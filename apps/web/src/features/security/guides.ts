/**
 * SECURITY → STEPS: the fixes that live in his Cloudflare account, each as a short guide in plain steps (lane SECURITY: the two
 * half-done items, security.u8, and the owner key and vault key). Ghosty never holds his Cloudflare login, so these are steps he
 * takes himself; where a value is needed (a long random key), the phone makes one and shows it once.
 */
import type { GuideId } from './locks';

export interface Guide {
  id: GuideId;
  title: string;
  why: string;
  steps: string[];
  /** A random value the steps need, made on the phone: which kind. */
  make?: 'vault' | 'owner';
  /** He can mark it done on this phone (only where the brain cannot see it for itself). */
  done?: boolean;
}

export const GUIDES: Guide[] = [
  {
    id: 'doors',
    title: 'STOP HAMMERING HARD',
    why: 'The brain already slows down anyone hammering its public doors, but only per Cloudflare server. Cloudflare’s free rate-limit rule stops them at the edge, before the brain wakes.',
    steps: [
      'Open dash.cloudflare.com and pick the website (domain) Ghosty is served on. The rule needs a domain of your own; on a workers.dev address only the brain’s own limits apply.',
      'Security → WAF → Rate limiting rules → Create rule. Name it “Ghosty public doors”.',
      'When incoming requests match: URI Path starts with /api/training/hook, or /demo, or /s/, or /i/.',
      'With the same characteristics: IP. When rate exceeds: 20 requests per 10 seconds (the free plan’s period).',
      'Then: Block, for 10 seconds. Deploy. Then tap DONE below so this screen knows.',
    ],
    done: true,
  },
  {
    id: 'previews',
    title: 'KEEP PREVIEWS APART',
    why: 'When I propose a change, Cloudflare can build a preview of it. A preview built that way may run with your live keys and your brain’s own data.',
    steps: [
      'Open dash.cloudflare.com → Workers & Pages → your Ghosty worker → Settings.',
      'Under Domains & Routes, turn Preview URLs off. Your live address is not touched.',
      'Or, to keep previews: give them their own settings with no live keys (Settings → Variables and Secrets, per environment), so a preview never sees yours.',
      'Back here, the PREVIEWS line turns green once the brain reports no previews.',
    ],
  },
  {
    id: 'vault',
    title: 'GIVE THE KEYS’ LOCK ITS OWN KEY',
    why: 'Your service keys are locked, but without a VAULT_KEY secret the lock’s own key is kept beside them. As a Cloudflare secret it is kept apart.',
    steps: [
      'Know this first: the keys you already added were locked with the old lock, so you will add them again once (System → Keys). Nothing else is lost.',
      'Tap MAKE ONE below: the phone makes a random VAULT_KEY and shows it once. Copy it.',
      'dash.cloudflare.com → Workers & Pages → your Ghosty worker → Settings → Variables and Secrets → Add. Type: Secret. Name: VAULT_KEY. Value: paste. Deploy.',
      'Add your keys again in System → Keys. The YOUR KEYS line turns green.',
    ],
    make: 'vault',
  },
  {
    id: 'ownerkey',
    title: 'A LONGER OWNER KEY',
    why: 'Your owner key opens everything, and its fingerprint is in your code’s public history. A long random key keeps any offline guess hopeless.',
    steps: [
      'Tap MAKE ONE below: the phone makes a 40-character random key and shows it once. Save it in your password manager first.',
      'dash.cloudflare.com → Workers & Pages → your Ghosty worker → Settings → Variables and Secrets → Add. Type: Secret. Name: OWNER_KEY. Value: the new key. Deploy.',
      'If OWNER_KEY_HASH is set there (or in wrangler.jsonc), remove it, so only the secret counts.',
      'On this phone: Settings → System, sign in again with the new key. Your backups stay readable: a backup made with the old key opens with the old key, so make a fresh BACK UP NOW straight after.',
    ],
    make: 'owner',
  },
];

export const guideOf = (id: GuideId): Guide | undefined => GUIDES.find((g) => g.id === id);
