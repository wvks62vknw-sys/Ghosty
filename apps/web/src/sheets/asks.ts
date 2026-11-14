/**
 * The chat's words for SPREADSHEETS (BRIEF-EDITOR-SPREADSHEETS), read with no model: "my spreadsheets", "new spreadsheet", "start a household budget",
 * "open a spreadsheet". The phone opens the screen; asking Ghosty to explain a cell or write a formula is on the screen itself. Pure.
 */
export interface SheetsAsk {
  what: 'list' | 'new' | 'budget' | 'import' | 'money';
}

export function sheetsAsked(text: string): SheetsAsk | null {
  const t = text.trim().replace(/[.!?]+$/, '');
  if (/^(?:open |show )?(?:me )?(?:my )?(?:spreadsheets?|excel files?|workbooks?)$|^(?:open )?(?:the )?spreadsheet (?:editor|maker)$/i.test(t)) return { what: 'list' };
  if (/^(?:start|make|build|set up|create)(?: me)?(?: a| my)?(?: new)? (?:household |home |monthly |family )?budget(?: spreadsheet| sheet)?$|^(?:new|start a|make a)(?: household| monthly)? budget$/i.test(t)) return { what: 'budget' };
  if (/^(?:new|start a|make a(?: new)?|create a(?: new)?) (?:blank |empty )?(?:spreadsheet|workbook)$/i.test(t)) return { what: 'new' };
  // [editors grid] MONEY's own figures as a fresh budget sheet (editors.c1, money.c4)
  if (/^(?:open|show|put|turn|make)(?: me)? my (?:money|spending|budgets?(?: and bills)?) (?:as|into|in) an? (?:spreadsheet|budget sheet|sheet)$|^(?:make|turn) my (?:spending|money) (?:into )?an? budget (?:spread)?sheet$|^(?:my )?(?:spending|money) (?:as an? )?(?:budget )?spreadsheet$/i.test(t)) return { what: 'money' };
  if (/^(?:read|open|import) (?:a|an|my|this) (?:spreadsheet|excel(?: file| sheet)?|workbook|\.?xlsx|csv(?: file)?)$/i.test(t)) return { what: 'import' };
  return null;
}
