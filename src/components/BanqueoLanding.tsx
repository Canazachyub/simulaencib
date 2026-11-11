import { useNavigate } from 'react-router-dom';
import {
  Brain, BookOpen, ChevronRight, Check, Zap, Target,
  Clock, Repeat, Lightbulb, Lock
} from 'lucide-react';
import { TopBar, TerminalFooter, Accordion, AccordionItem, GradingStepper } from './terminal';

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

  const comparison = [
    {
      icon: Brain,
      title: 'Banqueo Histórico',
      items: ['10 preguntas por curso', 'Sin límite de tiempo', 'Respuesta inmediata', 'Elige el curso a practicar', 'Enfocado en aprender']
    },
    {
      icon: BookOpen,
      title: 'Simulacro completo',
      items: ['Todas las preguntas del examen', 'Tiempo oficial de cada examen', 'Respuestas al finalizar', 'Todos los cursos del examen', 'Enfocado en evaluar']
    }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <TopBar />

      {/* Hero */}
      <section className="border-b border-line">
        <div className="max-w-terminal mx-auto px-4 lg:px-8 py-12 md:py-16">
          <p className="eyebrow">Banqueo · Active Recall</p>
          <h1 className="title-screen text-[28px] md:text-[32px] mt-3">Banqueo histórico</h1>
          <p className="mt-4 max-w-[640px] text-[17px] leading-relaxed text-muted">
            Practica con preguntas de exámenes anteriores usando el método <strong className="text-ink">Active Recall</strong>.
            Retroalimentación inmediata después de cada pregunta.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={() => navigate('/banqueo/acceso')} className="btn-primary">
              Acceder al Banqueo
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="pill">
              <Lock className="w-4 h-4" />
              Exclusivo para usuarios inscritos
            </span>
          </div>
        </div>
      </section>

      {/* What is Active Recall */}
      <section className="bg-paper border-b border-line">
        <div className="max-w-terminal mx-auto px-4 lg:px-8 py-12">
          <p className="label-section">Método científico</p>
          <h2 className="font-display font-bold text-2xl md:text-[28px] text-ink mt-2 mb-4">¿Qué es el Active Recall?</h2>
          <p className="text-ink/90 leading-relaxed max-w-[68ch] mb-6">
            El <strong>Active Recall</strong> (Recuerdo Activo) es una técnica de estudio
            que consiste en intentar recordar información de memoria en lugar de simplemente releerla.
            Los estudios científicos demuestran que esta técnica es <strong>2-3 veces más efectiva</strong> que
            los métodos tradicionales de estudio.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="font-semibold text-ink mb-2">Estudio pasivo <span className="text-muted font-normal">(menos efectivo)</span></h3>
              <ul className="text-sm text-muted space-y-1">
                <li>· Releer apuntes</li>
                <li>· Subrayar textos</li>
                <li>· Ver videos sin pausar</li>
              </ul>
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-ink mb-2">Active Recall <span className="text-muted font-normal">(más efectivo)</span></h3>
              <ul className="text-sm text-muted space-y-1">
                <li>· Resolver preguntas de memoria</li>
                <li>· Flashcards con autocorrección</li>
                <li>· Banqueo con retroalimentación</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section>
        <div className="max-w-terminal mx-auto px-4 lg:px-8 py-12">
          <p className="label-section">Beneficios</p>
          <h2 className="font-display font-bold text-2xl md:text-[28px] text-ink mt-2 mb-8">Por qué practicar con el banqueo</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="card p-5 flex gap-4">
                <div className="w-10 h-10 shrink-0 bg-jungle-100 text-jungle-800 rounded-control flex items-center justify-center">
                  <benefit.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink mb-1">{benefit.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works + comparison */}
      <section className="bg-paper border-y border-line">
        <div className="max-w-terminal mx-auto px-4 lg:px-8 py-12 grid lg:grid-cols-[1fr_1fr] gap-10">
          <div>
            <p className="label-section">Paso a paso</p>
            <h2 className="font-display font-bold text-2xl md:text-[28px] text-ink mt-2 mb-6">¿Cómo funciona?</h2>
            <ol className="card divide-y divide-line">
              {howItWorks.map((step, index) => (
                <li key={index} className="flex items-center gap-4 px-5 py-4">
                  <span className="num w-7 h-7 shrink-0 rounded-full border border-line bg-white text-jungle-800 text-sm font-semibold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <p className="text-ink">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="label-section">Comparación</p>
            <h2 className="font-display font-bold text-2xl md:text-[28px] text-ink mt-2 mb-6">Banqueo vs. simulacro</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {comparison.map(col => (
                <div key={col.title} className="card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <col.icon className="w-5 h-5 text-jungle-800" />
                    <h3 className="font-semibold text-ink">{col.title}</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {col.items.map(item => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted">
                        <Check className="w-4 h-4 text-jungle-600 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Reglas (acordeones 6.8) */}
      <section className="flex-1">
        <div className="max-w-terminal mx-auto px-4 lg:px-8 py-12">
          <div className="max-w-[700px]">
            <Accordion>
              <AccordionItem title="Reglas del banqueo">
                Cada sesión trae 10 preguntas aleatorias del curso elegido. No hay límite de tiempo.
                Al responder, la alternativa queda fija y ves de inmediato si acertaste y la justificación.
              </AccordionItem>
              <AccordionItem title="Cómo se califica">
                <GradingStepper
                  steps={[
                    { title: 'Responder', text: 'Elige una alternativa y confírmala.' },
                    { title: 'Corregir', text: 'Ves al instante la respuesta correcta y su justificación.' },
                    { title: 'Revisar', text: 'Al final, tu porcentaje de aciertos del curso.' },
                  ]}
                />
              </AccordionItem>
              <AccordionItem title="¿Quién puede acceder?">
                El banqueo es exclusivo para usuarios inscritos: ingresa con tu DNI y el correo con el que te inscribiste.
                <div className="mt-4">
                  <button onClick={() => navigate('/banqueo/acceso')} className="btn-secondary">
                    Ir al acceso
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      <TerminalFooter />
    </div>
  );
}
