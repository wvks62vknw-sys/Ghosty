/**
 * THE SHELF: every game the arcade plays, as data. The screen renders its cards from this list and the node test
 * (apps/edge/test/arcade.test.mjs) checks every entry.
 *
 * The lines that hold: game DATA is never in the repo and nothing commercial is ever fetched. Each entry names a free
 * package whose own licence lets anyone pass it on (named in `licence`), the public mirrors it comes from (fetched on
 * his tap, on Wi-Fi, size said first), its exact size and SHA-256 (checked on the phone before anything is kept), and
 * what the phone takes out of it. The mirrors are the Internet Archive's CORS door (archive.org/cors/…): the idgames
 * mirrors and the Archive's plain download servers send no CORS header, so a page cannot read them; this one can.
 * Engine CODE is vendored under public/vendor/<engine>/ with its LICENCE and SOURCE.md.
 */

import type { DosSetup } from './dos';

export type EngineId = 'doom' | 'quake' | 'dos';

/** What a game is played with (the touch layer draws only these; the gamepad layer maps the standard pad to them). */
export type Control = 'move' | 'look' | 'fire' | 'use' | 'weapon' | 'jump' | 'map';

/**
 * One file the engine gets, taken out of the package on the phone: the `from` members joined end to end (the DOOM
 * shareware's two floppy parts make one self-extracting archive), then, when `inner` is set, that member of the joined
 * archive. `sha256` (optional) is the taken file's own checksum, checked after unpacking.
 */
export interface Take {
  name: string;
  from: string[];
  inner?: string;
  sha256?: string;
  /**
   * Keep a whole archive as one bundle for the DOS engine (its members become drive C:): the package itself as it
   * came when `from` is empty, else the archive `from` joins, its members written into a fresh ZIP on the phone.
   */
  bundle?: boolean;
}

export interface GameData {
  /** Public HTTPS mirrors, tried in order. */
  url: string[];
  /** SHA-256 of the whole package as downloaded (64 hex). */
  sha256: string;
  /** The package's size in bytes (said on GET before anything is fetched). */
  bytes: number;
  /** Why anyone may pass it on, in plain words. */
  licence: string;
  /** Who made it. */
  credit: string;
  /** What the phone takes out of the package. */
  take: Take[];
}

export interface ShelfEntry {
  id: string;
  title: string;
  /** One plain line under the title. */
  line: string;
  engine: EngineId;
  data: GameData;
  controls: Control[];
  /** The engine keeps saved games for it (in the browser's storage, on this phone). */
  saves: boolean;
  /** When it joined the shelf (YYYY-MM-DD). */
  since: string;
  /** Ghosty's own line about it, on the card. */
  ghosty: string;
  /** Ghosty's line when a level is finished (a DOS game, which says nothing of its levels: when he stops playing). */
  done: string;
  /** A DOS game's set-up: what DOS runs, DOSBox's speed, our set-up files and its CONTROLS block (engine 'dos'). */
  dos?: DosSetup;
}

/** The Internet Archive's CORS door for a file of an item, or for one member of a ZIP the item holds (served alone). */
export const archive = (item: string, file: string, member?: string): string =>
  `https://archive.org/cors/${item}/${encodeURIComponent(file)}${member ? `/${encodeURIComponent(member)}` : ''}`;
/** A member of the Archive's 1 March 2020 copy of the idgames archive (one 22 GB ZIP; the Archive serves each member alone). */
export const idgames = (path: string): string => archive('idgames_202003', 'idgames.zip', `idgames/${path}`);

