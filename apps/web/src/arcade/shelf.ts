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

import type { DosButton, DosSetup } from './dos';

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

/** The small keys every DOS game has along the top: its menu (ESC) and ENTER, and its map where it has one. */
const ESC: DosButton = { act: 'menu', key: 'esc', label: 'ESC', small: true };
const ENTER: DosButton = { act: 'ok', key: 'enter', label: 'ENTER', small: true };
const MAP: DosButton = { act: 'map', key: 'tab', label: 'MAP', small: true };
/** A WEAPON button that walks through the number keys, one a press. */
const WEAPON = (...keys: string[]): DosButton => ({ act: 'weapon', key: keys[0]!, cycle: keys, label: 'WEAPON' });

/** The permission in Apogee's VENDOR.DOC, the same words in each of its shareware packages. */
const APOGEE = 'Its own VENDOR.DOC, in the package: "Everyone can -- and is encouraged! -- to copy, upload and generally pass around this Program without charging for it." (Apogee\'s shareware terms: free to pass on, unchanged.)';
/** Apogee's 1990–91 packages carry its distribution agreement instead (LICENSE.DOC). */
const APOGEE_OLD = 'Its own LICENSE.DOC, in the package: Apogee\'s shareware distribution agreement — shareware re-sellers, distributors and BBS operators may pass the episode on, unaltered.';
/** The permission in Epic MegaGames' LICENSE.DOC. */
const EPIC = 'Its own LICENSE.DOC, in the package: "You may copy and/or distribute the Program only in its original, unaltered form, with all files included unmodified" (Epic MegaGames\' shareware licence; the package is fetched whole).';

/** DOOM's and Heretic's own set-up file (DEFAULT.CFG, HERETIC.CFG): Sound Blaster 16 at 220/7/1 for sound and music;
 * the up and down arrows walk, left and right strafe (so the stick moves and the drag turns, with the mouse). */
const DOOMCFG = `mouse_sensitivity 5
sfx_volume 12
music_volume 10
show_messages 1
key_right 52
key_left 51
key_up 72
key_down 80
key_strafeleft 75
key_straferight 77
key_fire 29
key_use 57
key_strafe 56
key_speed 54
use_mouse 1
mouseb_fire 0
mouseb_strafe 1
mouseb_forward 2
use_joystick 0
screenblocks 10
detaillevel 0
snd_channels 8
snd_musicdevice 3
snd_sfxdevice 3
snd_sbport 544
snd_sbirq 7
snd_sbdma 1
snd_mport 816
usegamma 0
`;

