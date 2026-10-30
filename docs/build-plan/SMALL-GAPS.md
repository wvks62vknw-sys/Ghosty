# SMALL GAPS — the hundred tiny moments where Ghosty must feel like the Machine, not an app

The owner (26 Oct): *"we're missing a lot of small gaps which matter a lot … there's hundreds of small
gaps like that."* He's right, and this is where "superior" actually lives — not in a grand feature, but in
the tiny moments where a normal app is clumsy and Ghosty isn't.

## What this list is, and how it grows

A living catalogue so none of these is forgotten (the same principle as the Abilities tab in OWNER-ISSUES 68:
if it isn't written down, it's lost). It is **not** a one-time brainstorm of 300 guesses — that would be
padding. The hundreds get caught three ways, continuously:

1. **By family, not one at a time.** Almost every small gap we've actually hit is an instance of one of the
   families below. Each family gets ONE fix — a shared rule + a helper + a test or lint that fails when a new
   instance appears — so fixing the family kills every current instance and stops new ones being born. This is
   the credit-efficient way to attack hundreds of gaps: batches, not a long tail of one-liners.
2. **By a per-surface polish pass, inside every build.** Polish is not bolted on at the end. Every surface we
   build or touch gets a final "walk it like Harold would" pass against this list before it ships.
3. **By the app feeding itself.** Ghosty already has 👍/👎 on replies (it feeds the nightly rewrite/training —
   `selftrain/`). Extend it: a one-tap "that felt off" on any moment, and the owner just telling him "that was
   clumsy", drops the moment into this list **with context** (which screen, what he'd just done, what was on
   it). That is how we actually reach the hundreds — from his real use, effortlessly — not from me guessing.

Honest note (holds from OWNER-ISSUES 66, 74, 75): most of these are small by design and are fixed *while
building the surface they live on*. They wait for the weekly reset with everything else. Nothing here builds
until all-models (95%) resets.

---

## The families (each = one fix that catches dozens)

Legend: **Rule** = the standing law · **Seen** = real instances we've already hit · **Guard** = how a new
instance gets caught automatically.

### A. He never breaks character
- **Rule:** no raw browser/technical string ever reaches the owner — not in a reply, a toast, a card, or the
  voice. Every failure is said as *him*, in few words, with what it means and what to do. "The operation was
  aborted", "fetch failed", "undefined", "[object Object]", a stack trace: none of these are English he'd ever
  say.
- **Seen:** the stop bug (OWNER-ISSUES 54) printed the browser's "The operation was aborted." as a reply — the
  exact shape of this whole family. There are more of these hiding behind every `catch`.
- **Guard:** one `sayError(e)` funnel that maps any thrown thing to his-voice copy; a lint that flags a raw
  `e.message`/`String(e)` rendered to the UI or spoken; the mock provider already proves copy in tests.

### B. The result always reaches him where he is
- **Rule:** the outcome of an action lands in **all** the places he might be — the words he reads, the words
  he hears, and the card — never just one. A link, a file, a built app, a booked thing: if he asked by voice,
  he hears it; if he's on Home, he sees it.
- **Seen:** `build_app` gave the link card but not the spoken/Home words (OWNER-ISSUES 54, `[links]` fix).
  Same risk for every future tool that produces a thing.
- **Guard:** tools declare their deliverable once; a shared "deliver" step puts it in reply + voice + card;
  a test asserts a tool's artifact appears in the spoken text, not only the card.

### C. Nothing gives up a beat early
- **Rule:** when success is seconds away, wait the seconds. Smart retry, not instant failure on the edge of
  working.
- **Seen:** "thinks for ages then says no free models when one comes up in 0 seconds" (OWNER-ISSUES 64) — the
  router throws while a free model is within the chat wait. The whole conversational pass starts here.
- **Guard:** the wait/retry policy lives in one place with the deadline; a test with a model that frees up at
  T−1s asserts he waits and answers, never fails.

### D. State survives
- **Rule:** nothing re-downloads, re-asks, re-logs-in, or forgets across opens that it shouldn't. Long work
  resumes exactly where it stopped. A crash is remembered so the next open is safe, not a blind retry into the
  same wall.
- **Seen:** the offline brain re-downloading every open (service worker wiping WebLLM's caches, OWNER-ISSUES
  47); the big-brain crash + blind retry (44, 47); a paper that must resume after a crash (57c, still live).
