/**
 * The 3D STUDIO's catalogue of real models, shared by the phone (browse, search, open) and the
 * brain (make_3d looks here before generating anything). Pure, no DOM, no network.
 *
 * Two free sources, every model with its licence and its author's credit:
 *  - Objaverse 1.0 (allenai/objaverse on Hugging Face): Sketchfab models released under Creative
 *    Commons, each with its own licence. `tools/build-models3d.py` keeps only CC0 and CC BY 4.0 ones
 *    in the 1,156 everyday LVIS categories that are light enough for an iPhone, into the static index
 *    `public/data/models3d.json` (fetched only when the catalogue opens). A model's GLB is fetched
 *    from Hugging Face only when it is opened (connect-src already allows huggingface.co / *.hf.co).
 *  - Poly Haven (CC0, a public API): its model list comes from the brain (/api/m3d/catalog, kept in
 *    KV for a week); a model is packed into one GLB by the brain (/api/m3d/ph/<id>) at 1k textures.
 *
 * `searchCatalog` ranks by the words of a query against each model's name, category and tags, with
 * British/American synonyms and plurals ("couch" finds sofas, "knives" finds a knife).
 * `standIn` is the always-available fallback: a simple parametric model built from boxes and
 * cylinders for the thing named, so "type anything" never ends with nothing.
 */

export type Licence = 'CC0' | 'CC BY 4.0';

/** One model in the catalogue. */
export interface CatalogItem {
  /** 'ov:<uid>' (Objaverse) or 'ph:<asset id>' (Poly Haven). */
  id: string;
  name: string;
  /** Its own category ("armchair", "Furniture/Seating/Chairs" → "chairs"). */
  cat: string;
  /** The browse shelf it sits on (one of GROUPS). */
  group: string;
  tags: string[];
  licence: Licence;
  author: string;
  source: 'Objaverse' | 'Poly Haven';
  /** Download size in kB (Poly Haven: unknown until packed, 0). */
  kb: number;
  faces: number;
  /** Thumbnail address (on media.sketchfab.com or cdn.polyhaven.com). */
  thumb: string;
  /** Where the model's own page is, for the credit. */
  page: string;
  /** Objaverse only: the folder its GLB is in on Hugging Face. */
  shard?: number;
}

/** Licences we accept: public domain and attribution only — no NonCommercial, NoDerivatives or ShareAlike. */
export function licenceOf(code: unknown): Licence | null {
  const c = String(code ?? '').trim().toLowerCase().replace(/^cc[ -]?/, '').replace(/[ -]?4\.0$/, '');
  if (c === '0' || c === 'cc0' || c === 'zero' || c === 'public domain') return 'CC0';
  if (c === 'by') return 'CC BY 4.0';
  return null;
}

/** An iPhone 13 handles this much comfortably (the index builder uses the same limits). */
export const MAX_FACES = 200_000;
export const MAX_KB = 12_000;

// ---------------------------------------------------------------- browse shelves

export const GROUPS = ['Furniture', 'Kitchen & dining', 'Home & decor', 'Bathroom & cleaning', 'Electronics', 'Tools & DIY', 'Clothes & accessories', 'Food & drink', 'Toys, games & sport', 'Music', 'Office & school', 'Vehicles', 'Plants & nature', 'Animals', 'Other things'] as const;

