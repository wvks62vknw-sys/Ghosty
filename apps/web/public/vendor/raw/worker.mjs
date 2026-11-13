// Ghosty's RAW reader: LibRaw 0.22.1 as WebAssembly (./libraw.wasm and its glue ./libraw.mjs, unchanged, see README.md) run here, in its
// own thread, so that putting it away can end this worker and give the WebAssembly memory back. The page talks to it (src/photo/raw.ts):
//   { id, op: 'read', bytes: ArrayBuffer, half?: boolean }
//        -> { id, t: 'done', w, h, colors, bits, data: Uint16Array (w*h*colors, interleaved, 16 bits, sRGB-encoded, the camera's own
//           white balance, demosaiced by LibRaw, turned the right way up), half: boolean, make, model }
// Every answer carries the request's id; a file that cannot be read answers { id, t: 'error', code, message }.
// The whole file is read here in memory; nothing is fetched and nothing is written anywhere.
import init from './libraw.mjs';

let M = null;
const post = (m, transfer) => self.postMessage(m, transfer || []);
const cstr = (p) => {
  if (!p) return '';
  const h = M.HEAPU8;
  let e = p;
  while (h[e] && e - p < 400) e++;
  return new TextDecoder().decode(h.subarray(p, e));
};

self.onmessage = async (ev) => {
  const m = ev.data || {};
  let lr = 0;
  let input = 0;
  try {
    if (m.op !== 'read') throw Object.assign(new Error('unknown request'), { code: 0 });
    M ??= await init();
    const bytes = new Uint8Array(m.bytes);
    if (!bytes.byteLength) throw Object.assign(new Error('empty file'), { code: -1 });
    lr = M._libraw_init(0);
    input = M._malloc(bytes.byteLength);
    if (!input) throw Object.assign(new Error('no room for the file'), { code: -100007 });
    M.HEAPU8.set(bytes, input);
    const check = (code) => {
      if (code) throw Object.assign(new Error(cstr(M._libraw_strerror(code)) || 'could not read the file'), { code });
    };
    check(M._libraw_open_buffer(lr, input, bytes.byteLength));
    const rw = M._libraw_get_raw_width(lr);
    const rh = M._libraw_get_raw_height(lr);
    // a very large sensor is read at half size (a quarter of the pixels): the phone's memory is the limit
    const half = m.half === true || rw * rh > 40e6;
    M._libraw_set_output_bps(lr, 16);
    M._libraw_set_use_camera_wb(lr, 1);
    M._libraw_set_no_auto_bright(lr, 1);
    M._libraw_set_output_color(lr, 1);
    M._libraw_set_half_size(lr, half ? 1 : 0);
    check(M._libraw_unpack(lr));
    check(M._libraw_dcraw_process(lr));
    const err = M._malloc(4);
    const img = M._libraw_dcraw_make_mem_image(lr, err);
    const code = new Int32Array(M.HEAPU8.buffer, err, 1)[0];
    M._free(err);
    if (!img) check(code || -1);
    const dv = new DataView(M.HEAPU8.buffer, img, 16);
    const height = dv.getUint16(4, true);
    const width = dv.getUint16(6, true);
    const colors = dv.getUint16(8, true);
    const bits = dv.getUint16(10, true);
    const size = dv.getUint32(12, true);
    if (bits !== 16 || size !== width * height * colors * 2) {
      M._libraw_dcraw_clear_mem(img);
      throw Object.assign(new Error('the picture came out in a shape I do not expect'), { code: -2 });
    }
    const data = new Uint16Array(width * height * colors);
    data.set(new Uint16Array(M.HEAPU8.buffer, img + 16, width * height * colors));
    M._libraw_dcraw_clear_mem(img);
    const ip = M._libraw_get_iparams(lr);
    // libraw_iparams_t: a 4-byte guard, then the make and the model, 64 bytes each
    const make = cstr(ip + 4);
    const model = cstr(ip + 68);
    post({ id: m.id, t: 'done', w: width, h: height, colors, bits, data, half, make, model }, [data.buffer]);
  } catch (e) {
    post({ id: m.id, t: 'error', code: e && e.code != null ? e.code : 0, message: String((e && e.message) || e).slice(0, 300) });
  } finally {
    try {
      if (lr) {
        M._libraw_recycle(lr);
        M._libraw_close(lr);
      }
      if (input) M._free(input);
    } catch {
      /* the worker is put away after a read anyway */
    }
  }
};
