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
import { HUB_TABS } from '../shell/areas';

export const TABS: TabDef[] = [coreTab, eyeTab, lensTab, briefTab, agendaTab, threatsTab, marketsTab, radioTab, memoryTab, libraryTab, workshopTab, learnTab, gymTab, schoolTab, studioTab, reverseTab, spaceTab, linksTab, settingsTab, systemTab, abilitiesTab, ...HUB_TABS];
