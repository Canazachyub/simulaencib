import type { ApiResponse, ExamConfig, ExamMeta, Question, Course } from '../types';
import { DEFAULT_EXAM_ID, ENCIB_FALLBACK_CONFIG, ENCIB_FALLBACK_META, UPCOMING_EXAMS } from '../types';

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
// SESIONES (token emitido por el servidor en checkAccess / checkBanqueoAccess)
// ============================================

/** Error devuelto por el servidor con su código (AUTH_EXPIRED, QUOTA, TOKEN_USED, ...). */
export class ApiError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/** Sesión vencida o sin permiso: hay que volver a ingresar DNI y correo. */
export class AuthError extends ApiError {
  constructor(message: string, code: string) {
    super(message, code);
    this.name = 'AuthError';
  }
}

const AUTH_CODES = new Set(['AUTH_REQUIRED', 'AUTH_EXPIRED', 'FORBIDDEN']);

function toApiError(message: unknown, code: unknown): ApiError {
  const msg = String(message || 'Error del servidor');
  const c = String(code || 'ERROR');
  return AUTH_CODES.has(c) ? new AuthError(msg, c) : new ApiError(msg, c);
}

export interface SimSession {
  token: string;
  dni: string;
  email: string;
  exam: string;
  /** true = simulacro pagado con la cuenta SINAPSIS (token "cuenta"; no se renueva con DNI). */
  cuenta?: boolean;
}

const SIM_SESSION_KEY = 'sim_session';
const BANQUEO_TOKEN_KEY = 'banqueo_token';
const CUENTA_SESSION_KEY = 'cuenta_session';

function storageGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // sin sessionStorage
  }
}

/** Sesión del simulacro (DNI y correo verificados + token). */
export function getSimSession(): SimSession | null {
  try {
    const s = JSON.parse(storageGet(SIM_SESSION_KEY) || 'null') as SimSession | null;
    return s && s.dni ? s : null;
  } catch {
    return null;
  }
}

function setSimSession(s: SimSession | null) {
  storageSet(SIM_SESSION_KEY, s ? JSON.stringify(s) : null);
}

// ============================================
// CUENTA SINAPSIS (banqueo + simulacros pagados)
// ============================================

/** URL de sinapsisedu.com (con "/" final). */
export const SINAPSIS_URL = (import.meta.env.VITE_SINAPSIS_URL || 'https://sinapsisedu.com/').replace(/\/?$/, '/');
/** Login de SINAPSIS que, al entrar, vuelve al banqueo con un ticket. */
export const SINAPSIS_LOGIN_BANQUEO_URL = `${SINAPSIS_URL}#/login?next=banqueo`;
/** Planes (sección de plataformas de la landing de sinapsisedu.com). */
export const SINAPSIS_PLANES_URL = `${SINAPSIS_URL}#/plataformas`;
export const SINAPSIS_PORTAL_URL = `${SINAPSIS_URL}#/portal`;

/** id de examen del banqueo → slug de la plataforma en sinapsisedu.com */
const SLUG_POR_EXAMEN: Record<string, string> = { serums: 'encaps' };

/** Página de la plataforma de un examen en sinapsisedu.com (para comprar el acceso). */
export function sinapsisPlataformaUrl(examId: string): string {
  const id = examId.toLowerCase();
  return `${SINAPSIS_URL}#/plataforma/${SLUG_POR_EXAMEN[id] || id}`;
}

/** Sesión de la cuenta SINAPSIS (canjeada con loginTicket). */
export interface CuentaSession {
  token: string;
  exams: string[];
  nombre: string;
  correo: string;
  dni: string;
  /** Vencimiento del acceso por examen ('YYYY-MM-DD', '' = sin fecha). */
  fin: Record<string, string>;
}

export function getCuentaSession(): CuentaSession | null {
  try {
    const s = JSON.parse(storageGet(CUENTA_SESSION_KEY) || 'null') as CuentaSession | null;
    return s && s.token && Array.isArray(s.exams) ? s : null;
  } catch {
    return null;
  }
}

/** ¿La cuenta da acceso (banqueo y simulacros pagados) a este examen? */
export function cuentaPermiteExamen(examId: string): boolean {
  return !!getCuentaSession()?.exams.includes(examId.toLowerCase());
}

/** ¿Hay sesión del banqueo (cuenta SINAPSIS)? */
export function hasBanqueoSession(): boolean {
  return !!storageGet(BANQUEO_TOKEN_KEY);
}

