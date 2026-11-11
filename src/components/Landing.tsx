import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Stethoscope, BookOpen, Clock, Award, ChevronRight, CheckCircle,
  FileText, BarChart3, Zap, Target, Activity, Heart, Microscope,
  Play, TrendingUp, Library, ListChecks
} from 'lucide-react';
import { ENCIB_FALLBACK_CONFIG } from '../types';
import { useExamStore, useExamCatalog, useSelectedExam, readExamFromUrl } from '../hooks/useExam';
import { formatDuration, formatDurationShort } from '../utils/calculations';
import { ExamSelector } from './ExamSelector';
import { TopBar, TerminalFooter, SectionLabel, Accordion, AccordionItem, GradingStepper } from './terminal';

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

  const kpis = [
    { value: totalQuestions || '—', label: 'Preguntas' },
    { value: courseCount || '—', label: 'Cursos / áreas' },
    { value: `0–${exam.scaleMax}`, label: exam.passing !== null ? `Aprueba con ${exam.passing}` : 'Escala de nota' },
    { value: formatDurationShort(exam.durationMinutes), label: 'Duración' }
  ];

  const maxCourseQuestions = Math.max(1, ...courses.map(c => c.questions));

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <TopBar>
        {exams.length > 1 && (
          <ExamSelector exams={exams} selectedId={exam.id} onSelect={handleSelectExam} />
        )}
      </TopBar>

      <main className="flex-1 max-w-terminal w-full mx-auto px-4 lg:px-8 py-8 lg:py-10">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
          {/* Columna principal */}
          <div className="min-w-0 max-w-[700px]">
            {/* Cabecera de examen (6.1) */}
            <div className="flex items-start gap-4">
              <div className="grid place-items-center w-12 h-12 shrink-0 rounded-control bg-jungle-100 text-jungle-800">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="meta num">
                  {exam.nombre} · Simulacro
                  {totalQuestions > 0 && <> · {totalQuestions} preguntas</>}
                  {' · '}{formatDurationShort(exam.durationMinutes)}
                </p>
                <h1 className="title-screen text-[28px] md:text-[32px] leading-tight mt-1">
                  Simulacro {exam.nombre}
                </h1>
              </div>
            </div>

            <p className="mt-5 text-[17px] leading-[1.65] text-muted max-w-[68ch]">
              {isEncib ? (
                <>
                  El <strong className="text-ink">Examen Nacional de Ciencias Básicas (ENCIB)</strong> es una prueba
                  planificada, organizada, conducida y validada por la <strong className="text-ink">Asociación Peruana de
                  Facultades de Medicina (ASPEFAM)</strong>, dirigida a los estudiantes de medicina que culminan cursos de
                  Ciencias Básicas.
                </>
              ) : (
                <>
                  <strong className="text-ink">{exam.descripcion || exam.nombre}</strong>. Este simulacro reproduce el
                  número de preguntas, el tiempo y la escala de calificación del examen oficial.
                </>
              )}
            </p>

            {/* KPIs */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {kpis.map(k => (
                <div key={k.label} className="rounded-control border border-line p-4">
                  <p className="num text-2xl font-semibold text-ink">{k.value}</p>
                  <p className="text-[13px] text-muted mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Distribución por curso */}
            <section className="mt-10">
              <SectionLabel>Distribución del examen</SectionLabel>
              <h2 className="font-display font-bold text-xl text-ink mt-2">
                {totalQuestions || '—'} preguntas por curso o área
              </h2>
              {courses.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Cargando distribución del examen...</p>
              ) : (
                <ul className="mt-4 card divide-y divide-line max-h-[420px] overflow-y-auto">
                  {courses.map((course, index) => (
                    <li key={index} className="flex items-center gap-3 px-4 py-3">
                      <course.icon className="w-4 h-4 text-jungle-600 shrink-0" />
                      <span className="text-sm font-medium text-ink flex-1 min-w-0 truncate">{course.name}</span>
                      <span className="hidden sm:block w-28 h-1.5 rounded-full bg-paper overflow-hidden">
                        <span
                          className="block h-full bg-jungle-600 rounded-full"
                          style={{ width: `${(course.questions / maxCourseQuestions) * 100}%` }}
                        />
                      </span>
                      <span className="num text-sm font-semibold text-ink w-16 text-right">{course.questions} preg.</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between px-4 py-3 bg-paper">
                    <span className="label-section">Total</span>
                    <span className="num text-sm font-semibold text-ink">{totalQuestions || '—'} preguntas</span>
                  </li>
                </ul>
              )}
            </section>

            {/* Reglas, calificación y FAQ (6.8) */}
            <section className="mt-10">
              <Accordion>
                <AccordionItem title="Reglas del examen" icon={<ListChecks className="w-4 h-4" />} defaultOpen>
                  <ul className="space-y-2">
                    {benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-jungle-600 flex-shrink-0 mt-1" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-jungle-600 flex-shrink-0 mt-1" />
                      <span>Al acabar el tiempo, el examen se cierra y se califica automáticamente</span>
                    </li>
                  </ul>
                  {exam.fuente && <p className="mt-4 text-xs text-subtle">Fuente: {exam.fuente}</p>}
                </AccordionItem>
                <AccordionItem title="Cómo se califica" icon={<Award className="w-4 h-4" />}>
                  <p className="mb-4">
                    Nota en escala de 0 a {exam.scaleMax}
                    {exam.passing !== null ? `; se aprueba con ${exam.passing}` : ''}. Las preguntas sin contestar
                    cuentan como incorrectas.
                  </p>
                  <GradingStepper />
                </AccordionItem>
                <AccordionItem title="Qué incluye" icon={<BarChart3 className="w-4 h-4" />}>
                  <ul className="grid sm:grid-cols-2 gap-4">
                    {features.map((feature, index) => (
                      <li key={index} className="flex gap-3">
                        <feature.icon className="w-4 h-4 text-jungle-600 shrink-0 mt-1" />
                        <div>
                          <p className="text-sm font-semibold text-ink">{feature.title}</p>
                          <p className="text-sm">{feature.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </AccordionItem>
                <AccordionItem title="Preguntas frecuentes" icon={<BookOpen className="w-4 h-4" />}>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-semibold text-ink">¿Necesito crear una cuenta?</dt>
                      <dd className="text-sm">No. Solo ingresa tu DNI para identificar tu resultado y comienza a practicar.</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-ink">¿Puedo volver a una pregunta?</dt>
                      <dd className="text-sm">Sí. La navegación entre preguntas es libre hasta que califiques.</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-ink">¿Qué recibo al terminar?</dt>
                      <dd className="text-sm">Tu nota, el rendimiento por curso, la revisión de cada respuesta y un reporte PDF.</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-semibold text-ink">¿Funciona en el celular?</dt>
                      <dd className="text-sm">Sí, funciona en móvil y en computadora.</dd>
                    </div>
                  </dl>
                </AccordionItem>
              </Accordion>
            </section>

            {/* Video (solo ENCIB) */}
            {isEncib && (
              <section className="mt-10 card overflow-hidden">
                <div className="p-5 border-b border-line flex items-start gap-3">
                  <Play className="w-5 h-5 text-jungle-600 mt-0.5" />
                  <div>
                    <h3 className="font-display font-bold text-ink">Presentación ENCIB 2025</h3>
                    <p className="text-sm text-muted">Conoce más sobre el examen oficial de ASPEFAM</p>
                  </div>
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
              </section>
            )}
          </div>

          {/* Panel de acción (sticky) */}
          <aside className="mt-10 lg:mt-0">
            <div className="lg:sticky lg:top-[136px] card p-5">
              <p className="eyebrow">Empieza ahora</p>
              <h2 className="font-display font-bold text-lg text-ink mt-2">Comienza en 2 pasos</h2>
              <ol className="mt-4 space-y-3">
                <li className="flex gap-3">
                  <span className="grid place-items-center w-7 h-7 shrink-0 rounded-full bg-jungle-100 text-jungle-800 text-sm font-semibold">1</span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Ingresa tus datos</p>
                    <p className="text-[13px] text-muted">DNI, nombre y universidad</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="grid place-items-center w-7 h-7 shrink-0 rounded-full bg-jungle-100 text-jungle-800 text-sm font-semibold">2</span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Resuelve y obtén tu nota</p>
                    <p className="num text-[13px] text-muted">{totalQuestions || '—'} preguntas en {durationText}</p>
                  </div>
                </li>
              </ol>
              <div className="mt-5 pt-4 border-t border-line flex items-center justify-between gap-2 text-sm">
                <span className="text-muted">Examen</span>
                <span className="num font-semibold text-ink text-right">
                  {exam.nombre} · {exam.alternatives} alt. · 0–{exam.scaleMax}
                </span>
              </div>
              <button onClick={startSimulacro} className="btn-primary w-full mt-5">
                Comenzar simulacro
                <ChevronRight className="w-5 h-5" />
              </button>
              <button onClick={() => navigate('/banqueo')} className="btn-secondary w-full mt-3">
                <Library className="w-5 h-5" />
                Banqueo histórico
              </button>
              <p className="mt-4 text-xs text-subtle text-center">Sin crear cuenta: solo tu DNI.</p>
            </div>
          </aside>
        </div>
      </main>

      <TerminalFooter />
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
