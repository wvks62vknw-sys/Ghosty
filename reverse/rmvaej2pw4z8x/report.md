# Reverse engineering report

**Target:** https://linear.app/  
**Kind:** web  
**Started:** 2026-10-16T03:22:40.629Z


## Site overview (Ghosty baseline)

- **Title:** Linear – The system for product development
- **Final URL:** https://linear.app/ (HTTP 200, 1227 KB)
- **Server:** cloudflare  ·  **Powered by:** ?
- **Technologies spotted:** Next.js, Cloudflare, Vite, React
- **Scripts:** 3 (3 first-party scripts scanned)
- **Stylesheets:** 40  ·  **Forms:** 0
- **Third-party hosts:** static.linear.app, rolldown.rs, vinext.local, react.dev, nextjs.org, www.w3.org

**API endpoints found in code (31):**
- `/api`
- `/api/`
- `/api/oauth-app-manifest-schema`
- `/api/llms`
- `/api/draft-mode/disable`
- `/api/draft-mode/enable`
- `/api/draft-mode/status`
- `/api/health/liveliness`
- `/api/health/readiness`
- `/api/mobile-diffs-waitlist`
- `/api/og/careers`
- `/api/og/customers`
- `/api/og/developers`
- `/api/og/docs`
- `/api/og/generic`
- `/api/og/integrations`
- `/api/og/integrations-category`
- `/api/og/learn`
- `/api/og/main`
- `/api/og/method`
- `/api/og/now`
- `/api/og/twitter`
- `/api/reviews-waitlist`
- `/api/route-protection/crypt`
- `/api/route-unlock`
- `/api/rss/changelog.json`
- `/api/rss/changelog.xml`
- `/api/rss/now.json`
- `/api/rss/now.xml`
- `/api/search-index`
- `/api/unsubscribe`

**Security headers:**
- content-security-policy: ✓ default-src 'self' https://static.linear.app https://static.linear.dev; connect-src https://*.ads.linkedin.com 'self' ht
- strict-transport-security: ✓ max-age=63072000; includeSubDomains
- x-frame-options: ✗ missing
- x-content-type-options: ✓ nosniff
- referrer-policy: ✓ same-origin
- permissions-policy: ✗ missing

**Script files:**
- https://static.linear.app/web/_next/static/chunks/C_JJxWoe.js
- https://static.linear.app/web/_next/static/chunks/B5mLuTUC.js
- https://static.linear.app/web/_next/static/chunks/index-DrFM7gz5.js


> browser for REA: Chrome did not start


---
_Finished 2026-10-16T03:23:11.227Z · 1 problem(s) · REA by morluto (MIT) · for lawful research only_
