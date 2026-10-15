/**
 * Every tab in the interface, in dock order. To add a tab, create
 * features/<name>/index.ts exporting a TabDef and add it here.
 */
import type { TabDef } from '../shell/tabs';
import { agendaTab } from './agenda';
import { briefTab } from './brief';
import { coreTab } from './core';
import { eyeTab } from './eye';
import { libraryTab } from './library';
import { linksTab } from './links';
import { marketsTab } from './markets';
import { radioTab } from './radio';
import { memoryTab } from './memory';
import { systemTab } from './system';
import { threatsTab } from './threats';
import { workshopTab } from './workshop';

export const TABS: TabDef[] = [coreTab, eyeTab, briefTab, agendaTab, threatsTab, marketsTab, radioTab, memoryTab, libraryTab, workshopTab, linksTab, systemTab];
