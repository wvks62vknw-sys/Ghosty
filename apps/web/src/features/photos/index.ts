/**
 * PHOTOS (THE APPS ROUND, lane LENS: the flagship): his own private photo library, behind the photo editor, kept on this phone.
 *
 * - LIBRARY: every photo and video by month, newest first; ADD PHOTOS brings them in from the phone's photo picker (or the Share
 *   sheet), each kept exactly as it came, the storage used said.
 * - ALBUMS: Favourites, Videos, Duplicates (the best shot suggested), People (only him and the people he introduced), Hidden,
 *   Recently deleted (30 days) and his own albums.
 * - FOR YOU: On this day, and memories (a day or a trip) played as a short film with a soft score, made when he taps.
 * - SEARCH: by what is in a photo ("dog on a beach": the names the Lens's namer gave it on this phone), by date ("last summer",
 *   "march 2025"), by kind ("videos", "favourites") and by file or album name. All on the phone.
 * - A photo opens full screen: FAVOURITE, EDIT (into PHOTO), ALBUM, SHARE, HIDE, DELETE (UNDO), INFO (when, its size, and where
 *   when the camera wrote it: shown to him, never sent).
 *
 * Nothing in the library leaves the phone. The state a spec reads is window.__ghosty.photos.
 */
import type { TabDef, TabInstance } from '../../shell/tabs';
import { h } from '../../core/dom';
import { button, confirmSheet, modal, toast, undo } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { byMonth, bin, clock, duplicateGroups, libraryLine, matches, memories, onThisDay, parseQuery, placesOf, visible, type Item } from '../../photos/pure';
import * as L from '../../photos/lib';

type View = 'library' | 'albums' | 'foryou' | 'search';
type Sub = '' | 'favourites' | 'videos' | 'duplicates' | 'people' | 'places' | `place:${string}` | 'hidden' | 'deleted' | `album:${string}` | `memory:${string}` | `year:${number}`;

/** What a spec reads. */
export const photosState = {
  view: 'library' as View,
  sub: '' as string,
  state: 'loading' as 'loading' | 'empty' | 'ready' | 'error',
  line: '',
  count: 0,
  shown: [] as string[],
  selecting: false,
  selected: [] as string[],
  viewer: '' as string,
  search: { q: '', results: 0, naming: '' as '' | 'none' | 'needs' | 'ready' | 'working' | 'done', reading: '' as '' | 'needs' | 'working' | 'done' },
  albums: [] as { id: string; name: string; count: number }[],
  dupes: 0,
  deleted: 0,
  memories: [] as string[],
  playing: '' as string,
  said: '',
};

let summary = '';
/** Open PHOTOS (on a view, or with a search already typed). */
export async function openPhotos(o: { view?: View; q?: string } = {}): Promise<void> {
  pendingOpen = o;
  const { go } = await import('../../shell/tabs');
  if (!go('photos')) return;
  if (liveOpen) liveOpen(o);
}
let pendingOpen: { view?: View; q?: string } | null = null;
let liveOpen: ((o: { view?: View; q?: string }) => void) | null = null;

const urls = new Map<string, string>();
async function thumbUrl(id: string): Promise<string> {
  const u = urls.get(id);
  if (u) return u;
  const b = await L.thumbOf(id);
  if (!b) return '';
  const nu = URL.createObjectURL(b);
  urls.set(id, nu);
  return nu;
}

const say = (words: string, kind: '' | 'ok' | 'warn' = 'ok') => {
  photosState.said = words;
  toast(words, kind);
};

