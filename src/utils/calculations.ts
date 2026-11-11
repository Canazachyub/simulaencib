import type {
  Question,
  Answer,
  CourseResult,
  ExamResult,
  ExamConfig,
  Student,
  PerformanceLevel
} from '../types';
import { PERFORMANCE_THRESHOLDS, ENCIB_FALLBACK_CONFIG } from '../types';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function questionPoints(question: Question): number {
  const p = Number(question.points);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

/**
 * Calcula la nota en la escala del examen.
 * nota = (puntos obtenidos / puntos posibles) × scaleMax, con 2 decimales.
 */
export function calculateScaledScore(pointsEarned: number, pointsTotal: number, scaleMax: number = 20): number {
  if (pointsTotal <= 0) return 0;
  return round2((pointsEarned / pointsTotal) * scaleMax);
}

/**
 * Compatibilidad: nota vigesimal a partir de correctas (todas las preguntas valen lo mismo)
 */
export function calculateVigesimalScore(correctAnswers: number, totalQuestions: number = 100): number {
  return calculateScaledScore(correctAnswers, totalQuestions, 20);
}

/**
 * Calcula los resultados por curso. El orden sale de la configuración del examen;
 * los cursos que no estén en la configuración van al final en orden de aparición.
 */
export function calculateCourseResults(
  questions: Question[],
  answers: Answer[],
  courseOrder: string[] = []
): CourseResult[] {
  const answerById = new Map(answers.map(a => [a.questionId, a]));
  const groups = new Map<string, CourseResult>();

  questions.forEach((question) => {
    let group = groups.get(question.subject);
    if (!group) {
      group = {
        name: question.subject,
        correctAnswers: 0,
        totalQuestions: 0,
        percentage: 0,
        pointsEarned: 0,
        pointsTotal: 0
      };
      groups.set(question.subject, group);
    }
    const pts = questionPoints(question);
    group.totalQuestions += 1;
    group.pointsTotal += pts;
    if (answerById.get(question.id)?.isCorrect) {
      group.correctAnswers += 1;
      group.pointsEarned += pts;
    }
  });

  const results = Array.from(groups.values()).map(g => ({
    ...g,
    pointsEarned: round2(g.pointsEarned),
    pointsTotal: round2(g.pointsTotal),
    percentage: g.totalQuestions > 0 ? round2((g.correctAnswers / g.totalQuestions) * 100) : 0
  }));

  const firstSeen = new Map(results.map((r, i) => [r.name, i]));
  const orderIndex = (name: string) => {
    const idx = courseOrder.indexOf(name);
    return idx === -1 ? courseOrder.length + (firstSeen.get(name) ?? 0) : idx;
  };

  return results.sort((a, b) => orderIndex(a.name) - orderIndex(b.name));
}

/**
 * Determina el nivel de rendimiento según el porcentaje de respuestas correctas
 * ≥80% Excelente, ≥60% Bueno, ≥50% Regular, <50% Necesita práctica
 */
export function getPerformanceLevel(percentage: number): PerformanceLevel {
  if (percentage >= PERFORMANCE_THRESHOLDS.excellent) return 'excellent';
  if (percentage >= PERFORMANCE_THRESHOLDS.good) return 'good';
  if (percentage >= PERFORMANCE_THRESHOLDS.regular) return 'regular';
  return 'needs_practice';
}

/**
 * Calcula el resultado completo del simulacro para el examen indicado
 */
export function calculateExamResult(
  student: Student,
  questions: Question[],
  answers: Answer[],
  startTime: Date,
  config: ExamConfig = ENCIB_FALLBACK_CONFIG
): ExamResult {
  const courseResults = calculateCourseResults(
    questions,
    answers,
    config.courses.map(c => c.name)
  );

  const answerById = new Map(answers.map(a => [a.questionId, a]));
  let pointsEarned = 0;
  let pointsTotal = 0;
  let correctAnswers = 0;
  questions.forEach((q) => {
    const pts = questionPoints(q);
    pointsTotal += pts;
    if (answerById.get(q.id)?.isCorrect) {
      pointsEarned += pts;
      correctAnswers += 1;
    }
  });

  const totalQuestions = questions.length;
  const scaleMax = config.scaleMax > 0 ? config.scaleMax : 20;
  const score = calculateScaledScore(pointsEarned, pointsTotal, scaleMax);
  const percentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  const passing = config.passing ?? null;

  const totalTime = Math.round((new Date().getTime() - startTime.getTime()) / 1000);

  return {
    examId: config.id,
    examName: config.nombre,
    scaleMax,
    passing,
    passed: passing === null ? null : score >= passing,
    student,
    date: new Date(),
    correctAnswers,
    totalQuestions,
    rawScore: round2(pointsEarned),
    maxPoints: round2(pointsTotal),
    vigesimalScore: score,
    percentage: round2(percentage),
    courseResults,
    answers,
    totalTime,
    performanceLevel: getPerformanceLevel(percentage)
  };
}

/**
 * Formatea una duración en minutos (ej: 120 -> "2 horas", 90 -> "1 h 30 min")
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} minutos`;
  if (m === 0) return h === 1 ? '1 hora' : `${h} horas`;
  return `${h} h ${m} min`;
}

/**
 * Formato corto de duración (ej: 120 -> "2h", 90 -> "1h 30m")
 */
export function formatDurationShort(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Formatea puntos con hasta 2 decimales (1 -> "1", 0.111111 -> "0.11")
 */
export function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(2);
}

/**
 * Formatea el tiempo en formato MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formatea el tiempo en formato legible (ej: "1h 30min 45s")
 */
export function formatTimeReadable(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}min`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Formatea un número con separador de miles
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formatea una fecha en español
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Obtiene el color para un porcentaje (para gráficos)
 */
export function getColorForPercentage(percentage: number): string {
  if (percentage >= 80) return '#10B981'; // emerald
  if (percentage >= 60) return '#3B82F6'; // blue
  if (percentage >= 50) return '#F59E0B'; // amber
  return '#EF4444'; // red
}

/**
 * Convierte índice numérico a letra (0 -> A, 1 -> B, etc.)
 */
export function indexToLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * Valida un DNI peruano (8 dígitos)
 */
export function validateDNI(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

/**
 * Valida un nombre (al menos 3 caracteres, solo letras y espacios)
 */
export function validateName(name: string): boolean {
  return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{3,100}$/.test(name.trim());
}

/**
 * Formatea la nota vigesimal para mostrar (ej: "14.50")
 */
export function formatVigesimalScore(score: number): string {
  return score.toFixed(2);
}

/**
 * Obtiene el texto del nivel de rendimiento en español
 */
export function getPerformanceLevelText(level: PerformanceLevel): string {
  const texts: Record<PerformanceLevel, string> = {
    excellent: 'Excelente',
    good: 'Bueno',
    regular: 'Regular',
    needs_practice: 'Necesita práctica'
  };
  return texts[level];
}
