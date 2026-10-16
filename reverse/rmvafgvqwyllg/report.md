# Reverse engineering report

**Target:** https://linear.app/  
**Kind:** web  
**Started:** 2026-10-16T03:48:52.292Z


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


## REA · browser targets

```json
{
  "evidence_id": "ev_197e480e098637eb17162c784b1e850ab7ff277996e792a35b6e8ada1ae18b4a",
  "subject": null,
  "provider": {
    "id": "rea-cdp-browser",
    "name": "REA Chrome DevTools Protocol observation provider",
    "version": "2"
  },
  "analysis_profile": null,
  "predicate_type": "rea.browser-target-list",
  "operation": "list_browser_targets",
  "parameters": {
    "cdp_endpoint": "http://127.0.0.1:9222",
    "allowed_origins": []
  },
  "raw_result": null,
  "normalized_result": {
    "browser": {
      "product": "Chrome/155.0.8059.39",
      "protocol_version": "1.3",
      "revision": "537.36 (@3ff7ac5a9224be9156d7f8703a06e22890aafd34)",
      "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36",
      "js_version": "15.5.35.20"
    },
    "targets": [
      {
        "target_id": "E4BB91F859710881411F162B331B49D9",
        "type": "page",
        "title": "Linear – The system for product development",
        "url": "https://linear.app/",
        "origin": "https://linear.app",
        "attached": null
      }
    ],
    "excluded": {
      "disallowed_origin": 0,
      "unsupported_url": 1,
      "non_page": 6
    },
    "limitations": [
      "All page targets with supported HTTP(S) URLs are listed.",
      "CDP discovery omitted attachment state for one or more targets; attached is reported as unknown."
    ]
  },
  "confidence": "observed",
  "authority": "external-service",
  "environment": {
    "id": "Chrome/155.0.8059.39@537.36 (@3ff7ac5a9224be9156d7f8703a06e22890aafd34)",
    "platform": "unknown",
    "architecture": "unknown",
    "isolation": "none"
  },
  "limitations": [
    "Artifact identity is unavailable for this observation.",
    "All page targets with supported HTTP(S) URLs are listed.",
    "CDP discovery omitted attachment state for one or more targets; attached is reported as unknown.",
    "Browser host platform and architecture were not observed."
  ],
  "relationship_coverage": null,
  "locations": [],
  "evidence_links": []
}
```


## REA · web page

