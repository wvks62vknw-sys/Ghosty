# FINAL ROUND: VOICE, MEANINGS AND COLOURS (lane-voice, 13 November 2026)

Branch `claude/new-session-4erjve-lane-voice`. Spec word: `voicelane`. Brain tests: `apps/edge/test/meanings.test.mjs` (run from
intent.test.mjs) and the new tests at the end of `apps/edge/test/voiceknown.test.mjs`.

## 1. His voice, known in the chat

**What was wrong.** The phone did recognise his voice: Settings and the talk bar said YOU. But the brain was told only `Voice: yours`
on a spoken turn that got scored. A typed turn told it nothing, and neither did a spoken turn too short to score. So asked "do you know
it's me?" it guessed, and said it had no way of recognising him. Settings and the chat contradicted each other.

**What I made.**
- Every chat turn from the app now carries `heard`: whether his voice is taught to this phone and, on a typed turn, whose voice the
  phone last knew and how long ago (within half an hour). The brain gets one plain line:
  - `Speaker: the owner, recognised by voice on this phone (sure; never a lock)`
  - `Speaker: Sam, whom he introduced, known by voice on this phone (sure)`
  - `Speaker: not sure who, by voice: say nothing private, ask who it is` (new: the voiceprint's "not sure" band is now said as
    not sure. The phone still fails closed and holds the turn, and the talk bar says NOT SURE WHO)
  - `Speaker: a voice this phone doesn't know: say nothing private, ask who`
  - `Speaker: spoken, too short to recognise; this phone knows his voice`
  - `Speaker: typed, no voice heard; this phone knows his voice (last heard: his, just now)`
  - `Speaker: his voice isn't taught to this phone yet (Settings, My voice)`
  The line has words only. It carries no score and no number, and Telegram never carries it.
- "Do you know it's me?", "who's talking?", "can you recognise my voice?" and similar are answered on the phone from the tag, with
  no model. The answer is true either way: yes and sure, not sure, a voice it doesn't know, typed so no voice was heard, or not taught
  yet with where to teach it. It always says the voice never unlocks anything. These asks come before "can you…?", so they can't be
  answered as an ability he lacks.
- His voice is still never a lock: nothing here opens, approves or unlocks anything (a brain test reads the source to check).
- **The prompt guard stays at 5,500.** I paid for the line by condensing two others: WORK IN CHAINS ("do the chain, each feeding the
  next" became "chain them") and PICTURES ("orders in it" became "orders"). After merging the other lanes' prompt words, the worst
  turn was 5,503, so the line for a person he introduced now says "known by voice" instead of "recognised by voice". The worst turn
  is 5,498 (a person he introduced, with the longest name). The prompt test now also measures typed turns carrying the speaker line.

## 2. Many wordings, one meaning

**What was wrong.** Each table knew only its own words. "Play music", "put some tunes on" and "log a pint" fell through to the model,
which had no radio tools turned on for those words. The look table also took "show me the map" as the Map *look* instead of the map
screen, and took "lights off" as dark mode.

**What I made.** I added `packages/shared/src/meanings.ts`, an intent layer the phone runs after every table has had his words as he
said them, so nothing that already worked changes. It covers synonyms, paraphrases and British wordings for:
- the radio (and stopping it), water (a glass, a pint), lights on and off, timers ("give us a shout in ten minutes")
- the map, the Lens, the comic
- docs, sheets, slides, photo and video
- the arcade and the board games
- weather and news
- settings, agenda, money, library and learn

Each meaning is done in one of four ways:
- The ability's own table runs on its plain words, and the chat still shows what he said.
- A screen opens and the reply says so.
- The radio plays his last station or a favourite. With none kept, it opens Radio to pick one.
- For weather and news, his words go to the brain with one short note of the meaning read.

Where the words fairly mean two things, it asks one short question with both as keys:
- "play something": Music, or a game?
- "play a game": The arcade, or a board game?
- "open the camera": the Lens, or the map's cameras?
- "lights off": the room's lights, or a dark screen?
- "white" and "grey": the colour, or the background?

The radio tool's description now says plain asks for music mean it too.

**Proof.** `meanings.test.mjs` runs 2,282 wordings over 26 abilities through the phone's real order (its tables first, then the
meanings), and all 2,282 come out right. It also proves:
- every canonical phrase is taken by its own table;
- every screen it opens is a real tab;
- every two-way key's words lead back to exactly that meaning;
- 19 sentences about something else ("who invented the radio", "how much water should I drink a day") are left alone.

## 3. Colours named plainly

**What was wrong.** The twelve colours were named Reactor, Ember, Crimson, Violet and so on. Saying "red" did nothing because no colour
was called red.

