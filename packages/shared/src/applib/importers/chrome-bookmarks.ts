/** Saved bookmarks: a browser's bookmarks export (the HTML file every browser writes) or its Bookmarks JSON file. */
import { decodeEntities } from './xml';
import { localDay, type Rec } from './input';

const site = (u: string) => /^https?:\/\/([^/]+)/i.exec(u)?.[1]?.replace(/^www\./, '') ?? '';
const rec = (title: string, link: string, folder: string, added?: Date): Rec | null => {
  if (!/^https?:\/\//i.test(link)) return null;
  const r: Rec = { _key: link, title: title.trim() || site(link), link, site: site(link) };
  if (folder) r.folder = folder;
  if (added && !Number.isNaN(+added) && added.getFullYear() > 1995) r.added = localDay(added);
  return r;
};

export function bookmarkRecords(text: string): Rec[] {
  const t = text.trim();
  if (t[0] === '{') return fromJson(t);
  const out: Rec[] = [];
  const folders: string[] = [];
  let pending = '';
  const re = /<DT><H3[^>]*>([\s\S]*?)<\/H3>|<DL>|<\/DL>|<DT><A\s([^>]*)>([\s\S]*?)<\/A>/gi;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const tok = m[0].slice(0, 4).toUpperCase();
    if (m[1] !== undefined) pending = decodeEntities(m[1].trim());
    else if (tok === '<DL>') { folders.push(pending); pending = ''; }
    else if (tok === '</DL') folders.pop();
    else if (m[2] !== undefined) {
      const href = /HREF="([^"]*)"/i.exec(m[2])?.[1] ?? '';
      const add = /ADD_DATE="(\d+)"/i.exec(m[2])?.[1];
      const r = rec(decodeEntities(m[3]!.replace(/<[^>]+>/g, '')), decodeEntities(href), folders.filter(Boolean).slice(-1)[0] ?? '', add ? new Date(+add * 1000) : undefined);
      if (r) out.push(r);
    }
  }
  return out;
}

function fromJson(t: string): Rec[] {
  let j: any;
  try { j = JSON.parse(t); } catch { return []; }
  const out: Rec[] = [];
  const walk = (n: any, folder: string) => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'url') {
      // the date is microseconds since 1601
      const added = n.date_added ? new Date(Number(n.date_added) / 1000 - 11644473600000) : undefined;
      const r = rec(String(n.name ?? ''), String(n.url ?? ''), folder, added);
      if (r) out.push(r);
    } else if (Array.isArray(n.children)) for (const c of n.children) walk(c, n.type === 'folder' && n.name ? String(n.name) : folder);
  };
  for (const root of Object.values(j.roots ?? {})) walk(root, '');
  return out;
}
