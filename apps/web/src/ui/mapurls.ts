/**
 * Where a spot on the map is, and the addresses of Google's and Waze's pages for it — shared by
 * the map sheet (ui/mapsheet.ts), the immersive Street View (ui/streetview.ts) and the maps.
 */
export interface MapSpot {
  lat: number;
  lon: number;
  name?: string;
  /** Compass heading to face in Street View (degrees). */
  heading?: number;
  /** Up/down in Street View (degrees, positive looks up). */
  pitch?: number;
}

const f = (n: number) => Number(n.toFixed(6));
/** Google Street View at a spot: Google snaps to the nearest panorama (and says when there is none). */
export const streetViewUrl = (s: MapSpot): string => `https://www.google.com/maps/embed?origin=mfe&pb=!6m7!1m6!2m2!1d${f(s.lat)}!2d${f(s.lon)}!3f${Math.round(((s.heading ?? 0) % 360 + 360) % 360)}!4f${-Math.round(s.pitch ?? 0)}!5f1`;
export const satelliteUrl = (s: MapSpot, zoom = 17): string => `https://www.google.com/maps/embed?origin=mfe&pb=!1m4!2m1!1s${f(s.lat)},${f(s.lon)}!5e1!6i${zoom}`;
export const wazeUrl = (s: MapSpot, zoom = 14): string => `https://embed.waze.com/iframe?zoom=${zoom}&lat=${f(s.lat)}&lon=${f(s.lon)}&ct=livemap&pin=1`;
