# NEXT ROUND: VOICE, MEANINGS AND COLOURS (lane-voice, 14 November 2026)

This lane leads the big move **Talk to it your own way**. Branch: `claude/new-session-4erjve-lane-voice`. Spec word: `voicelane`
(already in check.yml). Brain tests: `apps/edge/test/meanings.test.mjs` (run from intent.test.mjs) and `apps/edge/test/voiceknown.test.mjs`.

## What I built

### Ghosty learns your own words (voice.u1)
- Say something your own way. If nothing on the phone knows it, it goes to my brain as usual.
- If you then tap the screen you meant within half a minute, a small bar asks: "Next time you say “money stuff”, open Money?"
  - **REMEMBER IT** keeps the wording. From then on those words open that screen at once, before anything else reads them.
  - **NO** is remembered too, so the same words are never offered again.
- What it never learns:
  - an ask that sends, pays, posts, deletes, reminds or calls;
  - a bare "yes", "no" or number;
  - anything the brain did by itself (if the brain opened the screen, there's nothing to learn).
- "My wordings" lists them, each with **FORGET**; "forget the wording money stuff" forgets one.
- Kept on this phone only.

### Every screen answers many wordings (voice.u2)
- All 48 screens open from their everyday names after any common verb: "bring up the game maker", "open the translator", "show me my
  portfolio", "pull up the room planner", "open the themes".
- A screen that shares its name with a real place (school, work, the gym, the library, the bank, the kitchen, home) opens only with a
  screen's verb ("open the gym") or the word "screen/page/app". So "take me to school" or "go to work" stays a trip for the brain.
- Built in from other lanes:
  - **Paint by voice (make.c6):** "how much paint for my lounge" opens SPACE on MATERIALS (first estimates).
  - **Cameras on a road (see.c6):** "cameras on the M6" goes to the brain with its meaning noted.
  - **Weather at home (see.c6):** "is it raining at home?" is the weather.
- Proven: 1,731 screen wordings and 2,359 ability wordings, all routed right.

### Amounts understood exactly (voice.u3) and more ways to say body and kitchen things (body.c4)
- One shared reader for durations and volumes. It fixes real wrong numbers:
  - "a quarter of an hour" was a 60-minute timer; it is now 15 minutes;
  - "twenty five minutes" was 5 minutes; now 25;
  - "one minute thirty" was 1 minute; now 90 seconds;
  - "two and a half minutes" was not understood at all; now 2 minutes 30 seconds.
- Water:
  - "half a litre" is 500 ml;
  - "a pint and a half" is 852 ml (it was 568);
  - "750ml" is read at all;
  - "a litre" works;
  - your own cup sizes win.
- Timer names no longer carry the amount's words (it was "quarter of" and "and half").
- New wordings:
  - "give us a shout in ten" sets ten minutes;
  - "chuck a pint in" logs a pint;
  - "how's my water looking" answers.

### Private things kept to you when others talk (voice.s1), and their turns kept out of your memory (voice.c5)
- When a voice you introduced, or one the phone doesn't know, asks about your money, health, messages, diary, notes, passwords or
  whereabouts, the phone answers kindly, with your name: "Sorry Sam, that’s [your name]’s to see, so I keep it to him." No table and no brain sees the ask.
- Their other questions carry none of your private picture: your remembered facts, your reflection, your day and your mood stay out of
  the answer.
- Their turns are kept out of your recall on the phone. On the brain, they stay out of your day log and recall, and never move your mood
  or rate my replies.
- This needed three guarded lines in `agent.ts`. It is a protected file; the commit says why.
- Never a lock: it only keeps things back.

### Put the look back by words (voice.u9)
- "Put it back" (just after a look change) or "the old colour" (any time) returns the look before.
- Every saved change is remembered, including taps in Settings. The day's own flips and the start are not.

### Shades by words (voice.u7)
- "A bit softer blue" gives light blue; "a bit deeper pink" gives red; "brighter green" gives lime; "a warmer colour" moves to the
  next colour that way.
- The twelve colours are fixed blocks, so a shade is the neighbouring plain colour in that direction, and the reply names it.
- At the end of a way it says so ("Blue is as deep as I go that way") and never makes a shade up.
- A bare "a bit darker" is still the background, as before.

### A colour for each room (voice.u8)
- "Make the money screen green" keeps green for Money alone.
- It shows while that screen is open, and your own colour comes back everywhere else; your saved look is never changed by it.
- "Money screen back to normal" lets it go.

### Colour-blind safe looks (voice.s5)
- A ninth switch on THE LOOK, "Colour-blind safe", also said as "colour-blind mode on".
- With it on, failures show orange, successes sky blue and warnings yellow (the Okabe–Ito set), never red against green; on Paper,
  their deeper inks.
- Each colour is checked for contrast against every background it is drawn on.

### Calm, focus or lively colours (voice.s10)
- "Calm colours" gives light blue, the glow off and nothing moving.
- "Focus colours" gives grey, no glow and a plain floor.
- "Lively colours" gives lime, the glow on and everything moving.

### Radio favourites by your own name (voice.c1, built into PLAN AND HOME's radio, small and additive)
- "Call this my morning station" names what is playing.
- "Put on my morning station" plays it.

### Voice recognition that keeps up (voice.u4)
- Your voice print refreshes itself gently from turns that were clearly you (well inside its own tolerance): a cold, a tired voice,
  outside.
- Each turn moves it a little, at most six a day, and it never drifts more than half its tolerance from the voice you enrolled, so it
  can never wander to someone else's.
- Kept on this phone only, in the voices' own store. It only helps the courtesy tag; it is never a lock.
- Turns judged by the voice pack's model don't refresh it yet.

### Why it wasn't sure (voice.u5)
- NOT SURE WHO on the talk bar now says why, in plain words:
  - "Two voices I know sound alike in that";
  - "Too much noise around your voice";
  - "Close to a voice I know, not close enough".
- "Do you know it’s me?" says the same.

### Spoken notes kept as yours (voice.s9, with ci.s4)
- "Note: buy milk", "note to self, call the garage", "jot this down: …" are written down and kept in Memory → Things you told me.
- Said aloud, a note is marked "by you" only when the phone is sure the voice was yours.
- Another voice's note, or one it isn't sure of, is not kept, and the reply says why: type it instead.
- Typed notes are kept too.

### Light colours by plain names (voice.s6, built into PLAN AND HOME's house controls, small and additive)
- "Make the lights red", "turn the bedroom lamp navy", "lights to pink" set your Home Assistant bulbs with the app's own colour words.
- The colour values sent are held to range, and the reply names the colour plainly: "the Hall light is on, in red".

### The same everyday wordings on Telegram (voice.u11, reshaped: for what Telegram can do)
- On Telegram, "give us a shout in ten" or "in a quarter of an hour" is noted for my brain as a reminder in that time.
- "Is it gonna chuck it down" is noted as the weather.
- The radio and water, which only the app keeps, are named as such, so I say so instead of guessing.

### Everyday asks in other languages (voice.u10)
- Spanish, French, and Urdu or Hindi as people type them in English letters reach the same abilities as the English:
  - the radio: "pon música", "mets de la musique", "gaana chalao";
  - the lights: "apaga la luz", "allume la lumière", "batti bujhao";
  - timers: "pon un temporizador de diez minutos", "minuteur de 5 minutes", "10 minute ka timer lagao";
  - water: "me he tomado un vaso de agua", "ek glass paani piya";
  - the map: "abre el mapa", "naqsha dikhao";
  - the weather: "qué tiempo hace", "mausam kaisa hai";
  - the news: "las noticias", "khabrein sunao";
  - settings: "ajustes".
- Other sentences in those languages are left to my brain, which speaks them anyway.

### Radio names for each person introduced (voice.s2, first part)
- "Call this my morning station" in Sam's voice names it for Sam; "put on my morning station" in Sam's voice plays Sam's, and falls back
  to yours only if Sam has none. Your own names are never changed by theirs.

### Also fixed on the way
- The look table no longer takes "show me the map" as the Map look (since the final round).
- **The talk bar's mic key after he ends listening (red on main, chatpass shard 4):** the key read "Stop listening" a moment after he
  had ended it on a slow machine, because it followed the speech engine's own state, which lags after it is told to stop. It now
  follows his tap: the moment he ends it, the key reads its resting state, and a new listen clears that. The spec is unchanged and as
  strict. The talk bar is the chat pass's code (features/core); I fixed it here as asked.

## How to try it on your phone
1. **Learning your words:** type "wonga page". When I answer, tap LIFE → MONEY. Tap REMEMBER IT on the bar. Go back and type
   "wonga page" again: Money opens. "My wordings" lists it.
2. **Exact amounts:** say "log half a litre" (500 ml kept), then "give us a shout in a quarter of an hour" (a 15-minute timer).
3. **Screens by name:** say "bring up the game maker", "open the translator", "how much paint for my lounge".
4. **The look:** say "calm colours", then "put it back".
5. **Your station:** with a station playing, say "call this my morning station"; later, "put on my morning station".
6. **Quiet mode:** with Sam introduced, let Sam ask "how much did I spend this month?": I keep it to you.

## Checks
- **Typechecks:** web and edge, both clean.
- **Brain tests:** meanings (2,359 wordings plus 1,731 screen wordings, amounts, learned wordings, the look put back, feelings, station
  names, why not sure); voiceknown (quiet mode in the prompt, agent.ts read from the source, private asks); prompt (worst turn within
  5,500); look, catalogue, car, speaker, kitchen, body, ratchet and knowledge.
- **Specs:** `voicelane` clean (168 checks at 440 and 390). `speaker` and `voice` were updated to the new truth: an unknown voice's GO
  ON turn is now a sentence with nothing of yours in it, because one about your calendar is now kept on the phone.

## What is left (later items, listed for the next round)
- **More languages and abilities for voice.u10:** a first set is built (Spanish, French, Urdu/Hindi in English letters, for nine
  abilities); more abilities and Urdu in its own script are left.
- **Settings for each person introduced (voice.s2):** their own station names are built; their own look and voice settings are not.
- **Say "Ghosty" to start listening (voice.s8):** not built; it needs a listening pack and the download rule.
- **Comic colours by plain names (voice.c3):** not built. The comic's speech balloons have no colour of their own yet, so this needs
  the COMIC lane's drawing to take a colour first.
- **Quiet mode, one gap:** after a reinstall, the phone's recall index refills from the brain's history, which does not carry who
  spoke a turn. Their turns from before the reinstall could come back into the phone's recall.

## Specialist sweep (against Siri, Google Assistant, Alexa, dictation apps)
- **Learns personal phrasings:** the assistants let you set custom phrases in settings; Ghosty now learns them from what you tap, and
  lists and forgets them by words. Built.
- **Plain amounts and durations:** built (u3).
- **Asking when an ask means two things:** built in the final round (keys).
- **Open any screen by voice:** built (u2).
- **Undo by voice:** for the look, built (u9).
- **Household privacy for other voices:** built (s1), stronger than the assistants' optional "personal results" switch.
- **Still missing next to them:**
  - follow-up questions that reuse the last subject ("and tomorrow?"), on the phone without the brain;
  - routines ("goodnight"), which the coordinator moved to CONSISTENCY and PLAN;
  - a "what can I say here" list on each screen, which went to CONSISTENCY.
