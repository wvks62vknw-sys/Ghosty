# NEXT ROUND: SPEED AND RELIABILITY (CI TIMING)

Your lane: **Speed**. Read `docs/build-plan/NEXT-ROUND.md` first: the rules, how the code is checked, and the protocol. This file is your work, in order.

## The big moves you are part of

- **Talk to it your own way** (led by VOICE). Every screen gets one name and answers lots of everyday wordings, and when Ghosty misses one, it learns it from the screen you tap. You can also make your own one-word routines, like 'goodnight' or 'morning', that run several things at once, and anything that sends or posts still waits for APPROVE. Yours: `ci.u1`, `ci.u5`.
- **Learning that adapts and talks back** (led by LEARN). Courses aim at the questions you got wrong, the shelf fills with free public-domain classics, and lessons can be heard, quizzed and argued with out loud. Learn becomes a personal tutor and a library in one. Yours: `ci.c3`.
- **Everything works with no signal** (led by POLISH3). One number shows how much of Ghosty works offline right now, and which single download would help most. Each download happens only when you tap, on Wi-Fi, with its size shown, and journeys, translation, plant names and screens keep working when the signal drops. Yours: `ci.u12`.

## 1. The next round: build every one, whole and specialist-grade

- **Start speaking on the first sentence** (`ci.u1`, M). Ghosty starts talking as soon as the first sentence of a long answer arrives, about a third of a second sooner.
  - Their words: Start speaking on the first sentence while the rest is still arriving. Why: His first word comes about a third of a second sooner on long answers. Builds on: Replies already arrive a sentence at a time, and the voice already queues sentences.
  - Why now: Every spoken answer starts about a third of a second sooner, which lifts all voice use at once.

## 3. Finish what is half done

- (nothing partial in your lane)

## 4. Soon: build them all once 1 to 3 are whole

- **Screens that rest when still** (`ci.u4`, M). Every screen, your own games included, stops redrawing when nothing moves, for longer battery, a cooler phone and no freezes.
  - Their words: Draw nothing while nothing moves, on every screen. Why: Longer battery, a cooler phone, and none of the second-long freezes after a screen opens (the board-game fix, applied everywhere). Builds on: The board games' redraw-only-on-change fix.
- **A soft tick when you're heard** (`ci.u5`, S). A soft tick when Ghosty hears you finish speaking, so you never wonder whether to say it again.
  - Their words: A sign that the end of his speech was heard. Why: A soft tick tells him he was heard, so he never wonders whether to say it again. Builds on: The ear's end-of-speech detection and the "your turn" tone.

## 5. Later: build the best of these, as many as stay whole and green; list the rest in your report

- **Keep the line to the brain warm** (`ci.u2`, S). While you're in a conversation, the line to the brain stays open, so the first answer is as quick as the rest.
  - Their words: Keep the connection to the brain warm during a conversation. Why: Removes the slower first turn after opening (today about 1 second, against about 0.85 seconds after that). Builds on: The status call already made when a conversation starts.
- **Voice timings on the Speed card** (`ci.u3`, S). Add your spoken first-word and ear-reopening times to System's Speed card, which already times replies and screens on your phone. *Reshaped to keep his rules: Partly built: the SPEED card already shows reply, screen and start-up timings.*
  - Their words: A speed meter in Settings → System. Why: He sees his own first-word, answer and ear-reopening times from the last day, kept on the phone. Builds on: The timings the talk checks already measure.
- **Faster video export on more phones** (`ci.u7`, L). Videos are made faster than real time on more phones, by using the frame-by-frame route more widely.
  - Their words: Faster video export on more phones. Why: Videos are made quicker than real time on more phones. Builds on: The existing frame-by-frame route and Ghosty's own file writer.
- **Keep using Ghosty while exporting** (`ci.u8`, M). Move to other Ghosty screens while a long video exports, with a small progress pill that follows you. *Reshaped to keep his rules: Reshaped: an iPhone web app pauses when you leave it, so it can't export in the background or notify from there.*
  - Their words: Export in the background, with progress in a notification. Why: He can leave the editor while a long video is being made. Builds on: The export's progress line.
