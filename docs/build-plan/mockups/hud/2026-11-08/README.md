# W1 THE SCAN as a whole HUD — pictures before code (8 Nov; BRIEF-HUD-MOCKS)

His words this round was drawn to: "with the mind i just meant the orb kinda thing in the middle" (131); "something that hasn't
been seen before" (136); "make it actually feel like that ... modern and clean not like AI slop" (137); "i don't like how dark it
looks ... very easily navigated ... nothing clunky or hard to read ... things in places where you'll never find them" (139); every
thing usable and findable, no page listing every ability (143); "every theme as like a whole different hud as a whole like even
the tabs are different" (155); the way round "a mix of the last two", the cinematic "longer, richer, the world assembling the
scan building up and the feeds answering ... polished like a high grade app", the Lens "it should just know" (156).

Every frame is 440 × 956 at 2×. Every colour, size and duration is a token of `apps/web/src/design/tokens.css` (loaded first);
the marks are the design system's own `.g-*` rules (copied from `apps/web/styles.css` THE SYSTEM into `hud.css`); the room is
W1's scan (`scan.js`, grown from `directions-2/w1/room.js` by three uniforms and nothing else); the orb in the middle is the real
hologram (the boot storyboard's `orb.js`, `mind.ts` ported, drawn with the app's vendored three.js). Nothing here ships.

| File | What |
| --- | --- |
| `contact.png` | the one sheet, reading top to bottom: 1 Home by the hour · 2 the way round · 3 the Learn room and Every screen · 4 Settings and the Theme page · 5 the Lens that just knows · 6 the boot (twelve frames) |
| `home-morning.png` `home-commute.png` `home-evening.png` | Home at 07:12, 07:16 and 21:08 |
| `home-evening-paper.png` | beyond the brief, one frame: the same Home on the Paper ground, so "how light" can be answered with a picture (question 2) |
| `nav-house.png` `nav-jump.png` `nav-typed.png` | the way round: the house unfolded, the jump bar, the typed word (the resting state is `home-evening.png`) |
| `learn.png` `deck.png` | the Learn room; Every screen |
| `settings.png` `theme.png` | Settings; the Theme page cut to HUD · colour · ground |
| `lens-1.png` … `lens-4.png` | a page of print; a sign in French; a known person, a stranger and a code; a mug |
| `boot-01.png` … `boot-12.png` | the richer boot, one frame per beat |
| `build.py` `hud.css` `hud.js` `scan.js` `boot.js` `render.mjs` | how they were made (below) |

## What each sheet shows

1. **Home by the hour.** The orb in the middle of the room, as he decided (131). The stamp line at the top is the Machine's point
   of view: SUN 8 NOV · 07:12 · BIRMINGHAM · WATCHING 3 FEEDS · LOOKING AT HOME (`stampWords` as the real component writes it;
   the day and the time from the clock, his saved place, never live GPS). Under it, what I say first and one sentence more. The
   things he uses are marked in the room the way the Machine marks a thing: a reticle he can press, its tag above (the clock for
   a recent, the star for a favourite), one true line below. NOW is the thing of the hour, lit in his colour with a callout and a
   leader: the morning's Brief (the folded paper on the desk), the commute's journey (the window onto Birmingham), the evening's
   book (open on the desk). Along the bottom, the house: the tab bar of this HUD, drawn as the Machine draws a building (a plan
   with door gaps, the room he is in lit), then the ask line with the mic.
