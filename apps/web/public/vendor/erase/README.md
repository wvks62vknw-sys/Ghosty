# The erase model (PHOTO · ERASE)

Fills a part of a photo that was painted over (a mark, a wire, a passer-by) with what would have been there, on the phone. Served from
this site and kept by the phone on the owner's tap (offline packs). Nothing here talks to the network on its own, and a photo never leaves the phone.

| File | What | Size |
| --- | --- | --- |
| `worker.mjs` | ours: the worker the runtime and the model run in (`src/photo/inpaint.ts` talks to it with two plain messages, `load` and `run`). It uses the ONNX Runtime Web 1.30.0 copy in `../clip` (MIT, `../clip/LICENSE-onnxruntime.txt`) | 2 KB |
| `erase.v1.wq8.onnx.part1`, `.part2`, `.part3` | **big-lama** (LaMa, "Resolution-robust Large Mask Inpainting with Fourier Convolutions"), ONNX with int8 convolution weights, one file cut in three because Cloudflare serves files up to 25 MiB; the worker joins them. Inputs `image` 1×3×512×512 (RGB 0–1) and `mask` 1×1×512×512 (1 where to fill), output 1×3×512×512 in 0–255 (the app uses only what the mask covers, the rest is the photo's own pixels) | 55.7 MB (55,657,319 bytes: 24,900,000 + 24,900,000 + 5,857,319) |

SHA-256 of the joined file: `ecfb3169b5c31c9109d06da2e5ed8aebe5eb38e552117d56b1cc6ec0423c319f`.

How it was made (outside this repository, 2026-11-12, onnx 1.23, onnxruntime 1.29):

1. `Carve/LaMa-ONNX` on Hugging Face, `lama_fp32.onnx` (208,044,816 bytes, SHA-256 `1faef5301d78db7dda502fe59966957ec4b79dd64e16f03ed96913c7a4eb68d6`):
   a port of the original PyTorch big-lama with a custom exportable FourierUnit; fixed 512×512, opset 17; its card says the result is
   identical to the original. Apache-2.0.
2. Every `Conv` weight of 1,024 values or more was replaced by an int8 initializer with one scale per output channel
   (`q = round(w / scale)`, `scale = max|w| / 127`, per output channel) and a `DequantizeLinear` node in front of the convolution;
   nothing else changed. The runtime turns the weights back to float32 when it loads the model, so the arithmetic is the full-precision
   model's with weights held to 8 bits: the file shrinks to a quarter (203.6 MB of weights became 50.9 MB). The script:

   ```python
   import onnx, numpy as np, collections
   from onnx import numpy_helper, helper
   m = onnx.load('lama_fp32.onnx'); g = m.graph
   inits = {i.name: i for i in g.initializer}
   users = collections.defaultdict(list)
   for n in g.node:
       for i in n.input: users[i].append(n)
   new, drop, added = [], set(), []
   for n in g.node:
       if n.op_type in ('Conv', 'ConvTranspose') and len(n.input) > 1 and n.input[1] in inits:
           w = inits[n.input[1]]; a = numpy_helper.to_array(w)
           if a.size < 1024 or a.dtype != np.float32 or len(users[w.name]) != 1: continue
           ax = 0 if n.op_type == 'Conv' else 1
           red = tuple(i for i in range(a.ndim) if i != ax)
           sc = np.abs(a).max(axis=red, keepdims=True) / 127.0; sc[sc == 0] = 1.0
           q = np.clip(np.round(a / sc), -127, 127).astype(np.int8)
           added += [numpy_helper.from_array(q, w.name + '_q'), numpy_helper.from_array(sc.reshape(-1).astype(np.float32), w.name + '_s')]
           drop.add(w.name)
           new.append(helper.make_node('DequantizeLinear', [w.name + '_q', w.name + '_s'], [w.name + '_dq'], axis=ax, name=w.name + '_dql'))
           n.input[1] = w.name + '_dq'
   keep = [i for i in g.initializer if i.name not in drop]
   del g.initializer[:]; g.initializer.extend(keep + added)
   nodes = new + list(g.node); del g.node[:]; g.node.extend(nodes)
   onnx.save(m, 'lama_wq8.onnx')
   ```
3. Cut with `split -b 24900000` into the three parts (the worker joins them in order).

Why this and not a ready-made int8 file: the one found on Hugging Face (`benote93/mon-lama-int8`, 61.9 MB) has no card, no named source or
method, and a licence tag (MIT) that does not match the model it comes from; and it is wrong: its integer convolutions wreck LaMa's Fourier
units (on a test hole of 28 px on a textured gradient the filled colour was off by 121 of 255 on average). Checked here, under ONNX Runtime Web itself,
in this worker, on the same test (a 28 px dark disc on a textured gradient, 512×512, the filled part against the truth): the full-precision file
2.0 of 255, this file 2.4 of 255 (1.7 apart between the two inside the hole, 0.000004 outside it).

Licence: the LaMa code and weights are Apache-2.0 (`LICENSE.txt`, the upstream `advimman/lama` LICENSE; `Carve/LaMa-ONNX` is
tagged apache-2.0). LaMa: Roman Suvorov, Elizaveta Logacheva, Anton Mashikhin, Anastasia Remizova, Arsenii Ashukha, Aleksei Silvestrov,
Naejin Kong, Harshith Goka, Kiwoong Park, Victor Lempitsky (WACV 2022, arXiv:2109.07161). The big-lama weights were trained on Places2;
the trained weights are released with the code under the same licence.

What it is, plainly: it fills; it does not know what is under a thing. A small mark on a table, a wire across a sky or a bin in a lawn
usually comes out well; a hole across a face or text, or one over a lot of different things, comes out plausible rather than true. The app
says so, and BRAIN ERASE stays as the other way.
