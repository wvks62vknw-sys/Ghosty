/**
 * THE INTERNATIONAL TOPICS, from the documents themselves (BRIEF-REST-E part 3; OWNER-ISSUES 77c): the International
 * Court of Justice's orders and its advisory opinion, the International Criminal Court's warrants, the UN Commission of
 * Inquiry's findings, Amnesty International's and Human Rights Watch's, the US Justice Department's and FBI's
 * memorandum on the Epstein files and the court record of Ghislaine Maxwell's conviction, and the UK's Post Office
 * Horizon Act — each read on 1 November 2026 and put exactly as strongly as the document puts it. Two ICJ press
 * releases (26 January and 24 May 2024) and a US Attorney's Office release (Ghislaine Maxwell's sentence) would not
 * open from here and are left out: the ICJ's own case page and the UN's own news service carry what the Court ordered
 * and advised, and the Court of Appeals' own opinion carries Maxwell's conviction and sentence.
 */
import { CHECKED, type RightsTopic } from './types';

const c = CHECKED;

/** The words that name the matter the ICJ, ICC and UN findings below are about (a topic's `about`, types.ts). */
const ISRAEL_PALESTINE = ['israel', 'israels', 'israeli', 'israelis', 'gaza', 'gazas', 'palestine', 'palestinian', 'palestinians', 'west bank', 'east jerusalem'];

