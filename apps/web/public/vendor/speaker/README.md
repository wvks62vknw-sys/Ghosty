# The voice model (SETTINGS → MY VOICE, PEOPLE I'VE INTRODUCED)

What tells voices apart on the phone: his own, and the voices of the people he introduces with them present. Served from this site,
fetched only on his tap on Wi-Fi as a pack (`src/offline/speakerpack.ts`) and kept in the phone's own cache; nothing here talks to
the network, and the numbers it makes leave the phone never (`src/assistant/speakermodel.ts`, `voicestore.ts`).

| File | What | Size |
| --- | --- | --- |
| `voice-model.onnx.part1`, `.part2` | The model in two parts, joined on the phone as the depth model's are (the host refuses a file over 25 MiB): `part1` is the first 24,900,000 bytes, `part2` the last 1,630,309; together byte for byte the original file. A speaker-verification network (a ResNet with 6.6 million weights, trained on 5,994 speakers to tell voices apart, large-margin fine-tuned). Input `feats` 1 × frames × 80 (the 80-band log filterbank of 25 ms frames every 10 ms, the mean taken off: `src/assistant/speakerfbank.ts`), output `embs` 1 × 256. Source: the WeSpeaker project (github.com/wenet-e2e/wespeaker), file `voxceleb_resnet34_LM.onnx` of `Wespeaker/wespeaker-voxceleb-resnet34-LM` on Hugging Face; paper arXiv:2210.17016. Licence: CC BY 4.0 (`LICENSE-voice-model.txt`), unchanged file. SHA-256 7bb2f06e…c068 | 24.9 MB + 1.6 MB |
| `worker.mjs` | ours: the worker the model runs in, on `../clip/`'s ONNX Runtime Web (one thread, WebAssembly); its address carries `?maxPages=` as the face worker's does | 3 KB |

Compared with a cosine score: the same voice on another day scores high (a published equal-error line near 0.3 to 0.4 on its test set),
another voice scores low. `src/assistant/speakerjudge.ts` keeps its own accept and reject lines and fails closed. A courtesy signal,
never a lock: a recording of him defeats any such model.
