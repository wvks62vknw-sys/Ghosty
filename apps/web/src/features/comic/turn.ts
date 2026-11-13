/** THE COMIC from the chat: what was asked, done on the screen, and said back in one line (assistant/local.ts calls this). */
import { comicAsked } from './asks';

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
  if (ask.what === 'make') {
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
    reply = 'COMIC → SHELF is open: tap IMPORT A COMIC and pick a CBZ, a PDF, pictures or a folder of them. A CBR can’t be opened in any browser, so save it as a CBZ first. It stays on this phone.';
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
