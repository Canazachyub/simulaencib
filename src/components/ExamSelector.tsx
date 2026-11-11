import { CheckCircle, Clock, FileText, Award } from 'lucide-react';
import clsx from 'clsx';
import type { ExamMeta } from '../types';
import { formatDurationShort } from '../utils/calculations';

interface ExamSelectorProps {
  exams: ExamMeta[];
  selectedId: string;
  onSelect: (examId: string) => void;
  /** 'dark' = sobre fondo de color (hero); 'light' = sobre fondo claro */
  variant?: 'dark' | 'light';
}

/**
 * Tarjetas para elegir el examen. No se muestra si solo hay un examen disponible.
 */
export function ExamSelector({ exams, selectedId, onSelect, variant = 'dark' }: ExamSelectorProps) {
  if (exams.length <= 1) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {exams.map((exam) => {
        const selected = exam.id === selectedId;
        const disabled = !exam.available;
        return (
          <button
            key={exam.id}
            type="button"
            onClick={() => !disabled && onSelect(exam.id)}
            disabled={disabled}
            aria-pressed={selected}
            title={disabled ? 'Próximamente' : undefined}
            className={clsx(
              'relative text-left rounded-xl p-3 md:p-4 transition-all duration-200 border-2',
              disabled && 'opacity-60 cursor-not-allowed',
              variant === 'dark'
                ? selected
                  ? 'bg-white text-cyan-800 border-white shadow-xl'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-sm'
                : selected
                  ? 'bg-cyan-50 text-cyan-800 border-cyan-500 shadow-md'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50'
            )}
          >
            {selected && (
              <CheckCircle
                className={clsx(
                  'absolute top-2 right-2 w-4 h-4',
                  variant === 'dark' ? 'text-cyan-600' : 'text-cyan-600'
                )}
              />
            )}
            <p className="font-bold text-sm md:text-base leading-tight pr-5">{exam.nombre}</p>
            {disabled && (
              <span
                className={clsx(
                  'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  variant === 'dark' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                )}
              >
                Próximamente
              </span>
            )}
            <div
              className={clsx(
                'mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs',
                variant === 'dark' && !selected ? 'text-cyan-100' : 'text-slate-500'
              )}
            >
              {exam.totalQuestions > 0 && (
                <span className="inline-flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {exam.totalQuestions} preg.
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDurationShort(exam.durationMinutes)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Award className="w-3 h-3" />
                0-{exam.scaleMax}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
