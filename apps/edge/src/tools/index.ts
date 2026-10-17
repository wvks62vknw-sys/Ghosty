/**
 * KERNEL — protected. Every tool Ghosty can use.
 * New abilities go in tools/extra.ts (unprotected); they're merged in here, but can never
 * replace a built-in tool.
 */
import type { ToolSpec } from '../llm/router';
import { agendaTools } from './agenda';
import { checkTools } from './check';
import { dataTools } from './data';
import { emailTools } from './email';
import { evolveTools } from './evolve';
import { extraTools } from './extra';
import { knowledgeTools } from './knowledge';
import { libraryTools } from './library';
import { mediaTools } from './media';
import { notifyTools } from './notify';
import { crimeTools } from './crime';
import { trafficTools } from './traffic';
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

const CORE: Tool[] = [...memoryTools, ...agendaTools, ...webTools, ...dataTools, ...travelTools, ...trafficTools, ...mapTools, ...crimeTools, ...mediaTools, ...emailTools, ...spotifyTools, ...notifyTools, ...uiTools, ...widgetTools, ...siteTools, ...checkTools, ...knowledgeTools, ...libraryTools, ...evolveTools, ...repoTools, ...reverseTools, ...reconTools];
const coreNames = new Set(CORE.map((t) => t.name));

export const TOOLS: Tool[] = [...CORE, ...extraTools.filter((t) => t && typeof t.name === 'string' && /^[a-z][a-z0-9_]{1,63}$/.test(t.name) && !coreNames.has(t.name))];

export const toolByName = new Map(TOOLS.map((t) => [t.name, t]));