const SHELF: [string, RegExp][] = [
  ['Furniture', /\b(?:chair|armchair|sofa|couch|settee|stool|bench|table|desk|bed|cot|crib|bunk|wardrobe|armoire|cabinet|cupboard|dresser|drawer|bookcase|shelf|shelves|shelving|seating|furniture|ottoman|futon|chaise|recliner|rocking|sideboard|nightstand|beanbag|coatrack|highchair|headboard|hammock|deck chair|folding chair)/],
  ['Kitchen & dining', /\b(?:kettle|teapot|mug|cup|glass|plate|bowl|dish|spoon|fork|knife|knives|chopstick|pan|pot|wok|saucepan|frying|skillet|toaster|blender|mixer|microwave|oven|stove|refrigerator|fridge|dishwasher|jar|jug|pitcher|bottle|can opener|corkscrew|ladle|spatula|whisk|grater|colander|tray|platter|saucer|teacup|wineglass|wine glass|tumbler|thermos|flask|cutlery|chinaware|crockpot|casserole|kitchen|dishes|coffee maker|coffeepot|espresso|tableware|cookware|rolling pin|chopping board|cutting board|salt|pepper mill|napkin|place mat|kitchen table|tablecloth|ice maker|food processor|waffle)/],
  ['Bathroom & cleaning', /\b(?:toilet|bathtub|bath|shower|sink|basin|faucet|tap|towel|soap|toothbrush|toothpaste|razor|shampoo|sponge|broom|mop|bucket|pail|vacuum|duster|dustpan|scrub|detergent|cleansing|laundry|hamper|washer|washing|hair dryer|hairbrush|comb|plunger|tissue|toilet paper|bath mat)/],
  ['Electronics', /\b(?:television|tv|monitor|computer|laptop|keyboard|mouse|phone|telephone|cellular|smartphone|tablet|camera|camcorder|speaker|headphone|headset|earphone|radio|remote|console|joystick|router|printer|projector|charger|battery|cable|plug|socket|electronics|appliances|game|ipod|cd player|record player|stereo|amplifier|microphone|webcam|calculator|clock radio|walkie|drone|robot|electric|fan|air conditioner|heater|lightbulb|light bulb)/],
  ['Tools & DIY', /\b(?:hammer|screwdriver|wrench|spanner|pliers|saw|drill|chisel|axe|ax|shovel|spade|rake|hoe|ladder|toolbox|tool|tools|tape measure|level|vise|vice|clamp|nail|screw|bolt|nut|anvil|crowbar|chainsaw|lawn mower|lawnmower|wheelbarrow|barrow|hose|watering can|industrial|padlock|lock|key|flashlight|torch|lantern|fire extinguisher|gas|crate|barrel|pallet|toolchest|machine|generator|pump|sledgehammer|trowel|paintbrush|paint|roller)/],
  ['Clothes & accessories', /\b(?:shirt|t-shirt|jacket|coat|blazer|cardigan|sweater|jumper|dress|skirt|trouser|jean|short|sock|shoe|boot|sandal|slipper|sneaker|trainer|hat|cap|beanie|helmet|glove|mitten|scarf|tie|bow-tie|belt|bag|handbag|backpack|purse|wallet|suitcase|briefcase|umbrella|watch|bracelet|necklace|ring|earring|anklet|glasses|sunglasses|spectacles|goggles|mask|apron|bathrobe|robe|pajama|uniform|vest|hood|bandanna|bonnet|beret|crown|tiara|clothing|fashion|jewel|brooch|broach|cufflink|clutch bag|cloak|cape|gown|costume|armor|armour|wig)/],
  ['Food & drink', /\b(?:apple|banana|orange|lemon|lime|grape|strawberry|cherry|pear|peach|plum|melon|watermelon|pineapple|mango|avocado|tomato|potato|carrot|onion|garlic|pepper|cucumber|lettuce|cabbage|broccoli|cauliflower|corn|mushroom|bread|bun|bagel|baguet|croissant|cake|cupcake|cookie|biscuit|donut|doughnut|pie|pizza|burger|hamburger|sandwich|hotdog|hot dog|sausage|bacon|egg|cheese|butter|milk|yogurt|honey|jam|chocolate|candy|sweet|lollipop|ice cream|popcorn|pretzel|pastry|muffin|waffle|pancake|sushi|burrito|taco|noodle|pasta|rice|soup|salad|steak|beef|chicken leg|fish|shrimp|lobster|crab|beer|wine|cider|juice|soda|water bottle|coffee|tea|cappuccino|cocktail|alcohol|food|fruit|vegetable|nut|almond|walnut|peanut|coconut|kiwi|apricot|blackberry|blueberry|raspberry|clementine|tangerine|grapefruit|artichoke|asparagus|celery|zucchini|courgette|aubergine|eggplant|pumpkin|squash|radish|turnip|bean|pea|olive|spice|brownie|mousse|pudding|dessert|cereal|crisp|chip|fries|syrup|ketchup|mustard|mayonnaise|sauce|tabasco)/],
  ['Toys, games & sport', /\b(?:toy|teddy|doll|puppet|lego|block|puzzle|kite|balloon|ball|football|soccer|basketball|baseball|tennis|golf|cricket|rugby|volleyball|bowling|frisbee|skateboard|scooter|skate|rollerblade|ski|snowboard|surfboard|sled|racket|racquet|bat|club|dumbbell|barbell|weight|kettlebell|treadmill|boxing|dart|dartboard|chess|checkerboard|domino|dice|card|game|trophy|award|medal|yoyo|spinning top|rubik|playing|sport|fishing rod|tent|sleeping bag|binoculars|hula|jump rope|trampoline|swing|slide|seesaw|rocking horse|water gun|sword|shield|bow \(weapon\)|arrow|rifle|pistol|gun)/],
  ['Music', /\b(?:guitar|violin|cello|viola|bass|piano|keyboard instrument|drum|cymbal|flute|clarinet|saxophone|trumpet|trombone|tuba|horn|harmonica|harp|banjo|ukulele|accordion|xylophone|tambourine|maraca|bell|chime|gong|music|instrument|metronome|record)/],
  ['Office & school', /\b(?:book|notebook|notepad|pen|pencil|marker|sharpie|crayon|eraser|ruler|scissors|stapler|staple|paper|envelope|folder|binder|clipboard|calendar|globe|blackboard|whiteboard|chalk|bulletin|easel|calculator|briefcase|business card|label|sticker|tape|paperclip|clip|pushpin|thumbtack|desk lamp|office|school|bookmark|booklet|magazine|newspaper|map|postcard|card|stamp|ink|typewriter|bible)/],
  ['Vehicles', /\b(?:car|automobile|truck|lorry|van|bus|train|tram|locomotive|railcar|subway|taxi|cab|ambulance|fire engine|police|motorcycle|motorbike|bicycle|bike|tricycle|scooter|tractor|bulldozer|excavator|crane|forklift|trailer|camper|caravan|jeep|tank|airplane|aeroplane|aircraft|plane|jet|helicopter|blimp|rocket|spaceship|space shuttle|boat|ship|yacht|canoe|kayak|ferry|barge|submarine|sailboat|raft|vehicle|wheel|tire|tyre|car battery|license plate|steering|go-kart|golf cart|wagon|cart|stroller|baby buggy|pram|wheelchair)/],
  ['Plants & nature', /\b(?:plant|tree|flower|rose|tulip|daisy|sunflower|lily|orchid|cactus|succulent|fern|bush|shrub|grass|leaf|leaves|branch|log|stump|rock|stone|pebble|boulder|shell|seashell|mushroom|moss|bamboo|bonsai|palm|pine|oak|bouquet|carnation|nature|ground cover|flowerpot|vase|planter|potted|seed|acorn|pinecone|driftwood|coral)/],
  ['Animals', /\b(?:dog|puppy|cat|kitten|horse|pony|cow|calf|bull|pig|sheep|lamb|goat|chicken|hen|cock|rooster|duck|goose|swan|bird|parrot|owl|eagle|hawk|pigeon|penguin|flamingo|fish|shark|whale|dolphin|seal|octopus|crab|lobster|frog|toad|turtle|tortoise|snake|lizard|crocodile|alligator|dinosaur|elephant|giraffe|zebra|lion|tiger|leopard|cheetah|bear|panda|koala|kangaroo|monkey|gorilla|baboon|ape|deer|moose|elk|reindeer|camel|llama|rabbit|bunny|hamster|mouse \(animal\)|rat|squirrel|fox|wolf|bat \(animal\)|butterfly|bee|beetle|ant|spider|ladybug|dragonfly|cockroach|snail|worm|pug|bulldog|poodle|dalmatian|animal|insect|pet)/],
  ['Home & decor', /\b(?:lamp|light|lighting|chandelier|candle|candlestick|candle holder|vase|mirror|clock|picture|painting|frame|poster|statue|sculpture|figurine|bust|ornament|decoration|decorative|cushion|pillow|blanket|quilt|duvet|bedspread|rug|carpet|mat|curtain|blind|shade|lampshade|basket|box|storage|container|containers|jar|urn|bowl|tray|coaster|wreath|christmas|tree ornament|snow globe|dreamcatcher|wind chime|doormat|door|window|fireplace|radiator|bookend|trinket|jewelry box|music box|hourglass|globe|plaque|trophy|sign|banner|flag|wall decoration|dishes|props|hanger|coat hanger|hook|ashtray|incense|perfume|atomizer|ring box|piggy bank|lantern|shelf decor|vases)/],
];

/** The shelf for a category (and, failing that, the model's name and tags). */
export function groupOf(cat: string, more = ''): string {
  const a = cat.toLowerCase();
  for (const [g, re] of SHELF) if (re.test(a)) return g;
  const b = more.toLowerCase();
  if (b) for (const [g, re] of SHELF) if (re.test(b)) return g;
  return 'Other things';
}

// ---------------------------------------------------------------- the two sources

