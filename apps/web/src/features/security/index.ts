/**
 * SETTINGS → SECURITY (NEXT ROUND, lane SECURITY: "Safe, private and in your hands", security.u1, u4, u6, u8 and the two
 * half-done fixes): every lock on one screen, each a green, amber or red line in his words, worked out by locks.ts; every
 * APPROVE and NOT NOW in one list (what, when, from the phone or Telegram, and the page whose words came before it); and the
 * fixes that live in his Cloudflare account as short STEPS, with a random key made on the phone where one is needed.
 * A row of Settings, like THE LOOK, SYSTEM and LINKS.
 *
 * States, each in a sentence: loading (the locks the phone knows show at once, the brain's fill in), offline (the phone's own
 * locks still show; the brain's say they can't be checked), error (the same, in his words), empty approvals ("nothing asked").
 */
import type { ScreenContext } from '../../../../../packages/shared/src/awareness';
import { brain, ownerKey } from '../../api/brain';
import { clear, h } from '../../core/dom';
import type { TabDef } from '../../shell/tabs';
import { button, confirmSheet, panel, row, toast } from '../../ui/components';
import { page } from '../../ui/page';
import { sayError } from '../../ui/hisWords';
import { knownFaces } from '../../vision/facestore';
import { lastBackup } from '../system/backup';
import { GUIDES, type Guide } from './guides';
import { leakCount, leakWords, sha1Hex } from './pwned';
import { approvalLine, locksOf, newOwnerKey, newVaultKey, summaryOf, type ApprovalEntry, type BrainLocks, type Level, type Lock, type LockFacts } from './locks';

const DOORS_KEY = 'ghosty.security.doorsRule';
const doorsRule = {
  get: (): boolean => {
    try {
      return localStorage.getItem(DOORS_KEY) === '1';
    } catch {
      return false;
    }
  },
  set: (on: boolean): void => {
    try {
      if (on) localStorage.setItem(DOORS_KEY, '1');
      else localStorage.removeItem(DOORS_KEY);
    } catch {
      /* storage refused: the line stays amber */
    }
  },
};

const SEV: Record<Level, number> = { green: 0, amber: 1, red: 3 };
const WORD: Record<Level, string> = { green: 'OK', amber: 'LOOK', red: 'FIX' };
const TONE: Record<Level, 'up' | 'dn' | 'bad'> = { green: 'up', amber: 'dn', red: 'bad' };

/** What the screen knows now (also read by the checks, window.__ghosty.security). */
export const securityState: { locks: Lock[]; approvals: ApprovalEntry[] | null; brain: BrainLocks | null; at: number } = { locks: [], approvals: null, brain: null, at: 0 };

let summary = '';

