# BRIEF-REST-A — offline Wikipedia, Siri Shortcuts, Morse (batch ⑧ part A, 1 Nov 2026)

Worktree from the LOCAL tip of claude/ghosty-ai-training-idwhp9 (at or after ceb6634; never reset to FETCH_HEAD or origin,
only to the local branch). Your preview port: 8744. Read first: ROADMAP.md row ⑧; OWNER-ISSUES 91 (c), 92 ⑧, 95–97, 99 (the
catalogue rules), 100 (how the brain's big downloads work on the phone: his tap, Wi-Fi, the size said, pieces, the Cache
API, deletable — `apps/web/src/offline/brain.ts` is the pattern), 105 (the pack pattern, if you add any brain tool — you
should not need to: all three are phone-side); `apps/web/src/features/library/index.ts` (the Library tab: your Wikipedia
lives there as a section), `apps/web/src/assistant/phrases.ts` + `local.ts` (the no-model phrases), `apps/web/src/features/
settings/*` (a SHORTCUTS panel goes there), `apps/web/sw.js` or wherever the service worker lives (read-only unless the
reader needs it), `apps/web/public/_headers` (the security policy: the reader must run inside it). Other builders run in
parallel (the car, the people/work/creative packs, the social self): touch nothing under `car/`, `features/studio/`,
`features/people|work|creative/`, `social/`, `features/links/`. Yours: `apps/web/src/wiki/*` (new), `apps/web/public/vendor/
kiwix/*` (vendored reader), the Library tab's new section, `apps/web/src/features/settings/shortcuts.ts` (+ one row in the
Settings registry), `apps/web/src/morse/*` + a small sheet, your phrases, `packages/shared/src/catalogue/resta.ts` (joined
where the catalogue files are), `apps/edge/test/resta.test.mjs` (bundling the phone modules as the other phone tests do),
`tests/resta.spec.mjs`, the CI smoke loop's list (`resta` after `games3`), `apps/edge/package.json`'s test list, a CSS block
at the END of styles.css. The plain prompt is at exactly 5,500: add nothing to it.

## 1. OFFLINE WIKIPEDIA (the Library → WIKIPEDIA, OFFLINE)

- THE FILE: a ZIM from the Kiwix library (`https://download.kiwix.org/zim/wikipedia/`, public; read the listing to pick):
  offer two sizes on his tap, on Wi-Fi, the size said first, the file in pieces into the Cache API (or OPFS if Safari holds
  it better: measure the quota the way brain.ts does) and deletable in one tap: SIMPLE ENGLISH WIKIPEDIA, NO PICTURES (about
  250 MB: every Simple English article) and a small taster (the "top 100" or "mini" English ZIM, tens of MB) so he can try
  it in a minute. If download.kiwix.org sends no CORS header, stream it through the Worker (`/api/zim/<file>`: a plain
  passthrough with the size and range headers, the owner only; nothing cached on the Worker; nothing that bills) and say so
  in SOURCE.md. Never the full English Wikipedia (tens of GB): say in the panel why.
