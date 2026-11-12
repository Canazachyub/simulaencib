import { useEffect, useState, useMemo, useRef } from 'react';
import { mascota } from '../utils/imagenes';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, RotateCcw, CheckCircle, XCircle, ChevronLeft, ChevronRight, History, Target
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { useExamStore } from '../hooks/useExam';
import { PERFORMANCE_MESSAGES, ALL_UNIVERSITIES, SITE_NAME } from '../types';
import { formatTimeReadable, formatDate, indexToLetter, formatVigesimalScore, formatPoints } from '../utils/calculations';
import { PDFGenerator } from './PDFGenerator';
import { saveScore, getUserHistory, type UserHistory } from '../services/api';
import { TopBar, TerminalFooter, SectionLabel } from './terminal';
import { FlashcardReview, Sparkline, toCard, type StudyCard } from './study';
import clsx from 'clsx';

type ReviewFilter = 'all' | 'wrong' | 'blank';
type AnswerState = 'correct' | 'wrong' | 'blank';

/** Colores 6.9: verde ≥ 70 %, ámbar 50–69 %, rojo < 50 %. */
function barTone(percentage: number): { bar: string; text: string } {
  if (percentage >= 70) return { bar: 'bg-correct', text: 'text-correct' };
  if (percentage >= 50) return { bar: 'bg-warning', text: 'text-warning' };
  return { bar: 'bg-wrong', text: 'text-wrong' };
}