/** The static Objaverse index (public/data/models3d.json, written by tools/build-models3d.py). */
export interface ObjaverseIndex {
  v: number;
  cats: string[];
  /** [uid, shard, name, cat index, licence 0 CC0 / 1 CC BY, author, kB, faces, thumbnail path, tags] */
  items: [string, number, string, number, number, string, number, number, string, string][];
}

const OV_THUMB = 'https://media.sketchfab.com/models/';
const HF_OBJAVERSE = 'https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/';

/** The Objaverse index, expanded; anything malformed, too heavy or not permissively licensed is left out. */
export function objaverseItems(doc: unknown): CatalogItem[] {
  const d = doc as ObjaverseIndex | null;
  if (!d || !Array.isArray(d.items) || !Array.isArray(d.cats)) return [];
  const out: CatalogItem[] = [];
  for (const r of d.items) {
    if (!Array.isArray(r) || r.length < 10) continue;
    const [uid, shard, name, ci, lic, author, kb, faces, thumb, tags] = r;
    if (typeof uid !== 'string' || !/^[0-9a-f]{32}$/.test(uid) || typeof shard !== 'number' || !Number.isInteger(shard) || shard < 0 || shard > 999) continue;
    const licence = lic === 0 ? 'CC0' : lic === 1 ? 'CC BY 4.0' : null;
    if (!licence || !author || kb > MAX_KB || faces > MAX_FACES) continue;
    if (typeof thumb !== 'string' || !/^[0-9a-f]{32}\/[\w.-]+\.(?:jpe?g|png|webp)$/i.test(thumb)) continue;
    const cat = String(d.cats[ci] ?? '');
    out.push({ id: `ov:${uid}`, name: String(name || cat), cat, group: groupOf(cat, `${name} ${tags}`), tags: String(tags ?? '').split(/\s+/).filter(Boolean), licence, author: String(author), source: 'Objaverse', kb, faces, thumb: `${OV_THUMB}${uid}/thumbnails/${thumb}`, page: `https://sketchfab.com/3d-models/${uid}`, shard });
  }
  return out;
}

/** Where an Objaverse model's GLB is on Hugging Face, or null. */
export function objaverseGlb(it: Pick<CatalogItem, 'id' | 'shard'>): string | null {
  const uid = it.id.replace(/^ov:/, '');
  if (!it.id.startsWith('ov:') || !/^[0-9a-f]{32}$/.test(uid) || typeof it.shard !== 'number') return null;
  return `${HF_OBJAVERSE}000-${String(it.shard).padStart(3, '0')}/${uid}.glb`;
}

/** Poly Haven's /assets?t=models answer → catalogue items (CC0, every one; too-detailed scans left out). */
export function polyHavenItems(api: unknown): CatalogItem[] {
  if (!api || typeof api !== 'object') return [];
  const out: CatalogItem[] = [];
  for (const [id, raw] of Object.entries(api as Record<string, unknown>)) {
    const a = raw as { name?: unknown; type?: unknown; categories?: unknown; tags?: unknown; authors?: unknown; polycount?: unknown; category?: unknown; thumbnail_url?: unknown };
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !a || (a.type !== undefined && a.type !== 2)) continue;
    const faces = typeof a.polycount === 'number' ? a.polycount : 0;
    if (faces > MAX_FACES) continue;
    const path = typeof a.category === 'string' ? a.category : '';
    const cats = Array.isArray(a.categories) ? a.categories.filter((c): c is string => typeof c === 'string' && !c.startsWith('collection:')) : [];
    const cat = (path.split('/').pop() || cats[cats.length - 1] || 'model').toLowerCase();
    const tags = Array.isArray(a.tags) ? a.tags.filter((t): t is string => typeof t === 'string').slice(0, 8) : [];
    const authors = a.authors && typeof a.authors === 'object' ? Object.keys(a.authors as object) : [];
    const name = typeof a.name === 'string' && a.name ? a.name : id.replace(/_/g, ' ');
    const thumb = typeof a.thumbnail_url === 'string' && a.thumbnail_url.startsWith('https://cdn.polyhaven.com/') ? a.thumbnail_url : `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256&height=256`;
    out.push({ id: `ph:${id}`, name, cat, group: groupOf(`${path.replace(/\//g, ' ')} ${cats.join(' ')}`, `${name} ${tags.join(' ')}`), tags, licence: 'CC0', author: authors.join(', ') || 'Poly Haven', source: 'Poly Haven', kb: 0, faces, thumb, page: `https://polyhaven.com/a/${id}` });
  }
  return out;
}

/** The credit line shown under every opened model. */
export function creditLine(it: Pick<CatalogItem, 'name' | 'author' | 'licence' | 'source'>): string {
  const via = it.source === 'Poly Haven' ? 'Poly Haven' : 'Sketchfab, via Objaverse';
  return `“${it.name}” by ${it.author} · ${it.licence}${it.licence === 'CC0' ? ' (public domain)' : ''} · ${via}`;
}

// ---------------------------------------------------------------- words, synonyms, search

const STOP = new Set(['a', 'an', 'the', 'of', 'with', 'for', 'and', 'my', 'me', 'some', 'model', 'models', '3d', '3-d', 'three', 'make', 'show', 'find', 'get', 'please', 'in', 'on', 'to', 'like', 'one', 'that', 'is', 'it', 'i', 'want', 'need', 'give', 'new', 'old', 'nice', 'big', 'small', 'little', 'large']);

const IRREGULAR: Record<string, string> = { knives: 'knife', shelves: 'shelf', leaves: 'leaf', wolves: 'wolf', loaves: 'loaf', halves: 'half', geese: 'goose', mice: 'mouse', teeth: 'tooth', feet: 'foot', children: 'child', people: 'person', men: 'man', women: 'woman', dice: 'die', glasses: 'glasses', trousers: 'trousers', pants: 'pants', jeans: 'jeans', scissors: 'scissors', tongs: 'tongs', pliers: 'pliers', headphones: 'headphone', sunglasses: 'sunglasses', drawers: 'drawers', fries: 'fries', series: 'series', species: 'species', chess: 'chess', glass: 'glass', bus: 'bus', gas: 'gas', grass: 'grass', dress: 'dress', mattress: 'mattress', compass: 'compass', cactus: 'cactus', octopus: 'octopus', lotus: 'lotus', walrus: 'walrus', asparagus: 'asparagus', hummus: 'hummus', couscous: 'couscous', tennis: 'tennis', iris: 'iris', canvas: 'canvas', atlas: 'atlas', hibiscus: 'hibiscus', bonus: 'bonus', virus: 'virus', citrus: 'citrus', abacus: 'abacus', lens: 'lens', boss: 'boss', moss: 'moss', class: 'class', brass: 'brass', cross: 'cross', ferris: 'ferris', chassis: 'chassis', ugs: 'ugs' };

