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
import { toast } from '../../ui/components';
import { key } from '../../ui/machine';
import { askWithImage } from '../../vision/ask';
import { toJpegDataUrl } from '../../vision/camera';
import { jobsOf, sureWords, textActs, type JobId, type Seen, type TextAct } from '../../vision/jobs';
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
  /** The language of the text, in capitals ("FRENCH"), and its English when it has been translated. */
  lang?: string;
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
  act(what: 'look' | 'nameit' | 'measure' | 'document' | 'ask'): void;
}

const day = (): string => isoDay(new Date());

export function createCards(deps: CardDeps): { el: HTMLElement; update(k: CardInput): void; clear(): void } {
  const el = h('div.lenscards', { role: 'region', 'aria-label': 'What I understand', 'aria-live': 'polite' });
  let sig = '';
  let last: CardInput | null = null;
  const products = new Map<string, LookupResult | 'unknown' | 'failed'>();
  const places = new Map<string, { name: string; summary: string; url: string } | 'unsure' | 'failed'>();
  let productBusy = '';

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
      case 'date':
        return card('date', `A DATE · ${longDay(a.value).toUpperCase()}`, `“${a.text}”`, key('ADD TO AGENDA', async (b) => {
          b.disabled = true;
          const line = (last?.text ?? '').split('\n').find((l) => l.includes(a.text))?.trim() ?? a.text;
          const [y, m, d] = a.value.split('-').map(Number);
          try {
            await brain.addEvent({ title: line.slice(0, 80) || 'From the Lens', start: new Date(y!, m! - 1, d!, 9, 0).getTime(), allDay: true });
            done(`In your agenda for ${longDay(a.value)}.`);
            b.querySelector('span')!.textContent = 'IN YOUR AGENDA';
          } catch {
            b.disabled = false;
            toast('I couldn’t reach my brain to put it in your agenda. Tap again when there is a signal.', 'warn');
          }
        }, { label: `Add ${longDay(a.value)} to your agenda` }));
      case 'phone':
        return card('phone', 'A PHONE NUMBER', a.text, link('CALL', `tel:${a.value}`, `Call ${a.text}`), copy('COPY', a.text, 'the number'));
      case 'address':
        return card('address', 'AN ADDRESS', a.text, key('ON THE MAP', () => {
          cardsState.done = `map: ${a.value}`;
          void import('../../commands/registry').then((m) => m.run('show_map', { place: a.value }));
        }, { label: `Show ${a.text} on the map` }));
      case 'link': {
        let host = a.value;
        try {
          host = new URL(a.value).hostname;
        } catch {
          /* the words as they are */
        }
        return card('link', 'A LINK', host, link('OPEN', a.value, `Open ${host}`), copy('COPY', a.value, 'the link'));
      }
      case 'email':
        return card('email', 'AN EMAIL ADDRESS', a.text, link('WRITE', `mailto:${a.value}`, `Write to ${a.text}`), copy('COPY', a.text, 'the address'));
      case 'sum': {
        const body = h('div.lc-sum', h('p.lc-line', a.text.replace(/=\s*\??\s*$/, '').trim()), h('ol.lc-steps', ...(a.steps ?? []).map((s) => h('li', s))), h('p.lc-answer', `= ${a.value}`.replace(/^= ([a-z]) = /i, '$1 = ')));
        return card('sum', 'A SUM · SOLVED', body, copy('COPY ANSWER', a.value, 'the answer'));
      }
    }
  };

  const lookProduct = (code: string): void => {
    if (products.has(code) || productBusy === code) return;
    if (!last?.online) return;
    productBusy = code;
    cardsState.product = { state: 'looking', name: '' };
    void fetch(`/api/lookup/barcode?code=${encodeURIComponent(code)}`, { headers: headers(), credentials: 'same-origin' })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as LookupResult | null;
        products.set(code, r.ok && j && j.kind !== 'unknown' && j.title ? j : 'unknown');
      })
      .catch(() => products.set(code, 'failed'))
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
    cardsState.place = { state: 'asking', name: '', summary: '' };
    b.querySelector('span')!.textContent = 'ASKING MY MODEL THAT SEES…';
    try {
      const r = await askWithImage(
        'LENS NAME A PLACE: name the famous landmark, building or work of art in this photo. Answer only with JSON of two keys: name (its usual English name, as its Wikipedia article is titled) and sure (one of sure, probably, a guess, cant). If it is no known landmark or artwork, sure is cant. Never name a person.',
        toJpegDataUrl(c, 1024, 0.8),
        undefined,
        { quiet: true, seen: `the phone's namer says it looks like: ${label}` },
      );
      const j = firstJson(r.text) as { name?: unknown; sure?: unknown } | null;
      const name = typeof j?.name === 'string' ? j.name.trim().slice(0, 80) : '';
      if (!name || j?.sure === 'cant') {
        places.set(label, 'unsure');
      } else {
        const about = await fetch(`/api/aim/about?title=${encodeURIComponent(name)}`, { headers: headers(), credentials: 'same-origin' })
          .then((x) => (x.ok ? (x.json() as Promise<{ title?: string; extract?: string; url?: string }>) : null))
          .catch(() => null);
        places.set(label, { name: about?.title || name, summary: about?.extract ?? '', url: about?.url || `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}` });
      }
    } catch {
      places.set(label, 'failed');
    }
    sig = '';
    if (last) update(last);
  };

  const update = (k: CardInput): void => {
    last = k;
    const jobs = k.camera ? jobsOf(k) : [];
    const acts = k.text ? textActs(k.text, day()) : [];
    const code = k.code?.text ?? '';
    const prod = jobs.includes('product') ? products.get(code) : undefined;
    const place = k.thing?.label ? places.get(k.thing.label) : undefined;
    const s = JSON.stringify([jobs, k.text, k.english, k.lang, k.reading, code, k.thing?.label, Math.round((k.thing?.score ?? 0) * 100), k.knownName, k.online, k.eyes, prod ? 1 : 0, productBusy, place ? 1 : 0, cardsState.place.state]);
    if (s === sig) return;
    sig = s;
    cardsState.jobs = jobs;
    cardsState.acts = acts.map((a) => ({ kind: a.kind, value: a.value }));
    cardsState.cards = [];
    const out: HTMLElement[] = [];
    for (const job of jobs) {
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
            const name = [p.title, p.brand, p.quantity].filter(Boolean).join(' · ');
            cardsState.product = { state: 'found', name: p.title };
            out.push(card('product', p.kind === 'book' ? 'A BOOK' : 'A PRODUCT', `${name}${p.nutriscore ? ` · Nutri-Score ${p.nutriscore.toUpperCase()}` : ''}. From ${p.source}${p.credit ? ` (${p.credit})` : ''}.`, key('MORE ABOUT IT', () => deps.act('look'))));
          }
          break;
        }
        case 'code': {
          const info = classifyCode(code);
          const word = info.kind === 'url' ? 'A LINK CODE' : info.kind === 'wifi' ? 'A WI-FI CODE' : info.kind === 'contact' ? 'A CONTACT CODE' : info.kind === 'phone' ? 'A PHONE CODE' : info.kind === 'email' ? 'AN EMAIL CODE' : info.kind === 'geo' ? 'A PLACE CODE' : 'A CODE';
          const open = info.kind === 'url' && /^https?:\/\//i.test(code) ? link('OPEN', code, `Open ${code}`) : info.kind === 'phone' && info.phone ? link('CALL', `tel:${info.phone}`, 'Call the number in the code') : null;
          out.push(card('code', word, (info.url?.host ?? info.wifi?.ssid ?? info.contact?.name ?? info.phone ?? code).slice(0, 120), open, key(open ? 'MORE' : 'WHAT IT HOLDS', () => deps.act('look'))));
          break;
        }
        case 'letter':
          out.push(card('letter', 'A LETTER', 'REMIND ME and FILE are under its words above.', copy('COPY', k.text ?? '', 'the letter')));
          break;
        case 'document':
          out.push(card('document', `A PAGE · ${(k.text ?? '').match(/\S+/g)?.length ?? 0} WORDS`, 'Scan it flat and keep it, or have it read to you.', key('SCAN IT FLAT', () => deps.act('document')), key('READ ALOUD', () => speak(k.text ?? '', 'en-GB'))));
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
              key('READ ALOUD', () => speak(shown, foreign && !k.english ? '' : 'en-GB')),
              foreign && !k.english ? key('TRANSLATE', () => deps.act('ask')) : null,
              copy('COPY', shown, 'the words'),
            ),
          );
          break;
        }
        case 'place': {
          const sure = sureWords(k.thing!.score);
          if (place && typeof place === 'object') {
            cardsState.place = { state: 'found', name: place.name, summary: place.summary };
            out.push(card('place', place.name.toUpperCase(), place.summary ? `${place.summary.slice(0, 280)}${place.summary.length > 280 ? '…' : ''} (Wikipedia)` : 'Named by my free model that sees.', link('WIKIPEDIA', place.url, `Read about ${place.name} on Wikipedia`)));
          } else {
            const said = place === 'unsure' ? 'My model that sees couldn’t name this place for sure.' : place === 'failed' ? 'I couldn’t reach my model that sees. Try again.' : `Looks like a ${k.thing!.label} · ${sure}. Tap to have it named: the picture goes to my free model that sees.`;
            if (place) cardsState.place = { state: place, name: '', summary: '' };
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
          out.push(card('thing', `A ${k.thing!.label.toUpperCase()}`, `${sure} · named on this phone`, key('MEASURE IT', () => deps.act('measure')), k.online ? key('ASK ABOUT IT', () => deps.act('ask')) : null));
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
    clear() {
      sig = '';
      last = null;
      cardsState.jobs = [];
      cardsState.cards = [];
      cardsState.acts = [];
      el.replaceChildren();
      el.hidden = true;
    },
  };
}

