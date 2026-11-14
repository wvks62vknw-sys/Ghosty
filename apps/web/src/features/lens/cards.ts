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
import { openSafe } from '../../core/safeurl';
import { h } from '../../core/dom';
import { confirmSheet, modal, toast, undo } from '../../ui/components';
import { key } from '../../ui/machine';
import { askWithImage } from '../../vision/ask';
import { toJpegDataUrl } from '../../vision/camera';
import { ALLERGENS, DIETS, DOC_SHARE, avoidFromWords, avoidVerdict, bandOf, comparePackets, jobsOf, nhsSearch, readBusStop, readBusinessCard, readMedicine, readRating, receiptCsv, runningCost, sureWords, textActs, vcardOf, type CardContact, type JobId, type Seen, type TextAct } from '../../vision/jobs';
import { readReceipt } from '../../../../../packages/shared/src/homeadmin';
import { classifyCode } from '../../scan/codes';
import { letterOf, longDay } from '../../../../../packages/shared/src/lifeeasier';
import { firstJson } from '../../../../../packages/shared/src/living';
import type { LookupResult } from '../../../../../packages/shared/src/scan';
import { isoDay } from '../brief/day';
import { sayIn } from '../learning/voices';
import { STRANGER } from './words';
import { looksEnglish } from '../../vision/tags';

/** What a spec reads (window.__ghosty.cards): the jobs in view, the cards drawn, and the last act done. */
export const cardsState = {
  jobs: [] as JobId[],
  cards: [] as { job: string; head: string; line: string; keys: string[] }[],
  acts: [] as { kind: string; value: string }[],
  done: '',
  product: { state: 'none' as 'none' | 'looking' | 'found' | 'unknown' | 'offline' | 'failed', name: '' },
  place: { state: 'none' as 'none' | 'asking' | 'found' | 'unsure' | 'offline' | 'failed', name: '', summary: '' },
  said: '',
  /** What he avoids (kept on this phone only), and the last verdict a packet got against it. */
  avoid: [] as string[],
  verdict: { tone: '' as string, line: '' },
  /** The last receipt put into his spending (or 'duplicate'), and what HOME kept from it. */
  spent: { state: '' as '' | 'adding' | 'added' | 'duplicate' | 'failed', line: '' },
  /** The last contact made for his phone's contacts from a business card or a contact code (made on the phone; nobody is looked up). */
  contact: { state: '' as '' | 'shared' | 'saved' | 'failed', name: '', vcf: '' },
  /** A bus stop's next buses, asked by the stop's name on the sign (never where he is). */
  buses: { state: '' as '' | 'asking' | 'found' | 'offline' | 'failed', stop: '', text: '' },
  /** An appliance's running cost at his price (a first estimate), and the price it used. */
  cost: { watts: 0, price: 0, line: '' },
  /** The last two packets put side by side (lens.u8): their names and the one line. */
  compare: { a: '', b: '', line: '' },
  /** The prices in view in pounds, once he asked (the sweep). */
  pounds: [] as string[],
};

/** His price for a unit of electricity (pence a kWh), kept on this phone; 25p until he says his own. */
const KWH_KEY = 'ghosty.lens.kwh';
export const DEFAULT_KWH = 25;
export function loadKwh(): { price: number; his: boolean } {
  try {
    const v = Number(localStorage.getItem(KWH_KEY));
    return v > 0 && v < 500 ? { price: v, his: true } : { price: DEFAULT_KWH, his: false };
  } catch {
    return { price: DEFAULT_KWH, his: false };
  }
}

