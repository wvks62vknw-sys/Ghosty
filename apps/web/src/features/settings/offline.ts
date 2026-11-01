/**
 * SETTINGS → OFFLINE BRAIN: whether this phone can run the small model (offline/brain.ts),
 * DOWNLOAD it (≈352 MB, once, best on Wi-Fi) with a progress bar, DELETE it, when to use it
 * (only when needed / always / off), a TEST that shows a reply and its speed and then runs the report card's
 * QUICK CHECK on the brain in use, how long THINK HARDER may take on one question (offline/think.ts; 55 s unless
 * changed), and SEARCH BY MEANING (./meaning.ts).
 * WHICH BRAIN (the picker): today's Qwen3 0.6B and the bigger Qwen3.5 0.8B, 2B and 4B (offline/models.ts PICKER), each
 * with its download, the memory it needs when running and whether it fits (fitLine: the browser's memory figure, else the
 * owner's 12 GB 18 Pro Max), the one in use marked. GET asks first with the size (never on mobile data) and only stores
 * the files, one piece at a time with "piece 37 of 120 · 412 MB of 1,082 MB" (offline/fill.ts); if Ghosty closes half-way
 * the picker says where it stopped and CONTINUE carries on (nothing restarts by itself). USE is what loads a brain into
 * graphics memory: first the phone's WebGPU limits are checked against it (a brain it cannot run is refused in plain
 * words), then, before the first load of a bigger brain, it warns what it takes and that Ghosty may close; then the
 * brain loads, with 12 s to UNDO it. A load that closed Ghosty is found on the next open: that brain is marked "closed
 * Ghosty on this phone", the 0.6B is back in use, and USE asks again before another try. "What this phone can hold" says
 * what its graphics chip gives and what has run or closed here. A bigger one can be removed (REMOVE asks first in a
 * one-tap confirm, as DELETE does: neither can be put back without downloading again). The weekly training follows the
 * brain chosen here (offline/trained.ts followBase; not the 0.8B, which it does not train). If a bigger one cannot get
 * the memory, the 0.6B takes over and the panel says so.
 * What the phone really holds (25 Oct, "you have to download the offline brain every time"): under the brains, the pieces
 * counted in the cache at opening ("On this phone: Qwen3 0.6B whole (352 MB) · Qwen3.5 2B 37 of 120 pieces"), a brain that
 * lost pieces since its download finished said by name, whether the phone keeps Ghosty's storage for good, and on an
 * iPhone that Safari and the Home Screen app each keep their own; GET is refused before anything is asked or downloaded
 * when the space the phone gives Ghosty cannot hold it.
 */
import { clear, h } from '../../core/dom';
import { overall, voiceLine } from '../../offline/bench';
import { approveLoad, brainsHere, checkBrain, chooseBrain, deleteOffline, downloadOffline, getBrain, gpuLimits, heldOf, keptHere, noRoom, offlineBrain, offlineModels, offlineReady, offlineReply, offlineSize, offlineSupport, currentModel, removeBrain, useBrain, wasClosedWhileGetting, withModel } from '../../offline/brain';
import { readLog } from '../../offline/fill';
import { reportCard, runReportCard } from '../../offline/harder';
import { BIGGER, brainOf, fitLine, FLOOR, heldKey, holdLine, isBigger, memText, MODELS, onPhoneLine, PICKER, shortName, sizeText, slotOf, STAND_INS, stockOf, type GpuLimits, type Held, type ModelDef } from '../../offline/models';
import { cleanReply, progressLabel } from '../../offline/prompt';
import { followBase } from '../../offline/trained';
import { brainKey, syncTrust } from '../../offline/brain';
import { CAT_WORDS, DEFAULT_BAR, judgedFor, trust } from '../../offline/trust';
import { homeScreenApp } from '../system/storage';
import { settings } from '../../state/app';
import { bar, button, confirmSheet, panel, toast, undo, type Panel } from '../../ui/components';
import { meaningBlock } from './meaning';
import { independenceBlock } from '../system/independence';

