# Reverse engineering report

**Target:** https://linear.app/  
**Kind:** web  
**Started:** 2026-10-25T12:43:56.731Z


## Site overview (Ghosty baseline)

- **Title:** Linear – The system for product development
- **Final URL:** https://linear.app/ (HTTP 200, 1235 KB)
- **Server:** cloudflare  ·  **Powered by:** ?
- **Technologies spotted:** Next.js, Cloudflare, Vite, React
- **Scripts:** 3 (3 first-party scripts scanned)
- **Stylesheets:** 40  ·  **Forms:** 0
- **Third-party hosts:** static.linear.app, rolldown.rs, vinext.local, react.dev, nextjs.org, www.w3.org

**API endpoints found in code (32):**
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
- `/api/support-docs`
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
- https://static.linear.app/web/_next/static/chunks/BwOZYkAI.js
- https://static.linear.app/web/_next/static/chunks/index-jT703Tec.js


## REA · browser targets

```json
{
  "evidence_id": "ev_ce55053acf6df7d7365902ea41a5fe5dd4ea83a554f27bc21328cbdfa00f0b5e",
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
        "target_id": "98C8AF9DC5AD184D54BF18B68CDF3664",
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
  "evidence_id": "ev_c42d688636d8a141c416644ee410fb79137e5280b3fe0b456f97cce2649ebf46",
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
    "target_id": "98C8AF9DC5AD184D54BF18B68CDF3664",
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
      "target_id": "98C8AF9DC5AD184D54BF18B68CDF3664",
      "type": "page",
      "title": "Linear – The system for product development",
      "url": "https://linear.app/",
      "origin": "https://linear.app",
      "attached": null
    },
    "capture_window": {
      "started_at": "2026-10-25T12:44:12.647Z",
      "ended_at": "2026-10-25T12:44:17.182Z",
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
        "websocket_shapes"
      ],
      "attach_limited_sections": [
        "console_events",
        "metadata",
        "network_requests",
        "websocket_connections",
        "websocket_frames",
        "workers"
      ],
      "truncated_sections": [],
      "unavailable_sections": [
        "workers"
      ],
      "excluded": [
        {
          "section": "accessibility",
          "reason": "not_approved",
          "count": 2162
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
          "reason": "unattributed_target",
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
        "frame_id": "98C8AF9DC5AD184D54BF18B68CDF3664",
        "parent_frame_id": null,
        "url": "https://linear.app/",
        "origin": "https://linear.app"
      }
    ],
    "dom": {
      "total_nodes": 5930,
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "data-precedence",
            "crossorigin"
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
            "crossorigin",
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
            "crossorigin",
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
            "crossorigin",
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
            "crossorigin",
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
            "crossorigin",
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
            "crossorigin",
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
            "crossorigin",
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
            "crossorigin",
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
            "crossorigin",
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
            "crossorigin",
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
            "crossorigin",
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
            "crossorigin",
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
            "crossorigin",
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
       
… (truncated)
```


## REA · web bundle

