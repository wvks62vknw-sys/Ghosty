/**
 * What the blocks share: slot shorthands for their content contracts, the section wrapper (tone, id,
 * reveal), and the heading group most sections open with (eyebrow, title, lead).
 */
import { esc, linkOf, rich, str } from '../html';
import type { RenderCtx, Slot } from '../types';

export const T = (max: number, hint?: string, optional = false): Slot => ({ t: 'text', max, ...(hint ? { hint } : {}), ...(optional ? { optional } : {}) });
export const OT = (max: number, hint?: string): Slot => T(max, hint, true);
export const IMG = (hint?: string, optional = false): Slot => ({ t: 'image', ...(hint ? { hint } : {}), ...(optional ? { optional } : {}) });
export const LINK = (hint?: string, optional = true): Slot => ({ t: 'link', ...(hint ? { hint } : {}), optional });
export const LIST = (of: Record<string, Slot>, max: number, min = 1, hint?: string): Slot => ({ t: 'list', of, max, min, ...(hint ? { hint } : {}) });
export const TEXTS = (max: number, each: number, hint?: string): Slot => ({ t: 'texts', max, each, ...(hint ? { hint } : {}), optional: true });
export const ICON: Slot = { t: 'text', max: 24, optional: true, hint: 'an icon name from the kit' };

/** The heading slots most sections share. */
export const HEAD = { eyebrow: OT(40, 'two to four words above the title'), title: T(80, 'the section title; *word* for an accent'), lead: OT(240, 'one or two plain sentences') };

/** A section: its tone, an id for in-page links, and the block's class. */
export function sec(id: string, x: RenderCtx, inner: string, o: { cls?: string; tight?: boolean; label?: string; anchor?: string } = {}): string {
  const tone = x.tone === 'base' ? '' : ` tone-${x.tone}`;
  return `<section class="sec b-${id}${o.tight ? ' tight' : ''}${tone}${o.cls ? ` ${o.cls}` : ''}"${o.anchor ? ` id="${esc(o.anchor)}"` : ''}${o.label ? ` aria-label="${esc(o.label)}"` : ''}>${inner}</section>`;
}

/** Eyebrow, h2 and lead (and an optional link), left or centred. Empty when there is no title. */
export function head(d: Record<string, unknown>, o: { center?: boolean; split?: boolean; level?: 2 | 3 } = {}): string {
  const title = str(d, 'title');
  if (!title) return '';
  const eyebrow = str(d, 'eyebrow');
  const lead = str(d, 'lead');
  const more = linkOf(d, 'link');
  const h = o.level ?? 2;
  const titleHtml = `<h${h}>${rich(title)}</h${h}>`;
  if (o.split) return `<div class="head split reveal"><div>${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}${titleHtml}</div>${lead || more ? `<div>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}${more ? `<p style="margin-top:var(--space-s)"><a class="btn btn-outline btn-sm" href="${esc(more.href)}"${/^https:/.test(more.href) ? ' target="_blank" rel="noopener"' : ''}>${esc(more.label)}</a></p>` : ''}</div>` : ''}</div>`;
  return `<div class="head${o.center ? ' center' : ''} reveal">${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}${titleHtml}${lead ? `<p class="lead">${esc(lead)}</p>` : ''}</div>`;
}

/** Initials for a monogram (brand mark, a person without a photo). */
export const initials = (name: string) =>
  name
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w) && !/^(the|and|of|co\.?|ltd|limited)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || name.slice(0, 1).toUpperCase();
