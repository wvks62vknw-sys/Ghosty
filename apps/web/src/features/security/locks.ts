/**
 * SECURITY (NEXT ROUND, lane SECURITY, security.u1): every lock as one green, amber or red line in his words, worked out from facts
 * the phone already has (its owner key, its last backup, the faces it keeps, Telegram's state) and the brain's yes/no facts
 * (GET /security: VAULT_KEY set, the demo open, change previews on). Pure, so apps/edge/test/security.test.mjs holds every case.
 * Nothing here holds a key: the owner key's LENGTH is all that is looked at, and only on the phone.
 */

export type Level = 'green' | 'amber' | 'red';

export interface Lock {
  id: 'signin' | 'backup' | 'vault' | 'faces' | 'telegram' | 'previews' | 'demo' | 'doors' | 'approvals';
  label: string;
  level: Level;
  line: string;
  /** The STEPS guide that fixes it, when one does. */
  guide?: GuideId;
}

export type GuideId = 'doors' | 'previews' | 'vault' | 'ownerkey';

export interface BrainLocks {
  vaultKey: boolean;
  demoOpen: boolean;
  previews: string | null;
  access: boolean;
  keyByHash: boolean;
}

export interface ApprovalEntry {
  tool: string;
  what: string;
  allow: boolean;
  from: 'phone' | 'telegram';
  at: number;
  after?: string;
}

export interface LockFacts {
  /** The owner key's length on this phone (null: this phone signed in with Cloudflare Access instead). */
  keyLength: number | null;
  lastBackup: { at: number; ok: boolean } | null;
  faces: number | null;
  telegram: { linked: boolean; paired: boolean } | null;
  /** null: the brain could not be asked just now. */
  brain: BrainLocks | null;
  approvals: ApprovalEntry[] | null;
  /** He told this phone he added Cloudflare's free rate-limit rule (STEPS → DONE). */
  doorsRule: boolean;
  now: number;
}

const DAY = 86_400_000;
const ago = (ms: number): string => {
  const h = Math.round(ms / 3_600_000);
  if (h < 1) return 'under an hour ago';
  if (h < 36) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(ms / DAY);
  return `${d} day${d === 1 ? '' : 's'} ago`;
};

export const LONG_KEY = 32;

/** Every lock, in the order the screen shows them. */
export function locksOf(f: LockFacts): Lock[] {
  const out: Lock[] = [];
  // SIGN-IN: the owner key's length (a long random key is what keeps an offline guess hopeless), or Cloudflare Access
  if (f.keyLength == null) out.push({ id: 'signin', label: 'SIGN-IN', level: 'green', line: 'This phone signed in with Cloudflare Access.' });
  else if (f.keyLength >= LONG_KEY) out.push({ id: 'signin', label: 'SIGN-IN', level: 'green', line: `Your owner key, ${f.keyLength} characters: long enough.` });
  else out.push({ id: 'signin', label: 'SIGN-IN', level: 'amber', line: `Your owner key works, but it is ${f.keyLength} characters: ${LONG_KEY} or more random ones is much safer.`, guide: 'ownerkey' });
  // BACKUP: the phone's daily locked backup
  const b = f.lastBackup;
  if (!b) out.push({ id: 'backup', label: 'BACKUP', level: 'red', line: 'No backup of this phone yet: System → Backup & restore → BACK UP NOW.' });
  else if (!b.ok) out.push({ id: 'backup', label: 'BACKUP', level: 'red', line: `The last backup did not work (${ago(f.now - b.at)}): try System → Backup & restore.` });
  else if (f.now - b.at < 1.5 * DAY) out.push({ id: 'backup', label: 'BACKUP', level: 'green', line: `Backed up ${ago(f.now - b.at)}, locked with your owner key.` });
  else if (f.now - b.at < 8 * DAY) out.push({ id: 'backup', label: 'BACKUP', level: 'amber', line: `Last backed up ${ago(f.now - b.at)}: open Ghosty on Wi-Fi and it backs up again.` });
  else out.push({ id: 'backup', label: 'BACKUP', level: 'red', line: `Last backed up ${ago(f.now - b.at)}: back up now in System.` });
  // VAULT: where the lock on his service keys keeps its own key
  if (!f.brain) out.push({ id: 'vault', label: 'YOUR KEYS', level: 'amber', line: 'I can’t ask the brain just now, so I can’t check how your keys are locked.' });
  else if (f.brain.vaultKey) out.push({ id: 'vault', label: 'YOUR KEYS', level: 'green', line: 'Your service keys are locked, and the lock’s own key is a Cloudflare secret.' });
  else out.push({ id: 'vault', label: 'YOUR KEYS', level: 'amber', line: 'Your service keys are locked, but the lock’s own key is kept beside them. A VAULT_KEY secret keeps it apart.', guide: 'vault' });
  // FACES: only his and people he introduced, on this phone
  if (f.faces == null) out.push({ id: 'faces', label: 'FACES', level: 'green', line: 'Faces are only ever kept on this phone, and only yours and people you introduce.' });
  else out.push({ id: 'faces', label: 'FACES', level: 'green', line: f.faces ? `${f.faces} face${f.faces === 1 ? '' : 's'} kept, on this phone only (Settings → Privacy removes any).` : 'No faces kept.' });
  // TELEGRAM: answers one chat only
  const t = f.telegram;
  if (!t) out.push({ id: 'telegram', label: 'TELEGRAM', level: 'amber', line: 'I can’t check Telegram just now.' });
  else if (!t.linked) out.push({ id: 'telegram', label: 'TELEGRAM', level: 'green', line: 'Not linked: nobody can reach me through Telegram.' });
  else if (t.paired) out.push({ id: 'telegram', label: 'TELEGRAM', level: 'green', line: 'Paired: your bot answers your chat and no one else.' });
  else out.push({ id: 'telegram', label: 'TELEGRAM', level: 'amber', line: 'Linked and waiting for the pairing code: the first chat that types it becomes yours. Pair it soon, or unlink it in Links.' });
  // PREVIEWS: proposed changes built as previews
  if (!f.brain) out.push({ id: 'previews', label: 'PREVIEWS', level: 'amber', line: 'I can’t check change previews just now.' });
  else if (!f.brain.previews) out.push({ id: 'previews', label: 'PREVIEWS', level: 'green', line: 'No change previews are built.' });
  else out.push({ id: 'previews', label: 'PREVIEWS', level: 'amber', line: `Change previews are on (${f.brain.previews}). They may run with your live keys; keep them apart in Cloudflare.`, guide: 'previews' });
  // DEMO: the public sample
  if (!f.brain) out.push({ id: 'demo', label: 'DEMO', level: 'amber', line: 'I can’t check the public demo just now.' });
  else if (f.brain.demoOpen) out.push({ id: 'demo', label: 'DEMO', level: 'amber', line: 'The public demo is open: anyone with its link sees a made-up Sam, never your data. DEMO_OFF=1 in Cloudflare closes it.' });
  else out.push({ id: 'demo', label: 'DEMO', level: 'green', line: 'The public demo is closed.' });
  // DOORS: the public doors' own limits, hard once Cloudflare's free rule is added
  out.push(f.doorsRule
    ? { id: 'doors', label: 'PUBLIC DOORS', level: 'green', line: 'Cloudflare’s free rate limit stops anyone hammering the public doors, and the brain’s own limits stay on too.' }
    : { id: 'doors', label: 'PUBLIC DOORS', level: 'amber', line: 'The public doors slow down anyone hammering them, best effort. Cloudflare’s free rate-limit rule makes it a hard stop.', guide: 'doors' });
  // APPROVALS: what he allowed and turned down this week
  const week = (f.approvals ?? []).filter((a) => f.now - a.at < 7 * DAY);
  if (!f.approvals) out.push({ id: 'approvals', label: 'APPROVALS', level: 'amber', line: 'I can’t read the list of approvals just now.' });
  else if (!week.length) out.push({ id: 'approvals', label: 'APPROVALS', level: 'green', line: 'Nothing asked for your APPROVE this week.' });
  else {
    const yes = week.filter((a) => a.allow).length;
    out.push({ id: 'approvals', label: 'APPROVALS', level: 'green', line: `This week: ${yes} approved, ${week.length - yes} turned down. Every one is listed below.` });
  }
  return out;
}