export const WORLD_TOPICS: RightsTopic[] = [
  {
    id: 'icj-gaza',
    title: 'The ICJ: South Africa v. Israel, and the advisory opinion on the occupation',
    scope: 'world',
    about: [...ISRAEL_PALESTINE, 'south africa', 'rafah'],
    tags: ['icj', 'international court of justice', 'world court', 'provisional measures', 'advisory opinion', 'genocide case', 'genocide convention', 'south africa v israel', 'south africa vs israel', 'genocide', 'illegal occupation', 'unlawful occupation', 'occupation illegal', 'occupation unlawful', 'occupation is illegal', 'occupation is unlawful', 'settlements illegal', 'settlements are illegal', 'illegal settlements', 'occupation', 'settlements', 'settlers', '~illegal', '~unlawful', '~legal', '~lawful'],
    docs: [
      {
        title: 'Application of the Convention on the Prevention and Punishment of the Crime of Genocide in the Gaza Strip (South Africa v. Israel): the case’s documents',
        by: 'the International Court of Justice',
        date: '2024-05-24',
        dated: 'issued',
        url: 'https://www.icj-cij.org/case/192',
        kind: 'court record',
        finding: 'The Court’s own case page records: on 26 January 2024, "The Court indicates provisional measures"; an Order of 28 March 2024 on South Africa’s request to modify that Order; and on 24 May 2024, on a further request, "The Court reaffirms its previous provisional measures and indicates new measures".',
        checked: c,
      },
      {
        title: 'UN world court calls for prevention of genocidal acts in Gaza',
        by: 'UN News',
        date: '2024-01-26',
        dated: 'published',
        url: 'https://news.un.org/en/story/2024/01/1145937',
        kind: 'court order',
        finding: 'The ICJ declared that Palestinians had a right to be protected from acts of genocide and called on Israel to "take all measures within its power" to prevent such acts and to allow the entry of humanitarian aid; there was no explicit call for an immediate halt to the military operation. Provisional measures are a temporary injunction ahead of a final decision, likely years away; they are "mandatory for implementation", but the Court has no means of enforcing them. Israel denies the allegations of genocide.',
        checked: c,
      },
      {
        title: 'Israel’s continued occupation of Palestinian territory ‘unlawful’: UN world court',
        by: 'UN News',
        date: '2024-07-19',
        dated: 'published',
        url: 'https://news.un.org/en/story/2024/07/1152296',
        kind: 'court opinion',
        finding: 'In an advisory opinion requested by the UN General Assembly, the ICJ declared that Israel’s continued presence in the Occupied Palestinian Territory "is unlawful", that Israel must end it "as rapidly as possible" and is under an obligation "to cease immediately all new settlement activities and to evacuate all settlers", and that "all States are under an obligation not to recognize" it. Advisory opinions are not legally binding, unlike judgments between States.',
        checked: c,
      },
    ],
  },
  {
    id: 'icc-warrants',
    title: 'The ICC’s arrest warrants',
    scope: 'world',
    about: [...ISRAEL_PALESTINE, 'netanyahu', 'gallant', 'putin', 'lvova-belova', 'ukraine', 'ukrainian', 'russia', 'russias', 'russian'],
    tags: ['icc', 'international criminal court', 'arrest warrant', 'arrest warrants', 'warrant', 'warrants', 'war crimes', 'war crime', 'war criminal', 'war criminals', 'crimes against humanity', 'be arrested', 'starvation', 'deported children', 'deportation of children'],
    docs: [
      {
        title: 'Situation in the State of Palestine: ICC Pre-Trial Chamber I rejects the State of Israel’s challenges to jurisdiction and issues warrants of arrest for Benjamin Netanyahu and Yoav Gallant',
        by: 'the International Criminal Court',
        date: '2024-11-21',
        dated: 'issued',
        url: 'https://www.icc-cpi.int/news/situation-state-palestine-icc-pre-trial-chamber-i-rejects-state-israels-challenges',
        kind: 'arrest warrants',
        finding: 'Pre-Trial Chamber I unanimously rejected Israel’s challenges to the Court’s jurisdiction and issued arrest warrants for Benjamin Netanyahu and Yoav Gallant. It found reasonable grounds to believe each bears criminal responsibility as a co-perpetrator for the war crime of starvation as a method of warfare and the crimes against humanity of murder, persecution and other inhumane acts, and as a civilian superior for the war crime of intentionally directing an attack against the civilian population.',
        checked: c,
      },
      {
        title: 'Situation in Ukraine: ICC judges issue arrest warrants against Vladimir Vladimirovich Putin and Maria Alekseyevna Lvova-Belova',
        by: 'the International Criminal Court',
        date: '2023-03-17',
        dated: 'issued',
        url: 'https://www.icc-cpi.int/news/situation-ukraine-icc-judges-issue-arrest-warrants-against-vladimir-vladimirovich-putin-and',
        kind: 'arrest warrants',
        finding: 'Pre-Trial Chamber II issued arrest warrants for Vladimir Putin and Maria Lvova-Belova: there are reasonable grounds to believe each bears criminal responsibility for the war crimes of unlawful deportation and unlawful transfer of children from occupied areas of Ukraine to the Russian Federation, allegedly committed from at least 24 February 2022.',
        checked: c,
      },
    ],
  },
  {
    id: 'gaza-findings',
    title: 'Genocide findings on Gaza: the UN commission, Amnesty, Human Rights Watch',
    scope: 'world',
    about: ISRAEL_PALESTINE,
    tags: ['genocide', 'genocidal', 'extermination', 'war crimes', 'crimes against humanity', 'commission of inquiry', 'un commission', 'amnesty', 'amnesty international', 'human rights watch', 'hrw'],
    docs: [
      {
        title: 'Israel has committed genocide in the Gaza Strip, UN Commission finds',
        by: 'the UN Independent International Commission of Inquiry on the Occupied Palestinian Territory, including East Jerusalem, and Israel (OHCHR)',
        date: '2025-09-16',
        dated: 'published',
        url: 'https://www.ohchr.org/en/press-releases/2025/09/israel-has-committed-genocide-gaza-strip-un-commission-finds',
        kind: 'commission finding',
        finding: 'The Commission said in a new report that Israel has committed genocide against Palestinians in the Gaza Strip. Investigating events from 7 October 2023 to 31 July 2025, it concluded that Israeli authorities and security forces committed four of the five genocidal acts defined by the 1948 Genocide Convention, among them killing, causing serious bodily or mental harm, and deliberately inflicting conditions of life calculated to bring about the destruction of the Palestinians in whole or in part. It is the Commission’s finding, not a court’s judgment.',
        checked: c,
      },
      {
        title: 'Israel has committed war crimes and crimes against humanity in the Occupied Palestinian Territory amid continuing genocide in Gaza, UN Commission of Inquiry finds',
        by: 'the UN Independent International Commission of Inquiry (OHCHR)',
        date: '2026-10-26',
        dated: 'published',
        url: 'https://www.ohchr.org/en/press-releases/2026/10/israel-has-committed-war-crimes-and-crimes-against-humanity-occupied',
        kind: 'commission finding',
        finding: 'In a report to the UN General Assembly the Commission found that Israel has committed war crimes and the crimes against humanity of extermination, persecution, torture, rape and other forms of sexual violence in the Occupied Palestinian Territory as it continues to commit genocide in Gaza, including genocidal acts after the so-called ceasefire agreement; and that in the West Bank, Palestinians killed by airstrikes rose from six between 2008 and 6 October 2023 to 254 between 7 October 2023 and 30 September 2026.',
        checked: c,
      },
      {
        title: 'Amnesty concludes Israel is committing genocide in Gaza',
        by: 'Amnesty International',
        date: '2024-12-05',
        dated: 'published',
        url: 'https://www.amnesty.org/en/latest/news/2024/12/amnesty-international-concludes-israel-is-committing-genocide-against-palestinians-in-gaza/',
        kind: 'organisation finding',
        finding: 'Amnesty International’s research "found sufficient basis to conclude that Israel has committed and is continuing to commit genocide against Palestinians in the occupied Gaza Strip" (its report "You Feel Like You Are Subhuman"): acts prohibited under the Genocide Convention, including killings, serious bodily or mental harm and conditions of life calculated to bring about physical destruction, with the specific intent to destroy Palestinians in Gaza. It is Amnesty’s conclusion.',
        checked: c,
      },
      {
        title: 'Israel’s Crime of Extermination, Acts of Genocide in Gaza',
        by: 'Human Rights Watch',
        date: '2024-12-19',
        dated: 'published',
        url: 'https://www.hrw.org/news/2024/12/19/israels-crime-extermination-acts-genocide-gaza',
        kind: 'organisation finding',
        finding: 'Human Rights Watch found that by deliberately depriving Palestinians in Gaza of adequate access to water, most likely resulting in thousands of deaths, Israeli authorities are responsible for the crime against humanity of extermination and for acts of genocide; and that this pattern of conduct, with statements suggesting some officials wished to destroy Palestinians in Gaza, "may amount to the crime of genocide". It is HRW’s finding, put as it puts it.',
        checked: c,
      },
    ],
  },
  {
    id: 'epstein',
    title: 'The Epstein case: what the US Justice Department and FBI said, and Ghislaine Maxwell’s conviction',
    scope: 'world',
    about: ['epstein', 'epsteins', 'ghislaine', 'ghislaine maxwell'],
    tags: ['jeffrey', 'ghislaine', 'maxwell', 'convicted', 'conviction', 'sentenced', 'sentence', 'appeal', 'supreme court', 'trafficking', 'prison', 'jail', 'files', 'file', 'list', 'client list', 'clients', 'fbi', 'doj', 'justice department', 'department of justice', 'blackmail', 'blackmailed', 'suicide', 'kill himself', 'killed himself', 'murdered', 'death', 'died', 'victims', 'documents', 'memo', 'evidence', 'cover up', 'cover-up', 'island', 'names', 'case', 'investigation', 'released', 'who was', 'tell me about', 'what happened'],
    docs: [
      {
        title: 'FBI Memo, July 2025 (Department of Justice and FBI memorandum on the review of Epstein-related holdings)',
        by: 'the US Department of Justice and Federal Bureau of Investigation (as published on govinfo.gov)',
        date: '2025-07',
        dated: 'as shown',
        url: 'https://www.govinfo.gov/content/pkg/GOVPUB-J-PURL-gpo254689/pdf/GOVPUB-J-PURL-gpo254689.pdf',
        kind: 'agency finding',
        finding: 'The DOJ and FBI said their review of more than 300 gigabytes of data and physical evidence "revealed no incriminating “client list”", found no credible evidence that Epstein blackmailed prominent individuals, and uncovered no evidence that could predicate an investigation against uncharged third parties; that it confirmed Epstein harmed over one thousand victims; and that FBI investigators concluded he committed suicide in his cell in New York on 10 August 2019. These are the agencies’ own conclusions.',
        checked: c,
      },
      {
        title: 'United States v. Maxwell, No. 22-1426-cr: opinion of the Court of Appeals',
        by: 'the US Court of Appeals for the Second Circuit (as filed in the Supreme Court’s docket 24-1073)',
        date: '2024-09-17',
        dated: 'issued',
        url: 'https://www.supremecourt.gov/DocketPDF/24/24-1073/337362/20250117133905126_22-1426.pdf',
        kind: 'court opinion',
        finding: 'Ghislaine Maxwell was convicted in the Southern District of New York of conspiracy to transport minors with intent to engage in criminal sexual activity, transportation of a minor with intent to engage in criminal sexual activity, and sex trafficking of a minor, and sentenced principally to concurrent terms of 60, 120 and 240 months, with a fine of $250,000 on each count. The Court of Appeals held that Epstein’s Non-Prosecution Agreement did not bar her prosecution in New York, as it does not bind that office, and that the indictment was brought in time: "Identifying no errors in the District Court’s conduct of this complex case, we AFFIRM the District Court’s June 29, 2022, judgment of conviction."',
        checked: c,
      },
      {
        title: 'Docket for 24-1073: Ghislaine Maxwell, Petitioner v. United States',
        by: 'the Supreme Court of the United States',
        date: '2025-10-06',
        dated: 'as shown',
        url: 'https://www.supremecourt.gov/docket/docketfiles/html/public/24-1073.html',
        kind: 'court record',
        finding: 'The Supreme Court’s docket records Ghislaine Maxwell’s petition for a writ of certiorari from the Second Circuit’s decision of 17 September 2024 (No. 22-1426; rehearing denied 25 November 2024), docketed on 14 April 2025, the United States’ brief in opposition of 14 July 2025, and on 6 October 2025: "Petition DENIED."',
        checked: c,
      },
    ],
  },
  {
    id: 'post-office-horizon',
    title: 'The Post Office Horizon convictions',
    scope: 'world',
    about: ['post office', 'horizon', 'subpostmaster', 'subpostmasters', 'sub-postmaster', 'sub-postmasters', 'sub postmasters', 'postmasters'],
    tags: ['scandal', 'convictions', 'conviction', 'convicted', 'quashed', 'prosecuted', 'prosecutions', 'compensation scheme', 'post office inquiry', 'horizon inquiry', 'public inquiry', 'subpostmaster', 'subpostmasters', 'sub-postmaster', 'sub-postmasters', 'sub postmasters', 'fujitsu', 'mr bates', 'horizon system', 'horizon act', 'offences act', 'wrongly convicted', 'wrongly accused', 'wrongly prosecuted'],
    docs: [
      {
        title: 'Post Office (Horizon System) Offences Act 2024 (2024 c. 14)',
        by: 'legislation.gov.uk',
        date: '2024',
        dated: 'enacted',
        url: 'https://www.legislation.gov.uk/ukpga/2024/14/contents',
        kind: 'statute',
        finding: 'The Act’s own contents: section 1 quashes convictions for "relevant offences" (defined in section 2), section 4 provides for identifying and notifying the quashed convictions, and section 5 deletes cautions for relevant offences in England and Wales.',
        checked: c,
      },
    ],
  },
];
