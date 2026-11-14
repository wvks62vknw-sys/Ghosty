/** THE COMIC from the chat: what was asked, done on the screen, and said back in one line (assistant/local.ts calls this). */
import { comicAsked } from './asks';

/** What "it" is: the screen he is on (a note, a trip, a memory: its own sentence), else what I last said in the chat. */
async function thisOnScreen(): Promise<string> {
  try {
    const { screenContext } = await import('../../shell/awareness');
    const c = screenContext();
    if (c.screen && c.screen !== 'core' && c.screen !== 'comic') return `the following, as a comic: ${c.title}: ${(c.looking || c.line).slice(0, 240)}`;
  } catch {
    /* (no screen to read: the chat instead) */
  }
  const { chat } = await import('../../assistant/session');
  const last = [...chat.get().entries].reverse().find((e) => e.kind === 'assistant' && 'text' in e && e.text.trim().length > 20) as { text: string } | undefined;
  return last ? `the following, as a comic: ${last.text.replace(/\s+/g, ' ').trim().slice(0, 280)}` : '';
}

export interface ComicReply {
  said: string;
  reply: string;
  go: { id: string; ask: number; label: string; run?: string; args?: Record<string, unknown> }[];
}

export async function comicTurn(text: string): Promise<ComicReply> {
  const ask = comicAsked(text) ?? { what: 'open' as const };
  const app = await import('./app');
  const { go } = await import('../../shell/tabs');
  const open = (section: string) => go(`comic?${section}`);
  let reply = '';
  if (ask.what === 'this') {
    const idea = await thisOnScreen();
    if (!idea) {
      reply = 'Make what into a comic? Say it like “make me a comic about a cat who wants to fly”, or open a note, a trip or a memory and say “make it a comic”.';
      return { said: text, reply, go: [{ id: 'comic', ask: -1, label: 'Open Comic', run: 'open_comic', args: {} }] };
    }
    if (app.hooks.make) {
      open('make');
      app.hooks.make(idea);
    } else {
      app.pending.make = idea;
      open('make');
    }
    reply = `I’m making that into a comic: ${idea.replace(/^the following, as a comic: /, '').slice(0, 90)}… It opens in COMIC → MAKE, kept on this phone; tap any panel to change it.`;
  } else if (ask.what === 'week') {
    if (app.hooks.week) {
      open('make');
      app.hooks.week();
    } else {
      app.pending.week = true;
      open('make');
    }
    reply = 'I’m making your week into a comic from your agenda and the to-dos you ticked: a panel a day, open in COMIC → MAKE, kept on this phone. Only the titles and days are used, never where things were.';
  } else if (ask.what === 'make') {
    const idea = ask.idea || 'a cat who wants to be an astronaut';
    if (app.hooks.make) {
      open('make');
      app.hooks.make(idea);
    } else {
      app.pending.make = idea;
      open('make');
    }
    reply = `I wrote and drew a comic about ${idea}: a cover and four pages, with a beginning, a turn and an end. It is open in COMIC → MAKE, kept on this phone. Tap any panel to change a line, a face or the place; READ IT shows it full screen.`;
  } else if (ask.what === 'import') {
    open('shelf');
    if (app.hooks.askImport) app.hooks.askImport();
    else app.pending.import = true;
    reply = 'COMIC → SHELF is open: tap IMPORT A COMIC and pick a CBZ, a CBR, a PDF, pictures or a folder of them. A CBR needs the free RAR reader once (1.1 MB, on your tap, on Wi-Fi). It stays on this phone.';
  } else if (ask.what === 'library') {
    if (app.hooks.library) {
      open('library');
      app.hooks.library(ask.words);
    } else {
      app.pending.library = ask.words;
      open('library');
    }
    reply = `The public-domain library is open${ask.words ? ` on “${ask.words}”` : ''}: comics old enough to be free, from the Internet Archive. Nothing downloads until you tap, never on mobile data, and the size is said first.`;
  } else if (ask.what === 'shelf') {
    open('shelf');
    reply = 'Your comic shelf is open: tap READ on one (it opens where you stopped), or import one of yours. The Library has free public-domain comics.';
  } else {
    open('shelf');
    reply = 'COMIC is open: your shelf, MAKE for a comic of your own from an idea, and a free public-domain LIBRARY.';
  }
  return { said: text, reply, go: [{ id: 'comic', ask: -1, label: 'Open Comic', run: 'open_comic', args: {} }] };
}
