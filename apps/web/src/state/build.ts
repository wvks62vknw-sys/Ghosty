/**
 * Which version of Ghosty this interface is. The build fills in __GHOSTY_BUILD__ (build.mjs):
 * the commit Cloudflare built and when. Shown in the System tab, so you can tell whether the
 * newest shipped version is the one on your screen.
 */
declare const __GHOSTY_BUILD__: { sha: string; at: string } | undefined;

export const BUILD: { sha: string; at: string } = typeof __GHOSTY_BUILD__ !== 'undefined' ? __GHOSTY_BUILD__ : { sha: 'dev', at: '' };