- **Screens that open instantly** (`ci.u12`, L). Each screen opens at once from what's kept on your phone, then quietly updates when fresh numbers arrive.
  - Their words: Screens that open instantly. Why: Each screen opens from what is kept on the phone, then updates. Builds on: What each screen already keeps on the phone.
- **Hear your document read back** (`ci.s2`, S). A LISTEN key in the document editor reads your own writing aloud, so mistakes jump out.
  - Their words: Hear my document read aloud while I edit it. Why: Hearing his own writing catches mistakes. Builds on: Read-aloud and the document editor.
- **Play board games by talking** (`ci.s5`, M). Say 'column four' or 'take with the left piece' and Ghosty says the move back before playing it.
  - Their words: Board games played by talking. Why: "Column four" or "take with the left piece", with the move said back. Builds on: The board games and the conversation loop.
- **A listening queue for the commute** (`ci.s9`, M). Line up saved articles and Ghosty reads them one after another, keeping your place in each.
  - Their words: A read-aloud queue for the commute. Why: Saved articles read one after another, with his place kept. Builds on: Read-aloud and the library.
- **Offer to steady shaky clips** (`ci.s10`, M). When you add a shaky clip, Ghosty offers to steady it with one yes.
  - Their words: Offer to steady shaky clips when they are added. Why: Shaky clips fixed with one yes. Builds on: STEADY and the exact-frame seek.
- **Spoken lessons you can interrupt** (`ci.c3`, M). A lesson in Learn is read aloud and you can cut in with a question, then it carries on where it was.
  - Their words: School's tutor teaches as a spoken lesson that he can interrupt. Why: He can stop it to ask a question, the way a real tutor allows. With: LEARN (school) (build it into their area, small and additive).

## 6. Everything else, at the level of the best app of its kind (his words: "every single little feature … the absolute best", "and even more things")

Go screen by screen through your lane and compare each with the best dedicated apps of its kind (the fastest apps on iPhone: first word within a breath, every screen open in a blink, nothing janky at 120 Hz). For each screen, list what they have that Ghosty lacks and build it, within his rules. Then fix every rough edge you find: a dead key, a missing state in his words, a slow open, a cut word at BODY 21, a look that breaks in one of the seven worlds. Add your own ideas too. Put the list, with what you built and what is left, in your report.

## Built into your area by other lanes (expect their small additions; keep their intent when you merge)

- `editors.c6` from EDITORS: A post drafted from a photo or video edit, sent only with APPROVE
- `money.c5` from MONEY: Birthday cards and messages drafted from Coming up with one tap, in his voice, sent only on APPROVE

## Left out (do not build these as written)

- `ci.u6` Short answers aloud with no signal: Already built: common asks are answered on the phone, the offline brain answers the rest, and the phone's own voice reads them.
- `ci.u9` Board games think during your turn: Near-worthless: easy levels already answer in about half a second.
- `ci.u10` A voice that heals itself: Already built: whatever Ghosty's voice could not say, the phone's voice says from the same sentence.
- `ci.u11` Nightly check of slow paths: Duplicate of flagging screens that got slower; the phone can't run checks at night.
- `ci.s3` A spoken guide to any screen: Duplicate of the help desk with exact taps.
- `ci.s6` Practise a speech with timing: Already built: Rehearse's one-minute talk gives your pace, filler words and the line to cut.
- `ci.s7` Video voice-over by talking: Already built: RECORD A VOICE-OVER in the video editor, with the music ducking under it.
- `ci.s8` Captions for your own videos: Already built: SUBTITLES writes them from the clip's sound on your tap and saves .srt; a phone-only version would need a big download.
- `ci.c1` Radio fades under Ghosty's voice: Already built: the radio ducks while Ghosty talks or listens.
- `ci.c2` The Lens reads aloud what it sees: Already built: READ ALOUD on the Lens's letter, page and translation cards.
- `ci.c5` Morning brief read aloud: Already built: 'Read me the Brief on the first open of the day' in Settings → Voice.
- `ci.c6` Game-studio games drawn only on change: Duplicate of screens that rest when still, which includes your own games.

## Merged into another idea (built there)

- `ci.s1` Hands-free cooking goes into `body.u12`
- `ci.s4` Voice notes turned into text goes into `voice.s9`
- `ci.c4` Comics read in character voices goes into `comic.u12`
