/**
 * JOURNAL (APPS ROUND, MEMORY lane's flagship): HIS own journal, Day One's kind, inside MEMORY (Memory is my diary about him; this is his).
 *  - ENTRIES: write, take a prompt on a blank page, add photos (made smaller on the phone) and a voice note, a mood, a place (a saved
 *    place or his own words, never a position) and which journal; search by his words, and by meaning through the phone's own index;
 *  - CALENDAR: a month, a dot on each day written, a tap for that day; ON THIS DAY: a week, a month and the years ago;
 *  - PLACES: his entries by the place he gave; SETTINGS: his journals and their colours, the Face ID lock (a passkey made on the phone),
 *    a gentle daily nudge through the brain's reminders (the time only: the words never leave the phone), this year as a printable book,
 *    and RECENTLY DELETED;
 *  - the first run shows three example entries and a three-step tour; his streak in the header.
 * Everything is kept on this phone and in the encrypted backup (BACKUP_KEYS: ghosty.journal).
 */
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import type { TabDef } from '../../shell/tabs';
import { screenSays } from '../../shell/awareness';
import { button, modal, panel, toast, undo } from '../../ui/components';
import { page } from '../../ui/page';
import { sections, sectionNow } from '../../ui/sections';
import { canLock, makeKey, unlock } from './lock';
import { photoGps, nearestSaved, asDataUrl, binned, dayKey, dropMedia, getMedia, live, load, matches, newId, onThisDay, putMedia, samples, save, shrink, streak, type Entry, type JournalData, type Mood, type Tone } from './store';
import { J, PROMPTS } from './words';

const ICON = '<path d="M6 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6z"/><path d="M6 3.5v17M9.5 8h6M9.5 11.5h6"/>';
const TONES: Tone[] = ['accent', 'amber', 'green', 'pink', 'violet'];

/** What a spec reads: window.__ghosty.journal. */
export const journalState = { entries: 0, shown: 0, locked: false, open: '' as string, streak: 0, state: 'idle' as 'idle' | 'shown' | 'empty' | 'locked' };

let data: JournalData = load();
const keep = (): boolean => {
  const ok = save(data);
  if (!ok) toast(J.NO_ROOM, 'warn');
  return ok;
};
const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
const time = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const toneOf = (journal: string): Tone => data.journals.find((j) => j.id === journal)?.tone ?? 'accent';

