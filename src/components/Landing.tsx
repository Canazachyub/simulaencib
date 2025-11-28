import { useNavigate } from 'react-router-dom';
import {
  Stethoscope, BookOpen, Clock, Award, ChevronRight, CheckCircle,
  FileText, BarChart3, Zap, Target, Brain, Activity, Heart, Microscope,
  Play, Users, TrendingUp
} from 'lucide-react';
import { COURSES, COURSE_CONFIG } from '../types';

export function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      icon: BookOpen,
      title: 'Preguntas Tipo ENCIB',
      description: 'Casos clínicos (70%) y problemas (30%) basados en el formato oficial de ASPEFAM'
    },
    {
      icon: Clock,
      title: '3 Horas de Examen',
      description: 'Igual que el ENCIB oficial. Al acabar el tiempo, el examen se cierra automáticamente'
    },
    {
      icon: BarChart3,
      title: 'Análisis por Curso',
      description: 'Estadísticas detalladas de tu rendimiento en los 8 cursos de ciencias básicas'
    },
    {
      icon: FileText,
      title: 'Reporte PDF',
      description: 'Descarga tus resultados con nota vigesimal y desempeño detallado por curso'
    },
    {
      icon: Target,
      title: 'Nota Vigesimal (0-20)',
      description: 'Sistema de calificación idéntico al ENCIB oficial para conocer tu nivel real'
    },
    {
      icon: TrendingUp,
      title: 'Historial de Progreso',
      description: 'Visualiza tu evolución en cada simulacro y compara tu mejora en el tiempo'
    }
  ];

  const courses = COURSES.map(course => ({
    name: course,
    questions: COURSE_CONFIG[course].questionCount,
    icon: getCourseIcon(course)
  }));

  const benefits = [
    'Preguntas tipo caso clínico (70%) y tipo problema (30%)',
    'Límite de 3 horas igual que el examen oficial',
    'Nota calculada en escala vigesimal (0-20)',
    'Navegación libre entre preguntas',
    'Revisión detallada de cada respuesta al finalizar',
    'Funciona en móvil y desktop'
  ];

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
          <div className="max-w-4xl mx-auto text-center">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-6 animate-fade-in">
              <Stethoscope className="w-10 h-10" />
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight animate-slide-up">
              Prepárate para el
              <span className="block text-cyan-200">ENCIB 2025</span>
            </h1>

            <p className="text-lg md:text-xl text-cyan-100 mb-8 max-w-2xl mx-auto">
              Simulador del <strong>Examen Nacional de Ciencias Básicas</strong>.
              100 preguntas de los 8 cursos con
              <strong> nota en escala vigesimal (0-20)</strong>.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={() => navigate('/registro')}
                className="btn-primary text-lg px-8 py-4 bg-white text-cyan-700 hover:bg-cyan-50 shadow-xl"
              >
                Comenzar Simulacro
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Stats - Cuadros responsive corregidos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 min-h-[80px] flex flex-col justify-center">
                <p className="text-2xl md:text-3xl font-bold text-white">100</p>
                <p className="text-xs md:text-sm text-cyan-200">Preguntas</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 min-h-[80px] flex flex-col justify-center">
                <p className="text-2xl md:text-3xl font-bold text-white">8</p>
                <p className="text-xs md:text-sm text-cyan-200">Cursos</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 min-h-[80px] flex flex-col justify-center">
                <p className="text-2xl md:text-3xl font-bold text-white">0-20</p>
                <p className="text-xs md:text-sm text-cyan-200">Nota Vigesimal</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 md:p-4 min-h-[80px] flex flex-col justify-center">
                <p className="text-base md:text-lg font-bold text-white leading-tight">ASPEFAM</p>
                <p className="text-xs md:text-sm text-cyan-200">Formato Oficial</p>
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

      {/* ¿Qué es el ENCIB? Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block px-4 py-1.5 bg-cyan-100 text-cyan-700 rounded-full text-sm font-medium mb-4">
                Información Oficial
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                ¿Qué es el ENCIB?
              </h2>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-8">
              <p className="text-slate-700 leading-relaxed mb-6">
                El <strong className="text-cyan-700">Examen Nacional de Ciencias Básicas (ENCIB)</strong> es una prueba
                planificada, organizada, conducida y validada por la <strong>Asociación Peruana de Facultades de Medicina
                (ASPEFAM)</strong>. Está dirigida a los estudiantes de medicina que culminan cursos de Ciencias Básicas
                en sus respectivas universidades.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-cyan-50 rounded-xl p-5">
                  <h3 className="font-bold text-cyan-800 mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Objetivos
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
                      <span>Evaluar la suficiencia de conocimientos en ciencias básicas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
                      <span>Proporcionar información objetiva a las facultades</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
                      <span>Orientar procesos de desarrollo curricular</span>
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
                      <span>100 preguntas en 2 horas (examen oficial)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>70% casos clínicos, 30% problemas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>5 alternativas, sin puntaje negativo</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Video Section */}
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
          </div>
        </div>
      </section>

      {/* Courses Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              8 Cursos de Ciencias Básicas
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              El ENCIB evalúa los conocimientos fundamentales según la
              Tabla de Especificaciones oficial de ASPEFAM
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

      {/* Benefits Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              ¿Por qué usar SimulaENCIB?
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
                      <p className="text-sm text-slate-500">100 preguntas en 3 horas</p>
                    </div>
                  </div>
                </div>

                {/* Question Type Info */}
                <div className="mt-6 p-4 bg-cyan-50 rounded-xl">
                  <h4 className="font-semibold text-cyan-800 mb-2">Tipos de Pregunta</h4>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-cyan-500 rounded-full"></span>
                      <span className="text-slate-600">70% Casos Clínicos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                      <span className="text-slate-600">30% Problemas</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Courses Detail Preview */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              Distribución del Examen
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              100 preguntas distribuidas según la tabla de especificaciones
              oficial del ENCIB de ASPEFAM
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {courses.map((course, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm hover:shadow-md hover:bg-cyan-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-cyan-100 text-cyan-600 rounded-lg flex items-center justify-center">
                      <course.icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium text-slate-800">{course.name}</span>
                  </div>
                  <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-semibold">
                    {course.questions} preg.
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4 flex items-center justify-between p-4 bg-cyan-600 text-white rounded-lg">
              <span className="font-bold">TOTAL</span>
              <span className="text-xl font-bold">100 preguntas</span>
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
            Practica con simulacros realistas y llega preparado al día del ENCIB.
            ¡El conocimiento es poder!
          </p>
          <button
            onClick={() => navigate('/registro')}
            className="btn bg-white text-cyan-700 hover:bg-cyan-50 text-lg px-10 py-4 shadow-xl"
          >
            Iniciar Simulacro
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
              <span className="font-semibold text-white">SimulaENCIB</span>
              <span className="hidden sm:inline">- Examen Nacional de Ciencias Básicas</span>
            </p>
            <p className="text-sm text-center md:text-right">
              Simulador basado en el formato oficial ENCIB - ASPEFAM
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