/** One word in its plain singular form ("benches" → "bench", "berries" → "berry"). */
export function stem(w: string): string {
  if (IRREGULAR[w]) return IRREGULAR[w]!;
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(?:ss|x|z|ch|sh|o)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Synonym families (stemmed words; several words joined by "_"). British and American names both. */
const FAMILIES: string[][] = [
  ['sofa', 'couch', 'settee', 'loveseat', 'sofa_bed'],
  ['armchair', 'arm_chair', 'easy_chair', 'recliner', 'wing_chair'],
  ['wardrobe', 'armoire', 'closet'],
  ['cupboard', 'cabinet', 'sideboard', 'kitchen_cabinet'],
  ['dresser', 'chest_of_drawers', 'drawers'],
  ['bookcase', 'bookshelf', 'shelving', 'shelf', 'shelving_unit'],
  ['nightstand', 'bedside_table', 'night_table', 'bedside_cabinet'],
  ['fridge', 'refrigerator', 'fridge_freezer'],
  ['television', 'tv', 'telly', 'television_set'],
  ['kettle', 'teakettle', 'electric_kettle'],
  ['mug', 'cup', 'beer_mug', 'teacup', 'coffee_cup'],
  ['bin', 'trash_can', 'garbage_can', 'dustbin', 'wastebasket', 'rubbish_bin', 'waste_bin', 'trashcan'],
  ['lamp', 'lantern', 'floor_lamp', 'table_lamp', 'desk_lamp'],
  ['lightbulb', 'light_bulb', 'bulb'],
  ['telephone', 'phone', 'mobile', 'cellphone', 'smartphone', 'cellular_telephone', 'mobile_phone', 'iphone'],
  ['laptop', 'laptop_computer', 'notebook_computer', 'macbook'],
  ['computer', 'pc', 'desktop_computer'],
  ['vacuum', 'hoover', 'vacuum_cleaner'],
  ['trainer', 'sneaker', 'running_shoe', 'tennis_shoe', 'shoe'],
  ['shoe', 'footwear'],
  ['trousers', 'pants', 'jeans'],
  ['jumper', 'sweater', 'pullover', 'sweatshirt'],
  ['torch', 'flashlight'],
  ['tap', 'faucet'],
  ['cooker', 'stove', 'oven', 'range_cooker'],
  ['washing_machine', 'washer', 'automatic_washer'],
  ['bicycle', 'bike', 'push_bike'],
  ['car', 'automobile'],
  ['lorry', 'truck', 'trailer_truck', 'pickup_truck'],
  ['pram', 'stroller', 'baby_buggy', 'pushchair', 'buggy'],
  ['nappy', 'diaper'],
  ['biscuit', 'cookie'],
  ['crisp', 'potato_chip'],
  ['chip', 'fries', 'french_fry'],
  ['aubergine', 'eggplant'],
  ['courgette', 'zucchini'],
  ['tin', 'can', 'tin_can'],
  ['jug', 'pitcher'],
  ['saucepan', 'pan', 'frying_pan', 'skillet', 'pot', 'cooking_pot'],
  ['desk', 'writing_desk', 'office_desk'],
  ['cot', 'crib'],
  ['rug', 'carpet', 'mat'],
  ['curtain', 'drape'],
  ['cushion', 'pillow'],
  ['duvet', 'quilt', 'blanket', 'bedspread', 'comforter'],
  ['planter', 'flowerpot', 'plant_pot', 'pot_plant'],
  ['plate', 'dish', 'platter'],
  ['tumbler', 'drinking_glass', 'glass'],
  ['headphone', 'headset', 'earphone', 'earbud'],
  ['speaker', 'loudspeaker'],
  ['football', 'soccer_ball'],
  ['umbrella', 'brolly', 'parasol'],
  ['backpack', 'rucksack', 'knapsack', 'schoolbag'],
  ['suitcase', 'luggage'],
  ['handbag', 'purse', 'clutch_bag'],
  ['glasses', 'spectacles', 'eyeglass', 'eyeglasses'],
  ['spanner', 'wrench'],
  ['bucket', 'pail'],
  ['toilet', 'loo', 'wc', 'toilet_bowl'],
  ['bathtub', 'bath', 'tub'],
  ['radiator', 'heater'],
  ['motorbike', 'motorcycle', 'motor_bike'],
  ['sweet', 'candy'],
  ['aeroplane', 'airplane', 'plane', 'aircraft', 'jet'],
  ['taxi', 'cab'],
  ['jacket', 'coat', 'blazer', 'anorak'],
  ['stool', 'barstool', 'bar_stool'],
  ['teapot', 'tea_pot'],
  ['microwave', 'microwave_oven'],
  ['clock', 'alarm_clock', 'wall_clock'],
  ['painting', 'picture', 'artwork', 'canvas'],
  ['houseplant', 'potted_plant', 'plant'],
  ['axe', 'ax', 'hatchet'],
  ['lawnmower', 'lawn_mower', 'mower'],
  ['dummy', 'pacifier'],
  ['postbox', 'mailbox', 'letterbox'],
  ['mobile_home', 'caravan', 'camper'],
  ['ring', 'finger_ring'],
  ['hat', 'cap'],
  ['dining_table', 'kitchen_table', 'table'],
  ['coffee_table', 'table'],
  ['chair', 'dining_chair', 'kitchen_chair', 'office_chair', 'folding_chair'],
  ['bed', 'double_bed', 'single_bed', 'bunk_bed'],
];

/** Phrases written as one token ("chests of drawers" → "chest_of_drawers"), longest first; any word may be plural. */
const PHRASES = [...new Set(FAMILIES.flat().filter((w) => w.includes('_')))].sort((a, b) => b.length - a.length).map((p) => [new RegExp(`\\b${p.split('_').map((w) => `${w}(?:e?s)?`).join('[\\s-]+')}\\b`, 'g'), p] as const);

const FAMILY = new Map<string, Set<string>>();
for (const f of FAMILIES) {
  const all = new Set(f);
  // the words inside a phrase ("dining_table") also lead to its family's head word
  for (const w of f) {
    const had = FAMILY.get(w);
    FAMILY.set(w, had ? new Set([...had, ...all]) : new Set(all));
  }
}

/** Text → its words: lower case, phrases joined, plurals made singular, filler words dropped. */
export function words(text: string): string[] {
  let t = ` ${String(text).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9_\s-]+/g, ' ')} `;
  for (const [re, p] of PHRASES) t = t.replace(re, ` ${p} `);
  const out: string[] = [];
  for (const w of t.split(/[\s-]+/)) {
    if (!w || STOP.has(w) || /^\d+$/.test(w)) continue;
    const s = w.includes('_') ? w : stem(w);
    out.push(s);
    // a phrase also counts as its parts ("dining_table" → "dining", "table")
    if (w.includes('_')) for (const p of w.split('_')) if (p && !STOP.has(p)) out.push(stem(p));
  }
  return out;
}

/** A word and every synonym of it. */
export function synonyms(w: string): Set<string> {
  return FAMILY.get(w) ?? new Set([w]);
}

interface Fields {
  name: Set<string>;
  cat: Set<string>;
  tags: Set<string>;
  group: Set<string>;
}
const fieldCache = new WeakMap<CatalogItem, Fields>();
function fieldsOf(it: CatalogItem): Fields {
  let f = fieldCache.get(it);
  if (!f) {
    f = { name: new Set(words(it.name)), cat: new Set(words(it.cat)), tags: new Set(words(it.tags.join(' '))), group: new Set(words(it.group)) };
    fieldCache.set(it, f);
  }
  return f;
}

export interface SearchHit {
  item: CatalogItem;
  score: number;
  /** Share of the query's words found (0–1). */
  quality: number;
  /** The query's last word (its head noun, "oak dining CHAIR") was found in the name, category or tags. */
  head: boolean;
}

/** How well one word matches one model (0 = not at all). */
function wordScore(f: Fields, w: string): { s: number; strong: boolean } {
  const alts = synonyms(w);
  let best = 0;
  let strong = false;
  const hit = (set: Set<string>, weight: number) => {
    for (const a of alts) {
      if (set.has(a)) {
        // the word itself counts a little more than a synonym of it
        const s = a === w ? weight : weight * 0.9;
        if (s > best) best = s;
        return true;
      }
    }
    // "chai" → "chair", "telesc" → "telescope": a beginning of four letters or more, at a discount
    if (w.length >= 4) for (const x of set) if (x.startsWith(w) && weight * 0.6 > best) best = weight * 0.6;
    return false;
  };
  if (hit(f.cat, 3)) strong = true;
  if (hit(f.name, 3)) strong = true;
  if (hit(f.tags, 1.5)) strong = true;
  hit(f.group, 0.5);
  return { s: best, strong };
}

/**
 * The catalogue's best models for a query, best first. `group` keeps to one shelf; an empty query
 * lists the shelf (or everything) by name.
 */
export function searchCatalog(items: CatalogItem[], query: string, opts: { limit?: number; group?: string } = {}): SearchHit[] {
  const limit = opts.limit ?? 40;
  const pool = opts.group ? items.filter((i) => i.group === opts.group) : items;
  const q = [...new Set(words(query))];
  if (!q.length) return pool.slice(0, limit).map((item) => ({ item, score: 0, quality: 0, head: false }));
  const head = q[q.length - 1]!;
  const hits: SearchHit[] = [];
  for (const item of pool) {
    const f = fieldsOf(item);
    let score = 0;
    let found = 0;
    let headHit = false;
    for (const w of q) {
      const r = wordScore(f, w);
      if (r.s > 0) {
        score += r.s;
        found++;
      }
      if (w === head && r.strong) headHit = true;
    }
    if (!score) continue;
    // the head noun matters most: "oak dining chair" is a chair before it is anything oak
    if (headHit) score += 2;
    // lighter models first among equals (they open sooner on a phone)
    score -= Math.min(0.5, item.kb / 24_000);
    hits.push({ item, score, quality: found / q.length, head: headHit });
  }
  hits.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return hits.slice(0, limit);
}

/** A hit good enough to open instead of generating something new. */
export function goodMatch(h: SearchHit | undefined): boolean {
  return !!h && h.head && h.quality >= 0.5 && h.score >= 4;
}

// ---------------------------------------------------------------- the stand-in builder

/** One piece of a stand-in model, in metres, y up, standing on y = 0. */
export interface StandInPart {
  name: string;
  shape: 'box' | 'cyl' | 'sphere' | 'torus' | 'cone';
  /** box: width, height, depth; cyl/cone: top diameter, height, bottom diameter; sphere: diameter ×3; torus: diameter, tube, – */
  size: [number, number, number];
  pos: [number, number, number];
  rot?: [number, number, number];
  color: number;
  metal?: number;
  rough?: number;
  opacity?: number;
}

export interface StandIn {
  title: string;
  kind: string;
  parts: StandInPart[];
}

const COLOURS: [RegExp, number][] = [
  [/\boak\b/, 0xb98a55], [/\bwalnut\b/, 0x6b4a32], [/\bpine\b/, 0xd8b27a], [/\bwood(?:en)?\b/, 0xa47448], [/\bwhite\b/, 0xeeeeee], [/\bblack\b/, 0x222222], [/\bgr[ae]y\b/, 0x8a8f96],
  [/\bred\b/, 0xc0392b], [/\bblue\b/, 0x2e6fd8], [/\bnavy\b/, 0x1f2f5a], [/\bgreen\b/, 0x3c9a5f], [/\byellow\b/, 0xe8c547], [/\borange\b/, 0xe67e22], [/\bpink\b/, 0xe88fb5],
  [/\bpurple\b/, 0x8e5bc4], [/\bbrown\b/, 0x7a5232], [/\bcream\b/, 0xf1e6c8], [/\bbeige\b/, 0xd9c7a3], [/\bgold(?:en)?\b|\bbrass\b/, 0xd4af37], [/\bsilver\b|\bsteel\b|\bchrome\b|\bmetal\b/, 0xb8c0c8], [/\bcopper\b/, 0xb87333], [/\bglass\b/, 0xbfe9ff],
];

/** A size in the words ("a 120 cm table", "2m sofa", "800mm") in metres, or null. */
export function sizeIn(text: string): number | null {
  const m = String(text).toLowerCase().match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|metres?|meters?|in(?:ch(?:es)?)?|"|ft|feet|foot)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2]!;
  const v = u === 'mm' ? n / 1000 : u === 'cm' ? n / 100 : /^(?:in|inch|inches|")$/.test(u) ? n * 0.0254 : /^(?:ft|feet|foot)$/.test(u) ? n * 0.3048 : n;
  return v > 0.01 && v < 20 ? v : null;
}

type Build = (o: { c: number; s: number | null; t: string }) => StandInPart[];
const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, color: number, extra: Partial<StandInPart> = {}): StandInPart => ({ name, shape: 'box', size: [w, h, d], pos: [x, y, z], color, ...extra });
const cyl = (name: string, top: number, h: number, bottom: number, x: number, y: number, z: number, color: number, extra: Partial<StandInPart> = {}): StandInPart => ({ name, shape: 'cyl', size: [top, h, bottom], pos: [x, y, z], color, ...extra });
const legs = (w: number, d: number, h: number, t: number, color: number, inset = 0.03): StandInPart[] =>
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => box(`Leg ${i + 1}`, t, h, t, sx! * (w / 2 - inset - t / 2), h / 2, sz! * (d / 2 - inset - t / 2), color));

