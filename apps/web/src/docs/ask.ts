/**
 * DOCUMENTS AND THE BRAIN (BRIEF-REST-E part 2): the brain writes, edits and translates through the ordinary chat with
 * the document's words as the turn's data (no tool, no new words in its prompt); the phone does the rest. With the cloud
 * off-limits (Settings → Offline brain → always) the phone's own brain is asked instead, and nothing leaves the phone;
 * with neither, it is said. And after a reply he asked to be written ("write a letter to my landlord"), the offer of it
 * laid out as a document.
 */
import { brain } from '../api/brain';
import { answerOffline, offlineReady, translateOffline } from '../offline/brain';
import { settings, timeZone } from '../state/app';
import { card } from '../../../../packages/shared/src/cards';
import { chat } from '../assistant/session';
import { editMessage, langCode, numbered, parseNumbered, suggestionsFrom, textOf, titleFromAsk, translatedDoc, translateMessage, writeAsked, type Doc, type EditKind, type Suggestion } from './model';

/** Where the words came from: the brain, or the phone's own. */
export type Where = 'brain' | 'phone';
const cloudOff = () => settings.get().offlineBrain === 'always';

/** One question for the brain, its whole reply (the phone's own brain when the cloud is off-limits or out of reach). */
export async function askBrain(message: string, onWords: (w: string) => void = () => undefined): Promise<{ text: string; where: Where }> {
  const here = async (): Promise<{ text: string; where: Where }> => {
    if (settings.get().offlineBrain === 'off' || !(await offlineReady().catch(() => false))) throw new Error(cloudOff() ? 'this phone keeps everything on it (Offline brain: always), and my offline brain isn’t downloaded yet: Settings → Offline brain' : 'I can’t reach my brain, and my offline brain isn’t on this phone');
    let raw = '';
    const r = await answerOffline(message, [], (t) => onWords((raw += t)));
    return { text: r.text || raw, where: 'phone' };
  };
  if (cloudOff()) return here();
  try {
    let text = '';
    let failed = '';
    await brain.chat(message, { tz: timeZone, tab: 'documents', name: settings.get().name, now: new Date().toLocaleString('en-GB') }, (ev) => {
      if (ev.t === 'text') onWords((text += (text ? '\n\n' : '') + ev.text));
      else if (ev.t === 'error') failed = ev.message;
    });
    if (!text && failed) throw new Error(failed);
    if (!text) throw new Error('no reply came back');
    return { text, where: 'brain' };
  } catch (e) {
    if (await offlineReady().catch(() => false)) return here();
    throw e;
  }
}

/** The brain's edit of the whole document, as suggestions to accept or reject one by one. */
export async function suggestEdits(d: Doc, kind: EditKind | string): Promise<{ list: Suggestion[]; where: Where }> {
  const r = await askBrain(editMessage(d, kind));
  return { list: suggestionsFrom(d, r.text), where: r.where };
}

/**
 * The document translated paragraph by paragraph, its structure kept: in pieces of about 3,000 letters by the brain, or
 * a paragraph at a time by the phone's own brain (rough, and said so).
 */
export async function translateDoc(d: Doc, language: string, progress: (done: number, of: number) => void = () => undefined): Promise<{ doc: Doc; missing: number; where: Where }> {
  const paras = numbered(d);
  const replies = new Map<number, string>();
  let where: Where = 'brain';
  if (cloudOff()) {
    if (!(await offlineReady().catch(() => false))) throw new Error('this phone keeps everything on it, and my offline brain isn’t downloaded yet (Settings → Offline brain)');
    where = 'phone';
    for (const [i, b] of paras.entries()) {
      progress(i, paras.length);
      replies.set(i + 1, (await translateOffline(textOf(b), langCode(language))).text);
    }
  } else {
    let from = 0;
    while (from < paras.length) {
      let to = from;
      let size = 0;
      while (to < paras.length && (to === from || size + textOf(paras[to]!).length < 3000)) size += textOf(paras[to++]!).length;
      progress(from, paras.length);
      const r = await askBrain(translateMessage(d, language, from, to));
      where = r.where;
      for (const [n, t] of parseNumbered(r.text)) if (n > from && n <= to) replies.set(n, t);
      from = to;
    }
  }
  progress(paras.length, paras.length);
  return { ...translatedDoc(d, replies, language), where };
}

/** His name for a letter: what Settings calls him, unless that is still the default "Boss" (not a name to sign with). */
export function myName(): string {
  const n = settings.get().name?.trim() ?? '';
  return n && !/^boss$/i.test(n) ? n : '';
}

/**
 * After the brain's reply to "write a letter to …" (or an email, an essay, a report): a card under it that opens the
 * reply as a document, laid out, with his name and the date where a letter wants them.
 */
export function offerDocument(asked: string): void {
  const kind = writeAsked(asked);
  if (!kind) return;
  const entries = chat.get().entries;
  const mine = [...entries].reverse().findIndex((e) => e.kind === 'user' && e.text === asked);
  if (mine < 0) return;
  const reply = entries.slice(entries.length - mine).find((e) => e.kind === 'assistant' && e.text.trim().length > 60);
  if (!reply || reply.kind !== 'assistant') return;
  const words = kind === 'letter' || kind === 'complaint' ? 'letter' : kind === 'email' || kind === 'e-mail' ? 'email' : kind;
  const c = card({
    id: `doc:${reply.at}`,
    kind: 'brief',
    title: `Your ${words}, laid out`,
    line: `${titleFromAsk(asked)}: as a document, to edit and save as PDF or Word.`,
    brief: { icon: 'document' },
    acts: [{ label: 'OPEN', run: { name: 'open_docs', args: { reply: reply.at, ask: asked } } }],
  });
  void import('../features/core/cards').then((m) => m.postCard(c)).catch(() => undefined);
}

/** The words of a chat reply (by its time) and the ask it answered: what OPEN on the card lays out. */
export function replyText(at: number): string {
  const e = chat.get().entries.find((x) => x.kind === 'assistant' && x.at === at);
  return e && e.kind === 'assistant' ? e.text : '';
}
