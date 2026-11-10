/**
 * Self-evolution: Ghosty upgrades itself in planned steps.
 *   self_audit    → what Ghosty has today (abilities, tabs, handbook, lessons, open changes)
 *   plan_upgrade  → a roadmap: one goal, ordered steps, each step one shippable change
 *   roadmap       → where the upgrade stands, and the next step
 *   update_step   → mark a step doing / done / blocked, link its change
 * The roadmap is kept in the brain and shown in the Workshop tab.
 */
import type { Roadmap, RoadmapStep } from '../../../../packages/shared/src/protocol';
import { loadLessons, PLAYBOOKS } from '../knowledge';
import { TOOLS } from './index';
import { arg, clip, type Tool } from './types';

export const ROADMAP_KEY = 'roadmap';
const STATES: RoadmapStep['status'][] = ['todo', 'doing', 'done', 'blocked'];

export async function loadRoadmap(storage: DurableObjectStorage): Promise<Roadmap | null> {
  return (await storage.get<Roadmap>(ROADMAP_KEY)) ?? null;
}

export function describeRoadmap(r: Roadmap): string {
  const done = r.steps.filter((s) => s.status === 'done').length;
  const next = r.steps.find((s) => s.status === 'doing') ?? r.steps.find((s) => s.status === 'todo');
  const lines = r.steps.map((s, i) => `${i + 1}. [${s.status.toUpperCase()}] ${s.title}${s.pr ? ` (change #${s.pr})` : ''}${s.note ? ` — ${s.note}` : ''}`);
  return `UPGRADE: ${r.goal}\n${done}/${r.steps.length} steps done.\n${lines.join('\n')}\n${next ? `NEXT: step ${r.steps.indexOf(next) + 1} — ${next.title}` : 'All steps are done: tell the owner, then propose what could come next.'}`;
}

export const evolveTools: Tool[] = [
  {
    name: 'self_audit',
    description:
      'Look at yourself before upgrading: your abilities (tools), interface tabs, handbook playbooks, learned lessons, open changes and the current upgrade roadmap. Use when the owner asks you to improve yourself, make a better version of yourself, or asks what you could do better.',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const out: string[] = [];
      out.push(`ABILITIES (${TOOLS.length} tools): ${TOOLS.map((t) => t.name).join(', ')}`);
      const g = await ctx.github().catch(() => null);
      if (g) {
        try {
          const main = (await ctx.storage.get<string>('repo:main')) ?? (await g.defaultBranch());
          const tree = await g.tree(main);
          const tabs = [...new Set(tree.map((p) => p.match(/^apps\/web\/src\/features\/([\w-]+)\//)?.[1]).filter(Boolean))];
          const feeds = tree.filter((p) => /^apps\/web\/src\/data\/[\w-]+\.ts$/.test(p)).map((p) => p.split('/').pop()!.replace('.ts', ''));
          out.push(`INTERFACE TABS (${tabs.length}): ${tabs.join(', ')}`);
          out.push(`DATA FEEDS: ${feeds.join(', ')}`);
          out.push(`SOURCE FILES: ${tree.filter((p) => /\.(ts|css)$/.test(p)).length}`);
          const open = await g.openChanges();
          out.push(`OPEN CHANGES: ${open.length ? open.map((c) => `#${c.number} ${c.title} (${c.checks})`).join('; ') : 'none'}`);
        } catch (e) {
          out.push(`(could not read the repository: ${String((e as Error)?.message ?? e).slice(0, 120)})`);
        }
      } else out.push('SELF-EDIT: not connected (no GitHub token) — upgrades need it.');
      out.push(`HANDBOOK: ${PLAYBOOKS.length} playbooks (${PLAYBOOKS.map((p) => p.id).join(', ')})`);
      const lessons = await loadLessons(ctx.storage);
      out.push(`LESSONS LEARNED: ${lessons.length}${lessons.length ? ` — most repeated: ${[...lessons].sort((a, b) => b.hits - a.hits).slice(0, 3).map((l) => l.text).join(' | ')}` : ''}`);
      const r = await loadRoadmap(ctx.storage);
      out.push(r ? `CURRENT ROADMAP:\n${describeRoadmap(r)}` : 'CURRENT ROADMAP: none');
      out.push('Next: study "self-improvement", pick the upgrades worth most to the owner, and plan_upgrade.');
      return clip(out.join('\n'), 8000);
    },
  },
  {
    name: 'plan_upgrade',
    description:
      'Start an upgrade roadmap for a big improvement to yourself (a new major ability, a redesign, "a better version of yourself"). Give the goal and 2–12 ordered steps; each step must be ONE small change that works and ships on its own. Replaces any previous roadmap. Then build step 1.',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'what the upgrade achieves for the owner' },
        steps: { type: 'array', items: { type: 'string' }, description: 'ordered step titles, e.g. "Add a stocks feed and a minimal panel"' },
      },
      required: ['goal', 'steps'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const goal = arg.str(a, 'goal').trim().slice(0, 200);
      const raw = Array.isArray(a.steps) ? a.steps.map((s) => String(s).trim()).filter(Boolean) : [];
      if (raw.length < 2) throw new Error('give at least 2 steps; a single change does not need a roadmap');
      if (raw.length > 12) throw new Error('at most 12 steps — group the work into bigger milestones, or do it in two roadmaps');
      const r: Roadmap = { goal, at: Date.now(), steps: raw.map((title, i) => ({ id: i + 1, title: title.slice(0, 160), status: 'todo' })) };
      await ctx.storage.put(ROADMAP_KEY, r);
      return `Roadmap saved (shown in the Workshop tab).\n${describeRoadmap(r)}\nTell the owner the plan in a few short lines, then start step 1 (update_step to "doing").`;
    },
  },
  {
    name: 'roadmap',
    description: 'Show the current upgrade roadmap and the next step. Use when the owner says "carry on", "continue the upgrade" or asks how the upgrade is going.',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const r = await loadRoadmap(ctx.storage);
      return r ? describeRoadmap(r) : 'No upgrade roadmap. Use self_audit and plan_upgrade to start one.';
    },
  },
  {
    name: 'update_step',
    description: 'Update a roadmap step: status doing (started), done (its change shipped), blocked (with a note why), or todo. Link its change number with pr.',
    parameters: {
      type: 'object',
      properties: {
        step: { type: 'number', description: 'step number, starting at 1' },
        status: { type: 'string', enum: STATES },
        pr: { type: 'number' },
        note: { type: 'string' },
      },
      required: ['step', 'status'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const r = await loadRoadmap(ctx.storage);
      if (!r) throw new Error('there is no roadmap; start one with plan_upgrade');
      const n = arg.num(a, 'step');
      const s = r.steps.find((x) => x.id === n);
      if (!s) throw new Error(`no step ${n}; the roadmap has steps 1–${r.steps.length}`);
      const status = arg.str(a, 'status') as RoadmapStep['status'];
      if (!STATES.includes(status)) throw new Error(`status must be one of ${STATES.join(', ')}`);
      s.status = status;
      const pr = arg.num(a, 'pr', 0);
      if (pr > 0) s.pr = pr;
      const note = arg.str(a, 'note', false).trim().slice(0, 200);
      if (note) s.note = note;
      else if (status === 'done') delete s.note;
      await ctx.storage.put(ROADMAP_KEY, r);
      return describeRoadmap(r);
    },
  },
];
