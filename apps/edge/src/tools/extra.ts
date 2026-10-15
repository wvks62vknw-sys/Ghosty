/**
 * NEW ABILITIES GO HERE. Ghosty may edit this file freely.
 *
 * Add tools to `extraTools` (define them here, or in a new file and import them).
 * They are registered automatically by tools/index.ts. A tool whose name clashes with a
 * built-in tool is ignored, so core tools such as ship_change can't be replaced.
 *
 * Example:
 *   import { arg, type Tool } from './types';
 *   export const extraTools: Tool[] = [{
 *     name: 'dad_joke', description: 'Fetch a random dad joke.',
 *     parameters: { type: 'object', properties: {} }, risk: 'auto',
 *     async run() { const r = await fetch('https://icanhazdadjoke.com/', { headers: { Accept: 'text/plain' } }); return r.text(); },
 *   }];
 */
import type { Tool } from './types';

import { detect_crime } from './detect_crime';

export const extraTools: Tool[] = [detect_crime];
