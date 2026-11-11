import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, ArrowLeft, Activity, Heart, Microscope, Zap, Target, FileText, BookOpen, Loader2, AlertCircle
} from 'lucide-react';
import { getConfig } from '../services/api';
import { useExamCatalog, useExamStore } from '../hooks/useExam';
import { ENCIB_FALLBACK_CONFIG, SITE_NAME } from '../types';
import type { Course } from '../types';
import { ExamSelector } from './ExamSelector';

const BANQUEO_EXAM_KEY = 'banqueo_exam';

function readBanqueoExam(): string | null {
  try {
    return sessionStorage.getItem(BANQUEO_EXAM_KEY);
  } catch {
    return null;
  }
}

export function BanqueoCourseSelection() {
  const navigate = useNavigate();
  const { exams, examsLoaded } = useExamCatalog();
  const simulacroExamId = useExamStore(state => state.selectedExamId);

  const [examId, setExamId] = useState<string>(() => readBanqueoExam() || simulacroExamId);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Check if user has access
  useEffect(() => {
    const dni = sessionStorage.getItem('banqueo_dni');
    const email = sessionStorage.getItem('banqueo_email');
    if (!dni || !email) {
      navigate('/banqueo/acceso');
    }
  }, [navigate]);

  // Validar el examen contra el catálogo (con backend viejo solo existe ENCIB)
  useEffect(() => {
    if (examsLoaded && !exams.some(e => e.id === examId)) {
      setExamId(exams[0]?.id ?? ENCIB_FALLBACK_CONFIG.id);
    }
  }, [examsLoaded, exams, examId]);

  // Cargar los cursos del examen elegido
  useEffect(() => {
    if (!examsLoaded) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getConfig(examId)
      .then(config => {
        if (cancelled) return;
        setCourses(config.courses);
      })
      .catch(err => {
        if (cancelled) return;
        if (examId === ENCIB_FALLBACK_CONFIG.id) {
          setCourses(ENCIB_FALLBACK_CONFIG.courses);
        } else {
          setCourses([]);
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los cursos');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [examId, examsLoaded, reloadKey]);

  const handleSelectExam = (id: string) => {
    setExamId(id);
    try {
      sessionStorage.setItem(BANQUEO_EXAM_KEY, id);
    } catch {
      // sin sessionStorage
    }
  };

  const handleSelectCourse = (courseName: string) => {
    navigate(`/banqueo/practica/${encodeURIComponent(courseName)}?examen=${encodeURIComponent(examId)}`);
  };

  const examName = exams.find(e => e.id === examId)?.nombre ?? examId.toUpperCase();

  const getCourseIcon = (courseName: string) => {
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
    return icons[courseName] || BookOpen;
  };

  const getCourseColor = (index: number) => {
    const colors = [
      'from-red-500 to-rose-600',
      'from-pink-500 to-fuchsia-600',
      'from-purple-500 to-violet-600',
      'from-blue-500 to-indigo-600',
      'from-cyan-500 to-teal-600',
      'from-green-500 to-emerald-600',
      'from-amber-500 to-orange-600',
      'from-slate-500 to-slate-700'
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={() => navigate('/banqueo')}
            className="flex items-center gap-2 text-purple-200 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Salir del Banqueo
          </button>

          <div className="max-w-4xl mx-auto text-center py-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl mb-3">
              <Brain className="w-7 h-7" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Selecciona un Curso
            </h1>
            <p className="text-purple-100">
              Banqueo {examName}: elige el curso que deseas practicar (10 preguntas aleatorias)
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Selector de examen */}
        {exams.length > 1 && (
          <div className="max-w-6xl mx-auto mb-8">
            <p className="text-sm text-slate-600 mb-2">Examen</p>
            <ExamSelector
              exams={exams}
              selectedId={examId}
              onSelect={handleSelectExam}
              variant="light"
            />
          </div>
        )}

        {/* Course Grid */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-3" />
            <p className="text-slate-600">Cargando cursos de {examName}...</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto text-center py-12">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-slate-600 mb-4">{error}</p>
            <button
              onClick={() => setReloadKey(k => k + 1)}
              className="btn-primary bg-purple-600 hover:bg-purple-700"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {courses.map((course, index) => {
              const Icon = getCourseIcon(course.name);
              const gradientColor = getCourseColor(index);

              return (
                <button
                  key={`${course.code}-${course.name}`}
                  onClick={() => handleSelectCourse(course.name)}
                  className="group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl"
                >
                  {/* Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradientColor}`} />

                  {/* Decorative circles */}
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-lg" />
                  <div className="absolute right-8 bottom-8 w-16 h-16 bg-white/5 rounded-full" />

                  {/* Content */}
                  <div className="relative z-10 text-white">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">{course.name}</h3>
                    <p className="text-sm text-white/80">10 preguntas</p>
                  </div>

                  {/* Hover effect */}
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        )}

        {/* Info Box */}
        <div className="max-w-2xl mx-auto mt-8">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
            <h3 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Método Active Recall
            </h3>
            <p className="text-sm text-purple-700">
              Después de responder cada pregunta, verás inmediatamente si tu respuesta fue correcta
              y cuál era la respuesta correcta. Este método de retroalimentación inmediata
              mejora significativamente la retención de información.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-400 py-6 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              <span className="font-semibold text-white">Banqueo Histórico</span>
            </p>
            <p className="text-sm">{SITE_NAME} - Active Recall</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