/** Cierra la sesión de la cuenta (vencida o rechazada por el servidor). */
export function clearCuentaSession() {
  storageSet(CUENTA_SESSION_KEY, null);
  storageSet(BANQUEO_TOKEN_KEY, null);
  storageSet('banqueo_dni', null);
  storageSet('banqueo_email', null);
  if (getSimSession()?.cuenta) setSimSession(null);
}

function guardarCuenta(s: CuentaSession) {
  storageSet(CUENTA_SESSION_KEY, JSON.stringify(s));
  storageSet(BANQUEO_TOKEN_KEY, s.token);
  // Marca de agua y progreso local del banqueo
  storageSet('banqueo_dni', s.dni || null);
  storageSet('banqueo_email', s.correo || null);
  // Un simulacro gratis previo en esta pestaña no se mezcla con la cuenta
  const sim = getSimSession();
  if (sim && !sim.cuenta) setSimSession(null);
}

/**
 * Canjea el ticket de un solo uso que da sinapsisedu.com (portal o login ?next=banqueo) por la sesión
 * de la cuenta: banqueo + simulacros pagados de sus exámenes. Lanza ApiError con el mensaje del servidor.
 */
export async function loginTicket(ticket: string): Promise<CuentaSession> {
  if (USE_MOCK) {
    await mockDelay(400);
    const mock: CuentaSession = {
      token: 'mock', exams: ['encib', 'enam', 'rm', 'serums', 'essalud'], nombre: 'Alumno de prueba',
      correo: 'alumno@ejemplo.com', dni: '00000000', fin: {}
    };
    guardarCuenta(mock);
    return mock;
  }
  const d = await callApi<Partial<CuentaSession> & { token: string }>({ action: 'loginTicket', ticket }, 30000);
  const s: CuentaSession = {
    token: d.token,
    exams: (d.exams || []).map(e => String(e).toLowerCase()),
    nombre: d.nombre || '',
    correo: d.correo || '',
    dni: d.dni || '',
    fin: d.fin || {}
  };
  guardarCuenta(s);
  return s;
}

/**
 * Prepara el simulacro PAGADO con la cuenta: la sesión del simulacro usa el token de la cuenta
 * (sin formulario de DNI). Devuelve false si la cuenta no tiene ese examen.
 */
export function iniciarSimulacroConCuenta(examId: string): boolean {
  const c = getCuentaSession();
  const exam = examParam(examId);
  if (!c || !c.exams.includes(exam)) return false;
  setSimSession({ token: c.token, dni: c.dni, email: c.correo, exam, cuenta: true });
  return true;
}

/** GET a la API. Lanza ApiError/AuthError con el código del servidor, o BackendViejoError. */
async function callApi<T>(params: Record<string, string>, timeout = REQUEST_TIMEOUT): Promise<T> {
  const url = `${API_BASE_URL}?${new URLSearchParams(params).toString()}`;
  const response = await fetchWithTimeout(url, timeout);
  if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
  const result = await response.json();
  if (!result.success) {
    if (esAccionNoValida(result.error)) throw new BackendViejoError();
    throw toApiError(result.error, result.code);
  }
  const data = result.data as T & { error?: string };
  if (data && typeof data === 'object' && !Array.isArray(data) && data.error) throw new Error(data.error);
  return data;
}

/** Vuelve a pedir el token del simulacro gratis con el DNI/correo ya verificados (la cuenta no se renueva así). */
async function refreshSimToken(examId: string): Promise<string | null> {
  const s = getSimSession();
  if (!s || s.cuenta) return null;
  const r = await checkAccess(s.dni, s.email, examId);
  return r.canAccess && r.token ? r.token : null;
}

/**
 * El token de la cuenta no se renueva desde aquí (se renueva solo con cada uso, 6 h):
 * si venció, hay que volver a entrar desde sinapsisedu.com.
 */
async function refreshBanqueoToken(): Promise<string | null> {
  return null;
}

/**
 * Ejecuta una llamada con token; si el servidor dice que la sesión venció (o el token gratis ya se usó
 * y se permite renovarlo), pide un token nuevo una sola vez y reintenta.
 */
async function withToken<T>(
  getToken: () => string | null,
  refresh: () => Promise<string | null>,
  fn: (token: string) => Promise<T>,
  retryCodes: string[] = []
): Promise<T> {
  try {
    return await fn(getToken() || '');
  } catch (err) {
    const retry = err instanceof AuthError || (err instanceof ApiError && retryCodes.includes(err.code));
    if (!retry) throw err;
    const fresh = await refresh();
    if (!fresh) throw err instanceof AuthError ? err : new AuthError(err.message, err.code);
    return fn(fresh);
  }
}

