/**
 * Plan + brief → one finished HTML document: every page of the site in one file (the published page is
 * a single sandboxed document), shown one at a time by a tiny hash router (#/about), so moving between
 * pages is instant and the back button works. The head carries the SEO and sharing basics (title and
 * description per page, canonical, Open Graph, the business as schema.org JSON-LD, FAQ markup), the
 * theme's tokens and only the CSS of the blocks used; the body carries only the icons and behaviours
 * used. Works without JavaScript too: every page is then shown one after another.
 */
import { BLOCKS } from './blocks';
import { cleanEmail, esc, isImage, route } from './html';
import { iconSprite } from './icons';
import { fontsHref, PALETTES, themeCss } from './tokens';
import type { Brief, ImageRef, Page, Plan, RenderCtx, Section } from './types';

export interface Assembled {
  html: string;
  /** Every picture used (for credits and the image checks). */
  images: ImageRef[];
  /** Blocks used, in order of first use. */
  blocks: string[];
  /** Sections dropped because a block was unknown or needed facts the owner has not given. */
  dropped: string[];
}

/** Every picture anywhere in a value (slots nest pictures in lists). */
export function imagesIn(v: unknown, out: ImageRef[] = []): ImageRef[] {
  if (isImage(v)) out.push(v);
  else if (Array.isArray(v)) for (const x of v) imagesIn(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) imagesIn(x, out);
  return out;
}

/** Does the brief hold the facts a block needs (real reviews, a real team…)? */
export function hasFacts(b: Brief, needs: (keyof Brief)[] | undefined): boolean {
  return (needs ?? []).every((k) => {
    const v = b[k];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '';
  });
}

const SCHEMA_TYPE: Record<Brief['kind'], string> = {
  cafe: 'CafeOrCoffeeShop',
  restaurant: 'Restaurant',
  barber: 'HairSalon',
  salon: 'BeautySalon',
  trades: 'HomeAndConstructionBusiness',
  gym: 'HealthClub',
  photographer: 'ProfessionalService',
  shop: 'Store',
  clinic: 'MedicalClinic',
  estate: 'RealEstateAgent',
  portfolio: 'ProfessionalService',
  event: 'Event',
  charity: 'NGO',
  saas: 'SoftwareApplication',
};
const DAY_CODE = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** The business as schema.org data (what search engines and maps read). */
export function jsonLd(plan: Plan, b: Brief, image?: string): Record<string, unknown> {
  const type = SCHEMA_TYPE[b.kind];
  const base: Record<string, unknown> = { '@context': 'https://schema.org', '@type': type, name: plan.name, ...(plan.url ? { url: plan.url } : {}), ...(image ? { image } : {}), ...(b.tagline || plan.pages[0]?.description ? { description: b.tagline || plan.pages[0]!.description } : {}) };
  if (type === 'Event') return { ...base, ...(b.date ? { startDate: b.date } : {}), location: { '@type': 'Place', name: b.venue || b.town || plan.name, address: [b.address, b.town, b.postcode].filter(Boolean).join(', ') } };
  if (type === 'SoftwareApplication') return { ...base, applicationCategory: 'BusinessApplication', operatingSystem: 'Web' };
  const addr = b.address || b.town || b.postcode ? { address: { '@type': 'PostalAddress', ...(b.address ? { streetAddress: b.address } : {}), ...(b.town ? { addressLocality: b.town } : {}), ...(b.postcode ? { postalCode: b.postcode } : {}), addressCountry: 'GB' } } : {};
  const geo = b.lat !== undefined && b.lon !== undefined ? { geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lon } } : {};
  const hours = (b.hours ?? []).filter((h) => !h.closed && h.days?.length && h.open && h.close).map((h) => `${h.days!.map((d) => DAY_CODE[d]).join(',')} ${to24(h.open!)}-${to24(h.close!)}`);
  const same = Object.values(b.socials ?? {}).filter((s): s is string => typeof s === 'string' && /^https:\/\//.test(s));
  return { ...base, ...addr, ...geo, ...(b.phone ? { telephone: b.phone } : {}), ...(b.email ? { email: b.email } : {}), ...(hours.length ? { openingHours: hours } : {}), ...(same.length ? { sameAs: same } : {}) };
}

