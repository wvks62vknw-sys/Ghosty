/**
 * The templates: for each kind of business, a designed look (palette, fonts, shape) and a sensible set
 * of pages built from the blocks, with copy written for that trade — short, specific, British English,
 * none of the usual web filler — filled from the brief. This is the whole site when no model is free
 * (or on the phone, offline); with a model, the planner and the writer start from it and improve it.
 *
 * Honesty rules: reviews, team, accreditations, listings, projects and products appear only when the
 * owner gave them. Prices, hours and FAQ answers the owner did not give are filled with typical ones
 * and listed in plan.confirm for the owner to check.
 */
import { addressLine, route, telHref } from './html';
import { stockFor, type StockSet } from './stock-data';
import type { Brief, Hours, ImageRef, KindId, Page, Plan, Section, Service, Theme, Tone } from './types';

// ── small helpers ───────────────────────────────────────────────────────────────────

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) >>> 0;
/** The same choice every time for the same business, a different one for the next. */
const pick = <T>(b: Brief, list: T[], salt = ''): T => list[hash(`${b.name}|${b.kind}|${salt}`) % list.length]!;
const inTown = (b: Brief) => (b.town ? ` in ${b.town}` : '');
const S = (block: string, data: Record<string, unknown>, tone?: Tone): Section => ({ block, data, ...(tone ? { tone } : {}) });

const DAYS7 = (open: string, close: string, sat?: [string, string] | null, sun?: [string, string] | null): Hours[] => [
  { label: 'Mon–Fri', open, close, days: [1, 2, 3, 4, 5] },
  sat ? { label: 'Saturday', open: sat[0], close: sat[1], days: [6] } : { label: 'Saturday', closed: true, days: [6] },
  sun ? { label: 'Sunday', open: sun[0], close: sun[1], days: [0] } : { label: 'Sunday', closed: true, days: [0] },
];

/** Services grouped for a price list. */
function priceGroups(services: Service[], fallback = 'Prices'): Record<string, unknown>[] {
  const groups = new Map<string, Service[]>();
  for (const s of services) groups.set(s.group || fallback, [...(groups.get(s.group || fallback) ?? []), s]);
  return [...groups].map(([name, items]) => ({ name: groups.size > 1 ? name : '', items: items.map((s) => ({ name: s.name, price: s.price ?? 'Ask', note: s.description ?? '', time: s.duration ?? '' })) }));
}

function reviewsBlock(b: Brief, title = 'What people say', tone?: Tone): Section[] {
  if (!b.reviews?.length) return [];
  if (b.reviews.length === 1) {
    const r = b.reviews[0]!;
    return [S('testimonial-feature', { quote: r.quote, name: r.name, detail: r.detail ?? '', rating: r.rating ?? 5 }, tone)];
  }
  return [S('testimonials-grid', { eyebrow: 'Reviews', title, items: b.reviews.slice(0, 6).map((r) => ({ quote: r.quote, name: r.name, detail: r.detail ?? '', rating: r.rating ?? 5 })) }, tone)];
}
const teamBlock = (b: Brief, title: string, tone?: Tone): Section[] => (b.team?.length ? [S('team', { eyebrow: 'The team', title, people: b.team.map((p) => ({ name: p.name, role: p.role, bio: p.bio ?? '', ...(p.photo ? { photo: p.photo } : {}) })) }, tone)] : []);
const statsBlock = (b: Brief, extra: { value: string; label: string }[] = []): Section[] => {
  const items = [...(b.established ? [{ value: String(new Date().getFullYear() - b.established), label: `years${inTown(b) ? inTown(b) : ' in business'}` }] : []), ...(b.reviews?.length ? [{ value: `${(b.reviews.reduce((n, r) => n + (r.rating ?? 5), 0) / b.reviews.length).toFixed(1)}★`, label: 'average from the reviews here' }] : []), ...extra];
  return items.length >= 2 ? [S('stats', { items })] : [];
};
const logosBlock = (b: Brief, title: string): Section[] => (b.accreditations?.length ? [S('logos', { title, items: b.accreditations })] : []);
const galleryOf = (s: StockSet | undefined, n: number, from = 0) => (s ? s.gallery.slice(from, from + n).map((image) => ({ image })) : []);

function contactPage(b: Brief, s: StockSet | undefined, o: { slug?: string; label?: string; title: string; lead: string; kind?: 'contact' | 'quote'; formTitle?: string }): Page {
  return {
    slug: o.slug ?? 'contact',
    label: o.label ?? 'Contact',
    title: o.label ?? 'Contact',
    description: `${o.lead} ${addressLine(b)}`.trim().slice(0, 158),
    sections: [
      S('page-header', { eyebrow: o.label ?? 'Contact', title: o.title, lead: o.lead }, 'alt'),
      S('contact-form', { kind: o.kind ?? 'contact', title: 'The quickest ways to reach us', lead: b.phone ? `Ring, message or fill in the form — we reply the same day where we can.` : 'Send a message and we will get back to you.', formTitle: o.formTitle ?? '' }),
      ...(b.kind === 'saas' || b.kind === 'portfolio' ? [] : [S('map', { eyebrow: 'Find us', title: b.town ? `In ${b.town}` : 'Where we are', note: '' }, 'alt')]),
    ],
  };
}
function aboutPage(b: Brief, s: StockSet | undefined, o: { title: string; lead: string; intro: string; body: string; signoff?: string; teamTitle?: string; label?: string }): Page {
  return {
    slug: 'about',
    label: o.label ?? 'About',
    title: o.label ?? 'About',
    description: o.lead.slice(0, 158),
    sections: [
      S('page-header', { eyebrow: o.label ?? 'About', title: o.title, lead: o.lead }, 'alt'),
      S('about-story', { eyebrow: 'Our story', intro: o.intro, body: b.about ? `${b.about}\n\n${o.body}` : o.body, image: s?.story[1] ?? s?.story[0], signoff: o.signoff ?? '' }),
      ...statsBlock(b),
      ...teamBlock(b, o.teamTitle ?? 'The people you will meet', 'alt'),
      ...reviewsBlock(b),
    ],
  };
}

const closing = (b: Brief, title: string, text: string): Section => S('cta-banner', { title, text });

// ── the kinds ───────────────────────────────────────────────────────────────────────

export interface KindTemplate {
  theme: Theme;
  nav: 'nav-classic' | 'nav-centered';
  tone: string;
  /** Typical facts for a business of this kind, used only when the owner gave none (and listed to confirm). */
  defaults: (b: Brief) => { services?: Service[]; hours?: Hours[] };
  announce?: (b: Brief) => string;
  pages: (b: Brief, s: StockSet | undefined) => Page[];
  /** What the footer says in one line. */
  blurb: (b: Brief) => string;
  /** The home page's title tag and description. */
  meta: (b: Brief) => { title: string; description: string };
}

