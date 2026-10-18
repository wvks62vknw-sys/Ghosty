/**
 * Heroes: the first screen of the home page, where a visitor decides in two seconds whether this is the
 * right place. Six layouts — split, full-bleed photo, centred with a collage, editorial, product, and
 * one with a booking card — each with the page's one h1, the main action, and the picture loaded first.
 */
import { a, btn, esc, icon, img, imgOf, isImage, linkOf, list, primaryAction, rich, str, texts } from '../html';
import type { BlockDef, ImageRef, RenderCtx } from '../types';
import { IMG, LINK, LIST, OT, sec, T, TEXTS } from './common';

/** Form fields, notes and errors, shared by every form on a page (hero booking card, booking and contact forms). */
export const FORM_CSS = `.ghost-form{display:grid;gap:var(--space-s)}
.ghost-form .two{display:grid;gap:var(--space-s)}
@media (min-width:600px){.ghost-form .two{grid-template-columns:1fr 1fr}}
.ghost-form .btn{justify-self:start}
.ghost-form .alt{display:flex;flex-wrap:wrap;gap:var(--space-xs)}
.form-note{font-size:var(--step--1);color:var(--muted)}
.form-note.ok{color:var(--text);font-weight:600}
.form-note.bad{color:#b42318;font-weight:600}
.field [aria-invalid=true]{border-color:#b42318}`;

const HERO_SLOTS = {
  eyebrow: OT(48, 'a short line above the headline: place, speciality'),
  title: T(70, 'the headline: what you are, said with confidence; *word* for an accent'),
  lead: OT(220, 'one or two sentences: who it is for and why here'),
  primary: LINK('the main action (default: book / call / quote)'),
  secondary: LINK('a second, quieter action'),
};

const actions = (d: Record<string, unknown>, x: RenderCtx, outline = 'btn-outline') => {
  const p = linkOf(d, 'primary') ?? primaryAction(x.brief, x.plan);
  const s = linkOf(d, 'secondary');
  return `<div class="btns">${btn(p, 'btn-primary', 'arrow')}${s ? btn(s, outline) : ''}</div>`;
};
const words = (d: Record<string, unknown>, cls = 'lead') =>
  `${str(d, 'eyebrow') ? `<p class="eyebrow">${esc(str(d, 'eyebrow'))}</p>` : ''}<h1>${rich(str(d, 'title'))}</h1>${str(d, 'lead') ? `<p class="${cls}">${esc(str(d, 'lead'))}</p>` : ''}`;

