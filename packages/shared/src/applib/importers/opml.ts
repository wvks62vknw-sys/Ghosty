/** A podcast or feed reader's subscriptions (OPML): each show or feed, its feed address and its folder. */
import { Sax } from './xml';
import type { Rec } from './input';

export function feedRecords(text: string): Rec[] {
  const out: Rec[] = [];
  const stack: (string | null)[] = [];
  const sax = new Sax({
    open(name, a, self) {
      if (name !== 'outline') return;
      const title = (a.title || a.text || '').trim();
      const feed = a.xmlUrl || a.xmlurl || '';
      if (feed && /^https?:\/\//i.test(feed)) {
        const r: Rec = { _key: feed, title: title || feed, feed };
        if (a.htmlUrl && /^https?:\/\//i.test(a.htmlUrl)) r.site = a.htmlUrl;
        const folder = stack.filter(Boolean).slice(-1)[0];
        if (folder) r.folder = folder;
        out.push(r);
      }
      if (!self) stack.push(feed ? null : title);
    },
    close(name) { if (name === 'outline') stack.pop(); },
  });
  sax.push(text);
  sax.end();
  return out;
}
