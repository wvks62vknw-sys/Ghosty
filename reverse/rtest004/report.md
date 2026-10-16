# Reverse engineering report

**Target:** is-odd  
**Kind:** npm  
**Started:** 2026-10-16T00:13:23.299Z


## Package overview (Ghosty baseline)

- **Package:** is-odd 3.0.1 — Returns true if the given number is odd, and is an integer that does not exceed the JavaScript MAXIMUM_SAFE_INTEGER.
- **Licence:** MIT  ·  **Entry:** "index.js"  ·  **Bin:** none
- **Scripts:** test
- **Files:** 4  ·  by type: (none) 1, .md 1, .js 1, .json 1

**Dependencies (1):** is-number
**Dev dependencies (2):** gulp-format-md, mocha

**Largest files:**
- README.md (3 KB)
- package.json (1 KB)
- LICENSE (1 KB)
- index.js (1 KB)


## REA · JavaScript application

```json
{
  "evidence_id": "ev_c2b84eeb4174513df7e0d3dfabf2f9ae16011b18ae5045f444e16da2ba4c8cdd",
  "subject": {
    "name": "app",
    "digest": {
      "sha256": "aa163948a0b367661cc437d03ec1f6fcad6711494b9eb8fc2a2e860fcb637af0"
    },
    "local_path": "/tmp/rea-KOOpht/app",
    "format": "directory",
    "architecture": null
  },
  "provider": {
    "id": "rea-javascript-application",
    "name": "REA JavaScript application analyzer",
    "version": "1"
  },
  "analysis_profile": null,
  "predicate_type": "rea.javascript-application-analysis",
  "operation": "analyze_javascript_application",
  "parameters": {
    "format": "auto",
    "integrity_policy": "fail"
  },
  "raw_result": null,
  "normalized_result": {
    "input_path": "/tmp/rea-KOOpht/app",
    "format": "directory",
    "root_artifact_sha256": "aa163948a0b367661cc437d03ec1f6fcad6711494b9eb8fc2a2e860fcb637af0",
    "inventory_manifest_id": "agm_f54bf1f83301c0204d62d240ccda9b1517e0d4e393ba98966fb3f536df4c62fb",
    "inventory_graph_sha256": "a1f32a5576c8ad4d2c1beb30a7e23ef7cd87b2211c1574a2d6f51503985b365d",
    "integrity_contradictions": [],
    "graph": {
      "schema": "JavaScriptApplicationGraph",
      "root_node_ids": [
        "jag_node_889fdc4c9c11658acb0e0649d3e7ae8cddae68e4f416b253cd89684678e414e3"
      ],
      "nodes": [
        {
          "node_id": "jag_node_3346f53dc132686db4e79fddfc8578f40a93e5e1792773a1864fa5770039f96b",
          "kind": "javascript-module",
          "identity": {
            "strategy": "artifact-local-key",
            "stability": "artifact-version",
            "artifact_sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
            "namespace": "module-export",
            "key": "[\"aa163948a0b367661cc437d03ec1f6fcad6711494b9eb8fc2a2e860fcb637af0\",\"index.js\",\"default\"]"
          },
          "observations": [
            {
              "label": "index.js:default",
              "source_map_reference": null,
              "properties": {
                "semantic_role": "export-binding",
                "module_path": "index.js",
                "relationship_kind": "commonjs-export",
                "exported_name": "default",
                "local_name": null,
                "imported_name": null,
                "declared_specifier": null
              },
              "evidence": {
                "authority": "ast-static-analysis",
                "state": "observed",
                "confidence": "exact",
                "artifact": {
                  "available": true,
                  "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
                  "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
                },
                "location": {
                  "available": true,
                  "value": {
                    "kind": "source-range",
                    "source": "index.js",
                    "start": {
                      "line": 12,
                      "column": 0
                    },
                    "end": {
                      "line": 24,
                      "column": 1
                    }
                  }
                },
                "extractor": {
                  "name": "rea-javascript-artifact-reconstruction",
                  "version": "1",
                  "operation": "recover-module-export",
                  "executable_sha256": null
                },
                "coverage": {
                  "status": "complete",
                  "truncated": false,
                  "omitted_count": 0,
                  "limits": []
                },
                "limitations": [
                  "Cross-function mutation and dynamic property resolution remain unknown.",
                  "Local call, argument, return, and closure relations are static candidates and do not prove runtime invocation.",
                  "Promise ownership covers explicit unshadowed Promise construction, static factories, aggregation, chaining, and await syntax only.",
                  "Return sites include only direct callable returns; nested callable returns remain separate.",
                  "Values and aliases were recovered from inert syntax only; no JavaScript was executed."
                ],
                "evidence_ids": []
              },
              "observation_id": "jag_observation_62f480606d8496bf601e7288c8d3990ae3f47df85a4d88350364b81d2aaf33b3",
              "identifier_strategy": {
                "strategy": "semantic-content-sha256",
                "stability": "observation-exact"
              }
            },
            {
              "label": "index.js:default:return-shapes",
              "source_map_reference": null,
              "properties": {
                "semantic_role": "export-return-shapes",
                "module_path": "index.js",
                "exported_name": "default",
                "callable_id": "callable:function:215:540",
                "callable_kind": "function",
                "static_return_shapes": [
                  {
                    "source_range": {
                      "start": {
                        "line": 23,
                        "column": 2
                      },
                      "end": {
                        "line": 23,
                        "column": 23
                      }
                    },
                    "value_status": "unknown",
                    "fields": [
                      {
                        "path": "",
                        "presence": "present",
                        "state": "unknown",
                        "value": null,
                        "reason": "Unsupported BinaryExpression value."
                      }
                    ],
                    "property_coverage": []
                  }
                ],
                "return_shape_coverage": {
                  "status": "complete",
                  "retained_return_sites": 1,
                  "omitted_return_sites": 0,
                  "omitted_fields": 0,
                  "omitted_property_coverage": 0,
                  "projection_complete": true
                }
              },
              "evidence": {
                "authority": "static-relationship-inference",
                "state": "inferred",
                "confidence": "high",
                "artifact": {
                  "available": true,
                  "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
                  "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
                },
                "location": {
                  "available": true,
                  "value": {
                    "kind": "source-range",
                    "source": "index.js",
                    "start": {
                      "line": 12,
                      "column": 17
                    },
                    "end": {
                      "line": 24,
                      "column": 1
                    }
                  }
                },
                "extractor": {
                  "name": "rea-javascript-artifact-reconstruction",
                  "version": "1",
                  "operation": "recover-export-return-shapes",
                  "executable_sha256": null
                },
                "coverage": {
                  "status": "complete",
                  "truncated": false,
                  "omitted_count": 0,
                  "limits": []
                },
                "limitations": [
                  "Cross-function mutation and dynamic property resolution remain unknown.",
                  "Local call, argument, return, and closure relations are static candidates and do not prove runtime invocation.",
                  "Promise ownership covers explicit unshadowed Promise construction, static factories, aggregation, chaining, and await syntax only.",
                  "Return shapes are inferred from inert syntax and do not prove runtime behavior.",
                  "Return sites include only direct callable returns; nested callable returns remain separate.",
                  "Static syntax does not prove that this relationship executes at runtime.",
                  "Values and aliases were recovered from inert syntax only; no JavaScript was executed."
                ],
                "evidence_ids": []
              },
              "observation_id": "jag_observation_a7a845f0ac0e091fa90e1121e1e9a19200c9bf3b5d63c497d9526ba7f347fd31",
              "identifier_strategy": {
                "strategy": "semantic-content-sha256",
                "stability": "observation-exact"
              }
            }
          ]
        },
        {
          "node_id": "jag_node_4166b2fee9370934c6a1ea5ac68619f82828a02ba5f6be23985bd8475da5dd70",
          "kind": "javascript-module",
          "identity": {
            "strategy": "artifact-local-key",
            "stability": "artifact-version",
            "artifact_sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
            "namespace": "unresolved-semantic-module",
            "key": "external:is-number"
          },
          "observations": [
            {
              "label": "is-number",
              "source_map_reference": null,
              "properties": {
                "semantic_role": "module-reference",
                "declared_specifier": "is-number",
                "resolution_status": "external"
              },
              "evidence": {
                "authority": "static-relationship-inference",
                "state": "inferred",
                "confidence": "low",
                "artifact": {
                  "available": true,
                  "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
                  "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
                },
                "location": {
                  "available": true,
                  "value": {
                    "kind": "source-range",
                    "source": "index.js",
                    "start": {
                      "line": 10,
                      "column": 6
                    },
                    "end": {
                      "line": 10,
                      "column": 37
                    }
                  }
                },
                "extractor": {
                  "name": "rea-javascript-artifact-reconstruction",
                  "version": "1",
                  "operation": "retain-unresolved-semantic-module",
                  "executable_sha256": null
                },
                "coverage": {
                  "status": "complete",
                  "truncated": false,
                  "omitted_count": 0,
                  "limits": []
                },
                "limitations": [
                  "Cross-function mutation and dynamic property resolution remain unknown.",
                  "Local call, argument, return, and closure relations are static candidates and do not prove runtime invocation.",
                  "Promise ownership covers explicit unshadowed Promise construction, static factories, aggregation, chaining, and await syntax only.",
                  "Return sites include only direct callable returns; nested callable returns remain separate.",
                  "Static syntax does not prove that this relationship executes at runtime.",
                  "Values and aliases were recovered from inert syntax only; no JavaScript was executed."
                ],
                "evidence_ids": []
              },
              "observation_id": "jag_observation_b33bc47163d86da4c9e236c186a2c00dc20fca63dbc51aae036ed6c1562ada92",
              "identifier_strategy": {
                "strategy": "semantic-content-sha256",
                "stability": "observation-exact"
              }
            }
          ]
        },
        {
          "node_id": "jag_node_4899ee420410d10ebbc7acc6c75155688e610cac310c8c690d058eb9e567a56c",
          "kind": "javascript-module",
          "identity": {
            "strategy": "artifact-local-key",
            "stability": "artifact-version",
            "artifact_sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
            "namespace": "source-module",
            "key": "aa163948a0b367661cc437d03ec1f6fcad6711494b9eb8fc2a2e860fcb637af0:index.js"
          },
          "observations": [
            {
              "label": "index.js",
              "source_map_reference": null,
              "properties": {
                "semantic_role": "source-module",
                "path": "index.js",
                "container_sha256": "aa163948a0b367661cc437d03ec1f6fcad6711494b9eb8fc2a2e860fcb637af0",
                "logical_module_key": "index.js",
                "module_format": "commonjs",
                "import_relationships": 1,
                "type_relationships": 0,
                "export_relationships": 1,
                "export_names": [
                  "default"
                ],
                "type_export_names": [],
                "omitted_export_names": 0
              },
              "evidence": {
                "authority": "ast-static-analysis",
                "state": "observed",
                "confidence": "exact",
                "artifact": {
                  "available": true,
                  "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
                  "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
                },
                "location": {
                  "available": true,
                  "value": {
                    "kind": "source-range",
                    "source": "index.js",
                    "start": {
                      "line": 1,
                      "column": 0
                    },
                    "end": {
                      "line": 26,
                      "column": 0
                    }
                  }
                },
                "extractor": {
                  "name": "rea-javascript-artifact-reconstruction",
                  "version": "1",
                  "operation": "recover-source-module",
                  "executable_sha256": null
                },
                "coverage": {
                  "status": "complete",
                  "truncated": false,
                  "omitted_count": 0,
                  "limits": []
                },
                "limitations": [
                  "Cross-function mutation and dynamic property resolution remain unknown.",
                  "Local call, argument, return, and closure relations are static candidates and do not prove runtime invocation.",
                  "Promise ownership covers explicit unshadowed Promise construction, static factories, aggregation, chaining, and await syntax only.",
                  "Return sites include only direct callable returns; nested callable returns remain separate.",
                  "Values and aliases were recovered from inert syntax only; no JavaScript was executed."
                ],
                "evidence_ids": []
              },
              "observation_id": "jag_observation_900181038bb00b2b92df3b0a69b70d272ec4448256a2866e17c92faf2ed17f5e",
              "identifier_strategy": {
                "strategy": "semantic-content-sha256",
                "stability": "observation-exact"
              }
            }
          ]
        },
        {
          "node_id": "jag_node_4bb76bafb336cfbe9bc639f517bb393239199529c3d95ec8dba24a955daf259e",
          "kind": "electron-main",
          "identity": {
            "strategy": "artifact-local-key",
            "stability": "artifact-version",
            "artifact_sha256": "5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c",
            "namespace": "electron-role",
            "key": "electron-main:package-entrypoint:index.js"
          },
          "observations": [
            {
              "label": "index.js",
              "source_map_reference": null,
              "properties": {
                "declared_path": "index.js",
                "resolution_context": "package-entrypoint",
                "resolved_path": "index.js",
                "resolution_status": "resolved",
                "limitations": [],
                "mechanism": "package.json:main"
              },
              "evidence": {
                "authority": "static-relationship-inference",
                "state": "inferred",
                "confidence": "high",
                "artifact": {
                  "available": true,
                  "artifact_id": "art_5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c",
                  "sha256": "5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c"
                },
                "location": {
                  "available": true,
                  "value": {
                    "kind": "artifact-path",
                    "path": "package.json"
                  }
                },
                "extractor": {
                  "name": "rea-javascript-artifact-reconstruction",
                  "version": "1",
                  "operation": "discover-electron-entrypoint",
                  "executable_sha256": null
                },
                "coverage": {
                  "status": "complete",
                  "truncated": false,
                  "omitted_count": 0,
                  "limits": []
                },
                "limitations": [
                  "Static syntax does not prove that this relationship executes at runtime."
                ],
                "evidence_ids": []
              },
              "observation_id": "jag_observation_cf36d39b015e463ee8158f3fc08441989267124a716e293886dce121f3b703ed",
              "identifier_strategy": {
                "strategy": "semantic-content-sha256",
                "stability": "observation-exact"
              }
            }
          ]
        },
        {
          "node_id": "jag_node_5fa59689ecf9094d76f8b334cbed70661dd76d80504dffaca93bb74f66559145",
          "kind": "javascript-module",
          "identity": {
            "strategy": "artifact-local-key",
            "stability": "artifact-version",
            "artifact_sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
            "namespace": "unresolved-reference",
            "key": "require:is-number"
          },
          "observations": [
            {
              "label": "is-number",
              "source_map_reference": null,
              "properties": {
                "reference_kind": "require",
                "specifier": "is-number",
                "expression": null,
                "resolution": "unresolved",
                "resolution_status": "external"
              },
              "evidence": {
                "authority": "static-relationship-inference",
                "state": "inferred",
                "confidence": "low",
                "artifact": {
                  "available": true,
                  "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
                  "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
                },
                "location": {
                  "available": true,
                  "value": {
                    "kind": "source-range",
                    "source": "index.js",
                    "start": {
                      "line": 10,
                      "column": 17
                    },
                    "end": {
                      "line": 10,
                      "column": 37
                    }
                  }
                },
                "extractor": {
                  "name": "rea-javascript-artifact-reconstruction",
                  "version": "1",
                  "operation": "resolve-static-reference",
                  "executable_sha256": null
                },
                "coverage": {
                  "status": "complete",
                  "truncated": false,
                  "omitted_count": 0,
                  "limits": []
                },
                "limitations": [
                  "No matching bare package was inventoried in an enclosing node_modules directory.",
                  "Static syntax does not prove that this relationship executes at runtime.",
                  "The static reference could not be resolved within the inventoried artifact."
                ],
                "evidence_ids": []
              },
              "observation_id": "jag_observation_445daaf53aee53176960b97d997516588ff0d801c0ce0b2d3b67a7649329676f",
              "identifier_strategy": {
                "strategy": "semantic-content-sha256",
                "stability": "observation-exact"
              }
            }
          ]
        },
        {
          "node_id": "jag_node_889fdc4c9c11658acb0e0649d3e7ae8cddae68e4f416b253cd89684678e414e3",
          "kind": "package",
          "identity": {
            "strategy": "artifact-local-key",
            "stability": "artifact-version",
            "artifact_sha256": "5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c",
            "namespace": "package-json",
            "key": "package.json"
          },
          "observations": [
            {
              "label": "is-odd",
              "source_map_reference": null,
              "properties": {
                "path": "package.json",
                "name": "is-odd",
                "version": "3.0.1",
                "main": "index.js",
                "renderer": null,
                "parse_status": "included"
              },
              "evidence": {
                "authority": "artifact-bytes",
                "state": "observed",
                "confidence": "exact",
                "artifact": {
                  "available": true,
                  "artifact_id": "art_5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c",
                  "sha256": "5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c"
                },
                "location": {
                  "available": true,
                  "value": {
                    "kind": "artifact-path",
                    "path": "package.json"
                  }
                },
                "extractor": {
                  "name": "rea-javascript-artifact-reconstruction",
                  "version": "1",
                  "operation": "parse-package-json",
                  "executable_sha256": null
                },
                "coverage": {
                  "status": "complete",
                  "truncated": false,
                  "omitted_count": 0,
                  "limits": []
                },
                "limitations": [],
                "evidence_ids": []
              },
              "observation_id": "jag_observation_e6ee3dc02023d7af81d4a675c4383f9009da5b6267ef6242a030f4cf59e9eeb5",
              "identifier_strategy": {
                "strategy": "semantic-content-sha256",
                "stability": "observation-exact"
              }
            }
          ]
        },
        {
          "node_id": "jag_node_ccd933df5b4ac46358e55f189dd3c033484d616f83b4e9c6f9971831fa14d5f0",
          "kind": "artifact",
          "identity": {
            "strategy": "content-digest",
            "stability": "global-exact",
            "sha256": "5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c"
          },
          "observations": [
            {
              "label": "package.json",
              "source_map_reference": null,
              "properties": {
                "path": "package.json",
                "bytes": 1381,
                "inventory_artifact_id": "art_dd16c66587700880fa20a60c58911418ee660e0fa3553bb35816ba7883947db2",
                "unpacked": false,
                "file_kind": "package-json",
                "text_status": "included",
                "parse_status": null,
                "json_parse_status": null,
                "json_top_level_keys": [],
                "omitted_json_top_level_keys": 0,
                "vendor_markers": []
              },
              "evidence": {
                "authority": "artifact-bytes",
                "state": "observed",
                "confidence": "exact",
                "artifact": {
                  "available": true,
                  "artifact_id": "art_5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c",
                  "sha256": "5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c"
                },
                "location": {
                  "available": true,
                  "value": {
                    "kind": "artifact-path",
                    "path": "package.json"
                  }
                },
                "extractor": {
                  "name": "rea-javascript-artifact-reconstruction",
                  "version": "1",
                  "operation": "inventory-relevant-file",
                  "executable_sha256": null
                },
                "coverage": {
                  "status": "complete",
                  "truncated": false,
                  "omitted_count": 0,
                  "limits": []
                },
                "limitations": [],
                "evidence_ids": []
              },
              "observation_id": "jag_observation_7122281742f7aaff0177fddddd6db67245f45c168657f2db946d5decd56c211e",
              "identifier_strategy": {
                "strategy": "semantic-content-sha256",
                "stability": "observation-exact"
              }
            }
          ]
        },
        {
          "node_id": "jag_node_e001fb0d2d20a839f79c205eca376e640f6b5df2b7486ddd0b64f627b097f019",
          "kind": "artifact",
          "identity": {
            "strategy": "content-digest",
            "stability": "global-exact",
            "sha256": "aa163948a0b367661cc437d03ec1f6fcad6711494b9eb8fc2a2e860fcb637af0"
          },
          "observations": [
            {
              "label": "artifact root",
              "source_map_reference": null,
              "properties": {
                "format": "directory",
                "bytes": 0,
                "inventory_manifest_id": "agm_f54bf1f83301c0204d62d240ccda9b1517e0d4e393ba98966fb3f536df4c62fb",
                "inventory_graph_sha256": "a1f32a5576c8ad4d2c1beb30a7e23ef7cd87b2211c1574a2d6f51503985b365d",
                "inventory_artifact_id": "art_a56a94dc940bbf788fadee6a34b6dd2d1d9402e9193c0ea734798822569ac0ed"
              },
              "evidence": {
                "authority": "artifact-bytes",
                "state": "observed",
                "confidence": "exact",
                "artifact": {
                  "available": true,
                  "artifact_id": "art_aa163948a0b367661cc437d03ec1f6fcad6711494b9eb8fc2a2e860fcb637af0",
                  "sha256": "aa163948a0b367661cc437d03ec1f6fcad6711494b9eb8fc2a2e860fcb637af0"
                },
                "location": {
                  "available": true,
                  "value": {
                    "kind": "artifact-path",
                    "path": "artifact-root"
                  }
                },
                "extractor": {
                  "name": "rea-javascript-artifact-reconstruction",
                  "version": "1",
                  "operation": "inventory-root",
                  "executable_sha256": null
                },
                "coverage": {
                  "status": "complete",
                  "truncated": false,
                  "omitted_count": 0,
                  "limits": []
                },
                "limitations": [
                  "artifact-root is a path-independent alias; the application result retains the canonical local input path."
                ],
                "evidence_ids": []
              },
              "observation_id": "jag_observation_f12ba9585ad82e847fa47bc41e0f2a3ee12ced405420cdf3103199987f23047e",
              "identifier_strategy": {
                "strategy": "semantic-content-sha256",
                "stability": "observation-exact"
              }
            }
          ]
        },
        {
          "node_id": "jag_node_e965c55cc29e0b26c138c2e84e4013c8c2ae887ec8c3fa09e3fc8f63f529e2fb",
          "kind": "javascript-asset",
          "identity": {
            "strategy": "content-digest",
            "stability": "global-exact",
            "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
          },
          "observations": [
            {
              "label": "index.js",
              "source_map_reference": null,
              "properties": {
                "path": "index.js",
                "bytes": 543,
                "inventory_artifact_id": "art_e38a3de05d575817d67509223fe3f867862b3a17413655cba6cac386083cc619",
                "unpacked": false,
                "file_kind": "javascript",
                "text_status": "included",
                "parse_status": "complete",
                "json_parse_status": null,
                "json_top_level_keys": [],
                "omitted_json_top_level_keys": 0,
                "vendor_markers": []
              },
              "evidence": {
                "authority": "artifact-bytes",
                "state": "observed",
                "confidence": "exact",
                "artifact": {
                  "available": true,
                  "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
                  "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
                },
                "location": {
                  "available": true,
                  "value": {
                    "kind": "artifact-path",
                    "path": "index.js"
                  }
                },
                "extractor": {
                  "name": "rea-javascript-artifact-reconstruction",
                  "version": "1",
                  "operation": "inventory-relevant-file",
                  "executable_sha256": null
                },
                "coverage": {
                  "status": "complete",
                  "truncated": false,
                  "omitted_count": 0,
                  "limits": []
                },
                "limitations": [],
                "evidence_ids": []
              },
              "observation_id": "jag_observation_5e9d758dee6ce4e40046bf46fc2f350f95c4dfff07031c2561017859882b8813",
              "identifier_strategy": {
                "strategy": "semantic-content-sha256",
                "stability": "observation-exact"
              }
            }
          ]
        }
      ],
      "edges": [
        {
          "source_node_id": "jag_node_4899ee420410d10ebbc7acc6c75155688e610cac310c8c690d058eb9e567a56c",
          "target_node_id": "jag_node_5fa59689ecf9094d76f8b334cbed70661dd76d80504dffaca93bb74f66559145",
          "relation": "imports",
          "properties": {
            "kind": "require",
            "specifier": "is-number",
            "expression": null,
            "resolution_mode": "require",
            "resolved_path": null,
            "resolution_status": "external"
          },
          "evidence": {
            "authority": "static-relationship-inference",
            "state": "inferred",
            "confidence": "high",
            "artifact": {
              "available": true,
              "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
              "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
            },
            "location": {
              "available": true,
              "value": {
                "kind": "source-range",
                "source": "index.js",
                "start": {
                  "line": 10,
                  "column": 17
                },
                "end": {
                  "line": 10,
                  "column": 37
                }
              }
            },
            "extractor": {
              "name": "rea-javascript-artifact-reconstruction",
              "version": "1",
              "operation": "map-static-relationship",
              "executable_sha256": null
            },
            "coverage": {
              "status": "complete",
              "truncated": false,
              "omitted_count": 0,
              "limits": []
            },
            "limitations": [
              "No matching bare package was inventoried in an enclosing node_modules directory.",
              "Static syntax does not prove that this relationship executes at runtime."
            ],
            "evidence_ids": []
          },
          "edge_id": "jag_edge_0239be7fba6242f3f65666e23e15dc66dff23c53553bc27aa49bb05857785de9",
          "identifier_strategy": {
            "strategy": "semantic-content-sha256",
            "stability": "relationship-exact"
          }
        },
        {
          "source_node_id": "jag_node_889fdc4c9c11658acb0e0649d3e7ae8cddae68e4f416b253cd89684678e414e3",
          "target_node_id": "jag_node_e001fb0d2d20a839f79c205eca376e640f6b5df2b7486ddd0b64f627b097f019",
          "relation": "contains",
          "properties": {
            "basis": "package-metadata-within-artifact"
          },
          "evidence": {
            "authority": "static-relationship-inference",
            "state": "inferred",
            "confidence": "high",
            "artifact": {
              "available": true,
              "artifact_id": "art_5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c",
              "sha256": "5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c"
            },
            "location": {
              "available": true,
              "value": {
                "kind": "artifact-path",
                "path": "package.json"
              }
            },
            "extractor": {
              "name": "rea-javascript-artifact-reconstruction",
              "version": "1",
              "operation": "associate-package-artifact",
              "executable_sha256": null
            },
            "coverage": {
              "status": "complete",
              "truncated": false,
              "omitted_count": 0,
              "limits": []
            },
            "limitations": [
              "Static syntax does not prove that this relationship executes at runtime."
            ],
            "evidence_ids": []
          },
          "edge_id": "jag_edge_02ca975880a64144083686dac365d14dbb42325a8b4273744e80ed156dbc472a",
          "identifier_strategy": {
            "strategy": "semantic-content-sha256",
            "stability": "relationship-exact"
          }
        },
        {
          "source_node_id": "jag_node_4bb76bafb336cfbe9bc639f517bb393239199529c3d95ec8dba24a955daf259e",
          "target_node_id": "jag_node_e965c55cc29e0b26c138c2e84e4013c8c2ae887ec8c3fa09e3fc8f63f529e2fb",
          "relation": "maps_to",
          "properties": {
            "declared_path": "index.js",
            "resolution_context": "package-entrypoint",
            "resolved_path": "index.js",
            "resolution_status": "resolved"
          },
          "evidence": {
            "authority": "static-relationship-inference",
            "state": "inferred",
            "confidence": "high",
            "artifact": {
              "available": true,
              "artifact_id": "art_5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c",
              "sha256": "5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c"
            },
            "location": {
              "available": true,
              "value": {
                "kind": "artifact-path",
                "path": "package.json"
              }
            },
            "extractor": {
              "name": "rea-javascript-artifact-reconstruction",
              "version": "1",
              "operation": "resolve-electron-entrypoint",
              "executable_sha256": null
            },
            "coverage": {
              "status": "complete",
              "truncated": false,
              "omitted_count": 0,
              "limits": []
            },
            "limitations": [
              "Static syntax does not prove that this relationship executes at runtime."
            ],
            "evidence_ids": []
          },
          "edge_id": "jag_edge_1dad4cc66d643982c9b2033f789f7cd9fb2d58bfb5f7a1201f951e78f9895275",
          "identifier_strategy": {
            "strategy": "semantic-content-sha256",
            "stability": "relationship-exact"
          }
        },
        {
          "source_node_id": "jag_node_889fdc4c9c11658acb0e0649d3e7ae8cddae68e4f416b253cd89684678e414e3",
          "target_node_id": "jag_node_4bb76bafb336cfbe9bc639f517bb393239199529c3d95ec8dba24a955daf259e",
          "relation": "loads",
          "properties": {
            "declared_path": "index.js",
            "resolution_context": "package-entrypoint",
            "resolved_path": "index.js",
            "resolution_status": "resolved",
            "limitations": []
          },
          "evidence": {
            "authority": "static-relationship-inference",
            "state": "inferred",
            "confidence": "high",
            "artifact": {
              "available": true,
              "artifact_id": "art_5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c",
              "sha256": "5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c"
            },
            "location": {
              "available": true,
              "value": {
                "kind": "artifact-path",
                "path": "package.json"
              }
            },
            "extractor": {
              "name": "rea-javascript-artifact-reconstruction",
              "version": "1",
              "operation": "discover-package-entrypoint",
              "executable_sha256": null
            },
            "coverage": {
              "status": "complete",
              "truncated": false,
              "omitted_count": 0,
              "limits": []
            },
            "limitations": [
              "Static syntax does not prove that this relationship executes at runtime."
            ],
            "evidence_ids": []
          },
          "edge_id": "jag_edge_6a2776ef2bd04ca438167f8cf657594f691749d053c12da2170cb24b7661bef5",
          "identifier_strategy": {
            "strategy": "semantic-content-sha256",
            "stability": "relationship-exact"
          }
        },
        {
          "source_node_id": "jag_node_e965c55cc29e0b26c138c2e84e4013c8c2ae887ec8c3fa09e3fc8f63f529e2fb",
          "target_node_id": "jag_node_4899ee420410d10ebbc7acc6c75155688e610cac310c8c690d058eb9e567a56c",
          "relation": "contains",
          "properties": {
            "logical_module_key": "index.js"
          },
          "evidence": {
            "authority": "ast-static-analysis",
            "state": "observed",
            "confidence": "exact",
            "artifact": {
              "available": true,
              "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
              "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
            },
            "location": {
              "available": true,
              "value": {
                "kind": "source-range",
                "source": "index.js",
                "start": {
                  "line": 1,
                  "column": 0
                },
                "end": {
                  "line": 26,
                  "column": 0
                }
              }
            },
            "extractor": {
              "name": "rea-javascript-artifact-reconstruction",
              "version": "1",
              "operation": "map-bundler-structure",
              "executable_sha256": null
            },
            "coverage": {
              "status": "complete",
              "truncated": false,
              "omitted_count": 0,
              "limits": []
            },
            "limitations": [],
            "evidence_ids": []
          },
          "edge_id": "jag_edge_71f9a0efc3aa72737bb7c1d03bef9912667e849349b01779e26d9e97f53ae935",
          "identifier_strategy": {
            "strategy": "semantic-content-sha256",
            "stability": "relationship-exact"
          }
        },
        {
          "source_node_id": "jag_node_4899ee420410d10ebbc7acc6c75155688e610cac310c8c690d058eb9e567a56c",
          "target_node_id": "jag_node_4166b2fee9370934c6a1ea5ac68619f82828a02ba5f6be23985bd8475da5dd70",
          "relation": "imports",
          "properties": {
            "module_link_kind": "require",
            "resolution_mode": "require",
            "specifier": "is-number",
            "imported_name": "*",
            "imported_path": [
              "*"
            ],
            "local_name": "isNumber",
            "exported_name": null,
            "resolved_path": null,
            "resolution_status": "external",
            "target_file_kind": null,
            "target_json_status": null
          },
          "evidence": {
            "authority": "static-relationship-inference",
            "state": "inferred",
            "confidence": "medium",
            "artifact": {
              "available": true,
              "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
              "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
            },
            "location": {
              "available": true,
              "value": {
                "kind": "source-range",
                "source": "index.js",
                "start": {
                  "line": 10,
                  "column": 6
                },
                "end": {
                  "line": 10,
                  "column": 37
                }
              }
            },
            "extractor": {
              "name": "rea-javascript-artifact-reconstruction",
              "version": "1",
              "operation": "resolve-semantic-module-relationship",
              "executable_sha256": null
            },
            "coverage": {
              "status": "complete",
              "truncated": false,
              "omitted_count": 0,
              "limits": []
            },
            "limitations": [
              "Cross-function mutation and dynamic property resolution remain unknown.",
              "Local call, argument, return, and closure relations are static candidates and do not prove runtime invocation.",
              "No matching bare package was inventoried in an enclosing node_modules directory.",
              "Promise ownership covers explicit unshadowed Promise construction, static factories, aggregation, chaining, and await syntax only.",
              "Return sites include only direct callable returns; nested callable returns remain separate.",
              "Static syntax does not prove that this relationship executes at runtime.",
              "Values and aliases were recovered from inert syntax only; no JavaScript was executed."
            ],
            "evidence_ids": []
          },
          "edge_id": "jag_edge_8ab43b2c5517bb2daa6d02161016151eb90de0c7f4655d1248b16406f3981a30",
          "identifier_strategy": {
            "strategy": "semantic-content-sha256",
            "stability": "relationship-exact"
          }
        },
        {
          "source_node_id": "jag_node_e001fb0d2d20a839f79c205eca376e640f6b5df2b7486ddd0b64f627b097f019",
          "target_node_id": "jag_node_ccd933df5b4ac46358e55f189dd3c033484d616f83b4e9c6f9971831fa14d5f0",
          "relation": "contains",
          "properties": {
            "path": "package.json"
          },
          "evidence": {
            "authority": "artifact-bytes",
            "state": "observed",
            "confidence": "exact",
            "artifact": {
              "available": true,
              "artifact_id": "art_5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c",
              "sha256": "5ecb92855f47dd9e225d37437e50f76c9fd41eda3d978d1d416066eadf1dc75c"
            },
            "location": {
              "available": true,
              "value": {
                "kind": "artifact-path",
                "path": "package.json"
              }
            },
            "extractor": {
              "name": "rea-javascript-artifact-reconstruction",
              "version": "1",
              "operation": "inventory-file",
              "executable_sha256": null
            },
            "coverage": {
              "status": "complete",
              "truncated": false,
              "omitted_count": 0,
              "limits": []
            },
            "limitations": [],
            "evidence_ids": []
          },
          "edge_id": "jag_edge_aaa35311c643dcd2f46764472c77ea5e293771fc531da77b8fa01860b4c9f58a",
          "identifier_strategy": {
            "strategy": "semantic-content-sha256",
            "stability": "relationship-exact"
          }
        },
        {
          "source_node_id": "jag_node_4899ee420410d10ebbc7acc6c75155688e610cac310c8c690d058eb9e567a56c",
          "target_node_id": "jag_node_3346f53dc132686db4e79fddfc8578f40a93e5e1792773a1864fa5770039f96b",
          "relation": "exposes",
          "properties": {
            "module_link_kind": "commonjs-export",
            "specifier": null,
            "imported_name": null,
            "imported_path": [],
            "local_name": null,
            "exported_name": "default",
            "resolved_path": null,
            "resolution_status": null,
            "target_file_kind": null,
            "target_json_status": null
          },
          "evidence": {
            "authority": "static-relationship-inference",
            "state": "inferred",
            "confidence": "high",
            "artifact": {
              "available": true,
              "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
              "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
            },
            "location": {
              "available": true,
              "value": {
                "kind": "source-range",
                "source": "index.js",
                "start": {
                  "line": 12,
                  "column": 0
                },
                "end": {
                  "line": 24,
                  "column": 1
                }
              }
            },
            "extractor": {
              "name": "rea-javascript-artifact-reconstruction",
              "version": "1",
              "operation": "expose-module-export",
              "executable_sha256": null
            },
            "coverage": {
              "status": "complete",
              "truncated": false,
              "omitted_count": 0,
              "limits": []
            },
            "limitations": [
              "Cross-function mutation and dynamic property resolution remain unknown.",
              "Local call, argument, return, and closure relations are static candidates and do not prove runtime invocation.",
              "Promise ownership covers explicit unshadowed Promise construction, static factories, aggregation, chaining, and await syntax only.",
              "Return sites include only direct callable returns; nested callable returns remain separate.",
              "Static syntax does not prove that this relationship executes at runtime.",
              "Values and aliases were recovered from inert syntax only; no JavaScript was executed."
            ],
            "evidence_ids": []
          },
          "edge_id": "jag_edge_c5013149865dd5da3138f23f190316e7dbd4b9b07ba3956ddb939d00ad9bd670",
          "identifier_strategy": {
            "strategy": "semantic-content-sha256",
            "stability": "relationship-exact"
          }
        },
        {
          "source_node_id": "jag_node_e001fb0d2d20a839f79c205eca376e640f6b5df2b7486ddd0b64f627b097f019",
          "target_node_id": "jag_node_e965c55cc29e0b26c138c2e84e4013c8c2ae887ec8c3fa09e3fc8f63f529e2fb",
          "relation": "contains",
          "properties": {
            "path": "index.js"
          },
          "evidence": {
            "authority": "artifact-bytes",
            "state": "observed",
            "confidence": "exact",
            "artifact": {
              "available": true,
              "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
              "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
            },
            "location": {
              "available": true,
              "value": {
                "kind": "artifact-path",
                "path": "index.js"
              }
            },
            "extractor": {
              "name": "rea-javascript-artifact-reconstruction",
              "version": "1",
              "operation": "inventory-file",
              "executable_sha256": null
            },
            "coverage": {
              "status": "complete",
              "truncated": false,
              "omitted_count": 0,
              "limits": []
            },
            "limitations": [],
            "evidence_ids": []
          },
          "edge_id": "jag_edge_d5c0eec4149da584d1780272ee3a6e9826c704649c1ff75a1f1e67fc3551b85b",
          "identifier_strategy": {
            "strategy": "semantic-content-sha256",
            "stability": "relationship-exact"
          }
        }
      ],
      "coverage": {
        "status": "complete",
        "truncated": false,
        "omitted_count": 0,
        "limits": []
      },
      "limitations": [
        "CommonJS and ESM binding relationships were recovered from inert syntax and resolved only within the inventoried artifact container.",
        "JavaScript and HTML were parsed as inert text; bundle bootstrap code was never executed.",
        "Static imports, entrypoints, workers, endpoints, and storage relationships do not prove runtime execution.",
        "Static paths and relationships may remain unresolved when expressions are dynamic or obfuscated.",
        "Webpack/Rspack factories were recovered from AST literals; REA did not invoke push handlers or bundle bootstrap code."
      ],
      "graph_id": "jag_4fa9784c5f627a6959564b4f59846a0ba77399fdf8a779539a34a87416d00f6d"
    },
    "summary": {
      "browser_windows": 0,
      "explicit_web_preferences": 0,
      "preload_entrypoints": 0,
      "context_bridge_apis": 0,
      "exposed_api_members": 0,
      "ipc": {
        "operations": 0,
        "literal_channels": 0,
        "dynamic_channel_operations": 0,
        "renderer_transmissions": 0,
        "renderer_listeners": 0,
        "main_handlers": 0,
        "paired_renderer_transmissions": 0,
        "ambiguous_renderer_transmissions": 0,
        "unpaired_literal_renderer_transmissions": 0
      },
      "sender_validation_observations": 0,
      "utility_processes": 0,
      "resolved_utility_entrypoints": 0,
      "native_addon_bindings": 0,
      "resolved_native_addon_bindings": 0
    },
    "statistics": {
      "relevant_files": 2,
      "nested_asar_containers": 0,
      "text_bytes_read": 1924,
      "invalid_utf8_files": 0,
      "parsed_javascript_files": 1,
      "visited_ast_nodes": 67,
      "findings": 3,
      "modules": 0,
      "parse_failures": 0
    },
    "limitations": [
      "CommonJS and ESM binding relationships were recovered from inert syntax and resolved only within the inventoried artifact container.",
      "JavaScript and HTML were parsed as inert text; bundle bootstrap code was never executed.",
      "Static imports, entrypoints, workers, endpoints, and storage relationships do not prove runtime execution.",
      "Static paths and relationships may remain unresolved when expressions are dynamic or obfuscated.",
      "Webpack/Rspack factories were recovered from AST literals; REA did not invoke push handlers or bundle bootstrap code."
    ],
    "semantic_graph": {
      "schema": "JavaScriptSemanticRelationGraph",
      "root_artifact_sha256": "aa163948a0b367661cc437d03ec1f6fcad6711494b9eb8fc2a2e860fcb637af0",
      "application_graph_id": "jag_4fa9784c5f627a6959564b4f59846a0ba77399fdf8a779539a34a87416d00f6d",
      "root_node_ids": [
        "jsrg_node_6da606ea07b1e4bd6d9b13d558fb00e1186a24a0b148876938f8759c5da73f98"
      ],
      "evidence_contexts": [
        {
          "authority": "unknown",
          "state": "unknown",
          "confidence": "unknown",
          "artifact": {
            "available": true,
            "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
            "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
          },
          "extractor": {
            "name": "rea-javascript-semantic-analysis",
            "version": "1",
            "operation": "analyze_javascript_application",
            "executable_sha256": null
          },
          "coverage": {
            "status": "complete",
            "truncated": false,
            "omitted_count": 0,
            "limits": []
          },
          "limitations": [
            "Unsupported CallExpression value."
          ],
          "evidence_ids": [],
          "context_id": "jsrg_evidence_2b4b1f75aa254ec130d11a460919c79d4befb488b59c4746be3184482e0c0cd1"
        },
        {
          "authority": "static-relationship-inference",
          "state": "inferred",
          "confidence": "high",
          "artifact": {
            "available": true,
            "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
            "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
          },
          "extractor": {
            "name": "rea-javascript-semantic-analysis",
            "version": "1",
            "operation": "analyze_javascript_application",
            "executable_sha256": null
          },
          "coverage": {
            "status": "complete",
            "truncated": false,
            "omitted_count": 0,
            "limits": []
          },
          "limitations": [
            "This relationship is a conservative static candidate; it does not prove runtime execution or causal flow."
          ],
          "evidence_ids": [],
          "context_id": "jsrg_evidence_5550a6e64351675ea4705fac347d1ab3401c445a9ee4bd209c3184150e2a42df"
        },
        {
          "authority": "ast-static-analysis",
          "state": "observed",
          "confidence": "exact",
          "artifact": {
            "available": true,
            "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
            "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
          },
          "extractor": {
            "name": "rea-javascript-semantic-analysis",
            "version": "1",
            "operation": "analyze_javascript_application",
            "executable_sha256": null
          },
          "coverage": {
            "status": "complete",
            "truncated": false,
            "omitted_count": 0,
            "limits": []
          },
          "limitations": [],
          "evidence_ids": [],
          "context_id": "jsrg_evidence_7f3a34f7ac8d6ccdfc2d2b7e2cfe213c339eb0060fa88e6dd1325fdc3e73cad3"
        },
        {
          "authority": "unknown",
          "state": "unknown",
          "confidence": "unknown",
          "artifact": {
            "available": true,
            "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
            "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
          },
          "extractor": {
            "name": "rea-javascript-semantic-analysis",
            "version": "1",
            "operation": "analyze_javascript_application",
            "executable_sha256": null
          },
          "coverage": {
            "status": "complete",
            "truncated": false,
            "omitted_count": 0,
            "limits": []
          },
          "limitations": [
            "Unsupported FunctionExpression value."
          ],
          "evidence_ids": [],
          "context_id": "jsrg_evidence_e1247b04d8ed8a9148562d7cb374ff18889e0c0ac5175a556583604978bcc631"
        },
        {
          "authority": "unknown",
          "state": "unknown",
          "confidence": "unknown",
          "artifact": {
            "available": true,
            "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
            "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
          },
          "extractor": {
            "name": "rea-javascript-semantic-analysis",
            "version": "1",
            "operation": "analyze_javascript_application",
            "executable_sha256": null
          },
          "coverage": {
            "status": "complete",
            "truncated": false,
            "omitted_count": 0,
            "limits": []
          },
          "limitations": [
            "Dynamic syntax prevents an exact static relationship."
          ],
          "evidence_ids": [],
          "context_id": "jsrg_evidence_f06db7aa18caf0b6131cc14290131b33e111f0b80dda7dbdf29d59e47c98c2c3"
        },
        {
          "authority": "unknown",
          "state": "unknown",
          "confidence": "unknown",
          "artifact": {
            "available": true,
            "artifact_id": "art_0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
            "sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995"
          },
          "extractor": {
            "name": "rea-javascript-semantic-analysis",
            "version": "1",
            "operation": "analyze_javascript_application",
            "executable_sha256": null
          },
          "coverage": {
            "status": "complete",
            "truncated": false,
            "omitted_count": 0,
            "limits": []
          },
          "limitations": [
            "Binding value has no constant initializer."
          ],
          "evidence_ids": [],
          "context_id": "jsrg_evidence_f63d9a35fdd7fec6a344e7187626162a45285b6f1d830e8b97b57ab0f295bbee"
        }
      ],
      "nodes": [
        {
          "kind": "call-site",
          "identity": {
            "artifact_sha256": "0f9e8227a22ef8abaf1aee8f82d7cc802964d44c9347ed4bbbaf8c427d19a995",
            "module_path": "index.js",
            "source_range": {
              "start": {
                "line": 20,
                "column": 7
              },
              "end": {
                "line": 20,
                "column": 30
              }
            },
            "role_key": "call:call:call:425:448"
          },
          "function_node_id": "jsrg_node_192c65115dd5b8b6a674703eb9b18a2cbf47414f914eb95e61bca256b501e51f",
          "application_node_ids": [],
          "label": "call",
          "properties": {},
          "evidence": {
            "context_id": "jsrg_evidence_7f3a34f7ac8d6ccdfc2d2b7e2cfe213c339eb0060fa88e6dd1
… (truncated)
```


---
_Finished 2026-10-16T00:13:26.081Z · 0 problem(s) · REA by morluto (MIT) · for lawful research only_
