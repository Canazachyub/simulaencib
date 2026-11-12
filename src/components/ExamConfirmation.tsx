import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, CreditCard, BookOpen, Clock, AlertTriangle,
  ChevronLeft, PlayCircle, Loader2, AlertCircle, GraduationCap, Stethoscope, ListChecks, Award
} from 'lucide-react';
import { useExamStore, useSelectedExam } from '../hooks/useExam';
import { ALL_UNIVERSITIES, ENCIB_FALLBACK_CONFIG } from '../types';
import { formatDuration, formatDurationShort } from '../utils/calculations';
import { TopBar, SectionLabel, Accordion, AccordionItem, GradingStepper, FlowSteps } from './terminal';

export function ExamConfirmation() {
  const navigate = useNavigate();
  const { student, config, loadConfig, loadQuestions, status, error } = useExamStore();
  const exam = useSelectedExam();

  // Redirect if no student data
  useEffect(() => {
    if (!student) {
      navigate('/registro');
    }
  }, [student, navigate]);

  // Asegurar que la configuración corresponda al examen seleccionado
  useEffect(() => {
    if (student && (!config || config.id !== exam.id)) {
      loadConfig();
    }
  }, [student, config, exam.id, loadConfig]);

  if (!student) return null;

  const examConfig = config && config.id === exam.id
    ? config
    : exam.id === ENCIB_FALLBACK_CONFIG.id ? ENCIB_FALLBACK_CONFIG : null;
  const totalQuestions = examConfig?.totalQuestions ?? exam.totalQuestions;
  const examCourses = (examConfig?.courses ?? []).filter(c => c.questionCount > 0);
  const durationMinutes = examConfig?.durationMinutes ?? exam.durationMinutes;
  const alternatives = examConfig?.alternatives ?? exam.alternatives;
  const scaleMax = examConfig?.scaleMax ?? exam.scaleMax;
  const passing = examConfig ? examConfig.passing : exam.passing;
  const fuente = examConfig?.fuente || exam.fuente;

  // Obtener nombre de la universidad
  const universityInfo = ALL_UNIVERSITIES.find(u => u.code === student.university);
  const universityName = universityInfo ? `${universityInfo.code} - ${universityInfo.name}` : student.university;

  const handleStartExam = async () => {
    await loadQuestions();
    navigate('/examen');
  };

  const instructions = [
    `El examen consta de ${totalQuestions} preguntas de ${examCourses.length || exam.courseCount} cursos/áreas, con ${alternatives} alternativas cada una`,
    `Tienes ${formatDuration(durationMinutes).toUpperCase()} para completar el examen (igual que el ${exam.nombre} oficial)`,
    'Cuando el tiempo termine, el examen se cierra y muestra tus resultados',
    'Puedes navegar libremente entre las preguntas (avanzar y retroceder)',
    'Verás qué acertaste recién al enviar la prueba ("Revisar" → "Enviar la prueba"), como en el examen real',
    `Al finalizar, obtendrás tu nota (0-${scaleMax})${passing !== null ? `; se aprueba con ${passing}` : ''} y podrás descargar un PDF`
  ];

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col bg-paper">
        <TopBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-jungle-600 animate-spin mx-auto mb-4" />
            <h2 className="title-screen text-xl mb-2">Preparando tu examen</h2>
            <p className="text-muted">Cargando preguntas del {exam.nombre}...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col bg-paper">
        <TopBar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="card p-8 max-w-md w-full text-center">
            <AlertCircle className="w-12 h-12 text-wrong mx-auto mb-4" />
            <h2 className="title-screen text-xl mb-2">Error al cargar</h2>
            <p className="text-muted mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate('/registro')} className="btn-secondary">
                Volver
              </button>
              <button onClick={handleStartExam} className="btn-primary">
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const kpis = [
    { icon: BookOpen, value: totalQuestions || '—', label: 'Preguntas' },
    { icon: Clock, value: formatDurationShort(durationMinutes), label: 'Duración' },
    { icon: ListChecks, value: alternatives, label: 'Alternativas' },
    { icon: Award, value: `0–${scaleMax}`, label: passing !== null ? `Aprueba con ${passing}` : 'Escala de nota' }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <TopBar />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 lg:py-12">
        {/* Cabecera (6.1) */}
        <div className="flex items-start gap-4 mb-6">
          <div className="grid place-items-center w-12 h-12 shrink-0 rounded-control bg-jungle-100 text-jungle-800">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="meta num">
              {exam.nombre} · Simulacro{totalQuestions ? ` · ${totalQuestions} preguntas` : ''} · {formatDurationShort(durationMinutes)}
            </p>
            <h1 className="title-screen text-[26px] md:text-[28px] leading-tight mt-1">Confirmar examen</h1>
          </div>
        </div>

        <div className="mb-6">
          <FlowSteps current={2} />
        </div>

        <div className="card">
          {/* Estudiante */}
          <section className="p-6 border-b border-line">
            <SectionLabel>Estudiante</SectionLabel>
            <dl className="mt-3 grid sm:grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
              <dt className="flex items-center gap-2 text-muted"><CreditCard className="w-4 h-4" />DNI</dt>
              <dd className="num font-semibold text-ink">{student.dni}</dd>
              <dt className="flex items-center gap-2 text-muted"><User className="w-4 h-4" />Nombre</dt>
              <dd className="font-semibold text-ink">{student.fullName}</dd>
              <dt className="flex items-center gap-2 text-muted"><GraduationCap className="w-4 h-4" />Universidad</dt>
              <dd className="font-semibold text-ink">{universityName}</dd>
            </dl>
          </section>

          {/* Examen */}
          <section className="p-6">
            <SectionLabel>Examen {exam.nombre}</SectionLabel>
            {exam.descripcion && <p className="text-sm text-muted mt-2">{exam.descripcion}</p>}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {kpis.map(k => (
                <div key={k.label} className="rounded-control border border-line p-3">
                  <k.icon className="w-4 h-4 text-jungle-600" />
                  <p className="num text-xl font-semibold text-ink mt-2">{k.value}</p>
                  <p className="text-[13px] text-muted">{k.label}</p>
                </div>
              ))}
            </div>
            {fuente && <p className="mt-4 text-xs text-subtle">Fuente: {fuente}</p>}
          </section>

          {/* Reglas y cursos (6.8) */}
          <section className="px-6">
            <Accordion>
              <AccordionItem title="Reglas del examen" icon={<AlertTriangle className="w-4 h-4" />} defaultOpen>
                <ol className="space-y-2">
                  {instructions.map((instruction, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="num font-semibold text-jungle-800">{index + 1}.</span>
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ol>
              </AccordionItem>
              <AccordionItem title="Cómo se califica" icon={<Award className="w-4 h-4" />}>
                <p className="mb-4">
                  Nota de 0 a {scaleMax}{passing !== null ? `; se aprueba con ${passing}` : ''}. Las preguntas sin
                  contestar cuentan como incorrectas.
                </p>
                <GradingStepper />
              </AccordionItem>
              <AccordionItem title={`Cursos evaluados (${examCourses.length})`} icon={<BookOpen className="w-4 h-4" />}>
                {examCourses.length === 0 ? (
                  <p className="text-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cargando cursos...
                  </p>
                ) : (
                  <ul className={`divide-y divide-line ${examCourses.length > 12 ? 'max-h-80 overflow-y-auto pr-1' : ''}`}>
                    {examCourses.map((course) => (
                      <li key={course.name} className="flex items-center justify-between gap-2 text-sm py-2">
                        <span className="text-ink">{course.name}</span>
                        <span className="num font-semibold text-ink flex-shrink-0">{course.questionCount}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionItem>
            </Accordion>
          </section>

          {/* Acciones */}
          <div className="sticky bottom-0 z-10 bg-white rounded-b-2xl border-t border-line p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-row justify-between gap-3">
            <button onClick={() => navigate('/registro')} className="btn-secondary">
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Modificar datos</span>
              <span className="sm:hidden">Datos</span>
            </button>
            <button onClick={handleStartExam} disabled={!examConfig} className="btn-primary flex-1 sm:flex-none">
              {examConfig ? <PlayCircle className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
              {examConfig ? <>Empezar · <span className="num">{formatDurationShort(durationMinutes)}</span></> : 'Cargando…'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
