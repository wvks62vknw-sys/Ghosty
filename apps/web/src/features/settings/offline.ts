/**
 * SETTINGS → OFFLINE BRAIN: whether this phone can run the small model (offline/brain.ts),
 * DOWNLOAD it (≈352 MB, once, best on Wi-Fi) with a progress bar, DELETE it, when to use it
 * (only when needed / always / off), a TEST that shows a reply and its speed, and how long THINK HARDER
 * may take on one question (offline/think.ts; 55 s unless changed).
 */
import { clear, h } from '../../core/dom';
import { deleteOffline, downloadOffline, offlineBrain, offlineReady, offlineReply, offlineSize, offlineSupport, currentModel, withModel } from '../../offline/brain';
import { cleanReply, progressLabel } from '../../offline/prompt';
import { settings } from '../../state/app';
import { bar, button, panel, toast, type Panel } from '../../ui/components';

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
    if (!confirm('Remove the offline brain from this phone? (You can download it again any time.)')) return;
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
      .then((r) => clear(out, h('b', r.text || '(no words)'), h('br'), `${r.tokens} tokens · ${r.perSecond.toFixed(1)} tokens a second`))
      .catch((e) => clear(out, `The test failed: ${String((e as Error)?.message ?? e).slice(0, 200)}`))
      .finally(refresh);
  });

  const paintProgress = (frac: number, text: string) => {
    clear(prog, bar('DOWNLOAD', frac, `${Math.round(frac * 100)}%`), h('div.note', progressLabel(frac, offlineSize())), text ? h('div.note.obtext', text.slice(0, 160)) : null);
  };

  function paint(): void {
    const s = offlineBrain.get();
    const m = currentModel();
    if (!ok) state.textContent = state.textContent || 'Not available on this device.';
    else if (s.busy === 'download') state.textContent = `Downloading ${m.label} (about ${m.mb} MB)… keep Ghosty open, on Wi-Fi.`;
    else if (s.busy === 'load') state.textContent = `Loading ${m.label} into memory…`;
    else if (ready) state.textContent = `Ready on this phone: ${m.label} (${m.mb} MB). Ghosty can talk with no signal.`;
    else state.textContent = `Not downloaded. About ${m.mb} MB, once: use Wi-Fi. Afterwards Ghosty can talk with no connection.`;
    p.setStatus(ok ? (ready ? 'READY' : s.busy ? 'BUSY' : 'NOT DOWNLOADED') : 'UNSUPPORTED', ok ? (ready ? 'ok' : 'mid') : 'off');
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
      paint();
    })();
  }

  p.body.append(
    state,
    prog,
    h('div.keyrow', download, test, del),
    mode,
    think,
    out,
    h('div.note', 'A small AI (Qwen, about 352 MB) that runs on the phone itself, free and private: no tools or live data, but it knows your memory, agenda and library copy. Needs iOS 26 or newer.'),
  );
  offlineBrain.subscribe(paint);
  settings.subscribe((s, prev) => {
    if (s.offlineBrain !== prev.offlineBrain) mode.value = s.offlineBrain;
  });
  refresh();
  return Object.assign(p, { refresh });
}
