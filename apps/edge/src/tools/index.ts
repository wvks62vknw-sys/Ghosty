/**
 * KERNEL — protected. Every tool Ghosty can use.
 * New abilities go in tools/extra.ts (unprotected); they're merged in here, but can never
 * replace a built-in tool.
 */
import type { ToolSpec } from '../llm/router';
import { agendaTools } from './agenda';
import { dataTools } from './data';
import { emailTools } from './email';
import { evolveTools } from './evolve';
import { extraTools } from './extra';
import { highwaysTools } from './highways';
import { knowledgeTools } from './knowledge';
import { lensTools } from './lens';
import { libraryTools } from './library';
import { mediaTools } from './media';
import { notifyTools } from './notify';
import { picturesTools } from './pictures';
import { crimeTools } from './crime';
import { trafficTools } from './traffic';
import { transitTools } from './transit';
import { mapTools } from './maps';
import { travelTools } from './travel';
import { memoryTools } from './memory';
import { reconTools } from './recon';
import { repoTools } from './repo';
import { reverseTools } from './reverse';
import { siteTools } from './sites';
import { spotifyTools } from './spotify';
import type { Tool } from './types';
import { uiTools } from './ui';
import { webTools } from './web';
import { widgetTools } from './widgets';

const CORE: Tool[] = [...memoryTools, ...agendaTools, ...webTools, ...dataTools, ...travelTools, ...trafficTools, ...highwaysTools, ...transitTools, ...mapTools, ...crimeTools, ...mediaTools, ...emailTools, ...spotifyTools, ...notifyTools, ...picturesTools, ...uiTools, ...lensTools, ...widgetTools, ...siteTools, ...knowledgeTools, ...libraryTools, ...evolveTools, ...repoTools, ...reverseTools, ...reconTools];
const coreNames = new Set(CORE.map((t) => t.name));

export const TOOLS: Tool[] = [...CORE, ...extraTools.filter((t) => t && typeof t.name === 'string' && /^[a-z][a-z0-9_]{1,63}$/.test(t.name) && !coreNames.has(t.name))];

export const toolByName = new Map(TOOLS.map((t) => [t.name, t]));

