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
import { knowledgeTools } from './knowledge';
import { libraryTools } from './library';
import { mediaTools } from './media';
import { travelTools } from './travel';
import { memoryTools } from './memory';
import { repoTools } from './repo';
import { spotifyTools } from './spotify';
import type { Tool } from './types';
import { uiTools } from './ui';
import { webTools } from './web';
import { widgetTools } from './widgets';

const CORE: Tool[] = [...memoryTools, ...agendaTools, ...webTools, ...dataTools, ...travelTools, ...mediaTools, ...uiTools, ...widgetTools, ...knowledgeTools, ...libraryTools, ...evolveTools, ...repoTools];
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
export const TOOL_GROUPS: { name: string; tools: Tool[]; when: RegExp | 'always' | 'code' }[] = [
  { name: 'memory', tools: memoryTools, when: 'always' },
  { name: 'web', tools: webTools, when: 'always' },
  { name: 'ui', tools: uiTools, when: 'always' },
  { name: 'widgets', tools: widgetTools, when: /\b(widget|game|play|app|tool|timer|calculator|converter|tracker|counter|quiz|puzzle|make me|build me|create)/i },
  { name: 'extra', tools: extras, when: 'always' },
  { name: 'agenda', tools: agendaTools, when: /\b(remind|reminder|alarm|wake|schedule|scheduled|calendar|event|agenda|meeting|appointment|diary|today|tomorrow|tonight|week|every|daily|at \d|in \d+ ?(min|hour)|plans?)\b/i },
  { name: 'data', tools: dataTools, when: /\b(weather|forecast|rain|snow|temperature|hot|cold|wind|umbrella|quake|earthquake|seismic)\b/i },
  { name: 'travel', tools: travelTools, when: /\b(direction|directions|route|drive|driving|walk|walking|cycle|cycling|bike|near|nearby|nearest|closest|restaurant|cafe|shop|how far|get to|way to|navigate|petrol|station)\b/i },
  { name: 'email', tools: emailTools, when: /\b(e-?mails?|inbox|mail|gmail|reply|replied|unread|send (a |an )?(message|note) to)\b/i },
  { name: 'media', tools: mediaTools, when: /\b(radio|music|song|songs|play|station|listen|stop audio|stop the music|volume)\b/i },
  { name: 'library', tools: libraryTools.filter((t) => t.name === 'library_search'), when: 'always' },
  { name: 'library-admin', tools: libraryTools.filter((t) => t.name !== 'library_search'), when: /\b(library|import|arxiv|cve-?\d*|github|paper|papers|repo|repository|save (this|that)|read (this|that)|add (this|that))\b/i },
  { name: 'knowledge', tools: knowledgeTools, when: /\b(study|learn|lessons?|handbook|playbooks?)\b/i },
  { name: 'evolve', tools: evolveTools, when: /\b(upgrade|improve yourself|better version|roadmap|carry on|continue|audit)\b/i },
  { name: 'repo', tools: repoTools, when: /\b(ship|propose|proposed|changes?|versions?|roll ?back|restore|discard|preview|workshop|repo|source code)\b/i },
];

/** The tools to offer for this request: always-on groups, groups the words call for, groups already in use. */
export function selectTools(text: string, used: Set<string>, code: boolean): Tool[] {
  const out: Tool[] = [];
  for (const g of TOOL_GROUPS) {
    const on = g.when === 'always' || (g.when === 'code' ? code : g.when.test(text)) || (code && ['widgets', 'evolve', 'knowledge', 'repo'].includes(g.name)) || g.tools.some((t) => used.has(t.name));
    if (on) out.push(...g.tools);
  }
  return out;
}

export const ALL_TOOL_NAMES = TOOLS.map((t) => t.name).join(', ');