```json
{
  "evidence_id": "ev_cf6ba3a23eacd1409b6ff7d6486450516d882b4ffdf58ef47c938083abe687e8",
  "subject": null,
  "provider": {
    "id": "rea-cdp-browser",
    "name": "REA Chrome DevTools Protocol observation provider",
    "version": "2"
  },
  "analysis_profile": null,
  "predicate_type": "rea.web-page-inspection",
  "operation": "inspect_web_page",
  "parameters": {
    "cdp_endpoint": "http://127.0.0.1:9222",
    "allowed_origins": [
      "https://linear.app"
    ],
    "target_id": "E4BB91F859710881411F162B331B49D9",
    "observation_ms": 4000,
    "include_accessibility_text": false,
    "include_console_text": true,
    "include_json_body_shapes": true,
    "include_websocket_shapes": false,
    "include_storage_keys": true,
    "include_storage_fingerprints": false,
    "include_script_sources": false
  },
  "raw_result": null,
  "normalized_result": {
    "browser": {
      "product": "Chrome/155.0.8059.39",
      "protocol_version": "1.3",
      "revision": "537.36 (@3ff7ac5a9224be9156d7f8703a06e22890aafd34)",
      "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36",
      "js_version": "15.5.35.20"
    },
    "target": {
      "target_id": "E4BB91F859710881411F162B331B49D9",
      "type": "page",
      "title": "Linear – The system for product development",
      "url": "https://linear.app/",
      "origin": "https://linear.app",
      "attached": null
    },
    "capture_window": {
      "started_at": "2026-10-16T03:49:11.546Z",
      "ended_at": "2026-10-16T03:49:16.223Z",
      "observation_ms": 4000
    },
    "completeness": {
      "status": "policy_filtered",
      "conditions": [
        "attach_limited",
        "policy_filtered"
      ],
      "policy_filtered_sections": [
        "accessibility",
        "console_events",
        "metadata",
        "resources",
        "script_sources",
        "scripts",
        "websocket_shapes",
        "workers"
      ],
      "attach_limited_sections": [
        "console_events",
        "metadata",
        "network_requests",
        "websocket_connections",
        "websocket_frames"
      ],
      "truncated_sections": [],
      "unavailable_sections": [],
      "excluded": [
        {
          "section": "accessibility",
          "reason": "not_approved",
          "count": 2164
        },
        {
          "section": "console_events",
          "reason": "disallowed_origin",
          "count": 1
        },
        {
          "section": "metadata",
          "reason": "disallowed_origin",
          "count": 395
        },
        {
          "section": "resources",
          "reason": "disallowed_origin",
          "count": 382
        },
        {
          "section": "resources",
          "reason": "unsupported_url",
          "count": 2
        },
        {
          "section": "script_sources",
          "reason": "not_approved",
          "count": 12
        },
        {
          "section": "scripts",
          "reason": "disallowed_origin",
          "count": 303
        },
        {
          "section": "websocket_shapes",
          "reason": "not_approved",
          "count": null
        },
        {
          "section": "workers",
          "reason": "out_of_target_scope",
          "count": 2
        }
      ],
      "dropped_events": {
        "scripts": 0,
        "network_requests": 0,
        "console_events": 0,
        "websocket_connections": 0,
        "websocket_frames": 0,
        "webmcp_tools": 0,
        "timeline_events": 0,
        "total": 0
      }
    },
    "frames": [
      {
        "frame_id": "E4BB91F859710881411F162B331B49D9",
        "parent_frame_id": null,
        "url": "https://linear.app/",
        "origin": "https://linear.app"
      }
    ],
    "dom": {
      "total_nodes": 5925,
      "nodes": [
        {
          "index": 0,
          "parent_index": -1,
          "node_type": 9,
          "node_name": "#document",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 1,
          "parent_index": 0,
          "node_type": 10,
          "node_name": "html",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 2,
          "parent_index": 0,
          "node_type": 1,
          "node_name": "HTML",
          "node_value_length": 0,
          "attribute_names": [
            "lang",
            "data-theme",
            "class",
            "style"
          ]
        },
        {
          "index": 3,
          "parent_index": 2,
          "node_type": 1,
          "node_name": "HEAD",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 4,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "META",
          "node_value_length": 0,
          "attribute_names": [
            "charset"
          ]
        },
        {
          "index": 5,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "META",
          "node_value_length": 0,
          "attribute_names": [
            "name",
            "content"
          ]
        },
        {
          "index": 6,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "as",
            "href"
          ]
        },
        {
          "index": 7,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "as",
            "href"
          ]
        },
        {
          "index": 8,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "as",
            "href"
          ]
        },
        {
          "index": 9,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 10,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 11,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 12,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 13,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 14,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 15,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 16,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 17,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 18,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 19,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 20,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 21,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 22,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 23,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 24,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 25,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 26,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 27,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 28,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 29,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 30,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 31,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 32,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 33,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 34,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 35,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 36,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 37,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 38,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 39,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 40,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 41,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 42,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 43,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-precedence"
          ]
        },
        {
          "index": 44,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 45,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 46,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 47,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 48,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 49,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 50,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 51,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 52,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 53,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 54,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 55,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 56,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "data-rsc-css-href",
            "data-precedence"
          ]
        },
        {
          "index": 57,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "fetchpriority",
            "href",
            "crossorigin"
          ]
        },
        {
          "index": 58,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "SCRIPT",
          "node_value_length": 0,
          "attribute_names": [
            "src",
            "type",
            "async",
            "crossorigin"
          ]
        },
        {
          "index": 59,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "SCRIPT",
          "node_value_length": 0,
          "attribute_names": [
            "src",
            "type",
            "async",
            "crossorigin"
          ]
        },
        {
          "index": 60,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 61,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 62,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 63,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 64,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 65,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 66,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 67,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 68,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 69,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 70,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 71,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 72,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 73,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 74,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 75,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 76,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 77,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 78,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 79,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 80,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 81,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 82,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 83,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 84,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 85,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 86,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 87,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 88,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 89,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 90,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 91,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 92,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 93,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 94,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 95,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 96,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 97,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 98,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 99,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 100,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 101,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 102,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 103,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 104,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 105,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 106,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 107,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 108,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 109,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 110,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 111,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 112,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 113,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 114,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 115,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 116,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 117,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 118,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 119,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 120,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 121,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 122,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 123,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 124,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 125,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 126,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 127,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 128,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 129,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 130,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 131,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 132,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 133,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 134,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 135,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 136,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 137,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 138,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 139,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 140,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 141,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 142,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 143,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 144,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 145,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 146,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 147,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 148,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 149,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 150,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 151,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 152,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 153,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 154,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 155,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 156,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 157,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 158,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 159,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 160,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 161,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 162,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 163,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 164,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 165,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 166,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 167,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 168,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 169,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 170,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 171,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 172,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 173,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 174,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 175,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 176,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 177,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 178,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 179,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 180,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 181,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 182,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 183,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 184,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 185,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 186,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 187,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 188,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 189,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href",
            "crossorigin",
            "fetchpriority"
          ]
        },
        {
          "index": 190,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
     
… (truncated)
```


