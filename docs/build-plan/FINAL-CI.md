# FINAL-CI: the CI TIMING lane (13 November 2026)

Four reds from the combined check, each fixed at its cause in the app. No budget, no check and no spec was changed.

## 1. talk: his first spoken word came late (1212 ms on the first turn; a median of 1075 ms over ten)

**What was wrong.** Measured step by step on this branch and on a copy of origin/main (the page's own clock: his voice
ending, the words heard, the brain asked, the reply in, the voice asked, the first clip playing):

- From the brain's reply arriving to the voice being asked: about 1 ms on main, about 20 ms here.
- From the voice being asked to the first clip playing: about 83 ms on main, about 108 ms here.

A CPU profile of those windows named the cause. The CHAT pass's turn line (`paintTurn`, features/core/index.ts) was painted
inside the brain's event, before the reply was handed to the voice. It also read the log's height straight after changing it,
which forces the whole layout there and then. That was 81 ms of the 96 ms in that window over six turns here, and more on
CI's slower runner. Then, while the voice's first clip was on its way, the whole log was rebuilt two or three times in a row
(the reply, its steps settled, the turn's end). Each rebuild did that forced layout again, and the clip waited behind them.

The other candidates (the caption's rating keys, the Stage's line, narration, KERNEL 3's open-work data, the orb's frame) did
not show up on the critical path.

**What I made.** The turn line is painted on the next frame, once, however often the turn moves before it. The log is drawn
once a frame too, and puts the turn line back in that same paint, so there is never a frame without it. His own sent words
are still drawn the instant he sends them (chatpass's "reply while he reads back" relies on that, and so does he).

**Numbers (this container; CI's runner is slower).**

| | origin/main | before | after |
| --- | --- | --- | --- |
| spoken, the page's first turn | 1123 ms | 1138 ms; 1054 ms on final today | 886, 1049, 861, 951, 1015, 941, 898 ms |
| convo, median of ten turns | 877 ms | 951 ms; final today a little over 950 | 813, 830, 904, 877, 857, 823 ms |
| reply in → voice asked (profile) | about 1 ms | 96 ms over six turns | 4.5 ms over six turns |

talk (spoken and convo) and chatpass (whole) pass.

## 2. video: the exported file was 105 ms shorter than the timeline (54797 ms against 54902 ms)

**What was wrong.** CI's log shows what happened. With no H.264 encoder, the export takes the recorder's way, and under
software drawing the player drew only 164 pictures in 55 seconds, about three a second.

I reproduced it here: the H.264 encoder was forced to fail as on CI, the CPU slowed to a third, and the player drew 129 to
254 pictures. Moving the last picture later, or waiting longer before stopping, made no difference: −60 ms with the original
code, −58 and −68 with those changes.

The cause is that the recorder's encoder hands a picture on only once the next one has come in. So whatever is drawn last
is still inside it when the recorder stops, and it is lost. The file then ends on the picture before, short by one picture's
time, which is a third of a second at three pictures a second. I also tried checking the file while it was still being
recorded, but it is written in pieces and does not say its own length reliably (it ran 2.3 s over), so I took that out.

**What I made** (video/export.ts, video/preview.ts):

- The timeline's last picture is drawn at exactly the timeline's length after the start, on its own clock.
- The same picture is then drawn twice more, 40 ms apart, to push it through the encoder. Where nothing is held back, the
  file runs at most 80 ms over.
- The recorder then gets two frames and 150 ms before it stops.
- The export's player no longer seeks back to the last frame after the end. That seek drew one more picture later still.

**Numbers** (the file's length against the timeline's 54866 ms; the check allows 100 ms either way):

| | original | now |
| --- | --- | --- |
| CPU at a third (CI-like, 129 to 254 pictures) | 54806 ms (−60) | 54904 ms (+38) |
| full speed | n/a | 54897 ms (+31) |
| CI | 54797 ms (−105) | the combined check will say |

video's own "an encoder that cannot be made" check (a 2 s file) passes at both speeds.

## 3. video2: "a sampled frame's shift is smaller after: 5.9 px against 8.3 px before"

**What was wrong.** The check wants the after-shift to be under 0.7 of the before-shift. CI's log shows the same clip measured
12.2 px "before" on the first try and 8.3 px on the retry, with about 5.1 to 5.9 px "after" both times. So the steadying was
about as good both times. What moved was the sampling. A seek waited for the video element's `seeked` event and then drew. On
a slow decoder that can still hand over the picture before, so the same time showed one frame on one run and its neighbour
on the next. The steadier's own check of where the player's picture sits ("the player's offset") came out 0 for the same
reason.

**What I made.** A seek in the editor (video/preview.ts, `Feeder.seek`) now waits for the new picture itself to be shown
(`requestVideoFrameCallback`), not just for `seeked`. A seek that lands on the picture already showing has a short fallback
of 0.4 s. The spec's samples, the steadier's frames and his own scrubbing all get the frame under the playhead.

**Numbers.** Two runs here with the fix gave the same samples to the tenth of a pixel: 11.1 px before and 6.4 px after, both
times (6.4 against 11.1 is 0.58; the check wants under 0.7). CI's two runs before the fix gave 12.2 and 8.3 px before for the
same clip.

## 4. games5: Ghosty's level-1 answer took about 4 s (draughts 3813 ms; backgammon about 4.1 s)

**What was wrong.** It was neither a cold Worker nor the search: the search takes the 0.2 s it should (measured in Node), and
the Worker answered in about 230 ms. A trace showed the page's main thread blocked for about five seconds, starting about a
second after the page opened. At that point the browser shuts down the blank page's compositor, which waits on the GPU, and
the GPU was seconds behind because the board redrew the whole board sixty times a second at twice the screen's resolution.
It did that only for a slow gold pulse on the places he may play. A plain page that draws nothing does not stall. One that
redraws a heavy canvas every frame stalls at the same moment. At 390 his first move falls inside that stall, so Ghosty's
answer waited behind it.

**What I made** (arcade/games/board/shell.ts). The board is drawn again only when its picture changes: a move, a touch, the
size, a hint. While the places he may play are showing, the pulse is redrawn ten times a second (it takes a second and a
quarter to swell and fade). While Ghosty thinks, nothing pulses, so nothing is redrawn.

**Numbers (this container, 390 × 844, from his move to Ghosty's answer; the check allows 3,500 ms):**

| | before | after |
| --- | --- | --- |
| draughts | 8584, 4963, 5094 ms | 497 ms |
| backgammon | 4995 ms | 1050 ms |
| othello | n/a | 494 ms |
| connect four | n/a | 497 ms |

games5's four board parts pass.

## Checked

All on this branch merged with final:

- The web app typechecks. The brain typechecks, and the whole brain suite passes (2,223 tests after the last merge). ratchet, knowledge and look
  pass again after the merge (43).
- **talk:** spoken and convo pass every run. In whole runs, two other parts failed once each and then passed: `?do=listen`
  listened at 1232 and 1500 ms (31, 50, 63 and 107 ms on other runs), and "cooling" missed its line twice on a preview
  server that had been up through a dozen runs. Run on their own, mine and final pass alike and take the same time (cooling:
  mine 759 to 920 ms, final 804 to 1026 ms). I could not tie either to these changes. If CI shows one, it is worth its own look.
- **chatpass:** passes whole, after the turn line was made to go back in the same paint as the log (an earlier version
  missed it for one frame, and chatpass caught that).
- **video:** passes whole. Here, too, the export takes the recorder's way: 54933 ms against 54902 ms.
- **video2:** passes whole (10.9 px to 3.4 px at both sizes).
- **games5:** draughts, othello, backgammon and connect four pass (answers 411 to 797 ms after the merge).

- **Early check on 3309d128 (21:15 to 21:45 UTC).** I ran one shard: sites, direct, scroll, apps, scrollfeel, arcade, speed2,
  orbithud, video and bootfilm. orbithud was red twice, and the cause was my log painting: "orbit" is answered on the phone with
  no brain turn, and its reply reached the log a frame after the world changed. Fixed in 067b66a: the log is drawn once a frame
  only while a brain turn is at work, and at once otherwise. With that fix orbithud passes, and talk and chatpass still pass.
  scroll could only run in Chromium here, because this container has no WebKit; the Chromium run was clean.

## How to try it on his phone

- **Talk.** Talk to Ghosty hands-free. His first word comes a little sooner after you stop, and the line under your words
  still says where the turn is.
- **Video.** Export a video on a phone whose browser makes it in real time. The file is as long as the timeline. Scrub the
  timeline, and the picture is the frame under the playhead.
- **Board games.** Play draughts, othello, backgammon or connect four at level 1. He answers in about half a second, and the
  gold dots still pulse on your turn.

## What is left

- CI's runner is slower than this container, so the numbers above are this container's. The combined check is the real
  proof.
- The same stall that held up the board games (an old page's compositor waiting on a GPU kept busy by a picture redrawn
  every frame) can hit any screen that redraws a heavy canvas sixty times a second while nothing moves. The orb and the eye's
  layers would be the next places to look if a check right after a reload is slow on CI.
- One commit on this branch ("the recorder's file is as long as the timeline…") ends with another session's link in its
  Claude-Session line, copied by mistake. Rewriting a pushed commit was not allowed, so it stays. The later commit on the
  same files carries this session's link.
