/** A playbook: one focused piece of know-how Ghosty can look up with the `study` tool. */
export interface Playbook {
  /** Short stable id, e.g. 'self-review'. */
  id: string;
  title: string;
  /** Words that should find this playbook. */
  tags: string[];
  body: string;
}

/** Something Ghosty learned from its own experience (stored in its brain, shown in every prompt). */
export type { Lesson } from '../../../../packages/shared/src/protocol';
