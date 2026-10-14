/**
 * KERNEL — protected. Every tool Ghosty can use.
 * New abilities go in tools/extra.ts (unprotected); they're merged in here, but can never
 * replace a built-in tool.
 */
import type { ToolSpec } from '../llm/router';
import { agendaTools } from './agenda';
import { dataTools } from './data';
import { extraTools } from './extra';
import { memoryTools } from './memory';
import { repoTools } from './repo';
import type { Tool } from './types';
import { uiTools } from './ui';
import { webTools } from './web';
import { widgetTools } from './widgets';

const CORE: Tool[] = [...memoryTools, ...agendaTools, ...webTools, ...dataTools, ...uiTools, ...widgetTools, ...repoTools];
const coreNames = new Set(CORE.map((t) => t.name));

export const TOOLS: Tool[] = [...CORE, ...extraTools.filter((t) => t && typeof t.name === 'string' && /^[a-z][a-z0-9_]{1,63}$/.test(t.name) && !coreNames.has(t.name))];

export const toolByName = new Map(TOOLS.map((t) => [t.name, t]));

export function toolSpecs(): ToolSpec[] {
  return TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}
