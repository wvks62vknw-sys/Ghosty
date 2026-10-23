# Website builder: the fixes the adversarial review demands (before the next merge to main)

Read BRIEF-W0.md (shared rules), HANDOFF.md ("Wave C website builder" and the owner's hard rules: honesty, free only,
nothing public without his choice), MAP.md's entries for sites and the sitekit, then the code: `packages/shared/src/sitekit/**`,
`apps/edge/src/sitebuild.ts`, `apps/edge/src/tools/sites.ts`, `apps/web/src/offline/site.ts`, `sitework.ts`,
`apps/web/src/assistant/session.ts` (the offline site turn), `apps/web/src/features/core/sitecard.ts`, and the tests
`apps/edge/test/sitekit.test.mjs`, `sites.test.mjs`, `tests/websites.spec.mjs`. The review's probe scripts are in
`/tmp/claude-0/-home-user-Ghosty/6a05925c-6839-5546-8e68-c6df376dadfa/scratchpad/websites-review/` (read-only; copy
what you reuse). Work ONLY in those files plus `apps/edge/test/*`; no protected files (the `sites` group's wording in
`tools/index.ts` is noted for the orchestrator, finding 22). Another builder is restyling the interface: keep any
change to `sitecard.ts` and `session.ts` to the logic named below.

## Must fix (each with a test that fails on the old code)

1. **Made-up trust and legal claims** (templates.ts ~116, 117, 151, 309, 316, 321, ~345–352, ~410, ~524, ~575):
   "Fully insured", "Work guaranteed", "Gas Safe"/"CP12", "registered with the DNO", "NHS staff discount", "No joining
   fee", "Tickets are refundable", "encrypted at rest", "no card needed", "walk-ins welcome", "card and cash", "people
   recommend us", "repeat customers", "do I need a GP referral? No". Render such a claim ONLY from a brief fact (via
   `needs` or a condition); otherwise leave it out. Every remaining default line is listed in `confirm`. Test: for every
   kind, planFrom on a bare brief → assemble → the html never matches
   /insur|guarantee|registered|CP12|Gas Safe|NHS|refund|encrypted|walk-ins|recommend|repeat customers|referral/i
   unless the brief supplies it.
2. **The writer and the critic can add claims without digits** (write.ts ~127–141 `rejectRewrite`; EDITABLE ~15):
   reject a rewrite that adds a claim word (registered, insured, accredited, award, rated, star(s), verified, certified,
   approved, guarantee(d), qualified, NHS, Which?, Checkatrade, Trustpilot, best, number words such as twenty, hundred,
   thousand, years of experience…) not present in `factLines(brief)` or the old text; make the honesty gate scan the
   body for the same list against the brief. Test: `rejectRewrite(old, 'Gas Safe registered, award-winning', 240, brief)`
   is non-empty; the gate flags a body claim the brief does not support.
3. **Made-up stars** (blocks/proof.ts ~52, ~70; templates.ts ~40–46): no stars when `rating` is undefined; no average
   unless every review has a real rating. Test: reviews without ratings → no "out of 5 stars" and no "★" stat.
4. **The confirm list is lost after a model wait, and defaults become "facts"** (sitebuild.ts ~281–283; write.ts ~62):
   keep the original brief (`job.facts`) apart from the filled-in one; compute `confirm` from the original; hand the
   writer only real facts, with defaults clearly marked unconfirmed (and `allowedNumbers` built from real facts only).
   Test: the planner throws once with waitMs → the report still says "opening hours (typical ones are shown)".
5. **Silent overwrite and slug collisions** (sitebuild.ts ~121, ~344; sites.ts ~475): the approval looks the slug up
   and says "replaces <title>" when a page is there (or picks a numeric suffix); a short random suffix when the slug is
   empty or not Latin (Arabic, Chinese, emoji names all slugged to `site-barber`). Test: a page at the slug → the
   approval matches /replac/ or the slug differs; three non-Latin names → three different slugs.
6. **The picture call bypasses the free-AI ledger** (sitebuild.ts ~202–216 `makePicture`): charge `cost.image(6)`
   through the shared neuron ledger before `ai.run` (as tools/pictures.ts does), and check storeImage's daily count
   and the https origin BEFORE running the model. Test: a fake AI binding with the ledger full → makePicture returns
   null and `ai.run` is never called.
