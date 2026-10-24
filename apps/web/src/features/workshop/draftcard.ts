/**
 * The DRAFT card under a website project in the Workshop (BRIEF-WEBSITES-LIFT): the page as it will look on a
 * phone and on a laptop, side by side, each in the same locked frame the phone's PREVIEW uses (it cannot reach
 * Ghosty's page or storage); what the owner is asked to confirm; CHANGE, where he says in his own words what to
 * change (the brain folds the facts in and draws the draft again, still not public); and PUBLISH, which sends the
 * words to the chat so the usual approval names the list before anything goes live.
 */
import { brain, type SiteDraft } from '../../api/brain';
import { send } from '../../assistant/session';
import { clear, h } from '../../core/dom';
import { go } from '../../shell/tabs';
import { button, pill, sandboxFrame, toast } from '../../ui/components';

/** The two screens a draft is shown at: an iPhone and a laptop. */
const SCREENS = [
  { label: 'LAPTOP', w: 1280, h: 800 },
  { label: 'PHONE', w: 390, h: 844 },
] as const;

/** One screen: the page drawn at its real width, scaled down to fit the card. */
function screen(html: string, title: string, s: (typeof SCREENS)[number]): HTMLElement {
  const f = sandboxFrame(html);
  f.classList.add('draftframe');
  f.title = `${title} on a ${s.label.toLowerCase()}`;
  f.style.width = `${s.w}px`;
  f.style.height = `${s.h}px`;
  const vp = h('div.dvp', f);
  const box = h(`div.dscreen.${s.label.toLowerCase()}` as 'div', h('small', s.label), vp);
  box.dataset.w = String(s.w);
  box.dataset.h = String(s.h);
  return box;
}

/** Fit both screens to the card: the laptop across the width, the phone beside it (or under it on a phone). */
function fit(frames: HTMLElement): void {
  const width = frames.clientWidth;
  if (!width) return;
  const side = width >= 620;
  for (const box of [...frames.querySelectorAll<HTMLElement>('.dscreen')]) {
    const w = Number(box.dataset.w);
    const hgt = Number(box.dataset.h);
    const phone = w < 600;
    const shown = side ? (phone ? Math.min(200, width * 0.26) : width - Math.min(200, width * 0.26) - 16) : phone ? Math.min(220, width * 0.6) : width;
    const scale = shown / w;
    const vp = box.querySelector<HTMLElement>('.dvp')!;
    vp.style.width = `${Math.round(shown)}px`;
    vp.style.height = `${Math.round(hgt * scale)}px`;
    const f = vp.querySelector<HTMLElement>('iframe')!;
    f.style.transform = `scale(${scale})`;
  }
  frames.classList.toggle('side', side);
}

/** The card for one website project; it loads its draft itself. */
export function draftCard(projectId: string): HTMLElement {
  const card = h('div.draftcard', h('small.note', 'Loading the website…'));
  let draft: SiteDraft | null = null;
  const paint = (said = '') => {
    clear(card);
    if (!draft) return;
    const d = draft;
    const frames = h('div.dframes', ...SCREENS.map((s) => screen(d.html, d.title, s)));
    const head = h('div.dhead', pill(d.live ? 'LIVE' : 'DRAFT · NOT PUBLIC', d.live ? 'live' : 'warn'), h('b', d.title));
    card.append(head, frames);
    if (said) card.append(h('p.dsaid', said));
    if (!d.live && d.confirm.length) card.append(h('div.dconfirm', h('small', 'PLEASE CONFIRM'), h('ul', ...d.confirm.map((c) => h('li', c)))));
    const words = h('textarea.dwords', { rows: 3, placeholder: 'Say what to change, e.g. “open Sat 9–5, beard trim £12, name: Fade & Co”' }) as HTMLTextAreaElement;
    words.setAttribute('aria-label', 'What to change');
    const changeBox = h('div.dchange', words, h('div.row', button('SEND CHANGE', async (b) => {
      const w = words.value.trim();
      if (!w) return toast('Say what to change first.', 'warn');
      b.disabled = true;
      try {
        const r = await brain.siteChange(projectId, w);
        draft = r.draft;
        paint(r.said);
      } catch (e) {
        toast(`Could not change it: ${String((e as Error).message)}`, 'bad');
        b.disabled = false;
      }
    }, 'on')));
    changeBox.hidden = true;
    const actions = h('div.row.wrap.dactions');
    if (d.live) actions.append(h('a.btn', { href: d.link, target: '_blank', rel: 'noopener' }, 'OPEN THE LIVE PAGE'));
    else {
      actions.append(
        button('CHANGE', () => {
          changeBox.hidden = !changeBox.hidden;
          if (!changeBox.hidden) words.focus();
        }),
        // Publishing goes through the chat, where the approval names what is being confirmed.
        button('PUBLISH', () => {
          go('core');
          void send(d.publish);
        }, 'on'),
      );
    }
    card.append(actions, changeBox);
    requestAnimationFrame(() => fit(frames));
    if ('ResizeObserver' in window) new ResizeObserver(() => fit(frames)).observe(frames);
  };
  void brain
    .siteDraft(projectId)
    .then((r) => {
      draft = r.draft;
      paint();
    })
    .catch(() => {
      clear(card);
      card.append(h('small.note', 'The website is not ready to show yet.'));
    });
  return card;
}
