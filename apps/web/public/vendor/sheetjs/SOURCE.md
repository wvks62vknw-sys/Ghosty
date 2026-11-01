# SheetJS Community Edition 0.20.3 (the "mini" build), for the converter's tables

**What it is:** SheetJS's spreadsheet library. Ghosty uses it on the phone to write a CSV or JSON table as an Excel file
and to read an Excel (or OpenDocument) workbook back as rows, the header row kept (`apps/web/src/convert/table.ts`,
`apps/web/src/convert/vendor.ts`). The mini build reads and writes the modern formats (XLSX, CSV and the plain ones).
Nothing is sent anywhere.

**Package:** `xlsx@0.20.3` from SheetJS's own site (since 0.18.6 SheetJS publishes releases there, not on npm), the
release list at https://cdn.sheetjs.com/xlsx.lst naming 0.20.3 as the latest, fetched on 1 November 2026.

| | |
| --- | --- |
| tarball | `xlsx-0.20.3.tgz`, https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz |
| tarball SHA-256 | `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8` |
| upstream | https://sheetjs.com/ (the Community Edition) |

**Files here, unchanged from the tarball:**

| File | From | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `xlsx.mini.min.js` | `package/dist/xlsx.mini.min.js` | 279,523 | `0cb353f830d7288385492c83d277b058ddeac664ca51cf1393aa1fd3e2b70939` |
| `LICENCE` | `package/LICENSE` | 11,355 | `4d2a38ac35cda06a555c84074a819d413339cd3691b822cae50f8f322fe01f64` |

**Licence:** Apache License 2.0 (`LICENCE`).