7. **Stock photos shown as the business's own work; one licence red flag**: never use stock in "work / portfolio /
   services / from the salon / what is cooking" blocks (neutral headings or leave the block out); photographer and
   portfolio galleries only from owner-supplied images; drop the GymNation interior photo (licence laundering
   pattern on Commons); keep the credits honest. Test: photographer planFrom with no owner images → no gallery-grid on
   the work page; the vetted list no longer contains the GymNation file.
8. **The offline builder takes over the owner's next message** (assistant/session.ts ~429 `offlineSiteTurn`,
   `siteAsk`): a message counts as answers only if it looks like answers (mergeAnswers finds a fact, or it is short with
   no question or command verb); never take over a message while online; `siteAsk` only for a website FOR something
   ("the NHS website", "the site visit", "home page widget" are not asks). Test: a pending question set plus "remind me
   to ring Dr Patel at 4pm…" → offlineSiteTurn is false; the four false positives named in the review are false.
9. **Email injection in the form** (sitebuild.ts ~98 `briefOf`; assemble.ts ~381; gates.ts ~133): validate the email
   with `emailOf` and refuse anything else; encode the address in `mailHref` and in the form JS. Test: the email
   `owner@fade.example?bcc=spy@evil.example` → no "bcc" anywhere in the html.
10. **Publish only after the owner confirms**: build step 5 publishes the page as a DRAFT (or without every unconfirmed
    claim) and goes live only after the owner confirms the "Please confirm" list from the approval or the chat; the
    report says which state it is in. Test: a build with unconfirmed defaults ends in draft; confirming publishes.

## Soon (do them if the must-fix list is done within your run; otherwise list them for the next)

11. Gate errors never stop a publish (sitebuild.ts ~331–347; gates.ts ~180–186; images.ts ~92, ~105, ~147): honesty and
    placeholder errors block step 5 or the report says "published with N problems"; call `uncredited()`; reject BY /
    BY-SA images with an unknown author.
12. The approval says which personal details go public ("Public on the page: phone X, email Y, address Z; forms go to
    WhatsApp X") (sitebuild.ts ~126; brief.ts ~61–63; blocks/hero.ts ~223).
13. Model waits and resume (sitebuild.ts ~53, ~292, ~303): `waits` per step; record `job.wrote = i`; saveJob after
    pushing to `plain`.
14. The critic's "drop" fixes remove the wrong sections (write.ts ~261): resolve targets first, drop from the highest
    index down. Test: drop price-list (1) and media-text (2) → exactly those two go.
15. SEO claims that cannot take effect (sites.ts ~323, ~328, ~341, ~365; gates.ts ~99): copy og:title/description/image
    into the outer /s/<n> page and stop claiming SEO, or make indexing an explicit owner choice.
16. Screenshots (Microlink / thum.io, keyless): skip when `env.IS_PREVIEW` or a mock model is in use or a
    NO_SCREENSHOTS flag is set; keep the shots in the job so a rerun does not repeat them; the preview server must
    never reach them.
17. Small: the map iframe's referrerpolicy overrides the page's no-referrer (blocks/media.ts ~145; narrow the frame
    policy to `https://www.openstreetmap.org/export/embed.html`); "Open now" should use Europe/London (assemble.ts ~362);
    `img()` writes width/height unescaped (html.ts ~61; coerce to numbers); cancel after step 5 leaves the site live
    and model pictures stay public at /i/<id> for 10 years after unpublishing (sitebuild.ts ~209); long requests are cut
    to 2,000 characters silently (sitebuild.ts ~88; brief.ts ~111): say so; the Commons/Openverse user agent needs a
    contact address; Unsplash's download-event call and UTM links.

## Checks

`apps/edge/test/sitekit.test.mjs` and `sites.test.mjs` (targeted while working), the full edge `npm test` once at the
end (≈ 16 min on this shared 4-core machine), `npx tsc --noEmit -p tsconfig.json`, `npm run check` in `apps/web`,
`tests/websites.spec.mjs` on your port **8809**. Prompt budgets never raised.

## Finish

Commit on your worktree branch, often (do not push, do not merge). Final report: each finding with what you changed
(file:line) or why not; tests and proof they fail on the old code; every check with its exact result; what is left
for the next pass.
