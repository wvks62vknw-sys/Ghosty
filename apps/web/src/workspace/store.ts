/**
 * THE WORKSPACE ON THIS PHONE (BRIEF-EDITOR-WORKSPACE): the whole workspace under one key, about eight megabytes of words (pictures are in the
 * phone's own picture database, docs/images.ts, shared with his documents). Where both the words and the version snapshots do not fit, the
 * oldest snapshots are let go first and `room()` says how many. It rides the phone's daily encrypted backup (features/system/backup.ts keeps
 * the ciphertext, the brain never opens it), so a new phone brings it back with the rest. A phone whose storage is blocked still edits;
 * it keeps nothing, and the screen says so and tries again.
 */
import { dropOldest, versionCount } from './versions';
import { emptyWorkspace, purgeBin, type Workspace } from './model';

export const KEY = 'ghosty.workspace';
const WHERE = 'ghosty.workspace.where';
const SAVED = 'ghosty.workspace.saved';
export const BYTES = 8_000_000;

export function loadWorkspace(): Workspace {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Workspace | null;
    if (raw && raw.v === 1 && raw.pages && typeof raw.pages === 'object') {
      const ws: Workspace = { v: 1, pages: raw.pages, versions: raw.versions ?? {}, at: raw.at ?? Date.now() };
      return purgeBin(ws).ws;
    }
  } catch {
    /* nothing kept, or unreadable: start empty */
  }
  return emptyWorkspace();
}

export interface Kept {
  ok: boolean;
  /** The workspace as kept (older snapshots let go to make room). */
  ws: Workspace;
  /** Snapshots let go this time. */
  dropped: number;
  bytes: number;
}
let letGo = 0;
/** Kept, or not: false when this phone keeps nothing right now. */
export function saveWorkspace(ws0: Workspace): Kept {
  let ws = ws0;
  let dropped = 0;
  try {
    let text = JSON.stringify(ws);
    while (text.length > BYTES && versionCount(ws) > 0) {
      const n = Math.max(5, Math.ceil(versionCount(ws) * 0.2));
      ws = dropOldest(ws, n);
      dropped += n;
      text = JSON.stringify(ws);
    }
    localStorage.setItem(KEY, text);
    try {
      localStorage.setItem(SAVED, String(Date.now()));
    } catch {
      /* the stamp is a convenience */
    }
    letGo += dropped;
    return { ok: true, ws, dropped, bytes: text.length };
  } catch {
    return { ok: false, ws, dropped, bytes: 0 };
  }
}
export interface Room {
  bytes: number;
  limit: number;
  pages: number;
  versions: number;
  /** Snapshots let go to make room since this page opened. */
  letGo: number;
}
export function room(): Room {
  let bytes = 0;
  try {
    bytes = (localStorage.getItem(KEY) ?? '').length;
  } catch {
    /* none */
  }
  const ws = loadWorkspace();
  return { bytes, limit: BYTES, pages: Object.values(ws.pages).filter((p) => !p.deleted).length, versions: versionCount(ws), letGo };
}
export const roomWords = (r: Room): string => `${(r.bytes / 1_000_000).toFixed(1)} of ${(r.limit / 1_000_000).toFixed(0)} MB${r.letGo ? ` · ${r.letGo} oldest version${r.letGo === 1 ? '' : 's'} let go to make room` : ''}`;

export function where(): { page: string; view?: string } | null {
  try {
    const w = JSON.parse(localStorage.getItem(WHERE) ?? 'null') as { page?: string; view?: string } | null;
    return w && typeof w.page === 'string' ? { page: w.page, ...(w.view ? { view: w.view } : {}) } : null;
  } catch {
    return null;
  }
}
export function keepWhere(page: string, view = ''): void {
  try {
    if (page) localStorage.setItem(WHERE, JSON.stringify({ page, ...(view ? { view } : {}) }));
    else localStorage.removeItem(WHERE);
  } catch {
    /* not kept */
  }
}
/** The pictures the kept workspace holds (so the documents' tidy-up never lets one go). */
export const workspaceImageIds = (): Set<string> => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Workspace | null;
    const ids = new Set<string>();
    for (const p of Object.values(raw?.pages ?? {})) for (const b of p.blocks ?? []) if (b.img) ids.add(b.img);
    for (const l of Object.values(raw?.versions ?? {})) for (const v of l) for (const b of v.blocks) if (b.img) ids.add(b.img);
    return ids;
  } catch {
    return new Set();
  }
};
/** When the last backup of this phone ran, as the phone knows it (SETTINGS says it; the backup itself is the SYSTEM page's). */
export function lastBackupAt(): number {
  try {
    const l = JSON.parse(localStorage.getItem('ghosty.backup.last') ?? 'null') as { at?: number; ok?: boolean } | null;
    return l?.ok && typeof l.at === 'number' ? l.at : 0;
  } catch {
    return 0;
  }
}