export const photosTab: TabDef = {
  id: 'photos',
  title: 'PHOTOS',
  icon: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
  scene: 'backdrop',
  // behind the photo editor: a screen inside PHOTO (shell/rooms.ts), reached from PHOTO's shelf, the jump bar and his words
  inside: 'photo',
  blurb: 'your library · albums · search · memories · on this phone',
  now: () => summary,
  mount(root): TabInstance {
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    const attach = (tries = 0) => (w.__ghosty ? (w.__ghosty.photos = photosState) : tries < 150 && setTimeout(() => attach(tries + 1), 100));
    attach();

    let view: View = 'library';
    let sub: Sub = '';
    let list: Item[] = [];
    let albumNames: Record<string, string> = {};
    let query = '';
    const selected = new Set<string>();

    // ---- the frame: a title row with the storage line, the four views, the body, the bottom bar
    const line = h('p.phx-line', { role: 'status' }, 'Opening your library…');
    const segs = (['library', 'albums', 'foryou', 'search'] as View[]).map((v) =>
      h('button.phx-seg', { type: 'button', role: 'tab', dataset: { v, case: 'keep' }, onclick: () => go(v, '') }, { library: 'Library', albums: 'Albums', foryou: 'For You', search: 'Search' }[v]),
    );
    const segRow = h('div.phx-segs', { role: 'tablist', 'aria-label': 'Photos views' }, ...segs);
    const body = h('div.phx-body');
    const picker = h('input', { type: 'file', accept: 'image/*,video/*', multiple: true, hidden: true }) as HTMLInputElement;
    picker.addEventListener('change', () => {
      const files = [...(picker.files ?? [])];
      picker.value = '';
      if (files.length) void bringIn(files);
    });
    const addBtn = button('ADD PHOTOS', () => picker.click(), 'phx-add');
    addBtn.setAttribute('aria-label', 'Add photos and videos from your phone');
    const selBtn = button('SELECT', () => setSelecting(!photosState.selecting), 'phx-select');
    const moreBtn = button('MORE', () => void more(), 'phx-more');
    moreBtn.setAttribute('aria-label', 'Settings, storage, help and Ghosty for Photos');
    const selBar = h('div.phx-selbar', { hidden: true });
    const bar = h('div.phx-bar', addBtn, selBtn, moreBtn);
    const app = h('div.phx', h('div.phx-top', line, segRow), body, selBar, bar, picker);
    // one scroll area for the screen (as THE LOOK and the reader have): the bar sticks above the house
    root.append(h('div.hud.phxhud', app));

    // ---- MORE: settings with good defaults, storage, a short help page, and Ghosty about what is open
    const more = async () => {
      const set = photoSettings();
      const r = await L.room();
      const toggle = (label: string, k: keyof PhotoSettings, line: string) => {
        const b = h('button.phx-row', { type: 'button', role: 'switch', 'aria-checked': String(set[k]), dataset: { case: 'keep', set: k } }, h('span.phx-rowname', label), h('span.phx-rownote', set[k] ? 'On' : 'Off'));
        b.addEventListener('click', () => {
          set[k] = !set[k];
          savePhotoSettings(set);
          b.setAttribute('aria-checked', String(set[k]));
          b.querySelector('.phx-rownote')!.textContent = set[k] ? 'On' : 'Off';
        });
        return h('div', b, h('p.phx-small', line));
      };
      const used = `${libraryLine(list)}${r.quota ? ` · this phone lets the app keep up to about ${Math.round(r.quota / 1e9)} GB` : ''}`;
      const sheet = modal('PHOTOS', h('div.phx-sheet',
        h('h3.phx-h', 'Settings'),
        toggle('Name new photos on this phone', 'autoName', 'When the Lens’s namer is on this phone, each photo you add is named here so search finds what’s in it. Nothing is sent.'),
        toggle('Read words in new photos', 'autoRead', 'Each photo you add is read for words (a sign, a menu, a ticket) on this phone. Off by default: it takes a few seconds a photo.'),
        h('h3.phx-h', 'Storage'),
        h('p.phx-small', used),
        h('h3.phx-h', 'Help'),
        h('p.phx-small', 'ADD PHOTOS brings photos and videos in from your phone’s library; each is kept as it came, on this phone only. Tap one to see it full screen; SELECT to act on several. Deleted photos wait 30 days in Albums → Recently deleted. Search knows dates (“last summer”), kinds (“videos”) and, once named, what’s in a photo (“dog on a beach”). Where a photo was taken is shown to you and never sent.'),
        h('div.phx-keys',
          button('ASK GHOSTY', async () => {
            sheet.close();
            const { askInBox } = await import('../core/cards');
            askInBox(`About my photos (${libraryLine(list)}): `);
          }),
          ...(list.some((i) => i.sample) ? [button('REMOVE SAMPLES', async () => {
            sheet.close();
            const n = await L.removeSamples();
            say(`${n} sample photos removed.`);
          })] : []),
          button('DONE', () => sheet.close()),
        ),
      ));
    };

    // ---- bringing photos in
    const bringIn = async (files: File[]) => {
      line.textContent = `Bringing in ${files.length} ${files.length === 1 ? 'item' : 'items'}…`;
      const r = await L.bringInAll(files, (d, of) => (line.textContent = `Bringing in ${d} of ${of}…`));
      const n = r.added.length;
      say(n ? `${n} ${n === 1 ? 'item' : 'items'} in your library, kept on this phone.${r.failed.length ? ` ${r.failed.length} this phone could not read.` : ''}` : 'This phone could not read those. A JPEG, HEIC, PNG or a video works.', n ? 'ok' : 'warn');
      void draw();
      // his settings: new photos named (only when the namer is already on this phone: never a download by itself) and read
      const set = photoSettings();
      if (n && set.autoName) {
        const { eyesKept, EYES_NAMER } = await import('../../offline/eyes');
        if (eyesKept(EYES_NAMER.id)) void L.nameAll().catch(() => undefined);
      }
      if (n && set.autoRead) void L.readAllText().catch(() => undefined);
    };

    // ---- selection
    const setSelecting = (on: boolean) => {
      photosState.selecting = on;
      selected.clear();
      photosState.selected = [];
      (selBtn.querySelector('span') ?? selBtn).textContent = on ? 'CANCEL' : 'SELECT';
      drawSelBar();
      app.classList.toggle('phx-selecting', on);
      body.querySelectorAll('.phx-cell[aria-pressed="true"]').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    };
    const drawSelBar = () => {
      selBar.hidden = !photosState.selecting;
      if (!photosState.selecting) return;
      const ids = [...selected];
      const n = ids.length;
      const inBin = sub === 'deleted';
      selBar.replaceChildren(
        h('span.phx-selcount', n ? `${n} selected` : 'Tap photos to choose them'),
        ...(inBin
          ? [button('RECOVER', () => n && void act('recover', ids)), button('DELETE FOR GOOD', () => n && void act('forgood', ids))]
          : [button('FAVOURITE', () => n && void act('fav', ids)), button('ALBUM', () => n && void pickAlbum(ids)), button('SHARE', () => n && void shareMany(ids)), button(sub === 'hidden' ? 'UNHIDE' : 'HIDE', () => n && void act(sub === 'hidden' ? 'unhide' : 'hide', ids)), button('DELETE', () => n && void act('delete', ids))]),
      );
    };

    /** Several photos through the phone's Share sheet (saved to Photos, sent in a message: his choice there). */
    const shareMany = async (ids: string[]) => {
      const files: File[] = [];
      for (const i of ids.slice(0, 30)) {
        const it = list.find((x) => x.id === i);
        const b = it ? await L.blobOf(i) : null;
        if (it && b) files.push(new File([b], it.name, { type: it.type }));
      }
      try {
        if (files.length && navigator.canShare?.({ files })) await navigator.share({ files });
        else say('This phone has no share sheet here. Open a photo and hold it to save it.', 'warn');
      } catch {
        /* he closed the share sheet */
      }
    };

    // ---- the changes, each one with UNDO
    const act = async (what: 'fav' | 'unfav' | 'hide' | 'unhide' | 'delete' | 'recover' | 'forgood', ids: string[]) => {
      const n = ids.length;
      const things = `${n} ${n === 1 ? 'photo' : 'photos'}`;
      if (what === 'forgood') {
        if (!(await confirmSheet('Delete for good?', `${things} will be gone from this phone. This can’t be undone.`, 'DELETE FOR GOOD'))) return;
        for (const i of ids) await L.removeForGood(i, false);
        await L.update([], (x) => x);
        say(`${things} deleted for good.`);
      } else if (what === 'fav' || what === 'unfav') {
        const before = list.filter((i) => ids.includes(i.id)).map((i) => [i.id, i.fav] as const);
        const on = what === 'fav' ? !before.every(([, f]) => f) : false;
        await L.setFav(ids, on);
        undo(on ? `${things} in Favourites.` : `${things} out of Favourites.`, async () => {
          for (const [i, f] of before) await L.setFav([i], f);
        });
      } else if (what === 'hide' || what === 'unhide') {
        await L.setHidden(ids, what === 'hide');
        undo(what === 'hide' ? `${things} hidden. They’re in Albums → Hidden.` : `${things} back in your library.`, () => L.setHidden(ids, what !== 'hide'));
      } else if (what === 'delete') {
        await L.setDeleted(ids, true);
        undo(`${things} in Recently deleted for 30 days.`, () => L.setDeleted(ids, false));
      } else if (what === 'recover') {
        await L.setDeleted(ids, false);
        undo(`${things} back in your library.`, () => L.setDeleted(ids, true));
      }
      if (photosState.selecting) setSelecting(false);
    };

    const pickAlbum = async (ids: string[]) => {
      const as = await L.albums();
      const nameIn = h('input.phx-input', { type: 'text', placeholder: 'A new album’s name', maxlength: '60', 'aria-label': 'A new album’s name' }) as HTMLInputElement;
      const rows = as.map((a) => button(a.name, async () => {
        sheet.close();
        await L.addToAlbum(ids, a.id);
        undo(`In ${a.name}.`, () => L.removeFromAlbum(ids, a.id));
        if (photosState.selecting) setSelecting(false);
      }, 'phx-albumrow'));
      const make = button('NEW ALBUM', async () => {
        const name = nameIn.value.trim();
        if (!name) return void nameIn.focus();
        sheet.close();
        const a = await L.newAlbum(name);
        await L.addToAlbum(ids, a.id);
        say(`In ${a.name}, a new album.`);
        if (photosState.selecting) setSelecting(false);
      });
      const sheet = modal('ADD TO AN ALBUM', h('div.phx-sheet', ...(rows.length ? [h('div.phx-albumrows', ...rows)] : [h('p.phx-small', 'No albums yet: name your first one.')]), h('div.phx-newalbum', nameIn, make)));
    };

    // ---- the grid of thumbnails
    const cell = (it: Item, group: Item[]): HTMLElement => {
      const img = h('img.phx-img', { alt: it.labels.length ? `A photo: ${it.labels.slice(0, 3).join(', ')}` : it.kind === 'video' ? 'A video' : 'A photo', loading: 'lazy', decoding: 'async', draggable: false }) as HTMLImageElement;
      void thumbUrl(it.id).then((u) => u && (img.src = u));
      const c = h('button.phx-cell', { type: 'button', dataset: { id: it.id, case: 'keep' }, 'aria-pressed': 'false', 'aria-label': `${it.kind === 'video' ? 'Video' : 'Photo'}, ${new Date(it.taken).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}${it.fav ? ', a favourite' : ''}` },
        img,
        ...(it.kind === 'video' ? [h('span.phx-badge.phx-dur', clock(it.secs ?? 0))] : []),
        ...(it.fav ? [h('span.phx-badge.phx-fav', { 'aria-hidden': 'true' }, '♥')] : []),
        ...(it.sample ? [h('span.phx-badge.phx-sample', 'SAMPLE')] : []),
      );
      c.addEventListener('click', () => {
        if (photosState.selecting) {
          if (selected.has(it.id)) selected.delete(it.id);
          else selected.add(it.id);
          c.setAttribute('aria-pressed', String(selected.has(it.id)));
          photosState.selected = [...selected];
          drawSelBar();
          return;
        }
        openViewer(it.id, group.map((g) => g.id));
      });
      return c;
    };
    const grid = (items: Item[], group = items) => h('div.phx-grid', ...items.map((i) => cell(i, group)));
    const empty = (head: string, words: string, ...keys: HTMLElement[]) => h('div.phx-empty', { dataset: { state: 'empty' } }, h('p.phx-emptyhead', head), h('p.phx-small', words), ...(keys.length ? [h('div.phx-keys', ...keys)] : []));
    const backRow = (title: string, to: View, ...keys: HTMLElement[]) => h('div.phx-subhead', button('‹ BACK', () => go(to, ''), 'phx-back'), h('h3.phx-h', title), ...keys);

    // ---- the views
    const library = (): HTMLElement[] => {
      const live = visible(list);
      if (!live.length) {
        /* state: photos.library empty */
        return [empty('No photos yet', 'ADD PHOTOS brings photos and videos in from your phone’s library. They stay on this phone, and nothing is sent anywhere.', button('ADD PHOTOS', () => picker.click()))];
      }
      const months = byMonth(live);
      const out: HTMLElement[] = [];
      if (live.some((i) => i.sample)) out.push(h('div.phx-note', h('p.phx-small', 'These are sample photos drawn on this phone, so you can see how it all works. Add your own and remove these whenever you like.'), button('REMOVE SAMPLES', async () => {
        const n = await L.removeSamples();
        say(`${n} sample photos removed.`);
      })));
      // the viewer goes through them in the grid's own order (newest first), so → is always the next one along
      const ordered = months.flatMap((m) => m.items);
      for (const m of months) out.push(h('section.phx-month', h('h3.phx-h', m.title, h('span.phx-count', ` · ${m.items.length}`)), grid(m.items, ordered)));
      return out;
    };

    const tile = (title: string, n: number, cover: Item | undefined, onTap: () => void, note = ''): HTMLElement => {
      const img = h('img.phx-img', { alt: '', loading: 'lazy' }) as HTMLImageElement;
      if (cover) void thumbUrl(cover.id).then((u) => u && (img.src = u));
      const b = h('button.phx-tile', { type: 'button', dataset: { case: 'keep' }, 'aria-label': `${title}, ${n}` }, h('span.phx-cover', cover ? img : h('span.phx-coverempty', '')), h('span.phx-tilename', title), h('span.phx-tilecount', note || String(n)));
      b.addEventListener('click', onTap);
      return b;
    };

    const albumsView = async (): Promise<HTMLElement[]> => {
      const live = visible(list);
      const as = await L.albums();
      const dupes = duplicateGroups(list);
      const del = bin(list, Date.now()).waiting;
      photosState.dupes = dupes.length;
      photosState.deleted = del.length;
      photosState.albums = as.map((a) => ({ id: a.id, name: a.name, count: live.filter((i) => i.albums.includes(a.id)).length }));
      const favs = live.filter((i) => i.fav), vids = live.filter((i) => i.kind === 'video'), hid = visible(list, true);
      const mine = as.map((a) => {
        const inA = live.filter((i) => i.albums.includes(a.id));
        return tile(a.name, inA.length, inA[0], () => go('albums', `album:${a.id}`));
      });
      const newAlbum = h('button.phx-tile.phx-newtile', { type: 'button', dataset: { case: 'keep' }, 'aria-label': 'A new album' }, h('span.phx-cover', h('span.phx-plus', '+')), h('span.phx-tilename', 'New album'), h('span.phx-tilecount', ''));
      newAlbum.addEventListener('click', () => void askName('A NEW ALBUM', '', async (name) => {
        const a = await L.newAlbum(name);
        say(`${a.name} is ready. Select photos and tap ALBUM to fill it.`);
      }));
      return [
        h('h3.phx-h', 'My albums'),
        h('div.phx-tiles', tile('Favourites', favs.length, favs[0], () => go('albums', 'favourites')), ...mine, newAlbum),
        h('h3.phx-h', 'Media types and more'),
        h('div.phx-rows',
          row('Videos', String(vids.length), () => go('albums', 'videos')),
          row('Duplicates', dupes.length ? `${dupes.length} ${dupes.length === 1 ? 'group' : 'groups'}` : 'none', () => go('albums', 'duplicates')),
          row('People', 'you and who you introduced', () => go('albums', 'people')),
          row('Places', (() => {
            const n = placesOf(list).length;
            return n ? `${n} ${n === 1 ? 'place' : 'places'}` : 'none yet';
          })(), () => go('albums', 'places')),
          row('Hidden', hid.length ? String(hid.length) : 'none', () => go('albums', 'hidden')),
          row('Recently deleted', del.length ? String(del.length) : 'empty', () => go('albums', 'deleted')),
        ),
      ];
    };
    const row = (name: string, note: string, onTap: () => void) => {
      const b = h('button.phx-row', { type: 'button', dataset: { case: 'keep' } }, h('span.phx-rowname', name), h('span.phx-rownote', note), h('span.phx-chev', { 'aria-hidden': 'true' }, '›'));
      b.addEventListener('click', onTap);
      return b;
    };

    const askName = (title: string, now: string, then: (name: string) => Promise<void>) => {
      const nameIn = h('input.phx-input', { type: 'text', value: now, maxlength: '60', 'aria-label': 'The album’s name' }) as HTMLInputElement;
      const sheet = modal(title, h('div.phx-sheet', nameIn, h('div.phx-keys', button('KEEP', async () => {
        if (!nameIn.value.trim()) return void nameIn.focus();
        sheet.close();
        await then(nameIn.value.trim());
      }), button('CANCEL', () => sheet.close()))));
      setTimeout(() => nameIn.focus(), 60);
    };

    const subView = async (): Promise<HTMLElement[]> => {
      const live = visible(list);
      if (sub === 'favourites') {
        const f = live.filter((i) => i.fav);
        return [backRow('Favourites', 'albums'), f.length ? grid(f) : empty('No favourites yet', 'Tap ♥ on a photo and it shows here.')];
      }
      if (sub === 'videos') {
        const v = live.filter((i) => i.kind === 'video');
        return [backRow('Videos', 'albums'), v.length ? grid(v) : empty('No videos yet', 'ADD PHOTOS brings videos in too.')];
      }
      if (sub === 'hidden') {
        const hid = visible(list, true);
        return [backRow('Hidden', 'albums'), hid.length ? grid(hid) : empty('Nothing hidden', 'Hide a photo and it leaves the library and search, and waits here.')];
      }
      if (sub === 'deleted') {
        const waiting = bin(list, Date.now()).waiting;
        const emptyBtn = button('EMPTY', async () => {
          if (!(await confirmSheet('Empty Recently deleted?', `${waiting.length} ${waiting.length === 1 ? 'item' : 'items'} will be gone from this phone for good.`, 'EMPTY'))) return;
          const n = await L.emptyBin();
          say(`${n} deleted for good.`);
        });
        emptyBtn.disabled = !waiting.length;
        return [
          backRow('Recently deleted', 'albums', emptyBtn),
          waiting.length
            ? h('div', h('p.phx-small', 'Each waits 30 days, then goes for good. SELECT to recover some, or open one.'), h('div.phx-grid', ...waiting.map((it) => {
                const c = cell(it, waiting);
                c.append(h('span.phx-badge.phx-days', `${it.daysLeft} ${it.daysLeft === 1 ? 'day' : 'days'}`));
                return c;
              })))
            : empty('Nothing here', 'Deleted photos wait here for 30 days before they go for good.'),
        ];
      }
      if (sub === 'duplicates') {
        const groups = duplicateGroups(list);
        if (!groups.length) return [backRow('Duplicates', 'albums'), empty('No duplicates', 'When the same moment is kept twice, or nearly, the copies show here with the best shot first.')];
        return [
          backRow('Duplicates', 'albums', button('KEEP THE BEST OF ALL', async () => {
            const extra = groups.flatMap((g) => g.slice(1).map((x) => x.id));
            await L.setDeleted(extra, true);
            undo(`${extra.length} copies in Recently deleted; the best of each kept.`, () => L.setDeleted(extra, false));
          })),
          h('p.phx-small', 'The same moment kept more than once. The first of each is the best shot: the sharpest, then the biggest.'),
          ...groups.map((g) => h('section.phx-dupe', h('div.phx-grid', ...g.map((it, i) => {
            const c = cell(it, g);
            if (i === 0) c.append(h('span.phx-badge.phx-best', 'BEST'));
            return c;
          })), h('div.phx-keys', button('KEEP THE BEST', async () => {
            const extra = g.slice(1).map((x) => x.id);
            await L.setDeleted(extra, true);
            undo(`${extra.length} ${extra.length === 1 ? 'copy' : 'copies'} in Recently deleted.`, () => L.setDeleted(extra, false));
          })))),
        ];
      }
      if (sub === 'people') {
        // only him and the people he introduced, by the names he gave; everyone else stays "a person"
        let names: string[] = [];
        try {
          const { knownFaces } = await import('../../vision/facestore');
          names = (await knownFaces()).map((p) => (p.me ? `${p.name} (you)` : p.name)).filter(Boolean);
        } catch {
          names = [];
        }
        const withThem = (n: string) => live.filter((i) => (i.people ?? []).includes(n));
        return [
          backRow('People', 'albums'),
          h('p.phx-small', 'Only you and the people you’ve introduced, by the names you gave them. Open a photo and tap WHO’S IN IT to say who is in it. Faces in your photos are never scanned (the face finder looks only through the live camera), anyone else stays “a person”, and nobody is looked up.'),
          names.length
            ? h('div.phx-rows', ...names.map((n) => row(n, withThem(n).length ? String(withThem(n).length) : 'not in a photo yet', () => {
                query = n;
                go('search', '');
              })))
            : empty('Nobody introduced yet', 'Introduce yourself or someone you know in the Lens (FACES). Then WHO’S IN IT on a photo lets you say they’re in it, and search finds them by name.'),
        ];
      }
      if (sub === 'places') {
        // where his photos were taken, from their own data: grouped and named on the phone, never looked up, never sent
        const ps = placesOf(list);
        return [
          backRow('Places', 'albums'),
          h('p.phx-small', 'Where your photos were taken, from the photos’ own data. It stays on this phone: nothing is looked up or sent.'),
          ps.length ? h('div.phx-tiles', ...ps.map((p) => tile(p.title, p.items.length, p.items[0], () => go('albums', `place:${p.key}`)))) : empty('No places yet', 'Photos taken with location on in the camera show here by where they were taken.'),
        ];
      }
      if (sub.startsWith('place:')) {
        const p = placesOf(list).find((x) => `place:${x.key}` === sub);
        return [backRow(p ? p.title : 'Place', 'albums'), p ? grid(p.items) : empty('Nothing here now', 'Those photos may have been deleted or hidden.')];
      }
      if (sub.startsWith('album:')) {
        const aid = sub.slice(6);
        const a = (await L.albums()).find((x) => x.id === aid);
        if (!a) return [backRow('Album', 'albums'), empty('That album is gone', 'It was deleted. Its photos are still in your library.')];
        const inA = live.filter((i) => i.albums.includes(aid));
        return [
          backRow(a.name, 'albums', button('RENAME', () => askName('RENAME THE ALBUM', a.name, (n) => L.renameAlbum(aid, n))), button('DELETE ALBUM', async () => {
            if (!(await confirmSheet(`Delete ${a.name}?`, 'The album goes; its photos stay in your library.', 'DELETE ALBUM'))) return;
            await L.deleteAlbum(aid);
            go('albums', '');
          })),
          inA.length ? grid(inA) : empty('This album is empty', 'In the library, SELECT photos, then tap ALBUM.'),
        ];
      }
      if (sub.startsWith('memory:') || sub.startsWith('year:')) return forYouDetail();
      return [];
    };

    const forYou = (): HTMLElement[] => {
      const now = Date.now();
      const days = onThisDay(list, now);
      const ms = memories(list);
      photosState.memories = ms.map((m) => m.title);
      const out: HTMLElement[] = [];
      if (days.length) {
        out.push(h('h3.phx-h', 'On this day'), h('div.phx-tiles', ...days.map((d) => tile(`${new Date(now).getFullYear() - d.year === 1 ? 'A year ago' : `${new Date(now).getFullYear() - d.year} years ago`}`, d.items.length, d.items[0], () => go('foryou', `year:${d.year}`), String(d.year)))));
      }
      out.push(h('h3.phx-h', 'Memories'));
      if (!ms.length) {
        /* state: photos.foryou empty */
        out.push(empty('No memories yet', 'A day or a trip with four photos or more becomes a memory here: a short film, made when you tap.'));
      } else out.push(h('div.phx-tiles', ...ms.map((m) => tile(m.title, m.items.length, m.items[Math.floor(m.items.length / 2)], () => go('foryou', `memory:${m.id}`)))));
      return out;
    };
    const forYouDetail = (): HTMLElement[] => {
      if (sub.startsWith('year:')) {
        const y = Number(sub.slice(5));
        const d = onThisDay(list, Date.now()).find((x) => x.year === y);
        return [backRow(`On this day, ${y}`, 'foryou'), d ? grid(d.items) : empty('Nothing from that day', 'It may have been deleted.')];
      }
      const m = memories(list).find((x) => `memory:${x.id}` === sub);
      if (!m) return [backRow('Memory', 'foryou'), empty('That memory is gone', 'Its photos may have been deleted or hidden.')];
      return [backRow(m.title, 'foryou', button('PLAY', () => play(m.title, m.items.map((i) => i.id)), 'phx-play')), grid(m.items)];
    };

    const searchIn = h('input.phx-input.phx-search', { type: 'search', placeholder: 'Dog on a beach, last summer, videos…', 'aria-label': 'Search your photos', enterkeyhint: 'search', autocomplete: 'off' }) as HTMLInputElement;
    let searchTimer = 0;
    searchIn.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        query = searchIn.value;
        void drawSearchResults();
      }, 180);
    });
    const results = h('div.phx-results');
    const namingLine = h('div.phx-naming');
    const readingLine = h('div.phx-naming.phx-reading');
    const searchView = (): HTMLElement[] => {
      searchIn.value = query;
      void drawNaming();
      void drawSearchResults();
      const labels = new Map<string, number>();
      for (const i of visible(list)) for (const l of i.labels) labels.set(l, (labels.get(l) ?? 0) + 1);
      const chips = [...labels].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([l]) => button(l, () => {
        query = l;
        searchIn.value = l;
        void drawSearchResults();
      }, 'phx-chip'));
      drawReading();
      return [h('div.phx-searchrow', searchIn), ...(chips.length ? [h('div.phx-chips', ...chips)] : []), namingLine, readingLine, results];
    };
    const drawSearchResults = async () => {
      const q = parseQuery(query, Date.now());
      const live = visible(list);
      const found = query.trim() ? live.filter((i) => matches(i, q, albumNames)) : [];
      photosState.search.q = query;
      photosState.search.results = found.length;
      photosState.shown = found.map((i) => i.id);
      results.replaceChildren(
        ...(!query.trim()
          ? [h('p.phx-small', 'Search by what’s in a photo, a date, a place in your albums, or words in a file’s name. All on this phone.')]
          : found.length
            ? [h('p.phx-small', `${found.length} ${found.length === 1 ? 'result' : 'results'}`), grid(found)]
            : [empty(`Nothing for “${query.trim()}”`, live.some((i) => !i.labels.length && i.kind === 'photo') ? 'Some photos aren’t named yet. NAME MY PHOTOS below lets me find what’s in them.' : 'Try fewer words, or a month or a year.')]),
      );
    };
    const drawNaming = async () => {
      const unnamed = visible(list).filter((i) => i.kind === 'photo' && !i.labels.length).length;
      const { eyesKept, EYES_NAMER } = await import('../../offline/eyes');
      const { NAMER_SIZE } = await import('../../vision/clip');
      const kept = eyesKept(EYES_NAMER.id);
      photosState.search.naming = !unnamed ? 'done' : kept ? 'ready' : 'needs';
      if (!unnamed) return void namingLine.replaceChildren();
      const goName = button(kept ? 'NAME MY PHOTOS' : `GET THE NAMER · ${NAMER_SIZE}`, async (b) => {
        if (!kept) {
          const { onMobileData } = await import('../../wiki/store');
          // (the iPhone's browser cannot tell Wi-Fi from mobile data: there a second tap within 20 s is his yes, as learn/wifi.ts says)
          const { netUnknown, secondTap, unknownNet } = await import('../learn/wifi');
          if ((onMobileData() || netUnknown()) && !secondTap('photos:namer')) return void say(onMobileData() ? `The namer (${NAMER_SIZE}) waits for Wi-Fi: you’re on mobile data. Join Wi-Fi and tap again.` : unknownNet(NAMER_SIZE), 'warn');
        }
        b.disabled = true;
        photosState.search.naming = 'working';
        try {
          const r = await L.nameAll((d, of) => (namingLine.querySelector('.phx-small')!.textContent = `Naming ${d} of ${of} on this phone…`));
          photosState.search.naming = 'done';
          say(`${r.named} ${r.named === 1 ? 'photo' : 'photos'} named on this phone: search finds what’s in them now.`);
        } catch (e) {
          b.disabled = false;
          photosState.search.naming = kept ? 'ready' : 'needs';
          /* state: photos.search error */
          say(sayError(e, 'name your photos'), 'warn');
        }
      });
      namingLine.replaceChildren(h('p.phx-small', kept ? `${unnamed} ${unnamed === 1 ? 'photo isn’t' : 'photos aren’t'} named yet. NAME MY PHOTOS looks at each one on this phone, so search finds what’s in them. Nothing is sent.` : `To find what’s in your photos, I name each one on this phone with the Lens’s namer: a ${NAMER_SIZE} download, once, only on Wi-Fi, when you tap. Nothing of your photos is sent.`), goName);
    };

    /** The words in his photos, read on this phone with the Lens's reader, on his tap. */
    const drawReading = () => {
      const unread = visible(list).filter((i) => i.kind === 'photo' && !i.textRead).length;
      photosState.search.reading = unread ? 'needs' : 'done';
      if (!unread) return void readingLine.replaceChildren();
      const go = button('READ THE WORDS IN MY PHOTOS', async (b) => {
        b.disabled = true;
        photosState.search.reading = 'working';
        try {
          const r = await L.readAllText((d, of) => (readingLine.querySelector('.phx-small')!.textContent = `Reading ${d} of ${of} on this phone…`));
          photosState.search.reading = 'done';
          say(`${r.read} ${r.read === 1 ? 'photo' : 'photos'} read on this phone; ${r.withWords} had words in them. Search finds those words now.`);
        } catch (e) {
          b.disabled = false;
          photosState.search.reading = 'needs';
          say(sayError(e, 'read the words in your photos'), 'warn');
        }
      });
      readingLine.replaceChildren(h('p.phx-small', `${unread} ${unread === 1 ? 'photo hasn’t' : 'photos haven’t'} been read for words yet (a sign, a menu, a ticket). This reads them on this phone; nothing is sent.`), go);
    };

    /** Who is in a photo, as he says: only the people he introduced, by the names he gave; nobody is found or named for him. */
    const whoIsIn = async (it: Item) => {
      let names: string[] = [];
      try {
        const { knownFaces } = await import('../../vision/facestore');
        names = (await knownFaces()).map((p) => p.name).filter(Boolean);
      } catch {
        names = [];
      }
      if (!names.length) return void say('Only people you’ve introduced can be named here. Introduce yourself or someone in the Lens (FACES) first.', 'warn');
      const chosen = new Set(it.people ?? []);
      const rows = names.map((n) => {
        const b = h('button.phx-row', { type: 'button', role: 'checkbox', 'aria-checked': String(chosen.has(n)), dataset: { case: 'keep', name: n } }, h('span.phx-rowname', n), h('span.phx-chev', { 'aria-hidden': 'true' }, chosen.has(n) ? '✓' : ''));
        b.addEventListener('click', () => {
          if (chosen.has(n)) chosen.delete(n);
          else chosen.add(n);
          b.setAttribute('aria-checked', String(chosen.has(n)));
          b.querySelector('.phx-chev')!.textContent = chosen.has(n) ? '✓' : '';
        });
        return b;
      });
      const sheet = modal('WHO’S IN IT', h('div.phx-sheet', h('p.phx-small', 'Tick who is in this photo. Only people you’ve introduced are listed; anyone else stays “a person”.'), h('div.phx-rows', ...rows), h('div.phx-keys', button('KEEP', async () => {
        sheet.close();
        const before = it.people ?? [];
        await L.setPeople([it.id], [...chosen]);
        undo(chosen.size ? `In this photo: ${[...chosen].join(', ')}.` : 'Nobody named in this photo.', () => L.setPeople([it.id], before));
        await refresh();
        void drawViewer();
      }), button('CANCEL', () => sheet.close()))));
    };

    // ---- the viewer: one photo full screen, swipe or ‹ › for the next
    const viewer = h('div.phx-viewer', { hidden: true, role: 'dialog', 'aria-label': 'Photo' });
    document.body.append(viewer);
    let vIds: string[] = [];
    let vAt = 0;
    let vUrl = '';
    const closeViewer = () => {
      viewer.hidden = true;
      viewer.replaceChildren();
      photosState.viewer = '';
      if (vUrl) URL.revokeObjectURL(vUrl);
      vUrl = '';
      stopPlay();
    };
    const openViewer = (itemId: string, ids: string[]) => {
      vIds = ids;
      vAt = Math.max(0, ids.indexOf(itemId));
      viewer.hidden = false;
      void drawViewer();
    };
    const drawViewer = async () => {
      const itemId = vIds[vAt];
      const it = list.find((i) => i.id === itemId);
      if (!it) return closeViewer();
      photosState.viewer = it.id;
      const blob = await L.blobOf(it.id);
      if (vUrl) URL.revokeObjectURL(vUrl);
      vUrl = blob ? URL.createObjectURL(blob) : '';
      const media = it.kind === 'video' ? h('video.phx-media', { src: vUrl, controls: true, playsInline: true, preload: 'metadata' }) : h('img.phx-media', { src: vUrl, alt: it.labels.length ? `A photo: ${it.labels.join(', ')}` : 'A photo' });
      const when = new Date(it.taken);
      const head = h('div.phx-vtop',
        button('CLOSE', closeViewer, 'phx-vclose'),
        h('div.phx-vwhen', h('b', when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })), h('span', when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))),
        h('span.phx-vpos', `${vAt + 1} of ${vIds.length}`),
      );
      const inBin = !!it.deletedAt;
      const actions = inBin
        ? [button('RECOVER', async () => {
            await act('recover', [it.id]);
            closeViewer();
          }), button('DELETE FOR GOOD', async () => {
            await act('forgood', [it.id]);
            closeViewer();
          })]
        : [
            button(h('span', it.fav ? '♥ Favourite' : '♡ Favourite'), async () => {
              await act('fav', [it.id]);
              await refresh();
              void drawViewer();
            }, it.fav ? 'phx-on' : ''),
            ...(it.kind === 'photo' ? [button('EDIT', async () => {
              const b = await L.blobOf(it.id);
              if (!b) return;
              closeViewer();
              const { openPhotoEditor } = await import('../photo');
              await openPhotoEditor({ files: [new File([b], it.name, { type: it.type })] });
            })] : []),
            button('ALBUM', () => void pickAlbum([it.id])),
            ...(it.kind === 'photo' ? [button('WHO’S IN IT', () => void whoIsIn(it))] : []),
            button('SHARE', async () => {
              const b = await L.blobOf(it.id);
              if (!b) return;
              const f = new File([b], it.name, { type: it.type });
              try {
                if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f] });
                else say('This phone has no share sheet here. Hold the photo to save it.', 'warn');
              } catch {
                /* he closed the share sheet */
              }
            }),
            button(it.hidden ? 'UNHIDE' : 'HIDE', async () => {
              await act(it.hidden ? 'unhide' : 'hide', [it.id]);
              closeViewer();
            }),
            button('DELETE', async () => {
              await act('delete', [it.id]);
              closeViewer();
            }),
            button('INFO', () => info(it)),
          ];
      const prev = button('‹', () => step(-1), 'phx-vprev');
      prev.setAttribute('aria-label', 'The one before');
      const next = button('›', () => step(1), 'phx-vnext');
      next.setAttribute('aria-label', 'The next one');
      prev.disabled = vAt === 0;
      next.disabled = vAt >= vIds.length - 1;
      const stage = h('div.phx-stage', media, prev, next);
      let x0 = -1;
      stage.addEventListener('pointerdown', (e) => (x0 = e.clientX));
      stage.addEventListener('pointerup', (e) => {
        if (x0 < 0) return;
        const dx = e.clientX - x0;
        x0 = -1;
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
      });
      viewer.replaceChildren(head, stage, h('div.phx-vbar', ...actions));
    };
    const step = (d: number) => {
      const n = vAt + d;
      if (n < 0 || n >= vIds.length) return;
      vAt = n;
      void drawViewer();
    };
    // a keyboard (an iPad's, a Mac's): the arrows go through the photos, Escape closes
    // (heard first, while the viewer is open: the shell's own keys do not move the screen under it)
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (viewer.hidden || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable))) return;
      if (e.key !== 'Escape' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') closeViewer();
      else step(e.key === 'ArrowRight' ? 1 : -1);
    }, true);
    const info = (it: Item) => {
      const rows: [string, string][] = [
        ['Taken', new Date(it.taken).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
        ['Size', `${it.w} × ${it.h} · ${(it.bytes / 1e6).toFixed(1)} MB`],
        ['File', it.name],
        ...(it.labels.length ? [['What I see', it.labels.join(', ')] as [string, string]] : []),
        ...(it.place ? [['Where', `${it.place.lat.toFixed(4)}, ${it.place.lon.toFixed(4)} (from the photo itself; kept on this phone, never sent)`] as [string, string]] : [['Where', 'The photo doesn’t say.'] as [string, string]]),
        ['Added', new Date(it.added).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
      ];
      modal('INFO', h('dl.phx-info', ...rows.flatMap(([k, v]) => [h('dt', k), h('dd', v)])));
    };

    // ---- a memory played: its photos one after another, slowly drifting, with a soft score made here (on his tap only)
    let playTimer = 0;
    let music: { stop(): void } | null = null;
    const stopPlay = () => {
      clearInterval(playTimer);
      playTimer = 0;
      music?.stop();
      music = null;
      photosState.playing = '';
      viewer.classList.remove('phx-playing');
    };
    const play = (title: string, ids: string[]) => {
      openViewer(ids[0]!, ids);
      photosState.playing = title;
      viewer.classList.add('phx-playing');
      music = softScore();
      playTimer = window.setInterval(() => {
        if (vAt >= vIds.length - 1) return stopPlay();
        step(1);
      }, 3200);
    };

    // ---- drawing
    const go = (v: View, s: Sub) => {
      view = v;
      sub = s;
      photosState.view = v;
      photosState.sub = s;
      if (photosState.selecting) setSelecting(false);
      void draw();
    };
    const refresh = async () => {
      list = await L.items();
      albumNames = Object.fromEntries((await L.albums()).map((a) => [a.id, a.name]));
    };
    let drawing = 0;
    const draw = async () => {
      const gen = ++drawing;
      segs.forEach((s) => {
        s.setAttribute('aria-selected', String(s.dataset.v === view));
        s.classList.toggle('on', s.dataset.v === view);
      });
      if (!list.length && photosState.state === 'loading') body.replaceChildren(h('div.phx-grid.phx-skeleton', { dataset: { state: 'loading' } }, ...Array.from({ length: 12 }, () => h('span.phx-cell.phx-ghost')))); /* state: photos.library loading */
      try {
        await refresh();
      } catch (e) {
        /* state: photos.library error */
        photosState.state = 'error';
        line.textContent = sayError(e, 'open your library');
        return;
      }
      if (gen !== drawing) return;
      const live = visible(list);
      photosState.count = live.length;
      photosState.state = live.length ? 'ready' : 'empty';
      line.textContent = L.libState.persistent ? libraryLine(list) : `${libraryLine(list)} · this window keeps nothing after you close it`;
      /* state: photos.library offline */
      if (navigator.onLine === false) line.textContent += ' · everything here works with no signal';
      photosState.line = line.textContent;
      summary = live.length ? libraryLine(list) : '';
      selBtn.hidden = !(view === 'library' || sub) || !live.length || view === 'search' || view === 'foryou' && !sub;
      const parts = sub && view !== 'search' ? await subView() : view === 'library' ? library() : view === 'albums' ? await albumsView() : view === 'foryou' ? forYou() : searchView();
      if (gen !== drawing) return;
      body.replaceChildren(...parts);
      if (view !== 'search') photosState.shown = [...body.querySelectorAll<HTMLElement>('.phx-cell[data-id]')].map((c) => c.dataset.id!);
    };

    L.onChange(() => void draw());
    liveOpen = (o) => {
      if (o.q != null) query = o.q;
      go(o.view ?? (o.q ? 'search' : view), '');
    };

    return {
      enter: async () => {
        const o = pendingOpen;
        pendingOpen = null;
        if (o?.q != null) query = o.q;
        if (o?.view || o?.q) {
          view = o.view ?? 'search';
          sub = '';
        }
        // the first run: sample photos drawn here, said to be samples, so the library is never an empty grey screen
        if (!L.samplesShown()) {
          L.markSamplesShown();
          await refresh();
          if (!list.length) {
            line.textContent = 'Setting out some sample photos…';
            await L.addSamples().catch(() => 0);
          }
        }
        await draw();
      },
      leave: () => {
        closeViewer();
        if (photosState.selecting) setSelecting(false);
      },
    } as TabInstance;
  },
};

