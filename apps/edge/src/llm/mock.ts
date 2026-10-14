/**
 * A scripted fake model used only by automated tests (env MOCK_LLM = "1").
 * It turns simple phrases into tool calls so the agent loop can be tested offline.
 */
import type { Msg, ToolSpec } from './router';

let n = 0;
const call = (name: string, args: Record<string, unknown>): Msg => ({
  role: 'assistant',
  content: null,
  tool_calls: [{ id: `mock_${++n}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
});

export async function mockComplete(messages: Msg[], tools: ToolSpec[]): Promise<{ message: Msg; model: string }> {
  const last = messages[messages.length - 1]!;
  const model = 'Mock · scripted';
  if (last.role === 'tool') {
    return { message: { role: 'assistant', content: `Done. ${String(last.content).slice(0, 160)}` }, model };
  }
  const text = String(last.content ?? '').toLowerCase().replace(/^scheduled task "[^"]*": /, '');
  const has = (name: string) => tools.some((t) => t.function.name === name);
  let m: RegExpMatchArray | null;
  if ((m = text.match(/^remember (.+)$/)) && has('remember')) return { message: call('remember', { text: m[1] }), model };
  if ((m = text.match(/^remind me in (\d+) minutes? to (.+)$/)) && has('set_reminder')) return { message: call('set_reminder', { text: m[2], in_minutes: Number(m[1]) }), model };
  if ((m = text.match(/^every day at (\d\d:\d\d) (.+)$/)) && has('schedule_task')) return { message: call('schedule_task', { title: 'Daily job', prompt: m[2], at: m[1], repeat: 'daily' }), model };
  if ((m = text.match(/^add event (.+) on (\S+)$/)) && has('add_event')) return { message: call('add_event', { title: m[1], start: m[2], remind_minutes_before: 30 }), model };
  if (text === 'show agenda' && has('list_agenda')) return { message: call('list_agenda', { days: 30 }), model };
  if ((m = text.match(/^fly to (.+)$/)) && has('fly_to')) return { message: call('fly_to', { place: m[1] }), model };
  if ((m = text.match(/^ship (\d+)$/)) && has('ship_change')) return { message: call('ship_change', { pr: Number(m[1]) }), model };
  if (text === 'show versions' && has('list_versions')) return { message: call('list_versions', {}), model };
  if (text === 'force forget everything') return { message: call('forget_everything', {}), model }; // ignores the offered tool list
  if (text === 'forget everything' && has('forget_everything')) return { message: call('forget_everything', {}), model };
  if (text === 'propose edit' && has('propose_change')) {
    return {
      message: call('propose_change', {
        title: 'Rename the greeting',
        summary: 'Changes the greeting text.',
        edits: [{ path: 'apps/web/src/hello.ts', action: 'replace', find: "'Hello'", replace: "'Good evening'" }],
      }),
      model,
    };
  }
  if (text === 'propose file' && has('propose_change')) {
    return {
      message: call('propose_change', { title: `Add extra module ${n}`, summary: 'Adds a file.', edits: [{ path: `apps/web/src/extra-${n}.ts`, action: 'write', content: `export const extra = ${n};\n` }] }),
      model,
    };
  }
  if (text === 'propose kernel' && has('propose_change')) {
    return { message: call('propose_change', { title: 'Weaken auth', summary: 'x', edits: [{ path: 'apps/edge/src/kernel/auth.ts', action: 'write', content: '// gone' }] }), model };
  }
  if ((m = text.match(/^status (\d+)$/)) && has('change_status')) return { message: call('change_status', { pr: Number(m[1]) }), model };
  if ((m = text.match(/^restore ([0-9a-f]+)$/)) && has('restore_version')) return { message: call('restore_version', { sha: m[1] }), model };
  if (text === 'make a widget' && has('create_widget')) {
    return { message: call('create_widget', { name: 'clock', title: 'Clock', html: '<h1 id=t></h1><script>setInterval(()=>t.textContent=new Date().toLocaleTimeString(),1000)</script>' }), model };
  }
  return { message: { role: 'assistant', content: `Mock reply to: ${text.slice(0, 80)}` }, model };
}
