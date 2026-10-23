# What was made better, and by how much

The running list the owner asked for (HANDOFF.md, "The owner's bar"): every improvement with before-and-after
evidence (a measured number, a screenshot, a test), so the scale of it can be seen. Newest first. A line is added
when the change is merged into the branch, not when it is planned.

| Date | Area | What changed | Before | After | Evidence |
|---|---|---|---|---|---|
| 23 Oct | Library / self-study | STUDY reads one field at a time, hundreds of pieces a day on his own (STUDY ALL), honest "x of y · time left" line, the curriculum grows from Wikipedia's outlines | 3 pieces every 15 min, fields mixed; ~4,000 pieces by hand | 5 pieces every 10 s while there is room (up to 1,000 a day), one field at a time; Algebra alone grew from 59 to 259 topics in one look | `apps/edge/test/study.test.mjs` (6 new tests), `tests/library.spec.mjs` at 440 × 956 |
| 23 Oct | Design | Mock-ups of routes A, B and C on the 18 Pro Max screen, for the owner's pick | the round-5 look the owner called terrible | `docs/build-plan/mockups/{a,b,c}/contact.png`; route C self-scored 9/10 on every screen | the PNGs |
| 23 Oct | Plan | The ordered three-week plan, the baseline audit and this list exist | no plan file; last run out at 89% | `docs/build-plan/PLAN.md`, chunks of 15–30 min | this folder |