export const heroBlocks: BlockDef[] = [
  {
    id: 'hero-split',
    group: 'hero',
    about: 'Headline and actions on the left, a tall photo on the right with a small floating card (hours, a promise). Warm and clear; suits almost anything local.',
    slots: { ...HERO_SLOTS, image: IMG('a tall photo of the place, the work or the people'), card: OT(60, 'the floating card: a short promise or "Open today"'), points: TEXTS(3, 40, 'up to three short reassurances, e.g. "Walk-ins welcome"') },
    css: `.b-hero-split{padding-block:var(--space-xl) var(--space-2xl)}
.b-hero-split .wrap{display:grid;gap:var(--space-xl);align-items:center}
.b-hero-split h1{max-width:13ch}
.b-hero-split .lead{margin-top:var(--space-m)}
.b-hero-split .btns{margin-top:var(--space-l)}
.b-hero-split .points{list-style:none;display:flex;flex-wrap:wrap;gap:.5em 1.4em;margin-top:var(--space-l);color:var(--muted);font-size:var(--step--1);font-weight:500}
.b-hero-split .points li{display:inline-flex;align-items:center;gap:.45em}
.b-hero-split .points .ic{width:18px;height:18px;color:var(--primary)}
.b-hero-split .art{position:relative;margin-inline:auto;width:100%;max-width:560px}
.b-hero-split .art::before{content:"";position:absolute;inset:8% -4% -4% 10%;border-radius:var(--r3);background:var(--surface-2)}
.b-hero-split .media{aspect-ratio:4/5;box-shadow:var(--shadow-3)}
.b-hero-split .float{position:absolute;left:-2%;bottom:7%;display:flex;align-items:center;gap:.75em;max-width:78%;padding:.85em 1.1em;border-radius:var(--r2);background:var(--surface);color:var(--text);box-shadow:var(--shadow-3);font-weight:600;font-size:var(--step--1);line-height:1.35}
.b-hero-split .float .dot{width:10px;height:10px;border-radius:50%;background:#22a05a;box-shadow:0 0 0 4px rgb(34 160 90 / .18);flex:none}
@media (min-width:900px){.b-hero-split .wrap{grid-template-columns:1.05fr .95fr;gap:var(--space-2xl)}.b-hero-split{padding-block:var(--space-2xl) var(--space-3xl)}.b-hero-split .float{left:-10%}}
@media (max-width:599px){.b-hero-split .media{aspect-ratio:4/4.4}}`,
    render(d, x) {
      const image = imgOf(d, 'image');
      const card = str(d, 'card');
      const pts = texts(d, 'points').slice(0, 3);
      const inner = `<div class="wrap"><div class="copy">${words(d)}${actions(d, x)}${pts.length ? `<ul class="points">${pts.map((p) => `<li>${icon('check')}${esc(p)}</li>`).join('')}</ul>` : ''}</div>${image ? `<div class="art"><div class="media">${img(image, { eager: true, sizes: '(min-width:900px) 560px, 100vw' })}</div>${card ? `<p class="float"><span class="dot" aria-hidden="true"></span>${esc(card)}</p>` : ''}</div>` : ''}</div>`;
      return sec('hero-split', x, inner);
    },
  },
  {
    id: 'hero-image',
    group: 'hero',
    about: 'A full-bleed photograph with the headline over a dark gradient and three quick facts along the bottom (hours, where, phone). Bold; needs one great wide photo.',
    slots: { ...HERO_SLOTS, image: IMG('a great wide photo; the text sits on its lower left'), facts: LIST({ icon: OT(24), label: T(24), value: T(48) }, 3, 0, 'up to three quick facts: hours, area, phone') },
    css: `.b-hero-image{position:relative;isolation:isolate;display:flex;align-items:flex-end;min-height:min(92dvh,860px);padding:calc(var(--space-3xl) + 40px) 0 0;color:#fff;background:#141210;overflow:hidden}
.b-hero-image .bg{position:absolute;inset:0;z-index:-2}
.b-hero-image .bg img{width:100%;height:100%;object-fit:cover;color:transparent}
.b-hero-image::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(0 0 0 / .45) 0%,rgb(0 0 0 / .18) 30%,rgb(0 0 0 / .55) 62%,rgb(0 0 0 / .86) 100%)}
.b-hero-image .wrap{width:min(100% - 2 * var(--gutter),var(--wrap))}
.b-hero-image h1{max-width:14ch;color:#fff;text-shadow:0 2px 30px rgb(0 0 0 / .35)}
.b-hero-image h1 em{color:inherit}
.b-hero-image .eyebrow,.b-hero-image .lead{color:rgb(255 255 255 / .88)}
.b-hero-image .lead{margin-top:var(--space-s)}
.b-hero-image .btns{margin-top:var(--space-l)}
.b-hero-image .btn-primary{--b-bg:#fff;--b-fg:#111;--b-line:#fff}
.b-hero-image .btn-outline{--b-fg:#fff;--b-line:rgb(255 255 255 / .6)}
.b-hero-image .facts{list-style:none;display:grid;margin-top:var(--space-xl);border-top:1px solid rgb(255 255 255 / .25)}
.b-hero-image .facts li{display:flex;align-items:center;gap:.8em;padding:var(--space-s) 0;border-bottom:1px solid rgb(255 255 255 / .14)}
.b-hero-image .facts .ic{color:#fff;opacity:.85}
.b-hero-image .facts small{display:block;font-size:var(--step--1);letter-spacing:.08em;text-transform:uppercase;opacity:.72}
.b-hero-image .facts b{font-weight:600}
.b-hero-image .facts a{text-decoration:none}
@media (min-width:900px){.b-hero-image .facts{grid-template-columns:repeat(3,1fr)}.b-hero-image .facts li{border-bottom:0;padding:var(--space-m) var(--space-m) var(--space-m) 0}.b-hero-image .facts li+li{border-left:1px solid rgb(255 255 255 / .2);padding-left:var(--space-m)}}`,
    render(d, x) {
      const image = imgOf(d, 'image');
      const facts = list<Record<string, unknown>>(d, 'facts').slice(0, 3);
      const factHtml = facts.length
        ? `<ul class="facts">${facts.map((f) => {
            const v = esc(str(f, 'value'));
            const tel = /^\+?[\d\s()]{9,}$/.test(str(f, 'value')) ? a(`tel:${str(f, 'value').replace(/[^\d+]/g, '')}`, v) : v;
            return `<li>${icon(str(f, 'icon') || 'info')}<span><small>${esc(str(f, 'label'))}</small><b>${tel}</b></span></li>`;
          }).join('')}</ul>`
        : '';
      return `<section class="b-hero-image" data-hero="over">${image ? `<div class="bg">${img(image, { eager: true, sizes: '100vw', alt: image.alt })}</div>` : ''}<div class="wrap">${words(d)}${actions(d, x)}${factHtml}</div></section>`;
    },
  },
  {
    id: 'hero-centered',
    group: 'hero',
    about: 'A centred statement with two actions, then a collage of three photos beneath. Calm and premium: clinics, salons, cafés, charities.',
    slots: { ...HERO_SLOTS, images: LIST({ image: IMG() }, 3, 1, 'one to three photos for the collage') },
    css: `.b-hero-centered{padding-block:var(--space-2xl) var(--space-2xl);text-align:center;overflow:hidden}
.b-hero-centered .copy{display:grid;justify-items:center}
.b-hero-centered h1{max-width:16ch}
.b-hero-centered .lead{margin-top:var(--space-m);margin-inline:auto}
.b-hero-centered .btns{justify-content:center;margin-top:var(--space-l)}
.b-hero-centered .collage{display:grid;grid-template-columns:1fr 2.2fr 1fr;gap:var(--space-s);align-items:end;margin-top:var(--space-xl)}
.b-hero-centered .collage .media:nth-child(2){aspect-ratio:16/11;box-shadow:var(--shadow-3)}
.b-hero-centered .collage .media:nth-child(1),.b-hero-centered .collage .media:nth-child(3){aspect-ratio:3/4;transform:translateY(-12%)}
.b-hero-centered .collage.one{grid-template-columns:1fr}
.b-hero-centered .collage.one .media{aspect-ratio:21/9;transform:none}
@media (max-width:599px){.b-hero-centered .collage{grid-template-columns:1fr 1fr;}.b-hero-centered .collage .media:nth-child(2){grid-column:1/-1;grid-row:1}.b-hero-centered .collage .media:nth-child(1),.b-hero-centered .collage .media:nth-child(3){transform:none;aspect-ratio:1}.b-hero-centered .collage.one .media{aspect-ratio:4/3}}`,
    render(d, x) {
      const imgs = list<Record<string, unknown>>(d, 'images').map((i) => (isImage(i) ? (i as unknown as ImageRef) : imgOf(i, 'image'))).filter((i): i is ImageRef => !!i).slice(0, 3);
      const order = imgs.length === 3 ? [imgs[1]!, imgs[0]!, imgs[2]!] : imgs;
      const collage = order.length ? `<div class="collage${order.length === 1 ? ' one' : ''}">${order.map((m, i) => `<div class="media">${img(m, { eager: i === 1 || order.length === 1, sizes: order.length === 1 || i === 1 ? '(min-width:1200px) 640px, 100vw' : '(min-width:900px) 300px, 50vw' })}</div>`).join('')}</div>` : '';
      return sec('hero-centered', x, `<div class="wrap"><div class="copy">${words(d)}${actions(d, x)}</div>${collage}</div>`);
    },
  },
  {
    id: 'hero-editorial',
    group: 'hero',
    about: 'An oversized headline across the page, a short paragraph and actions on one side and a wide photo on the other, with a fine rule: restaurants, photographers, estate agents.',
    slots: { ...HERO_SLOTS, image: IMG('a wide, atmospheric photo'), meta: OT(60, 'a small line on the rule: "Since 2009 · Walsall"') },
    css: `.b-hero-editorial{padding-block:var(--space-xl) var(--space-2xl)}
.b-hero-editorial h1{font-size:clamp(2.7rem,1.3rem + 6.4vw,7.2rem);line-height:.98;max-width:15ch}
.b-hero-editorial .rule{display:flex;justify-content:space-between;gap:var(--space-s);margin:var(--space-l) 0;padding-top:var(--space-s);border-top:1px solid var(--border);font-size:var(--step--1);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.b-hero-editorial .row{display:grid;gap:var(--space-l)}
.b-hero-editorial .side .btns{margin-top:var(--space-m)}
.b-hero-editorial .media{aspect-ratio:3/2}
@media (min-width:900px){.b-hero-editorial .row{grid-template-columns:.8fr 1.6fr;align-items:end}.b-hero-editorial .side{padding-bottom:var(--space-s)}}`,
    render(d, x) {
      const image = imgOf(d, 'image');
      const meta = str(d, 'meta') || [x.brief.established ? `Since ${x.brief.established}` : '', x.brief.town].filter(Boolean).join(' · ');
      const inner = `<div class="wrap">${str(d, 'eyebrow') ? `<p class="eyebrow">${esc(str(d, 'eyebrow'))}</p>` : ''}<h1>${rich(str(d, 'title'))}</h1><div class="rule"><span>${esc(meta)}</span><span aria-hidden="true">${icon('arrow').replace('class="ic"', 'class="ic" style="transform:rotate(90deg);width:18px;height:18px"')}</span></div><div class="row"><div class="side">${str(d, 'lead') ? `<p class="lead">${esc(str(d, 'lead'))}</p>` : ''}${actions(d, x)}</div>${image ? `<div class="media">${img(image, { eager: true, sizes: '(min-width:900px) 760px, 100vw' })}</div>` : ''}</div></div>`;
      return sec('hero-editorial', x, inner);
    },
  },
  {
    id: 'hero-app',
    group: 'hero',
    about: 'A product landing hero: badge, headline, actions, a small note, and a product window drawn in CSS (or a real screenshot). For apps and online services.',
    slots: { ...HERO_SLOTS, note: OT(80, 'small print under the buttons: "Free for 14 days · no card"'), shot: IMG('a real screenshot (optional)', true) },
    css: `.b-hero-app{padding-block:var(--space-2xl) 0;text-align:center;overflow:hidden;background:radial-gradient(60% 50% at 50% 0%,rgb(var(--rgb-primary) / .16),transparent 70%)}
.b-hero-app .copy{display:grid;justify-items:center}
.b-hero-app .eyebrow{padding:.4em .9em;border:1px solid var(--border);border-radius:999px;background:var(--surface);letter-spacing:.04em;text-transform:none;color:var(--text)}
.b-hero-app .eyebrow::before{width:8px;height:8px;border-radius:50%;background:var(--primary);opacity:1}
.b-hero-app h1{max-width:15ch}
.b-hero-app .lead{margin:var(--space-m) auto 0}
.b-hero-app .btns{justify-content:center;margin-top:var(--space-l)}
.b-hero-app .note{margin-top:var(--space-s);font-size:var(--step--1);color:var(--muted)}
.b-hero-app .window{margin:var(--space-xl) auto 0;max-width:1040px;border:1px solid var(--border);border-bottom:0;border-radius:var(--r3) var(--r3) 0 0;background:var(--surface);box-shadow:var(--shadow-3);overflow:hidden;text-align:left}
.b-hero-app .chrome{display:flex;gap:6px;padding:12px 14px;border-bottom:1px solid var(--border)}
.b-hero-app .chrome i{width:10px;height:10px;border-radius:50%;background:var(--border)}
.b-hero-app .ui{display:grid;grid-template-columns:1fr;gap:14px;padding:18px;min-height:260px}
.b-hero-app .ui .side{display:none}
.b-hero-app .ui .tile{border-radius:var(--r2);background:var(--surface-2);padding:14px}
.b-hero-app .ui .tile b{display:block;font:700 var(--step-2)/1 var(--font-display)}
.b-hero-app .ui .tile small{color:var(--muted)}
.b-hero-app .ui .row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.b-hero-app .ui svg.chart{width:100%;height:120px;color:var(--primary)}
.b-hero-app .ui .line{height:10px;border-radius:6px;background:var(--surface-2);margin:10px 0}
@media (min-width:900px){.b-hero-app .ui{grid-template-columns:200px 1fr;padding:22px}.b-hero-app .ui .side{display:block}}
@media (max-width:599px){.b-hero-app .ui .row{grid-template-columns:1fr 1fr}.b-hero-app .ui .row .tile:nth-child(3){display:none}}`,
    render(d, x) {
      const shot = imgOf(d, 'shot');
      const ui = shot
        ? img(shot, { eager: true, sizes: '(min-width:1100px) 1040px, 100vw' })
        : `<div class="ui" aria-hidden="true"><div class="side"><div class="line" style="width:70%"></div><div class="line"></div><div class="line" style="width:85%"></div><div class="line" style="width:60%"></div><div class="line" style="width:75%"></div></div><div><div class="row"><div class="tile"><small>This week</small><b>+24%</b></div><div class="tile"><small>Saved</small><b>6.5 h</b></div><div class="tile"><small>Done</small><b>142</b></div></div><div class="tile" style="margin-top:14px"><svg class="chart" viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 100 C50 90 70 60 120 66 S200 30 250 42 330 10 400 18" fill="none" stroke="currentColor" stroke-width="3"/><path d="M0 100 C50 90 70 60 120 66 S200 30 250 42 330 10 400 18 V120 H0Z" fill="currentColor" opacity=".12"/></svg></div></div></div>`;
      const note = str(d, 'note');
      return sec('hero-app', x, `<div class="wrap"><div class="copy">${words(d)}${actions(d, x)}${note ? `<p class="note">${esc(note)}</p>` : ''}</div><div class="window"><div class="chrome" aria-hidden="true"><i></i><i></i><i></i></div>${ui}</div></div>`);
    },
  },
  {
    id: 'hero-booking',
    group: 'hero',
    about: 'Headline on one side and a quick booking card on the other (service, day, time, name, phone) that sends the request by WhatsApp or email. Barbers, salons, clinics, trades.',
    slots: { ...HERO_SLOTS, image: IMG('a photo behind the card (optional)', true), card: OT(40, 'the card title: "Book in 30 seconds"'), points: TEXTS(3, 40, 'short reassurances') },
    css: `${FORM_CSS}
.b-hero-booking{padding-block:var(--space-xl) var(--space-2xl);position:relative;overflow:hidden}
.b-hero-booking .wrap{display:grid;gap:var(--space-xl);align-items:center}
.b-hero-booking h1{max-width:13ch}
.b-hero-booking .lead{margin-top:var(--space-m)}
.b-hero-booking .btns{margin-top:var(--space-l)}
.b-hero-booking .points{list-style:none;display:grid;gap:.5em;margin-top:var(--space-l);font-weight:500}
.b-hero-booking .points li{display:flex;gap:.6em;align-items:center}
.b-hero-booking .points .ic{color:var(--primary);width:20px;height:20px}
.b-hero-booking .stage{position:relative;padding:var(--space-m) 0}
.b-hero-booking .stage .media{position:absolute;inset:0 0 0 18%;border-radius:var(--r3)}
.b-hero-booking .bookcard{position:relative;width:min(100%,420px);padding:var(--space-m);border-radius:var(--r3);background:var(--surface);color:var(--text);border:1px solid var(--border);box-shadow:var(--shadow-3)}
.b-hero-booking .bookcard h2{font-size:var(--step-2);margin-bottom:var(--space-s)}
.b-hero-booking .bookcard form{display:grid;gap:var(--space-xs)}
.b-hero-booking .bookcard .two{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-xs)}
.b-hero-booking .bookcard .btn{width:100%;margin-top:6px}
@media (min-width:900px){.b-hero-booking .wrap{grid-template-columns:1fr 1fr}.b-hero-booking .stage{padding:var(--space-xl) 0}}
@media (max-width:899px){.b-hero-booking .stage .media{display:none}}`,
    js: ['form'],
    render(d, x) {
      const image = imgOf(d, 'image');
      const pts = texts(d, 'points').slice(0, 3);
      const inner = `<div class="wrap"><div class="copy">${words(d)}${pts.length ? `<ul class="points">${pts.map((p) => `<li>${icon('check-circle')}${esc(p)}</li>`).join('')}</ul>` : ''}</div><div class="stage">${image ? `<div class="media">${img(image, { eager: true, sizes: '(min-width:900px) 520px, 100vw' })}</div>` : ''}<div class="bookcard"><h2>${esc(str(d, 'card') || 'Book in 30 seconds')}</h2>${bookingForm(x, 'hb')}</div></div></div>`;
      return sec('hero-booking', x, inner);
    },
  },
];

