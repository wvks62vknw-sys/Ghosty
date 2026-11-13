# The cut-out model (PHOTO · SUBJECT)

Cuts the subject of a photo out from its ground as a soft mask, on the phone. Served from this site and kept by the
phone on the owner's tap (offline packs). Nothing here talks to the network on its own, and a photo never leaves the phone.

| File | What | Size |
| --- | --- | --- |
| `worker.mjs` | ours: the worker the runtime and the model run in (`src/photo/matting.ts` talks to it with two plain messages, `load` and `run`; shared with the erase model's worker in shape). It uses the ONNX Runtime Web 1.30.0 copy in `../clip` (MIT, `../clip/LICENSE-onnxruntime.txt`) | 2 KB |
| `cutout.v1.onnx` | **U²-Net-P** ("U-2-Netp", the small build of U²-Net, 1.1 M parameters), the ONNX export used by rembg, from `BritishWerewolf/U-2-Netp` on Hugging Face (`onnx/model.onnx`, unchanged). Input `input.1` 1×3×320×320 (RGB 0–1, ImageNet mean 0.485 0.456 0.406 and std 0.229 0.224 0.225), seven outputs 1×1×320×320 sigmoid maps; the app uses the first (the fused one) and stretches it to 0–1 | 4.6 MB (4,574,861 bytes) |

SHA-256: `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`.

The `v1` in the name is the model's version: the service worker keeps files by address, so a new model must get a new name.

Licence: the U²-Net code and weights are Apache-2.0 (`LICENSE.txt`, the upstream `xuebinqin/U-2-Net` LICENSE; the model card of the
export says "licensed under the Apache License 2.0 to match the original U-2-Net model"). U²-Net: Xuebin Qin, Zichen Zhang, Chenyang Huang,
Masood Dehghan, Osmar R. Zaiane and Martin Jagersand, "U²-Net: Going Deeper with Nested U-Structure for Salient Object Detection",
Pattern Recognition 106 (2020).

What it is, plainly: a salient-object model. It picks out what stands out (a mug on a table, a person, a bicycle), not a named thing, and it
finds no face and names nothing. Its mask is soft and 320×320; the app upsamples it to the photo's size along the photo's own edges.
