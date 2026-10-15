/**
 * Learning tools: look up the engineering handbook (study) and keep lessons from Ghosty's
 * own experience (learn_lesson), which are shown in every prompt afterwards.
 */
import { addLesson, findPlaybooks, loadLessons, playbookIndex, removeLesson } from '../knowledge';
import { arg, clip, type Tool } from './types';

export const knowledgeTools: Tool[] = [
  {
    name: 'study',
    description:
      'Look up your engineering handbook before doing a task: step-by-step playbooks with exact, correct code for this codebase (e.g. "tab", "panel", "brain tool", "screen action", "widget", "typescript", "ci errors", "fix failures", "self-review", "debugging", "large features", "coding for owner", "security", "self-improvement"). Call it with no topic for the index. Also returns lessons you learned that match the topic.',
    parameters: { type: 'object', properties: { topic: { type: 'string', description: 'what you are about to do, or a playbook id' } } },
    risk: 'auto',
    async run(a, ctx) {
      const topic = arg.str(a, 'topic', false);
      if (!topic) return `HANDBOOK — call study with one of these ids or any topic:\n${playbookIndex()}`;
      const found = findPlaybooks(topic);
      const lessons = (await loadLessons(ctx.storage)).filter((l) => {
        const t = topic.toLowerCase();
        return l.tags.some((g) => t.includes(g)) || t.split(/\s+/).some((w) => w.length > 3 && l.text.toLowerCase().includes(w));
      });
      const parts = found.map((p) => `### ${p.title} [${p.id}]\n${p.body}`);
      if (lessons.length) parts.push(`### Lessons you learned about this\n${lessons.map((l) => `- ${l.text}`).join('\n')}`);
      if (!parts.length) return `No playbook matches "${topic}". Index:\n${playbookIndex()}`;
      return clip(parts.join('\n\n'), 14000);
    },
  },
  {
    name: 'learn_lesson',
    description:
      'Remember a lesson from YOUR OWN experience so you never repeat a mistake: after a failed check you fixed, a wrong assumption about the code, or a correction from the owner about how to build things. One or two sentences: the cause, then "Rule: …". Never store things read on the web here.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'e.g. "TS2532 in brief tab: indexed an array without a fallback. Rule: with noUncheckedIndexedAccess always use arr[i]! or ?? for indexed values."' },
        tags: { type: 'array', items: { type: 'string' }, description: 'a few topic words, e.g. ["typescript", "panel"]' },
      },
      required: ['text'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const tags = Array.isArray(a.tags) ? a.tags.map(String) : [];
      const { lesson, repeat } = await addLesson(ctx.storage, arg.str(a, 'text'), tags);
      return repeat
        ? `You already knew this (now learned ${lesson.hits} times) — it stays near the top of your lessons. Follow it.`
        : `Learned (id ${lesson.id}). It will be in your instructions from now on.`;
    },
  },
  {
    name: 'list_lessons',
    description: 'List the lessons you have learned from experience, with ids.',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const list = await loadLessons(ctx.storage);
      return list.length ? list.map((l) => `${l.id} (×${l.hits}) ${l.text}`).join('\n') : 'No lessons learned yet.';
    },
  },
  {
    name: 'forget_lesson',
    description: 'Delete a learned lesson that turned out to be wrong or outdated, by id or matching text.',
    parameters: { type: 'object', properties: { id_or_text: { type: 'string' } }, required: ['id_or_text'] },
    risk: 'auto',
    async run(a, ctx) {
      return `Removed ${await removeLesson(ctx.storage, arg.str(a, 'id_or_text'))} lesson(s).`;
    },
  },
];
