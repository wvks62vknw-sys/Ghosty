/**
 * MEMORY tab: what Ghosty knows about you — the TIMELINE (everything, newest first, each with
 * where it came from; EDIT, FORGET with UNDO, LOCK — timeline.ts), PATTERNS it noticed, ME
 * (your profile, in your own words, built by the nightly reflection and editable here), the facts
 * it remembers, the lessons it learned, the DIARY it writes (one entry a day; REFLECT NOW writes
 * today's) — and the conversation history.
 */
import type { DiaryEntry, Lesson, MemoryFact, Profile, ProfileSection } from '../../../../../packages/shared/src/protocol';
import { PROFILE_SECTIONS } from '../../../../../packages/shared/src/protocol';
import { brain } from '../../api/brain';
import { offline } from '../../api/offline';
import { chat, clearConversation } from '../../assistant/session';
import { clear, fmt, h, icon } from '../../core/dom';
import { swipeToDelete } from '../../ui/swipe';
import type { TabDef } from '../../shell/tabs';
import { button, empty, modal, pager, panel, row, toast, undo } from '../../ui/components';
import { page } from '../../ui/page';
import { sections } from '../../ui/sections';
import { placesBlock } from './places';
import { principlesEditor } from '../settings/principles';
import { diaryDay, lineId, offlineNow, patternsPanel, timelinePanel, why } from './timeline';

