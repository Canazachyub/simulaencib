import { CheckCircle, XCircle } from 'lucide-react';
import type { Question as QuestionType } from '../types';
import { indexToLetter } from '../utils/calculations';
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
function parseFormattedText(text: unknown): string {
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
    .replace(/<mark>/gi, '<mark class="bg-yellow-200 px-0.5 rounded">')
    // Limpiar tags no permitidos
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tag) => {
      return allowedTags.includes(tag.toLowerCase()) ? match : '';
    });

  return result;
}

// Componente para renderizar texto formateado
function FormattedText({ text, className }: { text: string; className?: string }) {
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

// Función para obtener las clases de color según el índice y estado
function getOptionColorClasses(index: number, optionState: string): string {
  // Si tiene un estado especial, usar esos colores
  if (optionState === 'selected') {
    return 'bg-primary-600 text-white scale-110 shadow-lg';
  }
  if (optionState === 'correct') {
    return 'bg-emerald-500 text-white';
  }
  if (optionState === 'incorrect') {
    return 'bg-red-500 text-white';
  }

  // Colores Google para estado default - CLASES ESTÁTICAS
  const colors = [
    'bg-blue-500 text-white',      // A - Azul Google
    'bg-rose-500 text-white',      // B - Rojo/Rosa Google (cambiado de red a rose para diferenciarlo)
    'bg-amber-500 text-white',     // C - Amarillo/Ámbar Google
    'bg-green-500 text-white',     // D - Verde Google
    'bg-purple-500 text-white',    // E - Púrpura
  ];

  return colors[index] || 'bg-slate-500 text-white';
}

export function Question({
  question,
  questionNumber,
  selectedAnswer,
  showFeedback,
  isCorrect,
  onSelectAnswer
}: QuestionProps) {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Question Card */}
      <div className="card p-6 md:p-8 animate-slide-up">
        {/* Subject tag - mobile */}
        <div className="md:hidden mb-4">
          <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
            {question.subject}
          </span>
        </div>

        {/* Question text con soporte para formato */}
        <div className="mb-6">
          <h2 className="text-lg md:text-xl font-semibold text-slate-800 leading-relaxed">
            <span className="text-primary-600 mr-2">P{questionNumber}.</span>
            <FormattedText text={question.questionText} />
          </h2>
        </div>

        {/* Question image */}
        {question.imageLink && (
          <div className="mb-6">
            <img
              src={question.imageLink}
              alt="Imagen de la pregunta"
              className="max-w-full h-auto rounded-lg border border-slate-200 mx-auto"
              style={{ maxHeight: '300px' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Source file label */}
        {question.sourceFile && (
          <div className="mb-4 flex justify-end">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-xs font-medium border border-purple-200">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Tomado en: {question.sourceFile}
            </span>
          </div>
        )}

        {/* Options */}
        <div className="space-y-3">
          {question.options.map((option, index) => {
            const letter = indexToLetter(index);
            const isSelected = selectedAnswer === index;
            const isCorrectAnswer = question.correctAnswer === index;

            // Determinar el estado visual de la opción
            let optionState: 'default' | 'selected' | 'correct' | 'incorrect' = 'default';
            if (showFeedback) {
              if (isCorrectAnswer) {
                optionState = 'correct';
              } else if (isSelected && !isCorrectAnswer) {
                optionState = 'incorrect';
              }
            } else if (isSelected) {
              optionState = 'selected';
            }

            return (
              <button
                key={index}
                onClick={() => onSelectAnswer(index)}
                disabled={showFeedback}
                className={clsx(
                  'w-full p-4 rounded-xl border-2 text-left transition-all duration-200 flex items-start gap-4',
                  {
                    // Default state
                    'border-slate-200 hover:border-primary-300 hover:bg-primary-50':
                      optionState === 'default',
                    // Selected (before feedback)
                    'border-primary-500 bg-primary-50 shadow-md':
                      optionState === 'selected',
                    // Correct answer (after feedback)
                    'border-emerald-500 bg-emerald-50':
                      optionState === 'correct',
                    // Incorrect answer (after feedback)
                    'border-red-500 bg-red-50':
                      optionState === 'incorrect',
                    // Disabled state
                    'cursor-not-allowed opacity-75':
                      showFeedback && optionState === 'default'
                  }
                )}
              >
                {/* Letter indicator con colores Google */}
                <div
                  className={clsx(
                    'flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm transition-transform',
                    getOptionColorClasses(index, optionState)
                  )}
                >
                  {optionState === 'correct' ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : optionState === 'incorrect' ? (
                    <XCircle className="w-6 h-6" />
                  ) : (
                    letter
                  )}
                </div>

                {/* Option text con soporte para formato */}
                <span
                  className={clsx('flex-1 pt-2.5', {
                    'text-slate-700': optionState === 'default',
                    'text-primary-700 font-medium': optionState === 'selected',
                    'text-emerald-700 font-medium': optionState === 'correct',
                    'text-red-700': optionState === 'incorrect'
                  })}
                >
                  <FormattedText text={option} />
                </span>
              </button>
            );
          })}
        </div>

        {/* Feedback message */}
        {showFeedback && (
          <div
            className={clsx(
              'mt-6 p-4 rounded-xl flex items-center gap-3 animate-fade-in',
              {
                'bg-emerald-100 text-emerald-800': isCorrect,
                'bg-red-100 text-red-800': !isCorrect
              }
            )}
          >
            {isCorrect ? (
              <>
                <CheckCircle className="w-6 h-6 text-emerald-600" />
                <span className="font-medium">¡Correcto! +{question.points.toFixed(2)} puntos</span>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-red-600" />
                <span className="font-medium">
                  {selectedAnswer === null
                    ? 'Tiempo agotado. '
                    : 'Incorrecto. '}
                  La respuesta correcta es la opción {indexToLetter(question.correctAnswer)}.
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
