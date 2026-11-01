/**
 * KERNEL — protected. Every tool Ghosty can use.
 * New abilities go in tools/extra.ts (unprotected); they're merged in here, but can never
 * replace a built-in tool.
 */
import type { ToolSpec } from '../llm/router';
import { agendaTools } from './agenda';
import { checkTools } from './check';
import { dataTools } from './data';
import { emailTools } from './email';
import { evolveTools } from './evolve';
import { extraTools, placesTools, schoolTools, spendingTools, videoTools } from './extra'; // [places] placesTools, spendingTools
import { gadgetTools } from './gadgets';
import { guardianTools } from './guardian'; // [guardian]
import { foresightTools, FORESIGHT_ABOUT, FORESIGHT_WHEN } from './foresight'; // [foresight]
import { workbenchTools, WORKBENCH_ABOUT, WORKBENCH_WHEN } from './workbench'; // [workbench]
import { highwaysTools } from './highways';
import { homeTools } from './home';
import { homePlanTools, HOMEPLAN_ABOUT, HOMEPLAN_WHEN } from './homeplan'; // [homeplan]
import { photoTools, PHOTO_ABOUT, PHOTO_WHEN } from './photo'; // [photo]
import { designTools } from './design';
import { journeyTools } from './journey';
import { knowledgeTools } from './knowledge';
import { learnTools } from './learn';
import { lensTools } from './lens';
import { libraryTools } from './library';
import { mediaTools } from './media';
import { notifyTools } from './notify';
import { picturesTools } from './pictures';
import { projectTools } from '../projects';
import { crimeTools } from './crime';
import { trafficTools } from './traffic';
import { transitTools } from './transit';
import { mapTools } from './maps';
import { travelTools } from './travel';
import { memoryTools } from './memory';
import { reconTools } from './recon';
import { repoTools } from './repo';
import { reverseTools } from './reverse';
import { scanTools } from './scan';
import { siteTools } from './sites';
import { spotifyTools } from './spotify';
import { studioTools } from './studio';
import type { Tool } from './types';
import { uiTools } from './ui';
import { vehicleTools } from './vehicle';
import { webTools } from './web';
import { widgetTools } from './widgets';
import { moneyTools, MONEY_ABOUT, MONEY_WHEN } from './money'; // [packs] the money pack (BRIEF-PACKS-1)

const CORE: Tool[] = [...memoryTools, ...agendaTools, ...webTools, ...dataTools, ...travelTools, ...journeyTools, ...trafficTools, ...highwaysTools, ...transitTools, ...mapTools, ...crimeTools, ...mediaTools, ...emailTools, ...spotifyTools, ...notifyTools, ...picturesTools, ...uiTools, ...lensTools, ...widgetTools, ...siteTools, ...checkTools, ...knowledgeTools, ...libraryTools, ...evolveTools, ...repoTools, ...reverseTools, ...reconTools, ...projectTools, ...scanTools, ...homeTools, ...vehicleTools, ...gadgetTools, ...studioTools, ...learnTools, ...designTools, ...schoolTools, ...videoTools, ...homePlanTools, ...photoTools, ...placesTools, ...spendingTools, ...guardianTools, ...foresightTools, ...workbenchTools, ...moneyTools]; // [photo] [places] [guardian] [foresight] [workbench] [packs]
const coreNames = new Set(CORE.map((t) => t.name));

export const TOOLS: Tool[] = [...CORE, ...extraTools.filter((t) => t && typeof t.name === 'string' && /^[a-z][a-z0-9_]{1,63}$/.test(t.name) && !coreNames.has(t.name))];

export const toolByName = new Map(TOOLS.map((t) => [t.name, t]));

