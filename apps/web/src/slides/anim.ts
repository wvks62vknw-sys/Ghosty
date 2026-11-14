/**
 * SLIDE BUILDS IN AND OUT OF POWERPOINT (NEXT ROUND, editors.u4): a slide's builds written as PowerPoint's own entrance animations in
 * p:timing (APPEAR is PowerPoint's Appear, FADE its Fade, RISES IN its Fly In from the bottom), one click each, in the slide's order, and
 * read back from a file PowerPoint saved (also when it sits inside mc:AlternateContent, as PowerPoint 2010 and later can write it).
 * PowerPoint's other entrances come in as the nearest build (a fade, or a rise for anything that moves in); an emphasis or an exit has no
 * build to be, so it is said as left out. Pure: XML text out, an XML tree in.
 */
import { attr, find, findAll, first, kids, type XEl } from './xml';
import type { Anim } from './model';

/** One build to write: the shape's id on the slide (its cNvPr id), how it comes in, and whether it is a text shape (it gets a bldP). */
export interface TimedBuild {
  spid: number;
  how: Anim;
  text: boolean;
}

/** PowerPoint's preset for each build: Appear 1, Fade 10, Fly In 2 (subtype 4: from the bottom). */
export const PRESET: Record<Anim, { id: number; sub: number }> = { appear: { id: 1, sub: 0 }, fade: { id: 10, sub: 0 }, rise: { id: 2, sub: 4 } };

/** The p:timing element for a slide's builds ('' when it has none). Each build is its own click, in the order given. */
export function timingXml(builds: TimedBuild[]): string {
  if (!builds.length) return '';
  let id = 2;
  const tgt = (spid: number) => `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>`;
  const clicks = builds.map((b) => {
    const p = PRESET[b.how];
    const outer = ++id;
    const mid = ++id;
    const eff = ++id;
    const set = `<p:set><p:cBhvr><p:cTn id="${++id}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${tgt(b.spid)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`;
    let more = '';
    if (b.how === 'fade') more = `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${++id}" dur="500"/>${tgt(b.spid)}</p:cBhvr></p:animEffect>`;
    if (b.how === 'rise') {
      const anim = (name: string, from: string, to: string) => `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${++id}" dur="500" fill="hold"/>${tgt(b.spid)}<p:attrNameLst><p:attrName>${name}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="${to}"/></p:val></p:tav></p:tavLst></p:anim>`;
      more = anim('ppt_x', '#ppt_x', '#ppt_x') + anim('ppt_y', '1+#ppt_h/2', '#ppt_y');
    }
    return `<p:par><p:cTn id="${outer}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${mid}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${eff}" presetID="${p.id}" presetClass="entr" presetSubtype="${p.sub}" fill="hold"${b.text ? ' grpId="0"' : ''} nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${set}${more}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`;
  });
  const bld = builds.filter((b) => b.text).map((b) => `<p:bldP spid="${b.spid}" grpId="0"/>`).join('');
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${clicks.join('')}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>${bld ? `<p:bldLst>${bld}</p:bldLst>` : ''}</p:timing>`;
}

/** PowerPoint's entrance presets that move the shape in (they come in as RISES IN); every other entrance comes in as a fade, Appear as itself. */
const MOVES = new Set([2, 3, 12, 37, 42, 47, 49, 52, 55]);
export const animOfPreset = (id: number): Anim => (id === 1 ? 'appear' : MOVES.has(id) ? 'rise' : 'fade');

export interface ReadTiming {
  /** Each entrance found, in the file's order: the shape's id and the build it becomes. */
  builds: { spid: number; how: Anim }[];
  /** An emphasis, an exit or a motion path was there (no build can be one). */
  other: boolean;
}

/** The slide's timing element: a direct child, or inside mc:AlternateContent (its Choice first, else its Fallback). */
export function timingOf(root: XEl | null): XEl | null {
  const direct = first(root, 'timing');
  if (direct) return direct;
  for (const ac of kids(root, 'AlternateContent')) {
    const t = first(first(ac, 'Choice'), 'timing') ?? first(first(ac, 'Fallback'), 'timing');
    if (t) return t;
  }
  return null;
}

/** The builds a slide's timing holds. Each shape keeps its first entrance; an effect on no shape is passed over. */
export function readTiming(timing: XEl | null): ReadTiming {
  const out: ReadTiming = { builds: [], other: false };
  if (!timing) return out;
  const seen = new Set<number>();
  for (const ctn of findAll(timing, 'cTn')) {
    const cls = attr(ctn, 'presetClass');
    if (!cls) continue;
    if (cls !== 'entr') {
      if (cls !== 'mediacall') out.other = true;
      continue;
    }
    const spid = Number(attr(find(ctn, 'spTgt'), 'spid'));
    if (!Number.isFinite(spid) || !spid || seen.has(spid)) continue;
    seen.add(spid);
    out.builds.push({ spid, how: animOfPreset(Number(attr(ctn, 'presetID')) || 0) });
  }
  return out;
}
