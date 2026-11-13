/**
 * The chat's words for THE WORKSPACE (BRIEF-EDITOR-WORKSPACE), read with no model: "my workspace", "my projects", "start a project", "a blank page",
 * "import a markdown file", and "what is due this week in my project", which is answered from the phone's own dates. Pure.
 */
export interface WorkspaceAsk {
  what: 'list' | 'project' | 'blank' | 'import' | 'due' | 'bin';
}

export function workspaceAsked(text: string): WorkspaceAsk | null {
  const t = text.trim().replace(/[.!?]+$/, '');
  if (/^(?:open |show )?(?:me )?(?:my )?(?:workspace|work space|projects?|notion|pages)$/i.test(t)) return { what: 'list' };
  if (/\b(?:what(?:'s| is| are)|which|anything)\b.*\b(?:due|deadlines?|overdue|coming up)\b.*\b(?:projects?|workspace|my pages|my plan)\b/i.test(t)) return { what: 'due' };
  if (/^(?:start|make|create|new|begin) (?:a |my |me a )?(?:new )?(?:project|workspace project)$/i.test(t)) return { what: 'project' };
  if (/^(?:new|start|make|create) (?:a )?(?:blank |new )?(?:page|note|notion page|workspace page)$/i.test(t)) return { what: 'blank' };
  if (/^(?:open|read|import) (?:a|my|some|this) (?:markdown|md)(?: file| files| folder)?$/i.test(t) || /^import (?:a |my )?(?:csv|csv file) as a database$/i.test(t)) return { what: 'import' };
  if (/^(?:open |show )?(?:my )?(?:workspace )?bin$/i.test(t)) return { what: 'bin' };
  return null;
}
