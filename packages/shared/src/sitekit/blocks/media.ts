/**
 * Pictures and places: a gallery grid that opens a full-screen viewer, a swipeable strip, an Instagram
 * style grid with the handle, the map (an OpenStreetMap embed with the address card and directions), and
 * the opening hours with "open now".
 */
import { a, addressLine, btn, directionsHref, esc, icon, img, list, mailHref, mapsHref, str, telHref, waHref } from '../html';
import type { BlockDef, Brief, Hours } from '../types';
import { HEAD, LIST, OT, head, sec } from './common';
import { whatsappOf } from './hero';
import { imageList } from './proof';

/** The OpenStreetMap embed for a point (published pages may frame www.openstreetmap.org). */
export function osmEmbed(lat: number, lon: number, zoom = 0.006): string {
  const bbox = [lon - zoom * 1.6, lat - zoom, lon + zoom * 1.6, lat + zoom].map((n) => n.toFixed(5)).join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lon.toFixed(5)}`;
}

/** The hours table; the page's script marks today and says whether it is open now. */
export function hoursTable(hours: Hours[]): string {
  return `<table class="hours" data-hours="${esc(JSON.stringify(hours.map((h) => ({ d: h.days ?? [], o: h.open ?? '', c: h.close ?? '', x: !!h.closed }))))}"><tbody>${hours.map((h) => `<tr${h.days?.length ? ` data-days="${h.days.join(',')}"` : ''}><th scope="row">${esc(h.label)}</th><td>${h.closed ? 'Closed' : `${esc(h.open ?? '')}–${esc(h.close ?? '')}`}</td></tr>`).join('')}</tbody></table>`;
}

export const HOURS_CSS = `.hours{width:100%;border-collapse:collapse}
.hours th,.hours td{padding:.55em 0;border-bottom:1px solid var(--border);text-align:left;font-weight:400}
.hours td{text-align:right;font-variant-numeric:tabular-nums}
.hours tr.today th,.hours tr.today td{font-weight:700;color:var(--text)}
.open-now{display:inline-flex;align-items:center;gap:.45em;font-weight:600;font-size:var(--step--1)}
.open-now::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--muted)}
.open-now.yes::before{background:#22a05a;box-shadow:0 0 0 4px rgb(34 160 90 / .18)}`;

function contactList(b: Brief): string {
  const wa = whatsappOf(b);
  const rows = [
    addressLine(b) ? `<li>${icon('pin')}<span><small>Address</small>${esc(addressLine(b))}</span></li>` : '',
    b.phone ? `<li>${icon('phone')}<span><small>Phone</small>${a(telHref(b.phone), esc(b.phone))}</span></li>` : '',
    wa ? `<li>${icon('whatsapp')}<span><small>WhatsApp</small>${a(waHref(wa), 'Message us')}</span></li>` : '',
    b.email ? `<li>${icon('mail')}<span><small>Email</small>${a(mailHref(b.email), esc(b.email))}</span></li>` : '',
  ].filter(Boolean);
  return rows.length ? `<ul class="clist">${rows.join('')}</ul>` : '';
}
export const CLIST_CSS = `.clist{list-style:none;display:grid;gap:var(--space-s)}
.clist li{display:flex;gap:.8em;align-items:flex-start}
.clist .ic{color:var(--primary);margin-top:.15em}
.tone-inverse .clist .ic{color:inherit}
.clist small{display:block;font-size:var(--step--1);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.clist a{font-weight:600;text-decoration:none;overflow-wrap:anywhere}`;
export { contactList };

export const mediaBlocks: BlockDef[] = [
  {
    id: 'gallery-grid',
    group: 'media',
    about: 'A photo grid with one large picture leading; tapping opens a full-screen viewer with next and previous. The work, the room, the food.',
    slots: { ...HEAD, images: LIST({ image: { t: 'image' }, caption: OT(80) }, 12, 3) },
    js: ['lightbox'],
    css: `.b-gallery-grid .grid{display:grid;grid-template-columns:repeat(2,1fr);grid-auto-rows:minmax(150px,26vw);gap:var(--space-2xs)}
.b-gallery-grid .grid button{position:relative;padding:0;border:0;border-radius:var(--r2);overflow:hidden;cursor:zoom-in;background:var(--surface-2)}
.b-gallery-grid .grid img{width:100%;height:100%;object-fit:cover;transition:transform var(--t-slow) var(--ease)}
.b-gallery-grid .grid button:hover img{transform:scale(1.04)}
.b-gallery-grid .grid button:first-child{grid-column:span 2;grid-row:span 2}
.b-gallery-grid figcaption{position:absolute;left:0;right:0;bottom:0;padding:1.6em .9em .7em;background:linear-gradient(transparent,rgb(0 0 0 / .65));color:#fff;font-size:var(--step--1);text-align:left}
@media (min-width:900px){.b-gallery-grid .grid{grid-template-columns:repeat(4,1fr);grid-auto-rows:minmax(160px,14vw)}.b-gallery-grid .grid button:nth-child(5n+4){grid-row:span 2}}
@media (min-width:1300px){.b-gallery-grid .grid{grid-auto-rows:190px}}
.lightbox{position:fixed;inset:0;z-index:200;display:grid;grid-template-rows:auto 1fr auto;background:rgb(8 8 8 / .94);color:#fff;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
.lightbox[hidden]{display:none}
.lightbox .top{display:flex;justify-content:space-between;align-items:center;padding:8px 8px 8px 16px;font-size:var(--step--1)}
.lightbox button{width:52px;height:52px;display:grid;place-items:center;border:0;background:none;color:#fff;cursor:pointer;border-radius:50%}
.lightbox button:hover{background:rgb(255 255 255 / .1)}
.lightbox .stage{display:grid;place-items:center;min-height:0;padding:0 8px}
.lightbox .stage img{max-width:100%;max-height:100%;object-fit:contain;border-radius:var(--r1)}
.lightbox .nav2{display:flex;justify-content:center;gap:24px;padding:8px}
.lightbox .cap{padding:0 16px;text-align:center;opacity:.8;min-height:1.4em}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'images').slice(0, 12);
      const imgs = imageList(items);
      const caps = items.map((i) => str(i, 'caption'));
      return sec('gallery-grid', x, `<div class="wrap">${head(d)}<div class="grid" data-gallery>${imgs.map((m, i) => `<button type="button" class="reveal" data-full="${esc(m.srcset?.length ? m.srcset[m.srcset.length - 1]![0] : m.src)}" aria-label="Open photo ${i + 1}${caps[i] ? `: ${esc(caps[i])}` : ''}">${img(m, { sizes: i === 0 ? '(min-width:900px) 600px, 100vw' : '(min-width:900px) 300px, 50vw' })}${caps[i] ? `<figcaption>${esc(caps[i])}</figcaption>` : ''}</button>`).join('')}</div></div>`);
    },
  },
  {
    id: 'gallery-strip',
    group: 'media',
    about: 'A row of photos that swipes sideways on a phone (snaps to each), with arrows on bigger screens. Lighter than a grid.',
    slots: { ...HEAD, images: LIST({ image: { t: 'image' }, caption: OT(80) }, 10, 3) },
    js: ['carousel'],
    css: `.b-gallery-strip{overflow:hidden}
.b-gallery-strip .top{display:flex;justify-content:space-between;align-items:end;gap:var(--space-s);margin-bottom:var(--space-l)}
.b-gallery-strip .top .head{margin:0}
.b-gallery-strip .arrows{display:none;gap:8px}
.b-gallery-strip .arrows button{width:48px;height:48px;border-radius:50%;border:1px solid var(--border);background:var(--surface);display:grid;place-items:center;cursor:pointer}
.b-gallery-strip .arrows button:first-child .ic{transform:rotate(180deg)}
.b-gallery-strip .track{display:flex;gap:var(--space-s);overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:var(--gutter);padding-inline:max(var(--gutter),calc((100vw - var(--wrap)) / 2));scrollbar-width:none;overscroll-behavior-x:contain}
.b-gallery-strip .track::-webkit-scrollbar{display:none}
.b-gallery-strip figure{flex:0 0 min(78vw,420px);margin:0;scroll-snap-align:start}
.b-gallery-strip .media{aspect-ratio:4/5}
.b-gallery-strip figcaption{margin-top:.6em;color:var(--muted);font-size:var(--step--1)}
@media (min-width:900px){.b-gallery-strip .arrows{display:flex}}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'images').slice(0, 10);
      const imgs = imageList(items);
      const caps = items.map((i) => str(i, 'caption'));
      return sec('gallery-strip', x, `<div class="wrap top">${head(d)}<div class="arrows"><button type="button" data-dir="-1" aria-label="Previous photos">${icon('arrow')}</button><button type="button" data-dir="1" aria-label="Next photos">${icon('arrow')}</button></div></div><div class="track" data-carousel tabindex="0" role="region" aria-label="${esc(str(d, 'title') || 'Photos')}">${imgs.map((m, i) => `<figure><div class="media">${img(m, { sizes: '(min-width:900px) 420px, 78vw' })}</div>${caps[i] ? `<figcaption>${esc(caps[i])}</figcaption>` : ''}</figure>`).join('')}</div>`);
    },
  },
  {
    id: 'social-grid',
    group: 'media',
    about: 'Six square photos in the style of an Instagram grid, the handle and a follow button. Cafés, salons, barbers, photographers.',
    slots: { ...HEAD, images: LIST({ image: { t: 'image' } }, 6, 3), handle: OT(40, '@name') },
    css: `.b-social-grid .top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:var(--space-s);margin-bottom:var(--space-l)}
.b-social-grid .top .head{margin:0}
.b-social-grid .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.b-social-grid .media{aspect-ratio:1;border-radius:var(--r1)}
@media (min-width:900px){.b-social-grid .grid{grid-template-columns:repeat(6,1fr);gap:var(--space-2xs)}}`,
    render(d, x) {
      const imgs = imageList(list(d, 'images')).slice(0, 6);
      const ig = x.brief.socials?.instagram;
      const handle = str(d, 'handle') || (ig ? `@${ig.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/[/?].*$/, '').replace(/^@/, '')}` : '');
      const href = ig ? (/^https:/.test(ig) ? ig : `https://www.instagram.com/${handle.replace(/^@/, '')}/`) : '';
      return sec('social-grid', x, `<div class="wrap"><div class="top">${head(d)}${href ? a(href, `${icon('instagram')}Follow ${esc(handle)}`, 'btn btn-outline') : ''}</div><div class="grid">${imgs.map((m) => `<div class="media reveal">${img(m, { sizes: '(min-width:900px) 190px, 33vw' })}</div>`).join('')}</div></div>`);
    },
  },
  {
    id: 'map',
    group: 'media',
    about: 'Find us: an OpenStreetMap map with the pin, beside a card with the address, directions, phone and today\'s hours.',
    slots: { ...HEAD, note: OT(160, 'parking, public transport, accessibility') },
    js: ['hours'],
    css: `${CLIST_CSS}
${HOURS_CSS}
.b-map .wrap{display:grid;gap:var(--space-l)}
.b-map .card{display:grid;gap:var(--space-m);align-content:start;padding:var(--space-l)}
.b-map .card .head{margin:0}
.b-map .note{color:var(--muted);font-size:var(--step--1)}
.b-map .mapbox{position:relative;min-height:340px;border-radius:var(--r3);overflow:hidden;border:1px solid var(--border);background:var(--surface-2)}
.b-map iframe{position:absolute;inset:0;width:100%;height:100%;border:0;filter:var(--map-filter)}
.b-map .nomap{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:var(--space-s);text-align:center;padding:var(--space-l);background:repeating-linear-gradient(45deg,transparent 0 18px,rgb(var(--rgb-text) / .04) 18px 19px)}
.b-map .nomap .ic{width:44px;height:44px;color:var(--primary)}
.b-map .credit{position:absolute;right:0;bottom:0;padding:2px 8px;background:rgb(255 255 255 / .85);color:#222;font-size:11px;border-top-left-radius:6px}
@media (min-width:900px){.b-map .wrap{grid-template-columns:.85fr 1.15fr}.b-map .mapbox{min-height:460px}}`,
    render(d, x) {
      const b = x.brief;
      const map =
        b.lat !== undefined && b.lon !== undefined
          ? `<iframe src="${esc(osmEmbed(b.lat, b.lon))}" title="Map showing ${esc(b.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
          : `<div class="nomap">${icon('pin')}<p><b>${esc(addressLine(b) || b.town || b.name)}</b></p>${btn({ label: 'Open the map', href: mapsHref(b) }, 'btn-outline btn-sm')}</div>`;
      const card = `<div class="card reveal">${head(d, { level: 2 })}${contactList(b)}${b.hours?.length ? `<div><p class="open-now" data-open-now>Opening hours</p>${hoursTable(b.hours)}</div>` : ''}${str(d, 'note') ? `<p class="note">${esc(str(d, 'note'))}</p>` : ''}<div class="btns">${btn({ label: 'Get directions', href: directionsHref(b) }, 'btn-primary', 'directions')}</div></div>`;
      return sec('map', x, `<div class="wrap">${card}<div class="mapbox reveal">${map}</div></div>`, { anchor: 'find-us' });
    },
  },
  {
    id: 'hours',
    group: 'media',
    about: 'Opening hours with today in bold and "Open now" or "Closed now", beside contact details. For a contact page or the end of the home page.',
    slots: { ...HEAD, note: OT(160, 'bank holidays, appointments only…') },
    js: ['hours'],
    css: `${CLIST_CSS}
${HOURS_CSS}
.b-hours .wrap{display:grid;gap:var(--space-l)}
.b-hours .box{padding:var(--space-l);border-radius:var(--r3);background:var(--surface);border:1px solid var(--border)}
.b-hours .box h3{display:flex;justify-content:space-between;align-items:center;gap:.6em;font-size:var(--step-2);margin-bottom:var(--space-s)}
.b-hours .note{margin-top:var(--space-s);color:var(--muted);font-size:var(--step--1)}
@media (min-width:900px){.b-hours .wrap{grid-template-columns:1fr 1fr 1fr;align-items:start}.b-hours .head{margin:0}}`,
    render(d, x) {
      const b = x.brief;
      return sec('hours', x, `<div class="wrap">${head(d)}${b.hours?.length ? `<div class="box reveal"><h3>Hours <span class="open-now" data-open-now></span></h3>${hoursTable(b.hours)}${str(d, 'note') ? `<p class="note">${esc(str(d, 'note'))}</p>` : ''}</div>` : ''}<div class="box reveal"><h3>Contact</h3>${contactList(b)}</div></div>`);
    },
  },
];

