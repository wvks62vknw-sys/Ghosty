/**
 * THE GET LINE INSIDE PHOTO (BRIEF-EDITOR-PHOTO-2): where a tool needs a model he has not kept (SUBJECT: the cut-out model, ERASE: the erase
 * model, a RAW shared in: the RAW reader), the tray says so once with the size and a GET that follows the pack rule (photo/packget.ts):
 * on his tap only, on Wi-Fi, progress with the bytes, STOP, carried on from the files already here, and a plain line for no signal. One
 * download at a time. A pack kept here is the same pack Settings → offline eyes lists, which is where REMOVE is, with the size freed said.
 */
import { h } from '../../core/dom';
import { sayError } from '../../ui/hisWords';
import { button } from '../../ui/components';
import { getPhotoPack, PHOTO_PACKS, packSize, type PhotoPackId } from '../../photo/packget';
import { sizeSaid } from '../../offline/pack';

/** One download at a time (a second tap while one runs only shows the one that runs). */
let getting: { id: PhotoPackId; ctl: AbortController; line: string; frac: number } | null = null;
let failure: { id: PhotoPackId; text: string } | null = null;
const listeners = new Set<() => void>();
const changed = (): void => listeners.forEach((f) => f());

/** What a spec reads: the line a pack's GET shows now. */
export const packState = {
  line: '',
  failed: '',
  getting: '' as '' | PhotoPackId,
};

/** The words that offer a pack, by tool. */
export const OFFER: Record<PhotoPackId, (size: string) => string> = {
  cutout: (s) => `A better cut-out needs the cut-out model (${s}): GET`,
  erase: (s) => `Erase on this phone needs the erase model (${s}): GET`,
  raw: (s) => `This is a RAW. To open it I need the RAW reader (${s}): GET`,
};

async function start(id: PhotoPackId, onDone: () => void): Promise<void> {
  if (getting) return;
  failure = null;
  const ctl = new AbortController();
  getting = { id, ctl, line: '', frac: 0 };
  packState.getting = id;
  const say = (line: string, frac: number): void => {
    if (!getting) return;
    getting.line = line;
    getting.frac = frac;
    packState.line = line;
    changed();
  };
  changed();
  try {
    await getPhotoPack(id, say, ctl.signal);
    getting = null;
    packState.getting = '';
    packState.line = '';
    changed();
    onDone();
  } catch (e) {
    const stopped = (e as Error)?.name === 'AbortError';
    getting = null;
    packState.getting = '';
    failure = { id, text: stopped ? 'Stopped. What came so far stays: GET carries on from there.' : sayError(e, 'get it') };
    packState.failed = failure.text;
    changed();
  }
}

/**
 * The offer for a pack, as a block to put in a tray: the line with its size, GET (and STOP and the bytes while it runs, RESUME where it
 * stopped half way). `kept` is called when the pack is here, for the tray to draw itself again. `extra` is a line under it ("the first
 * cut stays until then").
 */
export function packOffer(id: PhotoPackId, kept: () => void, extra = ''): HTMLElement {
  const p = PHOTO_PACKS[id];
  const root = h('div.pepack', { dataset: { pack: id } });
  const draw = (): void => {
    root.replaceChildren();
    const mine = getting?.id === id;
    const f = failure?.id === id ? failure : null;
    const half = !!f && /carries on|GET again|Stopped/.test(f.text);
    root.dataset.state = mine ? 'getting' : f ? 'failed' : 'offered';
    root.append(h('p.g-truth.pepackline', { role: 'status', 'aria-live': 'polite' }, mine ? getting!.line : OFFER[id](packSize(id))));
    if (extra && !mine) root.append(h('p.pnote', extra));
    if (f) root.append(h('p.pepackerr', { role: 'alert' }, f.text));
    if (mine) {
      root.append(h('div.pepackbar', h('i', { style: { width: `${Math.round((getting!.frac || 0) * 100)}%` } })));
      const stop = button('STOP', () => getting?.ctl.abort());
      stop.dataset.act = 'stop';
      root.append(h('div.perow.pekeys', stop));
    } else {
      const get = button(half ? `RESUME · ${sizeSaid(p)}` : `GET · ${sizeSaid(p)}`, () => void start(id, kept), 'on');
      get.dataset.act = 'get';
      get.setAttribute('aria-label', `Get ${p.name}, ${sizeSaid(p)}, on Wi-Fi`);
      get.disabled = !!getting;
      root.append(h('div.perow.pekeys', get));
      root.append(h('p.pnote', 'Only on Wi-Fi, only when you tap. It stays on this phone; Settings, offline eyes, takes it off and says how much room that frees.'));
    }
  };
  const f = (): void => {
    if (!root.isConnected && root.dataset.drawn) {
      listeners.delete(f);
      return;
    }
    root.dataset.drawn = '1';
    draw();
  };
  listeners.add(f);
  draw();
  return root;
}

/** Whether a GET for this pack is running now (the tray waits to draw its buttons). */
export const gettingNow = (id?: PhotoPackId): boolean => !!getting && (!id || getting.id === id);
