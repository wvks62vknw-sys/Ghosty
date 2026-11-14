# planlane parts

Each `<screen>.mjs` here exports `async function run(H)` and is run by `tests/planlane.spec.mjs` after its core checks, in name
order. `H` is the harness: `{ browser, phone(viewport, world?, seedLocalStorage?), open(page, tab), fit(page, selector), check(ok, msg),
log(msg), pure(entryPath), chat(page, words), out, base, KEY, today(), PHONE, PHONE2, WORLDS, RAW, TONE, DIRECTORY }`.
Run one part alone: `PLANLANE_ONLY=radio node tests/planlane.spec.mjs tests/.shots` (add `core` to run the core checks too, `core,looks` for their seven looks). In a full run the parts go in two lanes at once (see LANES in the spec): a part that changes the preview brain belongs in the first.
