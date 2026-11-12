/**
 * NATURE DIARY (BRIEF-OCT-IDEAS-3 item 9; Learn → Library, on the shelf): the living things he tapped KEEP on in the Lens ("seen: a robin,
 * 24 Oct, 1.2 km north-east of Birmingham"), newest first, with a small map of where from his own position at the time: Home in the
 * middle and a dot for each, on this phone only (further/diary.ts), never sent to the brain. READ IT TO ME says the lines aloud;
 * FORGET has UNDO. Nothing is kept by itself.
 */
import { speak, stopSpeaking } from '../../assistant/voice';
import { clear, h, svgEl } from '../../core/dom';
import { home } from '../../state/app';
import { button, empty, panel, undo, type Panel } from '../../ui/components';
import { entryLine, loadDiary, metres, onDiary, saveDiary, type DiaryEntry } from '../../further/diary';

/** The small map: Home at the middle, a dot a sighting, the scale said. SVG in the tokens, no tiles (it works with no signal). */
export function diaryMap(list: DiaryEntry[]): { svg: SVGSVGElement; caption: string } | null {
  const at = home();
  const placed = list.filter((e) => e.at2);
  if (!placed.length) return null;
  const far = Math.max(500, ...placed.map((e) => metres(at, e.at2!)));
  // a round scale: 500 m, 1 km, 2 km, 5 km, 10 km, 20 km, 50 km
  const ring = [500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000].find((r) => r >= far) ?? far;
  const S = 220;
  const c = S / 2;
  const R = c - 14;
  const svg = svgEl('svg', { viewBox: `0 0 ${S} ${S}`, class: 'diarysvg', role: 'img', 'aria-label': `Where ${placed.length} sightings were, round ${at.name || 'home'}; the outer ring is ${ring < 1000 ? `${ring} metres` : `${ring / 1000} kilometres`}` });
  svg.append(svgEl('circle', { cx: c, cy: c, r: R, class: 'diaryring' }), svgEl('circle', { cx: c, cy: c, r: R / 2, class: 'diaryring' }), svgEl('circle', { cx: c, cy: c, r: 3, class: 'diaryhome' }));
  for (const e of placed) {
    const d = metres(at, e.at2!);
    const brg = Math.atan2(Math.sin((e.at2!.lon - at.lon) * (Math.PI / 180)) * Math.cos(e.at2!.lat * (Math.PI / 180)), Math.cos(at.lat * (Math.PI / 180)) * Math.sin(e.at2!.lat * (Math.PI / 180)) - Math.sin(at.lat * (Math.PI / 180)) * Math.cos(e.at2!.lat * (Math.PI / 180)) * Math.cos((e.at2!.lon - at.lon) * (Math.PI / 180)));
    const r = Math.min(R, (d / ring) * R);
    const dot = svgEl('circle', { cx: (c + Math.sin(brg) * r).toFixed(1), cy: (c - Math.cos(brg) * r).toFixed(1), r: 4.5, class: 'diarydot' });
    dot.dataset.id = e.id;
    svg.append(dot);
  }
  const north = svgEl('text', { x: c, y: 11, 'text-anchor': 'middle', class: 'diarytx' });
  north.textContent = 'N';
  svg.append(north);
  return { svg, caption: `${placed.length} of ${list.length} placed · ${at.name || 'home'} in the middle · outer ring ${ring < 1000 ? `${ring} m` : `${ring / 1000} km`}` };
}

export function diaryPanel(): { pn: Panel; paint(): void } {
  const pn = panel('NATURE DIARY', { grow: false, cls: 'diary', status: '' });
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const state = { entries: [] as string[], placed: 0 };
  if (w.__ghosty) w.__ghosty.diary = state;
  let going = new Set<string>();
  let reading = false;
  const paint = () => {
    const list = loadDiary().filter((e) => !going.has(e.id)).sort((a, b) => b.at - a.at);
    state.entries = list.map(entryLine);
    state.placed = list.filter((e) => e.at2).length;
    clear(pn.body);
    pn.setStatus(list.length ? `${list.length} SEEN` : 'NONE YET', list.length ? 'ok' : 'off');
    if (!list.length) {
      pn.body.append(empty('NONE YET', 'In the Lens, NAME IT on a bird, a plant or an insect, then tap KEEP: it is kept here with where you were. Nothing is kept by itself, and where you were stays on this phone.'));
      return;
    }
    const map = diaryMap(list);
    if (map) pn.body.append(h('div.diarymap', map.svg, h('small.diarycap', map.caption)));
    else pn.body.append(h('p.note', 'None of these has a place: I couldn’t place you when you kept them.'));
    const read = button(reading ? 'STOP' : 'READ IT TO ME', (b) => {
      if (reading) {
        stopSpeaking();
        reading = false;
        b.textContent = 'READ IT TO ME';
        return;
      }
      reading = true;
      b.textContent = 'STOP';
      void speak(list.slice(0, 12).map(entryLine).join('. '), { here: true }).catch(() => undefined).finally(() => {
        reading = false;
        b.textContent = 'READ IT TO ME';
      });
    });
    read.dataset.case = 'keep';
    pn.body.append(h('div.row.wrap', read));
    for (const e of list) {
      const forget = button('FORGET', () => {
        going = new Set([...going, e.id]);
        paint();
        undo(
          `Forgotten from the diary: ${e.name}`,
          () => {
            going.delete(e.id);
            paint();
          },
          () => {
            saveDiary(loadDiary().filter((x) => x.id !== e.id));
            going.delete(e.id);
            paint();
          },
        );
      }, 'warn');
      forget.dataset.case = 'keep';
      const sub = [e.latin, e.sure].filter(Boolean).join(' · ');
      const where = e.at2 ? h('a.lnk', { href: `https://www.openstreetmap.org/?mlat=${e.at2.lat.toFixed(5)}&mlon=${e.at2.lon.toFixed(5)}#map=17/${e.at2.lat.toFixed(5)}/${e.at2.lon.toFixed(5)}`, target: '_blank', rel: 'noopener noreferrer' }, 'OPEN MAP') : null;
      pn.body.append(h('div.diaryrow', { dataset: { id: e.id } }, h('div.diarytext', h('b', entryLine(e)), sub ? h('small', sub) : null), h('div.row.wrap', where, forget)));
    }
  };
  onDiary(paint);
  paint();
  return { pn, paint };
}
