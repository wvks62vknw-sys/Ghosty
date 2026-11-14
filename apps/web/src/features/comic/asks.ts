/**
 * The chat's words for THE COMIC, read on the phone with no model, in many wordings: "make me a comic about a cat who wants to
 * fly", "draw a comic where…", "a comic book about pirates", "read a comic", "my comics", "import this comic", "open my CBZ",
 * "public domain comics", "find old western comics". Pure.
 */
export type ComicAsk = { what: 'this' } | { what: 'week' } | { what: 'make'; idea: string } | { what: 'shelf' } | { what: 'import' } | { what: 'library'; words: string } | { what: 'open' };

export function comicAsked(text: string): ComicAsk | null {
  const t = text.trim().replace(/[.!?]+$/, '').replace(/^(?:hey ghosty[, ]+|ghosty[, ]+|ok(?:ay)?[, ]+|please[, ]+|can you |could you |will you |i want (?:you )?to |i(?:'|’)d like (?:you )?to |let(?:'|’)?s )/i, '').trim();
  if (!/\b(?:comic|comics|cbz|cbr|graphic novel|manga|cartoon strip|comic strip|comic book)\b/i.test(t)) return null;
  // "make it a comic": what is on screen, or what I last said (comic.c6)
  if (/^(?:make|turn|draw|do)\s+(?:it|this|that)\s+(?:into\s+|as\s+|in(?:to)?\s+)?(?:a\s+)?(?:comic|comic strip|comic book)$/i.test(t) || /^(?:make|draw)\s+(?:me\s+)?(?:a\s+)?comic\s+(?:of|about|from)\s+(?:this|that|it)$/i.test(t) || /^comic\s+(?:this|that|it)$/i.test(t)) return { what: 'this' };
  // his week as a comic (from his own agenda)
  if (/\b(?:my|this|the) week\b/i.test(t) && /\b(?:comic|comics|comic strip)\b/i.test(t) && !/\bread\b/i.test(t)) return { what: 'week' };
  // the library: free, old, public-domain, golden-age
  const lib = /^(?:find|get|show|search|browse|look for|download|open)?\s*(?:me\s+)?(?:some\s+)?(?:free|old|classic|vintage|golden[- ]age|public[- ]domain)\s+(?:(.+?)\s+)?comics?(?:\s+(?:about|with|from)\s+(.+))?$/i.exec(t)
    ?? /^(?:the\s+)?(?:public[- ]domain|free)\s+comic(?:s| library)$/i.exec(t)
    ?? /^comic library$/i.exec(t);
  if (lib) return { what: 'library', words: (lib[1] ?? lib[2] ?? '').replace(/\b(?:public[- ]domain|free|old)\b/gi, '').trim() };
  if (/^open\s+(?:this|that|my|a|an)?\s*(?:cbz|cbr|comic file)s?$/i.test(t) || /^(?:import|add|load|upload|bring in)\s+(?:this|that|my|a|an|the)?\s*(?:own\s+)?(?:comic|comics|cbz|cbr|comic book|comic file|manga|graphic novel)(?:\s+file)?s?(?:\s+(?:file|files|from my phone|from my files))?$/i.test(t)) return { what: 'import' };
  if (/^(?:read|show|open|let me read|i want to read)\s+(?:me\s+)?(?:a|an|my|some|the)?\s*(?:comic|comics|comic book|comic books|manga|graphic novel)s?$/i.test(t) || /^(?:my|show my|open my)\s+(?:comic|comics)(?:\s+shelf)?$/i.test(t) || /^(?:comic|comics)\s+shelf$/i.test(t)) return { what: 'shelf' };
  const make = /^(?:make|write|draw|create|do|give|design|produce)\s+(?:me\s+|us\s+|my\s+)?(?:a\s+|an\s+|another\s+)?(?:new\s+|full\s+|whole\s+|funny\s+|short\s+|proper\s+|real\s+)*(?:comic(?:\s+(?:book|strip))?|graphic novel|manga)s?\b\s*(.*)$/i.exec(t)
    ?? /^(?:a|an)\s+(?:funny\s+|new\s+)?comic(?:\s+book)?\s+(?:about|where|in which|with)\s+(.+)$/i.exec(t);
  if (make) {
    const idea = (make[1] ?? '').replace(/^(?:about|where|in which|with|of|on)\s+/i, '').trim();
    return { what: 'make', idea };
  }
  if (/^(?:open\s+)?(?:the\s+)?comic(?:s)?(?:\s+app|\s+maker|\s+studio)?$/i.test(t)) return { what: 'open' };
  return null;
}