const simToken = () => getSimSession()?.token ?? null;
const banqueoToken = () => storageGet(BANQUEO_TOKEN_KEY);

// ============================================
// CATÁLOGO DE EXÁMENES
// ============================================

export interface ExamCatalog {
  exams: ExamMeta[];
  /** true si el backend soporta ?action=exams (multi-examen); false = backend viejo, solo ENCIB */
  multiExam: boolean;
}

const ENCIB_ONLY_CATALOG: ExamCatalog = { exams: [ENCIB_FALLBACK_META, ...UPCOMING_EXAMS], multiExam: false };

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

/** Preguntas de un simulacro. attemptId = null → backend viejo/mock: las respuestas vienen incluidas y se califica en el navegador. */
export interface SimulacroLoad {
  questions: Question[];
  attemptId: string | null;
}

/** El servidor nuevo no envía la respuesta correcta: se marca con -1 hasta calificar. */
export const UNKNOWN_ANSWER = -1;

/**
 * Obtiene las preguntas aleatorias para el simulacro del examen indicado (requiere la sesión de checkAccess).
 */
export async function getQuestions(examId: string = DEFAULT_EXAM_ID): Promise<SimulacroLoad> {
  if (USE_MOCK) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return { questions: generateMockQuestions(), attemptId: null };
  }
  const exam = examParam(examId);
  try {
    const data = await withToken(
      simToken,
      () => refreshSimToken(exam),
      t => callApi<Question[] | { attemptId: string; questions: Question[] }>({ action: 'questions', exam, t }),
      ['TOKEN_USED']
    );
    const list = Array.isArray(data) ? data : (data?.questions || []);
    const attemptId = Array.isArray(data) ? null : data?.attemptId || null;
    return {
      attemptId,
      questions: list.map(q => ({
        ...q,
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : UNKNOWN_ANSWER,
        points: toNumber(q.points, 1)
      }))
    };
  } catch (error) {
    console.error('Error al obtener preguntas:', error);
    if (error instanceof AuthError) {
      throw new Error('Tu sesión expiró. Vuelve a "Tus datos" e ingresa tu DNI y correo otra vez.');
    }
    throw new Error(
      error instanceof Error
        ? error.message
        : 'No se pudo cargar el examen. Por favor, intenta de nuevo.'
    );
  }
}

export interface GradeItem {
  id: string;
  selected: number | null;
  /** Solo en simulacros pagados (el gratis no trae la clave de respuestas). */
  correctAnswer?: number;
  justification?: string | null;
  /** Solo en el simulacro gratis: si acertó. */
  correct?: boolean;
}

export interface GradeResult {
  exam: string;
  attemptId: string;
  correctAnswers: number;
  totalQuestions: number;
  rawScore: number;
  maxPoints: number;
  vigesimalScore: number;
  scaleMax: number;
  passing: number | null;
  saved: boolean;
  /** true = simulacro gratis: sin respuestas correctas ni justificaciones. */
  free?: boolean;
  courses?: { name: string; correct: number; total: number }[];
  results: GradeItem[];
}

/**
 * Califica el simulacro en el servidor (que además guarda el puntaje).
 * answers: respuesta elegida por pregunta, en el mismo orden en que llegaron (null = en blanco).
 */
