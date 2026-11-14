# THE PRO ROUND: DATA lane report

All curation sits in `packages/shared/src/applib/catalogue/pro.ts`, which every family file runs its apps through.
Extra first-run records live in `catalogue/samples.ts`.

## What landed
- **Tier:** every app now has a tier. 284 of the 664 are essential, including all 45 of Ghosty's own screens. The other 380 are
  `more` and show under MORE APPS.
- **Merged near-duplicates:** 10 apps removed, keeping the richer one each time:
  - tipping into tip-split
  - fuel-cost into trip-fuel
  - ev-charge-cost into ev-charging
  - currency into currency-sums
  - colour-contrast into contrast-check
  - hike-log into hikes
  - reading-list into books
  - tempo-converter into tempo-delay
  - game-nights into play-log
  - film-nights into film-diary

  Nothing outside the catalogue referred to any of the removed ids.
- **Bands and explain:** on about 70 calculator outputs, from each calc's own source:
  - NHS: BMI, waist-to-height ratio and alcohol units;
  - EFSA: caffeine;
  - GOV.UK: Stamp Duty, Child Benefit charge, tax on savings, gains and dividends, and the minimum wage;
  - MoneyHelper: emergency fund;
  - WCAG: contrast, including bands on the AA, AAA and large-text pass flags;
  - Environment and Climate Change Canada: wind chill;
  - American Wood Council: beam deflection limits;
  - plus explain sentences on the main money, health and travel answers.

  The quadratic solver's root count is now said in words.
- **Skin and hue:** set only where the family default was wrong:
  - money sums in other families get the money skin;
  - collections such as the cellar, coffee and cocktails get create (gallery);
  - outdoor logs get world, and garden and home get life;
  - 18 apps get their own hue.
- **Samples:** all 121 essential log and importer apps open with 5 to 8 invented, recent records (281 new records).
- **validate.ts:**
  - bands rise in order and only the last band may leave out upTo, with tones good, ok, warn or bad;
  - band words are short, start with a capital, have no full stop and follow the word rules;
  - explain is one sentence of 12 to 140 characters;
  - tier, hue (0 to 359) and skin are checked;
  - the whole Library needs at least 250 essentials, and every screen is essential;
  - samples may now number 2 to 8.

## Not done
- Plain intermediate outputs (such as contrast-check's luminance values and daylight's working angles) have no field to hide
  them. KINDS can drop outputs that have neither bands nor a unit if it wants.
- Samples for apps in the `more` tier are unchanged.
