/**
 * THE HOME PACK on the phone (BRIEF-PACKS-3): a sheet over whatever is showing (the open_homeadmin command; the chat's "when are
 * the bins?", "my bills"). DUE: everything coming at home, in date order; BINS: his bin days in his words, or his council's page
 * pasted; BILLS: a photo of a bill read on this phone with the Lens's reader (nothing leaves the phone to read it), or its pasted
 * text, kept by his own brain; METER: a photo of the dial or the number; ROOMS: a room's things for insurance, from a photo the
 * phone looks at or typed, as CSV. Everything is kept in his own brain (POST /packs/do, no model). The state sits on
 * window.__ghosty.homeadmin for the specs.
 */
import { h } from '../../core/dom';
import { button, modal, toast } from '../../ui/components';
import { brain } from '../../api/brain';
import { thingsFromLabels } from '../../../../../packages/shared/src/homeadmin';

export type HomeWhat = 'due' | 'bins' | 'bills' | 'meter' | 'things';
interface BillRow {
  id: string;
  supplier: string;
  kind: string;
  amount: number;
  due: string;
  paid?: string;
}
const VIEWS: { id: HomeWhat; label: string }[] = [
  { id: 'due', label: 'Due' },
  { id: 'bins', label: 'Bins' },
  { id: 'bills', label: 'Bills' },
  { id: 'meter', label: 'Meter' },
  { id: 'things', label: 'Rooms' },
];
export const homeState = { open: '' as '' | HomeWhat, said: '', due: [] as { on: string; text: string }[], bills: [] as BillRow[], csv: '', lines: [] as string[] };
let openSheet: { close(): void } | null = null;

export async function openHomeadmin(what: string): Promise<void> {
  const v: HomeWhat = (VIEWS.find((x) => x.id === what)?.id ?? 'due') as HomeWhat;
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
    body.replaceChildren(view === 'due' ? dueView() : view === 'bins' ? binsView() : view === 'bills' ? billsView() : view === 'meter' ? meterView() : thingsView());
  };
  for (const t of VIEWS) {
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

async function run(action: string, a: Record<string, unknown>): Promise<{ text: string; data?: unknown }> {
  try {
    const r = await brain.packDo('homeadmin', action, a);
    homeState.said = r.text;
    return r;
  } catch (e) {
    toast(`My brain didn’t answer: ${(e as Error).message}`, 'warn');
    return { text: '' };
  }
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
  const status = note('Everything I know is coming at home, in date order. Tell me bills, bin days, renewals and services and it fills up.');
  const load = async () => {
    const r = await run('due', { days: 45 });
    homeState.due = ((r.data as { lines?: { on: string; text: string }[] } | undefined)?.lines ?? []).slice();
    status.textContent = homeState.due.length ? 'Coming up at home:' : r.text || 'My brain didn’t answer.';
    list.replaceChildren(...homeState.due.slice(0, 14).map((x) => h('div.pkperson', { role: 'group', 'aria-label': `${niceDay(x.on)}: ${x.text}` }, h('b', x.text), h('span.pklab', niceDay(x.on)))));
  };
  void load();
  return h('div.pkcol', status, list, named(button('Refresh', () => void load()), 'Refresh what is due'));
}

// ---------------------------------------------------------------- BINS

function binsView(): HTMLElement {
  const status = note('Loading your bin days…');
  const words = area('Your bin days, in your words', 'bins are Tuesday, recycling every other Tuesday, next recycling is 10 November', 2);
  const page = area('Your council’s bin page, pasted', 'paste the page: Recycling: 3 Nov, 17 Nov…', 3);
  const show = (text: string) => {
    status.textContent = text || 'My brain didn’t answer.';
    homeState.lines = text.split('\n');
  };
  void run('bins', {}).then((r) => show(r.text));
  const keep = named(button('Keep these bin days', async () => show((await run('bins', { words: words.value })).text), 'on'), 'Keep what I said about my bins');
  const read = named(button('Read the council’s page', async () => show((await run('bins', { text: page.value })).text)), 'Read the council page I pasted');
  const moved = named(button('A collection moved', async () => show((await run('bins', { words: `bins moved ${words.value || 'to Wednesday this week'}` })).text)), 'Tell me a collection moved');
  return h('div.pkcol', status, words, h('div.pkrow', keep, moved), page, read);
}

// ---------------------------------------------------------------- BILLS

function billsView(): HTMLElement {
  const status = note('Photograph a bill (the page with the amount and the date) or paste its text. It is read on this phone; my brain keeps the supplier, amount and due day.');
  const list = h('div.pkcol', { 'aria-live': 'polite' });
  const paste = area('The text of a bill, pasted', 'Amount due £84.20 … Pay by 14 November 2026', 4);
  const paint = () => {
    list.replaceChildren(
      ...homeState.bills.slice(0, 10).map((b) =>
        h('div.pkperson', { role: 'group', 'aria-label': `${b.supplier} ${b.amount} pounds, ${b.due ? `due ${niceDay(b.due)}` : 'no due date'}` }, h('b', `${b.supplier} £${b.amount.toFixed(2)}`), h('span.pklab', `${b.kind}${b.due ? ` · due ${niceDay(b.due)}` : ''}${b.paid ? ` · paid ${niceDay(b.paid)}` : ''}`),
          h('div.pkrow',
            named(button('Paid', async () => { await run('paid', { id: b.id }); await load(); }), `Mark ${b.supplier} paid`),
            named(button('Forget', async () => { await run('paid', { id: b.id, remove: true }); await load(); }), `Forget the ${b.supplier} bill`))),
      ),
    );
  };
  const load = async () => {
    const r = await run('bills', {});
    homeState.bills = ((r.data as { bills?: BillRow[] } | undefined)?.bills ?? []).slice();
    paint();
  };
  const send = async (text: string) => {
    status.textContent = 'Reading it…';
    const r = await run('bill', { text });
    status.textContent = r.text || 'My brain didn’t answer.';
    await load();
  };
  void load();
  const pick = photo('Photograph a bill', (f) => void readText(f, status).then(async (t) => { if (t) await send(t); else status.textContent = 'I found no words in that photo: try a flatter, brighter one.'; }).catch((e: Error) => { status.textContent = `The reader couldn’t open that: ${e.message}`; }));
  const go = named(button('Read this text', () => void send(paste.value), 'on'), 'Read the bill text I pasted');
  return h('div.pkcol', status, h('div.pkrow', pick), paste, go, list);
}

// ---------------------------------------------------------------- METER

function meterView(): HTMLElement {
  const status = note('Pick the meter, then photograph the dial or type the number. I keep the reading and the day, and tell you the usage since last time.');
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
    const r = await run('meter', { text, kind });
    status.textContent = r.text || 'My brain didn’t answer.';
  };
  void run('meter', {}).then((r) => (status.textContent = r.text || status.textContent));
  const pick = photo('Photograph the meter', (f) => void readText(f, status).then(async (t) => { if (t) await send(t); else status.textContent = 'I found no digits in that photo: try closer and straighter.'; }).catch((e: Error) => { status.textContent = `The reader couldn’t open that: ${e.message}`; }));
  const go = named(button('Keep this reading', () => void send(typed.value), 'on'), 'Keep the reading I typed');
  return h('div.pkcol', status, kinds, h('div.pkrow', pick), typed, go);
}

