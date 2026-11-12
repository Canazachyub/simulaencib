import { useNavigate } from 'react-router-dom';
import {
  Brain, BookOpen, ChevronRight, Check, X, Target,
  Clock, Repeat, Lightbulb, Lock, MousePointerClick, ListChecks, Filter
} from 'lucide-react';
import { TopBar, TerminalFooter, Accordion, AccordionItem } from './terminal';

export function BanqueoLanding() {
  const navigate = useNavigate();
  const goAccess = () => navigate('/banqueo/acceso');

  // Beneficios: título corto + una línea (más gráfico, menos texto)
  const benefits = [
    { icon: Lightbulb, title: 'Corrección al instante', description: 'Respuesta correcta y justificación tras cada pregunta' },
    { icon: Clock, title: 'Sin límite de tiempo', description: 'Analiza cada caso a tu ritmo' },
    { icon: Filter, title: 'Por curso, tema y año', description: 'Refuerza justo lo que te falta' },
    { icon: Repeat, title: 'Repite tus falladas', description: 'Tu progreso queda guardado por curso' }
  ];

  // Cómo funciona: 3 pasos visuales
  const steps = [
    { icon: Target, title: 'Elige un curso', text: 'y cuántas preguntas: 10, 20, 50 o todas' },
    { icon: MousePointerClick, title: 'Responde', text: 'y ve al instante si acertaste' },
    { icon: ListChecks, title: 'Revisa', text: 'tu % de acierto y repasa lo fallado' }
  ];

  const comparison = [
    {
      icon: Brain,
      title: 'Banqueo',
      tag: 'para aprender',
      items: ['Por curso o tema', 'Sin límite de tiempo', 'Respuesta inmediata']
    },
    {
      icon: BookOpen,
      title: 'Simulacro',
      tag: 'para evaluarte',
      items: ['Todas las preguntas', 'Tiempo oficial', 'Respuestas al final']
    }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col pb-[76px] md:pb-0">
      <TopBar />

      {/* Hero */}
      <section className="border-b border-line">
        <div className="max-w-terminal mx-auto px-4 lg:px-8 py-10 md:py-16">
          <p className="eyebrow">Banqueo · Active Recall</p>
          <h1 className="title-screen text-[28px] md:text-[32px] mt-3">Banqueo histórico</h1>
          <p className="mt-4 max-w-[600px] text-[17px] leading-relaxed text-muted">
            Preguntas de exámenes anteriores con <strong className="text-ink">corrección inmediata</strong>.
            Aprende de cada error al momento.
          </p>
          <div className="mt-6 hidden md:flex flex-wrap items-center gap-3">
            <button onClick={goAccess} className="btn-primary">
              Entrar al banqueo
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="pill">
              <Lock className="w-4 h-4" />
              Para alumnos inscritos
            </span>
          </div>
          <p className="mt-4 md:hidden inline-flex items-center gap-1.5 text-sm text-muted">
            <Lock className="w-4 h-4" /> Para alumnos inscritos
          </p>

          {/* Pasos */}
          <ol className="mt-8 grid sm:grid-cols-3 gap-3">
            {steps.map((st, i) => (
              <li key={st.title} className="card p-4 flex items-start gap-3">
                <span className="relative grid place-items-center w-10 h-10 shrink-0 rounded-control bg-jungle-100 text-jungle-800">
                  <st.icon className="w-5 h-5" />
                  <span className="absolute -top-1.5 -left-1.5 grid place-items-center w-5 h-5 rounded-full bg-jungle-800 text-white text-[11px] font-bold num">
                    {i + 1}
                  </span>
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink leading-snug">{st.title}</p>
                  <p className="text-sm text-muted">{st.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Active Recall: comparación visual en lugar de párrafos */}
      <section className="bg-paper border-b border-line">
        <div className="max-w-terminal mx-auto px-4 lg:px-8 py-10 md:py-12">
          <p className="label-section">Método científico</p>
          <h2 className="font-display font-bold text-2xl md:text-[28px] text-ink mt-2 mb-2">¿Por qué Active Recall?</h2>
          <p className="text-muted max-w-[60ch] mb-6">
            Recordar de memoria fija mejor que releer: es la técnica de estudio con más respaldo científico.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="card p-5">
              <p className="label-section text-wrong">Estudio pasivo</p>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {['Releer apuntes', 'Subrayar textos', 'Ver videos sin pausar'].map(t => (
                  <li key={t} className="flex items-center gap-2"><X className="w-4 h-4 text-wrong shrink-0" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="card p-5 border-jungle-600">
              <p className="label-section text-correct">Active Recall</p>
              <ul className="mt-3 space-y-2 text-sm text-ink">
                {['Resolver preguntas de memoria', 'Corregirte al instante', 'Repetir lo que fallaste'].map(t => (
                  <li key={t} className="flex items-center gap-2"><Check className="w-4 h-4 text-correct shrink-0" />{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Beneficios + comparación */}
      <section>
        <div className="max-w-terminal mx-auto px-4 lg:px-8 py-10 md:py-12 grid lg:grid-cols-[1fr_1fr] gap-10">
          <div>
            <p className="label-section">Beneficios</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {benefits.map(b => (
                <div key={b.title} className="card p-4">
                  <span className="grid place-items-center w-10 h-10 rounded-control bg-jungle-100 text-jungle-800">
                    <b.icon className="w-5 h-5" />
                  </span>
                  <h3 className="mt-3 font-semibold text-ink leading-snug">{b.title}</h3>
                  <p className="text-sm text-muted mt-1 leading-snug">{b.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="label-section">Banqueo vs. simulacro</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {comparison.map(col => (
                <div key={col.title} className="card p-4">
                  <col.icon className="w-5 h-5 text-jungle-800" />
                  <h3 className="mt-2 font-semibold text-ink">{col.title}</h3>
                  <p className="text-xs text-muted">{col.tag}</p>
                  <ul className="mt-3 space-y-2">
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
            <button onClick={() => navigate('/')} className="btn-ghost mt-3 -ml-3">
              ¿Sin inscripción? Haz el simulacro gratuito
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section className="flex-1">
        <div className="max-w-terminal mx-auto px-4 lg:px-8 pb-12">
          <div className="max-w-[700px]">
            <Accordion>
              <AccordionItem title="¿Quién puede acceder?">
                Los alumnos inscritos: entra con tu DNI y el correo con el que te inscribiste.
              </AccordionItem>
              <AccordionItem title="¿Cómo se califica?">
                Al confirmar una alternativa queda fija y ves al instante si acertaste y la justificación.
                Al final ves tu porcentaje de aciertos y tu avance en el curso.
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      <TerminalFooter />

      {/* Barra de acción fija en móvil */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-white/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button onClick={goAccess} className="btn-primary w-full">
          Entrar al banqueo
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