/** "9am", "9:30", "18.00", "6pm" → "09:00" style; anything else as written. */
export function to24(t: string): string {
  const m = t.trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return t.trim();
  let h = Number(m[1]);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
}

/** A favicon from the brand initials, drawn in the brand colour. */
function favicon(plan: Plan): string {
  const c = PALETTES[plan.theme.palette][plan.theme.scheme === 'dark' ? 'dark' : 'light'];
  const letters = plan.name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'G';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${c.primary}"/><text x="32" y="41" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="26" fill="${c.onPrimary}">${letters}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Remove repeated CSS lines (blocks share some rules) keeping the first. Every rule in the kit is one line. */
export function dedupeCss(css: string): string {
  const seen = new Set<string>();
  return css
    .split('\n')
    .filter((l) => {
      const k = l.trim();
      if (!k) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join('\n');
}

const pageId = (slug: string) => `p-${slug || 'home'}`;

/** Draw one section with its block; '' (and a note in `dropped`) for unknown blocks or missing facts. */
function draw(s: Section, x: Omit<RenderCtx, 'tone' | 'index'>, index: number, dropped: string[], used: string[]): string {
  const def = BLOCKS[s.block];
  if (!def) {
    dropped.push(`${x.page.slug || 'home'}: unknown block "${s.block}"`);
    return '';
  }
  if (!hasFacts(x.brief, def.needs)) {
    dropped.push(`${x.page.slug || 'home'}: ${s.block} left out (needs ${def.needs!.join(', ')} from the owner)`);
    return '';
  }
  if (!used.includes(def.id)) used.push(def.id);
  try {
    return def.render(s.data ?? {}, { ...x, index, tone: s.tone ?? 'base' });
  } catch (e) {
    dropped.push(`${x.page.slug || 'home'}: ${s.block} failed to draw (${String((e as Error)?.message ?? e).slice(0, 80)})`);
    return '';
  }
}

export function assemble(plan: Plan, briefIn: Brief): Assembled {
  // An email that is not exactly one address ("owner@x.example?bcc=…") never reaches a link, a form or the data.
  const brief: Brief = { ...briefIn, email: cleanEmail(briefIn.email) || undefined };
  const dropped: string[] = [];
  const used: string[] = [];
  const images = imagesIn([plan.header, plan.pages, plan.footer]);
  const home = plan.pages[0] as Page;
  const base = { brief, plan, credits: images };
  // Site-wide header and footer, drawn once with the home page as their page.
  const header = plan.header.map((s, i) => draw(s, { ...base, page: home }, i, dropped, used)).join('');
  const footer = plan.footer.map((s, i) => draw(s, { ...base, page: home }, 100 + i, dropped, used)).join('');
  const pages = plan.pages.map((p, pi) => {
    const body = p.sections.map((s, i) => draw(s, { ...base, page: p }, pi * 40 + i, dropped, used)).join('');
    const over = p.sections[0]?.block === 'hero-image' && BLOCKS['hero-image'] ? ' data-over="1"' : '';
    return `<div class="page${pi === 0 ? ' on' : ''}" id="${pageId(p.slug)}" data-page="${esc(p.slug)}" data-title="${esc(pageTitle(plan, p))}"${over}>${body}</div>`;
  });
  const css = dedupeCss([themeCss(plan.theme), ...used.map((id) => BLOCKS[id]!.css)].join('\n'));
  const behaviours = new Set<string>(['core']);
  for (const id of used) for (const j of BLOCKS[id]!.js ?? []) behaviours.add(j);
  const js = [...behaviours].map((b) => BEHAVIOURS[b] ?? '').join('\n');
  const body = `${header}<main id="main">${pages.join('')}</main>${footer}`;
  const sprite = iconSprite([...body.matchAll(/href="#i-([a-z0-9-]+)"/g)].map((m) => m[1]!));
  const ogImage = images.find((i) => /^https:/.test(i.src));
  const ld: unknown[] = [jsonLd(plan, brief, ogImage?.src)];
  const faqs = plan.pages.flatMap((p) => p.sections.filter((s) => s.block === 'faq').flatMap((s) => (Array.isArray(s.data.items) ? (s.data.items as Record<string, unknown>[]) : [])));
  if (faqs.length) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.filter((f) => typeof f.q === 'string' && typeof f.a === 'string').map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  const c = PALETTES[plan.theme.palette];
  const fonts = fontsHref(plan.theme.fonts);
  const desc = home.description;
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(pageTitle(plan, home))}</title>
<meta name="description" content="${esc(desc)}">
${plan.url ? `<link rel="canonical" href="${esc(plan.url)}">\n` : ''}<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(plan.name)}">
<meta property="og:title" content="${esc(pageTitle(plan, home))}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:locale" content="en_GB">
${plan.url ? `<meta property="og:url" content="${esc(plan.url)}">\n` : ''}${ogImage ? `<meta property="og:image" content="${esc(ogImage.srcset?.find(([, w]) => w >= 1200)?.[0] ?? ogImage.src)}">\n<meta property="og:image:alt" content="${esc(ogImage.alt)}">\n` : ''}<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">
<meta name="theme-color" content="${plan.theme.scheme === 'dark' ? c.dark.bg : c.light.bg}"${plan.theme.scheme === 'auto' ? ' media="(prefers-color-scheme: light)"' : ''}>
${plan.theme.scheme === 'auto' ? `<meta name="theme-color" content="${c.dark.bg}" media="(prefers-color-scheme: dark)">\n` : ''}<link rel="icon" href="${favicon(plan)}">
${fonts ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(fonts)}">\n` : ''}<script>document.documentElement.classList.add('js')</script>
<style>
${css}
</style>
<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, '\\u003c')}</script>
</head>
<body id="top">
<a class="skip" href="#main">Skip to content</a>
${sprite}
${body}
<script>
${js}
</script>
</body>
</html>
`;
  return { html, images, blocks: used, dropped };
}

/** "About — Fade & Co. Barbers, Walsall" (the home page: the name and its line). */
export function pageTitle(plan: Plan, p: Page): string {
  if (!p.slug) return p.title || plan.name;
  return `${p.title || p.label} — ${plan.name}`;
}

/** The site's internal links, for the link checker. */
export const internalRoutes = (plan: Plan) => new Set(plan.pages.map((p) => route(p.slug)));

/**
 * The page behaviours, plain JavaScript that runs in the sandboxed frame: no network, no storage needed.
 * core: the router (#/slug), the header (menu, shadow on scroll, over a full-bleed hero), reveal on scroll, the year.
 */
export const BEHAVIOURS: Record<string, string> = {
  core: `(function(){
var d=document,pages=[].slice.call(d.querySelectorAll('.page')),nav=d.querySelector('.nav'),first=true;
function show(){
  var h=location.hash||'#/';
  if(h.indexOf('#/')!==0){return}
  var slug=h.slice(2).replace(/\\/$/,''),hit=null;
  pages.forEach(function(p){if(p.getAttribute('data-page')===slug)hit=p});
  if(!hit)hit=pages[0];
  pages.forEach(function(p){p.classList.toggle('on',p===hit)});
  d.title=hit.getAttribute('data-title')||d.title;
  [].forEach.call(d.querySelectorAll('[data-route]'),function(a){if(a.getAttribute('data-route')===hit.getAttribute('data-page'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  if(nav){nav.classList.toggle('nav-over',hit.getAttribute('data-over')==='1');nav.classList.remove('open');var t=nav.querySelector('.nav-toggle');if(t)t.setAttribute('aria-expanded','false');onScroll()}
  if(!first){window.scrollTo(0,0);var h1=hit.querySelector('h1');if(h1){h1.setAttribute('tabindex','-1');h1.focus({preventScroll:true})}}
  first=false;reveal(hit)
}
function onScroll(){if(nav)nav.classList.toggle('scrolled',window.scrollY>8)}
window.addEventListener('scroll',onScroll,{passive:true});
window.addEventListener('hashchange',show);
if(nav){var t=nav.querySelector('.nav-toggle');if(t)t.addEventListener('click',function(){var o=nav.classList.toggle('open');t.setAttribute('aria-expanded',o?'true':'false')});
  d.addEventListener('keydown',function(e){if(e.key==='Escape'&&nav.classList.contains('open')){nav.classList.remove('open');if(t){t.setAttribute('aria-expanded','false');t.focus()}}})}
var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'}):null;
function reveal(root){[].forEach.call(root.querySelectorAll('.reveal:not(.in)'),function(el){if(io)io.observe(el);else el.classList.add('in')})}
[].forEach.call(d.querySelectorAll('header .reveal,footer .reveal'),function(el){el.classList.add('in')});
[].forEach.call(d.querySelectorAll('[data-year]'),function(el){el.textContent=String(new Date().getFullYear())});
show();
})();`,
  tabs: `(function(){[].forEach.call(document.querySelectorAll('[data-tabs]'),function(set){
var list=set.querySelector('[role=tablist]');if(!list)return;list.hidden=false;
var tabs=[].slice.call(list.querySelectorAll('[role=tab]'));
function pick(i,focus){tabs.forEach(function(t,k){var on=k===i;t.setAttribute('aria-selected',on?'true':'false');t.tabIndex=on?0:-1;var p=document.getElementById(t.getAttribute('aria-controls'));if(p)p.hidden=!on});if(focus)tabs[i].focus()}
tabs.forEach(function(t,i){t.addEventListener('click',function(){pick(i)});t.addEventListener('keydown',function(e){if(e.key==='ArrowRight')pick((i+1)%tabs.length,true);if(e.key==='ArrowLeft')pick((i-1+tabs.length)%tabs.length,true)})});
pick(0)})})();`,
  lightbox: `(function(){var d=document,box,im,cap,list=[],at=0,back=null;
function build(){box=d.createElement('div');box.className='lightbox';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Photo viewer');
box.innerHTML='<div class="top"><span class="n"></span><button type="button" class="x" aria-label="Close"><svg class="ic" aria-hidden="true"><use href="#i-close"/></svg></button></div><div class="stage"><img alt=""></div><p class="cap"></p><div class="nav2"><button type="button" class="pv" aria-label="Previous photo"><svg class="ic" aria-hidden="true" style="transform:rotate(180deg)"><use href="#i-arrow"/></svg></button><button type="button" class="nx" aria-label="Next photo"><svg class="ic" aria-hidden="true"><use href="#i-arrow"/></svg></button></div>';
d.body.appendChild(box);im=box.querySelector('img');cap=box.querySelector('.cap');
box.querySelector('.x').addEventListener('click',close);box.querySelector('.pv').addEventListener('click',function(){go(-1)});box.querySelector('.nx').addEventListener('click',function(){go(1)});
box.addEventListener('click',function(e){if(e.target===box||e.target.classList.contains('stage'))close()});
var sx=null;box.addEventListener('pointerdown',function(e){sx=e.clientX});box.addEventListener('pointerup',function(e){if(sx!==null&&Math.abs(e.clientX-sx)>50)go(e.clientX<sx?1:-1);sx=null});
d.addEventListener('keydown',function(e){if(box.hidden)return;if(e.key==='Escape')close();if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1)})}
function set(){var b=list[at],i=b.querySelector('img'),c=b.querySelector('figcaption');im.src=b.getAttribute('data-full');im.alt=i?i.alt:'';cap.textContent=c?c.textContent:'';box.querySelector('.n').textContent=(at+1)+' / '+list.length}
function go(k){at=(at+k+list.length)%list.length;set()}
function close(){box.hidden=true;d.documentElement.style.overflow='';if(back)back.focus()}
[].forEach.call(d.querySelectorAll('[data-gallery]'),function(g){var items=[].slice.call(g.querySelectorAll('button[data-full]'));items.forEach(function(b,i){b.addEventListener('click',function(){if(!box)build();list=items;at=i;back=b;set();box.hidden=false;d.documentElement.style.overflow='hidden';box.querySelector('.x').focus()})})});
})();`,
  carousel: `(function(){[].forEach.call(document.querySelectorAll('[data-carousel]'),function(tr){var sec=tr.closest('section');if(!sec)return;[].forEach.call(sec.querySelectorAll('[data-dir]'),function(b){b.addEventListener('click',function(){tr.scrollBy({left:Number(b.getAttribute('data-dir'))*tr.clientWidth*.8,behavior:'smooth'})})})})})();`,
  hours: `(function(){var now=new Date(),day=now.getDay(),mins=now.getHours()*60+now.getMinutes();
function m(t){var x=String(t).trim().toLowerCase().match(/^(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)?$/);if(!x)return null;var h=+x[1];if(x[3]==='pm'&&h<12)h+=12;if(x[3]==='am'&&h===12)h=0;return h*60+(+(x[2]||0))}
[].forEach.call(document.querySelectorAll('table.hours'),function(t){var rows;try{rows=JSON.parse(t.getAttribute('data-hours')||'[]')}catch(e){rows=[]}
var open=null;rows.forEach(function(r,i){if(r.d.indexOf(day)>=0){var tr=t.querySelectorAll('tr')[i];if(tr)tr.classList.add('today');if(r.x)open=false;else{var o=m(r.o),c=m(r.c);if(o!==null&&c!==null)open={yes:mins>=o&&mins<c,until:r.c,from:r.o,later:mins<o}}}});
var box=t.closest('section,footer');var flag=box&&box.querySelector('[data-open-now]');if(!flag||open===null)return;
if(open===false){flag.textContent='Closed today';return}
flag.classList.toggle('yes',open.yes);flag.textContent=open.yes?'Open now · until '+open.until:open.later?'Opens today at '+open.from:'Closed now'})})();`,
  // form: the send buttons are type=button with data-via — a published page's sandbox has no allow-forms, and there the browser
  // drops a form submission before any submit event fires, so a submit handler alone would never run.
  form: `(function(){var d=document;
function wa(n){n=String(n).replace(/[^\\d+]/g,'');if(n.indexOf('00')===0)n='+'+n.slice(2);if(n.charAt(0)==='0')n='+44'+n.slice(1);return n.replace('+','')}
[].forEach.call(d.querySelectorAll('form.ghost-form'),function(f){var note=f.querySelector('.form-note'),idle=note?note.innerHTML:'';
var day=f.querySelector('input[type=date]');if(day){var t=new Date();day.min=t.toISOString().slice(0,10)}
function go(viaAsked){var bad=null,lines=[];
[].forEach.call(f.querySelectorAll('input,select,textarea'),function(el){var v=String(el.value||'').trim();var miss=el.required&&!v;var wrong=el.type==='email'&&v&&!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(v);el.setAttribute('aria-invalid',miss||wrong?'true':'false');if((miss||wrong)&&!bad)bad=el;if(v&&el.name)lines.push(el.name+': '+v)});
if(bad){bad.focus();if(note){note.className='form-note bad';note.textContent='Please fill in '+((bad.labels&&bad.labels[0]&&bad.labels[0].textContent)||'the highlighted field').replace(/\\(optional\\)/,'').trim()+'.'}return}
var via=viaAsked||(f.getAttribute('data-to-wa')?'whatsapp':'email'),subject=f.getAttribute('data-subject')||'Enquiry',text=subject+'\\n\\n'+lines.join('\\n');
var waTo=f.getAttribute('data-to-wa'),mailTo=f.getAttribute('data-to-mail')||'',url='';if(!/^[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+$/.test(mailTo))mailTo='';
if(via==='whatsapp'&&waTo)url='https://wa.me/'+wa(waTo)+'?text='+encodeURIComponent(text);
else if(mailTo)url='mailto:'+encodeURIComponent(mailTo).replace(/%40/g,'@')+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(lines.join('\\n'));
if(!url){if(note){note.className='form-note bad';note.textContent='This form cannot send yet — please call us instead.'}return}
var a=d.createElement('a');a.href=url;a.rel='noopener';a.target=url.indexOf('mailto:')===0?'_top':'_blank';d.body.appendChild(a);a.click();a.remove();
if(note){note.className='form-note ok';note.textContent=(url.indexOf('mailto:')===0?'Your email app should open with the message ready — press send.':'WhatsApp should open with the message ready — press send.')+(mailTo?' Nothing opened? Email '+mailTo+'.':'');setTimeout(function(){note.className='form-note';note.innerHTML=idle},20000)}}
[].forEach.call(f.querySelectorAll('button[data-via]'),function(b){b.addEventListener('click',function(){go(b.getAttribute('data-via'))})});
f.addEventListener('submit',function(e){e.preventDefault();go('')})})})();`,
  nav: '',
};
