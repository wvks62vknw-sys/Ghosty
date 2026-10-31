// KNOWLEDGE WITH SOURCES (OWNER-ISSUES 77; packages/shared/src/sources.ts, packages/shared/src/refusal.ts, bundled by the test
// script into .build/sources/): the tier of 40 hosts and their subdomains, the six labels and the lines that hold as code
// (a lead alone is a rumour at most; an established fact needs a primary source or two credible ones; nothing read backs
// it: contested at best), a lead's note, a library document's tier — and a model that would not engage, told from ten real
// shapes of a declined answer, with ten ordinary replies that must not match.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const S = await import('./.build/sources/sources.mjs');
const R = await import('./.build/sources/refusal.mjs');

test('tiers: forty hosts, their subdomains, and everything else unknown', () => {
  const want = {
    'https://www.icj-cij.org/case/192': 'primary', 'https://www.icc-cpi.int/news/situation-state-palestine': 'primary', 'supremecourt.uk': 'primary', 'https://www.judiciary.uk/judgments/x': 'primary',
    'https://www.bailii.org/ew/cases/EWCA/Civ/2024/1.html': 'primary', 'https://www.courtlistener.com/docket/4355835/giuffre-v-maxwell/': 'primary', 'https://www.documentcloud.org/documents/x': 'primary',
    'https://www.un.org/unispal/': 'primary', 'https://www.ohchr.org/en/press-releases': 'primary', 'https://news.un.org/en/story/2025': 'primary', 'https://digitallibrary.un.org/record/1': 'primary',
    'https://www.gov.uk/government/news': 'primary', 'https://www.legislation.gov.uk/ukpga/2023/1': 'primary', 'https://hansard.parliament.uk/commons': 'primary', 'https://www.congress.gov/bill/1': 'primary',
    'https://www.justice.gov/epstein': 'primary', 'https://vault.fbi.gov/jeffrey-epstein': 'primary', 'https://www.ons.gov.uk/': 'primary', 'https://www.who.int/news': 'primary', 'https://doi.org/10.1038/x': 'primary',
    'https://arxiv.org/abs/1706.03762': 'primary', 'https://www.ox.ac.uk/news': 'primary', 'https://news.mit.edu/2025': 'primary',
    'https://www.amnesty.org/en/documents/mde15/8668/2024/en/': 'credible', 'https://www.hrw.org/report/2024/12/19': 'credible', 'https://www.btselem.org/publications': 'credible', 'https://www.icij.org/investigations/': 'credible',
    'https://www.bellingcat.com/news/': 'credible', 'https://fullfact.org/health/': 'credible', 'https://www.propublica.org/article/x': 'credible',
    'https://www.bbc.co.uk/news/world-1': 'press', 'https://www.reuters.com/world/': 'press', 'https://apnews.com/article/x': 'press', 'https://www.aljazeera.com/news/': 'press', 'https://www.haaretz.com/israel-news/': 'press',
    'https://en.wikipedia.org/wiki/Gaza': 'reference', 'https://www.britannica.com/topic/x': 'reference',
    'https://www.tiktok.com/@someone/video/1': 'lead', 'https://x.com/someone/status/1': 'lead', 'https://twitter.com/a': 'lead', 'https://youtu.be/abc': 'lead', 'https://m.youtube.com/watch?v=1': 'lead', 'https://old.reddit.com/r/x': 'lead', 'https://t.me/channel/1': 'lead',
    'https://example.com/blog': 'unknown', 'https://gov.uk.example.com/fake': 'unknown', 'https://notbbc.co.uk.evil.io/x': 'unknown', 'not a url at all': 'unknown', '': 'unknown',
  };
  assert.ok(Object.keys(want).length >= 40);
  for (const [u, t] of Object.entries(want)) assert.equal(S.tierOf(u), t, u);
  // a bare host, and a subdomain of each kind
  assert.equal(S.tierOf('bbc.co.uk'), 'press');
  assert.equal(S.tierOf('feeds.bbci.co.uk'), 'press', "the BBC's own feed host (the morning digest reads it)");
  assert.equal(S.tierOf('bbc-news.co.uk'), 'unknown', 'only the hosts in the table, never a guess from the look of a name');
  assert.equal(S.tierOf('bbc.co.uk.example.net'), 'unknown');
  assert.equal(S.tierOf('pubmed.ncbi.nlm.nih.gov'), 'primary');
  assert.equal(S.tierOf('www.publishing.service.gov.uk'), 'primary');
  assert.equal(S.tierWord('primary'), 'PRIMARY');
  assert.equal(S.tierWord(undefined), 'UNKNOWN');
  assert.match(S.tierReason('https://www.hrw.org/x'), /human-rights/);
  assert.match(S.leadNote('https://www.tiktok.com/@a/video/1'), /^TikTok is a lead, not a source: .*Never cite TikTok itself as the proof\.$/);
  assert.match(S.leadNote('https://x.com/a'), /^X is a lead/);
});