## REA · web bundle

```json
{
  "evidence_id": "ev_912e9e15408c2b506346d5183e90fbc00a2a3c0aa3ebf1a7139f41d9071a0869",
  "subject": null,
  "provider": {
    "id": "rea-cdp-browser",
    "name": "REA Chrome DevTools Protocol observation provider",
    "version": "2"
  },
  "analysis_profile": null,
  "predicate_type": "rea.web-bundle-analysis",
  "operation": "analyze_web_bundle",
  "parameters": {
    "cdp_endpoint": "http://127.0.0.1:9222",
    "allowed_origins": [],
    "target_id": "E4BB91F859710881411F162B331B49D9",
    "observation_ms": 4000,
    "include_accessibility_text": false,
    "include_console_text": false,
    "include_json_body_shapes": false,
    "include_websocket_shapes": false,
    "include_storage_keys": false,
    "include_storage_fingerprints": false,
    "include_script_sources": true,
    "fetch_source_maps": true
  },
  "raw_result": null,
  "normalized_result": {
    "capture": {
      "target_url": "https://linear.app/",
      "scripts_observed": 12,
      "scripts_analyzed": 12,
      "source_artifacts": [
        {
          "sha256": "5abbd53652af82f4df4d18886e18d56d6b533caaee69b333f9a1563f9fa40393",
          "bytes": 38,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "045d5be93e7e20021308bb2190ead196a58fcccfce7611aac2838c526912664e",
          "bytes": 131,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "583efdab202fc79e8dcfc6c6c9e17b4ab48b49697274462efd43aa904ba2a127",
          "bytes": 216,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "67cbb25131ff60a6dba7f88ebbde56406e25a485f1b90cd85b7771ee96c1d965",
          "bytes": 18959,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "d4200728955735a6c584f11b4ba426753d0158966d5a4a7dcfc66ce30d4f89fa",
          "bytes": 715,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "73a61f5e41bf4c2d7dfac9106ec07f817f68a61bb1900bf4fb08674319cbfc6b",
          "bytes": 68797,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "278e2feed4dc402e43355892712be3b8f90ee0abd97695e6c23d2df62899d746",
          "bytes": 549,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "f561ab64d7b25aabcfc1af27bd1098287471408e1293a9f9b7cafcfa472e167c",
          "bytes": 14961,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "34ae81730bffe6dc8e3d8afa077e8adcb76756f312e03ec34612b21b429c289b",
          "bytes": 99966,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "8f7c5fc69f4bcbad5a9823dbbf8a1820f866c4b1fe3e2e3a41cf49a67fd8ea6b",
          "bytes": 972,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "d08f141973fea9a331091061f0b0192cf8041757694b2ef164bc1552bc1252a3",
          "bytes": 19124,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "d01cf462a8af44c8c2d1789c9fb8da6fac7bf7f530c2090316c3bb674a463aaa",
          "bytes": 76274,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        }
      ]
    },
    "observations": {
      "chunks": {
        "nodes": [
          {
            "script_key": "scr_05349dce19a40b2cb2e56d446047ea4ef0ed74250c4c7e2bc72d498575bd335b",
            "url": "https://linear.app/",
            "artifact_sha256": "5abbd53652af82f4df4d18886e18d56d6b533caaee69b333f9a1563f9fa40393",
            "bytes": 38
          },
          {
            "script_key": "scr_0890eeddafea54601bf440042efe0282de2350730c2ce3e67efb14eddf6c4a86",
            "url": "https://linear.app/",
            "artifact_sha256": "045d5be93e7e20021308bb2190ead196a58fcccfce7611aac2838c526912664e",
            "bytes": 131
          },
          {
            "script_key": "scr_3e5ae3e1dc1a3429011ef29209def1e7a5d06bfe718756bcca37726deaa79748",
            "url": "https://linear.app/",
            "artifact_sha256": "583efdab202fc79e8dcfc6c6c9e17b4ab48b49697274462efd43aa904ba2a127",
            "bytes": 216
          },
          {
            "script_key": "scr_4303c8e75015e33d294851d0109312b4e11afbcd1d0cadac44a5385292be1bd4",
            "url": "https://linear.app/",
            "artifact_sha256": "67cbb25131ff60a6dba7f88ebbde56406e25a485f1b90cd85b7771ee96c1d965",
            "bytes": 18959
          },
          {
            "script_key": "scr_47243e082d96b758e9408fa1ab9a61c0366ca7ce1b9a06f18a242b14da9867ee",
            "url": "https://linear.app/",
            "artifact_sha256": "d4200728955735a6c584f11b4ba426753d0158966d5a4a7dcfc66ce30d4f89fa",
            "bytes": 715
          },
          {
            "script_key": "scr_4a57fa86ccbbc39acd8e072dd6a6cad5f7e2e1e796a77ebc7ea018aa1fea8f7d",
            "url": "https://linear.app/",
            "artifact_sha256": "73a61f5e41bf4c2d7dfac9106ec07f817f68a61bb1900bf4fb08674319cbfc6b",
            "bytes": 68797
          },
          {
            "script_key": "scr_5afbf588025f2060b8c9581764efa672d89c9d0209fa581953f96f6999ff6823",
            "url": "https://linear.app/",
            "artifact_sha256": "278e2feed4dc402e43355892712be3b8f90ee0abd97695e6c23d2df62899d746",
            "bytes": 549
          },
          {
            "script_key": "scr_674aa0bfc4e4a422ef3b709f90ef58792cbb28a12dde0a86c22c78be43e31eec",
            "url": "https://linear.app/",
            "artifact_sha256": "f561ab64d7b25aabcfc1af27bd1098287471408e1293a9f9b7cafcfa472e167c",
            "bytes": 14961
          },
          {
            "script_key": "scr_87febeddc076e7ca30462ad51d34c28f6a54b367f081fb5e5659da82852d1225",
            "url": "https://linear.app/",
            "artifact_sha256": "34ae81730bffe6dc8e3d8afa077e8adcb76756f312e03ec34612b21b429c289b",
            "bytes": 99966
          },
          {
            "script_key": "scr_8a90e87c527fa8239b6072163352343bbde6dc3b1ddce2f8de036b8bd32610de",
            "url": "https://linear.app/",
            "artifact_sha256": "8f7c5fc69f4bcbad5a9823dbbf8a1820f866c4b1fe3e2e3a41cf49a67fd8ea6b",
            "bytes": 972
          },
          {
            "script_key": "scr_d13b4df1e70318d335acf3760c2babe57cc9d03fc65161bae6851f87209e1165",
            "url": "https://linear.app/",
            "artifact_sha256": "d08f141973fea9a331091061f0b0192cf8041757694b2ef164bc1552bc1252a3",
            "bytes": 19124
          },
          {
            "script_key": "scr_ef82efc816ba7d235ed11623fa577f49202cd2f79ef9caac2714157a88535a1a",
            "url": "https://linear.app/",
            "artifact_sha256": "d01cf462a8af44c8c2d1789c9fb8da6fac7bf7f530c2090316c3bb674a463aaa",
            "bytes": 76274
          }
        ],
        "edges": []
      },
      "routes": [],
      "endpoints": [],
      "webmcp_declarations": [],
      "source_maps": {
        "status": "unavailable",
        "requested": 0,
        "processed": 0,
        "items": []
      }
    },
    "inferences": [
      {
        "kind": "vendor_fingerprint",
        "value": "Next.js",
        "confidence": "high",
        "basis": [
          {
            "script_key": "scr_4303c8e75015e33d294851d0109312b4e11afbcd1d0cadac44a5385292be1bd4",
            "artifact_sha256": "67cbb25131ff60a6dba7f88ebbde56406e25a485f1b90cd85b7771ee96c1d965",
            "line": null,
            "column": null,
            "detector": "next-runtime"
          }
        ]
      },
      {
        "kind": "vendor_fingerprint",
        "value": "Next.js",
        "confidence": "high",
        "basis": [
          {
            "script_key": "scr_4a57fa86ccbbc39acd8e072dd6a6cad5f7e2e1e796a77ebc7ea018aa1fea8f7d",
            "artifact_sha256": "73a61f5e41bf4c2d7dfac9106ec07f817f68a61bb1900bf4fb08674319cbfc6b",
            "line": null,
            "column": null,
            "detector": "next-runtime"
          }
        ]
      },
      {
        "kind": "vendor_fingerprint",
        "value": "Next.js",
        "confidence": "high",
        "basis": [
          {
            "script_key": "scr_674aa0bfc4e4a422ef3b709f90ef58792cbb28a12dde0a86c22c78be43e31eec",
            "artifact_sha256": "f561ab64d7b25aabcfc1af27bd1098287471408e1293a9f9b7cafcfa472e167c",
            "line": null,
            "column": null,
            "detector": "next-runtime"
          }
        ]
      },
      {
        "kind": "vendor_fingerprint",
        "value": "Next.js",
        "confidence": "high",
        "basis": [
          {
            "script_key": "scr_d13b4df1e70318d335acf3760c2babe57cc9d03fc65161bae6851f87209e1165",
            "artifact_sha256": "d08f141973fea9a331091061f0b0192cf8041757694b2ef164bc1552bc1252a3",
            "line": null,
            "column": null,
            "detector": "next-runtime"
          }
        ]
      },
      {
        "kind": "vendor_fingerprint",
        "value": "Next.js",
        "confidence": "high",
        "basis": [
          {
            "script_key": "scr_ef82efc816ba7d235ed11623fa577f49202cd2f79ef9caac2714157a88535a1a",
            "artifact_sha256": "d01cf462a8af44c8c2d1789c9fb8da6fac7bf7f530c2090316c3bb674a463aaa",
            "line": null,
            "column": null,
            "detector": "next-runtime"
          }
        ]
      }
    ],
    "unknowns": [
      {
        "dimension": "source_maps",
        "reason": "One or more requested source maps were unavailable or incomplete",
        "affected_script_keys": []
      }
    ],
    "completeness": {
      "status": "partial",
      "parsed_scripts": 12,
      "parse_failures": 0,
      "visited_ast_nodes": 762
    },
    "limitations": [
      "Static bundle findings are observations or bounded inferences; REA does not execute captured JavaScript.",
      "Bare string arguments of unbound HTTP-method-named calls are low-confidence endpoint candidates; form, translation, storage and other APIs can use the same syntax. URL-shaped findings still do not prove network execution.",
      "Endpoint candidates are deduplicated by script, value and detector; basis retains only the first matching source coordinate. They are not a complete call-site inventory or a runtime occurrence count. completeness.status=\"complete\" describes examination of captured source, not a call-site census.",
      "String-built routes and endpoints, encrypted configuration, and server-side behavior may remain unknown.",
      "Page-declared WebMCP metadata is untrusted and is never registered or invoked as an REA tool."
    ]
  },
  "confidence": "observed",
  "authority": "external-service",
  "environment": null,
  "limitations": [
    "Artifact identity is unavailable for this observation.",
    "Static bundle findings are observations or bounded inferences; REA does not execute captured JavaScript.",
    "Bare string arguments of unbound HTTP-method-named calls are low-confidence endpoint candidates; form, translation, storage and other APIs can use the same syntax. URL-shaped findings still do not prove network execution.",
    "Endpoint candidates are deduplicated by script, value and detector; basis retains only the first matching source coordinate. They are not a complete call-site inventory or a runtime occurrence count. completeness.status=\"complete\" describes examination of captured source, not a call-site census.",
    "String-built routes and endpoints, encrypted configuration, and server-side behavior may remain unknown.",
    "Page-declared WebMCP metadata is untrusted and is never registered or invoked as an REA tool."
  ],
  "relationship_coverage": null,
  "locations": [],
  "evidence_links": []
}
```


