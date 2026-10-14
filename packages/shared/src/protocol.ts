/**
 * The contract between Ghosty's brain (apps/edge) and its interface (apps/web).
 * Both sides import this file, so a change here must be made on both sides.
 */

/** Events streamed (one JSON object per line) from POST /api/chat and POST /api/approve. */
export type ChatEvent =
  | { t: 'status'; text: string }
  | { t: 'tool'; id: string; name: string; args: Record<string, unknown> }
  | { t: 'tool_result'; id: string; name: string; ok: boolean; summary: string }
  | { t: 'client'; name: string; args: Record<string, unknown> }
  | { t: 'approval'; id: string; name: string; args: Record<string, unknown>; reason: string }
  | { t: 'text'; text: string }
  | { t: 'done'; model: string }
  | { t: 'error'; message: string };

/** Commands the brain may ask the interface to run (tools with `side: 'client'`). */
export const CLIENT_COMMANDS = [
  'open_tab',
  'fly_to',
  'set_layer',
  'set_theme',
  'set_sensor_mode',
  'notify',
  'reload_interface',
] as const;
export type ClientCommand = (typeof CLIENT_COMMANDS)[number];

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  at: number;
  model?: string;
}

export interface MemoryFact {
  id: string;
  text: string;
  at: number;
}

export interface Widget {
  name: string;
  title: string;
  html: string;
  at: number;
}

export interface KeyStatus {
  name: string;
  label: string;
  set: boolean;
  hint: string;
  link: string;
}

export interface ModelHealth {
  provider: string;
  model: string;
  state: 'ok' | 'cool' | 'dead';
  info: string;
}

export interface BrainStatus {
  owner: string;
  repo: string | null;
  repoReady: boolean;
  pagesProject: string | null;
  kernelUnlockedUntil: number;
  keys: KeyStatus[];
  models: ModelHealth[];
  lastModel: string | null;
}

export interface ChangeSummary {
  number: number;
  title: string;
  branch: string;
  /** Exact commit shown to the owner; shipping is pinned to it. */
  sha: string;
  url: string;
  previewUrl: string | null;
  checks: 'pending' | 'passed' | 'failed' | 'none';
  createdAt: string;
}

export interface VersionSummary {
  sha: string;
  message: string;
  date: string;
}
