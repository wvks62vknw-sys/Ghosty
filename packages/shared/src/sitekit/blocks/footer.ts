/**
 * Footers and the reading pages: the full footer (brand, pages, contact, hours, social links and the
 * photo credits the licences ask for), a one-line footer, a list of posts, and an article.
 */
import { a, addressLine, directionsHref, esc, icon, img, imgOf, list, mailHref, navPages, route, str, telHref, texts, waHref } from '../html';
import type { BlockDef, ImageRef, RenderCtx } from '../types';
import { HEAD, IMG, LIST, OT, T, TEXTS, head, initials, sec } from './common';
import { whatsappOf } from './hero';
import { prose } from './content';
import { HOURS_CSS, hoursTable } from './media';

const SOCIAL_BASE: Record<string, string> = { instagram: 'https://www.instagram.com/', facebook: 'https://www.facebook.com/', tiktok: 'https://www.tiktok.com/@', x: 'https://x.com/', linkedin: 'https://www.linkedin.com/company/', youtube: 'https://www.youtube.com/@' };
const LABEL: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', x: 'X', linkedin: 'LinkedIn', youtube: 'YouTube' };

export function socialLinks(x: RenderCtx): string {
  const s = x.brief.socials ?? {};
  const out = Object.entries(s)
    .filter(([k, v]) => SOCIAL_BASE[k] && typeof v === 'string' && v.trim())
    .map(([k, v]) => {
      const href = /^https:\/\//.test(v!) ? v! : `${SOCIAL_BASE[k]}${v!.replace(/^@/, '')}`;
      return a(href, icon(k, LABEL[k]), 'soc');
    });
  return out.length ? `<div class="socials">${out.join('')}</div>` : '';
}

/** The credits the licences ask for: title, author, licence (linked) and where it came from. */
export function creditsList(credits: ImageRef[]): string {
  const seen = new Set<string>();
  const rows = credits.filter((c) => c.credit && !seen.has(c.src) && seen.add(c.src)).map((c) => {
    const k = c.credit!;
    return `<li>${k.title ? `“${esc(k.title)}” ` : ''}by ${esc(k.author || 'unknown')}, ${k.licenseUrl ? a(k.licenseUrl, esc(k.license)) : esc(k.license)}, via ${a(k.sourceUrl, esc(k.source))}</li>`;
  });
  const made = credits.some((c) => c.generated);
  if (!rows.length && !made) return '';
  return `<details class="credits" id="credits"><summary>Photo credits</summary><ul>${rows.join('')}${made ? '<li>Some illustrations were made with an AI picture model.</li>' : ''}</ul></details>`;
}

const FOOT_CSS = `.foot{background:var(--foot-bg);color:var(--foot-fg);padding-block:var(--space-2xl) var(--space-l);--muted:rgb(var(--rgb-foot-fg) / .72);--border:rgb(var(--rgb-foot-fg) / .16)}
.foot a{color:inherit;text-decoration:none}
.foot a:hover{text-decoration:underline}
.foot .brandline{display:flex;align-items:center;gap:.65em;font:var(--display-weight) var(--step-2)/1.1 var(--font-display);letter-spacing:var(--display-tracking);text-transform:var(--display-case)}
.foot .brandline .mark{display:grid;place-items:center;width:44px;height:44px;border-radius:var(--r2);background:var(--foot-fg);color:var(--foot-bg);font:700 .95rem/1 var(--font-body);text-transform:none}
.foot .socials{display:flex;gap:6px;margin-top:var(--space-m)}
.foot .soc{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;border:1px solid var(--border)}
.foot .soc:hover{background:rgb(var(--rgb-foot-fg) / .08);text-decoration:none}
.foot .soc .ic{width:20px;height:20px}
.foot .bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:var(--space-xs) var(--space-m);margin-top:var(--space-xl);padding-top:var(--space-m);border-top:1px solid var(--border);font-size:var(--step--1);color:var(--muted)}
.credits{font-size:var(--step--1);color:var(--muted);flex-basis:100%}
.credits summary{cursor:pointer;min-height:44px;display:inline-flex;align-items:center}
.credits ul{list-style:none;display:grid;gap:.3em;margin-top:.4em}
.credits a{text-decoration:underline}`;

