/**
 * MEMORY tab: what Ghosty knows about you — ME (your profile, in your own words, built by the
 * nightly reflection and editable here), the facts it remembers, the lessons it learned, the
 * DIARY it writes (one entry a day; REFLECT NOW writes today's) — and the conversation history.
 */
import type { DiaryEntry, Lesson, MemoryFact, Profile, ProfileSection } from '../../../../../packages/shared/src/protocol';
import { PROFILE_SECTIONS } from '../../../../../packages/shared/src/protocol';
import { brain } from '../../api/brain';
import { chat, clearConversation } from '../../assistant/session';
import { clear, fmt, h } from '../../core/dom';
import type { TabDef } from '../../shell/tabs';
import { button, modal, pager, panel, row, toast } from '../../ui/components';
import { page } from '../../ui/page';

export const memoryTab: TabDef = {
  id: 'memory',
  title: 'MEMORY',
  icon: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="9" cy="18" r="2.5"/><path d="M8 7l8 1M7 8l2 8M17 10l-6 7"/>',
  scene: 'backdrop',
  blurb: 'what Ghosty knows about you',
  mount(root) {
    const P = page(root, { tag: 'NEURAL MEMORY', sub: 'stored in your private brain, synced across your devices', rightLabel: 'CONVERSATION', leftLabel: 'FACTS' });
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
    };
    const fg = pager(fp, 46, (f: MemoryFact) => {
      const r = row(fmt.ago(f.at), f.text, '✕', { wrap: true });
      const x = r.lastChild as HTMLElement;
      x.classList.add('del');
      x.title = 'Forget this';
      x.addEventListener('click', async () => {
        await brain.forget(f.id);
        void refresh();
      });
      return r;
    });
    const input = h('input', { placeholder: 'Tell me something to remember…', 'aria-label': 'New fact' });
    const add = async () => {
      const t = input.value.trim();
      if (!t) return;
      input.value = '';
      await brain.addMemory(t).catch(() => toast('Could not save', 'bad'));
      void refresh();
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
    const sectionSel = h('select', { 'aria-label': 'Section of your profile' }, ...PROFILE_SECTIONS.map((s) => h('option', { value: s }, s.toUpperCase())));
    const lineIn = h('input', { placeholder: 'Something about you, e.g. "I take my coffee black"', 'aria-label': 'New line about you' });
    const paintMe = () => {
      clear(mp.body);
      if (!profile) {
        mp.setStatus('OFFLINE', 'off');
        mp.body.append(h('div.note', 'Not reachable right now.'));
        return;
      }
      const n = PROFILE_SECTIONS.reduce((k, s) => k + profile!.sections[s].length, 0);
      mp.setStatus(n ? `${n} LINES` : 'EMPTY', n ? 'ok' : 'mid');
      mp.body.append(h('div.note.summary', profile.summary || 'Every night Ghosty looks back over the day and keeps what you told it about yourself: your likes, your people, your places, your routines and plans — never what it read on the web, never a password. Add a line below, or tap ✕ to remove one.'));
      for (const s of PROFILE_SECTIONS) {
        const lines = profile.sections[s];
        if (!lines.length) continue;
        mp.body.append(h('div.lab', s));
        lines.forEach((text, i) => {
          const r = row(null, text, '✕', { wrap: true });
          const x = r.lastChild as HTMLElement;
          x.classList.add('del');
          x.title = 'Remove this line';
          x.addEventListener('click', async () => {
            try {
              profile = (await brain.profileRemove(s, i)).profile;
            } catch (e) {
              toast(`Could not remove it: ${(e as Error).message}`, 'bad');
            }
            paintMe();
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
        toast(`Could not save it: ${(e as Error).message}`, 'bad');
      }
      paintMe();
    };
    lineIn.addEventListener('keydown', (e) => e.key === 'Enter' && void addLine());
    mp.el.insertBefore(h('div.keyrow.wrapit', sectionSel, lineIn, button('ADD', () => void addLine())), mp.body);
    paintMe();
    P.left.append(mp.el, fp.el);

    // ---- DIARY: one entry a day, written by the nightly reflection; REFLECT NOW writes today's.
    const dp = panel('DIARY', { footer: true, status: '' });
    const dg = pager(dp, 46, (e: DiaryEntry) => row(e.heading, e.text, '›', { wrap: true, onClick: () => modal(`Diary · ${e.heading}`, h('div.readwrap', h('div.reader', ...e.text.split(/\n+/).map((p) => h('p', p))))) }), () => 'NONE YET');
    const paintDiary = () => {
      dp.setStatus(lastReflect ? `last reflected ${fmt.ago(lastReflect)}` : diary.length ? `${diary.length}` : 'nothing yet', diary.length ? 'ok' : 'mid');
      dg.set(diary);
    };
    const refreshProfile = async () => {
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
    };
    dp.foot!.prepend(button('REFLECT NOW', async (b) => {
      b.disabled = true;
      b.textContent = 'REFLECTING…';
      try {
        const r = await brain.reflectNow();
        if (r.skipped) toast(`Nothing reflected: ${r.skipped}`, 'warn');
        else toast(`Reflected: ${r.facts.length} new fact${r.facts.length === 1 ? '' : 's'}, ${r.lines.length} line${r.lines.length === 1 ? '' : 's'} about you${r.diary ? ', diary written' : ''}`, 'ok');
      } catch (e) {
        toast(`Could not reflect: ${(e as Error).message}`, 'bad');
      }
      b.disabled = false;
      b.textContent = 'REFLECT NOW';
      void refreshProfile();
      void refresh();
    }, 'on'));
    paintDiary();
    const lp = panel('LESSONS LEARNED', { footer: true, status: 'from my own mistakes' });
    let lessons: Lesson[] = [];
    const lg = pager(lp, 46, (l: Lesson) => {
      const r = row(l.hits > 1 ? `×${l.hits}` : fmt.ago(l.at), l.text, '✕', { wrap: true });
      const x = r.lastChild as HTMLElement;
      x.classList.add('del');
      x.title = 'Forget this lesson';
      x.addEventListener('click', async () => {
        await brain.forgetLesson(l.id);
        void refreshLessons();
      });
      return r;
    }, () => 'NONE YET');
    const refreshLessons = async () => {
      try {
        lessons = (await brain.lessons()).lessons;
        lp.setStatus(`${lessons.length}`, 'ok');
      } catch {
        lp.setStatus('OFFLINE', 'off');
      }
      lg.set([...lessons].sort((a, b) => b.hits - a.hits || b.at - a.at));
    };
    P.left.append(lp.el);
    const cp = panel('CONVERSATION', { footer: true });
    const cg = pager(cp, 52, (e: { who: string; text: string }) => row(e.who, e.text, null, { wrap: true }));
    cp.foot!.prepend(button('CLEAR CONVERSATION', async () => {
      await clearConversation();
      toast('Conversation cleared');
    }, 'warn'));
    P.right.append(dp.el, cp.el);
    const paintChat = () => {
      const list = chat.get().entries.filter((e) => e.kind === 'user' || e.kind === 'assistant') as { kind: 'user' | 'assistant'; text: string }[];
      cg.set(list.map((e) => ({ who: e.kind === 'user' ? 'YOU' : 'GHOSTY', text: e.text })).reverse());
      P.sub.textContent = `${list.length} messages in this conversation`;
    };
    chat.subscribe(paintChat);
    paintChat();
    return {
      enter() {
        void refresh();
        void refreshLessons();
        void refreshProfile();
      },
      describe: () => `Memory: ${facts.length} facts stored, ${lessons.length} lessons learned${profile ? `, a profile of ${PROFILE_SECTIONS.reduce((k, s) => k + profile!.sections[s].length, 0)} lines` : ''}, ${diary.length} diary entries.`,
    };
  },
};