2. **The way round** ("a mix of the last two", 156: a navigation that belongs to the world AND the finding rule held).
   At rest: recents and favourites are things in the room, one tap. The house along the bottom: seven rooms, one tap each.
   One tap on THE HOUSE unfolds the plan: every room with its things numbered 01, 02, 03 (the Machine's index), the room he is in
   lit, 45 screens on one visible surface; a tap on a thing goes there. The ask line is the jump bar: a tap raises FAVOURITES and
   RECENT above the keyboard; a typed word is the search: CHECKED HOME · SEE · MAKE · LEARN · FOUND IN PLAN, the box locks on
   RADIO · 04 with OPEN, and words that match nothing go to me as a question.
3. **The Learn room and Every screen.** The room as a band with every thing in it reticled and numbered; AT HAND (recent and
   starred) open with their two readings; THE REST folded in a grid with one line each; IN THE WORKS in amber. Every screen is the
   Machine's inventory of the whole house as a list: FAVOURITES, RECENT, then each room's things with their numbers and one true
   line; it scrolls; a number, a word or a question goes in the ask line.
4. **Settings and the Theme page.** Settings is a page brought to the front of the room (a strong plate on the dimmed scan), its
   rows numbered and grouped. The Theme page holds three choices and nothing else (155): THE HUD (The Scan, you're in it; The
   Map, The Eye, One Ink coming; Glass, today's look), THE COLOUR (the twelve, each swatch in its own accent), THE GROUND (black,
   the lit grey, paper).
5. **The Lens that just knows.** No key rows (156). The viewfinder is the whole screen, the picture quietened to the Machine's grey
   with the scan's grid on the table; the stamp says LOOKING AT A LETTER; one reticle per thing with its tag; one line under the
   viewfinder at most. A page of English print: the words shown beside it as I read them, the first sentence lit, a tap on a
   word and I read from there. A French sign: EMERGENCY EXIT drawn in the sign's own place, the original under it, a tap and I say
   it. Two people: MUM (he introduced her), SOMEONE I DON'T KNOW and nothing else (the boundary: a stranger is never identified,
   faces never leave the phone), and the code in the corner opened as what it is, A LINK · THE MENU. A mug: named and measured;
   a tap asks about it; "measure it" and the rest are words.
6. **The boot, longer and richer:** twelve frames below.

## The way round: how every screen is reached (the finding rule, 143)

The house has seven rooms (the tab bar: HOME is the hall, SEE, MAKE, LEARN, PLAN, LIFE, ME) and every screen is a thing in one
of them. The registry has 46 screens today (FACTS-SHELL 1.8): 7 hubs, 37 area screens, 2 inside another (the reader in the
Library, THE LOOK in Settings). The Abilities page is withdrawn as a way in (143; BRIEF-SHELL pass 1), so 45 remain, and they are
the 45 on the house plan: 7 rooms + 36 things + the 2 inside (the origin and Every screen are rows in Me, counted with Me's
things in the plan, not registry screens).

| How | Taps | Which screens |
| --- | ---: | --- |
| A thing in Home's room (the reticle) | 1 | the recents and favourites of the day (Library, God's eye, Brief, Lens, Agenda, Gym, Courses) and the thing of the hour |
| A room on the plan | 1 | the 7 hubs |
| A room, then a thing in its inventory | 2 | every one of the 36 area screens |
| A thing inside a screen | 3 | the reader (LEARN, 05 LIBRARY, the book), THE LOOK (ME, 02 SETTINGS, the Theme row) |
| THE HOUSE unfolded, then a thing | 2 | every one of the 36 |
| The jump bar: tap the ask line, tap a row | 2 | favourites and recents |
| The typed word | 1 tap + a word | every screen (the search locks on it; OPEN or return) |

Ten counted from Home: the Brief 1 (NOW, or the paper on the desk); Library 1 (the shelf) or 2 (LEARN, 05); Radio 2 (PLAN, 04);
Convert 2 (MAKE, 06); Settings 2 (ME, 02); Social 2 (ME, 05); Household 2 (LIFE, 08); the reader 3 (LEARN, 05 LIBRARY, the book)
or 1 in the evening (NOW); THE LOOK / Theme 3 (ME, 02 SETTINGS, 01 THEME); Lens 1 (starred in the room) or 2 (SEE, 02). Nothing
is over three; recents and favourites beat the rule (one tap); every screen is on a visible list (its room's inventory, the
house plan, Every screen) and reachable by one typed word.

## The boot: twelve frames, 4.3 s to a usable Home, skippable at any tap

The world assembles in the order the Machine would record it: the ground, the scan sampling the room in, the edges, the things
found, the orb forming in the middle, the stamp, the feeds, the recognition, the greeting, Now, the landing. TAP TO SKIP sits
small by the thumb from the orb's first light to the recognition; a tap at any moment cuts to shot 12. Under Reduce Motion the
whole is two stills (the room whole with the orb, then Home), 1.2 s, as the old cut's STILL kind.

