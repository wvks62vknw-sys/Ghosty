/**
 * HIS OWN ACCOUNTS in LINKS (BRIEF-SOCIAL items 3–6): BLUESKY, MASTODON, DISCORD and TELEGRAM CHANNEL — the accounts he made
 * himself, each linked once with the steps shown in plain words (an app password or a token of his own, never a main
 * password), checked by the brain signing in, and kept in its vault (apps/edge/src/social). Linked, a panel says who it is
 * and what to ask, with UNLINK. Every post, follow and unfollow still waits for his APPROVE on a draft card.
 */
import { ACCOUNTS, type Account } from '../../../../../packages/shared/src/social';
import { brain, type SocialInfo } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { button, confirmSheet, panel, row, toast, type Panel } from '../../ui/components';

const NOSPELL = { autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' } as const;

interface Field {
  key: string;
  label: string;
  placeholder: string;
  secret?: boolean;
  optional?: boolean;
  /** Why the value cannot be right, before anything is sent; null when it can. */
  check?: (v: string) => string | null;
}
interface Form {
  intro: string;
  link?: { href: string; label: string };
  steps: string[];
  fields: Field[];
  linkLabel: string;
  /** Linked: what to ask. */
  ask: string;
}

/** Each account's form: the steps in plain words and the boxes they fill. */
export const FORMS: Partial<Record<Account, Form>> = {
  bluesky: {
    intro: 'My own Bluesky account: you make it, I read your home timeline, and I post only what you APPROVE.',
    link: { href: 'https://bsky.app/settings/app-passwords', label: 'GET AN APP PASSWORD ↗' },
    steps: [
      'Make the account in the Bluesky app or at bsky.app, with any handle you like for me.',
      'In that account: Settings → Privacy and security → App passwords → Add App Password. Name it, then copy the code (four groups of four).',
      'Paste the handle and that app password here and press LINK BLUESKY. Never your main password: I refuse anything that is not an app password.',
      'Optional: one search I read each morning for the digest (a topic, a team, a place).',
    ],
    fields: [
      { key: 'handle', label: 'Bluesky handle', placeholder: 'you.bsky.social' },
      { key: 'password', label: 'Bluesky app password', placeholder: 'xxxx-xxxx-xxxx-xxxx', secret: true, check: (v) => (/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(v.trim()) ? null : 'That is not an app password (four groups of four, like abcd-efgh-ijkl-mnop). Never your main password.') },
      { key: 'search', label: 'A search for the morning (optional)', placeholder: 'e.g. Aston Villa', optional: true },
    ],
    linkLabel: 'LINK BLUESKY',
    ask: 'Ask me “what’s on Bluesky?”, “search Bluesky for …” or “post that on Bluesky” — every post waits for your APPROVE on a card.',
  },
};

/** The panels, by their titles as written (the EVERYTHING tab's catalogue reads each one from this source). */
const makePanels = (): Partial<Record<Account, Panel>> => ({
  bluesky: panel('BLUESKY', { grow: false, cls: 'socialpanel' }),
});

/** The panels, one per account with a form, and a paint that fills them from GET /api/social. */
export function socialPanels(): { panels: Panel[]; paint(): Promise<void> } {
  const made = makePanels();
  const list = ACCOUNTS.filter((a) => FORMS[a.id] && made[a.id]).map((a) => ({ a, p: made[a.id]! }));
  const editing = new Set<Account>();
  let info: SocialInfo | null = null;

  const paintOne = (a: (typeof ACCOUNTS)[number], p: Panel) => {
    const f = FORMS[a.id]!;
    const who = info?.accounts.find((x) => x.id === a.id)?.who ?? null;
    clear(p.body);
    p.setStatus(who ? 'LINKED' : info ? 'NOT LINKED' : 'OFFLINE', who ? 'ok' : 'mid');
    if (who && !editing.has(a.id)) {
      p.body.append(
        row('ACCOUNT', who),
        h('div.note', f.ask),
        h('div.keyrow', button('UNLINK', async () => {
          if (!(await confirmSheet(`Unlink ${a.name}?`, `I stop reading and posting as ${who}. What I kept for it is wiped from my vault: to link it again you paste a new one.`, 'UNLINK'))) return;
          await brain.socialUnlink(a.id).catch(() => undefined);
          toast(`${a.name} unlinked`, 'ok');
          void paint();
        }, 'warn')),
      );
      return;
    }
    const boxes = f.fields.map((x) => {
      const el = h('input', { type: x.secret ? 'password' : 'text', placeholder: x.placeholder, 'aria-label': x.label, ...NOSPELL, ...(x.secret ? { autocomplete: 'new-password' } : {}) }) as HTMLInputElement;
      el.dataset.key = x.key;
      return { x, el };
    });
    const msg = h('small.note', { role: 'status' }, '');
    const go = button(f.linkLabel, async (b) => {
      const values: Record<string, string> = {};
      for (const { x, el } of boxes) {
        const v = el.value.trim();
        if (!v && !x.optional) return void (msg.textContent = `Fill in: ${x.label}.`);
        const bad = v && x.check ? x.check(v) : null;
        if (bad) return void ((msg.textContent = bad), (msg.className = 'note bad'));
        if (v) values[x.key] = v;
      }
      b.disabled = true;
      msg.className = 'note';
      msg.textContent = `signing in to ${a.name} to check it…`;
      try {
        const r = await brain.socialLink(a.id, values);
        if (!r.ok) throw new Error(r.error ?? 'it did not work');
        toast(`${a.name} linked as ${r.who}`, 'ok');
        editing.delete(a.id);
        void paint();
      } catch (e) {
        msg.textContent = String((e as Error).message ?? e);
        msg.className = 'note bad';
      } finally {
        b.disabled = false;
      }
    }, 'on');
    p.body.append(
      h('div.note', f.intro),
      h('ol.steps', ...f.steps.map((s) => h('li', s))),
      f.link ? h('div.keyrow', h('a.lnk', { href: f.link.href, target: '_blank', rel: 'noopener' }, f.link.label)) : '',
      ...boxes.flatMap(({ x, el }) => [h('div.lab', x.label.toUpperCase()), el]),
      h('div.keyrow', go),
      msg,
    );
  };

  const paint = async () => {
    try {
      info = await brain.social();
    } catch {
      info = null;
    }
    for (const { a, p } of list) paintOne(a, p);
  };
  return { panels: list.map((x) => x.p), paint };
}
