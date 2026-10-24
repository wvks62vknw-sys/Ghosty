/**
 * SETTINGS → OFFLINE BRAIN: whether this phone can run the small model (offline/brain.ts),
 * DOWNLOAD it (≈352 MB, once, best on Wi-Fi) with a progress bar, DELETE it, when to use it
 * (only when needed / always / off), a TEST that shows a reply and its speed and then runs the report card's
 * QUICK CHECK on the brain in use, how long THINK HARDER may take on one question (offline/think.ts; 55 s unless
 * changed), and SEARCH BY MEANING (./meaning.ts).
 * WHICH BRAIN (the picker): today's Qwen3 0.6B and the bigger Qwen3.5 2B and 4B (offline/models.ts PICKER), each with
 * its download, the memory it needs when running and whether it fits (fitLine: the browser's memory figure, else the
 * owner's 12 GB 18 Pro Max), the one in use marked; GET asks first with the size (never on mobile data), a brain on the
 * phone is switched to at once (USE), a bigger one can be removed. The weekly training follows the brain chosen here
 * (offline/trained.ts followBase). If a bigger one cannot get the memory, the 0.6B takes over and the panel says so.
 */
import { clear, h } from '../../core/dom';
import { overall, voiceLine } from '../../offline/bench';
import { brainsHere, chooseBrain, deleteOffline, downloadOffline, offlineBrain, offlineModels, offlineReady, offlineReply, offlineSize, offlineSupport, currentModel, removeBrain, withModel } from '../../offline/brain';
import { reportCard, runReportCard } from '../../offline/harder';
import { BIGGER, brainOf, fitLine, memText, MODELS, PICKER, sizeText, stockOf, type ModelDef } from '../../offline/models';
import { cleanReply, progressLabel } from '../../offline/prompt';
import { followBase } from '../../offline/trained';
import { settings } from '../../state/app';
import { bar, button, panel, toast, type Panel } from '../../ui/components';
import { meaningBlock } from './meaning';

