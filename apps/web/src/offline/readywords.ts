/**
 * HOW READY YOU ARE OFFLINE (NEXT ROUND, polish3.u10, with polish3.c4): one number for how much of Ghosty works with no signal right
 * now, and the one download that would help most, with its size. Pure: no DOM, no storage, no request. offline/readiness.ts reads
 * what is on this phone and hands the pieces here; features/system/offlineready.ts draws them; the chat says them.
 *
 * Each piece is something that keeps working with no signal once it is on the phone, weighted by how much of Ghosty it carries.
 * A piece this phone cannot run (no WebGPU for the brains) is left out of the count and said, never counted against him.
 */

export interface ReadyPiece {
  /** Steady, for the phone's records and the checks. */
  id: string;
  /** How he knows it. */
  name: string;
  /** What keeps working with no signal once it is here, in his words. */
  gives: string;
  /** How much of Ghosty it carries (the weights add up to 100 over every piece). */
  weight: number;
  /** Its download, in bytes. */
  bytes: number;
  /** Its size as the panel that fetches it says it ("352 MB", "41.3 MB"), so the two always read the same. */
  size: string;
  /** On this phone now. */
  held: boolean;
  /** This phone can run it (false: left out of the count, with why). */
  can: boolean;
  /** Why it cannot run here, when it cannot. */
  why?: string;
  /** Where it is fetched: the screen and the panel (the key opens it; the download itself is still his tap there, on Wi-Fi). */
  where: { tab: string; panel: string };
}

/** The pieces, their weights and what each keeps working. Sizes and whether each is here are filled in by offline/readiness.ts. */
export const PIECES: Omit<ReadyPiece, 'bytes' | 'size' | 'held' | 'can' | 'why'>[] = [
  { id: 'brain', name: 'The offline brain', gives: 'answers, the interpreter’s translations and School papers', weight: 34, where: { tab: 'settings', panel: 'OFFLINE BRAIN' } },
  { id: 'map', name: 'The offline map', gives: 'the map and your journeys around home', weight: 15, where: { tab: 'settings', panel: 'OFFLINE MAPS' } },
  { id: 'eyes-lens', name: 'The Lens’s eyes', gives: 'the Lens finding things and reading words and codes', weight: 15, where: { tab: 'settings', panel: 'OFFLINE EYES' } },
  { id: 'eyes-name', name: 'The namer', gives: 'the Lens naming everyday things', weight: 8, where: { tab: 'settings', panel: 'OFFLINE EYES' } },
  { id: 'meaning', name: 'Search by meaning', gives: 'finding passages in your library by what they mean', weight: 8, where: { tab: 'settings', panel: 'OFFLINE BRAIN' } },
  { id: 'eyes-measure', name: 'Measure’s distance', gives: 'MEASURE setting its own scale', weight: 5, where: { tab: 'settings', panel: 'OFFLINE EYES' } },
  { id: 'eyes-people', name: 'People you know', gives: 'knowing you and the people you introduced, in person', weight: 5, where: { tab: 'settings', panel: 'OFFLINE EYES' } },
  { id: 'voice-model', name: 'The voice model', gives: 'telling your voice from the people you introduced', weight: 4, where: { tab: 'settings', panel: 'VOICE MODEL' } },
  { id: 'photo-cutout', name: 'The cut-out model', gives: 'PHOTO cutting out a subject', weight: 2, where: { tab: 'settings', panel: 'OFFLINE EYES' } },
  { id: 'photo-erase', name: 'The erase model', gives: 'PHOTO removing an object', weight: 2, where: { tab: 'settings', panel: 'OFFLINE EYES' } },
  { id: 'photo-raw', name: 'The RAW reader', gives: 'PHOTO opening RAW photos', weight: 2, where: { tab: 'settings', panel: 'OFFLINE EYES' } },
];

/** A size as he reads it, where a piece has none of its own: "352 MB", "1.1 GB", "640 KB". */
export const sizeOf = (bytes: number): string => {
  const mb = bytes / 1_000_000;
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
};

export interface Readiness {
  /** 0 to 100: the share of what this phone can keep that is here. */
  pct: number;
  held: ReadyPiece[];
  missing: ReadyPiece[];
  /** What this phone cannot run, left out of the count. */
  cannot: ReadyPiece[];
  /** The one download that would help most: the heaviest missing piece (the smaller one when two weigh the same). */
  next: ReadyPiece | null;
  /** The number once that download is here. */
  nextPct: number;
}

export function scoreOf(pieces: ReadyPiece[]): Readiness {
  const can = pieces.filter((p) => p.can);
  const total = can.reduce((n, p) => n + p.weight, 0);
  const held = can.filter((p) => p.held);
  const have = held.reduce((n, p) => n + p.weight, 0);
  const missing = can.filter((p) => !p.held).sort((a, b) => b.weight - a.weight || a.bytes - b.bytes);
  const next = missing[0] ?? null;
  const pct = total ? Math.round((have / total) * 100) : 0;
  const nextPct = next && total ? Math.round(((have + next.weight) / total) * 100) : pct;
  return { pct, held, missing, cannot: pieces.filter((p) => !p.can), next, nextPct };
}

/** The headline: the number and what it means. */
export const readyHead = (r: Readiness): string => `${r.pct}% works with no signal`;

/** The line under it: the one download that helps most, or that nothing is left. */
export function readyNext(r: Readiness): string {
  if (!r.next) return r.held.length ? 'Everything this phone can keep is here, so I work with no signal.' : 'This phone can’t keep anything for no signal.';
  return `Next: ${r.next.name}, ${r.next.size || sizeOf(r.next.bytes)} on Wi-Fi, for ${r.next.gives} (${r.nextPct}% after).`;
}

/** What the chat says to "how ready are you offline?". */
export function readySay(r: Readiness): string {
  const parts = [`${readyHead(r)} right now.`];
  if (r.held.length) parts.push(`Here: ${r.held.map((p) => p.name.replace(/^The /, 'the ')).join(', ')}.`);
  parts.push(readyNext(r));
  return parts.join(' ');
}

/** His ways of asking (the chat answers on the phone, with no model): "how ready are you offline?", "what works with no signal?". */
export const READY_ASK = /^(?:(?:hey )?ghosty,? )?(?:how (?:ready|prepared) are you (?:for (?:no signal|offline)|offline|with no (?:signal|internet|wi-?fi))|how offline[- ]ready are (?:you|we)|what (?:still )?works (?:offline|with no (?:signal|internet|wi-?fi))|what can you do (?:offline|with no (?:signal|internet))|(?:show (?:me )?|open )?(?:the |my |your )?offline (?:readiness|ready)(?: score)?|are you ready (?:for no signal|to go offline))\s*[?.!]*$/i;
