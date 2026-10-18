# The depth model (Lens MEASURE · AUTO, and the SPACE PLANNER's FROM PHOTO)

For rooms, indoors, things 0.5–10 m away (it was trained on rendered indoor scenes, up to 20 m); MEASURE says so
when a photo looks outdoors or too close.

Everything MEASURE needs to tell how far away every pixel of a photo is, in metres, served from this site and
kept by the service worker after the first use. Nothing here talks to the network on its own.

| File | What | Size |
| --- | --- | --- |
| `worker.mjs` | ours: the worker the runtime and the model run in (`src/measure/depth.ts` talks to it with two plain messages, `load` and `run`); leaving MEASURE ends it, which is what gives the runtime's WebAssembly memory back. It uses the ONNX Runtime Web 1.30.0 copy in `../clip` (MIT, `../clip/LICENSE-onnxruntime.txt`) | 2 KB |
| `dav2-metric-indoor-small.v1.int8.onnx.part1`, `.part2` | Depth Anything V2 **Metric Indoor Small** (24.8 M parameters, fine-tuned on Hypersim for indoor metric depth, up to 20 m), one ONNX file cut in two because Cloudflare serves files up to 25 MiB; the worker joins them. Input `pixel_values` 1×3×H×W (H, W multiples of 14; RGB scaled 0–1 then ImageNet mean/std; the app gives it 392 px on the short side), output `predicted_depth` 1×H×W in metres | 35.6 MB |

The `v1` in the names is the model's version: the service worker keeps files by address, so a new model must get new
names to reach phones that already have this one. The first download is asked for with one tap (50 MB with the runtime).

SHA-256 of the joined file: `bcaad337599fd3948aa25316f9bcc2f1d4b863bb3c93e5e288b480e5ea038119`.

How it was made (outside this repository, 2026-10-18, PyTorch 2.14 CPU, transformers 5.20, onnxruntime 1.31):

1. `depth-anything/Depth-Anything-V2-Metric-Indoor-Small-hf` (`model.safetensors`) loaded with
   `AutoModelForDepthEstimation`, exported with `torch.onnx.export` (opset 17, H and W dynamic). The head's last
   resize was replaced by one sized from the input tensor's own shape: the library's version turns the size into
   plain numbers, which freezes every output at the export's 392 × 518. Checked against PyTorch at 392×518, 518×392
   and 266×350: largest difference 8 µm.
2. `onnxruntime.quantization.quantize_dynamic` on the `MatMul`s only (weights int8, activations quantised as it
   runs); the convolutions stay float32.

Why int8 (unlike the namer, `../clip/README.md`, where 8-bit gave nonsense under this runtime): checked under
ONNX Runtime Web itself, in this worker, on 60 real NYU Depth v2 photos with the Kinect's depth as the truth
(40 random pairs of points 20 cm or more apart per photo), it measures as well as the full-precision weights
(median length error 12.3 % against 12.2 %) and runs in 10.0 s instead of 12.8 s a photo (desktop Chromium, one
WebAssembly thread, a shared 2.1 GHz Xeon; Linux WebKit, Safari's engine, took 27.5 s on the same busy machine;
not yet timed on an iPhone, so the app says "about half a minute").

How good it is, plainly (split by scene, see `src/measure/depth3d.ts` `DEPTH_STATS`): median length error 12–14 %,
but about 1 in 10 measurements is off by around 40 %. Only one real camera (NYU's Kinect) was checked; the
iPhone's 0.5× and 3× lenses are untested on real photos.

Licences, plainly: the Depth Anything V2 code is Apache-2.0 (`LICENSE-depth-anything-v2.txt`), and its README says
"Depth-Anything-V2-Small model is under the Apache-2.0 license" (Base/Large are CC-BY-NC-4.0 and are not used). The
metric checkpoint used here (`depth-anything/Depth-Anything-V2-Metric-Indoor-Small-hf`) carries **no licence tag**
on Hugging Face, and it was fine-tuned on Hypersim, whose data is **CC BY-SA 3.0**. Treat it as the Small model's
Apache-2.0 with that open question noted; Ghosty is one person's private, non-commercial assistant. Depth Anything
V2: Lihe Yang, Bingyi Kang, Zilong Huang, Zhen Zhao, Xiaogang Xu, Jiashi Feng, Hengshuang Zhao (arXiv:2406.09414);
Hypersim: Mike Roberts et al. (Apple, arXiv:2011.02523).
