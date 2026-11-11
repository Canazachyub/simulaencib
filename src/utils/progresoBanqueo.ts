// ============================================
// Progreso local del banqueo (localStorage) + repetición espaciada (Leitner)
// y sesión a medias (sessionStorage). Todo vive en el navegador del alumno.
// ============================================
import type { BanqueoIdItem } from '../services/api';

export interface ProgresoItem {
  vistas: number;
  aciertos: number;
  ultimoResultado: boolean | null;
  ultimaFecha: string | null; // ISO
  caja: number; // Leitner 1..5
  proxima: string | null; // YYYY-MM-DD (fecha local)
  marcada: boolean;
  curso?: string;
  tema?: string;
}

export type Progreso = Record<string, ProgresoItem>;

/** Días hasta el siguiente repaso según la caja (1..5). */
export const INTERVALOS = [1, 3, 7, 14, 30];

const PREFIJO = 'banqueo_progreso_v1';

function usuario(): string {
  try {
    const dni = (sessionStorage.getItem('banqueo_dni') || '').trim();
    const email = (sessionStorage.getItem('banqueo_email') || '').toLowerCase().trim();
    return dni || email || 'anonimo';
  } catch {
    return 'anonimo';
  }
}

function clave(examId: string): string {
  return `${PREFIJO}:${examId.toLowerCase()}:${usuario()}`;
}

export function hoy(): string {
  return fechaLocal(new Date());
}

function fechaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function sumarDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return fechaLocal(d);
}