/** The device's memory when the browser says it (Chrome, at most 8); Safari does not, and the picker uses the 18 Pro Max's 12 GB. */
const deviceGB = (): number | null => {
  const v = (navigator as unknown as { deviceMemory?: unknown }).deviceMemory;
  return typeof v === 'number' && v > 0 ? v : null;
};
/**
 * Whether a brain fits, said from what really happened on this phone when it has been tried (a guess from the memory
 * figure cannot stand next to "closed Ghosty on this phone"), else the rule-of-thumb guess (fitLine).
 */
const fitHere = (m: ModelDef, s: Held['s'] | undefined): string =>
  s === 'loaded' ? 'runs on this phone'
  : s === 'closed' ? 'did not fit this phone'
  : s === 'failed' ? 'ran out of memory on this phone'
  : s === 'refused' ? 'cannot run on this phone'
  : fitLine(m, deviceGB());
/**
 * The sheet just opened keeps its title as written: titles show in sentence case, which turned "Load Qwen3.5 2B?"
 * into "Load qwen3.5 2b?" (confirmSheet opens its sheet at once, so it is the last one on the page).
 */
const keepTitle = (): void => {
  const t = [...document.querySelectorAll<HTMLElement>('.modal .mhead b')].at(-1);
  if (t) t.dataset.case = 'keep';
};
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** On mobile data, as far as the browser can tell (Safari cannot: the confirm asks him to be on Wi-Fi). */
const onMobileData = (): boolean => {
  const c = (navigator as unknown as { connection?: { type?: string; saveData?: boolean } }).connection;
  return c?.type === 'cellular' || c?.saveData === true;
};