export const securityTab: TabDef = {
  id: 'security',
  title: 'SECURITY',
  icon: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  scene: 'backdrop',
  // a row of Settings, like THE LOOK: it sits inside Settings (shell/rooms.ts, the finding rule)
  inside: 'settings',
  blurb: 'Every lock · approvals · steps',
  now: () => summary,
  mount(root) {
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    const attach = (tries = 0) => (w.__ghosty ? (w.__ghosty.security = securityState) : tries < 150 && setTimeout(() => attach(tries + 1), 100));
    attach();
    const P = page(root, { tag: 'SECURITY', leftLabel: 'LOCKS', rightLabel: 'STEPS', stack: true });
    const lp = panel('LOCKS', { grow: false });
    const ap = panel('APPROVALS', { grow: false, cls: 'scroll' });
    const kp = panel('LOCK EVERYTHING', { grow: false });
    kp.el.classList.add('seclockdown');
    const sp = panel('STEPS', { grow: false });
    const cp = panel('CHECK A LINK', { grow: false });
    cp.el.classList.add('seclinkcheck');
    const pp = panel('HAS IT LEAKED?', { grow: false });
    pp.el.classList.add('secpwned');
    lp.el.classList.add('seclocks');
    ap.el.classList.add('secapprovals');
    sp.el.classList.add('secsteps');
    P.left.append(lp.el, kp.el, ap.el);
    P.right.append(cp.el, pp.el, sp.el);

    const facts: LockFacts = { keyLength: null, lastBackup: null, faces: null, telegram: null, brain: null, approvals: null, doorsRule: doorsRule.get(), now: Date.now() };
    const key = ownerKey.get();
    facts.keyLength = key ? key.length : null;
    const lb = lastBackup.get();
    facts.lastBackup = lb ? { at: lb.at, ok: lb.ok } : null;

    const paintLocks = () => {
      facts.now = Date.now();
      facts.doorsRule = doorsRule.get();
      const locks = locksOf(facts);
      securityState.locks = locks;
      const s = summaryOf(locks);
      summary = `${s.green} of ${s.total} locks green`;
      P.big.textContent = `${s.green}/${s.total}`;
      P.sub.textContent = `locks green · ${s.line}`;
      lp.setStatus(`${s.green} of ${s.total} green`, s.level === 'green' ? 'ok' : 'mid');
      clear(
        lp.body,
        ...locks.map((l) => {
          const r = row(l.label, l.line, WORD[l.level], { sev: SEV[l.level], tone: TONE[l.level], wrap: true, ...(l.guide ? { onClick: () => openGuide(l.guide!) } : {}) });
          r.dataset.lock = l.id;
          r.dataset.level = l.level;
          return r;
        }),
      );
    };

    const paintApprovals = () => {
      const list = securityState.approvals;
      if (list == null) {
        /* state: security.approvals error */
        clear(ap.body, h('p.note', 'I can’t read the list of approvals just now. It comes back when the brain answers.'));
        ap.setStatus('Not reachable', 'mid');
        return;
      }
      if (!list.length) {
        /* state: security.approvals empty */
        clear(ap.body, h('p.note', 'Nothing has asked for your APPROVE yet. Each time something does (a send, a post, a payment, a change), it is listed here with your answer.'));
        ap.setStatus('None yet');
        return;
      }
      const now = Date.now();
      ap.setStatus(`${list.length} kept`);
      clear(
        ap.body,
        ...list.slice(0, 50).map((a) => {
          const r = row(null, approvalLine(a, now), a.allow ? 'YES' : 'NO', { sev: a.allow ? 0 : 1, tone: a.allow ? 'up' : 'dn', wrap: true });
          r.classList.add('secapproval');
          return r;
        }),
        h('div.row', button('CLEAR LIST', () => void clearList(), 'quiet')),
      );
    };

    const clearList = async () => {
      if (!(await confirmSheet('Clear the approvals list?', 'The list of what you approved and turned down is cleared. Nothing you approved is undone.', 'CLEAR'))) return;
      try {
        await brain.clearApprovals();
        securityState.approvals = [];
        facts.approvals = [];
        paintApprovals();
        paintLocks();
        toast('Approvals list cleared.', 'ok');
      } catch (e) {
        toast(sayError(e, 'clear the list'), 'bad');
      }
    };

    // STEPS: each fix that lives in his Cloudflare account
    const guideEls = new Map<string, HTMLElement>();
    const guideBlock = (g: Guide): HTMLElement => {
      const made = h('p.note.secmade', { dataset: { case: 'keep' } });
      const steps = h('ol.secsteplist', ...g.steps.map((s) => h('li', s)));
      const keys = h('div.row.wrap');
      if (g.make) {
        keys.append(
          button('MAKE ONE', async () => {
            const v = g.make === 'vault' ? newVaultKey() : newOwnerKey();
            made.textContent = v;
            try {
              await navigator.clipboard.writeText(v);
              toast('Made and copied. It is shown once and kept nowhere.', 'ok');
            } catch {
              toast('Made: copy it from the screen. It is kept nowhere.', 'ok');
            }
          }),
        );
      }
      if (g.done) {
        const doneKey = button(doorsRule.get() ? 'NOT DONE' : 'DONE', (b) => {
          const on = !doorsRule.get();
          doorsRule.set(on);
          b.textContent = on ? 'NOT DONE' : 'DONE';
          paintLocks();
          toast(on ? 'Marked done on this phone.' : 'Marked not done.', 'ok');
        });
        keys.append(doneKey);
      }
      const el = h('div.secguide', { dataset: { guide: g.id } }, h('h4', g.title), h('p.note', g.why), steps, keys, made);
      guideEls.set(g.id, el);
      return el;
    };
    clear(sp.body, h('p.note', 'Fixes that live in your Cloudflare account, in plain steps. I never hold your Cloudflare login, so these are yours to do.'), ...GUIDES.map(guideBlock));
    sp.setStatus(`${GUIDES.length} guides`);

    const openGuide = (id: string) => {
      const hud = root.querySelector('.hud');
      if (hud && !hud.classList.contains('alt')) (root.querySelector('.hero .swap') as HTMLButtonElement | null)?.click();
      guideEls.get(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };

    // HAS IT LEAKED? (security.s2): typed here, fingerprinted here, only five characters of the fingerprint go out
    const pw = h('input', { type: 'password', autocomplete: 'off', 'aria-label': 'A password to check', placeholder: 'A password to check', spellcheck: false }) as HTMLInputElement;
    const said = h('p.note.secpwnedsaid', { dataset: { case: 'keep' } });
    const check = async () => {
      const v = pw.value;
      if (!v) {
        said.textContent = 'Type a password first. It never leaves this phone.';
        return;
      }
      pw.value = '';
      said.textContent = 'Checking…';
      pp.setStatus('Checking…');
      try {
        const fp = await sha1Hex(v);
        const { list } = await brain.pwnedRange(fp.slice(0, 5));
        const n = leakCount(fp, list);
        said.textContent = leakWords(n);
        said.dataset.found = n > 0 ? '1' : '0';
        pp.setStatus(n > 0 ? 'Leaked' : 'Not found', n > 0 ? 'mid' : 'ok');
      } catch (e) {
        /* state: security.locks error */
        said.textContent = sayError(e, 'check the list of leaked passwords');
        pp.setStatus('Can’t check', 'mid');
      }
    };
    pw.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void check();
    });
    pp.body.append(
      h('p.note', 'Only the first five characters of its scrambled fingerprint leave this phone, never the password. Nothing is kept.'),
      h('div.row.secpwrow', pw, button('CHECK', () => void check(), 'on')),
      said,
    );
    pp.setStatus('On this phone');

    // CHECK A LINK (security.u9): where a link really goes and any scam signs, from public records, before he opens it
    const lk = h('input', { type: 'url', autocomplete: 'off', 'aria-label': 'A link or a message to check', placeholder: 'Paste a link or a message', spellcheck: false, inputmode: 'url' }) as HTMLInputElement;
    const lkSaid = h('p.note.seclinksaid', { dataset: { case: 'keep' } });
    const checkLink = async () => {
      const v = lk.value.trim();
      if (!v) {
        lkSaid.textContent = 'Paste a link, or a message with a link in it.';
        return;
      }
      lkSaid.textContent = 'Checking it against the public records…';
      cp.setStatus('Checking…');
      try {
        const r = await brain.securityLinkCheck(v);
        lkSaid.textContent = r.words;
        lkSaid.dataset.verdict = r.verdict;
        cp.setStatus(r.verdict === 'scam' ? 'Looks like a scam' : r.verdict === 'nothing' ? 'Nothing found' : 'Be careful', r.verdict === 'nothing' ? 'ok' : 'mid');
      } catch (e) {
        lkSaid.textContent = sayError(e, 'check that link');
        cp.setStatus('Can’t check', 'mid');
      }
    };
    lk.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void checkLink();
    });
    cp.body.append(h('p.note', 'Before you open a link from a text, an email or a sticker: where it really goes and any scam signs, from public records. Nothing is opened.'), h('div.row.secpwrow', lk, button('CHECK', () => void checkLink(), 'on')), lkSaid);
    cp.setStatus('Public records');

    // ONE TAP TO LOCK EVERYTHING (security.u11): Telegram unpaired, nothing that leaves runs, until his key unlocks it
    let lockAt: number | null = null;
    const paintLock = () => {
      if (lockAt) {
        const keyIn = h('input', { type: 'password', autocomplete: 'off', 'aria-label': 'Your owner key', placeholder: 'Your owner key', spellcheck: false }) as HTMLInputElement;
        const unlock = async () => {
          const mine = ownerKey.get();
          if (mine && keyIn.value !== mine) {
            keyIn.value = '';
            toast('That is not your owner key. Ghosty stays locked.', 'bad');
            return;
          }
          if (!mine && !(await confirmSheet('Unlock Ghosty?', 'This phone signed in with Cloudflare Access, so there is no key to type here.', 'UNLOCK'))) return;
          try {
            await brain.securityUnlock();
            lockAt = null;
            paintLock();
            toast('Unlocked. Pair Telegram again in Links when you want it.', 'ok');
          } catch (e) {
            toast(sayError(e, 'unlock'), 'bad');
          }
        };
        keyIn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') void unlock();
        });
        kp.setStatus('Locked', 'mid');
        kp.el.dataset.locked = '1';
        clear(kp.body, h('p.note', `Locked since ${new Date(lockAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}: Telegram unpaired, and nothing that publishes, sends, pays or ships runs.`), h('div.row.secpwrow', keyIn, button('UNLOCK', () => void unlock(), 'on')));
      } else {
        kp.setStatus('Open', 'ok');
        delete kp.el.dataset.locked;
        clear(kp.body, h('p.note', 'If something feels wrong: one tap unpairs Telegram and pauses anything that publishes, sends, pays or ships, until you unlock with your owner key.'), h('div.row', button('LOCK EVERYTHING', () => void lockNow(), 'warn')));
      }
    };
    const lockNow = async () => {
      if (!(await confirmSheet('Lock everything?', 'Telegram is unpaired, and anything that publishes, sends, pays or ships is paused, until you unlock with your owner key here.', 'LOCK'))) return;
      try {
        const r = await brain.securityLock();
        lockAt = r.at ?? Date.now();
        paintLock();
        toast('Locked. Unlock here with your owner key.', 'ok');
      } catch (e) {
        toast(sayError(e, 'lock everything'), 'bad');
      }
    };
    paintLock();

    // The phone's own locks show at once; the brain's fill in as they answer.
    /* state: security.locks loading */
    lp.setStatus('Checking…');
    paintLocks();
    paintApprovals();
    const load = async () => {
      const [sec, tg, faces] = await Promise.allSettled([brain.security(), brain.telegramStatus(), knownFaces()]);
      if (sec.status === 'fulfilled') {
        facts.brain = sec.value.locks;
        facts.approvals = sec.value.approvals;
        securityState.brain = sec.value.locks;
        securityState.approvals = sec.value.approvals;
        lockAt = sec.value.lockedAt ?? null;
        paintLock();
      } else {
        /* state: security.locks offline */
        facts.brain = null;
        facts.approvals = null;
        securityState.brain = null;
        securityState.approvals = null;
      }
      facts.telegram = tg.status === 'fulfilled' ? { linked: !!tg.value.linked, paired: !!tg.value.paired } : null;
      facts.faces = faces.status === 'fulfilled' ? faces.value.length : null;
      securityState.at = Date.now();
      paintLocks();
      paintApprovals();
    };
    let loading: Promise<void> | null = null;
    const refreshAll = () => (loading ??= load().finally(() => (loading = null)));
    void refreshAll();
    return {
      enter() {
        const k = ownerKey.get();
        facts.keyLength = k ? k.length : null;
        const b = lastBackup.get();
        facts.lastBackup = b ? { at: b.at, ok: b.ok } : null;
        paintLocks();
        void refreshAll();
      },
      open(arg: string) {
        if (GUIDES.some((g) => g.id === arg)) openGuide(arg);
        // "lock everything": the confirm, the lock itself his tap; "has my password leaked?": the box, ready to type in
        if (arg === 'lock' && !lockAt) void lockNow();
        if (arg === 'leaked') {
          openGuide('doors');
          setTimeout(() => pw.focus(), 300);
        }
      },
      context(): ScreenContext {
        return { screen: 'security', title: 'Security', line: `Security: ${summary || 'checking the locks'}.`, at: Date.now() };
      },
    };
  },
};
