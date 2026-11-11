import { useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronDown, Play, Loader2, Settings2, GraduationCap, ClipboardCheck, AlertCircle } from 'lucide-react';
import { areaImg } from '../utils/imagenes';
import type { BanqueoIdItem } from '../services/api';
import {
  CATEGORIAS, FILTROS_VACIOS, filtrar, enCategoria, cobertura, hoy, subKey, SEP,
  type Categoria, type FiltrosBanqueo, type Progreso
} from '../utils/progresoBanqueo';

export type ModoBanqueo = 'practica' | 'examen';

export interface ConfigBanqueo {
  ids: string[];
  filtros: FiltrosBanqueo;
  categoria: Categoria;
  modo: ModoBanqueo;
  cantidad: number;
}

interface Props {
  examId: string;
  courseName: string;
  items: BanqueoIdItem[];
  progreso: Progreso;
  inicial?: Partial<Pick<ConfigBanqueo, 'filtros' | 'categoria' | 'modo' | 'cantidad'>>;
  ajustes: ReactNode;
  extra?: ReactNode;
  starting: boolean;
  error?: string;
  onStart: (cfg: Omit<ConfigBanqueo, 'ids'> & { pool: BanqueoIdItem[] }) => void;
  onBack: () => void;
}

const CANTIDADES = [10, 20, 50, 0];
const FUENTES_VISIBLES = 10;