| Beat (starts at) | Pace | What happens | The sound (option A, the tone only · option B, the short score) |
| --- | --- | --- | --- |
| The ground (0) | one breath, 500 ms ease-out | the lit graphite, the room's light breathing in where the orb will be | A silence · B a low pad fades in |
| The scan builds (300) | 1,300 ms, quick out and settling (ease-out-quad) | the points sampled in from the back-left corner, a brighter front where the scan is now | A silence · B the pad rises a fifth with the front |
| The edges (900) | 700 ms | the hairline edges drawn a step behind the points | — |
| The room is found (1,200) | seven things, 140 ms apart, each a 160 ms lock | each thing snaps into its reticle with its tag: Library, God's eye, Agenda, Lens, Brief, Gym, Courses | A silence · B a soft tick per thing, falling in pitch |
| The orb forms (1,400) | gather 640 ms, the sweep at 240–540 ms, the sphere resolves 1,650–2,220 ms, the camera pushes in 1.45× → 1 | his library's points drift out of one point of light in the middle and gather into the constellation; the meridians catch the light one after another; the rim closes last | A silence · B the pad opens to a chord |
| The stamp types (1,900) | 10 ms a character, 470 ms for the line | SUN 8 NOV · 07:12 · BIRMINGHAM · CHECKING FEEDS with the block cursor | A silence · B a faint typing tick under the cursor |
| The feeds answer (2,500) | one lock (160 ms) apart; the window lights over 600 ms | FLOOD, WEATHER, CRIME, one truth line each; the city outside the window resolves as they answer; the stamp becomes WATCHING 3 FEEDS | A silence · B three soft ticks, rising |
| The recognition (3,000) | the lock: 14 px wider closing over 160 ms, the lock curve | the box snaps onto the orb in his colour; G H O S T Y under it; the feeds' lines go | A one short tone · B the tone, the pad stops with it |
| The greeting (3,300) | 160 ms in | Good morning, Boss. (spoken now if the phone allows sound, else on the first tap) | A spoken · B spoken |
| Now (3,450) | three stops, 130 ms apart, the last a lock | the search: the box checks the shelf, the desk, and locks on the Brief; its callout follows | A silence · B nothing: the voice is talking |
| The landing (3,950) | 150 ms out, the HUD 300 ms up a beat (110 ms) later | the box and the name go; the stamp gains LOOKING AT HOME; the house and the ask line slide up | — |
| Home (4,300) | — | usable; the same frame as home-morning.png to the pixel | — |

The finish: nothing travels at the end. The orb forms where Home keeps it (131), so there is no flight into a hero box; the
landing is only the marks on the orb leaving and the HUD arriving. iOS keeps a cold open silent until a tap, so option A is what
he would hear most mornings anyway; the recommendation is A by default with B behind his Sounds setting (question 14).

## Questions for him (the recommendation first in each)

1. **The house as the tab bar.** The seven rooms along the bottom (HOME, SEE, MAKE, LEARN, PLAN, LIFE, ME) replace today's six
   areas and the avatar: Me is a room like the others, and the plan is drawn as a building, not as icons. I recommend it: it is
   the tabs drawn the world's way (155) and nothing is lost. The other way keeps the avatar for Me at the top.
