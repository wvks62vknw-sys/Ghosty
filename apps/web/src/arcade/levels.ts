/**
 * THE FREE LEVELS: a dozen of the most-loved free fan level packs for DOOM, each from the idgames archive (through the
 * Internet Archive's copy of it, the only mirror a page can read), each made to run on the original engine's limits
 * (none needs a "limit-removing" port), each loaded over Freedoom as the pack requires: the Doom II packs over Freedoom
 * phase 2, the DOOM packs over phase 1. Every `licence` quotes the pack's own idgames text file; nothing here is a
 * commercial game's levels.
 */
import { idgames, type GameData } from './shelf';

export interface LevelPack {
  id: string;
  title: string;
  /** Who made it (said on its card). */
  author: string;
  /** One plain line. */
  line: string;
  /** The Freedoom phase it loads over: 1 for DOOM-format maps (E1M1…), 2 for Doom II maps (MAP01…). */
  base: 'freedoom1' | 'freedoom2';
  data: GameData;
}

/** The idgames permission line most packs carry, word for word. */
const MAY = 'idgames; its text file: "You MAY distribute this file, provided you include this text file, with no modifications."';

const pack = (id: string, title: string, author: string, line: string, base: LevelPack['base'], path: string, bytes: number, sha256: string, files: string[], licence = MAY): LevelPack => ({
  id,
  title,
  author,
  line,
  base,
  data: { url: [idgames(path)], sha256, bytes, licence, credit: `${author} (idgames: ${path})`, take: files.map((f) => ({ name: f.split('/').pop()!.toLowerCase(), from: [f] })) },
});

