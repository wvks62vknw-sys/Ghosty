/**
 * The contract between Ghosty's brain (apps/edge) and its interface (apps/web).
 * Both sides import this file, so a change here must be made on both sides.
 */
import type { Card } from './cards';
import type { Mood } from './mood';
import type { PersonaSettings } from './persona';
import type { SpeedSummary } from './speed';

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
  | { t: 'error'; message: string }
  /** A cited answer (CITED on, or "with sources"): its numbered sources and each claim checked against them; sent after its `text`. */
  | ({ t: 'cited' } & CitedInfo)
  /** His mood changed with this message (packages/shared/src/mood.ts): the phone shows it at once, not at the next status. */
  | { t: 'mood'; mood: Mood }
  /** Live cards a tool's result made, by code (packages/shared/src/cards.ts cardsFromTool): sent after its `tool_result`. */
  | { t: 'cards'; cards: Card[] };

/** One numbered source of a cited answer: a web page (`url`) or a library document (`doc`, its title); `missing`: cited but never looked up this turn. */
export interface Citation {
  n: number;
  title: string;
  url?: string;
  doc?: string;
  /** The words in the source that back the answer, when found. */
  quote?: string;
  missing?: boolean;
  /** How far the source can be trusted (packages/shared/src/sources.ts tierOf): primary, credible, press, reference, lead, unknown. */
  tier?: string;
}

/** One claim of a cited answer (the exact words of the reply) and whether a source it looked up says it. */
export interface ClaimCheck {
  claim: string;
  status: 'supported' | 'not_found';
  source?: number;
  /** How strongly the claim may be put (sources.ts LABELS), capped by the tiers of what backs it: "established fact", "rumour"… */
  label?: string;
}

export interface CitedInfo {
  citations: Citation[];
  checks: ClaimCheck[];
  /** The model declined to engage (sources.ts / refusal.ts): the answer says so first. */
  refused?: boolean;
}

/**
 * A home drawn from the owner's words (the brain's design_home → the `home_plan` command): every storey's
 * whole plan as Room JSON v2 (packages/shared/src/design.ts; never cut, it does not go to the model), the
 * words it was drawn from and everything that was assumed or could not be done. The phone keeps the last one
 * (SPACE → DESIGN MY HOME and the plan card in the chat).
 */
export interface HomePlanEvent {
  words: string;
  unit: 'metric' | 'imperial';
  /** Ground floor first. */
  storeys: { name: string; plan: Record<string, unknown> }[];
  assumed: string[];
  cannot: string[];
}

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
  'show_journey',
  'open_space',
  'open_studio',
  'open_learn',
  'design_changes',
  'home_plan',
  'open_photo_tools',
  'open_money', // [packs] the money pack's statement box (BRIEF-PACKS-1)
  'open_body', // [packs] the body pack's screens (BRIEF-PACKS-1)
  'open_kitchen', // [packs] the kitchen pack's sheets
  'kitchen_timer', // [packs] timers on the phone
  'open_people', // [packs] the people pack's who's who and plan (BRIEF-PACKS-2)
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
  /** Locked in the Memory tab: never reworded, merged away or dropped (memories.ts). */
  locked?: boolean;
  /**
   * 'conduct': a standing rule about how he talks and acts, in the owner's own words ("too long", "never call me that";
   * OWNER-ISSUES 64 RAISING HIM), on every turn. None: an engineering lesson, on coding turns only.
   */
  kind?: 'conduct';
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  at: number;
  model?: string;
  /** A page published in this turn: shown as a live-link card under the reply, reloads included. */
  link?: { url: string; title: string };
  /** The owner's message ran a vehicle check: the reply to it is never kept (integrations/vehicle.ts). */
  vehicle?: boolean;
  /** A cited answer's sources and claim checks (cited.ts), so they show again after a reload. */
  cited?: CitedInfo;
}

export interface MemoryFact {
  id: string;
  text: string;
  at: number;
  /** Where it came from (missing on facts kept before sources were recorded). */
  src?: MemorySource;
  /** Locked in the Memory tab: the nightly reflection never rewrites or drops it. */
  locked?: boolean;
  /** When the owner last edited its words. */
  edited?: number;
  /** How often it was heard: 1 when first kept, one more each time he says it again, relies on it, or KEEPs it (memories.ts). */
  weight?: number;
  /** When it was last heard (said again, relied on, kept); unset: when it was first kept. */
  seen?: number;
}

/**
 * Where a memory came from (apps/edge/src/memories.ts). `owner`: typed in the Memory tab;
 * `chat`: saved during a conversation; `reflection`: the nightly look back over the day;
 * `ghosty`: a lesson from Ghosty's own work; `unknown`: kept before sources were recorded.
 */
