/**
 * Free pictures, credited: turning search results from Openverse (CC-licensed photos across Flickr,
 * Wikimedia and more), Wikimedia Commons, and — only with the owner's own free keys — Unsplash and Pexels
 * into responsive pictures with the credit their licence asks for. Pure: the brain does the fetching.
 * Only licences that allow use on a business site are kept (CC0, public domain, CC BY, CC BY-SA; never
 * NC or ND), and only pictures big enough to look sharp.
 */
import { COMMONS_WIDTHS, LICENSE_URL } from './stock';
import type { ImageRef, KindId } from './types';

/** Searches that find good pictures for each kind (Openverse and Commons both understand plain words). */
export const KIND_QUERIES: Record<KindId, string[]> = {
  barber: ['barbershop interior', 'barber cutting hair', 'barber chair'],
  salon: ['hair salon interior', 'hairdresser styling hair', 'nail salon manicure'],
  cafe: ['coffee shop interior', 'latte art', 'cafe breakfast'],
  restaurant: ['restaurant interior', 'plated food restaurant', 'chef cooking kitchen'],
  trades: ['plumber at work', 'tradesman tools', 'house renovation'],
  gym: ['gym weights', 'fitness training', 'kettlebell workout'],
  photographer: ['wedding couple photograph', 'portrait photography', 'landscape England'],
  shop: ['independent shop interior', 'gift shop shelves', 'florist shop'],
  clinic: ['dental clinic', 'physiotherapy treatment', 'clinic reception'],
  estate: ['terraced houses England', 'house exterior England', 'living room interior'],
  portfolio: ['design studio desk', 'creative workspace', 'sketchbook drawing'],
  event: ['concert crowd lights', 'festival stage', 'people dancing party'],
  charity: ['volunteers community', 'community garden volunteers', 'food bank volunteers'],
  saas: ['laptop on desk', 'team working office', 'person using laptop'],
};

const OK_LICENSE = /^(cc0|pdm|by|by-sa)$/i;

/** "CC BY-SA 4.0" from Openverse's ("by-sa", "4.0"). */
export function licenseName(l: string, v = ''): string {
  const k = l.toLowerCase();
  if (k === 'cc0') return 'CC0';
  if (k === 'pdm') return 'Public domain';
  return `CC ${k.toUpperCase()}${v ? ` ${v}` : ''}`;
}

/**
 * Flickr serves fixed sizes by a suffix (_w 400, _z 640, _c 800, _b 1024; _h 1600 and _k 2048 have their
 * own secret, so only the shared-secret sizes are derived): a Flickr picture becomes a srcset with no
 * third party involved.
 */
export function flickrSet(url: string): [string, number][] | undefined {
  const m = url.match(/^(https:\/\/live\.staticflickr\.com\/\d+\/\d+_[0-9a-f]+)(?:_[a-z])?\.jpg$/i);
  if (!m) return undefined;
  return [[`${m[1]}_w.jpg`, 400], [`${m[1]}_z.jpg`, 640], [`${m[1]}_c.jpg`, 800], [`${m[1]}_b.jpg`, 1024]];
}

