# BRIEF-REST-D — design and show a build (with a bill of materials), and the Home Assistant bridge (batch ⑧ part D, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after the commit that adds this brief; never reset to
FETCH_HEAD or origin, only to the local branch). Your preview port: 8711. Read first: ROADMAP.md rows ⑤ and ⑧ and the
"Not possible from a phone app" lines; OWNER-ISSUES 91 (his words: "it should be able to design and show a build.. like if I
wanted a room it should do it.. if I wanted a car a house a garage a garden shed a computer a tv screen a robot.. what ever I
decide to build it should be able to design it with full measurements and spec information"; "it should be able to work
with anything with wifi or anything thats smart like underfloor heating or central heating"; and the triage: a shed, a garden
room, a garage, a room, a PC build in full; a car or a robot "to the bolt" only as a concept with real parts named; anything
smart in the house via a free Home Assistant box), 92, 95–97, 99 (the catalogue rules), 105 (the packs' plumbing and the
money pack's price watches), 108 (how the car lands in the Studio: `apps/web/src/car/` — scene, panel, card, ask; the CAR ·
FIX IT pane and its lit parts; read `car/panel.ts` and `features/studio/index.ts` for how a pane joins the Studio),
`features/space/home.ts` (DESIGN MY HOME: a plan from words and its 3-D), `apps/edge/src/tools/money.ts` (the price watches:
a page he gives, read twice a day, a drop told once), `apps/edge/src/agent.ts` around VAULT_NAMES and the social batch's
`apps/edge/src/social/mastodon.ts` (how an account's key lives in the vault and is never sent to the phone), `tests/
preview-server.mjs` (the preview's mock API: your mock Home Assistant goes there). Other builders run in parallel: touch
nothing under `features/people|work|creative/`, `wiki/`, `morse/`, `coach/`, `demo/`, `gym/`, `lens/`, `hands/`, `tv/`,
`arcade/`, `social/`. Yours: `apps/web/src/build/*` (new), a Studio pane for the build (the way the car added one), `apps/web/
src/house/*` (new), `apps/edge/src/house.ts` (new: the Worker's bridge) + its route in `apps/edge/src/index.ts` and the vault
name, your phrases and local asks, `packages/shared/src/catalogue/restd.ts` (joined where the catalogue files are), `apps/
edge/test/restd.test.mjs`, `tests/restd.spec.mjs`, the smoke loop's list (`restd` after `resta`), `apps/edge/package.json`'s
test list (after `resta.test.mjs`), a CSS block at the END of styles.css. The plain prompt is at exactly 5,500 on its worst
dial: add nothing to it (no new brain tool; both parts work as LOCAL ASKS and sheets, the brain only wording when asked).

## 1. DESIGN AND SHOW A BUILD (MAKE → DESIGN A BUILD; "design me a shed three by two")

From his words — "a garden shed 3 m by 2 m", "a garden room with a desk", "a single garage", "a bedroom 4 by 3 with a
wardrobe wall", "a bookshelf for this wall, 2 metres", "a desk", "a gaming PC under £800" — to a DESIGN with four faces:
(a) THE PLAN: a dimensioned 2-D drawing (walls or boards, openings, a scale bar) drawn by code from a parametric kit per
build type — shed (timber frame at 600 centres, cladding, a pitched or pent roof with its pitch, a door, a window, a floor
on bearers, a base said to be needed), garden room (insulated stud walls, a warm roof, double doors, electrics as a line for
a registered electrician), garage (block or timber, an up-and-over door, a slab), a room (walls, floor, ceiling, finishes,
a radiator or underfloor heating sized by a plain rule of thumb), furniture (shelf, desk, bench: boards, fixings, a load
line); (b) THE 3-D: the same build in the Studio as a pane of its own (the way CAR · FIX IT is one), walls with height and
openings, the roof, a figure for scale, tap a part → its line in the list lit, EXPLODE to see the frame, a ROOF toggle; (c)
THE BILL OF MATERIALS: every part with size, count, material and a cut list where boards are cut (lengths from the
dimensions, rounded up to stock lengths — 2.4 m, 3.0 m, 3.6 m, 4.8 m — with the waste said), fixings and consumables
counted (screws by the box, nails by weight, sealant by the tube), a FIRST ESTIMATE price per line from a curated UK price
table in the code with the month it was written and the honest line ("typical prices from October 2026, not quotes"), the
total, and PRICE IT LIVE: a line's shop page he gives (or one the brain finds with a citation when he asks) becomes a money-
pack price watch, so the number is then real and dated; EXPORT as CSV and as plain text, the plan as PNG; (d) THE BUILD, in
plain words: the order of work, tools needed, how long for one person, the safety and law lines that apply (planning: the
permitted-development rules of thumb for sheds and garden rooms said as rules of thumb with the gov.uk words; Part P for new
circuits; a gas engineer for gas; "check with your council" where it matters). A PC build is its own kit: from a budget and a
use (gaming, editing, school) to a parts list by type — CPU, board, memory, storage, graphics, power, case, cooling — from a
small curated table of current real parts with dated typical prices, a compatibility check in code (socket to board, memory
type, power to the graphics card's need plus headroom, card length to case, cooler height), the honest line that prices move
weekly, and PRICE IT LIVE as above. A car, a robot, a TV: a CONCEPT only — the real parts named (a motor and its controller, a
battery and its chemistry, sensors, a frame material) with the one line "a concept with real parts, not a build plan", and
nothing drawn as if it were one. Every number is a FIRST ESTIMATE, NEVER CERTIFIED (the sentence appears on the sheet, the
export and the catalogue). He changes any dimension or part by words or by a field and the whole design follows. Plain words
everywhere; no CAD or trade jargon without a plain gloss. Lives in MAKE as DESIGN A BUILD and from the chat (the asks above;
"show me the build" opens the Studio pane; "price the roof" prices a part's lines); VoiceOver describes the plan's parts.

## 2. THE HOME ASSISTANT BRIDGE (LINKS → HOME ASSISTANT; the HOUSE sheet; "turn the hall light off")

Anything smart in his house through his own free Home Assistant box (a Pi or any old computer), never through a paid cloud.
HIS SIDE, said plainly on the LINKS card with the steps: Home Assistant reachable over HTTPS from the internet (the free
DuckDNS + Let's Encrypt add-on in Home Assistant's own add-on store, one port forwarded on his router; Nabu Casa works too
but costs, so it is named only as "if you ever pay for it"), a long-lived access token made in his Home Assistant profile,
both pasted into SYSTEM → KEYS → HOME ASSISTANT (the URL and the token live in the Worker's vault; the token never reaches
the phone). GHOSTY'S SIDE: the Worker is the only thing that talks to the house (`apps/edge/src/house.ts`): states
(`/api/states`), areas and the entity registry where the API gives them, service calls (`/api/services/<domain>/<service>`),
a short cache so the sheet is quick; an ALLOWLIST of domains as code — light, switch, climate (this is his underfloor and
central heating: current and target temperature, mode), fan, cover (blinds and curtains), media_player (his TVs and speakers),
scene, script, input_boolean, vacuum, water_heater, sensor and binary_sensor read-only — and a GUARDED set that only his own
tap with a confirm may touch and no scheduled job ever may: lock.unlock, alarm_control_panel.disarm, any cover whose device
class is garage or gate, switch entities he marks as "needs my word"; anything else is refused with the domain named. THE
HOUSE SHEET on the phone (`apps/web/src/house/`): rooms as Home Assistant has them, each entity a card in plain words with
its control (a light's switch and brightness, the heating's dial and mode, a blind's position, a speaker's play and volume,
a sensor's reading with its unit and when it last changed), the whole house in a line at the top (how many lights on, the
coldest room, the heating's state), the WHY of every action kept (the ledger that "what did you do today" reads). THE ASKS,
local and without the model: "turn (on|off) the <name>", "dim the <name> to <n>", "set the heating to <n>", "is the <name>
(on|off|open|closed)?", "what's the temperature in the <room>?", "pause the telly", "close the blinds" — names matched to
his entities' friendly names and areas with a plain "which one?" when two match; the brain, when he asks in other words,
gets the house's state as a fact only for that turn (no new tool). The MORNING may carry one house line (the coldest room and
the heating) when linked, counted in the cap, read without the model. Nothing acts on a schedule unless he sets a standing
rule in his own words through the existing rules, and the GUARDED set never does. Unlinked: the LINKS card with the steps,
and the house asks answer "Link your Home Assistant first — it's in LINKS." Your mock Home Assistant in the preview server
has three rooms, lights, one climate, a sensor, a media player, a lock and a garage door, so the spec can prove the
allowlist and the confirm.

## The lines that hold

Every design number is a FIRST ESTIMATE, never certified; prices are typical and dated until a watch makes them real; the
law lines are rules of thumb with the official words and "check with your council"; nothing bills (DuckDNS and Home Assistant
are free; no paid cloud is required or named as needed); the token stays in the vault; the guarded set needs his tap and
confirm every time and never a job; every house action is in the WHY ledger; the plain prompt untouched; no test skipped or
weakened; the guard job untouched; no model names anywhere; every new thing has its catalogue entry (its id named by the
catalogue test when missing).

## Tests

`restd.test.mjs`: the kits (a 3 × 2 shed's frame count, cladding area, roof pitch geometry, the cut list's stock rounding
and waste; a garden room's insulation count; a shelf's load line), the BOM totals and the CSV export, the PC compatibility
check (a socket mismatch refused, a power shortfall said), the concept-only rule for a car or a robot, the price table's
date; the bridge (the allowlist and the guarded set, a job refused on a guarded call, the vault's URL and token never in a
response, the service-call shaping, the asks' matching and the "which one?" case). `tests/restd.spec.mjs` on your preview:
"design me a shed 3 by 2" → the plan with dimensions, the BOM with the estimate line, SHOW ME → the Studio pane with a part
tapped and lit, EXPORT; a change of width redraws; the PC build from a budget; the HOUSE sheet on the mock: a light toggled
from the sheet and from the chat, the heating set, "is the back door open?", the garage door asking to confirm and the lock
refused from a job; unlinked words; the LINKS card's steps; VoiceOver labels.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration. Validation: brain typecheck +
suite; web typecheck + build; on one fresh preview: websites, apps, studio, restd, deck, nav, links (if a links spec exists).

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files; validation numbers; the kits and the price table's date; LIMITS;
DESIGN PICKS THE OWNER MAY CHANGE; NEEDS HIS HANDS (his Home Assistant's URL and token; the DuckDNS steps; a real build to
price); WHAT THE MERGE MUST KNOW.