2. **How light.** Everything is on the lit graphite (#101317, the tokens' default) with the room's points lifted and an ambient
   light the orb does not cast, so no surface falls to black; `home-evening-paper.png` shows the other end. I recommend the lit
   grey as drawn, with Paper one tap away on the Theme page; if the room still reads dark to him on the phone, the next step up
   is the plates (one token, `--g-plate`), not the canvas.
3. **The stamp line wraps to two lines at 440** (SUN 8 NOV · 07:12 · BIRMINGHAM · / WATCHING 3 FEEDS · LOOKING AT HOME), as the
   real component wraps, whole segments. I recommend leaving it: two lines of mono at the top is the Machine's log. The other
   way shortens the day to SUN 8 and drops WATCHING to a number (3 FEEDS) so it fits one line.
4. **The orb's size.** 164 px across, in front of the window, the eye of the room. I recommend it; smaller (120) frees the window
   for God's eye's city, larger (220) crowds the shelf and the calendar.
5. **The marks in the room: seven things tagged at rest.** Library, God's eye, Lens, Agenda, Brief, Gym, Courses, each with a
   tag and the clock or the star. I recommend seven as the most the room should carry (W1's own density); the other way shows
   only NOW and the favourites, with recents in the jump bar only.
6. **NOW as a callout with a leader** (the tag, the name, one true line, lit, a hairline to the thing). I recommend it over a card
   under the orb: it keeps the thing in the room and the words at the edge where the thumb is.
7. **The house unfolded: 40 pt rows, not 44.** Three columns of things at 13 pt mono so all 45 fit on one surface without a
   scroll; the rows are 40 pt tall where the floor says 44. I recommend accepting 40 here (a tap target four points short of the
   rule, on one screen, to keep the whole house in one look); the other way scrolls the house or drops the numbers.
8. **Numbers are fixed per room** (05 LIBRARY is always 05 in Learn), so "open five" means the same thing every day; the hub shows
   AT HAND first but keeps the numbers. I recommend fixed numbers; W1 renumbered by what was at hand.
9. **The jump bar's rows.** FAVOURITES then RECENT, as keys with their numbers; hold a thing to pin it. I recommend favourites
   first (his order, up to six); the other way puts RECENT first because it changes more.
10. **The typed word's answer.** The search says which rooms it checked and locks on the one it found, with OPEN; a word that
    matches no screen goes to me as a question. I recommend showing the one best match only; the other way lists every match
    (at "rad", Radio and the Reader) as numbered rows.
11. **The Learn room's band.** The room as a band at the top (a third of the screen) with the inventory under it, as W1 drew the
    hub. I recommend keeping the band: it is what makes a hub a room and not a list; the other way is the list alone with the
    room's small orb at the top, which fits two more rows.
12. **Every screen as a list, the house as a plan: both, or one?** I recommend both: the plan is one tap from anywhere (the
    switcher), the list lives in Me and scrolls with a true line per screen. If one, the plan.
13. **The Lens's one line.** Under the viewfinder: what it is, one fact, then the one act in his colour (A LETTER · ENGLISH · TAP
    A WORD TO HEAR IT). I recommend this line always present (it is the Machine's truth line), never a key row; the other way
    drops it and leaves the tag alone, with the act on the tap unsaid.
14. **The boot's sound.** A, the tone only at the recognition (today's), or B, a short score (a low pad under the scan building,
    a tick per thing found and per feed, the tone, silence for the voice). I recommend A by default and B as a Sounds choice; iOS
    keeps a cold open silent until a tap either way.
15. **The boot's length.** 4.3 s to a usable Home (today 2.88, his words: longer and richer), under five as asked. I recommend
    4.3; if it wears after a week, the lean cut drops the edges beat and the search (3.6 s) without losing the shape.
16. **The feeds' lines go at the recognition** (the stamp keeps WATCHING 3 FEEDS). I recommend that, as the old cut did; the other
    way keeps them on Home as the window's truth lines.
17. **"Household" for the Life screen the deck calls "Home".** Two things called Home in one house would fail the five-second test;
    I recommend Household (bins, bills, meters). The other way is HOME ADMIN.
18. **The HUD tiles say COMING for The Map, The Eye and One Ink.** I recommend showing them now, greyed, so the page says what a
    HUD is; the other way shows only The Scan and Glass until the next HUD lands.

## The gaps (what the plan misses or the app does wrong against his words)

1. Today's Home has no stamp line, no NOW by the hour and no way round but the six icons: none of 139's three benchmarks is on
   the first screen he sees (FACTS-SHELL 2: "Home follows nothing by hour").
2. The deck's promises say "he" ("he gets it done", "he names what he sees") where the bar says ONE VOICE, "I" (STANDARD 5);
   every line in these mocks is "I", and the deck's words need the same pass.
3. Two screens are called Home (the Life screen `homeadmin` and Home itself); the house cannot have two halls (question 17).
4. The Abilities page is still a tab in Me today (FACTS-SHELL 3: "it exists today"); 143 says it is not the way in. These mocks
   leave it out of the house; pass 1 of the shell withdraws it.
5. There are no favourites in the app at all (FACTS-SHELL 1.3: "NO favourites of screens anywhere"), so "favourites in two taps"
   has no feature behind it yet; the star on seven things here is the design, not the code.
6. The six-area bar, the deck's five groups and the Me sheet are three hand-kept lists that disagree (Learn and Plan share a deck
   group; the Me sheet has rows the Me hub does not): the house is one list, and the code needs one too.
