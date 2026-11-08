# BRIEF: THE LENS THAT JUST KNOWS — one view, no key rows; it recognises what is in front of it and does the right thing

OWNER-ISSUES 156 (his words, 8 Nov 00:50 UK: "it should have all the features every lens feature can provide but in one so it
just recognises whatever and can do all of them things and shouldn't have an overlay saying translate etc it should just know
when it needs to translate and it does it then like if it's a different language or something and the same with everything
else it knows what it needs to do, it knows WHO its looking at, it knows what it looking at"), 157 (5: "genuine billions poured
in" is the bar), 162 (The Scan is the HUD his phone opens in). The design is the four frames of the first HUD mock round:
docs/build-plan/mockups/hud/2026-11-08/lens-1.png … lens-4.png (and their .html, which carry the exact type, plates and
spacing): a page of print, a sign in French, two people and a code, a mug. Read STANDARD.md first, then this, then
apps/web/src/features/lens/one.ts (the one view on main today: the stopgap of PR #67, one tag per kind, a key row under the
tag, at most three tags), lens/index.ts (the viewfinder, the bar, MORE, the modes), vision/frame.ts (the budgets, pure),
lens/read.ts (OCR into the library and the speech), lens/ask.ts (ASK and TRANSLATE through the brain), scan/codes.ts
(classifyCode), lens/people.ts (faces: his own and the people he introduced, on the phone), lens/name.ts (the namer), and
tests/lens.spec.mjs. The mid tier. Start from the session branch (main's tree, with THE SCAN's Home on it).

## What is fixed

1. **NO KEY ROWS ON THE PICTURE.** The one view shows the camera, the Machine's marks over what it sees, ONE truth line under
   the viewfinder, and the ask line. Nothing else: no act keys under a tag (READ, TRANSLATE, NAME IT, ASK go as keys), no mode
   tiles on the picture, no "GET THE EYES" plate in the middle. The camera's own bar stays (START, flip, freeze, torch, PHOTO
   TOOLS once a photo is on screen) and keeps its MORE key for the TOOLS (hands, aim, measure, sound, shapes, the people
   enrolment screen) as today: the bar is the camera's, not an overlay on the picture, and 143 says every tool stays findable.
   (Moving the tools out of the bar altogether, to words and the Every-screen list alone, is a later call for the owner;
   this PR does not make it, so aim.spec, faces.spec and awareness.spec keep their MORE path unchanged.)

2. **IT KNOWS WHAT IT IS LOOKING AT, AND SAYS SO AS THE STAMP.** The stamp line at the top (shell pass 1: every screen's own
   sentence from the one source) reads LOOKING AT A LETTER / A SIGN / TWO PEOPLE / A MUG / NOTHING YET, in the mock's words,
   and changes as the marks change (never faster than once a second; the Scan's stamp carries it in the Scan, the Glass
   stamp in Glass). The tag on a thing is a plate above its reticle in the mock's form: `A LETTER · 61 WORDS`,
   `A SIGN · FRENCH`, `MUM`, `SOMEONE I DON'T KNOW`, `A LINK · THE MENU`, `A MUG`. The truth line under the viewfinder is
   one line: what it is · one fact · the one act in his colour (`A LETTER · ENGLISH · TAP A WORD TO HEAR IT`;
   `A SIGN · FRENCH · TRANSLATED · TAP TO HEAR IT`; `MUM · SOMEONE I DON'T KNOW · A LINK: TAP IT`; `A MUG · TAP TO ASK ABOUT
   IT`). With several things, the line lists them in the mock's order (people, then the code, then text, then things) and
   ends with the one act of the thing nearest the middle.

3. **TEXT IN HIS LANGUAGE IS READ, THERE AND THEN.** The cheap "text present" check (as today, under its 4 ms budget) gates
   it; on a STEADY frame the OCR READ already has runs on the phone as the heavy pass (one at a time, once per steady scene:
   it runs again only after the frame moved and settled again, so a page held still costs one read, not one a second). The
   words appear in the WHAT IT SAYS plate under the thing (mock 1): the first sentence lit in his colour, the rest in ink; a
   tap on a word and Ghosty reads aloud from that word with the phone's own voice (READ's speech path); the plate scrolls
   when the text is long and never covers the ask line or the truth line. The text goes into the library only on his word
   ("keep it", "read that" as today) or a tap on the tag, never by itself. The language is decided ON THE PHONE from the
   words (vision/frame.ts `looksEnglish` today; extend it to a small table of the commonest words of French, German, Spanish,
   Italian, Portuguese and Dutch, pure and tested, naming the language or saying UNKNOWN; nothing downloaded, no model).

