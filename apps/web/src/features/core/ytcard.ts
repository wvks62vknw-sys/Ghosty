/**
 * A YouTube summary in the chat log (the brain's summarise_video, apps/edge/src/integrations/youtube.ts):
 * a video card — the thumbnail (i.ytimg.com through the brain's proxy), the title, the channel and the
 * length — above the summary, then the MOMENTS, each a link that opens the video at that second. Drawn
 * from the reply's own words: the "▶ title · channel · 18:32" line and the "[12:40] label — link" lines
 * the brain asks for; a reply with neither is drawn as before. Route C's reply-card classes, no new colours.
 */
import { fetchImage } from '../../api/feed';
import { h } from '../../core/dom';

export interface Moment {
  /** Seconds into the video, from the link's own t= (the link is what opens it). */
  sec: number;
  label: string;
  url: string;
}

export interface VideoReply {
  id: string;
  title: string;
  author: string;
  /** "18:32", or '' when the reply does not say. */
  length: string;
  moments: Moment[];
  /** The reply without the ▶ line, the video's own address and the moment lines (they are on the card). */
  rest: string;
}

const LINK = /https?:\/\/(?:(?:www\.|m\.)?youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})[^\s<>"')\]]*/;
const TIME = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/;

/** 75 → "1:15", 3725 → "1:02:05". */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(hh ? 2 : 1, '0');
  return `${hh ? `${hh}:` : ''}${mm}:${String(s % 60).padStart(2, '0')}`;
}

/** The second a link opens at: t=760, t=760s, t=12m40s, t=1h2m5s; null when it has none. */
function tOf(url: string): number | null {
  const t = url.match(/[?&#]t=([\dhms]+)/)?.[1];
  if (!t) return null;
  if (/^\d+s?$/.test(t)) return parseInt(t, 10);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m && (m[1] || m[2] || m[3]) ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : null;
}

/** The video a reply is about, its card line and its moments; null for any other reply. Pure (no DOM). */
export function videoOf(text: string): VideoReply | null {
  const lines = String(text ?? '').split('\n');
  let id = '';
  let title = '';
  let author = '';
  let length = '';
  const moments: Moment[] = [];
  const rest: string[] = [];
  for (const line of lines) {
    const plain = line.replace(/\*\*|__/g, '').trim();
    if (/^▶/.test(plain)) {
      const parts = plain.replace(/^▶\s*/, '').split(' · ').map((p) => p.trim()).filter(Boolean);
      if (parts.length && TIME.test(parts[parts.length - 1]!.replace(/^about /, ''))) length = parts.pop()!;
      title = parts.shift() ?? '';
      author = parts.join(' · ');
      continue;
    }
    const link = plain.match(LINK);
    const sec = link ? tOf(link[0]) : null;
    if (link && sec !== null && (!id || id === link[1])) {
      id = link[1]!;
      const label = plain
        .replace(link[0], ' ')
        .replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '')
        .replace(/\[?\(?\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b\)?\]?/, ' ')
        .replace(/\[\s*\]|\(\s*\)|[[\]()]/g, ' ')
        .replace(/\s*[—–:-]\s*$/, '')
        .replace(/^\s*[—–:-]\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
      moments.push({ sec, label: label || `at ${clock(sec)}`, url: link[0] });
      continue;
    }
    // the video's own address on a line of its own is the card's link
    if (link && plain === link[0] && (!id || id === link[1])) {
      id = link[1]!;
      continue;
    }
    // "Moments:" over the list: the card has its own heading
    if (/^moments\b[^.!?]*:$/i.test(plain)) continue;
    rest.push(line);
  }
  if (!id || (!moments.length && !title)) return null;
  return { id, title, author, length, moments, rest: rest.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
}

/** Thumbnails fetched once per video (the log is redrawn as replies stream in). */
const thumbs = new Map<string, Promise<string | null>>();
function thumb(id: string): Promise<string | null> {
  let p = thumbs.get(id);
  if (!p) {
    p = fetchImage(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`, 86_400).catch(() => null);
    thumbs.set(id, p);
  }
  return p;
}

/** The card: thumbnail, title, channel and length, linking to the video. */
function card(v: VideoReply): HTMLElement {
  const href = `https://www.youtube.com/watch?v=${v.id}`;
  const pic = h('a.piccard.ytthumb', { href, target: '_blank', rel: 'noopener noreferrer', hidden: true });
  void thumb(v.id).then((src) => {
    if (!src) return pic.remove();
    pic.append(h('img', { src, alt: `${v.title || 'YouTube video'} — thumbnail`, loading: 'lazy' }));
    pic.hidden = false;
  });
  const what = ['YOUTUBE', v.length].filter(Boolean).join(' · ');
  return h('div.ytcard', pic, h('a.sitelink.ytlink', { href, target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'none' } }, h('small', what), h('b', v.title || 'YouTube video'), h('span', v.author || `youtu.be/${v.id}`)));
}

/** The MOMENTS: each opens the video at its second. */
function momentList(v: VideoReply): HTMLElement {
  return h('div.citesrc.ytmoments', h('small', 'MOMENTS'), ...v.moments.map((m) => h('a.csrc.ytmoment', { href: m.url, target: '_blank', rel: 'noopener noreferrer', dataset: { t: String(m.sec) } }, h('b', '▶'), h('span', m.label), h('em', clock(m.sec)))));
}

/**
 * A reply's body: for a YouTube summary the card, the words, then the moments; for anything else
 * just the words (`linked` makes web links in them tappable), so the chat renderer can always call it.
 */
export function videoBody(text: string, linked: (t: string) => HTMLElement): HTMLElement[] {
  const v = videoOf(text);
  if (!v) return [linked(text)];
  return [card(v), linked(v.rest), ...(v.moments.length ? [momentList(v)] : [])];
}
