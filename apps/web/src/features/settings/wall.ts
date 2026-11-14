/**
 * SETTINGS → THE WALL (BRIEF-MACHINE-WALL; STARS 165): pair this phone with the wall (a television or a laptop that shows what the
 * phone is talking about), see what is on it, rest it, or LEAVE. The wall shows a six-letter code; it is typed here (or said: "pair the
 * wall, KPQTRM"). A wrong code three times waits a minute, and says so. The page asks the brain how the wall is when it comes into view
 * (a phone that never paired asks nothing); with the brain out of reach it says so and keeps what it last knew.
 */
import { clear, h } from '../../core/dom';
import { panel, toast } from '../../ui/components';
import { para } from '../../ui/oneline';
import { key, tag } from '../../ui/machine';
import { WALL_SAYS, cleanCode, codeOk, type WallKind } from '../../../../../packages/shared/src/wall';
import { leaveWall, pairWall, refreshWall, restWall, wallPhone } from '../../wall/phone';

const TAGS: Record<WallKind, string> = { chart: 'CHART', map: 'MAP', place: 'PLACE', document: 'DOCUMENT', plan: 'PLAN', room: 'ROOM', part: 'PART', car: 'CAR', waveform: 'WAVEFORM', thing: 'THE LENS' };
const hhmm = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function wallPanel(): { el: HTMLElement; refresh(): void } {
  const p = panel('THE WALL', { grow: false, status: 'Not paired' });
  p.el.classList.add('wallpn');
  const input = h('input.wallcodein', { placeholder: 'The wall’s code', 'aria-label': 'The wall’s code', maxLength: 8, autocomplete: 'off', autocapitalize: 'characters', autocorrect: 'off', spellcheck: false, inputMode: 'text', dataset: { case: 'keep' } });
  const state = h('p.note.wallstate', { role: 'status', dataset: { case: 'keep' } });
  const pairKey = key('PAIR', () => void doPair(), { kind: 'fill', label: 'Pair with the wall' });
  const restKey = key('REST THE WALL', async () => {
    state.textContent = (await restWall()) ? WALL_SAYS.cleared : WALL_SAYS.none;
  }, { label: 'Rest the wall' });
  const leaveKey = key('LEAVE', async () => {
    state.textContent = (await leaveWall()) ? WALL_SAYS.left : WALL_SAYS.none;
  }, { kind: 'ghost', label: 'Leave the wall: unpair it' });
  const unpaired = h('div.wallunpaired',
    ...para('p.note', 'Open Ghosty on a television or a laptop with ?wall=1 at the end of its address. It shows a code: type it here, or say “pair the wall” and the code.'),
    h('div.keyrow.wrapit.wallpairrow', input, pairKey));
  const thumb = h('div.wallthumb', { dataset: { case: 'keep' } });
  const paired = h('div.wallpaired', thumb, h('div.row.wrap.wallbtns', restKey, leaveKey));
  p.body.append(unpaired, paired, state, ...para('p.note.walllimit', 'It shows pictures and the one sentence they answer: never the camera, a face, where you are, what you spend or anyone’s messages. Hold anywhere on the wall for a second to unpair it there. To make that screen Ghosty again, open its address with ?wall=0.'));

  let timer = 0;
  const paint = () => {
    const w = wallPhone.get();
    const wait = w.retryAt > Date.now();
    p.setStatus(w.paired ? 'Paired' : 'Not paired', w.paired ? 'ok' : undefined);
    unpaired.hidden = w.paired;
    paired.hidden = !w.paired;
    pairKey.disabled = wait;
    pairKey.setAttribute('aria-disabled', String(wait));
    clearTimeout(timer);
    if (wait) timer = window.setTimeout(paint, w.retryAt - Date.now() + 100);
    if (w.paired) {
      clear(thumb,
        w.showing
          ? h('div.wallshown', tag(`ON THE WALL · ${TAGS[w.showing.kind] ?? String(w.showing.kind).toUpperCase()}`, { tone: 'on' }), h('p.wallsentence', w.showing.sentence))
          : h('div.wallshown', tag('THE WALL', { tone: 'off' }), h('p.wallsentence', 'It is resting.')),
        h('p.note', `Paired since ${hhmm(w.since)}${w.lost ? ' · I can’t reach my brain now, so this may be out of date' : ''}.`));
    } else if (w.lost && !state.textContent) state.textContent = WALL_SAYS.offline;
  };
  const doPair = async () => {
    const code = cleanCode(input.value);
    if (!codeOk(code)) {
      state.textContent = code.length < 6 ? 'The code is six letters.' : WALL_SAYS.wrong;
      input.focus();
      return;
    }
    state.textContent = 'Pairing…';
    pairKey.disabled = true;
    const r = await pairWall(code);
    state.textContent = r.said;
    if (r.ok) {
      input.value = '';
      toast(r.said, 'ok');
    }
    paint();
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && pairKey.click());
  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z ]/g, '');
  });
  wallPhone.subscribe(paint);
  paint();
  // ask the brain how the wall is when the page comes into view (never at boot; a phone that never paired asks nothing)
  let askedAt = 0;
  const ask = () => {
    if (Date.now() - askedAt < 20_000) return;
    askedAt = Date.now();
    if (wallPhone.get().paired || wallPhone.get().at) void refreshWall().then(() => state.textContent === WALL_SAYS.none && (state.textContent = ''));
  };
  if (typeof IntersectionObserver === 'function') new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && ask()).observe(p.el);
  return { el: p.el, refresh: ask };
}
