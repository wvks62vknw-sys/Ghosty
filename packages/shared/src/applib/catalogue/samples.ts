import type { AppDef } from '../types';

/**
 * THE PRO ROUND's extra first-run records (the DATA lane): invented, varied and recent, so an essential tracker opens with
 * five to eight records and its hero, stats and charts already look alive. pro() adds them after the app's own samples.
 */
export const MORE_SAMPLES: Record<string, NonNullable<AppDef['sample']>> = {
  "read-later": [
    {"title": "How tides are forecast a year ahead", "url": "https://example.com/tide-tables", "site": "A science magazine", "minutes": 14, "status": "Finished", "tags": ["Science", "Long read"], "favourite": true, "saved": "2026-11-03", "highlights": "Harmonic constituents add up like notes in a chord."},
    {"title": "A simple guide to index funds", "url": "https://example.com/index-funds", "site": "A money newsletter", "minutes": 7, "status": "Reading", "tags": ["Money", "How-to"], "saved": "2026-11-10"},
  ],
  writer: [
    {"scene": "Fog on the causeway", "chapter": 3, "status": "Draft", "pov": "Tom", "synopsis": "Tom crosses at low tide and meets someone who should not be there.", "words": 1980, "written": "2026-11-12"},
    {"scene": "The keeper’s logbook", "chapter": 4, "status": "Outlined", "pov": "Mara", "synopsis": "An entry from 1953 matches the letter word for word.", "words": 0, "written": "2026-11-14"},
  ],
  capture: [
    {"text": "Ask Priya for the slides from Tuesday", "kind": "Email", "filed": false, "when": "2026-11-14"},
    {"text": "Dentist on the 2nd at 9.40", "kind": "Event", "filed": true, "when": "2026-12-02"},
  ],
  goals: [
    {"result": "Save £3,000 for the house fund", "goal": "Grow savings", "area": "Money", "quarter": "Q4", "target": 3000, "current": 2150, "progress": 72, "status": "On track", "checkin": "2026-11-28"},
    {"result": "Finish the statistics course", "goal": "Learn data skills", "area": "Learning", "quarter": "Q4", "target": 34, "current": 12, "progress": 35, "status": "At risk", "checkin": "2026-11-21", "note": "Two lectures a week to catch up."},
  ],
  timesheet: [
    {"work": "Client call and notes", "project": "Website refresh", "client": "Harbour Bakery", "day": "2026-11-12", "start": "14:00", "length": 45, "billable": true, "rate": 45, "tag": "Meetings"},
    {"work": "Invoices and email", "project": "Running the business", "day": "2026-11-11", "start": "16:30", "length": 40, "billable": false, "tag": "Admin"},
  ],
  "meeting-notes": [
    {"title": "One to one with Sam", "day": "2026-11-06", "start": "15:00", "kind": "One to one", "people": "Sam", "agenda": "Workload, training, holiday", "decisions": "Sam leads the next sprint review.", "actions": "Me: book the course for January.", "follow_up": "2026-12-04"},
    {"title": "Kitchen quote walk-round", "day": "2026-11-09", "start": "11:30", "kind": "Client", "people": "The fitter and me", "notes": "Worktops in oak, sink under the window.", "actions": "Fitter: written quote by Friday.", "follow_up": "2026-11-20"},
    {"title": "Launch plan review", "day": "2026-11-13", "start": "09:30", "kind": "Project", "people": "Project group", "agenda": "Timeline, risks, comms", "decisions": "Soft launch on 1 December.", "actions": "Me: draft the customer email."},
  ],
  books: [
    {"title": "Small Hours", "author": "J. Okafor", "shelf": "Reading", "kind": "Crime", "format": "E-book", "pages": 388, "page_now": 214, "started": "2026-11-04"},
    {"title": "The Map of Rain", "author": "L. Hart", "shelf": "Want to read", "kind": "Fantasy", "format": "Paper", "pages": 512},
  ],
  "job-hunt": [
    {"role": "Senior UX Designer", "employer": "A health charity", "stage": "Applied", "salary": 48000, "location": "Remote", "applied": "2026-11-09", "next_step": "Wait to hear back", "fit": 4},
    {"role": "Design Lead", "employer": "A city council digital team", "stage": "Saved", "salary": 58000, "location": "Office", "next_date": "2026-11-20", "next_step": "Closing date, finish cover letter", "fit": 3},
  ],
  "expense-claims": [
    {"item": "Lunch with the client team", "day": "2026-11-06", "amount": 42.5, "category": "Meals", "project": "Booking system", "status": "Claimed"},
    {"item": "Hotel, one night", "day": "2026-10-28", "amount": 96, "category": "Hotel", "project": "Booking system", "status": "Paid"},
  ],
  "mileage-log": [
    {"purpose": "Training day", "day": "2026-11-05", "from_place": "Home", "to_place": "Head office", "miles": 31.4, "return_trip": true, "vehicle": "Car", "claimed": true},
    {"purpose": "Supplier meeting", "day": "2026-11-10", "from_place": "Office", "to_place": "Supplier yard", "miles": 12.8, "return_trip": true, "vehicle": "Car", "claimed": false},
    {"purpose": "Site survey", "day": "2026-10-29", "from_place": "Home", "to_place": "New site", "miles": 58.0, "return_trip": false, "vehicle": "Van", "claimed": true},
  ],
  "leave-tracker": [
    {"first_day": "2026-08-17", "days": 10, "kind": "Annual leave", "approved": true, "note": "Summer in Cornwall"},
    {"first_day": "2026-12-24", "days": 3, "kind": "Annual leave", "approved": true, "note": "Christmas"},
  ],
  "idea-bank": [
    {"idea": "A short guide for new starters in the team", "area": "Work", "stage": "Trying", "impact": 4, "effort": 3, "had": "2026-10-30"},
    {"idea": "Sell prints of the coastal sketches", "area": "Business", "stage": "Raw", "impact": 3, "effort": 4, "had": "2026-11-12"},
    {"idea": "Photo book of Dad’s allotment year", "area": "Gift", "stage": "Worth a look", "impact": 5, "effort": 3, "had": "2026-11-02"},
  ],
  "song-ideas": [
    {"title": "Last Train South", "stage": "Drafting", "key": "A minor", "bpm": 118, "mood": "Restless", "chords": "Am F C G", "parts": ["Verse", "Chorus"], "date": "2026-11-07"},
    {"title": "Kitchen Light", "stage": "Spark", "key": "D", "bpm": 76, "mood": "Tender", "parts": ["Verse"], "lyrics": "You left the kitchen light on", "date": "2026-11-13"},
  ],
  "practice-log": [
    {"date": "2026-11-12", "piece": "Major scales, two octaves", "instrument": "Guitar", "mins": 15, "bpm": 96, "focus": "Scales", "feel": 3},
    {"date": "2026-11-10", "piece": "Autumn waltz", "instrument": "Piano", "mins": 40, "bpm": 72, "focus": "Repertoire", "feel": 4, "next": "Left hand alone, bars 20 to 28"},
  ],
  palettes: [
    {"name": "Forest Floor", "colours": "#2F3E2E #5B7553 #A3B18A #DAD7CD #8C5E3C", "harmony": "Analogous", "use": ["Interior"], "fave": false},
    {"name": "Night Market", "colours": "#1B1B3A #693668 #A74482 #F84AA7 #FF3562", "harmony": "Split complementary", "use": ["Illustration", "Print"], "fave": true},
    {"name": "Paper and Ink", "colours": "#F7F4EA #DED9C4 #6E6A5E #2B2A27", "harmony": "Monochrome", "use": ["Brand", "Web"], "fave": false},
  ],
  "camera-kit": [
    {"item": "35 mm prime lens", "kind": "Lens", "serial": "LN88021", "bought": "2024-06-02", "price": 449, "value": 360, "condition": "As new"},
    {"item": "Carbon travel tripod", "kind": "Tripod", "bought": "2023-11-20", "price": 189, "value": 110, "condition": "Worn"},
  ],
  "writing-log": [
    {"date": "2026-11-12", "project": "The Lighthouse Keeper", "words": 890, "mins": 40, "kind": "Drafting", "flow": 3},
    {"date": "2026-11-10", "project": "Short story for the competition", "words": 420, "mins": 35, "kind": "Editing", "flow": 4, "note": "Cut the opening by half"},
  ],
  "story-bible": [
    {"name": "Gull Rock", "kind": "Place", "role": "Supporting", "look": "Black rock, white with birds", "first": "Chapter 2", "details": "Cut off at high tide twice a day."},
    {"name": "Tom Penhale", "kind": "Character", "role": "Supporting", "look": "Tall, oilskin coat", "want": "To buy the lighthouse", "first": "Chapter 3"},
  ],
  sketchbook: [
    {"title": "Gulls on the harbour wall", "medium": "Pencil", "subject": "Animal", "mins": 15, "date": "2026-11-11", "rating": 3},
    {"title": "Self-portrait in the window", "medium": "Charcoal", "subject": "Portrait", "mins": 45, "date": "2026-11-08", "rating": 4, "note": "Shadows too heavy on the left."},
  ],
  "art-portfolio": [
    {"title": "Harbour at Dusk", "medium": "Watercolour", "size": "A3", "year": 2026, "price": 220, "status": "Available", "where": "Studio"},
    {"title": "Tide Line II", "medium": "Oil on canvas", "size": "60 × 60 cm", "year": 2026, "price": 850, "status": "On show", "where": "Town gallery winter show"},
  ],
  commissions: [
    {"piece": "House portrait, A3", "client": "Ruth", "stage": "Sketch", "price": 180, "deposit": 60, "paid": false, "due": "2026-12-12"},
    {"piece": "Wedding card illustration", "client": "Ali and Jo", "stage": "Delivered", "price": 90, "deposit": 30, "paid": true, "due": "2026-10-30"},
  ],
  "craft-projects": [
    {"name": "Patchwork cot quilt", "craft": "Quilting", "stage": "Queued", "pattern": "Simple squares", "materials": "Fat quarters in greens", "progress": 0, "cost": 38, "for": "Baby Iris"},
    {"name": "Ribbed hat", "craft": "Knitting", "stage": "Finished", "pattern": "Two by two rib", "materials": "1 ball chunky wool", "progress": 100, "cost": 9, "start": "2026-10-20", "for": "Dad"},
  ],
  "gig-diary": [
    {"venue": "Castle Hotel", "date": "2026-11-07", "time": "19:00", "kind": "Wedding", "fee": 450, "mins": 150, "status": "Played", "rating": 5},
    {"venue": "The Crown", "date": "2026-11-12", "time": "20:00", "kind": "Open mic", "fee": 0, "mins": 15, "status": "Played", "rating": 3, "note": "Tried the new song."},
  ],
  "film-diary": [
    {"title": "Small Planets", "year": 2024, "date": "2026-11-01", "where": "Home", "genre": "Animation", "rating": 5, "rewatch": true},
    {"title": "The Quiet Floor", "year": 2026, "date": "2026-11-12", "where": "Cinema", "genre": "Thriller", "rating": 3, "rewatch": false, "review": "Tense first hour, lost its nerve."},
    {"title": "Salt and Iron", "year": 2023, "date": "2026-10-26", "where": "Home", "genre": "Documentary", "rating": 4, "rewatch": false},
  ],
  "game-backlog": [
    {"title": "Skyward Gardens", "platform": "Handheld", "status": "Finished", "genre": "Puzzle", "hours": 22, "rating": 5, "finished": "2026-11-02"},
    {"title": "Iron Rally", "platform": "Console", "status": "Backlog", "genre": "Racing"},
  ],
  "exam-planner": [
    {"topic": "Quadratic equations", "subject": "Maths", "stage": "Secure", "confidence": 5, "review": "2026-11-28", "score": 88, "exam": "2027-05-21"},
    {"topic": "Cell structure", "subject": "Biology", "stage": "To learn", "confidence": 2, "review": "2026-11-15", "exam": "2027-05-12"},
  ],
  "course-tracker": [
    {"course": "Beginners’ Spanish", "kind": "Evening class", "subject": "Languages", "status": "In progress", "done": 7, "total": 20, "hours": 14, "target": "2027-03-31", "rating": 4},
    {"course": "Intro to Python", "kind": "Online course", "subject": "Coding", "status": "Finished", "done": 24, "total": 24, "hours": 30, "rating": 5},
  ],
  "vocabulary-book": [
    {"word": "le chantier", "meaning": "Building site", "language": "French", "example": "Il y a un chantier devant chez moi.", "source": "A podcast", "date": "2026-11-10", "stage": "Learning"},
    {"word": "die Ausfahrt", "meaning": "Exit (on a road)", "language": "German", "date": "2026-11-08", "stage": "Known"},
    {"word": "la sobremesa", "meaning": "Talking at the table after a meal", "language": "Spanish", "source": "Class", "date": "2026-11-12", "stage": "New"},
  ],
  "study-log": [
    {"subject": "Spanish", "date": "2026-11-12", "minutes": 25, "kind": "Cards", "focus": 7},
    {"subject": "Python", "date": "2026-11-10", "minutes": 60, "kind": "Project", "focus": 9, "learned": "Dictionaries keep the order you add keys."},
  ],
  "food-log": [
    {"food": "Chicken and lentil soup", "meal": "Lunch", "kcal": 420, "protein": 32, "carbs": 38, "fat": 12, "fibre": 9, "date": "2026-11-14"},
    {"food": "Apple and peanut butter", "meal": "Snack", "kcal": 210, "protein": 6, "carbs": 22, "fat": 12, "fibre": 4, "date": "2026-11-13"},
  ],
  meds: [
    {"name": "Vitamin D", "strength": "10 micrograms", "status": "Taken", "date": "2026-11-13", "time": "08:10", "left": 42},
    {"name": "Hay fever tablet", "strength": "10 mg", "status": "Skipped", "date": "2026-11-12", "notes": "Not needed today"},
    {"name": "Vitamin D", "strength": "10 micrograms", "status": "Late", "date": "2026-11-12", "time": "12:20", "left": 43, "refill": "2026-12-20"},
  ],
  "progress-photos": [
    {"date": "2026-11-07", "pose": "Front", "weight": 81.8, "waist": 87, "chest": 101, "arm": 34.3},
    {"date": "2026-10-31", "pose": "Side", "weight": 82.3, "waist": 88, "chest": 100.5, "arm": 34.2},
    {"date": "2026-10-24", "pose": "Front", "weight": 82.9, "waist": 89, "chest": 100.5, "arm": 34},
  ],
  "ride-log": [
    {"route": "Commute in", "kind": "Commute", "distance": 11.4, "time": 38, "climb": 90, "feel": 3, "date": "2026-11-12"},
    {"route": "Forest trails", "kind": "Gravel", "distance": 32.6, "time": 105, "climb": 420, "feel": 5, "date": "2026-11-08"},
    {"route": "Turbo intervals", "kind": "Indoor", "distance": 24, "time": 45, "climb": 0, "feel": 3, "date": "2026-11-10"},
  ],
  symptoms: [
    {"symptom": "Lower back ache", "severity": 4, "where": "Back", "date": "2026-11-10", "time": "18:00", "lasted": 240, "helped": "Walk and stretches"},
    {"symptom": "Itchy eyes", "severity": 3, "where": "Eyes", "date": "2026-11-07", "time": "10:15", "lasted": 60},
    {"symptom": "Headache", "severity": 3, "where": "Head", "date": "2026-11-03", "time": "16:45", "lasted": 90, "helped": "Water"},
  ],
  fasting: [
    {"date": "2026-11-12", "start": "19:30", "plan": "16 h", "hours": 15.5, "feel": 3},
    {"date": "2026-11-10", "start": "20:00", "plan": "13 h", "hours": 13, "feel": 5},
    {"date": "2026-11-08", "start": "19:00", "plan": "18 h", "hours": 17.25, "feel": 3, "notes": "Hungry by 11"},
  ],
  drinks: [
    {"drink": "Green tea", "kind": "Tea", "caffeine": 30, "units": 0, "date": "2026-11-14", "time": "10:30"},
    {"drink": "Pint of bitter", "kind": "Beer", "caffeine": 0, "units": 2.3, "date": "2026-11-13", "time": "19:30"},
  ],
  "meal-planner": [
    {"dish": "Vegetable chilli", "meal": "Dinner", "date": "2026-11-17", "kcal": 520, "cook": 45, "style": ["Vegetarian", "Batch"]},
    {"dish": "Overnight oats", "meal": "Breakfast", "date": "2026-11-17", "kcal": 350, "cook": 5, "style": ["Quick"]},
  ],
  houseplants: [
    {"plant": "Snake plant", "room": "Bedroom", "light": "Low", "every": 21, "watered": "2026-11-01", "next": "2026-11-22"},
    {"plant": "Fiddle-leaf fig", "room": "Conservatory", "light": "Bright indirect", "every": 10, "watered": "2026-11-08", "next": "2026-11-18", "notes": "Turn it a quarter each week"},
  ],
  "weight-log": [
    {"kg": 81.5, "date": "2026-11-11", "time": "07:10"},
    {"kg": 81.9, "date": "2026-11-07", "time": "07:00"},
  ],
  "blood-pressure": [
    {"sys": 128, "dia": 82, "pulse": 70, "arm": "Left", "date": "2026-11-12", "time": "07:35"},
    {"sys": 119, "dia": 77, "pulse": 64, "arm": "Left", "date": "2026-11-10", "time": "07:25"},
    {"sys": 131, "dia": 84, "pulse": 72, "arm": "Right", "date": "2026-11-07", "time": "21:10", "note": "After a long day"},
  ],
  "sleep-diary": [
    {"date": "2026-11-12", "bed": "23:40", "wake": "06:50", "hours": 6.75, "woke": 2, "rested": 5, "tags": ["Screens", "Late caffeine"]},
    {"date": "2026-11-10", "bed": "22:30", "wake": "06:30", "hours": 7.75, "woke": 0, "rested": 8, "tags": ["Exercise"]},
    {"date": "2026-11-08", "bed": "00:15", "wake": "08:00", "hours": 7.25, "woke": 1, "rested": 6, "tags": ["Alcohol", "Late meal"]},
  ],
  "wine-cellar": [
    {"wine": "Coastal Sauvignon Blanc", "producer": "Hillside Estate", "vintage": 2024, "region": "Marlborough", "grape": "Sauvignon Blanc", "colour": "White", "bottles": 4, "rating": 4, "price": 11.5, "drinkby": "2026-12-31", "notes": "Crisp and zesty, good with fish."},
    {"wine": "Vintage Reserve Port", "producer": "Quinta da Serra", "vintage": 2011, "region": "Douro", "grape": "Touriga Nacional", "colour": "Fortified", "bottles": 1, "rating": 5, "price": 42, "drinkby": "2035-01-01", "notes": "Saving this one for Christmas."},
  ],
  "coffee-brews": [
    {"beans": "Colombian house blend", "method": "Espresso", "dose": 18, "water": 36, "grind": "Fine", "secs": 28, "rating": 4, "date": "2026-11-12", "notes": "Rich caramel, slightly bitter finish."},
    {"beans": "Natural Brazilian", "method": "Cafetière", "dose": 30, "water": 500, "grind": "Coarse", "secs": 240, "rating": 3, "date": "2026-11-07", "notes": "A bit muddy, try a coarser grind."},
    {"beans": "Kenyan single origin", "method": "Aeropress", "dose": 16, "water": 220, "grind": "Medium", "secs": 120, "rating": 5, "date": "2026-10-29", "notes": "Blackcurrant notes, really juicy."},
  ],
  receipts: [
    {"shop": "Electronics shop", "items": "Wireless headphones", "date": "2026-10-30", "total": 89.99, "vat": 15, "category": "Tech", "returnby": "2026-11-29", "warranty": "2028-10-30", "business": false},
    {"shop": "Stationery shop", "items": "Printer paper, notebooks, pens", "date": "2026-11-11", "total": 18.45, "vat": 3.08, "category": "Business", "returnby": "2026-12-11", "business": true},
  ],
  subscriptions: [
    {"service": "Cloud photo storage", "monthly": 2.99, "renews": "2026-11-28", "kind": "Cloud", "trial": false, "status": "Keep", "link": "https://example.com/storage"},
    {"service": "Gym membership", "monthly": 34, "renews": "2026-12-01", "kind": "Fitness", "trial": false, "status": "Review", "link": "https://example.com/gym"},
  ],
  "spending-diary": [
    {"amount": 42.8, "what": "Weekly food shop", "category": "Food", "date": "2026-11-09", "need": true},
    {"amount": 12.5, "what": "Cinema ticket", "category": "Fun", "date": "2026-11-01", "need": false},
  ],
  "savings-pots": [
    {"pot": "Holiday", "amount": 200, "date": "2026-10-28", "note": "Summer trip fund"},
    {"pot": "Gifts", "amount": 50, "date": "2026-11-07", "note": "Christmas presents"},
  ],
  ious: [
    {"who": "Priya", "amount": 18.5, "way": "I Owe", "what": "Share of the taxi", "date": "2026-11-08", "settled": false},
    {"who": "Tom", "amount": 30, "way": "Owed To Me", "what": "Birthday meal", "date": "2026-10-25", "settled": true},
    {"who": "Jess", "amount": 12, "way": "I Owe", "what": "Coffee and cake", "date": "2026-11-12", "settled": false},
  ],
  "meter-readings": [
    {"meter": "Gas", "reading": 6721, "date": "2026-11-01", "sent": true},
    {"meter": "Water", "reading": 482, "date": "2026-11-10", "sent": false},
  ],
  "home-inventory": [
    {"item": "Laptop", "room": "Office", "value": 1100, "bought": "2025-08-19", "serial": "LT-58201-KX"},
    {"item": "Washing machine", "room": "Kitchen", "value": 420, "bought": "2023-11-04", "serial": "WM-77310"},
  ],
  payslips: [
    {"date": "2026-09-26", "gross": 2980, "tax": 386.6, "ni": 154.56, "pension": 149, "loan": 0, "net": 2289.84, "code": "1257L"},
    {"date": "2026-08-28", "gross": 2680, "tax": 326.6, "ni": 130.56, "pension": 134, "loan": 0, "net": 2088.84, "code": "1257L"},
    {"date": "2026-07-28", "gross": 2615, "tax": 313.6, "ni": 125.36, "pension": 130.75, "loan": 0, "net": 2045.29, "code": "1257L"},
  ],
  invoices: [
    {"number": "INV-0042", "client": "Riverside Florist", "amount": 350, "vat": 0, "issued": "2026-10-27", "due": "2026-11-26", "status": "Sent", "work": "Logo refresh and business cards"},
    {"number": "INV-0040", "client": "Hilltop Garage", "amount": 620, "vat": 0, "issued": "2026-09-30", "due": "2026-10-30", "status": "Paid", "work": "New website homepage and contact page"},
  ],
  "business-books": [
    {"date": "2026-11-06", "what": "Monthly phone bill", "amount": 24, "category": "Phone And Web"},
    {"date": "2026-10-29", "what": "Train to client meeting", "amount": 38.6, "category": "Travel"},
  ],
  "returns-tracker": [
    {"shop": "Homeware site", "item": "Cushion covers, set of two", "amount": 22, "bought": "2026-10-26", "returnby": "2026-11-25", "status": "Sent Back"},
    {"shop": "Shoe shop", "item": "Leather boots, size 7", "amount": 95, "bought": "2026-10-18", "returnby": "2026-11-17", "status": "Refunded"},
    {"shop": "Department store", "item": "Wool jumper", "amount": 48, "bought": "2026-11-02", "returnby": "2026-12-02", "status": "Kept"},
  ],
  "home-maintenance": [
    {"job": "Test smoke alarms", "area": "Safety", "last": "2026-10-15", "due": "2027-01-15", "who": "Me", "cost": 0, "pro": false},
    {"job": "Clear the gutters", "area": "Outside", "last": "2025-11-08", "due": "2026-11-22", "who": "Local handyman", "cost": 60, "pro": true},
  ],
  renting: [
    {"what": "Monthly rent paid", "kind": "Rent", "date": "2026-11-01", "status": "Noted", "amount": 950, "reply": "Standing order went out as normal"},
    {"what": "Dripping kitchen tap", "kind": "Repair", "date": "2026-10-22", "fixed": "2026-10-29", "status": "Fixed", "reply": "Plumber replaced the washer"},
    {"what": "Six-monthly inspection", "kind": "Inspection", "date": "2026-11-25", "status": "Booked", "reply": "Agent visiting mid-morning"},
  ],
  "diy-projects": [
    {"project": "Put up bedroom shelves", "room": "Bedroom", "budget": 60, "spent": 44, "hours": 3, "level": "Easy", "stage": "Done", "start": "2026-10-31", "notes": "Used heavy-duty wall plugs."},
    {"project": "Regrout the shower", "room": "Bathroom", "budget": 40, "spent": 18, "hours": 2, "level": "Medium", "stage": "Doing", "start": "2026-11-08", "notes": "Grey grout to match the tiles."},
    {"project": "Build a raised vegetable bed", "room": "Garden", "budget": 150, "spent": 0, "hours": 0, "level": "Medium", "stage": "Planning", "start": "2026-11-14", "notes": "Measure the sunny corner first."},
  ],
  "fuel-log": [
    {"date": "2026-11-01", "litres": 36.8, "cost": 51.2, "odo": 41408, "trip": 398, "station": "Supermarket forecourt", "full": true},
    {"date": "2026-10-24", "litres": 40.1, "cost": 56.4, "odo": 41010, "trip": 431, "station": "Motorway services", "full": true},
    {"date": "2026-10-14", "litres": 20, "cost": 27.9, "odo": 40579, "trip": 205, "station": "Village garage", "full": false},
  ],
  countdowns: [
    {"event": "Mum's birthday", "date": "2026-12-03", "kind": "Birthday", "yearly": true},
    {"event": "Tax return deadline", "date": "2027-01-31", "kind": "Deadline", "yearly": true},
    {"event": "Jazz night at the town hall", "date": "2026-11-28", "kind": "Gig", "yearly": false},
  ],
  parcels: [
    {"what": "Winter coat", "from": "Clothing site", "tracking": "TRK 5530 1127", "carrier": "Postal service", "due": "2026-11-14", "status": "Out Today"},
    {"what": "Kitchen scales", "from": "Homeware shop", "tracking": "TRK 3302 8841", "carrier": "Courier", "due": "2026-11-11", "status": "Delivered"},
    {"what": "Phone case", "from": "Online marketplace", "tracking": "TRK 9017 2245", "carrier": "Courier", "due": "2026-11-19", "status": "Ordered"},
  ],
  "keep-in-touch": [
    {"name": "Grandma", "often": "Weekly", "how": "Call", "spoke": "2026-11-09", "next": "2026-11-16", "topics": "Her garden and the church fair"},
    {"name": "Chris from old job", "often": "Every 3 months", "how": "In person", "spoke": "2026-09-20", "next": "2026-12-20", "topics": "Catch up over lunch in town"},
    {"name": "Aunt Ruth", "often": "Monthly", "how": "Video", "spoke": "2026-10-26", "next": "2026-11-26", "topics": "Plans for Christmas"},
  ],
  "gift-planner": [
    {"gift": "Knitted scarf", "person": "Dad", "occasion": "Christmas", "status": "Idea", "price": 30, "hidden": "Top of the wardrobe", "date": "2026-12-25", "link": "https://example.com/scarf"},
    {"gift": "Personalised photo book", "person": "Ella", "occasion": "Birthday", "status": "Wrapped", "price": 25, "hidden": "Under the bed", "date": "2026-11-20", "link": "https://example.com/photobook"},
  ],
  "bucket-list": [
    {"goal": "Learn to play the piano", "category": "Learn", "status": "Dreaming", "year": 2028},
    {"goal": "Run a half marathon", "category": "Fitness", "status": "Done", "year": 2026, "done": "2026-10-11", "memory": "Crossed the line in just under two hours."},
  ],
  "family-calendar": [
    {"event": "Parents' evening", "who": "Everyone", "date": "2026-11-19", "time": "18:00", "length": 60, "repeat": "Once", "place": "Primary school", "notes": "Bring the reading record."},
    {"event": "Football practice", "who": "Child 2", "date": "2026-11-15", "time": "10:00", "length": 90, "repeat": "Weekly", "place": "Park pitches", "notes": "Pack shin pads and water."},
  ],
  chores: [
    {"chore": "Feed the cat", "who": "Child 2", "points": 1, "earned": 0.25, "paid": true, "date": "2026-11-12"},
    {"chore": "Tidy the bedroom", "who": "Child 1", "points": 3, "earned": 1, "paid": false, "date": "2026-11-13"},
  ],
  "emergency-card": [
    {"name": "Jamie", "born": "1987-05-22", "blood": "A+", "allergies": "None known", "meds": "Hay fever tablets in summer", "gp": "Riverside Surgery", "contact": "Partner, 07700 900456", "notes": "Wears contact lenses."},
    {"name": "Lily", "born": "2018-09-03", "blood": "Not known", "allergies": "Peanuts", "meds": "Adrenaline pen in school bag", "gp": "Riverside Surgery", "contact": "Mum, 07700 900123", "notes": "Mild asthma, inhaler as needed."},
    {"name": "Oscar", "born": "2021-02-14", "blood": "O-", "allergies": "None known", "meds": "None", "gp": "Riverside Surgery", "contact": "Dad, 07700 900456", "notes": "Up to date with vaccinations."},
    {"name": "Margaret", "born": "1951-11-30", "blood": "B+", "allergies": "Aspirin", "meds": "Blood pressure tablets each morning", "gp": "Parkside Medical Centre", "contact": "Son, 07700 900789", "notes": "Hearing aid in left ear."},
  ],
  "baby-tracker": [
    {"kind": "Breast feed", "side": "Left", "mins": 20, "date": "2026-11-14", "time": "03:25", "notes": "Settled straight back to sleep."},
    {"kind": "Sleep", "mins": 95, "date": "2026-11-13", "time": "13:10", "notes": "Long nap in the pram."},
  ],
  "baby-book": [
    {"moment": "First proper laugh", "child": "Child 2", "kind": "First", "date": "2026-11-05", "words": "Giggled every time the dog sneezed."},
    {"moment": "Six months old", "child": "Child 2", "kind": "Monthly photo", "date": "2026-11-10", "words": "Sitting up with the knitted bear."},
    {"moment": "Bonfire night sparklers", "child": "Child 1", "kind": "Celebration", "date": "2026-11-05", "words": "Wrote their name in the air, nearly."},
  ],
  "parent-care": [
    {"what": "Collect repeat prescription", "kind": "Medicine", "who": "Partner", "date": "2026-11-16", "time": "12:30", "notes": "Ready at the pharmacy after midday."},
    {"what": "Sunday lunch visit", "kind": "Visit", "who": "Everyone", "date": "2026-11-09", "time": "13:00", "notes": "Mum was in good spirits."},
    {"what": "Ask about the hearing test", "kind": "Question", "who": "Me", "date": "2026-11-18", "notes": "Raise it at the eye clinic too."},
  ],
  "family-history": [
    {"name": "Albert Rowe", "side": "Mother's side", "relation": "Great-grandfather", "born": "1898-10-04", "died": "1971-01-19", "place": "Sheffield", "story": "Worked in the steelworks for forty years."},
    {"name": "Margaret Hale", "side": "Father's side", "relation": "Grandmother", "born": "1931-06-17", "died": "2012-04-08", "place": "Norwich", "story": "Taught at the village school and kept bees."},
    {"name": "Thomas Hale", "side": "Father's side", "relation": "Great-uncle", "born": "1925-02-28", "died": "1998-09-12", "place": "Great Yarmouth", "story": "Fished out of the harbour most of his life."},
  ],
  "family-cookbook": [
    {"recipe": "Grandad's beef stew", "from": "Grandad Albert", "course": "Main", "serves": 4, "time": 180, "ingredients": "Stewing beef, carrots, onions, stock, thyme", "method": "Brown the beef, then simmer low and slow", "story": "Always made on the coldest day of the year."},
    {"recipe": "Lemon drizzle cake", "from": "Aunt Ruth", "course": "Baking", "serves": 8, "time": 60, "ingredients": "Butter, sugar, eggs, self-raising flour, two lemons", "method": "Pour the lemon syrup over while still warm", "story": "Brought to every family party."},
    {"recipe": "Bramble jam", "from": "Grandma Margaret", "course": "Preserve", "serves": 12, "time": 45, "ingredients": "1 kg blackberries, 1 kg sugar, juice of a lemon", "method": "Boil hard until it wrinkles on a cold plate", "story": "Picked from the lane every September."},
  ],
  "guest-list": [
    {"guest": "Hannah and Mark", "rsvp": "Maybe", "party": 2, "diet": ["Gluten-free"], "invited": "2026-11-01", "notes": "Will confirm after work rota."},
    {"guest": "The Okafors", "rsvp": "Invited", "party": 5, "diet": ["Child meal", "Dairy-free"], "invited": "2026-11-03", "notes": "Three children, youngest is two."},
  ],
  "wish-list": [
    {"item": "Cast iron casserole dish", "list": "Home", "want": 4, "colour": "Deep red", "price": 85, "link": "https://example.com/casserole", "got": false},
    {"item": "Merino wool hat", "list": "Birthday", "want": 3, "size": "One size", "colour": "Charcoal grey", "price": 24, "link": "https://example.com/hat", "got": true},
    {"item": "Bird feeder for the garden", "list": "Any time", "want": 2, "colour": "Natural wood", "price": 18, "got": false},
  ],
  "travel-journal": [
    {"title": "Clifftop walk at sunset", "trip": "Autumn coast", "place": "Lighthouse point", "country": "Scotland", "date": "2026-10-15", "rating": 4, "entry": "Wind nearly took my hat but the colours were worth it."},
    {"title": "Rainy day in the old town", "trip": "City break", "place": "Old town", "country": "Portugal", "date": "2026-11-01", "rating": 4, "entry": "Sheltered in a tiny café with custard tarts."},
    {"title": "Tram ride up the hill", "trip": "City break", "place": "Hilltop district", "country": "Portugal", "date": "2026-11-02", "rating": 5, "entry": "Rattled up the steep streets to a view over the river."},
  ],
  "pet-care": [
    {"pet": "Biscuit", "kind": "Weigh-in", "date": "2026-11-07", "next": "2026-12-07", "weight": 12.4, "cost": 0, "notes": "Down a little, cut back on treats."},
    {"pet": "Pepper", "kind": "Flea", "date": "2026-10-30", "next": "2026-11-30", "weight": 4.2, "cost": 14, "notes": "Monthly spot-on treatment."},
  ],
  "dog-walks": [
    {"dog": "Biscuit", "route": "Woods loop by the farm", "mins": 40, "km": 3.2, "mood": 4, "date": "2026-11-12"},
    {"dog": "Biscuit", "route": "Beach and back via the dunes", "mins": 75, "km": 5.6, "mood": 5, "date": "2026-11-08"},
    {"dog": "Biscuit", "route": "Round the block in the rain", "mins": 20, "km": 1.4, "mood": 3, "date": "2026-11-03"},
  ],
  "growth-log": [
    {"child": "Child 2", "cm": 104.2, "kg": 17.1, "date": "2026-11-01", "note": "Growing out of last winter's coat."},
    {"child": "Child 3", "cm": 86.7, "kg": 12.3, "date": "2026-11-01", "note": "Checked at the health visitor clinic."},
    {"child": "Child 1", "cm": 117.6, "kg": 21.0, "date": "2026-08-01", "note": "Measured before the new school term."},
  ],
  "dates-to-remember": [
    {"who": "Mum and Dad", "kind": "Anniversary", "date": "2026-12-03", "nudge": "2026-11-26", "idea": "Dinner at a local bistro"},
    {"who": "Tom", "kind": "Birthday", "date": "2027-01-17", "nudge": "2027-01-08", "idea": "Walking boots voucher"},
    {"who": "Grandad", "kind": "Memorial", "date": "2026-11-29", "nudge": "2026-11-25", "idea": "Flowers and a visit to the garden"},
  ],
  "gratitude-journal": [
    {"date": "2026-11-13", "one": "Fresh bread from the bakery", "two": "Finished a tricky report", "three": "Kids laughing at bath time", "mood": 4},
    {"date": "2026-11-11", "one": "Frosty morning light", "two": "A neighbour fixed the gate", "three": "Early night", "mood": 4},
    {"date": "2026-11-07", "one": "Bonfire with friends", "two": "Hot chocolate after", "three": "No meetings on Friday", "mood": 5},
    {"date": "2026-11-02", "one": "A quiet Sunday", "two": "Soup made from leftovers", "three": "Phone call with Gran", "mood": 3},
  ],
  "dream-journal": [
    {"title": "Late for an exam again", "date": "2026-11-11", "dream": "Ran through endless corridors looking for the hall.", "tags": ["School", "Chase", "Recurring"], "vivid": 7},
    {"title": "Floating over the harbour", "date": "2026-11-06", "dream": "Drifted above the boats and could steer by thinking.", "tags": ["Flying", "Lucid"], "vivid": 9},
    {"title": "The flooded office", "date": "2026-10-30", "dream": "Water rose round the desks while everyone kept typing.", "tags": ["Water", "Work"], "vivid": 6},
    {"title": "Stairs with no bottom", "date": "2026-10-26", "dream": "Kept stepping down a spiral stair that never ended.", "tags": ["Falling", "Nightmare"], "vivid": 5},
  ],
  "filament-spools": [
    {"name": "Translucent blue", "material": "PETG", "colour": "Blue", "diameter": "1.75 mm", "grams_left": 820, "price": 22.5, "nozzle_temp": 240, "bed_temp": 80, "opened": "2026-10-27", "dry": true, "notes": "Strings a little, so retraction is up to 6 mm."},
    {"name": "Flexible black", "material": "TPU", "colour": "Black", "diameter": "1.75 mm", "grams_left": 310, "price": 27, "nozzle_temp": 225, "bed_temp": 50, "opened": "2026-09-15", "dry": false, "notes": "Print slowly at 20 mm/s."},
    {"name": "Silk orange", "material": "PLA", "colour": "Orange", "diameter": "1.75 mm", "grams_left": 150, "price": 18.99, "nozzle_temp": 215, "bed_temp": 60, "opened": "2026-08-22", "dry": true},
  ],
  "print-log": [
    {"model": "Cable clip set", "day": "2026-11-10", "result": "Usable", "material": "PETG", "print_time": 48, "grams": 12, "layer": 0.16, "infill": 30, "notes": "Slight stringing between clips."},
    {"model": "Plant pot with saucer", "day": "2026-11-04", "result": "Failed", "material": "PLA", "print_time": 210, "grams": 64, "layer": 0.28, "infill": 15, "notes": "Detached from the bed halfway through."},
  ],
  "build-log": [
    {"step": "Fitted the drawer runners", "project": "Workbench", "day": "2026-11-12", "hours": 2, "cost": 28.5, "stage": "Build", "notes": "Had to shim the left side by 2 mm."},
    {"step": "Sanded and oiled the top", "project": "Workbench", "day": "2026-11-14", "hours": 1.5, "cost": 12, "stage": "Finish", "notes": "Two coats, a third tomorrow."},
  ],
  "bug-tracker": [
    {"title": "Dates show in the wrong time zone", "project": "Booking site", "status": "Confirmed", "severity": "Minor", "found": "2026-11-09", "steps": "1. Set device to Lisbon time. 2. Open a booking.", "expected": "Times shown in the venue's local time.", "link": "https://example.com/issues/212"},
    {"title": "Crash when uploading an empty file", "project": "Photo sorter", "status": "Fixed", "severity": "Critical", "found": "2026-11-02", "steps": "1. Choose a zero-byte file. 2. Tap Upload.", "expected": "A friendly error message.", "fix": "Check file size before reading."},
    {"title": "Footer overlaps text on small screens", "project": "Booking site", "status": "New", "severity": "Cosmetic", "found": "2026-11-13", "steps": "1. Open the about page at 320 px wide.", "expected": "Footer sits below the content."},
  ],
  "side-projects": [
    {"name": "Recipe scaler", "stage": "Shipped", "what": "Scales recipes by servings and converts units.", "stack": "Web page, local storage", "next": "Add metric to imperial toggle", "hours": 22, "started": "2026-08-14", "link": "https://example.com/recipe-scaler", "excitement": 4},
    {"name": "Bird feeder camera", "stage": "Planning", "what": "Motion-triggered photos of garden visitors.", "stack": "Single-board computer, camera module", "next": "Order a weatherproof case", "hours": 3, "started": "2026-11-05", "excitement": 5},
    {"name": "Board game timer", "stage": "Paused", "what": "Turn timer with per-player colours.", "stack": "Microcontroller, LED ring", "next": "Design the button layout", "hours": 8, "started": "2026-06-20", "excitement": 3},
  ],
  "code-snippets": [
    {"title": "Count rows per day", "language": "SQL", "code": "SELECT date(created_at) AS day, count(*) FROM orders GROUP BY day ORDER BY day;", "why": "Quick daily totals from a log table", "saved": "2026-11-09"},
    {"title": "Space items in a row", "language": "CSS", "code": ".row { display: flex; gap: 8px; }", "why": "Even gaps without margins", "saved": "2026-10-29"},
    {"title": "Match a UK postcode", "language": "Regex", "code": "^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$", "why": "Rough check for form input", "saved": "2026-11-12"},
  ],
  "til-log": [
    {"what": "Capacitors in parallel add their values, unlike resistors.", "topic": "Electronics", "day": "2026-11-11"},
    {"what": "A chamfer on the first layer stops elephant's foot showing.", "topic": "Making", "day": "2026-11-05"},
    {"what": "The median is far less swayed by outliers than the mean.", "topic": "Data", "day": "2026-10-28"},
  ],
  trips: [
    {"item": "Tram 28 up to the castle", "trip": "Lisbon, May", "day": "2027-05-15", "time": "10:30", "kind": "Sight", "place": "Castle hill", "cost": 3.4, "notes": "Go early before the queues."},
    {"item": "Dinner at a fado restaurant", "trip": "Lisbon, May", "day": "2027-05-16", "time": "20:00", "kind": "Food", "place": "Alfama", "ref": "Table for 2", "cost": 70, "link": "https://example.com/fado-dinner"},
  ],
  "tickets-passes": [
    {"name": "Lisbon return", "kind": "Boarding pass", "date": "2027-05-18", "time": "18:40", "from": "Lisbon", "to": "London Gatwick", "seat": "9A", "ref": "K7PQ2M", "used": false},
    {"name": "Sintra day train", "kind": "Train ticket", "date": "2027-05-17", "time": "09:11", "from": "Lisbon Rossio", "to": "Sintra", "ref": "S4471", "used": false},
    {"name": "Concert at the town hall", "kind": "Event ticket", "date": "2026-11-07", "time": "19:30", "from": "Doors", "to": "Main hall", "seat": "Row F, 12", "ref": "EV9031", "used": true},
  ],
  "car-logbook": [
    {"kind": "Service", "date": "2026-11-03", "cost": 189, "mileage": 47960, "where": "A local garage", "due": "2027-11-03", "notes": "Oil, filters and a new wiper blade."},
    {"kind": "MOT", "date": "2026-10-21", "cost": 54.85, "mileage": 47720, "where": "Test centre on the ring road", "due": "2027-10-21", "notes": "Passed with an advisory on the rear tyres."},
  ],
  "trip-spend": [
    {"what": "Metro day passes", "date": "2027-05-14", "category": "Transport", "local": 13.2, "currency": "EUR", "pounds": 11.3, "paidby": "Me", "shared": true},
    {"what": "Tiles from a craft shop", "date": "2027-05-16", "category": "Shopping", "local": 35, "currency": "EUR", "pounds": 29.9, "paidby": "Sam", "shared": false},
  ],
  "travel-papers": [
    {"document": "GHIC", "holder": "Me", "ref": "9917", "expires": "2030-02-18", "renew": "2029-11-01", "link": "https://example.com/ghic"},
    {"document": "Travel insurance", "holder": "Family", "ref": "TI-55210", "expires": "2027-04-30", "renew": "2027-04-01", "notes": "Annual multi-trip, covers winter sports."},
  ],
  hikes: [
    {"route": "Ridge walk above the reservoir", "date": "2026-11-01", "area": "Peak District", "km": 11.2, "climb": 520, "time": 240, "grade": "Hard", "with": "Sam", "rating": 4, "notes": "Boggy in places after the rain."},
    {"route": "Woodland and waterfall circuit", "date": "2026-10-25", "area": "Yorkshire Dales", "km": 7.4, "climb": 210, "time": 165, "grade": "Easy", "with": "Family", "rating": 5, "notes": "Autumn colour was at its best."},
  ],
  "places-visited": [
    {"city": "Edinburgh", "country": "United Kingdom", "continent": "Europe", "date": "2025-08-12", "times": 2, "rating": 5, "highlight": "Climbing the hill for sunset over the old town."},
    {"city": "Kyoto", "country": "Japan", "continent": "Asia", "date": "2023-04-05", "times": 1, "rating": 5, "highlight": "Quiet temple gardens in blossom season."},
  ],
  "flight-log": [
    {"date": "2026-08-24", "from": "ISB", "to": "LHR", "flight": "PK785", "aircraft": "Wide-body twin jet", "seat": "28A", "cabin": "Economy", "km": 6050, "time": 500, "notes": "Headwinds made it a long one."},
    {"date": "2026-06-10", "from": "MAN", "to": "DUB", "aircraft": "Turboprop", "seat": "5C", "cabin": "Economy", "km": 265, "time": 55},
    {"date": "2026-03-19", "from": "LGW", "to": "BCN", "aircraft": "Narrow-body jet", "seat": "3D", "cabin": "Premium economy", "km": 1140, "time": 125, "notes": "Clear views of the Pyrenees."},
  ],
  "rail-journeys": [
    {"date": "2026-11-12", "from": "London Euston", "to": "Manchester Piccadilly", "due": "19:40", "delay": 0, "fare": 38.2, "ticket": "Off-peak", "railcard": true, "claimed": false, "notes": "Quiet carriage, on time."},
    {"date": "2026-11-03", "from": "Leeds", "to": "York", "due": "08:27", "delay": 18, "fare": 12.6, "ticket": "Day return", "railcard": false, "claimed": true, "notes": "Signal fault outside Leeds."},
    {"date": "2026-10-27", "from": "Manchester Piccadilly", "to": "Sheffield", "due": "17:05", "delay": 6, "fare": 15.4, "ticket": "Anytime", "railcard": true, "claimed": false},
  ],
  stays: [
    {"name": "Cottage by the lake", "town": "Keswick", "kind": "Holiday let", "date": "2026-11-07", "nights": 2, "cost": 260, "rating": 5, "ref": "HL-8832", "notes": "Wood burner and a great view."},
    {"name": "Hotel near the station", "town": "York", "kind": "Hotel", "date": "2026-10-30", "nights": 1, "cost": 94, "rating": 3, "ref": "771204", "notes": "Fine for one night, thin walls."},
    {"name": "Ana's flat", "town": "Porto", "kind": "Friends", "date": "2027-05-18", "nights": 2, "cost": 0, "notes": "Bring a gift from home."},
  ],
  "where-i-parked": [
    {"spot": "Station car park, row D", "date": "2026-11-12", "time": "07:48", "until": "18:30", "cost": 9.2, "notes": "Pay by phone, ticket on dash."},
    {"spot": "Street outside the library", "date": "2026-11-09", "time": "14:05", "until": "15:05", "cost": 2.4, "notes": "One hour limit."},
    {"spot": "Retail park, by the trolleys", "date": "2026-11-07", "time": "11:20", "until": "13:20", "cost": 0, "notes": "Free for two hours."},
    {"spot": "Level 1, bay 8", "date": "2026-11-01", "time": "18:40", "until": "22:40", "cost": 7, "notes": "Near the cinema exit."},
  ],
  "health-steps": [
    {"date": "2026-11-13", "steps": 8420, "km": 6.1, "flights": 5},
    {"date": "2026-11-12", "steps": 14310, "km": 10.4, "flights": 12},
    {"date": "2026-11-11", "steps": 5980, "km": 4.3, "flights": 3},
  ],
  "health-sleep": [
    {"date": "2026-11-13", "asleep": 398, "inbed": 445, "deep": 51, "rem": 88, "bed": "23:40", "wake": "07:05"},
    {"date": "2026-11-12", "asleep": 465, "inbed": 490, "deep": 74, "rem": 112, "bed": "22:35", "wake": "06:45"},
    {"date": "2026-11-10", "asleep": 361, "inbed": 420, "deep": 45, "rem": 79, "bed": "00:10", "wake": "07:10"},
  ],
  "health-heart": [
    {"date": "2026-11-13", "avg": 71, "low": 50, "high": 138, "resting": 55, "hrv": 52},
    {"date": "2026-11-12", "avg": 79, "low": 54, "high": 164, "resting": 57, "hrv": 44},
    {"date": "2026-11-11", "avg": 68, "low": 49, "high": 121, "resting": 54, "hrv": 56},
  ],
  "health-workouts": [
    {"date": "2026-11-13", "time": "18:15", "type": "Cycling", "mins": 48, "km": 16.3, "kcal": 402},
    {"date": "2026-11-12", "time": "12:30", "type": "Walking", "mins": 40, "km": 3.4, "kcal": 168},
    {"date": "2026-11-08", "time": "09:00", "type": "Strength training", "mins": 35, "km": 0, "kcal": 210},
  ],
  "health-weight": [
    {"date": "2026-10-15", "kg": 78.1, "fat": 18.9},
    {"date": "2026-11-01", "kg": 77.7, "fat": 18.6},
    {"date": "2026-11-14", "kg": 77.4, "fat": 18.4},
  ],
  "listening-year": [
    {"date": "2026-11-12", "track": "Paper Lanterns", "artist": "North Fields", "album": "Slow Weather", "kind": "Music", "plays": 5, "minutes": 17.5},
    {"date": "2026-11-11", "track": "Episode 42: Mending Things", "artist": "The Workshop Hour", "album": "The Workshop Hour", "kind": "Podcast", "plays": 1, "minutes": 48},
    {"date": "2026-11-09", "track": "Glass Morning", "artist": "Ivy and the Kites", "album": "Small Lights", "kind": "Music", "plays": 2, "minutes": 7.6},
  ],
  "watch-history": [
    {"date": "2026-11-09", "time": "21:00", "title": "Harbour Lights: Season 1: Low Water", "show": "Harbour Lights", "episode": "Low Water", "kind": "Series", "mins": 49},
    {"date": "2026-11-07", "time": "19:45", "title": "The Lantern Keeper", "kind": "Film", "mins": 112},
    {"date": "2026-11-12", "time": "20:30", "title": "Fen Country: Season 2: The Flood", "show": "Fen Country", "episode": "The Flood", "kind": "Series", "mins": 58},
  ],
  "book-highlights": [
    {"book": "The Salt Road", "author": "Ana Field", "kind": "Highlight", "quote": "Every harbour is a promise someone kept.", "page": 88, "location": 1204, "date": "2026-11-11"},
    {"book": "Winter Orchard", "author": "Tom Hale", "kind": "Note", "quote": "Lovely image, reminds me of the farm in the valley.", "page": 34, "location": 512, "date": "2026-11-06"},
    {"book": "Winter Orchard", "author": "Tom Hale", "kind": "Highlight", "quote": "The apples did not hurry, and neither did she.", "page": 101, "location": 1530, "date": "2026-11-13"},
  ],
  "reading-history": [
    {"title": "Winter Orchard", "author": "Tom Hale", "shelf": "Reading", "pages": 284, "year": 2021, "added": "2026-10-20"},
    {"title": "Maps of Small Islands", "author": "Leah Dorn", "shelf": "Read", "rating": 5, "pages": 240, "year": 2017, "read": "2026-10-28", "added": "2026-09-12", "review": "Gentle, funny and full of sea air."},
    {"title": "The Clockmaker's Year", "author": "Owen Pryce", "shelf": "To read", "pages": 398, "year": 2024, "added": "2026-11-10"},
  ],
  "runs-rides": [
    {"date": "2026-11-13", "time": "18:10", "sport": "Ride", "name": "Canal Towpath", "km": 21.4, "mins": 62, "pace": "2:54 /km", "kmh": 20.7, "climb": 58, "hr": 132, "kcal": 520},
    {"date": "2026-11-12", "time": "06:50", "sport": "Run", "name": "Park Intervals", "km": 6.3, "mins": 31, "pace": "4:55 /km", "kmh": 12.2, "climb": 22, "hr": 156, "kcal": 402, "splits": "5:05, 4:50, 4:58, 4:47, 4:52, 4:59"},
    {"date": "2026-11-08", "time": "10:00", "sport": "Hike", "name": "Hill Fort Path", "km": 8.8, "mins": 145, "pace": "16:28 /km", "kmh": 3.6, "climb": 340, "hr": 112, "kcal": 610},
  ],
  "statement-reader": [
    {"date": "2026-11-12", "payee": "A local supermarket", "spent": 52.37, "memo": "Weekly shop"},
    {"date": "2026-11-11", "payee": "Employer", "received": 2140, "memo": "Salary"},
    {"date": "2026-11-08", "payee": "Village bakery", "spent": 6.8},
  ],
  "table-explorer": [
    {"title": "Running", "details": "Minutes: 30 · Notes: windy", "date": "2026-11-12", "value": 30},
    {"title": "Swimming", "details": "Minutes: 40 · Notes: busy pool", "date": "2026-11-10", "value": 40},
    {"title": "Cycling", "details": "Minutes: 60 · Notes: hilly route", "date": "2026-11-08", "value": 60},
  ],
};
