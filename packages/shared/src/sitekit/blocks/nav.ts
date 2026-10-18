/**
 * Navigation and page tops: the sticky header (classic or centred), the announcement bar, and the
 * header of an inner page. The header is the same on every page; the current page is marked by the
 * router (aria-current), and on a phone the links fold into a menu button.
 */
import { a, btn, esc, icon, img, imgOf, linkOf, navPages, primaryAction, rich, route, str, telHref } from '../html';
import type { BlockDef, RenderCtx } from '../types';
import { HEAD, IMG, initials, LINK, OT, sec, T } from './common';

function brand(x: RenderCtx, d: Record<string, unknown>): string {
  const logo = imgOf(d, 'logo');
  const mark = logo ? `<img class="logo" src="${esc(logo.src)}" alt="" width="40" height="40">` : `<span class="mark" aria-hidden="true">${esc(initials(x.plan.name))}</span>`;
  return `<a class="brand" href="${route('')}" aria-label="${esc(x.plan.name)}, home">${mark}<span class="name">${esc(x.plan.name)}</span></a>`;
}
const links = (x: RenderCtx) => navPages(x.plan).map((p) => `<li><a href="${route(p.slug)}" data-route="${esc(p.slug)}">${esc(p.label)}</a></li>`).join('');

/** The mobile panel: every page, the main action, and the phone number. */
function panel(x: RenderCtx, cta: string): string {
  const b = x.brief;
  return `<div class="nav-panel" id="nav-panel"><ul class="nav-plinks">${links(x)}</ul><div class="nav-pfoot">${cta}${b.phone ? a(telHref(b.phone), `${icon('phone')}${esc(b.phone)}`, 'nav-phone') : ''}</div></div>`;
}

const NAV_CSS = `.nav{--nav-h:73px;position:sticky;top:0;z-index:50;background:rgb(var(--rgb-bg) / .86);-webkit-backdrop-filter:saturate(1.6) blur(14px);backdrop-filter:saturate(1.6) blur(14px);border-bottom:1px solid transparent;transition:border-color var(--t-mid),background-color var(--t-mid),color var(--t-mid)}
.nav.scrolled{border-bottom-color:var(--border)}
.nav .bar{display:flex;align-items:center;gap:var(--space-s);min-height:72px}
.brand{display:inline-flex;align-items:center;gap:.65em;text-decoration:none;font:var(--display-weight) var(--step-1)/1 var(--font-display);letter-spacing:var(--display-tracking);text-transform:var(--display-case);margin-right:auto;min-height:44px}
.brand .mark{display:grid;place-items:center;width:40px;height:40px;border-radius:var(--r2);background:var(--primary);color:var(--on-primary);font:700 .95rem/1 var(--font-body);letter-spacing:.02em;text-transform:none}
.brand .logo{width:40px;height:40px;border-radius:var(--r2);object-fit:cover}
.nav-links{display:none;list-style:none;gap:clamp(.8rem,1.8vw,1.9rem);align-items:center}
.nav-links a,.nav-plinks a{text-decoration:none;font-weight:500;position:relative;display:inline-flex;align-items:center;min-height:44px}
.nav-links a::after{content:"";position:absolute;left:0;right:0;bottom:8px;height:2px;background:var(--primary);transform:scaleX(0);transform-origin:left;transition:transform var(--t-mid) var(--ease)}
.nav-links a:hover::after,.nav-links a[aria-current=page]::after{transform:scaleX(1)}
.nav .cta{display:none}
.nav-toggle{display:inline-grid;place-items:center;width:48px;height:48px;margin-right:-8px;border:0;background:none;border-radius:var(--r1);cursor:pointer}
.nav-toggle .ic{width:26px;height:26px}
.nav-toggle .i-close{display:none}
.nav.open .nav-toggle .i-menu{display:none}.nav.open .nav-toggle .i-close{display:block}
.nav-panel{border-top:1px solid var(--border);padding:var(--space-s) var(--gutter) var(--space-m);background:var(--bg)}
.js .nav-panel{display:none}
.js .nav.open .nav-panel{display:block;animation:navIn var(--t-mid) var(--ease)}
.nav-plinks{list-style:none;display:grid}
.nav-plinks a{font:var(--display-weight) var(--step-2)/1.2 var(--font-display);letter-spacing:var(--display-tracking);text-transform:var(--display-case);padding:.35em 0;width:100%;border-bottom:1px solid var(--border)}
.nav-pfoot{display:grid;gap:var(--space-xs);margin-top:var(--space-m)}
.nav-pfoot .btn{width:100%}
.nav-phone{display:inline-flex;align-items:center;justify-content:center;gap:.5em;min-height:48px;font-weight:600;text-decoration:none}
@keyframes navIn{from{opacity:0;transform:translateY(-6px)}}
@media (min-width:900px){.nav-links{display:flex}.nav .cta{display:inline-flex}.nav-toggle,.js .nav.open .nav-panel,.nav-panel{display:none}}
.nav-over{margin-bottom:calc(-1 * var(--nav-h));background:transparent;-webkit-backdrop-filter:none;backdrop-filter:none;color:#fff}
.nav-over:not(.scrolled):not(.open) .cta .btn{--b-bg:#fff;--b-fg:#111;--b-line:#fff}
.nav-over:not(.scrolled):not(.open) .nav-links a::after{background:#fff}
.nav-over:not(.scrolled):not(.open) .brand .mark{background:rgb(255 255 255 / .16);color:#fff;box-shadow:inset 0 0 0 1px rgb(255 255 255 / .45)}
.nav-over.scrolled,.nav-over.open{background:rgb(var(--rgb-bg) / .92);-webkit-backdrop-filter:saturate(1.6) blur(14px);backdrop-filter:saturate(1.6) blur(14px);color:var(--text)}`;

