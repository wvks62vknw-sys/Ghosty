# PRO-SHELL: the full-screen app frame, identity and skins (THE PRO ROUND, lane SHELL)

The brief is `APPLIB-PRO.md`. This lane makes every Library app take the whole screen like a proper app, gives each one its
own identity, and sets the shared skin tokens the LOG and KINDS lanes draw with.

## What landed
- **The frame (`apps/web/src/features/applib/pro.ts`).** An app opens in `.al-pro-frame`, appended to `<body>`, fixed and
  covering the whole screen above Ghosty's room bar, ask line and page title.
  - It grows out of the icon he tapped. This is a FLIP of the frame's `clip-path` from the icon's box, 380 ms, ease-out with a
    soft settle. With reduced motion it is a 150 ms fade.
  - It closes back into the icon that is on screen (the tile, row, hero or page icon).
  - It runs edge to edge inside the safe areas: the kit app's padding is `max(env(safe-area-inset-*), gutter)`.
  - `html.al-open` marks the page while an app is open.
- **Every way back closes it to the Library.**
  - The back chevron (`.al-back.al-pro-back` in `.ak-head`).
  - The edge swipe from the left 24 px, which follows the finger. Past 35% it slides away and closes; short of that it springs back.
  - The phone's own back. Each open from inside the Library pushes one history entry (`history.state.alApp`).
  - A cold link or an address-opened app closes straight to the Library page under it.
  - The Library page under an app is never redrawn, so its scroll position is kept.
- **The header.**
  - A large title: the 64 pt icon tile, the name and the family. It collapses into a small centred title as the app's one scroll
    area scrolls, and the bar gets a hairline once it has collapsed.
  - The ⋯ menu (`.al-pro-menu`): How it works, Settings, Export CSV, Export JSON, Recently deleted, Make my own (when App Maker is
    in) and Pin to Home or Unpin.
- **Coach marks (`.al-pro-coach`).** These replace the kit's tour banner, which is hidden inside the frame. A dimmed layer lights
  one control at a time: the first thing in the app, its main key, then ⋯. Each has one line from `AppDef.tour`, at most three
  steps, ending with Got it. Finishing them ends the kit's first-run tour, so they show once. ⋯ → How it works plays them again.
  If the kit's tour is ended any other way, the coach marks go with it.
- **Identity.**
  - `FAMILY_HUE` spreads the 11 families round the wheel. `AppDef.hue` overrides it, and `AppDef.skin` overrides the family skin.
  - `--al-accent` is `oklch(var(--al-pro-l) var(--al-pro-c) var(--al-hue))`: each look sets the chroma and each ground sets the
    lightness (0.82 on the dark grounds, 0.45 on Paper), so text keeps 4.5:1.
  - The icon tile (`.al-pro-tile`, sizes s 32, m 52, l 64, xl 88) is a gradient of the accent with the glyph in the on-accent ink.
- **Skins.** `data-skin` is set on the frame and on the kit app (`.ak-app.al-pro-app`), with shared tokens per skin. The Library
  rows, chips, featured hero and app pages carry their own app's identity too.
- **The Library at App Store class.**
  - **The front page:**
    - a featured hero with an 88 pt icon, the name, the pitch and View;
    - Today's picks, with 64 pt icons;
    - Pinned and Recently used;
    - the families as tinted chips;
    - a section per family with large-icon rows and an Open pill;
    - MORE APPS for `tier: 'more'`, also at `#apps/more`.
  - **A family page** puts its essential apps first, then its MORE APPS.
  - **An app's page** has a tinted hero with its 88 pt icon, then Open, Pin to Home and Make my own. Below that come a picture of
    the app at work (`.al-pro-shot`, drawn in its skin from what it keeps), What it keeps and How it works.

## For LOG and KINDS: what to draw into
- **The kit app** is `.al-pro-frame .ak-app.al-pro-app[data-skin]`. Draw into `k.body` as before; the frame, header and menu are SHELL's.
- **Specs** now find an open app at `.al-pro-frame .ak-app`, not `#pg-apps .ak-app`. To end the first-run tour in a spec, click
  `.al-pro-frame .ak-tour:not([hidden]) button` until it is gone, or the coach marks will stand over the keys.
- **Tokens:**
  - `--al-accent`, `--al-accent-soft` (a tint for fills), `--al-accent-line` and `--al-on-accent` (text on an accent fill);
  - `--al-pro-gap`, `--al-pro-rowpad` and `--al-pro-rowh`;
  - `--al-pro-cardr`, `--al-pro-keyh` and `--al-pro-heronum`;
  - `--al-pro-face-num` (mono in maker);
  - `--al-pro-t-large`, `--al-pro-t-hero`, `--al-pro-t-name` and `--al-pro-t-small`.
- **Anatomy:**
  - `.al-pro-hero` holds `.al-pro-herok` (kicker), `.al-pro-herov` (the big number), `.al-pro-heros` (one sentence) and `.al-pro-herotrend`.
  - `.al-pro-row` holds `.al-pro-rowic` (a round icon, initials or photo), `.al-pro-rowmain` (with `b` and `small`) and
    `.al-pro-rowval` (right-aligned and tabular).
  - Also: `.al-pro-card`, `.al-pro-chip` (44 pt, with `aria-pressed` filled), `.al-pro-key` (a big tactile key),
    `.al-pro-section`, `.al-pro-sechead`, `.al-pro-list` and `.al-pro-fill`.
  - `.g-key.fill` in the frame is filled with the accent automatically.

## The spec: `tests/applibpro.spec.mjs`
Its word is appended at the end of `all=` in `check.yml`. It checks:
- the cover (a grid of points all in the frame) and the FLIP animation;
- back, swipe (short springs back), phone back and a cold link;
- the collapse;
- the coach marks (once, three steps, and again from ⋯);
- the ⋯ menu items, with Pin and Recently deleted driven;
- accents distinct across families;
- 4.5:1 text contrast;
- 44 pt keys, nothing sideways and no word cut, on the frame and the front page.

It runs at 440 × 956 and 390 × 844 in all seven looks, plus Paper for the frame. It saves `applibpro-<skin>.png` for each skin
that has an app, plus the Library at 390 in each look.

## Known and left
- **The Library page under Paper:** the shell stands today's rooms on the night floor (`--g-room-canvas`) while Paper's inks are
  dark. That is the shell's, not the Library's, so the Library under Paper reads poorly. The app frame paints its own canvas, so
  apps are right on Paper.
- **`applibplay`** (the game launcher frame) still draws its own; KINDS owns the launcher.
