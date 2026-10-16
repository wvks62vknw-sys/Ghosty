# Reverse engineering report

**Target:** https://www.wikipedia.org  
**Kind:** web  
**Started:** 2026-10-16T00:13:23.982Z


## Site overview (Ghosty baseline)

- **Title:** Wikipedia
- **Final URL:** https://www.wikipedia.org/ (HTTP 200, 119 KB)
- **Server:** ATS/9.2.15  ·  **Powered by:** ?
- **Technologies spotted:** none recognised
- **Scripts:** 2 (2 first-party scripts scanned)
- **Stylesheets:** 0  ·  **Forms:** 1
- **Third-party hosts:** intake-analytics.wikimedia.org, donate.wikimedia.org

**API endpoints found in code (0):**
- none found

**Security headers:**
- content-security-policy: ✗ missing
- strict-transport-security: ✓ max-age=106384710; includeSubDomains; preload
- x-frame-options: ✗ missing
- x-content-type-options: ✗ missing
- referrer-policy: ✗ missing
- permissions-policy: ✗ missing

**Script files:**
- https://www.wikipedia.org/portal/wikipedia.org/assets/js/index-43aa8c7b47.js
- https://www.wikipedia.org/portal/wikipedia.org/assets/js/gt-ie9-507b16b6be.js


## REA · browser targets

