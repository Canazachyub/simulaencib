import { create } from 'zustand';
import type {
  ExamStore,
  Student,
  ExamConfig,
  Question,
  Answer,
  ExamResult
} from '../types';
import { getConfig, getQuestions, MOCK_CONFIG, generateMockQuestions } from '../services/api';
import { calculateExamResult } from '../utils/calculations';

// Determinar si usar mock o API real
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !import.meta.env.VITE_API_URL;

export const useExamStore = create<ExamStore>((set, get) => ({
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

  // Establecer datos del estudiante
  setStudent: (student: Student) => {
    set({ student });
  },

  // Cargar configuración del examen ENCIB
  loadConfig: async () => {
    set({ status: 'loading', error: null });

    try {
      let config: ExamConfig;

      if (USE_MOCK) {
        // Simular delay de red
        await new Promise(resolve => setTimeout(resolve, 500));
        config = MOCK_CONFIG;
      } else {
        config = await getConfig();
      }

      set({ config, status: 'idle' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Error al cargar configuración'
      });
    }
  },

  // Cargar preguntas del examen ENCIB (sin parámetro de área)
  loadQuestions: async () => {
    set({ status: 'loading', error: null });

    try {
      let questions: Question[];

      if (USE_MOCK) {
        // Simular delay de red
        await new Promise(resolve => setTimeout(resolve, 1000));
        questions = generateMockQuestions();
      } else {
        questions = await getQuestions();
      }

      set({ questions, status: 'ready' });
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

  // Finalizar el examen y calcular resultados
  finishExam: () => {
    const { student, questions, savedAnswers, startTime } = get();

    if (!student || !startTime) return;

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

    // Calcular resultado del examen ENCIB (sin areaConfig)
    const result: ExamResult = calculateExamResult(
      student,
      questions,
      evaluatedAnswers,
      startTime
    );

    set({ status: 'completed', result, answers: evaluatedAnswers });
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
      startTime: null
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
