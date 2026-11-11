import type { ApiResponse, ExamConfig, ExamMeta, Question, Course } from '../types';
import { DEFAULT_EXAM_ID, ENCIB_FALLBACK_CONFIG, ENCIB_FALLBACK_META } from '../types';

// ============================================
// CONFIGURACIÓN DE LA API - Simulacros SINAPSIS (multi-examen)
// ============================================

// URL del Google Apps Script desplegado como aplicación web
// Spreadsheet ID: 1S0HFMTZQ5wk4u5idfEH-NGKkmzG0Rp1OnBJMd7IFwWI
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://script.google.com/macros/s/TU_SCRIPT_ID_ENCIB/exec';

// Usar datos de prueba (mock) en lugar de la API real
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !import.meta.env.VITE_API_URL;

// Timeout para las peticiones (30 segundos)
const REQUEST_TIMEOUT = 30000;

// ============================================
// FUNCIONES DE FETCH CON MANEJO DE ERRORES
// ============================================

async function fetchWithTimeout(url: string, timeout: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado tiempo. Por favor, intenta de nuevo.');
    }
    throw error;
  }
}

function examParam(examId?: string): string {
  return (examId || DEFAULT_EXAM_ID).toLowerCase();
}

// ============================================
// CATÁLOGO DE EXÁMENES
// ============================================

export interface ExamCatalog {
  exams: ExamMeta[];
  /** true si el backend soporta ?action=exams (multi-examen); false = backend viejo, solo ENCIB */
  multiExam: boolean;
}

const ENCIB_ONLY_CATALOG: ExamCatalog = { exams: [ENCIB_FALLBACK_META], multiExam: false };

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function toPassing(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  if (value === undefined || value === '') return fallback;
  const n = toNumber(value, NaN);
  return Number.isFinite(n) ? n : fallback;
}

type RawRecord = Record<string, unknown>;

function normalizeExamMeta(raw: RawRecord): ExamMeta | null {
  if (!raw || typeof raw.id !== 'string' || !raw.id) return null;
  const id = raw.id.toLowerCase();
  const base = id === ENCIB_FALLBACK_META.id ? ENCIB_FALLBACK_META : null;
  return {
    id,
    nombre: String(raw.nombre || base?.nombre || id.toUpperCase()),
    descripcion: String(raw.descripcion || base?.descripcion || ''),
    durationMinutes: toNumber(raw.durationMinutes, base?.durationMinutes ?? 120),
    alternatives: toNumber(raw.alternatives, base?.alternatives ?? 4),
    scaleMax: toNumber(raw.scaleMax, base?.scaleMax ?? 20),
    passing: toPassing(raw.passing, base ? base.passing : null),
    fuente: String(raw.fuente || base?.fuente || ''),
    totalQuestions: toNumber(raw.totalQuestions, base?.totalQuestions ?? 0),
    courseCount: toNumber(raw.courseCount, base?.courseCount ?? 0),
    available: raw.available !== false
  };
}

let catalogPromise: Promise<ExamCatalog> | null = null;

/**
 * Obtiene la lista de exámenes disponibles.
 * Si el backend es el viejo (responde "Acción no válida" a action=exams) o la llamada falla,
 * devuelve un catálogo con solo ENCIB construido localmente.
 */
export function getExams(): Promise<ExamCatalog> {
  if (USE_MOCK) {
    return Promise.resolve(ENCIB_ONLY_CATALOG);
  }
  if (!catalogPromise) {
    catalogPromise = (async (): Promise<ExamCatalog> => {
      try {
        const response = await fetchWithTimeout(`${API_BASE_URL}?action=exams`, 20000);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const result: ApiResponse<unknown> = await response.json();
        if (!result.success || !Array.isArray(result.data)) {
          // Backend viejo (no conoce action=exams): solo ENCIB
          return ENCIB_ONLY_CATALOG;
        }
        const exams = (result.data as RawRecord[])
          .map(normalizeExamMeta)
          .filter((e): e is ExamMeta => e !== null);
        if (exams.length === 0) return ENCIB_ONLY_CATALOG;
        return { exams, multiExam: true };
      } catch (error) {
        console.warn('No se pudo obtener la lista de exámenes, se usa solo ENCIB:', error);
        catalogPromise = null; // permitir reintentar en la próxima llamada
        return ENCIB_ONLY_CATALOG;
      }
    })();
  }
  return catalogPromise;
}

