# FACTS-SHELL: what the next brief (THE SHELL REDESIGNED) stands on

Read from the code and the plan files on 7 Nov 2026 (HEAD 050e7b9). Facts only: file:line everywhere, short quotes. Paths are
under apps/web/src unless they start with tests/, docs/ or packages/. "styles.css" is apps/web/styles.css (6,375 lines).
The brief asks for README.md in directions-2/; it is at docs/build-plan/mockups/directions-2/w1/README.md (69 lines).

## 0. THE ASK, in the plan's own words

- STATUS.md:308-312 (section 4, item 4): "THE SHELL REDESIGNED (STARS 160–161; PLAN-STARS 3b): the bar, the hubs, the deck, Home
  following the hour, Mind the orb with the Stage, the switcher and the jump bar, rebuilt to the system; EVERY FEATURE STAYS A THING
  HE CAN USE AND FIND, as a tab or a row as the shell decides, and NO PAGE LISTING EVERY ABILITY (OWNER-ISSUES 143) ... the finding
  rule — two taps for recents and favourites, three taps or one typed word for everything else; the other screens migrate to the
  system as their passes touch them (item 7), each migration said in its PR. 3–4 days for the shell; the full migration is weeks".
- STATUS.md:287 item 1: (a) round one rejected (135, 136), round two W1 chosen (138, 139); (b)(c) the tokens, the marks, THE LOOK, twelve
  themes: PR #60 merged; (d) THEMES-2 (ground, colour, world, switches; 147): PR #62 merged; (e) the orb and the boot (142, 148, 149):
  PR #63 merged, main run 343 green. All five are FINISHED; the shell is what is left of item 1's chain.
- PLAN-STARS.md:55-57: "3b's shell is STATUS section 4 item 4; the other screens migrate to the system as their passes touch them";
  PLAN-STARS.md:67: "3b Applied, area by area (Home, hubs and deck, Ask, See, Make, Learn, Life, Plan, Me)" then 3.6-3.13 (empty states [53],
  skeletons [54], cards alive [55], Home as a living feed with depth [68], first-run moment [70], copy pass [64], gestures [63],
  Dynamic Type / VoiceOver / Reduce Motion / contrast [62]).
- STARS.md:227-237 (160): "THE LOOK REDESIGNED ... Mind kept at the centre ... The finding rule: two taps for recents and favourites,
  three taps or one typed word for everything else (two taps to three hundred things is the clutter he hates ...)". Sizes: "the system
  a day, the shell 3–4 days, the full migration weeks".
- STARS.md:238-239 (161): "A Home that follows the hour: the Brief in the morning, the journey at commute time, the reading in the
  evening, Mind always at the centre. Medium. Folded into 160's Home (5 Nov)."
- STARS.md:250 (163): "Recent and favourite abilities on ABILITIES and in the jump bar; the deck remembers where he was. Small."
- The Stage (the show-me surface, STARS 164 = STATUS item 5, STATUS.md:313) is NOT built. `main#stage` (shell/layout.ts:119) is only the
  container that holds every tab's page. Nothing in the code is "the Stage" in the show-me sense.

## 1. THE SHELL TODAY (apps/web/src/shell/*.ts)