/** A trade from the words: the services and the look differ between a plumber and a roofer. */
export function tradeOf(b: Brief): 'plumber' | 'electrician' | 'builder' | 'roofer' | 'decorator' | 'gardener' | 'cleaner' | 'locksmith' | 'trade' {
  const t = `${b.request} ${b.name} ${b.extras ?? ''}`.toLowerCase();
  if (/plumb|heating|boiler|gas/.test(t)) return 'plumber';
  if (/electric/.test(t)) return 'electrician';
  if (/roof/.test(t)) return 'roofer';
  if (/decorat|paint|plaster/.test(t)) return 'decorator';
  if (/garden|landscap/.test(t)) return 'gardener';
  if (/clean/.test(t)) return 'cleaner';
  if (/locksmith/.test(t)) return 'locksmith';
  if (/build|construct|extension|joiner|carpent|kitchen fitter|bathroom fitter/.test(t)) return 'builder';
  return 'trade';
}
const TRADE: Record<ReturnType<typeof tradeOf>, { noun: string; services: [string, string, string][]; icon: string[] }> = {
  plumber: { noun: 'plumbing and heating', icon: ['flame', 'droplet', 'wrench', 'shield', 'home', 'clock'], services: [['Boiler installation', 'New combi and system boilers fitted, flushed and registered, with the manufacturer\'s warranty.', 'Free quote'], ['Boiler service & repair', 'Annual services, breakdowns and pressure problems, usually fixed on the first visit.', 'From £75'], ['Leaks & emergencies', 'Burst pipes, leaks and no hot water — we come out fast and make it safe first.', 'From £90'], ['Bathrooms', 'Full bathroom refits and shower installs, from first fix to the last bead of silicone.', 'Free quote'], ['Radiators & heating', 'New radiators, power flushing and smart thermostats for an even, cheaper warmth.', 'From £120'], ['Landlord gas safety', 'CP12 certificates for rental properties, booked around your tenants.', 'From £65']] },
  electrician: { noun: 'electrical work', icon: ['bolt', 'plug', 'shield', 'home', 'check', 'clock'], services: [['Rewires', 'Full and partial rewires with the least disruption to your home.', 'Free quote'], ['Consumer units', 'Fuse box upgrades to modern, safe consumer units.', 'From £450'], ['EICR certificates', 'Electrical installation condition reports for homeowners and landlords.', 'From £120'], ['Lighting', 'Downlights, outdoor lighting and new circuits, neatly done.', 'From £85'], ['EV chargers', 'Home car charger installs, registered with the DNO.', 'From £850'], ['Fault finding', 'Tripping switches and dead sockets traced and fixed.', 'From £70']] },
  builder: { noun: 'building work', icon: ['home', 'hammer', 'ruler', 'layers', 'shield', 'check'], services: [['Extensions', 'Single and double storey extensions, from drawings to handover.', 'Free quote'], ['Loft conversions', 'Dormer and Velux conversions that add a proper room.', 'Free quote'], ['Kitchens', 'Kitchen fitting, knock-throughs and the making good.', 'Free quote'], ['Bathrooms', 'Complete bathroom refits.', 'Free quote'], ['Brickwork & repairs', 'Walls, pointing, lintels and the jobs other builders turn down.', 'From £150'], ['Project management', 'One point of contact for every trade on the job.', 'Ask us']] },
  roofer: { noun: 'roofing', icon: ['home', 'shield', 'droplet', 'hammer', 'check', 'clock'], services: [['Roof repairs', 'Slipped tiles, leaks and storm damage sorted quickly.', 'From £150'], ['New roofs', 'Complete re-roofs in tile and slate.', 'Free quote'], ['Flat roofs', 'GRP and EPDM flat roofs with long guarantees.', 'Free quote'], ['Guttering & fascias', 'uPVC fascias, soffits and gutters replaced or cleaned.', 'From £95'], ['Chimneys', 'Repointing, flashing and removals.', 'Free quote'], ['Inspections', 'A proper look with photos of everything we find.', 'From £60']] },
  decorator: { noun: 'painting and decorating', icon: ['paint', 'home', 'sparkle', 'layers', 'check', 'clock'], services: [['Interior painting', 'Walls, ceilings and woodwork with crisp lines and no mess left behind.', 'Free quote'], ['Wallpapering', 'Feature walls and whole rooms, patterns matched properly.', 'Free quote'], ['Exterior painting', 'Render, masonry and windows, prepared to last.', 'Free quote'], ['Plastering', 'Skimming and patch repairs before we paint.', 'From £180'], ['Commercial', 'Shops and offices out of hours.', 'Ask us'], ['Colour advice', 'Help choosing colours that work in your light.', 'Free']] },
  gardener: { noun: 'garden work', icon: ['leaf', 'home', 'sparkle', 'calendar', 'check', 'clock'], services: [['Regular maintenance', 'Mowing, edging, weeding and pruning on a schedule that suits you.', 'From £30'], ['Garden clearance', 'Overgrown gardens cleared and the waste taken away.', 'Free quote'], ['Hedges & trees', 'Hedge cutting and small tree work.', 'From £60'], ['Patios & paths', 'New patios, pressure washing and sealing.', 'Free quote'], ['Turfing', 'New lawns laid and levelled.', 'Free quote'], ['Planting', 'Borders planted to grow in, not just look good for a week.', 'Free quote']] },
  cleaner: { noun: 'cleaning', icon: ['sparkle', 'home', 'calendar', 'shield', 'check', 'clock'], services: [['Regular cleans', 'The same cleaner each week or fortnight.', 'From £18/hr'], ['Deep cleans', 'Top to bottom, inside the oven too.', 'Free quote'], ['End of tenancy', 'Cleans that get deposits back.', 'Free quote'], ['Offices', 'Early or late, before your team arrives.', 'Free quote'], ['Carpets', 'Carpet and upholstery cleaning.', 'From £40'], ['After builders', 'The dust gone after the work is done.', 'Free quote']] },
  locksmith: { noun: 'locksmith work', icon: ['key', 'lock', 'shield', 'clock', 'home', 'check'], services: [['Lock-outs', 'Non-destructive entry wherever possible.', 'From £70'], ['Lock changes', 'British Standard locks for insurance.', 'From £80'], ['uPVC door repairs', 'Mechanisms and handles fixed or replaced.', 'From £90'], ['Burglary repairs', 'Made secure the same day.', 'Ask us'], ['Key cutting', 'Spares for most locks.', 'Ask us'], ['Safes', 'Opening and fitting.', 'Ask us']] },
  trade: { noun: 'jobs around the home', icon: ['wrench', 'home', 'shield', 'clock', 'check', 'hammer'], services: [['Repairs', 'The small jobs that have been waiting too long.', 'From £60'], ['Installations', 'Fitted properly the first time.', 'Free quote'], ['Maintenance', 'Regular visits for landlords and businesses.', 'Ask us'], ['Emergencies', 'Fast help when something gives up.', 'Ask us'], ['Advice', 'An honest view before you spend anything.', 'Free'], ['Quotes', 'Clear, written quotes with no surprises.', 'Free']] },
};

const CLINIC = (b: Brief) => (/physio|osteo|chiro|sports/i.test(`${b.request} ${b.name}`) ? 'physio' : /dent/i.test(`${b.request} ${b.name}`) ? 'dentist' : /optic|eye/i.test(`${b.request} ${b.name}`) ? 'optician' : 'dentist');

