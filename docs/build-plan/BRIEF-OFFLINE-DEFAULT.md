# BRIEF-OFFLINE-DEFAULT — the brain on his phone used by default for what it has passed (batch ⑥ part 2, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after the commit that adds this brief; never reset to
FETCH_HEAD or origin, only to the local branch). Your preview port: 8688. Read first: ROADMAP row ⑥ ("then it is used by
default for everything it can do; then smarter every week until the cloud is rarely needed") and the upwards table's offline
row ("Used by default, no toggle"); OWNER-ISSUES 78 (the independence meter, SOVEREIGN MODE, the one honest ceiling), 72
(FAIL CLOSED: the on-phone choice binds to the task, survives retries and the router's fallback, never falls open to the
cloud; the marker test), 100 (batch ⑥ part 1 as built: the floor SmolLM2 360M, the chain, the crash records, the 600-token
sitting prompt), 50 (never talk like an AI), 9 and 12 (what the library and the schooling are FOR). The code: `apps/web/src/
offline/*` (brain.ts: the store, the chain, `answerOffline`, `offlineReady`, `mayUse`; prompt.ts: the phone's own prompt and
`shouldFallBack`; models.ts; think.ts and harder.ts: THINK HARDER; trained.ts: the trained weeks), `apps/web/src/assistant/
session.ts` (where a turn picks the phone or the cloud today: the `offline` rescue path and the "always" setting), `apps/
web/src/features/settings/offline.ts` (SETTINGS → OFFLINE BRAIN as built), `apps/web/src/features/system/independence.ts`
(what exists of the meter: build on it, never a second one), `apps/edge/src/school/*` (the report card: grades per subject
per brain from the held-out tests; `state.ts`, `mark.ts`, `night.ts`), `apps/edge/src/selftrain/*` (the weekly training),
`apps/edge/src/llm/router.ts` (the cloud router's fallback), `apps/web/src/assistant/local.ts` (the model-free asks, which
never need either brain). Other builders run in parallel: touch nothing under `features/people|work|creative|outside|
homeadmin|learning/`, `wiki/`, `morse/`, `coach/`, `demo/`, `build/`, `house/`, `lens/`, `hands/`, `tv/`, `arcade/`,
`social/`, `convert/`, `docs/`. Yours: `apps/web/src/offline/trust.ts` (new) + hooks in `offline/brain.ts`, `assistant/
session.ts` and `features/settings/offline.ts`, `features/system/independence.ts`, `apps/edge/src/school/trust.ts` (new: the
grades → the trust table, served to the phone) + its route, `packages/shared/src/catalogue/offline2.ts` (joined where the
catalogue files are), `apps/edge/test/offline2.test.mjs`, `tests/offline2.spec.mjs`, the smoke loop's list (`offline2` after
`sit`), `apps/edge/package.json`'s test list, a CSS block at the END of styles.css. The CLOUD's plain prompt is at exactly
5,500 on its worst dial: add nothing to it; the phone's own prompt (offline/prompt.ts) is yours to change within its 600 tokens.

## 1. TRUST BY GRADE (the router)

Today the phone's brain answers when the cloud cannot be reached, or always when he set "always" (fail-closed). Make it the
DEFAULT for what it has PASSED, honestly: the report card already grades each brain per subject on held-out tests; from it
(and from the categories below) build a TRUST TABLE per sitting brain — for each category of ask, the grade and whether the
phone's brain is trusted (the bar: 80 per cent on at least twenty held-out items, a dial in SETTINGS → OFFLINE BRAIN → TRUST
with the plain words "above this grade I answer on your phone first"). The categories, decided on the phone by code from the
words (no model): small talk and greetings; rewording, shortening or fixing the grammar of text he gives; summarising text he
gives; translating a sentence (the eight languages the sitting brain's grade covers); simple arithmetic and unit sums (the
local solvers first anyway); facts from his own memory and the Library on this device (retrieval, the model only to phrase);
the reading-check questions; spelling; the day's agenda read back; everything else is the cloud's (search, tools, long
reasoning, anything that acts). When a brain sits on the phone, WebGPU works and the category is trusted, the phone answers
FIRST, tagged "on this phone" in the chat's model line; every local answer carries ASK THE CLOUD (one tap: the cloud answers
the same ask, the local answer stays above it struck faintly), and that tap counts as a miss for the category: three misses in
a week drop the category below the bar for that brain until the next report card. Nothing acts from the phone's brain (no
tool calls: it has none); a category whose words touch a tool (a time, a place, "remind", "send", "search") is never local.
The "always" setting stays exactly as built (72: fail-closed, the marker test — if the suite has no such test yet, add it:
a fictional statement with a distinctive marker, the on-phone route forced, the local model unavailable, the task stops with
an explanation and the marker never reaches any cloud address). The rescue path (the cloud unreachable) stays.

## 2. THE INDEPENDENCE METER (SYSTEM → INDEPENDENCE; "how independent are you?")

Build on `features/system/independence.ts`: the share of his real asks in the last seven and thirty days handled fully on his
own brains with no cloud, per category and overall, counted on the phone from the chat's own records (the `offline` flag and
the model line; the model-free local asks count as his own too), the trend line week by week (a sparkline drawn by code), the
categories still the cloud's and why (no brain sits; below the bar; needs a tool), and SOVEREIGN MODE as the plain name for
"always" with its truth: "the cloud is off-limits; what I can't do here, I say I can't". One weekly line in the Brief ("This
week 61 per cent of what you asked stayed on your phone, up from 48") when a brain sits. The honest ceiling, said once on the
sheet in his words from OWNER-ISSUES 78: a phone alone will not match the biggest cloud brains on the hardest new reasoning.

## 3. SMARTER EVERY WEEK (the hook, not new training)

When a trained week (trained.ts) sits in place of the stock brain, its report-card grades decide its trust table like any
other; the meter shows the week it came from; nothing else in the training changes. SETTINGS → OFFLINE BRAIN → TRUST shows
the table (category, grade, items, trusted or not, and why), and WHICH BRAIN says in one line what each brain here is trusted
with ("SmolLM2 360M: greetings and spelling"; "Qwen2.5 0.5B: + rewording, summaries").

## The lines that hold

Never fall open (72): a private or sovereign task stops with words, never routes to the cloud by itself; the floor's weakness
said plainly where it matters (the report card's grades are the words); nothing bills; the cloud's plain prompt untouched; no
test skipped or weakened; the guard job untouched; no model names anywhere (the brains are named by their own names as the
code already does); every new thing has its catalogue entry.

## Tests

`offline2.test.mjs`: the categoriser on fifty asks (each category and the tool-touching exclusions), the trust table from a
grade fixture (the bar, the twenty-item floor, the misses rule), the meter's counts from a chat fixture, the fail-closed marker
test. `tests/offline2.spec.mjs` on your preview with the stand-in brain the sit spec uses: a trusted ask answered "on this
phone", ASK THE CLOUD, an untrusted ask going to the cloud, the TRUST table in settings, the INDEPENDENCE sheet with its
sparkline, sovereign mode's refusal line, nothing sideways at 390 × 844, VoiceOver labels.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration. Validation: brain typecheck +
suite; web typecheck + build; on one fresh preview: websites, apps, sit, bigbrain, offline2, deck, nav.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files; validation numbers; the categories and the bar; LIMITS; DESIGN PICKS
THE OWNER MAY CHANGE; NEEDS HIS PHONE (a brain sitting; his taps); WHAT THE MERGE MUST KNOW.
