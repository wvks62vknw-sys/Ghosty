# BRIEF — THE EYES AND THE GUARDIAN (batch 5 after the 30 Oct reset; starts when PR #44 has merged)

You are building for Ghosty, the owner's personal AI (a Cloudflare Worker + Durable Object brain in `apps/edge`, a PWA in
`apps/web`, shared code in `packages/shared`). Read `docs/build-plan/HANDOFF.md` (the TOKEN BUDGET entry and the 30/31 Oct
entries) and `docs/build-plan/SMALL-GAPS.md` first. The owner's words are the spec: `docs/build-plan/OWNER-ISSUES.md` items
**55, 56** (the eyes, the guardian, the named person, the ADMIN label), the guardian and protection parts of **57, 58, 60**
("protection as the first duty"; "the guardian, a panic phrase"), and the standing rules in 55/56 on faces. This is the
batch the owner called "the Machine's eyes, the guardian" — the order he set in item 56.

## The lines that do not move (read twice)

- Ghosty uses the OWNER'S OWN data and PUBLIC feeds only. Nothing that can bill him: no SMS, no paid API. A message to
  the one named person goes by Telegram (his bot) or by the owner's own linked email (integrations/mail.ts), never a text.
- FACES: only the owner (who enrols himself, on his phone) and people he introduces IN PERSON with the camera live in the
  Lens. Never on God's Eye, CCTV, a web picture, a screenshot, a library picture, a Telegram photo or anything fetched.
  The face module's only input is a live frame from the device camera: no function in it takes a URL, a blob or a file,
  and a test asserts that. Face data lives on the phone (IndexedDB), is never sent to the brain, is left out of BACKUP &
  RESTORE, and is deletable in one tap. Nobody unknown is ever guessed by name. The Lens's NAME IT and PHOTO TOOLS keep
  their "never faces" rule.
- No prediction about any person, no violence "risk", no tracking of anyone but the owner's own position, while Ghosty is
  open, after he said yes. Threats near his places are the public warnings and the public crime counts as published:
  shown, never extrapolated.
- No edits to `apps/edge/src/prompt.ts`; never raise the 5,500 budget guard. A new tool group here is turned on by its
  words (`when:`), never `always`, so the plain turn's prompt does not change. The ABILITIES screen lists the new group by
  itself (add it to GROUP_CAT in `apps/edge/src/abilities.ts` as 'watch'; name what it needs in GROUP_NEEDS).
- Do not touch batch 2–4's files beyond what an item here needs: `persona.ts`, `mood.ts`, `intent.ts`, `theme.ts`,
  `mind.ts`, `abilities.ts` (shared), `why.ts`, `today.ts` — read them; hook into them where this brief says.

## Where things live (so you do not build what exists)

