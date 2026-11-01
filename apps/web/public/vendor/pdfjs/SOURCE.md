# pdf.js 6.4.299 (the legacy build), for the converter and the documents

**What it is:** Mozilla's PDF reader in JavaScript. Ghosty uses it on the phone to turn a PDF's pages into pictures, to
take a PDF's words out, and to read a PDF as a document with its headings (`apps/web/src/convert/vendor.ts`,
`apps/web/src/docs/read.ts`). The legacy build is the one made to run on older browsers too (an iPhone a few versions
behind). Nothing is sent anywhere: the file is read in the page and in pdf.js's worker, both from this site.

**Package:** `pdfjs-dist@6.4.299` from the npm registry (Mozilla's own distribution of the build), fetched on 1 November 2026.

| | |
| --- | --- |
| npm tarball | `pdfjs-dist-6.4.299.tgz`, https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz |
| integrity (npm, SHA-512) | `sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==` |
| tarball SHA-256 | `86269b40170eb41740ea05ad2102d71d33de4f122b34eb2f478be0ea7779c415` |
| upstream | https://mozilla.github.io/pdf.js/ |

**Files here, unchanged from the tarball:**

| File | From | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `pdf.min.mjs` | `package/legacy/build/pdf.min.mjs` | 523,774 | `bccc24ea711db8e44503629519904a5292d73b9daaa214bbe7cdcc282b0f4259` |
| `pdf.worker.min.mjs` | `package/legacy/build/pdf.worker.min.mjs` | 1,321,307 | `145d2dd3ab0c86151011dba95acfa2d5336e2accd59388ea43dbee0efddaaec6` |
| `LICENCE` | `package/LICENSE` | 10,174 | `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594` |

**Licence:** Apache License 2.0 (`LICENCE`). **Left out:** the character maps (`cmaps/`, for old Chinese, Japanese and
Korean PDFs without their own) and the standard fonts' data (`standard_fonts/`): a PDF that needs them still opens, its
letters drawn in the phone's own fonts. The standard fonts' widths in `apps/web/src/convert/fonts.ts` were read from this
worker's metrics, once, for the converter's own PDF writer.