export function toolSpecs(list: Tool[] = TOOLS): ToolSpec[] {
  return list.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

/**
 * A group of tools offered together. `about` is the one sentence the prompt gives the model
 * about the group ("you can …", naming the tools): it carries the rules the model needs when
 * the group is on, and when it is off the prompt names the group's tools instead. Optional in
 * the type only so a branch that adds a group still compiles before it writes one; the prompt
 * test requires it for every group here.
 */
export interface ToolGroup {
  name: string;
  tools: Tool[];
  /** When the group's tools are described in full: always, on a coding turn, or when the owner's words match. */
  when: RegExp | 'always' | 'code';
  about?: string;
}

/**
 * Tool groups, offered to the model only when a message needs them: describing every tool on
 * every request costs ~12,000 tokens, which is most of a free model's per-minute allowance.
 * Any tool can still be called by name (the prompt names every group's tools), and a group
 * stays on once the conversation has used it.
 */
const extras = TOOLS.filter((t) => !coreNames.has(t.name));
export const TOOL_GROUPS: ToolGroup[] = [
  { name: 'memory', tools: memoryTools, when: 'always', about: 'You can remember lasting facts the owner tells you (remember), list them (list_memory) and drop one (forget); forget_everything needs approval.' },
  { name: 'web', tools: webTools, when: 'always', about: 'You can search the web (web_search) and read any page or JSON address (web_fetch) — use them for anything current or that you are unsure about; never invent live data.' },
  {
    name: 'ui',
    tools: uiTools,
    when: 'always',
    about: "You can drive the interface (open_tab, fly_to, set_layer, set_theme, set_sensor_mode), follow the owner's drive (road_ahead) and open their camera (open_lens: SEE objects, READ text, HANDS gestures, ASK about a picture).",
  },
  {
    name: 'widgets',
    tools: widgetTools,
    when: /\b(widget|game|play|app|tool|timer|calculator|converter|tracker|counter|quiz|puzzle|make me|build me|create)/i,
    about: 'You can install instant widgets (create_widget: one HTML document on the GK kit — games, tools, trackers; list_widgets, delete_widget); a tool for the owner alone is a widget, not a published page.',
  },
  { name: 'extra', tools: extras, when: 'always', about: 'You can also use the extra abilities added to your tools/extra.ts (always described in full).' },
  {
    name: 'sites',
    tools: siteTools,
    when: /\b(websites?|site|sites|web ?pages?|landing page|home ?page|portfolio|blog|shop|store|storefront|online (?:shop|store|cv|menu)|cv|resume|résumé|invitation|invite|poster|menu page|a page (?:for|about)|put .{0,30}online|url|clone|rebuild|recreate|remake|redesign|copy (this|that|the)|deploy|publish|published|unpublish|take (it|that|.{0,20}) down|host(ing)?|live link|link again)\b|https?:\/\/|\bwww\.|\.(com|co\.uk|io|org|net|dev|app)\b/i,
    // The rule the owner cares about most, so it stays forceful: a page is delivered by its link.
    about: "You can PUBLISH websites: any site, page, portfolio, CV, shop or invitation the owner asks for, or a site to clone or rebuild — DO IT, never reply that you can't host or publish: study_site a link first, write ONE complete HTML document, publish_site, and ALWAYS give the exact live link.",
  },
  {
    name: 'agenda',
    tools: agendaTools,
    when: /\b(remind|reminder|alarm|wake|schedule|scheduled|calendar|event|agenda|meeting|appointment|diary|today|tomorrow|tonight|week|every|daily|at \d|in \d+ ?(min|hour)|plans?)\b/i,
    about: "You can keep the owner's agenda (add_event, list_agenda, calendar feeds), set reminders and alarms (set_reminder) and do things later or on a schedule yourself (schedule_task; the result arrives as a notification).",
  },
  {
    name: 'data',
    tools: dataTools,
    when: /\b(weather|forecast|rain|snow|temperature|hot|cold|wind|umbrella|quake|earthquake|seismic)\b/i,
    about: "You can give the weather, air quality and 3-day forecast anywhere (weather: a place, or the owner's own lat/lon from CONTEXT) and recent earthquakes (earthquakes).",
  },
  {
    name: 'travel',
    tools: travelTools,
    when: /\b(direction|directions|route|drive|driving|walk|walking|cycle|cycling|bike|near|nearby|nearest|closest|restaurant|cafe|shop|how far|get to|way to|navigate|petrol|station)\b/i,
    about: "You can give directions by car, foot or bike, drawn on the globe (get_directions), and find places nearby (find_nearby); both default to the owner's location.",
  },
  {
    name: 'traffic',
    tools: trafficTools,
    when: /\b(tomtom|street data|speeds?|incidents?|cams?|cameras?|cctv|webcams?|traffic|jams?|congestion|roads?|motorway|highway|accidents?|crash|closures?|roadworks|commute|rush hour|live view|god'?s eye|see (it|there|.+) live|street ?views?|street level|look around|walk around|satellite)\b/i,
    about: "You can show live road cameras on God's Eye (show_cameras: the West Midlands motorways, London, Durham, New York, California, Finland, Canada, Sydney; a city's own streets may have none, e.g. Birmingham's — say so plainly and show the nearest motorway camera), live traffic anywhere (traffic_now: Waze, and TomTom speeds with the key) and Street View (street_view).",
  },
  {
    // Motorway incidents and live buses/trams: described only when roads or public transport come up.
    name: 'roads',
    tools: [...highwaysTools, ...transitTools],
    when: /\b(bus|buses|tram|trams|transit|metro|public transport|motorways?|m6|m5|m42|m54|m6 toll|a38|incidents?|junctions?|spaghetti|roadworks|closures?|delays?|traffic)\b/i,
    about: 'You can list live motorway incidents worst first, with delays and when they clear (motorway_now: National Highways), and live buses and trams near a place (transit_now: TfWM/BODS key, else bustimes.org; no trains).',
  },
  {
    name: 'crime',
    tools: crimeTools,
    when: /\b(crimes?|criminal|safe|safety|dangerous|rough area|burglar(y|ies)|robber(y|ies)|theft|thefts|stolen|stabbing|stabbings|assaults?|anti-?social|police|mugging|muggings|shoplifting|drug dealing)\b/i,
    about: 'You can report street crime around any place in England, Wales or Northern Ireland (crime_near: police.uk open data, latest month, by type and street; nobody identified).',
  },
  {
    name: 'maps',
    tools: mapTools,
    when: /\b(maps?|map of|map it|on (the|a) map|3-?d|three-?d|vector map|buildings|elevation|altitude|how high|above sea level|post ?codes?|what(?:'s| is) (?:here|there|this|that|at)|landmarks?|wikipedia|nearby|measure|distance (?:between|from|to)|as the crow flies|crow flies|topo(?:graphic)?|terrain|contours?|cycle (?:map|route)|rail(?:way)? (?:map|lines?)|sea ?marks?|nautical|where is|where'?s)\b/i,
    about: 'You can open flat and 3D maps (show_map: streets, dark, topo, cycle or satellite; rail, sea, rain and camera overlays; view 3d), say what is at a spot (what_is_here), plus elevation, uk_postcode and measure_distance.',
  },
  {
    name: 'email',
    tools: emailTools,
    when: /\b(e-?mails?|inbox|mail|gmail|reply|replied|unread|send (a |an )?(message|note) to)\b/i,
    about: "You can check, search and read the owner's email once linked (check_email, search_email, read_email) and send as them (send_email — always waits for approval).",
  },
  { name: 'media', tools: mediaTools, when: /\b(radio|music|song|songs|play|station|listen|stop audio|stop the music|volume)\b/i, about: 'You can play internet radio in the interface (play_radio: a station name or a genre, optional country) and stop it (stop_audio).' },
  {
    name: 'library',
    tools: libraryTools.filter((t) => t.name === 'library_search'),
    when: 'always',
    about: 'You can search your permanent library — books, PDFs, papers, notes, code and the built-in starter library — without any AI (library_search; relevant passages are also looked up for you automatically); cite the source.',
  },
  {
    name: 'library-admin',
    tools: libraryTools.filter((t) => t.name !== 'library_search'),
    when: /\b(library|import|arxiv|cve-?\d*|github|paper|papers|repo|repository|save (this|that)|read (this|that)|add (this|that))\b/i,
    about: "You can grow the library (library_import: pages, arXiv, CVEs, GitHub repos, Gutenberg books, 'self'), list it (library_list), report and steer your self-study (study_progress, focus_study), export it (library_export).",
  },
  { name: 'notify', tools: notifyTools, when: /\b(push|notify|notification|notifications|ping|alert me|phone|text me|let me know)\b/i, about: "You can send a push notification to the owner's phone right now (push_to_phone; it is kept in the Agenda inbox too)." },
  {
    name: 'pictures',
    tools: picturesTools,
    when: /\b(picture|image|draw|paint|illustrat|logo|wallpaper|poster|artwork|sketch|render|generate .*(image|picture))/i,
    about: 'You can make pictures (make_picture: write the whole scene out in English yourself — subject, style, light, mood); the chat shows the picture, Telegram gets it as a photo, and the link lasts 7 days.',
  },
  {
    name: 'spotify',
    tools: spotifyTools,
    when: /\b(spotify|song|songs|music|track|album|artist|playlist|playing|pause|skip|next song|previous song|shuffle|volume|queue)\b/i,
    about: "You can see and control the owner's Spotify once linked: spotify_now_playing, spotify_control (pause, skip, volume), spotify_play (track, album, artist, playlist), spotify_queue, spotify_playlists, spotify_devices.",
  },
  {
    name: 'knowledge',
    tools: knowledgeTools,
    when: /\b(study|learn|lessons?|handbook|playbooks?)\b/i,
    about: 'You can study your engineering handbook before building (study: playbooks with exact code for this codebase) and keep lessons from your own mistakes (learn_lesson, list_lessons, forget_lesson).',
  },
  {
    name: 'evolve',
    tools: evolveTools,
    when: /\b(upgrade|improve yourself|better version|roadmap|carry on|continue|audit)\b/i,
    about: 'You can upgrade yourself in steps: self_audit (what you are now), plan_upgrade (a roadmap of small changes that each ship), roadmap (where you are when the owner says "carry on") and update_step.',
  },
  {
    name: 'reverse',
    tools: reverseTools,
    when: /\b(reverse[- ]?engineer(ing)?|decompile|disassemble|analy[sz]e (this|that|the) (app|site|website|package|binary|apk|file)|what is .* built with|how does .* work under the hood|rea\b)/i,
    about: "You can reverse-engineer software the owner owns or may test — a website, an npm package, a GitHub repository or a file link — on GitHub's runners (reverse_engineer, 3–8 minutes; reverse_status, reverse_jobs).",
  },
  {
    name: 'repo',
    tools: repoTools,
    when: /\b(ship|propose|proposed|changes?|versions?|roll ?back|restore|discard|preview|workshop|repo|source code)\b/i,
    about: 'You can change your OWN source code: repo_tree, repo_read, repo_read_many, repo_search to look; propose_change, then wait_for_checks (fix with update_change); ship_change and restore_version need approval.',
  },
  // Passive infrastructure recon: only when a domain, host, address or one of its words comes up.
  {
    name: 'recon',
    tools: reconTools,
    when: /\b(recon|reconnaissance|dns|whois|rdap|registrar|registered|certificates?|certs?|crt\.sh|subdomains?|wayback|archive\.org|snapshots?|fingerprint|security headers|hsts|open ports?|shodan|spf|dmarc|look ?up|lookup|who (?:owns|runs|hosts)|hosted|hosting|name ?servers?|mx records?|ip address)\b|\b\d{1,3}(?:\.\d{1,3}){3}\b|\b[a-z0-9-]+\.(?:com|co\.uk|org|net|io|dev|app|uk|ac\.uk|gov\.uk|edu|info|me)\b/i,
    about: "You can run passive recon on a domain, host, IP or web address — infrastructure only, never a person (refuse a name or an email address and say why): recon_domain does every public-record check at once; its pieces are dns_lookup, whois_rdap, cert_search, subdomains, wayback_lookup, ip_lookup (servers only, never an address from someone's message) and http_fingerprint.",
  },
  {
    name: 'lens',
    tools: lensTools,
    when: /\b(reverse image|image search|search by image|where is this (?:picture|photo|image) from|picture link|photo link|google lens|tineye|yandex)\b|https?:\/\/\S+\.(?:jpe?g|png|webp|gif)\b/i,
    about: 'You can give reverse image search links for a picture at a public web address (reverse_image_links: Google Lens, Bing Visual Search, Yandex Images and TinEye, each named plainly; never to find who a person is).',
  },
];

/** Groups that are always on while the conversation is about building things. */
const CODE_GROUPS = new Set(['widgets', 'evolve', 'knowledge', 'repo']);

/**
 * The groups for this request: `on` (always-on groups, groups the words call for, groups
 * already in use, the coding groups on a coding turn) are described in full; `off` groups are
 * named in the prompt so their tools can still be called by name. An empty group is nothing.
 */
export function selectGroups(text: string, used: Set<string>, code = false): { on: ToolGroup[]; off: ToolGroup[] } {
  const on: ToolGroup[] = [];
  const off: ToolGroup[] = [];
  for (const g of TOOL_GROUPS) {
    if (!g.tools.length) continue;
    const pick = g.when === 'always' || (g.when === 'code' ? code : g.when.test(text)) || (code && CODE_GROUPS.has(g.name)) || g.tools.some((t) => used.has(t.name));
    (pick ? on : off).push(g);
  }
  return { on, off };
}

/** The tools to offer for this request (see selectGroups). */
export function selectTools(text: string, used: Set<string>, code = false): Tool[] {
  return selectGroups(text, used, code).on.flatMap((g) => g.tools);
}

export const ALL_TOOL_NAMES = TOOLS.map((t) => t.name).join(', ');
