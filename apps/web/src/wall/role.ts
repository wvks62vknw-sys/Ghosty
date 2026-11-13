/**
 * THE WALL's role on this device (BRIEF-MACHINE-WALL), in a module of its own: SETTINGS reads and sets it without the wall's screen (wall/screen.ts,
 * which draws with the Stage's renderers) being loaded on the way to the first screen.
 */
import { createStore } from '../core/store';

/** Is this device the wall? Kept on it; `screen` is its own name to the brain (random, made once). */
export const wallRole = createStore({ on: false, screen: '' }, { persist: 'ghosty.wall.role' });
