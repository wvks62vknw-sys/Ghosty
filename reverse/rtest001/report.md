# Reverse engineering report

**Target:** https://example.com  
**Kind:** web  
**Started:** 2026-10-16T00:10:20.684Z  
**Question:** what is it built with


## Site overview (Ghosty baseline)

- **Title:** Example Domain
- **Final URL:** https://example.com/ (HTTP 200, 1 KB)
- **Server:** cloudflare  ·  **Powered by:** ?
- **Technologies spotted:** none recognised
- **Scripts:** 0 (0 first-party scripts scanned)
- **Stylesheets:** 0  ·  **Forms:** 0
- **Third-party hosts:** none

**API endpoints found in code (0):**
- none found

**Security headers:**
- content-security-policy: ✗ missing
- strict-transport-security: ✗ missing
- x-frame-options: ✗ missing
- x-content-type-options: ✗ missing
- referrer-policy: ✗ missing
- permissions-policy: ✗ missing


> REA web page (rea inspect-web-page https://example.com): rea inspect-web-page https://example.com --json exited 1


> REA web bundle (rea analyze-web-bundle https://example.com): rea analyze-web-bundle https://example.com --json exited 1


> REA WebMCP tools (rea discover-webmcp-tools https://example.com): rea discover-webmcp-tools https://example.com --json exited 1


---
_Finished 2026-10-16T00:10:22.994Z · 3 problem(s) · REA by morluto (MIT) · for lawful research only_
