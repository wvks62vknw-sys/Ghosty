# THE APP KIT: building an app in Ghosty

Every app in Ghosty is built from one frame, `apps/web/src/ui/appkit.ts`, so that a hundred apps feel made by one company. Its
styles are the "THE APP KIT" block in `apps/web/styles.css`: every class starts `ak-` and every colour is a world token. That
keeps it right in all seven looks without a rule of its own per look.

## What one call gives an app

`app(root, spec)` builds the whole frame into `root` and returns the app's handle (`KitApp`):

| Part | What he sees | In the code |
|---|---|---|
| Header | the app's own icon and name, a search key, a settings key | `spec.glyph`, `spec.name` |
| One scroll area | only the list scrolls; the page never scrolls, sideways or twice | `k.body` |
| Keys at the bottom | the app's own keys, then Undo and Redo, in thumb reach | `spec.actions` |
| Notices | small, in one place right under the header, gone after 4 s or with a tap; never mid-screen | `k.notice(words)` |
| First run | the sample data and a three-step tour, never an empty grey screen | `spec.sample`, `spec.tour` |
| Search | filters as he types, with its own "No items match…" words and CLEAR SEARCH | built in |
| Undo and redo | every change (add, change, delete, restore), 50 steps | `k.add`, `k.update`, `k.remove` |
| Recently deleted | every delete is kept (the last 30), put back from Settings | `k.bin()`, `k.restore(id)` |
| States | loading (skeleton rows, so nothing jumps), empty (what to do), error (and its fix key) | `k.state(kind, words, fix)` |
| Share and export | CSV and JSON, through the phone's Share sheet where it has one, otherwise saved on the phone | `k.share('csv')`, `k.exportAs` |
| Settings | the app's switches, its exports and Recently deleted, in a sheet from the bottom | `spec.settings`, `k.setting(id)` |
| Home card | the app's widget-sized summary: icon, name and one line | `homeCard({ name, glyph, line, onTap })` |
| A list row | title, a line under it, a number on the right, a delete key; 44 pt at least | `listRow(item, { onTap, onDelete })` |

**Kept on the phone:** an app's things live in localStorage under `ghosty.app.<id>`. Nothing goes off the phone. Share is only ever
his tap, and he picks where the file goes.

## A whole app in thirty lines

`kitDemo()` at the end of `appkit.ts` is the worked example, a packing list:

```ts
import { app, KIT_ICONS } from '../../ui/appkit';

const k = app(root, {
  id: 'packing',                         // kept at ghosty.app.packing
  name: 'Packing',
  glyph: KIT_ICONS.list,
  noun: ['item', 'items'],               // the kit's words: "No items yet", "Search items"
  sample: [{ id: 's1', title: 'Passport', sub: 'Documents', meta: '1' }],
  tour: ['These are sample items.', 'Tap ✕ to delete one: Undo puts it back.', 'Settings has export.'],
  settings: [{ id: 'done', label: 'Show packed items', on: true }],
  actions: [{ word: 'Add', glyph: KIT_ICONS.plus, run: (k) => k.add({ id: crypto.randomUUID(), title: 'New item' }) }],
  open: (item, k) => k.update(item.id, { meta: 'packed' }),
});
```

To try it on the phone: open the console and run `__ghosty.appkit.demo()`.

## The rules the kit keeps for you (the APPS-ROUND quality bar)
- **One scroll area per screen (bar 4):** `.ak-app` is a column that never scrolls. Only `.ak-body` does, with `overscroll-behavior: contain`.
- **Notices never jump out of nowhere (bar 5):** `k.notice` is the one place. Don't use a mid-screen `toast` inside a kit app.
- **Every state in plain words (bar 6):** say what happened and what to do ("Could not read the list. Try again." with TRY AGAIN).
- **Undo, redo and Recently deleted (bar 7):** change things only through `k.add`, `k.update` and `k.remove`, and you get all three.
- **Touch-first (bar 12):** every kit key is 44 pt, and the app's keys sit at the bottom.
- **Every look (bar 13):** the spec checks all seven looks at 440 and 390.

## Checked by
`tests/appkit.spec.mjs` (spec word `appkit`). It drives `kitDemo()` through:
- the first run, its tour and search;
- a delete, its notice, undo, redo and Recently deleted;
- settings and the exports;
- the three states, and a reload.

Then, in all seven looks at 440 and 390, it checks:
- one scroll area;
- nothing sideways;
- no word under a key;
- every key 44 pt;
- the keys at the bottom.