- THE READER: Kiwix's own JavaScript reader (kiwix-js, GPL-3; `git clone --depth 1 https://github.com/kiwix/kiwix-js
  /home/user/kiwix/kiwix-js` works: public clones go through the proxy, archive URLs and the API do not) — take only the ZIM
  archive reader (the ZIM format parsing, the xz and zstd decoders it ships), vendored under `public/vendor/kiwix/` with
  LICENCE and SOURCE.md (the commit, the files taken, your patches as diffs), used from `apps/web/src/wiki/zim.ts`. If the
  reader cannot be made to run under the page's security policy within a fair try, write a reader of our own for the ZIM
  format's directory, title index and clusters (the format is documented; the decoders are the hard part: xz via a small
  WASM or JS decoder you can vendor from an npm package with its licence; zstd likewise) — say which you did.
- THE SCREEN: in the Library tab a WIKIPEDIA, OFFLINE section: a search box (title prefix search from the ZIM's title index,
  results as you type, 44 pt rows), an article view (the article's HTML rendered inside a sandboxed iframe from a blob with
  links rewritten to open other articles in place, images from the ZIM where the file has them, a READ IT TO ME button
  through the existing voice, BACK, a random article), OFFLINE badge, the file's date from its metadata ("Simple English
  Wikipedia, March 2026, 250 MB on your phone"), DELETE. Works with the network off (the spec proves it).
- THE CHAT: no-model phrases "look it up offline" / "offline wikipedia <thing>" / "what does wikipedia say about <thing>
  (offline)" answer with the article's first paragraph as a card (OPEN) from the phone; when the phone is offline and the
  brain cannot be reached, any "what is X?" the chat cannot answer offers the offline article if the title matches.
  The brain itself never reads the ZIM (it is on the phone); say so in the catalogue words.

## 2. SIRI SHORTCUTS (Settings → SHORTCUTS)

- DEEP LINKS the app already understands (find them: `?open=<tab>&panel=…` and the deck's links) plus two new ones:
  `?say=<text>` (puts the text in the chat box and sends it when it is a question or a plain ask; leaves it in the box when
  it would start something, per the catalogue's TRY IT rule) and `?do=<command>` for the app's own commands (a timer, open
  the Lens on SCAN, the arcade, SIT, WALK ME HOME, a reminder) — the owner's signed-in session only; a stranger's link
  opens the sign-in.
- THE PANEL: a gallery of twelve ready shortcuts with a name, what it does, the URL (COPY), and the plain steps once for
  the Shortcuts app ("Shortcuts → + → Open URLs → paste → name it → Add to Siri: 'Hey Siri, Ghosty timer'"); he can make his
  own: pick a screen or type words → the URL made for him. Nothing is installed by us (iOS allows no such thing from a web
  page); say so in one line.

## 3. MORSE (a sheet from the chat: "morse", "in morse", "decode morse")

Text → Morse (shown, played on the synth at a WPM he sets, flashed on the screen since Safari has no torch API) and Morse →
text (typed dots and dashes, or TAPPED on a pad: short and long presses timed into letters), a LEARN mode (a letter a day
and a five-letter quiz), the chart. Tiny and polished.

## The lines that hold

Only public, free files with their licences (the Kiwix library's ZIMs are CC BY-SA Wikipedia content; say the licence in
the panel); downloads only on his tap, on Wi-Fi, the size said, deletable; nothing that bills (a Worker passthrough costs
nothing on the free plan: confirm the size stays under what the plan allows per request by streaming, and say so); the plain
prompt untouched; no test skipped or weakened; the guard job untouched; no model names anywhere; every new thing has its
catalogue entry (the section, the phrases, the panel, the sheet).

## Tests

`resta.test.mjs`: the ZIM reader on a tiny fixture ZIM you build or fetch (a few articles; the title index; a compressed
cluster of each kind the file uses), the link rewriter, the first-paragraph extraction, the deep-link parser (`say`, `do`,
a stranger), the shortcut URL maker, Morse both ways and the tap timer. `tests/resta.spec.mjs` on your preview: the panel
offers the two files with sizes; GET on stubbed mobile data waits; with the store stubbed to serve the fixture ZIM, search
finds a title, the article renders in its frame, a link opens another article, READ IT TO ME speaks (the voice stub), the
network off still searches and opens, DELETE; `?say=what is a cat` sends; `?do=open:lens` opens the Lens; the SHORTCUTS
panel's COPY; the Morse sheet plays and decodes a tapped letter; nothing sideways at 390 × 844; VoiceOver labels.

## Working lean

Ranged reads; `tail -30`; the brain suite once at the end under `nice -n 10`; no narration. Validation: brain typecheck +
suite; web typecheck + build; on one fresh preview: websites, apps, library, resta, deck, nav.

## The report (one message)

Base SHA, HEAD SHA, the worktree branch; commits; files (vendor sizes); validation numbers; which reader (Kiwix's or ours)
and why; the ZIM files offered with sizes and dates; LIMITS; DESIGN PICKS THE OWNER MAY CHANGE; NEEDS HIS PHONE (the 250
MB download on Wi-Fi; Safari's storage); WHAT THE MERGE MUST KNOW.
