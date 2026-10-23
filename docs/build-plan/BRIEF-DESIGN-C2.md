# DESIGN, chunk C2: route C pushed to "Tony Stark navigating Ghosty" (one round, then he approves and we build)

The owner picked route C (23 Oct) and said: "I like Route C the most but I still feel like it could be better, like I
genuinely want to feel like Tony Stark or Iron Man navigating Ghosty." So: keep everything that makes C premium and
calm (Apple-quality type, spacing, glass, one accent, honesty), and raise the Jarvis/Stark FEELING hard, through
presence, instruments, layering and motion, never through "hacker" decoration (no neon walls, no scanlines, no matrix
text, no clutter). Think of the films: holographic glass panels that float in layers, thin rotating rings and dials,
data that ticks in, targeting brackets around what is selected, the reactor as the living heart, and Jarvis talking to
Tony in one calm line. Build on `docs/build-plan/mockups/c/` (its build.py and style.css), do not start over.

## What makes it feel like Iron Man (do all of these)

1. **Ghosty has presence.** The reactor is Ghosty's heart, not a gauge. It breathes slowly when idle, brightens and
   opens its core when he listens (the mic), and pulses with what he is doing (studying, training, thinking). Under
   the greeting there is one calm **Jarvis line**, written as speech, from real state: "Good evening, Boss. The M6 is
   queuing northbound; leave by 19:10 and you'll miss it." The Home screen reads as Jarvis talking, not as a dashboard.
2. **Holographic layering.** Panels are holographic glass: a faint cyan hairline that brightens at the corners (film
   HUD corner brackets, subtle), a soft inner glow, true depth between layers (the background grid is far, cards are
   near, the reactor nearest). A faint technical grid (hexagonal or fine graph) sits far behind everything at 3–4%
   opacity and drifts with scroll; on the real phone the layers will parallax with the phone's tilt (DeviceMotion,
   honouring reduce motion) — show the depth in the stills.
3. **Instruments everywhere, and real.** Readouts in `ui-monospace` (SF Mono on the iPhone) with tabular figures,
   small-caps tracked labels (ALT 3,050 KM · HDG 0°), rotating tick rings on live dials (free AI, database, uplink),
   segmented arc gauges on the Gym rings, targeting brackets around the selected card or map target, a compass ribbon
   on God's Eye, data that visibly ticks (a frame mid-tick is fine). Every instrument shows a true value from the app.
4. **The systems ring.** Tapping the reactor opens Ghosty's systems as a ring around it (the "Every screen" deck as
   an orbit: icons on a circle with the names, the current one lit, a second ring for the rest). This is the signature
   Iron-Man interaction: show it as its own screen (6). Keep the five floating tabs as the everyday navigation.
5. **Jarvis works in the open.** In Chat, while tools run, a thin scanning line and the step names tick in
   ("Searching the web… 3 pages read… checking the weather"), then settle into the reply card. Approvals ("Send this
   email?") look like Jarvis asking, with APPROVE / NOT NOW as holographic buttons.
6. **Boot-up.** On opening the app the reactor spins up, the rings draw in and "Systems online · all good" appears
   for a second — show one frame of it (7). Reduce-motion users get a plain fade.
7. **Listening.** Show Home in its listening state (8): the reactor's core open and bright, a live waveform ring,
   "Listening…" in the Jarvis line.
8. **Sound and motion notes** on the language card: spring micro-animations at 120 Hz, the breathing reactor, a soft
   confirmation tone on done actions (the app already has sounds), everything honouring reduce motion.
9. **Keep the discipline.** One accent (reactor cyan) for live/active and for the holographic hairlines; white and
   greys for text; amber only for warnings; true black canvas. Text stays SF (Inter here). Nothing that hurts
   readability; nothing decorative that lies.

## Deliverables

Route C2 under `docs/build-plan/mockups/c2/`: the five screens as before (Home, Chat, God's Eye, Gym, Me), plus
(6) the systems ring, (7) the boot-up frame, (8) Home listening; a contact sheet of all eight; a language card that
also lists the motion and sound rules and the parallax note; every PNG under 1.5 MB; the HTML/CSS that made them.
Do your own Apple-style design review ("would Apple ship this?" AND "would Tony Stark use this?"), 1–10 for both,
fix anything under 9 on either, and report the scores. One round: when it is done, the owner approves and we build.
