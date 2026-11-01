/**
 * The catalogue's words for the phone's registries (apps/web/src/abilities/sources.ts): screens and hubs, the hub cards,
 * the Me sheet, themes, moods, what works everywhere, the chat's controls and phrases (app1.ts); the screens' panels
 * (app2.ts, app3.ts) and the Workbench's modes (app3.ts); the deck's lines, the Lens, the GYM, SCHOOL's stages, the
 * studio and the screens' sections (app4.ts); the ARCADE's games, one entry a shelf game (arcade.ts, and games2.ts for
 * the two made by us).
 */
import type { CatValue } from '../catalogue';
import { APP_1 } from './app1';
import { APP_2 } from './app2';
import { APP_3 } from './app3';
import { APP_4 } from './app4';
import { ARCADE_WORDS } from './arcade';
import { GAMES2_WORDS } from './games2';
import { GAMES3_WORDS } from './games3';
import { RESTA_WORDS } from './resta';

export const APP_WORDS: Record<string, CatValue> = { ...APP_1, ...APP_2, ...APP_3, ...APP_4, ...ARCADE_WORDS, ...GAMES2_WORDS, ...GAMES3_WORDS, ...RESTA_WORDS };
