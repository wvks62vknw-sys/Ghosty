/**
 * THE LENS THAT KNOWS ITS JOB (FINAL-LENS): under the viewfinder, a card for each thing the one view understands, best first, each
 * with the one or two keys that do its job. He points the phone; the cards come as the frame is understood:
 *   TEXT      read aloud, translated (the words only), copied; and in its words: a DATE to the Agenda, a PHONE number to call, an
 *             ADDRESS to the map, a LINK to open, an EMAIL to write, a SUM solved and shown worked
 *   A LETTER  the plate's REMIND ME and FILE (features/lens/letter.ts), said here too
 *   A PAGE    scanned flat and saved (SCAN's document part)
 *   A CODE    what it holds, acted on (SCAN's code card); a shop barcode is A PRODUCT, looked up on Open Food Facts and its sister
 *             open databases through the brain (free, no key; only the number is sent)
 *   A THING   named, with how sure; MEASURE IT (the existing measure)
 *   A LIVING THING  the species from the free model that sees (NAME's LIVING THING), on his tap: the picture leaves only then
 *   A PLACE OR ARTWORK  named by the same free model on his tap, with its public encyclopedia summary (the brain's /api/aim/about)
 *   A FACE    only him or someone he introduced, by the name he gave; a stranger is said plainly and never identified
 * Every state is said in his words (vision/jobs.ts and the honest line in one.ts): waking the eyes, looking, nothing found, no signal.
 * The decisions are pure (vision/jobs.ts); this file only draws them and does the acts.
 */
import { brain, headers } from '../../api/brain';
import { h } from '../../core/dom';
import { confirmSheet, toast } from '../../ui/components';
import { key } from '../../ui/machine';
import { askWithImage } from '../../vision/ask';
import { toJpegDataUrl } from '../../vision/camera';
import { DOC_SHARE, jobsOf, sureWords, textActs, type JobId, type Seen, type TextAct } from '../../vision/jobs';
import { classifyCode } from '../../scan/codes';
import { longDay } from '../../../../../packages/shared/src/lifeeasier';
import { firstJson } from '../../../../../packages/shared/src/living';
import type { LookupResult } from '../../../../../packages/shared/src/scan';
import { isoDay } from '../brief/day';
import { sayIn } from '../learning/voices';
import { STRANGER } from './words';

/** What a spec reads (window.__ghosty.cards): the jobs in view, the cards drawn, and the last act done. */
export const cardsState = {
  jobs: [] as JobId[],
  cards: [] as { job: string; head: string; line: string; keys: string[] }[],
  acts: [] as { kind: string; value: string }[],
  done: '',
  product: { state: 'none' as 'none' | 'looking' | 'found' | 'unknown' | 'offline' | 'failed', name: '' },
  place: { state: 'none' as 'none' | 'asking' | 'found' | 'unsure' | 'offline' | 'failed', name: '', summary: '' },
  said: '',
};

/** The words for each state with nothing to show, in his voice. */
export const LOOKING_WORDS = 'Looking…';
export const NOTHING_WORDS = 'Nothing I know yet. Point me at words, a code, a thing, a plant, a place or a page.';
export const NO_SIGNAL_WORDS = 'No signal. I still read words, codes and things on this phone; translations, products, species and places wait for a signal.';

/** What the one view knows, for the cards: the facts (vision/jobs.ts Seen) and what the Lens already has for them. */
export interface CardInput extends Seen {
  /** The face he introduced, by the name he gave it (never sent anywhere). */
  knownName?: string;
  /** The language of the text, in capitals ("FRENCH"), its voice tag ("fr-FR"), and its English when it has been translated. */
  lang?: string;
  langTag?: string;
  /** The thing's own tag (the place a WHAT PLACE IS THIS answer belongs to: that thing, never the next one with the same name). */
  thingId?: number;
  /** The text's own tag (a page stays a page while this tag stays, through a re-read). */
  textId?: number;
  english?: string;
  /** The Lens is still reading the text. */
  reading?: boolean;
  online: boolean;
  /** The object finder is on this phone and working. */
  eyes: boolean;
  camera: boolean;
}

