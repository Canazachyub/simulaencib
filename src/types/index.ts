// ============================================
// TIPOS PRINCIPALES DEL SISTEMA - SimulaENCIB
// ============================================

// Cursos del ENCIB (8 cursos de ciencias básicas)
export type CourseType =
  | 'Anatomía'
  | 'Embriología'
  | 'Histología'
  | 'Bioquímica'
  | 'Fisiología'
  | 'Patología'
  | 'Farmacología'
  | 'Microbiología-Parasitología';

// Estados del examen
export type ExamStatus = 'idle' | 'loading' | 'ready' | 'in_progress' | 'completed' | 'error';

// ============================================
// DATOS DEL ESTUDIANTE
// ============================================
export interface Student {
  dni: string;
  fullName: string;
  university?: string; // Universidad de procedencia (opcional)
}

// ============================================
// CONFIGURACIÓN DE CURSOS
// ============================================
export interface Course {
  code: number;
  name: CourseType;
  questionCount: number;
  // En ENCIB cada pregunta vale 1 punto, no hay ponderación
}

export interface ExamConfig {
  courses: Course[];
  totalQuestions: number; // 100
  maxScore: number; // 100 (1 punto por pregunta)
}

// ============================================
// PREGUNTAS Y OPCIONES
// ============================================
export interface QuestionMetadata {
  numero?: string | number;
  tema?: string;
  subtema?: string;
}

export interface Question {
  id: string;
  number: number; // Número de pregunta global (1-100)
  questionText: string;
  questionType: string; // "Caso Clínico" o "Problema"
  options: string[];
  correctAnswer: number; // Índice 0-based de la respuesta correcta
  timeSeconds: number;
  imageLink: string | null;
  subject: string; // Nombre del curso (CourseType)
  points: number; // Siempre 1 en ENCIB
  sourceFile?: string | null;
  justification?: string | null; // Explicación de la respuesta correcta
  metadata?: QuestionMetadata;
}

// ============================================
// RESPUESTAS DEL ESTUDIANTE
// ============================================
export interface Answer {
  questionId: string;
  selectedOption: number | null; // null si no respondió
  isCorrect: boolean;
  timeSpent: number; // Segundos que tardó en responder
}

// ============================================
// RESULTADOS DEL EXAMEN
// ============================================
export interface CourseResult {
  name: string;
  correctAnswers: number;
  totalQuestions: number;
  percentage: number;
  // No hay puntos ponderados en ENCIB - cada correcta = 1 punto
}

export interface ExamResult {
  student: Student;
  date: Date;
  correctAnswers: number; // Total de respuestas correctas (0-100)
  totalQuestions: number; // 100
  rawScore: number; // Puntaje bruto (= correctAnswers)
  vigesimalScore: number; // Nota vigesimal (0-20)
  percentage: number; // Porcentaje (0-100)
  courseResults: CourseResult[];
  answers: Answer[];
  totalTime: number; // Tiempo total en segundos
  performanceLevel: PerformanceLevel;
}

export type PerformanceLevel = 'excellent' | 'good' | 'regular' | 'needs_practice';

// ============================================
// ESTADO DEL STORE (ZUSTAND)
// ============================================
export interface SavedAnswer {
  questionId: string;
  selectedOption: number | null;
}

export interface ExamStore {
  // Estado
  status: ExamStatus;
  student: Student | null;
  config: ExamConfig | null;
  questions: Question[];
  currentQuestionIndex: number;
  answers: Answer[];
  savedAnswers: Map<string, number | null>;
  result: ExamResult | null;
  error: string | null;
  startTime: Date | null;

  // Acciones
  setStudent: (student: Student) => void;
  loadConfig: () => Promise<void>;
  loadQuestions: () => Promise<void>; // Sin parámetro de área
  startExam: () => void;
  saveAnswer: (questionId: string, selectedOption: number | null) => void;
  answerQuestion: (questionId: string, selectedOption: number | null, timeSpent: number) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  goToQuestion: (index: number) => void;
  finishExam: () => void;
  resetExam: () => void;
  setError: (error: string) => void;
}