/** A Wikimedia upload address as Commons' standard thumbnails. */
export function commonsSet(url: string, width: number): [string, number][] | undefined {
  const m = url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f]\/[0-9a-f]{2})\/([^/?#]+)/);
  if (!m) return undefined;
  const set: [string, number][] = COMMONS_WIDTHS.filter((w) => w < width).map((w) => [`https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${w}px-${m[2]}`, w]);
  return set.length ? set : undefined;
}

export interface OpenverseHit {
  id?: string;
  title?: string;
  url?: string;
  width?: number;
  height?: number;
  license?: string;
  license_version?: string;
  license_url?: string;
  creator?: string;
  foreign_landing_url?: string;
  source?: string;
  provider?: string;
  mature?: boolean;
}

const SOURCE_NAME: Record<string, string> = { flickr: 'Flickr', wikimedia: 'Wikimedia Commons', stocksnap: 'StockSnap', rawpixel: 'rawpixel', nappy: 'nappy', wordpress: 'WordPress Photo Directory' };

/** An Openverse result as a credited picture, or undefined when it is not usable (licence, size, address). */
export function fromOpenverse(h: OpenverseHit, alt: string): ImageRef | undefined {
  if (!h.url || !/^https:\/\//.test(h.url) || h.mature) return undefined;
  if (!OK_LICENSE.test(h.license ?? '')) return undefined;
  const w = h.width ?? 0;
  const ht = h.height ?? 0;
  if (w < 1200 || ht < 700) return undefined;
  const set = flickrSet(h.url) ?? commonsSet(h.url, w);
  const src = set ? set.find(([, x]) => x >= 800)?.[0] ?? set[set.length - 1]![0] : h.url;
  const license = licenseName(h.license!, h.license_version);
  return {
    src,
    ...(set ? { srcset: set } : {}),
    width: w,
    height: ht,
    alt,
    credit: { author: (h.creator ?? '').trim() || 'unknown', license, licenseUrl: h.license_url || LICENSE_URL[license], source: SOURCE_NAME[h.source ?? h.provider ?? ''] ?? (h.source ?? 'Openverse'), sourceUrl: h.foreign_landing_url && /^https:/.test(h.foreign_landing_url) ? h.foreign_landing_url : 'https://openverse.org/', title: (h.title ?? '').slice(0, 120) },
  };
}

/** A Commons API page (prop=imageinfo with extmetadata) as a credited picture. */
export function fromCommons(p: { title?: string; imageinfo?: { url?: string; width?: number; height?: number; mime?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }, alt: string): ImageRef | undefined {
  const ii = p.imageinfo?.[0];
  if (!ii?.url || ii.mime !== 'image/jpeg') return undefined;
  const md = ii.extmetadata ?? {};
  const lic = (md.LicenseShortName?.value ?? '').trim();
  if (!/^(CC0|Public domain|CC BY(-SA)? \d\.\d)$/i.test(lic)) return undefined;
  if ((ii.width ?? 0) < 1200 || (ii.height ?? 0) < 700) return undefined;
  const set = commonsSet(ii.url.split('?')[0]!, ii.width!);
  const author = (md.Artist?.value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'unknown';
  return {
    src: set?.find(([, x]) => x >= 960)?.[0] ?? ii.url.split('?')[0]!,
    ...(set ? { srcset: set } : {}),
    width: ii.width,
    height: ii.height,
    alt,
    credit: { author, license: lic, licenseUrl: md.LicenseUrl?.value || LICENSE_URL[lic], source: 'Wikimedia Commons', sourceUrl: ii.descriptionurl ?? 'https://commons.wikimedia.org/', title: (p.title ?? '').replace(/^File:/, '').replace(/\.[a-z]+$/i, '') },
  };
}

/** Unsplash (owner's free key): their hotlinked address with width steps, as Unsplash's guidelines ask, credited to the photographer. */
export function fromUnsplash(p: { urls?: { raw?: string }; width?: number; height?: number; alt_description?: string | null; user?: { name?: string; links?: { html?: string } }; links?: { html?: string } }, alt: string): ImageRef | undefined {
  const raw = p.urls?.raw;
  if (!raw || !/^https:\/\/images\.unsplash\.com\//.test(raw)) return undefined;
  const at = (w: number) => `${raw}${raw.includes('?') ? '&' : '?'}w=${w}&q=75&fm=jpg&fit=max`;
  return {
    src: at(1200),
    srcset: [480, 800, 1200, 1800].map((w) => [at(w), w] as [string, number]),
    width: p.width,
    height: p.height,
    alt: alt || p.alt_description || '',
    credit: { author: p.user?.name ?? 'Unsplash photographer', license: 'Unsplash Licence', licenseUrl: 'https://unsplash.com/license', source: 'Unsplash', sourceUrl: p.links?.html ?? 'https://unsplash.com/' },
  };
}

/** Pexels (owner's free key): sized copies from the API, credited as Pexels asks. */
export function fromPexels(p: { width?: number; height?: number; url?: string; alt?: string; photographer?: string; src?: Record<string, string> }, alt: string): ImageRef | undefined {
  const s = p.src ?? {};
  if (!s.large2x || !/^https:\/\/images\.pexels\.com\//.test(s.large2x)) return undefined;
  const set: [string, number][] = [[s.medium ?? '', 350], [s.large ?? '', 940], [s.large2x, 1880]].filter(([u]) => /^https:/.test(u as string)) as [string, number][];
  return {
    src: s.large ?? s.large2x,
    srcset: set,
    width: p.width,
    height: p.height,
    alt: alt || p.alt || '',
    credit: { author: p.photographer ?? 'Pexels photographer', license: 'Pexels Licence', licenseUrl: 'https://www.pexels.com/license/', source: 'Pexels', sourceUrl: p.url ?? 'https://www.pexels.com/' },
  };
}

/** Is every picture credited (or the owner's own, or made by Ghosty)? The pictures that are not, by address. */
export function uncredited(images: ImageRef[], ownHosts: string[] = []): string[] {
  return images.filter((i) => !i.credit && !i.generated && !ownHosts.some((h) => i.src.startsWith(h)) && !i.src.startsWith('data:')).map((i) => i.src);
}
