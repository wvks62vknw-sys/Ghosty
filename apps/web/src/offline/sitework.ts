/**
 * The offline website builder, inside the worker (workers/textures.worker.ts sends it messages carrying
 * `site`), so the page never bundles the website kit: the brief → the template's plan → the blocks
 * assembled → the quality gates. No model and no network: the template's own words and look, filled from
 * the owner's answers, with the vetted photo library's addresses (they load when the site is opened).
 */
import { assemble } from '../../../../packages/shared/src/sitekit/assemble';
import { runGates } from '../../../../packages/shared/src/sitekit/gates';
import { planFrom } from '../../../../packages/shared/src/sitekit/templates';
import type { Brief } from '../../../../packages/shared/src/sitekit/types';

export interface SiteIn {
  site: 'build';
  req: number;
  brief: Brief;
}
export interface SiteOut {
  site: 'built';
  req: number;
  html?: string;
  title?: string;
  pages?: string[];
  score?: number;
  problems?: number;
  confirm?: string[];
  error?: string;
}

export function siteMessage(m: SiteIn, post: (r: SiteOut) => void): void {
  try {
    const { plan, brief } = planFrom(m.brief);
    const a = assemble(plan, brief);
    const g = runGates(a.html, plan, brief);
    post({ site: 'built', req: m.req, html: a.html, title: plan.pages[0]?.title || brief.name, pages: plan.pages.map((p) => p.label), score: g.score, problems: g.errors, confirm: plan.confirm });
  } catch (e) {
    post({ site: 'built', req: m.req, error: String((e as Error)?.message ?? e) });
  }
}
