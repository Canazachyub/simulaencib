import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, Clock, Target, TrendingUp, RotateCcw,
  CheckCircle, XCircle, User, CreditCard, GraduationCap, Calendar,
  Grid3X3, ChevronLeft, ChevronRight, Eye, Table2, BarChart3, History, Award, Stethoscope
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line
} from 'recharts';
import { useExamStore } from '../hooks/useExam';
import { PERFORMANCE_MESSAGES, ALL_UNIVERSITIES } from '../types';
import { formatTimeReadable, formatNumber, formatDate, getColorForPercentage, indexToLetter, formatVigesimalScore } from '../utils/calculations';
import { PDFGenerator } from './PDFGenerator';
import { saveScore, getUserHistory, type UserHistory } from '../services/api';
import clsx from 'clsx';

interface ChartDataItem {
  name: string;
  fullName: string;
  percentage: number;
  correct: number;
  total: number;
}

export function Results() {
  const navigate = useNavigate();
  const { result, questions, resetExam } = useExamStore();
  const [showReview, setShowReview] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'review' | 'chart' | 'details' | 'history'>('review');
  const [userHistory, setUserHistory] = useState<UserHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scoreSaved = useRef(false);

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

        // Guardar puntaje con formato ENCIB
        await saveScore({
          dni: result.student.dni,
          correctAnswers: result.correctAnswers,
          totalQuestions: result.totalQuestions,
          rawScore: result.rawScore,
          vigesimalScore: result.vigesimalScore
        });

        // Pequeña espera para asegurar que Google Sheets procese el registro
        await new Promise(resolve => setTimeout(resolve, 500));

        // Ahora sí obtener el historial actualizado
        const history = await getUserHistory(result.student.dni);
        setUserHistory(history);
        setLoadingHistory(false);
      };

      saveAndFetchHistory();
    }
  }, [result, navigate]);

  if (!result) return null;

  const performanceInfo = PERFORMANCE_MESSAGES[result.performanceLevel];

  // Obtener nombre de la universidad
  const universityInfo = ALL_UNIVERSITIES.find(u => u.code === result.student.university);
  const universityName = universityInfo ? universityInfo.name : result.student.university;

  const chartData: ChartDataItem[] = result.courseResults.map((course) => ({
    name: course.name.length > 15 ? course.name.slice(0, 15) + '...' : course.name,
    fullName: course.name,
    percentage: course.percentage,
    correct: course.correctAnswers,
    total: course.totalQuestions
  }));

  const handleRestart = () => {
    resetExam();
    navigate('/');
  };

  const totalCorrect = result.correctAnswers;
  const totalQuestions = result.totalQuestions;
  const averageTimePerQuestion = result.answers.length > 0
    ? result.answers.reduce((sum, a) => sum + a.timeSpent, 0) / result.answers.length
    : 0;

  // Datos para la revisión de preguntas
  const answerMap = useMemo(() => {
    const map = new Map<string, { selectedOption: number | null; isCorrect: boolean }>();
    result.answers.forEach(answer => {
      map.set(answer.questionId, {
        selectedOption: answer.selectedOption,
        isCorrect: answer.isCorrect
      });
    });
    return map;
  }, [result.answers]);

  // Agrupar preguntas por curso para el navegador
  const questionsByCourse = useMemo(() => {
    const groups: { course: string; questions: { index: number; isCorrect: boolean }[] }[] = [];
    let currentCourse = '';

    questions.forEach((q, idx) => {
      if (q.subject !== currentCourse) {
        currentCourse = q.subject;
        groups.push({ course: currentCourse, questions: [] });
      }
      const answer = answerMap.get(q.id);
      groups[groups.length - 1].questions.push({
        index: idx,
        isCorrect: answer?.isCorrect ?? false
      });
    });

    return groups;
  }, [questions, answerMap]);

  const currentQuestion = questions[reviewIndex];
  const currentAnswer = currentQuestion ? answerMap.get(currentQuestion.id) : null;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Score Card - ENCIB con nota vigesimal */}
        <div className="card p-8 text-center animate-fade-in">
          <div
            className={clsx(
              'inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6',
              {
                'bg-emerald-100 text-emerald-700': result.performanceLevel === 'excellent',
                'bg-blue-100 text-blue-700': result.performanceLevel === 'good',
                'bg-amber-100 text-amber-700': result.performanceLevel === 'regular',
                'bg-red-100 text-red-700': result.performanceLevel === 'needs_practice'
              }
            )}
          >
            <Trophy className="w-5 h-5" />
            <span className="font-semibold">{performanceInfo.title}</span>
          </div>

          {/* Nota Vigesimal prominente */}
          <div className="mb-4">
            <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Nota Vigesimal</h2>
            <h1 className="text-5xl md:text-6xl font-extrabold text-cyan-600">
              {formatVigesimalScore(result.vigesimalScore)}
              <span className="text-2xl text-slate-400 font-normal"> / 20</span>
            </h1>
          </div>

          {/* Puntaje bruto secundario */}
          <div className="mb-6">
            <p className="text-slate-600">
              <span className="font-bold text-slate-800">{result.rawScore}</span> de {result.totalQuestions} respuestas correctas
              <span className="text-slate-400 mx-2">|</span>
              {result.percentage.toFixed(1)}%
            </p>
          </div>

          <p className="text-lg text-slate-700 max-w-xl mx-auto">
            {performanceInfo.message}
          </p>
        </div>

        {/* Student Info */}
        <div className="card p-6 animate-fade-in">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-600" />
            Datos del examen
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-slate-600">
              <CreditCard className="w-5 h-5 text-slate-400" />
              <span>DNI: <strong className="text-slate-800">{result.student.dni}</strong></span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <User className="w-5 h-5 text-slate-400" />
              <span className="truncate">Nombre: <strong className="text-slate-800">{result.student.fullName}</strong></span>
            </div>
            <div className="flex items-start gap-3 text-slate-600">
              <GraduationCap className="w-5 h-5 text-slate-400 mt-0.5" />
              <span className="truncate">Universidad: <strong className="text-slate-800">{universityName}</strong></span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <Calendar className="w-5 h-5 text-slate-400" />
              <span className="text-sm">{formatDate(result.date)}</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          <div className="card p-4 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-800">{totalCorrect}</p>
            <p className="text-sm text-slate-500">Correctas</p>
          </div>
          <div className="card p-4 text-center">
            <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-800">{totalQuestions - totalCorrect}</p>
            <p className="text-sm text-slate-500">Incorrectas</p>
          </div>
          <div className="card p-4 text-center">
            <Clock className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-800">{formatTimeReadable(result.totalTime)}</p>
            <p className="text-sm text-slate-500">Tiempo total</p>
          </div>
          <div className="card p-4 text-center">
            <Target className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-800">{Math.round(averageTimePerQuestion)}s</p>
            <p className="text-sm text-slate-500">Prom. por pregunta</p>
          </div>
        </div>

        {/* Tabs de navegación */}
        <div className="card p-2 animate-fade-in">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('review')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                activeTab === 'review'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              )}
            >
              <Grid3X3 className="w-4 h-4" />
              <span className="hidden sm:inline">Revisión</span>
              <span className="sm:hidden">Revisión</span>
            </button>
            <button
              onClick={() => setActiveTab('chart')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                activeTab === 'chart'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              )}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Rendimiento</span>
              <span className="sm:hidden">Gráfico</span>
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                activeTab === 'details'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              )}
            >
              <Table2 className="w-4 h-4" />
              <span className="hidden sm:inline">Detalle</span>
              <span className="sm:hidden">Tabla</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                activeTab === 'history'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              )}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Historial</span>
              <span className="sm:hidden">Historial</span>
            </button>
          </div>
        </div>

        {/* Tab Content: Revisión de Preguntas */}
        {activeTab === 'review' && (
        <>
        <div className="card p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Grid3X3 className="w-5 h-5 text-cyan-600" />
                Revisión de Preguntas
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Revisa cada pregunta para ver cuáles acertaste y cuáles fallaste
              </p>
            </div>
            <button
              onClick={() => setShowReview(!showReview)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                showReview
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )}
            >
              <Eye className="w-4 h-4" />
              {showReview ? 'Ocultar detalle' : 'Ver detalle'}
            </button>
          </div>

          {/* Legend compacta */}
          <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b border-slate-100 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
              <span className="text-slate-600">Correcta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-red-500"></div>
              <span className="text-slate-600">Incorrecta</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm ring-2 ring-cyan-500 bg-cyan-100"></div>
              <span className="text-slate-600">Viendo</span>
            </div>
          </div>

          {/* Navigator Grid - 2 columnas en desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {questionsByCourse.map((group, gIdx) => {
              const correctCount = group.questions.filter(q => q.isCorrect).length;
              const totalCount = group.questions.length;
              const percentage = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

              return (
                <div
                  key={gIdx}
                  className="bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors"
                >
                  {/* Header con nombre y stats */}
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-slate-700 truncate flex-1">
                      {group.course}
                    </h4>
                    <span
                      className={clsx(
                        'text-xs font-bold px-1.5 py-0.5 rounded ml-2',
                        percentage >= 60 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      )}
                    >
                      {correctCount}/{totalCount}
                    </span>
                  </div>

                  {/* Mini barra de progreso */}
                  <div className="h-1 bg-slate-200 rounded-full mb-2 overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        percentage >= 60 ? 'bg-emerald-500' : 'bg-red-500'
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  {/* Botones de preguntas */}
                  <div className="flex flex-wrap gap-1">
                    {group.questions.map(({ index, isCorrect }) => (
                      <button
                        key={index}
                        onClick={() => {
                          setReviewIndex(index);
                          setShowReview(true);
                        }}
                        className={clsx(
                          'w-7 h-7 rounded text-xs font-medium transition-all',
                          index === reviewIndex && showReview
                            ? 'ring-2 ring-cyan-500 ring-offset-1 scale-110 z-10'
                            : '',
                          isCorrect
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-red-500 text-white hover:bg-red-600'
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
        </div>

        {/* Question Detail View */}
        {showReview && currentQuestion && (
          <div className="card p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">
                Pregunta {reviewIndex + 1} de {questions.length}
              </h3>
              <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-medium">
                {currentQuestion.subject}
              </span>
            </div>

            {/* Question Text */}
            <div className="mb-4">
              <div
                className="text-slate-800 leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: `<span class="font-semibold text-cyan-600">P${reviewIndex + 1}.</span> ${currentQuestion.questionText}`
                }}
              />
            </div>

            {/* Source File */}
            {currentQuestion.sourceFile && (
              <div className="mb-4 text-right">
                <span className="text-xs italic text-slate-400 font-light">
                  Fuente: {currentQuestion.sourceFile}
                </span>
              </div>
            )}

            {/* Question Image */}
            {currentQuestion.imageLink && (
              <div className="mb-4">
                <img
                  src={currentQuestion.imageLink}
                  alt="Imagen de la pregunta"
                  className="max-w-full h-auto rounded-lg border border-slate-200 mx-auto"
                  style={{ maxHeight: '200px' }}
                />
              </div>
            )}

            {/* Options */}
            <div className="space-y-2 mb-4">
              {currentQuestion.options.map((option, index) => {
                const isSelected = currentAnswer?.selectedOption === index;
                const isCorrectAnswer = currentQuestion.correctAnswer === index;

                let optionStyle = 'border-slate-200 bg-white';
                if (isCorrectAnswer) {
                  optionStyle = 'border-emerald-500 bg-emerald-50';
                } else if (isSelected && !isCorrectAnswer) {
                  optionStyle = 'border-red-500 bg-red-50';
                }

                return (
                  <div
                    key={index}
                    className={clsx(
                      'p-3 rounded-lg border-2 flex items-start gap-3',
                      optionStyle
                    )}
                  >
                    <div
                      className={clsx(
                        'flex-shrink-0 w-8 h-8 rounded flex items-center justify-center font-bold text-sm',
                        isCorrectAnswer
                          ? 'bg-emerald-500 text-white'
                          : isSelected
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-200 text-slate-600'
                      )}
                    >
                      {isCorrectAnswer ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : isSelected ? (
                        <XCircle className="w-5 h-5" />
                      ) : (
                        indexToLetter(index)
                      )}
                    </div>
                    <span
                      className={clsx(
                        'flex-1 pt-1 text-sm',
                        isCorrectAnswer
                          ? 'text-emerald-700 font-medium'
                          : isSelected
                            ? 'text-red-700'
                            : 'text-slate-600'
                      )}
                    >
                      {option}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Result Badge */}
            <div
              className={clsx(
                'p-3 rounded-lg flex items-center gap-2',
                currentAnswer?.isCorrect
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-800'
              )}
            >
              {currentAnswer?.isCorrect ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Respuesta correcta (+1 punto)</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">
                    {currentAnswer?.selectedOption === null
                      ? 'Sin responder'
                      : `Respuesta incorrecta - La correcta es: ${indexToLetter(currentQuestion.correctAnswer)}`}
                  </span>
                </>
              )}
            </div>

            {/* Justification */}
            {currentQuestion.justification && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-700 mb-2">Justificación:</p>
                <div
                  className="text-sm text-blue-800 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.justification }}
                />
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setReviewIndex(Math.max(0, reviewIndex - 1))}
                disabled={reviewIndex === 0}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-all',
                  reviewIndex === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <button
                onClick={() => setReviewIndex(Math.min(questions.length - 1, reviewIndex + 1))}
                disabled={reviewIndex === questions.length - 1}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-all',
                  reviewIndex === questions.length - 1
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-cyan-600 text-white hover:bg-cyan-700'
                )}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        </>
        )}

        {/* Tab Content: Rendimiento por curso */}
        {activeTab === 'chart' && (
        <div className="card p-6 animate-fade-in">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-600" />
              Rendimiento por curso ({chartData.length} cursos)
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Visualiza gráficamente tu desempeño en cada curso para identificar fortalezas y áreas de mejora
            </p>
          </div>
          {/* Altura calculada: 45px por curso + padding */}
          <div style={{ height: Math.max(400, chartData.length * 50 + 40) }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 10, right: 40, left: 140, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  stroke="#94A3B8"
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#64748B"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  width={135}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload || payload.length === 0) return null;
                    const data = payload[0].payload as ChartDataItem;
                    return (
                      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-xl">
                        <p className="font-bold text-slate-800 mb-1">{data.fullName}</p>
                        <p className="text-slate-600">
                          <span className="font-semibold" style={{ color: getColorForPercentage(data.percentage) }}>
                            {data.percentage.toFixed(1)}%
                          </span>
                          {' '}({data.correct} de {data.total} correctas)
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="percentage"
                  radius={[0, 6, 6, 0]}
                  barSize={32}
                  background={{ fill: '#F1F5F9' }}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getColorForPercentage(entry.percentage)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Leyenda de colores - Basado en respuestas correctas */}
          <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-500"></div>
              <span className="text-sm text-slate-600">≥80% Excelente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <span className="text-sm text-slate-600">≥60% Bueno</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-500"></div>
              <span className="text-sm text-slate-600">≥50% Regular</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span className="text-sm text-slate-600">&lt;50% Necesita práctica</span>
            </div>
          </div>
        </div>
        )}

        {/* Tab Content: Detalle por curso */}
        {activeTab === 'details' && (
        <div className="card overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Table2 className="w-5 h-5 text-cyan-600" />
              Detalle por curso
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Consulta las respuestas correctas y porcentajes obtenidos en cada curso
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Curso
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Correctas
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Porcentaje
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.courseResults.map((course, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                      {course.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-slate-600">
                      {course.correctAnswers} / {course.totalQuestions}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={clsx(
                          'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                          {
                            'bg-emerald-100 text-emerald-700': course.percentage >= 80,
                            'bg-blue-100 text-blue-700': course.percentage >= 60 && course.percentage < 80,
                            'bg-amber-100 text-amber-700': course.percentage >= 50 && course.percentage < 60,
                            'bg-red-100 text-red-700': course.percentage < 50
                          }
                        )}
                      >
                        {course.percentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-cyan-50">
                <tr>
                  <td className="px-6 py-4 text-sm font-bold text-cyan-800">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 text-sm text-center font-bold text-cyan-800">
                    {totalCorrect} / {totalQuestions}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex px-2 py-1 text-xs font-bold rounded-full bg-cyan-200 text-cyan-800">
                      {result.percentage.toFixed(1)}%
                    </span>
                  </td>
                </tr>
                <tr className="bg-cyan-100">
                  <td colSpan={2} className="px-6 py-4 text-sm font-bold text-cyan-800">
                    NOTA VIGESIMAL
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex px-3 py-1 text-lg font-bold rounded-full bg-cyan-600 text-white">
                      {formatVigesimalScore(result.vigesimalScore)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        )}

        {/* Tab Content: Historial de Puntajes */}
        {activeTab === 'history' && (
        <div className="card p-6 animate-fade-in">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-600" />
              Tu Historial de Simulacros
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Visualiza tu progreso a lo largo del tiempo
            </p>
          </div>

          {loadingHistory ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500">Cargando historial...</p>
            </div>
          ) : userHistory && userHistory.history.length > 0 ? (
            <>
              {/* Stats del historial */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-4 text-center">
                  <Award className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-cyan-700">{userHistory.totalIntentos}</p>
                  <p className="text-xs text-cyan-600">Simulacros</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 text-center">
                  <Trophy className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-emerald-700">{formatVigesimalScore(userHistory.mejorNota)}</p>
                  <p className="text-xs text-emerald-600">Mejor Nota</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
                  <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-700">
                    {userHistory.history.length >= 2
                      ? (userHistory.history[0].notaVigesimal - userHistory.history[1].notaVigesimal > 0 ? '+' : '')
                        + formatVigesimalScore(userHistory.history[0].notaVigesimal - userHistory.history[1].notaVigesimal)
                      : '—'}
                  </p>
                  <p className="text-xs text-blue-600">vs Anterior</p>
                </div>
              </div>

              {/* Gráfico de progreso */}
              {userHistory.history.length >= 2 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-slate-600 mb-3">Evolución de tus notas</h3>
                  <div style={{ height: 250 }} className="w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={[...userHistory.history].reverse().map((h, idx) => ({
                          intento: `#${idx + 1}`,
                          nota: h.notaVigesimal,
                          correctas: h.correctas
                        }))}
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="intento" stroke="#94A3B8" fontSize={12} />
                        <YAxis stroke="#94A3B8" fontSize={12} domain={[0, 20]} />
                        <Tooltip
                          content={({ payload }) => {
                            if (!payload || payload.length === 0) return null;
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-xl">
                                <p className="font-bold text-slate-800">{data.intento}</p>
                                <p className="text-cyan-600 font-semibold">{formatVigesimalScore(data.nota)} / 20</p>
                                <p className="text-slate-500 text-sm">{data.correctas} correctas</p>
                              </div>
                            );
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="nota"
                          stroke="#0891B2"
                          strokeWidth={3}
                          dot={{ fill: '#0891B2', strokeWidth: 2, r: 5 }}
                          activeDot={{ r: 8, fill: '#0891B2' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Tabla de historial */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">#</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Fecha</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Correctas</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {userHistory.history.map((entry, index) => {
                      const isLatest = index === 0;
                      const isBest = entry.notaVigesimal === userHistory.mejorNota;
                      return (
                        <tr key={index} className={clsx('hover:bg-slate-50', isLatest && 'bg-cyan-50')}>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {userHistory.totalIntentos - index}
                            {isLatest && <span className="ml-1 text-xs text-cyan-600">(actual)</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {new Date(entry.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-slate-600">
                            {entry.correctas}/{entry.total}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            <span className={clsx(
                              'inline-flex items-center gap-1',
                              isBest ? 'text-emerald-600' : 'text-slate-800'
                            )}>
                              {isBest && <Trophy className="w-3.5 h-3.5" />}
                              {formatVigesimalScore(entry.notaVigesimal)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Este es tu primer simulacro</p>
              <p className="text-sm text-slate-400 mt-1">
                Vuelve a practicar para ver tu progreso aquí
              </p>
            </div>
          )}
        </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
          <PDFGenerator result={result} />
          <button
            onClick={handleRestart}
            className="btn-secondary"
          >
            <RotateCcw className="w-5 h-5" />
            Nuevo Simulacro
          </button>
        </div>

        <p className="text-center text-slate-400 text-sm flex items-center justify-center gap-2">
          <Stethoscope className="w-4 h-4" />
          SimulaENCIB - Examen Nacional de Ciencias Básicas
        </p>
      </div>
    </div>
  );
}