/** Freedoom 0.13.0 (BSD): one package holds both phases; phase 2 is also the base the Doom II level packs load over. */
export const FREEDOOM: GameData = {
  url: [archive('freedoom-0.13.0', 'freedoom-0.13.0.zip')],
  sha256: '3f9b264f3e3ce503b4fb7f6bdcb1f419d93c7b546f4df3e874dd878db9688f59',
  bytes: 24_143_781,
  licence: 'BSD 3-clause (Freedoom): anyone may copy and pass it on, changed or not, with its copyright notice.',
  credit: 'The Freedoom project contributors (freedoom.github.io), release 0.13.0, January 2024.',
  take: [
    { name: 'freedoom1.wad', from: ['freedoom-0.13.0/freedoom1.wad'], sha256: '7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d' },
    { name: 'freedoom2.wad', from: ['freedoom-0.13.0/freedoom2.wad'], sha256: 'a8772e088847032510d97ba2312406a6998f21cbab44d4ff10696faa9c0ecd4b' },
  ],
};

export const SHELF: ShelfEntry[] = [
  {
    id: 'freedoom',
    title: 'FREEDOOM',
    line: 'DOOM, the free version with its own levels.',
    engine: 'doom',
    data: FREEDOOM,
    controls: ['move', 'look', 'fire', 'use', 'weapon', 'map'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'Thirty-six levels made free by fans, on the real DOOM engine. Start on Hurt Me Plenty.',
    done: "Level down. That kill count is the one I'm chasing now.",
  },
  {
    id: 'doom-shareware',
    title: 'DOOM: KNEE-DEEP IN THE DEAD',
    line: "The original DOOM's first episode, as id Software gave it away in 1993.",
    engine: 'doom',
    data: {
      // id's own shareware package (doom19s.zip), unmodified; the same bytes as the idgames archive's idstuff/doom copy
      url: [archive('doom19s_202607', 'doom19s.zip'), archive('Idstuff', 'Idstuff.zip', 'Idstuff/Doom/doom19s.zip')],
      sha256: 'cacf0142b31ca1af00796b4a0339e07992ac5f21bc3f81e7532fe1b5e1b486e6',
      bytes: 2_450_688,
      licence: "id Software's shareware terms: the unmodified DOOM 1.9 shareware package may be passed on free (\"PLEASE DISTRIBUTE!!!\").",
      credit: 'id Software, 1993 (DOOM 1.9 shareware, episode 1).',
      take: [{ name: 'doom1.wad', from: ['DOOMS_19.1', 'DOOMS_19.2'], inner: 'DOOM1.WAD', sha256: '1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771' }],
    },
    controls: ['move', 'look', 'fire', 'use', 'weapon', 'map'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'Nine levels from 1993 that every shooter since has copied. E1M1 is about to be stuck in your head.',
    done: 'Another one of id\'s levels cleared. Romero would want you to find the secrets too.',
  },
  {
    id: 'quake-shareware',
    title: 'QUAKE: DIMENSION OF THE DOOMED',
    line: "Quake's first episode in real 3-D, as id Software gave it away in 1996.",
    engine: 'quake',
    data: {
      // the Internet Archive's software library copy of the Quake 1.06 shareware (its PAK0.PAK is id's own, MD5 5906e599…)
      url: [archive('msdos_Quake106_shareware', 'msdos_Quake106_shareware.zip'), archive('msdos_Quake106_shareware_201702', 'msdos_Quake106_shareware.zip')],
      sha256: '920f4609801d0bdbea5b6738cec49da846df4ff8ce0d46c901ea080dd4437833',
      bytes: 9_050_608,
      licence: "id Software's Quake shareware licence (SLICNSE.TXT, in the package): the shareware may be passed on whole, free of charge.",
      credit: 'id Software, 1996 (Quake 1.06 shareware, episode 1).',
      take: [{ name: 'pak0.pak', from: ['ID1/PAK0.PAK'], sha256: '35a9c55e5e5a284a159ad2a62e0e8def23d829561fe2f54eb402dbc0a9a946af' }],
    },
    controls: ['move', 'look', 'fire', 'jump', 'weapon'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'The first real 3-D shooter. Jump the gaps, and listen for the Ogres before you see them.',
    done: "Through the slipgate. I'd have taken the grenade launcher in there too.",
  },
];
