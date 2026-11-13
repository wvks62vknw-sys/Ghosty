/**
 * Every tab in the interface, in dock order. To add a tab, create
 * features/<name>/index.ts exporting a TabDef and add it here.
 */
import type { TabDef } from '../shell/tabs';
import { agendaTab } from './agenda';
import { briefTab } from './brief';
import { coreTab } from './core';
import { eyeTab } from './eye';
import { gymTab } from './gym';
import { learnTab } from './learn';
import { lensTab } from './lens';
// INTERPRETER (BRIEF-OCT-IDEAS-3 item 1): two halves, two languages, hold to talk, nothing kept
import { interpreterTab } from './interpreter';
// THE LAB (BRIEF-OCT-IDEAS-3 item 4): experiments on free public data, each kept as a page
import { labTab } from './lab';
// REHEARSE (BRIEF-OCT-IDEAS-3 item 7): a talk or a hard conversation against Ghosty, three rounds, then notes
import { rehearseTab } from './rehearse';
import { libraryTab } from './library';
// THE READER (BRIEF-LIBRARY-READER): a book from the Library's Shelf, read here or aloud, its place kept
import { readerTab } from './reader';
import { linksTab } from './links';
import { marketsTab } from './markets';
import { radioTab } from './radio';
import { reverseTab } from './reverse';
import { schoolTab } from './school';
import { settingsTab } from './settings';
// THE LOOK (BRIEF-DESIGN-SYSTEM 5): the design system shown by itself, a row of Settings
import { lookTab } from './look';
import { spaceTab } from './space';
import { studioTab } from './studio';
import { memoryTab } from './memory';
import { systemTab } from './system';
import { threatsTab } from './threats';
import { workshopTab } from './workshop';
import { workbenchTab } from './workbench';
import { arcadeTab } from './arcade';
// [tabs] the fourteen sheets as screens of their own (BRIEF-TABS 2): LIFE's eight packs, LEARN's learning and coach, MAKE's
// converter, documents and house, and ME's social self
import { moneyTab } from './money';
import { bodyTab } from './body';
import { kitchenTab } from './kitchen';
import { peopleTab } from './people';
import { workTab } from './work';
import { creativeTab } from './creative';
import { outsideTab } from './outside';
import { homeadminTab } from './homeadmin';
import { learningTab } from './learning';
import { coachTab } from './coach';
import { socialTab } from './social';
import { convertTab } from './convert';
import { docsTab } from './docs';
import { sheetsTab } from './sheets';
import { slidesTab } from './slides';
import { workspaceTab } from './workspace';
// PHOTO (BRIEF-EDITOR-PHOTO): the sixth of the full editors, a non-destructive photo editor on the phone
import { photoTab } from './photo';
import { houseTab } from './house';
import { HUB_TABS } from '../shell/areas';

export const TABS: TabDef[] = [coreTab, eyeTab, lensTab, interpreterTab, labTab, rehearseTab, briefTab, agendaTab, threatsTab, marketsTab, radioTab, memoryTab, libraryTab, readerTab, workshopTab, learnTab, gymTab, schoolTab, studioTab, reverseTab, spaceTab, workbenchTab, linksTab, settingsTab, lookTab, systemTab, arcadeTab, moneyTab, bodyTab, kitchenTab, peopleTab, workTab, creativeTab, outsideTab, homeadminTab, learningTab, coachTab, socialTab, convertTab, docsTab, sheetsTab, slidesTab, workspaceTab, photoTab, houseTab, ...HUB_TABS];
