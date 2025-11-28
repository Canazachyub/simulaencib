import type {
  Question,
  Answer,
  CourseResult,
  ExamResult,
  Student,
  PerformanceLevel
} from '../types';
import { PERFORMANCE_THRESHOLDS } from '../types';

/**
 * Calcula la nota vigesimal (0-20) a partir de las respuestas correctas
 * Fórmula: nota = correctas / 5 (o equivalentemente: correctas * 20 / 100)
 */
export function calculateVigesimalScore(correctAnswers: number, totalQuestions: number = 100): number {
  const vigesimal = (correctAnswers / totalQuestions) * 20;
  return Math.round(vigesimal * 100) / 100; // 2 decimales
}

/**
 * Calcula los resultados por curso (ENCIB tiene 8 cursos)
 */
export function calculateCourseResults(
  questions: Question[],
  answers: Answer[]
): CourseResult[] {
  // Agrupar preguntas por curso
  const courseGroups = new Map<string, { questions: Question[]; answers: Answer[] }>();

  questions.forEach((question) => {
    if (!courseGroups.has(question.subject)) {
      courseGroups.set(question.subject, { questions: [], answers: [] });
    }
    courseGroups.get(question.subject)!.questions.push(question);
  });

  // Asociar respuestas con sus preguntas
  answers.forEach((answer) => {
    const question = questions.find(q => q.id === answer.questionId);
    if (question && courseGroups.has(question.subject)) {
      courseGroups.get(question.subject)!.answers.push(answer);
    }
  });

  // Calcular resultados por curso
  const results: CourseResult[] = [];

  courseGroups.forEach((data, courseName) => {
    const correctAnswers = data.answers.filter(a => a.isCorrect).length;
    const totalQuestions = data.questions.length;
    const percentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    results.push({
      name: courseName,
      correctAnswers,
      totalQuestions,
      percentage: Math.round(percentage * 100) / 100
      // No hay puntos ponderados en ENCIB - cada correcta = 1 punto
    });
  });

  // Ordenar por nombre de curso (mantener orden del examen)
  const courseOrder = [
    'Anatomía', 'Embriología', 'Histología', 'Bioquímica',
    'Fisiología', 'Patología', 'Farmacología', 'Microbiología-Parasitología'
  ];

  return results.sort((a, b) => {
    const indexA = courseOrder.indexOf(a.name);
    const indexB = courseOrder.indexOf(b.name);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}

/**
 * Determina el nivel de rendimiento según las respuestas correctas
 * Basado en: ≥80 Excelente, ≥60 Bueno, ≥50 Regular, <50 Necesita práctica
 */
export function getPerformanceLevel(correctAnswers: number): PerformanceLevel {
  if (correctAnswers >= PERFORMANCE_THRESHOLDS.excellent) return 'excellent';
  if (correctAnswers >= PERFORMANCE_THRESHOLDS.good) return 'good';
  if (correctAnswers >= PERFORMANCE_THRESHOLDS.regular) return 'regular';
  return 'needs_practice';
}

/**
 * Calcula el resultado completo del examen ENCIB
 */
export function calculateExamResult(
  student: Student,
  questions: Question[],
  answers: Answer[],
  startTime: Date
): ExamResult {
  const courseResults = calculateCourseResults(questions, answers);

  // Calcular totales
  const correctAnswers = answers.filter(a => a.isCorrect).length;
  const totalQuestions = questions.length; // 100
  const rawScore = correctAnswers; // 1 punto por correcta
  const vigesimalScore = calculateVigesimalScore(correctAnswers, totalQuestions);
  const percentage = (correctAnswers / totalQuestions) * 100;

  const totalTime = Math.round((new Date().getTime() - startTime.getTime()) / 1000);

  return {
    student,
    date: new Date(),
    correctAnswers,
    totalQuestions,
    rawScore,
    vigesimalScore,
    percentage: Math.round(percentage * 100) / 100,
    courseResults,
    answers,
    totalTime,
    performanceLevel: getPerformanceLevel(correctAnswers)
  };
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
