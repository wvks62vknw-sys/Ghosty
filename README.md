# Ghosty 2.0

A personal AI for exactly one person. It answers only to you, it can act on the world
through tools, and it can **rebuild itself**: ask for a feature and it edits its own code,
lets you check a preview, ships it when you say so, and can roll any change back.

- **Set up:** [SETUP.md](SETUP.md)
- **Code map** (Ghosty reads this before every self-edit): [MAP.md](MAP.md)

```
apps/web     interface: God's Eye globe, arc reactor, briefings, threats, markets, workshop
apps/edge    brain: agent loop, tools, model router, memory, encrypted keys, self-edit
packages/shared   types shared by both
tests/       local preview server + browser test
```

## How Ghosty learns

- **Handbook** (`apps/edge/src/knowledge/`): playbooks on how to engineer changes without mistakes —
  method, self-review checklist, strict TypeScript, a catalogue of CI errors and fixes, debugging, and
  complete worked examples for this codebase (new tab, panel + feed, brain tool, screen action, widget).
  Ghosty looks them up with `study` before it builds anything.
- **Lessons**: whenever a check fails and Ghosty fixes it, it records the cause and a rule with
  `learn_lesson`. Lessons are put in its instructions from then on (most-repeated first) and are listed
  in **Memory → Lessons learned**, where you can delete any that are wrong.
- **Guard rails**: a fast self-check rejects the mistakes free models make most (placeholder comments,
  half-deleted files, duplicate declarations, missing imports, unregistered tabs, blocked feed hosts),
  and coding turns are routed to the strongest free models with room for longer replies.

Runs on free tiers: one Cloudflare Worker + Durable Object, GitHub, and free AI keys
(Gemini, Groq, Cerebras, OpenRouter, Mistral).