// ---------------------------------------------------------------- ROOMS

function thingsView(): HTMLElement {
  const status = note('Name a room and list what is in it (“a 55 inch TV worth £400, 2 armchairs”), or photograph the room and confirm what the phone sees. Nothing is sent anywhere.');
  const room = h('input', { type: 'text', placeholder: 'living room', 'aria-label': 'Which room', enterKeyHint: 'next' }) as HTMLInputElement;
  const items = area('The things in that room', 'a 55 inch TV worth £400, 2 armchairs, a laptop £900', 3);
  const seen = h('div.pkcol', { 'aria-live': 'polite' });
  const csv = h('pre.pkdoc', { 'aria-label': 'The inventory as CSV', tabindex: 0 });
  csv.hidden = true;
  const keep = async (a: Record<string, unknown>) => {
    const r = await run('inventory', { room: room.value.trim(), ...a });
    status.textContent = r.text || 'My brain didn’t answer.';
    homeState.csv = (r.data as { csv?: string } | undefined)?.csv ?? homeState.csv;
  };
  const photoPick = photo('Photograph the room', (f) => {
    status.textContent = 'Looking at the photo on this phone…';
    void (async () => {
      try {
        const [{ detector, nextStamp }, { loadImageFile }] = await Promise.all([import('../../vision/models'), import('../../vision/camera')]);
        const det = await detector.get((s) => (status.textContent = s));
        const res = det.detectForVideo(await loadImageFile(f, 960), nextStamp(performance.now()));
        const found = thingsFromLabels((res.detections ?? []).flatMap((x) => (x.categories ?? []).slice(0, 1).map((c) => c.categoryName ?? '')).filter(Boolean));
        status.textContent = found.length ? 'Tick what is really there, then keep them. The phone can miss things and name some oddly.' : 'I couldn’t make out anything I can name: type the things instead.';
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
        status.textContent = `The phone couldn’t look at that photo (${(e as Error).message}): type the things instead.`;
      }
    })();
  });
  const add = named(button('Keep these', () => void keep({ words: items.value }), 'on'), 'Keep the things I typed');
  const show = named(button('Make the CSV', async () => {
    await keep({ export: true });
    csv.textContent = homeState.csv;
    csv.hidden = !homeState.csv;
  }), 'Make the inventory CSV for my insurer');
  const copy = named(button('Copy the CSV', async () => {
    try {
      await navigator.clipboard.writeText(homeState.csv);
      status.textContent = 'Copied.';
    } catch {
      status.textContent = 'This phone wouldn’t let me copy: select the text below.';
    }
  }), 'Copy the inventory CSV');
  const save = named(button('Save the CSV', () => {
    const a = h('a', { href: URL.createObjectURL(new Blob([homeState.csv], { type: 'text/csv' })), download: 'home-inventory.csv' });
    document.body.append(a);
    a.click();
    a.remove();
  }), 'Save the inventory as a CSV file');
  return h('div.pkcol', status, room, items, h('div.pkrow', add, photoPick), seen, h('div.pkrow', show, copy, save), csv);
}