- **Guard:** a "survives a reload" test per persisted thing; a crash-record checked before any auto-retry.

### E. Everything meets him at full strength
- **Rule:** no feature quietly serves its weakest self by default. If he engages it, it's as good as it gets
  unless he chose otherwise.
- **Seen:** PLAY HIM met a barely-trained net so a trick won every time (OWNER-ISSUES 52). The fix made it
  full-strength always — but the *principle* applies everywhere (a draft, a plan, a search, a solver).
- **Guard:** default to the strongest free path a surface has; a review question on every surface — "what's
  the weakest version of this a user can accidentally get, and why can they?"

### F. Length and register match him
- **Rule:** short when he's short. A line, not a paragraph, unless the thing needs a paragraph. Never the AI
  cadence ("Certainly! Here are three things…"). His length, his bluntness, his tempo.
- **Seen:** "not everything has to be paragraphs" / "doesn't have to talk like an ai" (OWNER-ISSUES 64).
- **Guard:** reply-length shaped by the owner's recent message lengths; the AI-sounding detector already in
  `selftrain/` runs on live replies, not just training.

### G. Heavy surfaces shed load
- **Rule:** when something big runs (sitting a paper, loading a 2B brain, the wind tunnel), the non-essential
  heavy things step aside — Mind's WebGL eases, the GYM worker pauses — so the tab never dies.
- **Seen:** the school-test crash (OWNER-ISSUES 57c, live); the brain-load crashes (44).
- **Guard:** one "heavy mode" the big tasks enter; a memory-budget check before a big load; test the pause.

### H. Confirm the irreversible, stay silent on the trivial
- **Rule:** a beat before anything that can't be undone (a wipe, a send that costs nothing but can't be
  recalled, a delete) — and **no** "are you sure?" friction on the things that don't matter. Undo over confirm
  wherever undo is possible.
- **Seen:** backup/restore reloads immediately (`features/system/backup.ts`); the export/wipe-in-one-tap trust
  model (OWNER-ISSUES 71). Needs the confirm/undo line drawn consistently.
- **Guard:** one `confirmDestructive()` / `withUndo()` pair; a list of irreversible actions that must route
  through it.

### I. Time and continuity are always right
- **Rule:** never a raw timestamp where a human word belongs ("yesterday", "2 days ago", "just now"). He picks
  up where you left off. He knows it's late, knows it's the third time you've asked, knows it's been three
  days. (`fmt.ago` exists and is used well — hold the bar everywhere.)
- **Seen:** the day-line reading the wrong separator in chat (routec fix); the Agenda remembering the last pill
  (safari fix) — both continuity-of-context gaps.
- **Guard:** a `humanTime()` used everywhere a time is shown; session resume carries the last thread + mood.

### J. Latency honesty
- **Rule:** instant things feel instant; slow things say *why* and show progress; nothing is ever a frozen
  nothing. If he's waiting, he knows what for and roughly how long.
- **Seen:** the "thinks for ages" silence (C); big downloads that need a moving bar (D/44).
- **Guard:** any await over ~400ms shows his-voice progress; a loading state is required, not optional.

### K. Warmth in the dead moments
- **Rule:** empty states, waits, errors and first-runs carry his character, never a blank or a shrug. (The
  code already does this well — `ui/components.ts`, the `NONE YET` copy, the launcher's "Press return and
  Ghosty will answer it." Keep that bar on every new surface.)
- **Seen:** good today — this family is about *not regressing* as we add surfaces.
- **Guard:** the shared empty/error/loading component is the only way to render those states; a lint flags a
  bare empty `<div>` where a state component belongs.

### L. Readable and usable in every state
- **Rule:** moods/themes readable by shape + text, not colour alone (anger isn't only "red"); big-text safe;
  spoken-first works end to end; nothing below 44px tappable. (OWNER-ISSUES 71 accessibility.)
- **Seen:** radio controls measured under 44px mid-animation (radio fix); mood = colour needs a shape/word too
  (OWNER-ISSUES 63).
- **Guard:** the existing size/contrast checks in the browser specs, extended to the mood states.

---

## Loose gaps not yet in a family

(As they're caught — from his use, the "that felt off" capture, or a sweep — they land here first, then either
join a family or become their own. Empty for now; the capture fills it.)

---

*Maintained by the orchestrator. Added as OWNER-ISSUES 76.*
