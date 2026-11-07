# BRIEF: HIS VOICE KNOWN — a courtesy signal, never a lock (awareness PR C)

STATUS item 3, PR C (STARS 154 HIS VOICE KNOWN as revised 5 Nov, and 155 WHO IS SPEAKING, SAID; the owner's rules in
OWNER-ISSUES 131 (7): "his voice is a courtesy signal, never a lock: a phone speaker model misfires a few times in a hundred
and a recording defeats it, so he knows it is you, is wary when it is not, and the confirm tap stays the gate for guarded
actions (locks, sending, posting, keys); another person's voice is introduced only with them present, saying yes aloud, and
is deletable by name; nothing of it leaves the phone"). Read STANDARD.md first, then FACTS-AWARENESS.md section 6 (voice today:
no voiceprint code exists; the confirm-tap gates; the face store as the on-phone biometrics pattern; the download-on-tap
pattern), then MAP.md's voice rows, then apps/web/src/assistant/voice.ts and session.ts (how a spoken turn is captured and
sent), apps/web/src/vision/facestore.ts and facemath.ts (the pattern to copy: numbers only, IndexedDB, never sent, excluded from
the backup, forget with UNDO), apps/edge/src/prompt.ts (`contextLines`, the SPOKEN line) and apps/edge/test/prompt.test.mjs
(the guard: 5,500 on every dial and channel; never raised; an addition trims exactly where the prompt already trims). The mid
tier. PR A and PR B are on the branch you start from.

## What is fixed

1. NO NEW MODEL. A speaker model would be a new download and a licence question; this PR builds the voiceprint from the
   phone's own audio features with no model: log-mel band energies and pitch over the enrolment, summarised as a small
   per-voice profile (means and spreads; a few hundred numbers), compared by a distance with a floor and a ceiling tuned on
   the enrolment itself (say the numbers and how they were chosen). It is HONEST about its strength: a courtesy signal. It
   fails closed: "not sure" is treated as "a voice I don't know". A real speaker model, as a download on his tap with its
   size said, is written into STARS as the gap this leaves (number it), not built here.
2. ENROLMENT, HIS OWN: Settings → Voice & home → MY VOICE: he reads three short sentences shown on screen (his own words
   from the app's voice, not a stranger's text), the phone listens through the same capture `listen()` uses, the profile is
   kept in IndexedDB beside the faces (numbers only; never sent; excluded from the backup; DELETE MY VOICE with UNDO). The
   screen says what it is for and what it is not ("I'll know it's you. It never unlocks anything: the confirm tap still does").
3. THE SIGNAL, SHOWN AND USED ON THE PHONE: on every spoken turn the phone scores the capture against the profiles it has and
   shows a tag on the talk bar in the Machine's marks (ui/machine.ts `tag`): YOU · <NAME> (a person he introduced) · A VOICE I
   DON'T KNOW · (nothing when no voice is enrolled). The tag is said in the turn's `heard`-style note only as a label (owner /
   name / unknown), never the numbers. WARY WHEN IT IS NOT HIM: with an unknown voice the phone holds the turn and asks on
   the bar "A voice I don't know. Go on?" with GO ON (a tap) and NOT NOW; GO ON sends it; a tap on the tag "It's fine for
   an hour" stops the asking for an hour (said, and kept across the hour only). The confirm-tap gates (the approval cards,
   the house's guarded set, posting, keys) are UNTOUCHED: his voice never opens them and an unknown voice changes nothing
   there, because they already need a tap.
