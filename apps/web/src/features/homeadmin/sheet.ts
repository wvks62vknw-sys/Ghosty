/**
 * THE HOME PACK on the phone (BRIEF-PACKS-3): a sheet over whatever is showing (the open_homeadmin command; the chat's "when are
 * the bins?", "my bills"). DUE: everything coming at home, in date order; BINS: his bin days in his words, or his council's page
 * pasted; BILLS: a photo of a bill read on this phone with the Lens's reader (nothing leaves the phone to read it), or its pasted
 * text, kept by his own brain; METER: a photo of the dial or the number; ROOMS: a room's things for insurance, from a photo the
 * phone looks at or typed, as CSV. Everything is kept in his own brain (POST /packs/do, no model). The state sits on
 * window.__ghosty.homeadmin for the specs.
 */
import { h } from '../../core/dom';
import { button, modal } from '../../ui/components';
import { brain } from '../../api/brain';
import { thingsFromLabels } from '../../../../../packages/shared/src/homeadmin';
import { supplierYears } from '../../../../../packages/shared/src/moneyplan';
import { forgetReceipt, keepReceipt, receiptIds, receiptOf } from './receipts';
import { sayError } from '../../ui/hisWords';
import { dueWords, emptyState, inWords, lacksSignal, phrases, sizeWords, stateIn, stateLine, troubleWords, waitFor } from '../lifeui';

export type HomeWhat = 'due' | 'bins' | 'bills' | 'meter' | 'things' | 'papers';
interface BillRow {
  id: string;
  supplier: string;
  kind: string;
  amount: number;
  due: string;
  paid?: string;
}
/** The sheet's pages (its row of buttons, and the HOUSEHOLD screen's pills: features/homeadmin/index.ts). */
export const HOME_VIEWS: { id: HomeWhat; label: string }[] = [
  { id: 'due', label: 'Due' },
  { id: 'bins', label: 'Bins' },
  { id: 'bills', label: 'Bills' },
  { id: 'meter', label: 'Meter' },
  { id: 'things', label: 'Rooms' },
  // [moneynext] warranties with their receipts, and household papers with their renewal dates
  { id: 'papers', label: 'Papers' },
];
export const homeState = { open: '' as '' | HomeWhat, said: '', due: [] as { on: string; text: string }[], bills: [] as BillRow[], paid: [] as BillRow[], years: [] as string[], warranties: [] as string[], papers: [] as string[], receipts: 0, energy: [] as string[], csv: '', lines: [] as string[] };
let openSheet: { close(): void } | null = null;

