# The namer (Lens NAME mode)

Everything the Lens needs to name what the camera sees, served from this site and kept by the service
worker after the first use. Nothing here talks to the network on its own.

| File | What | Size |
| --- | --- | --- |
| `ort.wasm.min.mjs`, `ort-wasm-simd-threaded.mjs`, `ort-wasm-simd-threaded.wasm` | ONNX Runtime Web 1.30.0 (`npm pack onnxruntime-web@1.30.0`, `dist/`), WebAssembly only; MIT | 14.3 MB |
| `mobileclip_s0_vision_fp16.onnx` | MobileCLIP-S0 picture encoder from `Xenova/mobileclip_s0` (`onnx/vision_model_fp16.onnx`): input `pixel_values` 1×3×256×256 (RGB 0–1, no mean/std: `do_normalize` false in its `preprocessor_config.json`; shortest side to 256, centre 256), output `image_embeds` 1×512 | 22.9 MB |
| `core.labels.json` + `core.f16.bin` | 4,624 names × 512 half floats (little-endian), each row length 1 | 4.8 MB |
| `extended.labels.json` + `extended.i8.bin` | 28,223 names: 28,223 float32 scales, then 28,223 × 512 int8 (value = int8 × the row's scale) | 14.9 MB |

Why the half-float encoder and not the 11.8 MB `vision_model_quantized.onnx`: checked on 2026-10-17 with
four photos, both 8-bit versions (`_quantized`/`_uint8` and `_int8`) give meaningless names under ONNX
Runtime Web's WebAssembly backend (a banana came out as "lego", a cat as "wicker"); the half-float and
full-float versions agree with each other and get them right (banana 100 %, bicycle 69 %, apple 60 %,
lemon 96 %). The full-float file (45.5 MB) is over Cloudflare's 25 MiB per-file limit.

How the names were made (outside this repository, with `@huggingface/transformers` 4.3.1 in Node): the
vocabulary is WordNet 3.1 nouns under "physical object", "food" and "body part" (people and places
removed; only the generic words person, man, woman, child, baby, boy, girl, crowd, face, hand kept), plus
the LVIS, Open Images and ImageNet-21k class names; the core set is the everyday subset. Each name went
through MobileCLIP-S0's text encoder (`text_model_quantized.onnx`) as "a photo of a {name}.", and the
vector was scaled to length 1 and stored as half floats; `extended.i8.bin` is the full set re-packed as
int8 with one scale per row (`quantizeI8` in `src/vision/clipmath.ts`; the top names match the half-float
set). The phone scales the picture vector to length 1, takes the cosine with every name and turns the
scores into shares with CLIP's scale of 100.

Licences: `LICENSE-onnxruntime.txt` (MIT), `LICENSE-mobileclip.txt` (the notice in Xenova/mobileclip_s0),
`LICENSE-mobileclip-weights.txt` (Apple Machine Learning Research Model licence: research and
non-commercial use only — see `../VISION.md`).
