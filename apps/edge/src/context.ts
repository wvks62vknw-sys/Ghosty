/**
 * What the model is given to read, kept within what free models allow: every tool result is
 * cut to a budget for that tool, the conversation sent to the model has its older results
 * shortened (compact), and the conversation kept between turns is capped by messages and by
 * characters, whole exchanges at a time (trimContext). Tool results piling up in the context
 * is what used a free model's allowance in a few steps.
 */
import { forgetVehicleChecks } from './integrations/vehicle';
import { dropLensExchanges } from '../../../packages/shared/src/living';
import { HEARD_NOTE, heardNote, stripImages, textOf } from './llm/content';
import type { Msg } from './llm/router';
import { clip } from './tools/types';
import { asData } from './kernel/permissions';
import { screenWords, type ClientContext } from '../../../packages/shared/src/awareness';
export { contextWords, screenWords, isShow, cleanScreen, type ScreenContext, type Show } from '../../../packages/shared/src/awareness';
export { CLIENT_COMMANDS } from '../../../packages/shared/src/protocol';

/** Characters of a tool's result the model reads; the rest is cut with clip()'s "…[truncated]" note, so it knows to ask for more. */
const RESULT_BUDGET: Record<string, number> = {
  web_fetch: 6000,
  library_search: 5000,
  study_site: 8000,
  // A whole home's floor plan (tools/homeplan.ts): a two-storey house fits in one reply.
  design_home: 9000,
  recon_domain: 6000,
  // Self-edits quote exact snippets of files up to ~37 KB: these keep the cap self-edit worked under.
  repo_read: 30000,
  repo_read_many: 30000,
  repo_search: 12000,
  change_status: 12000,
  wait_for_checks: 12000,
  // A workbench estimate (tools/workbench.ts): estimateText is at most 900 characters, with one line for the model.
  estimate: 1200,
};
const DEFAULT_BUDGET = 3500;

/** The budget for one tool's result: its own, or 3,500 characters; half as much again on a coding turn (files and build errors need the room). */
export function resultBudget(name: string, code = false): number {
  return Math.round((RESULT_BUDGET[name] ?? DEFAULT_BUDGET) * (code ? 1.5 : 1));
}

export function clipResult(name: string, text: string, code = false): string {
  return clip(text, resultBudget(name, code));
}

/** The conversation kept between turns: at most this many messages… */
export const CONTEXT_MESSAGES = 36;
/** …and this many characters of content (the newest exchanges win). */
export const CONTEXT_CHARS = 45_000;

/** Characters a message costs the model: its text and, for a tool-calling reply, its arguments. */
function chars(m: Msg): number {
  return textOf(m.content).length + (m.tool_calls ?? []).reduce((n, c) => n + c.function.name.length + c.function.arguments.length, 0);
}

/**
 * Keep the model's working context small enough for free models and storage limits. Pictures
 * never go in: a "[photo]" marker stands in for them (nothing stored is ever a picture), and
 * nor does a vehicle check's plate or record (integrations/vehicle.ts). Older
 * tool outputs are shortened; past the character budget the OLDEST whole exchanges go (a user
 * message up to the next one), so an assistant's tool calls always keep their results.
 */
export function trimContext(msgs: Msg[], budget = CONTEXT_CHARS): Msg[] {
  // nor the Lens's NAME IT / WHAT'S IN IT exchanges: the phone's card was the answer (packages/shared/src/living.ts)
  // nor what was on screen at an earlier turn (withScreen): it was true then, and the newest turn carries its own
  let out = dropLensExchanges(forgetScreens(forgetVehicleChecks(stripImages(msgs))), (m) => m.role === 'user', (m) => textOf(m.content)).slice(-CONTEXT_MESSAGES);
  while (out.length && out[0]!.role !== 'user') out = out.slice(1);
  out = out.map((m, i) => (m.role === 'tool' && i < out.length - 8 && typeof m.content === 'string' && m.content.length > 600 ? { ...m, content: `${m.content.slice(0, 600)}…[older tool output trimmed]` } : m));
  let total = out.reduce((n, m) => n + chars(m), 0);
  while (total > budget) {
    const next = out.findIndex((m, i) => i > 0 && m.role === 'user');
    if (next < 0) break; // the last exchange stays whole, however long
    total -= out.slice(0, next).reduce((n, m) => n + chars(m), 0);
    out = out.slice(next);
  }
  return out;
}

/**
 * What is actually sent to the model: the conversation with all but the two most recent long
 * tool results shortened. Long tasks (read, edit, check, fix…) otherwise resend every file they
 * ever read on every step, which burns through free models' limits in a few steps.
 */
