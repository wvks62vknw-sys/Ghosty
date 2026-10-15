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
  'show_route',
  'show_cameras',
  'play_radio',
  'stop_audio',
] as const;
export type ClientCommand = (typeof CLIENT_COMMANDS)[number];

/** A document in Ghosty's library (a book, PDF, page, paper, repository…). */
export interface LibraryDoc {
  id: string;
  title: string;
  /** Where it came from: file name, URL, "arXiv 1706.03762"… */
  source: string;
  kind: string;
  pages: number;
  /** How many searchable passages it was cut into. */
  passages: number;
  chars: number;
  status: 'adding' | 'ready';
  /** Part of the built-in starter library. */
  builtin: boolean;
  at: number;
}

/** A passage found in the library. */
export interface LibraryHit {
  doc: string;
  title: string;
  heading: string;
  page: number | null;
  text: string;
  score: number;
  /** True when it really matches the question (not just one shared word). */
  relevant: boolean;
}

/** One step of an upgrade roadmap: one change that ships on its own. */
export interface RoadmapStep {
  id: number;
  title: string;
  status: 'todo' | 'doing' | 'done' | 'blocked';
  /** The change (pull request) that delivers this step. */
  pr?: number;
  note?: string;
}

/** Ghosty's plan for upgrading itself over several changes (Workshop tab). */
export interface Roadmap {
  goal: string;
  at: number;
  steps: RoadmapStep[];
}

/** A lesson Ghosty learned from its own experience (shown in the Memory tab). */
export interface Lesson {
  id: string;
  text: string;
  tags: string[];
  at: number;
  /** How many times the same lesson was learned again. */
  hits: number;
}

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
  need: 'needed' | 'recommended' | 'optional';
  why: string;
  steps: string[];
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
  /** Where previews of proposed changes appear, e.g. <change>-ghosty.you.workers.dev. */
  previews: string | null;
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
  /** Code checks (typecheck, tests, build) — shipping needs these to pass. */
  checks: 'pending' | 'passed' | 'failed' | 'none';
  /** Cloudflare's preview build of the change. */
  preview: 'ok' | 'failed' | 'pending' | 'none';
  createdAt: string;
}

export interface VersionSummary {
  sha: string;
  message: string;
  date: string;
}

/** Agenda tab (see apps/edge/src/schedule.ts). Times are UTC milliseconds. */
export interface AgendaEventInfo {
  id: string;
  title: string;
  start: number;
  end?: number;
  allDay?: boolean;
  location?: string;
  notes?: string;
  source: string;
}

export interface JobInfo {
  id: string;
  kind: 'reminder' | 'task' | 'verify';
  title: string;
  text: string;
  next: number;
  repeat: 'none' | 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
  tz: string;
  lastRun?: number;
  lastResult?: string;
  eventId?: string;
}

export interface InboxEntry {
  id: string;
  at: number;
  kind: 'reminder' | 'task' | 'error';
  title: string;
  text: string;
  read?: boolean;
}

export interface FeedInfo {
  id: string;
  name: string;
  at: number;
}
