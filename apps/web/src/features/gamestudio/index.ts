/**
 * THE GAME STUDIO (BRIEF-EDITOR-GAME-STUDIO; MAKE): a game maker on the app's own engine. Its page is the studio's
 * (studio-game/editor.ts): MY GAMES as a shelf with the three templates and BLANK, and the editor as pills (ROOMS, SPRITES,
 * CHARACTERS, THINGS, QUESTS, RULES, SOUND, PLAY, SHARE, AS AN APP). Games are saved on this phone as he goes. "make a game" and
 * "my games" in the chat open it; the ARCADE's MY GAMES row plays and edits what he made.
 */
import type { TabDef } from '../../shell/tabs';
import { screenSays } from '../../shell/awareness';
import { info } from '../../studio-game/hub';
import { page } from '../../ui/page';

export const gamestudioTab: TabDef = {
  id: 'gamestudio',
  // [consistency] one name: GAME STUDIO, as its pill, the deck and his words say it
  title: 'GAME STUDIO',
  icon: '<rect x="2.5" y="6.5" width="19" height="11" rx="3"/><path d="M7 10v4M5 12h4"/><path d="M14 10.5h3M14 13.5h3"/><path d="M5 20.5h14"/>',
  scene: 'backdrop',
  blurb: 'make a 2-D game · play it · share it',
  now: () => (info.games ? `${info.games} game${info.games === 1 ? '' : 's'}${info.last ? `, the newest “${info.last}”` : ''}` : ''),
  mount(root) {
    // (stacked, as every page() screen: About follows My games in one scrolling page, never behind a lone "?")
    const P = page(root, { tag: 'MAKE // GAME STUDIO', sub: '', leftLabel: 'GAMES', rightLabel: 'ABOUT', stack: true });
    root.classList.add('studiopg');
    P.big.dataset.case = 'keep';
    let studio: import('../../studio-game/editor').Studio | null = null;
    let pending = '';
    void import('../../studio-game/editor').then((m) => {
      studio = m.mountStudio(P);
      if (pending) studio.open(pending);
    });
    return {
      enter() {
        studio?.enter();
      },
      leave() {
        // (what runs in a pill — a play, a tune — is put away when the pill goes; the game is already saved)
      },
      open(arg) {
        if (studio) studio.open(arg);
        else pending = arg;
      },
      context: () => {
        const said = studio?.context() ?? 'the game studio';
        return screenSays('gamestudio', 'The game studio', said, { looking: said.match(/editing (“[^”]*”)/)?.[1]?.slice(0, 80) ?? 'my games' });
      },
      describe: () => `MAKE // GAME STUDIO: ${studio?.context() ?? 'opening'}.`,
    };
  },
};
