/**
 * Herramientas de estudio compartidas (solo interfaz, nada se envía a la API):
 * fichas de estudio con mazo personal en localStorage, lectura en voz alta y mini gráfico.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { RotateCw, X, Check, Repeat2, Volume2, Square } from 'lucide-react';
import clsx from 'clsx';

export function stripHtml(html: unknown): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================
// Fichas de estudio (mazo personal por examen)
// ============================================
export interface StudyCard {
  id: string;
  course: string;
  front: string; // enunciado (texto plano)
  answer: string; // "C) texto de la alternativa"
  justification?: string | null; // HTML
}

const deckKey = (examId: string) => `sinapsis_fichas_${examId.toLowerCase()}`;

export function readDeck(examId: string): StudyCard[] {
  try {
    const raw = localStorage.getItem(deckKey(examId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeDeck(examId: string, cards: StudyCard[]) {
  try {
    localStorage.setItem(deckKey(examId), JSON.stringify(cards.slice(-300)));
  } catch {
    // sin espacio: se ignora
  }
}

/** Construye una ficha a partir de una pregunta con alternativas e índice correcto. */
export function toCard(q: {
  id?: string; number?: number; questionText: string; options: string[]; correctAnswer: number;
  justification?: string | null; subject?: string;
}, course?: string): StudyCard {
  const letter = String.fromCharCode(65 + q.correctAnswer);
  return {
    id: String(q.id ?? q.number ?? stripHtml(q.questionText).slice(0, 60)),
    course: course || q.subject || '',
    front: stripHtml(q.questionText),
    answer: `${letter}) ${stripHtml(q.options[q.correctAnswer])}`,
    justification: q.justification ?? null,
  };
}

interface FlashcardReviewProps {
  examId: string;
  cards: StudyCard[];
  title?: string;
  onClose: () => void;
}