export async function openHomeadmin(what: string): Promise<void> {
  const v: HomeWhat = (HOME_VIEWS.find((x) => x.id === what)?.id ?? 'due') as HomeWhat;
  openSheet?.close();
  const win = window as unknown as { __ghosty?: Record<string, unknown> };
  if (win.__ghosty) win.__ghosty.homeadmin = homeState;
  const body = h('div.pkcol');
  const pk = h('div.pk', { dataset: { pack: 'homeadmin', screen: v } }, body);
  const tabs = h('div.pkrow', { role: 'group', 'aria-label': 'Pages of the home sheet' });
  const show = (view: HomeWhat) => {
    homeState.open = view;
    pk.dataset.screen = view;
    for (const b of tabs.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    body.replaceChildren(homeView(view));
  };
  for (const t of HOME_VIEWS) {
    const b = button(t.label, () => show(t.id));
    b.dataset.view = t.id;
    b.setAttribute('aria-label', `${t.label} page`);
    tabs.append(b);
  }
  openSheet = modal('HOME', h('div.pkcol', tabs, pk), () => {
    openSheet = null;
    homeState.open = '';
  });
  show(v);
}

/** One page of the sheet, made by its own function (the sheet's, and the HOUSEHOLD screen's panels). */
export function homeView(view: HomeWhat): HTMLElement {
  const win = window as unknown as { __ghosty?: Record<string, unknown> };
  if (win.__ghosty) win.__ghosty.homeadmin = homeState;
  return view === 'due' ? dueView() : view === 'bins' ? binsView() : view === 'bills' ? billsView() : view === 'meter' ? meterView() : view === 'papers' ? papersView() : thingsView();
}

/** One brain action. `failed` when it did not land (no signal, or a silent brain): the page says so in its own words. */
async function run(action: string, a: Record<string, unknown>): Promise<{ text: string; data?: unknown; failed?: boolean; offline?: boolean }> {
  if (lacksSignal()) return { text: '', failed: true, offline: true };
  try {
    const r = await brain.packDo('homeadmin', action, a);
    homeState.said = r.text;
    return r;
  } catch (e) {
    sayError(e, 'get an answer from my brain');
    return { text: '', failed: true };
  }
}
/** What a brain action said, in the page's status line: its words, or why it could not (in his). */
function said(status: HTMLElement, r: { text: string; failed?: boolean; offline?: boolean }, none = 'My brain didn’t answer.'): void {
  /* state: home.due error */
  /* state: home.due offline */
  /* state: home.bins error */
  /* state: home.bins offline */
  /* state: home.bills error */
  /* state: home.bills offline */
  /* state: home.meter error */
  /* state: home.meter offline */
  /* state: home.things error */
  /* state: home.things offline */
  if (r.failed) stateIn(status, r.offline ? 'offline' : 'error', troubleWords(!!r.offline));
  else stateIn(status, '', r.text || none);
}
const note = (text: string) => h('p.pknote', { 'aria-live': 'polite' }, text);
/** A day as he says it ("Wed 11 Nov"), not as the brain keeps it ("2026-11-11"). */
const niceDay = (ymd: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ymd);
const named = (b: HTMLButtonElement, label: string) => (b.setAttribute('aria-label', label), b);
function area(label: string, ph: string, rows = 3): HTMLTextAreaElement {
  return h('textarea', { rows, 'aria-label': label, placeholder: ph }) as HTMLTextAreaElement;
}
/** A photo picker whose picture is read on this phone: the words come back, nothing else leaves it. */
function photo(label: string, onFile: (f: File) => void): HTMLElement {
  const input = h('input', { type: 'file', accept: 'image/*', 'aria-label': label, hidden: true }) as HTMLInputElement;
  input.setAttribute('capture', 'environment');
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    input.value = '';
    if (f) onFile(f);
  });
  const b = named(button(label, () => input.click()), label);
  return h('span', { style: 'display:contents' }, b, input);
}
async function readText(f: File, status: HTMLElement): Promise<string> {
  const [{ Reader }, { loadImageFile }, { cleanOcr }] = await Promise.all([import('../../vision/ocr'), import('../../vision/camera'), import('../../vision/ocrtext')]);
  const reader = new Reader();
  try {
    const r = await reader.read(await loadImageFile(f, 2048), (s) => (status.textContent = `${s}`));
    return cleanOcr(r);
  } finally {
    reader.terminate();
  }
}

// ---------------------------------------------------------------- DUE

function dueView(): HTMLElement {
  const list = h('div.pkcol', { 'aria-live': 'polite' });
  const status = note('Everything I know is coming at home, in date order.');
  const load = async () => {
    list.replaceChildren();
    /* state: home.due loading */
    const done = waitFor(el, 'Opening what is due…');
    const r = await run('due', { days: 45 });
    if (r.failed) {
      done();
      said(status, r);
      return;
    }
    homeState.due = ((r.data as { lines?: { on: string; text: string }[] } | undefined)?.lines ?? []).slice();
    if (homeState.due.length) {
      done();
      stateIn(status, '', 'Coming up at home:');
      list.replaceChildren(...homeState.due.slice(0, 14).map((x) => h('div.pkperson', { role: 'group', 'aria-label': `${niceDay(x.on)}: ${x.text}` }, h('b', x.text), h('span.pklab', `${inWords(x.on)} · ${niceDay(x.on)}`))));
      return;
    }
    // nothing due: the bin day if I know it, else how to tell me
    const b = await run('bins', {});
    done();
    const known = !b.failed && !!b.text && !/^I don.t know/i.test(b.text);
    stateIn(status, '', '');
    /* state: home.due empty */
    list.replaceChildren(emptyState('Nothing due', known ? (b.text.split('\n')[0] ?? '') : 'Tell me your bin day, like “bins are Tuesday”, and I keep it.'));
  };
  const el = h('div.pkcol', status, list, named(button('Refresh', () => void load()), 'Refresh what is due'), phrases(['when are the bins?', 'my bills']));
  void load();
  return el;
}

// ---------------------------------------------------------------- BINS