export const TEMPLATES: Record<KindId, KindTemplate> = {
  barber: {
    theme: { palette: 'barber', fonts: 'condensed', shape: 'sharp', scheme: 'dark' },
    nav: 'nav-classic',
    tone: 'confident, friendly, no fuss',
    defaults: () => ({
      services: [
        { name: 'Haircut', price: '£18', duration: '30 min', group: 'Cuts' },
        { name: 'Skin fade', price: '£20', duration: '40 min', group: 'Cuts' },
        { name: 'Scissor cut', price: '£20', duration: '40 min', group: 'Cuts' },
        { name: "Kids' cut (under 12)", price: '£13', duration: '25 min', group: 'Cuts' },
        { name: 'Beard trim & line-up', price: '£10', duration: '15 min', group: 'Beards & shaves' },
        { name: 'Hot towel shave', price: '£22', duration: '40 min', group: 'Beards & shaves' },
        { name: 'Cut & beard', price: '£26', duration: '50 min', group: 'Beards & shaves' },
        { name: 'Senior cut (65+)', price: '£13', duration: '25 min', group: 'Cuts' },
      ],
      hours: [
        { label: 'Mon–Fri', open: '9:00', close: '18:30', days: [1, 2, 3, 4, 5] },
        { label: 'Saturday', open: '8:30', close: '17:00', days: [6] },
        { label: 'Sunday', open: '10:00', close: '14:00', days: [0] },
      ],
    }),
    announce: () => 'Walk-ins welcome · book ahead to skip the wait',
    meta: (b) => ({ title: `${b.name} — barbers${inTown(b)}`, description: `Fades, scissor cuts, beard trims and hot towel shaves${inTown(b)}. Walk in or book your chair at ${b.name}.` }),
    blurb: (b) => `Barbers${inTown(b)}. Fades, cuts, beards and shaves.`,
    pages: (b, s) => {
      const top = (b.services ?? []).slice(0, 8);
      return [
        {
          slug: '',
          label: 'Home',
          title: '',
          description: '',
          sections: [
            S('hero-image', {
              eyebrow: b.town ? `Barbers · ${b.town}` : 'Barbers',
              title: pick(b, ['Sharp cuts. *Proper* shaves.', 'Leave looking *sharper*.', 'The cut you *actually* asked for.']),
              lead: `Skin fades, scissor work, beard shaping and hot towel shaves${inTown(b)} — done properly, without the wait.`,
              primary: { label: 'Book a cut', href: route('book') },
              secondary: { label: 'See prices', href: route('prices') },
              image: s?.hero,
              facts: [
                ...(b.hours?.length ? [{ icon: 'clock', label: 'Open', value: `${b.hours[0]!.label} ${b.hours[0]!.closed ? 'closed' : `${b.hours[0]!.open}–${b.hours[0]!.close}`}` }] : []),
                ...(addressLine(b) ? [{ icon: 'pin', label: 'Find us', value: addressLine(b) }] : []),
                ...(b.phone ? [{ icon: 'phone', label: 'Call', value: b.phone }] : []),
              ],
            }),
            S('price-list', { eyebrow: 'Prices', title: 'Straightforward *prices*', lead: 'No upsell, no surprises. Card and cash welcome.', groups: priceGroups(top) }),
            S('media-text', { rows: [{ eyebrow: 'The chair', title: pick(b, ['Every cut gets *the time it needs*', 'Precision you can *see* from the back'], 'mt'), text: 'We take a minute to talk through what you want, then get it right — clean fades, sharp line-ups and a finish that grows out well.\nHot towels, a proper neck shave and a mirror at the end so you can see the back.', points: ['Clean, tidy shop', 'Experienced barbers', 'Kids and seniors welcome'], image: s?.story[0], link: { label: 'Book your slot', href: route('book') } }] }, 'alt'),
            S('gallery-grid', { eyebrow: 'Recent work', title: 'Fresh from the chair', images: galleryOf(s, 5) }),
            ...reviewsBlock(b, 'Straight from the chair', 'alt'),
            closing(b, 'Your chair is ready.', 'Book ahead in a minute, or just walk in.'),
            S('map', { eyebrow: 'Find us', title: b.town ? `In ${b.town}` : 'Find the shop', note: '' }, 'alt'),
          ],
        },
        { slug: 'prices', label: 'Prices', title: 'Prices', description: `Haircut, fade, beard and shave prices at ${b.name}${inTown(b)}.`, sections: [S('page-header', { eyebrow: 'Prices', title: 'Cuts, beards and *shaves*', lead: 'Every cut includes a wash on request, a hot towel finish and a styling product of your choice.' }, 'alt'), S('price-list', { title: 'The full list', groups: priceGroups(b.services ?? []), note: 'Prices can change; the price in the shop on the day is the one you pay.' }), S('faq', { eyebrow: 'Good to know', title: 'Questions', items: [{ q: 'Do I need to book?', a: 'No — walk-ins are welcome whenever a chair is free. Booking ahead means you will not wait.' }, { q: 'How long does a fade take?', a: 'About 40 minutes, including the line-up and finish.' }, { q: 'Do you cut kids\' hair?', a: 'Yes, any age. Bring them in when it is quieter if they are nervous — weekday afternoons are best.' }] }, 'alt'), closing(b, 'Ready when you are.', '')] },
        aboutPage(b, s, { title: 'A proper *barbers*', lead: `Who we are and how we work${inTown(b)}.`, intro: `${b.name} is a barbers for people who want a good cut without the fuss.`, body: 'We keep it simple: listen first, cut carefully, finish properly. No rushing the chair to fit in one more.\nCome in for a regular trim or something new — we will tell you honestly what will work with your hair.', teamTitle: 'Your barbers' }),
        contactPage(b, s, { slug: 'book', label: 'Book', title: 'Book your *chair*', lead: 'Pick a day and a time of day; we will confirm your slot by message.', formTitle: 'Booking request' }),
      ];
    },
  },

  salon: {
    theme: { palette: 'blush', fonts: 'luxe', shape: 'round', scheme: 'light' },
    nav: 'nav-centered',
    tone: 'warm, polished, reassuring',
    defaults: () => ({
      services: [
        { name: 'Cut & finish', price: '£45', duration: '60 min', group: 'Hair' },
        { name: 'Blow-dry', price: '£28', duration: '40 min', group: 'Hair' },
        { name: 'Full head colour', price: 'from £70', duration: '2 hr', group: 'Colour' },
        { name: 'Balayage', price: 'from £120', duration: '3 hr', group: 'Colour' },
        { name: 'Toner & gloss', price: '£35', duration: '30 min', group: 'Colour' },
        { name: 'Gel manicure', price: '£25', duration: '45 min', group: 'Beauty' },
        { name: 'Brow shape & tint', price: '£18', duration: '20 min', group: 'Beauty' },
        { name: 'Lash lift', price: '£40', duration: '45 min', group: 'Beauty' },
      ],
      hours: [
        { label: 'Tue–Fri', open: '9:30', close: '19:00', days: [2, 3, 4, 5] },
        { label: 'Saturday', open: '9:00', close: '17:00', days: [6] },
        { label: 'Sun–Mon', closed: true, days: [0, 1] },
      ],
    }),
    meta: (b) => ({ title: `${b.name} — hair & beauty${inTown(b)}`, description: `Cuts, colour, blow-dries and beauty${inTown(b)}. Book your appointment at ${b.name}.` }),
    blurb: (b) => `Hair and beauty${inTown(b)}.`,
    pages: (b, s) => [
      {
        slug: '',
        label: 'Home',
        title: '',
        description: '',
        sections: [
          S('hero-centered', { eyebrow: b.town ? `Hair & beauty · ${b.town}` : 'Hair & beauty', title: pick(b, ['Hair you will *love* for weeks', 'Colour, cut and *calm*', 'Leave feeling like *you*, only better']), lead: 'A relaxed salon with time for a proper consultation, honest advice and a finish you can recreate at home.', primary: { label: 'Book an appointment', href: route('book') }, secondary: { label: 'Treatments & prices', href: route('treatments') }, images: [s?.gallery[0], s?.hero, s?.gallery[1]].filter(Boolean).map((image) => ({ image })) }),
          S('services-cards', { eyebrow: 'Treatments', title: 'What we do *best*', lead: 'Every appointment starts with a chat about what you want and what will suit you.', items: (b.services ?? []).slice(0, 3).map((x, i) => ({ name: x.name, text: x.description ?? ['Shaped to your face and how you wear it day to day.', 'Rich, even colour with care for the condition of your hair.', 'Neat, long-lasting results from a steady hand.'][i % 3], price: x.price ?? '', time: x.duration ?? '', image: s?.gallery[i + 2] })), link: { label: 'All treatments', href: route('treatments') } }, 'alt'),
          S('media-text', { rows: [{ eyebrow: 'The salon', title: 'Time for you, *not a conveyor belt*', text: 'We book enough time for every client, so nobody is rushed and the coffee is still hot.\nAsk us anything — the best products for your hair, how often to come back, or whether that colour will really work.', image: s?.story[0], link: { label: 'Meet us', href: route('about') } }] }),
          ...reviewsBlock(b, 'Kind words', 'alt'),
          S('social-grid', { eyebrow: 'Latest', title: 'From the salon', images: galleryOf(s, 6) }),
          S('cta-split', { eyebrow: 'Appointments', title: 'Book your next visit', text: 'Tell us what you would like and when suits; we will confirm by message.', image: s?.story[1] ?? s?.hero }),
        ],
      },
      { slug: 'treatments', label: 'Treatments', title: 'Treatments & prices', description: `Hair, colour and beauty prices at ${b.name}${inTown(b)}.`, sections: [S('page-header', { eyebrow: 'Treatments', title: 'Treatments & *prices*', lead: 'Colour prices depend on length and thickness; we always confirm before we start.' }, 'alt'), S('price-list', { title: 'Price list', groups: priceGroups(b.services ?? []), note: 'A patch test is needed 48 hours before any colour or tint if you are new to us.' }), S('faq', { eyebrow: 'Good to know', title: 'Questions', items: [{ q: 'Do I need a patch test?', a: 'For colour, lash and brow tints, yes — 48 hours before. It takes two minutes and you can pop in any time we are open.' }, { q: 'What if I need to cancel?', a: 'Let us know at least 24 hours ahead so we can offer the slot to someone else.' }, { q: 'Can I bring a picture?', a: 'Please do — it is the quickest way to show us what you love.' }] }, 'alt')] },
      aboutPage(b, s, { title: 'Hello from *the salon*', lead: 'The people and the thinking behind the chair.', intro: `${b.name} is a small salon with a simple idea: take the time to get it right.`, body: 'We would rather do fewer appointments well than rush through more.\nYou will be looked after by the same person from consultation to finish.' }),
      contactPage(b, s, { slug: 'book', label: 'Book', title: 'Book an *appointment*', lead: 'Choose a treatment and a time; we will confirm by message.', formTitle: 'Appointment request' }),
    ],
  },

  cafe: {
    theme: { palette: 'espresso', fonts: 'editorial', shape: 'soft', scheme: 'light' },
    nav: 'nav-classic',
    tone: 'warm, local, unfussy',
    defaults: () => ({ hours: DAYS7('7:30', '16:00', ['8:30', '16:00'], ['9:30', '14:30']) }),
    meta: (b) => ({ title: `${b.name} — café${inTown(b)}`, description: `Good coffee, breakfast, lunch and cake${inTown(b)}. See the menu and opening times for ${b.name}.` }),
    blurb: (b) => `Coffee, breakfast and lunch${inTown(b)}.`,
    pages: (b, s) => [
      {
        slug: '',
        label: 'Home',
        title: '',
        description: '',
        sections: [
          S('hero-split', { eyebrow: b.town ? `Café · ${b.town}` : 'Neighbourhood café', title: pick(b, ['Good coffee, *slow* mornings', 'Your new *favourite* table', 'Coffee worth *crossing town* for']), lead: 'Freshly roasted coffee, breakfasts made to order and cakes baked here every morning.', primary: { label: 'See the menu', href: route('menu') }, secondary: { label: 'Find us', href: route('visit') }, image: s?.hero, card: b.hours?.length ? `Open today · ${b.hours[0]!.open}–${b.hours[0]!.close}` : 'Dogs and laptops welcome', points: ['Made here every morning', 'Vegan & gluten-free options', 'Take away or stay a while'] }),
          S('features-grid', { eyebrow: 'Why people come back', title: 'Small things, *done well*', items: [{ icon: 'coffee', title: 'Proper coffee', text: 'Espresso pulled with care, oat and other milks at no extra charge.' }, { icon: 'wheat', title: 'Baked here', text: 'Cakes, bakes and sourdough toast from our own kitchen.' }, { icon: 'leaf', title: 'Something for everyone', text: 'Vegan, vegetarian and gluten-free choices every day — just ask.' }] }, 'alt'),
          S('media-text', { rows: [{ eyebrow: 'Breakfast & lunch', title: 'Made to order, *never rushed*', text: 'From a bacon bap on the way to work to a long brunch with friends, everything is cooked when you order it.', image: s?.story[0], link: { label: 'Full menu', href: route('menu') } }, { eyebrow: 'The space', title: 'Stay as long as *you like*', text: 'Big windows, comfy corners and wifi that works. Bring a book, a laptop or the dog.', image: s?.story[1] }] }),
          S('gallery-strip', { eyebrow: 'Around the café', title: 'A taste of the place', images: galleryOf(s, 6) }, 'alt'),
          ...reviewsBlock(b),
          S('map', { eyebrow: 'Visit', title: b.town ? `Find us in ${b.town}` : 'Find us', note: '' }, 'alt'),
        ],
      },
      { slug: 'menu', label: 'Menu', title: 'Menu', description: `Breakfast, lunch, coffee and cake at ${b.name}${inTown(b)}.`, sections: [S('page-header', { eyebrow: 'Menu', title: 'Eat, drink, *stay*', lead: 'Breakfast served until 11:30, lunch from 11:30 until we close.' }, 'alt'), S('menu', { title: 'Today\'s menu', sections: [{ name: 'Breakfast', items: [{ name: 'Full breakfast', text: 'Bacon, sausage, egg your way, beans, mushrooms, tomato, toast.', price: '£9.50' }, { name: 'Veggie breakfast', text: 'Halloumi, egg, beans, mushrooms, avocado, toast.', price: '£9.00', tags: ['V'] }, { name: 'Avocado & eggs', text: 'Smashed avocado, poached eggs, chilli, sourdough.', price: '£8.50', tags: ['V'] }, { name: 'Bacon or sausage bap', text: 'Soft white bap, sauce of your choice.', price: '£4.50' }, { name: 'Granola bowl', text: 'Yoghurt, berries, honey.', price: '£5.50', tags: ['V'] }, { name: 'Porridge', text: 'Oat milk, banana, maple.', price: '£4.80', tags: ['VG'] }] }, { name: 'Lunch', items: [{ name: 'Soup of the day', text: 'With bread and butter.', price: '£5.95', tags: ['V'] }, { name: 'Toasties', text: 'Ham & cheese, three cheese & onion, or tuna melt.', price: '£6.50' }, { name: 'Club sandwich', text: 'Chicken, bacon, lettuce, tomato, mayo.', price: '£8.50' }, { name: 'Falafel wrap', text: 'Hummus, pickles, salad.', price: '£7.50', tags: ['VG'] }] }, { name: 'Drinks', items: [{ name: 'Espresso', price: '£2.40' }, { name: 'Flat white', price: '£3.20' }, { name: 'Latte / cappuccino', price: '£3.30' }, { name: 'Pot of tea', price: '£2.40' }, { name: 'Hot chocolate', price: '£3.40' }, { name: 'Fresh orange juice', price: '£3.00', tags: ['VG'] }] }, { name: 'Cakes', items: [{ name: 'Cake of the day', text: 'Ask what came out of the oven this morning.', price: '£3.50' }, { name: 'Brownie', price: '£3.20', tags: ['GF'] }, { name: 'Scone with jam & cream', price: '£3.80', tags: ['V'] }] }], note: 'Please tell us about any allergies before you order; we can show you the ingredients of everything we make.' })] },
      aboutPage(b, s, { title: 'About *the café*', lead: 'Who makes your coffee.', intro: `${b.name} started with a simple idea: a café we would want to go to ourselves.`, body: 'Good coffee, food cooked properly and a room where nobody hurries you out.\nWe buy locally where we can and bake every day.' }),
      { ...contactPage(b, s, { slug: 'visit', label: 'Visit', title: 'Come and *see us*', lead: 'Opening times, where we are and how to get in touch.' }) },
    ],
  },

  restaurant: {
    theme: { palette: 'estate', fonts: 'classic', shape: 'sharp', scheme: 'light' },
    nav: 'nav-centered',
    tone: 'assured, generous, sensory',
    defaults: () => ({ hours: [{ label: 'Tue–Thu', open: '17:00', close: '22:00', days: [2, 3, 4] }, { label: 'Fri–Sat', open: '12:00', close: '23:00', days: [5, 6] }, { label: 'Sunday', open: '12:00', close: '20:00', days: [0] }, { label: 'Monday', closed: true, days: [1] }] }),
    meta: (b) => ({ title: `${b.name} — restaurant${inTown(b)}`, description: `See the menu and book a table at ${b.name}${inTown(b)}.` }),
    blurb: (b) => `Restaurant${inTown(b)}.`,
    pages: (b, s) => [
      {
        slug: '',
        label: 'Home',
        title: '',
        description: '',
        sections: [
          S('hero-editorial', { eyebrow: b.town ? `Restaurant · ${b.town}` : 'Restaurant', title: pick(b, ['Cooked with *care*, served with *warmth*', 'Seasonal plates, *proper* hospitality', 'An evening worth *slowing down* for']), lead: 'A short menu that changes with the seasons, cooked from scratch and served without fuss.', primary: { label: 'Book a table', href: route('book') }, secondary: { label: 'View the menu', href: route('menu') }, image: s?.hero }),
          S('features-list', { eyebrow: 'The kitchen', title: 'Simple food, done *really well*', lead: 'We cook what is good this week and let it taste of itself.', items: [{ title: 'Seasonal menu', text: 'Changes as the produce does.' }, { title: 'Local suppliers', text: 'Meat, vegetables and bread from people we know.' }, { title: 'Made in house', text: 'Stocks, sauces, bread and puddings.' }, { title: 'Every diet considered', text: 'Tell us when you book and the kitchen will look after you.' }], link: { label: 'See the menu', href: route('menu') } }, 'alt'),
          S('gallery-grid', { eyebrow: 'From the pass', title: 'What is cooking', images: galleryOf(s, 5) }),
          ...reviewsBlock(b, 'Guests say', 'alt'),
          S('cta-split', { eyebrow: 'Private dining', title: 'Celebrating something?', text: 'Birthdays, family meals and work dinners — ask us about larger tables and set menus.', image: s?.story[0] }),
          S('map', { eyebrow: 'Find us', title: b.town ? `In ${b.town}` : 'Where we are', note: '' }, 'alt'),
        ],
      },
      { slug: 'menu', label: 'Menu', title: 'Menu', description: `The menu at ${b.name}${inTown(b)}.`, sections: [S('page-header', { eyebrow: 'Menu', title: 'This *season*', lead: 'A sample menu; dishes change with what is good.' }, 'alt'), S('menu', { title: 'Menu', sections: [{ name: 'Starters', items: [{ name: 'Soup of the day', text: 'House bread, salted butter.', price: '£7', tags: ['V'] }, { name: 'Chicken liver parfait', text: 'Chutney, toasted brioche.', price: '£9' }, { name: 'Burrata', text: 'Heritage tomato, basil oil.', price: '£10', tags: ['V', 'GF'] }, { name: 'Salt & pepper squid', text: 'Lemon mayonnaise.', price: '£9.50' }] }, { name: 'Mains', items: [{ name: 'Rump steak', text: 'Chips, watercress, peppercorn sauce.', price: '£24', tags: ['GF'] }, { name: 'Market fish', text: 'Crushed potatoes, greens, beurre blanc.', price: '£22', tags: ['GF'] }, { name: 'Roast chicken', text: 'Mash, greens, jus.', price: '£19' }, { name: 'Wild mushroom risotto', text: 'Parmesan, truffle.', price: '£17', tags: ['V', 'GF'] }] }, { name: 'Desserts', items: [{ name: 'Sticky toffee pudding', text: 'Butterscotch, vanilla ice cream.', price: '£8', tags: ['V'] }, { name: 'Dark chocolate tart', text: 'Crème fraîche.', price: '£8.50', tags: ['V'] }, { name: 'Cheeses', text: 'Three British cheeses, crackers, chutney.', price: '£11' }] }], note: 'Please tell us about any allergies when you order. A discretionary service charge may be added to larger tables.' })] },
      aboutPage(b, s, { title: 'Our *story*', lead: 'Who cooks, who serves, and why.', intro: `${b.name} is a neighbourhood restaurant with grown-up cooking and a warm welcome.`, body: 'We cook what we love to eat, with ingredients from people we know.\nCome for a quick plate at the bar or a long dinner — either way, we will look after you.' }),
      contactPage(b, s, { slug: 'book', label: 'Book', title: 'Book a *table*', lead: 'Send us your date, time and how many; we confirm every booking by message.', formTitle: 'Table request' }),
    ],
  },

  trades: {
    theme: { palette: 'trades', fonts: 'friendly', shape: 'soft', scheme: 'light' },
    nav: 'nav-classic',
    tone: 'reliable, plain-speaking, local',
    defaults: (b) => ({ services: TRADE[tradeOf(b)].services.map(([name, description, price]) => ({ name, description, price })), hours: DAYS7('8:00', '18:00', ['8:00', '13:00'], null) }),
    announce: (b) => (b.phone ? `Emergency? Call ${b.phone}` : 'Free, no-obligation quotes'),
    meta: (b) => ({ title: `${b.name} — ${TRADE[tradeOf(b)].noun}${inTown(b)}`, description: `Reliable ${TRADE[tradeOf(b)].noun}${inTown(b)} and nearby. Free quotes from ${b.name}.` }),
    blurb: (b) => `${TRADE[tradeOf(b)].noun[0]!.toUpperCase()}${TRADE[tradeOf(b)].noun.slice(1)}${inTown(b)} and the surrounding area.`,
    pages: (b, s) => {
      const t = TRADE[tradeOf(b)];
      const svc = (b.services ?? []).slice(0, 6);
      return [
        {
          slug: '',
          label: 'Home',
          title: '',
          description: '',
          sections: [
            S('hero-split', { eyebrow: b.town ? `${t.noun[0]!.toUpperCase()}${t.noun.slice(1)} · ${b.town}` : t.noun, title: pick(b, ['Turned up on time. *Done properly.*', 'Reliable work, *fair prices*', 'The job done right, *first time*']), lead: `Local ${t.noun}${inTown(b)} — clear quotes, tidy work, and we answer the phone.`, primary: { label: 'Get a free quote', href: route('quote') }, secondary: b.phone ? { label: `Call ${b.phone}`, href: telHref(b.phone) } : { label: 'Our services', href: route('services') }, image: s?.hero, card: b.accreditations?.[0] ?? 'Fully insured · written quotes', points: ['Free written quotes', 'Clean & tidy', 'Work guaranteed'] }),
            ...logosBlock(b, 'Registered & accredited'),
            S('features-grid', { eyebrow: 'Services', title: `What we *do*`, lead: 'No job too small — if it is not on the list, just ask.', items: svc.map((x, i) => ({ icon: t.icon[i % t.icon.length], title: x.name, text: x.description ?? '' })) }, 'alt'),
            S('process-steps', { eyebrow: 'How it works', title: 'Simple from *first call*', steps: [{ title: 'Tell us the job', text: 'Ring, message or fill in the form with a photo if you can.' }, { title: 'Get a fixed quote', text: 'We visit or price it from photos, in writing, with no surprises later.' }, { title: 'We do the work', text: 'On the agreed day, tidily, and we clear up after ourselves.' }] }),
            ...(b.areas?.length ? [S('areas-served', { eyebrow: 'Where we work', title: 'Areas we *cover*', areas: b.areas, note: 'Not on the list? Ask — we often travel further.' }, 'alt')] : []),
            ...reviewsBlock(b, 'From our customers', b.areas?.length ? undefined : 'alt'),
            S('faq', { eyebrow: 'FAQ', title: 'Common *questions*', items: [{ q: 'Are your quotes free?', a: 'Yes. Quotes are free and in writing, with no obligation.' }, { q: 'Are you insured?', a: 'Yes, we carry public liability insurance and can show the certificate.' }, { q: 'How soon can you come out?', a: 'Usually within a few days for quotes, and the same day for emergencies when we can.' }, { q: 'Do you guarantee your work?', a: 'Yes — if something we did is not right, we come back and put it right.' }] }),
            closing(b, 'Need a hand?', 'Tell us about the job and get a free, fixed quote.'),
          ],
        },
        { slug: 'services', label: 'Services', title: 'Services', description: `${t.noun} services from ${b.name}${inTown(b)}.`, sections: [S('page-header', { eyebrow: 'Services', title: 'Everything we *do*', lead: 'Prices are a guide; every job gets a fixed written quote before we start.' }, 'alt'), S('services-cards', { title: 'Services & guide prices', items: (b.services ?? []).map((x, i) => ({ name: x.name, text: x.description ?? '', price: x.price ?? '', image: i < 3 ? s?.gallery[i] : undefined })) }), S('process-steps', { eyebrow: 'How it works', title: 'What happens *next*', steps: [{ title: 'Tell us', text: 'Ring, message or use the quote form.' }, { title: 'Fixed quote', text: 'In writing, before any work starts.' }, { title: 'Done & guaranteed', text: 'Tidy work, and we stand behind it.' }] }, 'alt'), closing(b, 'Get your free quote', '')] },
        aboutPage(b, s, { title: 'Local, reliable, *honest*', lead: `About ${b.name}.`, intro: `${b.name} is a local ${t.noun} business that people recommend to their neighbours.`, body: 'We turn up when we say, explain what needs doing and why, and leave the place as we found it.\nMost of our work comes from repeat customers and word of mouth — that is how we like it.' }),
        contactPage(b, s, { slug: 'quote', label: 'Free quote', title: 'Get a free *quote*', lead: 'Tell us about the job. A photo helps — send it by WhatsApp.', kind: 'quote', formTitle: 'Quote request' }),
      ];
    },
  },

  gym: {
    theme: { palette: 'gym', fonts: 'condensed', shape: 'sharp', scheme: 'dark' },
    nav: 'nav-classic',
    tone: 'energetic, encouraging, direct',
    defaults: () => ({ services: [{ name: 'Off-peak', price: '£25', description: 'Weekdays before 4pm and weekends' }, { name: 'Full membership', price: '£35', description: 'Any time, all classes included' }, { name: 'Personal training', price: '£40', description: 'One-to-one session, 60 minutes' }], hours: [{ label: 'Mon–Fri', open: '6:00', close: '22:00', days: [1, 2, 3, 4, 5] }, { label: 'Sat–Sun', open: '8:00', close: '18:00', days: [6, 0] }] }),
    meta: (b) => ({ title: `${b.name} — gym${inTown(b)}`, description: `Training, classes and coaching${inTown(b)}. Book a free session at ${b.name}.` }),
    blurb: (b) => `Training and coaching${inTown(b)}.`,
    pages: (b, s) => {
      const sv = b.services ?? [];
      return [
        {
          slug: '',
          label: 'Home',
          title: '',
          description: '',
          sections: [
            S('hero-image', { eyebrow: b.town ? `Gym · ${b.town}` : 'Gym & coaching', title: pick(b, ['Stronger than *last week*', 'Train with people who *care*', 'Show up. *We will do the rest.*']), lead: 'Coached sessions, kit that works and people who will learn your name. Beginners very welcome.', primary: { label: 'Book a free session', href: route('join') }, secondary: { label: 'Memberships', href: route('memberships') }, image: s?.hero, facts: [{ icon: 'clock', label: 'Open', value: b.hours?.[0] ? `${b.hours[0].label} ${b.hours[0].open}–${b.hours[0].close}` : 'Early till late' }, { icon: 'users', label: 'Classes', value: 'Every day' }, { icon: 'dumbbell', label: 'First visit', value: 'Free' }] }),
            S('features-grid', { eyebrow: 'Why train here', title: 'Everything you need, *nothing you don\'t*', items: [{ icon: 'dumbbell', title: 'Proper equipment', text: 'Racks, platforms, dumbbells and machines — no queueing at peak.' }, { icon: 'users', title: 'Coached classes', text: 'Small groups so the coach actually watches your form.' }, { icon: 'pulse', title: 'A plan that fits', text: 'A free induction and a programme for your goals.' }] }),
            S('pricing-cards', { eyebrow: 'Memberships', title: 'Simple *pricing*', lead: 'No joining fee. Cancel with a month\'s notice.', plans: sv.slice(0, 3).map((p, i) => ({ name: p.name, price: p.price ?? '', per: i < 2 ? '/month' : '/session', text: p.description ?? '', features: i === 0 ? ['Gym floor access', 'Free induction', 'App programme'] : i === 1 ? ['Unlimited access', 'All classes included', 'Free induction', 'Monthly check-in'] : ['Your own coach', 'Nutrition guidance', 'Progress tracking'], cta: { label: 'Get started', href: route('join') } })) }, 'alt'),
            S('media-text', { rows: [{ eyebrow: 'New to the gym?', title: 'Nobody starts *fit*', text: 'Your first session is free and with a coach. We show you around, set up a simple plan and stay on hand while you find your feet.', image: s?.story[0], points: ['Free first session', 'Beginner-friendly classes', 'Friendly, not intimidating'] }] }),
            S('gallery-strip', { eyebrow: 'Inside', title: 'The gym', images: galleryOf(s, 6) }, 'alt'),
            ...reviewsBlock(b, 'Members say'),
            closing(b, 'Your first session is on us.', 'Book a free session and see if we are right for you.'),
          ],
        },
        { slug: 'memberships', label: 'Memberships', title: 'Memberships', description: `Membership prices at ${b.name}${inTown(b)}.`, sections: [S('page-header', { eyebrow: 'Memberships', title: 'Join *today*', lead: 'No joining fee and no long contracts.' }, 'alt'), S('pricing-cards', { title: 'Choose your membership', plans: sv.slice(0, 3).map((p, i) => ({ name: p.name, price: p.price ?? '', per: i < 2 ? '/month' : '/session', text: p.description ?? '', features: i === 1 ? ['Unlimited access', 'All classes included', 'Free induction'] : ['Free induction', 'Friendly coaches'], cta: { label: 'Join', href: route('join') } })), note: 'Students and NHS staff: ask about our discount.' }), S('faq', { eyebrow: 'FAQ', title: 'Questions', items: [{ q: 'Is there a joining fee?', a: 'No.' }, { q: 'Can I freeze my membership?', a: 'Yes, for holidays or injury — just ask at reception.' }, { q: 'I am a complete beginner. Is that OK?', a: 'Absolutely. Most members started where you are; a coach will show you everything.' }] }, 'alt')] },
        aboutPage(b, s, { title: 'More than a *gym*', lead: 'The people who will coach you.', intro: `${b.name} is a gym where people notice when you are missing.`, body: 'We started it because we wanted a place that is serious about training and kind to beginners.\nCome in, look around and meet the coaches.', teamTitle: 'Your coaches' }),
        contactPage(b, s, { slug: 'join', label: 'Join', title: 'Book your *free session*', lead: 'Tell us a little about your goals; we will find you a time.', formTitle: 'Free session request' }),
      ];
    },
  },

  photographer: {
    theme: { palette: 'mono', fonts: 'luxe', shape: 'sharp', scheme: 'light' },
    nav: 'nav-centered',
    tone: 'calm, observant, personal',
    defaults: () => ({ services: [{ name: 'Elopement', price: '£550', description: 'Up to three hours, 150+ edited photos' }, { name: 'Half day', price: '£850', description: 'Six hours, ceremony to first dance' }, { name: 'Full day', price: '£1,350', description: 'Getting ready to the evening, 500+ photos' }] }),
    meta: (b) => ({ title: `${b.name} — photographer${inTown(b)}`, description: `Natural, unposed photography${inTown(b)}. See the work and check dates with ${b.name}.` }),
    blurb: (b) => `Photography${inTown(b)} and beyond.`,
    pages: (b, s) => [
      {
        slug: '',
        label: 'Home',
        title: '',
        description: '',
        sections: [
          S('hero-editorial', { eyebrow: 'Photography', title: pick(b, ['Real moments, *beautifully* kept', 'Photographs that feel like *the day*', 'Quietly there for the moments *that matter*']), lead: 'Natural, unposed photography for weddings, families and brands — calm on the day, honest in the edit.', primary: { label: 'Check my dates', href: route('contact') }, secondary: { label: 'See the work', href: route('work') }, image: s?.hero }),
          S('gallery-grid', { eyebrow: 'Selected work', title: 'Recent *stories*', images: galleryOf(s, 5) }),
          S('features-list', { eyebrow: 'What to expect', title: 'Easy from the *first hello*', items: [{ title: 'A proper chat first', text: 'We talk through your plans, the light and the timings.' }, { title: 'Relaxed on the day', text: 'Mostly unposed, with a little gentle direction when it helps.' }, { title: 'Carefully edited', text: 'Every photo edited by hand, delivered in an online gallery.' }, { title: 'Yours to keep', text: 'Full-resolution files and a print licence included.' }], link: { label: 'Packages', href: route('packages') } }, 'alt'),
          ...reviewsBlock(b, 'Kind words'),
          S('cta-split', { eyebrow: 'Dates', title: 'Is your date *free*?', text: 'Tell me when and where and I will reply within a day.', image: s?.story[0] }),
        ],
      },
      { slug: 'work', label: 'Work', title: 'Work', description: `Photography by ${b.name}.`, sections: [S('page-header', { eyebrow: 'Portfolio', title: 'Selected *work*', lead: 'A few favourites from recent shoots.' }, 'alt'), S('gallery-grid', { title: 'Portfolio', images: galleryOf(s, 10) })] },
      { slug: 'packages', label: 'Packages', title: 'Packages', description: `Photography packages and prices from ${b.name}.`, sections: [S('page-header', { eyebrow: 'Packages', title: 'Packages & *prices*', lead: 'Every package includes an online gallery and full-resolution files.' }, 'alt'), S('pricing-cards', { title: 'Packages', plans: (b.services ?? []).slice(0, 3).map((p) => ({ name: p.name, price: p.price ?? '', text: p.description ?? '', features: ['Online gallery', 'Full-resolution files', 'Print licence'], cta: { label: 'Check dates', href: route('contact') } })) }), S('process-steps', { eyebrow: 'How it works', title: 'From hello to *gallery*', steps: [{ title: 'Say hello', text: 'Tell me your date and plans.' }, { title: 'Book', text: 'A short contract and a deposit secure the date.' }, { title: 'The day', text: 'I will be there early and quiet.' }, { title: 'Your gallery', text: 'Edited photos delivered within six weeks.' }] }, 'alt'), S('faq', { eyebrow: 'FAQ', title: 'Questions', items: [{ q: 'Do you travel?', a: 'Yes, anywhere in the UK; travel costs are agreed up front.' }, { q: 'How long until we get the photos?', a: 'Usually four to six weeks, with a preview within a week.' }, { q: 'How do we secure our date?', a: 'With a signed agreement and a deposit.' }] })] },
      aboutPage(b, s, { title: 'Hello, *I\'m the photographer*', lead: 'A little about me and how I work.', intro: `I photograph people as they are — not as a list of poses.`, body: 'I work quietly, notice the small things and keep the day moving gently.\nIf that sounds like you, I would love to hear about your plans.' }),
      contactPage(b, s, { title: 'Let\'s *talk*', lead: 'Tell me about your date and what you have in mind.', formTitle: 'Enquiry' }),
    ],
  },

  clinic: {
    theme: { palette: 'clinic', fonts: 'refined', shape: 'round', scheme: 'light' },
    nav: 'nav-classic',
    tone: 'calm, expert, reassuring',
    defaults: (b) => CLINIC(b) === 'physio'
      ? { services: [{ name: 'Initial assessment', price: '£60', duration: '45 min', description: 'A full assessment and a plan you understand.' }, { name: 'Follow-up session', price: '£50', duration: '30 min', description: 'Treatment and exercises that progress with you.' }, { name: 'Sports massage', price: '£45', duration: '45 min', description: 'For recovery and tight, overworked muscles.' }, { name: 'Shockwave therapy', price: '£70', duration: '20 min', description: 'For stubborn tendon problems.' }], hours: DAYS7('8:00', '19:00', ['9:00', '13:00'], null) }
      : { services: [{ name: 'Check-up', price: '£60', duration: '30 min', description: 'A thorough examination with X-rays when needed.' }, { name: 'Hygienist', price: '£75', duration: '40 min', description: 'A deep clean and advice for healthier gums.' }, { name: 'Teeth whitening', price: 'from £350', description: 'Safe, dentist-led home whitening.' }, { name: 'Invisalign', price: 'from £2,500', description: 'Clear aligners to straighten teeth discreetly.' }, { name: 'Emergency appointment', price: '£90', description: 'Same-day appointments for pain.' }, { name: 'Fillings', price: 'from £95', description: 'Tooth-coloured fillings.' }], hours: DAYS7('8:30', '17:30', ['9:00', '13:00'], null) },
    meta: (b) => ({ title: `${b.name} — ${CLINIC(b) === 'physio' ? 'physiotherapy' : 'dental practice'}${inTown(b)}`, description: `${CLINIC(b) === 'physio' ? 'Physiotherapy and sports injury care' : 'Friendly, modern dentistry'}${inTown(b)}. Book an appointment with ${b.name}.` }),
    blurb: (b) => `${CLINIC(b) === 'physio' ? 'Physiotherapy' : 'Dental care'}${inTown(b)}.`,
    pages: (b, s) => {
      const physio = CLINIC(b) === 'physio';
      return [
        {
          slug: '',
          label: 'Home',
          title: '',
          description: '',
          sections: [
            S('hero-split', { eyebrow: b.town ? `${physio ? 'Physiotherapy' : 'Dental practice'} · ${b.town}` : physio ? 'Physiotherapy' : 'Dental practice', title: physio ? pick(b, ['Move *without* the pain', 'Back to the things *you love*']) : pick(b, ['Gentle dentistry, *real* smiles', 'Dentistry that puts you *at ease*']), lead: physio ? 'Clear diagnosis, hands-on treatment and exercises that fit your life.' : 'Modern, unhurried care for the whole family — and nervous patients are our speciality.', primary: { label: 'Book an appointment', href: route('book') }, secondary: { label: 'Treatments & fees', href: route('treatments') }, image: s?.hero, card: physio ? 'Same-week appointments' : 'New patients welcome', points: physio ? ['No referral needed', 'Insurance accepted', 'Evening appointments'] : ['Nervous patients welcome', 'Clear, upfront fees', 'Emergency appointments'] }),
            S('features-grid', { eyebrow: 'Treatments', title: physio ? 'How we *help*' : 'Care for *every* smile', items: (b.services ?? []).slice(0, 6).map((x, i) => ({ icon: physio ? ['pulse', 'hand', 'heart', 'bolt', 'users', 'check'][i % 6] : ['tooth', 'sparkle', 'smile', 'shield', 'clock', 'check'][i % 6], title: x.name, text: x.description ?? '' })) }, 'alt'),
            S('process-steps', { eyebrow: 'Your first visit', title: 'What to *expect*', steps: physio ? [{ title: 'Assessment', text: 'We listen, examine and explain what is going on.' }, { title: 'Treatment', text: 'Hands-on treatment that starts on day one.' }, { title: 'Your plan', text: 'Simple exercises and a plan to stay well.' }] : [{ title: 'A proper chat', text: 'Tell us your worries; we explain everything before we start.' }, { title: 'Check-up', text: 'A gentle, thorough examination.' }, { title: 'Your plan', text: 'Clear options and costs, with no pressure.' }] }),
            S('media-text', { rows: [{ eyebrow: physio ? 'Our approach' : 'Nervous?', title: physio ? 'Treatment that *gets to the cause*' : 'You are in *kind hands*', text: physio ? 'We do not just treat the sore spot. We find out why it hurts and help you fix it for good.' : 'Many of our patients had not seen a dentist for years. We go at your pace, explain every step and stop whenever you raise a hand.', image: s?.story[0] }] }, 'alt'),
            ...reviewsBlock(b, 'Patients say'),
            S('faq', { eyebrow: 'FAQ', title: 'Questions', items: physio ? [{ q: 'Do I need a GP referral?', a: 'No, you can book directly.' }, { q: 'Do you accept insurance?', a: 'We work with most major insurers; bring your authorisation code.' }, { q: 'What should I wear?', a: 'Loose, comfortable clothing so we can see the area we are treating.' }] : [{ q: 'Are you taking new patients?', a: 'Yes — book online or call, and mention you are new.' }, { q: 'I am very nervous. Can you help?', a: 'Yes. Tell us when you book; we will give you extra time and go at your pace.' }, { q: 'Do you see emergencies?', a: 'We keep appointments free every day for patients in pain.' }] }, 'alt'),
            closing(b, 'Ready to book?', 'Appointments this week — choose a time that suits you.'),
          ],
        },
        { slug: 'treatments', label: 'Treatments', title: 'Treatments & fees', description: `Treatments and fees at ${b.name}.`, sections: [S('page-header', { eyebrow: 'Treatments', title: 'Treatments & *fees*', lead: 'Clear prices, agreed before treatment starts.' }, 'alt'), S('services-cards', { title: 'Treatments', items: (b.services ?? []).map((x) => ({ name: x.name, text: x.description ?? '', price: x.price ?? '', time: x.duration ?? '' })) })] },
        aboutPage(b, s, { title: 'About *the practice*', lead: 'The people who will look after you.', intro: `${b.name} is an independent ${physio ? 'clinic' : 'practice'} where you see the same faces every visit.`, body: 'We take time to explain, never rush and always give you options.\nOur aim is simple: care that you are glad you came for.', teamTitle: 'Our clinicians', label: 'About' }),
        contactPage(b, s, { slug: 'book', label: 'Book', title: 'Book an *appointment*', lead: 'Request a time; we confirm by phone or message.', formTitle: 'Appointment request' }),
      ];
    },
  },

  estate: {
    theme: { palette: 'estate', fonts: 'refined', shape: 'soft', scheme: 'light' },
    nav: 'nav-classic',
    tone: 'knowledgeable, straight-talking, local',
    defaults: () => ({ hours: DAYS7('9:00', '17:30', ['9:00', '15:00'], null) }),
    meta: (b) => ({ title: `${b.name} — estate agents${inTown(b)}`, description: `Selling, letting and property management${inTown(b)}. Book a free valuation with ${b.name}.` }),
    blurb: (b) => `Independent estate and letting agents${inTown(b)}.`,
    pages: (b, s) => [
      {
        slug: '',
        label: 'Home',
        title: '',
        description: '',
        sections: [
          S('hero-editorial', { eyebrow: b.town ? `Estate agents · ${b.town}` : 'Estate agents', title: pick(b, ['Local agents who *actually* pick up', 'Move with people who *know the street*']), lead: 'Honest valuations, proper marketing and someone who knows your name from listing to keys.', primary: { label: 'Book a free valuation', href: route('valuation') }, secondary: { label: 'Selling with us', href: route('about') }, image: s?.hero }),
          S('features-grid', { eyebrow: 'What we do', title: 'Sales, lettings, *management*', items: [{ icon: 'home', title: 'Selling', text: 'A realistic price, great photos and accompanied viewings.' }, { icon: 'key', title: 'Lettings', text: 'Good tenants found, referenced and moved in properly.' }, { icon: 'shield', title: 'Property management', text: 'Rent, repairs and compliance handled for landlords.' }] }, 'alt'),
          ...(b.listings?.length ? [S('property-listings', { eyebrow: 'Properties', title: 'Latest *listings*', items: b.listings })] : []),
          S('process-steps', { eyebrow: 'Selling', title: 'How we *sell*', steps: [{ title: 'Valuation', text: 'A free visit and an honest price, backed by local sales.' }, { title: 'Marketing', text: 'Professional photos, floorplans and the main property portals.' }, { title: 'Viewings & offers', text: 'Accompanied viewings and every offer checked.' }, { title: 'To completion', text: 'We chase the chain so you do not have to.' }] }),
          ...reviewsBlock(b, 'Clients say', 'alt'),
          S('cta-split', { eyebrow: 'Thinking of moving?', title: 'What is your home *worth*?', text: 'Book a free, no-obligation valuation with someone who sells on your street.', image: s?.story[0], primary: { label: 'Book a valuation', href: route('valuation') } }),
        ],
      },
      aboutPage(b, s, { title: 'Independent, *local*, straightforward', lead: `About ${b.name}.`, intro: `${b.name} is an independent agency that treats every sale like it is our own.`, body: 'We know the streets, the schools and the buyers.\nYou get one person who knows your property, not a call centre.' }),
      contactPage(b, s, { slug: 'valuation', label: 'Valuation', title: 'Book a free *valuation*', lead: 'Tell us about the property; we will call to arrange a time.', formTitle: 'Valuation request' }),
    ],
  },

  shop: {
    theme: { palette: 'sage', fonts: 'friendly', shape: 'round', scheme: 'light' },
    nav: 'nav-classic',
    tone: 'friendly, characterful, local',
    defaults: () => ({ hours: DAYS7('9:30', '17:30', ['9:30', '17:00'], ['11:00', '16:00']) }),
    meta: (b) => ({ title: `${b.name}${inTown(b) ? ` —${inTown(b).replace(' in', '')}` : ''}`, description: `An independent shop${inTown(b)}. Visit ${b.name} or order by message.` }),
    blurb: (b) => `An independent shop${inTown(b)}.`,
    pages: (b, s) => [
      {
        slug: '',
        label: 'Home',
        title: '',
        description: '',
        sections: [
          S('hero-split', { eyebrow: b.town ? `Independent shop · ${b.town}` : 'Independent shop', title: pick(b, ['Lovely things, *chosen with care*', 'Small shop, *big heart*']), lead: 'Hand-picked and often hand-made — come and browse, or message us to order.', primary: { label: b.shopUrl ? 'Shop online' : 'Visit the shop', href: b.shopUrl || route('visit') }, secondary: { label: 'About us', href: route('about') }, image: s?.hero, card: 'Gift wrapping on request' }),
          ...(b.products?.length ? [S('product-cards', { eyebrow: 'In the shop', title: 'New *in*', items: b.products, link: b.shopUrl ? { label: 'Shop online', href: b.shopUrl } : undefined }, 'alt')] : [S('features-grid', { eyebrow: 'In the shop', title: 'What you will *find*', items: [{ icon: 'gift', title: 'Gifts', text: 'Thoughtful presents for people who have everything.' }, { icon: 'sparkle', title: 'Made locally', text: 'Work by makers from round here.' }, { icon: 'bag', title: 'Order by message', text: 'See something you like? Message us and we will put it aside.' }] }, 'alt')]),
          S('media-text', { rows: [{ eyebrow: 'Our shop', title: 'Come in and *browse*', text: 'No pressure, just good things on the shelves and someone happy to help you find the right one.', image: s?.story[0], link: { label: 'Find us', href: route('visit') } }] }),
          S('social-grid', { eyebrow: 'Follow along', title: 'Fresh on the shelves', images: galleryOf(s, 6) }, 'alt'),
          ...reviewsBlock(b),
          S('map', { eyebrow: 'Visit', title: 'Find the *shop*', note: '' }),
        ],
      },
      aboutPage(b, s, { title: 'Our *story*', lead: 'Why we opened the shop.', intro: `${b.name} is the shop we always wanted on our high street.`, body: 'We choose everything ourselves and love to tell you about it.\nThank you for shopping small.' }),
      contactPage(b, s, { slug: 'visit', label: 'Visit', title: 'Visit *us*', lead: 'Opening hours, where we are and how to order.' }),
    ],
  },

  portfolio: {
    theme: { palette: 'mono', fonts: 'tech', shape: 'sharp', scheme: 'light' },
    nav: 'nav-classic',
    tone: 'clear, confident, personal',
    defaults: () => ({ services: [{ name: 'Brand identity', description: 'Logos, colour and type that work everywhere.' }, { name: 'Websites', description: 'Fast, accessible sites that are easy to update.' }, { name: 'Design for print', description: 'Menus, signage and everything on paper.' }] }),
    meta: (b) => ({ title: `${b.name} — portfolio`, description: `Work, services and contact for ${b.name}.` }),
    blurb: (b) => `${b.name} — independent work${inTown(b)}.`,
    pages: (b, s) => [
      {
        slug: '',
        label: 'Home',
        title: '',
        description: '',
        sections: [
          S('hero-editorial', { eyebrow: b.tagline ?? 'Independent studio', title: pick(b, ['Thoughtful work for *people who care*', 'Clear ideas, *carefully made*']), lead: b.about ? b.about.slice(0, 200) : 'I help small businesses and people with big ideas look as good as they are.', primary: { label: 'Start a project', href: route('contact') }, secondary: { label: 'See the work', href: route('work') }, image: s?.hero }),
          ...(b.projects?.length ? [S('case-studies', { eyebrow: 'Selected work', title: 'Recent *projects*', items: b.projects })] : [S('gallery-grid', { eyebrow: 'Selected work', title: 'Recent *work*', images: galleryOf(s, 5) })]),
          S('features-list', { eyebrow: 'Services', title: 'How I can *help*', items: (b.services ?? []).map((x) => ({ title: x.name, text: x.description ?? '' })), link: { label: 'Get in touch', href: route('contact') } }, 'alt'),
          ...reviewsBlock(b, 'Clients say'),
          closing(b, 'Have a project in mind?', 'Tell me about it — I reply within a day.'),
        ],
      },
      { slug: 'work', label: 'Work', title: 'Work', description: `Selected work by ${b.name}.`, sections: [S('page-header', { eyebrow: 'Work', title: 'Selected *work*', lead: '' }, 'alt'), ...(b.projects?.length ? [S('case-studies', { title: 'Projects', items: b.projects })] : [S('gallery-grid', { title: 'Work', images: galleryOf(s, 10) })])] },
      aboutPage(b, s, { title: 'About *me*', lead: 'A little background.', intro: 'I make things that are clear, useful and good to look at.', body: 'I work directly with every client, from the first call to the final file.\nYou will always know what is happening and what it costs.' }),
      contactPage(b, s, { title: 'Let\'s *work together*', lead: 'Tell me about your project, timeline and budget.', formTitle: 'Project enquiry' }),
    ],
  },

  event: {
    theme: { palette: 'neon', fonts: 'friendly', shape: 'round', scheme: 'dark' },
    nav: 'nav-classic',
    tone: 'exciting, clear, practical',
    defaults: () => ({}),
    meta: (b) => ({ title: `${b.name}${b.date ? ` — ${b.date}` : ''}`, description: `${b.name}${b.date ? `, ${b.date}` : ''}${b.venue ? ` at ${b.venue}` : inTown(b)}. Times, tickets and how to get there.` }),
    blurb: (b) => `${b.name}${b.date ? ` · ${b.date}` : ''}`,
    pages: (b, s) => [
      {
        slug: '',
        label: 'Home',
        title: '',
        description: '',
        sections: [
          S('hero-image', { eyebrow: [b.date, b.venue || b.town].filter(Boolean).join(' · ') || 'Save the date', title: pick(b, ['One night. *Be there.*', 'You will *want* to be there']), lead: b.about ? b.about.slice(0, 200) : 'Good people, great sounds and a night to remember.', primary: { label: 'Get tickets', href: b.bookingUrl || route('info') }, secondary: { label: 'What\'s on', href: route('info') }, image: s?.hero, facts: [...(b.date ? [{ icon: 'calendar', label: 'When', value: b.date }] : []), ...(b.venue || b.town ? [{ icon: 'pin', label: 'Where', value: [b.venue, b.town].filter(Boolean).join(', ') }] : []), { icon: 'ticket', label: 'Tickets', value: 'On sale now' }] }),
          S('features-grid', { eyebrow: 'What to expect', title: 'The *night*', items: [{ icon: 'music', title: 'Live music', text: 'Acts all evening on the main stage.' }, { icon: 'utensils', title: 'Food & drink', text: 'Street food and a proper bar.' }, { icon: 'users', title: 'Good company', text: 'Bring friends, make new ones.' }] }),
          ...(b.schedule?.length ? [S('event-schedule', { eyebrow: 'Running order', title: 'The *timings*', items: b.schedule }, 'alt')] : []),
          S('gallery-strip', { eyebrow: 'Last time', title: 'Moments', images: galleryOf(s, 6) }),
          closing(b, 'Get your tickets', 'Do not leave it to the last minute.'),
          S('map', { eyebrow: 'Getting there', title: 'Find the *venue*', note: '' }, 'alt'),
        ],
      },
      { slug: 'info', label: 'Info', title: 'Info', description: `Tickets, times and FAQs for ${b.name}.`, sections: [S('page-header', { eyebrow: 'Info', title: 'Good to *know*', lead: 'Tickets, timings and practical details.' }, 'alt'), ...(b.schedule?.length ? [S('event-schedule', { title: 'Timings', items: b.schedule, link: b.bookingUrl ? { label: 'Get tickets', href: b.bookingUrl } : undefined })] : []), S('faq', { title: 'Questions', items: [{ q: 'Is there an age limit?', a: 'Please check the ticket page for age restrictions.' }, { q: 'Is the venue accessible?', a: 'Contact us before the day and we will make sure you are looked after.' }, { q: 'Can I get a refund?', a: 'Tickets are refundable if the event is cancelled.' }] }, 'alt')] },
      contactPage(b, s, { title: 'Get in *touch*', lead: 'Questions about the event? Ask away.' }),
    ],
  },

  charity: {
    theme: { palette: 'charity', fonts: 'editorial', shape: 'round', scheme: 'light' },
    nav: 'nav-classic',
    tone: 'warm, hopeful, practical',
    defaults: () => ({}),
    meta: (b) => ({ title: `${b.name}${inTown(b)}`, description: `${b.name}: who we help${inTown(b)}, how to get involved and how to donate.` }),
    blurb: (b) => `${b.name}${inTown(b)}.`,
    pages: (b, s) => [
      {
        slug: '',
        label: 'Home',
        title: '',
        description: '',
        sections: [
          S('hero-centered', { eyebrow: b.town ? `Community · ${b.town}` : 'Community', title: pick(b, ['Neighbours *helping* neighbours', 'Together we *go further*']), lead: b.about ? b.about.slice(0, 220) : 'We are a local group making life a little easier for the people around us.', primary: { label: 'Donate', href: b.donateUrl || route('donate') }, secondary: { label: 'Volunteer', href: route('get-involved') }, images: [s?.gallery[0], s?.hero, s?.gallery[1]].filter(Boolean).map((image) => ({ image })) }),
          ...statsBlock(b),
          S('media-text', { rows: [{ eyebrow: 'What we do', title: 'Help that is *close to home*', text: 'Run by volunteers, for the community we live in. Every pound and every hour goes straight into the work.', image: s?.story[0], link: { label: 'About us', href: route('about') } }] }, 'alt'),
          S('features-grid', { eyebrow: 'Get involved', title: 'Ways to *help*', items: [{ icon: 'heart', title: 'Give', text: 'A one-off or monthly gift keeps us going.', link: { label: 'Donate', href: b.donateUrl || route('donate') } }, { icon: 'hand', title: 'Volunteer', text: 'An hour a week makes a real difference.', link: { label: 'Volunteer', href: route('get-involved') } }, { icon: 'users', title: 'Spread the word', text: 'Tell a friend, share a post, invite us to talk.' }] }),
          ...reviewsBlock(b, 'In their words', 'alt'),
          closing(b, 'Every bit helps.', 'Give today, or give an hour.'),
        ],
      },
      aboutPage(b, s, { title: 'Who *we are*', lead: 'Our story and what we stand for.', intro: `${b.name} began with a few people who wanted to help.`, body: 'We are still small and proud of it — close enough to know the people we help by name.' }),
      { slug: 'get-involved', label: 'Get involved', title: 'Get involved', description: `Volunteer with ${b.name}.`, sections: [S('page-header', { eyebrow: 'Get involved', title: 'Join *us*', lead: 'No experience needed — just a little time and a lot of kindness.' }, 'alt'), S('contact-form', { kind: 'contact', title: 'Volunteer with us', lead: 'Tell us a little about yourself and when you are free.', formTitle: 'I would like to help' })] },
      { slug: 'donate', label: 'Donate', title: 'Donate', description: `Donate to ${b.name}.`, sections: [S('page-header', { eyebrow: 'Donate', title: 'Give *today*', lead: 'Thank you — every gift goes straight into the work.' }, 'alt'), S('donate', { title: 'Choose a gift', options: [{ amount: '£5', title: 'A small gift', text: '' }, { amount: '£10', title: 'A kind gift', text: '' }, { amount: '£25', title: 'A big help', text: '' }], link: b.donateUrl ? { label: 'Donate securely', href: b.donateUrl } : undefined })] },
    ],
  },

  saas: {
    theme: { palette: 'saas', fonts: 'tech', shape: 'soft', scheme: 'light' },
    nav: 'nav-classic',
    tone: 'crisp, benefit-led, plain English',
    defaults: () => ({ services: [{ name: 'Starter', price: '£0', description: 'For trying it out' }, { name: 'Pro', price: '£12', description: 'For individuals who rely on it' }, { name: 'Team', price: '£29', description: 'For teams of up to ten' }] }),
    meta: (b) => ({ title: `${b.name}${b.tagline ? ` — ${b.tagline}` : ''}`, description: b.tagline ?? `${b.name}: do more in less time. Start free.` }),
    blurb: (b) => b.tagline ?? `${b.name}.`,
    pages: (b, s) => [
      {
        slug: '',
        label: 'Home',
        title: '',
        description: '',
        sections: [
          S('hero-app', { eyebrow: 'New · now in public beta', title: b.tagline ? b.tagline : pick(b, ['Get hours of your *week back*', 'The simple way to *stay on top*']), lead: b.about ? b.about.slice(0, 200) : `${b.name} takes the busywork off your plate so you can focus on the part you are good at.`, primary: { label: 'Start free', href: route('pricing') }, secondary: { label: 'See how it works', href: route('features') }, note: 'Free plan · no card needed' }),
          S('features-grid', { eyebrow: 'Features', title: 'Everything in *one place*', items: [{ icon: 'bolt', title: 'Fast to set up', text: 'Up and running in minutes, not weeks.' }, { icon: 'layers', title: 'Works with your tools', text: 'Connects to what you already use.' }, { icon: 'lock', title: 'Private by design', text: 'Your data is yours, encrypted and never sold.' }, { icon: 'chart', title: 'See what matters', text: 'Clear reports without the spreadsheet.' }, { icon: 'users', title: 'Built for teams', text: 'Share, assign and comment in one place.' }, { icon: 'globe', title: 'Anywhere', text: 'On your phone, tablet and desktop.' }] }, 'alt'),
          S('process-steps', { eyebrow: 'How it works', title: 'Three steps to *done*', steps: [{ title: 'Sign up', text: 'Create an account in under a minute.' }, { title: 'Connect', text: 'Bring in what you already have.' }, { title: 'Relax', text: 'Let it handle the routine work.' }] }),
          S('pricing-cards', { eyebrow: 'Pricing', title: 'Simple, fair *pricing*', plans: (b.services ?? []).slice(0, 3).map((p, i) => ({ name: p.name, price: p.price ?? '', per: i ? '/month' : '', text: p.description ?? '', features: [['Core features', 'Up to 3 projects'], ['Everything in Starter', 'Unlimited projects', 'Priority support'], ['Everything in Pro', 'Team workspace', 'Admin controls']][i] ?? [], cta: { label: i ? 'Start free trial' : 'Start free', href: route('contact') } })) }, 'alt'),
          S('faq', { eyebrow: 'FAQ', title: 'Questions', items: [{ q: 'Is there a free plan?', a: 'Yes, free for as long as you like.' }, { q: 'Can I cancel any time?', a: 'Yes, from your account settings, no questions asked.' }, { q: 'Where is my data stored?', a: 'In the UK/EU, encrypted at rest and in transit.' }] }),
          closing(b, 'Ready to try it?', 'Start free today.'),
        ],
      },
      { slug: 'features', label: 'Features', title: 'Features', description: `What ${b.name} does.`, sections: [S('page-header', { eyebrow: 'Features', title: 'Built to *save you time*', lead: '' }, 'alt'), S('features-list', { title: 'In detail', items: [{ title: 'Automations', text: 'Repeat jobs run themselves.' }, { title: 'Reports', text: 'The numbers that matter, at a glance.' }, { title: 'Integrations', text: 'Connect your favourite tools.' }, { title: 'Mobile apps', text: 'Everything on the go.' }] })] },
      { slug: 'pricing', label: 'Pricing', title: 'Pricing', description: `Plans and prices for ${b.name}.`, sections: [S('page-header', { eyebrow: 'Pricing', title: 'Plans for *every size*', lead: 'Start free, upgrade when you need to.' }, 'alt'), S('comparison', { title: 'Compare plans', plans: (b.services ?? []).slice(0, 3).map((p) => p.name), rows: [{ feature: 'Projects', values: ['3', 'Unlimited', 'Unlimited'] }, { feature: 'Integrations', values: ['yes', 'yes', 'yes'] }, { feature: 'Priority support', values: ['no', 'yes', 'yes'] }, { feature: 'Team workspace', values: ['no', 'no', 'yes'] }] })] },
      contactPage(b, s, { title: 'Talk to *us*', lead: 'Questions, demos or partnerships.' }),
    ],
  },
};

