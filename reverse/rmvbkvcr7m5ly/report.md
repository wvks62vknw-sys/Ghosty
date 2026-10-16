# Reverse engineering report

**Target:** https://linear.app/  
**Kind:** web  
**Started:** 2026-10-16T23:07:46.691Z


## Site overview (Ghosty baseline)

- **Title:** Linear – The system for product development
- **Final URL:** https://linear.app/ (HTTP 200, 1230 KB)
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
- https://static.linear.app/web/_next/static/chunks/DIgW3Tq8.js
- https://static.linear.app/web/_next/static/chunks/index-BegFITfV.js


## REA · browser targets

```json
{
  "evidence_id": "ev_53aac622fc3b15b7b29aa6a7ccf6d0f9e75a0a27ffa70daefedf438b8f5b8fe4",
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
        "target_id": "00088CB3B082E8CFB2C1D8B6B04A4108",
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
  "evidence_id": "ev_52aa966bffeff3098d4c114c0016e59530d76628c41a39d405282cd3de51dd21",
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
    "target_id": "00088CB3B082E8CFB2C1D8B6B04A4108",
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
      "target_id": "00088CB3B082E8CFB2C1D8B6B04A4108",
      "type": "page",
      "title": "Linear – The system for product development",
      "url": "https://linear.app/",
      "origin": "https://linear.app",
      "attached": null
    },
    "capture_window": {
      "started_at": "2026-10-16T23:08:04.971Z",
      "ended_at": "2026-10-16T23:08:09.653Z",
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
        "network_requests",
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
          "section": "network_requests",
          "reason": "disallowed_origin",
          "count": 6
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
          "count": 15
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
        "frame_id": "00088CB3B082E8CFB2C1D8B6B04A4108",
        "parent_frame_id": null,
        "url": "https://linear.app/",
        "origin": "https://linear.app"
      }
    ],
    "dom": {
      "total_nodes": 5940,
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
          "parent_index
… (truncated)
```


## REA · web bundle