export const journalTab: TabDef = {
  id: 'journal',
  title: 'JOURNAL',
  icon: ICON,
  scene: 'backdrop',
  blurb: 'your own words, kept on this phone',
  inside: 'memory',
  now() {
    const n = live(load()).filter((e) => !e.sample).length;
    return n ? `${n} entr${n === 1 ? 'y' : 'ies'} · ${J.STREAK(streak(load().entries))}` : '';
  },
  mount(root) {
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.journal = journalState;
    const P = page(root, { tag: J.TITLE, sub: J.SUB, leftLabel: 'WRITE', rightLabel: 'LOOK BACK', stack: true });
    let unlocked = false;
    let query = '';
    let only = '';

    // ---------------------------------------------------------------- the first run: examples and the tour
    if (!data.prefs.samplesGone && !live(data).length) {
      data.entries.push(...samples());
      keep();
    }

    // ---------------------------------------------------------------- ENTRIES
    const ep = panel('ENTRIES', { cls: 'jnentries', status: '' });
    const newKey = button(J.NEW, () => openEntry(), 'on');
    newKey.classList.add('jnnew');
    const search = h('input', { type: 'search', placeholder: 'Search what you wrote', 'aria-label': 'Search your journal' }) as HTMLInputElement;
    search.addEventListener('input', () => {
      query = search.value.trim();
      paintEntries();
    });
    const chips = h('div.row.wrap.jnchips', { dataset: { case: 'keep' } });
    const tour = h('div.jntour', { dataset: { case: 'keep' } });
    const list = h('div.jnlist', { dataset: { case: 'keep' } });
    ep.body.append(h('div.row.jnbar', newKey), tour, h('div.jnsearch', search), chips, list);

    const entryRow = (e: Entry) => {
      const r = h('button.jnrow', { type: 'button', dataset: { id: e.id, tone: toneOf(e.journal), case: 'keep' }, 'aria-label': `${day(e.at)}: ${e.text.slice(0, 60)}` },
        h('span.jnwhen', h('b', day(e.at)), h('small', `${time(e.at)}${e.place ? ` · ${e.place}` : ''}${e.mood ? ` · ${J.MOODS[e.mood - 1]}` : ''}${e.sample ? ' · example' : ''}`)),
        h('span.jntext', e.text || (e.photos.length ? 'A photo' : e.voice ? 'A voice note' : '')),
        e.photos[0] ? h('img.jnthumb', { src: e.photos[0].thumb, alt: '' }) : '');
      r.addEventListener('click', () => openEntry(e.id));
      return r;
    };

    const paintEntries = () => {
      const all = live(data);
      journalState.entries = all.length;
      journalState.streak = streak(data.entries);
      P.big.textContent = J.STREAK(journalState.streak).toUpperCase();
      clear(chips, ...(data.journals.length > 1 ? [chip('All', ''), ...data.journals.map((j) => chip(j.name, j.id, j.tone))] : []));
      const shown = all.filter((e) => (!only || e.journal === only) && matches(e, query, data.journals));
      journalState.shown = shown.length;
      journalState.state = shown.length ? 'shown' : 'empty';
      ep.setStatus(all.length ? `${all.length}` : '', 'ok');
      const tourOn = !data.prefs.toured;
      clear(tour, ...(tourOn ? [h('ol.jnsteps', ...J.TOUR.map((s) => h('li', s))), button(J.TOUR_OK, () => { data.prefs.toured = true; keep(); paintEntries(); })] : []),
        ...(all.some((e) => e.sample) ? [h('p.note', J.SAMPLES), button(J.CLEAR_SAMPLES, () => { data.entries = data.entries.filter((e) => !e.sample); data.prefs.samplesGone = true; keep(); paintAll(); })] : []));
      tour.hidden = !tour.childElementCount;
      if (!shown.length) {
        /* state: journal.entries empty */
        clear(list, h('div.empty', { dataset: { case: 'keep' } }, h('b', query ? J.NO_HIT(query) : J.EMPTY_HEAD), h('span', query ? 'Try other words, or fewer of them.' : J.EMPTY_NEXT)));
        if (query) void meaningHits(query);
        return;
      }
      // month headings, newest first
      const out: HTMLElement[] = [];
      let month = '';
      for (const e of shown) {
        const m = new Date(e.at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        if (m !== month) out.push(h('h4.jnmonth', (month = m)));
        out.push(entryRow(e));
      }
      clear(list, ...out);
    };
    /** By meaning, through the phone's own index, when his words found nothing in the journal (only while it is unlocked). */
    const meaningHits = async (q: string) => {
      const R = await import('../memory/recall');
      if (!(await R.recallWarm())) return;
      const hits = (await R.findLocal(q, { k: 8 })).filter((f) => f.kind === 'journal');
      if (!hits.length || search.value.trim() !== q) return;
      clear(list, h('p.note', `By meaning: ${hits.length} entr${hits.length === 1 ? 'y' : 'ies'}.`), ...hits.map((f) => data.entries.find((e) => e.id === f.id)).filter((e): e is Entry => !!e && !e.deleted).map(entryRow));
    };
    const chip = (label: string, id: string, tone?: Tone) => {
      const b = button(label, () => { only = id; paintEntries(); }, only === id ? 'on' : '');
      b.dataset.tone = tone ?? '';
      b.setAttribute('aria-pressed', String(only === id));
      return b;
    };

    // ---------------------------------------------------------------- the editor
    const openEntry = (id?: string, words = '') => {
      const was = id ? data.entries.find((e) => e.id === id) : undefined;
      const e: Entry = was ? { ...was, photos: [...was.photos] } : { id: newId(), journal: only || data.journals[0]!.id, at: Date.now(), text: words, photos: [], edited: Date.now() };
      journalState.open = e.id;
      const text = h('textarea.jntextarea', { rows: 8, placeholder: J.WRITE_HINT, 'aria-label': 'Your entry' }) as HTMLTextAreaElement;
      text.value = e.text;
      const promptLine = h('p.jnprompt', e.prompt ?? '');
      const pk = button(J.PROMPT_KEY, () => {
        e.prompt = PROMPTS[(PROMPTS.indexOf(e.prompt ?? '') + 1 + Math.floor(Math.random() * (PROMPTS.length - 1))) % PROMPTS.length];
        promptLine.textContent = e.prompt!;
        changed();
      });
      const moods = h('div.row.wrap.jnmoods', { role: 'group', 'aria-label': 'How you feel' }, ...J.MOODS.map((m, i) => {
        const b = button(m, () => {
          e.mood = e.mood === i + 1 ? undefined : ((i + 1) as Mood);
          for (const x of moods.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b && !!e.mood));
          changed();
        });
        b.setAttribute('aria-pressed', String(e.mood === i + 1));
        return b;
      }));
      const place = h('input', { type: 'text', placeholder: J.PLACE_HINT, 'aria-label': 'Where you were' }) as HTMLInputElement;
      place.setAttribute('list', 'jnplaces');
      place.value = e.place ?? '';
      const placesList = h('datalist#jnplaces');
      let saved: { label: string; lat: number; lon: number }[] = [];
      void brain.places().then((r) => {
        saved = r.places;
        clear(placesList, ...r.places.map((p) => h('option', { value: p.label })));
      }).catch(() => undefined);
      const jsel = h('select', { 'aria-label': 'Which journal' }, ...data.journals.map((j) => h('option', { value: j.id }, j.name))) as HTMLSelectElement;
      jsel.value = e.journal;
      const when = h('input', { type: 'date', 'aria-label': 'Which day it is about' }) as HTMLInputElement;
      when.value = dayKey(e.at);
      const photos = h('div.row.wrap.jnphotos', { dataset: { case: 'keep' } });
      const paintPhotos = () => clear(photos, ...e.photos.map((p) => h('img.jnphoto', { src: p.thumb, alt: 'A photo in this entry' })));
      paintPhotos();
      const fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true }) as HTMLInputElement;
      fileIn.addEventListener('change', async () => {
        for (const f of [...(fileIn.files ?? [])].slice(0, 10)) {
          // (a photo's own place, read here: only the nearest SAVED place's name is used, never the position)
          if (!place.value.trim() && saved.length) {
            const g = await photoGps(f);
            const near = g ? nearestSaved(g, saved) : null;
            if (near) {
              place.value = near;
              said.textContent = J.PLACE_FROM_PHOTO(near);
            }
          }
          const full = await shrink(f, 1600);
          const small = await shrink(f, 240, 0.7);
          if (!full || !small) {
            toast(J.PHOTO_FAIL, 'warn');
            continue;
          }
          const pid = newId();
          await putMedia(pid, full);
          e.photos.push({ id: pid, thumb: await asDataUrl(small) });
        }
        fileIn.value = '';
        paintPhotos();
        changed();
      });
      const voiceBox = h('div.row.wrap.jnvoice', { dataset: { case: 'keep' } });
      let rec: MediaRecorder | null = null;
      const paintVoice = async () => {
        const audio = e.voice ? await getMedia(e.voice.id) : null;
        const recKey = button(rec ? J.VOICE_STOP : J.VOICE_REC, () => void toggleRec());
        clear(voiceBox, recKey, ...(audio ? [h('audio', { controls: true, src: URL.createObjectURL(audio), 'aria-label': `Your voice note, ${e.voice!.secs} seconds` })] : []));
      };
      const toggleRec = async () => {
        if (rec) return rec.stop();
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const chunks: Blob[] = [];
          const t0 = Date.now();
          rec = new MediaRecorder(stream);
          rec.ondataavailable = (x) => chunks.push(x.data);
          rec.onstop = async () => {
            for (const t of stream.getTracks()) t.stop();
            const blob = new Blob(chunks, { type: rec?.mimeType || 'audio/webm' });
            rec = null;
            const vid = newId();
            if (await putMedia(vid, blob)) {
              if (e.voice) void dropMedia([e.voice.id]);
              e.voice = { id: vid, secs: Math.max(1, Math.round((Date.now() - t0) / 1000)) };
              changed();
            }
            void paintVoice();
          };
          rec.start();
          void paintVoice();
        } catch {
          toast(J.VOICE_NONE, 'warn');
        }
      };
      void paintVoice();
      const said = h('p.note.jnsaved', { role: 'status', 'aria-live': 'polite' });
      // saving as he goes: each change kept half a second after he stops (and an earlier wording kept as a version)
      let timer: ReturnType<typeof setTimeout> | undefined;
      const changed = () => {
        clearTimeout(timer);
        timer = setTimeout(commit, 500);
      };
      const commit = () => {
        if (gone) return;
        const before = data.entries.find((x) => x.id === e.id);
        e.text = text.value;
        e.place = place.value.trim() || undefined;
        e.journal = jsel.value;
        const d = when.value ? new Date(`${when.value}T${new Date(e.at).toTimeString().slice(0, 5)}`) : null;
        if (d && !Number.isNaN(d.getTime())) e.at = d.getTime();
        if (!e.text.trim() && !e.photos.length && !e.voice && !before) return;
        if (before && before.text !== e.text && before.text.trim()) e.versions = [...(before.versions ?? []), { at: before.edited, text: before.text }].slice(-10);
        e.edited = Date.now();
        delete e.sample;
        data.entries = [...data.entries.filter((x) => x.id !== e.id), { ...e }];
        if (keep()) said.textContent = J.SAVED;
        paintAll();
      };
      for (const x of [text, place, jsel, when]) x.addEventListener('input', changed);
      let gone = false;
      const del = button(J.DELETE, () => {
        commit();
        gone = true;
        const it = data.entries.find((x) => x.id === e.id);
        if (it) {
          it.deleted = Date.now();
          keep();
          paintAll();
          undo(J.DELETED, () => {
            const back = data.entries.find((x) => x.id === e.id);
            if (back) delete back.deleted;
            keep();
            paintAll();
          });
        }
        m.close();
      }, 'warn');
      const done = button(J.SAVE, () => {
        commit();
        m.close();
      }, 'on');
      const body = h('div.jneditor', { dataset: { case: 'keep' } },
        h('div.row.wrap.jnmeta', jsel, when), promptLine, text, h('div.row.wrap', pk), h('small.jnlab', 'MOOD'), moods,
        h('small.jnlab', 'PLACE'), place, placesList, h('small.jnlab', 'PHOTOS'), photos, h('div.row.wrap', button(J.PHOTO, () => fileIn.click()), fileIn),
        h('small.jnlab', 'VOICE'), voiceBox, said, h('div.row.wrap.jnkeys', done, ...(was ? [del] : [])));
      const m = modal(was ? day(e.at) : 'New entry', body, () => {
        commit();
        journalState.open = '';
      });
      if (words) changed();
      setTimeout(() => text.focus(), 50);
    };

    // ---------------------------------------------------------------- CALENDAR
    const cp = panel('CALENDAR', { cls: 'jncal', status: '' });
    let shownMonth = new Date();
    shownMonth.setDate(1);
    const calBox = h('div.jncalbox', { dataset: { case: 'keep' } });
    const dayList = h('div.jnlist.jndaylist', { dataset: { case: 'keep' } });
    cp.body.append(calBox, dayList);
    const paintCal = () => {
      const y = shownMonth.getFullYear();
      const mo = shownMonth.getMonth();
      const days = new Map<string, Entry[]>();
      for (const e of live(data)) days.set(dayKey(e.at), [...(days.get(dayKey(e.at)) ?? []), e]);
      const first = (new Date(y, mo, 1).getDay() + 6) % 7;
      const n = new Date(y, mo + 1, 0).getDate();
      const cells: HTMLElement[] = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('span.jncalhd', d));
      for (let i = 0; i < first; i++) cells.push(h('span.jncalpad'));
      for (let d = 1; d <= n; d++) {
        const k = dayKey(new Date(y, mo, d).getTime());
        const has = days.get(k);
        const b = button(String(d), () => clear(dayList, ...(has ?? []).map(entryRow)));
        b.classList.add('jncalday');
        if (has) b.dataset.has = String(has.length);
        b.setAttribute('aria-label', `${d} ${new Date(y, mo, 1).toLocaleDateString('en-GB', { month: 'long' })}${has ? `, ${has.length} entr${has.length === 1 ? 'y' : 'ies'}` : ''}`);
        cells.push(b);
      }
      const label = new Date(y, mo, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const prev = button('‹', () => { shownMonth = new Date(y, mo - 1, 1); paintCal(); });
      prev.setAttribute('aria-label', 'The month before');
      const next = button('›', () => { shownMonth = new Date(y, mo + 1, 1); paintCal(); });
      next.setAttribute('aria-label', 'The month after');
      const inMonth = [...days.keys()].filter((k) => k.startsWith(`${y}-${String(mo + 1).padStart(2, '0')}`)).length;
      cp.setStatus(`${inMonth} DAY${inMonth === 1 ? '' : 'S'}`, 'ok');
      clear(calBox, h('div.row.jncalnav', prev, h('b', label), next), h('div.jncalgrid', ...cells), ...(inMonth ? [] : [h('p.note', J.CAL_EMPTY)]));
      clear(dayList);
    };

    // ---------------------------------------------------------------- ON THIS DAY
    const op = panel('ON THIS DAY', { cls: 'jnotd', status: '' });
    const paintOtd = () => {
      const groups = onThisDay(data.entries);
      op.setStatus(groups.length ? `${groups.length}` : '', 'ok');
      clear(op.body, ...(groups.length ? groups.flatMap((g) => [h('h4.jnmonth', g.label), ...g.entries.map(entryRow)]) : [h('p.note.jnempty', J.OTD_EMPTY)]));
    };

    // ---------------------------------------------------------------- PLACES
    const pp = panel('PLACES', { cls: 'jnplaces', status: '' });
    const paintPlaces = () => {
      const by = new Map<string, Entry[]>();
      for (const e of live(data)) if (e.place) by.set(e.place, [...(by.get(e.place) ?? []), e]);
      pp.setStatus(by.size ? `${by.size}` : '', 'ok');
      clear(pp.body, ...(by.size ? [...by].sort((a, b) => b[1].length - a[1].length).flatMap(([p, es]) => [h('h4.jnmonth', `${p} · ${es.length}`), ...es.slice(0, 5).map(entryRow)]) : [h('p.note.jnempty', J.PLACES_EMPTY)]));
    };

    // ---------------------------------------------------------------- SETTINGS: journals, the lock, the nudge, the book, the bin
    const sp = panel('JOURNAL SETTINGS', { cls: 'jnsettings', status: '' });
    const paintSettings = () => {
      const jn = data.journals.map((j) => {
        const toneKey = button(j.tone.toUpperCase(), () => {
          j.tone = TONES[(TONES.indexOf(j.tone) + 1) % TONES.length]!;
          keep();
          paintAll();
        });
        toneKey.dataset.tone = j.tone;
        toneKey.setAttribute('aria-label', `Change ${j.name}'s colour`);
        return h('div.row.jnjournal', { dataset: { tone: j.tone } }, h('b', j.name), toneKey);
      });
      const nameIn = h('input', { type: 'text', placeholder: J.JOURNAL_NAME, 'aria-label': 'A new journal’s name' }) as HTMLInputElement;
      const addJ = button(J.NEW_JOURNAL, () => {
        const name = nameIn.value.trim().slice(0, 30);
        if (!name) return nameIn.focus();
        data.journals.push({ id: newId(), name, tone: TONES[data.journals.length % TONES.length]! });
        keep();
        paintAll();
      });
      const lockKey = data.prefs.lock
        ? button(J.LOCK_OFF, () => {
            data.prefs.lock = false;
            delete data.prefs.cred;
            keep();
            toast(J.LOCK_CLEARED, 'ok');
            paintAll();
          })
        : button(J.LOCK_ON, async (b) => {
            b.disabled = true;
            const id = await makeKey();
            b.disabled = false;
            if (!id) return void toast(J.LOCK_NONE, 'warn');
            data.prefs.lock = true;
            data.prefs.cred = id;
            keep();
            unlocked = true;
            toast(J.LOCK_SET, 'ok');
            paintAll();
          }, 'on');
      const remindIn = h('input', { type: 'time', value: data.prefs.remind || '20:30', 'aria-label': 'The time for a gentle nudge' }) as HTMLInputElement;
      const setRemind = button(data.prefs.remind ? 'CHANGE THE NUDGE' : 'NUDGE ME DAILY', async (b) => {
        b.disabled = true;
        try {
          if (data.prefs.remindId) await brain.deleteJob(data.prefs.remindId).catch(() => undefined);
          const [hh, mm] = remindIn.value.split(':').map(Number);
          const at = new Date();
          at.setHours(hh ?? 20, mm ?? 30, 0, 0);
          if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
          const r = await brain.addJob({ kind: 'reminder', title: 'Journal', text: 'A line in your journal?', at: at.getTime(), repeat: 'daily' as never });
          data.prefs.remind = remindIn.value;
          data.prefs.remindId = r.job.id;
          keep();
          paintAll();
        } catch {
          toast(J.REMIND_OFFLINE, 'warn');
        } finally {
          b.disabled = false;
        }
      });
      const stopRemind = data.prefs.remind ? button('NO NUDGE', async () => {
        if (data.prefs.remindId) await brain.deleteJob(data.prefs.remindId).catch(() => undefined);
        data.prefs.remind = '';
        delete data.prefs.remindId;
        keep();
        paintAll();
      }) : null;
      const bin = binned(data);
      clear(sp.body,
        h('h4.jnmonth', 'Journals'), ...jn, h('div.row.wrap', nameIn, addJ),
        h('h4.jnmonth', 'Lock'), h('p.note', data.prefs.lock ? 'Face ID or Touch ID opens your journal.' : canLock() ? 'Off: anyone holding your unlocked phone can read it.' : J.LOCK_NONE), ...(canLock() || data.prefs.lock ? [h('div.row.wrap', lockKey)] : []),
        h('h4.jnmonth', 'Nudge'), h('p.note', J.REMIND_LINE(data.prefs.remind)), h('div.row.wrap', remindIn, setRemind, ...(stopRemind ? [stopRemind] : [])),
        h('h4.jnmonth', 'Book'), h('div.row.wrap', button(J.EXPORT, () => exportYear())),
        h('h4.jnmonth', `Recently deleted${bin.length ? ` (${bin.length})` : ''}`),
        ...(bin.length ? bin.map((e) => h('div.row.jnbin', h('span.jntext', `${day(e.at)}: ${e.text.slice(0, 60)}`), button(J.RESTORE, () => {
          delete e.deleted;
          keep();
          toast(J.RESTORED, 'ok');
          paintAll();
        }), button('DELETE NOW', () => {
          void dropMedia([...e.photos.map((p) => p.id), ...(e.voice ? [e.voice.id] : [])]);
          data.entries = data.entries.filter((x) => x !== e);
          keep();
          paintAll();
        }, 'warn'))) : [h('p.note', J.BIN_EMPTY)]),
      );
    };

    /** This year as a book: a clean page of every entry, ready for Print → Save as PDF on the phone. */
    const exportYear = () => {
      const y = new Date().getFullYear();
      const es = live(data).filter((e) => new Date(e.at).getFullYear() === y && !e.sample).sort((a, b) => a.at - b.at);
      if (!es.length) return void toast(J.EXPORT_NONE, 'warn');
      const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
      const html = `<!doctype html><meta charset="utf-8"><title>My journal ${y}</title><style>body{font:16px/1.6 Georgia,serif;max-width:40em;margin:3em auto;padding:0 1em}h1{font-size:2em}h2{font-size:1.1em;margin-top:2.5em;page-break-after:avoid}p{white-space:pre-wrap}img{max-width:30%;margin:.3em}small{color:GrayText}@media print{h2{break-before:auto}}</style><h1>My journal, ${y}</h1>${es.map((e) => `<h2>${esc(day(e.at))}</h2><small>${esc([e.place, e.mood ? J.MOODS[e.mood - 1] : ''].filter(Boolean).join(' · '))}</small>${e.prompt ? `<p><i>${esc(e.prompt)}</i></p>` : ''}<p>${esc(e.text)}</p>${e.photos.map((p) => `<img src="${p.thumb}" alt="">`).join('')}`).join('')}`;
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      const win = window.open(url, '_blank', 'noopener');
      if (!win) toast('Allow pop-ups for Ghosty to see the book, then Print → Save as PDF.', 'warn');
    };

    // ---------------------------------------------------------------- the lock over everything
    const lockBox = h('div.jnlock', { hidden: true, dataset: { case: 'keep' } });
    const paintLock = () => {
      const locked = data.prefs.lock && !!data.prefs.cred && !unlocked;
      journalState.locked = locked;
      lockBox.hidden = !locked;
      for (const el of [ep.el, cp.el, op.el, pp.el, sp.el]) el.classList.toggle('jnhid', locked);
      root.classList.toggle('jnlocked', locked);
      if (locked) {
        journalState.state = 'locked';
        /* state: journal.entries locked */
        clear(lockBox, h('div.empty', h('b', J.LOCKED_HEAD), h('span', J.LOCKED_NEXT)), button(J.UNLOCK, async (b) => {
          b.disabled = true;
          unlocked = await unlock(data.prefs.cred!);
          b.disabled = false;
          if (!unlocked) toast(J.UNLOCK_FAIL, 'warn');
          paintAll();
        }, 'on'));
      }
    };
    // (it locks again when Ghosty goes to the background or he leaves the journal)
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') unlocked = false;
    });

    const paintAll = () => {
      data = load();
      paintLock();
      if (journalState.locked) return;
      paintEntries();
      paintCal();
      paintOtd();
      paintPlaces();
      paintSettings();
    };

    P.sub.after(lockBox);
    P.left.append(ep.el, cp.el);
    P.right.append(op.el, pp.el, sp.el);
    sections(root, 'journal', [
      { id: 'entries', label: 'Entries', match: /^ENTRIES/ },
      { id: 'calendar', label: 'Calendar', match: /^CALENDAR/ },
      { id: 'otd', label: 'On this day', match: /^ON THIS DAY/ },
      { id: 'places', label: 'Places', match: /^PLACES/ },
      { id: 'settings', label: 'Settings', match: /^JOURNAL SETTINGS/ },
    ]);
    paintAll();
    // "new journal entry" / "add to my journal: …" from the chat (features/journal/words.ts journalAsked)
    const pending = (window as unknown as { __journalWrite?: { words?: string } }).__journalWrite;
    return {
      enter() {
        paintAll();
        const p = (window as unknown as { __journalWrite?: { words?: string } | null }).__journalWrite;
        if (p && !journalState.locked) {
          (window as unknown as { __journalWrite?: null }).__journalWrite = null;
          openEntry(undefined, p.words ?? '');
        }
      },
      leave() {
        unlocked = false;
      },
      context: () => screenSays('journal', 'Journal', `the journal, on ${sectionNow('journal').toLowerCase() || 'entries'}${journalState.locked ? ', locked' : ''}`, { looking: 'journal' }),
      describe: () => `Journal: ${journalState.entries} entries, ${J.STREAK(journalState.streak).toLowerCase()}${journalState.locked ? ', locked' : ''}.`,
      ...(pending ? {} : {}),
    };
  },
};