/** His settings for Photos, kept on this phone (good defaults: name new photos when the namer is here; reading words is his choice). */
interface PhotoSettings {
  autoName: boolean;
  autoRead: boolean;
}
const SETTINGS_KEY = 'ghosty.photos.settings';
function photoSettings(): PhotoSettings {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<PhotoSettings>;
    return { autoName: v.autoName !== false, autoRead: v.autoRead === true };
  } catch {
    return { autoName: true, autoRead: false };
  }
}
function savePhotoSettings(s: PhotoSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* a private window: the defaults stand */
  }
}

/** A soft, slow score for a memory (two warm chords, made here with the phone's own sound), on his tap only; quiet and short. */
function softScore(): { stop(): void } {
  try {
    const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return { stop() {} };
    const ac = new Ctx();
    const master = ac.createGain();
    master.gain.value = 0.06;
    master.connect(ac.destination);
    const chords = [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]];
    let t = ac.currentTime + 0.05;
    for (let bar = 0; bar < 16; bar++) {
      for (const f of chords[bar % chords.length]!) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(1, t + 0.8);
        g.gain.linearRampToValueAtTime(0, t + 3.4);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 3.5);
      }
      t += 3.2;
    }
    return { stop: () => void ac.close().catch(() => undefined) };
  } catch {
    return { stop() {} };
  }
}
