# PLAN-STARS — the order of work, step by step, from tonight to the ceiling (2 Nov 2026, 01:00)

Every step below is one item of STARS.md (its number in brackets) placed in order. Each step is finished only by
STANDARD.md: measured, built, reviewed by a second builder, checked in Chromium and WebKit at 440 and 390, tried on the
owner's phone, and he says it blew his mind. Steps inside a pass run as one builder's batch and land as one PR; passes
run one after another, two at most in parallel when their files do not touch. "Done when" is the one line that decides it.

## Pass 0 — tonight (running)

0.1 [71] [135] Every sheet a tab, a LIFE area, hubs that show everything. Done when: every feature is two taps from the dock
    and each new screen has its states and its IN THE WORKS label where it is below the bar. (PR #52)
0.2 [81] [82] [84] The phone-first stall. Done when: no reply ever waits in silence past two seconds, talking over "thinking"
    cuts it, the phone answers first only when warm and quick. (PR #52 or #53)
0.3 [83] His free keys. Done when: two or more free keys are in System → Keys and the status line reads "plenty of room"
    through a demo day. (his hands, one minute each)

## Pass 1 — Talking to him (three PRs, this week first)

1a Speed and presence
1.1 [1] Speech sentence by sentence while the rest is written: first spoken word under one second after his last.
1.2 [2] Interruption mid-word with recovery ("…sorry, go on"), never a restart.
1.3 [9] Long work narrated as it happens; the narration is the status, never a spinner alone.
1.4 [10] Conversation mode: mic open between turns, the reactor breathing with his voice, no taps.
1.5 [83] Model supply managed: the next model warmed before the first runs dry; cool-downs predicted from the counts.
1.6 [16] Siri Shortcut → open and listening within a second (the nearest to a wake word iOS allows).
1b Memory and recall
1.7 [4] The day's and last week's conversation recalled in replies ("like you said on Tuesday").
1.8 [17] "What did I ask you about X" by meaning, across chat, voice and Telegram, instant.
1.9 [19] A multi-day task held and chased without being babysat.
1.10 [26] His documents, notes and photos' text indexed by meaning on the phone.
1c Character
1.11 [3] One character everywhere: voice, chat, Telegram, cards, toasts, errors; a voice he chose.
1.12 [5] Mood read from words, pace and hour; answered to; no performed cheer at 2 a.m.
1.13 [6] Opinions held with reasons, dropped when shown, "I was wrong" said.
1.14 [7] One good question back when the ask is vague.
1.15 [8] Short when short is right; silent when the answer is on screen.
1.16 [11] [12] [13] Whispers, emphasis, a laugh, a pause; quotes in another voice; eight languages in character.
1.17 [14] Humour that builds callbacks and never repeats.
1.18 [15] Told off, thanked, taught a word: it sticks and shows.
1.19 [18] A thought of his own a few times a day that is worth reading.
1.20 [20] Admits what he does not know in one sentence and offers the next best thing.

## Pass 2 — Reliability and the checks (one PR, this week)

2.1 [85] Offline-first: every screen opens from the phone's copy instantly, then refreshes.
2.2 [86] Optimistic actions with undo on failure.
2.3 [87] A status line when degraded; self-healing when a feed or model returns.
2.4 [88] Speed budgets in the checks: first paint, first words, each screen's open; slower fails.
2.5 [89] WebKit in the checks; the iPhone traps each a test (safe areas, Safari bars, WebGPU memory, network filters).
2.6 [90] Crash records for everything; the owner never sees a stack trace, a blank or a frozen spinner.
2.7 [91] [92] Background sync as far as iOS allows; the whole app precached; the second open instant with no signal.
2.8 [93] Export everything and delete everything in one place; a restore in a minute.
2.9 [94] The brain's health page in his words.
2.10 [95] The five-minute owner check with every PR; the weekly "show your dad" list.

## Pass 3 — The look (the design system first, then area by area; themes when he has given his opinion)

(5 Nov, OWNER-ISSUES 131: 3a moves to day one, right after his pick from the three directions; 3b's shell is STATUS section 4
item 4; the other screens migrate to the system as their passes touch them; the themes land with the system as token sets.)

3a The system
3.1 [51] Tokens, type scale, 8-point grid, spacing, elevation, one icon family, written down and enforced by a test.
3.2 [52] Motion: one set of durations and curves; every transition says where things went.
3.3 [60] Typography a designer would sign; numerals that line up; no orphans.
3.4 [65] Icons as one drawn family; the dock and the deck the most beautiful thing on his phone.
3.5 [66] Visual regression: every screen's picture compared on every change, both browsers.
3b Applied, area by area (Home, hubs and deck, Ask, See, Make, Learn, Life, Plan, Me)
3.6 [53] Empty states: an illustration, one line, one button; never a blank.
3.7 [54] Skeletons shaped like the content; never a spinner alone.
3.8 [55] Cards alive before the tap: a reading, a spark, a glow on change.
3.9 [68] Home as a living feed with depth: parallax, time of day in the light, cards expiring gracefully.
3.10 [70] A first-run moment on every screen that teaches by doing, once.
3.11 [64] A copy pass on every string: one voice, no jargon, the right word, the right length.
3.12 [63] Gestures: swipe back everywhere, long-press for more, pull to refresh where it means something.
3.13 [62] Dynamic Type, VoiceOver complete, Reduce Motion, high contrast.
3.14 [61] Landscape, iPad and TV as layouts, not stretches.
3.15 [59] [69] Five signature sounds; the moments that matter land with sound and motion.
3.16 [67] Photography and 3-D in one palette and light.
3c Themes and hero moments (after his opinion)
3.17 [56] [57] The twelve themes finished to the bar, his picks first; light mode as good as dark.
3.18 [58] The Cinematic boot and every hero moment crafted.

## Pass 4 — The Lens (two PRs)

4.1 [36] Point at anything: object, plant, animal, product, car, landmark, dish, within two seconds.
4.2 [37] Live translation on the words themselves as the camera moves.
4.3 [47] Measure anything; said and saved.
4.4 [44] A known face greeted by name; liveness instant.
4.5 [45] Barcodes: product, price elsewhere, facts, allergens.
4.6 [46] Document scan: flat, cropped, deskewed, to PDF, one tap.
4.7 [38] A receipt or bill → spending, reminder, "already paid?" in one glance.
4.8 [40] [41] Worksheets marked instantly; a whiteboard to clean notes into Documents.
4.9 [42] The sky: stars, planets, the ISS, the plane's route.
4.10 [43] A room drawn in the air → a 3-D room he can walk, furnished from the home designer.
4.11 [39] [48] A plate's rough contents; a plant's health, a dent's estimate, first aid for a wound: each with the honest line.
4.12 [49] [50] The Lens remembers what he showed it; three seconds of video described.

## Pass 5 — Fun (two PRs)

5.1 [96] The shelf plays instantly; DOOM and Quake flawless; downloads through our site when the Archive is blocked.
5.2 [97] Native-feel controls: a thumbstick with inertia, buttons under the thumb, gamepad first-class.
5.3 [98] Our five games finished to "worth playing on the bus".
5.4 [108] The arcade on the TV with the PS5 controller, perfect.
5.5 [99] Ghosty plays with him: beat my time, I built you a level, trash talk in character.
5.6 [100] Opponents to lose to: draughts, poker, backgammon, a word game, beside chess and Connect 4.
5.7 [101] [102] A daily puzzle at breakfast; trivia from his library and his week.
5.8 [103] A rhythm game on his Spotify playlists.
5.9 [104] Two-player with a mate over a Telegram link.
5.10 [105] A level editor; a world shared as a link.
5.11 [106] More free engines where the licence allows.
5.12 [107] [109] [110] Tasteful scores and streaks; drawing games with the Lens; "surprise me".

## Pass 6 — Answers and knowledge (one PR)

6.1 [21] Every factual answer cited with its tier, two seconds for the common case.
6.2 [22] [23] Whole documents read; disagreeing sources compared and weighed.
6.3 [24] [34] Time-aware answers; live data refreshing while he looks.
6.4 [25] His city known deeply.
6.5 [27] [28] [29] Maths with steps; tables, charts, maps, timelines drawn; code that runs.
6.6 [30] Registers on one word: like I'm ten, the one-liner, the other side.
6.7 [31] The Library offline, fast.
6.8 [32] [33] [35] Follow-ups anticipated; long-form in his voice; "how sure are you" honest.

## Pass 7 — Making (one PR)

7.1 [111] Websites and apps: 2026 templates, live preview, publish in a tap.
7.2 [112] Documents: a real editor, Ghosty's margin comments, designed exports.
7.3 [113] [114] Music from a hum or a beat; pictures, posters and memes from words; photos edited by asking.
7.4 [115] [119] Printable 3-D from the Studio; builds priced from public prices.
7.5 [116] [117] Video trims and captions; a highlight reel; comics from his photos.
7.6 [118] The workbench explains like a teacher; the wind tunnel as the showpiece.
7.7 [120] Everything made kept, searchable, shareable, restored after a reinstall.

## Pass 8 — Life, deep (one PR per three packs)

8.1 [121] [122] [123] Money, bills, home.
8.2 [124] [125] [126] Car, outside, kitchen.
8.3 [127] [128] [129] Body, people, work.
8.4 [130] [131] Creative, learning.
8.5 [132] [133] [134] A weekly card per pack; numbers and dates as a person writes them; everything forgettable and exportable.

## Pass 9 — Him growing (one PR)

9.1 [136] [137] "This week I learned", and the sharpening felt in answers.
9.2 [138] The weekly training running every week with a readable report card.
9.3 [139] [140] [141] An honest self-model; self-upgrades reviewed in the morning with one tap; a ledger that reads like a CV.

## Pass 10 — Other screens (one PR)

10.1 [142] Everything from Telegram: voice notes both ways, photos, cards as pictures.
10.2 [143] TV mode as a lean-back app.
10.3 [144] [145] iPad and desktop layouts; hand-off between devices.
10.4 [146] Home Screen widgets that look like iOS's own.

## Pass 11 — Trust, felt (one PR)

11.1 [147] "What left the phone today" in one glance; the meter as a daily card.
11.2 [148] Keys in one place with a plain line each.
11.3 [149] Approval previews that look like the real post.
11.4 [150] A plain page on what he never does, kept true by tests.

## Flow, finding and the rest, folded in

[72] [73] [74] [75] [76] [77] [78] [79] [80] land with Pass 0 and Pass 3b (the deck, the tour, NEW THIS WEEK, the jump bar by
meaning, deep links, back and the switcher, in-screen search, the set-up page).

## Pace and order, honestly

Each pass is one to three days of a strong builder plus a reviewer at the bar. This week: Pass 0, Pass 1a, Pass 2 and
the start of Pass 3a. After Friday's reset: 1b, 1c, 3b, then 4 and 5. Then 6 to 11 in order. Months in all. The order
is what he feels first; he can move any pass up by saying so.