/** The device's memory when the browser says it (Chrome, at most 8); Safari does not, and the picker uses the 18 Pro Max's 12 GB. */
const deviceGB = (): number | null => {
  const v = (navigator as unknown as { deviceMemory?: unknown }).deviceMemory;
  return typeof v === 'number' && v > 0 ? v : null;
};
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
    h('option', { value: 'auto' }, 'Use it: only when needed'),
    h('option', { value: 'always' }, 'Use it: always (never the cloud brain)'),
    h('option', { value: 'off' }, 'Use it: off'),
  );
  mode.value = settings.get().offlineBrain;
  mode.addEventListener('change', () => {
    const v = mode.value === 'always' || mode.value === 'off' ? mode.value : 'auto';
    settings.set({ offlineBrain: v });
    // "Always" never downloads by itself: until DOWNLOAD, each message only says it isn't here yet.
    if (v === 'always' && !ready) toast('Ghosty answers on this phone only, once you DOWNLOAD it (on Wi-Fi)', 'warn');
    else toast(v === 'always' ? 'Ghosty answers on this phone only' : v === 'off' ? 'Offline brain off' : 'Offline brain: only when the brain can’t answer', 'ok');
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
    offlineBrain.set({ model: which.value, downloaded: false, loaded: false });
    // (a kept week of another base: the training follows it; a week of the same base changes nothing there)
    if (brainOf(currentModel()) !== offlineBrain.get().trainBase) void followBase(brainOf(currentModel()));
    toast(`${currentModel().label}: press DOWNLOAD (about ${sizeText(currentModel().mb)}, on Wi-Fi)`, 'ok');
    refresh();
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
  const del = button('DELETE', () => {
    if (!confirm('Remove the offline brain from this phone, every size of it? (You can download it again any time.)')) return;
    void deleteOffline().then(() => toast('Offline brain removed', 'ok')).finally(refresh);
  }, 'warn');
  const test = button('TEST', () => {
    if (offlineBrain.get().busy) return;
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
        clear(out, h('b', r.text || '(no words)'), h('br'), `${r.tokens} tokens · ${r.perSecond.toFixed(1)} tokens a second`, h('br'), quick);
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

  /** Start using a brain that is on this phone (the training follows it). */
  const use = (m: ModelDef) => {
    if (!chooseBrain(m.id)) return;
    void followBase(brainOf(m));
    toast(`${m.label} is the offline brain now: tap TEST to try it on this phone`, 'ok');
    refresh();
  };
  /** Download a brain: asked first, with its size, and never on mobile data. */
  const get = (m: ModelDef) => {
    if (offlineBrain.get().busy) return;
    if (onMobileData()) {
      toast(`You are on mobile data: ${m.label} is about ${sizeText(m.mb)}. Join Wi-Fi, then press GET again.`, 'warn');
      return;
    }
    if (!confirm(`Download ${m.label}? About ${sizeText(m.mb)}, once, so only on Wi-Fi. It needs about ${memText(m.vram)} of memory when running; if your phone cannot give it that, ${MODELS[0]!.label} takes over.`)) return;
    if (!chooseBrain(m.id)) return;
    void downloadOffline((frac, text) => paintProgress(frac, text))
      .then(() => {
        void followBase(brainOf(m));
        toast(`${m.label} is on this phone: tap TEST to try it`, 'ok');
      })
      .catch((e) => toast(`Download stopped: ${String((e as Error)?.message ?? e).slice(0, 200)}`, 'bad'))
      .finally(refresh);
    refresh();
  };
  const remove = (m: ModelDef) => {
    if (offlineBrain.get().busy || !confirm(`Remove ${m.label} from this phone? It frees about ${sizeText(m.mb)}; you can get it again any time.`)) return;
    void removeBrain(m.id).then(() => toast(`${m.label} removed from this phone`, 'ok')).finally(refresh);
  };

  function paintPick(): void {
    const s = offlineBrain.get();
    const now = currentModel();
    const inUse = brainOf(now);
    clear(
      pick,
      h('div.lab', 'WHICH BRAIN'),
      // when a bigger brain could not get the memory: said here, beside the brains, until one is chosen again
      fell,
      ...PICKER.map((m) => {
        const using = brainOf(m) === inUse;
        const onPhone = here.includes(m.id) || (using && ready && now.id === m.id);
        const tag = using ? (now.id === m.id ? 'IN USE' : `IN USE: ${now.label}`) : onPhone ? 'ON THIS PHONE' : '';
        const btns: HTMLButtonElement[] = [];
        if (!using && onPhone) btns.push(button('USE', () => use(m), 'on'));
        if (!using && !onPhone) {
          const g = button('GET', () => get(m));
          g.setAttribute('aria-label', `Get ${m.label}: about ${sizeText(m.mb)}, on Wi-Fi`);
          btns.push(g);
        }
        if (!using && onPhone && BIGGER.includes(m)) btns.push(button('REMOVE', () => remove(m), 'warn'));
        for (const b of btns) b.disabled = !ok || !!s.busy;
        return h(
          `div.obbrain${using ? '.on' : ''}` as 'div',
          { dataset: { model: m.id } },
          h('div.obname', h('b', m.label), tag ? h('span.obtag', tag) : null),
          h('div.note.obfacts', `${sizeText(m.mb)} download · about ${memText(m.vram)} of memory when running · ${fitLine(m, deviceGB())}${m === MODELS[0] ? ' · the fallback' : ''}`),
          btns.length ? h('div.keyrow', ...btns) : null,
        );
      }),
    );
    fell.textContent = s.fellBack ?? '';
    fell.hidden = !fell.textContent;
  }

  const paintProgress = (frac: number, text: string) => {
    clear(prog, bar('DOWNLOAD', frac, `${Math.round(frac * 100)}%`), h('div.note', progressLabel(frac, offlineSize())), text ? h('div.note.obtext', text.slice(0, 160)) : null);
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
    const s = offlineBrain.get();
    const m = currentModel();
    paintModels();
    paintPick();
    if (!ok) state.textContent = state.textContent || 'Not available on this device.';
    else if (s.busy === 'download') state.textContent = `Downloading ${m.label} (about ${sizeText(m.mb)})… keep Ghosty open, on Wi-Fi.`;
    else if (s.busy === 'load') state.textContent = `Loading ${m.label} into memory…`;
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

  function refresh(): void {
    void (async () => {
      const sup = await offlineSupport();
      ok = sup.ok;
      if (!ok) state.textContent = `${sup.reason} Ghosty still answers from the cloud brain and your library.`;
      ready = ok && (await offlineReady());
      here = ok ? await brainsHere() : [];
      paint();
    })();
  }

  p.body.append(
    state,
    news,
    which,
    prog,
    h('div.keyrow', download, test, del),
    mode,
    think,
    out,
    h('div.note', 'A small AI (Qwen, about 352 MB) that runs on the phone itself, free and private: no tools or live data, but it knows your memory, agenda and library copy. Needs iOS 26 or newer.'),
    pick,
    // What a bigger brain costs and gains, in one line, and where the truth is found.
    h('div.note.obcost', 'A bigger brain answers better, but costs a bigger download, more of the phone’s memory and a slower first word. Whether it really fits is only known on your phone: choose it, then tap TEST after it loads.'),
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