/** Chip oscuro (multiselección) que admite textos largos en móvil. */
function Chip({ active, onClick, children, disabled, title }: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      title={title}
      className={clsx(
        'inline-flex items-center gap-1.5 min-h-[36px] max-w-full px-3 py-1.5 rounded-xl border text-left text-[14px] font-semibold leading-tight transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400',
        active
          ? 'bg-lime-400 border-lime-400 text-jungle-900'
          : 'bg-white/[0.06] border-white/15 text-white hover:bg-white/[0.12]',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}

function Seccion({ titulo, ayuda, children }: { titulo: string; ayuda?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.1em] text-white/60">{titulo}</h2>
        {ayuda && <span className="text-[12px] text-white/50 num text-right">{ayuda}</span>}
      </div>
      {children}
    </section>
  );
}

export function ArmaBanqueo({ examId, courseName, items, progreso, inicial, ajustes, extra, starting, error, onStart, onBack }: Props) {
  const [filtros, setFiltros] = useState<FiltrosBanqueo>(inicial?.filtros ?? FILTROS_VACIOS);
  const [categoria, setCategoria] = useState<Categoria>(inicial?.categoria ?? 'nuevas');
  const [cantidad, setCantidad] = useState<number>(inicial?.cantidad ?? 10);
  const [modo, setModo] = useState<ModoBanqueo>(inicial?.modo ?? 'practica');
  const [verSubtemas, setVerSubtemas] = useState(false);
  const [verFuentes, setVerFuentes] = useState(false);

  // Catálogo del curso armado con la lista ligera de ids
  const { temas, fuentes } = useMemo(() => {
    const t = new Map<string, { total: number; ids: BanqueoIdItem[]; subs: Map<string, number> }>();
    const f = new Map<string, number>();
    for (const it of items) {
      const e = t.get(it.tema) || { total: 0, ids: [], subs: new Map<string, number>() };
      e.total++;
      e.ids.push(it);
      e.subs.set(it.subtema, (e.subs.get(it.subtema) || 0) + 1);
      t.set(it.tema, e);
      f.set(it.fuente, (f.get(it.fuente) || 0) + 1);
    }
    return {
      temas: [...t].map(([tema, e]) => ({
        tema,
        total: e.total,
        pct: e.total ? Math.round((cobertura(e.ids, progreso).vistas / e.total) * 100) : 0,
        subtemas: [...e.subs].map(([subtema, total]) => ({ subtema, total })).sort((a, b) => b.total - a.total)
      })).sort((a, b) => b.total - a.total),
      fuentes: [...f].map(([fuente, total]) => ({ fuente, total }))
        .sort((a, b) => b.fuente.localeCompare(a.fuente, 'es', { numeric: true }))
    };
  }, [items, progreso]);

  const cursoCob = useMemo(() => cobertura(items, progreso), [items, progreso]);
  const filtrados = useMemo(() => filtrar(items, filtros), [items, filtros]);
  const conteos = useMemo(() => {
    const dia = hoy();
    const c = { nuevas: 0, repasar: 0, falladas: 0, marcadas: 0, todas: 0 } as Record<Categoria, number>;
    for (const it of filtrados) {
      const p = progreso[it.id];
      for (const cat of CATEGORIAS) if (enCategoria(cat.id, p, dia)) c[cat.id]++;
    }
    return c;
  }, [filtrados, progreso]);

  const disponibles = conteos[categoria];
  const n = cantidad === 0 ? disponibles : Math.min(cantidad, disponibles);
  const vacioMsg = CATEGORIAS.find(c => c.id === categoria)?.vacio ?? '';

  const toggleTema = (tema: string) => setFiltros(f => {
    const on = f.temas.includes(tema);
    return {
      ...f,
      temas: on ? f.temas.filter(t => t !== tema) : [...f.temas, tema],
      subtemas: on ? f.subtemas.filter(k => k.split(SEP)[0] !== tema) : f.subtemas
    };
  });
  const toggleSub = (tema: string, sub: string) => setFiltros(f => {
    const k = subKey(tema, sub);
    return { ...f, subtemas: f.subtemas.includes(k) ? f.subtemas.filter(x => x !== k) : [...f.subtemas, k] };
  });
  const toggleFuente = (fuente: string) => setFiltros(f => ({
    ...f,
    fuentes: f.fuentes.includes(fuente) ? f.fuentes.filter(x => x !== fuente) : [...f.fuentes, fuente]
  }));

  const temasElegidos = temas.filter(t => filtros.temas.includes(t.tema));
  const fuentesVisibles = verFuentes ? fuentes : fuentes.slice(0, FUENTES_VISIBLES);
  const subCount = filtros.subtemas.length;

  const empezar = () => {
    if (n === 0 || starting) return;
    const dia = hoy();
    onStart({ filtros, categoria, modo, cantidad, pool: filtrados.filter(it => enCategoria(categoria, progreso[it.id], dia)) });
  };

  return (
    <div className="min-h-screen bg-dots text-white px-4 sm:px-5 py-8 sm:py-12 overflow-x-hidden">
      <div className="max-w-[620px] mx-auto">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white mb-6">
          <ChevronLeft className="w-4 h-4" /> Cursos
        </button>

        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-sm">{examId.toUpperCase()} · Arma tu banqueo</p>
            <h1 className="font-display font-extrabold uppercase tracking-[0.02em] text-[26px] sm:text-[34px] leading-tight mt-1 break-words">{courseName}</h1>
          </div>
          <img src={areaImg(courseName)} alt="" aria-hidden draggable={false} className="w-16 h-16 sm:w-24 sm:h-24 object-contain shrink-0 motion-safe:animate-pop" />
        </div>

        {/* Cobertura del curso */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[13px] text-white/70 num">
            <span>Viste <strong className="text-white">{cursoCob.vistas}</strong> de {cursoCob.total} ({cursoCob.total ? Math.round((cursoCob.vistas / cursoCob.total) * 100) : 0} %)</span>
            {cursoCob.pctAcierto !== null && <span>aciertas {cursoCob.pctAcierto} %</span>}
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-lime-400 transition-[width] duration-500" style={{ width: `${cursoCob.total ? (cursoCob.vistas / cursoCob.total) * 100 : 0}%` }} />
          </div>
        </div>

        {extra}

        {/* Temas */}
        <Seccion titulo="Temas" ayuda={filtros.temas.length ? `${filtros.temas.length} elegidos` : 'todos'}>
          <div className="flex flex-wrap gap-2">
            <Chip active={filtros.temas.length === 0} onClick={() => setFiltros(f => ({ ...f, temas: [], subtemas: [] }))}>
              Todos <span className="num opacity-70">{items.length}</span>
            </Chip>
            {temas.map(t => (
              <Chip key={t.tema} active={filtros.temas.includes(t.tema)} onClick={() => toggleTema(t.tema)} title={`${t.total} preguntas · ${t.pct} % vistas`}>
                <span className="min-w-0 break-words">{t.tema}</span>
                <span className="num opacity-70 whitespace-nowrap">{t.total} · {t.pct}%</span>
              </Chip>
            ))}
          </div>
          {temas.some(t => t.subtemas.length > 1 || t.subtemas[0]?.subtema !== 'Sin subtema') && (
            <button
              type="button"
              onClick={() => setVerSubtemas(v => !v)}
              aria-expanded={verSubtemas}
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-lime-400 hover:text-lime-300"
            >
              <ChevronDown className={clsx('w-4 h-4 transition-transform', verSubtemas && 'rotate-180')} />
              Afinar por subtema{subCount > 0 && <span className="num"> ({subCount})</span>}
            </button>
          )}
          {verSubtemas && (
            <div className="mt-3 rounded-2xl bg-black/25 border border-white/10 p-3 space-y-3">
              {temasElegidos.length === 0 ? (
                <p className="text-[13px] text-white/60">Elige uno o más temas arriba para afinar por subtema.</p>
              ) : temasElegidos.map(t => (
                <div key={t.tema}>
                  <p className="text-[12px] font-semibold text-white/70 mb-1.5 break-words">{t.tema}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {t.subtemas.map(s => (
                      <Chip key={s.subtema} active={filtros.subtemas.includes(subKey(t.tema, s.subtema))} onClick={() => toggleSub(t.tema, s.subtema)}>
                        <span className="min-w-0 break-words">{s.subtema}</span>
                        <span className="num opacity-70">{s.total}</span>
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Seccion>

        {/* Fuentes */}
        {fuentes.length > 1 && (
          <Seccion titulo="Fuente / año" ayuda={filtros.fuentes.length ? `${filtros.fuentes.length} elegidas` : 'todas'}>
            <div className="flex flex-wrap gap-2">
              <Chip active={filtros.fuentes.length === 0} onClick={() => setFiltros(f => ({ ...f, fuentes: [] }))}>Todas</Chip>
              {fuentesVisibles.map(f => (
                <Chip key={f.fuente} active={filtros.fuentes.includes(f.fuente)} onClick={() => toggleFuente(f.fuente)}>
                  <span className="min-w-0 break-words">{f.fuente}</span>
                  <span className="num opacity-70">{f.total}</span>
                </Chip>
              ))}
              {fuentes.length > FUENTES_VISIBLES && (
                <button type="button" onClick={() => setVerFuentes(v => !v)} className="min-h-[36px] px-2 text-[13px] font-semibold text-lime-400 hover:text-lime-300">
                  {verFuentes ? 'Ver menos' : `Ver todas (${fuentes.length})`}
                </button>
              )}
            </div>
          </Seccion>
        )}

        {/* Categoría */}
        <Seccion titulo="¿Qué preguntas?">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORIAS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoria(c.id)}
                aria-pressed={categoria === c.id}
                className={clsx(
                  'min-h-[56px] rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400',
                  c.id === 'todas' && 'col-span-2 sm:col-span-1',
                  categoria === c.id ? 'bg-lime-400 border-lime-400 text-jungle-900' : 'bg-white/[0.06] border-white/15 hover:bg-white/[0.12]'
                )}
              >
                <span className="block text-[14px] font-bold leading-tight">{c.label}</span>
                <span className={clsx('block text-[12px] num mt-0.5', categoria === c.id ? 'text-jungle-900/75' : 'text-white/55')}>
                  {conteos[c.id]} {conteos[c.id] === 1 ? 'pregunta' : 'preguntas'}
                </span>
              </button>
            ))}
          </div>
        </Seccion>

        {/* Cantidad */}
        <Seccion titulo="Cantidad" ayuda={<>disponibles: <strong className="text-white">{disponibles}</strong></>}>
          <div className="grid grid-cols-4 gap-2">
            {CANTIDADES.map(c => (
              <Chip key={c} active={cantidad === c} onClick={() => setCantidad(c)}>
                <span className="w-full text-center">{c === 0 ? 'Todas' : c}</span>
              </Chip>
            ))}
          </div>
        </Seccion>

        {/* Modo */}
        <Seccion titulo="Modo">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {([
              ['practica', 'Práctica', 'Ves la respuesta y la justificación tras cada pregunta', GraduationCap],
              ['examen', 'Examen', 'Sin pistas hasta el final; luego revisas todo', ClipboardCheck]
            ] as const).map(([id, label, desc, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setModo(id)}
                aria-pressed={modo === id}
                className={clsx(
                  'flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400',
                  modo === id ? 'bg-lime-400 border-lime-400 text-jungle-900' : 'bg-white/[0.06] border-white/15 hover:bg-white/[0.12]'
                )}
              >
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                  <span className="block text-[15px] font-bold">{label}</span>
                  <span className={clsx('block text-[12px] mt-0.5', modo === id ? 'text-jungle-900/75' : 'text-white/60')}>{desc}</span>
                </span>
              </button>
            ))}
          </div>
        </Seccion>

        {/* Ajustes (plegable) */}
        <details className="group mt-6 rounded-2xl border border-white/15 bg-white/[0.04]">
          <summary className="list-none cursor-pointer flex items-center gap-2 px-4 py-3 text-[14px] font-semibold text-white/85 hover:text-white">
            <Settings2 className="w-4 h-4" />
            <span className="flex-1">Ajustes (tiempo, voz, música, potenciadores…)</span>
            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-2 pb-2">
            <div className="bg-white text-ink rounded-2xl p-1">{ajustes}</div>
          </div>
        </details>

        {error && (
          <p className="mt-5 rounded-xl bg-wrong/90 px-4 py-3 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </p>
        )}

        <button
          type="button"
          onClick={empezar}
          disabled={n === 0 || starting}
          className="btn w-full mt-6 min-h-[60px] text-[18px] bg-lime-400 text-jungle-900 hover:bg-lime-500 disabled:bg-white/10 disabled:text-white/40 focus-visible:ring-lime-400/60 focus-visible:ring-offset-jungle-900"
        >
          {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" fill="currentColor" />}
          {starting ? 'Preparando…' : n === 0 ? 'Empezar' : `Empezar (${n} ${n === 1 ? 'pregunta' : 'preguntas'})`}
        </button>
        {n === 0 && !starting && (
          <p className="mt-3 text-center text-[14px] text-white/75">{vacioMsg}</p>
        )}
      </div>
    </div>
  );
}
