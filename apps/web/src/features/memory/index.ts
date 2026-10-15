/** MEMORY tab: what Ghosty knows about you, and the conversation history. */
import type { Lesson, MemoryFact } from '../../../../../packages/shared/src/protocol';
import { brain } from '../../api/brain';
import { chat, clearConversation } from '../../assistant/session';
import { fmt, h } from '../../core/dom';
import type { TabDef } from '../../shell/tabs';
import { button, pager, panel, row, toast } from '../../ui/components';
import { page } from '../../ui/page';

export const memoryTab: TabDef = {
  id: 'memory',
  title: 'MEMORY',
  icon: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="9" cy="18" r="2.5"/><path d="M8 7l8 1M7 8l2 8M17 10l-6 7"/>',
  scene: 'backdrop',
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
      P.big.textContent = `${facts.length} FACTS`;
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
    P.left.append(fp.el);
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
    P.right.append(cp.el);
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
      },
      describe: () => `Memory: ${facts.length} facts stored, ${lessons.length} lessons learned.`,
    };
  },
};
