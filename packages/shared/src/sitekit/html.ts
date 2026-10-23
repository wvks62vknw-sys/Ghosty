/**
 * Small, careful helpers every block draws with: escaping (every word on a generated page went through
 * esc), reading a block's content slots without trusting their shape, icons, responsive pictures, and
 * the contact links (tel:, WhatsApp, mailto:, maps) a small business site lives on.
 */
import type { Brief, ImageRef, Link, Page, Plan } from './types';

export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Inline emphasis the writers may use in headlines: *word* becomes <em>word</em> (the theme draws it in
 * the display italic or the brand colour). Everything else is escaped.
 */
export const rich = (s: unknown): string => esc(s).replace(/\*([^*\n]{1,60})\*/g, '<em>$1</em>');

export const str = (d: Record<string, unknown>, k: string, fallback = ''): string => {
  const v = d[k];
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : fallback;
};
export const list = <T = Record<string, unknown>>(d: Record<string, unknown>, k: string): T[] => (Array.isArray(d[k]) ? (d[k] as unknown[]).filter((x) => x !== null && x !== undefined) as T[] : []);
export const texts = (d: Record<string, unknown>, k: string): string[] => list<unknown>(d, k).filter((x): x is string => typeof x === 'string' && !!x.trim());
export const num = (d: Record<string, unknown>, k: string): number | undefined => (typeof d[k] === 'number' && Number.isFinite(d[k]) ? (d[k] as number) : undefined);

export function isImage(v: unknown): v is ImageRef {
  return !!v && typeof v === 'object' && typeof (v as ImageRef).src === 'string' && /^(https:|data:image\/)/.test((v as ImageRef).src);
}
export const imgOf = (d: Record<string, unknown>, k: string): ImageRef | undefined => (isImage(d[k]) ? (d[k] as ImageRef) : undefined);
export const linkOf = (d: Record<string, unknown>, k: string): Link | undefined => {
  const v = d[k] as Link | undefined;
  return v && typeof v === 'object' && typeof v.label === 'string' && typeof v.href === 'string' && v.label.trim() && safeHref(v.href) ? { label: v.label.trim(), href: safeHref(v.href) } : undefined;
};

