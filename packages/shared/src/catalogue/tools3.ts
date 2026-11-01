/**
 * The catalogue's words for the brain's tools, part 3 (website records, pictures and plants, barcodes and translation,
 * furniture and rooms, photo jobs, your places, spending, the guardian, foresight, engineering estimates, the vehicle
 * check, gadgets, 3-D and the tutor). Keyed `tool:<name>`. Rules: packages/shared/src/catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';

export const TOOLS_3: Record<string, CatValue> = {
  // ---- website records (never a person)
  'tool:recon_domain': {
    name: 'Everything public about a website', line: 'I can run every public-record check on a website at once: who hosts it, its records, its certificates, its history.',
    more: 'Five to fifteen seconds, all from public records, no scanning and no logins. For websites and servers only: never a person or an email address.',
    say: ['Look up bbc.co.uk', 'Who runs this website?'], scene: ['watching', 'making'], cat: 'watch',
  },
  'tool:dns_lookup': {
    name: 'A website’s DNS records', line: 'I can read a website’s DNS records and whether its email is protected against fakes.',
    more: 'From Google’s public resolver: where it points, its mail servers, and its anti-spoofing settings.',
    say: ['What are the DNS records for example.com?', 'Does this domain protect its email?'], scene: ['watching'], cat: 'watch',
  },
  'tool:whois_rdap': {
    name: 'Who a website is registered with', line: 'I can tell you who a website is registered with, when, and when it runs out.',
    more: 'From the registry’s own public record. The people behind it are never read.',
    say: ['When was example.com registered?', 'Who is this domain registered with?'], scene: ['watching'], cat: 'watch',
  },
  'tool:cert_search': {
    name: 'A website’s certificates', line: 'I can list the security certificates issued for a website, and the other names they reveal.',
    more: 'From the public certificate logs. It can take ten seconds.',
    say: ['What certificates does example.com have?'], scene: ['watching'], cat: 'watch',
  },
  'tool:subdomains': {
    name: 'A website’s other addresses', line: 'I can find the other addresses under a website, like shop. or mail., and where each points.',
    more: 'From the names on its certificates and a public host search. No scanning.',
    say: ['What subdomains does example.com have?'], scene: ['watching'], cat: 'watch',
  },
  'tool:wayback_lookup': {
    name: 'A website years ago', line: 'I can show you what the Wayback Machine has kept of a website: its first and latest snapshots.',
    more: 'From the Internet Archive, with links to open the old pages.',
    say: ['What did bbc.co.uk look like in 2000?', 'When was this site first archived?'], scene: ['watching'], cat: 'know',
  },
  'tool:ip_lookup': {
    name: 'Who a server belongs to', line: 'I can tell you who a server’s address belongs to, where it is and what others have seen open on it.',
    more: 'For servers only, from public records: never an address taken from someone’s message, and never a scan by me.',
    say: ['Who owns the server at 8.8.8.8?'], scene: ['watching'], cat: 'watch',
  },
  'tool:http_fingerprint': {
    name: 'How a website is set up', line: 'I can check how a website answers: where it redirects, what it runs on, which safety settings it is missing.',
    more: 'One ordinary visit, the way a browser makes it, and nothing more.',
    say: ['What is example.com running on?', 'Is this site missing any security headers?'], scene: ['watching'], cat: 'watch',
  },
  // ---- pictures and plants
  'tool:reverse_image_links': {
    name: 'Where a picture came from', line: 'I can give you the four best ways to find where a picture online came from.',
    more: 'Links to Google Lens, Bing, Yandex and TinEye for a picture at a public link. Nothing is uploaded, and never to find out who a person is.',
    say: ['Where is this picture from? (paste its link)'], scene: ['camera'], cat: 'see',
    go: { ask: 'Where is this picture from? ', send: false },
  },
  'tool:identify_plant': {
    name: 'Name a plant from a photo', line: 'I can name a plant from a photo the Lens took: the best match, how sure, its family.',
    more: 'With the free plant service, for photos the Lens’s NAME took. Never for people.',
    say: ['What plant is this?'], scene: ['camera', 'out'], cat: 'see', needs: ['key:plantnet', 'camera'],
    go: { run: 'open_lens', args: { mode: 'name' } },
  },
  // ---- barcodes and translation
  'tool:lookup_barcode': {
    name: 'What a barcode is', line: 'I can tell you what a barcode is: a book’s title and author, or a food’s ingredients, allergens and Nutri-Score.',
    more: 'From the open book and food databases, credited. If none of them knows it, I search the web.',
    say: ['What’s barcode 5449000000996?', 'Look up this ISBN: 9780141439518'], scene: ['camera', 'money'], cat: 'know',
  },
  'tool:translate_text': {
    name: 'Translate anything you type', line: 'I can translate text into dozens of languages: Polish, Urdu, Arabic, Punjabi, Spanish and more.',
    more: 'With a free translator. For a sign or a menu in front of you, the Lens translates from the camera.',
    say: ['Translate “where is the station?” into Polish', 'What does “gracias” mean?'], scene: ['out', 'talking'], cat: 'know',
  },
  // ---- furniture and rooms
  'tool:find_furniture': {
    name: 'Furniture that fits', line: 'I can find furniture at UK shops that fits your space, best fit then cheapest, with links.',
    more: 'IKEA, Argos, Dunelm, John Lewis and more: I read the shops’ own pages for the price and the size. Prices are only ever as the page states them.',
    say: ['Find a sofa under 200 cm wide', 'A desk that fits a 120 cm alcove'], scene: ['making', 'money'], cat: 'build',
  },
  'tool:design_review': {
    name: 'Review a room’s design', line: 'I can review your room plan against UK guidance and suggest up to three checked changes.',
    more: 'Advice with its sources, never building-control approval. SPACE shows the changes as before and after.',
    say: ['Make my bedroom feel bigger', 'Review my home office layout'], scene: ['making'], cat: 'build',
    go: { open: 'space', panel: 'DESIGN REVIEW' },
  },
  'tool:design_home': {
    name: 'Draw a home from your words', line: 'I can draw a room or a whole home from your description, with doors, windows and furniture.',
    more: 'Sizes in any unit; I tell you every size I had to assume and never invent one quietly. It opens in SPACE, and in 3-D in the studio.',
    say: ['Draw me a 4 by 3 metre bedroom with a window', 'My flat has a 5 m lounge and a small kitchen'], scene: ['making'], cat: 'build',
    go: { ask: 'Draw me a ', send: false },
  },
  // ---- photo jobs
  'tool:photo_tool': {
    name: 'Fix up a photo', line: 'I can cut the background out of a photo, make it sharper and bigger, or erase something from it.',
    more: 'On free online services, best effort, never on faces. To erase, you draw over the thing in the photo tools.',
    say: ['Remove the background from this photo', 'Make this photo sharper'], scene: ['camera', 'making'], cat: 'build',
    go: { run: 'open_photo_tools' }, tryText: 'Opens the photo tools',
  },
  // ---- your places
  'tool:remember_place': {
    name: 'Save your places', line: 'I can save your home, work and other places, so journeys and the Brief know them.',
    more: 'I look the address up and show you; nothing is kept until you say yes. I never track where you are.',
    say: ['My home is 10 Broad Street, Birmingham', 'Save my gym'], scene: ['out', 'money'], cat: 'do',
    go: { ask: 'My home address is ', send: false },
  },
  'tool:forget_place': {
    name: 'Forget a saved place', line: 'I can forget a place you saved, or list them all.',
    more: 'Say its name and it goes; journeys and the Brief stop using it.',
    say: ['What places have I saved?', 'Forget my old work address'], scene: ['out'], cat: 'do',
  },
  // ---- spending
  'tool:spending_summary': {
    name: 'Where your money went', line: 'I can tell you where your money went: a month by category, the year, what changed, your subscriptions.',
    more: 'From the bank statements you add yourself. No bank access, ever.',
    say: ['How much did I spend this month?', 'What subscriptions am I paying for?'], scene: ['money'], cat: 'watch', needs: ['statement'],
  },
  'tool:set_budget': {
    name: 'Set a budget', line: 'I can set a monthly budget in your own words, like £200 a month on eating out.',
    more: 'A week or a year is turned into a month; £0 removes it. The Agenda’s SPENDING shows the bars.',
    say: ['£200 a month on eating out', 'Budget £50 a week for petrol'], scene: ['money'], cat: 'watch', needs: ['statement'],
    go: { ask: 'Set a budget of £', send: false },
  },
  // ---- the guardian
  'tool:threats_near': {
    name: 'Warnings near your places', line: 'I can tell you what is active near your saved places: flood warnings, severe weather, street crime.',
    more: 'Flood alerts within 5 km, Met Office warnings for each place’s area, and the latest month of crime within a mile. I check every hour by myself and tell you once when something new starts.',
    say: ['Any warnings near home?', 'Is there flooding near my places?'], scene: ['watching'], cat: 'watch', needs: ['places'],
  },
  'tool:check_link': {
    name: 'Is this a scam?', line: 'I can check a link or a message for a scam: the website’s age, look-alikes of real brands, the block lists.',
    more: 'From public records, no keys. I say "looks like a scam", "be careful" or "I can’t find anything wrong — that isn’t proof", and never call anything safe. On Telegram, forward me the message.',
    say: ['Is this a scam? (paste the text)', 'Is this link real?'], scene: ['watching'], cat: 'watch',
    go: { ask: 'Is this a scam? ', send: false }, tryText: 'Starts “Is this a scam?” in the chat box: paste the message',
  },
  // ---- foresight
  'tool:foresee': {
    name: 'Say what I expect, on record', line: 'I can tell you what I expect will happen and put it on record, so you can see if I was right.',
    more: 'Weather, roads, timetables, prices, your plans: never about a person. I check it myself when the day comes, or you tell me "you were right".',
    say: ['Will it rain on Saturday?', 'Will the train be on time tomorrow?'], scene: ['morning', 'watching'], cat: 'know',
  },
  // ---- engineering estimates
  'tool:estimate': {
    name: 'Engineering first estimates', line: 'I can work out a first engineering estimate: a beam, gears, an engine, a wing, heat loss, a circuit.',
    more: 'From textbook formulae, with the method and what I assumed. Always a first estimate, never certified: for anything that holds weight, a chartered engineer signs it, not me.',
    say: ['Will a 3 m steel beam hold 5 kN in the middle?', 'What resistor for an LED on 5 volts?'], scene: ['making'], cat: 'build',
  },
  // ---- the vehicle check
  'tool:vehicle_check': {
    name: 'A car’s MOT history', line: 'I can check one UK car by its plate: its MOT history, mileage, advisories, recalls and tax.',
    more: 'Only when you ask, one car at a time, and never the keeper. Nothing is kept afterwards. A mileage that went down is flagged.',
    say: ['Check the MOT on this plate', 'Is this car taxed?'], scene: ['out', 'money'], cat: 'know', needs: ['key:dvsa', 'key:dvla'],
    go: { run: 'vehicle_check' }, tryText: 'Opens the vehicle check: you type the plate',
  },
  // ---- gadgets
  'tool:gadget_settings': {
    name: 'Best settings for a gadget', line: 'I can find the best settings for your TV, speaker or headphones, from the manual and real reviewers.',
    more: 'Only settings someone has published, each with its source. Tell me the make and model first.',
    say: ['Best picture settings for an LG C3?', 'Best EQ for a Sonos Beam?'], scene: ['making'], cat: 'know',
  },
  'tool:find_part': {
    name: 'Find a spare part', line: 'I can find a spare part for sale in the UK, the exact match first, then the cheapest, with links.',
    more: 'Amazon, Screwfix, Toolstation and more. The part number printed on the part gets the best match. I never buy anything.',
    say: ['Find a filter for a Bosch SMS24AW01G', 'Replacement remote for a Samsung TV'], scene: ['making', 'money'], cat: 'know',
  },
  'tool:gadget_manual': {
    name: 'A gadget’s manual and fault codes', line: 'I can find a gadget’s manual and tell you what a fault code means, from its own pages.',
    more: 'The maker’s own PDF, kept in the Library under GADGETS; I say which page. If the manual does not say, I look on the web and tell you so.',
    say: ['What does E24 mean on my Bosch dishwasher?', 'Find the manual for my boiler'], scene: ['making', 'money'], cat: 'know',
  },
  // ---- 3-D
  'tool:make_3d': {
    name: 'Make a 3-D model', line: 'I can make a 3-D model from words or a photo, then turn it, take it apart and measure it.',
    more: 'A real model from a catalogue of thousands when one fits, otherwise I make one, free and best effort. It opens in the 3D studio and is kept for a day.',
    say: ['Make me a 3-D model of a wooden chair', 'Turn this photo into a 3-D model'], scene: ['making'], cat: 'build', needs: ['key:huggingface'],
  },
  // ---- the tutor
  'tool:tutor': {
    name: 'Teach you anything', line: 'I can teach you anything at your level: a course, lessons with sources, quizzes and flashcards.',
    more: 'Say "teach me…" and I plan a course from my library and Wikipedia. Each lesson ends with a check question, and flashcards come back when you are about to forget them.',
    say: ['Teach me how the stock market works', 'Quiz me on what we did yesterday'], scene: ['school'], cat: 'learn',
  },
};
