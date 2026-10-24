/**
 * Pl@ntNet (my.plantnet.org): a plant named from a photo. Free with a key (500 identifications a
 * day, key `plantnet` in SYSTEM → KEYS). The Lens's photo reaches it once, as the request's only
 * image (POST /v2/identify/all, multipart, organs "auto"); nothing is kept here, and Pl@ntNet's own
 * terms say it keeps the query's date and image link, not the image. The reply is read by
 * `parsePlantNet` (packages/shared/src/living.ts): best match, score, family, next names.
 */
import { parsePlantNet, type Living } from '../../../../packages/shared/src/living';

export const PLANTNET_URL = 'https://my-api.plantnet.org/v2/identify/all';

/** What the owner reads when Pl@ntNet says no (the key, the day's 500, a photo it could not use). */
export class PlantNetError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

/**
 * Name the plant in one photo (JPEG/PNG bytes). 404 is Pl@ntNet's "species not found": a
 * "can't tell", not an error. A bad key, the day's allowance and other failures are said plainly.
 */
export async function identifyPlant(bytes: ArrayBuffer, type: string, key: string, deps: { fetch?: typeof fetch } = {}): Promise<Living & { remaining?: number }> {
  const f = deps.fetch ?? fetch;
  const form = new FormData();
  form.append('organs', 'auto');
  form.append('images', new Blob([bytes], { type }), type === 'image/png' ? 'plant.png' : 'plant.jpg');
  const url = `${PLANTNET_URL}?${new URLSearchParams({ 'api-key': key, lang: 'en', 'nb-results': '3', 'include-related-images': 'false' })}`;
  let r: Response;
  try {
    r = await f(url, { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    throw new PlantNetError(`could not reach Pl@ntNet (${String((e as Error)?.message ?? e).slice(0, 80)})`, 503);
  }
  if (r.status === 404) return parsePlantNet({ results: [] });
  if (r.status === 401 || r.status === 403) throw new PlantNetError('Pl@ntNet says the key is not valid: copy it again from my.plantnet.org (SYSTEM → KEYS → Pl@ntNet)', 401);
  if (r.status === 429) throw new PlantNetError("Pl@ntNet's free 500 a day are used up: more tomorrow", 429);
  if (r.status === 413 || r.status === 400) throw new PlantNetError('Pl@ntNet could not use that photo: try one closer, in focus, with one plant filling it', 400);
  if (!r.ok) throw new PlantNetError(`Pl@ntNet answered ${r.status}: try again in a minute`, 502);
  return parsePlantNet(await r.json().catch(() => null));
}