/**
 * Completa una configuración recibida del backend. El backend viejo solo devuelve
 * {courses, totalQuestions, maxScore}; en ese caso se completa con los datos de ENCIB.
 */
function normalizeConfig(raw: RawRecord, examId: string): ExamConfig {
  const id = (typeof raw.id === 'string' && raw.id ? raw.id : examId).toLowerCase();
  const base = id === ENCIB_FALLBACK_CONFIG.id ? ENCIB_FALLBACK_CONFIG : null;
  const rawCourses = (Array.isArray(raw.courses) ? raw.courses : (base?.courses ?? [])) as RawRecord[];
  const courses: Course[] = rawCourses.map((c, i) => ({
    code: toNumber(c.code, i + 1),
    name: String(c.name),
    questionCount: toNumber(c.questionCount, 0),
    points: toNumber(c.points, 1)
  }));
  const totalQuestions = courses.reduce((sum, c) => sum + c.questionCount, 0);
  const maxScore = Math.round(courses.reduce((sum, c) => sum + c.questionCount * c.points, 0) * 100) / 100;
  return {
    id,
    nombre: String(raw.nombre || base?.nombre || id.toUpperCase()),
    descripcion: String(raw.descripcion || base?.descripcion || ''),
    durationMinutes: toNumber(raw.durationMinutes, base?.durationMinutes ?? 120),
    alternatives: toNumber(raw.alternatives, base?.alternatives ?? 4),
    scaleMax: toNumber(raw.scaleMax, base?.scaleMax ?? 20),
    passing: toPassing(raw.passing, base ? base.passing : null),
    fuente: String(raw.fuente || base?.fuente || ''),
    totalQuestions: toNumber(raw.totalQuestions, totalQuestions),
    maxScore: toNumber(raw.maxScore, maxScore),
    courses
  };
}

/**
 * Obtiene la configuración de un examen (por defecto ENCIB)
 */
export async function getConfig(examId: string = DEFAULT_EXAM_ID): Promise<ExamConfig> {
  if (USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return MOCK_CONFIG;
  }
  try {
    const params = new URLSearchParams({ action: 'config', exam: examParam(examId) });
    const url = `${API_BASE_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const result: ApiResponse<RawRecord> = await response.json();

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Error al obtener la configuración');
    }

    return normalizeConfig(result.data, examParam(examId));
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'No se pudo conectar con el servidor. Verifica tu conexión a internet.'
    );
  }
}

/**
 * Obtiene las preguntas aleatorias para el simulacro del examen indicado
 */
export async function getQuestions(examId: string = DEFAULT_EXAM_ID): Promise<Question[]> {
  if (USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return generateMockQuestions();
  }
  try {
    const params = new URLSearchParams({ action: 'questions', exam: examParam(examId) });
    const url = `${API_BASE_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const result: ApiResponse<Question[]> = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Error al obtener las preguntas');
    }

    return (result.data || []).map(q => ({
      ...q,
      points: toNumber(q.points, 1)
    }));
  } catch (error) {
    console.error('Error al obtener preguntas:', error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'No se pudo cargar el examen. Por favor, intenta de nuevo.'
    );
  }
}

/**
 * Verifica que la API esté disponible
 */
export async function testConnection(): Promise<boolean> {
  try {
    const url = `${API_BASE_URL}?action=test`;
    const response = await fetchWithTimeout(url, 10000);

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.success === true;
  } catch {
    return false;
  }
}

/**
 * Registra un usuario en la hoja "usuarios" de Google Sheets
 */
export interface UserRegistration {
  dni: string;
  fullName: string;
  email: string;
  phone: string;
  university: string; // Universidad de procedencia
}

