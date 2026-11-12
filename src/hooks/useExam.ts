import { create } from 'zustand';
import { useEffect } from 'react';
import type {
  ExamStore,
  Student,
  ExamConfig,
  ExamMeta,
  Question,
  Answer,
  ExamResult
} from '../types';
import { DEFAULT_EXAM_ID, ENCIB_FALLBACK_META, UPCOMING_EXAMS } from '../types';
import { getConfig, getQuestions, getExams, gradeSimulacro } from '../services/api';
import { calculateExamResult } from '../utils/calculations';

// ============================================
// EXAMEN SELECCIONADO (persistido en sessionStorage, o ?examen=<id> en la URL)
// ============================================
const EXAM_STORAGE_KEY = 'simulacro_exam';

function readStoredExamId(): string | null {
  try {
    return sessionStorage.getItem(EXAM_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeExamId(examId: string) {
  try {
    sessionStorage.setItem(EXAM_STORAGE_KEY, examId);
  } catch {
    // sessionStorage no disponible (modo privado, etc.)
  }
}

/** Lee ?examen=<id> (o ?exam=<id>) de la URL actual. */
export function readExamFromUrl(search: string = typeof window !== 'undefined' ? window.location.search : ''): string | null {
  const params = new URLSearchParams(search);
  const value = params.get('examen') || params.get('exam');
  return value ? value.toLowerCase().trim() : null;
}

function initialExamId(): string {
  const fromUrl = readExamFromUrl();
  if (fromUrl) {
    storeExamId(fromUrl);
    return fromUrl;
  }
  return readStoredExamId() || DEFAULT_EXAM_ID;
}

/** Configuración mínima a partir de los datos del examen (si la config no está cargada). */
function configFromMeta(meta: ExamMeta, questions: Question[]): ExamConfig {
  const courses: ExamConfig['courses'] = [];
  questions.forEach(q => {
    const existing = courses.find(c => c.name === q.subject);
    if (existing) existing.questionCount += 1;
    else courses.push({ code: courses.length + 1, name: q.subject, questionCount: 1, points: q.points || 1 });
  });
  return {
    id: meta.id,
    nombre: meta.nombre,
    descripcion: meta.descripcion,
    durationMinutes: meta.durationMinutes,
    alternatives: meta.alternatives,
    scaleMax: meta.scaleMax,
    passing: meta.passing,
    fuente: meta.fuente,
    totalQuestions: questions.length,
    maxScore: questions.reduce((s, q) => s + (q.points || 1), 0),
    courses
  };
}

let examsPromise: Promise<void> | null = null;

export const useExamStore = create<ExamStore>((set, get) => ({
  // Catálogo de exámenes (hasta saber qué soporta el backend, solo ENCIB)
  exams: [ENCIB_FALLBACK_META, ...UPCOMING_EXAMS],
  examsLoaded: false,
  multiExam: false,
  selectedExamId: initialExamId(),

  // Cargar el catálogo de exámenes (una sola vez)
  loadExams: () => {
    if (!examsPromise) {
      examsPromise = (async () => {
        const catalog = await getExams();
        const exams = catalog.exams.some(e => e.available) ? catalog.exams : [ENCIB_FALLBACK_META];
        const available = exams.filter(e => e.available);
        const current = get().selectedExamId;
        const valid = available.some(e => e.id === current);
        const selectedExamId = valid ? current : (available.find(e => e.id === DEFAULT_EXAM_ID)?.id ?? available[0].id);
        if (!valid) {
          storeExamId(selectedExamId);
        }
        set({
          exams,
          examsLoaded: true,
          multiExam: catalog.multiExam,
          selectedExamId,
          // Si el examen cambió, la config cargada ya no sirve
          ...(get().config && get().config!.id !== selectedExamId ? { config: null } : {})
        });
      })();
    }
    return examsPromise;
  },

  // Cambiar de examen
  selectExam: (examId: string) => {
    const id = examId.toLowerCase();
    const { exams, examsLoaded, selectedExamId } = get();
    // Con el catálogo ya cargado, solo se aceptan exámenes disponibles
    if (examsLoaded && !exams.some(e => e.id === id && e.available)) return;
    storeExamId(id);
    if (id === selectedExamId) return;
    set({
      selectedExamId: id,
      config: null,
      questions: [],
      attemptId: null,
      result: null,
      status: 'idle',
      error: null
    });
  },

  // Estado inicial
  status: 'idle',
  student: null,
  config: null,
  questions: [],
  currentQuestionIndex: 0,
  answers: [],
  savedAnswers: new Map(),
  result: null,
  error: null,
  startTime: null,
  attemptId: null,
  scoreSavedByServer: false,
  gradeError: null,

  // Establecer datos del estudiante
  setStudent: (student: Student) => {
    set({ student });
  },

  // Cargar configuración del examen seleccionado
  loadConfig: async () => {
    await get().loadExams();
    const examId = get().selectedExamId;
    set({ status: 'loading', error: null });

    try {
      const config: ExamConfig = await getConfig(examId);
      // Ignorar respuestas de un examen que ya no está seleccionado
      if (get().selectedExamId !== examId) return;
      set({ config: { ...config, id: examId }, status: 'idle' });
    } catch (error) {
      if (get().selectedExamId !== examId) return;
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Error al cargar configuración'
      });
    }
  },

  // Cargar preguntas del examen seleccionado
  loadQuestions: async () => {
    const examId = get().selectedExamId;
    set({ status: 'loading', error: null });

    try {
      const { questions, attemptId } = await getQuestions(examId);
      if (get().selectedExamId !== examId) return;
      if (questions.length === 0) {
        throw new Error('No hay preguntas disponibles para este examen por ahora.');
      }
      set({ questions, attemptId, scoreSavedByServer: false, gradeError: null, status: 'ready' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Error al cargar preguntas'
      });
    }
  },

  // Iniciar el examen
  startExam: () => {
    set({
      status: 'in_progress',
      currentQuestionIndex: 0,
      answers: [],
      savedAnswers: new Map(),
      startTime: new Date()
    });
  },

  // Guardar respuesta sin evaluar (durante el examen)
  saveAnswer: (questionId: string, selectedOption: number | null) => {
    const { savedAnswers } = get();
    const newSavedAnswers = new Map(savedAnswers);
    newSavedAnswers.set(questionId, selectedOption);
    set({ savedAnswers: newSavedAnswers });
  },

  // Registrar una respuesta (con evaluación - usado al finalizar)
  answerQuestion: (questionId: string, selectedOption: number | null, timeSpent: number) => {
    const { questions, answers } = get();
    const question = questions.find(q => q.id === questionId);

    if (!question) return;

    const isCorrect = selectedOption !== null && selectedOption === question.correctAnswer;

    const newAnswer: Answer = {
      questionId,
      selectedOption,
      isCorrect,
      timeSpent
    };

    set({ answers: [...answers, newAnswer] });
  },

  // Avanzar a la siguiente pregunta
  nextQuestion: () => {
    const { currentQuestionIndex, questions } = get();

    if (currentQuestionIndex < questions.length - 1) {
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    }
  },

  // Retroceder a la pregunta anterior
  previousQuestion: () => {
    const { currentQuestionIndex } = get();

    if (currentQuestionIndex > 0) {
      set({ currentQuestionIndex: currentQuestionIndex - 1 });
    }
  },

  // Ir a una pregunta específica
  goToQuestion: (index: number) => {
    const { questions } = get();

    if (index >= 0 && index < questions.length) {
      set({ currentQuestionIndex: index });
    }
  },

  // Finalizar el examen: el servidor califica (y guarda el puntaje); luego se arma el resultado
  finishExam: async () => {
    const { student, savedAnswers, startTime, config, exams, selectedExamId, attemptId } = get();
    let { questions } = get();

    if (!student || !startTime) return false;

    let scoreSavedByServer = false;
    if (attemptId) {
      set({ gradeError: null });
      try {
        const graded = await gradeSimulacro(
          selectedExamId,
          attemptId,
          questions.map(q => savedAnswers.get(q.id) ?? null)
        );
        const byId = new Map(graded.results.map(r => [r.id, r]));
        questions = questions.map(q => {
          const r = byId.get(q.id);
          return r ? { ...q, correctAnswer: r.correctAnswer, justification: r.justification } : q;
        });
        scoreSavedByServer = graded.saved;
      } catch (error) {
        set({ gradeError: error instanceof Error ? error.message : 'No se pudo calificar el examen. Intenta de nuevo.' });
        return false;
      }
    }

    // Convertir savedAnswers a Answer[] con evaluación
    const totalTime = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
    const timePerQuestion = totalTime / questions.length;

    const evaluatedAnswers: Answer[] = questions.map(question => {
      const selectedOption = savedAnswers.get(question.id) ?? null;
      const isCorrect = selectedOption !== null && selectedOption === question.correctAnswer;

      return {
        questionId: question.id,
        selectedOption,
        isCorrect,
        timeSpent: timePerQuestion
      };
    });

    // Calcular resultado con la configuración del examen (escala, nota mínima, orden de cursos)
    const examConfig = config && config.id === selectedExamId
      ? config
      : configFromMeta(exams.find(e => e.id === selectedExamId) ?? ENCIB_FALLBACK_META, questions);
    const result: ExamResult = calculateExamResult(
      student,
      questions,
      evaluatedAnswers,
      startTime,
      examConfig
    );

    set({ status: 'completed', result, answers: evaluatedAnswers, questions, scoreSavedByServer, gradeError: null });
    return true;
  },

  // Reiniciar el examen
  resetExam: () => {
    set({
      status: 'idle',
      student: null,
      questions: [],
      currentQuestionIndex: 0,
      answers: [],
      savedAnswers: new Map(),
      result: null,
      error: null,
      startTime: null,
      attemptId: null,
      scoreSavedByServer: false,
      gradeError: null
    });
  },

  // Establecer error
  setError: (error: string) => {
    set({ status: 'error', error });
  }
}));

// Hooks derivados para facilitar el uso
export function useCurrentQuestion() {
  const questions = useExamStore(state => state.questions);
  const currentIndex = useExamStore(state => state.currentQuestionIndex);
  return questions[currentIndex] || null;
}

export function useProgress() {
  const currentIndex = useExamStore(state => state.currentQuestionIndex);
  const totalQuestions = useExamStore(state => state.questions.length);
  const savedAnswers = useExamStore(state => state.savedAnswers);

  return {
    current: currentIndex + 1,
    total: totalQuestions,
    answered: savedAnswers.size,
    percentage: totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0
  };
}

export function useIsLastQuestion() {
  const currentIndex = useExamStore(state => state.currentQuestionIndex);
  const totalQuestions = useExamStore(state => state.questions.length);
  return currentIndex === totalQuestions - 1;
}

export function useIsFirstQuestion() {
  const currentIndex = useExamStore(state => state.currentQuestionIndex);
  return currentIndex === 0;
}

export function useSavedAnswer(questionId: string) {
  const savedAnswers = useExamStore(state => state.savedAnswers);
  return savedAnswers.get(questionId) ?? null;
}

/** Datos del examen seleccionado (meta del catálogo). */
export function useSelectedExam(): ExamMeta {
  const exams = useExamStore(state => state.exams);
  const selectedExamId = useExamStore(state => state.selectedExamId);
  return exams.find(e => e.id === selectedExamId) ?? exams[0] ?? ENCIB_FALLBACK_META;
}

/** Carga el catálogo de exámenes al montar el componente. */
export function useExamCatalog() {
  const loadExams = useExamStore(state => state.loadExams);
  const exams = useExamStore(state => state.exams);
  const examsLoaded = useExamStore(state => state.examsLoaded);
  const multiExam = useExamStore(state => state.multiExam);
  useEffect(() => {
    loadExams();
  }, [loadExams]);
  return { exams, examsLoaded, multiExam };
}
