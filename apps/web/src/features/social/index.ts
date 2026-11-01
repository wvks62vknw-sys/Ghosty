/**
 * SOCIAL (BRIEF-TABS 2; ME): his social self on one screen. THE QUEUE: every draft for his own accounts still waiting for his
 * APPROVE, drawn by the chat's own draft card (APPROVE · EDIT · NO: nothing goes out without APPROVE, as everywhere), and what
 * went out today (features/social/queue.ts); THE ACCOUNTS: LINKS' own panels for Bluesky, Mastodon, Discord and his Telegram
 * channel (features/links/social.ts), linked once each with the steps in plain words; FATHER AND THE ORIGIN: who made me, when,
 * of what, and my promises (features/me/origin.ts). The chat's drafts, LINKS and the Me sheet's row still show the same.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const socialTab: TabDef = {
  id: 'social',
  title: 'SOCIAL',
  icon: '<path d="M3.5 6.5a2 2 0 012-2h9a2 2 0 012 2V12a2 2 0 01-2 2H9.5L6 17v-3h-.5a2 2 0 01-2-2z"/><path d="M16.5 9h2a2 2 0 012 2v5a2 2 0 01-2 2H18v3l-3.5-3H11a2 2 0 01-1.8-1.1"/>',
  scene: 'backdrop',
  blurb: 'posts waiting for your APPROVE · your accounts · who made me',
  now: () => cardNow('social'),
  mount(root) {
    const inst = sheetPage(root, {
      screen: 'social',
      tag: 'ME // SOCIAL',
      sub: 'The accounts you made for me. Every post, follow and unfollow waits for your APPROVE; and who made me, and when.',
      big: () => cardBig('social'),
      load: () => cardLoad('social'),
      sections: async () => {
        const [q, links, origin] = await Promise.all([import('./queue'), import('../links/social'), import('../me/origin')]);
        const acc = links.socialPanels();
        return [
          {
            id: 'queue',
            label: 'Waiting',
            parts: [
              { title: 'WAITING FOR YOUR APPROVE', pack: 'social', screen: 'queue', build: () => q.queueScreen() },
              { title: 'SENT TODAY', pack: 'social', screen: 'sent', build: () => q.sentScreen() },
            ],
          },
          // (the four panels paint from one read: the first one asks for it)
          { id: 'accounts', label: 'Accounts', parts: acc.panels.map((p, i) => ({ title: p.title.textContent ?? '', made: { panel: p, ...(i ? {} : { paint: () => acc.paint().then(inst.repaint) }) } })) },
          { id: 'origin', label: 'Origin', parts: [{ title: 'FATHER AND THE ORIGIN', pack: 'social', screen: 'origin', build: () => ({ el: origin.originPage() }) }] },
        ];
      },
    });
    return inst;
  },
};