7. Thirty-eight screens have no sentence of their own for LOOKING AT (FACTS-SHELL 1.7); every tag in these mocks assumes one.
8. The feeds' count is written three ways (the look, the boot, the reader); the stamp on every screen here assumes one source.
9. The Lens on main (PR #67, the stopgap) still has a key row under the text box; 156 says no key rows and no overlay saying
   translate: the four frames here are the design, and the acts' code stays while the chooser goes.
10. A stranger's face: today's people mode names faces from his store and shows "FACE" otherwise; the words must be SOMEONE I
    DON'T KNOW and nothing else, said in the tag, so the boundary is read, not inferred.
11. The Theme page today carries dials, switches and worlds-on-a-few-pages (147); 155 cuts it to three choices and this mock
    is that page; what the dials did (glow, floor, corners, readings, body size, motion) needs a home or goes (STANDARD: say so).
12. The current W1 mock's Me room does not exist (W1 drew Home and Learn only); Settings and Every screen here are pages brought
    to the front of Home's room, and a Me room (and the five other rooms) still have to be designed: W1's own cost, about a room a
    day (its README: "about 12 days" for the room shell).
13. The boot's landing today flies the orb into a hero box 2.88 s in; with the orb in the middle of Home there is no flight, and
    `tests/boot.spec.mjs`'s "lands in the hero's box to the pixel" is re-cut to "forms where Home keeps it".
14. The hub cards' readouts are two per card today and the Learn room shows two per AT HAND row; the folded rows show one line,
    which `tests/hubcards.spec.mjs` ("two readouts") pins and must be re-cut, never loosened.
15. The house plan's rows are 40 pt (question 7); the 44 pt rule in STANDARD 10 needs a stated exception or a scroll.
16. "Not so dark" has no measure in the plan: W1's lift sheet measured mean L* (4.9 → 11.6). These frames sit on the same lit
    graphite; a number per screen on his phone is the only honest test, and the plan should ask for it in the shell's PR.

## What could not be drawn, and why

- **Motion.** Every frame is one moment; the camera's walk into a room, the tilt, the orb's breathing and the boot's beats are
  described in the tables, not shown. A storyboard at 440 cannot show pace; the README's ms are the design.
- **The other five rooms** (See, Make, Plan, Life, Me) as scans: W1 drew Home and Learn, and a room is a hand-placed scene
  (W1's README). Settings and Every screen stand on Home's room, dimmed, which is honest about where they sit today.
- **The Stage** (the 7:42 drawn through the window) is STATUS item 5, not this brief; the commute frame points at the window and
  says the journey in words.
- **Real camera pictures.** The four Lens scenes are drawings (a letter, a sign, two figures with no faces, a mug) passed through
  W1's Lens shader; no photograph was available offline and no real person may be drawn.
- **The phone's own faces.** Inter stands in for SF Pro, DejaVu Sans Mono for SF Mono (a little wider: the mono lines are tighter
  on the phone), Source Serif for New York; Chromium only, software WebGL.
- **A test with a stranger** (STANDARD 1): the five-second claims are design arguments.

## How they were made

`python3 -I -B docs/build-plan/mockups/hud/2026-11-08/build.py` writes the pages; `node docs/build-plan/mockups/hud/2026-11-08/
render.mjs all` photographs them (a tiny static server serves the worktree; Playwright's bundled Chromium with software WebGL
draws W1's raymarched room through `scan.js` in bands, then the real hologram through the boot's `orb.js`, then sets
`__frameReady`); `render.mjs contact` writes the sheet. The renderer prints anything he could press under 44 × 44, any type under
12 px and anything wider than the screen; the house plan's 40 pt rows and the Learn band's numbered reticles (28 px, not
pressed: the rows are) are the reports left standing, said above. One frame takes about six seconds here.