/** "today", "yesterday", else "Sat 17 Oct" (when ME was last updated). */
function dayWord(t: number): string {
  const d = new Date(t);
  const today = new Date();
  const days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** ME's sections, headed in his words (the brain keeps them as about, likes, dislikes …). */
const HEADINGS: Record<ProfileSection, string> = {
  about: 'Who you are',
  likes: 'What you like',
  dislikes: 'What you don’t like',
  people: 'Your people',
  places: 'Places in your life',
  routines: 'Your routines',
  goals: 'What you’re working towards',
  work: 'Your work',
  other: 'Also',
};

export const memoryTab: TabDef = {
  id: 'memory',
  title: 'MEMORY',
  icon: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="9" cy="18" r="2.5"/><path d="M8 7l8 1M7 8l2 8M17 10l-6 7"/>',
  scene: 'backdrop',
  blurb: 'what Ghosty knows about you',
  // the facts this phone was last given (api/offline.ts keeps a copy)
  now() {
    const n = offline.get().memory?.length;
    return n == null ? '' : n === 1 ? '1 thing remembered' : `${fmt.n(n)} things remembered`;
  },
  mount(root) {
    // On the phone one page in sections (ui/sections.ts) instead of two sides to swap between: Me (who he is first, with
    // his places), Patterns, Timeline, Diary and Chat (what I remember, the lessons, the conversation).
    const P = page(root, { tag: 'NEURAL MEMORY', sub: 'stored in your private brain, synced across your devices', rightLabel: 'DIARY & CHAT', leftLabel: 'YOU', stack: true });
    // A change in the TIMELINE shows in the panels below it, and theirs in it.
    const tl = timelinePanel(() => {
      void refresh();
      void refreshLessons();
      void refreshProfile(false);
    });
    const pats = patternsPanel();
    const refreshTimeline = async () => {
      await tl.refresh();
      pats.set(tl.patterns);
    };
    const clip = (t: string) => (t.length > 70 ? `${t.slice(0, 70)}…` : t);
    /** UNDO for a ✕ here: the timeline's restore brings the memory back as it was (locked still, if it was). */
    const putBack = async (id: string) => {
      await brain.memoryChange(id, 'restore');
      toast('Back in my memory', 'ok');
      void refresh();
      void refreshLessons();
      void refreshProfile();
    };
    const fp = panel('WHAT I REMEMBER', { footer: true });
    let facts: MemoryFact[] = [];
    const refresh = async () => {
      try {
        facts = (await brain.memory()).facts;
        fp.setStatus(`${facts.length}`, 'ok');
      } catch (e) {
        fp.setStatus('OFFLINE', 'off');
      }
      fg.set([...facts].reverse());
      P.big.textContent = `${facts.length} ${facts.length === 1 ? 'FACT' : 'FACTS'}`;
      paintSub();
    };
    let messages = 0;
    // one line under the title: what he knows, and how long this conversation is
    // (the facts and the lines about him: the same count as the TIMELINE's, less the diary and lessons)
    // With no connection, one line says so: what shows is what I knew before.
    const paintSub = () => {
      const n = facts.length + (profile ? PROFILE_SECTIONS.reduce((k, s) => k + profile!.sections[s].length, 0) : 0);
      P.sub.textContent = offlineNow() ? 'You’re offline: this is what I knew before. It updates by itself when you’re back.' : `${n} ${n === 1 ? 'thing' : 'things'} I know about you`;
      P.sub.classList.toggle('off', offlineNow());
    };
    addEventListener('offline', () => paintSub());
    addEventListener('online', () => {
      paintSub();
      if (root.isConnected && root.offsetParent) {
        void refresh();
        void refreshLessons();
        void refreshProfile();
        void pl.refresh();
      }
    });
    const fg = pager(fp, 46, (f: MemoryFact) => {
      const r = row(fmt.ago(f.at), f.text, '✕', { wrap: true });
      const x = r.lastChild as HTMLElement;
      x.classList.add('del');
      x.title = 'Forget this';
      x.addEventListener('click', async () => {
        // Through the timeline's FORGET: kept a day under RECENTLY FORGOTTEN, and UNDO right here.
        const ok = await brain.memoryChange(`f:${f.id}`, 'forget').then(() => true, (e) => (toast(`Could not forget it: ${why(e)}`, 'bad'), false));
        void refresh();
        void refreshTimeline();
        if (ok) undo(`Forgotten: “${clip(f.text)}”`, () => putBack(`f:${f.id}`));
      });
      return r;
    }, () => 'NONE YET', 'Say “remember …” in a chat and I keep it here.');
    const input = h('input', { placeholder: 'Tell me something to remember…', 'aria-label': 'New fact' });
    const add = async () => {
      const t = input.value.trim();
      if (!t) return;
      input.value = '';
      await brain.addMemory(t).catch(() => toast('Could not save', 'bad'));
      void refresh();
      void refreshTimeline();
    };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && void add());
    fp.el.insertBefore(h('div.keyrow', input, button('SAVE', () => void add())), fp.body);

    // ---- ME: your profile in your own words. Ghosty builds it every night from the day's
    // conversation (what you said about yourself, never what it read elsewhere); add a line
    // here, or tap ✕ to remove one.
    const mp = panel('ME', { status: 'from your own words', cls: 'me' });
    let profile: Profile | null = null;
    let diary: DiaryEntry[] = [];
    let lastReflect: number | null = null;
    const sectionSel = h('select', { 'aria-label': 'Section of your profile' }, ...PROFILE_SECTIONS.map((s) => h('option', { value: s }, s.charAt(0).toUpperCase() + s.slice(1))));
    const lineIn = h('input', { placeholder: 'Something about you, e.g. "I take my coffee black"', 'aria-label': 'New line about you' });
    const paintMe = () => {
      clear(mp.body);
      if (!profile) {
        mp.setStatus('OFFLINE', 'off');
        mp.body.append(empty('OFFLINE'));
        return;
      }
      const n = PROFILE_SECTIONS.reduce((k, s) => k + profile!.sections[s].length, 0);
      mp.setStatus(n ? `${n} LINES` : 'EMPTY', n ? 'ok' : 'mid');
      // who he is, in a line written to him; then where it came from and when, honestly
      mp.body.append(h('div.mesum', profile.summary || 'Tell me about yourself and each night I’ll write down what you said — never what I read online, never a password.'));
      if (profile.updatedAt) mp.body.append(h('div.note.mewhen', `From your own words · updated ${dayWord(profile.updatedAt)}`));
      for (const s of PROFILE_SECTIONS) {
        const lines = profile.sections[s];
        if (!lines.length) continue;
        mp.body.append(h('div.lab', { dataset: { section: s } }, HEADINGS[s]));
        lines.forEach((text) => {
          const r = row(null, text, '✕', { wrap: true });
          const x = r.lastChild as HTMLElement;
          x.classList.add('del');
          x.title = 'Remove this line';
          x.addEventListener('click', async () => {
            // Through the timeline's FORGET: kept a day under RECENTLY FORGOTTEN, and UNDO right here.
            try {
              await brain.memoryChange(lineId(text), 'forget');
              profile = (await brain.profile()).profile;
              undo(`Removed: “${clip(text)}”`, () => putBack(lineId(text)));
            } catch (e) {
              toast(`Could not remove it: ${why(e)}`, 'bad');
            }
            paintMe();
            void refreshTimeline();
          });
          mp.body.append(r);
        });
      }
    };
    const addLine = async () => {
      const text = lineIn.value.trim();
      if (!text) return;
      try {
        const r = await brain.profileAdd(sectionSel.value as ProfileSection, text);
        profile = r.profile;
        lineIn.value = '';
        if (!r.added) toast('Already there', 'warn');
      } catch (e) {
        toast(`Could not save it: ${why(e)}`, 'bad');
      }
      paintMe();
      void refreshTimeline();
    };
    lineIn.addEventListener('keydown', (e) => e.key === 'Enter' && void addLine());
    const meForm = h('div.keyrow.wrapit', sectionSel, lineIn, button('ADD', () => void addLine().then(() => sheet?.close())));
    mp.el.insertBefore(meForm, mp.body);
    paintMe();
    // PLACES under ME (places.ts): home, work and the rest, each found on the map and kept only after his yes.
    const pl = placesBlock();
    mp.el.append(pl.el);
    // One "Add a memory…" row opens a sheet with the form; Edit shows the delete buttons
    // (a row also swipes left to delete).
    let sheet: { close(): void } | null = null;
    const addRow = h('button.addrow', { type: 'button' }, h('span.sq', { style: '--tint:#5ac8fa' }, icon('<path d="M12 5v14M5 12h14"/>')), h('span', 'Add a memory…'));
    addRow.addEventListener('click', () => {
      sheet = modal('Add a memory', h('div.memadd', h('p.note', 'Something about you, in your own words. I keep it under ME.'), meForm), () => {
        mp.el.insertBefore(meForm, mp.body);
        sheet = null;
      });
      setTimeout(() => lineIn.focus(), 60);
    });
    const editBtn = h('button.editbtn', { type: 'button', 'aria-pressed': 'false' }, 'Edit');
    editBtn.addEventListener('click', () => {
      const on = root.classList.toggle('editing');
      editBtn.textContent = on ? 'Done' : 'Edit';
      editBtn.setAttribute('aria-pressed', String(on));
    });
    P.sub.after(editBtn);
    swipeToDelete(root);
    // ME (who he is) first: it was 6,500 points down, under thirty timeline rows.
    // PRINCIPLES (OWNER-ISSUES 64, 69b): his own lines, the same editor as SETTINGS → CHARACTER's.
    const pr = panel('PRINCIPLES', { status: 'your lines, in your words', cls: 'princpn' });
    const princ = principlesEditor();
    pr.body.append(princ.el);
    P.left.append(addRow, mp.el, pr.el, pats.el, tl.el);

    // ---- DIARY: one entry a day, written by the nightly reflection; REFLECT NOW writes today's.
    const dp = panel('DIARY', { footer: true, status: '' });
    const dg = pager(dp, 46, (e: DiaryEntry) => {
      const r = row(diaryDay(e.heading), e.text, '›', { wrap: true, onClick: () => modal(`Diary · ${diaryDay(e.heading)}`, h('div.readwrap', h('div.reader', ...e.text.split(/\n+/).map((p) => h('p', p))))) });
      // "Saturday 17 October" keeps its capitals (row keys are shown in sentence case)
      r.querySelector('.k')?.setAttribute('data-case', 'keep');
      return r;
    }, () => 'NONE YET', 'Each night I write a page about your day. Tap Reflect now for today’s.');
    const paintDiary = () => {
      dp.setStatus(lastReflect ? `last reflected ${fmt.ago(lastReflect)}` : diary.length ? `${diary.length}` : 'nothing yet', diary.length ? 'ok' : 'mid');
      dg.set(diary);
    };
    const refreshProfile = async (andTimeline = true) => {
      if (andTimeline) void refreshTimeline();
      try {
        const r = await brain.profile();
        profile = r.profile;
        diary = r.diary;
        lastReflect = r.lastReflect;
      } catch {
        profile = null;
      }
      paintMe();
      paintDiary();
      paintSub();
    };
    dp.foot!.prepend(button('REFLECT NOW', async (b) => {
      b.disabled = true;
      b.textContent = 'REFLECTING…';
      try {
        const r = await brain.reflectNow();
        if (r.skipped) toast(`Nothing reflected: ${r.skipped}`, 'warn');
        else toast(`Reflected: ${r.facts.length} new fact${r.facts.length === 1 ? '' : 's'}, ${r.lines.length} line${r.lines.length === 1 ? '' : 's'} about you${r.diary ? ', diary written' : ''}`, 'ok');
      } catch (e) {
        toast(`Could not reflect: ${why(e)}`, 'bad');
      }
      b.disabled = false;
      b.textContent = 'REFLECT NOW';
      void refreshProfile();
      void refresh();
    }, 'on'));
    paintDiary();
    const lp = panel('LESSONS LEARNED', { footer: true, status: 'my mistakes, and your rules' });
    let lessons: Lesson[] = [];
    const lg = pager(lp, 46, (l: Lesson) => {
      // His own rules for how I talk (conduct lessons, OWNER-ISSUES 64): his words, dated, deletable like any lesson.
      const when = l.hits > 1 ? `×${l.hits}` : fmt.ago(l.at);
      const r = row(l.kind === 'conduct' ? `you told me · ${when}` : when, l.text, '✕', { wrap: true });
      if (l.kind === 'conduct') r.dataset.kind = 'conduct';
      const x = r.lastChild as HTMLElement;
      x.classList.add('del');
      x.title = 'Forget this lesson';
      x.addEventListener('click', async () => {
        // Through the timeline's FORGET, so a locked lesson goes too when the owner asks (forget_lesson keeps it).
        const back = await brain.memoryChange(`l:${l.id}`, 'forget').then(() => true, () => brain.forgetLesson(l.id).then(() => false));
        void refreshLessons();
        void refreshTimeline();
        // (forget_lesson, the older way, keeps nothing to bring back: then there is no UNDO)
        if (back) undo(`Forgotten: “${clip(l.text)}”`, () => putBack(`l:${l.id}`));
      });
      return r;
    }, () => 'NONE YET', 'When I get something wrong and you put me right, the lesson shows here.');
    const refreshLessons = async () => {
      try {
        lessons = (await brain.lessons()).lessons;
        lp.setStatus(`${lessons.length}`, 'ok');
      } catch {
        lp.setStatus('OFFLINE', 'off');
      }
      lg.set([...lessons].sort((a, b) => b.hits - a.hits || b.at - a.at));
    };
    const cp = panel('CONVERSATION', { footer: true });
    const cg = pager(cp, 52, (e: { who: string; text: string }) => row(e.who, e.text, null, { wrap: true }), () => 'NONE YET', 'Nothing said between us yet.');
    // CLEAR CONVERSATION: gone from the screen at once, from the brain when the UNDO bar goes (session.ts);
    // UNDO puts every message back. What he remembers about you stays either way.
    cp.foot!.prepend(button('CLEAR CONVERSATION', () => clearConversation(), 'warn'));
    P.right.append(dp.el, fp.el, lp.el, cp.el);
    sections(root, 'memory', [
      { id: 'me', label: 'Me', match: /^(?:ME|PRINCIPLES)$/ },
      { id: 'patterns', label: 'Patterns', match: /^PATTERNS/ },
      { id: 'timeline', label: 'Timeline', match: /^TIMELINE/ },
      { id: 'diary', label: 'Diary', match: /^DIARY/ },
      { id: 'chat', label: 'Chat', match: /^(WHAT I REMEMBER|LESSONS|CONVERSATION)/ },
    ]);
    const paintChat = () => {
      const list = chat.get().entries.filter((e) => e.kind === 'user' || e.kind === 'assistant') as { kind: 'user' | 'assistant'; text: string }[];
      cg.set(list.map((e) => ({ who: e.kind === 'user' ? 'YOU' : 'GHOSTY', text: e.text })).reverse());
      messages = list.length;
      paintSub();
    };
    chat.subscribe(paintChat);
    paintChat();
    return {
      enter() {
        princ.refresh();
        void refresh();
        void refreshLessons();
        void refreshProfile();
        void pl.refresh();
      },
      describe: () => `Memory: ${facts.length} facts stored, ${lessons.length} lessons learned${profile ? `, a profile of ${PROFILE_SECTIONS.reduce((k, s) => k + profile!.sections[s].length, 0)} lines` : ''}, ${diary.length} diary entries.`,
    };
  },
};
