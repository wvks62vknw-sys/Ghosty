# Websites: the lift (OWNER-ISSUES 5, PLAN Week 2)

The owner: "websites still could be better." The builder exists (`apps/edge/src/sitebuild.ts`, `sitekit/`, `tools/sites.ts`,
`build_website` as a Workshop project, the adversarial review's 17 fixes in UPGRADES.md). Read BRIEF-W0.md, MAP.md,
BRIEF-WEBSITES-FIX.md, the kit (templates, blocks, palettes, fonts, photos with credits, the gates), `PAGE_CSP` and the
frame sandbox (never loosened), `tests/websites.spec.mjs`, `tests/sites.spec.mjs`.

## Build
1. **Better templates**: look at the fourteen with a critic's eye on a 440 × 956 phone and a laptop; raise each to a
   premium standard (type scale, spacing, one accent, real photo placement, a hero that reads in one glance, a footer
   with the real details) and add six kinds the owner would ask for (a tradesperson, a restaurant with a menu, a
   personal CV, an event with a map link, a local club, a product launch); every template passes the gates.
2. **Real forms where the sandbox allows**: a contact form that works without a server: the sandbox blocks scripts and
   network, so forms open the owner's email or WhatsApp with the message filled in (as today) AND, where the owner
   has a free form endpoint set (SYSTEM → KEYS: a free Formspree or Web3Forms address, free tiers only, said so), a
   real POST from the page is allowed by the policy for that one address only: `PAGE_CSP` gets `form-action` for that
   exact origin and nothing else; no scripts. If the policy cannot allow it safely, say so and keep the mailto path.
3. **Faster builds**: measure a `build_website` today (the stopwatch's tool timing or `Date.now()` around the steps),
   then cut the slow parts (fetch photos side by side, cache the palette and font choices, skip a step whose input
   did not change on a retry); numbers before and after in the report.
4. **A better preview**: the DRAFT card shows the page as a phone and as a laptop (two frames), and CHANGE lets the
   owner say what to change in words before confirming.

## Tests (each must fail on the old code)
Edge: the six new kinds pass every gate; the form endpoint policy (the exact origin only; a wrong address refused);
the build timings recorded. Spec `tests/websites.spec.mjs` extended at 440 × 956: a new kind built and shown as a
draft in two frames; CHANGE; the form's endpoint path with a mocked endpoint. `npm run check`, the edge tsc, the full
edge `npm test` once, the websites, sites and studiomake specs. Say any protected-file line (a KEYS entry for the
form address; `PAGE_CSP` lives where? if protected, the exact line).

## Finish
Commit per step (do not push, do not merge). Report: before/after screenshots of three templates; the build timings
before and after; files; every check's exact result; anything not done and why.