export const navBlocks: BlockDef[] = [
  {
    id: 'nav-classic',
    group: 'nav',
    about: 'Sticky header: brand left, page links, one call-to-action button; a menu button on phones. The default.',
    slots: { cta: LINK('the main action; leave out for the site default'), logo: IMG('a square logo (optional)', true) },
    css: NAV_CSS,
    js: ['nav'],
    render(d, x) {
      const cta = btn(linkOf(d, 'cta') ?? primaryAction(x.brief, x.plan), 'btn-primary btn-sm');
      return `<header class="nav b-nav-classic"><div class="wrap bar">${brand(x, d)}<nav aria-label="Main"><ul class="nav-links">${links(x)}</ul></nav><span class="cta">${cta}</span><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-panel" aria-label="Menu">${icon('menu').replace('class="ic"', 'class="ic i-menu"')}${icon('close').replace('class="ic"', 'class="ic i-close"')}</button></div>${panel(x, cta)}</header>`;
    },
  },
  {
    id: 'nav-centered',
    group: 'nav',
    about: 'Header with the name centred in the display font and links either side on wide screens: restaurants, salons, photographers.',
    slots: { cta: LINK('the main action'), logo: IMG('a square logo (optional)', true) },
    css: `${NAV_CSS}
.b-nav-centered{--nav-h:81px}
.b-nav-centered .bar{min-height:80px}
@media (min-width:900px){.b-nav-centered .bar{display:grid;grid-template-columns:1fr auto 1fr}.b-nav-centered .brand{margin:0;grid-column:2;grid-row:1;font-size:var(--step-2)}.b-nav-centered nav{grid-column:1;grid-row:1}.b-nav-centered .cta{grid-column:3;grid-row:1;justify-self:end}.b-nav-centered .brand .mark{display:none}}`,
    js: ['nav'],
    render(d, x) {
      const cta = btn(linkOf(d, 'cta') ?? primaryAction(x.brief, x.plan), 'btn-primary btn-sm');
      return `<header class="nav b-nav-centered"><div class="wrap bar">${brand(x, d)}<nav aria-label="Main"><ul class="nav-links">${links(x)}</ul></nav><span class="cta">${cta}</span><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-panel" aria-label="Menu">${icon('menu').replace('class="ic"', 'class="ic i-menu"')}${icon('close').replace('class="ic"', 'class="ic i-close"')}</button></div>${panel(x, cta)}</header>`;
    },
  },
  {
    id: 'announce',
    group: 'nav',
    about: 'A thin bar above the header for one short line: walk-ins welcome, 24-hour call-outs, a date, a new menu.',
    slots: { text: T(90, 'one short line'), link: LINK('optional link'), icon: OT(24, 'icon name') },
    css: `.b-announce{background:var(--text);color:var(--bg);font-size:var(--step--1);font-weight:500}
.b-announce .wrap{display:flex;align-items:center;justify-content:center;gap:.6em;min-height:40px;text-align:center;flex-wrap:wrap;padding-block:.35em}
.b-announce .ic{width:18px;height:18px}
.b-announce a{color:inherit;font-weight:600;min-height:32px;display:inline-flex;align-items:center}`,
    render(d) {
      const l = linkOf(d, 'link');
      return `<div class="b-announce" role="note"><div class="wrap">${str(d, 'icon') ? icon(str(d, 'icon')) : ''}<span>${esc(str(d, 'text'))}</span>${l ? a(l.href, `${esc(l.label)} →`) : ''}</div></div>`;
    },
  },
  {
    id: 'page-header',
    group: 'hero',
    about: 'The top of an inner page (about, services, contact): breadcrumb, the page title (h1), a lead line, an optional wide picture.',
    slots: { ...HEAD, image: IMG('a wide picture for the page (optional)', true) },
    css: `.b-page-header{padding-block:var(--space-xl) var(--space-xl)}
.b-page-header .crumb{display:flex;gap:.5em;font-size:var(--step--1);color:var(--muted);margin-bottom:var(--space-s)}
.b-page-header .crumb a{text-decoration:none}
.b-page-header h1{font-size:var(--step-5);max-width:16ch}
.b-page-header .lead{margin-top:var(--space-s)}
.b-page-header .media{margin-top:var(--space-xl);aspect-ratio:16/7}
@media (max-width:599px){.b-page-header .media{aspect-ratio:4/3}}`,
    render(d, x) {
      const image = imgOf(d, 'image');
      const inner = `<div class="wrap"><nav class="crumb" aria-label="Breadcrumb"><a href="${route('')}">Home</a><span aria-hidden="true">/</span><span aria-current="page">${esc(x.page.label)}</span></nav>${str(d, 'eyebrow') ? `<p class="eyebrow">${esc(str(d, 'eyebrow'))}</p>` : ''}<h1>${rich(str(d, 'title', x.page.label))}</h1>${str(d, 'lead') ? `<p class="lead">${esc(str(d, 'lead'))}</p>` : ''}${image ? `<div class="media">${imgFor(image)}</div>` : ''}</div>`;
      return sec('page-header', x, inner);
    },
  },
];

/** The page header's picture is above the fold: it loads at once. */
function imgFor(ref: Parameters<typeof img>[0]): string {
  return img(ref, { eager: true, sizes: '(min-width:1200px) 1140px, 100vw' });
}
