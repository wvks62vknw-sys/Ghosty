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
once a frame too, except his own sent words, which still show the instant he sends them (chatpass's "reply while he reads
back" relies on that, and so does he). A frame comes before anything is shown, so nothing flickers.

**Numbers (this container; CI's runner is slower).**

| | origin/main | before | after |
| --- | --- | --- | --- |
| spoken, the page's first turn | 1123 ms | 1138 ms | 886 ms (1049 ms on a second run) |
| convo, median of ten turns | 877 ms | 951 ms | 813 ms, 830 ms |
| reply in → voice asked (profile) | about 1 ms | 96 ms over six turns | 4.5 ms over six turns |

talk (spoken and convo) and chatpass (whole) pass.

## 2. video: the exported file was 105 ms shorter than the timeline (54797 ms against 54902 ms)

**What was wrong.** CI's log says what happened. With no H.264 encoder, the export takes the recorder's way, and under
software drawing the player drew only 164 pictures in 55 seconds, about three a second. The recorder's file runs from its
start to the last picture that reached it. The last picture was drawn when the player noticed the end (up to a third of a
second late), and the recorder was stopped 30 to 40 ms after that. A picture drawn that slowly had not reached the recorder
yet, so the file ended on an earlier picture.

**What I made** (video/export.ts, video/preview.ts):

- The last picture is drawn at exactly the timeline's length after the start, on its own clock, not whenever the player
  notices the end.
- The recorder stops only once that picture has had time to reach it: two frames and at least 150 ms.
- The export's player no longer seeks back to the last frame after the end. That seek drew a second, later picture, which
  would have made the file too long.

**Numbers.** See "Checked" below.

## 3. video2: "a sampled frame's shift is smaller after: 5.9 px against 8.3 px before"

**What was wrong.** The check wants the after-shift to be under 0.7 of the before-shift. CI's log shows the same clip measured
12.2 px "before" on the first try and 8.3 px on the retry, with about 5.1 to 5.9 px "after" both times. So the steadying was
about as good both times. What moved was the sampling. A seek waited for the video element's `seeked` event and then drew. On
a slow decoder that can still hand over the picture before, so the same time showed one frame on one run and its neighbour
on the next. The steadier's own check of where the player's picture sits ("the player's offset") came out 0 for the same
reason.

**What I made.** A seek in the editor (video/preview.ts, `Feeder.seek`) now waits for the new picture itself to be shown
(`requestVideoFrameCallback`), with a short fallback of 0.4 s for a seek that lands on the picture already showing. The spec's
samples, the steadier's frames and his own scrubbing all get the frame he asked for, every time.

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

(filled in below as each run finishes)

## How to try it on his phone

- **Talk.** Talk to Ghosty hands-free. His first word comes a little sooner after you stop, and the line under your words
  still says where the turn is.
- **Video.** Export a video on a phone whose browser makes it in real time. The file is as long as the timeline. Scrub the
  timeline, and the picture is the frame under the playhead.
- **Board games.** Play draughts, othello, backgammon or connect four at level 1. He answers in about half a second, and the
  gold dots still pulse on your turn.

## What is left

- CI's runner is slower than this container. The numbers above are this container's. The combined check is the real proof.
