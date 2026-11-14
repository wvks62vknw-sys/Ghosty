/**
 * The catalogue's words for SECURITY (NEXT ROUND, lane SECURITY: "Safe, private and in your hands"): Settings → Security, its
 * three panels and the things he can say. Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-14';

export const SECURITY_WORDS: Record<string, CatValue> = {
  'screen:security': {
    name: 'Security: every lock at once',
    line: 'You can see every lock I keep on one screen, each green, amber or red, with every approval you gave or turned down.',
    more: 'Settings → Security. Sign-in, your backup, your keys’ lock, faces, Telegram, change previews, the public demo, the public doors and this week’s approvals, each one line in plain words with what to do. STEPS walks you through the fixes that live in your Cloudflare account.',
    say: ['How safe am I?', 'Show my security', 'Are my locks green?'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  'panel:security:LOCKS': {
    name: 'Every lock, green, amber or red',
    line: 'You can see each lock I keep as one green, amber or red line, and tap an amber one for the steps that fix it.',
    more: 'Sign-in, backup, your keys’ lock, faces, Telegram, change previews, the demo, the public doors and approvals. Nothing secret is shown: only whether each lock is in place.',
    say: ['Is everything locked?', 'What needs fixing in security?'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  'panel:security:APPROVALS': {
    name: 'Every approval, listed',
    line: 'You can read every APPROVE and NOT NOW you gave, from the phone or Telegram, with when and what it was.',
    more: 'When an approval came after I read a page, the line names that page too. CLEAR LIST empties it; nothing you approved is undone.',
    say: ['What have I approved?', 'Show my approvals'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  'panel:security:STEPS': {
    name: 'Steps for the Cloudflare fixes',
    line: 'You can follow short steps for the fixes that live in your Cloudflare account, with a long random key made on the phone when one is needed.',
    more: 'A hard stop for anyone hammering the public doors (Cloudflare’s free rule), keeping change previews apart from your live keys, a separate key for your keys’ lock, and a longer owner key.',
    say: ['How do I keep previews apart?', 'Make me a new owner key'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  'panel:security:HAS IT LEAKED?': {
    name: 'Has this password leaked?',
    line: 'You can check a password against the public list of leaked ones; only five characters of its scrambled fingerprint leave the phone.',
    more: 'Settings → Security. Type it, tap CHECK: the box empties at once, the fingerprint is made on the phone, and the rest of the match happens here too. Nothing is kept.',
    say: ['Has my password leaked?', 'Check a password'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  'panel:security:LOCK EVERYTHING': {
    name: 'One tap to lock everything',
    line: 'You can lock everything in one tap: Telegram unpaired, and nothing that publishes, sends, pays or ships runs until you unlock.',
    more: 'Settings → Security, or say "lock everything". It stays locked until you unlock it there with your owner key; pair Telegram again in Links afterwards.',
    say: ['Lock everything', 'Panic button'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  'panel:security:CHECK A LINK': {
    name: 'Check a link first',
    line: 'You can paste a link or a message and see where it really goes and any scam signs, from public records, before you open it.',
    more: 'Settings → Security. Nothing is opened: the address is checked against public lists of scam sites and look-alike names, with no key.',
    say: ['Check this link', 'Is this link safe?'], scene: ['behind'], cat: 'do', since: SINCE,
  },
  // "lock everything", "has my password leaked?", "show my approvals", "how safe am I?": answered on the phone, the screen opened
  'phrase:security': { same: 'screen:security' },
};
