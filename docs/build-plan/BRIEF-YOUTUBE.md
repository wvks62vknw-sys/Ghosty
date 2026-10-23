# Wave D: a YouTube link → a summary with timestamps, and quiz cards for LEARN

From the plan (Wave D): "YouTube link → summary with timestamps + quiz cards". Read BRIEF-W0.md, MAP.md's entries for
the web tools (`apps/edge/src/tools/web.ts`: how pages are fetched and cut to budget), the library importers
(`library/importers.ts`), the tutor and LEARN (`apps/edge/src/tutor.ts`, `apps/web/src/features/learn/*`: how quizzes
and revision cards (SM-2) are made and kept), the proxy's allowed hosts (how feeds are added; `index.ts` is protected:
report any host you need), the quota engine (which model tier to use: the cheap lane), and `tools/extra.ts` (where an
unprotected tool is registered automatically). Other builders are restyling `features/*` and wiring the school: no
interface files beyond one new card component (`apps/web/src/features/core/ytcard.ts`, rendered through the existing
reply-card hooks: say exactly what one line it needs in the chat renderer if any). Work ONLY in: new
`apps/edge/src/integrations/youtube.ts`, `apps/edge/src/tools/extra.ts` (the tool), new `apps/web/src/features/core/ytcard.ts`,
`apps/edge/test/web.test.mjs` or a new test run through an existing file, `tests/ui.spec.mjs` (one check), MAP.md.

## Build

1. **The transcript, free and keyless** (`integrations/youtube.ts`): from a YouTube link or id, read the watch page
   for its caption tracks (`ytInitialPlayerResponse` → `captions.playerCaptionsTracklistRenderer.captionTracks`, the
   English or auto-generated track) and fetch the `timedtext` track as JSON or XML; keep (start, text) lines. If YouTube
   refuses the Worker (it often blocks datacentre addresses) try the oEmbed endpoint for the title only and say
   plainly that the transcript could not be fetched, offering the owner the paste route (he can paste a transcript
   from the YouTube app's "Show transcript"). Never a third-party transcript service, never a key. Cut to the tool
   budget (long videos: the first 25,000 characters with a note).
2. **The tool** `summarise_video { url, quiz?: boolean }` in `tools/extra.ts` (keyword-gated by the `extra` group's
   rules; keep the prompt budgets): title, length, a summary in plain words, then 5–10 timestamped moments
   (`[12:40] why the second battery matters`) as links back to the video at that second, and with `quiz` (or when the
   owner says "quiz me on this"), 5 questions with answers made from the transcript through the cheap lane, saved as
   LEARN revision cards (the same store the tutor uses) and said so ("5 cards added to LEARN → REVISE"). The whole
   thing filed in the library (kind `video`, the transcript's lines with their timestamps as passages) so later
   questions can cite the moment.
3. **The card** (`ytcard.ts`): the reply shows a video card (thumbnail from `i.ytimg.com` through the proxy or the
   oEmbed thumbnail, title, length) above the moments, each moment a link; plain, route C's reply-card style
   (reuse the existing classes; no new colours).
4. **Honesty**: if the transcript is auto-generated say so; if it could not be fetched say exactly why and what to
   paste; never invent moments.

## Tests (each must fail on the old code)

The watch-page parser on a fixture (caption tracks found; the English track chosen; auto-generated flagged); the
timedtext parser (JSON and XML fixtures); the budget cut; the tool's reply shape with a mocked fetch and a scripted
model; the cards reaching the LEARN store; the refusal path with YouTube returning 403; `tests/ui.spec.mjs`: a reply
with a video card renders its moments as links. Then tsc, `npm run check`, the full edge `npm test` once.

## Finish

Commit on your worktree branch (do not push, do not merge). Final report: what works keylessly and what YouTube
blocked in your tests (fixtures only: no live YouTube calls from here); the proxy host(s) needed; the renderer line
if any; tests and proof; every check's exact result.