/** The screen's one line: how many locks are green, and what most needs him. */
export function summaryOf(locks: Lock[]): { green: number; total: number; line: string; level: Level } {
  const green = locks.filter((l) => l.level === 'green').length;
  const red = locks.find((l) => l.level === 'red');
  const amber = locks.find((l) => l.level === 'amber');
  const level: Level = red ? 'red' : amber ? 'amber' : 'green';
  const line = red ? `Fix first: ${red.label.toLowerCase()}.` : amber ? `${locks.length - green} to look at, none urgent.` : 'Every lock is green.';
  return { green, total: locks.length, line, level };
}

/** One approval as a line: "Approved · Send an email … · from Telegram · 2 hours ago". */
export function approvalLine(a: ApprovalEntry, now: number): string {
  return `${a.allow ? 'Approved' : 'Turned down'} · ${a.what}${a.after ? ` · after reading ${a.after}` : ''} · from ${a.from === 'telegram' ? 'Telegram' : 'the phone'} · ${ago(now - a.at)}`;
}

/** A random VAULT_KEY in the form the brain reads (32 random bytes, base64). Made on the phone, shown once, kept nowhere. */
export function newVaultKey(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return btoa(String.fromCharCode(...rand(32)));
}

/** A long random owner key (40 characters, letters and digits only, so it types cleanly). Made on the phone, kept nowhere. */
export function newOwnerKey(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const out: string[] = [];
  while (out.length < 40) for (const b of rand(64)) if (b < 4 * abc.length && out.length < 40) out.push(abc[b % abc.length]!);
  return out.join('');
}

/**
 * THE NIGHTLY SELF-CHECK, told once (security.u7): the locks that slipped since he was last told. A lock counts when it is red, or
 * amber where it was green when he was last told; one he has heard about stays quiet until it changes again; one that can't be
 * checked right now (the brain or Telegram unreachable) is never news. `told` is what the Brief last said, kept on the phone.
 */
export function slipped(locks: Lock[], told: Record<string, Level>, unknown: ReadonlySet<string> = new Set()): { news: Lock[]; next: Record<string, Level> } {
  const next: Record<string, Level> = {};
  const news: Lock[] = [];
  const rank: Record<Level, number> = { green: 0, amber: 1, red: 2 };
  for (const l of locks) {
    if (unknown.has(l.id)) {
      if (told[l.id]) next[l.id] = told[l.id]!;
      continue;
    }
    next[l.id] = l.level;
    const was = told[l.id] ?? 'green';
    if (l.level !== 'green' && rank[l.level] > rank[was]) news.push(l);
  }
  return { news, next };
}

/** The Brief's one line for what slipped (empty when nothing did). */
export function slippedLine(news: Lock[]): string {
  if (!news.length) return '';
  const first = news[0]!;
  return news.length === 1 ? `Security: ${first.label.toLowerCase()} needs a look. ${first.line}` : `Security: ${news.length} locks need a look, first ${first.label.toLowerCase()}. ${first.line}`;
}
