/** THE APP LIBRARY: hundreds of apps as data, drawn by one engine on THE APP KIT (see types.ts and docs/build-plan/APPLIB.md). */
export * from './types';
import type { AppDef } from './types';
import { OFFICE } from './catalogue/office';
import { CREATE } from './catalogue/create';
import { GAMES } from './catalogue/games';
import { LEARN } from './catalogue/learn';
import { BODY } from './catalogue/body';
import { MONEY } from './catalogue/money';
import { TOOLS } from './catalogue/tools';
import { LIFE } from './catalogue/life';
import { MAKER } from './catalogue/maker';
import { WORLD } from './catalogue/world';
import { DATA } from './catalogue/data';

/** Every app in the Library, family by family. */
export const LIBRARY: AppDef[] = [...OFFICE, ...CREATE, ...GAMES, ...LEARN, ...BODY, ...MONEY, ...TOOLS, ...LIFE, ...MAKER, ...WORLD, ...DATA];
