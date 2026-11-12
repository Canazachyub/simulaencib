import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExamStore, useCurrentQuestion, useProgress, useIsLastQuestion, useIsFirstQuestion, useSelectedExam } from '../hooks/useExam';
import { formatDuration } from '../utils/calculations';
import { useTimer, formatTime } from '../hooks/useTimer';
import { parseFormattedText } from './Question';
import { timerTone } from './terminal';
import type { Question as QuestionType, Student, ExamConfig } from '../types';
import {
  Loader2, ChevronLeft, ChevronRight, ChevronUp, CheckCircle, Bookmark, Clock, X,
  AlertTriangle, AlertCircle, Eraser, Highlighter, Rows3, Settings, Maximize, Minimize,
  Flag, ZoomIn, Sun, Moon
, FileText } from 'lucide-react';
import clsx from 'clsx';

// ============================================
// Progreso guardado en sessionStorage (solo interfaz: no toca la API ni la calificación)
// ============================================
const PROGRESS_KEY = 'simulacro_progreso_v1';
const PREFS_KEY = 'simulacro_prefs_v1';

interface ProgressSnapshot {
  v: 1;
  examId: string;
  student: Student;
  config: ExamConfig | null;
  questions: QuestionType[];
  answers: [string, number | null][];
  index: number;
  startTime: string;
  durationSeconds: number;
  marked: string[];
  struck: Record<string, number[]>;
  visited: number[];
  highlights: Record<string, string>;
}

function readSnapshot(): ProgressSnapshot | null {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as ProgressSnapshot;
    return snap && snap.v === 1 && Array.isArray(snap.questions) && snap.questions.length > 0 ? snap : null;
  } catch {
    return null;
  }
}

function writeSnapshot(snap: ProgressSnapshot) {
  try {
    sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(snap));
  } catch {
    // sin espacio o sin sessionStorage: se ignora
  }
}

function clearSnapshot() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignorar
  }
}

// Si se recarga la página dentro del examen, se restaura el intento en curso antes del primer render.
let restored: { remaining: number; ui: Pick<ProgressSnapshot, 'marked' | 'struck' | 'visited' | 'highlights'> } | null = null;
(function hydrateOnReload() {
  if (typeof window === 'undefined' || !/\/examen\/?$/.test(window.location.pathname)) return;
  const snap = readSnapshot();
  if (!snap || useExamStore.getState().student) return;
  const start = new Date(snap.startTime);
  const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);
  useExamStore.setState({
    selectedExamId: snap.examId,
    student: snap.student,
    config: snap.config,
    questions: snap.questions,
    savedAnswers: new Map(snap.answers),
    currentQuestionIndex: Math.min(snap.index, snap.questions.length - 1),
    startTime: start,
    status: 'in_progress',
    result: null,
    error: null
  });
  restored = {
    remaining: Math.max(0, snap.durationSeconds - elapsed),
    ui: { marked: snap.marked, struck: snap.struck, visited: snap.visited, highlights: snap.highlights }
  };
})();

interface QuizPrefs {
  theme: 'light' | 'dark';
  scale: number;
}

function readPrefs(): QuizPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { theme: p.theme === 'dark' ? 'dark' : 'light', scale: typeof p.scale === 'number' ? p.scale : 1 };
  } catch {
    return { theme: 'light', scale: 1 };
  }
}

const SCALES = [0.9, 1, 1.1, 1.2, 1.35];

