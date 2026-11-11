import { Lock } from 'lucide-react';
import { examImg } from '../utils/imagenes';
import clsx from 'clsx';
import type { ExamMeta } from '../types';
import { formatDurationShort } from '../utils/calculations';

interface ExamSelectorProps {
  exams: ExamMeta[];
  selectedId: string;
  onSelect: (examId: string) => void;
  /** 'dark' = sobre fondo jungle; 'light' = sobre fondo claro (por defecto) */
  variant?: 'dark' | 'light';
  /** Muestra preguntas · duración del examen activo debajo de las pestañas */
  showMeta?: boolean;
}

/**
 * Barra de categorías (DESIGN.md 6.10): una pestaña por examen con subrayado en el activo.
 * Los exámenes no disponibles aparecen con candado y no se pueden elegir.
 * No se muestra si solo hay un examen.
 */
export function ExamSelector({ exams, selectedId, onSelect, variant = 'light', showMeta = false }: ExamSelectorProps) {
  if (exams.length <= 1) return null;
  const dark = variant === 'dark';
  const active = exams.find(e => e.id === selectedId);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Examen"
        className={clsx(
          'flex gap-6 overflow-x-auto -mb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          !dark && 'border-b border-line'
        )}
      >
        {exams.map((exam) => {
          const selected = exam.id === selectedId;
          const disabled = !exam.available;
          return (
            <button
              key={exam.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => !disabled && onSelect(exam.id)}
              disabled={disabled}
              title={disabled ? 'Próximamente' : exam.descripcion}
              className={clsx(
                'relative shrink-0 h-11 inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                selected
                  ? dark ? 'text-white border-lime-400' : 'text-ink border-ink'
                  : dark ? 'text-white/60 border-transparent hover:text-white' : 'text-muted border-transparent hover:text-ink',
                disabled && 'cursor-not-allowed opacity-70 hover:text-muted'
              )}
            >
              <img src={examImg(exam.id)} alt="" aria-hidden draggable={false} className={clsx('w-6 h-6 object-contain', disabled && 'grayscale opacity-60')} />
              {exam.nombre}
              {disabled && <Lock className="w-3 h-3" aria-label="Próximamente" />}
            </button>
          );
        })}
      </div>
      {showMeta && active && (
        <p className={clsx('meta num mt-3', dark && 'text-white/70')}>
          {active.descripcion}
          {active.totalQuestions > 0 && <> · {active.totalQuestions} preguntas</>}
          {' · '}{formatDurationShort(active.durationMinutes)}
          {' · '}nota 0–{active.scaleMax}
          {active.passing != null && <> · aprueba con {active.passing}</>}
        </p>
      )}
    </div>
  );
}
