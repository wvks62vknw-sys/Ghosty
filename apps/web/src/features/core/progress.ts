/**
 * Live progress from a tool at work (the brain's `progress` events): what it is doing
 * ("crt.sh…") and, when it knows, how far it is (3 of 7). Shown under the tool's line in the
 * chat and on the HUD. Pure helpers, so they are tested in Node without a DOM.
 */
export interface Progress {
  label: string;
  done?: number;
  total?: number;
}

const MAX_LABEL = 120;

/** The useful part of a progress event, tidied: one line of label, counts only when they make sense. */
export function progressOf(ev: { label: unknown; done?: unknown; total?: unknown }): Progress {
  const p: Progress = { label: String(ev.label ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL) };
  if (typeof ev.done === 'number' && Number.isFinite(ev.done) && ev.done >= 0) p.done = ev.done;
  if (typeof ev.total === 'number' && Number.isFinite(ev.total) && ev.total > 0) p.total = ev.total;
  return p;
}

/** The line shown: "crt.sh… 3 of 7"; "page (3)" with a count but no total; just the label otherwise. */
export function progressText(p: Progress): string {
  if (p.total !== undefined && p.done !== undefined) return `${p.label} ${p.done} of ${p.total}`.trim();
  if (p.done !== undefined) return `${p.label} (${p.done})`.trim();
  return p.label;
}

/** How far along, 0..1, for the thin bar; null when the total is not known. */
export function progressRatio(p: Progress): number | null {
  if (p.total === undefined || p.done === undefined) return null;
  return Math.max(0, Math.min(1, p.done / p.total));
}