export function toolSpecs(list: Tool[] = TOOLS): ToolSpec[] {
  return list.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

/**
 * Tool groups, offered to the model only when a message needs them: describing every tool on
 * every request costs ~5,000 tokens, which is most of a free model's per-minute allowance.
 * Any tool can still be called by name (the prompt lists all names), and a group stays on once
 * the conversation has used it.
 */
const extras = TOOLS.filter((t) => !coreNames.has(t.name));
/** `about`: one sentence for the prompt's list of what Ghosty can do ("you can …"). */
export const TOOL_GROUPS: { name: string; tools: Tool[]; when: RegExp | 'always' | 'code'; about?: string }[] = [
  { name: 'memory', tools: memoryTools, when: 'always' },
  { name: 'web', tools: webTools, when: 'always' },
  { name: 'ui', tools: uiTools, when: 'always' },
  { name: 'widgets', tools: widgetTools, when: /\b(widget|game|play|app|tool|timer|calculator|converter|tracker|counter|quiz|puzzle|make me|build me|create)/i },
  { name: 'extra', tools: extras, when: 'always' },
  { name: 'sites', tools: siteTools, when: /\b(websites?|site|sites|web ?pages?|landing page|home ?page|portfolio|blog|shop|store|storefront|online (?:shop|store|cv|menu)|cv|resume|résumé|invitation|invite|poster|menu page|a page (?:for|about)|put .{0,30}online|url|clone|rebuild|recreate|remake|redesign|copy (this|that|the)|deploy|publish|published|unpublish|take (it|that|.{0,20}) down|host(ing)?|live link|link again)\b|https?:\/\/|\bwww\.|\.(com|co\.uk|io|org|net|dev|app)\b/i },
  // The quality gate: also on for every coding turn (selectTools), since every page, app and widget goes through it.
  {
    name: 'build',
    tools: checkTools,
    when: /\b(check|test|verify|review|broken|bug|fix|polish|improve|better|perfect)\b/i,
    about: 'you can check any page, app or widget with check_html before handing it over (broken tags, script errors, what the sandbox blocks, missing basics — line by line); publish_site refuses a page with errors',
  },
  { name: 'agenda', tools: agendaTools, when: /\b(remind|reminder|alarm|wake|schedule|scheduled|calendar|event|agenda|meeting|appointment|diary|today|tomorrow|tonight|week|every|daily|at \d|in \d+ ?(min|hour)|plans?)\b/i },
  { name: 'data', tools: dataTools, when: /\b(weather|forecast|rain|snow|temperature|hot|cold|wind|umbrella|quake|earthquake|seismic)\b/i },
  { name: 'travel', tools: travelTools, when: /\b(direction|directions|route|drive|driving|walk|walking|cycle|cycling|bike|near|nearby|nearest|closest|restaurant|cafe|shop|how far|get to|way to|navigate|petrol|station)\b/i },
  { name: 'traffic', tools: trafficTools, when: /\b(tomtom|street data|speeds?|incidents?|cams?|cameras?|cctv|webcams?|traffic|jams?|congestion|roads?|motorway|highway|accidents?|crash|closures?|roadworks|commute|rush hour|live view|god'?s eye|see (it|there|.+) live|street ?views?|street level|look around|walk around|satellite)\b/i },
  { name: 'crime', tools: crimeTools, when: /\b(crimes?|criminal|safe|safety|dangerous|rough area|burglar(y|ies)|robber(y|ies)|theft|thefts|stolen|stabbing|stabbings|assaults?|anti-?social|police|mugging|muggings|shoplifting|drug dealing)\b/i },
  { name: 'maps', tools: mapTools, when: /\b(maps?|map of|map it|on (the|a) map|3-?d|three-?d|vector map|buildings|elevation|altitude|how high|above sea level|post ?codes?|what(?:'s| is) (?:here|there|this|that|at)|landmarks?|wikipedia|nearby|measure|distance (?:between|from|to)|as the crow flies|crow flies|topo(?:graphic)?|terrain|contours?|cycle (?:map|route)|rail(?:way)? (?:map|lines?)|sea ?marks?|nautical|where is|where'?s)\b/i },
  { name: 'email', tools: emailTools, when: /\b(e-?mails?|inbox|mail|gmail|reply|replied|unread|send (a |an )?(message|note) to)\b/i },
  { name: 'media', tools: mediaTools, when: /\b(radio|music|song|songs|play|station|listen|stop audio|stop the music|volume)\b/i },
  { name: 'library', tools: libraryTools.filter((t) => t.name === 'library_search'), when: 'always' },
  { name: 'library-admin', tools: libraryTools.filter((t) => t.name !== 'library_search'), when: /\b(library|import|arxiv|cve-?\d*|github|paper|papers|repo|repository|save (this|that)|read (this|that)|add (this|that))\b/i },
  { name: 'notify', tools: notifyTools, when: /\b(push|notify|notification|notifications|ping|alert me|phone|text me|let me know)\b/i },
  { name: 'spotify', tools: spotifyTools, when: /\b(spotify|song|songs|music|track|album|artist|playlist|playing|pause|skip|next song|previous song|shuffle|volume|queue)\b/i },
  { name: 'knowledge', tools: knowledgeTools, when: /\b(study|learn|lessons?|handbook|playbooks?)\b/i },
  { name: 'evolve', tools: evolveTools, when: /\b(upgrade|improve yourself|better version|roadmap|carry on|continue|audit)\b/i },
  { name: 'reverse', tools: reverseTools, when: /\b(reverse[- ]?engineer(ing)?|decompile|disassemble|analy[sz]e (this|that|the) (app|site|website|package|binary|apk|file)|what is .* built with|how does .* work under the hood|rea\b)/i },
  { name: 'repo', tools: repoTools, when: /\b(ship|propose|proposed|changes?|versions?|roll ?back|restore|discard|preview|workshop|repo|source code)\b/i },
  // Passive infrastructure recon: only when a domain, host, address or one of its words comes up.
  { name: 'recon', tools: reconTools, when: /\b(recon|reconnaissance|dns|whois|rdap|registrar|registered|certificates?|certs?|crt\.sh|subdomains?|wayback|archive\.org|snapshots?|fingerprint|security headers|hsts|open ports?|shodan|spf|dmarc|look ?up|lookup|who (?:owns|runs|hosts)|hosted|hosting|name ?servers?|mx records?|ip address)\b|\b\d{1,3}(?:\.\d{1,3}){3}\b|\b[a-z0-9-]+\.(?:com|co\.uk|org|net|io|dev|app|uk|ac\.uk|gov\.uk|edu|info|me)\b/i },
];

/** The tools to offer for this request: always-on groups, groups the words call for, groups already in use. */
export function selectTools(text: string, used: Set<string>, code: boolean): Tool[] {
  const out: Tool[] = [];
  for (const g of TOOL_GROUPS) {
    const on = g.when === 'always' || (g.when === 'code' ? code : g.when.test(text)) || (code && ['widgets', 'build', 'evolve', 'knowledge', 'repo'].includes(g.name)) || g.tools.some((t) => used.has(t.name));
    if (on) out.push(...g.tools);
  }
  return out;
}

export const ALL_TOOL_NAMES = TOOLS.map((t) => t.name).join(', ');
