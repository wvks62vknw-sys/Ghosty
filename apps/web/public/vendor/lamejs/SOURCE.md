# lamejs 1.2.1, for writing MP3 on the phone

**What it is:** the LAME MP3 encoder ported to JavaScript by Alex Zhukov. Ghosty uses it on the phone to write a recording
as an MP3 (`apps/web/src/convert/audio.ts`, `apps/web/src/convert/vendor.ts`). The brief allowed MP3 writing only if an
encoder fitted under 300 KB: this one is 156,043 bytes. Nothing is sent anywhere.

**Package:** `lamejs@1.2.1` from the npm registry (its author's own distribution), fetched on 1 November 2026.

| | |
| --- | --- |
| npm tarball | `lamejs-1.2.1.tgz`, https://registry.npmjs.org/lamejs/-/lamejs-1.2.1.tgz |
| integrity (npm, SHA-512) | `sha512-s7bxvjvYthw6oPLCm5pFxvA84wUROODB8jEO2+CE1adhKgrIvVOlmMgY8zyugxGrvRaDHNJanOiS21/emty6dQ==` |
| tarball SHA-256 | `d8d099ef788808c15bc9b4a407dd23ae935feb1152e6bb0efdcd24e3e91c2a2d` |
| upstream | the LAME project, https://lame.sourceforge.io/ (the JavaScript port is named in the package's own README) |

**Files here:**

| File | From | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `lame.min.js` | `package/lame.min.js`, unchanged | 156,043 | `15d285e2587b3bdbfd18a68de6ce07cc074f7480a82c3815da2dc1c348ec6df4` |
| `LICENCE` | the package's `LICENSE`, then the LGPL-3.0's text from SPDX's licence list (https://spdx.org/licenses/LGPL-3.0-only.json), with a line saying so | 43,170 | `cb341d3a320652aab828921334caf4005b98021558daa7fdbe57291dbecd9caa` |

**Licence:** GNU Lesser General Public License, version 3 (`"license": "LGPL-3.0"` in the package). The encoder is used
as the separate file it ships as, unchanged, loaded only when an MP3 is made; its source is upstream's (above) and the
package's own `src/` on the npm registry. The package's tarball carries no copy of the LGPL itself, and gnu.org did not
answer from here, so its text came from SPDX; the GPL-3.0 it builds on is in `../stockfish/LICENCE`.