function binsView(): HTMLElement {
  const status = note('');
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const words = area('Your bin days, in your words', 'bins are Tuesday, recycling every other Tuesday, next recycling is 10 November', 2);
  const page = area('Your council’s bin page, pasted', 'paste the page: Recycling: 3 Nov, 17 Nov…', 3);
  /** Whether my brain holds his bin days: a collection can only move once there are days to move. */
  let known = false;
  const show = (r: { text: string; failed?: boolean; offline?: boolean }) => {
    if (r.failed) return void said(status, r);
    const unknown = /^I don.t know your bin days/i.test(r.text);
    known = !unknown && !/^Forgot your bin days/i.test(r.text);
    /* state: home.bins empty */
    slot.replaceChildren(...(unknown ? [emptyState('No bin days yet', 'Tell me once, like “bins are Tuesday, recycling every other Tuesday”, or paste your council’s page.')] : []));
    stateIn(status, '', unknown ? '' : r.text || 'My brain didn’t answer.');
    homeState.lines = r.text.split('\n');
  };
  const keep = named(button('Keep these bin days', async () => {
    if (!words.value.trim()) return void stateIn(status, '', 'Tell me your bin days first.');
    show(await run('bins', { words: words.value }));
  }, 'on'), 'Keep what I said about my bins');
  const read = named(button('Read the council’s page', async () => {
    if (!page.value.trim()) return void stateIn(status, '', 'Paste your council’s page first.');
    show(await run('bins', { text: page.value }));
  }), 'Read the council page I pasted');
  // (a collection moved says only what he typed: an empty box asks for it, never a made-up day)
  const moved = named(button('A collection moved', async () => {
    if (!words.value.trim()) return void stateIn(status, '', 'Type where it moved first, like “to Wednesday this week”.');
    if (!known) return void stateIn(status, '', 'Tell me your bin days first with “Keep these bin days”; then a collection can move.');
    if (/\bevery\b/i.test(words.value)) return void stateIn(status, '', 'That reads as new bin days: tap “Keep these bin days” for those, or type only where this one moved.');
    show(await run('bins', { words: `bins moved ${words.value.trim()}` }));
  }), 'Tell me a collection moved');
  const el = h('div.pkcol', slot, status, words, h('div.pkrow', keep, moved), page, read);
  /* state: home.bins loading */
  const done = waitFor(el, 'Opening your bin days…');
  void run('bins', {}).then((r) => (done(), show(r)));
  return el;
}

// ---------------------------------------------------------------- BILLS

function billsView(): HTMLElement {
  const status = note('Photograph a bill, or paste its text. It is read on this phone.');
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const list = h('div.pkcol', { 'aria-live': 'polite' });
  const paste = area('The text of a bill, pasted', 'Amount due £84.20 … Pay by 14 November 2026', 4);
  let loaded = false;
  let allPaid = '';
  const paint = () => {
    /* state: home.bills empty */
    slot.replaceChildren(...(loaded && !homeState.bills.length ? [allPaid ? emptyState('All paid', allPaid) : emptyState('No bills kept yet', 'Photograph one or paste its text below.')] : []));
    // [moneylane] what is still to pay first, soonest first, with what the unpaid ones come to
    const unpaid = [...homeState.bills].filter((b) => !b.paid).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
    const owe = unpaid.reduce((k, b) => k + (Number.isFinite(b.amount) ? b.amount : 0), 0);
    // [moneynext] then the paid ones, kept (newest paid first), each with Forget, and what each supplier cost this year and last
    const paid = homeState.paid;
    const year = new Date().getFullYear();
    const years = supplierYears(paid, String(year));
    homeState.years = years.map((y) => `${y.supplier} ${y.now.toFixed(2)} ${y.before.toFixed(2)}`);
    const forget = (b: BillRow) => named(button('Forget', async () => { said(status, await run('paid', { id: b.id, remove: true })); await load(false); }), `Forget the ${b.supplier} bill`);
    list.replaceChildren(
      ...(unpaid.length ? [h('p.pknote.pkbilltotal', { dataset: { case: 'keep' } }, `£${owe.toFixed(2)} still to pay across ${unpaid.length} bill${unpaid.length === 1 ? '' : 's'}, from the bills you showed me.`)] : []),
      ...unpaid.slice(0, 12).map((b) =>
        h('div.pkperson', { role: 'group', 'aria-label': `${b.supplier} ${b.amount} pounds, ${b.due ? dueWords(b.due) || `due ${niceDay(b.due)}` : 'no due date'}` }, h('b', `${b.supplier} £${b.amount.toFixed(2)}`),
          h('span.pklab', `${b.kind}${b.due ? ` · ${dueWords(b.due) || `due ${niceDay(b.due)}`} · ${niceDay(b.due)}` : ''} · from the bill you showed me`),
          h('div.pkrow',
            named(button('Paid', async () => { said(status, await run('paid', { id: b.id })); await load(false); }), `Mark ${b.supplier} paid`),
            forget(b))),
      ),
      ...(paid.length
        ? [
            h('div.lab', 'PAID'),
            ...(years.length ? [h('div.pkcol.pkyears', ...years.map((y) => h('p.pknote.pkyear', { dataset: { case: 'keep' } }, `${y.supplier}: £${y.now.toFixed(2)} in ${year}${y.before ? `, £${y.before.toFixed(2)} in ${year - 1}` : ''}.`)))] : []),
            ...paid.slice(0, 24).map((b) =>
              h('div.pkperson.pkpaid', { role: 'group', 'aria-label': `${b.supplier} ${b.amount} pounds, paid ${niceDay(b.paid ?? '')}` }, h('b', `${b.supplier} £${b.amount.toFixed(2)}`),
                h('span.pklab', `${b.kind} · paid ${niceDay(b.paid ?? '')}${b.due ? ` · was due ${niceDay(b.due)}` : ''}`),
                h('div.pkrow', forget(b)))),
            h('p.pknote', { dataset: { case: 'keep' } }, 'Paid is your word: I don’t see your bank. Each year adds up the bills you marked paid in it.'),
          ]
        : []),
    );
  };
  const load = async (first = true) => {
    const r = await run('bills', {});
    if (r.failed) return void (first && said(status, r));
    const data = r.data as { bills?: BillRow[]; paid?: BillRow[] } | undefined;
    homeState.bills = (data?.bills ?? []).slice();
    homeState.paid = (data?.paid ?? []).slice();
    // (every bill marked paid is not "no bills": my brain says so in its own words, and that is what shows)
    allPaid = /^Nothing unpaid/i.test(r.text) ? r.text : '';
    loaded = true;
    paint();
  };
  const send = async (text: string) => {
    /* state: home.bills loading */
    const done = waitFor(el, 'Reading your bill…');
    const r = await run('bill', { text });
    done();
    said(status, r);
    await load(false);
  };
  const pick = photo('Photograph a bill', (f) => {
    const done = waitFor(el, 'Reading the photo…');
    void readText(f, status).then(async (t) => { done(); if (t) await send(t); else stateIn(status, 'error', 'I found no words in that photo. Try a flatter, brighter one.'); }).catch((e: unknown) => { done(); stateIn(status, 'error', sayError(e, 'read that photo')); });
  });
  const go = named(button('Read this text', () => (paste.value.trim() ? void send(paste.value) : stateIn(status, '', 'Paste the bill’s text first.')), 'on'), 'Read the bill text I pasted');
  const el = h('div.pkcol', status, h('div.pkrow', pick), paste, go, slot, list);
  const done0 = waitFor(el, 'Opening your bills…');
  void load().finally(done0);
  return el;
}