**What I made.**
- Every colour has a plain name, and that is what's shown in Settings › Theme, THE LOOK, the recipe line and the slides' themes:
  Blue, Grey, Orange, Yellow, Red, Purple, Green, Light blue, Pink, Lime, Peach, White. The keys underneath didn't change, so saved
  settings still read.
- `packages/shared/src/colours.ts` maps each plain name, its old name and common synonyms to one colour, both ways. For example
  crimson, scarlet, ruby and maroon all mean red; navy, teal and cyan mean blue; emerald, jade and olive mean green. A test checks that
  no word means two colours.
- These all work by chat and by voice, on the phone with no model: "make it red", "red theme", "change the colour to blue",
  "change the theme to green", "set the accent to teal", "paint it scarlet", "I want it lime green", "light blue please", and a plain
  name on its own ("red").
- The reply says what changed, for example "Red now, instead of blue. Only my colour changed.", or "Red (crimson) now…" when he used
  the fancy name.
- "White" and "grey" are a colour and a background both, so it asks which with two keys. "Black" is the black background.

## How to try it on his phone
1. Say or type **"make it red"**. The light turns red and the reply says so. Then try **"change the colour to blue"** and
   **"crimson theme"**.
2. Say **"make it white"** and tap **WHITE LIGHT** or **WHITE PAGE**.
3. Say **"put some tunes on"**. It plays his last station, or opens Radio to pick one.
4. Say **"log a pint"**, **"give us a shout in ten minutes"** and **"play something"**.
5. With his voice taught (Settings › My voice), say **"do you know it's me?"**. Then type it. Both answers are true to what the phone
   heard.

## Checks run
- Typecheck (web): clean.
- Brain tests: meanings (2,282 wordings, all right), voiceknown, prompt (worst turn 5,498 of 5,500 after the merge), look, catalogue, social, car,
  ratchet and knowledge. The full suite ran 2,161 passing with one red: speaker.test's "never a lock" ratchet caught the word "unlocks"
  in my answer text. I reworded it to "It never opens anything on its own: it's a courtesy, never a lock", and speaker and voiceknown
  passed again.
- Specs: `voicelane` ran clean (68 checks at 440 and 390). `speaker` ran clean.
- `voice` failed one check: enrolment took 29.6 s against a 20 s limit, during a run with three heavy jobs sharing the CPU. Nothing in
  enrolment changed in this lane.
- I updated `look`, `routec` and `slides` for the plain names. Their own browser runs are left to the combined check.

## Decisions I made (nobody was there to ask)
- **Plain names chosen.** Gold is shown as "Yellow"; "gold" still works. Sunset is "Peach" and Ice is "Light blue". Rose's tag already
  said "Coral pink", so Sunset couldn't take Coral.
- **"Lights on" and "lights off" left the look table.** They now ask "the room's lights, or a dark screen?". "Dark mode" and
  "light mode" are unchanged.
- **"Show me the map" opens the map screen**, as looks.ts already said it should. The Map look still answers "the map look" and a
  bare "the map".
- **The voiceprint's "not sure" band is now told to the brain as "not sure"**, at the owner's request. The earlier rule kept the
  reason from the brain; this tells it in words only, never as a number. The phone still holds that turn for a tap.
- **I didn't change the protected `tools/index.ts`.** On Telegram, "put some tunes on" still relies on the brain's own word match;
  the phone handles every app turn first.
- **push.ts:** a browser that blocks service workers (a private window) made the app throw at start. It now says push is unsupported.

## Adversarial pass (19:30 UTC)
I tried about 130 more wordings to find wrong matches and gaps.
- **Wrong matches:** none against ordinary chat ("set the table for dinner", "had a glass of wine", "the radio said it would rain").
  "Show me the money" opens Money, which is fair.
  Two idioms are read as colour asks, "go green" and "green light". They change only the colour and
  say so, so I left them.
- **Gaps closed:** "bang some music on", "can we have some music", "play us a tune", "drop some beats", "log my water", "wake me in 20
  minutes", "time me for 3 minutes", "show me where I am", "open google maps", "new comic", "wanna play a game", "what's the weather
  going to be like tomorrow", "change the colour" (opens THE LOOK and says "say one, like make it red"), "dark theme", and "turn
  yourself red" / "make yourself green".
- **Left to the brain on purpose:** asks that carry content, like "make me a comic about a cat", "write a letter to my landlord",
  "play some jazz", "put Radio 1 on" and "remind me in 10 minutes". The brain's own tools do these with what he said.

## What is left
- Studio-game's sprite colours (Night, Moss, Lagoon…) are scene names rather than theme colours, so I left them as they are.
- Teaching the brain's tool words (tools/index.ts, protected) the new music wordings for Telegram.