// ============================================
// RESPUESTAS DE LA API
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// PROPS DE COMPONENTES
// ============================================
export interface QuestionProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (selectedOption: number | null) => void;
  timeRemaining: number;
}

export interface ProgressBarProps {
  current: number;
  total: number;
  percentage?: number;
}

export interface TimerProps {
  seconds: number;
  isWarning?: boolean;
  onTimeout?: () => void;
}

export interface ResultCardProps {
  result: CourseResult;
}

// ============================================
// CONSTANTES - CURSOS ENCIB
// ============================================
export const COURSES: CourseType[] = [
  'Anatomía',
  'Embriología',
  'Histología',
  'Bioquímica',
  'Fisiología',
  'Patología',
  'Farmacología',
  'Microbiología-Parasitología'
];

// Configuración de cursos según Tabla de Especificaciones ENCIB 2024
export const COURSE_CONFIG: Record<CourseType, { questionCount: number; subAreas: number; temas: number; description: string }> = {
  'Anatomía': {
    questionCount: 16,
    subAreas: 9,
    temas: 35,
    description: 'Generalidades, Locomotor, Cabeza, Cuello, Sistema Nervioso, Tórax, Abdomen, Retroperitoneo, Pelvis'
  },
  'Embriología': {
    questionCount: 7,
    subAreas: 3,
    temas: 21,
    description: 'Introducción, Embriología y alteraciones, Embriología por sistemas'
  },
  'Histología': {
    questionCount: 9,
    subAreas: 6,
    temas: 26,
    description: 'Tejidos Básicos, Sistema Linfoide, Órganos Metabólicos, Reproductor, Sentidos, Tegumentario'
  },
  'Bioquímica': {
    questionCount: 9,
    subAreas: 5,
    temas: 18,
    description: 'Estructura celular, Señalización, Metabolismo general y tisular, Hormonas'
  },
  'Fisiología': {
    questionCount: 16,
    subAreas: 9,
    temas: 53,
    description: 'Cardiovascular, Respiratoria, Digestiva, Excretor, Endocrino, Hemato-inmune, Nervioso, Locomotor'
  },
  'Patología': {
    questionCount: 16,
    subAreas: 17,
    temas: 105,
    description: 'Lesión celular, Inflamación, Hemodinamia, Inmuno, Neoplasias, Infecciosa, por sistemas'
  },
  'Farmacología': {
    questionCount: 16,
    subAreas: 4,
    temas: 53,
    description: 'Generalidades, SN Vegetativo, Procesos somatosensoriales, Cardiovascular, Antiinfecciosos'
  },
  'Microbiología-Parasitología': {
    questionCount: 11,
    subAreas: 6,
    temas: 26,
    description: 'Bacteriología, Micología, Virología, Helmintos, Protozoos, Artrópodos'
  }
};