// ---------------------------------------------------------------- METER

function meterView(): HTMLElement {
  const status = note('Pick the meter, then photograph the dial or type the number.');
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  let kind: 'electricity' | 'gas' | 'water' = 'electricity';
  const kinds = h('div.pkrow', { role: 'group', 'aria-label': 'Which meter' });
  for (const k of ['electricity', 'gas', 'water'] as const) {
    const b = button(k, () => {
      kind = k;
      for (const x of kinds.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x.dataset.kind === k));
    });
    b.dataset.kind = k;
    b.setAttribute('aria-pressed', String(k === kind));
    b.setAttribute('aria-label', `The ${k} meter`);
    kinds.append(b);
  }
  const typed = h('input', { type: 'text', inputMode: 'decimal', placeholder: '12345', 'aria-label': 'The meter reading', enterKeyHint: 'done' }) as HTMLInputElement;
  const send = async (text: string) => {
    const done = waitFor(el, 'Keeping the reading…');
    const r = await run('meter', { text, kind });
    done();
    said(status, r);
    if (!r.failed) slot.replaceChildren();
    if (!r.failed) void use.load();
  };
  const pick = photo('Photograph the meter', (f) => {
    const done = waitFor(el, 'Reading the dial…');
    void readText(f, status).then(async (t) => { done(); if (t) await send(t); else stateIn(status, 'error', 'I found no digits in that photo. Try closer and straighter.'); }).catch((e: unknown) => { done(); stateIn(status, 'error', sayError(e, 'read that photo')); });
  });
  const go = named(button('Keep this reading', () => (typed.value.trim() ? void send(typed.value) : stateIn(status, '', 'Type the number on the dial first.')), 'on'), 'Keep the reading I typed');
  // [moneynext] money.u12: the use between readings as bars, and a first estimate of its cost on his tariff
  const use = energyBlock();
  const el = h('div.pkcol', slot, status, kinds, h('div.pkrow', pick), typed, go, use.el);
  /* state: home.meter loading */
  const done0 = waitFor(el, 'Opening your readings…');
  void run('meter', {}).then((r) => {
    done0();
    if (r.failed) return void said(status, r);
    /* state: home.meter empty */
    if (!r.data) slot.replaceChildren(emptyState('No readings yet', 'Pick the meter, then photograph the dial or type the number.'));
    else stateIn(status, '', r.text);
  });
  return el;
}