export function Results() {
  const navigate = useNavigate();
  const { result, questions, resetExam, scoreSavedByServer } = useExamStore();
  const [showReview, setShowReview] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [activeTab, setActiveTab] = useState<'review' | 'details' | 'history'>('review');
  const [userHistory, setUserHistory] = useState<UserHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scoreSaved = useRef(false);
  const [cards, setCards] = useState<StudyCard[] | null>(null);

  useEffect(() => {
    if (!result) {
      navigate('/');
      return;
    }

    // Guardar puntaje y obtener historial (solo una vez)
    if (!scoreSaved.current) {
      scoreSaved.current = true;

      // Primero guardar puntaje, LUEGO obtener historial
      const saveAndFetchHistory = async () => {
        setLoadingHistory(true);

        // Con el servidor nuevo, gradeSimulacro ya guardó el puntaje; solo el backend viejo lo guarda desde aquí
        if (!scoreSavedByServer) await saveScore({
          exam: result.examId,
          dni: result.student.dni,
          correctAnswers: result.correctAnswers,
          totalQuestions: result.totalQuestions,
          rawScore: result.rawScore,
          vigesimalScore: result.vigesimalScore
        });

        // Pequeña espera para asegurar que Google Sheets procese el registro
        await new Promise(resolve => setTimeout(resolve, 500));

        // Ahora sí obtener el historial actualizado
        const history = await getUserHistory(result.student.dni, result.examId);
        setUserHistory(history);
        setLoadingHistory(false);
      };

      saveAndFetchHistory();
    }
  }, [result, navigate, scoreSavedByServer]);

  // Datos para la revisión de preguntas
  const answerMap = useMemo(() => {
    const map = new Map<string, { selectedOption: number | null; isCorrect: boolean }>();
    (result?.answers ?? []).forEach(answer => {
      map.set(answer.questionId, {
        selectedOption: answer.selectedOption,
        isCorrect: answer.isCorrect
      });
    });
    return map;
  }, [result?.answers]);

  // Estado de cada pregunta (correcta / incorrecta / en blanco)
  const stateOf = useMemo(() => {
    return (questionId: string): AnswerState => {
      const a = answerMap.get(questionId);
      if (!a || a.selectedOption === null) return 'blank';
      return a.isCorrect ? 'correct' : 'wrong';
    };
  }, [answerMap]);

  // Agrupar preguntas por curso para el navegador
  const questionsByCourse = useMemo(() => {
    const groups: { course: string; questions: { index: number; state: AnswerState }[] }[] = [];
    let currentCourse = '';

    questions.forEach((q, idx) => {
      if (q.subject !== currentCourse) {
        currentCourse = q.subject;
        groups.push({ course: currentCourse, questions: [] });
      }
      groups[groups.length - 1].questions.push({ index: idx, state: stateOf(q.id) });
    });

    return groups;
  }, [questions, stateOf]);

  // Índices visibles según el filtro de revisión
  const filteredIndexes = useMemo(() => {
    return questions
      .map((q, idx) => ({ idx, state: stateOf(q.id) }))
      .filter(({ state }) => reviewFilter === 'all' || state === reviewFilter)
      .map(({ idx }) => idx);
  }, [questions, stateOf, reviewFilter]);

  if (!result) return null;

  const scaleMax = result.scaleMax ?? 20;
  const examName = result.examName ?? 'ENCIB';
  const passing = result.passing ?? null;
  const hasWeightedPoints = Math.abs((result.maxPoints ?? result.totalQuestions) - result.totalQuestions) > 0.001;

  const performanceInfo = PERFORMANCE_MESSAGES[result.performanceLevel];

  // Obtener nombre de la universidad
  const universityInfo = ALL_UNIVERSITIES.find(u => u.code === result.student.university);
  const universityName = universityInfo ? universityInfo.name : result.student.university;

  // Barras por curso: de peor a mejor
  const sortedCourses = [...result.courseResults].sort((a, b) => a.percentage - b.percentage);

  const handleRestart = () => {
    resetExam();
    navigate('/');
  };

  const totalCorrect = result.correctAnswers;
  const totalQuestions = result.totalQuestions;
  const blankCount = result.answers.filter(a => a.selectedOption === null).length;
  const wrongCount = totalQuestions - totalCorrect - blankCount;
  const averageTimePerQuestion = result.answers.length > 0
    ? result.answers.reduce((sum, a) => sum + a.timeSpent, 0) / result.answers.length
    : 0;

  const currentQuestion = questions[reviewIndex];
  const currentAnswer = currentQuestion ? answerMap.get(currentQuestion.id) : null;

  // Navegación del detalle dentro del filtro activo
  const posInFilter = filteredIndexes.indexOf(reviewIndex);
  const prevIndex = posInFilter > 0 ? filteredIndexes[posInFilter - 1] : null;
  const nextIndex = posInFilter >= 0 && posInFilter < filteredIndexes.length - 1 ? filteredIndexes[posInFilter + 1] : null;

  const kpis = [
    { label: 'Correctas', value: String(totalCorrect), tone: 'text-correct' },
    { label: 'Incorrectas', value: String(wrongCount), tone: 'text-wrong' },
    { label: 'En blanco', value: String(blankCount), tone: 'text-ink' },
    { label: 'Tiempo', value: formatTimeReadable(result.totalTime), tone: 'text-ink' }
  ];

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'review', label: 'Revisión' },
    { id: 'details', label: 'Detalle' },
    { id: 'history', label: 'Historial' }
  ];

  const filters: { id: ReviewFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Todas', count: questions.length },
    { id: 'wrong', label: 'Incorrectas', count: wrongCount },
    { id: 'blank', label: 'En blanco', count: blankCount }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {cards && (
        <FlashcardReview examId={result.examId} cards={cards} title={`Fichas · ${examName}`} onClose={() => setCards(null)} />
      )}
      <TopBar />

      <main className="flex-1 max-w-terminal w-full mx-auto px-4 lg:px-8 py-8 lg:py-10 space-y-10">
        {/* Cabecera + nota */}
        <section>
          <p className="meta">
            {examName} · Simulacro · {totalQuestions} preguntas · {formatDate(result.date)}
          </p>
          <h1 className="title-screen text-[28px] md:text-[32px] mt-1">Resultados {examName}</h1>

          <div className="mt-6 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-5">
              <ScoreRing correct={totalCorrect} wrong={wrongCount} blank={blankCount} percentage={result.percentage} />
              <div className="min-w-0">
              <SectionLabel>Nota</SectionLabel>
              <p className="num font-display font-extrabold text-jungle-800 leading-none mt-2 text-[48px] sm:text-[56px]">
                {formatVigesimalScore(result.vigesimalScore)}
                <span className="text-2xl font-semibold text-subtle"> / {scaleMax}</span>
              </p>
              </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {result.passed !== null && passing !== null && (
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-sm font-semibold',
                      result.passed ? 'bg-correct-bg text-correct' : 'bg-wrong-bg text-wrong'
                    )}
                  >
                    {result.passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {result.passed ? 'Aprobado' : 'Desaprobado'}
                    <span className="font-medium opacity-80">· mínimo {passing}</span>
                  </span>
                )}
                {hasWeightedPoints && (
                  <span className="pill num">
                    {formatPoints(result.rawScore)} / {formatPoints(result.maxPoints)} pts
                  </span>
                )}
              </div>
            </div>

            <div className="md:max-w-sm md:text-right flex md:flex-col items-center md:items-end gap-3">
              <img
                src={mascota(result.percentage >= 70 ? 'celebra' : result.percentage >= 50 ? 'piensa' : 'anima')}
                alt=""
                aria-hidden
                draggable={false}
                className="w-24 h-24 md:w-28 md:h-28 object-contain shrink-0 motion-safe:animate-pop"
              />
              <div>
              <p className="text-[15px] font-semibold text-ink">{performanceInfo.title}</p>
              <p className="text-sm text-muted mt-1 leading-relaxed">{performanceInfo.message}</p>
              <p className="meta mt-3 truncate">
                {result.student.fullName} · DNI {result.student.dni}
                {universityName && <> · {universityName}</>}
              </p>
            </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map(k => (
              <div key={k.label} className="rounded-xl border border-line bg-white p-4">
                <SectionLabel>{k.label}</SectionLabel>
                <p className={clsx('num text-2xl font-semibold mt-2', k.tone)}>{k.value}</p>
              </div>
            ))}
          </div>
          <p className="meta num mt-3 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" />
            Promedio {Math.round(averageTimePerQuestion)} s por pregunta
          </p>

          {/* Tu evolución + fichas */}
          <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-xl border border-line bg-white p-4">
              <div className="flex items-baseline justify-between gap-3">
                <SectionLabel>Tu evolución en {examName}</SectionLabel>
                {userHistory && userHistory.history.length > 0 && (
                  <span className="meta num">
                    {userHistory.history.length} {userHistory.history.length === 1 ? 'intento' : 'intentos'} · mejor {formatVigesimalScore(userHistory.mejorNota)}
                  </span>
                )}
              </div>
              {loadingHistory ? (
                <p className="mt-3 text-sm text-muted">Cargando tus notas anteriores…</p>
              ) : userHistory && userHistory.history.length > 1 ? (
                <Sparkline
                  className="mt-2"
                  values={[...userHistory.history]
                    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
                    .slice(-12)
                    .map(h => h.notaVigesimal)}
                  max={scaleMax}
                />
              ) : (
                <p className="mt-3 text-sm text-muted">Este es tu primer intento registrado. Vuelve a rendirlo para ver tu curva.</p>
              )}
            </div>
            {(wrongCount + blankCount) > 0 && (
              <button
                type="button"
                onClick={() => setCards(
                  questions
                    .filter(q => stateOf(q.id) !== 'correct')
                    .map(q => toCard(q))
                )}
                className="rounded-xl border border-line bg-white p-4 text-left hover:border-jungle-600 transition-colors md:w-64"
              >
                <SectionLabel>Fichas de estudio</SectionLabel>
                <p className="mt-2 text-[15px] font-semibold text-jungle-800">Repasar falladas como fichas</p>
                <p className="text-sm text-muted num mt-0.5">{wrongCount + blankCount} fichas · gira y califícate</p>
              </button>
            )}
          </div>
        </section>

        {/* Rendimiento por curso (peor → mejor) */}
        <section className="card p-5 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
            <div>
              <SectionLabel>Rendimiento por curso</SectionLabel>
              <p className="text-sm text-muted mt-1">
                {sortedCourses.length} cursos, de menor a mayor acierto
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-correct" />≥ 70 %</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warning" />50–69 %</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-wrong" />&lt; 50 %</span>
            </div>
          </div>

          <ul className={clsx('space-y-2.5', sortedCourses.length > 14 && 'max-h-[460px] overflow-y-auto pr-2')}>
            {sortedCourses.map(course => {
              const tone = barTone(course.percentage);
              return (
                <li key={course.name} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[200px_minmax(0,1fr)_96px] items-center gap-x-4 gap-y-1">
                  <span className="text-sm font-medium text-ink truncate" title={course.name}>{course.name}</span>
                  <span className="num text-sm text-muted text-right md:order-3">
                    <span className={clsx('font-semibold', tone.text)}>{course.percentage.toFixed(0)}%</span>
                    {' '}· {course.correctAnswers}/{course.totalQuestions}
                  </span>
                  <div className="col-span-2 md:col-span-1 md:order-2 h-5 rounded-md bg-paper overflow-hidden">
                    <div
                      className={clsx('h-full rounded-md', tone.bar)}
                      style={{ width: `${Math.max(course.percentage, course.percentage > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Pestañas */}
        <section>
          <div role="tablist" className="flex gap-6 border-b border-line">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                className={clsx(
                  'h-11 -mb-px border-b-2 text-sm font-medium transition-colors',
                  activeTab === t.id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Revisión de preguntas */}
          {activeTab === 'review' && (
            <div className="pt-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {filters.map(f => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setReviewFilter(f.id);
                        setShowReview(false);
                      }}
                      className={clsx('chip', reviewFilter === f.id && 'chip-active')}
                    >
                      {f.label}
                      <span className="num font-medium text-muted">{f.count}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-correct" />Correcta</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-wrong" />Incorrecta</span>
                  <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-line bg-white" />En blanco</span>
                </div>
              </div>

              {filteredIndexes.length === 0 ? (
                <p className="text-sm text-muted py-6 text-center">No hay preguntas en este filtro.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {questionsByCourse.map((group, gIdx) => {
                    const visible = group.questions.filter(q => reviewFilter === 'all' || q.state === reviewFilter);
                    if (visible.length === 0) return null;
                    const correctCount = group.questions.filter(q => q.state === 'correct').length;
                    const totalCount = group.questions.length;

                    return (
                      <div key={gIdx} className="rounded-xl border border-line p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-ink truncate flex-1">{group.course}</h4>
                          <span className="num text-xs font-medium text-muted ml-2">
                            {correctCount}/{totalCount}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {visible.map(({ index, state }) => (
                            <button
                              key={index}
                              onClick={() => {
                                setReviewIndex(index);
                                setShowReview(true);
                              }}
                              aria-label={`Pregunta ${index + 1}`}
                              className={clsx(
                                'num w-8 h-8 rounded-md text-xs font-semibold transition-colors',
                                state === 'correct' && 'bg-correct text-white hover:opacity-90',
                                state === 'wrong' && 'bg-wrong text-white hover:opacity-90',
                                state === 'blank' && 'bg-white border border-line text-muted hover:bg-paper',
                                index === reviewIndex && showReview && 'ring-2 ring-jungle-800 ring-offset-1'
                              )}
                            >
                              {index + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Detalle de la pregunta */}
              {showReview && currentQuestion && (
                <div className="card p-5 md:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <p className="meta">{currentQuestion.subject}</p>
                      <h3 className="title-screen text-xl mt-0.5 num">
                        Pregunta {reviewIndex + 1} / {questions.length}
                      </h3>
                    </div>
                    {currentQuestion.sourceFile && (
                      <span className="text-xs text-subtle">Fuente: {currentQuestion.sourceFile}</span>
                    )}
                  </div>

                  <div
                    className="text-[17px] leading-[1.65] text-ink max-w-[68ch] mb-5"
                    dangerouslySetInnerHTML={{ __html: currentQuestion.questionText }}
                  />

                  {currentQuestion.imageLink && (
                    <div className="mb-5">
                      <img
                        src={currentQuestion.imageLink}
                        alt="Imagen de la pregunta"
                        className="max-w-full h-auto rounded-xl border border-line"
                        style={{ maxHeight: '240px' }}
                      />
                    </div>
                  )}

                  <div className="space-y-2 mb-4" role="list">
                    {currentQuestion.options.map((option, index) => {
                      const isSelected = currentAnswer?.selectedOption === index;
                      const isCorrectAnswer = currentQuestion.correctAnswer === index;

                      return (
                        <div
                          key={index}
                          role="listitem"
                          className={clsx(
                            'min-h-12 px-4 py-3 rounded-xl border flex items-start gap-3',
                            isCorrectAnswer
                              ? 'border-correct bg-correct text-white'
                              : isSelected
                                ? 'border-wrong bg-wrong-bg text-ink'
                                : 'border-line bg-white text-ink opacity-50'
                          )}
                        >
                          <span
                            className={clsx(
                              'shrink-0 w-7 h-7 rounded-full grid place-items-center text-sm font-semibold',
                              isCorrectAnswer
                                ? 'bg-white text-correct'
                                : isSelected
                                  ? 'bg-wrong text-white'
                                  : 'bg-paper text-muted'
                            )}
                          >
                            {isCorrectAnswer ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : isSelected ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              indexToLetter(index)
                            )}
                          </span>
                          <span className="flex-1 pt-0.5 text-[15px] font-medium">{option}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    className={clsx(
                      'px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium',
                      currentAnswer?.isCorrect
                        ? 'bg-correct-bg text-correct'
                        : currentAnswer?.selectedOption == null
                          ? 'bg-paper text-muted'
                          : 'bg-wrong-bg text-wrong'
                    )}
                  >
                    {currentAnswer?.isCorrect ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Respuesta correcta (+{formatPoints(currentQuestion.points)} {currentQuestion.points === 1 ? 'punto' : 'puntos'})
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        {currentAnswer?.selectedOption == null
                          ? `Sin responder · la correcta es ${indexToLetter(currentQuestion.correctAnswer)}`
                          : `Respuesta incorrecta · la correcta es ${indexToLetter(currentQuestion.correctAnswer)}`}
                      </>
                    )}
                  </div>

                  {currentQuestion.justification && (
                    <div className="mt-4 rounded-xl border border-line bg-paper p-4 md:p-5">
                      <SectionLabel>Justificación</SectionLabel>
                      <div
                        className="mt-2 text-[15px] leading-relaxed text-ink max-w-[68ch]"
                        dangerouslySetInnerHTML={{ __html: currentQuestion.justification }}
                      />
                    </div>
                  )}

                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => prevIndex !== null && setReviewIndex(prevIndex)}
                      disabled={prevIndex === null}
                      className="btn-secondary flex-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </button>
                    <button
                      onClick={() => nextIndex !== null && setReviewIndex(nextIndex)}
                      disabled={nextIndex === null}
                      className="btn-secondary flex-1"
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detalle por curso */}
          {activeTab === 'details' && (
            <div className="pt-6">
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-paper">
                      <tr>
                        <th className="px-5 py-3 text-left label-section">Curso</th>
                        <th className="px-5 py-3 text-center label-section">Correctas</th>
                        <th className="px-5 py-3 text-right label-section">Porcentaje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {result.courseResults.map((course, index) => (
                        <tr key={index} className="hover:bg-paper transition-colors">
                          <td className="px-5 py-3 text-sm font-medium text-ink">{course.name}</td>
                          <td className="px-5 py-3 text-sm text-center text-muted num">
                            {course.correctAnswers} / {course.totalQuestions}
                          </td>
                          <td className={clsx('px-5 py-3 text-sm text-right font-semibold num', barTone(course.percentage).text)}>
                            {course.percentage.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-line bg-paper">
                      <tr>
                        <td className="px-5 py-3 text-sm font-semibold text-ink">Total</td>
                        <td className="px-5 py-3 text-sm text-center font-semibold text-ink num">
                          {totalCorrect} / {totalQuestions}
                        </td>
                        <td className="px-5 py-3 text-sm text-right font-semibold text-ink num">
                          {result.percentage.toFixed(1)}%
                        </td>
                      </tr>
                      {hasWeightedPoints && (
                        <tr>
                          <td colSpan={2} className="px-5 py-3 text-sm font-semibold text-ink">Puntos obtenidos</td>
                          <td className="px-5 py-3 text-sm text-right font-semibold text-ink num">
                            {formatPoints(result.rawScore)} / {formatPoints(result.maxPoints)}
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={2} className="px-5 py-3 text-sm font-semibold text-ink">
                          Nota (0–{scaleMax})
                          {result.passed !== null && passing !== null && (
                            <span className={clsx('ml-2 text-xs font-semibold', result.passed ? 'text-correct' : 'text-wrong')}>
                              {result.passed ? 'Aprobado' : 'Desaprobado'}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="num text-lg font-bold text-jungle-800">
                            {formatVigesimalScore(result.vigesimalScore)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Historial de puntajes */}
          {activeTab === 'history' && (
            <div className="pt-6">
              {loadingHistory ? (
                <div className="text-center py-10">
                  <div className="w-7 h-7 border-2 border-line border-t-jungle-800 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-muted">Cargando historial…</p>
                </div>
              ) : userHistory && userHistory.history.length > 0 ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-line p-4">
                      <SectionLabel>Simulacros</SectionLabel>
                      <p className="num text-2xl font-semibold text-ink mt-2">{userHistory.totalIntentos}</p>
                    </div>
                    <div className="rounded-xl border border-line p-4">
                      <SectionLabel>Mejor nota</SectionLabel>
                      <p className="num text-2xl font-semibold text-ink mt-2">{formatVigesimalScore(userHistory.mejorNota)}</p>
                    </div>
                    <div className="rounded-xl border border-line p-4">
                      <SectionLabel>Vs. anterior</SectionLabel>
                      <p className="num text-2xl font-semibold text-ink mt-2">
                        {userHistory.history.length >= 2
                          ? (userHistory.history[0].notaVigesimal - userHistory.history[1].notaVigesimal > 0 ? '+' : '')
                            + formatVigesimalScore(userHistory.history[0].notaVigesimal - userHistory.history[1].notaVigesimal)
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {userHistory.history.length >= 2 && (
                    <div className="card p-5">
                      <SectionLabel className="mb-3">Evolución de tus notas</SectionLabel>
                      <div style={{ height: 240 }} className="w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={[...userHistory.history].reverse().map((h, idx) => ({
                              intento: `#${idx + 1}`,
                              nota: h.notaVigesimal,
                              correctas: h.correctas
                            }))}
                            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid stroke="#E2E8E6" vertical={false} />
                            <XAxis dataKey="intento" stroke="#8A9A96" fontSize={12} tickLine={false} axisLine={{ stroke: '#E2E8E6' }} />
                            <YAxis stroke="#8A9A96" fontSize={12} domain={[0, scaleMax]} tickLine={false} axisLine={false} width={32} />
                            <Tooltip
                              cursor={{ stroke: '#E2E8E6' }}
                              content={({ payload }) => {
                                if (!payload || payload.length === 0) return null;
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-white border border-line rounded-xl px-3 py-2 shadow-card">
                                    <p className="text-xs text-muted">{data.intento}</p>
                                    <p className="num font-semibold text-ink">{formatVigesimalScore(data.nota)} / {scaleMax}</p>
                                    <p className="num text-xs text-muted">{data.correctas} correctas</p>
                                  </div>
                                );
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="nota"
                              stroke="#10312D"
                              strokeWidth={2}
                              dot={{ fill: '#10312D', strokeWidth: 0, r: 4 }}
                              activeDot={{ r: 6, fill: '#1F5B52' }}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-paper">
                          <tr>
                            <th className="px-4 py-2.5 text-left label-section">#</th>
                            <th className="px-4 py-2.5 text-left label-section">Fecha</th>
                            <th className="px-4 py-2.5 text-center label-section">Correctas</th>
                            <th className="px-4 py-2.5 text-right label-section">Nota</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {userHistory.history.map((entry, index) => {
                            const isLatest = index === 0;
                            const isBest = entry.notaVigesimal === userHistory.mejorNota;
                            return (
                              <tr key={index} className={clsx(isLatest && 'bg-jungle-50')}>
                                <td className="px-4 py-3 text-sm text-muted num">
                                  {userHistory.totalIntentos - index}
                                  {isLatest && <span className="ml-1 text-xs text-jungle-600">(actual)</span>}
                                </td>
                                <td className="px-4 py-3 text-sm text-muted">
                                  {new Date(entry.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="px-4 py-3 text-sm text-center text-muted num">
                                  {entry.correctas}/{entry.total}
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-semibold num">
                                  <span className="inline-flex items-center gap-1 text-ink">
                                    {isBest && <Trophy className="w-3.5 h-3.5 text-jungle-600" aria-label="Mejor nota" />}
                                    {formatVigesimalScore(entry.notaVigesimal)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <History className="w-10 h-10 text-subtle mx-auto mb-3" />
                  <p className="text-ink font-medium">Este es tu primer simulacro</p>
                  <p className="text-sm text-muted mt-1">Vuelve a practicar para ver tu progreso aquí</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Acciones: un solo primario (Descargar PDF) */}
        <section className="flex flex-col sm:flex-row gap-3 sm:justify-center border-t border-line pt-8">
          {/* PDFGenerator trae su propio color; se fuerza el primario de la marca */}
          <span className="contents [&_button]:!bg-jungle-800 [&_button:hover]:!bg-jungle-600">
            <PDFGenerator result={result} />
          </span>
          <button onClick={() => navigate('/banqueo/cursos')} className="btn-secondary">
            <Target className="w-4 h-4" />
            Practicar mis cursos débiles
          </button>
          <button onClick={handleRestart} className="btn-secondary">
            <RotateCcw className="w-4 h-4" />
            Nuevo simulacro
          </button>
        </section>

        <p className="text-center meta">{SITE_NAME} · Simulacro {examName}</p>
      </main>

      <TerminalFooter />
    </div>
  );
}

// Anillo de resultado: correctas (verde), incorrectas (rojo) y en blanco (gris), con el % al centro
function ScoreRing({ correct, wrong, blank, percentage }: { correct: number; wrong: number; blank: number; percentage: number }) {
  const total = Math.max(1, correct + wrong + blank);
  const r = 40;
  const c = 2 * Math.PI * r;
  const segs = [
    { v: correct, color: '#16A34A' },
    { v: wrong, color: '#DC2626' },
    { v: blank, color: '#E2E8E6' },
  ];
  let offset = 0;
  return (
    <div className="relative w-[104px] h-[104px] shrink-0" role="img" aria-label={`${correct} correctas, ${wrong} incorrectas, ${blank} en blanco`}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#F6F8F7" strokeWidth="12" />
        {segs.map((sg, i) => {
          const len = (sg.v / total) * c;
          const el = sg.v > 0 ? (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={sg.color}
              strokeWidth="12"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          ) : null;
          offset += len;
          return el;
        })}
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        <span className="text-center leading-none">
          <span className="block num text-xl font-bold text-ink">{Math.round(percentage)}%</span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted mt-1">acierto</span>
        </span>
      </span>
    </div>
  );
}
