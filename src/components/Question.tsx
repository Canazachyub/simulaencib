import { Check, X, FileText } from 'lucide-react';
import type { Question as QuestionType } from '../types';
import { indexToLetter, formatPoints } from '../utils/calculations';
import clsx from 'clsx';

/**
 * REGLAS DE FORMATO PARA EL TEXTO DE LAS PREGUNTAS:
 *
 * En tus celdas de Google Sheets puedes usar:
 *
 * 1. SALTOS DE LÍNEA:
 *    - Usa <br> o presiona Alt+Enter en la celda
 *    - Ejemplo: "Primera línea<br>Segunda línea"
 *
 * 2. NEGRITA:
 *    - Usa <b>texto</b>
 *    - Ejemplo: "El valor de <b>x</b> es igual a..."
 *
 * 3. SUBRAYADO:
 *    - Usa <u>texto</u>
 *    - Ejemplo: "Encuentra <u>la respuesta correcta</u>"
 *
 * 4. RESALTADO/SOMBREADO:
 *    - Usa <mark>texto</mark>
 *    - Ejemplo: "El resultado es <mark>42</mark>"
 *
 * 5. CURSIVA/ITÁLICA:
 *    - Usa <i>texto</i>
 *    - Ejemplo: "Según el <i>teorema de Pitágoras</i>..."
 *
 * 6. COMBINACIONES:
 *    - Puedes combinar: <b><u>texto negrita y subrayado</u></b>
 *    - Ejemplo: "I. <mark>b∈A</mark> II. <b>{b, c} ⊂ A</b>"
 */

// Función para parsear el texto con formato HTML básico
export function parseFormattedText(text: unknown): string {
  // Manejar valores null, undefined, o no-string
  if (text === null || text === undefined) return '';

  // Convertir a string si no lo es
  const textStr = typeof text === 'string' ? text : String(text);

  if (!textStr) return '';

  // Permitir solo tags seguros
  const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'mark', 'br', 'sub', 'sup'];

  // Escapar todo excepto los tags permitidos
  let result = textStr
    // Convertir saltos de línea a <br>
    .replace(/\n/g, '<br>')
    // Agregar clase al mark para el resaltado amarillo
    .replace(/<mark>/gi, '<mark class="bg-warning-bg text-ink px-0.5 rounded">')
    // Limpiar tags no permitidos
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
      return allowedTags.includes(tag.toLowerCase()) ? match : '';
    });

  return result;
}

// Componente para renderizar texto formateado
export function FormattedText({ text, className }: { text: string; className?: string }) {
  const formattedHtml = parseFormattedText(text);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: formattedHtml }}
    />
  );
}

interface QuestionProps {
  question: QuestionType;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: number | null;
  showFeedback: boolean;
  isCorrect: boolean | null;
  onSelectAnswer: (index: number) => void;
}

// ============================================
// Enunciado. "large" = modo examen (19-20 px / 1.7); la imagen se puede ampliar.
// ============================================
interface QuestionStemProps {
  question: QuestionType;
  large?: boolean;
  onImageClick?: (src: string) => void;
}

export function QuestionStem({ question, large = false, onImageClick }: QuestionStemProps) {
  const img = question.imageLink;
  return (
    <div>
      <div
        className={clsx(
          'text-ink',
          large ? 'text-[18px] sm:text-[19px] lg:text-[20px] leading-[1.7]' : 'text-[17px] leading-[1.65] max-w-[68ch]'
        )}
      >
        <FormattedText text={question.questionText} />
      </div>

      {img && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => onImageClick?.(img)}
            disabled={!onImageClick}
            className={clsx('block max-w-full rounded-control', onImageClick && 'cursor-zoom-in')}
            aria-label={onImageClick ? 'Ampliar imagen' : undefined}
          >
            <img
              src={img}
              alt="Imagen de la pregunta"
              className="max-w-full h-auto rounded-control border border-line"
              style={{ maxHeight: '360px' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </button>
        </div>
      )}

      {question.sourceFile && (
        <p className="mt-5 inline-flex items-center gap-1.5 meta">
          <FileText className="w-3.5 h-3.5" />
          Tomado en: {question.sourceFile}
        </p>
      )}
    </div>
  );
}

// ============================================
// Alternativas del simulacro (tarjetas 56 px, tachado estilo UWorld)
// ============================================
interface ExamOptionsProps {
  question: QuestionType;
  selectedAnswer: number | null;
  struck: Set<number>;
  onSelectAnswer: (index: number) => void;
  onToggleStrike: (index: number) => void;
}

