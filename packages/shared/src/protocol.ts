/**
 * The contract between Ghosty's brain (apps/edge) and its interface (apps/web).
 * Both sides import this file, so a change here must be made on both sides.
 */

/** Events streamed (one JSON object per line) from POST /api/chat and POST /api/approve. */
export type ChatEvent =
  | { t: 'status'; text: string }
  | { t: 'tool'; id: string; name: string; args: Record<string, unknown> }
  | { t: 'tool_result'; id: string; name: string; ok: boolean; summary: string }
  /** What a running tool is doing right now ("crt.sh… 3 of 7"); sits between its `tool` and `tool_result`, same id. */
  | { t: 'progress'; id: string; name: string; label: string; done?: number; total?: number }
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
  'show_traffic',
  'street_view',
  'traffic_map',
  'show_map',
  'open_widget',
  'offline_save',
  'show_link',
  'show_crime',
  'show_transit',
  'show_incidents',
  'road_ahead',
  'open_lens',
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
  /** A page published in this turn: shown as a live-link card under the reply, reloads included. */
  link?: { url: string; title: string };
}

export interface MemoryFact {
  id: string;
  text: string;
  at: number;
}

/** The parts of the owner's profile (apps/edge/src/profile.ts): short lines in the owner's own words, shown in the Memory tab's ME panel. */
export const PROFILE_SECTIONS = ['about', 'likes', 'dislikes', 'people', 'places', 'routines', 'goals', 'work', 'other'] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

/** What Ghosty knows about its owner from what they said themselves: built by the nightly reflection, edited in the Memory tab. */
export interface Profile {
  /** One line on who the owner is, as far as Ghosty knows. */
  summary: string;
  /** Short lines (at most 160 characters, 40 a section). */
  sections: Record<ProfileSection, string[]>;
  updatedAt: number;
}

/** One day's diary entry, written by the nightly reflection into the library (doc notes_diary). */
export interface DiaryEntry {
  /** The day, YYYY-MM-DD. */
  heading: string;
  text: string;
  rid: number;
}

/** What a reflection (nightly, or REFLECT NOW) changed. */
export interface ReflectInfo {
  ok: boolean;
  /** Why nothing was done, when nothing was ("no model free", "nothing new"). */
  skipped?: string;
  facts: string[];
  lines: { section: ProfileSection; text: string }[];
  diary: string;
  summary: string;
  profile: Profile;
}

/** What one run of the morning digest (apps/edge/src/library/digest.ts) filed. */
export interface DigestInfo {
  day: string;
  passages: number;
  sources: string[];
  /** The "in three levels" passage was written (a cheap model was free). */
  levels: boolean;
  skipped?: string;
  summary: string;
}

/** One step of a project that runs for days (apps/edge/src/projects.ts). */
export interface ProjectStep {
  n: number;
  title: string;
  instruction: string;
  status: 'todo' | 'doing' | 'done' | 'failed';
  /** What the step produced, shortened; the full result is in the library (doc project_<id>). */
  result?: string;
  at?: number;
}

/** A project Ghosty works through on its own, one step per alarm; the Workshop tab's PROJECTS panel. */
export interface Project {
  id: string;
  title: string;
  goal: string;
  steps: ProjectStep[];
  status: 'active' | 'paused' | 'done' | 'cancelled';
  /** steady = a step every 20 minutes; fast = every 3. */
  pace: 'fast' | 'steady';
  created: number;
  updated: number;
  /** Failures in a row on the current step (three pause the project). */
  fails: number;
  docId: string;
  /** The last thing worth knowing: waiting for a free model, why a step failed. */
  note?: string;
}

export interface Widget {
  name: string;
  title: string;
  html: string;
  at: number;
}

/** One of the pages Ghosty published (GET /api/sites). */
export interface PublishedSite {
  /** The name in the link: …/s/<name>. */
  name: string;
  title: string;
  /** The site it was rebuilt from, if any. */
  source: string;
  at: number;
  bytes: number;
}

export interface KeyStatus {
  name: string;
  label: string;
  /** null: not known right now (the database is paused and no copy of this key is reachable). */
  set: boolean | null;
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
  /** Set while the database is unavailable (free daily allowance used up): what still works. */
  paused?: string;
  /** Keys saved while the database was paused, still waiting to be written to it. */
  waiting?: number;
  /** Today's use of the database's free daily allowance (see apps/edge/src/meter.ts). */
  meter?: DatabaseMeter;
}

/** Today's use of the brain's database against Cloudflare's free daily allowance. */
export interface DatabaseMeter {
  /** UTC day the counts are for (YYYY-MM-DD). */
  day: string;
  reads: number;
  writes: number;
  /** Counts by the work that caused them, biggest first. */
  by: { label: string; r: number; w: number }[];
  limits: { reads: number; writes: number };
  /** The larger of reads/limit and writes/limit (can pass 1 once the allowance is gone). */
  level: number;
  /** When the allowance resets (midnight UTC), ms since the epoch. */
  resetAt: number;
}

/** The owner's linked Spotify account (LINKS → SPOTIFY). Tokens never leave the brain. */
export interface EmailStatus {
  linked: boolean;
  /** The brain could not tell right now (database paused, no copy reachable); the last known answer stands. */
  unknown?: boolean;
  /** The linked address (the password is never sent back). */
  address?: string;
  /** The IMAP server it reads from. */
  server?: string;
  /** Set when the saved settings can't be used. */
  problem?: string;
}

export interface SpotifyStatus {
  linked: boolean;
  /** Spotify display name, when linked. */
  name: string | null;
  /** 'premium' or 'free' (playback control needs Premium). */
  product: string | null;
  /** The Client ID of the owner's Spotify app (not a secret), to prefill the LINKS tab. */
  clientId: string | null;
  /** The brain could not tell right now (database paused, no copy reachable); the last known answer stands. */
  unknown?: boolean;
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
  kind: 'reminder' | 'task' | 'verify' | 'study' | 'reflect' | 'digest' | 'project';
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
