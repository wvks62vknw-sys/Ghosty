/**
 * UNDO FOR PUBLISHED PAGES (NEXT ROUND, sites.u2): every page keeps the versions it had before its last three updates in the brain
 * (apps/edge/src/tools/sites.ts); the Workshop's UNDO LAST UPDATE puts the newest back at the same link, after his confirm, and what
 * was live is kept, so an undo can be undone. In the chat, "undo my last update to the party page" asks his APPROVE.
 */
import { headers } from '../api/brain';
import { inHisWords } from '../ui/hisWords';

export interface Restored {
  ok: boolean;
  title: string;
  at: number;
  versions: number;
}
export async function restoreSite(name: string): Promise<Restored> {
  const r = await fetch(`/api/sites/${encodeURIComponent(name)}/restore`, { method: 'POST', credentials: 'same-origin', headers: headers() });
  const j = (await r.json().catch(() => null)) as (Restored & { error?: string }) | null;
  if (!r.ok || !j) throw typeof j?.error === 'string' ? inHisWords(j.error) : new Error(`the brain answered ${r.status}`);
  return j;
}

/** [sites] A published page's check-up (NEXT ROUND sites.u9): the publish check on the live page, in his words; nothing is changed. */
export interface CheckUp {
  ok: boolean;
  errors: string[];
  warnings: string[];
  kb: number;
  said: string;
}
export async function checkSite(name: string): Promise<CheckUp> {
  const r = await fetch(`/api/sites/${encodeURIComponent(name)}/check`, { credentials: 'same-origin', headers: headers() });
  const j = (await r.json().catch(() => null)) as (CheckUp & { error?: string }) | null;
  if (!r.ok || !j) throw typeof j?.error === 'string' ? inHisWords(j.error) : new Error(`the brain answered ${r.status}`);
  return j;
}
