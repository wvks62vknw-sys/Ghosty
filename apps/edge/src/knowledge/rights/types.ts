/**
 * THE RIGHTS-AND-LAW TOPICS (BRIEF-REST-E part 3): the shapes. Every document here was fetched and read on the day in
 * `checked`; its title and date are the page's own; its finding is the document's, in its own words or a faithful
 * summary, put exactly as strongly as the document puts it (a provisional order is not a judgment; a commission's
 * conclusion is the commission's; an organisation's finding is the organisation's). Its tier is never written here: the
 * sourcing code works it out from the address (packages/shared/src/sources.ts tierOf), as for every other source.
 */

/** The day these documents were read for this base. */
export const CHECKED = '2026-11-01';

export type DocKind = 'court order' | 'court opinion' | 'court record' | 'arrest warrants' | 'commission finding' | 'organisation finding' | 'agency finding' | 'statute' | 'official guidance' | 'advice';

export interface RightsDoc {
  /** The document's own title, as the page gives it. */
  title: string;
  /** Who published it: "GOV.UK", "the International Criminal Court", "Amnesty International". */
  by: string;
  /** Its date as the page gives it: YYYY-MM-DD, or YYYY-MM or YYYY when the page gives no more. */
  date: string;
  /** Which date that is. */
  dated: 'issued' | 'published' | 'last updated' | 'enacted' | 'as shown';
  url: string;
  kind: DocKind;
  /** What the document found or says, in its own words or faithfully, as strongly as it does and no more. */
  finding: string;
  checked: string;
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  /** When it answers, as its page says (empty when the page did not say). */
  hours: string;
  /** What it helps with, in a line. */
  what: string;
  /** The page the number was read from. */
  url: string;
  checked: string;
}

export interface RightsTopic {
  id: string;
  title: string;
  /** His practical rights in the UK, or a documented international matter. */
  scope: 'uk' | 'world';
  /**
   * Words in his question that find it: a plain one on its own, one written "~word" only when he also asks about rights
   * or the law (index.ts `findRights`).
   */
  tags: string[];
  /**
   * When given, the matter his question must name too ("landlord", "Gaza", "Epstein"), or the topic is not his
   * question's.
   */
  about?: string[];
  docs: RightsDoc[];
  /** Who to call (Contact ids), for the UK topics. */
  call?: string[];
}
