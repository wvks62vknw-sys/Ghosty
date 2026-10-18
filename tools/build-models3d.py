# Builds apps/web/public/data/models3d.json: the 3D STUDIO's catalogue of freely licensed models from
# Objaverse 1.0 (allenai/objaverse on Hugging Face: Sketchfab models released under Creative Commons,
# each with its own licence). Only CC0 and CC BY 4.0 models are kept (no NonCommercial, NoDerivatives
# or ShareAlike ones), only those the LVIS annotators put in one of 1,156 everyday categories, and only
# ones light enough for an iPhone (GLB at most MAX_MB, at most MAX_FACES faces, textures at most 2048 px).
# The best liked few per category are kept. Nothing is bundled: the phone fetches this index when the
# catalogue opens, and each model from Hugging Face only when it is opened.
#
# Run (needs ~600 MB of downloads, cached in the folder you pass):
#   curl -L -o <dir>/lvis.json.gz https://huggingface.co/datasets/allenai/objaverse/resolve/main/lvis-annotations.json.gz
#   curl -L -o <dir>/paths.json.gz https://huggingface.co/datasets/allenai/objaverse/resolve/main/object-paths.json.gz
#   for each shard 000-000 … 000-159: curl -L -o <dir>/meta-<shard>.json.gz …/metadata/<shard>.json.gz
#   python3 -I tools/build-models3d.py <dir> apps/web/public/data/models3d.json
import gzip, json, sys, re, os

PER_CAT = 10
MAX_MB = 12
MAX_FACES = 200_000
MAX_TEX = 2048
LICENCES = {'cc0': 0, 'by': 1}
# Brands and franchises are left out: a fan-made Pokémon or a modelled Gucci bag is licensed by its
# modeller, not by the owner of the name (the same list as BRANDS in packages/shared/src/models3d.ts).
BRANDS = re.compile(r"\b(?:lego|pok[eé]mon|pikachu|gucci|adidas|nike|fifa|minecraft|disney|pixar|marvel|star ?wars|nintendo|super ?mario|sonic the|batman|spider-?man|coca-?cola|pepsi|starbucks|mcdonald'?s|louis ?vuitton|chanel|rolex|ferrari|lamborghini|porsche|harley-?davidson|playstation|xbox|hello ?kitty|harry ?potter|fortnite|pubg|call of duty|zelda|transformers|barbie|hot ?wheels|balenciaga|yeezy|among ?us|roblox|overwatch|genshin|naruto|dragon ?ball|warhammer|iron ?man|avengers|mandalorian|simpsons|spongebob|peppa ?pig|paw ?patrol)\b", re.I)

src, out = sys.argv[1], sys.argv[2]
lvis = json.load(gzip.open(os.path.join(src, 'lvis.json.gz')))
paths = json.load(gzip.open(os.path.join(src, 'paths.json.gz')))
cat_of = {}
for cat, uids in lvis.items():
    for u in uids:
        cat_of[u] = cat

def clean_cat(c):
    c = c.replace('_', ' ')
    c = re.sub(r'\s*\((?:type of |kind of )?([^)]*)\)', r' (\1)', c)
    return c.strip()

def clean_name(n):
    n = re.sub(r'[_]+', ' ', str(n or ''))
    n = re.sub(r'\s+', ' ', n).strip()
    return n[:60]

THUMB = 'https://media.sketchfab.com/models/'
cands = {}
shards = sorted({paths[u].split('/')[1] for u in cat_of if u in paths})
for sh in shards:
    meta = json.load(gzip.open(os.path.join(src, f'meta-{sh}.json.gz')))
    for u, m in meta.items():
        cat = cat_of.get(u)
        # Sketchfab ids only (32 hex characters): the few others have no Sketchfab page to credit
        if not cat or not re.fullmatch(r'[0-9a-f]{32}', u):
            continue
        lic = LICENCES.get(m.get('license'))
        if lic is None or m.get('isAgeRestricted'):
            continue
        glb = (m.get('archives') or {}).get('glb') or {}
        size = glb.get('size') or 0
        faces = glb.get('faceCount') or m.get('faceCount') or 0
        tex = glb.get('textureMaxResolution') or 0
        if not size or size > MAX_MB * 1_000_000 or not faces or faces > MAX_FACES or tex > MAX_TEX:
            continue
        thumbs = [t for t in (m.get('thumbnails') or {}).get('images', []) if str(t.get('url', '')).startswith(THUMB + u + '/thumbnails/')]
        if not thumbs:
            continue
        t = min(thumbs, key=lambda t: abs((t.get('width') or 0) - 256))
        user = m.get('user') or {}
        author = clean_name(user.get('displayName') or user.get('username') or '')
        if not author:
            continue
        score = (m.get('likeCount') or 0) * 10 + (m.get('viewCount') or 0) / 50 + (500 if m.get('staffpickedAt') else 0)
        tags = [x.get('slug', '') for x in (m.get('tags') or [])][:6]
        tags = [x[:20] for x in tags if x and re.fullmatch(r'[a-z0-9-]+', x)][:4]
        shard = int(paths[u].split('/')[1].split('-')[1])
        # A model whose own name or tags name its category is what someone searching for it means
        # (LVIS puts a motorbike under "taillight" when one is visible); those come first.
        words = set(re.findall(r'[a-z]+', (str(m.get('name') or '') + ' ' + ' '.join(tags)).lower()))
        head = [w for w in re.findall(r'[a-z]+', cat.split('(')[0].lower()) if len(w) > 2]
        named = any(w in words or w.rstrip('s') in words or w + 's' in words for w in head)
        if BRANDS.search(f"{m.get('name') or ''} {clean_cat(cat)} {' '.join(tags)}"):
            continue
        cands.setdefault(cat, []).append(((1 if named else 0, score), [u, shard, clean_name(m.get('name')) or clean_cat(cat), lic, author, round(size / 1000), faces, t['url'][len(THUMB) + len(u) + 12:], ' '.join(tags)]))

cats = []
items = []
for cat in sorted(cands):
    # Only models that name their category: an unnamed one is usually something else that shows it.
    best = sorted([c for c in cands[cat] if c[0][0]], key=lambda x: -x[0][1])[:PER_CAT]
    if not best:
        continue
    cats.append(cat)
    for _, row in best:
        items.append(row[:2] + [row[2], len(cats) - 1] + row[3:])
doc = {
    'v': 1,
    'source': 'Objaverse 1.0 (allenai/objaverse, Hugging Face): Sketchfab models under CC0 or CC BY 4.0, LVIS categories',
    'fields': ['uid', 'shard', 'name', 'cat', 'licence (0 CC0, 1 CC BY 4.0)', 'author', 'kB', 'faces', 'thumb', 'tags'],
    'cats': [clean_cat(c) for c in cats],
    'items': items,
}
open(out, 'w').write(json.dumps(doc, separators=(',', ':'), ensure_ascii=False))
print(len(cats), 'categories', len(items), 'models', os.path.getsize(out) // 1000, 'kB')