export interface CardDeps {
  /** A crop of the thing (or the whole frame) for an act that needs the picture. */
  picture(job: JobId): HTMLCanvasElement | null;
  /** The old modes, by name: their code and cards kept. */
  act(what: 'look' | 'nameit' | 'measure' | 'document' | 'askthing' | 'translate'): void;
}

const day = (): string => isoDay(new Date());

/** A job by his words (vision/tags.ts lensWord): the card it belongs to, the key it presses, and what is said when there is none. */
export const CARD_WORDS: Record<'solve' | 'call' | 'agenda' | 'map' | 'species' | 'place' | 'aloud' | 'copy', { jobs: string[]; key: string; done: string; none: string }> = {
  solve: { jobs: ['sum'], key: 'COPY ANSWER', done: 'It’s worked out on the card.', none: 'I don’t see a sum yet. Hold the page still.' },
  call: { jobs: ['phone', 'code'], key: 'CALL', done: 'Calling.', none: 'I don’t see a phone number yet.' },
  agenda: { jobs: ['date'], key: 'ADD TO AGENDA', done: 'Putting it in your agenda.', none: 'I don’t see a date yet.' },
  map: { jobs: ['address'], key: 'ON THE MAP', done: 'Finding it on the map.', none: 'I don’t see an address yet.' },
  species: { jobs: ['living'], key: 'WHICH SPECIES', done: 'Asking my model that sees for the species.', none: 'I don’t see a plant or an animal yet. Getting the eyes helps.' },
  place: { jobs: ['place'], key: 'WHAT PLACE IS THIS', done: 'Asking my model that sees which place it is.', none: 'I don’t see a building or a work of art yet. Getting the eyes helps.' },
  aloud: { jobs: ['text', 'letter', 'document'], key: 'READ ALOUD', done: 'Reading it to you.', none: 'I don’t see any words to read yet.' },
  copy: { jobs: ['text', 'letter', 'phone', 'link', 'email', 'sum', 'code'], key: 'COPY', done: 'Copying it.', none: 'I don’t see anything to copy yet.' },
};

