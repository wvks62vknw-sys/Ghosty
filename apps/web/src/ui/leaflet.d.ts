/**
 * The small part of Leaflet 1.9 that Ghosty uses (ui/flatmap.ts), typed by hand: Leaflet is
 * vendored as a plain script (public/vendor/leaflet) and loaded on demand, not bundled, so no
 * package or type definitions are installed. Add to this file when using more of Leaflet.
 */
declare namespace L {
  type LatLngLike = LatLng | [number, number] | { lat: number; lng: number };

  interface LatLng {
    lat: number;
    lng: number;
  }
  interface LatLngBounds {
    getSouthWest(): LatLng;
    getNorthEast(): LatLng;
    contains(p: LatLngLike): boolean;
    pad(ratio: number): LatLngBounds;
    extend(p: LatLngLike): LatLngBounds;
  }
  interface Point {
    x: number;
    y: number;
  }
  interface LeafletEvent {
    type: string;
    target: unknown;
  }
  interface LeafletMouseEvent extends LeafletEvent {
    latlng: LatLng;
    containerPoint: Point;
    originalEvent: MouseEvent | TouchEvent;
  }

  interface Layer {
    addTo(map: Map | LayerGroup): this;
    remove(): this;
    bindPopup(content: string | HTMLElement | Popup, options?: PopupOptions): this;
    openPopup(latlng?: LatLngLike): this;
    closePopup(): this;
    getPopup(): Popup | undefined;
    bindTooltip(content: string | HTMLElement, options?: TooltipOptions): this;
    on(type: string, fn: (e: LeafletMouseEvent) => void): this;
    off(type?: string, fn?: (e: LeafletMouseEvent) => void): this;
  }
  interface LayerGroup extends Layer {
    addLayer(layer: Layer): this;
    removeLayer(layer: Layer): this;
    clearLayers(): this;
    getLayers(): Layer[];
  }
  interface TileLayer extends Layer {
    setUrl(url: string, noRedraw?: boolean): this;
    setOpacity(opacity: number): this;
  }
  interface Marker extends Layer {
    getLatLng(): LatLng;
    setLatLng(latlng: LatLngLike): this;
  }
  interface CircleMarker extends Layer {
    getLatLng(): LatLng;
    setStyle(style: PathOptions): this;
  }
  interface Polyline extends Layer {
    getBounds(): LatLngBounds;
    setLatLngs(latlngs: LatLngLike[]): this;
    addLatLng(latlng: LatLngLike): this;
    getLatLngs(): LatLng[];
  }
  interface Popup {
    setContent(content: string | HTMLElement): this;
    setLatLng(latlng: LatLngLike): this;
    getElement(): HTMLElement | undefined;
  }
  interface Control {
    addTo(map: Map): this;
    remove(): this;
  }

  interface MapOptions {
    zoomControl?: boolean;
    attributionControl?: boolean;
    minZoom?: number;
    maxZoom?: number;
    worldCopyJump?: boolean;
    zoomSnap?: number;
    preferCanvas?: boolean;
  }
  interface TileLayerOptions {
    attribution?: string;
    subdomains?: string | string[];
    maxZoom?: number;
    maxNativeZoom?: number;
    minZoom?: number;
    opacity?: number;
    crossOrigin?: boolean | string;
    detectRetina?: boolean;
    tileSize?: number;
    zoomOffset?: number;
    referrerPolicy?: string;
    className?: string;
  }
  interface PathOptions {
    color?: string;
    weight?: number;
    opacity?: number;
    fillColor?: string;
    fillOpacity?: number;
    radius?: number;
    dashArray?: string;
    lineCap?: string;
    interactive?: boolean;
    /** A class on the SVG path, so a test can count the lines a feature drew. */
    className?: string;
  }
  interface MarkerOptions {
    title?: string;
    icon?: Icon;
    interactive?: boolean;
    zIndexOffset?: number;
  }
  interface PopupOptions {
    maxWidth?: number;
    minWidth?: number;
    autoPan?: boolean;
    closeButton?: boolean;
    className?: string;
    autoPanPadding?: [number, number];
  }
  interface TooltipOptions {
    permanent?: boolean;
    direction?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';
    className?: string;
    offset?: [number, number];
    opacity?: number;
  }
  interface FitBoundsOptions {
    padding?: [number, number];
    maxZoom?: number;
    animate?: boolean;
  }
  interface Icon {
    options: Record<string, unknown>;
  }
  interface DivIconOptions {
    html?: string | HTMLElement;
    className?: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
  }

  interface Map {
    setView(center: LatLngLike, zoom?: number, options?: { animate?: boolean }): this;
    panTo(center: LatLngLike, options?: { animate?: boolean }): this;
    getCenter(): LatLng;
    getZoom(): number;
    setZoom(zoom: number): this;
    getBounds(): LatLngBounds;
    fitBounds(bounds: LatLngBounds, options?: FitBoundsOptions): this;
    invalidateSize(animate?: boolean): this;
    addLayer(layer: Layer): this;
    removeLayer(layer: Layer): this;
    hasLayer(layer: Layer): boolean;
    on(type: string, fn: (e: LeafletMouseEvent) => void): this;
    off(type?: string, fn?: (e: LeafletMouseEvent) => void): this;
    openPopup(popup: Popup): this;
    closePopup(): this;
    distance(a: LatLngLike, b: LatLngLike): number;
    remove(): this;
    getContainer(): HTMLElement;
  }

  function map(el: HTMLElement | string, options?: MapOptions): Map;
  function tileLayer(urlTemplate: string, options?: TileLayerOptions): TileLayer;
  function marker(latlng: LatLngLike, options?: MarkerOptions): Marker;
  function circleMarker(latlng: LatLngLike, options?: PathOptions): CircleMarker;
  function polyline(latlngs: LatLngLike[], options?: PathOptions): Polyline;
  function layerGroup(layers?: Layer[]): LayerGroup;
  function popup(options?: PopupOptions): Popup;
  function latLng(lat: number, lng: number): LatLng;
  function latLngBounds(a: LatLngLike, b: LatLngLike): LatLngBounds;
  function divIcon(options?: DivIconOptions): Icon;
  const control: {
    scale(options?: { metric?: boolean; imperial?: boolean; position?: string; maxWidth?: number }): Control;
    attribution(options?: { prefix?: string | false; position?: string }): Control;
  };
}