```json
{
  "evidence_id": "ev_b85171d03c05c2b71a1a9dbf6626f33113cfa6ef9c76f5ad09e44c133c80cc53",
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
    "allowed_origins": [
      "https://linear.app"
    ],
    "target_id": "98C8AF9DC5AD184D54BF18B68CDF3664",
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
    "route_inventory": {
      "inventory_id": "jsri:6d2ab242399715041f45c094fb2db69e86c3e00f11c9d9421f7f81c54a2972e1",
      "source_manifest_sha256": "bca3e61241adef39f44ec1d25c25610e0e1216de0ebad8ca11780c045f703789",
      "sources": [
        {
          "id": "jss:f0a7de9780a6cf7553cc2227749691c2",
          "key": "scr_05349dce19a40b2cb2e56d446047ea4ef0ed74250c4c7e2bc72d498575bd335b",
          "path": null,
          "url": "https://linear.app/",
          "sha256": "5abbd53652af82f4df4d18886e18d56d6b533caaee69b333f9a1563f9fa40393",
          "container_sha256": null,
          "status": "complete",
          "reported_route_capacity": null,
          "reason": null,
          "base_path": null
        },
        {
          "id": "jss:71557580f44ad99f2cb4180e0609ec76",
          "key": "scr_0890eeddafea54601bf440042efe0282de2350730c2ce3e67efb14eddf6c4a86",
          "path": null,
          "url": "https://linear.app/",
          "sha256": "045d5be93e7e20021308bb2190ead196a58fcccfce7611aac2838c526912664e",
          "container_sha256": null,
          "status": "complete",
          "reported_route_capacity": null,
          "reason": null,
          "base_path": null
        },
        {
          "id": "jss:b55d61139cd8ac45a2da459ef9f2a176",
          "key": "scr_2077c69fa4446b7b34a9e8d97d0ec0091684f3850f9267e1d262ed504016d27f",
          "path": null,
          "url": "https://linear.app/",
          "sha256": "0fef1612d21f558ead68133f6de908941e7fc431bbb9d904e5c4c0c2aad30c86",
          "container_sha256": null,
          "status": "complete",
          "reported_route_capacity": null,
          "reason": null,
          "base_path": null
        },
        {
          "id": "jss:5813ecff118c8be7edf059894e071c49",
          "key": "scr_23bcddb121915450fbbc8782f461eb3ad4ae2ff7d37ec2a6ee7077e0fd420992",
          "path": null,
          "url": "https://linear.app/",
          "sha256": "a51e5e0a718aae21e1d96335c86f8fe6c63dcad84c56a4c3ef06f252b20c9b58",
          "container_sha256": null,
          "status": "complete",
          "reported_route_capacity": null,
          "reason": null,
          "base_path": null
        },
        {
          "id": "jss:653225bb7254bccdc008f2eff270dea6",
          "key": "scr_2be425aa38e2eff3f9ba18b02e5e460c2f00e1cc5172451321acd886b5ec776b",
          "path": null,
          "url": "https://linear.app/",
          "sha256": "2e0595547c74889c84cd819f0eb8d56d52abff3cd2ae35962c4247ac85164c73",
          "container_sha256": null,
          "status": "complete",
          "reported_route_capacity": null,
          "reason": null,
          "base_path": null
        },
        {
          "id": "jss:6d53a384c560b290199bd457afeeb816",
          "key": "scr_3e5ae3e1dc1a3429011ef29209def1e7a5d06bfe718756bcca37726deaa79748",
          "path": null,
          "url": "https://linear.app/",
          "sha256": "583efdab202fc79e8dcfc6c6c9e17b4ab48b49697274462efd43aa904ba2a127",
          "container_sha256": null,
          "status": "complete",
          "reported_route_capacity": null,
          "reason": null,
          "base_path": null
        },
        {
          "id": "jss:2b39cf35f3bfbc9deb101ea0f49b2692",
          "key": "scr_47243e082d96b758e9408fa1ab9a61c0366ca7ce1b9a06f18a242b14da9867ee",
          "path": null,
          "url": "https://linear.app/",
          "sha256": "d4200728955735a6c584f11b4ba426753d0158966d5a4a7dcfc66ce30d4f89fa",
          "container_sha256": null,
          "status": "complete",
          "reported_route_capacity": null,
          "reason": null,
          "base_path": null
        },
        {
          "id": "jss:c9d6ba05e9168ec034a7bb680c45dd8f",
          "key": "scr_5afbf588025f2060b8c9581764efa672d89c9d0209fa581953f96f6999ff6823",
          "path": null,
          "url": "https://linear.app/",
          "sha256": "278e2feed4dc402e43355892712be3b8f90ee0abd97695e6c23d2df62899d746",
          "container_sha256": null,
          "status": "complete",
          "reported_route_capacity": null,
          "reason": null,
          "base_path": null
        },
        {
          "id": "jss:e386acf1842e0e7f716006b6290b13f3",
          "key": "scr_5ba0d3d7f2da96ca050f69db52b7ea2d5a95cf229350257b1ff3dd333f9d3f73",
          "path": null,
          "url": "https://linear.app/",
          "sha256": "9dad3461fe2dec39ca9eb8e9a58b12e2627dbaf67529e529c05a0192b6a34823",
          "container_sha256": null,
          "status": "complete",
          "reported_route_capacity": null,
          "reason": null,
          "base_path": null
        },
        {
          "id": "jss:c775edcb6775293305d05a71aa988669",
          "key": "scr_8a90e87c527fa8239b6072163352343bbde6dc3b1ddce2f8de036b8bd32610de",
          "path": null,
          "url": "https://linear.app/",
          "sha256": "8f7c5fc69f4bcbad5a9823dbbf8a1820f866c4b1fe3e2e3a41cf49a67fd8ea6b",
          "container_sha256": null,
          "status": "complete",
          "reported_route_capacity": null,
          "reason": null,
          "base_path": null
        },
        {
          "id": "jss:de576d1992efaaa08585658ace1dd54a",
          "key": "scr_92ee4d6185bce388ebbad5be0a03da2a0fb7ec9a59b3f674ccede9154536c48e",
          "path": null,
          "url": "https://linear.app/",
          "sha256": "27e5e59c611a1130fbe2ce8a6af0e961d084842bc5a6ed578f33c8a6fa95f4f4",
          "container_sha256": null,
          "status": "complete",
          "reported_route_capacity": null,
          "reason": null,
          "base_path": null
        },
        {
          "id": "jss:f4d79623ef4a5abe369ebbd5159e9cd3",
          "key": "scr_ca70dffb6ce7af6a83bf70d56fc98b0b7669a1199b87abec472e37f742726309",
          "path": null,
          "url": "https://linear.app/",
          "sha256": "4e294d970793a829294b86a86a63b61771eda3beaa562f4e4fa33f89553b7473",
          "container_sha256": null,
          "status": "complete",
          "reported_route_capacity": null,
          "reason": null,
          "base_path": null
        }
      ],
      "routes": [],
      "occurrences": [],
      "unknowns": [],
      "coverage": {
        "scope": "provided-code-sources",
        "source_parsing": "complete",
        "candidate_enumeration": "complete",
        "application_routes": "unknown"
      },
      "statistics": {
        "sources_seen": 12,
        "sources_retained": 12,
        "route_patterns": 0,
        "occurrences": 0,
        "unanchored_literals_excluded": 0
      },
      "capacity": null,
      "limitations": [
        "Routes are static candidates from the provided code sources. Reachability, permissions, server-only routes and the complete application route set are unverified.",
        "Pattern IDs are exact path identities within this inventory. Occurrence and source IDs retain source/content identity and precise syntax ranges; metadata-only discoveries have no AST range.",
        "System classification is a path-name heuristic. Asset URL prefixes can differ from routing bases; inferred prefixes retain the original unprefixed path.",
        "Unbound path strings require a top-level segment supported by structural routes or navigation candidates. Unknown or missing source facts do not establish route absence."
      ]
    },
    "capture": {
      "target_url": "https://linear.app/",
      "target_origin": "https://linear.app",
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
          "sha256": "0fef1612d21f558ead68133f6de908941e7fc431bbb9d904e5c4c0c2aad30c86",
          "bytes": 76623,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "a51e5e0a718aae21e1d96335c86f8fe6c63dcad84c56a4c3ef06f252b20c9b58",
          "bytes": 99966,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "2e0595547c74889c84cd819f0eb8d56d52abff3cd2ae35962c4247ac85164c73",
          "bytes": 71215,
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
          "sha256": "d4200728955735a6c584f11b4ba426753d0158966d5a4a7dcfc66ce30d4f89fa",
          "bytes": 715,
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
          "sha256": "9dad3461fe2dec39ca9eb8e9a58b12e2627dbaf67529e529c05a0192b6a34823",
          "bytes": 19677,
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
          "sha256": "27e5e59c611a1130fbe2ce8a6af0e961d084842bc5a6ed578f33c8a6fa95f4f4",
          "bytes": 15876,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "4e294d970793a829294b86a86a63b61771eda3beaa562f4e4fa33f89553b7473",
          "bytes": 21545,
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
            "script_key": "scr_2077c69fa4446b7b34a9e8d97d0ec0091684f3850f9267e1d262ed504016d27f",
            "url": "https://linear.app/",
            "artifact_sha256": "0fef1612d21f558ead68133f6de908941e7fc431bbb9d904e5c4c0c2aad30c86",
            "bytes": 76623
          },
          {
            "script_key": "scr_23bcddb121915450fbbc8782f461eb3ad4ae2ff7d37ec2a6ee7077e0fd420992",
            "url": "https://linear.app/",
            "artifact_sha256": "a51e5e0a718aae21e1d96335c86f8fe6c63dcad84c56a4c3ef06f252b20c9b58",
            "bytes": 99966
          },
          {
            "script_key": "scr_2be425aa38e2eff3f9ba18b02e5e460c2f00e1cc5172451321acd886b5ec776b",
            "url": "https://linear.app/",
            "artifact_sha256": "2e0595547c74889c84cd819f0eb8d56d52abff3cd2ae35962c4247ac85164c73",
            "bytes": 71215
          },
          {
            "script_key": "scr_3e5ae3e1dc1a3429011ef29209def1e7a5d06bfe718756bcca37726deaa79748",
            "url": "https://linear.app/",
            "artifact_sha256": "583efdab202fc79e8dcfc6c6c9e17b4ab48b49697274462efd43aa904ba2a127",
            "bytes": 216
          },
          {
            "script_key": "scr_47243e082d96b758e9408fa1ab9a61c0366ca7ce1b9a06f18a242b14da9867ee",
            "url": "https://linear.app/",
            "artifact_sha256": "d4200728955735a6c584f11b4ba426753d0158966d5a4a7dcfc66ce30d4f89fa",
            "bytes": 715
          },
          {
            "script_key": "scr_5afbf588025f2060b8c9581764efa672d89c9d0209fa581953f96f6999ff6823",
            "url": "https://linear.app/",
            "artifact_sha256": "278e2feed4dc402e43355892712be3b8f90ee0abd97695e6c23d2df62899d746",
            "bytes": 549
          },
          {
            "script_key": "scr_5ba0d3d7f2da96ca050f69db52b7ea2d5a95cf229350257b1ff3dd333f9d3f73",
            "url": "https://linear.app/",
            "artifact_sha256": "9dad3461fe2dec39ca9eb8e9a58b12e2627dbaf67529e529c05a0192b6a34823",
            "bytes": 19677
          },
          {
            "script_key": "scr_8a90e87c527fa8239b6072163352343bbde6dc3b1ddce2f8de036b8bd32610de",
            "url": "https://linear.app/",
            "artifact_sha256": "8f7c5fc69f4bcbad5a9823dbbf8a1820f866c4b1fe3e2e3a41cf49a67fd8ea6b",
            "bytes": 972
          },
          {
            "script_key": "scr_92ee4d6185bce388ebbad5be0a03da2a0fb7ec9a59b3f674ccede9154536c48e",
            "url": "https://linear.app/",
            "artifact_sha256": "27e5e59c611a1130fbe2ce8a6af0e961d084842bc5a6ed578f33c8a6fa95f4f4",
            "bytes": 15876
          },
          {
            "script_key": "scr_ca70dffb6ce7af6a83bf70d56fc98b0b7669a1199b87abec472e37f742726309",
            "url": "https://linear.app/",
            "artifact_sha256": "4e294d970793a829294b86a86a63b61771eda3beaa562f4e4fa33f89553b7473",
            "bytes": 21545
          }
        ],
        "edges": []
      },
      "routes": [],
      "endpoints": [],
      "webmcp_declarations": [],
      "source_maps": {
        "status": "not_requested",
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
            "script_key": "scr_2077c69fa4446b7b34a9e8d97d0ec0091684f3850f9267e1d262ed504016d27f",
            "artifact_sha256": "0fef1612d21f558ead68133f6de908941e7fc431bbb9d904e5c4c0c2aad30c86",
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
            "script_key": "scr_2be425aa38e2eff3f9ba18b02e5e460c2f00e1cc5172451321acd886b5ec776b",
            "artifact_sha256": "2e0595547c74889c84cd819f0eb8d56d52abff3cd2ae35962c4247ac85164c73",
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
            "script_key": "scr_5ba0d3d7f2da96ca050f69db52b7ea2d5a95cf229350257b1ff3dd333f9d3f73",
            "artifact_sha256": "9dad3461fe2dec39ca9eb8e9a58b12e2627dbaf67529e529c05a0192b6a34823",
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
            "script_key": "scr_92ee4d6185bce388ebbad5be0a03da2a0fb7ec9a59b3f674ccede9154536c48e",
            "artifact_sha256": "27e5e59c611a1130fbe2ce8a6af0e961d084842bc5a6ed578f33c8a6fa95f4f4",
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
            "script_key": "scr_ca70dffb6ce7af6a83bf70d56fc98b0b7669a1199b87abec472e37f742726309",
            "artifact_sha256": "4e294d970793a829294b86a86a63b61771eda3beaa562f4e4fa33f89553b7473",
            "line": null,
            "column": null,
            "detector": "next-runtime"
          }
        ]
      }
    ],
    "unknowns": [],
    "completeness": {
      "status": "complete",
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
  "evidence_id": "ev_f03a9cc476f97ffb0253c00f095182aed267219455711477a11bbcceb3df0a04",
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
    "target_id": "98C8AF9DC5AD184D54BF18B68CDF3664",
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
      "target_id": "98C8AF9DC5AD184D54BF18B68CDF3664",
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
_Finished 2026-10-25T12:44:24.388Z · 0 problem(s) · REA by morluto (MIT) · for lawful research only_
