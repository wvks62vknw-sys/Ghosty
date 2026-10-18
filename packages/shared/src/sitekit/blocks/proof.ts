/**
 * Proof: what other people say and who is behind the business. Every block here draws only what the
 * owner actually gave — real reviews, real people, real accreditations, real work — and is left out of
 * a page without it (BlockDef.needs). Nothing here is ever invented by the writers.
 */
import { a, esc, icon, img, imgOf, isImage, linkOf, list, str } from '../html';
import type { BlockDef, ImageRef } from '../types';
import { HEAD, IMG, LINK, LIST, OT, T, head, initials, sec } from './common';

const stars = (n: number) => {
  const k = Math.max(0, Math.min(5, Math.round(n)));
  return k ? `<span class="stars" role="img" aria-label="${k} out of 5 stars">${icon('star').repeat(k)}</span>` : '';
};

export const proofBlocks: BlockDef[] = [
  {
    id: 'logos',
    group: 'proof',
    about: 'A quiet row of accreditations, memberships or places featured (Gas Safe, NICEIC, a local paper) as typeset names. Only ones the owner named.',
    slots: { title: OT(60, 'e.g. "Registered and insured"'), items: { t: 'texts', max: 8, each: 40 } },
    needs: ['accreditations'],
    css: `.b-logos{padding-block:var(--space-l)}
.b-logos .wrap{display:grid;gap:var(--space-s);justify-items:center;text-align:center}
.b-logos h2{font:600 var(--step--1)/1.2 var(--font-body);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.b-logos ul{list-style:none;display:flex;flex-wrap:wrap;justify-content:center;gap:var(--space-xs) var(--space-l)}
.b-logos li{display:inline-flex;align-items:center;gap:.5em;font:var(--display-weight) var(--step-1)/1.2 var(--font-display);letter-spacing:var(--display-tracking);color:var(--text);opacity:.82}
.b-logos li .ic{width:20px;height:20px;color:var(--primary)}`,
    render(d, x) {
      const items = (Array.isArray(d.items) ? (d.items as unknown[]) : []).filter((t): t is string => typeof t === 'string' && !!t.trim()).slice(0, 8);
      return sec('logos', x, `<div class="wrap">${str(d, 'title') ? `<h2>${esc(str(d, 'title'))}</h2>` : ''}<ul>${items.map((t) => `<li>${icon('shield')}${esc(t)}</li>`).join('')}</ul></div>`, { tight: true, label: str(d, 'title') || 'Accreditations' });
    },
  },
  {
    id: 'testimonials-grid',
    group: 'proof',
    about: 'Two to six real reviews as cards with stars, the words and who said them, and a link to the full reviews (Google, Facebook). Only reviews the owner passed on.',
    slots: { ...HEAD, items: LIST({ quote: T(320), name: T(40), detail: OT(40), rating: { t: 'number', optional: true } }, 6, 1), link: LINK('where the full reviews are') },
    needs: ['reviews'],
    css: `.b-testimonials-grid .cards{columns:1;column-gap:var(--space-s)}
.b-testimonials-grid figure{break-inside:avoid;margin:0 0 var(--space-s);display:grid;gap:var(--space-s);padding:var(--space-m);background:var(--surface);border:1px solid var(--border);border-radius:var(--r2)}
.b-testimonials-grid blockquote{margin:0;font-size:var(--step-1);line-height:1.5}
.b-testimonials-grid figcaption{display:flex;align-items:center;gap:.75em}
.b-testimonials-grid .av{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:var(--surface-2);font-weight:700;font-size:.9rem}
.b-testimonials-grid figcaption b{display:block;font-weight:600}
.b-testimonials-grid figcaption small{color:var(--muted)}
.b-testimonials-grid .more{margin-top:var(--space-m);text-align:center}
@media (min-width:640px){.b-testimonials-grid .cards{columns:2}}
@media (min-width:1000px){.b-testimonials-grid .cards{columns:3}}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'items').slice(0, 6);
      const l = linkOf(d, 'link');
      return sec('testimonials-grid', x, `<div class="wrap">${head(d, { center: true })}<div class="cards">${items.map((r) => `<figure class="reveal">${stars(Number(r.rating ?? 5))}<blockquote><p>“${esc(str(r, 'quote'))}”</p></blockquote><figcaption><span class="av" aria-hidden="true">${esc(initials(str(r, 'name')))}</span><span><b>${esc(str(r, 'name'))}</b>${str(r, 'detail') ? `<small>${esc(str(r, 'detail'))}</small>` : ''}</span></figcaption></figure>`).join('')}</div>${l ? `<p class="more">${a(l.href, `${esc(l.label)} ${icon('external')}`, 'btn btn-outline btn-sm')}</p>` : ''}</div>`);
    },
  },
  {
    id: 'testimonial-feature',
    group: 'proof',
    about: 'One real review, large and centred, with who said it. Lets a single strong quote do the work.',
    slots: { quote: T(320), name: T(40), detail: OT(60), rating: { t: 'number', optional: true }, image: IMG('optional portrait', true) },
    needs: ['reviews'],
    css: `.b-testimonial-feature figure{margin:0 auto;max-width:900px;display:grid;justify-items:center;text-align:center;gap:var(--space-m)}
.b-testimonial-feature .q{color:var(--primary);width:44px;height:44px}
.tone-inverse.b-testimonial-feature .q{color:inherit;opacity:.6}
.b-testimonial-feature blockquote{margin:0;font:var(--display-weight) var(--step-3)/1.3 var(--font-display);letter-spacing:var(--display-tracking);text-transform:none;text-wrap:balance}
.b-testimonial-feature figcaption{display:flex;align-items:center;gap:.8em;text-align:left}
.b-testimonial-feature figcaption img{width:52px;height:52px;border-radius:50%;object-fit:cover}
.b-testimonial-feature figcaption small{display:block;color:var(--muted)}`,
    render(d, x) {
      const image = imgOf(d, 'image');
      return sec('testimonial-feature', x, `<div class="wrap"><figure class="reveal">${icon('quote').replace('class="ic"', 'class="ic q"')}${stars(Number(d.rating ?? 5))}<blockquote><p>${esc(str(d, 'quote'))}</p></blockquote><figcaption>${image ? img(image, { sizes: '52px' }) : ''}<span><b>${esc(str(d, 'name'))}</b>${str(d, 'detail') ? `<small>${esc(str(d, 'detail'))}</small>` : ''}</span></figcaption></figure></div>`);
    },
  },
  {
    id: 'team',
    group: 'proof',
    about: 'The people: photo (or a monogram), name, role and a line each. Only the real team.',
    slots: { ...HEAD, people: LIST({ name: T(40), role: T(48), bio: OT(200), photo: IMG(undefined, true) }, 8, 1) },
    needs: ['team'],
    css: `.b-team .grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))}
