/**
 * KERNEL — protected.
 *
 * Files Ghosty may not change through its own self-edits unless the owner has
 * unlocked the kernel (Workshop tab, time-limited). These are the parts that keep
 * Ghosty loyal, locked to its owner and able to undo its own mistakes: everything on
 * the path from "a request arrives" to "an action needs approval", plus deployment
 * config and the security headers.
 */
export const PROTECTED_PATHS: string[] = [
  'apps/edge/src/kernel/', // auth, permissions, vault, this list
  'apps/edge/src/index.ts', // entry point: calls authenticate(), proxy rules
  'apps/edge/src/agent.ts', // agent loop: enforces approvals, owner-only routes
  'apps/edge/src/env.ts',
  'apps/edge/src/tools/index.ts', // which tools exist
  'apps/edge/src/tools/repo.ts', // the self-edit tools themselves
  'apps/edge/src/tools/types.ts',
  'apps/edge/src/github.ts', // GitHub client used for self-edits and rollback
  'apps/edge/wrangler', // any wrangler.json / wrangler.jsonc / wrangler.toml
  'apps/edge/package.json', // deploy scripts
  'apps/web/functions/', // the gateway between interface and brain
  'apps/web/public/_headers', // Content Security Policy + widget sandbox
  '.github/', // CI checks that gate every change
];

/** Returns a reason string if the path is not allowed, otherwise null. */
export function pathProblem(path: string, kernelUnlocked: boolean): string | null {
  const segs = path.split('/');
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || segs.some((s) => s === '' || s === '.' || s === '..') || /[\u0000-\u001f]/.test(path)) {
    return `"${path}" is not a valid repository path`;
  }
  if (kernelUnlocked) return null;
  const p = path.toLowerCase();
  for (const rule of PROTECTED_PATHS.map((r) => r.toLowerCase())) {
    const dir = rule.endsWith('/') ? rule.slice(0, -1) : rule;
    const hit =
      p === dir || // the protected file or folder itself
      p.startsWith(rule) || // inside a protected folder, or a file starting with the protected prefix
      dir.startsWith(`${p}/`); // a parent folder of something protected
    if (hit) return `"${path}" is part of the protected kernel. Ask the owner to unlock the kernel in the Workshop tab first.`;
  }
  return null;
}