export const footerBlocks: BlockDef[] = [
  {
    id: 'footer-columns',
    group: 'footer',
    about: 'The full footer: brand with a line, the pages, contact details, opening hours, social links, then copyright and photo credits.',
    slots: { blurb: OT(200, 'one line about the business') },
    css: `${FOOT_CSS}
${HOURS_CSS}
.b-footer-columns .cols{display:grid;gap:var(--space-xl)}
.b-footer-columns h2{font:600 var(--step--1)/1.2 var(--font-body);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:var(--space-s)}
.b-footer-columns ul{list-style:none;display:grid;gap:.15em}
.b-footer-columns ul a{display:inline-flex;align-items:center;min-height:40px}
.b-footer-columns .blurb{margin-top:var(--space-s);color:var(--muted);max-width:36ch}
.b-footer-columns .hours th,.b-footer-columns .hours td{padding:.35em 0;border-color:var(--border);font-size:var(--step--1)}
.foot .hours tr.today th,.foot .hours tr.today td{color:inherit}
.b-footer-columns address{font-style:normal;display:grid;gap:.15em}
.b-footer-columns address a,.b-footer-columns address span{display:inline-flex;align-items:center;gap:.55em;min-height:40px}
.b-footer-columns address .ic{width:18px;height:18px;opacity:.8;flex:none}
.callbar{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;gap:8px;padding:10px var(--gutter) calc(10px + env(safe-area-inset-bottom));background:rgb(var(--rgb-bg) / .94);-webkit-backdrop-filter:saturate(1.6) blur(14px);backdrop-filter:saturate(1.6) blur(14px);border-top:1px solid var(--border)}
.callbar .btn{flex:1 1 0;min-height:48px;padding-inline:.8em}
body:has(.callbar){padding-bottom:calc(72px + env(safe-area-inset-bottom))}
@media (min-width:900px){.callbar{display:none}body:has(.callbar){padding-bottom:0}}
@media print{.callbar{display:none}}
@media (min-width:700px){.b-footer-columns .cols{grid-template-columns:1.4fr 1fr 1fr}}
@media (min-width:1000px){.b-footer-columns .cols{grid-template-columns:1.5fr .8fr 1fr 1.1fr}}`,
    render(d, x) {
      const b = x.brief;
      const pages = navPages(x.plan).map((p) => `<li><a href="${route(p.slug)}">${esc(p.label)}</a></li>`).join('');
      const wa = whatsappOf(b);
      const where = addressLine(b) || b.venue || '';
      // The real details, each one a tap away: the address opens directions, the phone rings, WhatsApp and email open.
      const contact = [
        where ? a(directionsHref(b), `${icon('pin')}${esc(where)}`) : b.town ? `<span>${icon('pin')}${esc(b.town)}</span>` : '',
        b.phone ? a(telHref(b.phone), `${icon('phone')}${esc(b.phone)}`) : '',
        wa ? a(waHref(wa), `${icon('whatsapp')}WhatsApp`) : '',
        b.email ? a(mailHref(b.email), `${icon('mail')}${esc(b.email)}`) : '',
      ].filter(Boolean).join('');
      // The blurb never just repeats the name ("Walsall Food Share in Walsall.").
      const name = x.plan.name.toLowerCase();
      const raw = str(d, 'blurb');
      const blurb = raw.toLowerCase().replace(/\.$/, '').split(/\s+in\s+/)[0]!.trim() === name ? '' : raw;
      // On a phone, the two things a visitor most often wants stay at the bottom of the screen.
      const bar = b.phone ? `<div class="callbar no-print">${a(telHref(b.phone), `${icon('phone')}Call`, 'btn btn-primary')}${wa ? a(waHref(wa), `${icon('whatsapp')}WhatsApp`, 'btn btn-outline') : b.email ? a(mailHref(b.email), `${icon('mail')}Email`, 'btn btn-outline') : ''}</div>` : '';
      return `<footer class="foot b-footer-columns"><div class="wrap"><div class="cols"><div><p class="brandline"><span class="mark" aria-hidden="true">${esc(initials(x.plan.name))}</span>${esc(x.plan.name)}</p>${blurb ? `<p class="blurb">${esc(blurb)}</p>` : ''}${socialLinks(x)}</div><nav aria-label="Footer"><h2>Pages</h2><ul>${pages}</ul></nav>${contact ? `<div><h2>Contact</h2><address>${contact}</address></div>` : ''}${b.hours?.length ? `<div><h2>Opening hours</h2>${hoursTable(b.hours)}</div>` : ''}</div><div class="bottom"><span>© <span data-year>${new Date().getFullYear()}</span> ${esc(x.plan.name)}${b.town ? ` · ${esc(b.town)}` : ''}</span><a href="#top">Back to top ↑</a>${creditsList(x.credits)}</div></div></footer>${bar}`;
    },
  },
  {
    id: 'footer-simple',
    group: 'footer',
    about: 'A compact footer on one or two lines: name, a few links, social icons, copyright and credits. For one-page sites and events.',
    slots: {},
    css: `${FOOT_CSS}
.b-footer-simple{padding-block:var(--space-xl) var(--space-l)}
.b-footer-simple .row{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:var(--space-m)}
.b-footer-simple .socials{margin:0}
.b-footer-simple nav ul{list-style:none;display:flex;flex-wrap:wrap;gap:.2em 1.2em}
.b-footer-simple nav a{display:inline-flex;min-height:44px;align-items:center}`,
    render(_d, x) {
      const pages = navPages(x.plan).map((p) => `<li><a href="${route(p.slug)}">${esc(p.label)}</a></li>`).join('');
      return `<footer class="foot b-footer-simple"><div class="wrap"><div class="row"><p class="brandline">${esc(x.plan.name)}</p><nav aria-label="Footer"><ul>${pages}</ul></nav>${socialLinks(x)}</div><div class="bottom"><span>© <span data-year>${new Date().getFullYear()}</span> ${esc(x.plan.name)}</span>${creditsList(x.credits)}</div></div></footer>`;
    },
  },
  {
    id: 'blog-list',
    group: 'blog',
    about: 'News or blog posts as cards: picture, date, category, title, a line, linking to each post\'s page.',
    slots: { ...HEAD, posts: LIST({ title: T(80), excerpt: T(200), date: OT(24), tag: OT(24), slug: T(40, 'the post page\'s slug'), image: IMG(undefined, true) }, 9, 1) },
    css: `.b-blog-list .grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))}
.b-blog-list article{display:grid;gap:var(--space-xs);align-content:start;position:relative}
.b-blog-list .media{aspect-ratio:16/10;margin-bottom:var(--space-2xs)}
.b-blog-list .meta{display:flex;gap:.8em;font-size:var(--step--1);color:var(--muted)}
.b-blog-list h3 a{text-decoration:none}
.b-blog-list h3 a::after{content:"";position:absolute;inset:0}
.b-blog-list article:hover h3{text-decoration:underline;text-decoration-thickness:1px}
.b-blog-list p{color:var(--muted)}`,
    render(d, x) {
      const posts = list<Record<string, unknown>>(d, 'posts').slice(0, 9);
      return sec('blog-list', x, `<div class="wrap">${head(d, { split: true })}<div class="grid">${posts.map((p) => {
        const image = imgOf(p, 'image');
        return `<article class="reveal">${image ? `<div class="media">${img(image, { sizes: '(min-width:900px) 380px, 100vw' })}</div>` : ''}<p class="meta">${str(p, 'date') ? `<span>${esc(str(p, 'date'))}</span>` : ''}${str(p, 'tag') ? `<span>${esc(str(p, 'tag'))}</span>` : ''}</p><h3><a href="${route(str(p, 'slug'))}">${esc(str(p, 'title'))}</a></h3><p>${esc(str(p, 'excerpt'))}</p></article>`;
      }).join('')}</div></div>`);
    },
  },
  {
    id: 'article',
    group: 'blog',
    about: 'One article: category and date, the title (the page\'s h1), the author, a cover picture and the text with subheadings; share by WhatsApp or email at the end.',
    slots: { tag: OT(24), title: T(90), date: OT(24), author: OT(48), image: IMG(undefined, true), body: T(6000, 'paragraphs; "## " subheadings, "- " bullets, "> " a quote'), points: TEXTS(5, 80, 'optional key points box') },
    css: `.b-article .top{display:grid;gap:var(--space-s);max-width:820px;margin-inline:auto;text-align:center;justify-items:center}
.b-article .meta{display:flex;flex-wrap:wrap;justify-content:center;gap:.4em 1em;color:var(--muted);font-size:var(--step--1)}
.b-article h1{font-size:var(--step-4);max-width:22ch}
.b-article .media{aspect-ratio:16/9;margin:var(--space-xl) auto;max-width:1040px}
.b-article .prose{margin-inline:auto;font-size:var(--step-1);line-height:1.7}
.b-article .prose p{color:var(--text)}
.b-article .keys{max-width:var(--measure);margin:0 auto var(--space-l);padding:var(--space-m);border-radius:var(--r2);background:var(--surface-2)}
.b-article .keys ul{list-style:none;display:grid;gap:.4em;margin-top:.4em}
.b-article .keys li{display:flex;gap:.5em}
.b-article .keys .ic{color:var(--primary);width:20px;height:20px;margin-top:.2em}
.b-article .share{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--space-xs);margin-top:var(--space-xl)}`,
    render(d, x) {
      const image = imgOf(d, 'image');
      const title = str(d, 'title');
      const pts = texts(d, 'points').slice(0, 5);
      const words = str(d, 'body').split(/\s+/).length;
      const share = `Worth a read: ${title} — ${x.plan.name}`;
      return sec('article', x, `<article><div class="wrap"><header class="top">${str(d, 'tag') ? `<span class="badge">${esc(str(d, 'tag'))}</span>` : ''}<h1>${esc(title)}</h1><p class="meta">${str(d, 'author') ? `<span>By ${esc(str(d, 'author'))}</span>` : ''}${str(d, 'date') ? `<span>${esc(str(d, 'date'))}</span>` : ''}<span>${Math.max(1, Math.round(words / 220))} min read</span></p></header>${image ? `<div class="media">${img(image, { eager: true, sizes: '(min-width:1100px) 1040px, 100vw' })}</div>` : ''}${pts.length ? `<aside class="keys"><b>In short</b><ul>${pts.map((p) => `<li>${icon('check')}${esc(p)}</li>`).join('')}</ul></aside>` : ''}<div class="prose">${prose(str(d, 'body'))}</div><div class="share">${a(`https://wa.me/?text=${encodeURIComponent(share)}`, `${icon('whatsapp')}Share on WhatsApp`, 'btn btn-outline btn-sm')}${a(mailHref('', title, share), `${icon('mail')}Email it`, 'btn btn-outline btn-sm')}</div></div></article>`);
    },
  },
];