const BUILDS: [RegExp, string, Build][] = [
  [/\b(?:armchair|arm chair|easy chair|recliner)\b/, 'armchair', ({ c, s }) => { const w = s ?? 0.85; return [box('Base', w, 0.25, 0.85, 0, 0.2, 0, c), box('Seat cushion', w - 0.3, 0.14, 0.62, 0, 0.39, 0.06, c), box('Back', w, 0.55, 0.18, 0, 0.6, -0.34, c), box('Left arm', 0.15, 0.32, 0.85, -w / 2 + 0.075, 0.48, 0, c), box('Right arm', 0.15, 0.32, 0.85, w / 2 - 0.075, 0.48, 0, c), ...legs(w, 0.85, 0.08, 0.05, 0x3b2a1c)]; }],
  [/\b(?:sofa|couch|settee|loveseat)\b/, 'sofa', ({ c, s }) => { const w = s ?? 2; const n = Math.max(1, Math.min(4, Math.round((w - 0.4) / 0.6))); const cw = (w - 0.4) / n; return [box('Base', w, 0.25, 0.9, 0, 0.2, 0, c), ...Array.from({ length: n }, (_, i) => box(`Seat cushion ${i + 1}`, cw - 0.02, 0.15, 0.62, -w / 2 + 0.2 + cw * (i + 0.5), 0.4, 0.07, c)), ...Array.from({ length: n }, (_, i) => box(`Back cushion ${i + 1}`, cw - 0.02, 0.45, 0.18, -w / 2 + 0.2 + cw * (i + 0.5), 0.68, -0.3, c)), box('Back', w, 0.6, 0.12, 0, 0.6, -0.39, c), box('Left arm', 0.2, 0.35, 0.9, -w / 2 + 0.1, 0.5, 0, c), box('Right arm', 0.2, 0.35, 0.9, w / 2 - 0.1, 0.5, 0, c), ...legs(w, 0.9, 0.08, 0.05, 0x3b2a1c)]; }],
  [/\b(?:stool|barstool)\b/, 'stool', ({ c, s }) => { const h = s ?? 0.65; return [cyl('Seat', 0.36, 0.05, 0.36, 0, h - 0.025, 0, c), ...legs(0.32, 0.32, h - 0.05, 0.035, c, 0.01), box('Footrest', 0.3, 0.025, 0.025, 0, h * 0.35, 0.13, c)]; }],
  [/\bbench\b/, 'bench', ({ c, s }) => { const w = s ?? 1.4; return [box('Seat', w, 0.05, 0.38, 0, 0.43, 0, c), ...legs(w, 0.38, 0.405, 0.06, c)]; }],
  [/\bchair\b/, 'chair', ({ c, s }) => { const h = s && s > 0.6 ? s : 0.9; return [box('Seat', 0.45, 0.04, 0.45, 0, 0.45, 0, c), ...legs(0.45, 0.45, 0.43, 0.04, c, 0.01), box('Back left post', 0.04, h - 0.47, 0.04, -0.205, 0.47 + (h - 0.47) / 2, -0.205, c), box('Back right post', 0.04, h - 0.47, 0.04, 0.205, 0.47 + (h - 0.47) / 2, -0.205, c), box('Backrest', 0.41, 0.18, 0.025, 0, h - 0.12, -0.205, c), box('Back rail', 0.41, 0.04, 0.02, 0, 0.62, -0.205, c)]; }],
  [/\b(?:desk|writing desk)\b/, 'desk', ({ c, s }) => { const w = s ?? 1.2; return [box('Top', w, 0.03, 0.6, 0, 0.735, 0, c), ...legs(w, 0.6, 0.72, 0.045, c), box('Drawer unit', 0.4, 0.5, 0.55, w / 2 - 0.25, 0.47, 0, c), box('Drawer front', 0.36, 0.14, 0.02, w / 2 - 0.25, 0.62, 0.285, 0xdddddd), box('Handle', 0.12, 0.015, 0.02, w / 2 - 0.25, 0.62, 0.305, 0x999999, { metal: 0.9 })]; }],
  [/\b(?:table|coffee table|dining table)\b/, 'table', ({ c, s, t }) => { const coffee = /coffee|side/.test(t); const w = s ?? (coffee ? 1.0 : 1.6); const h = coffee ? 0.45 : 0.75; const d = coffee ? 0.55 : Math.min(1, w * 0.56); return [box('Top', w, 0.035, d, 0, h - 0.0175, 0, c), ...legs(w, d, h - 0.035, 0.06, c), box('Front apron', w - 0.16, 0.08, 0.02, 0, h - 0.075, d / 2 - 0.05, c), box('Back apron', w - 0.16, 0.08, 0.02, 0, h - 0.075, -d / 2 + 0.05, c)]; }],
  [/\b(?:bed|bunk bed|double bed|single bed)\b/, 'bed', ({ c, s, t }) => { const single = /single|child|kid/.test(t); const w = s ?? (single ? 0.9 : 1.35); return [box('Frame', w + 0.06, 0.25, 2.0, 0, 0.2, 0, 0x7a5232), box('Mattress', w, 0.22, 1.9, 0, 0.43, 0.02, 0xf2f2f2), box('Headboard', w + 0.06, 0.7, 0.06, 0, 0.6, -1.0, c), box('Duvet', w + 0.02, 0.06, 1.3, 0, 0.56, 0.3, c), box('Pillow', Math.min(0.7, w * 0.45), 0.1, 0.4, -w / 4 + (single ? w / 4 : 0), 0.59, -0.7, 0xffffff), ...(single ? [] : [box('Pillow 2', Math.min(0.7, w * 0.45), 0.1, 0.4, w / 4, 0.59, -0.7, 0xffffff)])]; }],
  [/\b(?:bookcase|bookshelf|shelf|shelving|shelves)\b/, 'bookcase', ({ c, s }) => { const h = s ?? 1.8; const n = Math.max(2, Math.round(h / 0.35)); return [box('Left side', 0.02, h, 0.3, -0.39, h / 2, 0, c), box('Right side', 0.02, h, 0.3, 0.39, h / 2, 0, c), box('Back', 0.8, h, 0.01, 0, h / 2, -0.145, c), ...Array.from({ length: n + 1 }, (_, i) => box(`Shelf ${i + 1}`, 0.76, 0.02, 0.29, 0, 0.01 + (i * (h - 0.02)) / n, 0, c)), ...Array.from({ length: n }, (_, i) => box(`Books ${i + 1}`, 0.5, 0.22, 0.2, -0.1, 0.13 + (i * (h - 0.02)) / n, 0.02, [0xc0392b, 0x2e6fd8, 0x3c9a5f, 0xe8c547][i % 4]!))]; }],
  [/\b(?:wardrobe|armoire|closet)\b/, 'wardrobe', ({ c, s }) => { const w = s ?? 1.0; return [box('Carcass', w, 1.95, 0.58, 0, 1.0, 0, c), box('Left door', w / 2 - 0.01, 1.85, 0.02, -w / 4, 1.0, 0.3, c), box('Right door', w / 2 - 0.01, 1.85, 0.02, w / 4, 1.0, 0.3, c), box('Left handle', 0.015, 0.2, 0.02, -0.04, 1.05, 0.32, 0x999999, { metal: 0.9 }), box('Right handle', 0.015, 0.2, 0.02, 0.04, 1.05, 0.32, 0x999999, { metal: 0.9 }), box('Plinth', w, 0.05, 0.55, 0, 0.025, 0, 0x333333)]; }],
  [/\b(?:dresser|chest of drawers|drawers|cabinet|cupboard|sideboard|nightstand|bedside)\b/, 'cabinet', ({ c, s, t }) => { const small = /night|bedside/.test(t); const w = s ?? (small ? 0.45 : 0.8); const h = small ? 0.55 : 0.85; const n = small ? 2 : 3; return [box('Carcass', w, h, 0.45, 0, h / 2 + 0.05, 0, c), ...Array.from({ length: n }, (_, i) => box(`Drawer ${i + 1}`, w - 0.04, h / n - 0.03, 0.02, 0, 0.05 + (h / n) * (i + 0.5), 0.235, c)), ...Array.from({ length: n }, (_, i) => box(`Handle ${i + 1}`, 0.12, 0.015, 0.02, 0, 0.05 + (h / n) * (i + 0.5), 0.255, 0x999999, { metal: 0.9 })), ...legs(w, 0.45, 0.05, 0.04, 0x333333)]; }],
  [/\b(?:lamp|lampshade|lantern)\b/, 'lamp', ({ c, s, t }) => { const floor = /floor|standard/.test(t); const h = s ?? (floor ? 1.6 : 0.5); return [cyl('Base', 0.18, 0.03, 0.2, 0, 0.015, 0, 0x333333, { metal: 0.7 }), cyl('Stem', 0.02, h - 0.2, 0.02, 0, 0.03 + (h - 0.2) / 2, 0, 0x999999, { metal: 0.9 }), { name: 'Bulb', shape: 'sphere', size: [0.07, 0.07, 0.07], pos: [0, h - 0.13, 0], color: 0xfff3c4 }, { name: 'Shade', shape: 'cone', size: [floor ? 0.3 : 0.2, floor ? 0.3 : 0.2, floor ? 0.45 : 0.32], pos: [0, h - 0.1, 0], color: c, opacity: 0.85 }]; }],
  [/\b(?:kettle)\b/, 'kettle', ({ c }) => [cyl('Body', 0.15, 0.2, 0.18, 0, 0.11, 0, c, { metal: 0.6, rough: 0.25 }), cyl('Base plate', 0.19, 0.012, 0.19, 0, 0.006, 0, 0x222222), cyl('Lid', 0.1, 0.02, 0.12, 0, 0.22, 0, c, { metal: 0.6 }), { name: 'Handle', shape: 'torus', size: [0.14, 0.018, 0], pos: [-0.08, 0.17, 0], rot: [0, 0, Math.PI / 2], color: 0x222222 }, { name: 'Spout', shape: 'cone', size: [0.02, 0.08, 0.05], pos: [0.1, 0.17, 0], rot: [0, 0, -Math.PI / 3], color: c, metal: 0.6 }]],
  [/\b(?:teapot)\b/, 'teapot', ({ c }) => [{ name: 'Body', shape: 'sphere', size: [0.18, 0.15, 0.18], pos: [0, 0.08, 0], color: c }, cyl('Lid', 0.07, 0.02, 0.09, 0, 0.165, 0, c), { name: 'Knob', shape: 'sphere', size: [0.025, 0.025, 0.025], pos: [0, 0.185, 0], color: c }, { name: 'Handle', shape: 'torus', size: [0.09, 0.012, 0], pos: [-0.105, 0.09, 0], color: c }, { name: 'Spout', shape: 'cone', size: [0.015, 0.11, 0.04], pos: [0.11, 0.1, 0], rot: [0, 0, -Math.PI / 4], color: c }]],
  [/\b(?:mug|cup|teacup)\b/, 'mug', ({ c }) => [cyl('Body', 0.085, 0.095, 0.08, 0, 0.0475, 0, c, { rough: 0.3 }), cyl('Coffee', 0.075, 0.004, 0.075, 0, 0.088, 0, 0x4a2c16), { name: 'Handle', shape: 'torus', size: [0.055, 0.009, 0], pos: [0.05, 0.05, 0], color: c }]],
  [/\b(?:wine glass|glass|tumbler)\b/, 'glass', ({ c }) => [cyl('Bowl', 0.08, 0.12, 0.07, 0, 0.06, 0, c === 0x4fb3d9 ? 0xbfe9ff : c, { opacity: 0.35, rough: 0.05 })]],
  [/\b(?:bottle)\b/, 'bottle', ({ c, s }) => { const h = s ?? 0.3; return [cyl('Body', 0.075, h * 0.62, 0.075, 0, h * 0.31, 0, c, { opacity: 0.7, rough: 0.1 }), { name: 'Shoulder', shape: 'cone', size: [0.03, h * 0.13, 0.075], pos: [0, h * 0.685, 0], color: c, opacity: 0.7 }, cyl('Neck', 0.03, h * 0.2, 0.03, 0, h * 0.85, 0, c, { opacity: 0.7 }), cyl('Cap', 0.033, h * 0.05, 0.033, 0, h * 0.975, 0, 0x222222)]; }],
  [/\b(?:vase)\b/, 'vase', ({ c, s }) => { const h = s ?? 0.3; return [cyl('Base', 0.1, h * 0.5, 0.08, 0, h * 0.25, 0, c), cyl('Neck', 0.07, h * 0.5, 0.1, 0, h * 0.75, 0, c)]; }],
  [/\b(?:bowl)\b/, 'bowl', ({ c }) => [cyl('Bowl', 0.18, 0.07, 0.08, 0, 0.035, 0, c)]],
  [/\b(?:plate|dish)\b/, 'plate', ({ c }) => [cyl('Rim', 0.26, 0.012, 0.18, 0, 0.006, 0, c === 0x4fb3d9 ? 0xf4f4f4 : c)]],
  [/\b(?:saucepan|frying pan|pan|skillet|pot)\b/, 'pan', ({ c }) => [cyl('Pan', 0.22, 0.08, 0.2, 0, 0.04, 0, 0x555a60, { metal: 0.8, rough: 0.35 }), box('Handle', 0.2, 0.02, 0.03, 0.2, 0.07, 0, c)]],
  [/\b(?:television|tv|telly|monitor|screen)\b/, 'television', ({ s }) => { const w = s ?? 1.1; const h = w * 0.5625; return [box('Screen', w, h, 0.04, 0, 0.1 + h / 2, 0, 0x101418, { metal: 0.3, rough: 0.15 }), box('Bezel', w + 0.02, h + 0.02, 0.03, 0, 0.1 + h / 2, -0.01, 0x222222), box('Stand neck', 0.06, 0.08, 0.04, 0, 0.06, -0.02, 0x333333), box('Stand foot', w * 0.35, 0.02, 0.22, 0, 0.01, 0, 0x333333)]; }],
  [/\b(?:laptop|computer|macbook)\b/, 'laptop', () => [box('Base', 0.32, 0.018, 0.22, 0, 0.009, 0, 0xb8c0c8, { metal: 0.8, rough: 0.3 }), box('Keyboard', 0.28, 0.002, 0.1, 0, 0.019, -0.02, 0x222222), box('Lid', 0.32, 0.008, 0.22, 0, 0.12, -0.15, 0xb8c0c8, { rot: [-1.85, 0, 0], metal: 0.8 }), box('Screen', 0.29, 0.002, 0.19, 0, 0.122, -0.145, 0x101418, { rot: [-1.85, 0, 0] })]],
  [/\b(?:telephone|phone|smartphone|mobile|iphone)\b/, 'phone', ({ c }) => [box('Body', 0.072, 0.147, 0.008, 0, 0.0735, 0, c === 0x4fb3d9 ? 0x222222 : c, { metal: 0.6, rough: 0.2 }), box('Screen', 0.066, 0.14, 0.001, 0, 0.0735, 0.0045, 0x101418)]],
  [/\b(?:door)\b/, 'door', ({ c }) => [box('Leaf', 0.76, 1.98, 0.04, 0, 0.99, 0, c), box('Frame left', 0.05, 2.03, 0.1, -0.405, 1.015, 0, 0xeeeeee), box('Frame right', 0.05, 2.03, 0.1, 0.405, 1.015, 0, 0xeeeeee), box('Frame top', 0.86, 0.05, 0.1, 0, 2.005, 0, 0xeeeeee), { name: 'Handle', shape: 'sphere', size: [0.05, 0.05, 0.05], pos: [0.3, 1.0, 0.04], color: 0xd4af37, metal: 0.9 }]],
  [/\b(?:houseplant|plant|planter|flowerpot)\b/, 'plant', ({ c }) => [cyl('Pot', 0.22, 0.2, 0.17, 0, 0.1, 0, c === 0x4fb3d9 ? 0xc06a3b : c), cyl('Soil', 0.2, 0.01, 0.2, 0, 0.195, 0, 0x3b2a1c), cyl('Stem', 0.015, 0.25, 0.015, 0, 0.32, 0, 0x2f7a3c), { name: 'Leaves', shape: 'sphere', size: [0.35, 0.3, 0.35], pos: [0, 0.5, 0], color: 0x3c9a5f }]],
  [/\b(?:bucket|pail|bin|dustbin|trash can|wastebasket)\b/, 'bin', ({ c }) => [cyl('Body', 0.3, 0.4, 0.25, 0, 0.2, 0, c, { metal: 0.4 }), cyl('Lid', 0.31, 0.03, 0.31, 0, 0.415, 0, c, { metal: 0.4 })]],
  [/\b(?:clock)\b/, 'clock', ({ c }) => [cyl('Face', 0.3, 0.03, 0.3, 0, 0.15, 0, 0xf4f4f4, { rot: [Math.PI / 2, 0, 0] }), { name: 'Rim', shape: 'torus', size: [0.3, 0.015, 0], pos: [0, 0.15, 0], color: c }, box('Hour hand', 0.01, 0.07, 0.005, 0, 0.18, 0.02, 0x222222), box('Minute hand', 0.006, 0.11, 0.005, 0.03, 0.15, 0.022, 0x222222, { rot: [0, 0, -1.2] })]],
  [/\b(?:ball|football|basketball|globe)\b/, 'ball', ({ c, s }) => { const d = s ?? 0.22; return [{ name: 'Ball', shape: 'sphere', size: [d, d, d], pos: [0, d / 2, 0], color: c }]; }],
  [/\b(?:box|crate|parcel|chest)\b/, 'box', ({ c, s }) => { const w = s ?? 0.4; return [box('Box', w, w * 0.7, w * 0.7, 0, w * 0.35, 0, c), box('Lid', w + 0.01, 0.03, w * 0.7 + 0.01, 0, w * 0.7 + 0.015, 0, c)]; }],
];

