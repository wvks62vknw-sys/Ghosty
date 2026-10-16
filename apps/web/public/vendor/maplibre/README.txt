MapLibre GL JS 6.14.0 (BSD-3-Clause), vendored unchanged from the npm package maplibre-gl@6.14.0:
  maplibre-gl.mjs         the library (an ES module, imported on demand by ui/map3d.ts)
  maplibre-gl-worker.mjs  its tile worker, loaded from this same folder (same origin, so no blob: worker is needed)
  maplibre-gl.css         its stylesheet
Served from Ghosty's own address so the interface's "scripts only from this site" policy holds.
Tiles come from OpenFreeMap (free, no key; see ui/map3d.ts) and, with the owner's public token, Mapbox.
