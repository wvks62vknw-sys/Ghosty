/**
 * What is at a spot: the address from OpenStreetMap's Nominatim, through the brain's caching
 * proxy (free, no key). Shared by the flat map, the 3D map and the pin on God's Eye.
 */
import { fetchJson } from '../api/feed';

export interface Reverse {
  name?: string;
  display_name?: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
}

export function reverseAddress(lat: number, lon: number): Promise<Reverse> {
  return fetchJson<Reverse>(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=en&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`, 3600);
}

/** "Big Ben (attraction)", "residential", or nothing. */
export const whatIs = (r: Reverse): string => (r.name && r.type ? `${r.name} (${r.type.replace(/_/g, ' ')})` : r.type ? r.type.replace(/_/g, ' ') : '');
/** A short name for the spot: the place's own name, else the first two parts of the address. */
export const shortName = (r: Reverse): string | undefined => r.name || r.display_name?.split(',').slice(0, 2).join(',') || undefined;
