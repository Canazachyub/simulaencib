import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, CreditCard, BookOpen, Clock, AlertTriangle,
  ChevronLeft, PlayCircle, Loader2, AlertCircle, GraduationCap, Stethoscope, ListChecks, Award
} from 'lucide-react';
import { useExamStore, useSelectedExam } from '../hooks/useExam';
import { ALL_UNIVERSITIES, ENCIB_FALLBACK_CONFIG } from '../types';
import { formatDuration, formatDurationShort } from '../utils/calculations';

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
    'No sabrás si tu respuesta es correcta hasta que presiones "Calificar"',
    `Al finalizar, obtendrás tu nota (0-${scaleMax})${passing !== null ? `; se aprueba con ${passing}` : ''} y podrás descargar un PDF`
  ];

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-cyan-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Preparando tu examen</h2>
          <p className="text-slate-600">Cargando preguntas del {exam.nombre}...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="card p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Error al cargar</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <div className="flex gap-4 justify-center">
            <button onClick={() => navigate('/registro')} className="btn-secondary">
              Volver
            </button>
            <button onClick={handleStartExam} className="btn-primary bg-cyan-600 hover:bg-cyan-700">
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="card p-8 animate-fade-in">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-cyan-100 text-cyan-600 rounded-2xl mb-4">
              <Stethoscope className="w-7 h-7" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
              Confirmar datos del examen
            </h1>
            <p className="text-slate-600">
              Verifica tu información antes de comenzar el simulacro {exam.nombre}
            </p>
          </div>

          {/* Student Info Card */}
          <div className="bg-slate-50 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-slate-700 mb-4">Datos del estudiante</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-slate-400" />
                <span className="text-slate-600">DNI:</span>
                <span className="font-semibold text-slate-800">{student.dni}</span>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-slate-400" />
                <span className="text-slate-600">Nombre:</span>
                <span className="font-semibold text-slate-800">{student.fullName}</span>
              </div>
              <div className="flex items-start gap-3">
                <GraduationCap className="w-5 h-5 text-slate-400 mt-0.5" />
                <span className="text-slate-600">Universidad:</span>
                <span className="font-semibold text-slate-800">{universityName}</span>
              </div>
            </div>
          </div>

          {/* Exam Info */}
          <div className="bg-cyan-50 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-cyan-700 mb-1">Detalles del examen {exam.nombre}</h2>
            {exam.descripcion && (
              <p className="text-sm text-slate-600 mb-4">{exam.descripcion}</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-white rounded-lg">
                <p className="text-3xl font-bold text-cyan-600">{totalQuestions || '—'}</p>
                <p className="text-sm text-slate-600">Preguntas</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <p className="text-3xl font-bold text-cyan-600 flex items-center justify-center gap-1">
                  <Clock className="w-6 h-6" />
                  {formatDurationShort(durationMinutes)}
                </p>
                <p className="text-sm text-slate-600">Duración</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <p className="text-3xl font-bold text-cyan-600 flex items-center justify-center gap-1">
                  <ListChecks className="w-6 h-6" />
                  {alternatives}
                </p>
                <p className="text-sm text-slate-600">Alternativas</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <p className="text-3xl font-bold text-cyan-600 flex items-center justify-center gap-1">
                  <Award className="w-6 h-6" />
                  0-{scaleMax}
                </p>
                <p className="text-sm text-slate-600">
                  {passing !== null ? `Nota (aprueba con ${passing})` : 'Escala de nota'}
                </p>
              </div>
            </div>
            {fuente && (
              <p className="mt-4 text-xs text-slate-500">
                <strong>Fuente:</strong> {fuente}
              </p>
            )}
          </div>

          {/* Courses List */}
          <div className="bg-slate-50 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Cursos evaluados ({examCourses.length})
            </h2>
            {examCourses.length === 0 ? (
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando cursos...
              </p>
            ) : (
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${examCourses.length > 12 ? 'max-h-80 overflow-y-auto pr-1' : ''}`}>
                {examCourses.map((course) => (
                  <div key={course.name} className="flex items-center justify-between gap-2 text-sm py-2 px-3 bg-white rounded-lg">
                    <span className="text-slate-700">{course.name}</span>
                    <span className="text-cyan-600 font-semibold flex-shrink-0">{course.questionCount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-emerald-50 rounded-xl p-6 mb-8">
            <h2 className="font-semibold text-emerald-700 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Instrucciones del examen
            </h2>
            <ul className="space-y-2">
              {instructions.map((instruction, index) => (
                <li key={index} className="flex items-start gap-2 text-emerald-800">
                  <span className="font-bold text-emerald-600">{index + 1}.</span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => navigate('/registro')}
              className="btn-secondary"
            >
              <ChevronLeft className="w-5 h-5" />
              Modificar datos
            </button>
            <button
              onClick={handleStartExam}
              disabled={!examConfig}
              className="btn-primary bg-cyan-600 hover:bg-cyan-700 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlayCircle className="w-6 h-6" />
              Iniciar Examen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
