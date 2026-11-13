/**
 * VERSION HISTORY (BRIEF-EDITOR-WORKSPACE): a snapshot of a page per save burst (the 200 ms rule is the screen's; a burst is one snapshot),
 * sixty deep per page (thinned so they reach back, see thin), opened read-only and restored by one key (RESTORE THIS VERSION, which is itself undoable). Pure.
 */
import { patchPage, type Page, type Version, type Workspace } from './model';

export const DEPTH = 60;
const same = (a: Version, p: Page): boolean => a.title === p.title && a.icon === p.icon && JSON.stringify(a.blocks) === JSON.stringify(p.blocks) && JSON.stringify(a.vals ?? null) === JSON.stringify(p.vals ?? null);
const take = (p: Page, at: number): Version => ({ at, title: p.title, icon: p.icon, blocks: p.blocks, ...(p.vals ? { vals: p.vals } : {}) });

/** Sixty deep: past that the version whose neighbours are closest in time goes (never the oldest, never the ten newest), so the days stay in the list and not only the last hour. */
function thin(list: Version[]): Version[] {
  const out = [...list];
  while (out.length > DEPTH) {
    let at = 1;
    let best = Infinity;
    for (let i = 1; i < out.length - 10; i++) {
      const gap = out[i + 1]!.at - out[i - 1]!.at;
      if (gap < best) {
        best = gap;
        at = i;
      }
    }
    out.splice(at, 1);
  }
  return out;
}
/** Snapshot a page now; nothing is kept twice (the same content as the last snapshot is not a new one). */
export function snapshot(ws: Workspace, id: string, at = Date.now()): Workspace {
  const p = ws.pages[id];
  if (!p || p.deleted) return ws;
  const list = ws.versions[id] ?? [];
  const last = list[list.length - 1];
  if (last && same(last, p)) return ws;
  return { ...ws, versions: { ...ws.versions, [id]: thin([...list, take(p, at)]) } };
}
export const versionsOf = (ws: Workspace, id: string): Version[] => [...(ws.versions[id] ?? [])].reverse();
/** The page as a version had it, written back: a change like any other (so UNDO brings the present back). */
export function restoreVersion(ws: Workspace, id: string, at: number): Workspace {
  const v = (ws.versions[id] ?? []).find((x) => x.at === at);
  if (!v) return ws;
  return patchPage(ws, id, (p) => ({ ...p, title: v.title, icon: v.icon, blocks: v.blocks, ...(v.vals ? { vals: v.vals } : {}) }));
}
/** "3 hours ago", "yesterday", "12 Nov". */
export function agoWords(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
/** How many snapshots are kept in all. */
export const versionCount = (ws: Workspace): number => Object.values(ws.versions).reduce((n, l) => n + l.length, 0);
/** The oldest snapshot let go to make room; how many were dropped (the store says so). */
export function dropOldest(ws: Workspace, n: number): Workspace {
  const all = Object.entries(ws.versions).flatMap(([id, l]) => l.map((v) => ({ id, at: v.at }))).sort((a, b) => a.at - b.at).slice(0, n);
  if (!all.length) return ws;
  const kill = new Set(all.map((x) => `${x.id}:${x.at}`));
  const versions = Object.fromEntries(Object.entries(ws.versions).map(([id, l]) => [id, l.filter((v) => !kill.has(`${id}:${v.at}`))]));
  return { ...ws, versions };
}
