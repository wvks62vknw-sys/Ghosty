# Scroll audit on the owner's phone size (24 Oct; his words: "there's a few scroll issues which could be fixed")

He is on the 18 Pro Max (440 × 956, Safari, added to the Home Screen). The scroll and safari specs pass in CI, so what
he feels is beyond what they check. Hunt, on a preview at exactly 440 × 956 with touch, in Chromium AND in WebKit
(installed for Playwright at `/tmp/claude-0/wk/browsers`: `PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/wk/browsers`,
`import { webkit } from 'playwright'`; if it is missing here, say so and use Chromium only):
1. Every tab and every panel reachable from it: can the page scroll to the real end (nothing hidden under the floating
   tab bar or the ask bar: the bottom padding must clear them); does a swipe that starts on a card, a map, a chart, a
   list or a sheet move the page or get trapped; nested scroll areas (a list inside a page) that trap the swipe or
   rubber-band wrongly; `overscroll-behavior` where a sheet should not chain to the page; horizontal rows (chips,
   tiles) that steal vertical swipes or scroll the page sideways; sticky headers that jump; the ask bar with the
   keyboard up (`visualViewport`); momentum stopping dead at a panel edge; scroll position lost when coming back to
   a tab; the God's Eye globe and the Lens viewfinder (touch meant for them never scrolling the page, and the page
   still scrollable from outside them); the GYM's long lists; the Library's reader; the deck.
2. Measure before fixing: a list of every rough spot with the tab, the element, what happens, and why (CSS or code).
3. Fix the top ten, smallest change each, with a check added to `tests/scroll.spec.mjs` (WebKit) or a new
   `tests/scrollfeel.spec.mjs` (Chromium, touch) that fails on the old code.
Rules: BRIEF-W0.md; route C stays; no protected files; no new packages; no other feature's logic (CSS and the shared
shell `apps/web/src/shell/*`, `ui/page.ts` are yours; a feature file only for its own scroll container); 44 pt targets.
Report: the measured list, the ten fixes with before/after (pixel numbers), leftovers, every check's exact result.