export const LEVELS: LevelPack[] = [
  pack('scythe', 'Scythe', 'Erik Alm, with Kim "Torn" Bach', 'Thirty-two short, sharp maps that turn very hard by the end.', 'freedoom2', 'levels/doom2/megawads/scythe.zip', 2_086_863, 'a38246e005b4675d1f91474cd8dd93f4da016c4a22b1169dcede2608d72f6e99', ['SCYTHE.WAD']),
  pack('hr', 'Hell Revealed', 'Yonatan Donner and Haggay Niv', 'Thirty-two huge maps packed with monsters; famously tough.', 'freedoom2', 'themes/hr/hr.zip', 2_322_399, '0b353a4ba6f5fb5bb06d1484e737fbf7422bbc5894d8a648921844c4042583b3', ['HR.WAD', 'HRMUS.WAD'], 'idgames; its text file: "Hell Revealed is freeware … You can distribute it freely, but only in its entirety."'),
  pack('d2reload', 'Doom 2 Reloaded', 'Andy Stewart', "Doom II's thirty-two maps rebuilt from scratch, bigger and meaner.", 'freedoom2', 'levels/doom2/megawads/d2reload.zip', 4_375_631, 'a1c215cec2013e972f4d52cb409a58203f576860f42398416d755f441b4019f4', ['D2RELOAD.WAD']),
  pack('d2twid', 'Doom 2 the Way id Did', 'The Doomworld community', "New maps made exactly the way id made Doom II's.", 'freedoom2', 'levels/doom2/megawads/d2twid.zip', 1_964_344, 'e5ef240143640e537ab5b47239967ec9e70ba84a314ee40d3a2acb66757aed32', ['D2TWID.wad', 'D2TWID.deh']),
  pack('btsx1', 'Back to Saturn X: Episode 1', 'Esselfortium and team', 'Space stations with their own textures and music; a modern classic.', 'freedoom2', 'levels/doom2/megawads/btsx_e1.zip', 18_372_586, '8114c0c96213a8a869ae04046a319838e40d378560b8cc55a09ca8e980155ee2', ['btsx_e1a.wad', 'btsx_e1b.wad', 'btsx_e1.deh']),
  pack('intercep', 'Interception', 'The Interceptors', "A community megawad built inside the original engine's limits.", 'freedoom2', 'levels/doom2/megawads/intercep.zip', 4_175_993, '483b49dea460480e27ba75544ea0c8656f7c1f3c442837fff8c418b917d0e0c4', ['intercep/intercep.wad', 'intercep/intercep.deh']),
  pack('darken2', 'The Darkening: Episode 2', 'Ola Björling and the Darkening team', 'Dark bases and caverns; one of the best-loved packs of its day.', 'freedoom2', 'levels/doom2/megawads/darken2.zip', 4_498_934, '22a9352c48867294807756a5f277a437bfb419564131c6509e0782c228205540', ['Darken2.wad'], 'idgames; its text file: "You may distribute this WAD, provided you include this file, with no modifications."'),
  pack('epic2', 'Epic 2', 'Alexander "Eternal" S.', 'Big, detailed maps with their own textures and music.', 'freedoom2', 'levels/doom2/megawads/epic2.zip', 17_293_561, '678c6dc804687f1bd68f82b739ed75ae3fde0c867be4abbf3311908ee945de4c', ['epic2.wad']),
  pack('zone300', 'Zone 300', 'Paul "Pcorf" Corfiatis', 'Thirty-two quick maps, none with more than 300 lines.', 'freedoom2', 'levels/doom2/megawads/zone300.zip', 926_169, 'ffd0eff62ce38cb667a53f43462489a849fc0dc0b66dcfdcf5017768cef99d26', ['zone300.wad']),
  pack('1klinecp', '1000 Line Community Project', 'Liberation and the Doomworld community', 'Thirty-four maps, each held to a thousand lines.', 'freedoom2', 'levels/doom2/megawads/1klinecp.zip', 2_216_109, '775e2f52dc6638b575c4cc4192a3c5f3898e7841be77e003b7dbe4d3872540d8', ['1klinecp.wad', '1klinecp.deh'], 'idgames; its text file: Creative Commons Attribution 4.0 ("You are free to copy and redistribute the material in any medium or format").'),
  pack('icarus', 'Icarus: Alien Vanguard', 'TeamTNT', 'A war across a starship in thirty-two maps, from 1996.', 'freedoom2', 'themes/TeamTNT/icarus/icarus.zip', 2_849_657, '446c5aac35fecbe791f1fc58c3c6f7507ec25ae2114e105af0c78da155095fee', ['ICARUS.WAD'], 'idgames; its text file: "Icarus: Alien Vanguard is a copyrighted work and though free is not public property … Icarus should have been free to you."'),
  pack('dtwid', 'Doom the Way id Did', 'The Doomworld community', "Three new episodes made exactly the way id made the first DOOM's.", 'freedoom1', 'levels/doom/megawads/dtwid.zip', 2_005_606, '122b50713026a05423776e5c1330770f74a371d4236c63497f0f7f64bc9a62cb', ['DTWID.wad', 'DTWID.deh']),
];

/** The shelf entry whose kept files every pack loads over: Freedoom's one package (both phases, one GET). */
export const LEVELS_BASE = 'freedoom';

/** The pack's WADs, in its own order (a .deh patch stays out: this engine has no DeHackEd). */
export const packWads = (p: LevelPack): string[] => p.data.take.map((t) => t.name).filter((n) => n.endsWith('.wad'));

/** It ships a DeHackEd patch, which this engine does not read: its names and messages are the original engine's. */
export const needsDeh = (p: LevelPack): boolean => p.data.take.some((t) => t.name.endsWith('.deh'));

/** The engine's command line for a pack: the Freedoom phase it loads over, then its WADs. */
export const packArgs = (p: LevelPack): string[] => ['-iwad', `${p.base}.wad`, '-file', ...packWads(p)];

/** The kept files PLAY hands DOOM's engine for a pack, as [where kept, name]: its Freedoom phase, then its WADs. */
export const packReads = (p: LevelPack): [string, string][] => [[LEVELS_BASE, `${p.base}.wad`], ...packWads(p).map((n): [string, string] => [p.id, n])];
