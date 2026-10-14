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

Runs on free tiers: one Cloudflare Worker + Durable Object, GitHub, and free AI keys
(Gemini, Groq, Cerebras, OpenRouter, Mistral).
