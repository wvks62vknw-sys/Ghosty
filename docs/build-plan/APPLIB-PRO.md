# THE PRO ROUND: every app in the Library feels made by the best company in its field

The owner, on the Library as merged in #125: "they're all disappointing in pretty much every way, the look the feel they need
to feel like a multi billion dollar company made every single individual one like one that specialises in each of those things,
and they don't even fill up the screen and like take you away like a proper app kinda thing".

He's right. Today an app opens inside the Apps page, under its big "Apps" title, with Ghosty's room bar still showing. Every app
has the same colour, icon, list and keys, and the tour is a permanent banner. Calculators are bare form boxes ("Over 25: 0"),
and trackers are plain rows with a cross on each. All 675 apps share one engine (`apps/web/src/features/applib/`), so fixing the
engine fixes every app at once. That is this round.

## Budget and time
- The owner is at 83% of his weekly usage, and everything must end under about 93%. That is four lanes for about 90 minutes.
- **Hard stop 20:30 UTC**, with every lane's last fast-forward and report by then.
- Use targeted specs only, plus the brain suite before each fast-forward. Never run the whole spec set.

**Integration branch:** `claude/new-session-4erjve-pro` (from main). Land the same way as before:
1. Merge it into your lane.
2. Run `npm test`, which must be fully green, plus your spec.
3. Push your lane, then `git push origin HEAD:claude/new-session-4erjve-pro`.
4. If the push is refused, merge again and retry.

The new optional fields are already in `packages/shared/src/applib/types.ts`: `AppDef.tier`, `AppDef.hue`, `AppDef.skin`, `CalcOutput.bands` and `CalcOutput.explain`.

## The bar (what "made by the best company in its field" means here)
Judge every screen at 440 × 956, the owner's iPhone 18 Pro Max, in WebKit-like terms (no hover, touch only), in every look.
1. **It takes you away.** Tapping an app's icon grows that icon into the whole screen: a FLIP from the icon's box, about 380 ms,
   ease-out with a soft settle (reduced motion: a 150 ms fade). While an app is open, it is the only thing on screen. Ghosty's room
   bar, ask line and page title are hidden. The app runs edge to edge inside the safe areas (`env(safe-area-inset-*)`).
2. **It leaves like a real app.** It closes with the back chevron, an edge swipe from the left (the app follows the finger;
   past 35% it closes, otherwise it springs back) or the phone's own back. Each closes back into its icon. Every app open pushes one
   history entry, so back always works.
3. **It has its own identity.**
   - **Icon:** a large rounded-square icon, 64 pt on its page and in its header. It is a gradient of its accent with the glyph in
     the look's on-accent ink.
   - **Accent:** comes from its family's hue (or `hue`). Each look's tokens decide lightness and chroma, so text keeps 4.5:1 in every look.
   - **Name:** a large title that collapses to a small centred title as you scroll, like the phone's own apps.
4. **It is laid out like a specialist's app:** each family has its own skin (`data-skin`; `AppDef.skin` overrides it).
   - **money:** like the best bank apps. A big total hero; transaction rows with a round category icon and right-aligned
     tabular amounts, grouped by day; and a spending bar.
   - **body:** like the best health apps. Rings and metric tiles at the top, and trend cards with a sparkline and "up 12% on last week".
   - **office:** a clean document feel, with airy rows, quiet type and generous spacing.
   - **create:** gallery first, with big image cards (his photos, or the glyph art), masonry where it fits.
   - **games:** a launcher. A big art tile with PLAY, then best, streak and today's chips.
   - **learn:** a course feel. Progress at the top, lesson and card stacks, and a streak.
   - **world:** travel. Destination cards with big type, and a place or day timeline.
   - **tools:** a utility. A huge readout and big, satisfying keys.
   - **life:** warm. Initials avatars and soft cards.
   - **maker:** technical. Monospace readouts and fine grid lines.
   - **data:** insights. Story cards with one big number and one sentence each, swipeable, like a year-in-review.
5. **It shows the answer first.**
   - **Calculators:** one big live answer, said in words where `bands` gives them ("22.9 · Healthy weight"), with `explain` under
     it. Inputs are sliders with steppers and unit chips, not bare number boxes. A raw boolean or "0" never shows. KEEP saves results
     to a history.
   - **Trackers:** the hero stat big at the top, with its trend.
6. **Rows are rich.** Photo thumbnails, stars, chips and a right-aligned value. Swipe left to delete (undo in the notice) and
   right for the app's main action. A tap opens the item's own page: big photo, fields as a clean sheet, Edit. There is no cross
   on every row.
7. **Adding is effortless.** A quick-add bar understands plain words ("Rioja 2018 £14.50 4 stars") and fills the fields. The full
   form sits one tap away.
8. **The tour is one-time coach marks.** A dimmed layer lights one control at a time, with one line each, three steps at most,
   and "Got it". It replays from ⋯ → How it works. It is never a banner.
9. **Every state is designed.** Empty states have an illustration from the glyph and one inviting line. Loading uses skeletons
   in the final layout. Charts have rounded bars, labelled axes and a highlighted today.
10. **Motion and type are crisp.** Sections fade and rise slightly on enter, with springy taps (a scale of 0.97). Type follows the
    look's scale. Numbers use tabular figures. Nothing is cut, nothing runs sideways, and every key is 44 pt.

## The lanes (no lane edits another's files)
| Lane | Branch | Owns |
|---|---|---|
| SHELL | `…-pro-shell` | the full-screen app frame (open and close animation, edge swipe, history, hiding Ghosty's chrome), the collapsing large title and header, the ⋯ menu, coach marks, the identity system (accent from family or hue, the icon tile), the 11 skins' shared tokens and CSS (`al-pro-*` styles block), the Library screen's own polish (the App Store-class front page, app pages with screenshots of the app's hero, sections, MORE APPS), and the `applibpro` spec |
| LOG | `…-pro-log` | the log and importer views: the hero and trends, rich rows, swipe actions, the item page, quick-add parsing (in `packages/shared/src/applib/quickadd.ts`, with brain tests), the board, calendar heatmap and gallery masonry, and charts. It follows SHELL's skins and tokens. |
| KINDS | `…-pro-kinds` | calc (the answer-first layout, bands, explain, sliders and steppers, units, history), checklist (a progress ring and sections), timer (a big ring countdown), counter (big tactile tallies), deck (flip cards with swipe), guide (an article reader with contents), and the game launcher frame (the boards stay PLAY & MAKE's) |
| DATA | `…-pro-data` | catalogue data across all families: `tier` (the essential 250 to 300 lead, the rest MORE APPS), merging near-duplicates, `bands` and `explain` for every calc where a band or meaning exists (from the same public sources), `hue` and `skin` where the family default is wrong, and better first-run samples |

SHELL lands its frame and skins' tokens first, by 19:40, so LOG and KINDS draw inside it. Until then they build against the old
frame and keep their parts self-contained.

## Rules (never broken)
- Only his own data and public sources. Nothing costs money, no keys, no network for the apps.
- Never weaken or skip a test. Update a spec only to the new screen, and just as strictly.
- Protected files stay untouched. `.github` only gets spec words at the end of `all=`. Never raise the prompt guard.
- No model names in code, comments, tests, docs or PR text.
- British English, no emoji. Every colour is a token.