// ---------------------------------------------------------------- ROOMS

function thingsView(): HTMLElement {
  const status = note('Name a room and list what is in it, or photograph the room. Nothing is sent anywhere.');
  const room = h('input', { type: 'text', placeholder: 'living room', 'aria-label': 'Which room', enterKeyHint: 'next' }) as HTMLInputElement;
  const items = area('The things in that room', 'a 55 inch TV worth £400, 2 armchairs, a laptop £900', 3);
  const seen = h('div.pkcol', { 'aria-live': 'polite' });
  const csv = h('pre.pkdoc', { 'aria-label': 'The inventory as CSV', tabindex: 0 });
  csv.hidden = true;
  const keep = async (a: Record<string, unknown>) => {
    const r = await run('inventory', { room: room.value.trim(), ...a });
    said(status, r);
    homeState.csv = (r.data as { csv?: string } | undefined)?.csv ?? homeState.csv;
  };
  const photoPick = photo('Photograph the room', (f) => {
    stateIn(status, '', '');
    /* state: home.things loading */
    const done = waitFor(el, 'Looking at the photo on this phone…');
    void (async () => {
      try {
        const [{ detector, nextStamp }, { loadImageFile }] = await Promise.all([import('../../vision/models'), import('../../vision/camera')]);
        const det = await detector.get((s) => (status.textContent = s));
        const res = det.detectForVideo(await loadImageFile(f, 960), nextStamp(performance.now()));
        const found = thingsFromLabels((res.detections ?? []).flatMap((x) => (x.categories ?? []).slice(0, 1).map((c) => c.categoryName ?? '')).filter(Boolean));
        stateIn(status, '', found.length ? 'Tick what is really there, then keep them. The phone can miss things and name some oddly.' : 'I couldn’t make out anything I can name. Type the things instead.');
        seen.replaceChildren(
          ...found.map((t) => {
            const id = `home-thing-${t.name.replace(/\W+/g, '-')}`;
            const box = h('input', { type: 'checkbox', id, checked: true, 'aria-label': `${t.qty > 1 ? `${t.qty} ` : ''}${t.name}` }) as HTMLInputElement;
            box.dataset.item = `${t.qty > 1 ? `${t.qty} ` : ''}${t.name}`;
            return h('label.pkitem', box, `${t.qty > 1 ? `${t.qty} ` : ''}${t.name}`);
          }),
          ...(found.length ? [named(button('Keep the ticked things', () => void keep({ items: [...seen.querySelectorAll<HTMLInputElement>('input:checked')].map((x) => x.dataset.item ?? '') }), 'on'), 'Keep the ticked things')] : []),
        );
      } catch (e) {
        stateIn(status, 'error', `${sayError(e, 'look at that photo')} Type the things instead.`);
      } finally {
        done();
      }
    })();
  });
  const add = named(button('Keep these', () => (room.value.trim() || items.value.trim() ? void keep({ words: items.value }) : stateIn(status, '', 'Name a room and list what is in it first.')), 'on'), 'Keep the things I typed');
  const save = named(button('Save the CSV', () => {
    const a = h('a', { href: URL.createObjectURL(new Blob([homeState.csv], { type: 'text/csv' })), download: 'home-inventory.csv' });
    document.body.append(a);
    a.click();
    a.remove();
    stateIn(status, '', `Saved home-inventory.csv, ${sizeWords(new Blob([homeState.csv]).size)}, to your downloads.`);
  }), 'Save the inventory as a CSV file');
  const copy = named(button('Copy the CSV', async () => {
    try {
      await navigator.clipboard.writeText(homeState.csv);
      stateIn(status, '', 'Copied.');
    } catch {
      stateIn(status, '', 'This phone wouldn’t let me copy. Select the text below.');
    }
  }), 'Copy the inventory CSV');
  const show = named(button('Make the CSV', async () => {
    await keep({ export: true });
    csv.textContent = homeState.csv;
    csv.hidden = !homeState.csv;
    copy.hidden = save.hidden = !homeState.csv;
    if (homeState.csv) {
      // the size said before the tap that saves it
      const words = `Save the CSV · ${sizeWords(new Blob([homeState.csv]).size)}`;
      save.textContent = words;
      save.dataset.label = words;
    }
  }), 'Make the inventory CSV for my insurer');
  copy.hidden = save.hidden = true;
  const el = h('div.pkcol', status, room, items, h('div.pkrow', add, photoPick), seen, h('div.pkrow', show, copy, save), csv);
  return el;
}