export function ExamOptions({ question, selectedAnswer, struck, onSelectAnswer, onToggleStrike }: ExamOptionsProps) {
  return (
    <div role="radiogroup" aria-label="Alternativas" className="space-y-2.5">
      {question.options.map((option, index) => {
        const letter = indexToLetter(index);
        const selected = selectedAnswer === index;
        const isStruck = struck.has(index);
        return (
          <div key={index} className="group relative">
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelectAnswer(index)}
              onContextMenu={(e) => {
                e.preventDefault();
                onToggleStrike(index);
              }}
              className={clsx(
                'w-full min-h-12 sm:min-h-14 pl-3 pr-12 py-3 rounded-[14px] border text-left flex items-center gap-3.5',
                'text-[16px] sm:text-[17px] font-medium leading-snug transition-colors duration-150',
                selected
                  ? 'bg-jungle-800 border-jungle-800 text-white motion-safe:animate-pick'
                  : 'bg-white border-line text-ink hover:border-jungle-600 hover:bg-jungle-50',
                isStruck && !selected && 'opacity-40'
              )}
            >
              <span
                className={clsx(
                  'shrink-0 w-8 h-8 rounded-full grid place-items-center text-sm font-bold transition-colors',
                  selected ? 'bg-lime-400 text-jungle-900' : 'bg-paper border border-line text-muted group-hover:border-jungle-600 group-hover:text-jungle-800'
                )}
              >
                {letter}
              </span>
              <span className={clsx('flex-1', isStruck && 'line-through decoration-2')}>
                <FormattedText text={option} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => onToggleStrike(index)}
              aria-pressed={isStruck}
              aria-label={isStruck ? `Quitar tachado de la ${letter}` : `Tachar la ${letter}`}
              title={isStruck ? 'Quitar tachado' : 'Tachar (clic derecho)'}
              className={clsx(
                'absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-full transition-opacity',
                selected ? 'text-white/70 hover:bg-white/10' : 'text-subtle hover:text-ink hover:bg-paper',
                isStruck ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100'
              )}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Alternativas como botones-fila (DESIGN.md 6.3)
// ============================================
interface AnswerOptionsProps {
  question: QuestionType;
  selectedAnswer: number | null;
  showFeedback?: boolean;
  onSelectAnswer: (index: number) => void;
  /** Muestra la pista de atajos de teclado */
  showShortcutHint?: boolean;
}

export function AnswerOptions({
  question,
  selectedAnswer,
  showFeedback = false,
  onSelectAnswer,
  showShortcutHint = false
}: AnswerOptionsProps) {
  return (
    <div>
      <div role="radiogroup" aria-label="Alternativas" className="space-y-2">
        {question.options.map((option, index) => {
          const letter = indexToLetter(index);
          const isSelected = selectedAnswer === index;
          const isCorrectAnswer = question.correctAnswer === index;

          let state: 'default' | 'selected' | 'correct' | 'incorrect' | 'dimmed' = 'default';
          if (showFeedback) {
            if (isCorrectAnswer) state = 'correct';
            else if (isSelected) state = 'incorrect';
            else state = 'dimmed';
          } else if (isSelected) {
            state = 'selected';
          }

          return (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectAnswer(index)}
              disabled={showFeedback}
              className={clsx(
                'w-full min-h-12 px-4 py-3 rounded-control border text-left flex items-start gap-3 text-[16px] font-medium leading-snug',
                state === 'default' && 'bg-white border-line text-ink hover:bg-paper',
                state === 'selected' && 'bg-jungle-800 border-jungle-800 text-white',
                state === 'correct' && 'fill-correct border-correct text-white',
                state === 'incorrect' && 'bg-wrong-bg border-wrong text-ink',
                state === 'dimmed' && 'bg-white border-line text-ink opacity-50',
                showFeedback && 'cursor-default'
              )}
            >
              <span
                className={clsx(
                  'shrink-0 w-7 h-7 rounded-full grid place-items-center text-[13px] font-semibold',
                  state === 'default' && 'border border-line text-muted',
                  state === 'selected' && 'bg-lime-400 text-jungle-900',
                  state === 'correct' && 'bg-white text-correct',
                  state === 'incorrect' && 'bg-wrong text-white',
                  state === 'dimmed' && 'border border-line text-muted'
                )}
              >
                {state === 'correct' ? <Check className="w-4 h-4" /> : state === 'incorrect' ? <X className="w-4 h-4" /> : letter}
              </span>
              <span className="flex-1 pt-0.5">
                <FormattedText text={option} />
              </span>
            </button>
          );
        })}
      </div>
      {showShortcutHint && (
        <p className="hidden lg:block mt-3 text-xs text-subtle">
          Teclado: <kbd className="font-sans font-semibold text-muted">A–{indexToLetter(question.options.length - 1)}</kbd> o{' '}
          <kbd className="font-sans font-semibold text-muted">1–{question.options.length}</kbd> eligen ·{' '}
          <kbd className="font-sans font-semibold text-muted">Enter</kbd> siguiente ·{' '}
          <kbd className="font-sans font-semibold text-muted">← →</kbd> navegar
        </p>
      )}
    </div>
  );
}

// ============================================
// Pregunta completa (enunciado + alternativas + feedback). Se mantiene por compatibilidad.
// ============================================
export function Question({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  showFeedback,
  isCorrect,
  onSelectAnswer
}: QuestionProps) {
  return (
    <div className="max-w-[700px]">
      <p className="label-section mb-2">{question.subject}</p>
      <h2 className="title-screen text-[28px] mb-5 num">
        Pregunta {questionNumber} / {totalQuestions}
      </h2>
      <QuestionStem question={question} />
      <div className="mt-6">
        <AnswerOptions
          question={question}
          selectedAnswer={selectedAnswer}
          showFeedback={showFeedback}
          onSelectAnswer={onSelectAnswer}
        />
      </div>

      {showFeedback && (
        <div
          className={clsx(
            'mt-4 p-4 rounded-control border flex items-center gap-3 text-[15px] font-medium',
            isCorrect ? 'bg-correct-bg border-correct/30 text-ink' : 'bg-wrong-bg border-wrong/30 text-ink'
          )}
        >
          {isCorrect ? (
            <>
              <Check className="w-5 h-5 text-correct" />
              Correcto. +{formatPoints(question.points)} {question.points === 1 ? 'punto' : 'puntos'}
            </>
          ) : (
            <>
              <X className="w-5 h-5 text-wrong" />
              {selectedAnswer === null ? 'Sin respuesta. ' : 'Incorrecto. '}
              La respuesta correcta es la {indexToLetter(question.correctAnswer)}.
            </>
          )}
        </div>
      )}
    </div>
  );
}
