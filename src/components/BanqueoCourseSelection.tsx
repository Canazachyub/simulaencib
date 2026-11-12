import { useEffect, useMemo, useState } from 'react';
import { areaImg } from '../utils/imagenes';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, Heart, Microscope, Zap, Target, FileText, BookOpen, Loader2, AlertCircle, ChevronRight, Layers
} from 'lucide-react';
import { getConfig, getBanqueoCatalog, BackendViejoError, getCuentaSession, hasBanqueoSession, type BanqueoCatalog } from '../services/api';
import { leerProgreso, coberturaCurso, sesionPendiente, borrarSesion } from '../utils/progresoBanqueo';
import { PlayCircle, X as XIcon } from 'lucide-react';
import { useExamCatalog, useExamStore } from '../hooks/useExam';
import { ENCIB_FALLBACK_CONFIG } from '../types';
import type { Course } from '../types';
import { ExamSelector } from './ExamSelector';
import { TopBar, TerminalFooter } from './terminal';
import { FlashcardReview, readDeck, type StudyCard } from './study';

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
  const { exams: allExams, examsLoaded } = useExamCatalog();
  const simulacroExamId = useExamStore(state => state.selectedExamId);
  // Solo los exámenes que incluye el acceso de la cuenta SINAPSIS
  const cuentaExams = useMemo(() => getCuentaSession()?.exams ?? null, []);
  const exams = useMemo(() => {
    if (!cuentaExams) return allExams;
    const own = allExams.filter(e => cuentaExams.includes(e.id));
    return own.length ? own : allExams;
  }, [allExams, cuentaExams]);

  const [examId, setExamId] = useState<string>(() => readBanqueoExam() || simulacroExamId);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  // Mazo personal de fichas (localStorage)
  const [deck, setDeck] = useState<StudyCard[] | null>(null);
  const deckCount = readDeck(examId).length;

  // Sin sesión de la cuenta SINAPSIS → pantalla de acceso
  useEffect(() => {
    if (!hasBanqueoSession()) {
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

  // Catálogo del banqueo v2 (totales por curso) — si el backend es el viejo, aviso discreto
  const [catalog, setCatalog] = useState<BanqueoCatalog | null>(null);
  const [catalogNotice, setCatalogNotice] = useState('');
  const [pendiente, setPendiente] = useState(() => sesionPendiente());
  useEffect(() => {
    if (!examsLoaded) return;
    let cancelled = false;
    setCatalog(null);
    setCatalogNotice('');
    getBanqueoCatalog(examId)
      .then(c => { if (!cancelled) setCatalog(c); })
      .catch(err => {
        if (cancelled) return;
        setCatalogNotice(err instanceof BackendViejoError ? 'Actualiza el servidor para filtros y progreso' : '');
      });
    return () => { cancelled = true; };
  }, [examId, examsLoaded]);
  const progreso = useMemo(() => leerProgreso(examId), [examId]);

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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {deck && (
        <FlashcardReview examId={examId} cards={deck} title={`Mis fichas · ${examName}`} onClose={() => setDeck(null)} />
      )}
      <TopBar>
        {exams.length > 1 && (
          <ExamSelector
            exams={exams}
            selectedId={examId}
            onSelect={handleSelectExam}
            variant="light"
          />
        )}
      </TopBar>

      <main className="flex-1 max-w-terminal w-full mx-auto px-4 lg:px-8 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="meta">{examName} · Banqueo · {catalog ? 'arma tu práctica por tema y año' : '10 preguntas aleatorias'}</p>
            <h1 className="title-screen text-[28px] md:text-[32px] mt-1">Elige un curso</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDeck(readDeck(examId))}
              disabled={deckCount === 0}
              title={deckCount === 0 ? 'Aún no tienes fichas: márcalas con "Repasar" al terminar una práctica' : 'Repasar tus fichas guardadas'}
              className="btn-secondary min-h-[40px] py-2 px-4 text-sm"
            >
              <Layers className="w-4 h-4" />
              Mis fichas <span className="num text-muted">({deckCount})</span>
            </button>
            <button onClick={() => navigate('/banqueo')} className="btn-ghost">
              <ArrowLeft className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>

        {pendiente && (
          <div className="mb-5 rounded-2xl bg-jungle-900 text-white px-4 py-3 flex flex-wrap items-center gap-3">
            <PlayCircle className="w-6 h-6 text-lime-400 shrink-0" />
            <p className="flex-1 min-w-[180px] text-sm">
              Tienes un banqueo a medias de <strong>{pendiente.course}</strong>{' '}
              <span className="num text-white/70">
                ({pendiente.states.filter(s => s?.answered).length} de {pendiente.ids.length}{pendiente.modo === 'examen' ? ' · examen' : ''})
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(`/banqueo/practica/${encodeURIComponent(pendiente.course)}?examen=${encodeURIComponent(pendiente.exam)}&continuar=1`)}
                className="btn min-h-[40px] py-2 bg-lime-400 text-jungle-900 hover:bg-lime-500"
              >
                Continuar donde lo dejé
              </button>
              <button
                type="button"
                onClick={() => { borrarSesion(); setPendiente(null); }}
                className="w-10 h-10 grid place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/10"
                aria-label="Descartar banqueo a medias"
                title="Descartar"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-jungle-600 animate-spin mx-auto mb-3" />
            <p className="text-muted">Cargando cursos de {examName}...</p>
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto text-center py-16">
            <AlertCircle className="w-8 h-8 text-wrong mx-auto mb-3" />
            <p className="text-muted mb-4">{error}</p>
            <button onClick={() => setReloadKey(k => k + 1)} className="btn-primary">
              Reintentar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {courses.map((course) => {
              const cat = catalog?.courses.find(c => c.name === course.name);
              const cob = cat ? coberturaCurso(progreso, course.name, cat.total) : null;
              return (
                <button
                  key={`${course.code}-${course.name}`}
                  onClick={() => handleSelectCourse(course.name)}
                  className="group card p-5 text-left flex items-center gap-4 hover:border-jungle-600 hover:bg-paper transition-colors min-w-0"
                >
                  <img
                    src={areaImg(course.name)}
                    alt=""
                    aria-hidden
                    draggable={false}
                    className="w-14 h-14 shrink-0 object-contain transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-ink leading-snug">{course.name}</span>
                    {cob ? (
                      <>
                        <span className="block text-[12px] text-muted mt-1 num">
                          vistas {cob.vistas} de {cob.total} ({cob.pct} %)
                          {cob.pctAcierto !== null && <> · aciertas {cob.pctAcierto} %</>}
                        </span>
                        <span className="block mt-1.5 h-1.5 rounded-full bg-line overflow-hidden" aria-hidden>
                          <span className="block h-full rounded-full bg-jungle-600" style={{ width: `${cob.total ? (cob.vistas / cob.total) * 100 : 0}%` }} />
                        </span>
                        {cob.repasar > 0 && (
                          <span className="inline-flex items-center mt-2 h-6 px-2 rounded-full bg-warning-bg text-warning text-[11px] font-bold num">
                            {cob.repasar} para repasar hoy
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="block text-[13px] text-muted mt-0.5">{catalog ? 'Sin preguntas' : '10 preguntas'}</span>
                    )}
                  </span>
                  <ChevronRight className="w-4 h-4 text-subtle group-hover:text-jungle-800 shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {catalogNotice && !loading && (
          <p className="mt-4 text-[12px] text-subtle">{catalogNotice}</p>
        )}

      </main>

      <TerminalFooter />
    </div>
  );
}
