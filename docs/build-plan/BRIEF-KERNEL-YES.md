# BRIEF: THE KERNEL BATCH — the six calls he said yes to (OWNER-ISSUES 169, 170, 172, 173)

His words, 11 Nov, "yes to all" (173), to the six calls the speed, SHOW ME and games builders left in protected files. His word is the
licence for exactly these files and these changes and nothing else protected: `apps/edge/src/agent.ts` (items 1, 2, 4),
`apps/edge/src/kernel/vault.ts` (item 3), `apps/edge/package.json` (item 6, one line). The router, the protocol and the interface files
are not protected. The mid tier. Sources of the exact changes: speed-report.md, showme-report.md and games-report.md, "NEEDS HIS WORD".

## What is fixed

1. **THE TURN'S READS GO TOGETHER (agent.ts `loop()`).** Before the first step: github, recall, principles, lessons and mood are
   read side by side (`Promise.all`); `mindSnapshot` follows as now. Inside a step: memory, profile and inbox are read side by side.
   Same values, same order of use; each `.catch` it had it keeps. Proof: a brain test on a store that charges 1 ms a call: the hello
   turn's first word comes sooner (the speed builder measured about 45 ms down to about 25 ms).
2. **REPLIES STREAM FROM THE FIRST WORD.** `Router.complete` gains `onDelta(text, restart?)`, which forwards the provider's stream
   chunks (the chat-completions transports; the binding answers whole and sends none). The first chunk is the stopwatch's first word.
   agent.ts passes it on a chat step and emits `{ t: 'text', text, part: true }` (the protocol's one change: an optional `part` on
   the `text` member; a `text` without `part` is the whole reply and replaces what was drawn). On a reply with no tool calls the
   persona polish runs PER SENTENCE: a sentence is polished when its end punctuation arrives and is emitted then; the final whole
   `text` is the router's polish of the whole reply, as today. A reply that turns out to use tools keeps the whole-reply path (what
   was streamed is taken back by an empty whole `text`). Code fences and list lines stop the streaming (the whole reply then lands
   at the end). The prompt guard is untouched. The interface draws deltas as they arrive and the whole text, when it lands, sets the
   bubble's words and is the one that is spoken and kept.
3. **KEYS DECRYPTED ONCE PER ISOLATE (vault.ts).** The decrypted provider keys are kept in a cache shared by every `Vault` over the
   same storage in the isolate, cleared on `set` (a save, a removal, a rotation). Test: two reads, one decrypt; a `set`, then one
   more decrypt.
4. **THE BRAIN CHOOSES THE PICTURE.** One emit in agent.ts, `{ t: 'show', kind, data }` (kinds: place, route, numbers, document,
   formula, part), when the reply or a tool result makes the kind plain (a place a tool returned, a route, six figures the reply
   wrote, a letter, a formula, a part with sizes); never GPS, never a guess about a person. The interface's `decide.ts` prefers the
   brain's `show` when one arrives for the turn; its own reading stays as the fallback. showme.spec gains the case.
5. **A SHOW ME ROW IN SETTINGS.** One boolean `showMe` in settings (default on), read by `mayShow`: off means no Stage ever. A row
   in Settings (the plate of THE LOOK) switches it. showme.spec gains the case.
6. **`test/games4.test.mjs` at the end of the brain's node test list in apps/edge/package.json**, and nothing else in that file.

## What must not change

The prompt guard (prompt.test's ceilings); `apps/edge/src/index.ts`, `tools/{index,types,repo}.ts`, `.github/*`,
`apps/web/package.json` untouched; no new spec word (the cases go into showme.spec and the brain tests); no packages, no new keys,
nothing that can cost money; the brain never gets live GPS; never a vendor's model name; knowledge.test's placeholder rule; the
ratchet's ceiling (hex 506, rgba 1016, radiusPx 470, total 1992) if styles.css is touched; no test skipped or loosened. A reply
streamed or not reads the same once it has landed; a provider that does not stream behaves exactly as today.

## Tests (each fails on the code before this brief)

1. kernel-yes.test (brain): the hello turn at 1 ms a store call is first-word faster than the serial prelude's floor, and the reads
   are issued together (a call log shows them overlapping).
2. kernel-yes.test: a fake provider streaming three sentences 100 ms apart: the first `text` event comes before the second sentence
   is sent; the events are `part` deltas; the final `text` equals the polished whole; a reply with a tool call streams nothing that
   stays; a provider that answers plain JSON still works.
3. vault.test: two calls one decrypt; set then one more decrypt.
4. kernel-yes.test: a tool result naming a place makes a `show` event of kind place; a plain greeting makes none.
5. showme.spec: a scripted brain sends `show`, the Stage draws that kind (not what the interface would have guessed).
6. showme.spec: the SHOW ME switch off: no Stage for a reply that would have had one; on again: it comes back.
7. The brain's list holds games4.

## Validation (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

Six commits, one each, after this brief's own. `cd apps/web && npx tsc --noEmit -p . && node build.mjs`; the brain's `npm run
typecheck`; the whole brain test run (`cd apps/edge && npm test`, in the background, its log read); the preview on port 8804 only;
every spec that drives the chat, the Machine, speed or settings one at a time (`BASE=http://localhost:8804 NO_GL_SHOTS=1 timeout
480 node tests/<name>.spec.mjs tests/.shots`), the last line of each into kernel-report.md; a timing budget missed under load is run
again alone before it is called red. The known sandbox reds (direct, aim, radio, scroll, safari, eye's screenshot, tabs2) are said as such.

## The owner's phone check

(1) Say hello: the words arrive as they are spoken, a sentence at a time, not all at once at the end. (2) Ask for two lookups ("what
reminders and calendars have I got, any new mail"): the answer still comes after the slowest and reads whole and in his voice, with no
double text. (3) Ask "where is Lisbon": the sentence, then the picture the brain itself chose (it may differ from the phone's own
guess). (4) Settings, THE LOOK: SHOW ME, off: no picture under any reply; on: they return. (5) Nothing else should look or behave
differently: if it does, say what.

## Report

kernel-report.md in the scratchpad: every commit's hash and one line; each of the six with its proof; each spec's last line verbatim and
its verdict; what was not run or not done and why; the owner's phone check. Never push.