export async function registerUser(user: UserRegistration): Promise<void> {
  try {
    const params = new URLSearchParams({
      action: 'register',
      dni: user.dni,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      university: user.university
    });

    const url = `${API_BASE_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url, 15000);

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Error al registrar usuario');
    }
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    throw error;
  }
}

// ============================================
// HISTORIAL DE PUNTAJES
// ============================================

export interface ScoreData {
  exam: string;
  dni: string;
  correctAnswers: number;
  totalQuestions: number;
  rawScore: number; // Puntos obtenidos
  vigesimalScore: number; // Nota en la escala del examen (0..scaleMax)
}

export interface HistoryEntry {
  fecha: string;
  correctas: number;
  total: number;
  puntaje: number; // rawScore
  notaVigesimal: number; // 0-20
  porcentaje: number;
  examen?: string;
}

export interface UserHistory {
  dni: string;
  totalIntentos: number;
  history: HistoryEntry[];
  mejorPuntaje: number;
  mejorNota: number; // vigesimal
  ultimoPuntaje: number;
  ultimaNota: number; // vigesimal
}

/**
 * Guarda el puntaje de un usuario en Google Sheets
 */
export async function saveScore(data: ScoreData): Promise<void> {
  try {
    const params = new URLSearchParams({
      action: 'saveScore',
      exam: examParam(data.exam),
      dni: data.dni,
      correctAnswers: data.correctAnswers.toString(),
      totalQuestions: data.totalQuestions.toString(),
      rawScore: (Math.round(data.rawScore * 100) / 100).toString(),
      vigesimalScore: data.vigesimalScore.toFixed(2)
    });

    const url = `${API_BASE_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url, 15000);

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Error al guardar puntaje');
    }
  } catch (error) {
    console.error('Error al guardar puntaje:', error);
    // No lanzamos el error para no bloquear la experiencia del usuario
  }
}

/**
 * Obtiene el historial de puntajes de un usuario por DNI
 */
export async function getUserHistory(dni: string, examId: string = DEFAULT_EXAM_ID): Promise<UserHistory | null> {
  try {
    const params = new URLSearchParams({
      action: 'getHistory',
      exam: examParam(examId),
      dni: dni
    });

    const url = `${API_BASE_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url, 15000);

    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    if (!result.success) {
      return null;
    }

    return result.data as UserHistory;
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return null;
  }
}

// ============================================
// VERIFICACIÓN DE ACCESO
// ============================================

export interface AccessCheckResult {
  canAccess: boolean;
  reason: string;
  attemptCount: number;
  isFirstAttempt?: boolean;
  isConfirmed?: boolean;
  isFraudAttempt?: boolean;
}

/**
 * Verifica si un usuario puede dar el examen con detección de fraude
 * - Primer examen: LIBRE
 * - Segundo+: Requiere estar en hoja "confirmado"
 * - Detecta si el DNI/Email ya fueron usados con datos diferentes
 */
export async function checkAccess(dni: string, email: string, examId: string = DEFAULT_EXAM_ID): Promise<AccessCheckResult> {
  try {
    const params = new URLSearchParams({
      action: 'checkAccess',
      exam: examParam(examId),
      dni: dni,
      email: email.toLowerCase().trim()
    });

    const url = `${API_BASE_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url, 20000); // 20 segundos

    if (!response.ok) {
      // Si hay error de servidor, DENEGAR acceso por seguridad
      return { canAccess: false, reason: 'Error de conexión - intenta de nuevo', attemptCount: 0 };
    }

    const result = await response.json();

    if (!result.success) {
      return { canAccess: false, reason: 'Error de verificación - intenta de nuevo', attemptCount: 0 };
    }

    return result.data as AccessCheckResult;
  } catch (error) {
    console.error('Error al verificar acceso:', error);
    // En caso de error/timeout, DENEGAR acceso por seguridad
    return { canAccess: false, reason: 'No se pudo verificar - intenta de nuevo', attemptCount: 0 };
  }
}

// ============================================
// BANQUEO HISTÓRICO - SOLO USUARIOS CONFIRMADOS
// ============================================

export interface BanqueoAccessResult {
  canAccess: boolean;
  reason: string;
  isConfirmed?: boolean;
}

export interface BanqueoQuestion {
  id: string;
  number: number;
  questionText: string;
  questionType: string;
  options: string[];
  correctAnswer: number;
  imageLink: string | null;
  subject: string;
  sourceFile: string | null;
  justification: string | null;
  points?: number;
  metadata: {
    numero: number | string | null;
    curso?: string | null;
    tema: string;
    subtema: string;
  };
}