```json
{
  "evidence_id": "ev_d395522aee81f9bf1a2fe5157740b970d7d7f3e019954fed1fb0daab9c677fee",
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
        "target_id": "A68387E67005350EB4D473A07B5B8B43",
        "type": "page",
        "title": "Wikipedia",
        "url": "https://www.wikipedia.org/",
        "origin": "https://www.wikipedia.org",
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
  "evidence_id": "ev_94739dcb39d130665cab80e00d85bde97abe06837fa8aa65fd680309aa920f1e",
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
      "https://www.wikipedia.org"
    ],
    "target_id": "A68387E67005350EB4D473A07B5B8B43",
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
      "target_id": "A68387E67005350EB4D473A07B5B8B43",
      "type": "page",
      "title": "Wikipedia",
      "url": "https://www.wikipedia.org/",
      "origin": "https://www.wikipedia.org",
      "attached": null
    },
    "capture_window": {
      "started_at": "2026-10-16T00:13:44.068Z",
      "ended_at": "2026-10-16T00:13:48.699Z",
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
        "metadata",
        "script_sources",
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
          "count": 579
        },
        {
          "section": "metadata",
          "reason": "disallowed_origin",
          "count": 392
        },
        {
          "section": "script_sources",
          "reason": "not_approved",
          "count": 4
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
        "frame_id": "A68387E67005350EB4D473A07B5B8B43",
        "parent_frame_id": null,
        "url": "https://www.wikipedia.org/",
        "origin": "https://www.wikipedia.org"
      }
    ],
    "dom": {
      "total_nodes": 2776,
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
            "class"
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
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 5,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "META",
          "node_value_length": 0,
          "attribute_names": [
            "charset"
          ]
        },
        {
          "index": 6,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 7,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "TITLE",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 8,
          "parent_index": 7,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 9,
          "attribute_names": []
        },
        {
          "index": 9,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 10,
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
          "index": 11,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 12,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "SCRIPT",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 13,
          "parent_index": 12,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 123,
          "attribute_names": []
        },
        {
          "index": 14,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 15,
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
          "index": 16,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 17,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href"
          ]
        },
        {
          "index": 18,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 19,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href"
          ]
        },
        {
          "index": 20,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 21,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href"
          ]
        },
        {
          "index": 22,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 23,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "STYLE",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 24,
          "parent_index": 23,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1881,
          "attribute_names": []
        },
        {
          "index": 25,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 26,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "STYLE",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 27,
          "parent_index": 26,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 55936,
          "attribute_names": []
        },
        {
          "index": 28,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 29,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href"
          ]
        },
        {
          "index": 30,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 31,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href"
          ]
        },
        {
          "index": 32,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 33,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "META",
          "node_value_length": 0,
          "attribute_names": [
            "property",
            "content"
          ]
        },
        {
          "index": 34,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 35,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "META",
          "node_value_length": 0,
          "attribute_names": [
            "property",
            "content"
          ]
        },
        {
          "index": 36,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 37,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "META",
          "node_value_length": 0,
          "attribute_names": [
            "property",
            "content"
          ]
        },
        {
          "index": 38,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 39,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "META",
          "node_value_length": 0,
          "attribute_names": [
            "property",
            "content"
          ]
        },
        {
          "index": 40,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 41,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "META",
          "node_value_length": 0,
          "attribute_names": [
            "property",
            "content"
          ]
        },
        {
          "index": 42,
          "parent_index": 3,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 43,
          "parent_index": 3,
          "node_type": 1,
          "node_name": "LINK",
          "node_value_length": 0,
          "attribute_names": [
            "rel",
            "href"
          ]
        },
        {
          "index": 44,
          "parent_index": 2,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 45,
          "parent_index": 2,
          "node_type": 1,
          "node_name": "BODY",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "class",
            "style"
          ]
        },
        {
          "index": 46,
          "parent_index": 45,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 47,
          "parent_index": 45,
          "node_type": 1,
          "node_name": "MAIN",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 48,
          "parent_index": 47,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 49,
          "parent_index": 47,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class"
          ]
        },
        {
          "index": 50,
          "parent_index": 49,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 51,
          "parent_index": 49,
          "node_type": 1,
          "node_name": "IMG",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "src",
            "srcset",
            "width",
            "height",
            "alt"
          ]
        },
        {
          "index": 52,
          "parent_index": 49,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 53,
          "parent_index": 49,
          "node_type": 1,
          "node_name": "H1",
          "node_value_length": 0,
          "attribute_names": [
            "class"
          ]
        },
        {
          "index": 54,
          "parent_index": 53,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 55,
          "parent_index": 53,
          "node_type": 1,
          "node_name": "SPAN",
          "node_value_length": 0,
          "attribute_names": [
            "class"
          ]
        },
        {
          "index": 56,
          "parent_index": 55,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 11,
          "attribute_names": []
        },
        {
          "index": 57,
          "parent_index": 53,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 58,
          "parent_index": 53,
          "node_type": 1,
          "node_name": "STRONG",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "data-jsl10n"
          ]
        },
        {
          "index": 59,
          "parent_index": 58,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 21,
          "attribute_names": []
        },
        {
          "index": 60,
          "parent_index": 53,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 61,
          "parent_index": 49,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 62,
          "parent_index": 47,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 63,
          "parent_index": 47,
          "node_type": 1,
          "node_name": "NAV",
          "node_value_length": 0,
          "attribute_names": [
            "data-jsl10n",
            "aria-label",
            "class",
            "data-el-section"
          ]
        },
        {
          "index": 64,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 65,
          "parent_index": 63,
          "node_type": 8,
          "node_name": "#comment",
          "node_value_length": 48,
          "attribute_names": []
        },
        {
          "index": 66,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 67,
          "parent_index": 63,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "lang",
            "dir"
          ]
        },
        {
          "index": 68,
          "parent_index": 67,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 69,
          "parent_index": 67,
          "node_type": 1,
          "node_name": "A",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "href",
            "title",
            "class",
            "data-slogan"
          ]
        },
        {
          "index": 70,
          "parent_index": 69,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 71,
          "parent_index": 69,
          "node_type": 1,
          "node_name": "STRONG",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 72,
          "parent_index": 71,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 7,
          "attribute_names": []
        },
        {
          "index": 73,
          "parent_index": 69,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 74,
          "parent_index": 69,
          "node_type": 1,
          "node_name": "SMALL",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 75,
          "parent_index": 74,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 11,
          "attribute_names": []
        },
        {
          "index": 76,
          "parent_index": 74,
          "node_type": 1,
          "node_name": "SPAN",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 77,
          "parent_index": 76,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 8,
          "attribute_names": []
        },
        {
          "index": 78,
          "parent_index": 69,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 79,
          "parent_index": 67,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 80,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 81,
          "parent_index": 63,
          "node_type": 8,
          "node_name": "#comment",
          "node_value_length": 46,
          "attribute_names": []
        },
        {
          "index": 82,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 83,
          "parent_index": 63,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "lang",
            "dir"
          ]
        },
        {
          "index": 84,
          "parent_index": 83,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 85,
          "parent_index": 83,
          "node_type": 1,
          "node_name": "A",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "href",
            "title",
            "class",
            "data-slogan"
          ]
        },
        {
          "index": 86,
          "parent_index": 85,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 87,
          "parent_index": 85,
          "node_type": 1,
          "node_name": "STRONG",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 88,
          "parent_index": 87,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 3,
          "attribute_names": []
        },
        {
          "index": 89,
          "parent_index": 85,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 90,
          "parent_index": 85,
          "node_type": 1,
          "node_name": "SMALL",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 91,
          "parent_index": 90,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 11,
          "attribute_names": []
        },
        {
          "index": 92,
          "parent_index": 90,
          "node_type": 1,
          "node_name": "SPAN",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 93,
          "parent_index": 92,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 2,
          "attribute_names": []
        },
        {
          "index": 94,
          "parent_index": 85,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 95,
          "parent_index": 83,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 96,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 97,
          "parent_index": 63,
          "node_type": 8,
          "node_name": "#comment",
          "node_value_length": 46,
          "attribute_names": []
        },
        {
          "index": 98,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 99,
          "parent_index": 63,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "lang",
            "dir"
          ]
        },
        {
          "index": 100,
          "parent_index": 99,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 101,
          "parent_index": 99,
          "node_type": 1,
          "node_name": "A",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "href",
            "title",
            "class",
            "data-slogan"
          ]
        },
        {
          "index": 102,
          "parent_index": 101,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 103,
          "parent_index": 101,
          "node_type": 1,
          "node_name": "STRONG",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 104,
          "parent_index": 103,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 7,
          "attribute_names": []
        },
        {
          "index": 105,
          "parent_index": 101,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 106,
          "parent_index": 101,
          "node_type": 1,
          "node_name": "SMALL",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 107,
          "parent_index": 106,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 11,
          "attribute_names": []
        },
        {
          "index": 108,
          "parent_index": 106,
          "node_type": 1,
          "node_name": "SPAN",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 109,
          "parent_index": 108,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 7,
          "attribute_names": []
        },
        {
          "index": 110,
          "parent_index": 101,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 111,
          "parent_index": 99,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 112,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 113,
          "parent_index": 63,
          "node_type": 8,
          "node_name": "#comment",
          "node_value_length": 46,
          "attribute_names": []
        },
        {
          "index": 114,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 115,
          "parent_index": 63,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "lang",
            "dir"
          ]
        },
        {
          "index": 116,
          "parent_index": 115,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 117,
          "parent_index": 115,
          "node_type": 1,
          "node_name": "A",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "href",
            "title",
            "class",
            "data-slogan"
          ]
        },
        {
          "index": 118,
          "parent_index": 117,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 119,
          "parent_index": 117,
          "node_type": 1,
          "node_name": "STRONG",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 120,
          "parent_index": 119,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 8,
          "attribute_names": []
        },
        {
          "index": 121,
          "parent_index": 117,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 122,
          "parent_index": 117,
          "node_type": 1,
          "node_name": "SMALL",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 123,
          "parent_index": 122,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 11,
          "attribute_names": []
        },
        {
          "index": 124,
          "parent_index": 122,
          "node_type": 1,
          "node_name": "SPAN",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 125,
          "parent_index": 124,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 8,
          "attribute_names": []
        },
        {
          "index": 126,
          "parent_index": 117,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 127,
          "parent_index": 115,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 128,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 129,
          "parent_index": 63,
          "node_type": 8,
          "node_name": "#comment",
          "node_value_length": 46,
          "attribute_names": []
        },
        {
          "index": 130,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 131,
          "parent_index": 63,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "lang",
            "dir"
          ]
        },
        {
          "index": 132,
          "parent_index": 131,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 133,
          "parent_index": 131,
          "node_type": 1,
          "node_name": "A",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "href",
            "title",
            "class",
            "data-slogan"
          ]
        },
        {
          "index": 134,
          "parent_index": 133,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 135,
          "parent_index": 133,
          "node_type": 1,
          "node_name": "STRONG",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 136,
          "parent_index": 135,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 7,
          "attribute_names": []
        },
        {
          "index": 137,
          "parent_index": 133,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 138,
          "parent_index": 133,
          "node_type": 1,
          "node_name": "SMALL",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 139,
          "parent_index": 138,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 11,
          "attribute_names": []
        },
        {
          "index": 140,
          "parent_index": 138,
          "node_type": 1,
          "node_name": "SPAN",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 141,
          "parent_index": 140,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 6,
          "attribute_names": []
        },
        {
          "index": 142,
          "parent_index": 133,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 143,
          "parent_index": 131,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 144,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 145,
          "parent_index": 63,
          "node_type": 8,
          "node_name": "#comment",
          "node_value_length": 46,
          "attribute_names": []
        },
        {
          "index": 146,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 147,
          "parent_index": 63,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "lang",
            "dir"
          ]
        },
        {
          "index": 148,
          "parent_index": 147,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 149,
          "parent_index": 147,
          "node_type": 1,
          "node_name": "A",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "href",
            "title",
            "class",
            "data-slogan"
          ]
        },
        {
          "index": 150,
          "parent_index": 149,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 151,
          "parent_index": 149,
          "node_type": 1,
          "node_name": "STRONG",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 152,
          "parent_index": 151,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 7,
          "attribute_names": []
        },
        {
          "index": 153,
          "parent_index": 149,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 154,
          "parent_index": 149,
          "node_type": 1,
          "node_name": "SMALL",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 155,
          "parent_index": 154,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 11,
          "attribute_names": []
        },
        {
          "index": 156,
          "parent_index": 154,
          "node_type": 1,
          "node_name": "SPAN",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 157,
          "parent_index": 156,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 9,
          "attribute_names": []
        },
        {
          "index": 158,
          "parent_index": 149,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 159,
          "parent_index": 147,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 160,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 161,
          "parent_index": 63,
          "node_type": 8,
          "node_name": "#comment",
          "node_value_length": 45,
          "attribute_names": []
        },
        {
          "index": 162,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 163,
          "parent_index": 63,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "lang",
            "dir"
          ]
        },
        {
          "index": 164,
          "parent_index": 163,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 165,
          "parent_index": 163,
          "node_type": 1,
          "node_name": "A",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "href",
            "title",
            "class",
            "data-slogan"
          ]
        },
        {
          "index": 166,
          "parent_index": 165,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 167,
          "parent_index": 165,
          "node_type": 1,
          "node_name": "STRONG",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 168,
          "parent_index": 167,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 8,
          "attribute_names": []
        },
        {
          "index": 169,
          "parent_index": 165,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 170,
          "parent_index": 165,
          "node_type": 1,
          "node_name": "SMALL",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 171,
          "parent_index": 170,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 11,
          "attribute_names": []
        },
        {
          "index": 172,
          "parent_index": 170,
          "node_type": 1,
          "node_name": "SPAN",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 173,
          "parent_index": 172,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 4,
          "attribute_names": []
        },
        {
          "index": 174,
          "parent_index": 165,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 175,
          "parent_index": 163,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 176,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 177,
          "parent_index": 63,
          "node_type": 8,
          "node_name": "#comment",
          "node_value_length": 45,
          "attribute_names": []
        },
        {
          "index": 178,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 179,
          "parent_index": 63,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "lang",
            "dir"
          ]
        },
        {
          "index": 180,
          "parent_index": 179,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 181,
          "parent_index": 179,
          "node_type": 1,
          "node_name": "A",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "href",
            "title",
            "class",
            "data-slogan"
          ]
        },
        {
          "index": 182,
          "parent_index": 181,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 183,
          "parent_index": 181,
          "node_type": 1,
          "node_name": "STRONG",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 184,
          "parent_index": 183,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 2,
          "attribute_names": []
        },
        {
          "index": 185,
          "parent_index": 181,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 186,
          "parent_index": 181,
          "node_type": 1,
          "node_name": "SMALL",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 187,
          "parent_index": 186,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 11,
          "attribute_names": []
        },
        {
          "index": 188,
          "parent_index": 186,
          "node_type": 1,
          "node_name": "SPAN",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 189,
          "parent_index": 188,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 7,
          "attribute_names": []
        },
        {
          "index": 190,
          "parent_index": 181,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 191,
          "parent_index": 179,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 192,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 193,
          "parent_index": 63,
          "node_type": 8,
          "node_name": "#comment",
          "node_value_length": 45,
          "attribute_names": []
        },
        {
          "index": 194,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 195,
          "parent_index": 63,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "lang",
            "dir"
          ]
        },
        {
          "index": 196,
          "parent_index": 195,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 197,
          "parent_index": 195,
          "node_type": 1,
          "node_name": "A",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "href",
            "title",
            "class",
            "data-slogan"
          ]
        },
        {
          "index": 198,
          "parent_index": 197,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 199,
          "parent_index": 197,
          "node_type": 1,
          "node_name": "STRONG",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 200,
          "parent_index": 199,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 9,
          "attribute_names": []
        },
        {
          "index": 201,
          "parent_index": 197,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 202,
          "parent_index": 197,
          "node_type": 1,
          "node_name": "SMALL",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 203,
          "parent_index": 202,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 11,
          "attribute_names": []
        },
        {
          "index": 204,
          "parent_index": 202,
          "node_type": 1,
          "node_name": "SPAN",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 205,
          "parent_index": 204,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 7,
          "attribute_names": []
        },
        {
          "index": 206,
          "parent_index": 197,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 207,
          "parent_index": 195,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 208,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 209,
          "parent_index": 63,
          "node_type": 8,
          "node_name": "#comment",
          "node_value_length": 46,
          "attribute_names": []
        },
        {
          "index": 210,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 211,
          "parent_index": 63,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "lang",
            "dir"
          ]
        },
        {
          "index": 212,
          "parent_index": 211,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 213,
          "parent_index": 211,
          "node_type": 1,
          "node_name": "A",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "href",
            "title",
            "class",
            "data-slogan"
          ]
        },
        {
          "index": 214,
          "parent_index": 213,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 215,
          "parent_index": 213,
          "node_type": 1,
          "node_name": "STRONG",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 216,
          "parent_index": 215,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 6,
          "attribute_names": []
        },
        {
          "index": 217,
          "parent_index": 213,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 218,
          "parent_index": 213,
          "node_type": 1,
          "node_name": "SMALL",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 219,
          "parent_index": 218,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 11,
          "attribute_names": []
        },
        {
          "index": 220,
          "parent_index": 218,
          "node_type": 1,
          "node_name": "SPAN",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 221,
          "parent_index": 220,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 5,
          "attribute_names": []
        },
        {
          "index": 222,
          "parent_index": 213,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 223,
          "parent_index": 211,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 224,
          "parent_index": 63,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 225,
          "parent_index": 47,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 226,
          "parent_index": 47,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "role",
            "class"
          ]
        },
        {
          "index": 227,
          "parent_index": 226,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 228,
          "parent_index": 226,
          "node_type": 1,
          "node_name": "FORM",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "id",
            "action",
            "data-el-section"
          ]
        },
        {
          "index": 229,
          "parent_index": 228,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 230,
          "parent_index": 228,
          "node_type": 1,
          "node_name": "FIELDSET",
          "node_value_length": 0,
          "attribute_names": []
        },
        {
          "index": 231,
          "parent_index": 230,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 232,
          "parent_index": 230,
          "node_type": 1,
          "node_name": "INPUT",
          "node_value_length": 0,
          "attribute_names": [
            "type",
            "name",
            "value"
          ]
        },
        {
          "index": 233,
          "parent_index": 230,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 234,
          "parent_index": 230,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class",
            "id"
          ]
        },
        {
          "index": 235,
          "parent_index": 234,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 236,
          "parent_index": 234,
          "node_type": 1,
          "node_name": "LABEL",
          "node_value_length": 0,
          "attribute_names": [
            "for",
            "class",
            "data-jsl10n"
          ]
        },
        {
          "index": 237,
          "parent_index": 236,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 16,
          "attribute_names": []
        },
        {
          "index": 238,
          "parent_index": 234,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 239,
          "parent_index": 234,
          "node_type": 1,
          "node_name": "INPUT",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "name",
            "type",
            "size",
            "autofocus",
            "accesskey",
            "dir",
            "autocomplete",
            "style"
          ]
        },
        {
          "index": 240,
          "parent_index": 234,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 241,
          "parent_index": 234,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class"
          ]
        },
        {
          "index": 242,
          "parent_index": 241,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 243,
          "parent_index": 241,
          "node_type": 1,
          "node_name": "DIV",
          "node_value_length": 0,
          "attribute_names": [
            "class"
          ]
        },
        {
          "index": 244,
          "parent_index": 243,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 245,
          "parent_index": 243,
          "node_type": 1,
          "node_name": "LABEL",
          "node_value_length": 0,
          "attribute_names": [
            "for",
            "id",
            "class"
          ]
        },
        {
          "index": 246,
          "parent_index": 245,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 2,
          "attribute_names": []
        },
        {
          "index": 247,
          "parent_index": 243,
          "node_type": 1,
          "node_name": "SELECT",
          "node_value_length": 0,
          "attribute_names": [
            "id",
            "name"
          ]
        },
        {
          "index": 248,
          "parent_index": 247,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 249,
          "parent_index": 247,
          "node_type": 1,
          "node_name": "OPTION",
          "node_value_length": 0,
          "attribute_names": [
            "value",
            "lang"
          ]
        },
        {
          "index": 250,
          "parent_index": 249,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 9,
          "attribute_names": []
        },
        {
          "index": 251,
          "parent_index": 247,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 252,
          "parent_index": 247,
          "node_type": 1,
          "node_name": "OPTION",
          "node_value_length": 0,
          "attribute_names": [
            "value",
            "lang"
          ]
        },
        {
          "index": 253,
          "parent_index": 252,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 5,
          "attribute_names": []
        },
        {
          "index": 254,
          "parent_index": 247,
          "node_type": 8,
          "node_name": "#comment",
          "node_value_length": 10,
          "attribute_names": []
        },
        {
          "index": 255,
          "parent_index": 247,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 256,
          "parent_index": 247,
          "node_type": 1,
          "node_name": "OPTION",
          "node_value_length": 0,
          "attribute_names": [
            "value",
            "lang"
          ]
        },
        {
          "index": 257,
          "parent_index": 256,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 7,
          "attribute_names": []
        },
        {
          "index": 258,
          "parent_index": 247,
          "node_type": 8,
          "node_name": "#comment",
          "node_value_length": 14,
          "attribute_names": []
        },
        {
          "index": 259,
          "parent_index": 247,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 260,
          "parent_index": 247,
          "node_type": 1,
          "node_name": "OPTION",
          "node_value_length": 0,
          "attribute_names": [
            "value",
            "lang"
          ]
        },
        {
          "index": 261,
          "parent_index": 260,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 9,
          "attribute_names": []
        },
        {
          "index": 262,
          "parent_index": 247,
          "node_type": 3,
          "node_name": "#text",
          "node_value_length": 1,
          "attribute_names": []
        },
        {
          "index": 263,
          "parent_index": 247,
          "node_type": 1,
          "node_name": "OPTION",
          "node_value_length": 0,
          "attribute_names": [
            "value",
            "lang"
          ]
        },
        {
          "index": 264,
          "parent_index": 263,
          "node_ty
… (truncated)
```