4. WHO IS SPEAKING, SAID (155): the brain is told the label through the context it already receives (`ClientContext.voice`
   becomes `'owner' | 'unknown' | { name }` beside today's boolean, read in prompt.ts `contextLines` only: one short line,
   "Voice: yours" / "Voice: Sam, whom you introduced" / "Voice: one you don't know: say nothing private, ask who it is";
   within the guard, trimmed where the prompt already trims; the test prints the worst case). So with two people in the
   room he addresses each by name when he knows them, and says nothing private to a voice he does not know until the owner
   says so (the GO ON tap IS the owner saying so for that turn; the hour's grace likewise). agent.ts is PROTECTED and not
   touched: the label rides in the context the brain already passes whole to prompt.ts.
5. INTRODUCING SOMEONE: Settings → Voice & home → PEOPLE I'VE INTRODUCED → ADD: only with them present: the screen says
   "Ask them to say 'yes' when I ask", Ghosty asks aloud "<Name>, is it all right if I learn your voice? Say yes", the yes
   is heard (any yes-like word through the same capture), then they read the three sentences; stored like his, deletable by
   name with UNDO; never used to identify anyone who was not introduced; a voice that matches no profile is "a voice I don't
   know", never a guess at a name. At most 10 people (say why).
6. THE SPEED HABIT: the score is ready within 300 ms of the capture ending (measured in the spec on the fake microphone);
   enrolment under 20 s of his time; the WORKING / DEGRADED / OFFLINE mark on the MY VOICE screen (WORKING with a profile,
   DEGRADED "no voice enrolled yet" with ENROL, OFFLINE irrelevant: it never needs the network, say so).

## What must not change

The prompt guard (5,500 / 14,000; the new line trims exactly where the prompt trims and the test proves the worst case ≤
5,500 on every dial and channel); the CI guard job; check.yml gains at most one word (`voiceknown`) after `awareness` in
the `all=` list if a new spec is truly needed (prefer extending tests/voice.spec.mjs); agent.ts and every protected file
untouched; no packages, no new models, nothing from the network, no new keys; never a model name; never live GPS; nothing of
a voice leaves the phone (the STT path that already sends audio to /api/stt for words is unchanged and is not the voiceprint);
the boundary: no stranger identified, no voice used as a lock, the confirm tap the gate.

## Tests (each fails on the old code; run them against the old code once and say so)

apps/edge/test/voiceknown.test.mjs (imported from the end of speech.test.mjs; the feature math built into the brain's test
bundle the way vision/*.ts are): two synthetic voices (different pitch and spectral tilt) enrol and are told apart, a third
is "unknown", noise is "unknown", the floor and ceiling as chosen, "not sure" fails closed; prompt.test's dial budget with
the voice line on every channel ≤ 5,500, the worst case printed; the context line never carries numbers. tests/voice.spec.mjs
extended (Chromium's fake microphone with `--use-file-for-fake-audio-capture` and WAV files the spec writes: two synthetic
voices): enrolment in under 20 s, the YOU tag on his turn, the unknown tag and the GO ON hold on the other voice, the hour's
grace, DELETE MY VOICE with UNDO, nothing in localStorage or the backup, the score within 300 ms, every control 44 pt and
named at 440 and 390.

## Validation before the PR (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

web typecheck and build, the brain bundle (regenerate it from apps/edge/package.json's test script in YOUR worktree and keep
your own copy of the script in the scratchpad under your own name), the brain tests voiceknown, speech, prompt, context,
catalogue, abilities; then the specs voice, talk (ALONE, never beside another), settings, awareness, deck, tabs; look at
the screenshots.

## The owner's phone check (write it into OWNER-ISSUES with the build record, with context in every line)

(1) Settings → Voice & home → MY VOICE → ENROL: read the three sentences; WORKING. (2) Say anything to Ghosty: YOU on the
bar. (3) Have someone else say something: A VOICE I DON'T KNOW and "Go on?"; tap GO ON: it answers, and says nothing
private; tap the tag "It's fine for an hour": no more asking. (4) PEOPLE I'VE INTRODUCED → ADD with them present: Ghosty
asks them to say yes, they read the sentences; their name on the bar when they speak; Ghosty uses their name. (5) Play a
recording of your own voice from another phone: it may say YOU; try to open the house's guarded thing by voice: it still
needs your tap (the point of the rule). (6) DELETE MY VOICE, then UNDO. (7) Airplane mode: everything above still works.

## Size

A day on the mid tier; one PR. Questions for the owner with their context in the question itself, recommendation first.