/** The booking fields (shared with the booking-form block): sent by the page's script as WhatsApp or email. */
export function bookingForm(x: RenderCtx, id: string, extra = false): string {
  const b = x.brief;
  const services = (b.services ?? []).map((s) => s.name).slice(0, 14);
  const svc = services.length ? `<div class="field"><label for="${id}-svc">Service</label><select id="${id}-svc" name="Service">${services.map((s) => `<option>${esc(s)}</option>`).join('')}<option>Not sure yet</option></select></div>` : '';
  const wa = whatsappOf(b);
  return `<form class="ghost-form" data-kind="booking" data-to-wa="${esc(wa)}" data-to-mail="${esc(b.email ?? '')}" data-to-tel="${esc(b.phone ?? '')}" data-subject="${esc(`Booking request — ${b.name}`)}" novalidate>${svc}<div class="two"><div class="field"><label for="${id}-day">Day</label><input id="${id}-day" name="Day" type="date" required></div><div class="field"><label for="${id}-time">Time</label><select id="${id}-time" name="Time"><option>Morning</option><option>Lunchtime</option><option>Afternoon</option><option>Evening</option><option>Any time</option></select></div></div><div class="field"><label for="${id}-name">Your name</label><input id="${id}-name" name="Name" autocomplete="name" required></div><div class="field"><label for="${id}-phone">Phone</label><input id="${id}-phone" name="Phone" type="tel" autocomplete="tel" inputmode="tel" required></div>${extra ? `<div class="field"><label for="${id}-note">Anything we should know?</label><textarea id="${id}-note" name="Notes" rows="3"></textarea></div>` : ''}<button class="btn btn-primary" type="button" data-via="${wa ? 'whatsapp' : 'email'}">${wa ? `${icon('whatsapp')}Send by WhatsApp` : `${icon('send')}Send request`}</button><p class="form-note" role="status" aria-live="polite">${formNote(x)}</p></form>`;
}

/** Where a form's WhatsApp message goes: the WhatsApp number, else the phone when it is a UK mobile. */
export const whatsappOf = (b: RenderCtx['brief']): string => b.whatsapp || (b.phone && /^(\+44\s?\(?0?\)?\s?7|07)/.test(b.phone.trim()) ? b.phone : '');

/** The honest line under every form: where the message goes. */
export function formNote(x: RenderCtx): string {
  const b = x.brief;
  const ways = [whatsappOf(b) ? 'WhatsApp' : '', b.email ? 'your email app' : ''].filter(Boolean);
  return ways.length ? `Opens ${ways.join(' or ')} with your request filled in — nothing is stored on this site.${b.phone ? ` Or call ${esc(b.phone)}.` : ''}` : b.phone ? `Or call us on ${esc(b.phone)}.` : '';
}