/**
 * A simple model of the thing named, from boxes and cylinders at its usual size (or the size in
 * the words): always available, made on the phone in an instant, in real metres, and in parts that
 * come apart. Anything not recognised becomes a labelled box of the size given (or 30 cm).
 */
export function standIn(text: string): StandIn {
  const t = ` ${String(text).toLowerCase()} `;
  const c = COLOURS.find(([re]) => re.test(t))?.[1] ?? 0x4fb3d9;
  const s = sizeIn(t);
  const title = String(text).trim().replace(/\s+/g, ' ').slice(0, 60) || 'Stand-in';
  // The thing itself is named last in English ("an oak dining table", "a table lamp", "a glass vase"),
  // before anything it is on, with or for ("a lamp on a table" is a lamp).
  const head = t.split(/\s(?:on|with|for|next to|beside|by|in|under|near|and)\s/)[0]!;
  // Where two names end together the longer one wins ("arm chair" is an armchair, not a chair).
  let best: { end: number; len: number; kind: string; build: Build } | null = null;
  for (const [re, kind, build] of BUILDS) {
    for (const m of head.matchAll(new RegExp(re.source, 'g'))) {
      const end = m.index + m[0].length;
      if (!best || end > best.end || (end === best.end && m[0].length > best.len)) best = { end, len: m[0].length, kind, build };
    }
  }
  if (!best) {
    const w = s ?? 0.3;
    return { title, kind: 'box', parts: [box(title, w, w, w, 0, w / 2, 0, c)] };
  }
  return { title, kind: best.kind, parts: best.build({ c, s, t }) };
}