export interface MemorySource {
  kind: 'owner' | 'chat' | 'reflection' | 'ghosty' | 'unknown';
  /** When it was saved. */
  at: number;
  /** The owner's message it came from, when known (its time in the conversation history). */
  turnAt?: number;
  /** That message, cut short — only in the timeline, and only while it is still in the history. */
  quote?: string;
}

export type MemoryKind = 'profile' | 'fact' | 'diary' | 'lesson';

/** One thing Ghosty remembers about the owner, as the MEMORY tab's TIMELINE shows it. */
export interface MemoryItem {
  /** `p:<line, lower case>`, `f:<fact id>`, `d:<YYYY-MM-DD>`, `l:<lesson id>`. */
  id: string;
  kind: MemoryKind;
  section?: ProfileSection;
  text: string;
  at: number;
  src: MemorySource;
  locked: boolean;
  edited?: number;
  /** A saved fact: how often it was heard ("heard four times"). */
  weight?: number;
  /** A fact the reflection inferred that nothing has confirmed for three weeks: let go after five unless he KEEPs it. */
  fading?: boolean;
}

/** A memory forgotten in the last day, which UNDO can still bring back (the Memory tab's RECENTLY FORGOTTEN). */
export interface ForgottenItem {
  id: string;
  kind: MemoryKind;
  text: string;
  /** When it was forgotten; UNDO works until a day after. */
  gone: number;
  /** FORGET EVERYTHING: how many facts went at once. */
  count?: number;
}

/** Something Ghosty noticed over time, worked out from what is stored (never made up), with how often it was seen. */
export interface MemoryPattern {
  id: string;
  kind: 'time' | 'day' | 'topic' | 'mood' | 'theme';
  text: string;
  /** How many times (messages, days or memories: `unit`) back it up. */
  evidence: number;
  unit: string;
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
  /** How Ghosty talks (SETTINGS → CHARACTER: how dry, how brief, how warm; persona.ts). Missing: the default character. */
  persona?: PersonaSettings;
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
  /** Out-of-date lines and facts the reflection reworded or dropped (never a locked one). */
  revised?: { from: string; to: string }[];
  dropped?: string[];
  /** Changes the reflection asked for on locked memories, refused. */
  refused?: number;
  /** The consolidation (memories.ts): facts heard again, trivia let go, days of the day log folded into the diary. */
  heard?: number;
  faded?: number;
  folded?: number;
  /** One line of what changed about him today (from the lines reworded or dropped), written into the diary. */
  changed?: string;
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
  /**
   * 'site': a website built on Ghosty's own (sitebuild.ts runs its fixed steps); 'app': a mini-app (appbuild.ts: its
   * five steps run inside the build_app call, and a build cut short carries on from its record when resumed);
   * absent: steps run by the model with tools.
   */
  kind?: 'site' | 'app';
  /** The published link a mini-app build produced (the Workshop's OPEN and UNDO). */
  link?: string;
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
  /** A key pasted as several lines (DVSA's five): the System tab gives it a box this many lines tall. */
  lines?: number;
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
  /** What the brain can do with sound: hear (a Groq key or Workers AI) and speak with its own voice (Workers AI). */
  speech?: { stt: boolean; tts: boolean };
  /** How much free AI room each provider has (apps/edge/src/llm/quota.ts): the SYSTEM tab's gauge. */
  capacity?: AiCapacity;
  /** The brain's stopwatch (apps/edge/src/speed.ts): today's and last week's medians, in numbers and plain words, for the SPEED card. */
  speed?: SpeedSummary;
  /** His mood now (packages/shared/src/mood.ts): shown in words and a shape on the Me sheet's Status card. */
  mood?: Mood;
}

/** One provider's free allowance right now. */
export interface ProviderRoom {
  provider: string;
  /** ready: plenty of room; busy: over half of this minute's room used; full: none this minute; out: none until the day resets. */
  state: 'ready' | 'busy' | 'full' | 'out';
  /** Calls it can take this minute, and its per-minute allowance (null: not limited per minute). */
  roomNow: number | null;
  perMinute: number | null;
  /** Calls today, and the day's allowance (null: no daily cap). */
  usedToday: number;
  perDay: number | null;
  /** When the day's allowance resets (ms since the epoch); null for a rolling 24 hours. */
  resetAt: number | null;
  /** When room comes back while full or out (ms since the epoch). */
  backAt?: number;
  /** A provider limited model by model (each its own daily allowance): how many models, how many are out for today, and the most any one has left today. */
  models?: number;
  modelsOut?: number;
  dayLeft?: number;
  /** Only used for Ghosty's small jobs, never the owner's chat (Google Gemma). */
  smallOnly?: boolean;
}

