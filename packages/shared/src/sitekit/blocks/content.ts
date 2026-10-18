/**
 * The middle of a page: what you do (feature grid and checklist), the story (alternating photo and
 * text, about), how it works (steps, timeline), numbers, places covered, questions, plain text, and the
 * calls to action that close a page.
 */
import { a, btn, esc, icon, img, imgOf, linkOf, list, primaryAction, rich, str, texts } from '../html';
import type { BlockDef } from '../types';
import { HEAD, ICON, IMG, LINK, LIST, OT, T, TEXTS, head, sec } from './common';

export const contentBlocks: BlockDef[] = [
  {
    id: 'features-grid',
    group: 'content',
    about: 'Three to six short cards, each an icon, a title and a sentence: services, reasons to choose you, what is included.',
    slots: { ...HEAD, items: LIST({ icon: ICON, title: T(48), text: T(180), link: LINK() }, 6, 2) },
    css: `.b-features-grid .cards{display:grid;gap:var(--space-s);grid-template-columns:1fr}
@media (min-width:600px){.b-features-grid .cards{grid-template-columns:repeat(2,1fr)}}
@media (min-width:900px){.b-features-grid .cards{grid-template-columns:repeat(var(--cols),1fr)}}
.b-features-grid .card{display:grid;align-content:start;gap:var(--space-xs);padding:var(--space-m);transition:transform var(--t-mid) var(--ease),box-shadow var(--t-mid) var(--ease)}
.b-features-grid .card:hover{transform:translateY(-3px);box-shadow:var(--shadow-2)}
.b-features-grid .ico{display:grid;place-items:center;width:52px;height:52px;border-radius:var(--r2);background:rgb(var(--rgb-primary) / .1);color:var(--primary);margin-bottom:var(--space-2xs)}
.b-features-grid .card p{color:var(--muted)}
.b-features-grid .card a{font-weight:600;text-decoration:none;display:inline-flex;gap:.4em;align-items:center;margin-top:auto;min-height:44px}
.b-features-grid .card a .ic{width:18px;height:18px}
.tone-inverse.b-features-grid .card{background:rgb(var(--rgb-bg) / .06);border-color:rgb(var(--rgb-bg) / .14);color:inherit}
.tone-inverse.b-features-grid .ico{background:rgb(var(--rgb-bg) / .12);color:inherit}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'items').slice(0, 6);
      const cards = items.map((it) => {
        const l = linkOf(it, 'link');
        return `<article class="card reveal"><span class="ico">${icon(str(it, 'icon') || 'check')}</span><h3>${esc(str(it, 'title'))}</h3><p>${esc(str(it, 'text'))}</p>${l ? a(l.href, `${esc(l.label)}${icon('arrow')}`) : ''}</article>`;
      });
      // Rows that come out even on a laptop: 4 across for four, 3 for three or six, 2 for two.
      const cols = items.length === 4 ? 4 : items.length === 2 ? 2 : 3;
      return sec('features-grid', x, `<div class="wrap">${head(d)}<div class="cards" style="--cols:${cols}">${cards.join('')}</div></div>`);
    },
  },
  {
    id: 'features-list',
    group: 'content',
    about: 'Heading and a button on one side, a ruled checklist of reasons or inclusions on the other. Good for "why us" and "what is included".',
    slots: { ...HEAD, items: LIST({ title: T(60), text: OT(160) }, 8, 3), link: LINK('a button under the heading') },
    css: `.b-features-list .wrap{display:grid;gap:var(--space-xl)}
.b-features-list .head{margin:0}
.b-features-list ul{list-style:none;display:grid}
.b-features-list li{display:grid;grid-template-columns:auto 1fr;gap:var(--space-s);padding:var(--space-s) 0;border-top:1px solid var(--border)}
.b-features-list li:last-child{border-bottom:1px solid var(--border)}
.b-features-list li .ic{color:var(--primary);margin-top:.15em}
.b-features-list li b{display:block;font-weight:600}
.b-features-list li span{color:var(--muted)}
.b-features-list .btns{margin-top:var(--space-m)}
@media (min-width:900px){.b-features-list .wrap{grid-template-columns:.9fr 1.1fr;gap:var(--space-2xl)}.b-features-list .side{position:sticky;top:110px;align-self:start}}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'items').slice(0, 8);
      const l = linkOf(d, 'link');
      const side = `<div class="side">${head({ ...d, link: undefined })}${l ? `<div class="btns">${btn(l, 'btn-primary', 'arrow')}</div>` : ''}</div>`;
      return sec('features-list', x, `<div class="wrap">${side}<ul>${items.map((it) => `<li class="reveal">${icon('check-circle')}<div><b>${esc(str(it, 'title'))}</b>${str(it, 'text') ? `<span>${esc(str(it, 'text'))}</span>` : ''}</div></li>`).join('')}</ul></div>`);
    },
  },
  {
    id: 'media-text',
    group: 'content',
    about: 'Rows of a photo beside a short story, alternating sides: the place, the craft, the people. One to three rows.',
    slots: { rows: LIST({ eyebrow: OT(40), title: T(70), text: T(420, 'two or three sentences'), points: TEXTS(4, 60), image: IMG(), link: LINK() }, 3, 1) },
    css: `.b-media-text .rows{display:grid;gap:var(--space-2xl)}
.b-media-text .row{display:grid;gap:var(--space-l);align-items:center}
.b-media-text .media{aspect-ratio:4/3;box-shadow:var(--shadow-2)}
.b-media-text h2{font-size:var(--step-3);max-width:18ch}
.b-media-text .txt>*+*{margin-top:var(--space-s)}
.b-media-text .txt p{color:var(--muted);max-width:56ch}
.b-media-text ul{list-style:none;display:grid;gap:.45em}
.b-media-text li{display:flex;gap:.55em;align-items:flex-start}
.b-media-text li .ic{color:var(--primary);width:20px;height:20px;margin-top:.2em}
@media (min-width:900px){.b-media-text .row{grid-template-columns:1fr 1fr;gap:var(--space-2xl)}.b-media-text .row:nth-child(even) .media{order:2}}`,
    render(d, x) {
      const rows = list<Record<string, unknown>>(d, 'rows').slice(0, 3);
      return sec('media-text', x, `<div class="wrap rows">${rows.map((r) => {
        const image = imgOf(r, 'image');
        const pts = texts(r, 'points').slice(0, 4);
        const l = linkOf(r, 'link');
        return `<div class="row">${image ? `<div class="media reveal">${img(image, { sizes: '(min-width:900px) 580px, 100vw' })}</div>` : ''}<div class="txt reveal">${str(r, 'eyebrow') ? `<p class="eyebrow">${esc(str(r, 'eyebrow'))}</p>` : ''}<h2>${rich(str(r, 'title'))}</h2>${str(r, 'text').split(/\n+/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('')}${pts.length ? `<ul>${pts.map((p) => `<li>${icon('check')}${esc(p)}</li>`).join('')}</ul>` : ''}${l ? `<p>${btn(l, 'btn-outline', 'arrow')}</p>` : ''}</div></div>`;
      }).join('')}</div>`);
    },
  },
  {
    id: 'process-steps',
    group: 'content',
    about: 'How it works in three or four numbered steps (book, we come out, done). Reassuring for trades, clinics, services.',
    slots: { ...HEAD, steps: LIST({ title: T(48), text: T(160) }, 4, 3) },
    css: `.b-process-steps ol{list-style:none;display:grid;gap:var(--space-l);counter-reset:s}
.b-process-steps li{counter-increment:s;position:relative;padding-top:var(--space-l);border-top:2px solid var(--border)}
.b-process-steps li::before{content:counter(s,decimal-leading-zero);position:absolute;top:-1px;left:0;transform:translateY(-50%);padding-right:.6em;background:var(--sec-bg,var(--bg));font:var(--display-weight) var(--step-2)/1 var(--font-display);color:var(--primary)}
.tone-alt.b-process-steps{--sec-bg:var(--surface-2)}
.tone-inverse.b-process-steps{--sec-bg:var(--inv-bg,var(--text))}
.tone-inverse.b-process-steps li::before{color:inherit}
.b-process-steps h3{margin-bottom:var(--space-2xs)}
.b-process-steps p{color:var(--muted)}
@media (min-width:900px){.b-process-steps ol{grid-template-columns:repeat(var(--n),1fr)}}`,
    render(d, x) {
      const steps = list<Record<string, unknown>>(d, 'steps').slice(0, 4);
      return sec('process-steps', x, `<div class="wrap">${head(d)}<ol style="--n:${Math.max(1, steps.length)}">${steps.map((s) => `<li class="reveal"><h3>${esc(str(s, 'title'))}</h3><p>${esc(str(s, 'text'))}</p></li>`).join('')}</ol></div>`);
    },
  },
  {
    id: 'stats',
    group: 'proof',
    about: 'Three or four big numbers with labels. Only true numbers the owner gave (years trading, rating, members) — never invented.',
    slots: { ...HEAD, items: LIST({ value: T(12, 'e.g. "15+", "4.9★"'), label: T(48) }, 4, 2) },
    css: `.b-stats .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:var(--space-m)}
.b-stats .stat{padding-top:var(--space-s);border-top:1px solid var(--border)}
.b-stats .stat b{display:block;font:var(--display-weight) var(--step-5)/1 var(--font-display);letter-spacing:var(--display-tracking);color:var(--hl,var(--primary))}
.b-stats .stat span{display:block;margin-top:var(--space-2xs);color:var(--muted)}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'items').slice(0, 4);
      return sec('stats', x, `<div class="wrap">${head(d)}<div class="row">${items.map((s) => `<p class="stat reveal"><b>${esc(str(s, 'value'))}</b><span>${esc(str(s, 'label'))}</span></p>`).join('')}</div></div>`, { tight: !str(d, 'title') });
    },
  },
  {
    id: 'timeline',
    group: 'content',
    about: 'A vertical story in dated steps: how the business started and grew, or the day of an event.',
    slots: { ...HEAD, items: LIST({ when: T(24), title: T(60), text: OT(200) }, 8, 2) },
    css: `.b-timeline ol{list-style:none;position:relative;display:grid;gap:var(--space-l);max-width:760px;padding-left:var(--space-l)}
.b-timeline ol::before{content:"";position:absolute;left:6px;top:8px;bottom:8px;width:2px;background:var(--border)}
.b-timeline li{position:relative}
.b-timeline li::before{content:"";position:absolute;left:calc(-1 * var(--space-l) + 1px);top:.45em;width:12px;height:12px;border-radius:50%;background:var(--primary);box-shadow:0 0 0 5px var(--sec-bg,var(--bg))}
.tone-alt.b-timeline{--sec-bg:var(--surface-2)}
.b-timeline .when{font-size:var(--step--1);font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.b-timeline h3{margin:.2em 0 .3em}
.b-timeline p{color:var(--muted)}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'items').slice(0, 8);
      return sec('timeline', x, `<div class="wrap">${head(d)}<ol>${items.map((i) => `<li class="reveal"><span class="when">${esc(str(i, 'when'))}</span><h3>${esc(str(i, 'title'))}</h3>${str(i, 'text') ? `<p>${esc(str(i, 'text'))}</p>` : ''}</li>`).join('')}</ol></div>`);
    },
  },
  {
    id: 'about-story',
    group: 'content',
    about: 'The story in the owner\'s voice: a large opening line, two short paragraphs, a photo, and a sign-off with the owner\'s name.',
    slots: { eyebrow: OT(40), intro: T(220, 'one big opening sentence'), body: T(900, 'two or three short paragraphs, separated by blank lines'), image: IMG('a portrait of the owner or the place'), signoff: OT(60, 'the owner\'s name and role') },
    css: `.b-about-story .wrap{display:grid;gap:var(--space-xl);align-items:start}
.b-about-story .intro{font:var(--display-weight) var(--step-3)/1.2 var(--font-display);letter-spacing:var(--display-tracking);text-wrap:balance}
.b-about-story .body{display:grid;gap:var(--space-s);margin-top:var(--space-l);color:var(--muted);max-width:58ch}
.b-about-story .sign{margin-top:var(--space-l);font-weight:600;display:flex;align-items:center;gap:.7em}
.b-about-story .sign::before{content:"";width:36px;height:2px;background:var(--primary)}
.b-about-story .media{aspect-ratio:4/5;box-shadow:var(--shadow-2)}
@media (min-width:900px){.b-about-story .wrap{grid-template-columns:1.2fr .8fr;gap:var(--space-2xl)}.b-about-story .media{position:sticky;top:110px}}`,
    render(d, x) {
      const image = imgOf(d, 'image');
      const body = str(d, 'body').split(/\n\s*\n|\n/).filter(Boolean).slice(0, 4);
      return sec('about-story', x, `<div class="wrap"><div class="reveal">${str(d, 'eyebrow') ? `<p class="eyebrow">${esc(str(d, 'eyebrow'))}</p>` : ''}<h2 class="intro">${rich(str(d, 'intro'))}</h2><div class="body">${body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>${str(d, 'signoff') ? `<p class="sign">${esc(str(d, 'signoff'))}</p>` : ''}</div>${image ? `<div class="media reveal">${img(image, { sizes: '(min-width:900px) 440px, 100vw' })}</div>` : ''}</div>`);
    },
  },
  {
    id: 'areas-served',
    group: 'content',
    about: 'The towns and areas covered, as chips, with a line about call-out times. Trades and mobile services.',
    slots: { ...HEAD, areas: TEXTS(24, 32, 'towns and areas'), note: OT(160) },
    css: `.b-areas-served .chips{list-style:none;display:flex;flex-wrap:wrap;gap:.55em}
.b-areas-served .chips li{display:inline-flex;align-items:center;gap:.4em;padding:.55em 1em;border-radius:999px;border:1px solid var(--border);background:var(--surface);font-weight:500}
.b-areas-served .chips .ic{width:16px;height:16px;color:var(--primary)}
.b-areas-served .note{margin-top:var(--space-m);color:var(--muted)}`,
    render(d, x) {
      const areas = texts(d, 'areas').slice(0, 24);
      return sec('areas-served', x, `<div class="wrap">${head(d)}<ul class="chips reveal">${areas.map((t) => `<li>${icon('pin')}${esc(t)}</li>`).join('')}</ul>${str(d, 'note') ? `<p class="note">${esc(str(d, 'note'))}</p>` : ''}</div>`);
    },
  },
  {
    id: 'cta-banner',
    group: 'cta',
    about: 'A strong closing band in the brand colour: one line, one sentence, the main action and the phone. End of most pages.',
    slots: { title: T(70), text: OT(180), primary: LINK(), secondary: LINK() },
    css: `.b-cta-banner .box{position:relative;overflow:hidden;display:grid;gap:var(--space-m);padding:var(--space-xl) var(--space-l);border-radius:var(--r3);background:var(--primary);color:var(--on-primary)}
.b-cta-banner .box::after{content:"";position:absolute;right:-80px;top:-80px;width:320px;height:320px;border-radius:50%;border:56px solid currentColor;opacity:.07;pointer-events:none}
.b-cta-banner h2{font-size:var(--step-4);max-width:18ch;color:inherit}
.b-cta-banner h2 em{color:inherit}
.b-cta-banner p{opacity:.88;max-width:52ch}
.b-cta-banner .btn-primary{--b-bg:var(--on-primary);--b-fg:var(--primary);--b-line:var(--on-primary)}
.b-cta-banner .btn-outline{--b-fg:var(--on-primary);--b-line:color-mix(in srgb,var(--on-primary) 50%,transparent)}
@media (min-width:900px){.b-cta-banner .box{grid-template-columns:1.3fr auto;align-items:center;padding:var(--space-2xl) var(--space-xl)}}`,
    render(d, x) {
      const p = linkOf(d, 'primary') ?? primaryAction(x.brief, x.plan);
      const s = linkOf(d, 'secondary') ?? (x.brief.phone && !p.href.startsWith('tel:') ? { label: x.brief.phone, href: `tel:${x.brief.phone.replace(/[^\d+]/g, '')}` } : undefined);
      return sec('cta-banner', x, `<div class="wrap"><div class="box reveal"><div><h2>${rich(str(d, 'title'))}</h2>${str(d, 'text') ? `<p style="margin-top:var(--space-s)">${esc(str(d, 'text'))}</p>` : ''}</div><div class="btns">${btn(p, 'btn-primary', 'arrow')}${s ? btn(s, 'btn-outline', s.href.startsWith('tel:') ? 'phone' : '') : ''}</div></div></div>`, { tight: true });
    },
  },
  {
    id: 'cta-split',
    group: 'cta',
    about: 'A photo with a card overlapping it: a title, a sentence and the main action. A softer close than the banner.',
    slots: { eyebrow: OT(40), title: T(70), text: OT(220), primary: LINK(), image: IMG() },
    css: `.b-cta-split .wrap{display:grid;align-items:center}
.b-cta-split .media{aspect-ratio:16/10}
.b-cta-split .card{position:relative;margin:-15% var(--space-s) 0;padding:var(--space-l);box-shadow:var(--shadow-3);border-radius:var(--r3);display:grid;gap:var(--space-s)}
.b-cta-split h2{font-size:var(--step-3)}
.b-cta-split p{color:var(--muted)}
@media (min-width:900px){.b-cta-split .wrap{grid-template-columns:1.25fr .75fr}.b-cta-split .media{grid-column:1/3;grid-row:1;aspect-ratio:21/9;margin-right:20%}.b-cta-split .card{grid-column:2;grid-row:1;margin:0}}`,
    render(d, x) {
      const image = imgOf(d, 'image');
      const p = linkOf(d, 'primary') ?? primaryAction(x.brief, x.plan);
      return sec('cta-split', x, `<div class="wrap">${image ? `<div class="media">${img(image, { sizes: '(min-width:900px) 900px, 100vw' })}</div>` : ''}<div class="card reveal">${str(d, 'eyebrow') ? `<p class="eyebrow" style="margin:0">${esc(str(d, 'eyebrow'))}</p>` : ''}<h2>${rich(str(d, 'title'))}</h2>${str(d, 'text') ? `<p>${esc(str(d, 'text'))}</p>` : ''}<div class="btns">${btn(p, 'btn-primary', 'arrow')}</div></div></div>`);
    },
  },
  {
    id: 'faq',
    group: 'content',
    about: 'Frequently asked questions that open and close (no script needed), with the heading beside them on wide screens. Also marked up for search engines.',
    slots: { ...HEAD, items: LIST({ q: T(120), a: T(500) }, 10, 3) },
    css: `.b-faq .wrap{display:grid;gap:var(--space-l)}
.b-faq .head{margin:0}
.b-faq details{border-bottom:1px solid var(--border)}
.b-faq details:first-child{border-top:1px solid var(--border)}
.b-faq summary{display:flex;justify-content:space-between;align-items:center;gap:var(--space-s);min-height:60px;padding:var(--space-s) 0;font-weight:600;font-size:var(--step-1);cursor:pointer;list-style:none}
.b-faq summary::-webkit-details-marker{display:none}
.b-faq summary .ic{transition:transform var(--t-mid) var(--ease);color:var(--primary)}
.b-faq details[open] summary .ic{transform:rotate(45deg)}
.b-faq .ans{padding:0 0 var(--space-m);color:var(--muted);max-width:62ch}
@media (min-width:900px){.b-faq .wrap{grid-template-columns:.8fr 1.2fr;gap:var(--space-2xl)}}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'items').slice(0, 10);
      return sec('faq', x, `<div class="wrap">${head(d)}<div class="qs">${items.map((i) => `<details><summary>${esc(str(i, 'q'))}${icon('plus')}</summary><div class="ans"><p>${esc(str(i, 'a'))}</p></div></details>`).join('')}</div></div>`);
    },
  },
  {
    id: 'rich-text',
    group: 'content',
    about: 'Plain reading text with a heading: a policy, a longer note, terms. Paragraphs separated by blank lines; "## " starts a subheading.',
    slots: { ...HEAD, body: T(4000, 'paragraphs separated by blank lines; a line starting "## " is a subheading, "- " a bullet') },
    css: `.b-rich-text .prose{margin-top:var(--space-m)}
.b-rich-text .prose p,.b-rich-text .prose li{color:var(--muted)}`,
    render(d, x) {
      return sec('rich-text', x, `<div class="wrap narrow">${head(d)}<div class="prose">${prose(str(d, 'body'))}</div></div>`);
    },
  },
];

/** Plain text with "## " subheadings and "- " bullets as HTML (everything escaped). */
export function prose(text: string): string {
  const out: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) out.push(`<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`);
    bullets = [];
  };
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^[-•*]\s+/.test(line)) {
      bullets.push(line.replace(/^[-•*]\s+/, ''));
      continue;
    }
    flush();
    if (/^###?\s+/.test(line)) out.push(`<h3>${esc(line.replace(/^#+\s+/, ''))}</h3>`);
    else if (/^>\s*/.test(line)) out.push(`<blockquote>${esc(line.replace(/^>\s*/, ''))}</blockquote>`);
    else out.push(`<p>${esc(line)}</p>`);
  }
  flush();
  return out.join('');
}

