/** THE COMIC's state, for the specs (window.__ghosty.comic) and for the screen's own sentence. */
export const comicState = {
  books: 0,
  made: 0,
  imported: 0,
  last: '',
  shelf: { state: '' as string, titles: [] as string[], log: { pages: 0, mins: 0, done: 0 } },
  import: { state: '' as string, words: '' },
  editing: { series: 1, translated: '', week: -1, by: '' as '' | 'brain' | 'phone', writing: false, undo: 0, redo: 0, dragged: 0, photo: false, boxes: [] as { id: string; x: number; y: number; w: number; h: number }[], id: '', title: '', pages: 0, page: 0, panel: -1, balloon: '', drawn: 0, panels: 0, balloons: 0, cast: [] as string[] },
  reader: { aloud: { on: false, said: '', who: '', lines: 0 }, marks: [] as number[], night: false, auto: 0, turned: 0, open: false, id: '', page: 0, panel: -1, guided: false, rtl: false, zoom: 1, spread: false, pages: 0, shown: [] as number[] },
  library: { state: '' as string, query: '', items: 0, got: '' },
  saved: { kind: '', name: '', bytes: 0, count: 0 },
  error: '',
};
