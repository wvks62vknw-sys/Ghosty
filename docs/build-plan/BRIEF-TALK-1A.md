# BRIEF-TALK-1A — talking to him: speed and presence (PLAN-STARS Pass 1a; STARS 1, 2, 9, 10, 16, 83; 2 Nov 2026)

Read STANDARD.md first: it decides when anything here is finished. Then STARS.md items 1, 2, 9, 10, 16 and 83, and the
owner's words in OWNER-ISSUES 119–121 ("every feature must blow your mind … years of work in every single little thing").
Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (check `git log -1`; if your worktree is on another base,
`git reset --hard` to that tip first and say so). Your preview port: 8622. No network beyond it.

## What this pass is

Talking to Ghosty is the whole point and today it is the weakest felt thing: a reply arrives as a block after a wait, speech
starts when the whole text is written, an interruption restarts rather than resumes, long work shows a spinner, the mic needs a
tap per turn, and the free models run dry without warning. After this pass, a conversation with him feels like a call with a
quick, present person. Six families, each measured before and after on the preview (first-word latency in ms, interruption
recovery, narration present, mic turns without taps), each with a test that catches the next regression.

## The six

1. FIRST SPOKEN WORD UNDER ONE SECOND [1]. Speak sentence by sentence as the reply streams: the first complete sentence (or
   the first 12 words, whichever comes first) goes to speech while the rest is still being written; later sentences queue
   without a gap; the text on screen stays ahead of the voice. Measure: from the owner's last word (the end of his speech or
   Enter) to the first spoken sound, on the preview with the mock brain; budget 1,000 ms including the brain's first token.
   Where the phone's own speech synthesis is used, prime it on the mic tap so the first utterance is not the slow one.
2. INTERRUPTION WITH RECOVERY [2]. Talking over him (or a tap) stops the speech within 150 ms, marks the cut on screen as today,
   and when the owner's words are a continuation ("go on", "and then?", "sorry, continue") he resumes from the sentence he was
   cut in, with a short bridge ("…as I was saying,"), not from the top. When the owner's words are a new ask, the cut reply is
   left as it is and the new ask is answered. The brain is told what was actually heard by the owner (the said part), so its
   next turn does not assume he heard the rest.
3. NARRATION, NEVER A BARE SPINNER [9]. While the brain works for more than 1.5 s, the status line and, in a voice conversation,
   a spoken aside say what he is doing in his own voice ("looking at the trains…", "reading that page…", "two options so far…")
   from the tool and progress events the brain already streams (session.ts sees them). Never a generic "thinking". The aside is
   short, once per distinct step, never over the reply itself.
4. CONVERSATION MODE [10]. One tap starts a conversation: the mic stays open between turns, the reactor breathes with his speech
   and his listening, no tap per turn, the ear re-opens the moment his reply ends (and during long waits, as the stall fix
   added), a gentle tone marks "your turn". It ends on "that's all", "bye", a tap, or two quiet turns. The chat shows the whole
   exchange as it happens. Measure: ten turns, zero taps.
5. MODEL SUPPLY MANAGED [83]. The brain's router (apps/edge/src/llm/router.ts, quota.ts) knows the counts: before a cool-down
   bites, the next model is chosen and warmed (a tiny request) so the owner never meets "cooling down" mid-conversation; when
   every reachable model is cooling, the phone says so in one sentence within two seconds, with the back-at time, and offers the
   phone's brain if warm. The status line on SYSTEM → STATUS already says "Getting busy"; the chat must never be silent about it.
   Nothing that bills: free tiers only, the owner's keys spread as today.
6. SIRI SHORTCUT TO LISTENING [16]. The existing Shortcut ("Ghosty …", features/settings/shortcuts.ts, deeplinks.ts) gets a
   `listen` command: open and start listening within a second of the app showing, mic permission already granted. iOS allows
   nothing in the background; say so plainly on the SHORTCUTS panel.

## Tests (extend; never weaken)

tests/voice.spec.mjs and tests/direct.spec.mjs are the homes; add tests/talk.spec.mjs (new, in the smoke list after `tabs`;
BASE default http://localhost:8788; assumes a used brain) for: the first spoken sound within the budget (the page's speech
engine stubbed as the voice spec does, the mock brain streaming), sentence-by-sentence queueing with no gap, an interruption
that resumes from the cut sentence with the bridge, a new ask after a cut, narration lines during a slow tool turn (the mock
has slow phrases; add one if needed), ten conversation turns with zero taps, "cooling down" said within two seconds with the
back-at time (the mock's "no model" phrase), and the Shortcut's `listen` deeplink. Keep every existing voice/direct step.
Run: both typechecks, the web build, the brain bundles, then on one preview (8622) in order: voice, direct, talk, offline2,
resta, ui, abilities; the brain's suite once under nice at the end.

## The lines that hold

Nothing that bills; no model names anywhere; the plain prompt untouched (telegramVoice exactly 5,500; if a narration phrase
needs the brain's words, use what it already streams); no test skipped or weakened; check.yml: `talk` added after `tabs`,
nothing else, the guard untouched; the kept-on-phone paths fail closed as today; a cut reply never counts as fully heard.

## Report

Base and HEAD SHAs, the worktree branch, commits, files; the six measurements before and after (first word ms, cut-to-silence
ms, resume correct, narration lines, taps per ten turns, cooling-down said within ms); every spec's result with times; LIMITS
(no real speech engine or mic in the sandbox: say exactly what the owner's phone must confirm); DESIGN PICKS THE OWNER MAY CHANGE;
NEEDS HIS PHONE (a five-minute check, exact taps); WHAT THE MERGE MUST KNOW.
