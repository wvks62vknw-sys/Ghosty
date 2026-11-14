# NEXT-CI: SPEED AND RELIABILITY, the next round (14 November 2026)

## What I built

### 1. Ghosty starts speaking on the first sentence (ci.u1)

The brain already sends a long reply a sentence at a time, but the voice used to wait for the whole reply before it said a
word. Now the first sentence goes to the voice the moment it arrives, and the rest follow it into the same queue. This works
for Ghosty's own voice and for the phone's voice.

- **Same words as before.** The pieces said are exactly the ones the whole reply would have been said in. The first is
  kept short so the voice starts quickly, and a reply read out by itself still stops after about half a minute with "The rest
  is on screen." (`spoken.ts`, `SpokenPlan`, with a test in the brain suite).
- **When the brain changes its mind.** If it takes its sentences back (it turned to a tool), the voice stops. If the whole
  reply reads differently from what was sent, it is said again from the start, unless he has already heard part of it.
- **Proof.** The preview's stand-in model now writes "talk to me about…" one sentence every 300 ms, as a real model does, so
  talk.spec proves the gain. With the old voice path, the first word came 1217 ms (phone voice), 1078 ms (Ghosty's voice) and
  1826 ms (spoken) after he finished, and talk failed its budgets. Now it comes after 306–386, 200–324 and 807–880 ms.

### 2. A soft tick when you are heard (ci.u5)

When the ear hears his voice end in the quiet that closes a turn, or the phone's own recogniser finishes, a soft falling tick
plays. It is the quietest of the interface sounds, gone in 40 ms, and never sounds like the "your turn" tone. It follows the
sounds setting in Settings → VOICE & HOME.

talk.spec checks for one tick per turn over the ten-turn conversation, after his last word and before Ghosty's first. Here it
comes 0.6–0.9 s after he stops, at the moment the ear decides he has finished.

### 3. Screens that rest when still (ci.u4)

- **The background.** The quiet room behind every screen except the globe turned its stars and drifted its dust by well under
  a pixel a frame, yet it was redrawn at the display's full rate with its glow pass. Now it is drawn 30 times a second while
  nothing moves it. It is drawn every frame, at once, when the view moves (tilt or pointer), when the size or colours change,
  or when a flash plays. The canvas keeps its last picture in between.
- **The board games** already redraw only when something changes (the final round's fix).
- **Proof.** New spec `rest`, added at the end of check.yml's list.

### 4. Voice timings on the SPEED card (ci.u3)

System → SPEED now has a Voice row with today's medians, timed and kept on the phone: "first word 0.9 s after you stop, ear
open again 1 ms after I finish". The ear really does reopen within a millisecond of the last clip ending. The checks' own
70–220 ms is their polling delay.

talk.spec checks that the phone kept all ten turns, and that its first-word median agrees with the check's own clock to
within 300 ms. speed.test checks the line.

### 5. Every screen opens faster (my sweep)

The 3D room used to read its canvas's size in every frame, which forced the browser to lay out the whole page in the middle of
the frame. On the frame after a screen was built, that meant the whole new screen was laid out there and again when it was
painted. The size now comes from a ResizeObserver.

First open of each screen on the preview (390 × 844, timed by the phone's own stopwatch):

| Screen | Before | After |
| --- | --- | --- |
| Video | 2564 ms | 26 ms |
| Workbench | 2601 ms (1822 ms in a second run) | 81 ms |
| Settings | 416 ms | 118 ms |
| Library | 405 ms | 92 ms |
| Coach | 410 ms | 27 ms |

Most screens now open in 20–250 ms. GROWN UP's Home opens from a hub's way back in a median of 66 ms (60–118 ms), against
271 ms (67–329 ms) on the integration branch's starting point in the same container. Main's check had a flake at 485 ms
there, against a budget of 300.

### 6. Main's red: safari.spec's Agenda date boxes

It was not the clock. Since the PLAN lane's to-do list, the Agenda's pills run Diary, To-do, Reminders, Spending, Calendars,
and the check took the second pill to be the reminders' side.

I proved this in Chromium with the phone's clock at 00:58 and at noon, London time. The old way found one box at both times.
The new way looks for each box by its pill's name and waits for it to be drawn instead of sleeping, and finds both at both
times. The check is exactly as strict as before. WebKit is not in this container, so CI's run is its proof there.

## How to try it on his phone

- **Talk.** Ask Ghosty something with a long answer ("talk to me about the sea") by voice. He starts on the first sentence,
  and a soft tick says he heard you finish.
- **Speed.** Open System → SPEED after a few spoken turns: the Voice row shows your own timings.
- **Screens.** Open Workbench, Video, Settings or Library. They open at once, and the room behind stays calm.

## What is left, and why

- **ci.u2, keep the line to the brain warm.** Not built. The page's first spoken turn now lands at 807–956 ms, against a
  conversation median of about 830 ms, so the gap it would close has mostly gone.
- **ci.s2, hear your document read back.** It was already built: the document editor's READ IT TO ME reads paragraph by
  paragraph, highlighting and scrolling.
- **Not reached by 06:00:** ci.u7 (faster export on more phones), ci.u8 (an export pill that follows you), ci.u12 (screens
  that open from the phone's copy), ci.s5 (board games by talking), ci.s9 (a listening queue), ci.s10 (offer to steady a
  shaky clip) and ci.c3 (spoken lessons you can interrupt).
- **Sweep, still open:**
  - House and Home admin still took 1.3–1.9 s on their first open in one full run, but 0.3–0.45 s alone. I did not find the
    cause in time.
  - The globe (God's Eye) is still drawn every frame. eye.spec's screenshot times out in this container on the integration
    branch's own start too, so that is not from this round.
  - talk.spec's `?do=listen` part was slow (1.2–1.7 s) in some full runs and fine alone; I could not reproduce it outside a
    full run.
