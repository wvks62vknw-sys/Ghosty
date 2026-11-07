# BRIEF: THE ORB AND THE BOOT — the hologram a little better, the cinematic a lot better

The owner, 7 Nov 00:20 UK (OWNER-ISSUES 142): "i still want that old glowing hologram orb … if you can make it a little better,
along with the cinematic btw which can be a lot lot lot better". STATUS item 1(e); STARS 58. The top tier at max effort, after
THEMES-2 is on main (the boot plays on the chosen ground, in the chosen colour and world). Sharpen this brief from THEMES-2's
report before launching it; what is fixed already is below.

## What is fixed

- MIND IS THE HOLOGRAM ORB (apps/web's Mind, the 3-D hologram drawn from his library), everywhere, in every theme and world. The
  points-sphere "eye" (apps/web/src/ui/eye.ts, THE LOOK's MIND section) is retired: THE LOOK's MIND section shows the hologram
  itself, with its states.
- THE ORB A LITTLE BETTER, not different: sharper where it is sharp, lit in his colour from the tokens, its glow following the
  world's glow token and the GLOW switch, and FIVE STATES EACH ONE VISIBLE CHANGE (idle, listening, attending to a thing, thinking,
  saying), named on THE LOOK and held by the spec; Reduce Motion holds it still; the frame budget is kept (STANDARD's speed habit:
  measured before and after, no slower on the preview's stand-in GPU).
- THE BOOT A LOT BETTER: crafted shot by shot as a storyboard first (six to ten frames rendered as PNGs with the mock-up tools,
  docs/build-plan/mockups/boot/, sent to him before the code), then built: the ground first, the scan or the world's floor forming,
  the orb forming from his library's points, the stamp line typing itself (the day, the time, his place), the feeds answering, the
  recognition (one box snapping on with the tone) as the last beat, then Home. Under three seconds to a usable Home, the first word
  spoken on time (the talk rules), skippable with one tap, honest when offline (the stamp says so). Reduce Motion gets a two-frame
  version. Nothing in it is decoration that lies: every line in the boot is true of that moment.
- What must not change: the boundary, the prompt guard, the CI guard job; the hero, boot and routec specs are RE-CUT with the boot,
  never loosened; no new packages; never a model name.

## Size

Half a day for the orb, a day for the boot with its storyboard; one top-tier builder; the storyboard goes to him before the build.

## 7 Nov addendum, from THEMES-2's report (OWNER-ISSUES 147): what the build stands on

- THE ORB IS `apps/web/src/features/core/mind.ts`: the three.js hologram (a sphere of light holding the slowly turning
  constellation of his library; one WebGL context in the whole app; 30 fps idle, 60 for a second after a change, a still frame
  under Reduce Motion or heavy mode; `reactor.ts` is the 2-D fallback with no WebGL). Its light is the accent from the tokens
  (`--c`, `--c2`, set by state/theme.ts); `glowNow()` and `themeEvents` in state/theme.ts already give the world's glow times
  the GLOW switch, and the 3-D scene already clears to the ground. Build on `heroState` and the voice state it already reads
  (`idle`, `busy`, `listening`): the five states are idle, listening, attending (the reticle has landed on a thing: the
  recognition in ui/machine.ts), thinking (a reply being worked out: today's "many pulses"), saying (while it speaks).
- WHAT THEMES-2 FIXED ON `<html>` BEFORE THE FIRST FRAME: `data-theme`, `data-ground` (black · graphite · slate · warm · paper),
  `data-world` (scan · map · eye · ink · glass), `data-motion` (`calm` from the switch; the phone's Reduce Motion wins),
  `data-night` (the night ground that Paper boots on); the tokens `--g-glow` (0 in One Ink), `--g-glow-floor` (0 on Paper),
  `--g-floor-mask` / `--g-floor-size` / `--g-floor-a` (the world's floor), `--g-room-canvas`. `bootState.recipe` records the
  recipe the boot played in ({theme, ground, night, world, floor, glow}). The boot ALREADY plays on the ground in the colour
  (Paper: on the night ground, said on the Paper row); keep that true.
- THE BOOT TODAY: `apps/web/src/shell/boot.ts` (its header is the current shot list: point → gather → sphere → name → greeting →
  land, 3.9 s, kinds full / short / still / flat / warm / quiet, the frame budget in `__bootState.budget`, a tap skips, the
  sound from WebAudio only with the voice setting on). `tests/boot.spec.mjs` (487 lines) and `tests/hero.spec.mjs` check its
  phases, timings, the landing on Home's real Mind and the skip; `tests/routec.spec.mjs` opens the app round it. These specs
  are RE-CUT to the new storyboard (every phase name and timing they assert changed to the new ones, measured), never loosened:
  the same things stay asserted (order of frames, a usable Home under three seconds, the skip, Reduce Motion's short version,
  the landing on the same Mind, the budget).
- THE NEW SHOT LIST (the orb and the world in it; keep every shot true of that moment): (1) the ground, nothing else, one breath;
  (2) the world's floor forms (The Scan: the points sampled in from one corner; The Map: the grid drawn line by line and the
  crosshair finding centre; The Eye: the grain settling and one box; One Ink: one rule drawn; Glass: the blur clearing);
  (3) the orb forms from his library's points (today's gather, kept, on the floor); (4) the stamp line types itself in mono
  (the day · the time · his saved place · WATCHING n FEEDS when online, OFFLINE when not: the real facts from `ui/machine.ts`
  `stampLine`); (5) the feeds answer: one short truth line each as they connect (only the ones that really did); (6) the
  recognition: the reticle snaps onto the orb with the tone (the sound switch and his sound setting respected), G H O S T Y
  under it; (7) the greeting, his line, in his voice when the phone allows; (8) the orb eases up into Home's hero (the same
  Mind) and the HUD slides in. Under three seconds to a usable Home; the storyboard says the time of each shot.
- THE LOOK's MIND SECTION shows the hologram, not the points-sphere eye: one WebGL context stays the rule, so the section
  borrows the live Mind the way the boot does (never a copy), or draws its five states as stills when the Mind is on Home;
  `ui/eye.ts` is retired from THE LOOK (kept in the tree only if something else still imports it; say which).
- STORYBOARD FIRST, IN TWO RUNS: run one (this launch) renders the storyboard only: eight to ten frames at 440 × 956 as PNGs
  under docs/build-plan/mockups/boot/ (one contact sheet, `contact.png`, plus the frames), built the way
  docs/build-plan/mockups/hero/render.mjs builds its frames (Playwright is installed; stand-in fonts from mockups/fonts), on
  Graphite · Reactor · The Scan, with one extra frame each for The Map and Paper (night ground) to show the world and the ground
  in it, and a README saying the time of each shot and what is true in it. It commits and reports; the orchestrator sends the
  sheet to the owner; run two builds without waiting for his answer (his rule: never wait), and his notes, if any, are a re-cut.
- RULES THAT HOLD: the prompt guard, the CI guard job and check.yml untouched (no new spec: the boot spec is re-cut in place);
  never a model name; no packages; nothing from the network; commit before every heavy step and write each validation result to
  the scratchpad file as it lands (container restarts happen).
