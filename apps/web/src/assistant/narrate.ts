/**
 * Narration (BRIEF-TALK-1A 3; STARS 9): what Ghosty is doing while his brain works, in his own words, from what the brain
 * already streams — his words to begin with, then the tool he runs, a tool's own report as it goes, the step after the tools —
 * never a bare "thinking". Each line is short enough to say aloud as an aside in a spoken conversation ("looking at the
 * trains…", "reading that page…", "two of five so far…"). Pure (no screen, no sound): session.ts shows and says them, and
 * apps/edge/test/speech.test.mjs holds them.
 */

/** A step of a turn and what he says it is: `key` tells one step from the next (a line is shown and said once per step). */
export interface Narration {
  key: string;
  line: string;
}

/** The tools as he would say them at work (status line and aside alike); a tool not here says its own label. */
const TOOLS: Record<string, string> = {
  web_search: 'looking that up…',
  web_fetch: 'reading that page…',
  weather: 'checking the weather…',
  earthquakes: 'checking for earthquakes…',
  get_directions: 'working out the way…',
  find_nearby: 'looking nearby…',
  plan_journey: 'looking at the trains…',
  next_departures: 'checking the departures…',
  transit_now: 'checking the trains…',
  traffic_now: 'checking the roads…',
  motorway_now: 'checking the motorways…',
  road_ahead: 'checking the road ahead…',
  show_cameras: 'finding the cameras…',
  street_view: 'finding the street…',
  show_map: 'opening the map…',
  fly_to: 'opening the map…',
  what_is_here: 'looking at the map…',
  crime_near: 'checking the crime map…',
  remember: 'noting that down…',
  forget: 'forgetting that…',
  list_memory: 'checking what I know…',
  library_search: 'checking my library…',
  library_import: 'filing that away…',
  set_reminder: 'setting that reminder…',
  schedule_task: 'setting that up…',
  add_event: 'putting it in your diary…',
  list_agenda: 'looking at your day…',
  check_email: 'checking your email…',
  search_email: 'looking through your email…',
  read_email: 'reading that email…',
  send_email: 'writing the email…',
  spotify_play: 'putting that on…',
  spotify_queue: 'queueing that up…',
  spotify_now_playing: "checking what's playing…",
  play_radio: 'finding a station…',
  make_picture: 'drawing it…',
  build_website: 'building the page…',
  draft_site: 'writing the page…',
  publish_site: 'putting it online…',
  publish_game: 'putting your game on your sites…',
  build_app: 'building the app…',
  vehicle_check: 'checking the car…',
  gadget_manual: 'finding the manual…',
  gadget_settings: 'looking up the settings…',
  find_part: 'looking for the part…',
  translate_text: 'translating…',
  lookup_barcode: 'looking up that barcode…',
  identify_plant: 'looking at the plant…',
  summarise_video: 'taking in the video…',
  check_link: 'checking that link…',
  recon_domain: 'looking into that site…',
  estimate: 'working it out…',
  tutor: 'working through it…',
  spending_summary: 'adding up your spending…',
  repo_search: 'looking through my code…',
  repo_read: 'reading my code…',
  propose_change: 'writing a change to myself…',
  design_home: 'drawing the plan…',
  foresee: 'looking ahead…',
};

/** What a tool at work is said as: its own line, else its label ("Searching the web" → "searching the web…"). */
export function toolLine(name: string, label = ''): string {
  if (TOOLS[name]) return TOOLS[name]!;
  const base = (label.split(':')[0] ?? '').trim() || name.replace(/_/g, ' ');
  return `${base.charAt(0).toLowerCase()}${base.slice(1)}…`.replace(/…+$/, '…');
}

const NUMBER = ['nothing', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const said = (n: number) => NUMBER[n] ?? String(n);

/**
 * A tool's own report as it goes: "two of five so far…" when it counts; its words when they read as what it is doing
 * ("reading bosch.com…", "searching for the manual…"); null when they say nothing he would say ("crt.sh…").
 */
export function progressLine(label: string, done?: number, total?: number): string | null {
  if (typeof done === 'number' && typeof total === 'number' && total > 1 && done >= 1 && done < total) return `${said(done)} of ${said(total)} so far…`;
  const l = label.replace(/\s+/g, ' ').trim();
  return /^[a-z]+ing\s+\S/.test(l) && l.length <= 48 ? (l.endsWith('…') ? l : `${l}…`) : null;
}

/** After the tools, while he puts the answer together: said from the last tool. */
export function afterLine(lastTool: string): string {
  if (/^(web_search|web_fetch|library_search|search_email|read_email|check_email)$/.test(lastTool)) return 'reading what I found…';
  if (/^(plan_journey|next_departures|transit_now|get_directions)$/.test(lastTool)) return 'picking the best one…';
  if (lastTool === 'weather') return 'putting the forecast together…';
  return 'putting it together…';
}

/** Before any tool, from his words: what kind of thing he asked for (a person's "on it", never "thinking"). */
export function askLine(text: string): string {
  const t = text.toLowerCase();
  if (/\b(trains?|bus(es)?|trams?|tube|journey|departures?|platform|route)\b/.test(t)) return 'working out the trains…';
  if (/\b(weather|rain(ing)?|forecast|sunny|snow|temperature)\b/.test(t)) return 'checking the weather…';
  if (/\b(news|headlines?)\b/.test(t)) return 'catching up on the news…';
  if (/\b(e-?mails?|inbox)\b/.test(t)) return 'looking at your email…';
  if (/\b(remind(er)?|diary|calendar|agenda|meeting|appointment|schedule)\b/.test(t)) return 'looking at your day…';
  if (/\b(code|bug|function|script|compile|deploy)\b/.test(t)) return 'working through the code…';
  if (/\b(write|draft|letter|essay|poem|story|email him|email her|reply to)\b/.test(t)) return 'drafting it…';
  if (/\btranslat/.test(t)) return 'translating…';
  if (/\b(read|page|article|link|https?:)/.test(t)) return 'reading that…';
  if (/\d\s*[-+*/×÷x]\s*\d|\bhow (much|many|long|far)\b/.test(t)) return 'working it out…';
  if (/^(what|why|how|who|when|where|which|is|are|can|could|should|would|will|do|does|did)\b/.test(t.trim())) return 'working that out…';
  return 'on it…';
}

/** A status the brain sends that says nothing he would say: the narration's own line shows instead. */
export const BARE = /^(?:thinking|thinking about the results|processing|working)(?:…|\.\.\.)?$/i;
