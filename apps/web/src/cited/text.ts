/**
 * A cited answer on the phone, as data (no DOM here): the reply's words cut into plain text and
 * [n] source chips, with the claims the sources did not back marked; and the words alone for
 * the voice (no markers, no source list). The brain's cited.ts writes the reply this reads.
 */
import type { CitedInfo } from '../../../../packages/shared/src/protocol';

/**
 * One piece of the reply: words (`unconfirmed` when they belong to a claim no source backed), a chip for source `n`, or a
 * claim's label in words after it (OWNER-ISSUES 77: "established fact", "rumour"… — never colour alone).
 */
export type Piece = { kind: 'text'; text: string; unconfirmed?: boolean } | { kind: 'cite'; n: number; unconfirmed?: boolean } | { kind: 'label'; label: string };

const MARKER = /\[(\d{1,2}(?:\s*[,–-]\s*\d{1,2})*)\](?!\()/g;

/** The brain's check line ("✓ 2 of 3 claims found in the sources · 1 established, 1 documented"), last in a cited reply. */
const CHECK_LINE = /\n\n[✓✕] \d+ of \d+ claims? found in the sources(?: · [^\n]*)?\s*$/;
/** A claim's label as the brain writes it after the claim for Telegram ("… [1]. (established fact)"): the phone draws its own. */
const LABEL_TAG = / \((?:established fact|documented allegation|legal finding in progress|contested|rumour|debunked)\)/g;

/** The reply's own words: what comes before its SOURCES list and check line (those are drawn from the data instead). */
export function citedBody(text: string): string {
  const i = text.lastIndexOf('\n\nSOURCES\n');
  if (i >= 0) return text.slice(0, i).replace(LABEL_TAG, '').trim();
  // No list (the answer used no [n] markers), but its claims were still checked: the check line goes.
  // Nothing was looked up: the last paragraph is the brain's note saying so (it stays, as words).
  return text.replace(CHECK_LINE, '').replace(LABEL_TAG, '').trim();
}

function numbers(inside: string): number[] {
  const out: number[] = [];
  for (const part of inside.split(',')) {
    const [a, b] = part.split(/[–-]/).map((x) => Number(x.trim()));
    if (b !== undefined && b >= a! && b - a! < 10) for (let k = a!; k <= b; k++) out.push(k);
    else out.push(a!);
  }
  return out.filter((n) => n > 0);
}

/** The body cut into words and chips; the exact words of each unconfirmed claim are marked. */
export function citedPieces(body: string, info: CitedInfo): Piece[] {
  // Where the unconfirmed claims sit in the body (each claim is the reply's exact words).
  const marks: [number, number][] = [];
  // where each labelled claim ends: its label goes there
  const labels = new Map<number, string>();
  let from = 0;
  for (const c of info.checks) {
    const at = body.indexOf(c.claim, c.status === 'not_found' ? 0 : from);
    if (at < 0) continue;
    if (c.label) labels.set(at + c.claim.length, c.label);
    if (c.status === 'not_found') marks.push([at, at + c.claim.length]);
    else from = at + c.claim.length;
  }
  const inMark = (i: number) => marks.some(([a, b]) => i >= a && i < b);
  const cuts = new Set<number>([0, body.length]);
  for (const [a, b] of marks) cuts.add(a).add(b);
  for (const at of labels.keys()) cuts.add(at);
  const chips: { at: number; end: number; ns: number[] }[] = [];
  for (const m of body.matchAll(MARKER)) {
    chips.push({ at: m.index!, end: m.index! + m[0].length, ns: numbers(m[1]!) });
    cuts.add(m.index!).add(m.index! + m[0].length);
  }
  const edges = [...cuts].sort((a, b) => a - b);
  const out: Piece[] = [];
  for (let k = 0; k < edges.length - 1; k++) {
    const a = edges[k]!;
    const b = edges[k + 1]!;
    if (a === b) continue;
    const label = labels.get(a);
    if (label) out.push({ kind: 'label', label });
    const un = inMark(a) ? { unconfirmed: true } : {};
    const chip = chips.find((c) => c.at === a && c.end === b);
    if (chip) for (const n of chip.ns) out.push({ kind: 'cite', n, ...un });
    else out.push({ kind: 'text', text: body.slice(a, b), ...un });
  }
  const end = labels.get(body.length);
  if (end) out.push({ kind: 'label', label: end });
  return out;
}

/** What the voice says: the words without the [n] markers, the source list or the check line. */
export function spokenOf(text: string): string {
  return citedBody(text)
    .replace(MARKER, '')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Does this reply look like a cited one (a SOURCES list or a check line the brain wrote)? */
export const looksCited = (text: string): boolean => text.includes('\n\nSOURCES\n[') || CHECK_LINE.test(text);