export function offlinePanel(): Panel & { refresh(): void } {
  const p = panel('OFFLINE BRAIN', { grow: false, cls: 'offbrain' });
  const state = h('div.note.obstate', 'Checking this phone…');
  const prog = h('div.obprog');
  const mode = h(
    'select',
    { 'aria-label': 'Offline brain mode' },
    h('option', { value: 'auto' }, 'Only when needed (no signal)'),
    h('option', { value: 'always' }, 'Always (never online)'),
    h('option', { value: 'off' }, 'Never'),
  );
  mode.value = settings.get().offlineBrain;
  const MODE_WORDS = { auto: 'only when needed', always: 'always on this phone', off: 'off' } as const;
  mode.addEventListener('change', () => {
    const was = settings.get().offlineBrain;
    const v = mode.value === 'always' || mode.value === 'off' ? mode.value : 'auto';
    settings.set({ offlineBrain: v });
    // Off (no answers with no signal) or always (never the cloud brain) changes every reply: UNDO for 12 s.
    if (v !== was && (v === 'off' || v === 'always'))
      undo(`Offline brain: ${MODE_WORDS[v]}`, () => {
        settings.set({ offlineBrain: was });
        mode.value = was;
        toast(`Offline brain: ${MODE_WORDS[was]} again`, 'ok');
      });
    // "Always" never downloads by itself: until DOWNLOAD, each message only says it isn't here yet.
    if (v === 'always' && !ready) toast('Ghosty answers on this phone only, once you tap Download (on Wi-Fi)', 'warn');
    else toast(v === 'always' ? 'Ghosty answers on this phone only' : v === 'off' ? 'Offline brain off' : 'Offline brain: only when there’s no signal', 'ok');
  });
  // THINK HARDER's time on one question: longer is better on hard ones, and warmer on the phone.
  const think = h(
    'select',
    { 'aria-label': 'Think harder time' },
    h('option', { value: '30' }, 'THINK HARDER: up to 30 s'),
    h('option', { value: '55' }, 'THINK HARDER: up to a minute'),
    h('option', { value: '120' }, 'THINK HARDER: up to 2 minutes'),
  );
  think.value = String(offlineBrain.get().thinkSecs || 55);
  if (!think.value) think.value = '55';
  think.addEventListener('change', () => {
    offlineBrain.set({ thinkSecs: Number(think.value) || 55 });
    toast(`THINK HARDER takes up to ${think.selectedOptions[0]?.textContent?.replace(/^THINK HARDER: up to /, '') ?? 'a minute'} a question`, 'ok');
  });
  // Which model: the stock Qwen3, or a week the self-training published (SYSTEM → OFFLINE BRAIN TRAINING).
  const which = h('select.obmodel', { 'aria-label': 'Offline brain model' });
  const news = h('div.note.obnew');
  which.addEventListener('change', () => {
    if (offlineBrain.get().busy || which.value === offlineBrain.get().model) return;
    // The brain on the phone stops being ready until the new one is downloaded: UNDO goes back to the one that was
    // (its files are still here until another download finishes).
    const was = { model: offlineBrain.get().model, downloaded: offlineBrain.get().downloaded, label: currentModel().label };
    offlineBrain.set({ model: which.value, downloaded: false, loaded: false });
    // (a kept week of another base: the training follows it; a week of the same base changes nothing there)
    if (brainOf(currentModel()) !== offlineBrain.get().trainBase) void followBase(brainOf(currentModel()));
    toast(`${currentModel().label}: tap Download (about ${sizeText(currentModel().mb)}, on Wi-Fi)`, 'ok');
    refresh();
    undo(`Offline brain: ${currentModel().label}`, () => {
      offlineBrain.set({ model: was.model, downloaded: was.downloaded, loaded: false });
      // (and the training follows the brain put back, when its base is another)
      if (brainOf(currentModel()) !== offlineBrain.get().trainBase) void followBase(brainOf(currentModel()));
      toast(`Back to ${was.label}`, 'ok');
      refresh();
    });
  });
  const out = h('div.note.obtest');
  let ok = false;
  let ready = false;

  const download = button('DOWNLOAD', () => {
    if (offlineBrain.get().busy) return;
    void downloadOffline((frac, text) => paintProgress(frac, text))
      .then(() => toast('Offline brain ready on this phone', 'ok'))
      .catch((e) => toast(`Download stopped: ${String((e as Error)?.message ?? e).slice(0, 140)}`, 'bad'))
      .finally(refresh);
    refresh();
  }, 'on');
  // Every size on this phone cannot be put back without downloading it again: a one-tap confirm that says so.
  const del = button('DELETE', async () => {
    if (!(await confirmSheet('Delete the offline brain?', `${currentModel().label} and every other size of it on this phone come off it: with no signal Ghosty cannot answer until you download it again (about ${sizeText(currentModel().mb)}, best on Wi-Fi).`, 'DELETE'))) return;
    void deleteOffline().then(() => toast('Offline brain removed', 'ok')).finally(refresh);
  }, 'warn');
  const test = button('TEST', async () => {
    if (offlineBrain.get().busy) return;
    // TEST loads the brain in use: the same checks and warning as USE.
    if (!(await okToLoad(currentModel()))) return;
    clear(out, 'Thinking on this phone…');
    let raw = '';
    // Its turn on the model like any other job (never in the middle of a reply, THINK HARDER or the report card).
    void withModel(
      'test',
      () =>
        offlineReply(
          [
            { role: 'system', content: 'You are Ghosty, a friendly assistant. Answer in one short line.' },
            { role: 'user', content: 'Say hello in five words.' },
          ],
          (t) => {
            raw += t;
            out.textContent = cleanReply(raw) || 'Thinking on this phone…';
          },
        ),
      { wait: false },
    )
      .then(async (r) => {
        // Then the report card's QUICK CHECK on the same brain: the 20 fixed questions, as in chat.
        const m = currentModel();
        const quick = h('span.obquick', `QUICK CHECK on ${m.label}: getting the questions ready…`);
        clear(out, h('b', r.text || '(no words)'), h('br'), `${r.tokens} token${r.tokens === 1 ? '' : 's'} · ${r.perSecond.toFixed(1)} tokens a second`, h('br'), quick);
        const off = reportCard.subscribe((c) => {
          if (c.total) quick.textContent = `QUICK CHECK on ${m.label}: ${c.done} of ${c.total}…`;
        });
        try {
          const run = await runReportCard(false);
          const right = run.items.filter((x) => x.plain).length;
          const secs = Math.max(1, Math.round(run.ms / 1000));
          quick.textContent = `QUICK CHECK on ${m.label}: ${right} of ${run.items.length} right as in chat (${Math.round(overall(run)[0] * 100)}%) in ${secs >= 90 ? `${Math.round(secs / 60)} min` : `${secs} s`}${voiceLine(run) ? ` · ${voiceLine(run)}` : ''}${run.complete ? '' : ' (stopped early)'}. The whole card: SYSTEM → OFFLINE BRAIN REPORT CARD.`;
        } catch (e) {
          quick.textContent = `QUICK CHECK on ${m.label} did not run: ${String((e as Error)?.message ?? e).slice(0, 160)}`;
        } finally {
          off();
        }
      })
      .catch((e) => clear(out, `The test failed: ${String((e as Error)?.message ?? e).slice(0, 200)}`))
      .finally(refresh);
  });

  // ---- WHICH BRAIN: the picker ----------------------------------------------------------------------------
  const pick = h('div.obpick');
  const fell = h('div.note.obfell');
  let here: string[] = [];

  /**
   * Before a brain goes into graphics memory (USE, TEST): can this phone's graphics chip run it at all (said in plain
   * words when not, and nothing loads), and, before the first load of a bigger brain (or after one closed Ghosty), the
   * warning of what it takes. True to go ahead.
   */
  const okToLoad = async (m: ModelDef): Promise<boolean> => {
    const why = await checkBrain(m);
    if (why) {
      clear(out, why);
      toast(why, 'warn');
      refresh();
      return false;
    }
    const held = heldOf(m);
    // (a small brain asks only after it closed Ghosty here: the 0.6B did, on 31 Oct, while answering)
    if (held?.s !== 'closed' && (!isBigger(m) || held?.s === 'loaded')) return true;
    const before = held?.s === 'closed' ? `It closed Ghosty on this phone on ${new Date(held.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}${held.phase === 'answering' ? ' while answering' : ''}. ` : '';
    // (a small one comes back on the next smaller brain here: the 0.6B on the 0.5B, either on the floor)
    const rung = MODELS.findIndex((x) => heldKey(x) === heldKey(m));
    const below = rung < 0 ? undefined : MODELS.slice(rung + 1).find((x) => here.includes(x.id));
    const comeBack = isBigger(m) ? ` on the ${shortName(MODELS[0]!)}` : below ? ` on the ${shortName(below)}` : '';
    const asking = confirmSheet(`Load ${m.label}?`, `${before}Loading the ${shortName(m)} takes about ${memText(m.vram)} of graphics memory. If the phone cannot hold it, Ghosty will close and come back${comeBack}.`, 'LOAD IT');
    keepTitle();
    const yes = await asking;
    if (yes) approveLoad(m);
    return yes;
  };

  /**
   * USE: a brain on this phone becomes the one in use and loads now (after okToLoad), so a phone that cannot hold it
   * finds out here. Every reply changes, and the training starts a fresh chain: UNDO for 12 s goes back to the brain
   * that was (still on this phone) and its base.
   */
  const use = async (m: ModelDef) => {
    if (offlineBrain.get().busy) return;
    if (!(await okToLoad(m))) return;
    const was = currentModel();
    try {
      await useBrain(m.id);
    } catch (e) {
      toast(String((e as Error)?.message ?? e).slice(0, 300), 'bad');
      refresh();
      return;
    }
    // (the 0.8B is not trained: the training stays on its base)
    if (!m.alone) void followBase(brainOf(m));
    toast(`${m.label} is loaded and is the offline brain now: tap Test to try it on this phone`, 'ok');
    refresh();
    undo(`Offline brain: ${m.label}`, () => {
      if (!chooseBrain(was.id)) return;
      if (!was.alone) void followBase(brainOf(was));
      toast(`Back to ${was.label}`, 'ok');
      refresh();
    });
  };
  /** GET (or CONTINUE): a brain's files onto this phone, asked first with the size, never on mobile data; nothing is loaded. */
  const get = async (m: ModelDef) => {
    if (offlineBrain.get().busy) return;
    if (onMobileData()) {
      toast(`You are on mobile data: ${m.label} is about ${sizeText(m.mb)}. Join Wi-Fi, then press Get again.`, 'warn');
      return;
    }
    // Not when the space this phone gives Ghosty cannot hold it: said before anything is asked or downloaded.
    const room = await noRoom(m);
    if (room) {
      clear(out, room);
      toast(room, 'warn');
      return;
    }
    // Asked in Ghosty's own sheet, as every other question here (the browser's confirm() is a system alert headed by
    // the site's address on an iPhone).
    const resume = readLog()?.model === m.id;
    const yes = resume
      ? await confirmSheet('Carry on downloading?', `Carry on getting ${m.label}? The pieces already on this phone are kept; the rest of about ${sizeText(m.mb)} comes now, so only on Wi-Fi.`, 'CARRY ON')
      : await confirmSheet('Download this brain?', `Download ${m.label}? About ${sizeText(m.mb)}, once, so only on Wi-Fi. It is only stored: nothing is loaded until you tap USE, which first checks this phone can run it (it needs about ${memText(m.vram)} of memory when running; if your phone cannot give it that, ${MODELS[0]!.label} takes over).`, 'DOWNLOAD');
    if (!yes || offlineBrain.get().busy) return;
    void getBrain(m.id, (frac, text) => paintProgress(frac, text))
      .then(() => toast(`${m.label} is on this phone: tap Use to load it`, 'ok'))
      .catch((e) => toast(`Download stopped: ${String((e as Error)?.message ?? e).slice(0, 200)}`, 'bad'))
      .finally(refresh);
    refresh();
  };
  /** Remove a bigger brain's files: they cannot be put back without downloading them again, so a one-tap confirm says so. */
  const remove = async (m: ModelDef) => {
    if (offlineBrain.get().busy) return;
    if (!(await confirmSheet('Remove this brain?', `${m.label} comes off this phone and frees about ${sizeText(m.mb)}. To use it again it must be downloaded again (about ${sizeText(m.mb)}, best on Wi-Fi).`, 'REMOVE'))) return;
    if (offlineBrain.get().busy) return;
    void removeBrain(m.id).then(() => toast(`${m.label} removed from this phone`, 'ok')).finally(refresh);
  };

  /** A download that did not finish: where it stopped, and how to carry on (never by itself). */
  const getting = h('div.note.obgetting');
  const hold = h('div.note.obhold');
  /** What this phone really holds (counted in the cache at opening), what went missing, and whether it is kept for good. */
  const keep = h('div.note.obkeep');
  let kept: Awaited<ReturnType<typeof keptHere>> = null;
  let limits: GpuLimits | null = null;
  function carryOnLine(): string {
    const log = readLog();
    if (!log || offlineBrain.get().busy === 'download') return '';
    const m = offlineModels().find((x) => x.id === log.model);
    if (!m) return '';
    const at = log.of > 0 ? ` at piece ${log.piece} of ${log.of}${log.parts && log.parts > 1 && log.part ? `, part ${log.part} of ${log.parts}` : ''}` : '';
    // (a picker brain not in use has its CONTINUE; the brain in use, or a trained week, carries on with DOWNLOAD)
    const how = PICKER.some((x) => x.id === m.id) && slotOf(m) !== slotOf(currentModel()) ? 'Tap CONTINUE' : 'Press DOWNLOAD';
    return wasClosedWhileGetting() ? `Ghosty was closed while getting ${m.label}${at}. ${how} to carry on from there.` : `Getting ${m.label} stopped${at}. ${how} to carry on from there.`;
  }

  /**
   * The stand-ins, each a row of its own once the brain above it could not run here, or when it is on this phone: the
   * Qwen2.5 0.5B ("the smallest") after the 0.6B, the floor ("the tiniest", SmolLM2 360M) after the 0.5B.
   */
  const least = MODELS[1]!;
  const shownAfter = (above: ModelDef, m: ModelDef): boolean => {
    const s = heldOf(above)?.s;
    return here.includes(m.id) || currentModel().id === m.id || s === 'closed' || s === 'failed' || !!heldOf(m);
  };
  const leastShown = (): boolean => shownAfter(MODELS[0]!, least);
  const floorShown = (): boolean => shownAfter(least, FLOOR);
  /** Smallest first: the floor, the 0.5B, then the 0.6B and the bigger brains. */
  const pickerRows = (): ModelDef[] => [...(floorShown() ? [FLOOR] : []), ...(leastShown() ? [least] : []), ...PICKER];

  function paintPick(): void {
    const s = offlineBrain.get();
    const now = currentModel();
    const inUse = slotOf(now);
    const log = readLog();
    clear(
      pick,
      h('div.lab', 'WHICH BRAIN'),
      // when a bigger brain could not get the memory (or closed Ghosty): said here, beside the brains, until one is chosen again
      fell,
      getting,
      ...pickerRows().map((m) => {
        // (a stand-in shares the 0.6B's row in the training, so it is in use only when it is the model itself)
        const stand = (x: ModelDef) => STAND_INS.some((y) => y.id === x.id);
        const using = stand(m) ? now.id === m.id : slotOf(m) === inUse && !(m === MODELS[0] && stand(now));
        const onPhone = here.includes(m.id) || (using && ready && now.id === m.id);
        const partial = !onPhone && log?.model === m.id;
        const tag = using ? (now.id === m.id ? 'IN USE' : `IN USE: ${now.label}`) : onPhone ? 'ON THIS PHONE' : '';
        const btns: HTMLButtonElement[] = [];
        if (!using && onPhone) btns.push(button('USE', () => void use(m), 'on'));
        if (!using && !onPhone) {
          const g = button(partial ? 'CONTINUE' : 'GET', () => void get(m));
          g.setAttribute('aria-label', partial ? `Carry on getting ${m.label}: about ${sizeText(m.mb)} in all, on Wi-Fi` : `Get ${m.label}: about ${sizeText(m.mb)}, on Wi-Fi`);
          btns.push(g);
        }
        if (!using && (onPhone || partial) && BIGGER.includes(m)) btns.push(button('REMOVE', () => void remove(m), 'warn'));
        for (const b of btns) b.disabled = !ok || !!s.busy;
        const held = heldOf(m);
        return h(
          `div.obbrain${using ? '.on' : ''}` as 'div',
          { dataset: { model: m.id } },
          h('div.obname', h('b', m.label), tag ? h('span.obtag', tag) : null),
          h('div.note.obfacts', `${sizeText(m.mb)} download · about ${memText(m.vram)} of memory when running · ${fitHere(m, held?.s)}${m === MODELS[0] ? ' · the fallback' : m === least ? ' · the smallest' : m === FLOOR ? ' · the tiniest' : ''}`),
          held?.s === 'closed' ? h('div.note.obclosed', `closed Ghosty on this phone (${new Date(held.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})${held.phase === 'answering' ? ', while answering' : ''}: USE asks before trying again`) : null,
          btns.length ? h('div.keyrow', ...btns) : null,
        );
      }),
      keep,
      hold,
    );
    paintKeep();
    fell.textContent = s.fellBack ?? '';
    fell.hidden = !fell.textContent;
    getting.textContent = carryOnLine();
    getting.hidden = !getting.textContent;
    hold.textContent = ok ? holdLine(limits, s.held ?? {}, pickerRows()) : '';
    hold.hidden = !hold.textContent;
  }

  /**
   * The storage lines: the pieces on this phone per brain, any brain that lost pieces since its download finished (by
   * name), whether the phone keeps Ghosty's storage for good, and, on an iPhone, that Safari and the Home Screen app each
   * keep their own.
   */
  function paintKeep(): void {
    if (!ok || !kept) {
      clear(keep);
      keep.hidden = true;
      return;
    }
    const lines: string[] = [];
    if (kept.cacheless) lines.push('This browser gives Ghosty no Cache storage, so a brain cannot be kept here: it would download every time.');
    else lines.push(onPhoneLine(kept.kept), ...kept.gone);
    if (kept.persisted === true) lines.push('Kept for good: yes. The phone will not clear Ghosty’s downloads to make space.');
    else if (kept.persisted === false) lines.push('Kept for good: no. The phone may clear downloaded brains when it runs short of space.');
    if (isIos()) lines.push(`This is ${homeScreenApp() ? 'the Home Screen app' : 'Safari'}: a brain stays where it was downloaded (Safari and the Home Screen app each keep their own), so use Ghosty from one of them.`);
    clear(keep, ...lines.map((l, i) => h(`div${i === 0 ? '.obhere' : kept!.gone.includes(l) ? '.obgone' : ''}` as 'div', l)));
    keep.hidden = false;
  }

  const paintProgress = (frac: number, text: string) => {
    // GET's own line ("piece 37 of 120 · 412 MB of 1,082 MB") says the sizes; a load says WebLLM's words under the bar.
    const pieces = /^piece \d/.test(text);
    clear(prog, bar(offlineBrain.get().busy === 'load' ? 'LOADING' : 'DOWNLOAD', frac, `${Math.round(frac * 100)}%`), pieces ? null : h('div.note', progressLabel(frac, offlineSize())), text ? h('div.note.obtext', text.slice(0, 160)) : null);
  };

  function paintModels(): void {
    const s = offlineBrain.get();
    // The weeks trained on the base in use (and the recommended one, whatever its base), then its stock build and,
    // for the 0.6B, the stock Qwen3 and its Qwen2.5 stand-in. The bigger brains themselves are in the picker below.
    const base = brainOf(currentModel());
    const stock = base === 'qwen3-0.6b' ? MODELS : [stockOf(base)];
    const list = offlineModels().filter((m) => !PICKER.concat(MODELS).some((x) => x.id === m.id) && (brainOf(m) === base || m.rev === s.active)).concat(stock);
    clear(which, ...list.map((m) => h('option', { value: m.id }, m.id === list.find((x) => x.rev === s.active)?.id ? `${m.label} · recommended` : m.label)));
    which.value = currentModel().id;
    which.hidden = list.length <= stock.length;
    const best = list.find((m) => m.rev === s.active);
    news.textContent = best && best.id !== s.model ? `NEW: ${best.label} is the recommended brain (it did better in its test than the brain it was trained from). Choose it above, then DOWNLOAD (about ${sizeText(best.mb)}, on Wi-Fi).` : '';
    news.hidden = !news.textContent;
  }

  function paint(): void {
    paintTrust();
    const s = offlineBrain.get();
    const m = currentModel();
    paintModels();
    paintPick();
    if (!ok) state.textContent = state.textContent || 'Not available on this device.';
    else if (s.busy === 'download') {
      const g = offlineModels().find((x) => x.id === s.getting) ?? m;
      state.textContent = `Downloading ${g.label} (about ${sizeText(g.mb)})… keep Ghosty open, on Wi-Fi. Nothing is loaded into memory while it downloads.`;
    } else if (s.busy === 'load') state.textContent = `Loading ${m.label} into graphics memory…`;
    else if (ready) state.textContent = `Ready on this phone: ${m.label} (${sizeText(m.mb)}). Ghosty can talk with no signal.`;
    else state.textContent = `Not downloaded. About ${sizeText(m.mb)}, once: use Wi-Fi. Afterwards Ghosty can talk with no connection.`;
    p.setStatus(ok ? (ready ? 'READY' : s.busy ? 'BUSY' : 'NOT DOWNLOADED') : 'UNSUPPORTED', ok ? (ready ? 'ok' : 'mid') : 'off');
    // A phone that cannot run it: the row shows why instead of a dead end.
    p.el.querySelector<HTMLElement>(':scope > h3 small')!.dataset.label = ok ? p.el.querySelector<HTMLElement>(':scope > h3 small')!.dataset.label ?? '' : 'Not on this phone';
    download.disabled = !ok || ready || !!s.busy;
    del.disabled = !ok || (!ready && !s.downloaded) || !!s.busy;
    test.disabled = !ok || !ready || !!s.busy;
    if (s.busy === 'download' || s.busy === 'load') paintProgress(s.progress, s.text);
    else if (!s.busy) clear(prog);
  }

  // ---- [offline2] TRUST: what the brain in use answers on this phone FIRST, by its report card, and his bar ----------
  const barWords = (): string => `Above this grade I answer on your phone first: ${trust.get().bar}%`;
  const dialSays = h('span', barWords());
  const dial = h('input.trustdial', { type: 'range', min: '50', max: '100', step: '5', 'aria-label': 'Trust bar: above this grade I answer on your phone first' }) as HTMLInputElement;
  dial.value = String(trust.get().bar);
  dial.addEventListener('input', () => {
    trust.set({ bar: Math.min(100, Math.max(50, Number(dial.value) || DEFAULT_BAR)) });
    dialSays.textContent = barWords();
  });
  const trustRows = h('div.trustrows');
  function paintTrust(): void {
    const m = currentModel();
    const key = brainKey(m);
    const card = trust.get().brains.find((b) => b.model === key);
    const rows = judgedFor(key);
    const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    clear(
      trustRows,
      h('div.note.small.trustcard', card ? `${m.label}'s report card: ${card.papers ?? 0} paper${card.papers === 1 ? '' : 's'} at SCHOOL, the last on ${day(card.at)}.` : `${m.label} has sat no SCHOOL paper yet: until it does, the cloud answers everything first.`),
      h('ul.trusttable', { 'aria-label': `What ${m.label} answers on this phone first` }, ...rows.map((r) => {
        const grade = r.pct === null ? 'not tested' : `${r.pct}%`;
        return h(`li.trustrow${r.trusted ? '.on' : ''}` as 'li', { 'aria-label': `${CAT_WORDS[r.cat].label}: ${grade} on ${r.items} questions. ${r.trusted ? 'Answered on this phone first' : 'The cloud answers first'}: ${r.why}.` },
          h('b', CAT_WORDS[r.cat].label), h('span.trustgrade', r.pct === null ? '—' : grade), h('span.trustn', `${r.items} q`), h('span.trustis', r.trusted ? 'ON PHONE' : 'CLOUD'), h('small.trustwhy', r.why));
      })),
      h('div.note.small', 'Everything else is the cloud’s: search, tools, long thinking and anything that acts, and anything that names a time or a place or asks me to remind, send or search. Under each answer I give first, ASK THE CLOUD asks it again there; three of those in a week and that kind goes back to the cloud until the next report card.'),
    );
  }
  const trustBox = h('div.trustbox', h('div.lab', 'TRUST'), h('label.trustbar', dialSays, dial), trustRows);
  trust.subscribe(() => {
    dial.value = String(trust.get().bar);
    dialSays.textContent = barWords();
    paintTrust();
    paintPick();
  });
  paintTrust();

  function refresh(): void {
    void syncTrust();
    void (async () => {
      const sup = await offlineSupport();
      ok = sup.ok;
      if (!ok) state.textContent = `${sup.reason} Ghosty still answers from the cloud brain and your library.`;
      ready = ok && (await offlineReady());
      here = ok ? await brainsHere() : [];
      kept = ok ? await keptHere().catch(() => null) : null;
      limits = ok ? ((await gpuLimits())?.limits ?? null) : null;
      paint();
    })();
  }

  p.body.append(
    state,
    news,
    which,
    prog,
    h('div.keyrow', download, test, del),
    // TEST's reply, speed and QUICK CHECK right under TEST (it was under the two choices below, out of sight)
    out,
    // the choice under its own name, so each one stays short enough to show whole in a phone's or a laptop's column
    h('div.lab', 'WHEN THE PHONE ANSWERS'),
    mode,
    think,
    // [offline2] TRUST: the kinds of ask the brain in use answers here first, by its report card, at his bar
    trustBox,
    // How much of his week his own brains answered, and SOVEREIGN MODE (Always) with what still needed the cloud (OWNER-ISSUES 78)
    independenceBlock(),
    // What it is for (OWNER-ISSUES 46: "the big brain without straining my phone"): online he already has far bigger
    // free brains; this one is for no signal. No size here: the brain in use says its own above.
    h('div.note.obwhat', 'For when there is no signal. Online, Ghosty answers with far bigger brains, free, and nothing on this phone strains. This one runs on the phone itself, free and private: no tools or live news, but it knows your memory, your agenda and the library copy.'),
    pick,
    // What a bigger brain costs and gains, in one line, and where the truth is found.
    h('div.note.obcost', 'A bigger brain here answers better with no signal, but costs a bigger download, more of the phone’s memory and a slower first word. Whether it really fits is only known on your phone: choose it, then tap TEST after it loads.'),
    // Search by meaning: the library on this phone found by what passages mean (its own small model, ~70 MB).
    meaningBlock(),
  );
  offlineBrain.subscribe(paint);
  settings.subscribe((s, prev) => {
    if (s.offlineBrain !== prev.offlineBrain) mode.value = s.offlineBrain;
  });
  refresh();
  return Object.assign(p, { refresh });
}
