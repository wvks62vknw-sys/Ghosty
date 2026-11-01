# BRIEF-SOCIAL — his social self: Father and the origin, his own accounts posting only with approval, reading feeds, one line of his own a day (batch ⑦, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after 064ea00; never reset to FETCH_HEAD or origin,
only to the local branch). Your preview port: 8755. Read first: ROADMAP.md row ⑦ and the upwards table; OWNER-ISSUES 93 (b,
d, f), 94 (a, d), 95–97, 99 (the catalogue rules), 101 (the cadence and the cards of ②), 105 (the pack pattern: one tool with
an `action` enum, `short` on the group, read actions for jobs and write actions never, the prompt at EXACTLY 5,500 on the
worst dial — every character you add to the plain prompt must be trimmed elsewhere and listed); `apps/edge/src/tools/
money.ts` and `packs/base.ts` as the shape; `apps/edge/src/integrations/*` (how Spotify and email are linked: the vault,
LINKS panels, `GROUP_NEEDS` in abilities.ts); `apps/edge/src/speak.ts` + `packages/shared/src/cadence.ts` (how an
unprompted line goes out); `apps/edge/src/library/digest.ts` and `packages/shared/src/sources.ts` (how feeds join the digest
and are tiered); `apps/edge/src/telegram.ts` (the bot that exists). Other builders run in parallel (the car, three games,
the people/work/creative packs): touch nothing under `arcade/`, `car/`, `features/studio/`, `features/people|work|creative/`,
`tools/people|work|creative.ts`. Yours: `apps/edge/src/social/*` (new), `tools/social.ts`, `packages/shared/src/social.ts`,
`catalogue/social.ts` (joined where the catalogue files are), `apps/web/src/features/links/*` (the new LINKS panels),
`features/settings/character.ts` (one FATHER AND THE ORIGIN row that opens the page), `apps/web/src/features/me/*` or the
Me sheet's rows via `shell/areadefs.ts` (one row), your phrases in `assistant/phrases.ts` + `local.ts`, `apps/edge/test/
social.test.mjs`, `tests/social.spec.mjs`, the CI smoke loop's list (`social` after `packs2` if present, else after
`packs`), `apps/edge/package.json`'s test list, a CSS block at the END of styles.css, and the prompt trims.

## The owner's words and picks

"he can post on bluesky with my approval and read too"; "i'll call him a lot of things so it'll never be one thing" (no
fixed name); "he can speak first idm"; no weekly letter. Accounts he said yes to in principle: Bluesky first; Discord (a bot
in his own server), Mastodon, his own Telegram channel next; X posting-only later; Instagram/Threads/TikTok not now. He makes
the accounts himself and pastes the keys; nothing bills.

## What to build (a commit each)

1. FATHER AND THE ORIGIN (code, no model): a page in his voice reached from SETTINGS → CHARACTER and the Me sheet: who made
   him (his father, the owner — never a name he did not give; "you" in the page), when he was born (the first commit's
   date from a constant kept in packages/shared, not git at run time), what he was made of (the brain on the phone and the
   cloud, the weekly training, the school), what he is for (the plan's own words from VISION.md's first lines, quoted
   short), the things he has learned to do by month (the batches' dates from STATUS as a constant table), his promises (the
   lines that hold, in his voice: "I only ever use your own things and what is public." …). Nothing invented. One phrase,
   "who made you?" / "where did you come from?", answers with the page's first lines and a card to open it.
2. THE APPROVAL QUEUE (`social/queue.ts`, shared): any post anywhere is a DRAFT first: a card in the chat (and Telegram) with
   the words, the account, APPROVE · EDIT · NO; nothing goes out without APPROVE; drafts expire after 24 h; every post sent
   is recorded for WHY and "what did you do today". A `social` tool (one tool, actions: draft, read, search, follow_ask,
   status) with `short: 'his accounts'`; write actions never for jobs; follows and unfollows are drafts too.
3. BLUESKY (`social/bluesky.ts`, the AT Protocol over fetch, no library): LINKS → BLUESKY: his handle and an APP PASSWORD
   (never his main password) into the vault; a session with refresh; POST through the queue (text, one image from a card
   he approved, alt text required); READ his home timeline and a search into the digest as a feed in the LEAD tier (never
   a fact source), and "what's on Bluesky?" answers from the last read with authors and times; FOLLOW asks first. Rate
   limits honoured; errors in plain words; the key line when unlinked.
4. MASTODON (`social/mastodon.ts`): LINKS → MASTODON: his server and an access token from his own app on it (the steps
   shown in the panel); the same post/read/search/follow shape through the queue.
5. DISCORD (`social/discord.ts`, REST + an Interactions endpoint, no gateway): LINKS → DISCORD: his bot's token, the
   application id and public key, the one server and channel he picks; the bot answers when mentioned there (through the
   brain, the same guard as Telegram: the owner only, others get one polite line), posts to the channel through the queue,
   and the Worker's `/discord/interactions` verifies signatures (Ed25519) before anything. Read-only of the channel's last
   messages for the digest if the token allows.
6. HIS OWN TELEGRAM CHANNEL (`social/channel.ts`): the existing bot posts to a channel he names (he adds the bot as admin),
   through the queue.
7. ONE LINE OF HIS OWN A DAY: a scheduled job `musing` (JOB_KINDS, with catalogue words) that once a day, under ②'s cadence
   and counted in its cap, says one thing of his own in the chat — from what he read (the digest, Bluesky), learned (the
   weekly training's ledger), or noticed (the day) — written by the model from those facts with the standing rules, never
   invented, never about a private person; the stop word silences it like the rest. Also offered as a Bluesky draft when
   he has linked it ("post that?" → the queue).

## The lines that hold

Posting only with his APPROVE, every time, everywhere; reading only public feeds and his own timelines; no DMs to anyone;
nothing about a private person; no follows without approval; keys in the vault, never in the repo or the docs; nothing
that bills; the plain prompt ≤ 5,500 on every dial (trim exactly, list every trim); no test skipped or weakened; the guard
job untouched; no model names anywhere; every new thing has its catalogue entry; no fixed name for him anywhere.

## Tests

`social.test.mjs` with fakes for each API (AT Protocol createSession/refresh/createRecord/getTimeline/searchPosts;
Mastodon statuses and timelines; Discord's signature check with a known Ed25519 vector and the interaction reply; the
Telegram channel post): the queue (draft → approve → sent once; expiry; NO; EDIT), write actions refused for jobs, the
digest's Bluesky feed in the LEAD tier, the musing job under the cadence (counted, held at night, silenced by a stop word),
the origin page's facts from the constants, the prompt test for the group's on and off states. `tests/social.spec.mjs` on
your preview (the APIs stubbed in the preview brain as other integrations are): LINKS → BLUESKY shows the key steps and
accepts an app password; a draft card with APPROVE · EDIT · NO; APPROVE sends once (the stub records it) and WHY lists it;
"what's on Bluesky?" answers from a stubbed timeline; the FATHER AND THE ORIGIN page from Settings and the Me sheet; a
musing card on the clock stub; nothing sideways at 390 × 844; VoiceOver labels.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration. Validation: brain typecheck +
suite; web typecheck + build; on one fresh preview: websites, apps, abilities, social, deck, nav, brief, character.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files; validation numbers; every prompt trim (before/after) and the
plain prompt's size on the worst dial; LIMITS; DESIGN PICKS THE OWNER MAY CHANGE; NEEDS HIS WORDS OR KEYS (the accounts he
makes, step by step in plain words for the final message to him); WHAT THE MERGE MUST KNOW.
