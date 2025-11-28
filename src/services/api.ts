import type { ApiResponse, ExamConfig, Question, CourseType, COURSE_CONFIG } from '../types';
import { COURSES } from '../types';

// ============================================
// CONFIGURACIÓN DE LA API - SimulaENCIB
// ============================================

// URL del Google Apps Script desplegado como aplicación web
// Spreadsheet ID: 1S0HFMTZQ5wk4u5idfEH-NGKkmzG0Rp1OnBJMd7IFwWI
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://script.google.com/macros/s/TU_SCRIPT_ID_ENCIB/exec';

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

// ============================================
// FUNCIONES DE LA API
// ============================================

/**
 * Obtiene la configuración del examen ENCIB
 */
export async function getConfig(): Promise<ExamConfig> {
  try {
    const url = `${API_BASE_URL}?action=config`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const result: ApiResponse<ExamConfig> = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Error al obtener la configuración');
    }

    return result.data!;
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
 * Obtiene las preguntas aleatorias para el examen ENCIB
 * En ENCIB todos dan el mismo examen (no hay áreas)
 */
export async function getQuestions(): Promise<Question[]> {
  try {
    const url = `${API_BASE_URL}?action=questions`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const result: ApiResponse<Question[]> = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Error al obtener las preguntas');
    }

    return result.data!;
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
  dni: string;
  correctAnswers: number;
  totalQuestions: number;
  rawScore: number; // 0-100
  vigesimalScore: number; // 0-20
}

export interface HistoryEntry {
  fecha: string;
  correctas: number;
  total: number;
  puntaje: number; // rawScore
  notaVigesimal: number; // 0-20
  porcentaje: number;
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
      dni: data.dni,
      correctAnswers: data.correctAnswers.toString(),
      totalQuestions: data.totalQuestions.toString(),
      rawScore: data.rawScore.toString(),
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
export async function getUserHistory(dni: string): Promise<UserHistory | null> {
  try {
    const params = new URLSearchParams({
      action: 'getHistory',
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
}

/**
 * Verifica si un usuario puede dar el examen
 * - Primer examen: LIBRE
 * - Segundo+: Requiere estar en hoja "confirmado"
 */
export async function checkAccess(dni: string): Promise<AccessCheckResult> {
  try {
    const params = new URLSearchParams({
      action: 'checkAccess',
      dni: dni
    });

    const url = `${API_BASE_URL}?${params.toString()}`;
    const response = await fetchWithTimeout(url, 15000);

    if (!response.ok) {
      // Si hay error, permitir acceso por defecto
      return { canAccess: true, reason: 'Error de conexión', attemptCount: 0 };
    }

    const result = await response.json();

    if (!result.success) {
      return { canAccess: true, reason: 'Error de verificación', attemptCount: 0 };
    }

    return result.data as AccessCheckResult;
  } catch (error) {
    console.error('Error al verificar acceso:', error);
    // En caso de error, permitir el acceso para no bloquear usuarios
    return { canAccess: true, reason: 'Error de conexión', attemptCount: 0 };
  }
}

// ============================================
// DATOS DE PRUEBA (MOCK) PARA DESARROLLO
// ============================================

// Configuración mock del examen ENCIB (100 preguntas, 8 cursos)
export const MOCK_CONFIG: ExamConfig = {
  totalQuestions: 100,
  maxScore: 100, // 1 punto por pregunta
  courses: [
    { code: 1, name: 'Anatomía', questionCount: 16 },
    { code: 2, name: 'Embriología', questionCount: 7 },
    { code: 3, name: 'Histología', questionCount: 9 },
    { code: 4, name: 'Bioquímica', questionCount: 9 },
    { code: 5, name: 'Fisiología', questionCount: 16 },
    { code: 6, name: 'Patología', questionCount: 16 },
    { code: 7, name: 'Farmacología', questionCount: 16 },
    { code: 8, name: 'Microbiología-Parasitología', questionCount: 11 },
  ]
};

// Temas de ejemplo para preguntas mock de cada curso
const MOCK_TOPICS: Record<CourseType, string[]> = {
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
    const courseName = course.name as CourseType;
    const topics = MOCK_TOPICS[courseName] || ['Tema general'];

    for (let i = 0; i < course.questionCount; i++) {
      const topic = topics[i % topics.length];
      const questionType = i < course.questionCount * 0.7 ? 'Caso Clínico' : 'Problema';

      questions.push({
        id: `${course.name}-${i + 1}`,
        number: questionNumber++,
        questionText: generateMockQuestionText(courseName, topic, questionType, i + 1),
        questionType: questionType,
        options: generateMockOptions(courseName),
        correctAnswer: Math.floor(Math.random() * 5),
        timeSeconds: 180, // 3 minutos por pregunta (referencial)
        imageLink: null,
        subject: course.name,
        points: 1, // Siempre 1 punto en ENCIB
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
function generateMockQuestionText(course: CourseType, topic: string, type: string, num: number): string {
  if (type === 'Caso Clínico') {
    return `<b>Caso Clínico ${num}:</b> Paciente de 45 años acude a consulta por sintomatología relacionada con ${topic.toLowerCase()}. Al examen físico se encuentra... [${course}]<br><br>¿Cuál es el diagnóstico más probable?`;
  } else {
    return `<b>Pregunta ${num}:</b> En relación a ${topic.toLowerCase()} del área de ${course}, ¿cuál de las siguientes afirmaciones es correcta?`;
  }
}

/**
 * Genera opciones mock según el curso
 */
function generateMockOptions(course: CourseType): string[] {
  const baseOptions: Record<CourseType, string[]> = {
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
