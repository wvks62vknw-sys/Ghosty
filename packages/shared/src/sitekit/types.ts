/**
 * The website kit's shapes, shared by the brain (the website project, sitebuild.ts) and the phone (the
 * offline builder): what the owner told us (Brief), the design picked for it (Theme), the plan of pages
 * and sections (Plan), and the block contract every section is drawn by (BlockDef). Pure, no DOM.
 */

/** The kinds of business the templates cover. */
export type KindId = 'cafe' | 'restaurant' | 'barber' | 'salon' | 'trades' | 'gym' | 'photographer' | 'shop' | 'clinic' | 'estate' | 'portfolio' | 'event' | 'charity' | 'saas';

export interface Service {
  name: string;
  price?: string;
  duration?: string;
  description?: string;
  group?: string;
}
/** A real review the owner passed on. Never invented: blocks that need reviews are left out without them. */
export interface Review {
  quote: string;
  name: string;
  detail?: string;
  rating?: number;
}
export interface Person {
  name: string;
  role: string;
  bio?: string;
  photo?: ImageRef;
}
export interface Hours {
  /** "Mon", "Mon–Fri", "Sunday"… as written; `days` (0 = Sunday) when it could be read. */
  label: string;
  open?: string;
  close?: string;
  closed?: boolean;
  days?: number[];
}

/** Everything known about the business: the owner's words and answers. Missing facts are listed, never made up. */
export interface Brief {
  request: string;
  kind: KindId;
  name: string;
  tagline?: string;
  town?: string;
  address?: string;
  postcode?: string;
  lat?: number;
  lon?: number;
  phone?: string;
  email?: string;
  whatsapp?: string;
  hours?: Hours[];
  services?: Service[];
  about?: string;
  reviews?: Review[];
  team?: Person[];
  socials?: Partial<Record<'instagram' | 'facebook' | 'tiktok' | 'x' | 'linkedin' | 'youtube', string>>;
  established?: number;
  /** A booking or donation or shop page somewhere else (Fresha, Booksy, JustGiving, Etsy…). */
  bookingUrl?: string;
  donateUrl?: string;
  shopUrl?: string;
  /** Free words: anything else the owner said (specialities, awards they named, the feel they want). */
  extras?: string;
  /** For an event: when and where. */
  date?: string;
  venue?: string;
  /** Work to show (a portfolio, a trade's jobs, a product's customers): only what the owner named. */
  projects?: { title: string; summary?: string; result?: string; tag?: string; image?: ImageRef }[];
  /** An estate agent's live listings, as the owner gave them. */
  listings?: { title: string; price: string; status?: string; beds?: number; baths?: number; area?: string; image?: ImageRef }[];
  /** An event's running order. */
  schedule?: { time: string; title: string; detail?: string }[];
  /** Products for a small shop (name, price, a line). */
  products?: { name: string; price?: string; description?: string; badge?: string; image?: ImageRef }[];
  /** Accreditations and memberships the owner named (Gas Safe, NICEIC, GDC…): never assumed. */
  accreditations?: string[];
  /** Towns or areas covered (trades). */
  areas?: string[];
}

/** A picture on the page, with what the law and good manners need to show it. */
export interface ImageRef {
  src: string;
  /** Wider and narrower copies for srcset: [url, width] pairs (worked out for Wikimedia Commons and Flickr). */
  srcset?: [string, number][];
  width?: number;
  height?: number;
  alt: string;
  /** Credit line pieces: who made it, under what licence, where it came from. Empty for the owner's own or Ghosty-made pictures. */
  credit?: { author: string; license: string; licenseUrl?: string; source: string; sourceUrl: string; title?: string };
  /** Made by make_picture (flux), not a photograph. */
  generated?: boolean;
  /** Focus point for object-position, e.g. "50% 30%". */
  focus?: string;
}

export type PaletteId = 'espresso' | 'barber' | 'trades' | 'gym' | 'clinic' | 'estate' | 'mono' | 'charity' | 'saas' | 'sage' | 'neon' | 'blush';
export type FontsId = 'editorial' | 'classic' | 'condensed' | 'refined' | 'tech' | 'friendly' | 'luxe' | 'geometric' | 'system';
export type ShapeId = 'sharp' | 'soft' | 'round';
/** light / dark: always that; auto: the visitor's phone decides (light first). */
export type Scheme = 'light' | 'dark' | 'auto';

export interface Theme {
  palette: PaletteId;
  fonts: FontsId;
  shape: ShapeId;
  scheme: Scheme;
}

/** Section background: the page's own, the alternate surface, or inverted (brand colour or deep). */
export type Tone = 'base' | 'alt' | 'inverse';

export interface Section {
  block: string;
  tone?: Tone;
  /** The block's content slots (see BlockDef.slots). */
  data: Record<string, unknown>;
}
export interface Page {
  /** '' is the home page; others are short words: about, services, menu, contact… */
  slug: string;
  /** The navigation label. */
  label: string;
  /** The <title> part and the meta description for this page. */
  title: string;
  description: string;
  sections: Section[];
  /** false: reachable by link (a blog post, the privacy note) but not in the navigation. */
  nav?: boolean;
}
export interface Plan {
  kind: KindId;
  name: string;
  theme: Theme;
  /** Two or three words for the voice: "warm, local, unfussy". */
  tone: string;
  /** Site-wide sections above every page (announcement bar, navigation) and below it (footer). */
  header: Section[];
  footer: Section[];
  pages: Page[];
  /** The live address when known (canonical, Open Graph). */
  url?: string;
  /** Facts that were filled with sensible defaults and should be confirmed with the owner. */
  confirm: string[];
}

/** A content slot's type, for the writers (model and phone) and for checking what they wrote. */
export type Slot =
  | { t: 'text'; max: number; optional?: boolean; hint?: string }
  | { t: 'image'; optional?: boolean; hint?: string }
  | { t: 'link'; optional?: boolean; hint?: string }
  | { t: 'list'; of: Record<string, Slot>; min?: number; max: number; optional?: boolean; hint?: string }
  | { t: 'texts'; max: number; each: number; optional?: boolean; hint?: string }
  | { t: 'number'; optional?: boolean; hint?: string }
  | { t: 'bool'; optional?: boolean; hint?: string };

export interface Link {
  label: string;
  href: string;
}

/** What a block can see while drawing: the business, the theme, the pages and the shared helpers. */
export interface RenderCtx {
  brief: Brief;
  plan: Plan;
  page: Page;
  /** The section's place on its page (0 = first). */
  index: number;
  tone: Tone;
  /** Every credited picture on the site, for the footer's credits. */
  credits: ImageRef[];
}

export interface BlockDef {
  id: string;
  group: 'nav' | 'hero' | 'content' | 'proof' | 'commerce' | 'media' | 'form' | 'cta' | 'footer' | 'blog';
  /** One line for the planner: what it is and when it fits. */
  about: string;
  slots: Record<string, Slot>;
  /** Scoped CSS, emitted once when the block is on any page. */
  css: string;
  /** The behaviours it needs (assemble.ts BEHAVIOURS). */
  js?: string[];
  /** Blocks that only make sense with the owner's real facts (reviews, team…): left out without them. */
  needs?: (keyof Brief)[];
  render(d: Record<string, unknown>, x: RenderCtx): string;
}
