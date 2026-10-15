/**
 * TypeScript know-how for Ghosty's codebase (strict mode + noUncheckedIndexedAccess),
 * and a catalogue of the errors CI reports with their usual fixes.
 */
import type { Playbook } from './types';

export const TYPESCRIPT: Playbook[] = [
  {
    id: 'typescript-strict',
    title: 'TypeScript strict mode as used here (how to write code that typechecks first time)',
    tags: ['typescript', 'ts', 'types', 'strict', 'undefined', 'null', 'any', 'type', 'interface', 'generic'],
    body: 'Both apps compile with strict: true and noUncheckedIndexedAccess: true, isolatedModules: true. That means:\n\n' +
      '1. INDEXING MAY BE UNDEFINED. arr[0], arr[i], record[key], str.match(re)[1] all have type T | undefined.\n' +
      '   - Sure it exists?  arr[0]!            (non-null assertion)\n' +
      '   - Might not exist? arr[0] ?? fallback  or  arr[0]?.name\n' +
      '   - In loops prefer  for (const x of arr)  — x is T, not T | undefined.\n' +
      '   - Destructuring: const [a, b] = parts;  → a and b are string | undefined.\n\n' +
      '2. NULLABLE APIS. document.querySelector, storage.get, Array.find, Map.get, JSON fields, regex matches → check before use:\n' +
      '   const el = $(".x"); if (!el) return;      const m = s.match(/(\\d+)/); const n = m ? Number(m[1]) : 0;\n\n' +
      '3. NO IMPLICIT ANY. Parameters must have a type unless TS can infer it from context:\n' +
      '   pager(p, 44, (x: Item) => row(...))   // give x a type\n' +
      '   function f(a: string, n = 0): number { ... }\n' +
      '   Parsing JSON: const j = (await r.json()) as { items?: { id: string }[] };  then j.items ?? [].\n\n' +
      '4. catch (e) gives e: unknown. Use  String((e as Error)?.message ?? e).\n\n' +
      '5. TYPE-ONLY IMPORTS. Interfaces/types imported for types only: import type { Tool } from \'./types\';  or  import { h, type Child } from ...\n\n' +
      '6. UNION NARROWING. Use typeof / in / discriminant checks: if (typeof v === "string") ... ; if (ev.t === "text") ...\n\n' +
      '7. OBJECT LITERALS must match the declared type exactly: no extra properties on a typed object, all required fields present. Optional fields use ?: in the interface.\n\n' +
      '8. NUMBERS FROM STRINGS: Number(x) can be NaN; check Number.isFinite(n).\n\n' +
      '9. DOM TYPES. h(\'input\', {...}) returns HTMLInputElement, so .value works. event.target is EventTarget | null: cast (e.target as HTMLInputElement).value.\n\n' +
      '10. ASYNC. An async function returns a Promise; await it or mark it void when intentionally not awaited: void feed.refresh();  Never leave a floating promise that can reject unhandled.\n\n' +
      '11. CONST ASSERTIONS for fixed lists: const MODES = [\'a\', \'b\'] as const; type Mode = (typeof MODES)[number];\n\n' +
      '12. EXHAUSTIVE RECORDS: Record<Mode, string> must have every key.\n\n' +
      '13. Unused variables are allowed by the config, but delete them anyway — clean code.',
  },
  {
    id: 'ci-errors',
    title: 'Catalogue of CI errors and their usual fixes',
    tags: ['error', 'ts2304', 'ts2339', 'ts2532', 'ts2345', 'ts2307', 'ts7006', 'ts18048', 'typecheck', 'build', 'esbuild', 'pageerror', 'ci', 'fail', 'failed'],
    body: 'TYPECHECK (error TSxxxx: file(line,col): message)\n' +
      '- TS2304 Cannot find name \'X\' → X is not imported or not defined in this file. Add the import (check the exporting file really exports it) or define it.\n' +
      '- TS2305 Module has no exported member \'X\' → wrong name, or the file exports it under another name. repo_read the target file and use its real export.\n' +
      '- TS2307 Cannot find module \'./x\' → wrong relative path or the file does not exist. Count the ../ steps from the importing file\'s folder.\n' +
      '- TS2339 Property \'p\' does not exist on type T → misspelt property, wrong type, or the API doesn\'t have it. Read the type definition; do not guess.\n' +
      '- TS2532 / TS18048 Object is possibly \'undefined\' → noUncheckedIndexedAccess or an optional value. Use !, ?. or ?? (playbook typescript-strict, item 1).\n' +
      '- TS2531 / TS18047 Object is possibly \'null\' → check for null first (querySelector, storage, find).\n' +
      '- TS2345 Argument of type A is not assignable to parameter of type B → pass the right type; convert (String(x), Number(x)) or narrow first. Read the function signature.\n' +
      '- TS2322 Type A is not assignable to type B → same as above for variables/returns/object fields. Often a string where a union like \'ok\' | \'off\' is expected — use one of the allowed literals.\n' +
      '- TS2353 Object literal may only specify known properties → you added a property the type doesn\'t have. Remove it or extend the interface.\n' +
      '- TS2741 Property \'x\' is missing → add the required field.\n' +
      '- TS7006 Parameter \'x\' implicitly has an \'any\' type → annotate it: (x: Item) => ...\n' +
      '- TS2454 Variable used before being assigned → initialise it.\n' +
      '- TS2451 / TS2300 Cannot redeclare / Duplicate identifier → the same const/function is declared twice — usually an edit pasted code that already existed. Remove the duplicate.\n' +
      '- TS1005 \';\' expected / TS1128 Declaration or statement expected / TS1109 Expression expected → broken syntax: unbalanced brackets, a cut-off edit, or a replace that removed half a statement. Read the lines around the error on the branch.\n' +
      '- TS2554 Expected N arguments, but got M → read the function signature.\n' +
      '- TS2769 No overload matches this call → usually h() with a bad spec or props; or addEventListener with a wrong handler type.\n' +
      '- TS1484 X is a type and must be imported using a type-only import → use import type.\n\n' +
      'BUILD (esbuild)\n' +
      '- Could not resolve "./x" → missing file or wrong path (same as TS2307).\n' +
      '- Could not resolve "package" → npm packages are not available. Write the code yourself.\n' +
      '- Expected ")" but found ... / Unexpected "}" → syntax error at that line.\n\n' +
      'BROWSER CHECK (tests/*.spec.mjs)\n' +
      '- [tab] pageerror: X is not defined / Cannot read properties of undefined (reading \'y\') → your code throws at runtime when that tab opens. Look at mount() and anything that runs at import time. Guard missing data.\n' +
      '- console: ... → something logs console.error. Don\'t log errors for expected situations (offline feeds); show an empty state.\n' +
      '- layout: a panel cuts off / does not scroll → don\'t set fixed heights or overflow:hidden on columns; use the existing classes.\n\n' +
      'BRAIN TESTS (not ok N - name)\n' +
      '- Read the assertion: expected vs actual. A test that checks behaviour you intentionally changed must be updated in the same change. Otherwise your change broke something — fix the code, not the test.\n\n' +
      'SELF-CHECK (before the change is even created)\n' +
      '- It reports exact problems (missing import target, unbalanced bracket, code pasted twice, placeholder comments, declaring the same name twice). Nothing was saved — fix the edits and call propose_change/update_change again.',
  },
];
