import { useMemo, type ClipboardEvent, type DragEvent, type MouseEvent } from 'react';

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c] as string));
}

/**
 * Marca de agua repetida con el DNI/correo del alumno sobre el área de preguntas.
 * Va encima del contenido pero no recibe clics (pointer-events: none) ni la leen los lectores de pantalla.
 * El contenedor padre debe tener position: relative.
 */
export function Watermark({ text, color = '#000', opacity = 0.06 }: { text: string; color?: string; opacity?: number }) {
  const bg = useMemo(() => {
    const t = escapeXml(text.slice(0, 80));
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="170">` +
      `<text x="170" y="95" text-anchor="middle" transform="rotate(-24 170 85)" ` +
      `font-family="system-ui, sans-serif" font-size="15" font-weight="600" fill="${escapeXml(color)}">${t}</text></svg>`;
    return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }, [text, color]);
  if (!text) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none select-none absolute inset-0 z-20 overflow-hidden"
      style={{ backgroundImage: bg, backgroundRepeat: 'repeat', opacity }}
    />
  );
}

/** Texto de la marca de agua: DNI · correo. */
export function watermarkText(dni?: string | null, email?: string | null): string {
  return [dni, email].filter(Boolean).join(' · ');
}

const block = (e: ClipboardEvent | MouseEvent | DragEvent) => e.preventDefault();

/** Props para un contenedor de preguntas: bloquea copiar, cortar, menú contextual y arrastrar. */
export const noCopyProps = {
  onCopy: block,
  onCut: block,
  onContextMenu: block,
  onDragStart: block
};
