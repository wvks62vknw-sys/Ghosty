/**
 * THE VIDEO STORE (BRIEF-EDITOR-VIDEO): the original clips' bytes kept untouched in the phone's own database (IndexedDB, the
 * shape of library/local.ts), the project's JSON beside them (saved 200 ms after a change), a poster frame for each clip. About
 * 600 MB of clips at most; the oldest project's clips are let go first, and `room()` says so in words before anything goes.
 * A project exports and imports as a .zip of its JSON and clips (convert/zip.ts), with the size said.
 */
import type { Project } from './model';
import { newProject, usedSources } from './model';
import { sizeWords } from '../convert/bytes';
import { unzipSync, zipStore } from '../convert/zip';

export const MAX_BYTES = 600 * 1024 * 1024;

export interface Kept {
  id: string;
  name: string;
  at: number;
  bytes: number;
  clips: number;
  /** In the bin for a few seconds, UNDO still possible. */
  gone?: boolean;
}

/** What fits: where `add` more bytes would go among the projects kept (the oldest let go first), said in words. Pure. */
export function room(kept: Pick<Kept, 'id' | 'name' | 'at' | 'bytes'>[], add: number, max = MAX_BYTES, keepId = ''): { fits: boolean; free: number; letGo: { id: string; name: string; bytes: number }[]; words: string } {
  const used = kept.reduce((n, k) => n + k.bytes, 0);
  const free = Math.max(0, max - used);
  if (add > max) return { fits: false, free, letGo: [], words: `That clip alone is bigger than I can keep: ${sizeWords(add)}, and I keep about ${sizeWords(max)} of video.` };
  if (add <= free) return { fits: true, free, letGo: [], words: free - add < max * 0.1 ? `Room is running out: about ${sizeWords(free - add)} left after this.` : `There is room: about ${sizeWords(free - add)} left after this.` };
  const letGo: { id: string; name: string; bytes: number }[] = [];
  let need = add - free;
  for (const k of [...kept].filter((x) => x.id !== keepId).sort((a, b) => a.at - b.at)) {
    if (need <= 0) break;
    letGo.push({ id: k.id, name: k.name, bytes: k.bytes });
    need -= k.bytes;
  }
  if (need > 0) return { fits: false, free, letGo: [], words: `There isn’t room for ${sizeWords(add)} even with every other video let go.` };
  const names = letGo.map((x) => `“${x.name}”`).join(' and ');
  return { fits: true, free, letGo, words: `To keep this ${sizeWords(add)} I would let go of ${names}, the oldest (${sizeWords(letGo.reduce((n, x) => n + x.bytes, 0))}). Say if you would rather not.` };
}

// ---------------------------------------------------------------- the database
const DB = 'ghosty-video';
let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((ok, bad) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('projects', { keyPath: 'id' });
      d.createObjectStore('clips');
      d.createObjectStore('posters');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  });
  return dbp;
}
const req = <T,>(r: IDBRequest<T>): Promise<T> => new Promise((ok, bad) => {
  r.onsuccess = () => ok(r.result);
  r.onerror = () => bad(r.error);
});
const tx = async (stores: string[], mode: IDBTransactionMode) => (await db()).transaction(stores, mode);
const done = (t: IDBTransaction): Promise<void> => new Promise((ok, bad) => {
  t.oncomplete = () => ok();
  t.onerror = () => bad(t.error);
  t.onabort = () => bad(t.error);
});

type Row = { id: string; project: Project; gone?: number };
const key = (project: string, src: string) => `${project}/${src}`;

export const bytesOfProject = (p: Project): number => [...usedSources(p)].reduce((n, id) => n + (p.sources[id]?.size ?? 0) + (p.sources[id]?.proxy ?? 0), 0);

export async function listProjects(): Promise<Kept[]> {
  const rows = (await req((await tx(['projects'], 'readonly')).objectStore('projects').getAll())) as Row[];
  const now = Date.now();
  const out: Kept[] = [];
  for (const r of rows) {
    if (r.gone && now - r.gone > 60_000) {
      void removeProject(r.id);
      continue;
    }
    out.push({ id: r.id, name: r.project.name, at: r.project.at, bytes: bytesOfProject(r.project), clips: r.project.main.length, ...(r.gone ? { gone: true } : {}) });
  }
  return out.sort((a, b) => b.at - a.at);
}

