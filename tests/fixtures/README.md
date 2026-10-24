# Test pictures

| File | What | Source | Licence |
| --- | --- | --- | --- |
| `lemon.jpg` | a lemon on white, 330 × 274, 17 KB (tests/name.spec.mjs: NAME must say "lemon") | "Whole-Lemon.jpg" by Evan-Amos, Wikimedia Commons (320 px thumbnail) | CC0 1.0 |

# Test web pages

`cited.json` (made for these tests, no outside source): a DuckDuckGo results page and one article about the speed of light, served instead of the real web to `apps/edge/test/cited.test.mjs` and, through `tests/preview-server.mjs`, to `tests/cited.spec.mjs`.

# Recon report

`threats-recon.json`: the brain's real answer to `GET /api/recon?target=example.com` on 24 Oct 2026 (public DNS,
RDAP, certificate, archive and hosting records of IANA's example domain), served instead of a live run to
`tests/threats.spec.mjs`. It keeps example.com's null MX ("0 .", `noMail: true`), its six missing headers and its 13
open ports.
