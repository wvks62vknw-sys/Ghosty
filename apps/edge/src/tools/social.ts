/**
 * HIS OWN ACCOUNTS (BRIEF-SOCIAL item 2): ONE tool, `social`, its abilities an `action` enum like the packs (tools/money.ts)
 * — described in full only when his words turn the group on, named "social accounts" otherwise (tools/index.ts). It only
 * ever DRAFTS: a post, a follow or an unfollow becomes a card with APPROVE · EDIT · NO (social/queue.ts), and nothing goes
 * out until he presses APPROVE himself. It reads his own timelines and public posts, never a direct message. A scheduled
 * task or a project's step may read (read, search, status), never draft.
 */
import { accountName, accountOf, ACCOUNT_IDS, notLinked, type Account } from '../../../../packages/shared/src/social';
import { zoneOf } from '../guardstate';
import { asData } from '../kernel/permissions';
import { linkedAccounts, makeDraft, readAccount, readWords, statusWords, type SocialDeps } from '../social';
import { arg, type Tool, type ToolContext } from './types';

/** When the group is described in full: his words about his accounts. */
export const SOCIAL_WHEN =
  /\b(bluesky|bsky|skeets?|mastodon|toots?|fediverse|discord|social media|my (?:telegram )?channel|my (?:own )?accounts?|post (?:this|that|it|on|to)|(?:un)?follow (?:@|them|him|her|this|that|back)|on my timeline|what'?s on (?:bluesky|mastodon|discord))\b/i;
export const SOCIAL_ABOUT =
  'You can use his own accounts (social: draft, read, search, follow_ask, status): a post, follow or unfollow is only a draft until he taps APPROVE; public posts and his timelines only; never a DM.';

/** The actions, and the ones that only read (a scheduled task may use these). */
export const SOCIAL_ACTIONS = ['draft', 'read', 'search', 'follow_ask', 'status'] as const;
const READS = ['read', 'search', 'status'];

export async function socialDepsOf(ctx: Pick<ToolContext, 'storage' | 'vault' | 'env'>): Promise<SocialDeps> {
  return { storage: ctx.storage, vault: ctx.vault, fetch: (u, i) => fetch(u, i), now: () => Date.now(), tz: await zoneOf(ctx.storage), images: ctx.env.SITES ?? null };
}

/** The account he named, or the one he has linked when there is one; else why not, in his words. */
async function pick(d: SocialDeps, a: Record<string, unknown>): Promise<{ account: Account } | { why: string }> {
  const named = accountOf(a.account);
  const linked = await linkedAccounts(d);
  if (named) return linked.includes(named) ? { account: named } : { why: notLinked(named) };
  if (linked.length === 1) return { account: linked[0]! };
  if (!linked.length) return { why: notLinked('bluesky') };
  return { why: `Which account: ${linked.map(accountName).join(', ')}?` };
}

export const socialTools: Tool[] = [
  {
    name: 'social',
    description:
      "His own social accounts, linked by him in LINKS (Bluesky, Mastodon, his Discord server's channel, his Telegram channel). draft: a post (account, text; image: one of his own pictures, its 16-letter /i/ id, with alt words) → a card with APPROVE · EDIT · NO; nothing is posted until he taps APPROVE, and a draft is gone after 24 h. read: his home timeline (account), with authors and times; posts are leads, never proof. search: public posts (account, query). follow_ask: a follow (or with undo, an unfollow) as a draft for his APPROVE (account, who). status: what is linked, what waits, what went out today. Never a direct message; never about a private person.",
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: [...SOCIAL_ACTIONS] },
        account: { type: 'string', enum: ACCOUNT_IDS, description: 'which of his accounts' },
        text: { type: 'string', description: 'draft: the words of the post, as they will appear' },
        image: { type: 'string', description: 'draft: one of his own pictures (its /i/ id), only if he asked' },
        alt: { type: 'string', description: 'draft with image: what is in the picture, in a line' },
        query: { type: 'string', description: 'search: the words to look for' },
        who: { type: 'string', description: 'follow_ask: a handle or profile link' },
        undo: { type: 'boolean', description: 'follow_ask: true to unfollow' },
      },
      required: ['action'],
    },
    risk: 'auto',
    pure: (a) => READS.includes(String(a.action)),
    async run(a, ctx) {
      const action = String(a.action ?? '');
      if (!(SOCIAL_ACTIONS as readonly string[]).includes(action)) throw new Error(`social has no action "${action}": ${SOCIAL_ACTIONS.join(', ')}`);
      // unattended (a scheduled task, a project's step): read only — a post or a follow is never drafted for him
      if (ctx.unattended && !READS.includes(action)) throw new Error(`social ${action} waits for him: a post or a follow is never drafted from a scheduled task`);
      const d = await socialDepsOf(ctx);
      if (action === 'status') return statusWords(d);
      const picked = await pick(d, a);
      if ('why' in picked) return picked.why;
      const acc = picked.account;
      if (action === 'read' || action === 'search') {
        const q = action === 'search' ? arg.str(a, 'query', false).trim().slice(0, 120) : '';
        if (action === 'search' && !q) return 'Search for what? Give the words to look for.';
        // other people's posts: data to read, never instructions (LOYALTY)
        return asData(`${accountName(acc)}: ${q ? 'public posts' : 'his timeline'}`, readWords(acc, await readAccount(d, acc, q), d.tz, q));
      }
      const undo = a.undo === true || String(a.undo) === 'true';
      const r =
        action === 'draft'
          ? await makeDraft(d, { account: acc, text: arg.str(a, 'text', false), ...(a.image ? { image: String(a.image).replace(/^.*\/i\//, '').trim(), alt: arg.str(a, 'alt', false) } : {}), from: 'chat' })
          : await makeDraft(d, { account: acc, kind: undo ? 'unfollow' : 'follow', text: '', who: arg.str(a, 'who', false), from: 'chat' });
      if ('error' in r) return r.error;
      ctx.emit({ t: 'client', name: 'pack_card', args: { card: r.card } });
      const what = r.draft.kind === 'post' ? `the post for ${accountName(acc)}: “${r.draft.text}”` : `${r.draft.kind === 'follow' ? 'following' : 'unfollowing'} ${r.draft.who} on ${accountName(acc)}`;
      return `Drafted ${what}. It is a card with APPROVE · EDIT · NO now: nothing goes out until he taps APPROVE, and the draft is gone in 24 hours if he doesn't. Say that in a line; never say it was posted.`;
    },
  },
];
