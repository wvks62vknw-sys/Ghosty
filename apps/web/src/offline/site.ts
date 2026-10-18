/**
 * "Build me a website" with no connection to the brain: the phone asks the few questions that matter
 * (name, town, a phone number, hours, prices — skipped when the request already says), then assembles
 * the site from the website kit's blocks and templates in the worker (offline/sitework.ts). The finished
 * page is kept on this phone (localStorage `ghosty.offlineSites`, the last three) to PREVIEW, SAVE as a
 * file, or PUBLISH when the brain is back (which sends the request with the answers to build_website).
 */
import { briefFrom, mergeAnswers, missing, siteAsk } from '../../../../packages/shared/src/sitekit/brief';
import type { Brief } from '../../../../packages/shared/src/sitekit/types';
import type { SiteOut } from './sitework';

const PENDING = 'ghosty.offlineSite';
const SAVED = 'ghosty.offlineSites';
const KEEP = 3;

export interface SavedSite {
  key: string;
  title: string;
  html: string;
  brief: Brief;
  at: number;
}
interface Pending {
  brief: Brief;
  asked: (keyof Brief)[];
  at: number;
}

const read = <T>(k: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null') as T | null;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full or blocked: the site still shows this session */
  }
};

/** Questions asked less than a day ago and not yet answered. */
export function pendingSite(): Pending | null {
  const p = read<Pending>(PENDING);
  return p && Date.now() - p.at < 86_400_000 ? p : null;
}
export const cancelPendingSite = () => write(PENDING, null);
export const savedSite = (key: string): SavedSite | null => (read<SavedSite[]>(SAVED) ?? []).find((s) => s.key === key) ?? null;

/** Is this turn for the offline website builder: a website request, or the answers it is waiting for? */
export const offlineSiteTurn = (text: string): boolean => siteAsk(text) || (!!pendingSite() && !/^(stop|cancel|never ?mind|forget it)$/i.test(text.trim()));

/** Questions worth asking before building (the rest gets sensible defaults, listed to confirm). */
const ASK: (keyof Brief)[] = ['name', 'town', 'phone', 'hours', 'services'];

function build(brief: Brief): Promise<SiteOut> {
  return new Promise((resolve) => {
    const w = new Worker('/textures.worker.js');
    const done = (r: SiteOut) => {
      w.terminate();
      resolve(r);
    };
    w.onmessage = (e: MessageEvent) => {
      const r = e.data as SiteOut;
      if (r && r.site === 'built') done(r);
    };
    w.onerror = (e) => {
      e.preventDefault();
      done({ site: 'built', req: 0, error: e.message || 'the builder stopped' });
    };
    w.postMessage({ site: 'build', req: 1, brief });
  });
}

/**
 * One turn of the offline builder: the questions, or the finished site. `site` is set when a site was
 * built (its key in this phone's storage).
 */
export async function offlineSiteReply(text: string): Promise<{ text: string; site?: { key: string; title: string; pages: string[]; score: number } }> {
  const pending = pendingSite();
  let brief: Brief;
  if (pending && !siteAsk(text)) {
    brief = mergeAnswers(pending.brief, text, pending.asked);
    write(PENDING, null);
  } else {
    brief = briefFrom(text);
    const gaps = missing(brief).filter((m) => ASK.includes(m.key));
    if (gaps.length && !/\b(just build|go ahead|use defaults|don'?t ask)\b/i.test(text)) {
      write(PENDING, { brief, asked: [...gaps.map((g) => g.key), 'about'], at: Date.now() } satisfies Pending);
      return { text: `I can build it right here on your phone, even with no connection. A few quick answers first (all in one message is fine, or say "just build it"):\n${gaps.map((g, i) => `${i + 1}. ${g.ask}`).join('\n')}\n${gaps.length + 1}. Anything that makes it special?` };
    }
  }
  const r = await build(brief);
  if (r.error || !r.html) return { text: `I couldn't build the site on the phone: ${r.error ?? 'nothing came back'}.` };
  const key = `s${Date.now().toString(36)}`;
  const saved: SavedSite = { key, title: r.title ?? brief.name, html: r.html, brief, at: Date.now() };
  write(SAVED, [saved, ...(read<SavedSite[]>(SAVED) ?? [])].slice(0, KEEP));
  const confirm = r.confirm?.length ? ` Please check: ${r.confirm.join('; ')}.` : '';
  return {
    text: `Built "${saved.title}" on your phone from my templates — ${r.pages?.length ?? 0} pages (${(r.pages ?? []).join(', ')}), quality checks ${r.score}/100. No AI model was used, so the words are my standard ones for a ${brief.kind}, filled with your answers.${confirm} PREVIEW it here, SAVE it as a file, or PUBLISH it when I'm back online (I'll polish it with a model then).`,
    site: { key, title: saved.title, pages: r.pages ?? [], score: r.score ?? 0 },
  };
}

/** The request the brain gets when the owner taps PUBLISH: the original words and every answer. */
export function publishRequest(s: SavedSite): string {
  const b = s.brief;
  const facts = [b.name && `name ${b.name}`, b.town && `in ${b.town}`, b.phone && `phone ${b.phone}`, b.email && `email ${b.email}`, b.hours?.length && `hours ${b.hours.map((h) => `${h.label} ${h.closed ? 'closed' : `${h.open}-${h.close}`}`).join(', ')}`, b.services?.length && `prices ${b.services.map((x) => `${x.name} ${x.price ?? ''}`.trim()).join(', ')}`, b.about && `about: ${b.about}`].filter(Boolean);
  return `Build a website: ${b.request}${facts.length ? ` — ${facts.join('; ')}` : ''}`;
}
