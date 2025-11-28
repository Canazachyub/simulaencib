import { useNavigate } from 'react-router-dom';
import {
  Brain, BookOpen, ChevronRight, CheckCircle, Zap, Target,
  Clock, Repeat, Lightbulb, ArrowLeft, Lock
} from 'lucide-react';

export function BanqueoLanding() {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: Brain,
      title: 'Active Recall',
      description: 'Técnica de estudio basada en la recuperación activa de información, probada científicamente como la más efectiva'
    },
    {
      icon: Lightbulb,
      title: 'Retroalimentación Inmediata',
      description: 'Ve la respuesta correcta después de cada pregunta para aprender de tus errores al instante'
    },
    {
      icon: Clock,
      title: 'Sin Límite de Tiempo',
      description: 'Tómate el tiempo que necesites para analizar cada pregunta sin presión'
    },
    {
      icon: Repeat,
      title: 'Práctica Ilimitada',
      description: 'Practica cuantas veces quieras con 10 preguntas aleatorias por curso'
    },
    {
      icon: Target,
      title: 'Enfoque por Curso',
      description: 'Elige el curso que más necesitas reforzar y practica específicamente'
    },
    {
      icon: Zap,
      title: 'Aprendizaje Eficiente',
      description: 'Maximiza tu retención con sesiones cortas pero intensivas'
    }
  ];

  const howItWorks = [
    'Selecciona el curso que deseas practicar',
    'Responde cada pregunta a tu ritmo',
    'Ve la respuesta correcta inmediatamente',
    'Continúa con la siguiente pregunta',
    'Al finalizar, repite con más preguntas aleatorias'
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-purple-200 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </button>

          <div className="max-w-4xl mx-auto text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
              <Brain className="w-8 h-8" />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Banqueo Histórico
            </h1>

            <p className="text-lg text-purple-100 mb-6 max-w-2xl mx-auto">
              Practica con preguntas de exámenes anteriores usando el método <strong>Active Recall</strong>.
              Retroalimentación inmediata después de cada pregunta.
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-amber-900 rounded-full text-sm font-medium">
              <Lock className="w-4 h-4" />
              Exclusivo para usuarios inscritos
            </div>
          </div>
        </div>
      </header>

      {/* What is Active Recall */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <span className="inline-block px-4 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
                Método Científico
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">
                ¿Qué es el Active Recall?
              </h2>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-6 md:p-8">
              <p className="text-slate-700 leading-relaxed mb-6">
                El <strong className="text-purple-700">Active Recall</strong> (Recuerdo Activo) es una técnica de estudio
                que consiste en intentar recordar información de memoria en lugar de simplemente releerla.
                Los estudios científicos demuestran que esta técnica es <strong>2-3 veces más efectiva</strong> que
                los métodos tradicionales de estudio.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4">
                  <h3 className="font-bold text-red-600 mb-2">Estudio Pasivo (Menos Efectivo)</h3>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>- Releer apuntes</li>
                    <li>- Subrayar textos</li>
                    <li>- Ver videos sin pausar</li>
                  </ul>
                </div>
                <div className="bg-white rounded-xl p-4">
                  <h3 className="font-bold text-green-600 mb-2">Active Recall (Más Efectivo)</h3>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>- Resolver preguntas de memoria</li>
                    <li>- Flashcards con autocorrección</li>
                    <li>- Banqueo con retroalimentación</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">
              Beneficios del Banqueo Histórico
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex gap-4 p-5 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                    <benefit.icon className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 mb-1">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {benefit.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">
                ¿Cómo funciona?
              </h2>
            </div>

            <div className="space-y-4">
              {howItWorks.map((step, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl"
                >
                  <div className="w-10 h-10 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Comparison with Simulacro */}
      <section className="py-12 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-4">
                Banqueo vs Simulacro
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 border-2 border-purple-200">
                <div className="flex items-center gap-3 mb-4">
                  <Brain className="w-8 h-8 text-purple-600" />
                  <h3 className="text-xl font-bold text-purple-700">Banqueo Histórico</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">10 preguntas por curso</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Sin límite de tiempo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Respuesta inmediata</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Elige el curso a practicar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Enfocado en aprender</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-xl p-6 border-2 border-cyan-200">
                <div className="flex items-center gap-3 mb-4">
                  <BookOpen className="w-8 h-8 text-cyan-600" />
                  <h3 className="text-xl font-bold text-cyan-700">Simulacro ENCIB</h3>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">100 preguntas completas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">3 horas de tiempo</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Respuestas al finalizar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">8 cursos completos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600">Enfocado en evaluar</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-gradient-to-r from-purple-600 to-indigo-700">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            ¿Listo para practicar?
          </h2>
          <p className="text-purple-100 mb-8 max-w-xl mx-auto">
            Accede al banco de preguntas y mejora tu retención con Active Recall
          </p>
          <button
            onClick={() => navigate('/banqueo/acceso')}
            className="btn bg-white text-purple-700 hover:bg-purple-50 text-lg px-10 py-4 shadow-xl"
          >
            Acceder al Banqueo
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-400 py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              <span className="font-semibold text-white">Banqueo Histórico</span>
              <span className="hidden sm:inline">- SimulaENCIB</span>
            </p>
            <p className="text-sm text-center md:text-right">
              Técnica Active Recall para mejor retención
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
