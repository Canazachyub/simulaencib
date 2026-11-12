/**
 * Piezas compartidas del sistema "Terminal de estudio" (DESIGN.md).
 * Solo presentación: no tocan store, API ni calificación.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Home, KeyRound } from 'lucide-react';
import clsx from 'clsx';

// ============================================
// Marca y enlaces a la web de venta (paso 1 del flujo)
// ============================================
const BASE = import.meta.env.BASE_URL;
export const SINAPSIS_URL = import.meta.env.VITE_SINAPSIS_URL || 'https://sinapsisedu.com/';
export const PORTAL_URL = `${SINAPSIS_URL}#/portal`;

export function BrandMark({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-3', className)}>
      <img
        src={`${BASE}images/logo/${dark ? 'logo-blanco-transparente.png' : 'logo.png'}`}
        alt="SINAPSIS EDU"
        className="h-8 sm:h-9 w-auto"
      />
      <span
        className={clsx(
          'hidden sm:inline pl-3 border-l text-sm font-semibold',
          dark ? 'border-white/20 text-white/80' : 'border-line text-muted'
        )}
      >
        Simulacros
      </span>
    </span>
  );
}

// ============================================
// Barra superior (64 px)
// ============================================
interface TopBarProps {
  /** Contenido a la derecha (por defecto: Volver a SINAPSIS + Mis accesos) */
  right?: ReactNode;
  /** Barra de categorías debajo (44 px) */
  children?: ReactNode;
  sticky?: boolean;
}

export function TopBar({ right, children, sticky = true }: TopBarProps) {
  return (
    <header className={clsx('bg-white border-b border-line z-30', sticky && 'sticky top-0')}>
      <div className="max-w-terminal mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="shrink-0" aria-label="Simulacros SINAPSIS - inicio">
          <BrandMark />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {right ?? (
            <>
              <a href={SINAPSIS_URL} className="btn-ghost hidden md:inline-flex">
                <ArrowLeft className="w-4 h-4" />
                Volver a SINAPSIS
              </a>
              <a
                href={SINAPSIS_URL}
                className="md:hidden grid place-items-center w-11 h-11 rounded-xl text-muted hover:text-jungle-800 hover:bg-paper transition-colors"
                aria-label="Volver a sinapsisedu.com"
                title="Volver a sinapsisedu.com"
              >
                <Home className="w-5 h-5" />
              </a>
              <a href={PORTAL_URL} className="btn-secondary min-h-[44px] py-2 px-3 sm:px-4 text-sm">
                <KeyRound className="w-4 h-4" />
                Mis accesos
              </a>
            </>
          )}
        </nav>
      </div>
      {children && (
        <div className="max-w-terminal mx-auto px-4 lg:px-8">{children}</div>
      )}
    </header>
  );
}

// ============================================
// Pie de página (versión simple del footer de SinapsisEdu)
// ============================================
export function TerminalFooter() {
  return (
    <footer className="border-t border-white/10 bg-jungle-900 text-white/70">
      <div className="max-w-terminal mx-auto px-4 lg:px-8 py-10 flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
        <div>
          <img src={`${BASE}images/logo/logo-blanco-transparente.png`} alt="SINAPSIS EDU" className="h-9 w-auto" loading="lazy" />
          <p className="mt-3 max-w-sm text-sm leading-relaxed">
            Simulacros y banqueo para ENCIB, ENAM, Residentado Médico, SERUMS y EsSalud.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <a href={SINAPSIS_URL} className="transition-colors hover:text-lime-400">sinapsisedu.com</a>
          <a href={PORTAL_URL} className="transition-colors hover:text-lime-400">Mis accesos</a>
          <Link to="/banqueo" className="transition-colors hover:text-lime-400">Banqueo</Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-terminal mx-auto px-4 lg:px-8 flex flex-wrap justify-between gap-2 py-5 text-xs text-white/45">
          <span>© {new Date().getFullYear()} SINAPSIS EDU · sinapsisedu.com</span>
          <span>Material de práctica: no reemplaza ni representa a los exámenes oficiales.</span>
        </div>
      </div>
    </footer>
  );
}

// ============================================
// Etiqueta de sección (11 px, MAYÚSCULAS)
// ============================================
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx('label-section', className)}>{children}</p>;
}

// ============================================
// Acordeón (6.8)
// ============================================
interface AccordionItemProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
}