export interface BanqueoQuestionsResult {
  exam?: string;
  stock?: number;
  course: string;
  totalQuestions: number;
  questions: BanqueoQuestion[];
  error?: string;
}

/**
 * Verifica si un usuario puede acceder al Banqueo Histórico
 * SOLO usuarios confirmados (NO hay intento gratis)
 */
export async function checkBanqueoAccess(dni: string, email: string): Promise<BanqueoAccessResult> {
  try {
    const params = new URLSearchParams({
      action: 'checkBanqueoAccess',
      dni: dni,
      email: email.toLowerCase().trim()
    });

    const url = `${API_BASE_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url, 20000);

    if (!response.ok) {
      return { canAccess: false, reason: 'Error de conexión - intenta de nuevo' };
    }

    const result = await response.json();

    if (!result.success) {
      return { canAccess: false, reason: 'Error de verificación' };
    }

    return result.data as BanqueoAccessResult;
  } catch (error) {
    console.error('Error al verificar acceso a banqueo:', error);
    return { canAccess: false, reason: 'No se pudo verificar - intenta de nuevo' };
  }
}

/**
 * Obtiene 10 preguntas aleatorias de un curso específico para el Banqueo
 */
export async function getBanqueoQuestions(courseName: string, examId: string = DEFAULT_EXAM_ID): Promise<BanqueoQuestionsResult> {
  try {
    const params = new URLSearchParams({
      action: 'getBanqueoQuestions',
      exam: examParam(examId),
      course: courseName
    });

    const url = `${API_BASE_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url, 20000);

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Error al obtener preguntas');
    }

    return result.data as BanqueoQuestionsResult;
  } catch (error) {
    console.error('Error al obtener preguntas del banqueo:', error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'No se pudo cargar las preguntas. Por favor, intenta de nuevo.'
    );
  }
}

// Cursos de ENCIB para el banqueo (respaldo; los cursos salen de la config de cada examen)
export const BANQUEO_COURSES = ENCIB_FALLBACK_CONFIG.courses.map(c => ({ code: c.code, name: c.name }));

// ============================================
// DATOS DE PRUEBA (MOCK) PARA DESARROLLO
// ============================================

// Configuración mock del examen ENCIB (100 preguntas, 8 cursos)
export const MOCK_CONFIG: ExamConfig = ENCIB_FALLBACK_CONFIG;

// Temas de ejemplo para preguntas mock de cada curso
const MOCK_TOPICS: Record<string, string[]> = {
  'Anatomía': [
    'Generalidades y planimetría', 'Miembro superior', 'Miembro inferior',
    'Cabeza y cuello', 'Sistema nervioso', 'Tórax', 'Abdomen', 'Pelvis'
  ],
  'Embriología': [
    'Gametogénesis', 'Fertilización', 'Gastrulación', 'Neurulación',
    'Embriología cardiovascular', 'Anomalías congénitas'
  ],
  'Histología': [
    'Tejido epitelial', 'Tejido conectivo', 'Tejido muscular',
    'Tejido nervioso', 'Sistema circulatorio', 'Órganos de los sentidos'
  ],
  'Bioquímica': [
    'Carbohidratos', 'Lípidos', 'Proteínas', 'Enzimas',
    'Metabolismo energético', 'Señalización celular'
  ],
  'Fisiología': [
    'Cardiovascular', 'Respiratoria', 'Digestiva', 'Renal',
    'Endocrina', 'Sistema nervioso', 'Hemato-inmune'
  ],
  'Patología': [
    'Lesión celular', 'Inflamación', 'Neoplasias', 'Hemodinamia',
    'Inmunopatología', 'Patología infecciosa', 'Patología por sistemas'
  ],
  'Farmacología': [
    'Farmacocinética', 'Farmacodinamia', 'Sistema nervioso autónomo',
    'Analgésicos', 'Antibióticos', 'Antihipertensivos', 'Antidiabéticos'
  ],
  'Microbiología-Parasitología': [
    'Bacteriología', 'Virología', 'Micología',
    'Protozoos', 'Helmintos', 'Artrópodos'
  ]
};

// Tipos de pregunta ENCIB
const QUESTION_TYPES = ['Caso Clínico', 'Problema'];

