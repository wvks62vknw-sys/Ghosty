/**
 * WIKIPEDIA, OFFLINE in the chat (BRIEF-REST-A 1), answered on the phone from the file kept here, with no model and no
 * request (the brain never reads the file):
 *  - `wikiTurn`: "look it up offline", "offline wikipedia black holes", "what does wikipedia say about black holes
 *    (offline)?" (wiki/words.ts) → the article's first paragraph, and a card whose OPEN shows the article in the Library;
 *  - `offlineWiki`: when the brain cannot be reached and a "what is X?" found nothing else on the phone, the article whose
 *    title is X, said the same way (assistant/session.ts's no-connection path); after the library copy's own answer, the
 *    card alone.
 */
import type { Card } from '../../../../packages/shared/src/cards';
import { sizeWords, WIKI_FILES, type WikiFile } from './files';
import { firstParagraph } from './html';
import { archiveOf, readingFile } from './store';
import { titleVariants, whatIsAsked, wikiAsked } from './words';

/** What the chat shows (the shape of assistant/packs.ts PackReply). */
export interface WikiReply {
  said: string;
  reply: string;
  cards?: Card[];
  go?: { id: string; ask: number; label: string; run?: string; args?: Record<string, unknown> }[];
}

const TO_PANEL = { id: 'panel:library:WIKIPEDIA, OFFLINE', ask: -1, label: 'Wikipedia, offline', run: 'open_wiki', args: {} };

/** Four words at most on a card. */
const short = (t: string) => {
  const w = t.split(/\s+/);
  return w.length > 4 ? `${w.slice(0, 4).join(' ')}…` : t;
};

export function wikiCard(title: string, path: string, f: Pick<WikiFile, 'name'>): Card {
  return {
    id: `wiki:${path}`,
    kind: 'brief',
    at: Date.now(),
    title: short(title),
    line: `${f.name}, on this phone`,
    brief: { icon: 'diary' },
    acts: [{ label: 'OPEN', run: { name: 'open_wiki', args: { path } } }],
  };
}

/** The article for a thing (its title as said, or a capitalisation of it; redirects followed) and its first paragraph. */
async function lookUp(f: WikiFile, thing: string): Promise<{ title: string; path: string; para: string } | null> {
  const a = await archiveOf(f);
  const hit = await a.find(titleVariants(thing));
  if (!hit) return null;
  const art = await a.article(hit.path);
  if (!art) return null;
  return { title: art.title, path: art.path, para: firstParagraph(art.html) };
}

/**
 * His words, if they ask Wikipedia on the phone; null when they do not (or when "what does wikipedia say" has no file
 * here to answer from: then the brain's). `lastAsk`: his message before this one, for "look it up offline".
 */
export async function wikiTurn(text: string, lastAsk = ''): Promise<WikiReply | null> {
  const ask = wikiAsked(text);
  if (!ask) return null;
  const f = await readingFile().catch(() => null);
  if (!f) {
    if (!ask.offline) return null;
    const [taster, big] = WIKI_FILES;
    return {
      said: text,
      reply: `Wikipedia isn’t on this phone yet. In the Library, WIKIPEDIA, OFFLINE has ${taster!.name} (${sizeWords(taster!.bytes)}, a taster) and ${big!.name} (${sizeWords(big!.bytes)}): tap GET on Wi-Fi, and I can look things up with no signal.`,
      go: [TO_PANEL],
    };
  }
  const thing = ask.thing || (lastAsk ? (whatIsAsked(lastAsk) ?? lastAsk.replace(/[?!.]+$/, '').trim()) : '');
  if (!thing) return { said: text, reply: 'What shall I look up? Say “offline wikipedia” and the thing, like “offline wikipedia black holes”.', go: [TO_PANEL] };
  const got = await lookUp(f, thing).catch(() => null);
  if (!got) return { said: text, reply: `${f.name} on this phone has no article called “${thing}”. The search in the Library finds titles as you type.`, go: [TO_PANEL] };
  return { said: text, reply: `From ${f.name}, on this phone:\n${got.para || got.title}`, cards: [wikiCard(got.title, got.path, f)] };
}

/**
 * The brain cannot be reached (no connection) and `answer` is what the library copy on the phone said (null: nothing).
 * For a "what is X?" whose X is a title in the Wikipedia file here: with no answer, the article's first paragraph (and its
 * card); after an answer, the card alone, under it. Anything else, or no file here: `answer` as it was.
 */
export async function offlineWiki(question: string, answer: string | null): Promise<string | null> {
  try {
    const thing = whatIsAsked(question) ?? wikiAsked(question)?.thing ?? null;
    if (!thing) return answer;
    const f = await readingFile();
    if (!f) return answer;
    const got = await lookUp(f, thing);
    if (!got) return answer;
    // the card goes under the reply, which the chat puts up as soon as this returns
    setTimeout(() => void import('../features/core/cards').then((c) => c.postCard(wikiCard(got.title, got.path, f))).catch(() => undefined), 60);
    return answer ?? `I can’t reach my brain right now (no connection), but ${f.name} is on this phone:\n\n${got.para || got.title}`;
  } catch {
    return answer;
  }
}