test('labels: the six, read from a model’s words, and capped by the tiers read this turn', () => {
  assert.equal(S.LABELS.length, 6);
  assert.equal(S.labelOf('Established Fact'), 'established fact');
  assert.equal(S.labelOf('allegation'), 'documented allegation');
  assert.equal(S.labelOf('legal finding (in progress)'), 'legal finding in progress');
  assert.equal(S.labelOf('rumor'), 'rumour');
  assert.equal(S.labelOf('debunked'), 'debunked');
  assert.equal(S.labelOf('banana'), null);
  const cap = (p, t) => S.capLabel(p, t).label;
  // a lead alone: rumour at most, whatever was proposed
  for (const p of ['established fact', 'documented allegation', 'debunked', 'legal finding in progress', null]) assert.equal(cap(p, ['lead']), 'rumour', `${p} from a lead`);
  assert.equal(cap('established fact', ['lead', 'lead']), 'rumour');
  // an established fact: one primary, or two credible / press
  assert.equal(cap('established fact', ['primary']), 'established fact');
  assert.equal(cap('established fact', ['credible', 'press']), 'established fact');
  assert.equal(cap('established fact', ['press', 'press']), 'established fact');
  assert.equal(cap('established fact', ['press']), 'documented allegation');
  assert.equal(cap('established fact', ['reference']), 'documented allegation', 'Wikipedia is never itself the proof');
  assert.equal(cap('established fact', ['reference', 'unknown', 'lead']), 'documented allegation');
  assert.equal(cap('established fact', ['lead', 'primary']), 'established fact', 'a lead does not take away from a primary');
  const capped = S.capLabel('established fact', ['press']);
  assert.ok(capped.capped && /primary source/.test(capped.why));
  // nothing read backs it: contested at best (a rumour stays a rumour)
  assert.equal(cap('established fact', []), 'contested');
  assert.equal(cap('debunked', []), 'contested');
  assert.equal(cap('rumour', []), 'rumour');
  assert.equal(cap(null, []), 'contested');
  // the others stand when backed
  assert.equal(cap('legal finding in progress', ['primary']), 'legal finding in progress');
  assert.equal(cap('debunked', ['credible']), 'debunked');
  assert.equal(cap('contested', ['primary']), 'contested', 'never raised, only capped');
  assert.equal(cap(null, ['press']), 'documented allegation');
  assert.equal(S.labelCounts(['established fact', 'established fact', 'documented allegation', 'contested', undefined]), '2 established, 1 documented, 1 contested');
  // a library document's tier
  assert.equal(S.libraryTier('yt_dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'lead');
  assert.equal(S.libraryTier('notes_research', 'Ghosty'), 'reference');
  assert.equal(S.libraryTier('notes_daily', 'gathered daily by Ghosty', '2026-10-31 · UN News · PRIMARY'), 'primary');
  assert.equal(S.libraryTier('doc_1', 'https://www.amnesty.org/en/documents/x'), 'credible');
  assert.equal(S.libraryTier('doc_2', 'arXiv 1706.03762'), 'primary');
  assert.equal(S.libraryTier('doc_3', 'my notes.pdf'), 'unknown', 'his own upload');
});

test('a model that would not engage: ten real shapes of a declined answer, and ten ordinary replies that are not', () => {
  const declined = [
    "I'm sorry, but I can't discuss that topic.",
    "I'm not able to provide information on that subject as it involves sensitive political matters.",
    "As an AI, I don't take sides on political issues. There are many perspectives on this conflict.",
    'I cannot help with that request.',
    "This is a complex and sensitive topic, and I'd prefer not to weigh in on it.",
    "I'm unable to comment on ongoing legal matters or allegations against specific individuals.",
    "I don't have the ability to discuss this. Please consult reliable news sources for information.",
    "Sorry, I can't provide an answer to that. It's a highly controversial topic with differing views.",
    "I must decline to answer questions about this conflict.",
    'That is a sensitive topic that I am not able to engage with.',
  ];
  const ordinary = [
    'The ICJ ordered provisional measures on 26 January 2024 [1].',
    'Ghislaine Maxwell was convicted in December 2021 on five of six counts [2].',
    "I can't find a primary source for that claim: the TikTok video cites no document.",
    "I couldn't reach the court's website just now, so this rests on the Reuters report [3].",
    'There are competing claims here: the UN figure is X [1]; the government disputes it [2].',
    'The rain stops by 3pm.',
    "I'm sorry to hear that — do you want me to find the nearest pharmacy?",
    'Sure: the train leaves at 08:12 from platform 4.',
    "No, that's a rumour: Full Fact traced it to a satirical post [1].",
    "I won't guess at a private person's motives; the court documents say this [1].",
  ];
  for (const t of declined) assert.ok(R.refusedWords(t), `declined: "${t}"`);
  for (const t of ordinary) assert.ok(!R.refusedWords(t), `ordinary: "${t}"`);
  assert.equal(R.REFUSAL_LINE, "That model wouldn't engage with this; here is what the sources say:");
});