4. **TEXT IN ANOTHER LANGUAGE IS TRANSLATED, THERE AND THEN, DRAWN IN ITS PLACE.** When the language is not English (3), the
   WORDS (never the picture, never a crop) go to the brain by the TRANSLATE path ask.ts has today, by themselves, and the
   translation is drawn over the sign in the sign's own place (mock 2: the English large in the plate, the original and the
   language small under it), the truth line says `A SIGN · FRENCH · TRANSLATED · TAP TO HEAR IT`, a tap says the English
   aloud. This is the one thing the Lens sends without a tap, and it is his ask in 156; it is said on the screen the first
   time it happens in a session (one toast: "I sent the words, not the picture") and the privacy mark on the bar says
   WORDS SENT while it is in flight. OFFLINE, or when the brain fails: `A SIGN · FRENCH · I CAN'T TRANSLATE OFFLINE` and the
   original words shown, nothing else. One translation per steady scene (3), never a stream of them. The translate request
   carries the words and "translate this into English", nothing of where he is.

5. **A CODE IS OPENED AS WHAT IT IS.** The barcode reader as today (native where present, else the vendored one). The tag says
   the kind and the one word that tells him what it leads to (`A LINK · THE MENU` when the URL's path or title gives a word;
   `A LINK · <host>` otherwise; `A PRODUCT CODE`; `WI-FI`; `A CONTACT`), the truth line's act `A LINK: TAP IT`, a tap does
   what SCAN does with that kind today (opens, joins, saves), with SCAN's confirmation where it asks one.

6. **A FACE IS HIM, A PERSON HE INTRODUCED, OR SOMEONE HE DOESN'T KNOW.** With PEOPLE's models on the phone (as today: only
   when already there; the download by his tap, on Wi-Fi, with the size said, from the enrolment screen), every face is tagged
   with the name he gave (`ME`, `MUM`) or `SOMEONE I DON'T KNOW`, nothing else, no act, a tap does nothing but a toast
   "Faces stay on this phone". Without the models: no face tag at all, and the truth line never mentions faces. The boundary of
   131 and 139 holds to the letter: never a stranger identified, a face never leaves the phone, a known name never in the
   published ScreenContext (counts and kinds only).