- Saved places: `apps/edge/src/places.ts` (`loadPlaces`: label, lat, lon). The one shared mind: `apps/edge/src/mind.ts`
  (`observe` for the day log; `mindSnapshot` → `today.doing` / `ahead`; the Brief's YOUR DAY reads it).
- Street crime: `apps/edge/src/tools/crime.ts` (data.police.uk). Domain look-ups incl. RDAP: `apps/edge/src/integrations/
  lookup.ts`. Email: `apps/edge/src/integrations/mail.ts`. Telegram: `apps/edge/src/telegram.ts` (`telegramNotify`).
  Notifications and jobs: `apps/edge/src/schedule.ts` (`addJob`, `addInbox`, `notify` in agent.ts). The mood: a danger
  or a scam already makes him protective (`packages/shared/src/mood.ts` DANGER/SCAM); feed it, do not redo it.
- The Lens: `apps/web/src/features/lens/` (TILES, the live camera, the detector in `apps/web/src/vision/` — boxes.ts,
  camera.ts, frame.ts; CLIP in clip.ts; the fake camera the specs use is in `tests/lens.spec.mjs`). Threats:
  `apps/web/src/features/threats/` (God's Eye and recon; nothing near home yet). The Me sheet: `apps/web/src/shell/areas.ts`.
  Settings: `apps/web/src/features/settings/`. Journeys and his position: `apps/edge/src/tools/journey.ts`, the client's
  `location` in `ClientContext` (prompt.ts) and `owner:ctx`.

## The items (build 1–5 for certain; 6 if the batch stays within reason)

1. **HIS FACE: "it's you" (55; the ADMIN label of 56).** In the Lens a tile ME (or inside a PEOPLE mode, your call):
   ENROL takes three to five looks from the front camera, keeps face embeddings in IndexedDB on this phone only, and says
   plainly that this is where they stay and that Ghosty only sees while he is open. From then on, with that mode open and
   him in frame: a thin WHITE box with the label ADMIN (the homage he asked for — his, nobody else's) and "It's you." once
   per session; "is this you?" / "who am I?" answered in a word. Below certainty: "I think it's you." Re-enrol and DELETE in
   Settings → PRIVACY (a new panel, or where the Lens's own settings are): one tap, with UNDO like everything else. Model:
   a free on-device face detector + embedding (your pick; name the licence in the report; small — about 10 MB or less,
   cached like the other vision models, downloaded on first use with the same consent as those), running in WASM or WebGPU
   in Safari. Tests: the match maths with fixtures (same person two looks → match; two people → no match; the threshold);
   the API-surface test above; a spec that enrols from the fake camera and sees the box and the words.
2. **PEOPLE HE INTRODUCES (56).** With a face in frame in that mode, "Ghosty, this is Sam" (typed or spoken; the chat's
   stop/raising readings must not swallow it) → remembered on the phone (name + embeddings), listed in Settings → PRIVACY →
   FACES with × each and a count. Next time, in the Lens only: a thin box with "Sam", or "I think it's Sam" below certainty;
   "who's this?" answered from the list, else "I don't know them: introduce us." The brain never receives a face; if the
   owner wants Ghosty to remember that Sam exists, that is the ordinary `remember` fact in words (do not add it yourself).
3. **THREATS NEAR HIS PLACES (55; the Threats pass's leftover).** In the brain, a job every hour within free limits (schedule.ts):
   Environment Agency flood warnings (the public flood-monitoring API, no key), the Met Office National Severe Weather
   Warnings (its public feed, no key; by region), and street crime from the existing crime tool (monthly data; the public
   counts and categories only), each within a sensible radius of every saved place. A NEW warning that touches a place →
   one notification and one Telegram line (never the same warning twice; expiry honoured; the all-clear said once when it
   lifts), a line in the one mind (`observe` + `today.doing`/`ahead` so the Brief's YOUR DAY and the chat know), and a
   THREATS tab card NEAR HOME (one row per place: what is active, from which source, since when; "nothing active" in his
   voice). A tool group `guardian` (on by words: flood, warning, storm, crime near, is it safe) so he can ask. Tests with
   recorded fixtures of each feed (never the live feed in the suite); a spec for the card and the notification path.
4. **A SCAM OR A LINK, CHECKED (55).** "is this legit?", "is this a scam?", a forwarded text or a link, in chat or on
   Telegram → a real check with public sources and no keys: the domain's age and registrar via RDAP (lookup.ts), a
   lookalike check against the brands scammers use (the bank, HMRC, Royal Mail, DPD, Evri, Amazon, PayPal — homographs,
   extra words, odd TLDs), URLhaus's public API for known-bad URLs, the shape of the message (urgency, a fee to release a
   parcel, a link to "verify"). The verdict in plain words with its reasons, and never "safe" as a promise: "I can't find
   anything wrong with it — that isn't proof; don't type a password into it." This becomes the `check_link` tool in the
   guardian group; the mood's protective turn already fires on his words. Tests: fixtures for a known scam, a lookalike, a
   clean domain, an unreachable RDAP.
5. **WALK ME HOME (55, 56; the panic phrase of 60).** "walk me home" (chat, voice, Telegram) → Ghosty takes the journey
   time to the saved place from where he is (journey.ts; or asks "how long?"), then watches: his position while Ghosty is
   open (watchPosition, only after he said yes once, kept on the phone and sent to the brain only as the last known position
   for this walk), at the ETA "Home?" on the phone and on Telegram; a tap, "yes" or "home" ends it ("Good. Night."). No
   answer after ten minutes → asked again, spoken; after five more → the ONE NAMED PERSON is messaged by Telegram (if
   they use his bot) or by his own linked email: who, that he set off at HH:MM for home and has not answered, and the last
   known position only if he opted in at set-up. The named person is set once in Settings → GUARDIAN (name; a Telegram
   handle or an email; the opt-in for position), with a test message button. A PANIC PHRASE he chooses in the same panel
   (never a word he says by accident; typed or spoken) → the message goes at once with the position. The brain runs the
   clock (a job), so the check-in fires even if the phone sleeps; the honest limit (position only while open) is said in
   the panel and at the start of each walk. Tests: the timeline with a fake clock (ETA, the two nudges, the message, "home"
   ending it, the panic phrase), the message's words (no position unless opted in), nothing sent twice.
6. **THE GUARDIAN CARD (the presence of 55/58).** On the Me sheet (or the Threats tab, your call): WATCHING OVER YOU — the
   places watched, the three feeds and when each was last checked, the named person, a walk under way, in his voice ("I'm
   watching Kings Heath and Edgbaston. Nothing active. Last look 14:05.").

Not in this batch (later): the legacy/contingency plan (66.6), Health data via Shortcuts (73.3), his own devices (66.4),
social accounts (56), voice recognition of his circle (60).

## How you work

- Commit per item; never push or open a pull request; one preview on port 8855 only (`node tests/preview-server.mjs 8855 &`
  and `BASE=http://localhost:8855 node tests/<spec>.spec.mjs tests/.shots`); add each new spec to the loop in
  `.github/workflows/check.yml` with a sensible timeout. Validate on your FINAL tree: both typechecks, the full brain suite,
  the web build, every spec you added or touched plus `lens`, `threats`, `settings`, `nav`, `routec`, `abilities` and
  `onphone` (a face must never leave the phone: the marker method in onphone.spec is how to prove it). Report in the shape
  of the batch-4 report: branch and base, commits, files, validation spec by spec, per item what was built and how it is
  verified, limits stated plainly, design picks the owner may change, what needs his phone or words, anything not done
  with notes for a cheaper model, and what the merge must know. No model names anywhere but the Co-Authored-By line.