export function toolSpecs(list: Tool[] = TOOLS): ToolSpec[] {
  return list.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

/**
 * A group of tools offered together. `about` is the one sentence the prompt gives the model
 * about the group ("you can …", naming the tools): it carries the rules the model needs when
 * the group is on, and when it is off the prompt names the group's tools instead. Optional in
 * the type only so a branch that adds a group still compiles before it writes one; the prompt
 * test requires it for every group here.
 */
export interface ToolGroup {
  name: string;
  tools: Tool[];
  /** When the group's tools are described in full: always, on a coding turn, or when the owner's words match. */
  when: RegExp | 'always' | 'code';
  about?: string;
  /**
   * A PACK (BRIEF-PACKS-1: money, body, kitchen): one tool with an `action` enum, named when it is off by these two words
   * ("money pack") instead of its tools, so a pack of twenty abilities costs the plain prompt one short line; its `about`
   * describes the actions when his words turn it on. The first word is the tool's own name.
   */
  short?: string;
}

/**
 * Tool groups, offered to the model only when a message needs them: describing every tool on
 * every request costs ~12,000 tokens, which is most of a free model's per-minute allowance.
 * Any tool can still be called by name (the prompt names every group's tools), and a group
 * stays on once the conversation has used it.
 */
const extras = TOOLS.filter((t) => !coreNames.has(t.name));
export const TOOL_GROUPS: ToolGroup[] = [
  { name: 'memory', tools: memoryTools, when: 'always', about: 'You can remember lasting facts he tells you (remember), list them (list_memory), drop one (forget); forget_everything needs approval.' },
  { name: 'web', tools: webTools, when: 'always', about: 'You can search the web (web_search) and read any page or JSON (web_fetch).' },
  {
    name: 'ui',
    tools: uiTools,
    when: 'always',
    about: 'You can drive the interface (open_tab, fly_to, set_layer, set_theme, set_sensor_mode), follow his drive (road_ahead) and open his camera (open_lens).',
  },
  {
    name: 'widgets',
    tools: widgetTools,
    when: /\b(widget|game|play|app|tool|timer|calculator|converter|tracker|counter|quiz|puzzle|make me|build me|create)/i,
    about: 'You can install instant widgets in the chat (create_widget: one HTML document on the GK kit — games, tools; list_widgets, delete_widget); an app for the Home Screen (tracker, list, timer…) is build_app.',
  },
  { name: 'video', tools: videoTools, when: /\b(youtube|youtu\.be|videos?|transcripts?)\b/i, about: 'You can summarise a YouTube video with timestamped moments that link back to it, and make 5 LEARN quiz cards from it (summarise_video).' },
  { name: 'school', tools: schoolTools, when: /\b(school|exams?|sats|placement test|key stage|gcses?|a-levels?)\b/i, about: "You can report the offline brain's school journey: stage, grades, weak spots (school_status), and tell the owner how to start an exam on the phone (sit_exam)." },
  { name: 'extra', tools: extras, when: 'always', about: 'You can use the extras.' },
  {
    name: 'sites',
    tools: siteTools,
    when: /\b(websites?|site|sites|apps?|mini[- ]?apps?|home ?screen|install|web ?pages?|landing page|home ?page|portfolio|blog|shop|store|storefront|online (?:shop|store|cv|menu)|cv|resume|résumé|invitation|invite|poster|menu page|a page (?:for|about)|put .{0,30}online|url|clone|rebuild|recreate|remake|redesign|copy (this|that|the)|deploy|publish|published|unpublish|take (it|that|.{0,20}) down|host(ing)?|live link|link again)\b|https?:\/\/|\bwww\.|\.(com|co\.uk|io|org|net|dev|app)\b/i,
    // The rule the owner cares about most, so it stays forceful: a page is delivered by its link.
    about: "You can PUBLISH websites: any site — DO IT, never reply that you can't host or publish: study_site, ONE HTML document, publish_site, and ALWAYS give the exact live link. Business, event or charity sites: build_website (never by hand), a DRAFT until confirmed. Apps for his Home Screen: build_app.",
  },
  // The quality gate: also on for every coding turn (selectTools), since every page, app and widget goes through it.
  {
    name: 'build',
    tools: checkTools,
    when: /\b(check|test|verify|review|broken|bug|fix|polish|improve|better|perfect)\b/i,
    about: 'You can check any page, app or widget with check_html before handing it over (broken tags, script errors, what the sandbox blocks, missing basics — line by line); publish_site refuses a page with errors',
  },
  {
    name: 'agenda',
    tools: agendaTools,
    when: /\b(remind|reminder|alarm|wake|schedule|scheduled|calendar|event|agenda|meeting|appointment|diary|today|tomorrow|tonight|week|every|daily|at \d|in \d+ ?(min|hour)|plans?)\b/i,
    about: "You can keep the owner's agenda (add_event, list_agenda, calendar feeds), set reminders and alarms (set_reminder) and do things later or on a schedule yourself (schedule_task; the result arrives as a notification).",
  },
  {
    name: 'data',
    tools: dataTools,
    when: /\b(weather|forecast|rain|snow|temperature|hot|cold|wind|umbrella|quake|earthquake|seismic)\b/i,
    about: "You can give the weather, air quality and 3-day forecast anywhere (weather: a place, or the owner's own lat/lon from CONTEXT) and recent earthquakes (earthquakes).",
  },
  {
    name: 'travel',
    tools: travelTools,
    when: /\b(direction|directions|route|drive|driving|walk|walking|cycle|cycling|bike|near|nearby|nearest|closest|restaurant|cafe|shop|how far|get to|way to|navigate|petrol|station)\b/i,
    about: "You can give directions by car, foot or bike, drawn on the globe (get_directions), and find places nearby (find_nearby); both default to the owner's location.",
  },
  {
    name: 'journeys',
    tools: journeyTools,
    when: /\b(journey|journeys|train|trains|bus|buses|tram|trams|metro|rail|how do i get|get me to|take me to|travel to|next (bus|train|tram)|departures?|leave (at|by)|arrive (at|by)|public transport|commute)\b/i,
    about: 'You can plan door-to-door journeys by bus, tram, train, metro or ferry anywhere, with live times where published, drawn on the map (plan_journey), and list the next departures from any stop (next_departures)',
  },
  {
    name: 'traffic',
    tools: trafficTools,
    when: /\b(tomtom|street data|speeds?|incidents?|cams?|cameras?|cctv|webcams?|traffic|jams?|congestion|roads?|motorway|highway|accidents?|crash|closures?|roadworks|commute|rush hour|live view|god'?s eye|see (it|there|.+) live|street ?views?|street level|look around|walk around|satellite)\b/i,
    about: "You can show live road cameras on God's Eye (show_cameras: the West Midlands motorways, London, Durham, New York, California, Finland, Canada, Sydney; a city's own streets may have none, e.g. Birmingham's — say so plainly and show the nearest motorway camera), live traffic anywhere (traffic_now: Waze, and TomTom speeds with the key) and Street View (street_view).",
  },
  {
    // Motorway incidents and live buses/trams: described only when roads or public transport come up.
    name: 'roads',
    tools: [...highwaysTools, ...transitTools],
    when: /\b(bus|buses|tram|trams|transit|metro|public transport|motorways?|m6|m5|m42|m54|m6 toll|a38|incidents?|junctions?|spaghetti|roadworks|closures?|delays?|traffic)\b/i,
    about: 'You can list live motorway incidents worst first, with delays and when they clear (motorway_now: National Highways), and live buses and trams near a place (transit_now: TfWM/BODS key, else bustimes.org; no trains).',
  },
  {
    name: 'crime',
    tools: crimeTools,
    when: /\b(crimes?|criminal|safe|safety|dangerous|rough area|burglar(y|ies)|robber(y|ies)|theft|thefts|stolen|stabbing|stabbings|assaults?|anti-?social|police|mugging|muggings|shoplifting|drug dealing)\b/i,
    about: 'You can report street crime around any place in England, Wales or Northern Ireland (crime_near: police.uk open data, latest month, by type and street; nobody identified).',
  },
  {
    name: 'maps',
    tools: mapTools,
    when: /\b(maps?|map of|map it|on (the|a) map|3-?d|three-?d|vector map|buildings|elevation|altitude|how high|above sea level|post ?codes?|what(?:'s| is) (?:here|there|this|that|at)|landmarks?|wikipedia|nearby|measure|distance (?:between|from|to)|as the crow flies|crow flies|topo(?:graphic)?|terrain|contours?|cycle (?:map|route)|rail(?:way)? (?:map|lines?)|sea ?marks?|nautical|where is|where'?s)\b/i,
    about: 'You can open flat and 3D maps (show_map: streets, dark, topo, cycle or satellite; rail, sea, rain and camera overlays; view 3d), say what is at a spot (what_is_here), plus elevation, uk_postcode and measure_distance.',
  },
  {
    name: 'email',
    tools: emailTools,
    when: /\b(e-?mails?|inbox|mail|gmail|reply|replied|unread|send (a |an )?(message|note) to)\b/i,
    about: "You can check, search and read the owner's email once linked (check_email, search_email, read_email) and send as them (send_email — always waits for approval).",
  },
  { name: 'media', tools: mediaTools, when: /\b(radio|music|song|songs|play|station|listen|stop audio|stop the music|volume)\b/i, about: 'You can play internet radio in the interface (play_radio: a station name or a genre, optional country) and stop it (stop_audio).' },
  {
    name: 'library',
    tools: libraryTools.filter((t) => t.name === 'library_search'),
    when: 'always',
    about: 'You can search your library (library_search; relevant passages also come in on their own); cite the source.',
  },
  {
    name: 'library-admin',
    tools: libraryTools.filter((t) => t.name !== 'library_search'),
    when: /\b(library|import|arxiv|cve-?\d*|github|paper|papers|repo|repository|save (this|that)|read (this|that)|add (this|that))\b/i,
    about: "You can grow the library (library_import: pages, arXiv, CVEs, GitHub repos, Gutenberg books, 'self'), list it (library_list), report and steer your self-study (study_progress, focus_study), export it (library_export).",
  },
  { name: 'notify', tools: notifyTools, when: /\b(push|notify|notification|notifications|ping|alert me|phone|text me|let me know)\b/i, about: "You can send a push notification to the owner's phone right now (push_to_phone; it is kept in the Agenda inbox too)." },
  {
    name: 'pictures',
    tools: picturesTools,
    when: /\b(picture|image|draw|paint|illustrat|logo|wallpaper|poster|artwork|sketch|render|generate .*(image|picture))/i,
    about: 'You can make pictures (make_picture: write the whole scene out in English yourself — subject, style, light, mood); the chat shows the picture, Telegram gets it as a photo, and the link lasts 7 days.',
  },
  {
    name: 'spotify',
    tools: spotifyTools,
    when: /\b(spotify|song|songs|music|track|album|artist|playlist|playing|pause|skip|next song|previous song|shuffle|volume|queue)\b/i,
    about: "You can see and control the owner's Spotify once linked: spotify_now_playing, spotify_control (pause, skip, volume), spotify_play (track, album, artist, playlist), spotify_queue, spotify_playlists, spotify_devices.",
  },
  {
    name: 'knowledge',
    tools: knowledgeTools,
    when: /\b(study|learn|lessons?|handbook|playbooks?)\b/i,
    about: 'You can study your engineering handbook before building (study: playbooks with exact code for this codebase) and keep lessons from your own mistakes (learn_lesson, list_lessons, forget_lesson).',
  },
  {
    name: 'evolve',
    tools: evolveTools,
    when: /\b(upgrade|improve yourself|better version|roadmap|carry on|continue|audit)\b/i,
    about: 'You can upgrade yourself in steps: self_audit (what you are now), plan_upgrade (a roadmap of small changes that each ship), roadmap (where you are when the owner says "carry on") and update_step.',
  },
  {
    name: 'reverse',
    tools: reverseTools,
    when: /\b(reverse[- ]?engineer(ing)?|decompile|disassemble|analy[sz]e (this|that|the) (app|site|website|package|binary|apk|file)|what is .* built with|how does .* work under the hood|rea\b)/i,
    about: "You can reverse-engineer software the owner owns or may test — a website, an npm package, a GitHub repository or a file link — on GitHub's runners (reverse_engineer, 3–8 minutes; reverse_status, reverse_jobs).",
  },
  {
    name: 'repo',
    tools: repoTools,
    when: /\b(ship|propose|proposed|changes?|versions?|roll ?back|restore|discard|preview|workshop|repo|source code)\b/i,
    about: 'You can change your OWN source code: repo_tree, repo_read, repo_read_many, repo_search to look; propose_change, then wait_for_checks (fix with update_change); ship_change and restore_version need approval.',
  },
  // Projects that run for days (projects.ts): a plan of steps worked through on Ghosty's own schedule.
  {
    name: 'projects',
    tools: projectTools,
    when: /\b(project|over (the next )?(few )?days|in the background|keep working|long task|multi-?day|step by step)\b/i,
    about: 'You can run a project over days on your own schedule (start_project: 3–12 steps, one every few minutes, each result filed in the library; project_status, pause_project, resume_project (a paused one), cancel_project)',
  },
  // Passive infrastructure recon: only when a domain, host, address or one of its words comes up.
  {
    name: 'recon',
    tools: reconTools,
    when: /\b(recon|reconnaissance|dns|whois|rdap|registrar|registered|certificates?|certs?|crt\.sh|subdomains?|wayback|archive\.org|snapshots?|fingerprint|security headers|hsts|open ports?|shodan|spf|dmarc|look ?up|lookup|who (?:owns|runs|hosts)|hosted|hosting|name ?servers?|mx records?|ip address)\b|\b\d{1,3}(?:\.\d{1,3}){3}\b|\b[a-z0-9-]+\.(?:com|co\.uk|org|net|io|dev|app|uk|ac\.uk|gov\.uk|edu|info|me)\b/i,
    about: "You can run passive recon on a domain, host, IP or web address — infrastructure only, never a person (refuse a name or an email address and say why): recon_domain does every public-record check at once; its pieces are dns_lookup, whois_rdap, cert_search, subdomains, wayback_lookup, ip_lookup (servers only, never an address from someone's message) and http_fingerprint.",
  },
  {
    name: 'lens',
    tools: lensTools,
    when: /\b(reverse image|image search|search by image|where is this (?:picture|photo|image) from|picture link|photo link|google lens|tineye|yandex)\b|https?:\/\/\S+\.(?:jpe?g|png|webp|gif)\b|\bidentify_plant\b/i, // [lens] identify_plant: the Lens's NAME IT names the tool in its question
    about: 'You can give reverse image search links for a picture at a public web address (reverse_image_links: Google Lens, Bing Visual Search, Yandex Images and TinEye, each named plainly; never to find who a person is).',
  },
  // SCAN (integrations/lookup.ts): barcode numbers and translation, when the words are about them or a barcode-sized number comes up.
  {
    name: 'scan',
    tools: scanTools,
    when: /\b(barcode|bar code|isbn|ean|upc|qr|scan(?:ned)?|product|nutri-?score|ingredients?|allergens?|translat\w*|in (?:english|spanish|french|german|italian|polish|urdu|arabic|chinese|punjabi|portuguese|romanian)|what language)\b|\b\d{8}(?:\d{4,6})?\b/i,
    about: 'You can say what a barcode number is (lookup_barcode: books by ISBN, food and other products from the open databases — credit them) and translate text (translate_text: free translator).',
  },
  // FIT FINDER (tools/home.ts): furniture, sizes, measuring and making space; DESIGN REVIEW (tools/design.ts): a room plan
  // against UK guidance. (open_space sits in 'ui' with open_lens: naming it here too would push the plain prompt past its 5,500 characters.)
  {
    name: 'home',
    tools: [...homeTools, ...designTools],
    when: /\b(furniture|sofas?|couch(?:es)?|settees?|armchairs?|wardrobes?|beds?|desks?|tables?|bookcases?|tv units?|sideboards?|chests? of drawers|fit|fits|fitting|measure|measured|measurements?|space planner|make space|more space|room layout|floor ?plan|rearrange|design review|review (?:my|the|this) (?:room|plan|design|layout)|interior design|architect\w*|building reg\w*|approved documents?|building control|home office|feel bigger|extension|loft conversion|knock(?:ing)? through|load[- ]bearing)\b/i,
    about: "You can find furniture that fits at UK shops (find_furniture: shops' own prices and sizes; links), lay out a room (open_space) and review a room design against UK guidance (design_review: advice, never approval).",
  },
  // [homeplan] A home or a room from the owner's words (tools/homeplan.ts): the planner's floor plan, and 3-D through the studio.
  { name: 'homeplan', tools: homePlanTools, when: HOMEPLAN_WHEN, about: HOMEPLAN_ABOUT },
  // [photo] Photo jobs on free Spaces (tools/photo.ts): background removed, sharper, a thing erased; never faces.
  { name: 'photo', tools: photoTools, when: PHOTO_WHEN, about: PHOTO_ABOUT },
  // [places] Saved places (tools/places.ts) and spending from statements (tools/spending.ts): no tracking, no bank access.
  { name: 'places', tools: placesTools, when: /\b(address|postcode|my places?|saved places?|(?:home|work|office|school|gym)(?: address)? is\b|forget (?:my |the )?(?:home|work|office|school|gym|place))/i,
    about: "You can save the owner's places (remember_place: look up, show, keep only after his yes; forget_place) — plan_journey and get_directions read them; never a reminder by where he is: no tracking." },
  { name: 'spending', tools: spendingTools, when: /\b(spend|spent|spending|budgets?|subscriptions?|statements?|money|bank|bills?|£\s?\d|pounds|how much did i)\b/i,
    about: 'You can report spending from statements the owner added in Agenda → SPENDING (spending_summary: month, year, changes, subscriptions) and set budgets in his words (set_budget); no bank access, ever.' },
  // [guardian] THE GUARDIAN (guardian.ts, tools/guardian.ts): warnings near his places and a scam check, on by his words only
  // (never always: the plain turn names it, at 35 characters of the 5,500).
  {
    name: 'guardian',
    tools: guardianTools,
    when: /\b(?:floods?|flooding|flooded|(?:weather|storm|wind|rain|snow|fog|ice|flood|severe weather|met office) (?:warnings?|alerts?)|warnings? near|storms?|crime (?:near|round|around|by)|is it safe|safe (?:round|around|near|at|to walk)|legit|scam\w*|phish\w*|dodgy|suspicious (?:link|text|email|message)|fake (?:link|text|email|message|site)|is (?:this|it|that) real|genuine|fraud\w*|smish\w*|walk me home|guardian|named person|panic phrase|emergency phrase)\b/i,
    about: 'You can watch over the owner: flood and weather warnings and crime counts near his saved places (threats_near), and check a link or message for a scam (check_link; never call one safe). "Walk me home" starts his walk.',
  },
  // [foresight] FORESIGHT (foresight.ts, tools/foresight.ts): what Ghosty expects, put on record when he asks, and the record;
  // on by his words only (the plain turn names it: "foresight: foresee", paid for by the shorter ALSO header in prompt.ts).
  { name: 'foresight', tools: foresightTools, when: FORESIGHT_WHEN, about: FORESIGHT_ABOUT },
  // [workbench] THE WORKBENCH (tools/workbench.ts, packages/shared/src/workbench): first engineering estimates, never certified;
  // on by his words only (the plain turn names it: "workbench: estimate", paid for by shorter HEARING and TODAY lines in prompt.ts).
  { name: 'workbench', tools: workbenchTools, when: WORKBENCH_WHEN, about: WORKBENCH_ABOUT },
  // Vehicle check (integrations/vehicle.ts): one car's public MOT record, when its words or a current-style plate come up.
  {
    name: 'vehicle',
    tools: vehicleTools,
    when: /\b(mot|mots|vehicle|vehicles|reg|registration|number ?plates?|plates?|car check|check (?:this|that|a|the|my) (?:car|van|motorbike)|tax(?:ed)?|mileage|dvla|dvsa)\b|\b[a-z]{2}\d{2} ?[a-z]{3}\b/i,
    about: 'You can check ONE UK vehicle by its plate when the owner asks (vehicle_check: MOT history, mileage, advisories; tax with the DVLA key): never the keeper, never several cars, and never remember or file the record.',
  },
  // Gadgets (integrations/gadgets.ts, integrations/parts.ts): best settings and replacement parts, when the words are about them.
  {
    name: 'gadgets',
    tools: gadgetTools,
    when: /\b(speakers?|amp|amps|amplifiers?|soundbars?|settings|eq|equali[sz]er|distort\w*|tv settings|best settings|replacements?|spare parts?|spares|part numbers?|find (?:a |the )?part|manuals?|instructions? (?:book|for use)|rating plate|model number|fault codes?|error codes?|dishwashers?|washing machines?|tumble dryers?|fridges?|freezers?|ovens?|boilers?)\b|\b[EF]\s?:?\s?\d{1,3}\b/i, // [manuals] manuals, rating plates, fault codes and appliances turn the group on (gadget_manual)
    about: "You can get a gadget's best settings from manuals and reviewers (gadget_settings) and a spare part from UK shops with prices (find_part); identify make/model/part number first (study 'gadgets and parts'); never guess.",
  },
  // 3D STUDIO (model3d.ts, features/studio): pictures into 3-D models, and the studio itself.
  // Named "3d" and one tool: the plain-turn prompt names every group's tools within a hard budget.
  {
    name: '3d',
    tools: studioTools,
    when: /\b(3-?d|three[- ]?d|models?|mesh|meshes|glb|gltf|spline|take (?:it |this |that )?apart|exploded view|explode|reconstruct|reassemble|studio|cad|sculpt\w*)\b/i,
    about: 'You can open a real catalogue model or make a 3-D model from words or a photo (make_3d: free, best effort, kept 24 h) or open the 3D STUDIO on a sample, a room in cm or a Spline link.',
  },
  // The tutor (tutor.ts, features/learn): courses, lessons, quizzes and flashcards. One tool, for the same reason as 3d.
  {
    name: 'learn',
    tools: learnTools,
    when: /\b(teach(?:es|ing)? me|learn\w*|lessons?|tutor\w*|quiz(?:zes)? me|test me|flash ?cards?|revis(?:e|ion|ing)|explain (?:it )?like|courses?|spaced repetition)\b/i,
    about: "You can be the owner's patient tutor at their level (tutor: start a course from the library and Wikipedia, give the next lesson with its sources and check question, quiz them, revise flashcards; LEARN tab).",
  },
  // [packs] THE PACKS (BRIEF-PACKS-1): one tool each with an action enum, named off in two words ("money pack"), described on.
  { name: 'money', tools: moneyTools, when: MONEY_WHEN, about: MONEY_ABOUT, short: 'money pack' },
];

/** Groups that are always on while the conversation is about building things. */
const CODE_GROUPS = new Set(['widgets', 'evolve', 'knowledge', 'repo', 'build']);

/**
 * The groups for this request: `on` (always-on groups, groups the words call for, groups
 * already in use, the coding groups on a coding turn) are described in full; `off` groups are
 * named in the prompt so their tools can still be called by name. An empty group is nothing.
 */
export function selectGroups(text: string, used: Set<string>, code = false): { on: ToolGroup[]; off: ToolGroup[] } {
  const on: ToolGroup[] = [];
  const off: ToolGroup[] = [];
  for (const g of TOOL_GROUPS) {
    if (!g.tools.length) continue;
    const pick = g.when === 'always' || (g.when === 'code' ? code : g.when.test(text)) || (code && CODE_GROUPS.has(g.name)) || g.tools.some((t) => used.has(t.name));
    (pick ? on : off).push(g);
  }
  return { on, off };
}

/** The tools to offer for this request (see selectGroups). */
export function selectTools(text: string, used: Set<string>, code = false): Tool[] {
  return selectGroups(text, used, code).on.flatMap((g) => g.tools);
}

export const ALL_TOOL_NAMES = TOOLS.map((t) => t.name).join(', ');
