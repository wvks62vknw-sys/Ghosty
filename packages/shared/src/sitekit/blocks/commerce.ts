/**
 * What things cost and how to get them: membership tiers, a barber's price list, a restaurant menu
 * with tabs, service cards, products ordered by WhatsApp or email, property listings, donation amounts,
 * an event's running order, and a plan comparison table.
 */
import { a, btn, esc, icon, img, imgOf, linkOf, list, mailHref, primaryAction, str, texts, waHref } from '../html';
import type { BlockDef, RenderCtx } from '../types';
import { HEAD, IMG, LINK, LIST, OT, T, TEXTS, head, sec } from './common';
import { whatsappOf } from './hero';

/** "Order" for a product or a service: WhatsApp when there is a number, else email, else the contact page. */
function orderLink(x: RenderCtx, what: string): { label: string; href: string } {
  const wa = whatsappOf(x.brief);
  if (wa) return { label: 'Order on WhatsApp', href: waHref(wa, `Hi ${x.brief.name}, I'd like to order: ${what}`) };
  if (x.brief.email) return { label: 'Order by email', href: mailHref(x.brief.email, `Order: ${what}`, `Hi ${x.brief.name},\n\nI'd like to order: ${what}.\n\nThanks`) };
  return primaryAction(x.brief, x.plan);
}