export interface AiCapacity {
  /** One line, e.g. "Plenty of room · 9 providers ready". */
  summary: string;
  providers: ProviderRoom[];
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

/** The Telegram bot (LINKS → TELEGRAM, apps/edge/src/telegram.ts). The bot token never leaves the vault. */
export interface TelegramStatus {
  /** The token is saved and the bot's webhook points at Ghosty. */
  linked: boolean;
  /** The bot's username, without the @. */
  bot: string | null;
  /** A chat has sent the pairing code: Ghosty answers that chat alone. */
  paired: boolean;
  /** The owner's first name on Telegram. */
  name: string | null;
  /** The pairing code to send the bot, while it is valid (only before pairing). */
  code?: string;
  codeUntil?: number;
  /** The token is saved (even when the bot could not be connected, so the owner knows to save it again). */
  token?: boolean;
  /** The brain could not tell right now (database paused, no copy reachable); the last known answer stands. */
  unknown?: boolean;
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

/** An upgrade Ghosty proposed for itself (apps/edge/src/upgrades.ts; Workshop → UPGRADE IDEAS, GET /api/upgrades). */
export interface UpgradeIdea {
  id: string;
  title: string;
  /** What the owner gets. */
  why: string;
  /** Short concrete steps, each naming the files or tools. */
  steps: string[];
  /** When it was proposed. */
  at: number;
  /** A learning goal the owner asked for on ABILITIES ("Want me to learn it?" → YES): kept before Ghosty's own ideas. */
  from?: 'owner';
  /** His own words ("can you check my car's MOT?"). */
  ask?: string;
}

export interface JobInfo {
  id: string;
  kind: 'reminder' | 'task' | 'verify' | 'study' | 'reflect' | 'digest' | 'project' | 'upgrade' | 'revise';
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
  /** Which NOTIFICATIONS switch it falls under (apps/edge/src/notifyprefs.ts), when its sender gave one. */
  pushKind?: string;
  /** That switch was off when it came: listed in the Agenda inbox, but no alert. */
  quiet?: boolean;
  /** Its live card (a piece of the day, a reminder, a warning): the phone posts it in the chat and on Home's wall. */
  card?: Card;
}

export interface FeedInfo {
  id: string;
  name: string;
  at: number;
}

// ---- Public-transport journeys (apps/edge/src/integrations/transitous.ts; drawn by apps/web/src/ui/journeysheet.ts).

/** One place on a journey: a stop or station, an address, or any point. */
export interface JourneyPlace {
  name: string;
  lat: number;
  lon: number;
  /** The stop's id in the timetable, when it is a stop. */
  stopId?: string;
}

/** The kind of a leg, for its colour and icon; `kind` on the leg keeps the router's own word. */
export type JourneyMode = 'walk' | 'bus' | 'tram' | 'rail' | 'subway' | 'ferry' | 'other';

/** One leg of a journey — a walk, or one ride — compact enough to send to the phone and draw. */
export interface JourneyLeg {
  mode: JourneyMode;
  /** The router's own word for it (WALK, BUS, COACH, REGIONAL_RAIL…). */
  kind: string;
  /** The line's short name: "50", "X1", "WMR"; '' for a walk. */
  line: string;
  /** The operator's colour for the line ("#e07709"), or ''. */
  color: string;
  headsign: string;
  agency: string;
  from: JourneyPlace;
  to: JourneyPlace;
  /** Live times when the operator publishes them (`realTime`), else the timetable; ISO 8601. */
  start: string;
  end: string;
  scheduledStart: string;
  scheduledEnd: string;
  realTime: boolean;
  cancelled: boolean;
  /** Seconds. */
  duration: number;
  /** Metres, for a walk. */
  distance: number;
  /** The stand, bay or platform to board at, when known. */
  track: string;
  /** The stops ridden through, in order (not the one boarded at or the one to get off at). */
  stops: JourneyPlace[];
  /** The leg's shape as an encoded polyline with its precision (decimal digits), or '' when too long to send. */
  points: string;
  precision: number;
}

export interface Journey {
  id: string;
  start: string;
  end: string;
  /** Seconds, door to door. */
  duration: number;
  transfers: number;
  /** A walk all the way, no ride. */
  direct?: boolean;
  legs: JourneyLeg[];
}

/** The answer to GET /api/journey, and the payload of the show_journey command. */
export interface JourneyAnswer {
  from: JourneyPlace;
  to: JourneyPlace;
  /** The owner's time zone, which the clock times are shown in. */
  tz: string;
  /** Leaving at (or, with `arriveBy`, arriving by), ISO 8601. */
  time: string;
  arriveBy: boolean;
  itineraries: Journey[];
  /** Why the list is empty, in plain words. */
  note?: string;
}
