/**
 * The vetted picture library: free photographs chosen by eye for each kind of business, with the
 * credit their licence asks for (Wikimedia Commons, CC0 / CC BY / CC BY-SA; checked one by one). A site
 * starts from these, so it looks right even offline or when no search is possible; the website project
 * may swap in better matches it finds (Openverse, Wikimedia Commons, the owner's own Unsplash or Pexels
 * key) or pictures made with make_picture. Commons serves fixed thumbnail widths, which become srcset.
 */
import type { ImageRef } from './types';

/** Wikimedia Commons' standard thumbnail widths. */
export const COMMONS_WIDTHS = [500, 960, 1280, 1920];

/** A Commons file as a responsive picture: `path` is the upload path ("a/ab/File_name.jpg"). */
export function commons(path: string, w: number, h: number, alt: string, author: string, license: string, title: string, focus?: string): ImageRef {
  const file = path.split('/').pop()!;
  const f = encodeURIComponent(file);
  const dir = path.split('/').slice(0, 2).join('/');
  const widths = COMMONS_WIDTHS.filter((x) => x < w);
  const thumb = (x: number) => `https://upload.wikimedia.org/wikipedia/commons/thumb/${dir}/${f}/${x}px-${f}`;
  // The original only when it is not huge: a 6000-pixel photo is never worth sending to a phone.
  const srcset: [string, number][] = [...widths.map((x) => [thumb(x), x] as [string, number]), ...(w <= 2400 ? [[`https://upload.wikimedia.org/wikipedia/commons/${dir}/${f}`, w] as [string, number]] : [])];
  return {
    src: widths.includes(960) ? thumb(960) : widths.length ? thumb(widths[widths.length - 1]!) : `https://upload.wikimedia.org/wikipedia/commons/${dir}/${f}`,
    srcset,
    width: w,
    height: h,
    alt,
    ...(focus ? { focus } : {}),
    credit: { author, license, licenseUrl: LICENSE_URL[license], source: 'Wikimedia Commons', sourceUrl: `https://commons.wikimedia.org/wiki/File:${f}`, title: title || file.replace(/\.[a-z]+$/i, '').replace(/_/g, ' ') },
  };
}

export const LICENSE_URL: Record<string, string> = {
  CC0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  'Public domain': 'https://creativecommons.org/publicdomain/mark/1.0/',
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
  'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
};
