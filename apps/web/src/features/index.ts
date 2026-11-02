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
import { libraryTab } from './library';
import { linksTab } from './links';
import { marketsTab } from './markets';
import { radioTab } from './radio';
import { reverseTab } from './reverse';
import { schoolTab } from './school';
import { settingsTab } from './settings';
import { spaceTab } from './space';
import { studioTab } from './studio';
import { memoryTab } from './memory';
import { systemTab } from './system';
import { threatsTab } from './threats';
import { workshopTab } from './workshop';
import { abilitiesTab } from './abilities';
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
import { houseTab } from './house';
import { HUB_TABS } from '../shell/areas';

export const TABS: TabDef[] = [coreTab, eyeTab, lensTab, briefTab, agendaTab, threatsTab, marketsTab, radioTab, memoryTab, libraryTab, workshopTab, learnTab, gymTab, schoolTab, studioTab, reverseTab, spaceTab, workbenchTab, linksTab, settingsTab, systemTab, abilitiesTab, arcadeTab, moneyTab, bodyTab, kitchenTab, peopleTab, workTab, creativeTab, outsideTab, homeadminTab, learningTab, coachTab, socialTab, convertTab, docsTab, houseTab, ...HUB_TABS];