/** Rise of the Triad's own sound file: music and effects on the Sound Blaster 16 at 220/7/1/5. */
const ROTTSOUND = `Version 13
MusicMode 2
FXMode 2
MusicVolume 196
FXVolume 196
NumVoices 8
NumChannels 2
NumBits 16
MidiAddress $330
StereoReverse 0
SBType 6
SBPort $220
SBIrq 7
SBDma8 1
SBDma16 5
SBMidi $ffffffff
SBEmu $ffffffff
`;

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
  // ---------- THE DOS SHELF: the free classics, each run as it shipped by the DOS engine (engines/dos.ts), each package
  // the Archive's copy with its size and SHA-256 taken from the file itself, each licence quoted from its own text file.
  {
    id: 'doom-dos',
    title: 'DOOM',
    line: "id Software's own DOOM, its first episode as it shipped in 1993: nine levels of Knee-Deep in the Dead.",
    engine: 'dos',
    data: {
      url: [archive('doom19s_202607', 'doom19s.zip'), archive('Idstuff', 'Idstuff.zip', 'Idstuff/Doom/doom19s.zip')],
      sha256: 'cacf0142b31ca1af00796b4a0339e07992ac5f21bc3f81e7532fe1b5e1b486e6',
      bytes: 2_450_688,
      licence: 'Its own DOOMS_19.DAT, in the package: "SHAREWARE VERSION … PLEASE DISTRIBUTE!!!" (id Software\'s DOOM 1.9 shareware, passed on unmodified).',
      credit: 'id Software, 1993 (DOOM 1.9 shareware, episode 1).',
      // the two floppy parts join into one self-extracting ZIP; its files become drive C:
      take: [{ name: 'doom.jsdos', from: ['DOOMS_19.1', 'DOOMS_19.2'], bundle: true }],
    },
    controls: ['move', 'look', 'fire', 'use', 'weapon', 'map'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'The real thing, on the original engine. Stick to move, drag to turn, and open every door twice.',
    done: 'Saved where you stopped. E1M1 will still be there.',
    dos: {
      run: ['DOOM.EXE'],
      cycles: 'max',
      // DOOM's own set-up file: Sound Blaster 16 for sound and music, the arrows walk and strafe, the mouse turns
      files: { 'DEFAULT.CFG': DOOMCFG },
      controls: { stick: 'arrows', run: 'rshift', drag: 'mouse-x', mouseScale: 20, buttons: [{ act: 'fire', key: 'ctrl', label: 'FIRE' }, { act: 'use', key: 'space', label: 'OPEN' }, WEAPON('2', '3', '4', '5', '1'), MAP, ESC, ENTER] },
    },
  },
  {
    id: 'duke3d-sw',
    title: 'DUKE NUKEM 3D',
    line: 'The 1996 shooter with a mouth on him: L.A. Meltdown, the shareware episode.',
    engine: 'dos',
    data: {
      url: [archive('3dduke13SW', 'emulator.zip')],
      sha256: '8d5f06827050d643f5338c6ad2ca01c0135f52802f691faf1c05f0402460bf3b',
      bytes: 5_899_698,
      licence: 'Its own LICENSE.TXT, in the package: "INDIVIDUALS are encouraged to share and give copies of the Game to friends, family, coworkers … but only without charge." (3D Realms\' shareware terms: free to pass on, unchanged.)',
      credit: '3D Realms, 1996 (Duke Nukem 3D shareware 1.3D, episode 1).',
      take: [{ name: 'duke3d.jsdos', from: [], bundle: true }],
    },
    controls: ['move', 'look', 'fire', 'use', 'jump', 'weapon'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'Hollywood in flames and a pig cop behind every door. Jump a lot: Duke can.',
    done: "Saved. He'd have a line about that run; I'll let you imagine it.",
    dos: {
      run: ['DUKE3D.EXE'],
      cycles: 'max',
      controls: { stick: 'arrows', run: 'shift', drag: 'mouse-x', mouseScale: 20, buttons: [{ act: 'fire', key: 'ctrl', label: 'FIRE' }, { act: 'jump', key: 'a', label: 'JUMP' }, { act: 'use', key: 'space', label: 'OPEN' }, { act: 'weapon', key: 'quote', label: 'WEAPON' }, { act: 'crouch', key: 'z', label: 'CROUCH', small: true }, MAP, ESC, ENTER] },
    },
  },
  {
    id: 'heretic-sw',
    title: 'HERETIC',
    line: 'DOOM with spells and gargoyles: City of the Damned, the shareware episode from Raven.',
    engine: 'dos',
    data: {
      url: [archive('heretic-dos', 'HERETIC.ZIP')],
      sha256: 'b988b77d1168e31d34e548591a55d0e70f31bf367934a609331d3746fae8c394',
      bytes: 2_885_932,
      licence: 'Its own HTIC_V12.DAT, in the package: "Shareware Episode One … FREELY DISTRIBUTE".',
      credit: 'Raven Software, published by id Software, 1994 (Heretic 1.2 shareware).',
      take: [{ name: 'heretic.jsdos', from: ['HTIC_V12.1', 'HTIC_V12.2'], bundle: true }],
    },
    controls: ['move', 'look', 'fire', 'use', 'weapon', 'map'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'An elven wand against an army of gargoyles. Save the Tome of Power for the big ones.',
    done: 'Saved. The Iron Liches are not going anywhere.',
    dos: {
      run: ['HERETIC.EXE'],
      cycles: 'max',
      files: { 'HERETIC.CFG': DOOMCFG },
      controls: { stick: 'arrows', run: 'rshift', drag: 'mouse-x', mouseScale: 20, buttons: [{ act: 'fire', key: 'ctrl', label: 'FIRE' }, { act: 'use', key: 'space', label: 'OPEN' }, WEAPON('2', '3', '4', '1'), { act: 'special', key: 'enter', label: 'ITEM' }, MAP, ESC] },
    },
  },
  {
    id: 'rott-sw',
    title: 'RISE OF THE TRIAD',
    line: 'The Hunt Begins: rocket jumps, heat-seekers and a monastery full of guards.',
    engine: 'dos',
    data: {
      url: [archive('rott_shareware', 'ROTT.zip')],
      sha256: 'd4c7d8b2289d8edf238d889149ea9aa253bccb776b89950d5c3b7c2ab00cb2cd',
      bytes: 3_717_169,
      licence: APOGEE,
      credit: 'Apogee Software, 1995 (Rise of the Triad: The Hunt Begins, shareware 1.3).',
      take: [{ name: 'rott.jsdos', from: [], bundle: true }],
    },
    controls: ['move', 'fire', 'use', 'weapon', 'map'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'Pick Taradino to start. Ludicrous gibs is a real setting, and it is on.',
    done: 'Saved. The Triad will keep.',
    dos: {
      run: ['ROTT.EXE'],
      cycles: 'max',
      // its own sound file, pointing at the Sound Blaster 16 (the copy in the package has sound off)
      files: { 'SOUND.ROT': ROTTSOUND },
      controls: { stick: 'arrows', run: 'rshift', drag: 'none', buttons: [{ act: 'fire', key: 'ctrl', label: 'FIRE' }, { act: 'use', key: 'space', label: 'OPEN' }, WEAPON('1', '2', '3', '4'), MAP, ESC, ENTER] },
    },
  },
  {
    id: 'bstone-sw',
    title: 'BLAKE STONE',
    line: 'Aliens of Gold: a secret agent, a mad scientist, and the informants who help you.',
    engine: 'dos',
    data: {
      url: [archive('Bs-aog-sw1', 'bstone.zip')],
      sha256: '74c9cc0aeddfc446d4066a7509be7b93fae13fd677f35c3350008fee37ee6f50',
      bytes: 1_378_690,
      licence: APOGEE,
      credit: 'JAM Productions, published by Apogee Software, 1993 (Blake Stone: Aliens of Gold, episode 1).',
      take: [{ name: 'bstone.jsdos', from: [], bundle: true }],
    },
    controls: ['move', 'fire', 'use', 'weapon'],
    saves: true,
    since: '2026-11-01',
    ghosty: "Shoot the guards, not the scientists: the informants tell you things. Doors open on SPACE.",
    done: 'Saved. Dr. Goldfire is still out there.',
    dos: {
      run: ['BS_AOG.EXE'],
      cycles: 'max',
      controls: { stick: 'arrows', run: 'rshift', drag: 'none', buttons: [{ act: 'fire', key: 'ctrl', label: 'FIRE' }, { act: 'use', key: 'space', label: 'OPEN' }, WEAPON('1', '2', '3'), ESC, ENTER] },
    },
  },
  {
    id: 'raptor-sw',
    title: 'RAPTOR',
    line: 'Call of the Shadows: a vertical shooter where every kill buys better guns.',
    engine: 'dos',
    data: {
      url: [archive('Raptor-sw1', 'raptor.zip')],
      sha256: '7efac1f87da66fb4d2e010a332b662c18773e58e077e83543f441023bfb10202',
      bytes: 1_890_661,
      licence: APOGEE,
      credit: 'Cygnus Studios, published by Apogee Software, 1994 (Raptor: Call of the Shadows, shareware episode 1).',
      take: [{ name: 'raptor.jsdos', from: [], bundle: true }],
    },
    controls: ['move', 'fire', 'use', 'weapon'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'Spend the money in the hangar between waves. The mega bomb clears a screen: save it.',
    done: 'Pilot saved. The hangar will have your credits waiting.',
    dos: {
      run: ['cd raptor', 'RAP.EXE'],
      cycles: 'max',
      controls: { stick: 'arrows', drag: 'none', buttons: [{ act: 'fire', key: 'ctrl', label: 'FIRE' }, { act: 'special', key: 'alt', label: 'SPECIAL' }, { act: 'use', key: 'space', label: 'SWITCH' }, { act: 'weapon', key: 'rshift', label: 'BOMB' }, ESC, ENTER] },
    },
  },
  {
    id: 'tyrian-sw',
    title: 'TYRIAN',
    line: 'Escape, the shareware episode of the shooter people still call the best on the PC.',
    engine: 'dos',
    data: {
      url: [archive('TyrianV2.1SW1996EpicMegaGamesInc.Action', 'TYRIANv2.1.ZIP')],
      sha256: '45c878957767188ba3dfead113bd4956ce54a267a9fd60bd06efd796fbd027bc',
      bytes: 2_182_522,
      licence: EPIC,
      credit: 'Eclipse Productions, published by Epic MegaGames, 1995 (Tyrian 2.1 shareware, episode 1).',
      take: [{ name: 'tyrian.jsdos', from: [], bundle: true }],
    },
    controls: ['move', 'fire', 'use', 'weapon'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'Upgrade the front gun before anything else. MODE flips how the rear gun fires.',
    done: 'Saved. Your ship and its credits are kept.',
    dos: {
      run: ['TYRIAN.EXE'],
      cycles: 'max',
      controls: { stick: 'arrows', drag: 'none', buttons: [{ act: 'fire', key: 'space', label: 'FIRE' }, { act: 'use', key: 'enter', label: 'MODE' }, { act: 'special', key: 'ctrl', label: 'SIDE L' }, { act: 'weapon', key: 'alt', label: 'SIDE R' }, ESC, ENTER] },
    },
  },
  {
    id: 'omf-sw',
    title: 'ONE MUST FALL 2097',
    line: 'Giant robots in a one-on-one fighting tournament; the shareware release.',
    engine: 'dos',
    data: {
      url: [archive('omf20_zip', 'omf20.zip')],
      sha256: '93a2fb60347dd3408f05c7ec0cd3e012e59f7e569771776a35d52256c5b002dc',
      bytes: 2_931_404,
      licence: EPIC,
      credit: 'Diversions Entertainment, published by Epic MegaGames, 1994 (One Must Fall 2097 1.1 shareware).',
      take: [{ name: 'omf.jsdos', from: [], bundle: true }],
    },
    controls: ['move', 'fire', 'use'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'Push toward the other robot while you PUNCH for a throw. Jaguar is the one to learn first.',
    done: 'Your pilot is saved. The arena keeps the record.',
    dos: {
      run: ['OMF.EXE'],
      cycles: 'max',
      controls: { stick: 'arrows', drag: 'none', buttons: [{ act: 'fire', key: 'enter', label: 'PUNCH' }, { act: 'use', key: 'rshift', label: 'KICK' }, ESC, ENTER] },
    },
  },
  {
    id: 'keen4-sw',
    title: 'COMMANDER KEEN 4',
    line: 'Secret of the Oracle: a pogo stick, a raygun and eight Council members to find.',
    engine: 'dos',
    data: {
      url: [archive('Keen4e-sw', 'keen4.zip')],
      sha256: 'd7834a9b3265a997951743b58282886966e555bc6bf71d92df4de17b6129c36b',
      bytes: 631_332,
      licence: APOGEE_OLD,
      credit: 'id Software, published by Apogee Software, 1991 (Commander Keen 4: Secret of the Oracle, shareware).',
      take: [{ name: 'keen4.jsdos', from: [], bundle: true }],
    },
    controls: ['move', 'fire', 'jump', 'use'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'Pogo on the jump to go higher. The Dopefish is in the next episode, sadly.',
    done: "Saved. Keen's wrist computer remembers everything.",
    dos: {
      run: ['KEEN4E.EXE'],
      cycles: 'max',
      controls: { stick: 'arrows', drag: 'none', buttons: [{ act: 'jump', key: 'ctrl', label: 'JUMP' }, { act: 'use', key: 'alt', label: 'POGO' }, { act: 'fire', key: 'space', label: 'FIRE' }, ESC, ENTER] },
    },
  },
  {
    id: 'keen1-sw',
    title: 'COMMANDER KEEN',
    line: 'Marooned on Mars: the 1990 platformer that started id Software.',
    engine: 'dos',
    data: {
      url: [archive('keen1-sw', 'keen1.zip')],
      sha256: 'a823802afb03ab3878122370de43ff25dd721df3da2538a4d54951787d63be10',
      bytes: 194_029,
      licence: APOGEE_OLD,
      credit: 'id Software, published by Apogee Software, 1990 (Commander Keen: Marooned on Mars 1.31, shareware).',
      take: [{ name: 'keen1.jsdos', from: [], bundle: true }],
    },
    controls: ['move', 'fire', 'jump', 'use'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'Find the parts of the Bean-with-Bacon Megarocket. The raygun is JUMP and POGO together, so it has its own button.',
    done: 'Saved. Mars waits.',
    dos: {
      run: ['KEEN1.EXE'],
      cycles: 'max',
      controls: { stick: 'arrows', drag: 'none', buttons: [{ act: 'jump', key: 'ctrl', label: 'JUMP' }, { act: 'use', key: 'alt', label: 'POGO' }, { act: 'fire', key: 'ctrl+alt', label: 'FIRE' }, { act: 'map', key: 'space', label: 'STATUS', small: true }, ESC, ENTER] },
    },
  },
  {
    id: 'jill-sw',
    title: 'JILL OF THE JUNGLE',
    line: 'Jill Saves the Prince: a jungle platformer that turns you into a frog, a bird and a fish.',
    engine: 'dos',
    data: {
      url: [archive('jill1-sw', 'jill.zip')],
      sha256: 'facf6e4b448093514319895e4fd2bd0c466a8763f2b8a882339053fa30560889',
      bytes: 305_579,
      licence: 'Its own VENDOR.DOC, in the package: "You have permission to distribute this software, as long as you make it clear that this is SHAREWARE, and you don\'t charge over $8 for the disk."',
      credit: 'Tim Sweeney, Epic MegaGames, 1992 (Jill of the Jungle episode 1, shareware 1.2).',
      take: [{ name: 'jill.jsdos', from: [], bundle: true }],
    },
    controls: ['move', 'jump', 'fire'],
    saves: true,
    since: '2026-11-01',
    ghosty: "The map links the levels: walk Jill into a door to go in. Grab the knife first.",
    done: 'Saved. The prince can wait a bit longer.',
    dos: {
      run: ['JILL.BAT'],
      cycles: 'max',
      controls: { stick: 'arrows', drag: 'none', buttons: [{ act: 'jump', key: 'alt', label: 'JUMP' }, { act: 'fire', key: 'ctrl', label: 'THROW' }, ESC, ENTER] },
    },
  },
  {
    id: 'wacky-sw',
    title: 'WACKY WHEELS',
    line: 'Kart racing with animals and hedgehogs to throw; the shareware cup.',
    engine: 'dos',
    data: {
      url: [archive('WackyWheels', 'WACKY.ZIP')],
      sha256: '6726ee61f483111c876eb4d4bf8d40e8f5dc2778cc3815bc3f8ee515e0aac1e2',
      bytes: 1_559_310,
      licence: APOGEE,
      credit: 'Beavis Soft, published by Apogee Software, 1994 (Wacky Wheels 1.1 shareware).',
      take: [{ name: 'wacky.jsdos', from: [], bundle: true }],
    },
    controls: ['move', 'fire', 'use'],
    saves: false,
    since: '2026-11-01',
    ghosty: "Hold the gas through the corners and throw hedgehogs at whoever's ahead.",
    done: 'Race over. The cup table stays where it was.',
    dos: {
      run: ['WW.EXE'],
      cycles: 'max',
      controls: { stick: 'arrows', drag: 'none', buttons: [{ act: 'fire', key: 'ctrl', label: 'GAS' }, { act: 'use', key: 'alt', label: 'BRAKE' }, { act: 'special', key: 'space', label: 'THROW' }, ESC, ENTER] },
    },
  },
  {
    id: 'pinball-sw',
    title: 'EPIC PINBALL',
    line: 'Android, the table that came free: real flippers, a plunger and a score to beat.',
    engine: 'dos',
    data: {
      url: [archive('Epic-pinball-sw1', 'pinball.zip')],
      sha256: '862505fdff3422116885fc4743ed09601a528bff1e5638ca43aeb043ad91a183',
      bytes: 698_825,
      licence: 'Its own LICENSE.DOC, in the package: "Shareware vendors may distribute this program alone on a floppy disk" (Epic MegaGames\' shareware terms, the package unaltered).',
      credit: 'Digital Extremes, published by Epic MegaGames, 1993 (Epic Pinball 1.1 shareware: the Android table).',
      take: [{ name: 'pinball.jsdos', from: [], bundle: true }],
    },
    controls: ['move', 'fire', 'use', 'jump'],
    saves: true,
    since: '2026-11-01',
    ghosty: 'Hold PLUNGER, then let go. Nudge a little; nudge a lot and it tilts.',
    done: 'Game over. The high-score table keeps your best.',
    dos: {
      run: ['PINBALL.EXE'],
      cycles: 'max',
      controls: { stick: 'arrows', drag: 'none', buttons: [{ act: 'fire', key: 'rshift', label: 'RIGHT' }, { act: 'use', key: 'shift', label: 'LEFT' }, { act: 'jump', key: 'space', label: 'PLUNGER' }, ESC, ENTER] },
    },
  },
];