// ── the plan ────────────────────────────────────────────────────────────────────────

/** Fill what the owner did not give with the kind's typical facts, and say which. */
export function withDefaults(b: Brief): { brief: Brief; confirm: string[] } {
  const t = TEMPLATES[b.kind];
  const d = t.defaults(b);
  const out: Brief = { ...b };
  const confirm: string[] = [];
  if (!out.name) {
    out.name = `${b.town ? `${b.town} ` : ''}${({ barber: 'Barbers', salon: 'Salon', cafe: 'Café', restaurant: 'Kitchen', trades: 'Services', gym: 'Gym', photographer: 'Photography', clinic: 'Clinic', estate: 'Estates', shop: 'Shop', portfolio: 'Studio', event: 'Live', charity: 'Community Trust', saas: 'App' } as Record<KindId, string>)[b.kind]}`;
    confirm.push(`the business name (I used "${out.name}")`);
  }
  if (!out.services?.length && d.services) {
    out.services = d.services;
    confirm.push('services and prices (typical ones for the area are shown)');
  }
  if (!out.hours?.length && d.hours) {
    out.hours = d.hours;
    confirm.push('opening hours (typical ones are shown)');
  }
  if (!out.phone && !out.email) confirm.push('a phone number or email (the forms need one to reach you)');
  if (!out.address && !out.postcode && b.kind !== 'saas' && b.kind !== 'portfolio') confirm.push('the street address (the map shows the town only)');
  return { brief: out, confirm };
}