export async function gradeSimulacro(examId: string, attemptId: string, answers: (number | null)[]): Promise<GradeResult> {
  const exam = examParam(examId);
  const encoded = answers.map(a => (a !== null && a >= 0 && a <= 9 ? String(a) : '-')).join('');
  try {
    return await withToken(
      simToken,
      () => refreshSimToken(exam),
      t => callApi<GradeResult>({ action: 'gradeSimulacro', exam, t, attemptId, answers: encoded }, 45000)
    );
  } catch (error) {
    if (error instanceof AuthError) {
      throw new Error('Tu sesión expiró y no se pudo renovar. Recarga la página para intentarlo de nuevo.');
    }
    throw error instanceof Error ? error : new Error('No se pudo calificar el examen. Intenta de nuevo.');
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
      t: simToken() || '',
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
      t: simToken() || '',
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
      t: simToken() || banqueoToken() || '',
      exam: examParam(examId),
      dni: dni // solo para el backend viejo: el nuevo usa el DNI del token
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
  /** Token de sesión del simulacro (servidor nuevo). */
  token?: string;
}

/**
 * Verifica si un usuario puede dar el simulacro GRATIS con detección de fraude
 * - Primer simulacro de cada examen por DNI: LIBRE
 * - Más intentos: solo con la cuenta SINAPSIS (loginTicket)
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
      return { canAccess: false, reason: result.error || 'Error de verificación - intenta de nuevo', attemptCount: 0 };
    }

    const data = result.data as AccessCheckResult;
    if (data.canAccess) {
      setSimSession({ token: data.token || '', dni, email: email.toLowerCase().trim(), exam: examParam(examId) });
    }
    return data;
  } catch (error) {
    console.error('Error al verificar acceso:', error);
    // En caso de error/timeout, DENEGAR acceso por seguridad
    return { canAccess: false, reason: 'No se pudo verificar - intenta de nuevo', attemptCount: 0 };
  }
}

// ============================================
// BANQUEO HISTÓRICO - CUENTA SINAPSIS (loginTicket)
// ============================================

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
 * Obtiene 10 preguntas aleatorias de un curso específico para el Banqueo
 */
export async function getBanqueoQuestions(courseName: string, examId: string = DEFAULT_EXAM_ID): Promise<BanqueoQuestionsResult> {
  if (USE_MOCK) {
    await mockDelay(500);
    const bank = mockBank(examParam(examId), courseName);
    const questions = [...bank].sort(() => Math.random() - 0.5).slice(0, 10);
    return { exam: examParam(examId), course: courseName, totalQuestions: questions.length, stock: bank.length, questions };
  }
  try {
    const exam = examParam(examId);
    return await withToken(banqueoToken, refreshBanqueoToken, t => callApi<BanqueoQuestionsResult>(
      { action: 'getBanqueoQuestions', exam, course: courseName, t }, 30000
    ));
  } catch (error) {
    console.error('Error al obtener preguntas del banqueo:', error);
    if (error instanceof ApiError) throw error;
    throw new Error(
      error instanceof Error
        ? error.message
        : 'No se pudo cargar las preguntas. Por favor, intenta de nuevo.'
    );
  }
}

// ============================================
// BANQUEO v2 — "Arma tu banqueo"
// ============================================

export interface BanqueoCatalogCourse {
  name: string;
  total: number;
  temas: { tema: string; total: number; subtemas: { subtema: string; total: number }[] }[];
  fuentes: { fuente: string; total: number }[];
}

export interface BanqueoCatalog {
  exam: string;
  courses: BanqueoCatalogCourse[];
}

export interface BanqueoIdItem {
  id: string;
  tema: string;
  subtema: string;
  fuente: string;
}

export const BANQUEO_LOTE = 30;

/** Error que indica que el Apps Script desplegado aún no tiene las acciones nuevas. */
export class BackendViejoError extends Error {
  constructor() {
    super('Actualiza el servidor para filtros y progreso');
    this.name = 'BackendViejoError';
  }
}

function esAccionNoValida(msg: unknown): boolean {
  return /acci[oó]n no v[aá]lida/i.test(String(msg || ''));
}

/** Llamada del banqueo con el token de sesión (se renueva solo si venció). */
function callBanqueo<T>(params: Record<string, string>, timeout = 30000): Promise<T> {
  return withToken(banqueoToken, refreshBanqueoToken, t => callApi<T>({ ...params, t }, timeout));
}

const catalogCache = new Map<string, Promise<BanqueoCatalog>>();
const idsCache = new Map<string, Promise<BanqueoIdItem[]>>();

/** Catálogo de cursos/temas/fuentes con totales. Lanza BackendViejoError si el servidor es el viejo. */
export function getBanqueoCatalog(examId: string = DEFAULT_EXAM_ID): Promise<BanqueoCatalog> {
  const exam = examParam(examId);
  let p = catalogCache.get(exam);
  if (!p) {
    p = USE_MOCK
      ? mockDelay(400).then(() => mockBanqueoCatalog(exam))
      : callApi<BanqueoCatalog>({ action: 'banqueoCatalog', exam }, 60000);
    p.catch(() => catalogCache.delete(exam));
    catalogCache.set(exam, p);
  }
  return p;
}

/** Todas las preguntas (ligeras) de un curso; los filtros finos se aplican en el cliente. */
export function getBanqueoIds(examId: string, course: string): Promise<BanqueoIdItem[]> {
  const exam = examParam(examId);
  const key = `${exam}|${course}`;
  let p = idsCache.get(key);
  if (!p) {
    p = USE_MOCK
      ? mockDelay(300).then(() => mockBank(exam, course).map(q => ({ id: q.id, tema: q.metadata.tema, subtema: q.metadata.subtema, fuente: q.sourceFile || 'Sin fuente' })))
      : callBanqueo<{ items: BanqueoIdItem[] }>({ action: 'banqueoIds', exam, course }, 60000).then(d => d.items || []);
    p.catch(() => idsCache.delete(key));
    idsCache.set(key, p);
  }
  return p;
}

/** Preguntas completas en el orden pedido (máx. 30 por llamada; si hay más, se trocea). */
export async function getBanqueoPorIds(examId: string, course: string, ids: string[]): Promise<BanqueoQuestion[]> {
  const exam = examParam(examId);
  const out: BanqueoQuestion[] = [];
  for (let i = 0; i < ids.length; i += BANQUEO_LOTE) {
    const chunk = ids.slice(i, i + BANQUEO_LOTE);
    if (USE_MOCK) {
      await mockDelay(500);
      const bank = new Map(mockBank(exam, course).map(q => [q.id, q]));
      chunk.forEach(id => { const q = bank.get(id); if (q) out.push(q); });
    } else {
      const data = await callBanqueo<{ questions: BanqueoQuestion[] }>({ action: 'banqueoPorIds', exam, course, ids: chunk.join(',') });
      out.push(...(data.questions || []));
    }
  }
  return out;
}

// ----- Mocks del banqueo v2 (VITE_USE_MOCK) -----
function mockDelay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const MOCK_FUENTES = ['ENAM 2023', 'ENAM 2021', 'ENAM 2019', 'RM 2019', 'ENCIB 2024', 'EsSalud 2022'];
const mockBankCache = new Map<string, BanqueoQuestion[]>();

function mockBank(exam: string, course: string): BanqueoQuestion[] {
  const key = `${exam}|${course}`;
  const hit = mockBankCache.get(key);
  if (hit) return hit;
  const topics = MOCK_TOPICS[course] || ['Tema general', 'Casos clínicos', 'Conceptos básicos'];
  const size = 40 + (course.length % 5) * 8;
  const slug = course.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase();
  const bank: BanqueoQuestion[] = Array.from({ length: size }, (_, i) => {
    const tema = topics[i % topics.length];
    const subtema = `${tema} — ${i % 3 === 0 ? 'clínica' : i % 3 === 1 ? 'fisiopatología' : 'diagnóstico'}`;
    const options = generateMockOptions(course).slice(0, 4);
    return {
      id: `m${slug}${String(i + 1).padStart(3, '0')}`,
      number: i + 1,
      questionText: generateMockQuestionText(course, tema, i % 2 === 0 ? 'Caso Clínico' : 'Problema', i + 1),
      questionType: i % 2 === 0 ? 'Caso Clínico' : 'Problema',
      options,
      correctAnswer: (i * 7) % options.length,
      imageLink: null,
      subject: course,
      sourceFile: MOCK_FUENTES[(i * 5) % MOCK_FUENTES.length],
      justification: `<p>Justificación de ejemplo para la pregunta ${i + 1} de <b>${tema}</b>.</p>`,
      points: 1,
      metadata: { numero: i + 1, curso: course, tema, subtema }
    };
  });
  mockBankCache.set(key, bank);
  return bank;
}

function mockBanqueoCatalog(exam: string): BanqueoCatalog {
  return {
    exam,
    courses: MOCK_CONFIG.courses.map(c => {
      const bank = mockBank(exam, c.name);
      const temas = new Map<string, Map<string, number>>();
      const fuentes = new Map<string, number>();
      bank.forEach(q => {
        const t = temas.get(q.metadata.tema) || new Map<string, number>();
        t.set(q.metadata.subtema, (t.get(q.metadata.subtema) || 0) + 1);
        temas.set(q.metadata.tema, t);
        const f = q.sourceFile || 'Sin fuente';
        fuentes.set(f, (fuentes.get(f) || 0) + 1);
      });
      return {
        name: c.name,
        total: bank.length,
        temas: [...temas].map(([tema, subs]) => ({
          tema,
          total: [...subs.values()].reduce((a, b) => a + b, 0),
          subtemas: [...subs].map(([subtema, total]) => ({ subtema, total }))
        })),
        fuentes: [...fuentes].map(([fuente, total]) => ({ fuente, total }))
      };
    })
  };
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