Sizes: tabs.ts 151, areadefs.ts 51, areas.ts 550, hubcards.ts 1,042, launcher.ts 383, layout.ts 186, switcher.ts 189, awareness.ts 131,
boot.ts 1,039, deckcopy.ts 491, cardline.ts 47 (7,000-odd lines with the registry's command file).

### 1.1 The registry and go()
- Registry: `const defs: TabDef[] = []` tabs.ts:74; `registerTabs(list, stageEl)` tabs.ts:78; `tabs()` tabs.ts:83. The list is
  `TABS` in features/index.ts:51 (39 feature tabs then `...HUB_TABS`). Registered once in main.ts:136.
- `go(id)` tabs.ts:122-151: splits "name?arg" (:124), finds by `d.id === name || d.title.toLowerCase() === name.toLowerCase()` (:125),
  returns false for an unknown id (:126). Builds the page once (`build`, tabs.ts:93: `div.pg#pg-<id>`; a mount that throws shows
  "This tab failed to load"), toggles `.on`, sets the 3-D scene (`def.scene`: 'globe' | 'backdrop', :139), `ui.set({tab})`,
  `history.replaceState(null,'',#id)` (:143), `enter()` then `open(arg)`. `leave()` on the old one (:135).
- Addresses that reach go(): the hash (`hashchange`, main.ts:168), the first open (`location.hash`, main.ts:163-164: `if (!go(first)) go('core')`),
  `navTo(id, dir)` areas.ts:86 (sets `data-nav` push|pop|switch for the transition, then go()), links `?open=`, `?do=open:`,
  palette commands `tab_<id>` (commands/builtin.ts:739: one for EVERY tab, group GO, words from deckcopy).
- `TabInstance` tabs.ts:18-32: enter, leave, open(arg), describe(), context() (awareness). `ensureMounted(id)` tabs.ts:115 builds off screen.

### 1.2 TabDef fields that drive placement (tabs.ts:34-72)
- `id`, `title`, `icon` (24x24 path markup), `scene`, `blurb` (a few words under the name in the deck).
- `hub?: boolean` (:44) "An area's hub: left out of the systems deck". Only the seven generated hubs set it (areas.ts:177-190).
- `inside?: string` (:49) "A screen inside another (THE LOOK in Settings, the reader in the Library) ... the systems deck shows that
  screen's card ... and no card of its own". Set on exactly two: `reader` (features/reader/index.ts:17 `inside: 'library'`) and `look`
  (features/look/index.ts:85 `inside: 'settings'`).
- `cardTo?: string` (:54) where a tap on its hub card goes: only the Library, `'library?shelf'` (features/library/index.ts:135).
- `primary?: boolean` (:56) "Shown in the dock on phones": set on five tabs (core, eye, agenda, workshop, brief: features/*/index.ts
  eye:149 agenda:67 workshop:86 brief:25 core:487), but NOTHING reads it now: the bar is built from AREAS (areas.ts:364-368), not from `primary`.
- `now?(): string` (:62) one live line for the deck; "A line ending 'in N min' is due within the hour and lights" (regex `DUE`, launcher.ts:38).
- `instrument?()`, `readouts?()`, `status?()` (:68-70): a tab's own hub card; otherwise the default in hubcards.ts `CARDS` (:302). Only
  arcade (features/arcade/index.ts:180) and markets (features/markets/index.ts:76-81) set their own; the other 36 use `CARDS`.
- `HubCard` hubcards.ts:80-111: title (string|fn), status() LIVE|READY|TRAINING|OFF, instrument(), readouts() (two shown), why(), load(),
  line()+lineTo (God's Eye: `eye?machine`), say(), idle, works ("IN THE WORKS": amber, only on `learning` and `coach`, held by tests/tabs.spec.mjs:11-12).

### 1.3 The six-area bar (areas.ts, areadefs.ts)
- `AREAS` areadefs.ts:20-30: SEVEN entries, each {id,title,sub,icon,tabs[],tint}: ask [core, brief]; see [eye, lens]; make [studio, workshop,
  reverse, space, workbench, convert, docs, house]; learn [learn, arcade, gym, school, library, learning, coach]; plan [agenda, markets,
  threats, radio]; life [money, body, kitchen, people, work, creative, outside, homeadmin]; me [memory, settings, system, links, abilities, social].
  Area tab counts 2,2,8,7,4,8,6 = 37 screens in an area.
- The bar: `buildTabBar(dock, openDeck)` areas.ts:364. `for (const a of AREAS.filter((x) => x.id !== 'me'))` (:366) = SIX buttons
  (Ask See Make Learn Plan Life) in `div.tabcap[role=tablist]`; each `button[data-id][data-area]` with `i.gi` (halo, glyph, live dot).
  Me is not in the bar: it is the round avatar `button.you` in the top bar (areas.ts:~413, placed after `#top .cmd`, :430), opening the Me sheet.
- A tap: `tap(a)` areas.ts:453-460: Ask goes to `core`, tapped again on core to `area-ask`; any other area goes to its hub, or back to
  its hub when already inside the area (`navTo(hubId(a), inside ? 'pop' : 'switch')`).
- Hold 350 ms (`HOLD_MS`, switcher.ts:30; areas.ts:397) opens the quick switcher: `switchItems(a)` areas.ts:491 fans the area's tools (lit
  ones first: status LIVE/TRAINING) as instruments above the bar (switcher.ts:1-11; arc goes to two tiers past five tools per STATUS 121).
  A long press (550 ms) on the avatar opens the deck (areas.ts:~420). `liveIn()` areas.ts:515: live dots (busy, GYM training, school sitting, reverse running, offline brain downloading).
- `areaOf(tab)` areas.ts:56-59 (look maps to settings via `ROW_OF`, :55); `isHub` = id starts with "area-" (:60); `areaHome` :62.
- Recents: `ghosty.recents` in localStorage, 8 kept, not hubs, not `core` (areas.ts:65-83); the palette shows the first 4 on an empty query
  (areas.ts:226-236 `recents:`). There are NO favourites of screens anywhere in the shell (radio favourites in assistant/media are another thing).
- The Me sheet: `openMe` areas.ts:248; rows `ME_ROWS` areadefs.ts:33-45 (memory, settings, system | links, abilities, social, origin, deck "Every screen");
  cards `ME_CARDS` :48 (status, guardian). Me's hub (`area-me`) is also a hub: six cards. The deck opens from the avatar long press, the Me row, the GHOSTY logo (layout.ts:118), the M key (launcher.ts:375).
- Nav bar: `navInfo(tab)` areas.ts:537: roots (core, hubs, memory, settings, abilities, social) have a large title and no back; reader backs to the Library; system/links/look back to Settings; every other screen "‹ <area>" to its hub (:546-550).
  layout.ts:88-115 `paintNav` writes `body[data-tab]`, `data-depth` home|hub|inner. The greeting follows the clock (areas.ts:526 `greeting`: <5 night, <12 morning, <18 afternoon, else evening; boot.ts:176 the same).

### 1.4 A hub and its cards (areas.ts:177-222, hubcards.ts)
- One hub per area, generated: `HUB_TABS = AREAS.map(hubTab)` areas.ts:222. Id `area-<id>` (hubId). `mount` builds `p.hubsub` (the area's plain
  `sub`, or `hubWords(area)` made his from readings: hubcards.ts:979-1016: school stage + rating, next event + weather, city, latest project; `data-personal`),
  a `button.cmdbar` "Ask or jump anywhere" (opens the palette, :188-190), and `div.hubgrid` of cards. Repainted on entering and every 3 s while on screen (:208-214).
- A card = `toolCard()` areas.ts:117-165: `button.hubtile.inst` with `span.ins` (instrument), `span.kick` (bare glyph, name, status dot+word), `span.t` (what it does),
  `span.reads` (two readouts, mono for figures: `isFigure` :113), `span.why` (what to do when it knows nothing), optional `span.hline` and `span.works`. Tap = `navTo(t.cardTo ?? t.id,'push')` (:171).
- Cards per hub = the area's tabs (`areaTools` :168-175), Ask adds "Voice" (MIC, `voiceTap` :102). HUB CARDS: ask 3 (core, brief, voice), see 2, make 8, learn 7, plan 4, life 8, me 6 = 38.
  CARDS table has 38 keys (hubcards.ts:302-978). "every tool a full card, the six-card cap and the More row are gone" (OWNER-ISSUES 121).
- Instruments: ui/instruments.ts (`mindInst`, `gymRingInst`, `dayArcInst`...) imported at hubcards.ts:51; fed by the same stores as the deck's `now()`.

### 1.5 The deck, "Every screen" (launcher.ts, deckcopy.ts)
- Opens full screen `div#deck[role=dialog]` (launcher.ts:145). Cards = `tabs().filter((t) => !t.hub && !t.inside)` (:150) = 46 - 7 hubs - 2 inside = 37.
- Groups `DECK_GROUPS` deckcopy.ts:44-51 (hand-kept ids): "Ask and see" [core, brief, eye, lens] 4; "Make" 8; "Learn and plan" 11 (learn, arcade, gym, school, library,
  learning, coach, agenda, markets, threats, radio); "Life" 8; "Me" 6; anything unplaced goes to a sixth "More" (launcher.ts:272-273, empty today).
  So the deck's groups (Learn and plan) differ from the bar's areas (Learn / Plan).
- Per card: glyph, name, promise (two lines max), one live line (`TabDef.now`, "You are here" on the current), Core's card also carries the awareness mark (:191-192).
  Tap expands one card in place (`expand` :222): miniature `/deck/<id>.jpg` (35 images in public/deck, made by tests/deckshots.spec.mjs), YOU CAN rows
  (`DeckLine.act`: open+panel, run, ask, chat), DID YOU KNOW, "Open <name>". Words for every screen in `DECK` deckcopy.ts:57; TRY THIS NOW: three picks a day (`picksFor` :488, `TRY_DAYS` :444).
- The pill "Go to, or ask…" (launcher.ts:142): filters cards by name or any word of name/promise/blurb/can lines (`matches`: every typed word starts a word, :70, :283-309);
  return opens the first card, else the first YOU CAN line, else asks Ghosty (:311-325); mic dictates. `window.__ghosty.deck` = `deckState` (:47: open, expanded, query, shown, picks).
  A question typed here is answered on Home, carrying the screen asked from for 8 s (awareness.ts:76-85; OWNER-ISSUES 150 c).
- Taps today to a screen via the deck: logo/avatar press (1), tap a card (2: expands), Open (3); or the pill: one typed word + return.

### 1.6 The jump bar and typed words (commands/registry.ts)
- `#palette` opened by the "CMD" button in `#top` (layout.ts:118), the hub's `.cmdbar` (areas.ts:188), Ctrl/Cmd+K or "/" (registry.ts:78 area; button title). `togglePalette` registry.ts:120.
- `render()` registry.ts:143-182: score(q,c) (:98) over all non-hidden commands, top 12, at most 3 per group, then providers for q.length>1: `group 'ASK'` first (ask Ghosty),
  then others ("Fly to", "Read: <title>" etc. via `addPaletteProvider` :116). An empty query lists the 4 recents first (:157-160).
- Every tab is a command `tab_<id>` (group GO) with words = blurb + deck name + promise + every YOU CAN text (builtin.ts:739). So any screen is one typed word + Enter.
- Hub cards and the avatar are the other visible lists. NOTHING else lists screens.

### 1.7 Layout, boot landing, awareness
- layout.ts `buildLayout` :46-186: `header#top` (back, logo, status, now-playing, paused tag, CMD, clock, conn dot, nav title, + `.rcdate` and `.you` added by Home/areas), `main#stage`, `nav#dock.areas`,
  `div#rcoffline` ("Offline · showing what’s saved on this phone"), the deck. `LISTED` (:16) pages drawn as iOS lists: settings, system, links (`listMode`, groups :20-43). Keyboard fitting :154-175. TV mode `startTv()` :184 (bar stands left on 1,920 x 1,080).
- Landing: main.ts:163-164 opens `location.hash` else `core` (Home). boot.ts:246-263 `startBoot`: a deep link or Spotify return plays 'warm' (no cinematic); a cold open at Home plays 'full' (2,880 ms, boot.ts:98 `bootState`; stamp at 1,240 ms with the real facts).
  `reboot()` boot.ts:267 does `go('core')` first. The boot's stamp leaves at the landing: "Home has no stamp line of its own until the shell pass" (OWNER-ISSUES 149).
- awareness.ts: `tabContext` :35 (own `context()`, else `describe()`, else "the <title> screen, <blurb>"), `screenContext` :58 (overlay first: the deck), `lookingAt` :89,
  `clientContext` :98, `awarenessMark` :121. Only EIGHT screens publish their own `context()`: core (features/core/index.ts:981), eye (:1255), lens (:671), library (:791), reader, look, space (:1240), studio (:1005).
  The other 38 registry entries fall back to name + older describe() (30 features define `describe`): this is OWNER-ISSUES 150 (d): "SCREENS WITHOUT THEIR OWN LINE ... I recommend the shell pass gives each of them a line of its own, a sentence each".

### 1.8 COUNTS (from the registry, features/index.ts:51)
| Group | Screens |
| --- | --- |
| Ask: core (Home), brief | 2 |
| See: eye, lens | 2 |
| Make: studio, workshop, reverse, space, workbench, convert, docs, house | 8 |
| Learn: learn (Courses), arcade, gym, school, library, learning, coach | 7 |
| Plan: agenda, markets, threats, radio | 4 |
| Life: money, body, kitchen, people, work, creative, outside, homeadmin | 8 |
| Me: memory, settings, system, links, abilities, social | 6 |
| Inside another (no card, no deck card): reader (in library), look (in settings) | 2 |
| Hubs: area-ask, -see, -make, -learn, -plan, -life, -me | 7 |
| TOTAL registry tabs / catalogue `screen:` entries | 46 (39 + 7) |
Also reachable but not tabs: `origin` is a Me-sheet row opening a panel (areadefs.ts:43), Social is both.

## 2. HOME TODAY (features/core/*)

- Home = tab `core` (features/core/index.ts:480-487: blurb "talk to Ghosty · arc reactor HUD", `primary: true`); `mount` :488 builds `div.hud.core` and `div.ccenter` (:687).
  Files: index.ts 987, mind.ts 1,150, reactor.ts 583, home.ts 411, cards.ts 416, hud.ts 215, wall.ts 139.
- `div.ccenter` children in order (index.ts:687): StarkHud call-outs (`stark.el`), `#lock` (date+time), `rc.wx` (weather line), `rc.hero` (the orb frame with 3 arcs + 4 call-outs:
  Free AI, School, Library, Uplink), `#lockline` (weather, next event), `#cstate` pill ("ONLINE"), `#glance` (phone row), `#ccap` caption, `rc.below` (the WALL then Today, Roads, Gym),
  `#suggest` (three chips), `voiceTag()`, `#cbar` (ask bar: `+`, LOG button `.logbtn`, `input#cin` "Talk to me", SEND, `#mic`, CITED toggle).
- The hero: `routeCHome(reactorWrap)` home.ts:110. Arcs 135-405 deg: outer = free AI left today, middle = library topics read, inner = school subjects passed (home.ts:123-200). Call-outs "Free AI / School / Library / Uplink" (:177-181).
  The orb: Mind (features/core/mind.ts:1-40: hologram sphere, nodes ~ one per 20 library passages, lit by what is read; accent from tokens via `orbTokens()`; FIVE STATES idle, listening, attending, thinking, saying;
  `heroState`, `exposeHero`; 30 fps idle). reactor.ts keeps the old 2-D reactor where WebGL cannot run; tv/flatmind draws it flat.
- The wall (the Now cards): wall.ts:1-30 "the live cards in order of what matters now ... danger first, then what is due within two hours, then today's pieces, then the people's and cars' news,
  then progress — six at most" (`WALL_CAP = 6`, packages/shared/src/cards.ts:448; `wallOrder` :466; rest behind MORE); `EMPTY_WALL` "Nothing needs you right now. When something does, it’s here first." (wall.ts:21).
  Card kit cards.ts:1-12 (MAP, THREE-D, PERSON, CAR, ESTIMATE, LENS, BRIEF, PROGRESS, PLACE; two buttons at most, 180 pt).
- Today card `button.rctoday` (home.ts:~200, opens the agenda), Roads near you `.rcroad` (National Highways within 30 km), Gym tile `.rcgym` (22 game segments).
- The ask bar and chat: `#cbar` sticky; LOG toggles the conversation (`.logopen` on `.hud.core`, index.ts:592-593); on a phone the chat sits behind the button; `openChat()` launcher.ts:97 clicks `.logbtn` when under 1,240 px.
  Tests know `#cbar`, `#mic`, `.logbtn`, `#cin`, `#pg-core .hud.core`.
- BY HOUR: Home follows NOTHING by hour today except the greeting word (areas.ts:526) and "next" in the lock line. The three chips are fixed: "Brief me" (-> brief), "What’s on today", "God’s eye"
  (index.ts:651-655). `getHours` appears in index.ts only for the 24-hour temperature spark (:937). The Brief tab (features/brief/index.ts) holds the morning content; no commute or evening-reading card on Home exists.
  STARS 161 (follow the hour) has no code.
- Home has NO stamp line (see section 4).
- The old look on Home: `.rc*` rules (228 selector lines in styles.css), `#cbar/#suggest/#cstate/.ccenter` (127), the arcs and call-outs are SVG with `#fff` fills (home.ts:151, :161-162), hud.ts draws canvas with rgba().

### 2.1 What is drawn in the design system TODAY, and what is the old look
IN THE SYSTEM (import `ui/machine.ts` marks and/or live in THE SYSTEM section of styles.css, tokens only):
- THE READER (features/library/reader.ts:42 imports; screen `reader`, panel CSS inside THE SYSTEM per tests apps/edge/test/look.test.mjs:314-321).
- THE LOOK (features/look/index.ts:31, :101-110: stamp line, marks, 12 swatches, Mind section) and the Theme page (Settings, class `g-themepage` features/settings/index.ts:129; `.themepn.pushed`).
- The Lens's one view (features/lens/one.ts:23: reticle, tag, truthLine, key; CSS "THE ONE LENS" styles.css:6322+, tokens only, after the end marker).
- The voice panels: voicetag.ts:10 (the talk bar's "whose voice" tag) and settings/voiceknown.ts:19.
- The boot cinematic (shell/boot.ts:50; CSS styles.css:4545-4600, tokens only) and Mind (mind.ts reads tokens, imports `attendingNow`).
- Library's Shelf keys (features/library/index.ts:35 imports `key`). Nine files import ui/machine.ts: mind, voicetag, lens/one, library/index, library/reader, look, settings/voiceknown, main, boot.
OLD LOOK (route C, "calm glass", styles.css outside THE SYSTEM): Home (core), the seven hubs (`.hub`, `.hubtile`), the deck (`#deck`, `.dk*`), the tab bar and top bar (`#dock .tabcap`, `#top`),
the palette (`#palette`), the Me sheet, Settings (list mode), and EVERY other feature screen: brief, eye, lens (old modes under MORE), agenda, markets, threats, radio, memory, library (except the Shelf keys), workshop,
learn, gym, school, arcade, studio, reverse, space, workbench, links, system, abilities, the eight Life screens, learning, coach, social, convert, docs, house.
Honest reach, OWNER-ISSUES 147 (his words in the entry): "Paper and the world's full look reach the pages drawn in the new design (Theme, THE LOOK, the reader) and the floor, corners and glow of every screen; Home, the hubs and the old rooms stay on your night ground until the shell pass".
Also 147: "the tab bar's own glow is not tied to the Glow switch (the shell pass takes it; STARS 170)"; and (d) BODY SIZE 19 or 21 "makes the text bigger on the new-design pages now and the old rooms follow with the shell".

## 3. THE FINDING RULE AS CODE

- No test of reachability by taps exists. grep of tests/ and apps/edge/test for "two taps", "three taps", "findable", "reachable", "every screen":
  hits are only (a) tests/look.spec.mjs:111-130 "two taps from Settings" (Settings -> Appearance pill -> THE LOOK row, timed), (b) tests/reader.spec.mjs:27-28 item 11 "two taps from
  Learn (the Library's card opens the Shelf, then the book) and one typed word from the jump bar", (c) tests/tabs.spec.mjs: each of the 14 new screens "opens from its card, from Every screen and from the jump bar",
  (d) tests/library.spec.mjs:480 "shelf not reachable on the phone" (a scroll check), (e) apps/edge/test/catalogue.test.mjs:5 "every screen ... in the screens' source". None counts taps for all screens.
- Today's real tap counts from Home (derivable): 37 area screens = 2 taps (area button, card); `brief` 2 (Ask button twice or Ask hub card); reader 3 (Learn, Library card -> Shelf, book);
  look 4 (avatar, Settings row, Appearance pill, THE LOOK row); anything by typed word = open the jump bar (1 tap) + word + Enter. No favourite exists, so "favourites in two taps" has no feature behind it.
- How a spec could count taps (all pure facts already in code, no browser needed for the first two layers):
  1. Ids: features/index.ts:51 (regex-read by apps/edge/test/catalogue.test.mjs:43-57, which already parses TABS, `id:` of every feature, and `AREAS` from shell/areadefs.ts).
  2. Hub membership: `AREAS[].tabs` (areadefs.ts:20-30, pure) + `ME_ROWS` (:33). A screen in an area = tap 1 (bar) + tap 2 (card). `inside`/`cardTo` fields give the exceptions (reader, look).
  3. Browser: `go()` addresses (`#id`, `location.hash`), `document.body.dataset.tab`, `window.__ghosty.ui.get().tab`, `.deck` (`deckState.shown` after typing, launcher.ts:47), `.switcher` (`switcherState`, switcher.ts:35).
     Click path: `#dock .tabcap button[data-area=X]` then `#pg-area-X .hubgrid > .hubtile[data-id=Y]` (as tests/tabs.spec.mjs:181-186, hubcards.spec.mjs:55-97 do). Palette: `.cmd`, `#palette input`, Enter.
  4. Deck search: type in `.dkin`, read `deckState.shown` (launcher.ts:308).
- The catalogue's `screen:` entries as the visible list: 46 entries (packages/shared/src/catalogue/*.ts, e.g. app1.ts:10 `'screen:core'`, tabs.ts:16 `'screen:area-life'`), one per registry tab:
  core eye lens brief agenda threats markets radio memory library workshop learn gym arcade school studio reverse space workbench links settings system abilities area-ask area-see area-make area-learn area-plan area-me
  look reader area-life money body kitchen people work creative outside homeadmin learning coach social convert docs house. Built from the live tab list: abilities/sources.ts:96
  `for (const t of tabs) add({ id: 'screen:'+t.id, kind: 'screen', ...go: { open: t.id } })`; held both ways by apps/edge/test/catalogue.test.mjs:99 (every item has words) and :111 (no stale words).
  Counts printed there: screens 46, hub cards 38 (OWNER-ISSUES 121 "screens 44, hub cards 38, registry items 879" at that date; two screens, reader and look, have been added since).
- CONFLICT TO NAME: the Abilities tab (`abilities`, Me row "Everything I can do for you", areadefs.ts:39; features/abilities/index.ts:2 "THE EVERYTHING TAB") is a page that lists every ability
  (~250+ entries). OWNER-ISSUES 143: "NO PAGE THAT LISTS EVERY ABILITY: the shell does not keep or build an 'everything I can do' catalogue page as the way in". It exists today; 143 says the shell does not keep it as the way in.
  `can you...?` by words, WHY and the offers in context "stay (68)".

## 4. THE STAMP LINE AND THE MARKS (ui/machine.ts, 489 lines)

- Marks list: machine.ts:1-27: stampLine, reticle, tag, truthLine, plate, key, lineOfSight, typedLine, recognise, search, index, eyeGlyph. All values are tokens (`--g-*`); `still()` machine.ts:30 honours Reduce Motion and MOTION calm.
- `StampFacts` machine.ts:164-173: `place` (saved home or last place), `watching: number | null` (null = still finding out), `looking` (the thing in focus), `offline?`.
- `stampWords(f, now)` machine.ts:176-181 returns five segments: day ("Fri 6 Nov", en-GB short), time ("21:08", 24 h), `f.place || 'Here'`, feeds ("Offline, feeds paused" | "Checking feeds" |
  "No feeds yet" | "Watching n feed(s)"), "Looking at <looking>". Doc line :175: "Fri 6 Nov · 21:08 · Birmingham · Watching 3 feeds · Looking at the look" (mono capitals).
- `stampLine(facts)` machine.ts:211-243: `p.g-stamp[data-g=stamp]`, repaints on the minute (:215 timer `60_000 - (Date.now() % 60_000) + 50`), the last segment is in the accent (`tone 'on'`); returns { el, refresh(), look(thing) }.
  `stampTyped` :188 is the boot's typing form. CSS `.g-stamp` styles.css:5871-5873.
- Where it is used today: THE READER (features/library/reader.ts:311 `stampLine(facts)`, facts :309 with `looking` = book title; `stamp.look(lookingAt(context()))` :578, :681), THE LOOK (features/look/index.ts:102, plus a second at :263),
  the boot (shell/boot.ts:620-622: `facts()` with `looking: 'Home'`, `stampNow = () => stampWords(facts()).slice(0, 4)` and the comment "the fifth, LOOKING AT, is Home's own once it lands"; typed with `stampTyped`).
  Home, the hubs, the deck and every old screen have NONE.
- Awareness PR A hook: shell/awareness.ts:87-89 `STAMP_LOOK_MAX = 80`, `lookingAt(c: ScreenContext) = oneLineOf(c.looking || c.line, 80)`; used by reader.ts:22,578,681 and look/index.ts:17,101. The Core card reads `awarenessMark()` (:121).
  Home's own `context()` is features/core/index.ts:981 (its `looking`/`line` would feed "LOOKING AT HOME" or the open card).
- The facts are rebuilt in each caller: `feedsWatched()` features/look/index.ts:60-64 counts only flood, weather, crime (3 feeds) from `guardian.get().info` (checked and not failed); boot.ts keeps its own `feedsAnswered` (:186); the reader its own `facts`. No shared `stampFacts()`.
- OWNER-ISSUES 149: "NOT DONE HERE: Home's own stamp line with LOOKING AT HOME (the shell pass's)." and "the shell pass gives Home its own with LOOKING AT HOME."

## 5. WHAT THE WORLDS AND PAPER NEED FROM THE SHELL

- tokens.css (339 lines, 183 `--g-*` definitions): `:root` default recipe Graphite + Reactor + The Scan (:22-); accents `[data-theme|data-accent=reactor|graphite|ember|gold|crimson|violet|emerald|ice|rose|lime|sunset|mono]` (:174-208, twelve);
  grounds `[data-ground=black|graphite|slate|warm|paper]` (:220-250); worlds `[data-world=scan|map|eye|ink|glass]` (:269-302); switches `data-glow|floor|corners|readings|body|motion` (:313-323).
  The default `:root` ground tokens: canvas #101317, plate #171b20, plate-strong #1e2329, ink 1-4 (#ece8df, #c8c5bd, #a8a59e, #918f8a), line #cfcbc3, line-faint #75746f (:22-60).
  Room tokens `--g-room-canvas`, `--g-room-canvas-rgb`, `--g-room-points-rgb`: "the floor behind the rooms still in today's look" (tokens.css:57-58) = the NIGHT ground the old rooms keep even when the ground is Paper.
- styles.css: `@import url('src/design/tokens.css')` first line (look.test.mjs:254). THE SYSTEM section = styles.css:5850-6319 (470 lines) between "THE SYSTEM (BRIEF-DESIGN-SYSTEM" and "/* ==== end THE SYSTEM ==== */";
  apps/edge/test/look.test.mjs:291-296 asserts zero raw colours in it. THE RECIPE block 6219-6319 (inside the section): the world's floor `html[data-world] body::before` (:6229, 16 px point mask at `--g-floor-a`), `html[data-world] { --bg: var(--g-room-canvas); --card: var(--g-radius-cell); --rad: var(--g-radius-chip) }` (:6228),
  so every old rule using `--card`/`--rad` already follows the world's corners; `body[data-tab="eye"]::before { display: none }` (:6231).
- Paper reaches only `body:is([data-tab="look"], .g-themepage)` (styles.css:6244-6263: top bar, tab bar `#dock .tabcap`, nav title, `.you .av` re-drawn with `--g-*`); Home, the hubs and old rooms stay on the night ground. `data-ground`/`data-world` rule lines in styles.css: 19.
- Old-look hard-coding, counted (script over styles.css with THE SYSTEM section removed = 5,905 lines; comments stripped):
  * hex colours: 506 (distinct heavy: #fff 144, #000 54, #ff6961 17, #30d158 17, #ffb340 15, #03070a 12, #050607 11, #111 10); inside THE SYSTEM: 0.
  * `rgb(`/`rgba(` calls: 1,022. `border-radius:` declarations: 605, of which 460 carry a px value (only `--card`/`--rad` follow the world).
  * 375 rule blocks carry at least one hex. Top 15 selectors by hex count: (9) `.tglyph, .msg:not(.me)::before, #ccap::before`; (5) `.ptafter`; (5) `.g3kart .g3item[data-item="rolling"]::before`; (5) `:root` (the old aliases);
    (4 each) `html`, `#ccap::before`, `.msg:not(.me)::before`, `.two.stack, .hub, .convo .log`, `body.tabbar #dock .tabblur`, `.g3kart .g3item[data-item="orb"]::before`; (3 each) `.camstamp`, `.lensscene, .lenscount`,
    `.vcform .vcinput`, `button.vcchip`, `#dock .you .av`. The counts are flat (many rules with 1-2 hexes), so the 506 are spread over 375 rules, not concentrated.
  * Selector weight by shell part (lines mentioning): `.rc*` Home 228, `#cbar|#suggest|#cstate|.ccenter` 127, `#deck` 112, `#top` 108, `.dk*` 84, `.hub*` 82, `#dock` 79, `.sw*` 78, `#palette` 53, Me sheet `.merow|.mestatus|.meguard` 9.
- What a world/ground needs from the shell, said by its docs: tokens.css:20-21 "today's aliases (--c, --cr, --ink, --hair, --rc*, --t1..--t5, --sf, --sfd ...) keep their values until the shell pass redefines them onto these";
  styles.css:6219-6226 "the rooms still drawn in today's look keep their layout and stand on the night ground (light words on dark, until the shell pass)".
  Font floor held by look.test.mjs in every theme: "body 17 pt, a reading 15, a tag or a caption 13, nothing under 12; every ink at least 4.5:1 ... every line 3:1" (tokens.css:11-13), sixty pairs.
  Today's old rules also force `.sq`-free glyphs, 40 px buttons (a `!important` rule under hover: none, styles.css:6310 comment) that THE SYSTEM lifts to 44.

## 6. THE SPECS THAT PIN THE SHELL (tests/*.spec.mjs; CI runs them in 4 shards, .github/workflows/check.yml:69-110)

113 files in tests/. Files that touch shell selectors (#dock, .hubtile, #deck, #palette, area-, .navtitle/.navback, #top, .dk*): 35 specs. The core pins:
- tabs.spec.mjs (439 lines): bar = `ask,see,make,learn,plan,life` plus Me (`#top .you[data-area="me"]`) at 440 and 390, TV too (:162, :411); buttons 44 pt (56 on TV); every hub's cards equal AREAS tools exactly, in order (:186);
  last card scrolls clear of the bar; IN THE WORKS on LEARNING and COACH only; each of the 14 new screens opens from card, deck and jump bar and from `?open=`; pills named; TV bar stands left (:401-430).
- nav.spec.mjs (775 lines): quick switcher (long press 350 ms, slide, release; lit tool first; aria-hidden when closed), section pills on long screens (6 at most, 44 pt), hub sub-lines are his readings ("I", never "he"), `dock.areas == ask,see,make,learn,plan,life` (:673), every hub's `area-X` (:691).
- hubcards.spec.mjs (233 lines): per hub `#pg-area-X .hubgrid > .hubtile` all tools, no `.hubmore/.hubmini` (:124), each card BUTTON with `.inst`, status in LIVE|READY|TRAINING|OFF, "two readouts" (:107 `c.reads.length !== 2`), unknown marked "Not yet", no `.sq` glyph tile, every card sits above the bar, GYM 22 games, Graphite same shapes.
- deck.spec.mjs (216 lines): groups exactly `'Ask and see,Make,Learn and plan,Life,Me'` (:61-62), `ALL` = 37 ids (:71-72) with `look.cards.length !== ALL.length` (:74), the 14 new screens in the named groups, none in More, promises two lines, Core live line "Online", no filled glyph backgrounds,
  Lens opens in place with 3+ YOU CAN rows, TRY THIS NOW has 3 picks (:122), "ag" leaves Agenda, no-match goes to chat, final log "deck: OK (37 cards in five groups and More ...)" (:216), the Me sheet rows still go where they say (:197).
- routec.spec.mjs (560 lines): Home's four instruments, `.rctoday`, `.rcroad`, `.rcgym` (22 `.rcseg`), chips exactly `Brief me|What’s on today|God’s eye` (:156-157), `#dock .tabcap button[data-area=ask|see|make|learn|plan]` open `core, area-see, area-make, area-learn, area-plan` and are lit (:176-186),
  44 pt targets for `#suggest > button, #dock .tabcap button, #top .cmd, #top .you, #cbar #mic, #cbar .logbtn` (:168), the Me sheet's Status card and three dials, no sideways, glow stops under Reduce Motion, every other screen opens via the deck, empty lists say one sentence, offline line.
- hero.spec.mjs (227 lines): Mind on Home (node count per 20 passages, 4,186 stubbed passages), five states, accent from tokens, Reduce Motion one frame, WebGL fallback to the 2-D reactor.
- boot.spec.mjs (590 lines): the eight phases in order and on time, cut exactly 2,880 ms and under 3,000, stamp words true against the clock, feed lines equal feeds answered, box on the orb within 3 px, landing on Home's real Mind "in the hero's box to the pixel", HUD a beat after; 7 numbered checks.
- layout.spec.mjs (111 lines): 18 tabs (core eye lens brief agenda threats markets radio memory library workshop space links settings system studio learn gym) at phone, 375, laptop 1280 x 640 and desktop: nothing cut off, nothing sideways; `SECTIONED` = settings, library, memory, school, workshop, threats, links.
- Also: awareness.spec.mjs (deck context, Core card "Looking at"), look.spec.mjs (two taps from Settings, :111-130), reader.spec.mjs (two taps from Learn, :27-28), library.spec.mjs (Shelf), abilities.spec.mjs, scroll / scrollfeel / safari (bar and scroll), restc.spec.mjs (TV mode).
  Edge tests that read shell source: apps/edge/test/catalogue.test.mjs (parses features/index.ts, shell/areadefs.ts, hubcards.ts CARDS), look.test.mjs (styles.css markers), design.test.mjs.
- Which are re-cut vs held: the rule in STATUS/OWNER-ISSUES 149 is "RE-CUT IN PLACE, NOTHING LOOSENED". A bar that is not six areas (OWNER-ISSUES 142/143 make it the shell's call) re-cuts the `ask,see,make,learn,plan,life` assertions (tabs:162,411; nav:673; routec:176); a different deck re-cuts deck's five groups and 37 (:61,:74,:216);
  Home's `.rc*` and chips re-cut routec; the landing on Home's Mind box is pinned by boot.spec, hero.spec.
- NO spec asserts the finding rule across all screens; that spec is the new work (OWNER-ISSUES 142, 143: "held by a test in the shell pass").

## 7. THE OWNER'S WORDS (exact, from docs/build-plan/OWNER-ISSUES.md; entry line in the file)

- 119 (:380): "if I was to show someone it'd just be so hard to navigate and find every small feature because it's embedded somewhere random you have to go through 100 hoops for but it shouldn't be like that … can't we add tabs for everything we have like all the tabs we already have … whichever you think is best".
- 121 (:382, my built record, not his words): "THE BAR has six areas now: Ask, See, Make, Learn, Plan and LIFE ... and ME is your avatar at the top ... EVERY HUB SHOWS EVERYTHING: every tool a full card (the six-card cap and the More row are gone) ... THE DECK has a Life group".
- 130 (:399): "get rid of the abilities page for every ability because the way i wanna redesign it you'll be able to navigate and find everything". Decided: "every one of the brain's abilities reachable and runnable within the new navigation in two taps, with no phrase to remember".
- 131 (:401) his words: "okay fix all of this and btw with the mind i just meant the orb kinda thing in the middle and i just wanna redesign the theme a little to make it look a little better we might get rid of the iphone theme because the theme we currently have was designed for when we had a lot less things but we can redesign it to be a lot better since i feel like even you know a lot more now, and we could redesign it entirely to just look a lot better".
  The shell findings: "(2) 'every screen rebuilt in 3–4 days' was not true → the redesign is the shell now (bar, hubs, deck, Home, Mind with the Stage, switcher, jump bar) and the other screens migrate as their passes touch them (STARS 160, STATUS item 4); ... (5) 'two taps to everything' and 'less on each screen' contradict → two taps for recents and favourites, three taps or one typed word for the rest (160); (6) 'Mind with the Stage beside it' does not fit 390 wide → the Stage takes the centre while something is shown and Mind becomes its frame; one direction tries Mind as the navigation".
  "HIS CLARIFICATION: Mind is the orb in the middle and that is all that must stay; the rest of the look may change entirely, the current iOS-like theme included".
- 135 (:409), the three directions of round one: D1 ORBIT, D2 ONE INK, D3 GROWN UP, "shell about 9 days / 8.5 days / 5.5 days" (the builder's estimates); "In all three: recents and favourites in two taps, everything else in three taps or one typed word".
- 136 (:411) his words: "tbh they're all kinda shit i was expecting it to all look a bit better and like a total redesign something that hasn't been seen before or something that has and just like better in general". Taken as the brief: "Mind the orb and the Stage at the centre are the only fixed points."
- 139 (:417) his words: "i like 1 tbh, but i don't like how dark it looks but maybe it just looks like that rn ... do 1 but still i feel like we're missing couple crucial 'the machine' feeling benchmarks but apart from that it's good, remember we want it to be very easily navigated and i don't want nothing clunky or hard to read etc or just like things in places where you'll never find them".
  Its three rules: "(1) NOT SO DARK ... (2) THE MACHINE FELT, NOT NAMED — the Machine's marks are components used everywhere: the stamp line (its point of view: date · time · place · watching · looking at) ... (3) EASY TO NAVIGATE — ... recents and favourites in two taps, everything else in three or one typed word, every screen reachable from a visible list; the finding rule is a test in the shell pass".
- 142 (:425) his words: "yeah i still want that old glowing hologram orb if that's the question if you can make it a little better, along with the cinematic btw which can be a lot lot lot better · every feature doesn't have to be a tab if it is well navigated with the new design so we can cut that out · i haven't checked the book error thing".
  Decided (2), later replaced by 143: "A TAB PER FEATURE IS LIFTED ... the shell pass (item 4) may cut the six-area bar and the per-feature tabs where the finding rule holds".
- 143 (:427) his words: "no maybe we got that mixed up i still want every thing we have to like a thing where you can use it and like easy to find and navigate etc etc i meant i just don't want a whole page with every single ability because it'll be easy to find every ability you know?"
  Decided: "every feature stays its own usable screen or thing, reachable under the finding rule (recents and favourites in two taps, everything else in three taps or one typed word, every screen reachable from a visible list, held by a test in the shell pass); whether a feature is a TAB or a row in a hub is the shell pass's call, never a cut of the feature. NO PAGE THAT LISTS EVERY ABILITY ... 'can you…?' by words, WHY and the offers in context stay (68)". "Phone check 121 (the six-area bar) is not asked for; the bar's future is the shell pass's."
- 147 (:439): "Paper turns the new-design pages to bone paper and leaves Home, the hubs and the old rooms on your night ground ... until the shell pass redraws every screen. I recommend leaving it so; making the old rooms light now would mean redrawing every screen, which is the shell's job."
- 149 (:449): "NOT DONE HERE: Home's own stamp line with LOOKING AT HOME (the shell pass's)."
- 150 (d) (:455): "SCREENS WITHOUT THEIR OWN LINE say their name and their older description cut to 160 characters (Settings: "Settings: theme reactor, name Boss"); I recommend the shell pass gives each of them a line of its own, a sentence each". Also 150 (c): "the shell pass is the place to give every screen its own ask box so no one is taken away to ask".

### 7.1 W1 THE SCAN: what the shell was DRAWN to be (docs/build-plan/mockups/directions-2/w1/README.md, build.py, PNGs)
- One sentence (README:3-4): "the phone is a window into a 3-D scan of a room where everything Ghosty does has its place; tilt it to look round, and whatever you ask for is brought to the front."
- The six areas are "the other rooms of the house, drawn along the bottom as the Machine draws a building: a plan with door gaps, the room he is in lit" (README:13-14; `plan()` in build.py, used by home :164 and hub :232). The Stage is "the room's window brought to the front ... the orb sits on the frame's top edge as its keystone" (README:15-16).
- Home (build.py:150-165, home-390/440.png): truth line "Fri 6 Nov · 21:08 · Birmingham · 9° clear", say "Good evening, Boss.", say2 "Nothing needs you tonight. Shall we read?"; marks as things in the room: window = God’s eye (recent), shelf = Library 4 (recent), Lens (starred), Agenda (starred, "Dentist 09:15"), Brief (recent), Gym (starred), Courses (starred);
  tonight's thing lit: callout "Tonight · Library", "Alice's Adventures in Wonderland", "Page 42 of 112 · yesterday · carry on", a leader line; the plan along the bottom; an ask line (`ask()`).
- Hub (build.py:196-225, hub-390/440.png): top "The Learn room · 7 things · 21:11", title "Learn"; a band of reticled objects numbered 01-07; "At hand · 3 / Recent and starred" rows (Library, Gym, Courses with readings) then "Folded · 4 more / Tap to open" mini rows (School, Arcade, Learning and Coach marked IN THE WORKS); the plan; ask line "Find anything in Learn".
- Storyboard "Home becomes the 7:42" (build.py:276-281; story-1..4-390.png, story.png): 1 "He asks" ("07:12. He types “When’s my train?”. The other tags let go; the eye turns to the window"), 2 "The eye locks" (one reticle on the window, the camera walks across), 3 "Through the window" (city resolves from points, the way draws itself),
  4 "The Stage" ("The 7:42, platform 3, the walk and the train; the sentence comes after the picture").
- Its finding-rule table (README:37-44): tonight's thing 1 tap; a recent 1 tap; a favourite 1 tap ("The same: the camera, the calendar, the chessboard, the notebook, starred"); "Anything else (44 screens, about 150 abilities) | 3, or one typed word | tap a room (1, the camera walks there), tap a thing in its inventory (2), a panel inside (3); or type a word in the ask line".
  "Recents and favourites are better than the rule (one tap, not two) because they are things in the room he is in."
- Its own costs (README:56-69): "The shell (Home's room, the six area rooms as scans, the plan along the bottom, the camera and its moves ... the Stage as the window with the city model ..., the ask line and jump, the switcher as the plan): about 12 days" (vs STATUS's "3–4 days");
  the room is "a point cloud baked once (about 200,000 points ... about 2 MB)" with gyroscope parallax (DeviceOrientation permission); the weak spot: "a screen whose thing has no natural object in a room (Make's Convert, Me's Keys and storage) is a plate on the wall of its room"; migration "about half a day each".
  Five-second failure: "the room is dark and drawn in hairlines, so ... the tags are small"; the Lens "dominated by the photograph". `lift.css` (not-so-dark) is the design system's graphite laid over it (README:27-33).
- Files in w1/: tokens.css, style.css, lift.css, room.js (one fragment shader), build.py, home/hub/lens/reader/show .html + 390/440 PNGs, graphite and ember variants, story.html/.png, contact.png, lift-home/learn.png. Its own marks vocabulary maps 1:1 to ui/machine.ts.

## 8. SIZE (numbers)

- Screens: 46 registry tabs = 37 in an area + 2 inside another (reader, look) + 7 hubs. User-visible screens 39.
- Hub cards: 38 (ask 3 incl. Voice, see 2, make 8, learn 7, plan 4, life 8, me 6); CARDS table 38 keys.
- Deck cards: 37 in five groups (+ empty More); 35 miniature JPGs in public/deck.
- Bar: 6 buttons + avatar; 7 areas; 2 pure files (areadefs.ts 51 lines, deckcopy.ts DECK_GROUPS) hold the structure.
- styles.css: 6,375 lines; THE SYSTEM section 470 lines (5850-6319); OUTSIDE it 5,905 lines (this includes the Lens block ~30 lines after the end marker and the boot block, which are token-only, so the strictly old-look figure is somewhat lower). tokens.css 339 lines.
- Old-look literals outside THE SYSTEM: 506 hex, 1,022 rgb/rgba, 605 border-radius declarations (460 in px).
- Shell source: shell/*.ts ~5,000 lines (boot 1,039, hubcards 1,042, areas 550, deckcopy 491, launcher 383, switcher 189, layout 186, tabs 151, awareness 131, areadefs 51, cardline 47); features/core ~4,200 lines (index 987, mind 1,150, reactor 583, cards 416, home 411).
- Specs pinning the shell: 35 spec files touch shell selectors; 8 pin its structure directly (tabs, nav, hubcards, deck, routec, layout, hero, boot) = 3,151 lines; plus 3 edge tests that parse shell source (catalogue, look, design).
- Screens that publish their own awareness `context()`: 8 of 46; 38 fall back (OWNER-ISSUES 150 d).

## 9. WHAT WAS HARDEST TO FIND OR NOT FOUND (ten lines)

1. directions-2/README.md does not exist; the W1 text is w1/README.md, and the "storyboards" are build.py captions plus story-1..4 PNGs (no separate storyboard text file).
2. No test counts taps; the "two taps" greps return only Settings-to-THE LOOK and Learn-to-the-reader, so the rule has no spec at all today.
3. `TabDef.primary` is set on five tabs and read by nothing in shell/ (the bar comes from AREAS); its old "dock on phones" meaning is dead.
4. The Stage (STARS 164) has no code at all; "Mind the orb with the Stage" in item 4 depends on item 5's surface that does not exist.
5. Hex counts depend on where "THE SYSTEM" ends: the Lens and boot blocks sit after the end marker but are token-only; I counted everything outside 5850-6319 as "outside" and said so.
6. The Me sheet and the Me hub are two lists of the same six-plus rows (areadefs `ME_ROWS` vs `AREAS.me.tabs`: hub has memory, settings, system, links, abilities, social; sheet adds origin and deck).
7. The deck's groups, the bar's areas and the Me sheet's groups are three separate hand-kept lists (deckcopy.ts:44, areadefs.ts:20, areadefs.ts:33).
8. No favourites exist for screens (STARS 163 unbuilt); recents are 8 in localStorage, shown 4 in the palette only.
9. The stamp's facts (the feeds count) are written three times (look, boot, reader) with different counting; there is no shared source.
10. OWNER-ISSUES 131 has no single "shell paragraph"; I quoted finding (2), (5), (6) and the clarification, which are where the shell is said.

THREE BIGGEST RISKS FOR A REBUILD (facts):
- Pinned surface: 35 specs touch shell selectors and eight pin the structure by number (six areas, 37 deck cards in five groups, two readouts per card, chips, `.rc*`, the 2,880 ms landing on Home's Mind box to the pixel); CI is four shards of about forty minutes, and OWNER-ISSUES 149 rules "RE-CUT IN PLACE, NOTHING LOOSENED".
- Re-expression size and coupling: 506 hex, 1,022 rgba and 460 px radii over 5,905 old lines, 228 `.rc*` and 127 composer lines on Home, and Home's 987-line mount couples chat, voice, the orb (boot lands on it), the wall and the deck's `openChat` selectors (`.logbtn`, `#pg-core .hud.core`); the old rooms read `--g-room-canvas` (night ground) so Paper cannot reach them until each is redrawn.
- Estimate gap and a conflict: STATUS says 3-4 days; W1's own README says about 12 days for its room shell (point-cloud rooms, gyroscope, six hand-built scenes) and calls Convert and Keys "the weakest part of the metaphor"; and the existing Abilities tab is a page listing every ability, which OWNER-ISSUES 143 says the shell does not keep as the way in.