## REA · web bundle

```json
{
  "evidence_id": "ev_d63086a862148c38fee8b374c4b10b63dcc0e11621f199afd149938632972c09",
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
    "target_id": "A68387E67005350EB4D473A07B5B8B43",
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
      "target_url": "https://www.wikipedia.org/",
      "scripts_observed": 4,
      "scripts_analyzed": 4,
      "source_artifacts": [
        {
          "sha256": "634b83b6677cffc48c22ccc185efdb79c6e9c5f84e8580de715716679c54b9f2",
          "bytes": 1552,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "c406c48ae80988a75fbfa2993f8b6faa18853e175cd602c8cbf474cf68c4dfc7",
          "bytes": 27732,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "79ea51d8ed1fbf81b0e57c80435a39eb41a9e7e6ef1cbfac2f656f37b04984b2",
          "bytes": 123,
          "media_type": "text/javascript",
          "charset": "utf-8",
          "text_available": true
        },
        {
          "sha256": "b6095c067391ecb2841c3bdb11534507ed219c958bba2a20720ae876b6f2cb31",
          "bytes": 580,
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
            "script_key": "scr_1549efd645d344a56d531f3125b4c509ededd6258cdb602613ecc0f7a7233130",
            "url": "https://www.wikipedia.org/",
            "artifact_sha256": "634b83b6677cffc48c22ccc185efdb79c6e9c5f84e8580de715716679c54b9f2",
            "bytes": 1552
          },
          {
            "script_key": "scr_20366b6d397338a57004badc5be6c40c554a6680db92dbf2176d1770f5ec5e33",
            "url": "https://www.wikipedia.org/portal/wikipedia.org/assets/js/index-43aa8c7b47.js",
            "artifact_sha256": "c406c48ae80988a75fbfa2993f8b6faa18853e175cd602c8cbf474cf68c4dfc7",
            "bytes": 27732
          },
          {
            "script_key": "scr_2b3c966fea84113556f0cf108f612157c5ec36167538ad13868fffa662f8a1d0",
            "url": "https://www.wikipedia.org/",
            "artifact_sha256": "79ea51d8ed1fbf81b0e57c80435a39eb41a9e7e6ef1cbfac2f656f37b04984b2",
            "bytes": 123
          },
          {
            "script_key": "scr_c35a5bc7fe0866d41c6aa2c177debc70471ec769548e5b9efa325515b63c6437",
            "url": "https://www.wikipedia.org/portal/wikipedia.org/assets/js/gt-ie9-507b16b6be.js",
            "artifact_sha256": "b6095c067391ecb2841c3bdb11534507ed219c958bba2a20720ae876b6f2cb31",
            "bytes": 580
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
        "kind": "endpoint_candidate",
        "value": "translationHash",
        "confidence": "low",
        "basis": [
          {
            "script_key": "scr_20366b6d397338a57004badc5be6c40c554a6680db92dbf2176d1770f5ec5e33",
            "artifact_sha256": "c406c48ae80988a75fbfa2993f8b6faa18853e175cd602c8cbf474cf68c4dfc7",
            "line": 1,
            "column": 14951,
            "detector": "call:i.storage.get:unverified-network-receiver"
          }
        ]
      },
      {
        "kind": "endpoint_candidate",
        "value": "storedTranslations",
        "confidence": "low",
        "basis": [
          {
            "script_key": "scr_20366b6d397338a57004badc5be6c40c554a6680db92dbf2176d1770f5ec5e33",
            "artifact_sha256": "c406c48ae80988a75fbfa2993f8b6faa18853e175cd602c8cbf474cf68c4dfc7",
            "line": 1,
            "column": 15109,
            "detector": "call:i.storage.get:unverified-network-receiver"
          }
        ]
      },
      {
        "kind": "endpoint_candidate",
        "value": "lang-list-active",
        "confidence": "low",
        "basis": [
          {
            "script_key": "scr_20366b6d397338a57004badc5be6c40c554a6680db92dbf2176d1770f5ec5e33",
            "artifact_sha256": "c406c48ae80988a75fbfa2993f8b6faa18853e175cd602c8cbf474cf68c4dfc7",
            "line": 1,
            "column": 20301,
            "detector": "call:mw.storage.get:unverified-network-receiver"
          }
        ]
      },
      {
        "kind": "endpoint_candidate",
        "value": "translationHash",
        "confidence": "low",
        "basis": [
          {
            "script_key": "scr_20366b6d397338a57004badc5be6c40c554a6680db92dbf2176d1770f5ec5e33",
            "artifact_sha256": "c406c48ae80988a75fbfa2993f8b6faa18853e175cd602c8cbf474cf68c4dfc7",
            "line": 1,
            "column": 20707,
            "detector": "call:o.storage.get:unverified-network-receiver"
          }
        ]
      },
      {
        "kind": "endpoint_candidate",
        "value": "storedTranslations",
        "confidence": "low",
        "basis": [
          {
            "script_key": "scr_20366b6d397338a57004badc5be6c40c554a6680db92dbf2176d1770f5ec5e33",
            "artifact_sha256": "c406c48ae80988a75fbfa2993f8b6faa18853e175cd602c8cbf474cf68c4dfc7",
            "line": 1,
            "column": 20747,
            "detector": "call:o.storage.get:unverified-network-receiver"
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
      "parsed_scripts": 4,
      "parse_failures": 0,
      "visited_ast_nodes": 8188
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
  "evidence_id": "ev_440175a35528dfbd139ff8dcf818d9df9f8730e3403f15f007016cf424130ba5",
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
      "https://www.wikipedia.org"
    ],
    "target_id": "A68387E67005350EB4D473A07B5B8B43",
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
      "target_id": "A68387E67005350EB4D473A07B5B8B43",
      "url": "https://www.wikipedia.org/",
      "origin": "https://www.wikipedia.org"
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
_Finished 2026-10-16T00:13:55.657Z · 0 problem(s) · REA by morluto (MIT) · for lawful research only_