/** Vista de fichas que giran. "Repasar" guarda la ficha en el mazo; "Lo sé" la quita. */
export function FlashcardReview({ examId, cards, title = 'Fichas de estudio', onClose }: FlashcardReviewProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [review, setReview] = useState(0);
  const done = index >= cards.length;
  const card = cards[index];

  const mark = useCallback((knowIt: boolean) => {
    if (!card) return;
    const deck = readDeck(examId).filter(c => c.id !== card.id);
    writeDeck(examId, knowIt ? deck : [...deck, card]);
    if (knowIt) setKnown(k => k + 1);
    else setReview(r => r + 1);
    setFlipped(false);
    setIndex(i => i + 1);
  }, [card, examId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (done) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f); }
      else if (flipped && (e.key === 'ArrowRight' || e.key === '1')) mark(true);
      else if (flipped && (e.key === 'ArrowLeft' || e.key === '2')) mark(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, flipped, mark, onClose]);

  return (
    <div className="fixed inset-0 z-[80] bg-jungle-900/95 text-white flex flex-col motion-safe:animate-fade-in" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-w-[720px] w-full mx-auto px-4 h-16 flex items-center gap-3">
        <p className="flex-1 font-display font-extrabold uppercase tracking-[0.02em] truncate">{title}</p>
        {!done && <span className="num text-sm font-semibold text-white/70">{index + 1} / {cards.length}</span>}
        <button type="button" onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/10" aria-label="Cerrar fichas">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="max-w-[720px] w-full mx-auto px-4">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-lime-400 transition-[width] duration-200" style={{ width: `${cards.length ? (Math.min(index, cards.length) / cards.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] mx-auto px-4 py-6">
          {done ? (
            <div className="bg-white text-ink rounded-3xl p-8 text-center motion-safe:animate-slide-up">
              <p className="font-display font-extrabold uppercase text-2xl text-jungle-800">Mazo terminado</p>
              <p className="mt-3 text-muted num">
                <strong className="text-correct">{known}</strong> lo sé · <strong className="text-warning">{review}</strong> para repasar
              </p>
              <p className="mt-2 text-sm text-muted">Las fichas para repasar quedan en <strong>Mis fichas</strong> de este examen.</p>
              <button type="button" onClick={onClose} className="btn-primary mt-6">Listo</button>
            </div>
          ) : card ? (
            <>
              <button
                type="button"
                onClick={() => setFlipped(f => !f)}
                className="block w-full [perspective:1200px] text-left"
                aria-label={flipped ? 'Ver el frente de la ficha' : 'Girar la ficha para ver la respuesta'}
              >
                <div
                  className="relative min-h-[340px] transition-transform duration-300 [transform-style:preserve-3d] motion-reduce:transition-none"
                  style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}
                >
                  <div className="absolute inset-0 bg-white text-ink rounded-3xl p-6 sm:p-8 flex flex-col [backface-visibility:hidden]">
                    <span className="self-start inline-flex items-center h-7 px-3 rounded-full bg-jungle-100 text-jungle-800 text-[13px] font-semibold">
                      {card.course || 'Pregunta'}
                    </span>
                    <p className="mt-5 text-[18px] sm:text-[20px] leading-relaxed line-clamp-[9]">{card.front}</p>
                    <span className="mt-auto pt-4 inline-flex items-center gap-1.5 text-sm text-muted">
                      <RotateCw className="w-4 h-4" /> Toca para girar
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-white text-ink rounded-3xl p-6 sm:p-8 flex flex-col overflow-y-auto [backface-visibility:hidden] [transform:rotateY(180deg)]">
                    <p className="label-section">Respuesta correcta</p>
                    <p className="mt-2 text-[19px] sm:text-[21px] font-semibold text-correct leading-snug">{card.answer}</p>
                    {card.justification && (
                      <div className="mt-4 pt-4 border-t border-line text-[15px] leading-relaxed text-ink"
                        dangerouslySetInnerHTML={{ __html: card.justification }} />
                    )}
                  </div>
                </div>
              </button>

              <div className={clsx('mt-5 grid grid-cols-2 gap-3 transition-opacity', !flipped && 'opacity-40 pointer-events-none')}>
                <button type="button" onClick={() => mark(false)} className="btn min-h-[56px] bg-warning text-white hover:brightness-110">
                  <Repeat2 className="w-5 h-5" /> Repasar
                </button>
                <button type="button" onClick={() => mark(true)} className="btn min-h-[56px] bg-lime-400 text-jungle-900 hover:bg-lime-500">
                  <Check className="w-5 h-5" /> Lo sé
                </button>
              </div>
              {!flipped && <p className="mt-3 text-center text-xs text-white/60">Gira la ficha (toca o Espacio) para calificarte</p>}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Leer en voz alta (Web Speech API)
// ============================================
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let cachedVoice: SpeechSynthesisVoice | null | undefined;
function spanishVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined && cachedVoice !== null) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  cachedVoice =
    voices.find(v => /es[-_]PE/i.test(v.lang)) ||
    voices.find(v => /es[-_](ES|419|MX|US)/i.test(v.lang)) ||
    voices.find(v => /^es/i.test(v.lang)) ||
    null;
  return cachedVoice;
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

export function speak(text: string, onEnd?: () => void) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = spanishVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang || 'es-PE';
  u.rate = 1;
  if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
  window.speechSynthesis.speak(u);
}

/** Botón 🔊 que lee un texto; vuelve a tocarlo para detener. */
export function SpeakButton({ text, className, label = 'Leer en voz alta' }: { text: string; className?: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  useEffect(() => { setSpeaking(false); }, [text]);
  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (speaking) { stopSpeaking(); setSpeaking(false); }
        else { setSpeaking(true); speak(text, () => setSpeaking(false)); }
      }}
      aria-label={speaking ? 'Detener lectura' : label}
      title={speaking ? 'Detener lectura' : label}
      className={clsx('w-10 h-10 shrink-0 grid place-items-center rounded-full transition-colors', className)}
    >
      {speaking ? <Square className="w-4 h-4" fill="currentColor" /> : <Volume2 className="w-5 h-5" />}
    </button>
  );
}

// ============================================
// Mini gráfico de línea (sin librerías)
// ============================================
export function Sparkline({ values, max, height = 64, className }: { values: number[]; max: number; height?: number; className?: string }) {
  const w = 240;
  const pts = useMemo(() => {
    if (values.length === 0) return [];
    const step = values.length > 1 ? w / (values.length - 1) : 0;
    return values.map((v, i) => ({
      x: values.length > 1 ? i * step : w / 2,
      y: height - 6 - (Math.max(0, Math.min(max, v)) / (max || 1)) * (height - 12),
    }));
  }, [values, max, height]);
  if (pts.length === 0) return null;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`-6 0 ${w + 12} ${height}`} className={clsx('w-full', className)} style={{ height }} role="img" aria-label="Evolución de tus notas">
      <line x1="0" x2={w} y1={height - 6} y2={height - 6} stroke="#E2E8E6" />
      <path d={d} fill="none" stroke="#1F5B52" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4.5 : 2.5} fill={i === pts.length - 1 ? '#C2E476' : '#1F5B52'}
          stroke={i === pts.length - 1 ? '#10312D' : 'none'} strokeWidth="1.5" />
      ))}
      <title>{`Última: ${values[values.length - 1]}`}</title>
      <circle cx={last.x} cy={last.y} r="0" />
    </svg>
  );
}