/**
 * Genera preguntas de prueba para desarrollo (ENCIB - 100 preguntas)
 */
export function generateMockQuestions(): Question[] {
  const questions: Question[] = [];
  let questionNumber = 1;

  // Mantener orden por curso (NO mezclar)
  MOCK_CONFIG.courses.forEach((course) => {
    const courseName = course.name;
    const topics = MOCK_TOPICS[courseName] || ['Tema general'];

    for (let i = 0; i < course.questionCount; i++) {
      const topic = topics[i % topics.length];
      const questionType = i < course.questionCount * 0.7 ? 'Caso Clínico' : 'Problema';

      questions.push({
        id: `${course.name}-${i + 1}`,
        number: questionNumber++,
        questionText: generateMockQuestionText(courseName, topic, questionType, i + 1),
        questionType: questionType,
        options: generateMockOptions(courseName).slice(0, MOCK_CONFIG.alternatives),
        correctAnswer: Math.floor(Math.random() * MOCK_CONFIG.alternatives),
        timeSeconds: 180, // 3 minutos por pregunta (referencial)
        imageLink: null,
        subject: course.name,
        points: course.points,
        sourceFile: `ENCIB_${new Date().getFullYear()}.pdf`,
        metadata: {
          numero: i + 1,
          tema: topic,
          subtema: `Subtema de ${topic}`
        }
      });
    }
  });

  // NO mezclar - mantener orden por curso
  return questions;
}

/**
 * Genera texto de pregunta mock según el curso
 */
function generateMockQuestionText(course: string, topic: string, type: string, num: number): string {
  if (type === 'Caso Clínico') {
    return `<b>Caso Clínico ${num}:</b> Paciente de 45 años acude a consulta por sintomatología relacionada con ${topic.toLowerCase()}. Al examen físico se encuentra... [${course}]<br><br>¿Cuál es el diagnóstico más probable?`;
  } else {
    return `<b>Pregunta ${num}:</b> En relación a ${topic.toLowerCase()} del área de ${course}, ¿cuál de las siguientes afirmaciones es correcta?`;
  }
}

/**
 * Genera opciones mock según el curso
 */
function generateMockOptions(course: string): string[] {
  const baseOptions: Record<string, string[]> = {
    'Anatomía': ['Estructura A del sistema musculoesquelético', 'Estructura B del sistema vascular', 'Estructura C del sistema nervioso', 'Estructura D del sistema linfático', 'Ninguna de las anteriores'],
    'Embriología': ['Alteración en la gastrulación', 'Defecto en la neurulación', 'Anomalía del desarrollo cardiovascular', 'Malformación de arcos branquiales', 'Displasia del mesodermo'],
    'Histología': ['Tejido epitelial simple', 'Tejido conectivo denso', 'Tejido muscular estriado', 'Tejido nervioso periférico', 'Tejido linfoide asociado'],
    'Bioquímica': ['Inhibición enzimática competitiva', 'Activación alostérica positiva', 'Fosforilación oxidativa', 'Gluconeogénesis hepática', 'Beta oxidación mitocondrial'],
    'Fisiología': ['Aumento del gasto cardíaco', 'Disminución de la resistencia periférica', 'Alteración del filtrado glomerular', 'Modificación de la ventilación alveolar', 'Cambio en la motilidad intestinal'],
    'Patología': ['Necrosis coagulativa', 'Inflamación granulomatosa', 'Metaplasia escamosa', 'Hiperplasia reactiva', 'Displasia de alto grado'],
    'Farmacología': ['Inhibidor de la ECA', 'Bloqueador de canales de calcio', 'Agonista beta-adrenérgico', 'Antagonista muscarínico', 'Inhibidor de la COX-2'],
    'Microbiología-Parasitología': ['Staphylococcus aureus', 'Escherichia coli', 'Candida albicans', 'Plasmodium falciparum', 'Ascaris lumbricoides']
  };

  return baseOptions[course] || [
    'Opción A - Primera alternativa',
    'Opción B - Segunda alternativa',
    'Opción C - Tercera alternativa',
    'Opción D - Cuarta alternativa',
    'Opción E - Quinta alternativa'
  ];
}
