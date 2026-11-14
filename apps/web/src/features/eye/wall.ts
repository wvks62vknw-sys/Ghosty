/**
 * YOUR CAMERA WALL (NEXT ROUND, see.u2): up to nine public traffic cameras he pinned, on one live wall that is waiting each time, like
 * a control room. PIN TO WALL on a camera's card adds one; the wall's EDIT takes one off. Kept on this phone only (`ghosty.eye.wall`):
 * the cameras are public, and what he watches is his own. Each tile's still refreshes while the wall is open, and stops when it closes.
 */
import { fetchImage } from '../../api/feed';
import { h } from '../../core/dom';
import type { Camera } from '../../data/cameras';
import { button, modal, toast } from '../../ui/components';

export const WALL_MAX = 9;
const KEY = 'ghosty.eye.wall';
export type Pinned = Pick<Camera, 'id' | 'name' | 'lat' | 'lon' | 'src' | 'image'>;

/* state: eye.wall empty */
export const WALL_EMPTY = 'Your wall is empty. Open a public camera on God’s eye and tap PIN TO WALL: up to nine wait here.';
/* state: eye.wall error */
export const WALL_DOWN = 'I can’t reach this camera just now.';
export const WALL_FULL = `Your wall holds ${WALL_MAX} cameras. Take one off in EDIT to pin another.`;

export function wallList(): Pinned[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Pinned[];
    return Array.isArray(v) ? v.filter((c) => c && typeof c.id === 'string' && typeof c.image === 'string').slice(0, WALL_MAX) : [];
  } catch {
    return [];
  }
}
const save = (l: Pinned[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(l.slice(0, WALL_MAX)));
  } catch {
    /* not kept: the wall shows what it has */
  }
};
export const onWall = (id: string): boolean => wallList().some((c) => c.id === id);
/** Pin a camera (or take it off): returns what was said. */
export function togglePin(c: Camera): string {
  const l = wallList();
  if (l.some((x) => x.id === c.id)) {
    save(l.filter((x) => x.id !== c.id));
    return `${c.name} is off your wall.`;
  }
  if (l.length >= WALL_MAX) return WALL_FULL;
  save([...l, { id: c.id, name: c.name, lat: c.lat, lon: c.lon, src: c.src, image: c.image }]);
  return `${c.name} is on your wall (${l.length + 1} of ${WALL_MAX}).`;
}

/** What the wall shows, for the specs (window.__ghosty.wall). */
export const wallState = { open: false, tiles: 0, live: 0 };

/** Open the wall. `watch` opens one camera live on the globe. */
export function openWall(watch: (c: Pinned) => void): void {
  const timers: number[] = [];
  const urls: string[] = [];
  let editing = false;
  const grid = h('div.wallgrid', { dataset: { case: 'keep' } });
  const head = h('p.note.wallnote', { dataset: { case: 'keep' } });
  const edit = button('EDIT', () => {
    editing = !editing;
    edit.textContent = editing ? 'DONE' : 'EDIT';
    paint();
  });
  edit.dataset.act = 'edit';
  const stop = () => {
    for (const t of timers.splice(0)) clearInterval(t);
    for (const u of urls.splice(0)) URL.revokeObjectURL(u);
  };
  const paint = () => {
    stop();
    grid.replaceChildren();
    const l = wallList();
    wallState.tiles = l.length;
    wallState.live = 0;
    edit.hidden = !l.length;
    if (!l.length) {
      head.textContent = WALL_EMPTY;
      head.dataset.state = 'empty';
      return;
    }
    delete head.dataset.state;
    head.textContent = `${l.length} of ${WALL_MAX} · a new picture every few seconds · tap one to watch it live`;
    for (const c of l) {
      const img = h('img', { alt: `Live view: ${c.name}` });
      const stamp = h('small.wallstamp', { dataset: { state: 'loading', case: 'keep' } }, 'Connecting…');
      const tile = h('div.walltile', { dataset: { id: c.id } }, img, stamp, h('span.wallname', c.name));
      if (editing) {
        const off = button('TAKE OFF', () => {
          toast(togglePin(c as Camera), 'ok');
          paint();
        }, 'warn');
        off.dataset.act = 'off';
        off.setAttribute('aria-label', `Take ${c.name} off your wall`);
        tile.append(off);
      } else {
        const look = button('', () => {
          close.close();
          watch(c);
        });
        look.className = 'walllook';
        look.setAttribute('aria-label', `Watch ${c.name} live on God’s eye`);
        tile.append(look);
      }
      const load = async () => {
        try {
          const u = await fetchImage(c.image, c.src === 'New York' ? 5 : 15);
          urls.push(u);
          img.src = u;
          if (stamp.dataset.state) wallState.live++;
          stamp.textContent = `● ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${c.src}`;
          delete stamp.dataset.state;
          tile.classList.remove('dead');
        } catch {
          stamp.textContent = WALL_DOWN;
          stamp.dataset.state = 'error';
          tile.classList.add('dead');
        }
      };
      void load();
      timers.push(window.setInterval(() => void load(), c.src === 'New York' ? 5000 : c.src === 'National Highways' ? 20000 : 15000));
      grid.append(tile);
    }
  };
  const body = h('div.wall', head, grid, h('div.row.wrap.wallacts', edit));
  const close = modal('YOUR CAMERA WALL', body, () => {
    stop();
    wallState.open = false;
  });
  wallState.open = true;
  const g = (window as unknown as { __ghosty?: Record<string, unknown> }).__ghosty;
  if (g) g.wall = wallState;
  paint();
}
