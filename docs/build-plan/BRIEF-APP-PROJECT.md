# Mini-apps as a Workshop project (APPS follow-up)

`build_app` (`apps/edge/src/appbuild.ts`, `tools/sites.ts`) runs its five steps inside the call and resumes from
`appjob:<name>` records; the Workshop's PROJECTS panel knows nothing of it. Read BRIEF-W0.md, MAP.md, `appbuild.ts`,
`apps/edge/src/projects.ts` (how `build_website` is a project: steps, progress, resume, the report), the project
types in `packages/shared/src/protocol.ts` (not protected), `apps/web/src/features/workshop/index.ts` (PROJECTS: the
progress ring and step list), `tests/apps.spec.mjs` and `apps/edge/test/appkit.test.mjs`.

## Build
A mini-app build is a PROJECT like a website build: it appears in Workshop → PROJECTS with its five steps (brief and
plan → build and icon → check → publish → report), progress, the live step name, the report with the link, INSTALL
steps and UNDO when done, and a failed or cut-short build resumes from its record when tapped. The chat reply and the
`show_link` card stay as they are. No kernel file: `projects.ts` and `protocol.ts` are open.

## Tests
`appkit.test.mjs`: a build_app run creates and advances a project record step by step, a cut-short run resumes at the
right step, the report has the link. `tests/apps.spec.mjs`: after "make me an app …" in the chat (the scripted phrase),
Workshop → PROJECTS shows the app project with all steps done and the link. `npm run check`, the edge tsc, the sites
and appkit tests, the apps, projects and websites specs.

## Finish
Commit on the worktree branch (do not push, do not merge). Report: files, screenshots, every check's exact result.
