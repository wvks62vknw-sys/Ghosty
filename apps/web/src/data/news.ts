/** Headlines from BBC News RSS. */
import { Feed, fetchText } from '../api/feed';

export interface Headline {
  title: string;
  desc: string;
  url: string;
  at: number;
}

export const NEWS_FEEDS: Record<string, [string, string]> = {
  top: ['TOP', 'https://feeds.bbci.co.uk/news/rss.xml'],
  world: ['WORLD', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
  tech: ['TECH', 'https://feeds.bbci.co.uk/news/technology/rss.xml'],
  science: ['SCIENCE', 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml'],
  business: ['BUSINESS', 'https://feeds.bbci.co.uk/news/business/rss.xml'],
};

let current = 'top';

export function parseRss(xml: string): Headline[] {
  const d = new DOMParser().parseFromString(xml, 'text/xml');
  return [...d.querySelectorAll('item')].slice(0, 30).map((i) => ({
    title: i.querySelector('title')?.textContent?.trim() ?? '',
    desc: (i.querySelector('description')?.textContent ?? '').replace(/<[^>]+>/g, '').trim(),
    url: i.querySelector('link')?.textContent?.trim() ?? '',
    at: Date.parse(i.querySelector('pubDate')?.textContent ?? '') || 0,
  })).filter((x) => x.title);
}

export const news = new Feed<Headline[]>(
  'news',
  async () => {
    const items = parseRss(await fetchText(NEWS_FEEDS[current]![1], 300));
    if (!items.length) throw new Error('empty feed');
    return items;
  },
  300_000,
);

export function setNewsFeed(id: string): void {
  if (!NEWS_FEEDS[id]) return;
  current = id;
  void news.refresh(true);
}

export const currentNewsFeed = () => current;
