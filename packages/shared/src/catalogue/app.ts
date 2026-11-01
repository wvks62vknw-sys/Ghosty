/**
 * The catalogue's words for the phone's registries (apps/web/src/abilities/sources.ts): screens and hubs, the hub cards,
 * the Me sheet, themes, moods, what works everywhere, the chat's controls and phrases (app1.ts); the screens' panels
 * (app2.ts, app3.ts) and the Workbench's modes (app3.ts); the deck's lines, the Lens, the GYM, SCHOOL's stages and the
 * studio (app4.ts).
 */
import type { CatValue } from '../catalogue';
import { APP_1 } from './app1';
import { APP_2 } from './app2';
import { APP_3 } from './app3';
import { APP_4 } from './app4';

export const APP_WORDS: Record<string, CatValue> = { ...APP_1, ...APP_2, ...APP_3, ...APP_4 };
