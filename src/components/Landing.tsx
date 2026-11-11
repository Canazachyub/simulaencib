import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Stethoscope, BookOpen, Clock, Award, ChevronRight, CheckCircle,
  FileText, BarChart3, Zap, Target, Brain, Activity, Heart, Microscope,
  Play, TrendingUp, Library, ListChecks
} from 'lucide-react';
import { ENCIB_FALLBACK_CONFIG, SITE_NAME } from '../types';
import { useExamStore, useExamCatalog, useSelectedExam, readExamFromUrl } from '../hooks/useExam';
import { formatDuration, formatDurationShort } from '../utils/calculations';
import { ExamSelector } from './ExamSelector';

export function Landing() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { exams } = useExamCatalog();
  const exam = useSelectedExam();
  const selectExam = useExamStore(state => state.selectExam);
  const config = useExamStore(state => state.config);
  const loadConfig = useExamStore(state => state.loadConfig);

  // ?examen=<id> en la URL
  useEffect(() => {
    const fromUrl = readExamFromUrl(`?${searchParams.toString()}`);
    if (fromUrl) selectExam(fromUrl);
  }, [searchParams, selectExam]);

  // Cargar la configuración (cursos) del examen elegido
  useEffect(() => {
    if (!config || config.id !== exam.id) {
      loadConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id, config]);

  const isEncib = exam.id === 'encib';
  const examConfig = config && config.id === exam.id
    ? config
    : isEncib ? ENCIB_FALLBACK_CONFIG : null;
  const examCourses = (examConfig?.courses ?? []).filter(c => c.questionCount > 0);
  const totalQuestions = examConfig?.totalQuestions ?? exam.totalQuestions;
  const courseCount = examCourses.length || exam.courseCount;
  const durationText = formatDuration(exam.durationMinutes);

  const features = [
    {
      icon: BookOpen,
      title: `Preguntas tipo ${exam.nombre}`,
      description: isEncib
        ? 'Casos clínicos y problemas basados en el formato oficial de ASPEFAM'
        : `Preguntas con ${exam.alternatives} alternativas según el formato del examen`
    },
    {
      icon: Clock,
      title: `${durationText} de examen`,
      description: 'Igual que el examen oficial. Al acabar el tiempo, el examen se cierra automáticamente'
    },
    {
      icon: BarChart3,
      title: 'Análisis por curso',
      description: `Estadísticas detalladas de tu rendimiento en ${courseCount > 0 ? `los ${courseCount} cursos/áreas` : 'cada curso'} del examen`
    },
    {
      icon: FileText,
      title: 'Reporte PDF',
      description: 'Descarga tus resultados con tu nota y desempeño detallado por curso'
    },
    {
      icon: Target,
      title: `Nota de 0 a ${exam.scaleMax}`,
      description: exam.passing !== null
        ? `Misma escala del examen oficial; se aprueba con ${exam.passing}`
        : 'Misma escala de calificación del examen oficial para conocer tu nivel real'
    },
    {
      icon: TrendingUp,
      title: 'Historial de progreso',
      description: 'Visualiza tu evolución en cada simulacro y compara tu mejora en el tiempo'
    }
  ];

  const courses = examCourses.map(course => ({
    name: course.name,
    questions: course.questionCount,
    icon: getCourseIcon(course.name)
  }));

  const benefits = [
    `${totalQuestions || '—'} preguntas con ${exam.alternatives} alternativas`,
    `Límite de ${durationText} igual que el examen oficial`,
    `Nota calculada en escala de 0 a ${exam.scaleMax}`,
    'Navegación libre entre preguntas',
    'Revisión detallada de cada respuesta al finalizar',
    'Funciona en móvil y desktop'
  ];

  const startSimulacro = () => navigate('/registro');

  const handleSelectExam = (examId: string) => {
    selectExam(examId);
    // Quitar ?examen= de la URL para que no vuelva a imponer el examen anterior
    if (searchParams.has('examen') || searchParams.has('exam')) {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-cyan-600 via-cyan-700 to-cyan-800 text-white">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500 rounded-full opacity-20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-400 rounded-full opacity-20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white rounded-full opacity-5 blur-3xl" />
        </div>

        <div className="relative container mx-auto px-4 py-16 lg:py-20">
          <div className="max-w-5xl mx-auto text-center">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-4 animate-fade-in">
              <Stethoscope className="w-10 h-10" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-200 mb-6">
              {SITE_NAME}
            </p>

            {/* Selector de examen */}
            {exams.length > 1 && (
              <div className="mb-10 animate-fade-in">
                <p className="text-cyan-100 text-sm mb-3">Elige el examen que quieres simular</p>
                <ExamSelector
                  exams={exams}
                  selectedId={exam.id}
                  onSelect={handleSelectExam}
                  variant="dark"
                />
              </div>
            )}

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight animate-slide-up">
              Prepárate para el
              <span className="block text-cyan-200">{exam.nombre}</span>
            </h1>

            <p className="text-lg md:text-xl text-cyan-100 mb-8 max-w-2xl mx-auto">
              Simulador del <strong>{exam.descripcion || exam.nombre}</strong>.
              {totalQuestions > 0 && <> {totalQuestions} preguntas</>}
              {courseCount > 0 && <> de {courseCount} cursos/áreas</>} con
              <strong> nota en escala de 0 a {exam.scaleMax}</strong>.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={startSimulacro}
                className="btn-primary text-lg px-8 py-4 bg-white text-cyan-700 hover:bg-cyan-50 shadow-xl"
              >
                Comenzar Simulacro {exam.nombre}
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/banqueo')}
                className="btn text-lg px-8 py-4 bg-purple-600 text-white hover:bg-purple-700 shadow-xl"
              >
                <Library className="w-5 h-5" />
                Banqueo Histórico
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 min-h-[80px] flex flex-col justify-center">
                <p className="text-2xl md:text-3xl font-bold text-white">{totalQuestions || '—'}</p>
                <p className="text-xs md:text-sm text-cyan-200">Preguntas</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 min-h-[80px] flex flex-col justify-center">
                <p className="text-2xl md:text-3xl font-bold text-white">{courseCount || '—'}</p>
                <p className="text-xs md:text-sm text-cyan-200">Cursos / áreas</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 min-h-[80px] flex flex-col justify-center">
                <p className="text-2xl md:text-3xl font-bold text-white">0-{exam.scaleMax}</p>
                <p className="text-xs md:text-sm text-cyan-200">
                  {exam.passing !== null ? `Aprueba con ${exam.passing}` : 'Escala de nota'}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 min-h-[80px] flex flex-col justify-center">
                <p className="text-2xl md:text-3xl font-bold text-white">{formatDurationShort(exam.durationMinutes)}</p>
                <p className="text-xs md:text-sm text-cyan-200">Duración</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wave decoration */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              fill="#F8FAFC"
            />
          </svg>
        </div>
      </section>

      {/* Información del examen */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block px-4 py-1.5 bg-cyan-100 text-cyan-700 rounded-full text-sm font-medium mb-4">
                Información del examen
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                ¿Qué es el {exam.nombre}?
              </h2>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-8">
              {isEncib ? (
                <p className="text-slate-700 leading-relaxed mb-6">
                  El <strong className="text-cyan-700">Examen Nacional de Ciencias Básicas (ENCIB)</strong> es una prueba
                  planificada, organizada, conducida y validada por la <strong>Asociación Peruana de Facultades de Medicina
                  (ASPEFAM)</strong>. Está dirigida a los estudiantes de medicina que culminan cursos de Ciencias Básicas
                  en sus respectivas universidades.
                </p>
              ) : (
                <p className="text-slate-700 leading-relaxed mb-6">
                  <strong className="text-cyan-700">{exam.descripcion || exam.nombre}</strong>. Este simulacro reproduce
                  el número de preguntas, el tiempo y la escala de calificación del examen oficial, con la distribución
                  de preguntas por curso o área que se detalla más abajo.
                </p>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-cyan-50 rounded-xl p-5">
                  <h3 className="font-bold text-cyan-800 mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Objetivos
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
                      <span>Medir tu nivel real antes del examen oficial</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
                      <span>Identificar los cursos donde necesitas reforzar</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
                      <span>Practicar el manejo del tiempo en condiciones reales</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-emerald-50 rounded-xl p-5">
                  <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Características
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{totalQuestions || '—'} preguntas en {durationText}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{exam.alternatives} alternativas por pregunta</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>
                        Nota de 0 a {exam.scaleMax}
                        {exam.passing !== null ? ` (aprobatoria: ${exam.passing})` : ''}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {exam.fuente && (
                <p className="mt-6 text-xs text-slate-500 italic">Fuente: {exam.fuente}</p>
              )}
            </div>

            {/* Video Section (solo ENCIB) */}
            {isEncib && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Play className="w-6 h-6 text-red-500" />
                    Video: Presentación ENCIB 2025
                  </h3>
                  <p className="text-slate-600 text-sm mt-1">Conoce más sobre el examen oficial de ASPEFAM</p>
                </div>
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src="https://www.youtube.com/embed/3ZonKRAc2z0"
                    title="Presentación ENCIB 2025"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Courses Section (tarjetas, solo si son pocos cursos) */}
      {courses.length > 0 && courses.length <= 12 && (
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                {courses.length} cursos evaluados
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                El {exam.nombre} evalúa estos cursos según su tabla de especificaciones
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {courses.map((course, index) => (
                <div
                  key={index}
                  className="card p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 text-center"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-cyan-100 text-cyan-600 rounded-xl mb-3">
                    <course.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">
                    {course.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {course.questions} preguntas
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Benefits Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              ¿Por qué usar {SITE_NAME}?
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              La herramienta más completa para prepararte y conocer tu nivel real
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex gap-4 p-6 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-cyan-100 text-cyan-600 rounded-xl flex items-center justify-center">
                    <feature.icon className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <span className="inline-block px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-medium mb-4">
                  Fácil y rápido
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-6">
                  Comienza en 2 simples pasos
                </h2>
                <p className="text-slate-600 mb-8">
                  No necesitas crear una cuenta. Solo ingresa tu DNI para
                  identificar tu resultado y comienza a practicar inmediatamente.
                </p>
                <ul className="space-y-3">
                  {benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl p-6">
                <div className="space-y-4">
                  <div className="bg-white rounded-xl shadow-md p-5 flex items-center gap-4 hover:shadow-lg transition-shadow">
                    <div className="w-12 h-12 bg-cyan-500 text-white rounded-full flex items-center justify-center font-bold text-xl">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800">Ingresa tus datos</h4>
                      <p className="text-sm text-slate-500">DNI, nombre y universidad</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-5 flex items-center gap-4 hover:shadow-lg transition-shadow">
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-xl">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800">¡Resuelve y obtén tu nota!</h4>
                      <p className="text-sm text-slate-500">
                        {totalQuestions || '—'} preguntas en {durationText}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-cyan-50 rounded-xl">
                  <h4 className="font-semibold text-cyan-800 mb-2 flex items-center gap-2">
                    <ListChecks className="w-4 h-4" />
                    Examen seleccionado
                  </h4>
                  <p className="text-sm text-slate-600">
                    <strong>{exam.nombre}</strong> · {exam.alternatives} alternativas · nota 0-{exam.scaleMax}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Distribución del examen */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              Distribución del Examen
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              {totalQuestions || '—'} preguntas del {exam.nombre} distribuidas por curso o área
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            {courses.length === 0 ? (
              <p className="text-center text-slate-500">Cargando distribución del examen...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {courses.map((course, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 p-4 bg-white rounded-lg shadow-sm hover:shadow-md hover:bg-cyan-50 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 flex-shrink-0 bg-cyan-100 text-cyan-600 rounded-lg flex items-center justify-center">
                        <course.icon className="w-5 h-5" />
                      </div>
                      <span className="font-medium text-slate-800 text-sm">{course.name}</span>
                    </div>
                    <span className="flex-shrink-0 px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-semibold">
                      {course.questions} preg.
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            <div className="mt-4 flex items-center justify-between p-4 bg-cyan-600 text-white rounded-lg">
              <span className="font-bold">TOTAL</span>
              <span className="text-xl font-bold">{totalQuestions || '—'} preguntas</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-cyan-600 to-cyan-700">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-6">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            ¿Listo para conocer tu nivel?
          </h2>
          <p className="text-cyan-100 mb-8 max-w-xl mx-auto">
            Practica con simulacros realistas y llega preparado al día del {exam.nombre}.
            ¡El conocimiento es poder!
          </p>
          <button
            onClick={startSimulacro}
            className="btn bg-white text-cyan-700 hover:bg-cyan-50 text-lg px-10 py-4 shadow-xl"
          >
            Iniciar Simulacro {exam.nombre}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-400 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5" />
              <span className="font-semibold text-white">{SITE_NAME}</span>
              <span className="hidden sm:inline">- {exam.nombre}</span>
            </p>
            <p className="text-sm text-center md:text-right">
              Simuladores basados en el formato oficial de cada examen
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Helper function to get icon for each course
function getCourseIcon(course: string) {
  const icons: Record<string, typeof Heart> = {
    'Anatomía': Activity,
    'Embriología': Heart,
    'Histología': Microscope,
    'Bioquímica': Zap,
    'Fisiología': Activity,
    'Patología': Target,
    'Farmacología': FileText,
    'Microbiología-Parasitología': Microscope
  };
  return icons[course] || BookOpen;
}