.b-team .person{display:grid;gap:var(--space-2xs)}
.b-team .media{aspect-ratio:4/5;margin-bottom:var(--space-xs);border-radius:var(--r2)}
.b-team .mono{display:grid;place-items:center;aspect-ratio:4/5;border-radius:var(--r2);background:linear-gradient(160deg,var(--surface-2),var(--border));font:var(--display-weight) var(--step-4)/1 var(--font-display);color:var(--muted);margin-bottom:var(--space-xs)}
.b-team .role{color:var(--primary);font-weight:600;font-size:var(--step--1);letter-spacing:.06em;text-transform:uppercase}
.tone-inverse.b-team .role{color:inherit;opacity:.8}
.b-team .bio{color:var(--muted)}`,
    render(d, x) {
      const people = list<Record<string, unknown>>(d, 'people').slice(0, 8);
      return sec('team', x, `<div class="wrap">${head(d)}<div class="grid">${people.map((p) => {
        const photo = imgOf(p, 'photo');
        return `<article class="person reveal">${photo ? `<div class="media">${img(photo, { sizes: '(min-width:900px) 280px, 50vw' })}</div>` : `<div class="mono" aria-hidden="true">${esc(initials(str(p, 'name')))}</div>`}<h3>${esc(str(p, 'name'))}</h3><p class="role">${esc(str(p, 'role'))}</p>${str(p, 'bio') ? `<p class="bio">${esc(str(p, 'bio'))}</p>` : ''}</article>`;
      }).join('')}</div></div>`);
    },
  },
  {
    id: 'case-studies',
    group: 'proof',
    about: 'Selected work as cards: photo, tag, title, a line and the result. A portfolio, a builder\'s jobs, a product\'s customers. Only real projects.',
    slots: { ...HEAD, items: LIST({ title: T(60), summary: OT(200), result: OT(80), tag: OT(24), image: IMG() }, 6, 1) },
    needs: ['projects'],
    css: `.b-case-studies .grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr))}
.b-case-studies article{display:grid;gap:var(--space-xs);align-content:start}
.b-case-studies .media{aspect-ratio:3/2;margin-bottom:var(--space-xs)}
.b-case-studies .media img{transition:transform var(--t-slow) var(--ease)}
.b-case-studies article:hover .media img{transform:scale(1.04)}
.b-case-studies .tag{justify-self:start}
.b-case-studies p{color:var(--muted)}
.b-case-studies .result{display:flex;align-items:center;gap:.5em;color:var(--text);font-weight:600}
.b-case-studies .result .ic{color:var(--primary);width:20px;height:20px}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'items').slice(0, 6);
      return sec('case-studies', x, `<div class="wrap">${head(d, { split: true })}<div class="grid">${items.map((p) => {
        const image = imgOf(p, 'image');
        return `<article class="reveal">${image ? `<div class="media">${img(image, { sizes: '(min-width:900px) 380px, 100vw' })}</div>` : ''}${str(p, 'tag') ? `<span class="badge tag">${esc(str(p, 'tag'))}</span>` : ''}<h3>${esc(str(p, 'title'))}</h3>${str(p, 'summary') ? `<p>${esc(str(p, 'summary'))}</p>` : ''}${str(p, 'result') ? `<p class="result">${icon('check-circle')}${esc(str(p, 'result'))}</p>` : ''}</article>`;
      }).join('')}</div></div>`);
    },
  },
];

export const imageList = (v: unknown): ImageRef[] => (Array.isArray(v) ? v.map((i) => (isImage(i) ? i : i && typeof i === 'object' && isImage((i as Record<string, unknown>).image) ? ((i as Record<string, unknown>).image as ImageRef) : undefined)).filter((i): i is ImageRef => !!i) : []);
