/**
 * THE ONE SHARED MIND (OWNER-ISSUES 74): the shapes of the one picture of the owner and his day that every feature
 * reads (apps/edge/src/mind.ts builds it once per turn or alarm; GET /api/mind hands it to the phone), and of the
 * episodes every feature writes into the day log (`observe`).
 */

/** One thing in his day: a diary event, or a reminder or task still to go off. */
export interface DayLine {
  /** When it starts (ms); an all-day event: the start of its day. */
  at: number;
  /** "09:30", "All day", "Now" (on now); a later day's line: "Tue 08:00". */
  when: string;
  title: string;
  where?: string;
  /** An event's end (ms), so the phone can tell what is over by the time it shows it. */
  end?: number;
  allDay?: boolean;
  kind: 'event' | 'reminder';
  /** The calendar feed it came from: someone else's words (marked as data in the prompt). Unset: his own. */
  from?: string;
}

/** What an episode in the day log is about. */
export type EpisodeKind = 'turn' | 'tool' | 'game' | 'paper' | 'place' | 'built' | 'learned';

/** One thing that happened, in a line, with when (the day log: `mind:log`). */
export interface Episode {
  at: number;
  kind: EpisodeKind;
  /** One plain line, at most 140 characters. */
  text: string;
  /** Where it happened: "app", "telegram", "gym", "school", "library"… */
  via?: string;
}

export interface MindSnapshot {
  /** When it was built (ms). */
  at: number;
  owner: {
    name: string;
    /** The nightly reflection's one-line summary and his top profile lines. */
    summary: string;
    lines: string[];
    /** The facts he told Ghosty to remember, the most relied-on first. */
    facts: string[];
    /** Batch 2's standing rules and principles, when they are stored (read here, written there). */
    rules: string[];
    principles: string[];
    /** Batch 2's mood, when one is set and not over. */
    mood?: string;
  };
  now: {
    /** "2026-10-31T09:12", his local time. */
    iso: string;
    /** "Sat". */
    weekday: string;
    tz: string;
    /** "2026-10-31", his local day. */
    day: string;
    /** Where the phone says he is (his home setting unless it knows better), and which saved place that is. */
    where?: string;
    place?: string;
  };
  today: {
    day: string;
    /** What is left of today, in time order. */
    items: DayLine[];
    /** Nothing more today: the first thing after it. */
    next?: DayLine;
    /** What he is in the middle of, in a few words each: a paper being sat, the library's reading, a budget over. */
    doing: string[];
  };
  /** The latest episodes of the day log, newest last. */
  recent: Episode[];
  /** What is coming in the next six hours (from today and tomorrow). */
  ahead: DayLine[];
  /** The tool groups on for this turn. */
  can: string[];
}
