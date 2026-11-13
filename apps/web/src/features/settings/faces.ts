/**
 * SETTINGS → PRIVACY → FACES (OWNER-ISSUES 55, 56): the faces this phone knows — his own, enrolled by himself in the
 * Lens's PEOPLE, and the people he introduced there — with a count, RE-ENROL and DELETE for his, × for each of theirs.
 * One tap each, at once, with UNDO for a few seconds (the face kept only in memory meanwhile). They live on this phone
 * only (vision/facestore.ts): never sent to the brain, never in BACKUP & RESTORE.
 */
import { clear, h } from '../../core/dom';
import { button, row, undo } from '../../ui/components';
import { forgetFace, knownFaces, putBack } from '../../vision/facestore';
import { enrolNext } from '../lens/people';
import { openLens } from '../lens/index';
import { liveCheckOn, liveSetting } from '../lens/liveness'; // [restc] CHECK IT'S LIVE
import { switchRow } from './switch';
import { FACES_ERROR, FACES_NONE, SWITCHES } from './words';

const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function facesBlock(): { el: HTMLElement; refresh(): Promise<void> } {
  const count = h('p.note.facecount', { dataset: { case: 'keep' } });
  const list = h('div.facelist');
  // [restc] CHECK IT'S LIVE (on by default): a blink or a turn before a face is saved, so a photo held up cannot pass
  const live = switchRow('CHECK IT’S LIVE', SWITCHES.live, liveCheckOn, (on) => liveSetting.set({ on }));
  live.el.classList.add('livesw');
  const el = h('div.faces', h('div.lab', 'FACES ON THIS PHONE'), count, list, live.el);

  const refresh = async () => {
    let all: Awaited<ReturnType<typeof knownFaces>>;
    try {
      all = await knownFaces();
    } catch {
      /* state: settings.faces error */
      count.textContent = FACES_ERROR;
      return;
    }
    const me = all.find((p) => p.me);
    const others = all.filter((p) => !p.me);
    count.textContent = !all.length
      ? /* state: settings.faces empty */ FACES_NONE
      : `${all.length} ${all.length === 1 ? 'face' : 'faces'}: ${me ? 'you' : ''}${me && others.length ? ' and ' : ''}${others.length ? `${others.length} ${others.length === 1 ? 'person' : 'people'} you introduced` : ''}; they never leave this phone and are not in backups.`;
    const rows: HTMLElement[] = [];
    if (me) {
      const r = row('YOU', `enrolled ${day(me.at)} · ${me.looks.length} looks`, null, { wrap: true });
      r.dataset.face = 'me';
      r.append(
        h('span.facebtns',
          button('RE-ENROL', () => {
            enrolNext();
            openLens('people', undefined, true);
          }),
          button('DELETE', () => void drop(me.id, 'your face'), 'warn'),
        ),
      );
      rows.push(r);
    }
    for (const p of others) {
      const r = row(p.name.toUpperCase(), `met ${day(p.at)} · ${p.looks.length} looks`, null, { wrap: true });
      r.dataset.face = p.id;
      const x = h('button.facedel', { type: 'button', 'aria-label': `Forget ${p.name}'s face`, title: `Forget ${p.name}` }, '✕');
      x.addEventListener('click', () => void drop(p.id, `${p.name}'s face`));
      r.append(x);
      rows.push(r);
    }
    clear(list, ...rows);
  };

  /** One tap: gone from this phone now; UNDO puts it back from memory. */
  const drop = async (id: string, what: string) => {
    const was = await forgetFace(id);
    await refresh();
    if (was) undo(`Deleted ${what}`, async () => {
      await putBack(was);
      await refresh();
    });
  };

  void refresh();
  return { el, refresh };
}