/** Only addresses a published page can follow: https, the page's own routes and anchors, mail, phone and WhatsApp. */
export function safeHref(h: string): string {
  const t = h.trim();
  if (/^#\/?[a-z0-9-]*$/i.test(t)) return t;
  if (/^(https:\/\/|mailto:|tel:|sms:)/i.test(t)) return t.replace(/\s/g, (c) => (c === ' ' ? '%20' : ''));
  return '';
}

/** An icon from the page's sprite (icons.ts). Decorative unless labelled. */
export const icon = (name: string, label = ''): string => `<svg class="ic"${label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"'}><use href="#i-${esc(name)}"/></svg>`;

/** A link: the page's own routes stay in the frame, everything else opens in a new tab (a published page sits in a locked frame). */
export function a(href: string, inner: string, cls = '', extra = ''): string {
  const h = safeHref(href);
  if (!h) return `<span${cls ? ` class="${cls}"` : ''}>${inner}</span>`;
  const out = /^https:/i.test(h) ? ' target="_blank" rel="noopener"' : '';
  return `<a href="${esc(h)}"${cls ? ` class="${cls}"` : ''}${out}${extra ? ` ${extra}` : ''}>${inner}</a>`;
}
export const btn = (l: Link | undefined, kind = 'btn-primary', ic = ''): string => (l ? a(l.href, `${esc(l.label)}${ic ? icon(ic) : ''}`, `btn ${kind}`) : '');

/** width and height as whole numbers (a picture's size from outside is never written as given). */
const dims = (ref: ImageRef): string => {
  const w = Math.round(Number(ref.width));
  const h = Math.round(Number(ref.height));
  return w > 0 && h > 0 && w < 100_000 && h < 100_000 ? ` width="${w}" height="${h}"` : '';
};

/**
 * A responsive picture: srcset when there are sizes to pick from, its real width and height (no layout
 * jump), lazy unless it is the first thing on the page, and the focus point kept when it is cropped.
 */
export function img(ref: ImageRef | undefined, o: { sizes?: string; eager?: boolean; cls?: string; alt?: string } = {}): string {
  if (!ref) return '';
  const set = (ref.srcset ?? []).filter(([u, w]) => /^https:/.test(u) && w > 0).sort((x, y) => x[1] - y[1]);
  const alt = o.alt ?? ref.alt ?? '';
  return `<img src="${esc(ref.src)}"${set.length > 1 ? ` srcset="${esc(set.map(([u, w]) => `${u} ${w}w`).join(', '))}" sizes="${esc(o.sizes ?? '100vw')}"` : ''}${dims(ref)} alt="${esc(alt)}"${o.eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"'} decoding="async"${ref.focus ? ` style="object-position:${esc(ref.focus)}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}>`;
}

// ── contact links ───────────────────────────────────────────────────────────────────

/** A UK number as dialled from anywhere (+44…), for tel: and WhatsApp. */
export function intlPhone(p: string): string {
  const d = p.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d;
  if (d.startsWith('00')) return `+${d.slice(2)}`;
  if (d.startsWith('0')) return `+44${d.slice(1)}`;
  return d;
}
export const telHref = (p: string) => `tel:${intlPhone(p)}`;
export const waHref = (p: string, text = '') => `https://wa.me/${intlPhone(p).replace('+', '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
/** The address only when it is exactly one email address (no "?bcc=…", no second address): else ''. */
export const cleanEmail = (e: unknown): string => (typeof e === 'string' && /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(e.trim()) ? e.trim() : '');
export const mailHref = (e: string, subject = '', body = '') => `mailto:${encodeURIComponent(cleanEmail(e)).replace(/%40/g, '@')}${subject || body ? `?${[subject ? `subject=${encodeURIComponent(subject)}` : '', body ? `body=${encodeURIComponent(body)}` : ''].filter(Boolean).join('&')}` : ''}`;
export const mapsHref = (b: Brief) => (b.lat !== undefined && b.lon !== undefined ? `https://www.openstreetmap.org/?mlat=${b.lat}&mlon=${b.lon}#map=17/${b.lat}/${b.lon}` : `https://www.openstreetmap.org/search?query=${encodeURIComponent([b.address, b.postcode, b.town].filter(Boolean).join(', '))}`);
export const directionsHref = (b: Brief) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.lat !== undefined && b.lon !== undefined ? `${b.lat},${b.lon}` : [b.name, b.address, b.postcode, b.town].filter(Boolean).join(', '))}`;

/** The one address line: street, town, postcode. */
export const addressLine = (b: Brief) => [b.address, b.town && !(b.address ?? '').toLowerCase().includes(b.town.toLowerCase()) ? b.town : '', b.postcode].filter(Boolean).join(', ');

/** The page's own address for a slug ('' is home). */
export const route = (slug: string) => `#/${slug}`;

/** The main call to action of the whole site: book, call, order, donate… picked from what the owner gave. */
export function primaryAction(b: Brief, plan: Plan): Link {
  const contact = ['book', 'quote', 'valuation', 'join', 'contact', 'visit'].map((slug) => plan.pages.find((p) => p.slug === slug)).find(Boolean);
  if (b.bookingUrl) return { label: b.kind === 'restaurant' || b.kind === 'cafe' ? 'Book a table' : 'Book online', href: b.bookingUrl };
  if (b.kind === 'charity' && b.donateUrl) return { label: 'Donate', href: b.donateUrl };
  if (b.kind === 'shop' && b.shopUrl) return { label: 'Shop online', href: b.shopUrl };
  if (contact) return { label: contact.slug === 'visit' ? 'Find us' : ACTION_WORD[b.kind] ?? 'Get in touch', href: route(contact.slug) };
  if (b.phone) return { label: `Call ${b.phone}`, href: telHref(b.phone) };
  return { label: 'Get in touch', href: '#/' };
}
const ACTION_WORD: Partial<Record<Brief['kind'], string>> = {
  barber: 'Book a cut',
  salon: 'Book an appointment',
  trades: 'Get a free quote',
  gym: 'Book a free session',
  photographer: 'Check my dates',
  clinic: 'Book an appointment',
  estate: 'Book a valuation',
  restaurant: 'Book a table',
  cafe: 'Find us',
  portfolio: 'Start a project',
  event: 'Get tickets',
  charity: 'Get involved',
  saas: 'Get started',
  shop: 'Visit the shop',
};

/** The pages that appear in the navigation (home first). */
export const navPages = (plan: Plan): Page[] => plan.pages.filter((p) => p.nav !== false);
