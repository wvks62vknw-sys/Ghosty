/**
 * Spline scenes in the 3D STUDIO. Spline has no API for making models; what the owner can do is
 * paste the Public URL of a scene they made or remixed in Spline (Export → Public URL), and the
 * studio embeds it in a frame with "Powered by Spline" under it. Only Spline's own public-scene
 * host is accepted (the app's security policy lets frames load from https://my.spline.design and
 * nowhere new), and only a plain scene address — no other host, port, sign-in or extra path.
 */
export const SPLINE_HOST = 'my.spline.design';

export type SplineCheck = { ok: true; url: string } | { ok: false; why: string };

/** The embeddable address for what the owner pasted (a link, or Spline's whole iframe code), or why not. */
export function splineEmbedUrl(input: string): SplineCheck {
  let text = String(input ?? '').trim();
  // The embed code Spline offers is an <iframe src="…">: take the address out of it.
  const src = text.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  if (src) text = src[1]!.trim();
  if (!text) return { ok: false, why: 'paste the Public URL of a Spline scene (in Spline: Export → Public URL → copy)' };
  if (/^my\.spline\.design\//i.test(text)) text = `https://${text}`;
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, why: 'that is not a web address — paste the Public URL from Spline (Export → Public URL)' };
  }
  const host = u.hostname.toLowerCase();
  if (host === 'app.spline.design') return { ok: false, why: "that is the Spline editor's link; in Spline press Export → Public URL and paste that link (it starts https://my.spline.design/)" };
  if (host === 'prod.spline.design') return { ok: false, why: 'that is a Spline code export; paste the Public URL instead (Export → Public URL, it starts https://my.spline.design/)' };
  if (host !== SPLINE_HOST) return { ok: false, why: 'only Spline public scenes can be shown here (links starting https://my.spline.design/)' };
  if (u.protocol !== 'https:') return { ok: false, why: 'the link must start with https://' };
  if (u.username || u.password || u.port) return { ok: false, why: 'that Spline link has extra parts it should not have; copy the Public URL again' };
  const m = u.pathname.match(/^\/([A-Za-z0-9][A-Za-z0-9_-]{0,127})\/?$/);
  if (!m) return { ok: false, why: 'that is not a Spline scene address (it should look like https://my.spline.design/your-scene-1a2b3c/)' };
  return { ok: true, url: `https://${SPLINE_HOST}/${m[1]}/` };
}