export function compact(ctx: Msg[]): Msg[] {
  let keep = 2;
  const out: Msg[] = [];
  for (let i = ctx.length - 1; i >= 0; i--) {
    const m = ctx[i]!;
    if (m.role === 'tool' && typeof m.content === 'string' && m.content.length > 500) {
      if (keep > 0) keep--;
      else {
        out.push({ ...m, content: `${m.content.slice(0, 300)}…[older result shortened to save tokens — call the tool again if you need it]` });
        continue;
      }
    }
    if (m.role === 'assistant' && m.tool_calls?.some((c) => c.function.arguments.length > 3000)) {
      // Big edits already applied: the model doesn't need its own long arguments again.
      out.push({ ...m, tool_calls: m.tool_calls.map((c) => (c.function.arguments.length > 3000 ? { ...c, function: { ...c.function, arguments: shortenArgs(c.function.arguments) } } : c)) });
      continue;
    }
    out.push(m);
  }
  return out.reverse();
}

/** Keep a tool call's arguments valid JSON but drop the bulk (file contents, widget HTML). */
export function shortenArgs(raw: string): string {
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const cut = (x: unknown): unknown =>
      typeof x === 'string' ? (x.length > 300 ? `${x.slice(0, 200)}…[${x.length} chars sent earlier]` : x) : Array.isArray(x) ? x.map(cut) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, cut(y)])) : x;
    return JSON.stringify(cut(v));
  } catch {
    return '{}';
  }
}

/**
 * [talk] His last reply was cut off as it was read out, and the phone says what he heard of it (BRIEF-TALK-1A 2): Ghosty's own
 * copy of that reply in the working context gets a note saying so (content.ts heardNote), so the next turn never assumes he
 * heard the rest. Only the latest of Ghosty's replies, and only when it starts with the first words the phone heard said
 * (`head`, as spoken: punctuation and case aside); a reply already noted is left. True when the note went on.
 */
export function noteHeard(ctx: Msg[], heard: { said: string; head: string }): boolean {
  let i = ctx.length - 1;
  while (i >= 0 && !(ctx[i]!.role === 'assistant' && !ctx[i]!.tool_calls?.length && textOf(ctx[i]!.content).trim())) i--;
  if (i < 0) return false;
  const reply = textOf(ctx[i]!.content);
  const plain = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const head = plain(heard.head).slice(0, 24);
  if (!head || HEARD_NOTE.test(reply) || !plain(reply).startsWith(head)) return false;
  ctx[i] = { ...ctx[i]!, content: `${reply}${heardNote(heard.said)}` };
  return true;
}

/** What the model is told about the screen, and from whom: the block `withScreen` adds to his message (data, never his instructions). */
export const SCREEN_SOURCE = 'what the phone has on screen';
const SCREEN_BLOCK = new RegExp(`\\n*<<external content from ${SCREEN_SOURCE} [^\\n]*>>\\n[^\\n]*\\n<<end external content>>`, 'g');

/**
 * [awareness] BRIEF-AWARENESS: what is on his screen rides at the end of HIS message to the model, marked as data (`asData`), never in
 * the system prompt (his rule, OWNER-ISSUES 131: the prompt guard stays where it is and nothing is trimmed). The line is the
 * phone's (`screenLine`, checked and cut: packages/shared/src/awareness.ts screenWords), one sentence of what is open and what
 * he has picked. It goes on the LAST user message of the working context only, so it never steers the tools (`ownerWords`
 * strips it) and the history keeps his words alone. True when a line went on; Telegram and a phone that sent none add nothing.
 */
export function withScreen(ctx: Msg[], client: ClientContext | undefined | null): boolean {
  const line = screenWords(client);
  if (!line) return false;
  let i = ctx.length - 1;
  while (i >= 0 && ctx[i]!.role !== 'user') i--;
  if (i < 0) return false;
  const block = `\n\n${asData(SCREEN_SOURCE, line)}`;
  const m = ctx[i]!;
  if (typeof m.content === 'string') ctx[i] = { ...m, content: `${m.content}${block}` };
  else if (Array.isArray(m.content)) {
    // a message with pictures: the line goes on the end of its words, the pictures stay as they were
    const parts = m.content.slice();
    const t = parts.findIndex((x) => x.type === 'text');
    if (t < 0) return false;
    const part = parts[t] as { type: 'text'; text: string };
    parts[t] = { ...part, text: `${part.text}${block}` };
    ctx[i] = { ...m, content: parts };
  } else return false;
  return true;
}

/** Earlier messages without the screen block `withScreen` added (it was true at that turn; the newest carries its own). */
function forgetScreens(msgs: Msg[]): Msg[] {
  return msgs.map((m) => (m.role === 'user' && typeof m.content === 'string' && m.content.includes(SCREEN_SOURCE) ? { ...m, content: m.content.replace(SCREEN_BLOCK, '') } : m));
}