## REA · WebMCP tools

```json
{
  "evidence_id": "ev_5efade4a1336357fce47025e0be13c07acb07b121f297c7220f9528d4f0c0faa",
  "subject": null,
  "provider": {
    "id": "rea-cdp-browser",
    "name": "REA Chrome DevTools Protocol observation provider",
    "version": "2"
  },
  "analysis_profile": null,
  "predicate_type": "rea.webmcp-discovery",
  "operation": "discover_webmcp_tools",
  "parameters": {
    "cdp_endpoint": "http://127.0.0.1:9222",
    "allowed_origins": [
      "https://linear.app"
    ],
    "target_id": "E4BB91F859710881411F162B331B49D9",
    "observation_ms": 100
  },
  "raw_result": null,
  "normalized_result": {
    "browser": {
      "product": "Chrome/155.0.8059.39",
      "protocol_version": "1.3",
      "revision": "537.36 (@3ff7ac5a9224be9156d7f8703a06e22890aafd34)",
      "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36",
      "js_version": "15.5.35.20"
    },
    "target": {
      "target_id": "E4BB91F859710881411F162B331B49D9",
      "url": "https://linear.app/",
      "origin": "https://linear.app"
    },
    "status": "available",
    "tools": {
      "total": 0,
      "items": []
    },
    "completeness": {
      "status": "complete_within_window",
      "conditions": [
        "complete_within_window"
      ],
      "policy_filtered_sections": [],
      "attach_limited_sections": [],
      "truncated_sections": [],
      "unavailable_sections": [],
      "excluded": [],
      "dropped_events": {
        "scripts": 0,
        "network_requests": 0,
        "console_events": 0,
        "websocket_connections": 0,
        "websocket_frames": 0,
        "webmcp_tools": 0,
        "timeline_events": 0,
        "total": 0
      }
    },
    "limitations": [
      "Page-declared tool metadata is untrusted and is never registered or invoked by REA.",
      "Discovery uses only WebMCP.enable and toolsAdded/toolsRemoved; WebMCP.invokeTool is never called."
    ]
  },
  "confidence": "observed",
  "authority": "external-service",
  "environment": {
    "id": "Chrome/155.0.8059.39@537.36 (@3ff7ac5a9224be9156d7f8703a06e22890aafd34)",
    "platform": "unknown",
    "architecture": "unknown",
    "isolation": "none"
  },
  "limitations": [
    "Artifact identity is unavailable for this observation.",
    "Page-declared tool metadata is untrusted and is never registered or invoked by REA.",
    "Discovery uses only WebMCP.enable and toolsAdded/toolsRemoved; WebMCP.invokeTool is never called.",
    "Browser host platform and architecture were not observed."
  ],
  "relationship_coverage": null,
  "locations": [],
  "evidence_links": []
}
```


---
_Finished 2026-10-16T03:49:24.158Z · 0 problem(s) · REA by morluto (MIT) · for lawful research only_