```json
{
  "evidence_id": "ev_db448b35ce74c9fdc957d3712bf5352b2fe68c23a3298fba10443ea0f4aa6ccd",
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
    "target_id": "00088CB3B082E8CFB2C1D8B6B04A4108",
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
      "scripts_observed": 15,
      "scripts_analyzed": 15,
      "source_artifacts": [
        {
          "sha256": "5abbd53652af82f4df4d18886e18d56d6b533caaee69b333f9a1563f9fa40393",
          "bytes": 38,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "863269e706bd1581ba375db8b8355c057483b269598f40324397ab0625428e13",
          "bytes": 15591,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "8cef28dd95d7bd0d83078af4f4827b1cb1e2413480cb7d166b352dbd7a5e1073",
          "bytes": 68797,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "13bfc5477e0d7a96815f7cf3f7cee5c56a000cc2c390f0e4ad175610bcc4d516",
          "bytes": 18959,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "e55745691641571365bf50021dc42ebdd3558ac1a81a94472daac7804510ab62",
          "bytes": 76274,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "e2b6ba6e71b4471b6aee106fdd2881e5732d86bea9b55b93d94acfcf4f52837f",
          "bytes": 99966,
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
          "sha256": "8f7c5fc69f4bcbad5a9823dbbf8a1820f866c4b1fe3e2e3a41cf49a67fd8ea6b",
          "bytes": 972,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "4009527b06902e2fcd3c2ce78c0652caf43bda1783d1577198d0c3919782c607",
          "bytes": 845,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "ee6bb81f4e9fc030a39a7c71affc4d1f2b900baa4b4c7af83361388d7c39599b",
          "bytes": 57,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "99f193ac6a0bf4a5f81ee97309fe392ae3ed9e90a675e42fc79a784b27b2a0a0",
          "bytes": 362,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "2d6dbaa0951c1bda59a5552290b29a8a3ebde95fc7973ff5c5cb09ccdbd3ca2f",
          "bytes": 298,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "1e38eca00c44afbb69a4b873843cd156f91acaf84e0bd14d6cccae73cbf64aa0",
          "bytes": 19124,
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
            "script_key": "scr_0e0d551239e83312e626cf6f78e211e27bb02129e794b1f4ef4bb7dda1c3db38",
            "url": "https://linear.app/",
            "artifact_sha256": "863269e706bd1581ba375db8b8355c057483b269598f40324397ab0625428e13",
            "bytes": 15591
          },
          {
            "script_key": "scr_1c585ea2fc7ba7770ae436cb3691fb9681102c42f1c50877555da9598758991c",
            "url": "https://linear.app/",
            "artifact_sha256": "8cef28dd95d7bd0d83078af4f4827b1cb1e2413480cb7d166b352dbd7a5e1073",
            "bytes": 68797
          },
          {
            "script_key": "scr_1c94cbcd9a8a4445b41d512684b46d2df4e0e93c5cebb2bc0e1d924f5b185372",
            "url": "https://linear.app/",
            "artifact_sha256": "13bfc5477e0d7a96815f7cf3f7cee5c56a000cc2c390f0e4ad175610bcc4d516",
            "bytes": 18959
          },
          {
            "script_key": "scr_2ac773f7f87afb2a626a0a247012b6705f4c808f23b9158db870bdade7de7eed",
            "url": "https://linear.app/",
            "artifact_sha256": "e55745691641571365bf50021dc42ebdd3558ac1a81a94472daac7804510ab62",
            "bytes": 76274
          },
          {
            "script_key": "scr_3b3ede97668603c893e83ca875dd8626b2eaaa175c938fd793d220853fc417f4",
            "url": "https://linear.app/",
            "artifact_sha256": "e2b6ba6e71b4471b6aee106fdd2881e5732d86bea9b55b93d94acfcf4f52837f",
            "bytes": 99966
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
            "script_key": "scr_8a90e87c527fa8239b6072163352343bbde6dc3b1ddce2f8de036b8bd32610de",
            "url": "https://linear.app/",
            "artifact_sha256": "8f7c5fc69f4bcbad5a9823dbbf8a1820f866c4b1fe3e2e3a41cf49a67fd8ea6b",
            "bytes": 972
          },
          {
            "script_key": "scr_8b12902ca3597d16f94611ea2a25e48672e58a3c4ef2373c4535ac4351d77350",
            "url": "https://linear.app/",
            "artifact_sha256": "4009527b06902e2fcd3c2ce78c0652caf43bda1783d1577198d0c3919782c607",
            "bytes": 845
          },
          {
            "script_key": "scr_91be1ce13f28e77df5a9b8f71afbf2784f67a7d8caf0b28572a824dd1fd18005",
            "url": "https://linear.app/",
            "artifact_sha256": "ee6bb81f4e9fc030a39a7c71affc4d1f2b900baa4b4c7af83361388d7c39599b",
            "bytes": 57
          },
          {
            "script_key": "scr_a0ff7085f0c30261365473e22fa704aebebfb1656bc675b05fba7a4ff7bebe85",
            "url": "https://linear.app/",
            "artifact_sha256": "99f193ac6a0bf4a5f81ee97309fe392ae3ed9e90a675e42fc79a784b27b2a0a0",
            "bytes": 362
          },
          {
            "script_key": "scr_ea8cce44303944b944246070a622d1e40dc1a737934bc3a1b9ab692090a07c7c",
            "url": "https://linear.app/",
            "artifact_sha256": "2d6dbaa0951c1bda59a5552290b29a8a3ebde95fc7973ff5c5cb09ccdbd3ca2f",
            "bytes": 298
          },
          {
            "script_key": "scr_f1a6f559ee2131b797c2b97097a2c6139a56946f86acf46a74fb12d932e0295a",
            "url": "https://linear.app/",
            "artifact_sha256": "1e38eca00c44afbb69a4b873843cd156f91acaf84e0bd14d6cccae73cbf64aa0",
            "bytes": 19124
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
            "script_key": "scr_0e0d551239e83312e626cf6f78e211e27bb02129e794b1f4ef4bb7dda1c3db38",
            "artifact_sha256": "863269e706bd1581ba375db8b8355c057483b269598f40324397ab0625428e13",
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
            "script_key": "scr_1c585ea2fc7ba7770ae436cb3691fb9681102c42f1c50877555da9598758991c",
            "artifact_sha256": "8cef28dd95d7bd0d83078af4f4827b1cb1e2413480cb7d166b352dbd7a5e1073",
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
            "script_key": "scr_1c94cbcd9a8a4445b41d512684b46d2df4e0e93c5cebb2bc0e1d924f5b185372",
            "artifact_sha256": "13bfc5477e0d7a96815f7cf3f7cee5c56a000cc2c390f0e4ad175610bcc4d516",
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
            "script_key": "scr_2ac773f7f87afb2a626a0a247012b6705f4c808f23b9158db870bdade7de7eed",
            "artifact_sha256": "e55745691641571365bf50021dc42ebdd3558ac1a81a94472daac7804510ab62",
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
            "script_key": "scr_f1a6f559ee2131b797c2b97097a2c6139a56946f86acf46a74fb12d932e0295a",
            "artifact_sha256": "1e38eca00c44afbb69a4b873843cd156f91acaf84e0bd14d6cccae73cbf64aa0",
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
      "parsed_scripts": 15,
      "parse_failures": 0,
      "visited_ast_nodes": 1189
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
  "evidence_id": "ev_0ab64c1c14766d0f56732f27fd0abccaf7922dc79a2cc8aebc37306bc6cddff4",
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
    "target_id": "00088CB3B082E8CFB2C1D8B6B04A4108",
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
      "target_id": "00088CB3B082E8CFB2C1D8B6B04A4108",
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
_Finished 2026-10-16T23:08:16.648Z · 0 problem(s) · REA by morluto (MIT) · for lawful research only_
