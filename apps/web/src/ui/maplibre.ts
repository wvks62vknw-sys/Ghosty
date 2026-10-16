/**
 * The parts of MapLibre GL JS that ui/map3d.ts uses. The library itself is vendored under
 * public/vendor/maplibre and imported at runtime (not bundled), so these are hand-written
 * types for exactly what Ghosty calls — like leaflet.d.ts for the flat map.
 */
export interface MLLngLat {
  lng: number;
  lat: number;
}
export type MLLngLatLike = [number, number] | MLLngLat;
export interface MLCameraOptions {
  center?: MLLngLatLike;
  zoom?: number;
  pitch?: number;
  bearing?: number;
}
export interface MLAnimationOptions extends MLCameraOptions {
  duration?: number;
  essential?: boolean;
}
export interface MLMapOptions extends MLCameraOptions {
  container: HTMLElement;
  style: string | MLStyleSpec;
  attributionControl?: false | { compact?: boolean; customAttribution?: string };
  maxPitch?: number;
  minZoom?: number;
  maxZoom?: number;
  cooperativeGestures?: boolean;
  fadeDuration?: number;
  /** MapLibre's default is to refuse WebGL on a GPU it blocklists; software rendering is fine for us. */
  failIfMajorPerformanceCaveat?: boolean;
}
export interface MLLayerSpec {
  id: string;
  type: string;
  source?: string;
  'source-layer'?: string;
  minzoom?: number;
  maxzoom?: number;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
  filter?: unknown;
}
export interface MLSourceSpec {
  type: string;
  url?: string;
  tiles?: string[];
  tileSize?: number;
  maxzoom?: number;
  minzoom?: number;
  attribution?: string;
  data?: unknown;
}
export interface MLStyleSpec {
  version: 8;
  name?: string;
  sources: Record<string, MLSourceSpec>;
  layers: MLLayerSpec[];
  glyphs?: string;
  sprite?: string;
}
export interface MLMouseEvent {
  lngLat: MLLngLat;
  point: { x: number; y: number };
  originalEvent?: Event;
}
export interface MLErrorEvent {
  error?: { message?: string; status?: number };
}
export interface MLGeoJSONSource {
  setData(data: unknown): void;
}
export interface MLMap {
  on(type: 'click' | 'dblclick' | 'contextmenu' | 'touchstart', fn: (e: MLMouseEvent) => void): MLMap;
  on(type: 'load' | 'style.load' | 'moveend' | 'zoomend' | 'idle' | 'render' | 'styledata' | 'sourcedata', fn: () => void): MLMap;
  on(type: 'error', fn: (e: MLErrorEvent) => void): MLMap;
  once(type: 'load' | 'style.load' | 'idle', fn: () => void): MLMap;
  off(type: string, fn: (e?: unknown) => void): MLMap;
  setStyle(style: string | MLStyleSpec, options?: { diff?: boolean }): MLMap;
  getStyle(): MLStyleSpec;
  isStyleLoaded(): boolean;
  loaded(): boolean;
  addSource(id: string, source: MLSourceSpec): MLMap;
  removeSource(id: string): MLMap;
  getSource(id: string): MLGeoJSONSource | undefined;
  addLayer(layer: MLLayerSpec, before?: string): MLMap;
  removeLayer(id: string): MLMap;
  getLayer(id: string): unknown;
  setLayoutProperty(layer: string, name: string, value: unknown): MLMap;
  setPaintProperty(layer: string, name: string, value: unknown): MLMap;
  jumpTo(o: MLCameraOptions): MLMap;
  easeTo(o: MLAnimationOptions): MLMap;
  flyTo(o: MLAnimationOptions & { speed?: number; curve?: number }): MLMap;
  fitBounds(bounds: [[number, number], [number, number]], o?: { padding?: number; maxZoom?: number; duration?: number; pitch?: number }): MLMap;
  getCenter(): MLLngLat;
  getZoom(): number;
  getPitch(): number;
  getBearing(): number;
  setPitch(p: number): MLMap;
  setBearing(b: number): MLMap;
  resize(): MLMap;
  remove(): void;
  addControl(control: MLControl, position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'): MLMap;
  getCanvas(): HTMLCanvasElement;
  getContainer(): HTMLElement;
  project(ll: MLLngLatLike): { x: number; y: number };
}
/** A control is any object MapLibre can mount (its own classes below). */
export type MLControl = object;
export interface MLMarker {
  setLngLat(ll: MLLngLatLike): MLMarker;
  getLngLat(): MLLngLat;
  addTo(map: MLMap): MLMarker;
  remove(): MLMarker;
  setPopup(popup: MLPopup): MLMarker;
  togglePopup(): MLMarker;
  getElement(): HTMLElement;
}
export interface MLPopup {
  setLngLat(ll: MLLngLatLike): MLPopup;
  setDOMContent(el: HTMLElement): MLPopup;
  addTo(map: MLMap): MLPopup;
  remove(): MLPopup;
  isOpen(): boolean;
  on(type: 'close', fn: () => void): MLPopup;
}
export interface MapLibreNS {
  Map: new (o: MLMapOptions) => MLMap;
  Marker: new (o?: { element?: HTMLElement; color?: string; anchor?: string; offset?: [number, number] }) => MLMarker;
  Popup: new (o?: { closeButton?: boolean; closeOnClick?: boolean; maxWidth?: string; className?: string; offset?: number; anchor?: string }) => MLPopup;
  NavigationControl: new (o?: { showCompass?: boolean; showZoom?: boolean; visualizePitch?: boolean }) => MLControl;
  ScaleControl: new (o?: { maxWidth?: number; unit?: 'metric' | 'imperial' | 'nautical' }) => MLControl;
  AttributionControl: new (o?: { compact?: boolean; customAttribution?: string }) => MLControl;
  setWorkerUrl(url: string): void;
  version: string;
}