export function AccordionItem({ title, children, defaultOpen = false, icon }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full min-h-14 flex items-center gap-3 text-left text-[15px] font-semibold text-ink hover:text-jungle-600 transition-colors"
      >
        {icon && <span className="text-muted shrink-0">{icon}</span>}
        <span className="flex-1 py-4">{title}</span>
        <ChevronDown
          className={clsx('w-4 h-4 text-muted shrink-0 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>
      {open && <div className="pb-5 text-[15px] leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function Accordion({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('border-t border-line', className)}>{children}</div>;
}

// ============================================
// Stepper "Cómo se califica" (Responder → Calificar → Revisar)
// ============================================
export function GradingStepper({
  steps = [
    { title: 'Responder', text: 'Marca una alternativa por pregunta; puedes cambiarla hasta calificar.' },
    { title: 'Calificar', text: 'Al terminar (o al agotarse el tiempo) se suman los puntos de las correctas.' },
    { title: 'Revisar', text: 'Ves tu nota, el rendimiento por curso y la justificación de cada pregunta.' },
  ],
}: { steps?: { title: string; text: string }[] }) {
  return (
    <ol className="relative mt-1">
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && (
            <span className="absolute left-[7px] top-4 bottom-0 w-px bg-line" aria-hidden />
          )}
          <span
            className={clsx(
              'relative mt-1 w-[15px] h-[15px] rounded-full border-2 shrink-0',
              i === 0 ? 'bg-jungle-800 border-jungle-800' : 'bg-white border-line'
            )}
            aria-hidden
          />
          <div>
            <p className="text-sm font-semibold text-ink">{s.title}</p>
            <p className="text-sm text-muted">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ============================================
// Racha (6.6)
// ============================================
export type StreakMark = 'correct' | 'wrong' | 'blank';

export function Streak({ marks, label = 'Últimas' }: { marks: StreakMark[]; label?: string }) {
  const last = marks.slice(-10);
  return (
    <div className="inline-flex items-center gap-2 h-8 pl-3 pr-2 rounded-full bg-paper">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="flex items-center gap-1" aria-label={`${last.filter(m => m === 'correct').length} correctas de las últimas ${last.length}`}>
        {last.length === 0 && <span className="text-xs text-subtle">—</span>}
        {last.map((m, i) => (
          <span
            key={i}
            className={clsx(
              'grid place-items-center w-4 h-4 rounded-full text-[9px] font-bold leading-none',
              m === 'correct' && 'bg-correct text-white',
              m === 'wrong' && 'bg-wrong text-white',
              m === 'blank' && 'border border-subtle'
            )}
          >
            {m === 'correct' ? '✓' : m === 'wrong' ? '✕' : ''}
          </span>
        ))}
      </span>
    </div>
  );
}

// ============================================
// Temporizador anillo (6.2)
// ============================================
interface TimerRingProps {
  remaining: number; // segundos
  total: number; // segundos
  label: string; // texto formateado
  size?: 'sm' | 'md';
}

export function timerTone(remaining: number): 'normal' | 'warning' | 'critical' {
  if (remaining < 120) return 'critical';
  if (remaining < 600) return 'warning';
  return 'normal';
}

export function TimerRing({ remaining, total, label, size = 'md' }: TimerRingProps) {
  const tone = timerTone(remaining);
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const r = 9;
  const c = 2 * Math.PI * r;
  // Al inicio el arco es lime (chispa); luego jungle-600 → warning → wrong
  const stroke =
    tone === 'critical' ? '#DC2626' : tone === 'warning' ? '#D97706' : pct > 0.97 ? '#C2E476' : '#1F5B52';
  const milestone =
    tone === 'critical' ? 'Quedan menos de 2 minutos' : tone === 'warning' ? 'Quedan menos de 10 minutos' : '';

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border bg-white',
        size === 'md' ? 'h-9 pl-1.5 pr-3' : 'h-8 pl-1 pr-2.5',
        tone === 'critical' ? 'border-wrong/40 timer-critical' : tone === 'warning' ? 'border-warning/40' : 'border-line'
      )}
      title="Tiempo restante"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90 shrink-0" aria-hidden>
        <circle cx="12" cy="12" r={r} fill="none" stroke="#E2E8E6" strokeWidth="2" />
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <span
        className={clsx(
          'num text-sm font-semibold',
          tone === 'critical' ? 'text-wrong' : tone === 'warning' ? 'text-warning' : 'text-ink'
        )}
      >
        {label}
      </span>
      <span className="sr-only" aria-live="polite">{milestone}</span>
    </div>
  );
}

// ============================================
// Pasos del simulacro (Datos → Confirmar → Examen): progreso visual del flujo
// ============================================
export function FlowSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Tus datos', 'Confirmar', 'Examen'];
  return (
    <ol className="flex items-center gap-2" aria-label={`Paso ${current} de ${steps.length}`}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex-1 min-w-0" aria-current={active ? 'step' : undefined}>
            <span
              className={clsx(
                'block h-1.5 rounded-full',
                done ? 'bg-jungle-600' : active ? 'bg-jungle-800' : 'bg-line'
              )}
            />
            <span
              className={clsx(
                'mt-1.5 flex items-center gap-1 text-[12px] font-semibold truncate',
                active ? 'text-jungle-800' : done ? 'text-jungle-600' : 'text-subtle'
              )}
            >
              <span className="num">{n}.</span> {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
