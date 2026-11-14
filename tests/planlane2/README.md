# planlane2 parts

The next round's checks for the PLAN AND HOME lane: each `<name>.mjs` exports `async function run(H)`, run by `tests/planlane2.spec.mjs` with the same harness as `tests/planlane.spec.mjs` (see tests/planlane/README.md for `H`).
Run one: `PLANLANE_ONLY=onelist node tests/planlane2.spec.mjs tests/.shots`.
