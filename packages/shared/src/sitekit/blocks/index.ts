/** Every section block, by id. */
import type { BlockDef } from '../types';
import { commerceBlocks } from './commerce';
import { contentBlocks } from './content';
import { footerBlocks } from './footer';
import { formBlocks } from './forms';
import { heroBlocks } from './hero';
import { mediaBlocks } from './media';
import { navBlocks } from './nav';
import { proofBlocks } from './proof';

export const BLOCK_LIST: BlockDef[] = [...navBlocks, ...heroBlocks, ...contentBlocks, ...proofBlocks, ...commerceBlocks, ...mediaBlocks, ...formBlocks, ...footerBlocks];
export const BLOCKS: Record<string, BlockDef> = Object.fromEntries(BLOCK_LIST.map((b) => [b.id, b]));