/** What he avoids: kept on this phone and nowhere else (never sent with a lookup: only the barcode's number goes out). */
const AVOID_KEY = 'ghosty.lens.avoid';
export function loadAvoid(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(AVOID_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
export function saveAvoid(list: string[]): boolean {
  try {
    localStorage.setItem(AVOID_KEY, JSON.stringify([...new Set(list)]));
    return true;
  } catch {
    return false;
  }
}
const avoidSaid = (list: string[]): string => {
  const words = list.map((id) => ALLERGENS.find((a) => a.id === id)?.say ?? DIETS.find((d) => d.id === id)?.say ?? id);
  return words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
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
  /** A menu read line by line: the lines, and the English for each when it came back lined up (lens.u1). */
  lines?: string[];
  lineEnglish?: string[];
  /** The text's own tag (a page stays a page while this tag stays, through a re-read). */
  textId?: number;
  english?: string;
  /** Its words are out to be put into English, or that came back with nothing. */
  translating?: '' | 'sending' | 'failed';
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
export const CARD_WORDS: Record<'solve' | 'call' | 'agenda' | 'map' | 'species' | 'place' | 'aloud' | 'copy' | 'contacts' | 'buses' | 'nhs' | 'compare', { jobs: string[]; key: string; done: string; none: string }> = {
  solve: { jobs: ['sum'], key: 'COPY ANSWER', done: 'It’s worked out on the card.', none: 'I don’t see a sum yet. Hold the page still.' },
  call: { jobs: ['phone', 'code', 'contact'], key: 'CALL', done: 'Calling.', none: 'I don’t see a phone number yet.' },
  agenda: { jobs: ['date'], key: 'ADD TO AGENDA', done: 'Putting it in your agenda.', none: 'I don’t see a date yet.' },
  map: { jobs: ['address'], key: 'ON THE MAP', done: 'Finding it on the map.', none: 'I don’t see an address yet.' },
  species: { jobs: ['living'], key: 'WHICH SPECIES', done: 'Asking my model that sees for the species.', none: 'I don’t see a plant or an animal yet. Getting the eyes helps.' },
  place: { jobs: ['place'], key: 'WHAT PLACE IS THIS', done: 'Asking my model that sees which place it is.', none: 'I don’t see a building or a work of art yet. Getting the eyes helps.' },
  aloud: { jobs: ['text', 'letter', 'document', 'medicine'], key: 'READ ALOUD', done: 'Reading it to you.', none: 'I don’t see any words to read yet.' },
  copy: { jobs: ['text', 'letter', 'phone', 'link', 'email', 'sum', 'code', 'contact', 'stop', 'parcel', 'unit', 'price'], key: 'COPY', done: 'Copying it.', none: 'I don’t see anything to copy yet.' },
  contacts: { jobs: ['contact', 'code'], key: 'ADD TO CONTACTS', done: 'Handing it to your phone’s contacts.', none: 'I don’t see a business card or a contact code yet.' },
  buses: { jobs: ['stop'], key: 'NEXT BUSES', done: 'Asking for the next buses from this stop.', none: 'I don’t see a bus stop sign yet. Hold it so its name is in view.' },
  nhs: { jobs: ['medicine'], key: 'OPEN THE NHS PAGE', done: 'Opening the NHS page about it.', none: 'I don’t see a medicine box yet. Hold it so its name is in view.' },
  compare: { jobs: ['product'], key: 'COMPARE', done: 'Side by side, per 100 g.', none: 'Scan two packets, one after the other, and I’ll put them side by side.' },
};

export function createCards(deps: CardDeps): { el: HTMLElement; update(k: CardInput): void; clear(): void; press(word: keyof typeof CARD_WORDS): string; avoid(text: string): string; openAvoid(): void } {
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
  /** The receipts already put into his spending this visit (by their CSV line), so a held receipt is never added twice. */
  const spentOnce = new Set<string>();
  /** The food packets found this visit, newest last: the one before the packet in view is offered to COMPARE with it. */
  const foods: string[] = [];
  /** Today's exchange rates once he has asked for a price in pounds (MARKETS' free feed), and whether they are on their way. */
  let ratesNow: { per: Record<string, number>; at: number } | null = null;
  let ratesBusy = false;
  /** A stop's next buses, by the stop's name on its sign: asked once a visit, on his tap. */
  const buses = new Map<string, { state: 'asking' | 'found' | 'failed'; text: string }>();

  /** WHAT I AVOID: his allergies and ways of eating, ticked once, kept on this phone; every packet then gets its line. */
  const openAvoid = (prefill: string[] = []): void => {
    const have = new Set([...loadAvoid(), ...prefill]);
    const box = (id: string, say: string) => {
      const input = h('input', { type: 'checkbox', checked: have.has(id), 'aria-label': say, dataset: { avoid: id } }) as HTMLInputElement;
      return h('label.lc-tick', input, h('span', say));
    };
    const msg = h('p.lc-small', { role: 'status', 'aria-live': 'polite' }, 'Kept only on this phone. Every packet you point me at then gets a red, amber or green line for you.');
    const body = h('div.lc-avoid',
      msg,
      h('p.lc-head', 'ALLERGIES'),
      h('div.lc-ticks', ...ALLERGENS.map((a) => box(a.id, a.say))),
      h('p.lc-head', 'WAYS OF EATING'),
      h('div.lc-ticks', ...DIETS.map((d) => box(d.id, d.say))),
      h('div.lc-keys',
        key('KEEP THIS LIST', () => {
          const list = [...body.querySelectorAll<HTMLInputElement>('input[data-avoid]')].filter((i) => i.checked).map((i) => i.dataset.avoid!);
          if (!saveAvoid(list)) return void (msg.textContent = 'This phone would not keep it: its storage is full or blocked.');
          cardsState.avoid = list;
          cardsState.done = `avoid: ${list.join(', ')}`;
          sheet.close();
          toast(list.length ? `Kept on this phone: you avoid ${avoidSaid(list)}.` : 'Your list is empty: packets get no line for you.', 'ok');
          sig = '';
          if (last) update(last);
        }, { label: 'Keep this list on this phone' }),
        key('CANCEL', () => sheet.close()),
      ),
    );
    const sheet = modal('WHAT I AVOID', body);
  };

  /** A receipt into this month's spending: one row, by the rules alone (no shop name goes to any model), then its category's budget. */
  const intoSpending = async (b: HTMLButtonElement, rc: { store: string; date: string; total: number }): Promise<void> => {
    const csv = receiptCsv(rc, day());
    b.disabled = true;
    cardsState.spent = { state: 'adding', line: '' };
    try {
      const r = await brain.spendingImport(csv, true);
      spentOnce.add(csv);
      if (!r.result.added && r.result.duplicates) {
        cardsState.spent = { state: 'duplicate', line: 'That receipt is in your spending already.' };
        done(cardsState.spent.line);
      } else {
        const row = r.rows.find((x) => x.d === (rc.date || day()) && Math.abs(x.a + rc.total) < 0.005);
        const bud = row ? r.budgets.find((x) => x.category === row.c) : undefined;
        const line = `In your spending: £${rc.total.toFixed(2)}${rc.store ? ` at ${rc.store}` : ''}, ${longDay(rc.date || day())}${row ? ` (${row.c})` : ''}.${bud ? ` ${bud.line}` : ''}`;
        cardsState.spent = { state: 'added', line };
        done(line);
      }
    } catch {
      b.disabled = false;
      cardsState.spent = { state: 'failed', line: 'I couldn’t reach my brain to add it. Tap again when there is a signal.' };
      toast(cardsState.spent.line, 'warn');
    }
    sig = '';
    if (last) update(last);
  };

  /** A contact into his phone's own contacts: a vCard made here, handed to the phone's share sheet (or saved as a file). */
  let handing = false;
  const toContacts = async (c: Pick<CardContact, 'name'> & Partial<CardContact>): Promise<void> => {
    // (a second tap while the share sheet opens would throw: the first one is still handing it over)
    if (handing) return;
    handing = true;
    setTimeout(() => (handing = false), 1500);
    const vcf = vcardOf(c);
    const fileName = `${(c.name || 'contact').replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 40) || 'contact'}.vcf`;
    cardsState.contact = { state: '', name: c.name, vcf };
    try {
      const file = new File([vcf], fileName, { type: 'text/vcard' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: c.name });
        cardsState.contact.state = 'shared';
        done(`${c.name}: choose Contacts to add them.`);
        return;
      }
      const url = URL.createObjectURL(file);
      const a = h('a', { href: url, download: fileName, hidden: true });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      cardsState.contact.state = 'saved';
      done(`${c.name}: open the file to add them to your contacts.`);
    } catch (e) {
      // he closed the share sheet: nothing to say
      if ((e as { name?: string } | null)?.name === 'AbortError') return;
      cardsState.contact.state = 'failed';
      toast('This phone would not take the contact. COPY the details and add them yourself.', 'warn');
    }
  };

  /** A bus stop's next buses: the stop's name from its sign goes to the brain's free departures (never where he is). */
  const nextBuses = async (b: HTMLButtonElement, stop: string): Promise<void> => {
    if (!last?.online) {
      cardsState.buses = { state: 'offline', stop, text: '' };
      return void toast('No signal: the next buses need one. Hold the sign again when there is.', 'warn');
    }
    b.disabled = true;
    buses.set(stop, { state: 'asking', text: '' });
    cardsState.buses = { state: 'asking', stop, text: '' };
    sig = '';
    update(last);
    try {
      const r = await askWithImage(`next buses from ${stop}`, null, undefined, { quiet: true, bare: true });
      const text = r.text.trim();
      buses.set(stop, text && !r.error ? { state: 'found', text } : { state: 'failed', text: '' });
    } catch {
      buses.set(stop, { state: 'failed', text: '' });
    }
    const got = buses.get(stop)!;
    cardsState.buses = { state: got.state === 'asking' ? 'failed' : got.state, stop, text: got.text };
    if (got.state === 'failed') setTimeout(() => buses.get(stop)?.state === 'failed' && buses.delete(stop), 20_000);
    sig = '';
    if (last) update(last);
  };

  /** Two packets side by side, per 100 g, from the databases' own figures (lens.u8): the better on each row marked, one line said. */
  const openCompare = (a: LookupResult, b: LookupResult): void => {
    const c = comparePackets(a, b);
    cardsState.compare = { a: a.title, b: b.title, line: c.line };
    const mark = (r: { better: string }, side: 'a' | 'b') => (r.better === side ? { dataset: { better: '1' } } : {});
    const table = h('table.lc-compare',
      h('thead', h('tr', h('th', { scope: 'col' }, 'Per 100 g'), h('th', { scope: 'col' }, a.title), h('th', { scope: 'col' }, b.title))),
      h('tbody', ...c.rows.map((r) => h('tr', h('th', { scope: 'row' }, r.what), h('td', mark(r, 'a'), r.a, r.better === 'a' ? h('b', ' ✓') : ''), h('td', mark(r, 'b'), r.b, r.better === 'b' ? h('b', ' ✓') : '')))),
    );
    const body = h('div.lc-avoid', h('p.lc-small', c.line), table, h('p.lc-small', `From ${a.source}. ✓ marks less sugar, fat, saturates, salt and energy, more protein, and the better Nutri-Score.`), h('div.lc-keys', key('READ ALOUD', () => speak(c.line, 'en-GB')), key('DONE', () => sheet.close())));
    const sheet = modal('TWO PACKETS', body);
    done(c.line);
  };

  /** His price for a unit of electricity, by a small sheet: kept on this phone, and every rating plate is costed at it. */
  const openKwh = (): void => {
    const now = loadKwh();
    const input = h('input.lc-price', { type: 'number', inputmode: 'decimal', min: '1', max: '200', step: '0.1', value: String(now.price), 'aria-label': 'Your price for a unit of electricity, in pence a kWh' }) as HTMLInputElement;
    const body = h('div.lc-avoid',
      h('p.lc-small', 'Your price for a unit (kWh) of electricity, in pence: it is on your bill or your supplier’s app. Kept on this phone only.'),
      h('label.lc-pricerow', input, h('span', 'p a kWh')),
      h('div.lc-keys',
        key('KEEP MY PRICE', () => {
          const v = Math.round(Number(input.value) * 10) / 10;
          if (!(v >= 1 && v <= 200)) return void toast('Put in a price between 1p and 200p a unit.', 'warn');
          try {
            localStorage.setItem(KWH_KEY, String(v));
          } catch {
            return void toast('This phone would not keep it (private browsing?). The plate is costed at 25p.', 'warn');
          }
          sheet.close();
          toast(`Kept on this phone: ${v}p a unit.`, 'ok');
          sig = '';
          if (last) update(last);
        }, { label: 'Keep this price on this phone' }),
        key('CANCEL', () => sheet.close()),
      ),
    );
    const sheet = modal('MY ELECTRICITY PRICE', body);
  };

  /** One HOME action from a card (a bill kept with its reminder, a warranty from a receipt): its own words come back. */
  const homeDo = async (b: HTMLButtonElement, action: 'bill' | 'warranty', args: Record<string, unknown>, what: string): Promise<void> => {
    b.disabled = true;
    try {
      const r = await brain.packDo('homeadmin', action, args);
      cardsState.done = `${action}: ${r.text}`;
      toast(r.text || `Kept ${what}.`, 'ok');
      b.querySelector('span')!.textContent = action === 'bill' ? 'IN YOUR BILLS' : 'WARRANTY KEPT';
    } catch {
      b.disabled = false;
      toast(`I couldn’t reach my brain to keep ${what}. Tap again when there is a signal.`, 'warn');
    }
  };

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
      // [security] through the one opener that refuses an unsafe scheme (core/safeurl.ts)
      openSafe(href);
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

  /** Prices in another currency, in pounds on his tap at today's rate from the free public feed MARKETS uses (nothing of his goes with it). */
  const priceCard = (ps: TextAct[]): HTMLElement => {
    const r = ratesNow;
    const conv = (p: TextAct) => (r && p.amount != null && p.cur && r.per[p.cur] && r.per.gbp ? (p.amount * r.per.gbp) / r.per[p.cur]! : null);
    const head = ps.length === 1 ? `A PRICE · ${ps[0]!.text}` : `${ps.length} PRICES · ${[...new Set(ps.map((p) => (p.cur ?? '').toUpperCase()))].join(', ')}`;
    if (r && ps.some((p) => conv(p) != null)) {
      const time = new Date(r.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
      const lines = ps.map((p) => {
        const g = conv(p);
        return `${p.text} ≈ ${g == null ? 'no rate for it' : `£${g.toFixed(2)}`}`;
      });
      cardsState.pounds = lines;
      return card('price', head, h('div.lc-body', h('p.lc-line', lines.join(' · ')), h('p.lc-small', `At today’s rate (${time}), from a public feed: a guide, your bank’s rate will differ a little.`)), copy('COPY', lines.join('\n'), 'the prices in pounds'));
    }
    return card('price', head, ratesBusy ? 'Getting today’s rate…' : 'IN POUNDS works them out at today’s rate, from a public feed; nothing about you goes with it.',
      last?.online && !ratesBusy ? key('IN POUNDS', () => void getRates(), { label: 'These prices in pounds, at today’s rate' }) : null);
  };
  const getRates = async (): Promise<void> => {
    ratesBusy = true;
    sig = '';
    if (last) update(last);
    try {
      const m = await import('../../data/markets');
      const d = await m.rates.refresh();
      if (d?.per) ratesNow = { per: d.per, at: m.rates.at || Date.now() };
      else toast('I couldn’t get today’s rate just now. Tap again in a minute.', 'warn');
    } catch {
      toast('I couldn’t get today’s rate just now. Tap again in a minute.', 'warn');
    }
    ratesBusy = false;
    sig = '';
    if (last) update(last);
  };

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
            const r = await brain.addEvent({ title: line.slice(0, 80) || 'From the Lens', start: new Date(y!, m! - 1, d!, 9, 0).getTime(), allDay: true });
            added.add(id);
            cardsState.done = `In your agenda for ${longDay(a.value)}.`;
            b.querySelector('span')!.textContent = 'IN YOUR AGENDA';
            // (the sweep) a misread date is taken back in one tap: UNDO takes the day out of his agenda again
            const evId = (r as { event?: { id?: string } } | null)?.event?.id;
            if (evId) {
              undo(`In your agenda for ${longDay(a.value)}.`, async () => {
                await brain.deleteEvent(evId);
                added.delete(id);
                cardsState.done = `taken out of your agenda: ${longDay(a.value)}`;
                sig = '';
                if (last) update(last);
              });
            } else done(`In your agenda for ${longDay(a.value)}.`);
          } catch {
            b.disabled = false;
            toast('I couldn’t reach my brain to put it in your agenda. Tap again when there is a signal.', 'warn');
          }
        }, { label: `Add ${longDay(a.value)} to your agenda` }));
      }
      case 'price':
        return priceCard([a]);
      case 'unit':
        return card('unit', 'IN YOUR UNITS', `${a.text} ≈ ${a.value.replace(/^about /, '')}`, copy('COPY', `${a.text} = ${a.value}`, 'the measure'));
      case 'parcel':
        // (the sweep) a parcel's tracking number: Royal Mail's own public tracking page, opened on his tap
        return card('parcel', `A PARCEL · ${a.text}`, 'TRACK opens Royal Mail’s public tracking page for it.', link('TRACK', a.value, `Track ${a.text} on Royal Mail's page`), copy('COPY', a.text, 'the tracking number'));
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
        return card('code', 'A CONTACT CODE', [c.name, c.org].filter(Boolean).join(' · ') || 'A contact card', c.phones[0] ? link('CALL', `tel:${c.phones[0].replace(/[^\d+]/g, '')}`, `Call ${c.name || 'them'}`) : null, c.emails[0] ? link('WRITE', `mailto:${c.emails[0]}`, `Write to ${c.name || c.emails[0]}`) : null, c.name ? key('ADD TO CONTACTS', () => void toContacts({ name: c.name, org: c.org, phones: c.phones, emails: c.emails, web: c.urls[0] ?? '', address: c.address }), { label: `Add ${c.name} to your phone's contacts` }) : null, more());
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
    // each figure with its UK traffic-light band in words (and in colour), as UK packs show them
    const fig = (v: number | undefined, unit: string, word: string, key: string): HTMLElement | null => {
      const t = g(v, unit, word);
      if (!t) return null;
      const b = bandOf(key, v);
      return h('span.lc-fig', { ...(b ? { dataset: { band: b } } : {}) }, key === 'kcal' ? t.replace('energy ', '') : t, ...(b ? [h('b', ` ${b.toUpperCase()}`)] : []));
    };
    const per = [fig(n.kcal, ' kcal', 'energy', 'kcal'), fig(n.sugars, ' g', 'sugars', 'sugars'), fig(n.fat, ' g', 'fat', 'fat'), fig(n.saturates, ' g', 'saturates', 'saturates'), fig(n.salt, ' g', 'salt', 'salt'), fig(n.protein, ' g', 'protein', 'protein')].filter((x): x is HTMLElement => !!x);
    const grades = [p.nutriscore ? `Nutri-Score ${p.nutriscore.toUpperCase()}` : '', p.ecoscore ? `Green-Score ${p.ecoscore.toUpperCase()}` : ''].filter(Boolean).join(' · ');
    const book = p.kind === 'book' ? [p.authors?.join(', '), p.year, p.publisher, p.pages ? `${p.pages} pages` : ''].filter(Boolean).join(' · ') : '';
    return h('div.lc-body',
      h('p.lc-line', [p.title, p.brand, p.quantity].filter(Boolean).join(' · ')),
      ...(book ? [h('p.lc-line', book)] : []),
      ...(grades ? [h('p.lc-line', grades)] : []),
      ...(per.length ? [h('p.lc-small', 'Per 100 g: ', ...per.flatMap((x, i) => (i ? [' · ', x] : [x])))] : []),
      ...(p.allergens?.length ? [h('p.lc-warn', `Contains: ${p.allergens.join(', ')}`)] : []),
      h('p.lc-small', `From ${p.source}${p.credit ? ` (${p.credit})` : ''}.`),
      ...verdictOf(p),
    );
  };
  /** The packet against what he avoids: one line in red, amber or green (lens.u7). None when his list is empty. */
  const verdictOf = (p: LookupResult): HTMLElement[] => {
    const v = avoidVerdict(loadAvoid(), { allergens: p.allergens, ingredients: p.ingredients, nutrition: p.nutrition });
    cardsState.verdict = { tone: v.tone, line: v.line };
    return v.tone === 'none' ? [] : [h('p.lc-verdict', { dataset: { tone: v.tone }, role: 'note' }, h('b', v.tone === 'red' ? 'NOT FOR YOU' : v.tone === 'amber' ? 'CHECK' : 'FINE FOR YOU'), ` ${v.line.replace(/^(?:Not for you|Check the pack|Go easy|Fine for you): /, '')}`)];
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
    const s = JSON.stringify([jobs, k.text, k.english, k.lang, k.reading, code, k.thing?.label, k.thingId, Math.round((k.thing?.score ?? 0) * 100), k.knownName, k.online, k.eyes, prod ? 1 : 0, productBusy, typeof place === 'object' ? 1 : place ?? 0, asking, added.size, loadAvoid().join(','), k.lineEnglish?.length ?? 0, k.translating ?? '', spentOnce.size, [...buses.values()].map((x) => x.state).join(','), cardsState.contact.state, loadKwh().price, ratesBusy, ratesNow?.at ?? 0]);
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
            if (p.kind !== 'book' && foods[foods.length - 1] !== code) {
              const at = foods.indexOf(code);
              if (at >= 0) foods.splice(at, 1);
              foods.push(code);
              if (foods.length > 6) foods.shift();
            }
            const otherCode = p.kind === 'book' ? '' : [...foods].reverse().find((c) => c !== code && typeof products.get(c) === 'object') ?? '';
            const other = otherCode ? (products.get(otherCode) as LookupResult) : null;
            out.push(card('product', p.kind === 'book' ? 'A BOOK' : 'A PRODUCT', productBody(p), key('MORE ABOUT IT', () => deps.act('look')), p.kind === 'book' ? null : key('WHAT I AVOID', () => openAvoid(), { label: 'What I avoid: my allergies and ways of eating, kept on this phone' }), other ? key('COMPARE', () => openCompare(p, other), { label: `Compare ${p.title} with ${other.title}, per 100 g` }) : null));
          }
          break;
        }
        case 'code':
          out.push(codeCard(code));
          break;
        case 'receipt': {
          const rc = readReceipt(k.text ?? '', day());
          const head = `A RECEIPT${rc.store ? ` · ${rc.store.toUpperCase()}` : ''}${rc.total != null ? ` · £${rc.total.toFixed(2)}` : ''}`;
          if (rc.total == null) {
            out.push(card('receipt', head, 'I can’t find the total on it. Hold it flatter, with the TOTAL line in view.'));
            break;
          }
          const one = { store: rc.store, date: rc.date, total: rc.total };
          const csv = receiptCsv(one, day());
          const added = spentOnce.has(csv);
          const into = added ? null : k.online ? key('INTO SPENDING', (b) => void intoSpending(b, one), { label: `Put £${rc.total.toFixed(2)}${rc.store ? ` at ${rc.store}` : ''} into this month’s spending` }) : null;
          const warranty = k.online ? key('KEEP A WARRANTY', (b) => void homeDo(b, 'warranty', { text: k.text ?? '', ...(rc.item ? { item: rc.item } : {}) }, 'the warranty'), { label: 'Keep a warranty for what this receipt bought' }) : null;
          const said = added ? (cardsState.spent.line || 'In your spending.') : !k.online ? 'No signal: I’ll put it in your spending when there is one. Hold it again then.' : `${longDay(rc.date || day())}${rc.date ? '' : ' (no date on it: today)'}. One tap files it in this month’s spending; I read it from the photo, so check the total.`;
          out.push(card('receipt', head, said, into, warranty, copy('COPY', k.text ?? '', 'the receipt')));
          break;
        }
        case 'contact': {
          // (lens.s1) a business card: its details as printed, into his phone's contacts on his tap; nobody is looked up
          const c = readBusinessCard(k.text ?? '');
          if (!c) break;
          const said = [c.title, c.org].filter(Boolean).join(' · ') || [c.phones[0], c.emails[0]].filter(Boolean).join(' · ');
          out.push(card('contact', `A BUSINESS CARD · ${c.name.toUpperCase()}`, `${said}. ADD TO CONTACTS hands it to your phone’s contacts; I don’t look anyone up.`,
            key('ADD TO CONTACTS', () => void toContacts(c), { label: `Add ${c.name} to your phone's contacts` }),
            c.phones[0] ? link('CALL', `tel:${c.phones[0]}`, `Call ${c.name}`) : null,
            c.emails[0] ? link('WRITE', `mailto:${c.emails[0]}`, `Write to ${c.name}`) : null,
            copy('COPY', [c.name, c.title, c.org, ...c.phones, ...c.emails, c.web, c.address].filter(Boolean).join('\n'), 'the card')));
          break;
        }
        case 'stop': {
          // (lens.s7) a bus stop sign: the next buses from the stop it names, on his tap
          const st = readBusStop(k.text ?? '');
          if (!st) break;
          const name = st.name || `stop ${st.sms}`;
          const got = buses.get(name);
          const head = `A BUS STOP · ${name.toUpperCase()}${st.letter ? ` · STOP ${st.letter}` : ''}`;
          const about = [st.routes.length ? `Buses ${st.routes.join(', ')}` : '', st.towards ? `towards ${st.towards}` : ''].filter(Boolean).join(' ');
          const line =
            got?.state === 'asking' ? `${about ? `${about}. ` : ''}Asking for the next buses from ${name}…`
            : got?.state === 'found' ? h('div.lc-buses', h('p.lc-line', about ? `${about}.` : `From ${name}.`), h('pre.lc-times', got.text.split('\n').filter((l) => l.trim()).slice(0, 8).join('\n')))
            : got?.state === 'failed' ? `${about ? `${about}. ` : ''}I couldn’t get the times for ${name} just now. Tap again in a minute.`
            : !k.online ? `${about ? `${about}. ` : ''}No signal: the next buses need one.`
            : `${about ? `${about}. ` : ''}NEXT BUSES asks the free timetables by this stop’s name, not by where you are.`;
          out.push(card('stop', head, line,
            k.online && got?.state !== 'asking' ? key(got?.state === 'found' ? 'NEXT BUSES AGAIN' : 'NEXT BUSES', (b) => void nextBuses(b, name), { label: `The next buses from ${name}` }) : null,
            copy('COPY', k.text ?? '', 'the sign')));
          break;
        }
        case 'medicine': {
          // (lens.s2) a medicine box: read aloud, and its public NHS page opened on his tap; no advice of mine, ever
          const m = readMedicine(k.text ?? '');
          if (!m) break;
          out.push(card('medicine', `A MEDICINE · ${m.name.toUpperCase()}${m.strength ? ` ${m.strength.toUpperCase()}` : ''}`, `${m.form.charAt(0).toUpperCase()}${m.form.slice(1)}. OPEN THE NHS PAGE shows the NHS’s own public page about it. I don’t give medical advice: the leaflet in the box and your pharmacist do.`,
            k.online ? link('OPEN THE NHS PAGE', nhsSearch(m.name), `Open the NHS page about ${m.name}`) : null,
            key('READ ALOUD', () => speak(k.text ?? '', 'en-GB')),
            copy('COPY', k.text ?? '', 'the box')));
          break;
        }
        case 'rating': {
          // (lens.s3) an appliance's rating plate: what an hour costs at his price, always a first estimate
          const r = readRating(k.text ?? '');
          if (!r) break;
          const price = loadKwh();
          const c = runningCost(r.watts, price.price);
          cardsState.cost = { watts: r.watts, price: price.price, line: c.line };
          const power = r.watts >= 1000 ? `${(r.watts / 1000).toFixed(r.watts % 1000 ? 1 : 0)} kW` : `${r.watts} W`;
          out.push(card('rating', `A RATING PLATE · ${power}${r.volts ? ` · ${r.volts} V` : ''}`, `${c.line}${price.his ? '' : ' That is at 25p a unit until you put in yours.'}`,
            key(price.his ? 'CHANGE MY PRICE' : 'SET MY PRICE', () => openKwh(), { label: 'Set your price for a unit of electricity' }),
            copy('COPY', c.line, 'the running cost')));
          break;
        }
        case 'letter': {
          const bill = letterOf(k.text ?? '', day());
          const keepBill = bill?.kind === 'bill' && k.online ? key('ADD TO MY BILLS', (b) => void homeDo(b, 'bill', { text: k.text ?? '' }, 'the bill'), { label: 'Add this bill to my bills, with a reminder before it is due' }) : null;
          out.push(card('letter', bill?.kind === 'bill' ? 'A BILL' : 'A LETTER', bill?.kind === 'bill' ? 'ADD TO MY BILLS keeps it with your bills and reminds you two days before it is due. REMIND ME and FILE are under its words above.' : 'REMIND ME and FILE are under its words above.', keepBill, key('READ ALOUD', () => speak(k.text ?? '', k.langTag || 'en-GB')), copy('COPY', k.text ?? '', 'the letter')));
          break;
        }
        case 'document':
          out.push(card('document', `A PAGE · ${(k.text ?? '').match(/\S+/g)?.length ?? 0} WORDS`, 'Scan it flat and keep it, or have it read to you.', key('SCAN IT FLAT', () => deps.act('document')), key('READ ALOUD', () => speak(k.text ?? '', k.langTag || 'en-GB'))));
          break;
        case 'text': {
          const own = (k.text ?? '').replace(/\s+/g, ' ').trim();
          // (the sweep) words in a language the phone cannot name are offered TRANSLATE too, when they do not read as English
          const unnamed = k.lang === 'UNKNOWN' && (own.match(/\p{L}{3,}/gu)?.length ?? 0) >= 2 && !looksEnglish(own);
          const foreign = (!!k.lang && k.lang !== 'ENGLISH' && k.lang !== 'UNKNOWN') || unnamed;
          // a menu or a page in another language: each line with its English, in order (lens.u1)
          if (foreign && k.lines?.length && k.lineEnglish?.length === k.lines.length) {
            const en = k.lineEnglish;
            const list = h('ol.lc-pairs', ...k.lines.map((l, i) => h('li', h('span.lc-orig', l), h('span.lc-en', en[i]!))));
            out.push(card('text', `A MENU · ${k.lang} · ${k.lines.length} LINES IN ENGLISH`, list, key('READ ALOUD', () => speak(en.join('. '), 'en-GB')), copy('COPY', k.lines.map((l, i) => `${l} — ${en[i]}`).join('\n'), 'the menu in English')));
            break;
          }
          const shown = foreign && k.english ? k.english : own;
          const trLine = foreign && !k.english ? (k.translating === 'sending' ? 'Putting it into English… (the words only)' : k.translating === 'failed' ? 'The English didn’t come back. TRY AGAIN sends the words once more.' : '') : '';
          out.push(
            card(
              'text',
              foreign ? `TEXT${unnamed ? '' : ` · ${k.lang}`}${k.english ? ' · IN ENGLISH' : ''}` : 'TEXT',
              trLine ? h('div.lc-body', h('p.lc-line', shown.slice(0, 160) + (shown.length > 160 ? '…' : '')), h('p.lc-small', { role: 'status' }, trLine)) : shown.slice(0, 160) + (shown.length > 160 ? '…' : ''),
              // (in its own language's voice until it has its English)
              key('READ ALOUD', () => speak(shown, foreign && !k.english ? k.langTag || 'en-GB' : 'en-GB')),
              foreign && !k.english && k.online && k.translating !== 'sending' ? key(k.translating === 'failed' ? 'TRY AGAIN' : 'TRANSLATE', () => deps.act('translate'), { label: k.translating === 'failed' ? 'The English did not come back: send the words again' : 'Put these words into English' }) : null,
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
    // prices and measures stand on one card each (a menu has a price on every line); everything else on its own card
    for (const a of acts) if (a.kind !== 'price' && a.kind !== 'unit') out.push(actCard(a));
    const priceActs = acts.filter((a) => a.kind === 'price');
    if (priceActs.length) out.push(priceCard(priceActs));
    const unitActs = acts.filter((a) => a.kind === 'unit');
    if (unitActs.length) out.push(card('unit', 'IN YOUR UNITS', unitActs.map((u) => `${u.text} ≈ ${u.value.replace(/^about /, '')}`).join(' · '), copy('COPY', unitActs.map((u) => `${u.text} = ${u.value}`).join('\n'), 'the measures')));
    if (!out.length && k.camera) {
      const words = k.reading ? 'Reading the words…' : !k.online ? NO_SIGNAL_WORDS : k.eyes ? NOTHING_WORDS : '';
      if (words) out.push(card('nothing', k.reading ? 'READING' : !k.online ? 'NO SIGNAL' : 'NOTHING YET', words));
    }
    cardsState.said = out.map((c) => c.textContent ?? '').join(' | ');
    el.replaceChildren(...out);
    el.hidden = !out.length;
  };

  /** READ ALOUD: a second tap while it is reading the same words stops it. A phone with no voice for the language still reads in its own. */
  let saying = '';
  const speak = (text: string, tag: string): void => {
    if (!text) return;
    if (typeof speechSynthesis === 'undefined') return void toast('This phone has no voice to read it with.', 'warn');
    if (saying === text && speechSynthesis.speaking) {
      speechSynthesis.cancel();
      saying = '';
      cardsState.done = 'stopped reading';
      return;
    }
    saying = text;
    cardsState.done = `said aloud: ${text.slice(0, 60)}`;
    sayIn(text, tag || 'en-GB');
  };

  return {
    el,
    update,
    openAvoid: () => openAvoid(),
    /** What he avoids, by his words while the Lens is open ("I'm allergic to peanuts", "I'm vegan", "what do I avoid"). */
    avoid(text) {
      const found = avoidFromWords(text);
      if (!found.length) {
        const have = loadAvoid();
        openAvoid();
        return have.length ? `You avoid ${avoidSaid(have)}. Change it on the list.` : 'Tick what you avoid on the list, and every packet gets a line for you.';
      }
      const list = [...new Set([...loadAvoid(), ...found])];
      if (!saveAvoid(list)) return 'This phone would not keep it: its storage is full or blocked.';
      cardsState.avoid = list;
      sig = '';
      if (last) update(last);
      return `Kept on this phone: you avoid ${avoidSaid(list)}. Every packet now gets a line for you.`;
    },
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
      // a stop whose times are on their way: its card says so
      if (word === 'buses') {
        const stop = el.querySelector('.lenscard[data-job="stop"] .lc-line');
        if (stop) return (stop.textContent ?? '').trim() || w.done;
      }
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
      foods.length = 0;
      // a stop's times are for now: never shown as current on a later visit
      buses.clear();
      cardsState.jobs = [];
      cardsState.cards = [];
      cardsState.acts = [];
      el.replaceChildren();
      el.hidden = true;
    },
  };
}