/** The whole plan for a brief, from the template alone (no model). */
export function planFrom(input: Brief, o: { url?: string; theme?: Partial<Theme>; stock?: (kind: KindId) => StockSet | undefined } = {}): { plan: Plan; brief: Brief } {
  const { brief: b, confirm } = withDefaults(input);
  const t = TEMPLATES[b.kind];
  const s = (o.stock ?? stockFor)(b.kind);
  const pages = t.pages(b, s).map((p) => ({ ...p, sections: p.sections.map((x) => ({ ...x, data: clean(x.data) })) }));
  const home = pages[0]!;
  const meta = t.meta(b);
  home.title = meta.title;
  home.description = meta.description.slice(0, 160);
  for (const p of pages) if (!p.description) p.description = home.description;
  const pageWords = pages.some((p) => p.sections.some((x) => x.block === 'faq')) ? ['FAQ answers (typical ones are shown)'] : [];
  const announce = t.announce?.(b);
  const plan: Plan = {
    kind: b.kind,
    name: b.name,
    theme: { ...t.theme, ...o.theme },
    tone: t.tone,
    header: [...(announce ? [S('announce', { text: announce, icon: b.kind === 'trades' ? 'phone' : 'clock' })] : []), S(t.nav, {})],
    footer: [S('footer-columns', { blurb: t.blurb(b) })],
    pages,
    ...(o.url ? { url: o.url } : {}),
    confirm: [...confirm, ...pageWords],
  };
  return { plan, brief: b };
}

/** Drop undefined values and empty pictures from section data (templates use `s?.hero` freely). */
function clean(v: Record<string, unknown>): Record<string, unknown> {
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk).filter((y) => y !== undefined && !(y && typeof y === 'object' && !Array.isArray(y) && 'image' in (y as object) && (y as { image?: unknown }).image === undefined));
    if (x && typeof x === 'object' && !(x as ImageRef).src) return Object.fromEntries(Object.entries(x).filter(([, y]) => y !== undefined).map(([k, y]) => [k, walk(y)]));
    return x;
  };
  return walk(v) as Record<string, unknown>;
}