export function createCards(deps: CardDeps): { el: HTMLElement; update(k: CardInput): void; clear(): void; press(word: keyof typeof CARD_WORDS): string } {
  const el = h('div.lenscards', { role: 'region', 'aria-label': 'What I understand', 'aria-live': 'polite' });
  let sig = '';
  let last: CardInput | null = null;
  const products = new Map<string, LookupResult | 'unknown' | 'failed'>();
  /** A place's answer belongs to the thing it was asked about (its tag), never to the next thing the namer calls the same. */
  /** The answer is kept with the name the phone gave the thing when he asked; it shows only while the same tag still carries that name. */
  const places = new Map<number, { label: string; v: { name: string; summary: string; url: string } | 'unsure' | 'failed' | 'novision' }>();
  let askingFor = { id: -2, label: '' };
  let productBusy = '';
  /** What he has put in the agenda from the Lens this visit (the day and its line): those cards say so, and do not offer it twice. */
  const added = new Set<string>();
  /** The text tag that is a page: it became one at DOC_SHARE of the picture and stays one down to DOC_SHARE − 0.07 (no flicker at the line). */
  let docFor = -1;

  const card = (job: string, head: string, line: string | Node, ...keys: (HTMLElement | null)[]): HTMLElement => {
    const k = keys.filter((x): x is HTMLElement => !!x);
    const c = h('section.lenscard', { dataset: { job } }, h('p.lc-head', head), typeof line === 'string' ? h('p.lc-line', line) : line, ...(k.length ? [h('div.lc-keys', ...k)] : []));
    cardsState.cards.push({ job, head, line: typeof line === 'string' ? line : (line.textContent ?? ''), keys: k.map((x) => (x.textContent ?? '').trim()) });
    return c;
  };
  const done = (words: string): void => {
    cardsState.done = words;
    toast(words, 'ok');
  };
  const link = (word: string, href: string, label: string): HTMLElement => {
    const a = h('a.g-key.lc-link', { href, target: href.startsWith('http') ? '_blank' : '_self', rel: 'noopener noreferrer', 'aria-label': label, dataset: { case: 'keep' } }, h('span', word));
    a.addEventListener('click', () => (cardsState.done = `${word.toLowerCase()}: ${href}`));
    return a;
  };
  /** OPEN for a link; one with warnings is OPEN ANYWAY and asks first (as SCAN's card does), the warnings said. */
  const openKey = (href: string, domain: string, warnings: string[]): HTMLElement => {
    if (!warnings.length) return link('OPEN', href, `Open ${domain}`);
    return key('OPEN ANYWAY', async () => {
      if (!(await confirmSheet(`Open ${domain}?`, warnings.join(' '), 'OPEN'))) return;
      cardsState.done = `open: ${href}`;
      window.open(href, '_blank', 'noopener,noreferrer');
    }, { label: `Open ${domain} anyway: ${warnings.join(' ')}` });
  };
  const copy = (word: string, text: string, what: string): HTMLButtonElement =>
    key(word, () => {
      void navigator.clipboard?.writeText(text).then(
        () => done(`Copied ${what}.`),
        () => toast('This phone would not let me copy it. Hold on the words to copy them yourself.', 'warn'),
      );
      cardsState.done = `copied ${what}`;
    });

  /** One card for each thing in the words he can act on. */
  const actCard = (a: TextAct): HTMLElement => {
    switch (a.kind) {
      case 'date': {
        const line = (last?.text ?? '').split('\n').find((l) => l.includes(a.text))?.trim() ?? a.text;
        const id = `${a.value}|${line}`;
        if (added.has(id)) {
          const b = key('IN YOUR AGENDA', () => undefined, { label: `${longDay(a.value)} is in your agenda` });
          b.disabled = true;
          return card('date', `A DATE · ${longDay(a.value).toUpperCase()}`, `“${a.text}”`, b);
        }
        return card('date', `A DATE · ${longDay(a.value).toUpperCase()}`, `“${a.text}”`, key('ADD TO AGENDA', async (b) => {
          b.disabled = true;
          const [y, m, d] = a.value.split('-').map(Number);
          try {
            await brain.addEvent({ title: line.slice(0, 80) || 'From the Lens', start: new Date(y!, m! - 1, d!, 9, 0).getTime(), allDay: true });
            added.add(id);
            done(`In your agenda for ${longDay(a.value)}.`);
            b.querySelector('span')!.textContent = 'IN YOUR AGENDA';
          } catch {
            b.disabled = false;
            toast('I couldn’t reach my brain to put it in your agenda. Tap again when there is a signal.', 'warn');
          }
        }, { label: `Add ${longDay(a.value)} to your agenda` }));
      }
      case 'phone':
        return card('phone', 'A PHONE NUMBER', a.text, link('CALL', `tel:${a.value}`, `Call ${a.text}`), copy('COPY', a.text, 'the number'));
      case 'address':
        return card('address', 'AN ADDRESS', a.text, key('ON THE MAP', () => {
          cardsState.done = `map: ${a.value}`;
          void import('../../commands/registry').then((m) => m.run('show_map', { place: a.value }));
        }, { label: `Show ${a.text} on the map` }));
      case 'link': {
        // a link read off print gets SCAN's checks too (a look-alike address, an unencrypted page, a bare number)
        const u = classifyCode(a.value).url;
        const domain = u?.domain ?? a.value;
        const body = h('div.lc-body', h('p.lc-line', u && u.host !== u.domain ? `${u.domain} (${u.host})` : domain), ...(u?.warnings ?? []).map((w) => h('p.lc-warn', `Careful: ${w}`)));
        return card('link', 'A LINK', body, openKey(u?.href ?? a.value, domain, u?.warnings ?? []), copy('COPY', a.value, 'the link'));
      }
      case 'email':
        return card('email', 'AN EMAIL ADDRESS', a.text, link('WRITE', `mailto:${a.value}`, `Write to ${a.text}`), copy('COPY', a.text, 'the address'));
      case 'sum': {
        const body = h('div.lc-sum', h('p.lc-line', a.text.replace(/=\s*\??\s*$/, '').trim()), h('ol.lc-steps', ...(a.steps ?? []).map((s) => h('li', s))), h('p.lc-answer', `= ${a.value}`.replace(/^= ([a-z]) = /i, '$1 = ')));
        return card('sum', 'A SUM · SOLVED', body, copy('COPY ANSWER', a.value, 'the answer'));
      }
    }
  };

  /** What a QR code holds, acted on in the card itself: a link (with SCAN's warnings), a Wi-Fi network, a contact, a number, a text, an email, a place. */
  const codeCard = (code: string): HTMLElement => {
    const info = classifyCode(code);
    const more = (word = 'MORE') => key(word, () => deps.act('look'), { label: 'Everything the code holds, in SCAN' });
    switch (info.kind) {
      case 'url': {
        const u = info.url;
        const safe = !!u && (u.scheme === 'https' || u.scheme === 'http');
        const body = h('div.lc-body', h('p.lc-line', u ? `${u.domain}${u.host !== u.domain ? ` (${u.host})` : ''}` : code.slice(0, 120)), ...(u?.warnings ?? []).map((w) => h('p.lc-warn', `Careful: ${w}`)));
        return card('code', 'A LINK CODE', body, safe && u ? openKey(u.href, u.domain, u.warnings) : null, copy('COPY', u?.href ?? code, 'the link'), more());
      }
      case 'wifi': {
        const w = info.wifi!;
        return card('code', 'A WI-FI CODE', `Network ${w.ssid || '(no name)'}${w.security && w.security !== 'nopass' ? ` · ${w.security}` : ' · open'}${w.hidden ? ' · hidden' : ''}`, w.password ? copy('COPY PASSWORD', w.password, 'the Wi-Fi password') : null, more());
      }
      case 'contact': {
        const c = info.contact!;
        return card('code', 'A CONTACT CODE', [c.name, c.org].filter(Boolean).join(' · ') || 'A contact card', c.phones[0] ? link('CALL', `tel:${c.phones[0].replace(/[^\d+]/g, '')}`, `Call ${c.name || 'them'}`) : null, c.emails[0] ? link('WRITE', `mailto:${c.emails[0]}`, `Write to ${c.name || c.emails[0]}`) : null, more());
      }
      case 'phone':
        return card('code', 'A PHONE CODE', info.phone ?? code, info.phone ? link('CALL', `tel:${info.phone.replace(/[^\d+]/g, '')}`, `Call ${info.phone}`) : null, more());
      case 'sms': {
        const s = info.sms!;
        return card('code', 'A TEXT MESSAGE CODE', `To ${s.to}${s.body ? `: “${s.body.slice(0, 80)}”` : ''}`, link('TEXT', `sms:${s.to}${s.body ? `?body=${encodeURIComponent(s.body)}` : ''}`, `Text ${s.to}`), more());
      }
      case 'email': {
        const e = info.email!;
        return card('code', 'AN EMAIL CODE', `${e.to}${e.subject ? ` · “${e.subject.slice(0, 60)}”` : ''}`, link('WRITE', `mailto:${e.to}?${new URLSearchParams({ ...(e.subject ? { subject: e.subject } : {}), ...(e.body ? { body: e.body } : {}) }).toString().replace(/\+/g, '%20')}`, `Write to ${e.to}`), more());
      }
      case 'geo': {
        const g = info.geo!;
        return card('code', 'A PLACE CODE', g.label || `${g.lat.toFixed(5)}, ${g.lon.toFixed(5)}`, key('ON THE MAP', () => {
          cardsState.done = `map: ${g.lat},${g.lon}`;
          void import('../../commands/registry').then((m) => m.run('show_map', { lat: g.lat, lon: g.lon, place: g.label || 'the place in the code' }));
        }, { label: 'Show the place in the code on the map' }), more());
      }
      default:
        return card('code', 'A CODE', code.slice(0, 160), copy('COPY', code, 'what the code says'), more('WHAT IT HOLDS'));
    }
  };

  /** A product as a specialist food app shows it: what it is, its grade, the figures per 100 g, the allergens, and whose data it is. */
  const productBody = (p: LookupResult): HTMLElement => {
    const n = p.nutrition ?? {};
    const g = (v: number | undefined, unit: string, word: string) => (v == null ? '' : `${word} ${v < 1 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10}${unit}`);
    const per = [g(n.kcal, ' kcal', 'energy').replace('energy ', ''), g(n.sugars, ' g', 'sugars'), g(n.fat, ' g', 'fat'), g(n.saturates, ' g', 'saturates'), g(n.salt, ' g', 'salt'), g(n.protein, ' g', 'protein')].filter(Boolean);
    const grades = [p.nutriscore ? `Nutri-Score ${p.nutriscore.toUpperCase()}` : '', p.ecoscore ? `Green-Score ${p.ecoscore.toUpperCase()}` : ''].filter(Boolean).join(' · ');
    const book = p.kind === 'book' ? [p.authors?.join(', '), p.year, p.publisher, p.pages ? `${p.pages} pages` : ''].filter(Boolean).join(' · ') : '';
    return h('div.lc-body',
      h('p.lc-line', [p.title, p.brand, p.quantity].filter(Boolean).join(' · ')),
      ...(book ? [h('p.lc-line', book)] : []),
      ...(grades ? [h('p.lc-line', grades)] : []),
      ...(per.length ? [h('p.lc-small', `Per 100 g: ${per.join(' · ')}`)] : []),
      ...(p.allergens?.length ? [h('p.lc-warn', `Contains: ${p.allergens.join(', ')}`)] : []),
      h('p.lc-small', `From ${p.source}${p.credit ? ` (${p.credit})` : ''}.`),
    );
  };

  const lookProduct = (code: string): void => {
    if (products.has(code) || productBusy === code) return;
    if (!last?.online) return;
    productBusy = code;
    cardsState.product = { state: 'looking', name: '' };
    void fetch(`/api/lookup/barcode?code=${encodeURIComponent(code)}`, { headers: headers(), credentials: 'same-origin' })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as (LookupResult & { note?: string }) | null;
        if (r.ok && j && j.kind !== 'unknown' && j.title) return void products.set(code, j);
        // the brain down, refused, or the databases out (their note says what failed): asked again, never "nobody knows it"
        const outage = !r.ok || !j || /\(.*(time|fail|error|could|unreach|refus|\b[45]\d\d\b)/i.test(j.note ?? '');
        products.set(code, outage ? 'failed' : 'unknown');
        setTimeout(() => products.get(code) === (outage ? 'failed' : 'unknown') && products.delete(code), outage ? 30_000 : 10 * 60_000);
      })
      .catch(() => {
        products.set(code, 'failed');
        // a lookup the signal failed is tried again the next time the code is in view, half a minute on
        setTimeout(() => products.get(code) === 'failed' && products.delete(code), 30_000);
      })
      .finally(() => {
        productBusy = '';
        sig = '';
        if (last) update(last);
      });
  };

  const askPlace = async (b: HTMLButtonElement): Promise<void> => {
    const c = deps.picture('place');
    if (!c) return void toast('Open the camera first', 'warn');
    if (!last?.online) return void toast(NO_SIGNAL_WORDS, 'warn');
    b.disabled = true;
    const label = last.thing?.label ?? 'place';
    const id = last.thingId ?? -1;
    askingFor = { id, label };
    places.delete(id);
    cardsState.place = { state: 'asking', name: '', summary: '' };
    sig = '';
    update(last);
    try {
      const r = await askWithImage(
        'LENS NAME A PLACE: name the famous landmark, building or work of art in this photo. Answer only with JSON of two keys: name (its usual English name, as its Wikipedia article is titled) and sure (one of sure, probably, a guess, cant). If it is no known landmark or artwork, sure is cant. Never name a person.',
        toJpegDataUrl(c, 1024, 0.8),
        undefined,
        { quiet: true, seen: `the phone's namer says it looks like: ${label}` },
      );
      const j = firstJson(r.text) as { name?: unknown; sure?: unknown } | null;
      const name = typeof j?.name === 'string' ? j.name.trim().slice(0, 80) : '';
      if (r.noVision) places.set(id, { label, v: 'novision' });
      else if (r.error && !r.text) places.set(id, { label, v: 'failed' });
      else if (!name || j?.sure === 'cant') {
        places.set(id, { label, v: 'unsure' });
      } else {
        const about = await fetch(`/api/aim/about?title=${encodeURIComponent(name)}`, { headers: headers(), credentials: 'same-origin' })
          .then((x) => (x.ok ? (x.json() as Promise<{ title?: string; extract?: string; url?: string }>) : null))
          .catch(() => null);
        places.set(id, { label, v: { name: about?.title || name, summary: about?.extract ?? '', url: about?.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}` } });
      }
    } catch {
      places.set(id, { label, v: 'failed' });
    }
    if (askingFor.id === id && askingFor.label === label) askingFor = { id: -2, label: '' };
    sig = '';
    if (last) update(last);
  };

  const update = (k0: CardInput): void => {
    // a page stays a page while its words stay and it is still most of the way there (0.38 of the picture, against 0.45 to become one)
    const k = k0.text && k0.textId != null && k0.textId === docFor && (k0.textShare ?? 0) >= DOC_SHARE - 0.07 ? { ...k0, textShare: Math.max(k0.textShare ?? 0, DOC_SHARE) } : k0;
    last = k;
    const jobs = k.camera ? jobsOf(k) : [];
    docFor = jobs.includes('document') ? (k.textId ?? -1) : -1;
    // while the words are being read again, nothing is offered on the words that were: a new scene's number is never the old one
    const acts = k.text && !k.reading ? textActs(k.text, day()) : [];
    const code = k.code?.text ?? '';
    const prod = jobs.includes('product') ? products.get(code) : undefined;
    const pe = k.thingId != null ? places.get(k.thingId) : undefined;
    const place = pe && pe.label === (k.thing?.label ?? '') ? pe.v : undefined;
    const asking = k.thingId != null && askingFor.id === k.thingId && askingFor.label === (k.thing?.label ?? '');
    const s = JSON.stringify([jobs, k.text, k.english, k.lang, k.reading, code, k.thing?.label, k.thingId, Math.round((k.thing?.score ?? 0) * 100), k.knownName, k.online, k.eyes, prod ? 1 : 0, productBusy, typeof place === 'object' ? 1 : place ?? 0, asking, added.size]);
    if (s === sig) return;
    sig = s;
    cardsState.jobs = jobs;
    cardsState.acts = acts.map((a) => ({ kind: a.kind, value: a.value }));
    cardsState.cards = [];
    const out: HTMLElement[] = [];
    let readingSaid = false;
    for (const job of jobs) {
      // the words are being read again (a small move, or a new page): one card says so, with nothing to tap until they are read
      if (k.reading && k.text && (job === 'text' || job === 'letter' || job === 'document')) {
        if (!readingSaid) out.push(card('reading', 'READING AGAIN', 'Reading the words again…'));
        readingSaid = true;
        continue;
      }
      switch (job) {
        case 'stranger':
          out.push(card('stranger', 'SOMEONE I DON’T KNOW', STRANGER));
          break;
        case 'known':
          out.push(card('known', (k.knownName || 'SOMEONE YOU INTRODUCED').toUpperCase(), 'Someone you introduced. Their face stays on this phone.'));
          break;
        case 'product': {
          if (!prod && k.online) lookProduct(code);
          const p = products.get(code);
          if (!k.online && !p) {
            cardsState.product = { state: 'offline', name: '' };
            out.push(card('product', `A PRODUCT · ${code}`, 'No signal: I’ll look this barcode up on the open food and product databases when there is one.', key('WHAT IT HOLDS', () => deps.act('look'))));
          } else if (!p || productBusy === code) {
            cardsState.product = { state: 'looking', name: '' };
            out.push(card('product', `A PRODUCT · ${code}`, 'Looking it up on Open Food Facts…'));
          } else if (p === 'unknown' || p === 'failed') {
            cardsState.product = { state: p, name: '' };
            out.push(card('product', `A PRODUCT · ${code}`, p === 'unknown' ? 'No open database knows this barcode yet.' : 'I couldn’t reach the product databases. Tap to try in SCAN.', key('MORE ABOUT IT', () => deps.act('look'))));
          } else {
            cardsState.product = { state: 'found', name: p.title };
            out.push(card('product', p.kind === 'book' ? 'A BOOK' : 'A PRODUCT', productBody(p), key('MORE ABOUT IT', () => deps.act('look'))));
          }
          break;
        }
        case 'code':
          out.push(codeCard(code));
          break;
        case 'letter':
          out.push(card('letter', 'A LETTER', 'REMIND ME and FILE are under its words above.', key('READ ALOUD', () => speak(k.text ?? '', k.langTag || 'en-GB')), copy('COPY', k.text ?? '', 'the letter')));
          break;
        case 'document':
          out.push(card('document', `A PAGE · ${(k.text ?? '').match(/\S+/g)?.length ?? 0} WORDS`, 'Scan it flat and keep it, or have it read to you.', key('SCAN IT FLAT', () => deps.act('document')), key('READ ALOUD', () => speak(k.text ?? '', k.langTag || 'en-GB'))));
          break;
        case 'text': {
          const own = (k.text ?? '').replace(/\s+/g, ' ').trim();
          const foreign = !!k.lang && k.lang !== 'ENGLISH' && k.lang !== 'UNKNOWN';
          const shown = foreign && k.english ? k.english : own;
          out.push(
            card(
              'text',
              foreign ? `TEXT · ${k.lang}${k.english ? ' · IN ENGLISH' : ''}` : 'TEXT',
              shown.slice(0, 160) + (shown.length > 160 ? '…' : ''),
              // (in its own language's voice until it has its English)
              key('READ ALOUD', () => speak(shown, foreign && !k.english ? k.langTag || 'en-GB' : 'en-GB')),
              foreign && !k.english && k.online ? key('TRANSLATE', () => deps.act('translate')) : null,
              copy('COPY', shown, 'the words'),
            ),
          );
          break;
        }
        case 'place': {
          const sure = sureWords(k.thing!.score);
          if (asking) {
            const b = key('ASKING MY MODEL THAT SEES…', () => undefined);
            b.disabled = true;
            out.push(card('place', `A ${k.thing!.label.toUpperCase()} · ${sure.toUpperCase()}`, 'Asking my free model that sees which place this is…', b));
          } else if (place && typeof place === 'object') {
            cardsState.place = { state: 'found', name: place.name, summary: place.summary };
            out.push(card('place', place.name.toUpperCase(), place.summary ? `${place.summary.slice(0, 280)}${place.summary.length > 280 ? '…' : ''} (Wikipedia)` : 'Named by my free model that sees.', link('WIKIPEDIA', place.url, `Read about ${place.name} on Wikipedia`), k.online ? key('ASK AGAIN', (b) => void askPlace(b), { label: 'Not it? Ask my model that sees again' }) : null));
          } else {
            const said = place === 'unsure' ? 'My model that sees couldn’t name this place for sure. Try closer, or from the front.' : place === 'failed' ? 'I couldn’t reach my model that sees. Try again.' : place === 'novision' ? 'No free model that sees is reachable right now. Try again in a minute.' : `Looks like a ${k.thing!.label} · ${sure}. Tap to have it named: the picture goes to my free model that sees.`;
            if (place) cardsState.place = { state: place === 'novision' ? 'failed' : place, name: '', summary: '' };
            out.push(card('place', `A ${k.thing!.label.toUpperCase()} · ${sure.toUpperCase()}`, k.online ? said : NO_SIGNAL_WORDS, k.online ? key('WHAT PLACE IS THIS', (b) => void askPlace(b)) : null));
          }
          break;
        }
        case 'living': {
          const sure = sureWords(k.thing!.score);
          out.push(card('living', `A ${k.thing!.label.toUpperCase()} · ${sure.toUpperCase()}`, k.online ? 'Tap for the species: the picture goes to my free model that sees, and nothing is kept unless you save it.' : NO_SIGNAL_WORDS, k.online ? key('WHICH SPECIES', () => deps.act('nameit')) : null));
          break;
        }
        case 'thing': {
          const sure = sureWords(k.thing!.score);
          out.push(card('thing', `A ${k.thing!.label.toUpperCase()}`, `${sure} · named on this phone`, key('MEASURE IT', () => deps.act('measure')), k.online ? key('ASK ABOUT IT', () => deps.act('askthing')) : null));
          break;
        }
        case 'nothing':
          break;
      }
    }
    for (const a of acts) out.push(actCard(a));
    if (!out.length && k.camera) {
      const words = k.reading ? 'Reading the words…' : !k.online ? NO_SIGNAL_WORDS : k.eyes ? NOTHING_WORDS : '';
      if (words) out.push(card('nothing', k.reading ? 'READING' : !k.online ? 'NO SIGNAL' : 'NOTHING YET', words));
    }
    cardsState.said = out.map((c) => c.textContent ?? '').join(' | ');
    el.replaceChildren(...out);
    el.hidden = !out.length;
  };

  const speak = (text: string, tag: string): void => {
    if (!text) return;
    cardsState.done = `said aloud: ${text.slice(0, 60)}`;
    if (!sayIn(text, tag || 'en-GB')) toast('This phone has no voice to read it with.', 'warn');
  };

  return {
    el,
    update,
    /** Do a card's job by his words: the first card of its jobs that has the key (a sum is shown worked already: saying so is the job). */
    press(word) {
      const w = CARD_WORDS[word];
      for (const job of w.jobs) {
        const k = [...el.querySelectorAll<HTMLElement>(`.lenscard[data-job="${job}"] .lc-keys > *`)].find((x) => (x.textContent ?? '').trim().startsWith(w.key));
        if (k) {
          if (word !== 'solve') k.click();
          if (word === 'solve') {
            const c = k.closest('.lenscard');
            const steps = [...(c?.querySelectorAll('.lc-steps li') ?? [])].map((x) => x.textContent).join('; ');
            return `${steps}. So it’s ${(c?.querySelector('.lc-answer')?.textContent ?? '').replace(/^= /, '')}.`;
          }
          return w.done;
        }
      }
      // the card is there but its key is not, for a reason its own words give: a date already in the agenda; a plant or a place
      // with no signal, or already being asked about. Any other card is not this job's, and says nothing for it.
      if (word === 'agenda' && el.querySelector('.lenscard[data-job="date"] .lc-keys > [disabled]')) return 'That’s already in your agenda.';
      if (word === 'species' || word === 'place') {
        const there = el.querySelector(`.lenscard[data-job="${word === 'species' ? 'living' : 'place'}"]`);
        if (there) return (there.querySelector('.lc-line')?.textContent ?? '').trim() || w.none;
      }
      if (el.querySelector('.lenscard[data-job="reading"]')) return 'I’m reading the words again. Ask me in a moment.';
      return w.none;
    },
    clear() {
      sig = '';
      last = null;
      places.clear();
      askingFor = { id: -2, label: '' };
      docFor = -1;
      added.clear();
      cardsState.jobs = [];
      cardsState.cards = [];
      cardsState.acts = [];
      el.replaceChildren();
      el.hidden = true;
    },
  };
}