7. **A THING IS NAMED WHEN THE EYES ARE ON THE PHONE.** The object finder and the namer run as today on a steady frame (one
   heavy pass at a time, the finder first, the namer on the biggest thing), the tag `A MUG`, a fact where one is cheap and
   true (`WHITE CERAMIC` from the thing's own pixels: the dominant colour named from a twelve-colour table, pure, tested;
   no size unless MEASURE's method has a reference in frame, in which case its number as a first estimate, never certified),
   the act `TAP TO ASK ABOUT IT`: a tap sends ASK with the picture as today (his tap is the consent). Without the eyes: no
   thing tag, and the truth line's single honest line when nothing else is tagged: `I CAN SEE TEXT, CODES AND THE PEOPLE I
   KNOW · GET THE EYES (18 MB, ON WI-FI)` — the download key is the line itself (one key, his tap, the size said), never a
   plate on the picture. The part finder (FIND THE PART) stays reachable by words ("find this part").

8. **WORDS DO THE REST.** "read that", "what is that", "translate it", "measure it", "keep it", "find this part", "who is
   that" (answered with the tag's words only) go through the no-model tables (assistant/phrases.ts, local.ts) with the Lens's
   selection as the thing, as the one view does today; the ask line is the one the Lens has now (find how lens.spec sends
   "read that" today and keep that path).

9. **THE LOOK.** The mock's four frames, in the system's tokens (apps/web/src/design/tokens.css, the g-* tokens; THE SCAN's
   plates: `var(--g-plate-fill)`, `var(--g-line)`, `var(--g-t-tag)`, the accent as text `var(--g-accent-text)`), with the
   picture quietened to the Machine's grey and the grid as the mock .html files draw it when body.scanhome is on; in Glass
   the same structure in the Machine's marks ui/machine.ts has (reticle, tag, truthLine). Motion: a tag locks in with the
   160 ms snap the Scan's marks use; a tag fades two seconds after its last sighting (dur('turn')). Every key and tappable
   word 44 pt. Nothing sideways at 390 or 440.

10. **THE BUDGETS, HELD BY THE TESTS THAT HOLD THEM TODAY.** The text check under 4 ms on steady frames (lens.spec's
    textFrames read), the cheap pass every frame the FrameBudget allows, one heavy pass at a time, the first tag within 2 s
    of a steady frame on the fake camera, the UI never under 30 fps while tagging. The OCR and the translation count as
    heavy passes. The camera opens only on his tap, as today.

## What must not change

The prompt guard; the CI guard job; `.github/*`, `apps/*/package.json`, the kernel files (agent.ts, index.ts, tools/{index,
types,repo}.ts) untouched; no packages, no new models (the vendored ones only), nothing from the network but the brain's
translate and ask on his terms above, no new keys; never a model name in code, comments, tests, docs or the PR; no live GPS;
the camera never opens on its own; the specs' names stay (lens, scan, name, faces, measure, aim, mark, sound, awareness) and
check.yml is not touched: lens.spec is re-cut to the one view as it now is, never loosened (every check it makes today keeps
a home; a check that no longer applies, such as the act key under a tag, becomes its opposite: no key on the picture).

## Tests (each fails on the code before this brief; run them against it once and say so in your report)

In tests/lens.spec.mjs (the fake camera draws a test card as it does today):
1. The one view has no `.lensmodes` shown, no key inside a tag, no plate in the middle of the picture; the truth line is one
   line; the camera bar has START, flip, freeze, torch, MORE and nothing else before a photo.
2. A card with an English paragraph: within 3 s of the frame going steady, the WHAT IT SAYS plate shows the words (the OCR
   engine's output on the preview, or the spec's OCR stub if lens.spec stubs it today: find out and say), the first sentence
   has the lit class, the stamp says LOOKING AT and the text's kind, the truth line ends with TAP A WORD TO HEAR IT; a tap on
   the fourth word asks the speech stub to speak from that word (the stub records the text; assert it starts at that word).
   Holding the card still for 4 s more: the OCR ran once (a counter on window.__ghosty.lens), not again.
3. A card with "SORTIE DE SECOURS": the language table says FRENCH; the mocked brain (MOCK_LLM) receives one translate request
   whose body carries the words and no image field; the translation is drawn in the plate over the sign; the truth line says
   FRENCH · TRANSLATED; the WORDS SENT mark showed while in flight; the toast said "I sent the words, not the picture" once.
   With the brain made to fail (the spec's failing route): FRENCH · I CAN'T TRANSLATE OFFLINE, the original words shown.
4. A card with a QR of a URL with a path: the tag says A LINK · and the path's word in caps; the truth line's act A LINK: TAP
   IT; a tap opens what SCAN opens (assert the same call SCAN's spec asserts).
5. Without the eyes: a drawn mug makes no thing tag; the truth line is the honest line with GET THE EYES and 18 MB and ON
   WI-FI in it, and it is the one key; tapping it starts the download the hotfix started (the spec's model stub).
6. The language table: a pure unit test in apps/web (where frame.ts's tests live): ten short sentences, two per language and
   two of nonsense → the right language or UNKNOWN; never a model.
7. The colour table: a pure unit test: six flat colours → their names.
In tests/faces.spec.mjs: the one view's face tag words are the name he gave or exactly `SOMEONE I DON'T KNOW`; a tap on a face
does nothing but the toast; the published context never carries a name (the assertion that exists today, kept).

## Validation before the PR (one step at a time; COMMIT BEFORE EVERY HEAVY STEP; results to the scratchpad file)

`cd apps/web && npx tsc --noEmit -p . && node build.mjs`; the brain's bundle untouched (say so); `node --test` for the new
pure tests; the preview `setsid node tests/preview-server.mjs 8797`; then ONE AT A TIME with `BASE=http://localhost:8797
timeout 480 node tests/<name>.spec.mjs tests/.shots`: lens, faces, scan, name, aim, measure, mark, sound, awareness (the Lens
step), character (the field's words), thescan (the stamp's source). Two cores: never two specs at once. Screenshots of the
four scenes at 440 and 390 into the scratchpad for the orchestrator's review, named lens-letter-440.png etc.

## The owner's phone check (write it into your report in these terms; the orchestrator puts it in OWNER-ISSUES)

(1) Open the Lens, START, point it at a page of print: the words appear by themselves, the first sentence lit; tap a word
and it reads from there. (2) A sign or packet in another language: the English appears over it by itself, FRENCH · TRANSLATED
under; does the one toast about the words feel right? (3) A QR code: A LINK and what it leads to; tap and it opens. (4) Your
own face and a stranger's (a photo on a screen counts): ME and SOMEONE I DON'T KNOW, nothing more, no key. (5) A mug with the
eyes on the phone: A MUG · its colour · TAP TO ASK ABOUT IT; without: the one honest line with GET THE EYES. (6) Is there any
key, row or plate on the picture that should not be there?

## Report

In the scratchpad file: every commit's hash and one line; each spec's result verbatim (the summary line, or the failing
check); the four scenes' screenshots; the calls you made that the brief left open; the owner's phone check above; what you
did not do and why. Never push. Never touch a protected file. Named by tier, never by model.