// ============================================
// CONSTANTES - UNIVERSIDADES ASPEFAM
// ============================================
export const UNIVERSITIES_BY_REGION: Record<string, { code: string; name: string }[]> = {
  'Lima': [
    { code: 'UNMSM', name: 'Universidad Nacional Mayor de San Marcos' },
    { code: 'UPCH', name: 'Universidad Peruana Cayetano Heredia' },
    { code: 'USMP', name: 'Universidad de San Martín de Porres' },
    { code: 'URP', name: 'Universidad Ricardo Palma' },
    { code: 'UNFV', name: 'Universidad Nacional Federico Villarreal' },
    { code: 'UPC', name: 'Universidad Peruana de Ciencias Aplicadas' },
    { code: 'UCSUR', name: 'Universidad Científica del Sur' },
    { code: 'UPSJB', name: 'Universidad Privada San Juan Bautista' },
    { code: 'USIL', name: 'Universidad San Ignacio de Loyola' },
    { code: 'UPN', name: 'Universidad Privada del Norte' },
  ],
  'Norte del Perú': [
    { code: 'UNT', name: 'Universidad Nacional de Trujillo' },
    { code: 'UPAO', name: 'Universidad Privada Antenor Orrego' },
    { code: 'UCV', name: 'Universidad César Vallejo' },
    { code: 'UNP', name: 'Universidad Nacional de Piura' },
    { code: 'UDEP', name: 'Universidad de Piura' },
    { code: 'UNC', name: 'Universidad Nacional de Cajamarca' },
    { code: 'UNS', name: 'Universidad Nacional del Santa' },
  ],
  'Sur del Perú': [
    { code: 'UNSA', name: 'Universidad Nacional de San Agustín' },
    { code: 'UCSM', name: 'Universidad Católica de Santa María' },
    { code: 'UNSAAC', name: 'Universidad Nacional de San Antonio Abad del Cusco' },
    { code: 'UNA', name: 'Universidad Nacional del Altiplano - Puno' },
    { code: 'UPT', name: 'Universidad Privada de Tacna' },
    { code: 'UNJBG', name: 'Universidad Nacional Jorge Basadre Grohmann' },
  ],
  'Centro y Oriente': [
    { code: 'UNSLG', name: 'Universidad Nacional San Luis Gonzaga' },
    { code: 'UNCP', name: 'Universidad Nacional del Centro del Perú' },
    { code: 'UPLA', name: 'Universidad Peruana Los Andes' },
    { code: 'UNHEVAL', name: 'Universidad Nacional Hermilio Valdizán' },
    { code: 'UNSCH', name: 'Universidad Nacional San Cristóbal de Huamanga' },
    { code: 'UNAP', name: 'Universidad Nacional de la Amazonía Peruana' },
  ]
};

// Lista plana de todas las universidades
export const ALL_UNIVERSITIES = Object.values(UNIVERSITIES_BY_REGION).flat();

// ============================================
// UMBRALES DE RENDIMIENTO (basado en correctas de 100)
// ============================================
export const PERFORMANCE_THRESHOLDS = {
  excellent: 80, // ≥ 80 correctas = ≥ 16/20
  good: 60,      // ≥ 60 correctas = ≥ 12/20
  regular: 50,   // ≥ 50 correctas = ≥ 10/20
  // needs_practice: < 50 correctas = < 10/20
};

export const PERFORMANCE_MESSAGES: Record<PerformanceLevel, { title: string; message: string; color: string }> = {
  excellent: {
    title: '¡Excelente!',
    message: 'Tu preparación es sobresaliente. Estás muy bien preparado para el ENCIB.',
    color: 'emerald'
  },
  good: {
    title: '¡Buen trabajo!',
    message: 'Tienes una buena base en ciencias básicas. Con un poco más de práctica alcanzarás la excelencia.',
    color: 'blue'
  },
  regular: {
    title: 'Regular',
    message: 'Hay cursos que necesitan refuerzo. Enfócate en los temas con menor rendimiento.',
    color: 'amber'
  },
  needs_practice: {
    title: 'Necesitas practicar',
    message: 'Es importante dedicar más tiempo al estudio de ciencias básicas. No te desanimes, cada práctica suma.',
    color: 'red'
  }
};

// ============================================
// INFORMACIÓN DEL EXAMEN ENCIB
// ============================================
export const ENCIB_INFO = {
  name: 'ENCIB',
  fullName: 'Examen Nacional de Ciencias Básicas',
  organization: 'Asociación Peruana de Facultades de Medicina (ASPEFAM)',
  year: 2024,
  totalQuestions: 100,
  maxScore: 100,
  vigesimalMax: 20,
  questionTypes: {
    casoClinico: { count: 70, percentage: 70 },
    problema: { count: 30, percentage: 30 }
  },
  difficulty: {
    alta: { min: 6, max: 18, percentage: '5-15%' },
    media: { min: 48, max: 72, percentage: '40-60%' },
    baja: { min: 24, max: 48, percentage: '25-40%' }
  }
};