// ---------------------------------------------------------------- PAPERS (THE NEXT ROUND, the money lane: money.s1 and money.s12)

interface WarrRow {
  id: string;
  thing: string;
  bought: string;
  months: number;
  ends: string;
  store?: string;
  price?: number;
  from: 'home' | 'chat';
}
interface PaperRow {
  id: string;
  what: string;
  kind: string;
  renews: string;
  note?: string;
}
const KIND_SAY: Record<string, string> = { tenancy: 'Tenancy', 'home insurance': 'Home insurance', 'car insurance': 'Car insurance', 'council tax': 'Council tax', 'tv licence': 'TV licence', passport: 'Passport', 'driving licence': 'Driving licence', 'boiler cover': 'Boiler cover', 'phone contract': 'Phone contract', 'broadband contract': 'Broadband contract', 'mortgage deal': 'Mortgage deal', other: 'Other' };

/** Warranties with the receipt's photo kept on this phone, and household papers with their renewal dates; a reminder before each. */
function papersView(): HTMLElement {
  const status = note('Warranties with a photo of the receipt, and papers that renew. I remind you before each runs out.');
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const today = new Date().toLocaleDateString('en-CA');
  // a warranty
  const thing = h('input', { type: 'text', placeholder: 'Washing machine', 'aria-label': 'What it is', enterKeyHint: 'next' }) as HTMLInputElement;
  const bought = h('input', { type: 'date', 'aria-label': 'The day you bought it', max: today }) as HTMLInputElement;
  const months = h('input', { type: 'text', inputMode: 'numeric', placeholder: '24 months', 'aria-label': 'How many months the warranty runs' }) as HTMLInputElement;
  const store = h('input', { type: 'text', placeholder: 'Currys (you can leave it)', 'aria-label': 'Where you bought it' }) as HTMLInputElement;
  let photoFor = '';
  const pickPhoto = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'A photo of the receipt' }) as HTMLInputElement;
  pickPhoto.setAttribute('capture', 'environment');
  pickPhoto.addEventListener('change', async () => {
    const f = pickPhoto.files?.[0];
    pickPhoto.value = '';
    if (!f || !photoFor) return;
    try {
      await keepReceipt(photoFor, f);
      stateIn(status, '', 'Receipt photo kept on this phone. It never leaves it.');
      await load(false);
    } catch (e) {
      stateIn(status, 'error', sayError(e, 'keep that photo'));
    }
  });
  // a paper
  const what = h('input', { type: 'text', placeholder: 'House insurance with Aviva', 'aria-label': 'What the paper is', enterKeyHint: 'next' }) as HTMLInputElement;
  const kind = h('select', { 'aria-label': 'What kind of paper' }, ...Object.entries(KIND_SAY).map(([v, t]) => h('option', { value: v }, t))) as HTMLSelectElement;
  const renews = h('input', { type: 'date', 'aria-label': 'The day it renews or ends' }) as HTMLInputElement;
  const days = (ymd: string) => Math.round((Date.parse(`${ymd}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 864e5);
  const when = (ymd: string, past: string) => {
    const n = days(ymd);
    return n < 0 ? `${past} ${niceDay(ymd)}` : n === 0 ? 'today' : n === 1 ? 'tomorrow' : n <= 60 ? `in ${n} days, ${niceDay(ymd)}` : niceDay(ymd);
  };
  const run2 = async (args: Record<string, unknown>) => {
    const r = await run('papers', args);
    said(status, r);
    if (!r.failed) paint(r.data as { warranties: WarrRow[]; papers: PaperRow[]; id: string | null });
    return r;
  };
  let photos = new Set<string>();
  const paint = (d: { warranties: WarrRow[]; papers: PaperRow[] }) => {
    homeState.warranties = d.warranties.map((w) => `${w.thing} ${w.ends}`);
    homeState.papers = d.papers.map((p) => `${p.what} ${p.renews}`);
    homeState.receipts = d.warranties.filter((w) => photos.has(w.id)).length;
    const live = d.warranties.filter((w) => w.ends >= today);
    const gone = d.warranties.filter((w) => w.ends < today);
    const wRow = (w: WarrRow) => {
      const left = days(w.ends);
      const shot = h('div.pkcol.pkreceipt');
      if (photos.has(w.id)) void receiptOf(w.id).then((b) => {
        if (!b) return;
        const url = URL.createObjectURL(b);
        const img = h('img.pkreceiptimg', { src: url, alt: `The receipt for the ${w.thing}` }) as HTMLImageElement;
        img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
        shot.replaceChildren(img);
      });
      return h('div.pkperson.pkwarr', { role: 'group', dataset: { id: w.id, soon: left >= 0 && left <= 60 ? '1' : '' }, 'aria-label': `${w.thing}, warranty ${left < 0 ? 'ended' : 'to'} ${niceDay(w.ends)}` },
        h('b', w.thing.charAt(0).toUpperCase() + w.thing.slice(1)),
        h('span.pklab', `${left < 0 ? 'Warranty ended' : 'Warranty ends'} ${when(w.ends, '')}`.replace(/ {2}/g, ' ')),
        h('span.pklab', `Bought ${niceDay(w.bought)}${w.store ? ` at ${w.store}` : ''}${w.price ? ` for £${w.price.toFixed(2)}` : ''} · ${w.months} months${w.from === 'chat' ? ' · told me in the chat' : ''}`),
        shot,
        w.from === 'home'
          ? h('div.pkrow',
              named(button(photos.has(w.id) ? 'New receipt photo' : 'Add receipt photo', () => ((photoFor = w.id), pickPhoto.click())), `${photos.has(w.id) ? 'Replace' : 'Add'} the receipt photo for the ${w.thing}`),
              named(button('Forget', async () => { await forgetReceipt(w.id); await run2({ op: 'forgetWarranty', id: w.id }); }), `Forget the ${w.thing} warranty`))
          : null);
    };
    slot.replaceChildren(
      h('div.lab', 'WARRANTIES'),
      ...(live.length ? live.map(wRow) : [h('p.pknote', { dataset: { case: 'keep' } }, d.warranties.length ? 'No warranty still running.' : 'No warranties yet. Add one below, with a photo of the receipt.')]),
      ...(gone.length ? [h('div.lab', 'ENDED'), ...gone.map(wRow)] : []),
      h('div.pkcol.pkform', h('div.lab', 'ADD A WARRANTY'), thing, h('div.pkrow', bought, months), store,
        h('div.pkrow', named(button('Keep warranty', () => void addWarranty(), 'on'), 'Keep this warranty'))),
      h('div.lab', 'HOUSEHOLD PAPERS'),
      ...(d.papers.length
        ? d.papers.map((p) => h('div.pkperson.pkpaper', { role: 'group', dataset: { id: p.id }, 'aria-label': `${p.what}, renews ${niceDay(p.renews)}` },
            h('b', p.what),
            h('span.pklab', `${KIND_SAY[p.kind] ?? 'Other'} · ${days(p.renews) < 0 ? `renewed or ended ${niceDay(p.renews)}` : `renews ${when(p.renews, '')}`}`),
            h('div.pkrow', named(button('Forget', () => void run2({ op: 'forgetPaper', id: p.id })), `Forget ${p.what}`))))
        /* state: home.papers empty */
        : [emptyState('No papers yet', 'Tenancy, insurance, council tax, licences: add each with the day it renews, below.')]),
      h('div.pkcol.pkform', h('div.lab', 'ADD A PAPER'), what, h('div.pkrow', kind, renews),
        h('div.pkrow', named(button('Keep paper', () => void addPaper(), 'on'), 'Keep this paper'))),
      h('p.pknote', { dataset: { case: 'keep' } }, 'Receipt photos stay on this phone. Reminders come a month before a warranty ends, and a month and a week before a paper renews.'),
    );
  };
  const addWarranty = async () => {
    const m = Number(months.value.replace(/[^\d]/g, ''));
    if (!thing.value.trim()) return void stateIn(status, '', 'Say what it is first, like “washing machine”.');
    if (!bought.value) return void stateIn(status, '', 'Pick the day you bought it.');
    if (!m) return void stateIn(status, '', 'Say how many months the warranty runs, like 24.');
    const r = await run2({ op: 'warranty', thing: thing.value.trim(), bought: bought.value, months: m, store: store.value.trim() });
    // (a keep that failed or was refused leaves what he typed where it is)
    if (r.failed || !/^Kept/.test(r.text)) return;
    thing.value = '';
    months.value = '';
    store.value = '';
  };
  const addPaper = async () => {
    if (!what.value.trim()) return void stateIn(status, '', 'Say what the paper is first, like “house insurance with Aviva”.');
    if (!renews.value) return void stateIn(status, '', 'Pick the day it renews or ends.');
    const r = await run2({ op: 'paper', what: what.value.trim(), kind: kind.value, renews: renews.value });
    if (!r.failed && /^Kept/.test(r.text)) what.value = '';
  };
  const load = async (first = true) => {
    const done = first ? waitFor(el, 'Opening your papers…') : () => undefined;
    /* state: home.papers loading */
    photos = new Set(await receiptIds());
    const r = await run('papers', {});
    done();
    /* state: home.papers error */
    /* state: home.papers offline */
    if (r.failed) return void said(status, r);
    paint(r.data as { warranties: WarrRow[]; papers: PaperRow[] });
  };
  const el = h('div.pkcol', status, slot, pickPhoto, phrases(['my warranties', 'my household papers']));
  void load();
  return el;
}

// ---------------------------------------------------------------- ENERGY (on METER: money.u12)

interface Span {
  from: string;
  to: string;
  days: number;
  units: number;
  perDay: number;
  cost?: number;
}
interface EnergyKind {
  reads: number;
  tariff: { unit: number; standing: number } | null;
  spans: Span[];
}
/** The use between his readings, a bar for each span (units a day), the newest span's cost as a first estimate on his tariff. */
function energyBlock(): { el: HTMLElement; load(): Promise<void> } {
  const box = h('div.pkcol.pkenergy', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const UNIT: Record<string, string> = { electricity: 'kWh', gas: 'units', water: 'cubic metres' };
  const load = async () => {
    const r = await run('energy', {});
    if (r.failed) return;
    const data = r.data as { kinds: Record<string, EnergyKind> };
    homeState.energy = Object.entries(data.kinds).map(([k, v]) => `${k} ${v.spans.length}${v.spans.length && v.spans[v.spans.length - 1]!.cost !== undefined ? ` £${v.spans[v.spans.length - 1]!.cost!.toFixed(2)}` : ''}`);
    const parts = Object.entries(data.kinds).filter(([, v]) => v.reads > 0).map(([kind, v]) => {
      const spans = v.spans.slice(-8);
      const most = Math.max(0.1, ...spans.map((x) => x.perDay));
      const last = spans[spans.length - 1];
      const unit = h('input', { type: 'text', inputMode: 'decimal', placeholder: '24.5p a unit', 'aria-label': `The ${kind} price of a unit, in pence`, value: v.tariff ? String(v.tariff.unit) : '' }) as HTMLInputElement;
      const standing = h('input', { type: 'text', inputMode: 'decimal', placeholder: '60p a day', 'aria-label': `The ${kind} standing charge, in pence a day`, value: v.tariff ? String(v.tariff.standing) : '' }) as HTMLInputElement;
      const keep = async () => {
        const u = Number(unit.value.replace(/[^\d.]/g, ''));
        const st = Number(standing.value.replace(/[^\d.]/g, '') || '0');
        if (!u) return void stateIn(status, '', 'Type the price of a unit first, from your bill, like 24.5.');
        const x = await run('energy', { op: 'tariff', kind, unit: u, standing: st });
        said(status, x);
        if (!x.failed) await load();
      };
      return h('div.pkcol.pkkind', { dataset: { kind } },
        h('div.lab', `${kind.toUpperCase()} USE`),
        ...(spans.length
          ? spans.map((x) => h('div.mnmeter', { dataset: { tone: x === last ? 'ok' : 'soft' } },
              h('div.mnline', h('b', `${niceDay(x.from)} to ${niceDay(x.to)}`), h('span', `${x.perDay} a day`)),
              h('div.mnbar', { role: 'img', 'aria-label': `${x.perDay} ${UNIT[kind] ?? 'units'} a day` }, h('i', { style: { width: `${Math.round((x.perDay / most) * 100)}%` } })),
              h('small.mnhow', `${x.units.toLocaleString('en-GB')} ${UNIT[kind] ?? 'units'} over ${x.days} day${x.days === 1 ? '' : 's'}${x.cost !== undefined ? `: about £${x.cost.toFixed(2)}` : ''}.`)))
          : [h('p.pknote', { dataset: { case: 'keep' } }, 'One reading so far. Add another in a week or so and I show the use between them.')]),
        ...(last && last.cost !== undefined ? [h('p.pknote.pkcost', { dataset: { case: 'keep' } }, `The newest span cost about £${last.cost.toFixed(2)}, about £${(last.cost / last.days * 30).toFixed(2)} for 30 days at that rate. A first estimate from your tariff, not your bill.`)] : []),
        h('div.pkrow', unit, standing),
        h('div.pkrow', named(button(v.tariff ? 'Change tariff' : 'Keep tariff', () => void keep()), `Keep the ${kind} tariff`)));
    });
    box.replaceChildren(...parts);
  };
  void load();
  return { el: h('div.pkcol', box, status), load };
}