export function leerProgreso(examId: string): Progreso {
  try {
    const raw = localStorage.getItem(clave(examId));
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function guardar(examId: string, p: Progreso) {
  try {
    localStorage.setItem(clave(examId), JSON.stringify(p));
  } catch {
    // almacenamiento lleno o bloqueado: el progreso no se guarda, la práctica sigue
  }
}

function vacio(): ProgresoItem {
  return { vistas: 0, aciertos: 0, ultimoResultado: null, ultimaFecha: null, caja: 1, proxima: null, marcada: false };
}

/** Registra una respuesta: acierto sube de caja; fallo vuelve a caja 1 con repaso mañana. */
export function registrarRespuesta(examId: string, id: string, correcto: boolean, meta: { curso?: string; tema?: string } = {}): ProgresoItem {
  const p = leerProgreso(examId);
  const prev = p[id] || vacio();
  const caja = correcto ? Math.min(5, (prev.vistas > 0 ? prev.caja : 1) + 1) : 1;
  const item: ProgresoItem = {
    ...prev,
    vistas: prev.vistas + 1,
    aciertos: prev.aciertos + (correcto ? 1 : 0),
    ultimoResultado: correcto,
    ultimaFecha: new Date().toISOString(),
    caja,
    proxima: sumarDias(INTERVALOS[caja - 1]),
    curso: meta.curso ?? prev.curso,
    tema: meta.tema ?? prev.tema
  };
  p[id] = item;
  guardar(examId, p);
  return item;
}

export function alternarMarcada(examId: string, id: string, meta: { curso?: string; tema?: string } = {}): boolean {
  const p = leerProgreso(examId);
  const prev = p[id] || vacio();
  const marcada = !prev.marcada;
  p[id] = { ...prev, marcada, curso: meta.curso ?? prev.curso, tema: meta.tema ?? prev.tema };
  guardar(examId, p);
  return marcada;
}

// ============================================
// Filtros y categorías
// ============================================
export type Categoria = 'nuevas' | 'repasar' | 'falladas' | 'marcadas' | 'todas';

export const CATEGORIAS: { id: Categoria; label: string; vacio: string }[] = [
  { id: 'nuevas', label: 'Nuevas', vacio: "¡Ya viste todas las de esta selección! Prueba 'Para repasar' o 'Todas'." },
  { id: 'repasar', label: 'Para repasar hoy', vacio: "Nada pendiente para hoy. Vuelve mañana o prueba 'Nuevas'." },
  { id: 'falladas', label: 'Falladas', vacio: 'No tienes preguntas falladas en esta selección. 🎯' },
  { id: 'marcadas', label: 'Marcadas', vacio: 'Aún no marcaste preguntas: usa la ⭐ durante el banqueo.' },
  { id: 'todas', label: 'Todas', vacio: 'No hay preguntas con estos filtros.' }
];

export function esNueva(it?: ProgresoItem): boolean {
  return !it || it.vistas === 0;
}

export function esParaRepasar(it: ProgresoItem | undefined, dia = hoy()): boolean {
  return !!it && it.vistas > 0 && !!it.proxima && it.proxima <= dia;
}

export function enCategoria(cat: Categoria, it: ProgresoItem | undefined, dia = hoy()): boolean {
  switch (cat) {
    case 'nuevas': return esNueva(it);
    case 'repasar': return esParaRepasar(it, dia);
    case 'falladas': return !!it && it.vistas > 0 && it.ultimoResultado === false;
    case 'marcadas': return !!it?.marcada;
    default: return true;
  }
}

export interface FiltrosBanqueo {
  temas: string[]; // vacío = todos
  subtemas: string[]; // claves "tema␁subtema"; si un tema tiene subtemas elegidos, se limita a ellos
  fuentes: string[]; // vacío = todas
}

export const FILTROS_VACIOS: FiltrosBanqueo = { temas: [], subtemas: [], fuentes: [] };

export const SEP = '\u0001';
export const subKey = (tema: string, subtema: string) => `${tema}${SEP}${subtema}`;

export function filtrar(items: BanqueoIdItem[], f: FiltrosBanqueo): BanqueoIdItem[] {
  const temas = f.temas.length ? new Set(f.temas) : null;
  const fuentes = f.fuentes.length ? new Set(f.fuentes) : null;
  const subs = new Set(f.subtemas);
  const temasConSub = new Set(f.subtemas.map(k => k.split(SEP)[0]));
  return items.filter(it => {
    if (temas && !temas.has(it.tema)) return false;
    if (fuentes && !fuentes.has(it.fuente)) return false;
    if (temasConSub.has(it.tema) && !subs.has(subKey(it.tema, it.subtema))) return false;
    return true;
  });
}

export function mezclar<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Cobertura de un conjunto de preguntas: vistas, % de aciertos y pendientes de hoy. */
export function cobertura(items: { id: string }[], p: Progreso) {
  const dia = hoy();
  let vistas = 0, intentos = 0, aciertos = 0, repasar = 0;
  for (const { id } of items) {
    const it = p[id];
    if (!it || it.vistas === 0) continue;
    vistas++;
    intentos += it.vistas;
    aciertos += it.aciertos;
    if (esParaRepasar(it, dia)) repasar++;
  }
  return { vistas, total: items.length, pctAcierto: intentos ? Math.round((aciertos / intentos) * 100) : null, repasar };
}

/** Cobertura de un curso sin la lista de ids (usa el campo "curso" guardado en cada entrada). */
export function coberturaCurso(p: Progreso, curso: string, total: number) {
  const dia = hoy();
  let vistas = 0, intentos = 0, aciertos = 0, repasar = 0;
  for (const it of Object.values(p)) {
    if (it.curso !== curso || it.vistas === 0) continue;
    vistas++;
    intentos += it.vistas;
    aciertos += it.aciertos;
    if (esParaRepasar(it, dia)) repasar++;
  }
  vistas = Math.min(vistas, total || vistas);
  return { vistas, total, pct: total ? Math.round((vistas / total) * 100) : 0, pctAcierto: intentos ? Math.round((aciertos / intentos) * 100) : null, repasar };
}

// ============================================
// Sesión a medias (sessionStorage)
// ============================================
export interface SesionBanqueo {
  v: 1;
  exam: string;
  course: string;
  modo: 'practica' | 'examen';
  ids: string[];
  index: number;
  states: { answered: boolean; selectedOption: number | null; isCorrect: boolean }[];
  earned: number[];
  spent: (number | null)[];
  filtros: FiltrosBanqueo;
  categoria: Categoria;
  updatedAt: string;
}

const SESION_KEY = 'banqueo_sesion_v1';

export function leerSesion(): SesionBanqueo | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESION_KEY) || 'null');
    if (!s || s.v !== 1 || !Array.isArray(s.ids) || !s.ids.length) return null;
    return s as SesionBanqueo;
  } catch {
    return null;
  }
}

export function guardarSesion(s: SesionBanqueo) {
  try {
    sessionStorage.setItem(SESION_KEY, JSON.stringify(s));
  } catch {
    // sin sessionStorage
  }
}

export function borrarSesion() {
  try {
    sessionStorage.removeItem(SESION_KEY);
  } catch {
    // sin sessionStorage
  }
}

/** Sesión pendiente (alguna pregunta sin responder). */
export function sesionPendiente(): SesionBanqueo | null {
  const s = leerSesion();
  if (!s) return null;
  const respondidas = s.states.filter(x => x?.answered).length;
  return respondidas > 0 && respondidas < s.ids.length ? s : null;
}