export async function saveProject(p: Project): Promise<void> {
  const t = await tx(['projects'], 'readwrite');
  const old = (await req(t.objectStore('projects').get(p.id))) as Row | undefined;
  t.objectStore('projects').put({ id: p.id, project: p, ...(old?.gone ? { gone: old.gone } : {}) } satisfies Row);
  await done(t);
}
export async function loadProject(id: string): Promise<Project | null> {
  const r = (await req((await tx(['projects'], 'readonly')).objectStore('projects').get(id))) as Row | undefined;
  return r?.project ?? null;
}
export async function binProject(id: string, gone: boolean): Promise<void> {
  const t = await tx(['projects'], 'readwrite');
  const r = (await req(t.objectStore('projects').get(id))) as Row | undefined;
  if (r) t.objectStore('projects').put(gone ? { ...r, gone: Date.now() } : { id: r.id, project: r.project });
  await done(t);
}
export async function removeProject(id: string): Promise<void> {
  const d = await db();
  const t = d.transaction(['projects', 'clips', 'posters'], 'readwrite');
  const p = ((await req(t.objectStore('projects').get(id))) as Row | undefined)?.project;
  t.objectStore('projects').delete(id);
  for (const s of Object.keys(p?.sources ?? {})) {
    t.objectStore('clips').delete(key(id, s));
    t.objectStore('posters').delete(key(id, s));
  }
  await done(t);
}
export async function putSource(project: string, src: string, file: Blob, poster: Blob | null): Promise<void> {
  const t = await tx(['clips', 'posters'], 'readwrite');
  t.objectStore('clips').put(file, key(project, src));
  if (poster) t.objectStore('posters').put(poster, key(project, src));
  await done(t);
}
export const sourceBlob = async (project: string, src: string): Promise<Blob | null> => ((await req((await tx(['clips'], 'readonly')).objectStore('clips').get(key(project, src)))) as Blob | undefined) ?? null;
export const posterBlob = async (project: string, src: string): Promise<Blob | null> => ((await req((await tx(['posters'], 'readonly')).objectStore('posters').get(key(project, src)))) as Blob | undefined) ?? null;
export async function dropSource(project: string, src: string): Promise<void> {
  const t = await tx(['clips', 'posters'], 'readwrite');
  t.objectStore('clips').delete(key(project, src));
  t.objectStore('posters').delete(key(project, src));
  await done(t);
}

/** Saves a project 200 ms after the last change; `onSaved` says "Saved" (the first time a project is, only once). */
export function autosaver(onSaved: (p: Project) => void): { change(p: Project): void; flush(): Promise<void> } {
  let timer = 0;
  let latest: Project | null = null;
  const run = async () => {
    const p = latest;
    latest = null;
    if (!p) return;
    try {
      await saveProject(p);
      onSaved(p);
    } catch {
      /* a full or blocked store is said by the screen when it adds a clip */
    }
  };
  return {
    change(p) {
      latest = p;
      clearTimeout(timer);
      timer = window.setTimeout(() => void run(), 200);
    },
    async flush() {
      clearTimeout(timer);
      await run();
    },
  };
}

// ---------------------------------------------------------------- a project as a .zip
export async function projectZip(p: Project): Promise<{ blob: Blob; size: number }> {
  const files: { name: string; data: Uint8Array }[] = [{ name: 'project.json', data: new TextEncoder().encode(JSON.stringify(p)) }];
  for (const id of usedSources(p)) {
    const b = await sourceBlob(p.id, id);
    if (b) files.push({ name: `clips/${id}`, data: new Uint8Array(await b.arrayBuffer()) });
  }
  const zip = zipStore(files);
  return { blob: new Blob([zip as BlobPart], { type: 'application/zip' }), size: zip.length };
}
export async function importZip(bytes: Uint8Array): Promise<Project> {
  const f = unzipSync(bytes);
  const j = f.get('project.json');
  if (!j) throw new Error('that file is not a Ghosty video project');
  const p = JSON.parse(new TextDecoder().decode(j)) as Project;
  const base = newProject();
  const q: Project = { ...base, ...p, id: base.id, at: Date.now(), name: `${p.name} (copy)` };
  const old = p.id;
  for (const id of Object.keys(q.sources)) {
    const data = f.get(`clips/${id}`);
    if (data) await putSource(q.id, id, new Blob([data as BlobPart]), await posterBlob(old, id));
  }
  return q;
}