function stripHtml(html: string): string {
  return String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Duración por defecto si no hay configuración (ENCIB oficial: 2 horas)
const DEFAULT_DURATION_MINUTES = 120;

export function Quiz() {
  const navigate = useNavigate();
  const {
    status,
    student,
    questions,
    savedAnswers,
    currentQuestionIndex,
    startExam,
    saveAnswer,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    finishExam,
    config
  } = useExamStore();
  const exam = useSelectedExam();

  // Duración del examen seleccionado (minutos -> segundos)
  const durationMinutes = (config && config.id === exam.id ? config.durationMinutes : exam.durationMinutes) || DEFAULT_DURATION_MINUTES;
  const examDurationSeconds = Math.round(durationMinutes * 60);

  const currentQuestion = useCurrentQuestion();
  const progress = useProgress();
  const isLastQuestion = useIsLastQuestion();
  const isFirstQuestion = useIsFirstQuestion();

  const [showNavigator, setShowNavigator] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const hasTimedOutRef = useRef(false);

  // Callback cuando se agota el tiempo
  const handleTimeout = useCallback(() => {
    if (!hasTimedOutRef.current) {
      hasTimedOutRef.current = true;
      setShowTimeoutModal(true);
    }
  }, []);

  // Temporizador de cuenta regresiva con la duración del examen
  const { timeRemaining, start: startTimer } = useTimer({
    initialTime: restored ? restored.remaining : examDurationSeconds,
    onTimeout: handleTimeout,
    autoStart: false
  });

  // Formato del tiempo restante
  const formattedTime = formatTime(timeRemaining);

  // Calcular tiempo transcurrido (para mostrar en resultados)
  const elapsedTime = examDurationSeconds - timeRemaining;

  // Calcular preguntas contestadas y sin contestar
  const { answeredCount, unansweredCount, unansweredIndexes } = useMemo(() => {
    const answered = savedAnswers.size;
    const unanswered = questions.length - answered;
    const indexes: number[] = [];
    questions.forEach((q, idx) => {
      if (!savedAnswers.has(q.id)) {
        indexes.push(idx);
      }
    });
    return { answeredCount: answered, unansweredCount: unanswered, unansweredIndexes: indexes };
  }, [savedAnswers, questions]);

  // Obtener respuesta guardada para la pregunta actual
  const currentSavedAnswer = currentQuestion ? savedAnswers.get(currentQuestion.id) ?? null : null;

  // Iniciar examen y temporizador cuando el componente se monta
  useEffect(() => {
    if (status === 'ready' && questions.length > 0) {
      startExam();
      startTimer();
    }
  }, [status, questions.length, startExam, startTimer]);

  // Redirect si no hay datos
  useEffect(() => {
    if (!student) {
      navigate('/registro');
    } else if (questions.length === 0 && status !== 'loading') {
      navigate('/confirmar');
    }
  }, [student, questions.length, status, navigate]);

  const handleSelectAnswer = useCallback((index: number) => {
    if (!currentQuestion) return;
    saveAnswer(currentQuestion.id, index);
  }, [currentQuestion, saveAnswer]);

  const handleNext = useCallback(() => {
    if (!isLastQuestion) {
      nextQuestion();
    }
  }, [isLastQuestion, nextQuestion]);

  const handlePrevious = useCallback(() => {
    if (!isFirstQuestion) {
      previousQuestion();
    }
  }, [isFirstQuestion, previousQuestion]);

  const handleFinishExam = useCallback(() => {
    finishExam();
    navigate('/resultados');
  }, [finishExam, navigate]);

  // Agrupar preguntas por curso para el navegador
  const questionsByCourse = useMemo(() => {
    const groups: { course: string; questions: { index: number; answered: boolean }[] }[] = [];
    let currentCourse = '';

    questions.forEach((q, idx) => {
      if (q.subject !== currentCourse) {
        currentCourse = q.subject;
        groups.push({ course: currentCourse, questions: [] });
      }
      groups[groups.length - 1].questions.push({
        index: idx,
        answered: savedAnswers.has(q.id)
      });
    });

    return groups;
  }, [questions, savedAnswers]);

  // ============================================
  // Estado solo de interfaz (no afecta la calificación)
  // ============================================
  const restoredUi = useRef(restored?.ui ?? null);
  const [marked, setMarked] = useState<Set<string>>(() => new Set(restoredUi.current?.marked ?? []));
  const [struckMap, setStruckMap] = useState<Record<string, number[]>>(() => restoredUi.current?.struck ?? {});
  const [visited, setVisited] = useState<Set<number>>(() => new Set(restoredUi.current?.visited ?? []));
  const [highlights, setHighlights] = useState<Record<string, string>>(() => restoredUi.current?.highlights ?? {});
  const [prefs, setPrefs] = useState<QuizPrefs>(readPrefs);
  const [tool, setTool] = useState<'none' | 'eraser' | 'highlighter'>('none');
  const [rulerOn, setRulerOn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const startTime = useExamStore(s => s.startTime);
  const selectedExamId = useExamStore(s => s.selectedExamId);

  // Reanudar el reloj si se restauró un intento tras recargar
  useEffect(() => {
    if (!restored) return;
    const { remaining } = restored;
    restored = null;
    if (remaining <= 0) handleTimeout();
    else startTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignorar */ }
  }, [prefs]);

  useEffect(() => {
    setVisited(prev => (prev.has(currentQuestionIndex) ? prev : new Set(prev).add(currentQuestionIndex)));
    window.scrollTo({ top: 0 });
  }, [currentQuestionIndex]);

  // Guardar el progreso en sessionStorage
  useEffect(() => {
    if (status !== 'in_progress' || !student || !startTime || questions.length === 0) return;
    writeSnapshot({
      v: 1,
      examId: selectedExamId,
      student,
      config,
      questions,
      answers: Array.from(savedAnswers.entries()),
      index: currentQuestionIndex,
      startTime: startTime.toISOString(),
      durationSeconds: examDurationSeconds,
      marked: Array.from(marked),
      struck: struckMap,
      visited: Array.from(visited),
      highlights
    });
  }, [status, student, startTime, questions, savedAnswers, currentQuestionIndex, marked, struckMap, visited,
      highlights, config, selectedExamId, examDurationSeconds]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const submitExam = useCallback(() => {
    clearSnapshot();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    handleFinishExam();
  }, [handleFinishExam]);

  const isMarked = currentQuestion ? marked.has(currentQuestion.id) : false;
  const struck = useMemo(
    () => new Set(currentQuestion ? struckMap[currentQuestion.id] ?? [] : []),
    [struckMap, currentQuestion]
  );

  const toggleMarked = useCallback(() => {
    if (!currentQuestion) return;
    setMarked(prev => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) next.delete(currentQuestion.id);
      else next.add(currentQuestion.id);
      return next;
    });
  }, [currentQuestion]);

  const toggleStrike = useCallback((index: number) => {
    if (!currentQuestion) return;
    setStruckMap(prev => {
      const list = prev[currentQuestion.id] ?? [];
      const next = list.includes(index) ? list.filter(i => i !== index) : [...list, index];
      return { ...prev, [currentQuestion.id]: next };
    });
  }, [currentQuestion]);

  const onOptionClick = useCallback((index: number) => {
    if (tool === 'eraser') toggleStrike(index);
    else handleSelectAnswer(index);
  }, [tool, toggleStrike, handleSelectAnswer]);

  const goNextOrReview = useCallback(() => {
    if (isLastQuestion) setShowReview(true);
    else handleNext();
  }, [isLastQuestion, handleNext]);

  // Atajos: A–E / 1–5 eligen, Enter siguiente, ←/→ navegan, M marca, X tacha la seleccionada
  const overlayOpen = showFinishModal || showTimeoutModal || showReview || showSettings || zoomSrc !== null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (zoomSrc) setZoomSrc(null);
        else if (showSettings) setShowSettings(false);
        else if (showReview && !showFinishModal) setShowReview(false);
        return;
      }
      if (overlayOpen || !currentQuestion) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;

      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (key === 'M') { e.preventDefault(); toggleMarked(); return; }
      if (key === 'X') {
        e.preventDefault();
        if (currentSavedAnswer !== null) toggleStrike(currentSavedAnswer);
        return;
      }
      const n = currentQuestion.options.length;
      let idx = -1;
      if (/^[1-9]$/.test(key)) idx = Number(key) - 1;
      else if (/^[A-Z]$/.test(key)) idx = key.charCodeAt(0) - 65;
      if (idx >= 0 && idx < n) {
        e.preventDefault();
        handleSelectAnswer(idx);
        return;
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrevious(); }
      else if (e.key === 'Enter') {
        if (target && (target.tagName === 'BUTTON' || target.tagName === 'A')) return;
        e.preventDefault();
        goNextOrReview();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlayOpen, zoomSrc, showSettings, showReview, showFinishModal, currentQuestion, currentSavedAnswer,
      handleSelectAnswer, handleNext, handlePrevious, toggleMarked, toggleStrike, goNextOrReview]);

  // Loading state
  if (status === 'loading' || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-jungle-600 animate-spin mx-auto mb-3" />
          <p className="meta">Cargando pregunta...</p>
        </div>
      </div>
    );
  }

  const tone = timerTone(timeRemaining);
  const total = questions.length;
  const markedCount = marked.size;
  const notSeen = total - visited.size;
  const stemHtml = highlights[currentQuestion.id] ?? parseFormattedText(currentQuestion.questionText);

  return (
    <div className="quiz min-h-screen" data-theme={prefs.theme} style={{ ['--q-scale' as string]: prefs.scale }}>
      {/* ===== Barra superior ===== */}
      <header className="fixed top-0 inset-x-0 z-30 border-b bg-[var(--q-surface)] border-[color:var(--q-line)]">
        <div className="max-w-[1120px] mx-auto px-2 sm:px-5 h-16 flex items-center gap-2 sm:gap-3">
          <img
            src={`${import.meta.env.BASE_URL}images/logo/${prefs.theme === 'dark' ? 'logo-blanco-transparente.png' : 'logo.png'}`}
            alt="SINAPSIS EDU"
            className="hidden md:block h-7 w-auto shrink-0"
          />
          <span className="hidden lg:block text-sm font-semibold text-[color:var(--q-muted)] truncate">
            {exam.nombre} · Simulacro
          </span>

          <div className="flex-1" />

          <div
            className={clsx(
              'shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-sm font-semibold num',
              tone === 'critical'
                ? 'bg-wrong-bg border-wrong/40 text-wrong timer-critical'
                : tone === 'warning'
                  ? 'bg-warning-bg border-warning/40 text-warning'
                  : 'border-[color:var(--q-line)] text-[color:var(--q-ink)]'
            )}
            title="Tiempo restante"
          >
            <Clock className="w-4 h-4" />
            {formattedTime}
            <span className="sr-only" aria-live="polite">
              {tone === 'critical' ? 'Quedan menos de 2 minutos' : tone === 'warning' ? 'Quedan menos de 10 minutos' : ''}
            </span>
          </div>

          <div className="flex items-center">
            <ToolButton
              icon={<Eraser className="w-5 h-5" />}
              label="Eliminador"
              active={tool === 'eraser'}
              onClick={() => setTool(t => (t === 'eraser' ? 'none' : 'eraser'))}
              title="Eliminador de respuestas: toca una alternativa para tacharla (también clic derecho)"
            />
            <ToolButton
              icon={<Highlighter className="w-5 h-5" />}
              label="Subrayador"
              active={tool === 'highlighter'}
              onClick={() => setTool(t => (t === 'highlighter' ? 'none' : 'highlighter'))}
              title="Subrayador: selecciona texto del enunciado para resaltarlo; toca un resaltado para quitarlo"
            />
            <ToolButton
              icon={<Rows3 className="w-5 h-5" />}
              label="Lector"
              active={rulerOn}
              onClick={() => setRulerOn(v => !v)}
              title="Lector de líneas: resalta la línea que estás leyendo"
              className="hidden md:flex"
            />
            <div className="relative">
              <ToolButton
                icon={<Settings className="w-5 h-5" />}
                label="Ajustes"
                active={showSettings}
                onClick={() => setShowSettings(v => !v)}
                title="Ajustes"
              />
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border p-4 bg-[var(--q-surface)] border-[color:var(--q-line)] shadow-card motion-safe:animate-fade-in">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--q-muted)]">Tamaño de letra</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPrefs(p => ({ ...p, scale: SCALES[Math.max(0, SCALES.indexOf(p.scale) - 1)] ?? 1 }))}
                        disabled={prefs.scale <= SCALES[0]}
                        className="qz-btn-secondary flex-1 px-0 text-sm"
                        aria-label="Reducir letra"
                      >
                        A−
                      </button>
                      <span className="num w-12 text-center text-sm font-semibold">{Math.round(prefs.scale * 100)}%</span>
                      <button
                        type="button"
                        onClick={() => setPrefs(p => ({ ...p, scale: SCALES[Math.min(SCALES.length - 1, SCALES.indexOf(p.scale) + 1)] ?? 1 }))}
                        disabled={prefs.scale >= SCALES[SCALES.length - 1]}
                        className="qz-btn-secondary flex-1 px-0 text-lg"
                        aria-label="Aumentar letra"
                      >
                        A+
                      </button>
                    </div>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--q-muted)]">Tema</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(['light', 'dark'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setPrefs(p => ({ ...p, theme: t }))}
                          aria-pressed={prefs.theme === t}
                          className={clsx(
                            'min-h-[44px] rounded-xl border text-sm font-semibold inline-flex items-center justify-center gap-1.5',
                            prefs.theme === t
                              ? 'border-2 border-[color:var(--q-sel-border)] bg-[var(--q-sel-bg)]'
                              : 'border-[color:var(--q-line)]'
                          )}
                        >
                          {t === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                          {t === 'light' ? 'Claro' : 'Oscuro'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <ToolButton
              icon={isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              label={isFullscreen ? 'Salir' : 'Pantalla'}
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Modo concentración (pantalla completa)'}
              className="hidden sm:flex"
            />
          </div>
        </div>
        <div className="h-1 bg-[var(--q-line)]">
          <div
            className="h-full bg-[var(--q-accent)] transition-[width] duration-200"
            style={{ width: `${total > 0 ? (answeredCount / total) * 100 : 0}%` }}
          />
        </div>
      </header>

      {/* ===== Columna central ===== */}
      <main className="pt-[92px] pb-32 px-3 sm:px-5">
        <div key={currentQuestion.id} className="max-w-[780px] mx-auto motion-safe:animate-q-in">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center h-7 px-3 rounded-full text-[13px] font-semibold bg-[var(--q-chip)] text-[color:var(--q-chip-ink)]">
              {currentQuestion.subject}
            </span>
            {currentQuestion.sourceFile && (
              <span className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-[13px] font-semibold bg-lime-400 text-jungle-900" title="Fuente de la pregunta">
                <FileText className="w-3.5 h-3.5" /> {currentQuestion.sourceFile}
              </span>
            )}
            {isMarked && (
              <span className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-warning-bg text-warning text-[13px] font-semibold">
                <Bookmark className="w-3 h-3" fill="currentColor" /> Marcada para revisión
              </span>
            )}
            {tool !== 'none' && (
              <span className="ml-auto inline-flex items-center gap-1.5 h-7 pl-3 pr-1 rounded-full border text-[13px] font-semibold border-[color:var(--q-sel-border)] text-[color:var(--q-ink)]">
                {tool === 'eraser' ? 'Eliminador activo' : 'Subrayador activo'}
                <button type="button" onClick={() => setTool('none')} className="w-5 h-5 grid place-items-center rounded-full hover:bg-[var(--q-hover)]" aria-label="Desactivar herramienta">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>

          {currentQuestion.imageLink && (
            <button
              type="button"
              onClick={() => setZoomSrc(currentQuestion.imageLink)}
              className="group relative block mx-auto mb-5 rounded-xl overflow-hidden border border-[color:var(--q-line)] bg-white cursor-zoom-in"
              aria-label="Ampliar imagen"
            >
              <img
                src={currentQuestion.imageLink}
                alt="Imagen de la pregunta"
                className="max-w-full max-h-[340px] h-auto"
                onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
              />
              <span className="absolute bottom-2 right-2 w-8 h-8 grid place-items-center rounded-full bg-ink/70 text-white">
                <ZoomIn className="w-4 h-4" />
              </span>
            </button>
          )}

          <Stem
            html={stemHtml}
            highlightMode={tool === 'highlighter'}
            ruler={rulerOn}
            onChange={(html) => setHighlights(prev => ({ ...prev, [currentQuestion.id]: html }))}
          />


          <div role="radiogroup" aria-label="Alternativas" className="mt-6 space-y-2.5">
            {currentQuestion.options.map((option, index) => {
              const letter = String.fromCharCode(65 + index);
              const selected = currentSavedAnswer === index;
              const isStruck = struck.has(index);
              return (
                <div key={index} className="group relative">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onOptionClick(index)}
                    onContextMenu={(e) => { e.preventDefault(); toggleStrike(index); }}
                    style={{ fontSize: `calc(17px * var(--q-scale))` }}
                    className={clsx(
                      'w-full min-h-[52px] pl-3 pr-12 py-2.5 rounded-lg text-left flex items-center gap-3 leading-snug transition-colors duration-150',
                      selected
                        ? 'border-2 border-[color:var(--q-sel-border)] bg-[var(--q-sel-bg)] motion-safe:animate-pick'
                        : 'border border-[color:var(--q-line)] bg-[var(--q-surface)] hover:bg-[var(--q-hover)]',
                      tool === 'eraser' && 'cursor-crosshair',
                      isStruck && 'opacity-40'
                    )}
                  >
                    <span
                      className={clsx(
                        'shrink-0 w-10 h-10 rounded-full grid place-items-center text-base font-display font-extrabold border-2 transition-colors',
                        selected
                          ? 'bg-[var(--q-accent)] border-[color:var(--q-accent)] text-[color:var(--q-on-accent)]'
                          : 'border-[color:var(--q-line)] text-[color:var(--q-muted)]'
                      )}
                    >
                      {letter}
                    </span>
                    <span
                      className={clsx('flex-1 font-medium', isStruck && 'line-through decoration-2')}
                      dangerouslySetInnerHTML={{ __html: parseFormattedText(option) }}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleStrike(index)}
                    aria-pressed={isStruck}
                    aria-label={isStruck ? `Quitar tachado de la ${letter}` : `Tachar la ${letter}`}
                    title={isStruck ? 'Quitar tachado' : 'Tachar'}
                    className={clsx(
                      'absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full text-[color:var(--q-muted)] hover:bg-[var(--q-hover)] transition-opacity',
                      isStruck ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                    )}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-center">
            <a
              href="https://wa.link/40zqta"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[color:var(--q-muted)] hover:underline underline-offset-2"
            >
              Reportar un error en esta pregunta
            </a>
          </p>
        </div>
      </main>

      {/* ===== Barra inferior ===== */}
      <nav className="fixed bottom-0 inset-x-0 z-30 border-t bg-[var(--q-surface)] border-[color:var(--q-line)]">
        <div className="max-w-[1120px] mx-auto px-2 sm:px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={isFirstQuestion}
            className="qz-btn-secondary px-3 sm:px-4 shrink-0"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden md:inline">Anterior</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReview(true)}
            className="flex-1 min-w-0 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-semibold hover:bg-[var(--q-hover)] num"
          >
            <span className="truncate">
              <span className="hidden sm:inline">Pregunta </span>
              {progress.current} de {total}
              <span className="hidden md:inline font-normal text-[color:var(--q-muted)]"> · {answeredCount} respondidas</span>
            </span>
            <span className="inline-flex items-center gap-0.5 h-7 px-2 rounded-lg border border-[color:var(--q-line)] text-[13px]">
              Revisar <ChevronUp className="w-3.5 h-3.5" />
            </span>
          </button>

          <button
            type="button"
            onClick={toggleMarked}
            aria-pressed={isMarked}
            className={clsx(
              'qz-btn-secondary px-3 shrink-0',
              isMarked && '!border-warning !text-warning'
            )}
            title="Marcar para revisión (M)"
          >
            <Bookmark className="w-5 h-5" fill={isMarked ? 'currentColor' : 'none'} />
            <span className="hidden lg:inline">{isMarked ? 'Marcada' : 'Marcar para revisión'}</span>
          </button>

          <button type="button" onClick={goNextOrReview} className="qz-btn-primary shrink-0 px-4 sm:px-6">
            {isLastQuestion ? 'Revisar' : 'Siguiente'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* ===== Pantalla Revisar ===== */}
      {showReview && (
        <ReviewScreen
          questions={questions}
          currentIndex={currentQuestionIndex}
          isAnswered={(q) => savedAnswers.has(q.id)}
          isMarked={(q) => marked.has(q.id)}
          answeredCount={answeredCount}
          unansweredCount={unansweredCount}
          markedCount={markedCount}
          notSeen={notSeen}
          timeLabel={formattedTime}
          onJump={(i) => { goToQuestion(i); setShowReview(false); }}
          onClose={() => setShowReview(false)}
          onSubmit={() => setShowFinishModal(true)}
        />
      )}

      {/* ===== Imagen ampliada ===== */}
      {zoomSrc && (
        <div
          className="fixed inset-0 z-[60] bg-ink/85 flex items-center justify-center p-4 cursor-zoom-out motion-safe:animate-fade-in"
          onClick={() => setZoomSrc(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
        >
          <img src={zoomSrc} alt="Imagen ampliada" className="max-w-full max-h-full rounded-xl bg-white" />
          <button type="button" className="absolute top-4 right-4 w-11 h-11 grid place-items-center rounded-full bg-white text-ink" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ===== Confirmar envío ===== */}
      {showFinishModal && (
        <div className="fixed inset-0 z-[60] bg-ink/50 flex items-center justify-center p-4 motion-safe:animate-fade-in">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border p-6 bg-[var(--q-surface)] border-[color:var(--q-line)]">
            {unansweredCount > 0 ? (
              <>
                <AlertTriangle className="w-8 h-8 text-warning mb-3" />
                <h3 className="font-display font-extrabold uppercase tracking-[0.02em] text-xl mb-2">
                  ¿Enviar con <span className="num">{unansweredCount}</span> en blanco?
                </h3>
                <p className="text-[15px] text-[color:var(--q-muted)] leading-relaxed">
                  Las preguntas sin responder se califican como incorrectas.
                </p>
              </>
            ) : (
              <>
                <CheckCircle className="w-8 h-8 text-correct mb-3" />
                <h3 className="font-display font-extrabold uppercase tracking-[0.02em] text-xl mb-2">¿Enviar la prueba?</h3>
                <p className="text-[15px] text-[color:var(--q-muted)] leading-relaxed">
                  Respondiste todas. Después de enviar ya no podrás cambiar tus respuestas.
                </p>
              </>
            )}
            <div className="mt-6 space-y-2">
              <button onClick={submitExam} className="qz-btn-primary w-full">
                Enviar la prueba
              </button>
              {unansweredCount > 0 && (
                <button
                  onClick={() => {
                    if (unansweredIndexes.length > 0) goToQuestion(unansweredIndexes[0]);
                    setShowFinishModal(false);
                    setShowReview(false);
                  }}
                  className="qz-btn-secondary w-full"
                >
                  Ir a la primera en blanco
                </button>
              )}
              <button onClick={() => setShowFinishModal(false)} className="w-full min-h-[44px] text-sm font-semibold text-[color:var(--q-muted)] hover:text-[color:var(--q-ink)]">
                Seguir revisando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Tiempo agotado ===== */}
      {showTimeoutModal && (
        <div className="fixed inset-0 z-[70] bg-ink/60 flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl border p-6 bg-[var(--q-surface)] border-[color:var(--q-line)]">
            <AlertCircle className="w-8 h-8 text-wrong mb-3" />
            <h3 className="font-display font-extrabold uppercase tracking-[0.02em] text-2xl mb-2">Tiempo agotado</h3>
            <p className="text-[15px] text-[color:var(--q-muted)] leading-relaxed">
              Se acabó el tiempo del examen {exam.nombre} ({formatDuration(durationMinutes)}).
              Se calificará con lo que respondiste: <strong className="num text-[color:var(--q-ink)]">{answeredCount}</strong> de {questions.length}.
            </p>
            <button onClick={submitExam} className="qz-btn-primary w-full mt-6">
              Ver mis resultados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Botón de herramienta con etiqueta debajo (como Wayground)
// ============================================
function ToolButton({
  icon, label, active = false, onClick, title, className
}: { icon: ReactNode; label: string; active?: boolean; onClick: () => void; title: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      aria-label={title}
      className={clsx(
        'flex flex-col items-center justify-center gap-1 w-11 sm:w-[68px] h-12 rounded-xl transition-colors',
        active
          ? 'bg-[var(--q-sel-bg)] text-[color:var(--q-ink)] ring-1 ring-[color:var(--q-sel-border)]'
          : 'text-[color:var(--q-muted)] hover:text-[color:var(--q-ink)] hover:bg-[var(--q-hover)]',
        className
      )}
    >
      {icon}
      <span className="hidden sm:block text-[10px] font-semibold leading-none">{label}</span>
    </button>
  );
}

// ============================================
// Enunciado con subrayador y lector de líneas
// ============================================
function Stem({
  html, highlightMode, ruler, onChange
}: { html: string; highlightMode: boolean; ruler: boolean; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rulerY, setRulerY] = useState<number | null>(null);

  const applyHighlight = () => {
    if (!highlightMode || !ref.current) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return;
    if (!range.toString().trim()) return;
    const mark = document.createElement('mark');
    mark.className = 'qz-hl';
    mark.setAttribute('data-hl', '1');
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
    sel.removeAllRanges();
    onChange(ref.current.innerHTML);
  };

  const onClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest('mark[data-hl]');
    if (!mark || !ref.current) return;
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    onChange(ref.current.innerHTML);
  };

  const lineHeight = 1.7 * 19;

  return (
    <div
      className="relative"
      onMouseMove={ruler ? (e) => setRulerY(e.clientY - e.currentTarget.getBoundingClientRect().top) : undefined}
      onMouseLeave={ruler ? () => setRulerY(null) : undefined}
    >
      {ruler && rulerY !== null && (
        <div
          className="pointer-events-none absolute -inset-x-3 rounded-md bg-[var(--q-ruler)]"
          style={{ top: rulerY - (lineHeight * 0.6), height: `calc(${lineHeight * 1.2}px * var(--q-scale))` }}
          aria-hidden
        />
      )}
      <div
        ref={ref}
        onMouseUp={applyHighlight}
        onTouchEnd={() => window.setTimeout(applyHighlight, 0)}
        onClick={onClick}
        className={clsx('relative leading-[1.7] text-[color:var(--q-ink)]', highlightMode && 'cursor-text selection:bg-yellow-200')}
        style={{ fontSize: `calc(19px * var(--q-scale))` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ============================================
// Pantalla "Revisar" (como Wayground)
// ============================================
type ReviewTab = 'all' | 'answered' | 'blank' | 'marked';

function ReviewScreen({
  questions, currentIndex, isAnswered, isMarked, answeredCount, unansweredCount, markedCount, notSeen, timeLabel,
  onJump, onClose, onSubmit
}: {
  questions: QuestionType[];
  currentIndex: number;
  isAnswered: (q: QuestionType) => boolean;
  isMarked: (q: QuestionType) => boolean;
  answeredCount: number;
  unansweredCount: number;
  markedCount: number;
  notSeen: number;
  timeLabel: string;
  onJump: (index: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [tab, setTab] = useState<ReviewTab>('all');
  const items = questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) =>
      tab === 'all' ? true : tab === 'answered' ? isAnswered(q) : tab === 'blank' ? !isAnswered(q) : isMarked(q)
    );
  const tabs: { id: ReviewTab; label: string; count?: number }[] = [
    { id: 'all', label: 'Todas las preguntas' },
    { id: 'answered', label: 'Contestadas', count: answeredCount },
    { id: 'blank', label: 'Sin respuesta', count: unansweredCount },
    { id: 'marked', label: 'Marcadas', count: markedCount },
  ];
  // Se puede enviar en cualquier momento (como el examen real); si hay preguntas en blanco, el modal lo advierte.
  const canSubmit = true;
  void notSeen;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--q-bg)] motion-safe:animate-fade-in" role="dialog" aria-modal="true" aria-label="Revisar">
      <div className="border-b bg-[var(--q-surface)] border-[color:var(--q-line)]">
        <div className="max-w-[1000px] mx-auto px-3 sm:px-5 h-16 flex items-center gap-3">
          <button type="button" onClick={onClose} className="qz-btn-secondary px-3 shrink-0" aria-label="Volver a la prueba">
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Volver</span>
          </button>
          <h2 className="flex-1 font-display font-extrabold uppercase tracking-[0.02em] text-lg sm:text-xl truncate">Revisar</h2>
          <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-[color:var(--q-line)] text-sm font-semibold num">
            <Clock className="w-4 h-4" /> {timeLabel}
          </span>
        </div>
        <div className="max-w-[1000px] mx-auto px-3 sm:px-5 flex gap-5 overflow-x-auto [scrollbar-width:none]">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                'shrink-0 h-11 border-b-2 text-sm font-semibold whitespace-nowrap',
                tab === t.id ? 'border-[color:var(--q-accent)] text-[color:var(--q-ink)]' : 'border-transparent text-[color:var(--q-muted)] hover:text-[color:var(--q-ink)]'
              )}
            >
              {t.label}{t.count !== undefined && <span className="num"> ({t.count})</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1000px] mx-auto px-3 sm:px-5 py-6 pb-32">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--q-muted)] mb-3">Saltar a la pregunta</p>
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q, i) => {
              const ans = isAnswered(q);
              const mk = isMarked(q);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onJump(i)}
                  className={clsx(
                    'num w-10 h-10 rounded-lg text-sm font-semibold transition-colors',
                    i === currentIndex
                      ? 'bg-[var(--q-accent)] text-[color:var(--q-on-accent)]'
                      : mk
                        ? 'border-2 border-warning ' + (ans ? 'bg-[var(--q-sel-bg)]' : 'bg-[var(--q-surface)]')
                        : ans
                          ? 'bg-[var(--q-sel-bg)] border border-[color:var(--q-sel-border)]'
                          : 'bg-[var(--q-surface)] border border-[color:var(--q-line)] text-[color:var(--q-muted)]'
                  )}
                  aria-label={`Ir a la pregunta ${i + 1}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="mt-8 space-y-2.5">
            {items.length === 0 && (
              <p className="text-sm text-[color:var(--q-muted)] py-8 text-center">No hay preguntas en esta pestaña.</p>
            )}
            {items.map(({ q, i }) => {
              const ans = isAnswered(q);
              const mk = isMarked(q);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onJump(i)}
                  className="w-full text-left rounded-2xl border p-4 flex gap-4 bg-[var(--q-surface)] border-[color:var(--q-line)] hover:border-[color:var(--q-sel-border)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="num font-bold mr-1">P{i + 1}</span>
                      <span className="text-[color:var(--q-muted)] mr-1">{q.subject}</span>
                      {i === currentIndex && <Chip className="bg-[var(--q-accent)] text-[color:var(--q-on-accent)]">Actual</Chip>}
                      {ans
                        ? <Chip className="bg-[var(--q-chip)] text-[color:var(--q-chip-ink)]">Contestada</Chip>
                        : <Chip className="border border-[color:var(--q-line)] text-[color:var(--q-muted)]">Sin respuesta</Chip>}
                      {mk && <Chip className="bg-warning-bg text-warning"><Bookmark className="w-3 h-3" fill="currentColor" /> Marcada</Chip>}
                    </div>
                    <p className="mt-2 text-[15px] leading-snug line-clamp-2">{stripHtml(q.questionText)}</p>
                  </div>
                  {q.imageLink && (
                    <img src={q.imageLink} alt="" className="shrink-0 w-16 h-16 rounded-lg object-cover border border-[color:var(--q-line)] bg-white" loading="lazy" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t bg-[var(--q-surface)] border-[color:var(--q-line)]">
        <div className="max-w-[1000px] mx-auto px-3 sm:px-5 py-3 flex items-center gap-3">
          <p className="flex-1 text-xs sm:text-sm text-[color:var(--q-muted)] num">
            {canSubmit
              ? <><strong className="text-[color:var(--q-ink)]">{answeredCount}</strong> contestadas · <strong className="text-[color:var(--q-ink)]">{unansweredCount}</strong> sin respuesta</>
              : <>Mira todas las preguntas antes de enviar · faltan <strong className="text-[color:var(--q-ink)]">{notSeen}</strong></>}
          </p>
          <button type="button" onClick={onSubmit} disabled={!canSubmit} className="qz-btn-primary shrink-0">
            <Flag className="w-4 h-4" />
            Enviar la prueba
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 h-5 px-2 rounded-full text-[11px] font-semibold', className)}>
      {children}
    </span>
  );
}
