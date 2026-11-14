/**
 * QUIZ (the multiple-choice round genre). Options the board reads from GameConfig.options:
 *   questions: string[] (each "Question | right answer | wrong | wrong | wrong", 2 to 4 wrong answers;
 *              default a built-in round of plain general-knowledge facts)
 *   count:     number (questions a round, 3 to 20, default 10)
 *   secs:      number (seconds for each question, 0 for no clock, default 15)
 * The choices are shuffled each time. Ten points a right answer, plus the seconds left when there is a clock.
 */
import { type Rng, shuffle } from './rng';

export interface Question {
  q: string;
  right: string;
  choices: string[];
}

/** Plain facts, each checkable in any encyclopaedia. */
export const BUILT_IN = [
  'How many sides does a hexagon have? | 6 | 5 | 7 | 8',
  'What is the chemical symbol for gold? | Au | Ag | Gd | Go',
  'Which planet is closest to the Sun? | Mercury | Venus | Mars | Earth',
  'How many minutes are in a day? | 1,440 | 1,240 | 1,400 | 1,640',
  'What is the largest ocean on Earth? | Pacific | Atlantic | Indian | Arctic',
  'At sea level, water boils at what temperature? | 100 °C | 90 °C | 110 °C | 120 °C',
  'How many bones are in the adult human body? | 206 | 186 | 212 | 230',
  'What gas do plants take in for photosynthesis? | Carbon dioxide | Oxygen | Nitrogen | Hydrogen',
  'How many players are on a football team on the pitch? | 11 | 10 | 9 | 12',
  'Which is the longest river in the world by most measures? | Nile | Amazon | Yangtze | Danube',
  'What is the square root of 144? | 12 | 14 | 11 | 16',
  'Which continent is the Sahara Desert on? | Africa | Asia | Australia | South America',
  'How many days are in a leap year? | 366 | 365 | 364 | 367',
  'What is the freezing point of water in Fahrenheit? | 32 °F | 0 °F | 16 °F | 40 °F',
  'Which planet is known for its large ring system? | Saturn | Neptune | Mars | Mercury',
];

export function parse(lines: readonly string[]): Question[] {
  const out: Question[] = [];
  for (const line of lines) {
    const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3 && parts.length <= 6) out.push({ q: parts[0]!, right: parts[1]!, choices: parts.slice(1) });
  }
  return out;
}

/** A round: `count` questions in a shuffled order, each with its choices shuffled. */
export function round(lines: readonly string[], count: number, r: Rng): Question[] {
  const qs = parse(lines.length ? lines : BUILT_IN);
  return shuffle(r, qs).slice(0, count).map((q) => ({ ...q, choices: shuffle(r, q.choices) }));
}

export const points = (right: boolean, secsLeft: number): number => (right ? 10 + Math.max(0, Math.round(secsLeft)) : 0);
