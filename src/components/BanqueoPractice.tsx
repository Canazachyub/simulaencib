import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import { sonido } from '../utils/sonido';
import { areaImg, mascota } from '../utils/imagenes';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Loader2, ChevronRight, ChevronLeft, RefreshCw, LayoutGrid, AlertCircle, Check, X, Star, Timer,
  BookOpen, FileText, ZoomIn, Volume2, VolumeX, Lightbulb, HeartPulse, Zap, Layers, Share2, Link2, Swords, Play, Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import {
  getBanqueoQuestions, getBanqueoIds, getBanqueoPorIds, BackendViejoError, ApiError, AuthError, BANQUEO_LOTE,
  type BanqueoQuestion, type BanqueoIdItem
} from '../services/api';
import { Watermark, watermarkText, noCopyProps } from './Watermark';
import { SpeakButton, stopSpeaking, stripHtml, FlashcardReview, toCard, readDeck, type StudyCard } from './study';
import { ArmaBanqueo, type ModoBanqueo } from './ArmaBanqueo';
import {
  leerProgreso, registrarRespuesta, alternarMarcada, filtrar, esNueva, mezclar,
  leerSesion, guardarSesion, borrarSesion, FILTROS_VACIOS,
  type Progreso, type FiltrosBanqueo, type Categoria
} from '../utils/progresoBanqueo';

function readStoredBanqueoExam(): string | null {
  try {
    return sessionStorage.getItem('banqueo_exam');
  } catch {
    return null;
  }
}

interface QuestionState {
  answered: boolean;
  selectedOption: number | null;
  isCorrect: boolean;
}

// ============================================
// Capa de juego: todo es visual, no se envía a la API
// ============================================
const QUESTION_SECONDS = 90;
const BASE_POINTS = 100;
const MAX_SPEED_BONUS = 50;
const REDEMPTION_POINTS = 50;
const PREFS_KEY = 'banqueo_prefs_v1';

// Mosaicos: figura + color (paleta accesible con texto blanco)
const ICON = (name: string) => `${import.meta.env.BASE_URL}images/juego/${name}.webp`;

const TILES = [
  { shape: '▲', img: ICON('fig-triangulo'), color: '#1F5B52' },
  { shape: '◆', img: ICON('fig-rombo'), color: '#2563EB' },
  { shape: '●', img: ICON('fig-circulo'), color: '#B45309' },
  { shape: '■', img: ICON('fig-cuadrado'), color: '#7C3AED' },
  { shape: '★', img: ICON('fig-estrella'), color: '#DB2777' },
];

/** Ícono 3D generado (public/images/juego). */
function GameIcon({ name, className }: { name: string; className?: string }) {
  return <img src={ICON(name)} alt="" aria-hidden draggable={false} className={clsx('select-none pointer-events-none object-contain', className)} />;
}

const CONFETTI_COLORS = ['#C2E476', '#FFFFFF', '#2563EB', '#DB2777', '#D97706', '#16A34A'];

// Estallido al acertar: 22 confetis/estrellas que salen radiales desde el mosaico
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  a: Math.round((360 / 22) * i + ((i * 37) % 11) - 5),
  d: 70 + ((i * 53) % 60),
  delay: (i % 4) * 25,
  star: i % 3 === 0,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
}));

type FxKind = 'win' | 'lose' | 'timeout';
interface Fx { id: number; kind: FxKind; fly?: { x: number; y: number; dx: number; dy: number; gain: number } }

type PowerUp = 'fifty' | 'hint' | 'second' | 'double';
type Phase = 'answering' | 'result' | 'explain';

interface Prefs {
  timer: boolean;
  tts: boolean;
  musica: boolean;
  efectos: boolean;
  powerups: boolean;
  justification: 'always' | 'wrong';
}

const DEFAULT_PREFS: Prefs = { timer: true, tts: false, musica: true, efectos: true, powerups: true, justification: 'always' };

function readPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Número que sube animado hasta el valor objetivo. */
function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target || prefersReducedMotion()) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const v = Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      setValue(v);
      fromRef.current = v;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function BanqueoPractice() {
  const navigate = useNavigate();
  const { curso } = useParams<{ curso: string }>();
  const courseName = decodeURIComponent(curso || '');
  const [searchParams] = useSearchParams();
  const examId = (searchParams.get('examen') || readStoredBanqueoExam() || 'encib').toLowerCase();
  const reto = Number(searchParams.get('reto')) || 0;
  const continuar = searchParams.get('continuar') === '1';

  // questions = preguntas ya descargadas (prefijo de planIds, mismo orden); planIds = sesión completa
  const [questions, setQuestions] = useState<BanqueoQuestion[]>([]);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<QuestionState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const total = planIds.length;

  // ----- Banqueo v2 ("Arma tu banqueo"): null = detectando, false = backend viejo -----
  const [v2, setV2] = useState<boolean | null>(null);
  const [legacyNotice, setLegacyNotice] = useState('');
  const [items, setItems] = useState<BanqueoIdItem[]>([]);
  const [progreso, setProgreso] = useState<Progreso>(() => leerProgreso(examId));
  const [examMode, setExamMode] = useState(false);
  const [plan, setPlan] = useState<{ filtros: FiltrosBanqueo; categoria: Categoria; modo: ModoBanqueo; cantidad: number }>(
    { filtros: FILTROS_VACIOS, categoria: 'nuevas', modo: 'practica', cantidad: 10 }
  );
  const [armaKey, setArmaKey] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [batchError, setBatchError] = useState('');
  const [sessionKey, setSessionKey] = useState(0);
  const sessionRef = useRef(0);
  const fetchingRef = useRef(false);
  const restoreRef = useRef<{ earned: number[]; spent: (number | null)[] } | null>(null);
  const itemsById = useMemo(() => new Map(items.map(it => [it.id, it])), [items]);

  // Check access and load questions
  useEffect(() => {
    const dni = sessionStorage.getItem('banqueo_dni');
    const email = sessionStorage.getItem('banqueo_email');
    if (!dni || !email) {
      navigate('/banqueo/acceso');
      return;
    }

    loadBank();
  }, [courseName, examId, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Arranca un set nuevo de preguntas (reinicia toda la capa visual vía sessionKey). */
  const beginSet = (loaded: BanqueoQuestion[], ids: string[], states?: QuestionState[], index = 0) => {
    sessionRef.current += 1;
    fetchingRef.current = false;
    setQuestions(loaded);
    setPlanIds(ids);
    setQuestionStates(states ?? ids.map(() => ({ answered: false, selectedOption: null, isCorrect: false })));
    setCurrentIndex(index);
    setShowSummary(false);
    setBatchError('');
    setSessionKey(sessionRef.current);
  };

  /** Detecta el backend: con banqueoIds → "Arma tu banqueo"; si no, banqueo clásico de 10. */
  const loadBank = async () => {
    setLoading(true);
    setError('');
    setProgreso(leerProgreso(examId));
    try {
      const list = await getBanqueoIds(examId, courseName);
      setItems(list);
      setV2(true);
      if (continuar) await resumeSession(list);
      setLoading(false);
    } catch (err) {
      if (err instanceof AuthError) {
        // Sesión vencida y no renovable (p. ej. ya no está confirmado): volver a ingresar
        navigate('/banqueo/acceso');
        return;
      }
      if (err instanceof ApiError) {
        // Límite de uso u otro error declarado por el servidor: mostrarlo tal cual
        setError(err.message);
        setLoading(false);
        return;
      }
      setV2(false);
      setLegacyNotice(err instanceof BackendViejoError
        ? 'Actualiza el servidor para filtros y progreso'
        : 'No se pudieron cargar los filtros: práctica clásica de 10 al azar');
      await loadQuestions();
    }
  };

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getBanqueoQuestions(courseName, examId);
      if (result.error) {
        setError(result.error);
      } else {
        beginSet(result.questions, result.questions.map(q => q.id));
      }
    } catch (err) {
      if (err instanceof AuthError) { navigate('/banqueo/acceso'); return; }
      setError(err instanceof ApiError ? err.message : 'Error al cargar las preguntas. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  /** Ids que el servidor no devolvió (pregunta borrada/editada): se sacan del plan. */
  const resumeSession = async (list: BanqueoIdItem[]) => {
    const s = leerSesion();
    if (!s || s.exam !== examId || s.course !== courseName) return;
    const known = new Set(list.map(i => i.id));
    const upto = Math.min(s.ids.length, (Math.floor(s.index / BANQUEO_LOTE) + 1) * BANQUEO_LOTE);
    try {
      const got = await getBanqueoPorIds(examId, courseName, s.ids.slice(0, upto).filter(id => known.has(id)));
      const gotIds = new Set(got.map(q => q.id));
      const keep = s.ids.map((id, i) => ({ id, i })).filter(({ id, i }) => (i < upto ? gotIds.has(id) : known.has(id)));
      const ids = keep.map(k => k.id);
      const states = keep.map(k => s.states[k.i] ?? { answered: false, selectedOption: null, isCorrect: false });
      restoreRef.current = { earned: keep.map(k => s.earned[k.i] ?? 0), spent: keep.map(k => s.spent[k.i] ?? null) };
      const firstOpen = states.findIndex(st => !st.answered);
      setPlan({ filtros: s.filtros, categoria: s.categoria, modo: s.modo, cantidad: s.ids.length });
      setExamMode(s.modo === 'examen');
      beginSet(got, ids, states, firstOpen < 0 ? Math.max(0, ids.length - 1) : firstOpen);
      setStarted(true);
    } catch {
      // si falla, se queda en "Arma tu banqueo"
    }
  };

  /** Desde "Arma tu banqueo": mezcla, toma N y descarga el primer lote. */
  const startPlan = async (cfg: { filtros: FiltrosBanqueo; categoria: Categoria; modo: ModoBanqueo; cantidad: number; pool: BanqueoIdItem[] }) => {
    const chosenIds = mezclar(cfg.pool.map(p => p.id));
    const ids = cfg.cantidad === 0 ? chosenIds : chosenIds.slice(0, cfg.cantidad);
    if (!ids.length) return;
    setStarting(true);
    setStartError('');
    try {
      const first = ids.slice(0, BANQUEO_LOTE);
      const got = await getBanqueoPorIds(examId, courseName, first);
      if (!got.length) throw new Error('No se encontraron esas preguntas. Vuelve a cursos e inténtalo otra vez.');
      const gotIds = got.map(q => q.id);
      setPlan({ filtros: cfg.filtros, categoria: cfg.categoria, modo: cfg.modo, cantidad: cfg.cantidad });
      setExamMode(cfg.modo === 'examen');
      restoreRef.current = null;
      beginSet(got, [...gotIds, ...ids.slice(first.length)]);
      setStarted(true);
    } catch (err) {
      if (err instanceof AuthError) { navigate('/banqueo/acceso'); return; }
      setStartError(err instanceof Error ? err.message : 'No se pudieron cargar las preguntas.');
    } finally {
      setStarting(false);
    }
  };

  // Precarga del siguiente lote mientras el alumno responde
  const fetchNextBatch = useCallback(async () => {
    if (fetchingRef.current) return;
    const from = questions.length;
    const ids = planIds.slice(from, from + BANQUEO_LOTE);
    if (!ids.length) return;
    fetchingRef.current = true;
    const mySession = sessionRef.current;
    setBatchError('');
    try {
      const got = await getBanqueoPorIds(examId, courseName, ids);
      if (mySession !== sessionRef.current) return;
      const gotIds = got.map(q => q.id);
      if (gotIds.length !== ids.length) {
        // Faltaron algunas: se quitan del plan (todas las posiciones desde "from" están sin responder)
        const newLen = planIds.length - (ids.length - gotIds.length);
        setPlanIds(prev => [...prev.slice(0, from), ...gotIds, ...prev.slice(from + ids.length)]);
        setQuestionStates(prev => prev.slice(0, newLen));
        setEarned(prev => prev.slice(0, newLen));
        setSpent(prev => prev.slice(0, newLen));
      }
      setQuestions(prev => [...prev.slice(0, from), ...got]);
    } catch (err) {
      if (mySession === sessionRef.current) setBatchError(err instanceof Error ? err.message : 'No se pudo cargar el siguiente lote');
    } finally {
      if (mySession === sessionRef.current) fetchingRef.current = false;
    }
  }, [questions.length, planIds, examId, courseName]);

  const handleSelectOption = (optionIndex: number) => {
    if (questionStates[currentIndex]?.answered) return;

    const isCorrect = optionIndex === questions[currentIndex].correctAnswer;

    setQuestionStates(prev => {
      const newStates = [...prev];
      newStates[currentIndex] = {
        answered: true,
        selectedOption: optionIndex,
        isCorrect
      };
      return newStates;
    });
  };

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowSummary(true);
    }
  };

  const handlePracticeAgain = () => {
    if (v2) {
      // Volver a "Arma tu banqueo" con la misma selección
      setProgreso(leerProgreso(examId));
      setShowSummary(false);
      setStarted(false);
      setArmaKey(k => k + 1);
      return;
    }
    loadQuestions();
  };

  const correctCount = questionStates.filter(s => s.isCorrect).length;

  // ============================================
  // Estado de juego (solo interfaz)
  // ============================================
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>('answering');
  const [earned, setEarned] = useState<number[]>([]);
  const [spent, setSpent] = useState<(number | null)[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const startRef = useRef(performance.now());

  // Respuesta de la pregunta actual (índices originales)
  const [chosen, setChosen] = useState<number | null>(null);
  const [firstWrong, setFirstWrong] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // Potenciadores
  const [used, setUsed] = useState<Set<PowerUp>>(() => new Set());
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());
  const [hintShown, setHintShown] = useState(false);
  const [secondArmed, setSecondArmed] = useState(false);
  const [doubleArmed, setDoubleArmed] = useState(false);

  // Ronda de redención
  const [redemptionOffer, setRedemptionOffer] = useState(false);
  const [mode, setMode] = useState<'main' | 'redemption'>('main');
  const [rQueue, setRQueue] = useState<{ qi: number; order: number[] }[]>([]);
  const [rPos, setRPos] = useState(0);
  const [rResults, setRResults] = useState<boolean[]>([]);
  const [rPoints, setRPoints] = useState(0);

  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  // Efectos visuales del resultado (solo interfaz)
  const [fx, setFx] = useState<Fx | null>(null);
  const [pillBump, setPillBump] = useState(0);
  const [flameOut, setFlameOut] = useState(0);
  const tileRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const pillRef = useRef<HTMLSpanElement | null>(null);
  const fxSeq = useRef(0);
  const triggerFx = useCallback((kind: FxKind, orig: number | null, gain: number, hadStreak: boolean) => {
    let fly: Fx['fly'];
    if (kind === 'win' && gain > 0 && orig !== null) {
      const tile = tileRefs.current[orig]?.getBoundingClientRect();
      const pill = pillRef.current?.getBoundingClientRect();
      if (tile && pill) {
        const x = tile.left + tile.width / 2;
        const y = tile.top + tile.height / 2;
        fly = { x, y, dx: pill.left + pill.width / 2 - x, dy: pill.top + pill.height / 2 - y, gain };
      }
      window.setTimeout(() => setPillBump(n => n + 1), fly ? 880 : 200);
    }
    if (kind !== 'win' && hadStreak) setFlameOut(n => n + 1);
    setFx({ id: ++fxSeq.current, kind, fly });
  }, []);
  const [cards, setCards] = useState<StudyCard[] | null>(null);

  const wmText = useMemo(() => {
    try {
      return watermarkText(sessionStorage.getItem('banqueo_dni'), sessionStorage.getItem('banqueo_email'));
    } catch {
      return '';
    }
  }, []);

  const studentName = useMemo(() => {
    try {
      const email = sessionStorage.getItem('banqueo_email') || '';
      const n = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
      return n ? n.charAt(0).toUpperCase() + n.slice(1) : 'Estudiante';
    } catch {
      return 'Estudiante';
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignorar */ }
  }, [prefs]);

  // Nuevo set de preguntas: reiniciar todo lo visual (o restaurar una sesión a medias)
  useEffect(() => {
    const restore = restoreRef.current;
    restoreRef.current = null;
    setEarned(restore ? restore.earned : planIds.map(() => 0));
    setSpent(restore ? restore.spent : planIds.map(() => null));
    setStreak(0);
    setBestStreak(0);
    setUsed(new Set());
    setSecondArmed(false);
    setDoubleArmed(false);
    setMode('main');
    setRedemptionOffer(false);
    setRQueue([]);
    setRResults([]);
    setRPoints(0);
  }, [sessionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => {
    if (mode === 'redemption') {
      const item = rQueue[rPos];
      if (!item) return null;
      return { q: questions[item.qi], order: item.order };
    }
    const q = questions[currentIndex];
    return q ? { q, order: q.options.map((_, i) => i) } : null;
  }, [mode, rQueue, rPos, questions, currentIndex]);

  // Reiniciar la pregunta en pantalla (no al anexar un lote: depende del id visible, no del array)
  const viewId = view?.q.id ?? null;
  useEffect(() => {
    startRef.current = performance.now();
    setTimeLeft(QUESTION_SECONDS);
    setPhase('answering');
    setChosen(null);
    setFirstWrong(null);
    setTimedOut(false);
    setHidden(new Set());
    setHintShown(false);
    setFx(null);
    stopSpeaking();
    window.scrollTo({ top: 0 });
  }, [currentIndex, sessionKey, mode, rPos, viewId]);

  // Precarga: cuando faltan menos de 20 preguntas descargadas, pide el siguiente lote de 30
  useEffect(() => {
    if (!v2 || !started || showSummary) return;
    if (questions.length >= planIds.length) return;
    if (currentIndex < questions.length - 20) return;
    fetchNextBatch();
  }, [v2, started, showSummary, currentIndex, questions.length, planIds.length, fetchNextBatch]);

  // Si el plan se acortó (preguntas que ya no existen) y no queda nada por delante, terminar
  useEffect(() => {
    if (started && !showSummary && total > 0 && currentIndex >= total) {
      setCurrentIndex(total - 1);
      setShowSummary(true);
    }
  }, [started, showSummary, total, currentIndex]);

  // Guardar la sesión a medias (para "Continuar donde lo dejé")
  useEffect(() => {
    if (!v2 || !started || !planIds.length) return;
    if (showSummary) { borrarSesion(); return; }
    guardarSesion({
      v: 1, exam: examId, course: courseName, modo: examMode ? 'examen' : 'practica',
      ids: planIds, index: currentIndex, states: questionStates, earned, spent,
      filtros: plan.filtros, categoria: plan.categoria, updatedAt: new Date().toISOString()
    });
  }, [v2, started, showSummary, planIds, currentIndex, questionStates, earned, spent, examId, courseName, examMode, plan]);

  const totalPoints = earned.reduce((a, b) => a + b, 0) + rPoints;
  const shownPoints = useCountUp(totalPoints);

  const needExplain = useCallback((finalCorrect: boolean) => prefs.justification === 'always' || !finalCorrect, [prefs.justification]);

  // Registrar respuesta (índice ORIGINAL de la alternativa, o null si se acabó el tiempo)
  const answer = useCallback((orig: number | null) => {
    if (phase !== 'answering' || !view) return;
    // Protección: ignora clics en los primeros 450 ms de la pregunta (evita que un doble clic
    // en "Siguiente" responda sin querer la pregunta nueva). El tiempo agotado (null) siempre pasa.
    if (orig !== null && performance.now() - startRef.current < 450) return;
    const q = view.q;
    const correct = orig !== null && orig === q.correctAnswer;
    const elapsed = Math.min(QUESTION_SECONDS, (performance.now() - startRef.current) / 1000);

    // Redención: no altera el resultado de la práctica
    if (mode === 'redemption') {
      setChosen(orig);
      setTimedOut(orig === null);
      setRResults(prev => { const n = [...prev]; n[rPos] = correct; return n; });
      if (correct) setRPoints(p => p + REDEMPTION_POINTS);
      if (correct) sonido.correcto(); else if (orig === null) sonido.tiempoAgotado(); else sonido.incorrecto();
      triggerFx(correct ? 'win' : orig === null ? 'timeout' : 'lose', orig, correct ? REDEMPTION_POINTS : 0, false);
      setLastGain(correct ? REDEMPTION_POINTS : 0);
      setPhase('result');
      return;
    }

    if (questionStates[currentIndex]?.answered) return;

    // Segunda oportunidad: el primer error no cuenta todavía
    if (!correct && orig !== null && secondArmed && firstWrong === null) {
      setFirstWrong(orig);
      setSecondArmed(false);
      sonido.incorrecto();
      triggerFx('lose', orig, 0, false);
      return;
    }

    const isSecondTry = firstWrong !== null;
    let gain = 0;
    let newStreak = 0;
    if (correct) {
      newStreak = isSecondTry ? streak : streak + 1;
      const speedBonus = Math.round(MAX_SPEED_BONUS * Math.max(0, 1 - elapsed / QUESTION_SECONDS));
      const streakBonus = Math.min(50, Math.max(0, newStreak - 1) * 10);
      gain = BASE_POINTS + (prefs.timer ? speedBonus : 0) + streakBonus;
      if (isSecondTry) gain = Math.round(gain / 2);
      if (doubleArmed) { gain *= 2; setDoubleArmed(false); }
    }
    if (examMode) {
      // Modo examen: sin pistas de acierto/error hasta el final
      if (orig === null) sonido.tiempoAgotado(); else sonido.blip();
    } else {
      if (correct) {
        sonido.correcto(newStreak);
        if (!isSecondTry) sonido.racha(newStreak);
      } else if (orig === null) {
        sonido.tiempoAgotado();
      } else {
        sonido.incorrecto();
      }
      triggerFx(correct ? 'win' : orig === null ? 'timeout' : 'lose', orig, gain, streak > 0);
    }
    setStreak(newStreak);
    setBestStreak(b => Math.max(b, newStreak));
    setLastGain(gain);
    setEarned(prev => { const n = [...prev]; n[currentIndex] = gain; return n; });
    setSpent(prev => { const n = [...prev]; n[currentIndex] = Math.round(elapsed); return n; });
    setChosen(orig);
    setTimedOut(orig === null);

    // El resultado de la práctica registra el primer intento
    const recorded = isSecondTry ? firstWrong : orig;
    if (recorded === null) {
      setQuestionStates(prev => {
        const n = [...prev];
        n[currentIndex] = { answered: true, selectedOption: null, isCorrect: false };
        return n;
      });
    } else {
      handleSelectOption(recorded);
    }

    // Progreso local + repetición espaciada (solo con ids estables del backend nuevo)
    if (v2) {
      const it = itemsById.get(q.id);
      registrarRespuesta(examId, q.id, recorded !== null && recorded === q.correctAnswer, {
        curso: courseName,
        tema: it?.tema ?? (q.metadata?.tema ? String(q.metadata.tema) : undefined)
      });
      setProgreso(leerProgreso(examId));
    }

    // En modo examen la fase sigue en "answering" (sin revelar) y se avanza sola
    if (!examMode) setPhase('result');
  }, [phase, view, mode, rPos, questionStates, currentIndex, secondArmed, firstWrong, streak, prefs.timer, doubleArmed, triggerFx, examMode, v2, itemsById, examId, courseName]);

  const finalCorrect = view ? chosen !== null && chosen === view.q.correctAnswer : false;
  const recordedCorrect = mode === 'redemption' ? finalCorrect : !!questionStates[currentIndex]?.isCorrect;

  const failedIndexes = useMemo(
    () => questionStates.map((s, i) => (s.answered && !s.isCorrect ? i : -1)).filter(i => i >= 0),
    [questionStates]
  );

  const goNext = useCallback(() => {
    stopSpeaking();
    if (mode === 'redemption') {
      if (rPos < rQueue.length - 1) setRPos(p => p + 1);
      else {
        setMode('main');
        handleNext();
      }
      return;
    }
    const isLast = currentIndex >= total - 1;
    if (isLast && failedIndexes.length > 0 && rQueue.length === 0 && !examMode) {
      setRedemptionOffer(true);
      return;
    }
    handleNext();
  }, [mode, rPos, rQueue.length, currentIndex, total, failedIndexes.length, examMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Modo examen: tras elegir, pasa sola a la siguiente
  const examAnswered = examMode && mode === 'main' && !!questionStates[currentIndex]?.answered;
  useEffect(() => {
    if (!examAnswered || phase !== 'answering') return;
    const id = window.setTimeout(goNext, 450);
    return () => window.clearTimeout(id);
  }, [examAnswered, phase, goNext]);

  const continueFromResult = useCallback(() => {
    if (needExplain(recordedCorrect)) setPhase('explain');
    else goNext();
  }, [needExplain, recordedCorrect, goNext]);

  // Tras el resultado, pasar solo a la justificación
  useEffect(() => {
    if (phase !== 'result' || !needExplain(recordedCorrect)) return;
    const id = window.setTimeout(() => setPhase('explain'), 1500);
    return () => window.clearTimeout(id);
  }, [phase, recordedCorrect, needExplain]);

  const startRedemption = () => {
    setRQueue(failedIndexes.map(qi => ({ qi, order: shuffled(questions[qi].options.length) })));
    setRResults([]);
    setRPos(0);
    setRedemptionOffer(false);
    setMode('redemption');
  };

  const skipRedemption = () => {
    setRedemptionOffer(false);
    handleNext();
  };

  // ----- Sonido: música de fondo y efectos -----
  const lastTickRef = useRef(0);
  useEffect(() => { sonido.configurar({ musica: prefs.musica, efectos: prefs.efectos }); }, [prefs.musica, prefs.efectos]);
  useEffect(() => { if (started) sonido.iniciar(); }, [started, prefs.musica]);
  useEffect(() => () => sonido.detener(), []);
  useEffect(() => {
    lastTickRef.current = 0;
    if (phase === 'answering') { sonido.ambiente('pregunta'); return; }
    // al leer la justificación: fondo suave (entra cuando ya terminó el "clin"/"ennn")
    const id = window.setTimeout(() => sonido.ambiente('lectura'), 900);
    return () => window.clearTimeout(id);
  }, [phase, currentIndex]);
  useEffect(() => {
    if (!showSummary) return;
    const ok = questionStates.filter(s => s?.isCorrect).length;
    sonido.fanfarria(questionStates.length > 0 && ok / questionStates.length >= 0.7);
  }, [showSummary]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cuenta regresiva por pregunta
  const timerActive = started && prefs.timer && phase === 'answering' && !examAnswered && !loading && !error && !showSummary && !redemptionOffer && !!view;
  useEffect(() => {
    if (!timerActive) return;
    const id = window.setInterval(() => {
      const left = QUESTION_SECONDS - (performance.now() - startRef.current) / 1000;
      if (left <= 0) {
        setTimeLeft(0);
        answer(null);
      } else {
        setTimeLeft(left);
        sonido.tension(1 - left / QUESTION_SECONDS);
        const sec = Math.ceil(left);
        if (sec <= 5 && sec !== lastTickRef.current) { lastTickRef.current = sec; sonido.tic(1 + (5 - sec) * 0.2); }
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [timerActive, answer]);

  // Potenciadores
  const applyPowerUp = (p: PowerUp) => {
    if (!view || used.has(p) || phase !== 'answering' || mode !== 'main' || examMode) return;
    if (p === 'fifty') {
      const wrong = view.q.options.map((_, i) => i).filter(i => i !== view.q.correctAnswer && i !== firstWrong);
      setHidden(new Set(shuffled(wrong.length).slice(0, 2).map(k => wrong[k])));
    } else if (p === 'hint') {
      setHintShown(true);
    } else if (p === 'second') {
      setSecondArmed(true);
    } else if (p === 'double') {
      setDoubleArmed(true);
    }
    setUsed(prev => new Set(prev).add(p));
    sonido.potenciador();
  };

  // Teclado
  useEffect(() => {
    if (loading || error || showSummary || cards || zoomSrc) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (!started || redemptionOffer) {
        // En "Arma tu banqueo" (v2) se empieza con su propio botón
        if (key === 'enter' && target?.tagName !== 'BUTTON' && v2 === false) { e.preventDefault(); if (!started) setStarted(true); }
        return;
      }
      if (!view) return;
      if (phase === 'answering') {
        let d = -1;
        if (/^[1-5]$/.test(key)) d = Number(key) - 1;
        else if (/^[a-e]$/.test(key)) d = key.charCodeAt(0) - 97;
        if (d >= 0 && d < view.order.length) {
          const orig = view.order[d];
          if (!hidden.has(orig) && orig !== firstWrong) { e.preventDefault(); answer(orig); }
        }
        return;
      }
      if (key === ' ' || key === 'enter' || key === 'arrowright') {
        if (key === 'enter' && target?.tagName === 'BUTTON') return;
        e.preventDefault();
        if (phase === 'result') continueFromResult();
        else goNext();
      } else if (key === 'arrowleft' && phase === 'explain') {
        e.preventDefault();
        setPhase('result');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const confetti = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const r = (n: number) => (Math.sin((i + 1) * n) + 1) / 2;
        return {
          left: `${Math.round(r(12.9898) * 100)}%`,
          delay: `${(r(78.233) * 0.8).toFixed(2)}s`,
          duration: `${(2.4 + r(3.7) * 1.8).toFixed(2)}s`,
          drift: `${Math.round((r(9.1) - 0.5) * 160)}px`,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        };
      }),
    []
  );

  const openCards = (list: BanqueoQuestion[]) => setCards(list.map(q => toCard(q, courseName)));

  // ============================================
  // Pantallas
  // ============================================
  const flashcards = cards && (
    <FlashcardReview examId={examId} cards={cards} title={`Fichas · ${courseName}`} onClose={() => setCards(null)} />
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-dots flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Loader2 className="w-9 h-9 text-lime-400 animate-spin mx-auto mb-4" />
          <p className="font-display font-extrabold uppercase tracking-[0.02em] text-lg">Preparando tu práctica</p>
          <p className="text-white/60 text-sm mt-1">{courseName}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dots flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-9 h-9 text-wrong mx-auto mb-3" />
          <h2 className="title-screen text-2xl mb-2">No se pudo cargar</h2>
          <p className="text-muted mb-6">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate('/banqueo/cursos')} className="btn-secondary">Volver a cursos</button>
            <button onClick={v2 === false ? loadQuestions : loadBank} className="btn-primary">Reintentar</button>
          </div>
        </div>
      </div>
    );
  }

  const ajustesPanel = (
    <>
      <Toggle label="Temporizador por pregunta" hint="90 segundos" checked={prefs.timer} onChange={v => setPrefs(p => ({ ...p, timer: v }))} />
      <Toggle label="Leer en voz alta" hint="Botón 🔊 en el enunciado" checked={prefs.tts} onChange={v => setPrefs(p => ({ ...p, tts: v }))} />
      <Toggle label="Música" hint="Suave al responder, alegre en los intermedios" checked={prefs.musica} onChange={v => setPrefs(p => ({ ...p, musica: v }))} />
      <Toggle label="Efectos de sonido" hint="Acierto, error, racha y tiempo" checked={prefs.efectos} onChange={v => setPrefs(p => ({ ...p, efectos: v }))} />
      <Toggle label="Potenciadores" hint="50/50, pista, segunda oportunidad, x2 (solo en modo práctica)" checked={prefs.powerups} onChange={v => setPrefs(p => ({ ...p, powerups: v }))} />
      <div className="px-4 py-3">
        <p className="text-[15px] font-semibold">Mostrar justificación</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([['always', 'Siempre'], ['wrong', 'Solo si fallo']] as const).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setPrefs(p => ({ ...p, justification: v }))}
              aria-pressed={prefs.justification === v}
              className={clsx('chip h-10 text-[14px]', prefs.justification === v && 'chip-active')}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  // ----- Inicio v2: "Arma tu banqueo" -----
  if (!started && v2) {
    const deckCount = readDeck(examId).length;
    return (
      <>
        {flashcards}
        <ArmaBanqueo
          key={armaKey}
          examId={examId}
          courseName={courseName}
          items={items}
          progreso={progreso}
          inicial={plan}
          ajustes={ajustesPanel}
          starting={starting}
          error={startError}
          onStart={startPlan}
          onBack={() => navigate('/banqueo/cursos')}
          extra={
            <>
              {reto > 0 && <ChallengeBanner points={reto} className="mt-5" />}
              {deckCount > 0 && (
                <button
                  type="button"
                  onClick={() => setCards(readDeck(examId))}
                  className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/75 hover:text-white"
                >
                  <Layers className="w-4 h-4" /> Repasar mis fichas ({deckCount})
                </button>
              )}
            </>
          }
        />
      </>
    );
  }

  // ----- Inicio clásico (backend viejo): ajustes de la práctica -----
  if (!started) {
    const deckCount = readDeck(examId).length;
    return (
      <div className="min-h-screen bg-dots text-white px-3 sm:px-5 py-8 sm:py-14">
        {flashcards}
        <div className="max-w-[520px] mx-auto">
          <button type="button" onClick={() => navigate('/banqueo/cursos')} className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white mb-6">
            <ChevronLeft className="w-4 h-4" /> Cursos
          </button>
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-white/60 text-sm">{examId.toUpperCase()} · Banqueo</p>
              <h1 className="font-display font-extrabold uppercase tracking-[0.02em] text-[30px] sm:text-[36px] leading-tight mt-1">{courseName}</h1>
            </div>
            <img src={areaImg(courseName)} alt="" aria-hidden draggable={false} className="w-20 h-20 sm:w-24 sm:h-24 object-contain shrink-0 motion-safe:animate-pop" />
          </div>
          <p className="mt-2 text-white/70 num">{questions.length} preguntas · responde con un toque</p>

          {reto > 0 && <ChallengeBanner points={reto} className="mt-5" />}

          <div className="mt-6 bg-white text-ink rounded-3xl p-2">
            {ajustesPanel}
          </div>

          <button
            type="button"
            onClick={() => setStarted(true)}
            autoFocus
            className="btn w-full mt-6 min-h-[60px] text-[18px] bg-lime-400 text-jungle-900 hover:bg-lime-500 focus-visible:ring-lime-400/60 focus-visible:ring-offset-jungle-900"
          >
            <Play className="w-5 h-5" fill="currentColor" /> Empezar
          </button>
          {deckCount > 0 && (
            <button
              type="button"
              onClick={() => setCards(readDeck(examId))}
              className="btn w-full mt-3 border border-white/25 text-white hover:bg-white/10"
            >
              <Layers className="w-5 h-5" /> Mis fichas ({deckCount})
            </button>
          )}
          {legacyNotice && (
            <p className="mt-6 text-center text-[12px] text-white/45">{legacyNotice}</p>
          )}
        </div>
      </div>
    );
  }

  // ----- Pantalla final -----
  if (showSummary) {
    const total = questions.length;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const times = spent.filter((t): t is number => t !== null);
    const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    const failed = questions.map((q, i) => ({ q, i, state: questionStates[i] })).filter(x => !x.state?.isCorrect);
    // Modo examen: revisión de todas las respondidas
    const review = examMode ? questions.map((q, i) => ({ q, i, state: questionStates[i] })).filter(x => x.state?.answered) : failed;
    let nuevas: { count: number; scope: string; onGo: () => void } | null = null;
    if (v2) {
      const pool = filtrar(items, plan.filtros).filter(it => esNueva(progreso[it.id]));
      const t = plan.filtros.temas;
      nuevas = {
        count: pool.length,
        scope: t.length === 1 ? `de ${t[0]}` : t.length > 1 ? 'de estos temas' : 'de este curso',
        onGo: () => startPlan({ filtros: plan.filtros, categoria: 'nuevas', modo: plan.modo, cantidad: plan.cantidad, pool })
      };
    }
    return (
      <>
        {flashcards}
        <SummaryScreen
          review={review}
          examMode={examMode}
          nuevas={nuevas}
          starting={starting}
          repeatLabel={v2 ? 'Armar otro banqueo' : 'Repetir este curso'}
          examId={examId}
          courseName={courseName}
          pct={pct}
          correct={correctCount}
          total={total}
          points={totalPoints}
          bestStreak={bestStreak}
          avgTime={prefs.timer ? avgTime : null}
          failed={failed}
          redeemed={rResults.length > 0 ? { ok: rResults.filter(Boolean).length, total: rQueue.length } : null}
          reto={reto}
          confetti={pct >= 70 ? confetti : null}
          onRepeat={handlePracticeAgain}
          onOther={() => navigate('/banqueo/cursos')}
          onCards={() => openCards(failed.map(f => f.q))}
        />
      </>
    );
  }

  // ----- Oferta de redención -----
  if (redemptionOffer) {
    return (
      <div className="min-h-screen bg-dots text-white flex items-center justify-center px-4 py-10">
        <div className="max-w-[460px] w-full text-center motion-safe:animate-slide-up">
          <img src={mascota('anima')} alt="" aria-hidden draggable={false} className="w-28 h-28 mx-auto object-contain motion-safe:animate-pop" />
          <h1 className="mt-5 font-display font-extrabold uppercase tracking-[0.02em] text-[28px]">Ronda de redención</h1>
          <p className="mt-2 text-white/75">
            Fallaste <strong className="text-white num">{failedIndexes.length}</strong>. Vuelve a intentarlas con las alternativas en otro orden.
          </p>
          <button
            type="button"
            onClick={startRedemption}
            autoFocus
            className="btn w-full mt-7 min-h-[60px] text-[18px] bg-lime-400 text-jungle-900 hover:bg-lime-500 focus-visible:ring-offset-jungle-900"
          >
            Intentar de nuevo
          </button>
          <button type="button" onClick={skipRedemption} className="btn w-full mt-3 text-white/80 hover:text-white">
            Ver mis resultados
          </button>
        </div>
      </div>
    );
  }

  if (!view) {
    // La pregunta actual aún no llegó (lote en camino)
    return (
      <div className="min-h-screen bg-dots flex items-center justify-center p-4">
        <div className="text-center text-white max-w-sm">
          {batchError ? (
            <>
              <AlertCircle className="w-9 h-9 text-wrong mx-auto mb-3" />
              <p className="font-semibold">No se pudo cargar la siguiente pregunta</p>
              <p className="text-white/60 text-sm mt-1">{batchError}</p>
              <div className="mt-5 flex flex-col gap-2">
                <button type="button" onClick={fetchNextBatch} className="btn bg-lime-400 text-jungle-900 hover:bg-lime-500">Reintentar</button>
                <button type="button" onClick={() => setShowSummary(true)} className="btn text-white/80 hover:text-white">Terminar aquí y ver resultados</button>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="w-9 h-9 text-lime-400 animate-spin mx-auto mb-4" />
              <p className="font-display font-extrabold uppercase tracking-[0.02em] text-lg">Cargando más preguntas</p>
              <p className="text-white/60 text-sm mt-1 num">{currentIndex + 1} de {total}</p>
            </>
          )}
        </div>
      </div>
    );
  }
  const { q, order } = view;
  const isMarked = !!progreso[q.id]?.marcada;
  const toggleMark = () => {
    alternarMarcada(examId, q.id, { curso: courseName, tema: itemsById.get(q.id)?.tema });
    setProgreso(leerProgreso(examId));
  };
  const starButton = (className: string) => v2 && (
    <button
      type="button"
      onClick={toggleMark}
      aria-pressed={isMarked}
      aria-label={isMarked ? 'Quitar de marcadas' : 'Marcar para repasar'}
      title={isMarked ? 'Quitar de marcadas' : 'Marcar para repasar (queda en "Marcadas")'}
      className={clsx('grid place-items-center rounded-full transition-colors', className)}
    >
      <Star className={clsx('w-5 h-5', isMarked ? 'text-warning' : '')} fill={isMarked ? 'currentColor' : 'none'} />
    </button>
  );
  const correctDisplay = order.indexOf(q.correctAnswer);
  const correctLetter = String.fromCharCode(65 + correctDisplay);
  const timePct = Math.max(0, Math.min(100, (timeLeft / QUESTION_SECONDS) * 100));
  const timeColor = timeLeft <= 10 ? 'bg-wrong' : timeLeft <= 30 ? 'bg-warning' : 'bg-lime-400';
  const isRedemption = mode === 'redemption';
  const counter = isRedemption ? `${rPos + 1}/${rQueue.length}` : `${currentIndex + 1}/${total}`;
  const examChosen = examMode && !isRedemption && chosen !== null && !!questionStates[currentIndex]?.answered;
  const ttsText = `${stripHtml(q.questionText)}. ${order.map((o, d) => `${String.fromCharCode(65 + d)}: ${stripHtml(q.options[o])}`).join('. ')}`;
  const hint = String(q.metadata?.subtema || '').trim();

  // Mosaicos visibles: al responder solo quedan la correcta y la elegida errónea
  const visibleTiles = order
    .map((orig, d) => ({ orig, d }))
    .filter(({ orig }) => {
      if (phase === 'answering') return !hidden.has(orig);
      return orig === q.correctAnswer || orig === chosen || orig === firstWrong;
    });

  return (
    <div className="min-h-screen bg-dots text-white flex flex-col">
      {flashcards}

      {/* ===== Cabecera ===== */}
      <header className="sticky top-0 z-30 bg-jungle-900/95 border-b border-white/10">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-5 h-16 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => { stopSpeaking(); navigate('/banqueo/cursos'); }}
              className="w-9 h-9 grid place-items-center rounded-full text-white/70 hover:text-white hover:bg-white/10 shrink-0"
              aria-label="Salir de la práctica"
            >
              <X className="w-5 h-5" />
            </button>
            {examMode && (
              <span className="inline-flex items-center h-8 px-3 rounded-full bg-white/10 text-[12px] font-bold uppercase tracking-[0.08em] text-white/80">Examen</span>
            )}
            <div
              className={clsx(
                'inline-flex items-center gap-2 h-10 pl-2 pr-3 rounded-full shrink-0',
                streak > 0 ? 'bg-warning/90' : 'bg-white/10',
                examMode && 'hidden'
              )}
              title="Racha"
            >
              <span
                key={`flame-${flameOut}`}
                className={clsx('relative inline-block', streak > 0 ? 'fx-flame' : flameOut > 0 && 'fx-flame-out')}
                style={streak > 0 ? { transform: `scale(${1 + Math.min(streak, 10) * 0.05})` } : undefined}
              >
                <GameIcon name="racha" className="w-7 h-7" />
                {streak >= 5 && [0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="fx-spark"
                    style={{ left: `${7 + i * 6}px`, top: '0px', animationDelay: `${i * 0.3}s`, ['--sx' as string]: `${(i - 1) * 7}px` }}
                  />
                ))}
              </span>
              <span className="leading-none">
                <span className="block num text-[17px] font-extrabold">{streak}</span>
                <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-[0.08em] text-white/80">Racha</span>
              </span>
            </div>
          </div>
          <span className="justify-self-center num inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white text-jungle-900 text-[15px] font-extrabold">
            {isRedemption && <HeartPulse className="w-4 h-4 text-wrong" />}
            {counter}
          </span>
          <div className="justify-self-end flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPrefs(p => { const on = !(p.musica || p.efectos); return { ...p, musica: on, efectos: on }; })}
              aria-label={prefs.musica || prefs.efectos ? 'Silenciar' : 'Activar sonido'}
              title={prefs.musica || prefs.efectos ? 'Silenciar' : 'Activar sonido'}
              className="w-9 h-9 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              {prefs.musica || prefs.efectos ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <span
              ref={pillRef}
              key={`pill-${pillBump}`}
              className={clsx('num inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-lime-400 text-jungle-900 text-sm font-extrabold', pillBump > 0 && 'fx-pill-bump', examMode && 'hidden')}
              aria-label={`${totalPoints} puntos`}
            >
              <GameIcon name="puntos" className="w-6 h-6 -ml-1" />
              {shownPoints}
            </span>
          </div>
        </div>
        {prefs.timer && (
          <div className="max-w-[1200px] mx-auto px-3 sm:px-5 pb-2.5 flex items-center gap-2">
            <span className={clsx('shrink-0 inline-block', timedOut && phase !== 'answering' && 'fx-clock-shake')}>
              <GameIcon name="tiempo" className="w-5 h-5" />
            </span>
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <div className={clsx('h-full rounded-full transition-[width] duration-200 ease-linear', timeColor)} style={{ width: `${timePct}%` }} />
            </div>
            <span className="num text-xs font-semibold text-white/70 w-8 text-right">{Math.ceil(timeLeft)}s</span>
          </div>
        )}
      </header>

      {reto > 0 && phase === 'answering' && !isRedemption && currentIndex === 0 && (
        <div className="max-w-[1200px] w-full mx-auto px-3 sm:px-5 pt-3">
          <ChallengeBanner points={reto} compact />
        </div>
      )}

      {/* ===== Contenido ===== */}
      <main
        key={`${mode}-${currentIndex}-${rPos}-${phase === 'explain' ? 'e' : 'q'}`}
        className="relative no-copy flex-1 max-w-[1200px] w-full mx-auto px-3 sm:px-5 pt-4 pb-32 motion-safe:animate-q-in"
        {...noCopyProps}
      >
        <Watermark text={wmText} color={phase === 'explain' ? '#000000' : '#ffffff'} opacity={phase === 'explain' ? 0.05 : 0.07} />
        {phase === 'explain' ? (
          // ----- Pantalla intermedia: justificación -----
          <div className="max-w-[760px] mx-auto">
            <div className={clsx(
              'mb-4 rounded-2xl px-4 py-3 flex items-center gap-3 font-semibold',
              finalCorrect ? 'bg-correct text-white' : 'bg-wrong text-white'
            )}>
              {finalCorrect ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              <span>
                {finalCorrect
                  ? <>Correcto{lastGain > 0 && <span className="num"> · +{lastGain}</span>}</>
                  : <>La respuesta era <strong>{correctLetter}</strong></>}
              </span>
            </div>
            <section className="bg-white text-ink rounded-3xl p-5 sm:p-8">
              <div className="flex items-center gap-2 mb-4">
                <GameIcon name="justificacion" className="w-10 h-10" />
                <h2 className="flex-1 font-display font-extrabold uppercase tracking-[0.02em] text-jungle-800">Justificación</h2>
                {starButton(clsx('w-10 h-10 hover:bg-paper', isMarked ? 'text-warning' : 'text-muted hover:text-jungle-800'))}
                {prefs.tts && (
                  <SpeakButton
                    text={`Respuesta ${correctLetter}: ${stripHtml(q.options[q.correctAnswer])}. ${stripHtml(q.justification || '')}`}
                    className="text-jungle-800 hover:bg-paper"
                  />
                )}
              </div>
              <p className="text-[17px] font-semibold text-correct leading-snug">
                {correctLetter}) <span dangerouslySetInnerHTML={{ __html: q.options[q.correctAnswer] }} />
              </p>
              {q.justification ? (
                <div className="mt-4 text-[16px] sm:text-[17px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: q.justification }} />
              ) : (
                <p className="mt-4 text-[15px] text-muted">Esta pregunta aún no tiene justificación escrita.</p>
              )}
              <dl className="mt-6 pt-4 border-t border-line grid gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="label-section">Curso / tema</dt>
                  <dd className="text-ink mt-0.5">
                    {q.metadata?.curso || courseName}
                    {q.metadata?.tema && <> · {q.metadata.tema}</>}
                    {q.metadata?.subtema && <> · {q.metadata.subtema}</>}
                  </dd>
                </div>
                {q.sourceFile && (
                  <div>
                    <dt className="label-section">Fuente</dt>
                    <dd className="text-ink mt-0.5">{q.sourceFile}</dd>
                  </div>
                )}
              </dl>
            </section>
          </div>
        ) : (
          <>
            {/* ----- Panel de la pregunta ----- */}
            <section
              key={`panel-${fx && fx.kind !== 'win' ? fx.id : 0}`}
              className={clsx(
                'relative rounded-lg bg-black/25 border border-white/10 p-4 pt-11 sm:p-6 sm:pt-12 flex flex-col md:flex-row md:items-center gap-5 min-h-[180px]',
                fx && fx.kind !== 'win' && 'fx-panel-shake'
              )}
            >
              {/* Fuente (esquina izq.) y curso · tema (esquina der.): visibles sin estorbar */}
              {q.sourceFile && (
                <span
                  className="absolute top-3 left-3 max-w-[45%] truncate inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md bg-lime-400/95 text-jungle-900 text-[12px] font-bold"
                  title={`Fuente: ${q.sourceFile}`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{q.sourceFile}</span>
                </span>
              )}
              {starButton(clsx('absolute top-2 right-2 w-8 h-8 hover:bg-white/10', isMarked ? 'text-warning' : 'text-white/70 hover:text-white'))}
              {(q.metadata?.curso || q.metadata?.tema) && (
                <span
                  className={clsx(
                    'absolute top-3 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md bg-white/10 text-white/75 text-[12px] font-semibold',
                    v2 ? 'right-12 max-w-[42%]' : 'right-3 max-w-[50%]'
                  )}
                  title={[q.metadata?.curso, phase !== 'answering' ? q.metadata?.tema : null].filter(Boolean).join(' · ')}
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{[q.metadata?.curso, phase !== 'answering' ? q.metadata?.tema : null].filter(Boolean).join(' · ')}</span>
                </span>
              )}
              {q.imageLink && (
                <button
                  type="button"
                  onClick={() => setZoomSrc(q.imageLink)}
                  className="group relative shrink-0 md:w-[36%] rounded-lg overflow-hidden bg-white cursor-zoom-in self-center"
                  aria-label="Ampliar imagen"
                >
                  <img src={q.imageLink} alt="Imagen de la pregunta" className="w-full max-h-[280px] object-contain" />
                  <span className="absolute bottom-2 right-2 w-9 h-9 grid place-items-center rounded-full bg-jungle-900/80 text-white">
                    <ZoomIn className="w-4 h-4" />
                  </span>
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-center gap-2 mb-3 empty:hidden">
                  {isRedemption && (
                    <span className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-wrong text-white text-[13px] font-semibold">
                      <HeartPulse className="w-3.5 h-3.5" /> Redención
                    </span>
                  )}
                  {hintShown && hint && (
                    <span className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-lime-400 text-jungle-900 text-[13px] font-semibold motion-safe:animate-slide-down">
                      <Lightbulb className="w-3.5 h-3.5" /> {hint}
                    </span>
                  )}
                  {secondArmed && (
                    <span className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-white/15 text-[13px] font-semibold">
                      <HeartPulse className="w-3.5 h-3.5" /> Segunda oportunidad activa
                    </span>
                  )}
                  {firstWrong !== null && phase === 'answering' && (
                    <span className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-warning text-white text-[13px] font-semibold motion-safe:animate-slide-down">
                      ¡Otra vez! Vale la mitad
                    </span>
                  )}
                  {doubleArmed && (
                    <span className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-[#7C3AED] text-white text-[13px] font-semibold">
                      <Zap className="w-3.5 h-3.5" /> Puntos x2
                    </span>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <div
                    className="flex-1 text-center text-[19px] sm:text-[22px] lg:text-[24px] font-semibold leading-snug"
                    dangerouslySetInnerHTML={{ __html: q.questionText }}
                  />
                  {prefs.tts && <SpeakButton text={ttsText} className="text-white/80 hover:bg-white/10 -mt-1" />}
                </div>
              </div>
            </section>

            {/* ----- Mosaicos ----- */}
            <div
              role="radiogroup"
              aria-label="Alternativas"
              className={clsx(
                'mt-4 grid gap-3',
                phase === 'answering'
                  ? clsx('grid-cols-1 sm:grid-cols-2', visibleTiles.length >= 5 ? 'lg:grid-cols-5' : visibleTiles.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')
                  : 'grid-cols-1 sm:grid-cols-2 max-w-[900px] mx-auto'
              )}
            >
              {visibleTiles.map(({ orig, d }) => {
                const tile = TILES[d % TILES.length];
                const isCorrectTile = phase !== 'answering' && orig === q.correctAnswer;
                const isWrongTile = (phase !== 'answering' && orig === chosen && orig !== q.correctAnswer) || orig === firstWrong;
                const locked = phase !== 'answering' || orig === firstWrong || examChosen;
                const examPick = examChosen && orig === chosen;
                return (
                  <button
                    key={`${orig}`}
                    ref={el => { tileRefs.current[orig] = el; }}
                    type="button"
                    role="radio"
                    aria-checked={orig === chosen}
                    onClick={() => !locked && answer(orig)}
                    disabled={locked}
                    style={{ backgroundColor: isCorrectTile ? '#16A34A' : isWrongTile ? '#DC2626' : tile.color }}
                    className={clsx(
                      'group relative rounded-2xl p-4 sm:p-5 text-white flex items-center lg:flex-col lg:justify-start lg:pt-8 gap-3 lg:gap-5 text-left lg:text-center',
                      'min-h-[76px] sm:min-h-[120px] lg:min-h-[260px] transition-[transform,opacity,filter] duration-200',
                      !locked && 'hover:-translate-y-1 hover:brightness-110 active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-lime-400',
                      isCorrectTile && clsx('z-10', finalCorrect ? 'fx-tile-win' : 'fx-tile-hint'),
                      isWrongTile && 'fx-tile-break',
                      orig === firstWrong && phase === 'answering' && 'opacity-60',
                      examChosen && (examPick ? 'ring-4 ring-white scale-[1.02] z-10' : 'opacity-40')
                    )}
                  >
                    <span
                      key={`${currentIndex}-${orig}`}
                      style={{ animationDelay: `${d * 70}ms` }}
                      className={clsx(
                        'letra-opcion shrink-0 w-12 h-12 lg:w-16 lg:h-16 rounded-full grid place-items-center',
                        'bg-white text-[22px] lg:text-[30px] font-display font-extrabold shadow-[0_4px_0_rgba(0,0,0,0.25)]',
                        false
                      )}
                      aria-hidden
                    >
                      <span style={{ color: isCorrectTile ? '#16A34A' : isWrongTile ? '#DC2626' : tile.color }}>
                        {isCorrectTile ? <Check className="w-7 h-7 lg:w-8 lg:h-8" strokeWidth={3.5} /> : isWrongTile ? <X className="w-7 h-7 lg:w-8 lg:h-8" strokeWidth={3.5} /> : String.fromCharCode(65 + d)}
                      </span>
                    </span>
                    {isCorrectTile && finalCorrect && PARTICLES.map((p, k) => (
                      <span
                        key={`${fx?.id ?? 0}-${k}`}
                        className="fx-particle"
                        aria-hidden
                        style={{ ['--a' as string]: `${p.a}deg`, ['--d' as string]: `${p.d}px`, animationDelay: `${p.delay}ms` }}
                      >
                        {p.star
                          ? <span className="block text-[18px] leading-none" style={{ color: p.color }}>★</span>
                          : <span className="block w-2 h-3 rounded-sm" style={{ background: p.color }} />}
                      </span>
                    ))}
                    <span className="flex-1 lg:flex-none min-w-0 text-[17px] sm:text-[18px] lg:text-[19px] font-semibold leading-snug break-words">
                      <span className="sr-only">{String.fromCharCode(65 + d)}: </span>
                      <span dangerouslySetInnerHTML={{ __html: q.options[orig] }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* ===== Barra inferior ===== */}
      {phase === 'answering' ? (
        <footer className="fixed bottom-0 inset-x-0 z-30 bg-jungle-900/95 border-t border-white/10">
          <div className="max-w-[1200px] mx-auto px-3 sm:px-5 h-[72px] flex items-center gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-10 h-10 shrink-0 rounded-full bg-lime-400 text-jungle-900 grid place-items-center font-display font-extrabold">
                {studentName.charAt(0)}
              </span>
              <span className="hidden sm:block text-sm font-semibold truncate max-w-[160px]">{studentName}</span>
            </div>
            <div className="flex-1" />
            {examMode && !isRedemption && (
              <span className="text-[13px] text-white/60 text-right">Modo examen · verás tus resultados al final</span>
            )}
            {prefs.powerups && !isRedemption && !examMode && (
              <div className="flex items-center gap-1.5 sm:gap-2" aria-label="Potenciadores">
                <PowerButton icon={<GameIcon name="cincuenta" className="w-7 h-7" />} label="50/50" tip="Oculta 2 alternativas incorrectas" used={used.has('fifty')} onClick={() => applyPowerUp('fifty')} />
                <PowerButton icon={<GameIcon name="pista" className="w-7 h-7" />} label="Pista" tip={hint ? 'Muestra el subtema exacto de la pregunta' : 'Esta pregunta no tiene subtema registrado'} used={used.has('hint')} disabled={!hint} onClick={() => applyPowerUp('hint')} />
                <PowerButton icon={<GameIcon name="segunda" className="w-7 h-7" />} label="2ª vez" tip="Si fallas, otro intento sin perder la racha (vale la mitad)" used={used.has('second')} active={secondArmed} onClick={() => applyPowerUp('second')} />
                <PowerButton icon={<GameIcon name="doble" className="w-7 h-7" />} label="x2" tip="La siguiente correcta vale el doble" used={used.has('double')} active={doubleArmed} onClick={() => applyPowerUp('double')} />
              </div>
            )}
          </div>
        </footer>
      ) : phase === 'result' ? (
        <footer
          className={clsx(
            'fixed bottom-0 inset-x-0 z-30 motion-safe:animate-slide-up',
            finalCorrect ? 'bg-correct' : 'bg-wrong'
          )}
          aria-live="polite"
        >
          <div className="max-w-[1200px] mx-auto px-3 sm:px-5 h-[72px] flex items-center gap-3">
            <span className="w-10 h-10 shrink-0 rounded-full bg-white/20 grid place-items-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {finalCorrect
                  ? <path className="fx-draw" d="M5 12.5l4.5 4.5L19 7.5" />
                  : <path className="fx-draw" d="M7 7l10 10M17 7L7 17" />}
              </svg>
            </span>
            <p className="flex-1 min-w-0 font-display font-extrabold uppercase tracking-[0.02em] text-[18px] sm:text-[22px] truncate">
              {finalCorrect
                ? '¡Correcto!'
                : timedOut
                  ? '¡Se acabó el tiempo!'
                  : <span className="normal-case">Casi… la respuesta era {correctLetter}</span>}
              {finalCorrect && lastGain > 0 && <span className="num font-sans normal-case"> +{lastGain}</span>}
              {finalCorrect && streak > 1 && !isRedemption && <span className="num font-sans normal-case text-white/85 text-base"> · racha {streak} 🔥</span>}
            </p>
            <button type="button" onClick={continueFromResult} autoFocus className="btn shrink-0 bg-white text-ink hover:bg-paper">
              {needExplain(recordedCorrect) ? 'Ver explicación' : 'Siguiente'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </footer>
      ) : (
        <footer className="fixed bottom-0 inset-x-0 z-30 bg-jungle-900/95 border-t border-white/10">
          <div className="max-w-[760px] mx-auto px-3 sm:px-5 h-[76px] flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPhase('result')}
              className="w-12 h-12 shrink-0 grid place-items-center rounded-full border border-white/25 hover:bg-white/10"
              aria-label="Volver a la pregunta"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={goNext}
              autoFocus
              className="btn flex-1 min-h-[52px] text-[17px] bg-lime-400 text-jungle-900 hover:bg-lime-500 focus-visible:ring-offset-jungle-900"
            >
              Siguiente <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </footer>
      )}

      {fx?.fly && (
        <span
          key={`fly-${fx.id}`}
          className="fx-fly num font-display font-extrabold text-[30px] text-lime-400 [text-shadow:0_3px_0_rgba(11,33,31,0.6)]"
          style={{ left: fx.fly.x, top: fx.fly.y, ['--dx' as string]: `${fx.fly.dx}px`, ['--dy' as string]: `${fx.fly.dy}px` }}
          aria-hidden
        >
          +{fx.fly.gain}
        </span>
      )}
      {fx && fx.kind !== 'win' && <div key={`vig-${fx.id}`} className="fx-vignette" aria-hidden />}
      {fx && phase !== 'explain' && (
        <img
          key={`masc-${fx.id}`}
          src={mascota(fx.kind === 'win' ? 'celebra' : 'anima')}
          alt=""
          aria-hidden
          draggable={false}
          className="fx-peek fixed right-2 sm:right-8 bottom-[72px] z-40 w-24 h-24 sm:w-32 sm:h-32 object-contain pointer-events-none drop-shadow-[0_8px_12px_rgba(0,0,0,0.35)]"
        />
      )}

      {zoomSrc && (
        <div className="fixed inset-0 z-[70] bg-black/85 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setZoomSrc(null)} role="dialog" aria-modal="true" aria-label="Imagen ampliada">
          <img src={zoomSrc} alt="Imagen ampliada" className="max-w-full max-h-full rounded-xl bg-white" />
          <button type="button" className="absolute top-4 right-4 w-11 h-11 grid place-items-center rounded-full bg-white text-ink" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Piezas
// ============================================
function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-paper cursor-pointer">
      <span className="flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        <span className="block text-[13px] text-muted">{hint}</span>
      </span>
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative w-12 h-7 rounded-full bg-line peer-checked:bg-jungle-800 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-jungle-600 after:content-[''] after:absolute after:top-1 after:left-1 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

function PowerButton({
  icon, label, tip, used, active = false, disabled = false, onClick
}: { icon: ReactNode; label: string; tip: string; used: boolean; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={used || disabled}
      title={used && !active ? `${tip} (ya usado)` : tip}
      aria-label={`${label}: ${tip}${used ? ' (usado)' : ''}`}
      className={clsx(
        'relative w-14 sm:w-16 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors',
        active
          ? 'bg-lime-400 text-jungle-900 ring-2 ring-white'
          : used || disabled
            ? 'bg-white/5 text-white/30 cursor-not-allowed grayscale opacity-50'
            : 'bg-white/10 text-white hover:bg-white/20'
      )}
    >
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  );
}

function ChallengeBanner({ points, compact = false, className }: { points: number; compact?: boolean; className?: string }) {
  return (
    <div className={clsx('rounded-2xl bg-[#7C3AED] text-white flex items-center gap-3', compact ? 'px-3 py-2 text-sm' : 'px-4 py-3', className)}>
      <Swords className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
      <p className="font-semibold">
        Tu amigo hizo <span className="num">{points}</span> puntos, ¡supéralo!
      </p>
    </div>
  );
}

// ============================================
// Pantalla final
// ============================================
interface SummaryProps {
  examId: string;
  courseName: string;
  pct: number;
  correct: number;
  total: number;
  points: number;
  bestStreak: number;
  avgTime: number | null;
  failed: { q: BanqueoQuestion; i: number; state?: QuestionState }[];
  redeemed: { ok: number; total: number } | null;
  reto: number;
  confetti: { left: string; delay: string; duration: string; drift: string; color: string }[] | null;
  onRepeat: () => void;
  onOther: () => void;
  onCards: () => void;
  review: { q: BanqueoQuestion; i: number; state?: QuestionState }[];
  examMode: boolean;
  nuevas: { count: number; scope: string; onGo: () => void } | null;
  starting: boolean;
  repeatLabel: string;
}

function SummaryScreen({
  examId, courseName, pct, correct, total, points, bestStreak, avgTime, failed, redeemed, reto, confetti,
  onRepeat, onOther, onCards, review, examMode, nuevas, starting, repeatLabel
}: SummaryProps) {
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const shownPct = useCountUp(ready ? pct : 0, 900);
  const shownPoints = useCountUp(ready ? points : 0, 1100);
  useEffect(() => {
    if (ready && shownPoints > 0 && shownPoints < points) sonido.blip();
  }, [ready, shownPoints, points]);

  const r = 52;
  const c = 2 * Math.PI * r;
  const ringColor = pct >= 70 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';
  const title = pct >= 90 ? '¡Impecable!' : pct >= 70 ? '¡Muy bien!' : pct >= 50 ? 'Vas por buen camino' : 'A seguir practicando';

  const challengeUrl = `${window.location.origin}${import.meta.env.BASE_URL}banqueo/practica/${encodeURIComponent(courseName)}?examen=${encodeURIComponent(examId)}&reto=${points}`;
  const shareText = `Hice ${points} puntos en el banqueo de ${courseName} (${examId.toUpperCase()}) en SINAPSIS. ¿Me superas? ${challengeUrl}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(challengeUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copia este enlace:', challengeUrl);
    }
  };

  return (
    <div className="relative min-h-screen bg-dots overflow-hidden px-3 sm:px-5 py-8 sm:py-12">
      {confetti && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {confetti.map((p, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{ left: p.left, backgroundColor: p.color, animationDelay: p.delay, animationDuration: p.duration, ['--drift' as string]: p.drift }}
            />
          ))}
        </div>
      )}

      <div className="relative max-w-[560px] mx-auto">
        <div className="bg-white text-ink rounded-3xl p-6 sm:p-8 motion-safe:animate-slide-up">
          <img
            src={mascota(pct >= 70 ? 'celebra' : pct >= 50 ? 'piensa' : 'anima')}
            alt=""
            aria-hidden
            draggable={false}
            className="w-32 h-32 sm:w-40 sm:h-40 mx-auto -mt-20 sm:-mt-24 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.25)] fx-mascot-in"
          />
          <p className="meta text-center mt-2">{examId.toUpperCase()} · Banqueo · {courseName}</p>

          <h1 className="title-screen text-[26px] sm:text-[30px] text-center mt-1">{title}</h1>

          <div className="relative w-40 h-40 mx-auto mt-6">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r={r} fill="none" stroke="#E2E8E6" strokeWidth="10" />
              <circle cx="60" cy="60" r={r} fill="none" stroke={ringColor} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - shownPct / 100)} />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="num font-display font-extrabold text-[40px] leading-none">{shownPct}%</p>
                <p className="text-xs text-muted mt-1 num">{correct} de {total}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            <Kpi label="Puntos" value={<span className="text-jungle-800">{shownPoints}</span>} />
            <Kpi label="Mejor racha" value={<>{bestStreak} <span aria-hidden>🔥</span></>} />
            <Kpi label="Prom. / preg." value={avgTime === null ? '—' : `${avgTime}s`} />
          </div>

          {redeemed && (
            <p className="mt-4 rounded-xl bg-paper px-4 py-2.5 text-sm text-ink num flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-wrong" /> Redención: recuperaste <strong>{redeemed.ok}</strong> de {redeemed.total}
            </p>
          )}

          {reto > 0 && (
            <div className={clsx('mt-4 rounded-xl px-4 py-3 flex items-center gap-3 font-semibold', points > reto ? 'bg-correct-bg text-correct' : points === reto ? 'bg-warning-bg text-warning' : 'bg-wrong-bg text-wrong')}>
              <GameIcon name="trofeo" className="w-7 h-7 shrink-0" />
              <span className="num">
                {points > reto ? `¡Superaste a tu amigo! ${points} vs ${reto}` : points === reto ? `¡Empate! ${points} puntos` : `Tu amigo gana esta: ${reto} vs ${points}`}
              </span>
            </div>
          )}

          {nuevas && (
            <div className="mt-5 rounded-2xl bg-jungle-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="flex-1 text-sm text-jungle-800">
                {nuevas.count > 0
                  ? <>Te faltan <strong className="num">{nuevas.count}</strong> {nuevas.count === 1 ? 'pregunta nueva' : 'preguntas nuevas'} {nuevas.scope}.</>
                  : <>¡Ya viste todas las preguntas {nuevas.scope}! Ahora toca repasar las vencidas.</>}
              </p>
              {nuevas.count > 0 && (
                <button type="button" onClick={nuevas.onGo} disabled={starting} className="btn-primary shrink-0 min-h-[40px] py-2">
                  {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Seguir con las nuevas
                </button>
              )}
            </div>
          )}

          <div className="mt-7">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="label-section">
                {examMode ? `Revisión (${review.length})` : failed.length > 0 ? `Para repasar (${failed.length})` : 'Para repasar'}
              </p>
              {failed.length > 0 && (
                <button type="button" onClick={onCards} className="inline-flex items-center gap-1.5 text-sm font-semibold text-jungle-600 hover:text-jungle-800">
                  <Layers className="w-4 h-4" /> Repasar como fichas
                </button>
              )}
            </div>
            {review.length === 0 ? (
              <p className="text-sm text-muted rounded-xl bg-paper px-4 py-3">No fallaste ninguna. 🎯</p>
            ) : (
              <ul className="divide-y divide-line border border-line rounded-2xl overflow-hidden">
                {review.map(({ q, i, state }) => (
                  <li key={q.id ?? i}>
                    <details className="group">
                      <summary className="list-none cursor-pointer px-4 py-3 flex items-start gap-3 hover:bg-paper">
                        <span className={clsx('num shrink-0 w-7 h-7 rounded-full text-xs font-bold grid place-items-center', state?.isCorrect ? 'bg-correct-bg text-correct' : 'bg-wrong-bg text-wrong')}>{i + 1}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-ink line-clamp-2">{stripHtml(q.questionText)}</span>
                          <span className="block text-xs text-muted mt-0.5">
                            Respuesta: <strong className="text-correct">{String.fromCharCode(65 + q.correctAnswer)}</strong>
                            {' · '}
                            {state?.selectedOption == null ? 'sin responder' : <>marcaste <strong className={state.isCorrect ? 'text-correct' : 'text-wrong'}>{String.fromCharCode(65 + state.selectedOption)}</strong></>}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-subtle mt-1.5 shrink-0 transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="px-4 pb-4 pl-14 text-sm leading-relaxed text-ink">
                        {q.justification ? <div dangerouslySetInnerHTML={{ __html: q.justification }} /> : <p className="text-muted">Sin justificación escrita.</p>}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            <button onClick={onRepeat} className="btn-primary w-full">
              <RefreshCw className="w-5 h-5" /> {repeatLabel}
            </button>
            <button onClick={onOther} className="btn-secondary w-full">
              <LayoutGrid className="w-5 h-5" /> Otro curso
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-line">
            <p className="label-section mb-2 flex items-center gap-1.5"><Swords className="w-3.5 h-3.5" /> Desafía a un amigo</p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full"
              >
                <Share2 className="w-4 h-4" /> WhatsApp
              </a>
              <button type="button" onClick={copyLink} className="btn-secondary w-full">
                {copied ? <Check className="w-4 h-4 text-correct" /> : <Link2 className="w-4 h-4" />}
                {copied ? 'Copiado' : 'Copiar enlace'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line px-2 py-3 text-center">
      <p className="num font-display font-extrabold text-xl sm:text-2xl leading-none">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mt-1.5">{label}</p>
    </div>
  );
}
