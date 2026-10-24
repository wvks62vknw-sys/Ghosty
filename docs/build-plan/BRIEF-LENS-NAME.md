# Lens names plants, birds and insects, and says what is in a meal (PLAN Wave D)

Lens today names everyday things on the phone from name lists (`features/lens`, NAME mode), reads text, scans codes,
measures, and ASK sends the photo to the brain (a model that can see, when one is free). Read BRIEF-W0.md, MAP.md,
`features/lens/index.ts` and its modes, `tools/lens.ts` (the brain side of a Lens ask), how the brain picks a model
that can see (`llm/`), how a key is defined for SYSTEM → KEYS (`apps/edge/src/keys.ts`, protected: give the exact entry
in your report), `tests/lens.spec.mjs`. Everything free; honest about certainty; nothing stored that the owner did not
ask for.

## Build
1. **NAME IT, for living things**: in NAME, when the on-device lists are unsure or the owner taps LIVING THING, the photo
   goes to (a) for plants, Pl@ntNet's free identification API (a free key, 500 requests a day; the SYSTEM → KEYS entry
   says exactly that, how to get it, and that it is free), which returns species with scores; (b) for birds, insects
   and anything else, the brain's model that can see, asked for the species, the common UK name, how sure it is in
   plain words and one tell-tale feature, answered in JSON and checked. The card shows: the name, "about 70 % sure"
   (never a false precision), the tell-tale, a Wikipedia link, and SAVE (into Memory as "seen: a robin, 24 Oct,
   near home" only on tap). Without a key or a model: the card says what is missing and what to do.
2. **WHAT'S IN IT, for food**: a FOOD mode (or a chip in ASK): the model that can see lists the foods and rough
   portions it sees; each is matched to Open Food Facts (free, no key: packaged foods by name) or a small built-in
   table of about 150 common UK foods per 100 g (energy, protein, carbs, fat, from public-domain figures; say the
   source in the file header) for a rough total ("about 650 kcal; rough: portions are guessed from a photo"); a
   barcode in the frame uses the existing scan and Open Food Facts for exact figures. Never a medical claim.
3. **Honesty in the words**: "about", "probably", the confidence from the model's own words mapped to three levels
   (sure / probably / a guess), and "I can't tell from this photo" when it cannot.

## Tests (each must fail on the old code)
Edge: the Pl@ntNet reply parser (fixture), the vision reply's JSON checked and the three levels, the food matcher
against the table and an Open Food Facts fixture, the totals' rounding, the card text. Spec `tests/lens.spec.mjs`
extended at 440 × 956 with the brain mocked (`llm/mock.ts` phrases for a plant, a bird and a meal): LIVING THING shows
the name, the sureness and SAVE; FOOD shows the list and the rough total with its honesty line; no key → the
missing-key words. `npm run check`, the edge tsc, the lens and scan specs, the full edge `npm test` once.

## Finish
Commit per step (do not push, do not merge). Report: files; the KEYS entry text for `plantnet`; screenshots of the three
cards; every check's exact result; anything not done and why.