export const commerceBlocks: BlockDef[] = [
  {
    id: 'pricing-cards',
    group: 'commerce',
    about: 'Two to four plans or packages side by side, one highlighted, each with a price, what is included and a button. Gym memberships, photography packages, software plans.',
    slots: { ...HEAD, plans: LIST({ name: T(32), price: T(16), per: OT(16, 'e.g. "/month"'), text: OT(120), features: TEXTS(8, 60), cta: LINK(), featured: { t: 'bool', optional: true } }, 4, 2), note: OT(160, 'small print under the table') },
    css: `.b-pricing-cards .plans{display:grid;gap:var(--space-s);grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));align-items:stretch}
.b-pricing-cards .plan{display:flex;flex-direction:column;gap:var(--space-s);padding:var(--space-l) var(--space-m);border-radius:var(--r3);background:var(--surface);border:1px solid var(--border);position:relative}
.b-pricing-cards .plan.on{background:var(--text);color:var(--bg);border-color:var(--text);box-shadow:var(--shadow-3);--muted:rgb(var(--rgb-bg) / .72);--border:rgb(var(--rgb-bg) / .16)}
.b-pricing-cards .plan.on .btn-primary{--b-bg:var(--bg);--b-fg:var(--text);--b-line:var(--bg)}
.b-pricing-cards .flag{position:absolute;top:-12px;left:var(--space-m);padding:.3em .8em;border-radius:999px;background:var(--accent);color:var(--on-accent);font-size:var(--step--1);font-weight:700}
.b-pricing-cards h3{font-family:var(--font-body);font-size:var(--step-0);font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.b-pricing-cards .price{font:var(--display-weight) var(--step-5)/1 var(--font-display);letter-spacing:var(--display-tracking)}
.b-pricing-cards .price small{font:500 var(--step-0) var(--font-body);color:var(--muted);letter-spacing:0}
.b-pricing-cards .plan>p{color:var(--muted)}
.b-pricing-cards ul{list-style:none;display:grid;gap:.55em;padding-top:var(--space-s);border-top:1px solid var(--border);flex:1}
.b-pricing-cards li{display:flex;gap:.55em}
.b-pricing-cards li .ic{width:20px;height:20px;color:var(--primary);margin-top:.15em}
.b-pricing-cards .plan.on li .ic{color:inherit}
.b-pricing-cards .plan .btn{width:100%}
.b-pricing-cards .note{margin-top:var(--space-m);text-align:center;color:var(--muted);font-size:var(--step--1)}`,
    render(d, x) {
      const plans = list<Record<string, unknown>>(d, 'plans').slice(0, 4);
      const featured = plans.findIndex((p) => p.featured === true);
      const on = featured >= 0 ? featured : plans.length === 3 ? 1 : -1;
      return sec('pricing-cards', x, `<div class="wrap">${head(d, { center: true })}<div class="plans">${plans.map((p, i) => {
        const cta = linkOf(p, 'cta') ?? primaryAction(x.brief, x.plan);
        return `<article class="plan reveal${i === on ? ' on' : ''}">${i === on ? '<span class="flag">Most popular</span>' : ''}<h3>${esc(str(p, 'name'))}</h3><p class="price">${esc(str(p, 'price'))}${str(p, 'per') ? `<small> ${esc(str(p, 'per'))}</small>` : ''}</p>${str(p, 'text') ? `<p>${esc(str(p, 'text'))}</p>` : ''}<ul>${texts(p, 'features').slice(0, 8).map((f) => `<li>${icon('check')}${esc(f)}</li>`).join('')}</ul>${btn(cta, i === on ? 'btn-primary' : 'btn-outline')}</article>`;
      }).join('')}</div>${str(d, 'note') ? `<p class="note">${esc(str(d, 'note'))}</p>` : ''}</div>`);
    },
  },
  {
    id: 'price-list',
    group: 'commerce',
    about: 'A typeset price list in groups, name … price with a line under each and the time it takes: barbers, salons, treatments, simple trades.',
    slots: { ...HEAD, groups: LIST({ name: OT(40), items: LIST({ name: T(48), price: T(16), note: OT(100), time: OT(16) }, 14, 1) }, 4, 1), note: OT(160) },
    css: `.b-price-list .cols{display:grid;gap:var(--space-xl)}
.b-price-list h3{font-size:var(--step-2);margin-bottom:var(--space-s);padding-bottom:var(--space-xs);border-bottom:2px solid var(--text)}
.tone-inverse.b-price-list h3{border-color:currentColor}
.b-price-list ul{list-style:none;display:grid}
.b-price-list li{padding:var(--space-s) 0;border-bottom:1px solid var(--border)}
.b-price-list .line{display:flex;align-items:baseline;gap:.6em;font-weight:600;font-size:var(--step-1)}
.b-price-list .line .dots{flex:1;border-bottom:1.5px dotted var(--muted);opacity:.6;transform:translateY(-.3em);min-width:20px}
.b-price-list .line .p{font-family:var(--font-display);font-weight:var(--display-weight);white-space:nowrap}
.b-price-list .sub{display:flex;flex-wrap:wrap;gap:.3em 1em;margin-top:.25em;color:var(--muted);font-size:var(--step--1)}
.b-price-list .sub .t{display:inline-flex;align-items:center;gap:.3em}
.b-price-list .sub .ic{width:15px;height:15px}
.b-price-list .note{margin-top:var(--space-l);color:var(--muted)}
@media (min-width:900px){.b-price-list .cols.two{grid-template-columns:1fr 1fr;gap:var(--space-xl) var(--space-2xl)}}`,
    render(d, x) {
      const groups = list<Record<string, unknown>>(d, 'groups').slice(0, 4);
      return sec('price-list', x, `<div class="wrap">${head(d)}<div class="cols${groups.length > 1 ? ' two' : ''}">${groups.map((g) => `<div class="grp reveal">${str(g, 'name') ? `<h3>${esc(str(g, 'name'))}</h3>` : ''}<ul>${list<Record<string, unknown>>(g, 'items').slice(0, 14).map((i) => `<li><div class="line"><span>${esc(str(i, 'name'))}</span><span class="dots" aria-hidden="true"></span><span class="p">${esc(str(i, 'price'))}</span></div>${str(i, 'note') || str(i, 'time') ? `<div class="sub">${str(i, 'note') ? `<span>${esc(str(i, 'note'))}</span>` : ''}${str(i, 'time') ? `<span class="t">${icon('clock')}${esc(str(i, 'time'))}</span>` : ''}</div>` : ''}</li>`).join('')}</ul></div>`).join('')}</div>${str(d, 'note') ? `<p class="note">${esc(str(d, 'note'))}</p>` : ''}</div>`);
    },
  },
  {
    id: 'menu',
    group: 'commerce',
    about: 'A food and drink menu in tabs (breakfast, lunch, drinks…), each dish with a line, the price and dietary marks (V, VG, GF). Restaurants and cafés.',
    slots: { ...HEAD, sections: LIST({ name: T(32), items: LIST({ name: T(48), text: OT(140), price: T(12), tags: TEXTS(4, 6, 'V, VG, GF, DF, N') }, 16, 1) }, 6, 1), note: OT(200, 'allergy note') },
    js: ['tabs'],
    css: `.b-menu .tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:var(--space-l);padding:4px;border-radius:999px;background:var(--surface-2);width:max-content;max-width:100%}
.b-menu .tabs::-webkit-scrollbar{display:none}
.b-menu .tabs button{flex:none;min-height:44px;padding:0 1.2em;border:0;border-radius:999px;background:none;font-weight:600;cursor:pointer;color:var(--muted)}
.b-menu .tabs button[aria-selected=true]{background:var(--surface);color:var(--text);box-shadow:var(--shadow-1)}
.no-js .b-menu .tabs,.b-menu .tabs[hidden]{display:none}
.b-menu .panel h3{font-size:var(--step-3);margin-bottom:var(--space-m)}
.js .b-menu .panel h3{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
.b-menu .panel+.panel{margin-top:var(--space-xl)}
.js .b-menu .panel+.panel{margin-top:0}
.b-menu ul{list-style:none;display:grid;gap:0 var(--space-xl)}
.b-menu li{padding:var(--space-s) 0;border-bottom:1px solid var(--border)}
.b-menu .top{display:flex;justify-content:space-between;align-items:baseline;gap:var(--space-s)}
.b-menu .top b{font-weight:600;font-size:var(--step-1)}
.b-menu .top .p{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--step-1);white-space:nowrap}
.b-menu li p{color:var(--muted);margin-top:.2em;max-width:52ch}
.b-menu .tags{display:inline-flex;gap:4px;margin-left:.5em;vertical-align:middle}
.b-menu .tags abbr{display:inline-grid;place-items:center;min-width:26px;height:20px;padding:0 4px;border-radius:4px;border:1px solid var(--border);font:700 .66rem/1 var(--font-body);text-decoration:none;color:var(--muted)}
.b-menu .note{margin-top:var(--space-l);font-size:var(--step--1);color:var(--muted)}
@media (min-width:900px){.b-menu ul{grid-template-columns:1fr 1fr}}`,
    render(d, x) {
      const secs = list<Record<string, unknown>>(d, 'sections').slice(0, 6);
      const TAG: Record<string, string> = { V: 'Vegetarian', VG: 'Vegan', GF: 'Gluten free', DF: 'Dairy free', N: 'Contains nuts' };
      const id = `m${x.index}`;
      const tabs = secs.length > 1 ? `<div class="tabs" role="tablist" aria-label="Menu sections" hidden>${secs.map((s, i) => `<button type="button" role="tab" id="${id}-t${i}" aria-controls="${id}-p${i}" aria-selected="${i === 0}">${esc(str(s, 'name'))}</button>`).join('')}</div>` : '';
      const panels = secs.map((s, i) => `<div class="panel" id="${id}-p${i}"${secs.length > 1 ? ` role="tabpanel" aria-labelledby="${id}-t${i}"` : ''}><h3>${esc(str(s, 'name'))}</h3><ul>${list<Record<string, unknown>>(s, 'items').slice(0, 16).map((it) => {
        const tags = texts(it, 'tags').map((t) => t.toUpperCase()).filter((t) => TAG[t]);
        return `<li><div class="top"><b>${esc(str(it, 'name'))}${tags.length ? `<span class="tags">${tags.map((t) => `<abbr title="${TAG[t]}">${t}</abbr>`).join('')}</span>` : ''}</b><span class="p">${esc(str(it, 'price'))}</span></div>${str(it, 'text') ? `<p>${esc(str(it, 'text'))}</p>` : ''}</li>`;
      }).join('')}</ul></div>`);
      return sec('menu', x, `<div class="wrap">${head(d)}<div class="tabset" data-tabs>${tabs}${panels.join('')}</div>${str(d, 'note') ? `<p class="note">${esc(str(d, 'note'))}</p>` : ''}</div>`);
    },
  },
  {
    id: 'services-cards',
    group: 'commerce',
    about: 'Services as cards with a photo, a line, "from £…" and how long it takes, each with a book or enquire link. Salons, trades, clinics, photographers.',
    slots: { ...HEAD, items: LIST({ name: T(48), text: T(180), price: OT(24), time: OT(20), image: IMG(undefined, true) }, 9, 2), link: LINK() },
    css: `.b-services-cards .grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr))}
.b-services-cards article{display:flex;flex-direction:column;border-radius:var(--r3);background:var(--surface);border:1px solid var(--border);overflow:hidden;transition:box-shadow var(--t-mid) var(--ease),transform var(--t-mid) var(--ease)}
.b-services-cards article:hover{box-shadow:var(--shadow-2);transform:translateY(-3px)}
.b-services-cards .media{aspect-ratio:3/2;border-radius:0}
.b-services-cards .body{display:flex;flex-direction:column;gap:var(--space-xs);padding:var(--space-m);flex:1}
.b-services-cards .body p{color:var(--muted)}
.b-services-cards .meta{display:flex;justify-content:space-between;align-items:center;gap:var(--space-s);margin-top:auto;padding-top:var(--space-s);border-top:1px solid var(--border)}
.b-services-cards .meta b{font-family:var(--font-display);font-weight:var(--display-weight);font-size:var(--step-1)}
.b-services-cards .meta span{display:inline-flex;align-items:center;gap:.35em;color:var(--muted);font-size:var(--step--1)}
.b-services-cards .meta .ic{width:16px;height:16px}
.b-services-cards .more{margin-top:var(--space-l);display:flex;justify-content:center}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'items').slice(0, 9);
      const l = linkOf(d, 'link');
      return sec('services-cards', x, `<div class="wrap">${head(d, { split: true })}<div class="grid">${items.map((s) => {
        const image = imgOf(s, 'image');
        return `<article class="reveal">${image ? `<div class="media">${img(image, { sizes: '(min-width:900px) 380px, 100vw' })}</div>` : ''}<div class="body"><h3>${esc(str(s, 'name'))}</h3><p>${esc(str(s, 'text'))}</p>${str(s, 'price') || str(s, 'time') ? `<div class="meta">${str(s, 'price') ? `<b>${esc(str(s, 'price'))}</b>` : '<b></b>'}${str(s, 'time') ? `<span>${icon('clock')}${esc(str(s, 'time'))}</span>` : ''}</div>` : ''}</div></article>`;
      }).join('')}</div>${l ? `<div class="more">${btn(l, 'btn-outline', 'arrow')}</div>` : ''}</div>`);
    },
  },
  {
    id: 'product-cards',
    group: 'commerce',
    about: 'A small shop: product photos, a badge, name, price and an "Order" button that opens WhatsApp or email with the product named. No checkout needed.',
    slots: { ...HEAD, items: LIST({ name: T(48), price: OT(16), text: OT(120), badge: OT(16), image: IMG() }, 12, 2), link: LINK('the full online shop, if there is one') },
    needs: ['products'],
    css: `.b-product-cards .grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:var(--space-l) var(--space-s)}
.b-product-cards article{display:flex;flex-direction:column;gap:var(--space-2xs)}
.b-product-cards .media{aspect-ratio:4/5;border-radius:var(--r2);margin-bottom:var(--space-xs)}
.b-product-cards .badge{position:absolute;top:10px;left:10px;background:var(--surface);box-shadow:var(--shadow-1)}
.b-product-cards h3{font-family:var(--font-body);font-size:var(--step-0);font-weight:600;letter-spacing:0;text-transform:none}
.b-product-cards .price{font-weight:600;color:var(--primary)}
.tone-inverse.b-product-cards .price{color:inherit}
.b-product-cards p{color:var(--muted);font-size:var(--step--1)}
.b-product-cards .btn{margin-top:var(--space-xs);align-self:flex-start}
.b-product-cards .more{margin-top:var(--space-xl);display:flex;justify-content:center}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'items').slice(0, 12);
      const l = linkOf(d, 'link');
      return sec('product-cards', x, `<div class="wrap">${head(d, { split: true })}<div class="grid">${items.map((p) => {
        const image = imgOf(p, 'image');
        const what = `${str(p, 'name')}${str(p, 'price') ? ` (${str(p, 'price')})` : ''}`;
        return `<article class="reveal"><div class="media">${image ? img(image, { sizes: '(min-width:900px) 280px, 50vw' }) : ''}${str(p, 'badge') ? `<span class="badge">${esc(str(p, 'badge'))}</span>` : ''}</div><h3>${esc(str(p, 'name'))}</h3>${str(p, 'price') ? `<p class="price">${esc(str(p, 'price'))}</p>` : ''}${str(p, 'text') ? `<p>${esc(str(p, 'text'))}</p>` : ''}${btn(orderLink(x, what), 'btn-outline btn-sm')}</article>`;
      }).join('')}</div>${l ? `<div class="more">${btn(l, 'btn-primary', 'arrow')}</div>` : ''}</div>`);
    },
  },
  {
    id: 'property-listings',
    group: 'commerce',
    about: 'An estate agent\'s properties: photo, status (for sale, let agreed), price, address, bedrooms, bathrooms. Only real listings.',
    slots: { ...HEAD, items: LIST({ title: T(60), price: T(24), status: OT(20), beds: { t: 'number', optional: true }, baths: { t: 'number', optional: true }, area: OT(20), image: IMG() }, 9, 1), link: LINK() },
    needs: ['listings'],
    css: `.b-property-listings .grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))}
.b-property-listings article{border-radius:var(--r2);overflow:hidden;background:var(--surface);border:1px solid var(--border)}
.b-property-listings .media{aspect-ratio:3/2;border-radius:0}
.b-property-listings .badge{position:absolute;top:12px;left:12px;background:var(--primary);color:var(--on-primary)}
.b-property-listings .body{padding:var(--space-m);display:grid;gap:var(--space-2xs)}
.b-property-listings .price{font:var(--display-weight) var(--step-2)/1.1 var(--font-display)}
.b-property-listings h3{font-family:var(--font-body);font-size:var(--step-0);font-weight:500;letter-spacing:0;text-transform:none;color:var(--muted)}
.b-property-listings .specs{display:flex;gap:var(--space-s);margin-top:var(--space-xs);padding-top:var(--space-xs);border-top:1px solid var(--border);font-size:var(--step--1);font-weight:600}
.b-property-listings .specs span{display:inline-flex;align-items:center;gap:.35em}
.b-property-listings .specs .ic{width:18px;height:18px;color:var(--muted)}
.b-property-listings .more{margin-top:var(--space-l);display:flex;justify-content:center}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'items').slice(0, 9);
      const l = linkOf(d, 'link');
      return sec('property-listings', x, `<div class="wrap">${head(d, { split: true })}<div class="grid">${items.map((p) => {
        const image = imgOf(p, 'image');
        const beds = typeof p.beds === 'number' ? `<span>${icon('bed')}${p.beds} bed</span>` : '';
        const baths = typeof p.baths === 'number' ? `<span>${icon('bath')}${p.baths} bath</span>` : '';
        const area = str(p, 'area') ? `<span>${icon('ruler')}${esc(str(p, 'area'))}</span>` : '';
        return `<article class="reveal"><div class="media">${image ? img(image, { sizes: '(min-width:900px) 380px, 100vw' }) : ''}${str(p, 'status') ? `<span class="badge">${esc(str(p, 'status'))}</span>` : ''}</div><div class="body"><p class="price">${esc(str(p, 'price'))}</p><h3>${esc(str(p, 'title'))}</h3>${beds || baths || area ? `<p class="specs">${beds}${baths}${area}</p>` : ''}</div></article>`;
      }).join('')}</div>${l ? `<div class="more">${btn(l, 'btn-outline', 'arrow')}</div>` : ''}</div>`);
    },
  },
  {
    id: 'donate',
    group: 'commerce',
    about: 'Ways to give: two to four amounts or kinds of gift that link to the charity\'s own donation page, with a line on where money goes (only what the owner said).',
    slots: { ...HEAD, options: LIST({ amount: T(16), title: T(40), text: OT(140) }, 4, 2), link: LINK('the donation page (JustGiving, Enthuse, the charity\'s own)') },
    css: `.b-donate .opts{display:grid;gap:var(--space-s);grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}
.b-donate .opt{display:grid;gap:var(--space-2xs);padding:var(--space-m);border-radius:var(--r2);border:1.5px solid var(--border);background:var(--surface);text-decoration:none;transition:border-color var(--t-fast),transform var(--t-mid) var(--ease)}
.b-donate .opt:hover{border-color:var(--primary);transform:translateY(-2px)}
.b-donate .opt b{font:var(--display-weight) var(--step-4)/1 var(--font-display);color:var(--primary)}
.b-donate .opt span{font-weight:600}
.b-donate .opt small{color:var(--muted);font-size:var(--step--1)}
.b-donate .go{margin-top:var(--space-l);display:flex;justify-content:center}`,
    render(d, x) {
      const opts = list<Record<string, unknown>>(d, 'options').slice(0, 4);
      const l = linkOf(d, 'link') ?? (x.brief.donateUrl ? { label: 'Donate now', href: x.brief.donateUrl } : primaryAction(x.brief, x.plan));
      return sec('donate', x, `<div class="wrap">${head(d, { center: true })}<div class="opts">${opts.map((o) => a(l.href, `<b>${esc(str(o, 'amount'))}</b><span>${esc(str(o, 'title'))}</span>${str(o, 'text') ? `<small>${esc(str(o, 'text'))}</small>` : ''}`, 'opt reveal')).join('')}</div><div class="go">${btn(l, 'btn-primary', 'heart')}</div></div>`);
    },
  },
  {
    id: 'event-schedule',
    group: 'commerce',
    about: 'An event\'s running order: times down the side, what happens and who, in a clean list. Events and open days.',
    slots: { ...HEAD, items: LIST({ time: T(16), title: T(60), detail: OT(120) }, 12, 2), link: LINK('tickets') },
    css: `.b-event-schedule ol{list-style:none;display:grid;max-width:880px}
.b-event-schedule li{display:grid;grid-template-columns:5.5em 1fr;gap:var(--space-s);padding:var(--space-s) 0;border-bottom:1px solid var(--border)}
.b-event-schedule time{font:var(--display-weight) var(--step-1)/1.3 var(--font-display);color:var(--primary)}
.tone-inverse.b-event-schedule time{color:inherit}
.b-event-schedule b{font-size:var(--step-1);font-weight:600;display:block}
.b-event-schedule small{color:var(--muted)}
.b-event-schedule .go{margin-top:var(--space-l)}`,
    render(d, x) {
      const items = list<Record<string, unknown>>(d, 'items').slice(0, 12);
      const l = linkOf(d, 'link');
      return sec('event-schedule', x, `<div class="wrap">${head(d)}<ol>${items.map((i) => `<li class="reveal"><time>${esc(str(i, 'time'))}</time><div><b>${esc(str(i, 'title'))}</b>${str(i, 'detail') ? `<small>${esc(str(i, 'detail'))}</small>` : ''}</div></li>`).join('')}</ol>${l ? `<p class="go">${btn(l, 'btn-primary', 'ticket')}</p>` : ''}</div>`);
    },
  },
  {
    id: 'comparison',
    group: 'commerce',
    about: 'A table comparing plans feature by feature with ticks; scrolls sideways on a phone with the first column fixed. Software and memberships.',
    slots: { ...HEAD, plans: TEXTS(4, 20, 'the plan names, in order'), rows: LIST({ feature: T(60), values: TEXTS(4, 24, '"yes", "no" or a short value per plan') }, 14, 2) },
    css: `.b-comparison .scroll{overflow-x:auto;border:1px solid var(--border);border-radius:var(--r2);background:var(--surface)}
.b-comparison table{width:100%;min-width:560px;border-collapse:collapse;font-size:var(--step--1)}
.b-comparison th,.b-comparison td{padding:.9em 1em;text-align:center;border-bottom:1px solid var(--border)}
.b-comparison th:first-child,.b-comparison td:first-child{text-align:left;position:sticky;left:0;background:var(--surface);font-weight:600}
.b-comparison thead th{font-size:var(--step-0)}
.b-comparison tr:last-child td{border-bottom:0}
.b-comparison .ic{margin:auto;width:20px;height:20px}
.b-comparison .yes{color:var(--primary)}
.b-comparison .no{color:var(--muted)}`,
    render(d, x) {
      const plans = texts(d, 'plans').slice(0, 4);
      const rows = list<Record<string, unknown>>(d, 'rows').slice(0, 14);
      const cell = (v: string) => (/^(yes|y|✓|true|included)$/i.test(v) ? `<span class="yes">${icon('check', 'Included')}</span>` : /^(no|n|✗|-|—|false)$/i.test(v) ? `<span class="no">${icon('minus', 'Not included')}</span>` : esc(v));
      return sec('comparison', x, `<div class="wrap">${head(d, { center: true })}<div class="scroll" tabindex="0" role="region" aria-label="Plan comparison"><table><thead><tr><th scope="col">Feature</th>${plans.map((p) => `<th scope="col">${esc(p)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><th scope="row">${esc(str(r, 'feature'))}</th>${plans.map((_, i) => `<td>${cell(texts(r, 'values')[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`);
    },
  },
];
