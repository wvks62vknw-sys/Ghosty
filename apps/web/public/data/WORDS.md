# words-en.dawg

The word list of the game WORDS (BRIEF-GAMES-6).

- **What:** ENABLE ("Enhanced North American Benchmark Lexicon", the enable1 list): English words only, no definitions, no proper nouns.
- **Source:** the copy at github.com/dolph/dictionary (enable1.txt), 172,823 words, 1,743,363 bytes as text.
- **Terms:** released to the public domain by its compilers; no conditions.
- **Made by:** `node tools/pack-words.mjs enable1.txt apps/web/public/data/words-en.dawg` (words of 2 to 15 letters only, the longest the board holds: 168,551 of them), a minimal DAWG at three bytes an edge, 361,924 bytes in all.
- **Used:** not bundled (it is over 300 KB packed). WORDS asks for it on his tap, on Wi-Fi, with its size said first, keeps it on the phone (Cache Storage `ghosty-words-v1`) and can remove it. Nothing fetches it otherwise, and the service worker does not.
