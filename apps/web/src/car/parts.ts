/**
 * THE PARTS (BRIEF-CAR items 1–2): every part the stand-in car has, by the view it is seen in — the outside (`car`), the
 * engine bay with the bonnet up (`bay`), one wheel pulled off (`wheel`), the car lifted (`under`) — each with its sheet:
 * WHAT IT IS, A 30-SECOND CHECK, DIY OR GARAGE, A ROUGH COST (UK ranges, a first estimate, never a quote), what it looks
 * like for the Lens guide, and the MOT words that point to it. Pure: the 3-D builders must build every id of their view
 * (car/body.ts, bay.ts, wheel.ts are typed on these lists) and the fault table (faults.ts) names only these.
 */

export type View = 'car' | 'bay' | 'wheel' | 'under';
export const VIEWS: { id: View; label: string }[] = [
  { id: 'car', label: 'CAR' },
  { id: 'bay', label: 'BONNET UP' },
  { id: 'wheel', label: 'WHEEL OFF' },
  { id: 'under', label: 'UNDERNEATH' },
];

export const BODY_IDS = ['headlamp', 'tail_lamp', 'brake_lamp', 'indicator', 'plate_lamp', 'wiper', 'mirror', 'door_window', 'door_seal', 'fuel_cap'] as const;
export const BAY_IDS = [
  'engine_cover', 'oil_cap', 'dipstick', 'battery', 'battery_terminals', 'coolant_tank', 'coolant_cap', 'brake_fluid', 'washer_bottle', 'air_box', 'drive_belt', 'alternator', 'radiator', 'fan',
  'top_hose', 'fuse_box', 'strut_top', 'coils', 'thermostat', 'water_pump', 'aircon_compressor', 'condenser', 'horn', 'wiper_motor', 'heater_hoses', 'scuttle_drain', 'exhaust_manifold', 'engine_mount', 'turbo',
] as const;
export const WHEEL_IDS = ['tyre', 'tread', 'rim', 'disc', 'pads', 'caliper', 'hub', 'shock', 'spring', 'brake_hose', 'lower_arm', 'track_rod', 'drop_link', 'abs_sensor', 'cv_boot'] as const;
export const UNDER_IDS = ['exhaust', 'cat', 'heat_shield', 'exhaust_mount', 'sump', 'gearbox', 'clutch', 'driveshaft', 'fuel_tank', 'fuel_line', 'subframe', 'steering_rack', 'starter', 'tyre_wear'] as const;

export type BodyId = (typeof BODY_IDS)[number];
export type BayId = (typeof BAY_IDS)[number];
export type WheelId = (typeof WHEEL_IDS)[number];
export type UnderId = (typeof UNDER_IDS)[number];
export type PartId = BodyId | BayId | WheelId | UnderId;

export type Diy = 'DIY' | 'GARAGE' | 'DIY OR GARAGE';

export interface Sheet {
  name: string;
  /** WHAT IT IS, one plain line. */
  what: string;
  /** A 30-SECOND CHECK he (or whoever drives it) can do. */
  check: string;
  diy: Diy;
  /** A ROUGH COST in pounds, low and high, and what that covers. */
  cost: [number, number];
  covers: string;
  /** What to look for with the camera on the real car (the Lens guide). */
  looks: string;
  /** MOT advisory or failure words that point to this part. */
  mot?: RegExp;
  /** Not on an electric car. */
  ice?: boolean;
}

export const PARTS: Record<PartId, Sheet> = {
  // ---- the outside
  headlamp: { name: 'Headlamp', what: 'The headlamp: dipped and main beam in one sealed unit.', check: 'Lights on, walk round the car, or look at its reflection in a shop window at night.', diy: 'DIY OR GARAGE', cost: [10, 60], covers: 'a bulb fitted (some cars need the bumper off, which costs more)', looks: 'the big lamp at each front corner', mot: /head ?lamp|headlight|dipped beam|main beam/i },
  tail_lamp: { name: 'Rear lamp', what: 'The rear lamp: the red lights that show you at night.', check: 'Lights on, walk round the back.', diy: 'DIY', cost: [5, 40], covers: 'a bulb, more for a sealed LED unit', looks: 'the red lamp at each back corner', mot: /(?:rear|tail) (?:position )?lamp|rear light/i },
  brake_lamp: { name: 'Brake light', what: 'The brake lights: they come on when the pedal is pressed.', check: 'At night, back up to a window or a garage door and press the pedal, or ask someone to watch.', diy: 'DIY', cost: [5, 120], covers: 'a bulb, up to the switch at the pedal', looks: 'the red lamps at the back, and the one high in the rear window', mot: /stop lamp|brake light/i },
  indicator: { name: 'Indicator', what: 'The flashing orange indicators.', check: 'Indicate each way: flashing twice as fast means a bulb is out on that side.', diy: 'DIY', cost: [5, 40], covers: 'a bulb', looks: 'the orange lamps at the corners and on the mirrors', mot: /indicator|direction indicator|hazard/i },
  plate_lamp: { name: 'Number plate lamp', what: 'The small lamp that lights the back number plate at night: the law needs it lit.', check: 'Lights on, look at the back plate in the dark.', diy: 'DIY', cost: [3, 30], covers: 'a bulb or a small LED unit', looks: 'the small lamp above the back number plate', mot: /registration plate lamp|number plate lamp|plate lamp/i },
  wiper: { name: 'Wiper blade', what: 'The wiper blades on the windscreen.', check: 'A blade that smears, judders or has a split rubber edge needs replacing.', diy: 'DIY', cost: [15, 40], covers: 'a pair of blades', looks: 'the two black arms along the bottom of the windscreen', mot: /wiper/i },
  mirror: { name: 'Door mirror', what: 'The door mirror.', check: 'Look for cracked glass or a loose, wobbly housing.', diy: 'DIY OR GARAGE', cost: [30, 250], covers: 'a glass, up to a whole mirror', looks: 'the mirrors on the front doors', mot: /mirror/i },
  door_window: { name: 'Window motor', what: 'The door window, its motor and the regulator, the arm inside the door that lifts it.', check: 'Slow on one door is that door’s motor or regulator; slow on every door is the battery or the switches.', diy: 'GARAGE', cost: [120, 320], covers: 'a regulator and motor fitted', looks: 'inside the door, behind the trim panel' },
  door_seal: { name: 'Door seal', what: 'The rubber seals round the doors, and the plastic sheet inside each door that keeps rain out.', check: 'Look for torn or flattened seals; a damp door trim means the sheet inside it.', diy: 'DIY OR GARAGE', cost: [40, 160], covers: 'a seal, or resealing the sheet', looks: 'the rubber strip round each door opening' },
  fuel_cap: { name: 'Fuel cap', what: 'The fuel filler cap behind the flap.', check: 'Turn it until it clicks; a loose cap can bring on the engine light and a fuel smell.', diy: 'DIY', cost: [10, 35], covers: 'a new cap', looks: 'behind the small flap on one rear wing', mot: /fuel cap|filler cap/i, ice: true },
  // ---- the bay
  engine_cover: { name: 'Engine (under its cover)', what: 'The engine, under a plastic cover that hides the plugs or injectors and quietens it.', check: 'Nothing to check on the cover: it lifts off on push-fit studs when someone needs underneath.', diy: 'DIY', cost: [0, 60], covers: 'a new cover; usually it is just put back', looks: 'the big plastic cover in the middle, often with the maker’s badge', ice: true },
  oil_cap: { name: 'Oil filler cap', what: 'Where the engine oil goes in.', check: 'Engine off and cool: unscrew it and look inside. A creamy, mayonnaise-like gunk under it can mean coolant in the oil.', diy: 'DIY', cost: [8, 40], covers: 'a litre of the right oil to top up', looks: 'a black or yellow screw cap on top of the engine with an oil-can symbol', ice: true },
  dipstick: { name: 'Dipstick', what: 'A long strip that dips into the engine’s oil to show how much there is.', check: 'On level ground, engine off five minutes: pull it out, wipe it, push it fully in and pull again. The oil should sit between the two marks.', diy: 'DIY', cost: [8, 40], covers: 'oil to top up (a service with a new filter is £80–£150)', looks: 'a bright yellow or orange loop handle at the front of the engine', ice: true },
  battery: { name: 'Battery', what: 'The 12-volt battery that starts the engine and runs the electrics while it is off.', check: 'Engine off, headlights on: dim or flickering lights mean a weak battery. A garage tests it in a minute, often free.', diy: 'DIY OR GARAGE', cost: [90, 220], covers: 'a battery fitted (cars with stop-start need the dearer kind)', looks: 'a black box with a red cover on one terminal, usually at a front corner', mot: /battery/i },
  battery_terminals: { name: 'Battery terminals', what: 'The two clamps on the battery’s posts: red is positive (+), black is negative (−).', check: 'Engine off: try to twist each clamp by hand; neither should move. White or green crust is corrosion.', diy: 'DIY', cost: [0, 40], covers: 'cleaning and tightening them (a small labour charge at a garage)', looks: 'the two clamps on top of the battery, the red cover on the + one' },
  coolant_tank: { name: 'Coolant tank', what: 'The see-through tank of coolant (antifreeze) that keeps the engine at the right heat.', check: 'Engine cold: the coolant should sit between MIN and MAX on the side of the tank.', diy: 'DIY OR GARAGE', cost: [10, 300], covers: 'coolant to top up, up to finding and fixing a leak', looks: 'a see-through plastic tank with pink, blue or green liquid and MIN and MAX marks', mot: /coolant/i },
  coolant_cap: { name: 'Coolant cap', what: 'The pressure cap on the coolant tank.', check: 'Only with the engine COLD: open it slowly. Never open it hot: the coolant can spray out and scald.', diy: 'DIY', cost: [10, 30], covers: 'a new cap', looks: 'the black or blue cap on the coolant tank, often with a warning symbol' },
  brake_fluid: { name: 'Brake fluid', what: 'The small tank of brake fluid that the pedal pushes to work the brakes.', check: 'The level should sit between MIN and MAX. It drops slowly as the pads wear; a sudden drop is a leak, so a garage.', diy: 'GARAGE', cost: [50, 90], covers: 'a brake fluid change (due every two years)', looks: 'a small see-through pot with a yellow or black cap, at the back by the windscreen, on the driver’s side', mot: /brake fluid/i },
  washer_bottle: { name: 'Washer bottle', what: 'The windscreen washer fluid bottle.', check: 'Pop the blue cap and look in; top it up with screen wash mixed as its bottle says.', diy: 'DIY', cost: [3, 10], covers: 'a bottle of screen wash', looks: 'a blue cap with a windscreen-and-spray symbol, near a front corner', mot: /washer/i },
  air_box: { name: 'Air box and filter', what: 'The box the engine breathes through; the air filter inside stops dust getting in.', check: 'Undo the clips and lift the lid: a filter caked grey or black needs changing.', diy: 'DIY', cost: [15, 60], covers: 'a new filter (£15–£30 to do it yourself)', looks: 'a black plastic box with clips round its lid and a big pipe to the engine', ice: true },
  drive_belt: { name: 'Drive belt', what: 'The rubber belt round the pulleys at one end of the engine: it turns the alternator, the aircon and often the water pump.', check: 'Engine off: look at the ribbed side for cracks, shine or missing chunks. A squeal on cold starts means it is slipping.', diy: 'GARAGE', cost: [80, 160], covers: 'a new belt fitted', looks: 'a flat ribbed rubber belt looping round several pulleys at one end of the engine', ice: true },
  alternator: { name: 'Alternator', what: 'The engine-driven generator that charges the battery while the car runs.', check: 'A cheap meter across the battery with the engine running should read about 14 volts; 12 or less means it is not charging.', diy: 'GARAGE', cost: [250, 550], covers: 'a reconditioned or new alternator fitted', looks: 'a round finned metal unit with a pulley, driven by the belt', ice: true },
  radiator: { name: 'Radiator', what: 'The thin finned panel behind the grille that cools the coolant.', check: 'Look through the grille for bent fins, leaves, or a crusty pink or green trail from a leak.', diy: 'GARAGE', cost: [250, 550], covers: 'a new radiator fitted', looks: 'the wide finned panel just behind the grille' },
  fan: { name: 'Cooling fan', what: 'The electric fan behind the radiator: it pulls air through when the car is slow or standing.', check: 'Let the engine idle until it is properly hot: the fan should start by itself.', diy: 'GARAGE', cost: [150, 400], covers: 'a fan or its relay fitted', looks: 'the round fan in a black shroud behind the radiator' },
  top_hose: { name: 'Coolant hoses', what: 'The thick rubber hoses that carry coolant between the engine and the radiator.', check: 'Engine cold: squeeze them. They should feel firm, not soft, cracked or wet at the clips.', diy: 'GARAGE', cost: [60, 160], covers: 'a hose and its clips fitted', looks: 'thick black rubber pipes from the top of the radiator to the engine' },
  fuse_box: { name: 'Fuse box', what: 'The box of fuses and relays that protect each circuit: lights, horn, wipers, windows.', check: 'The lid’s diagram names each fuse: pull the right one and look at the wire inside. A broken wire is a blown fuse.', diy: 'DIY', cost: [1, 10], covers: 'a pack of fuses (a garage finds the fault if one keeps blowing)', looks: 'a black plastic box with a clip-on lid, often beside the battery' },
  strut_top: { name: 'Strut top', what: 'The top of a front suspension strut, bolted through the body.', check: 'Look for rust round the dome; a clunk when the steering is turned standing still can be a worn top mount.', diy: 'GARAGE', cost: [100, 250], covers: 'a top mount fitted, one side', looks: 'a round dome with three or four bolts at each back corner of the bay', mot: /(?:suspension|strut) (?:mount|top)|top mount/i },
  coils: { name: 'Spark plugs and coils', what: 'The coils and spark plugs under the engine cover that light the fuel in each cylinder (petrol engines).', check: 'A garage reads the engine light’s code: it names the cylinder that misfires.', diy: 'GARAGE', cost: [80, 250], covers: 'a set of plugs, or one coil, fitted', looks: 'under the engine cover: a row of coils on top of the engine, one per cylinder', ice: true },
  thermostat: { name: 'Thermostat', what: 'A valve in the coolant pipe that opens once the engine is warm.', check: 'A heater that stays cold and a low gauge after a long drive, or a gauge that shoots up: it may be stuck.', diy: 'GARAGE', cost: [120, 280], covers: 'a thermostat fitted', looks: 'a housing where the top hose meets the engine', ice: true },
  water_pump: { name: 'Water pump', what: 'The pump that pushes coolant round the engine.', check: 'Look for a crusty trail or drips below its pulley; a growl from that end of the engine.', diy: 'GARAGE', cost: [250, 600], covers: 'a pump fitted (more if the cambelt comes off for it)', looks: 'behind a pulley at the belt end of the engine', ice: true },
  aircon_compressor: { name: 'Aircon compressor', what: 'The aircon’s pump, driven by the belt.', check: 'Aircon on, engine running: the centre of its pulley should click in and spin with it.', diy: 'GARAGE', cost: [400, 900], covers: 'a compressor fitted and the aircon regassed', looks: 'a round unit low on the engine, on the belt' },
  condenser: { name: 'Aircon condenser', what: 'The aircon’s own radiator, in front of the engine’s radiator.', check: 'Look through the grille: bent fins or a stone hole stop it working. Usually the gas has just run low: a regas, £50–£90.', diy: 'GARAGE', cost: [50, 500], covers: 'a regas, up to a condenser fitted', looks: 'a thin finned panel right behind the grille, in front of the radiator' },
  horn: { name: 'Horn', what: 'The horn, behind the grille or the bumper.', check: 'Press it with the ignition on; if it is silent, check its fuse.', diy: 'DIY OR GARAGE', cost: [30, 90], covers: 'a horn fitted', looks: 'a round disc with one or two wires, behind the grille', mot: /horn/i },
  wiper_motor: { name: 'Wiper motor', what: 'The motor and linkage under the plastic panel below the windscreen that drive the wipers.', check: 'Wipers on: a hum with no movement is the linkage; nothing at all is the fuse or the motor.', diy: 'GARAGE', cost: [120, 280], covers: 'a motor or linkage fitted', looks: 'under the black plastic panel along the bottom of the windscreen' },
  heater_hoses: { name: 'Heater hoses', what: 'The two hoses through the back wall of the bay that take hot coolant to the heater inside.', check: 'Look for wet or crusty joints where they go through; a sweet smell inside the car points here.', diy: 'GARAGE', cost: [60, 700], covers: 'a hose, up to a heater matrix (the small radiator behind the dashboard)', looks: 'two hoses going through the back wall of the bay', ice: true },
  scuttle_drain: { name: 'Scuttle drains', what: 'The drain holes under the plastic panel below the windscreen that let rainwater out.', check: 'Lift the panel: leaves and muck here push rain into the car.', diy: 'DIY', cost: [0, 80], covers: 'clearing them (free yourself, or a garage)', looks: 'the plastic panel along the base of the windscreen' },
  exhaust_manifold: { name: 'Exhaust manifold', what: 'Where the exhaust leaves the engine; the hottest part of the bay.', check: 'A ticking or puffing from the engine when cold, louder when revved: a cracked manifold or a blown gasket.', diy: 'GARAGE', cost: [150, 500], covers: 'a gasket, up to a manifold', looks: 'a metal heat shield on the front or back of the engine', ice: true },
  engine_mount: { name: 'Engine mount', what: 'The rubber mounts that hold the engine to the body and soak up its shaking.', check: 'Handbrake on, a helper watching the engine: it should not lurch when you put it in gear.', diy: 'GARAGE', cost: [120, 300], covers: 'a mount fitted', looks: 'a rubber block on a bracket at the top of one end of the engine' },
  turbo: { name: 'Turbo', what: 'The turbocharger: a fan spun by the exhaust that blows more air into the engine (most engines since about 2010 have one).', check: 'A whistle that turns to a siren, blue smoke, or oil inside its pipes: a garage.', diy: 'GARAGE', cost: [800, 1800], covers: 'a reconditioned turbo fitted', looks: 'a snail-shaped metal housing beside the exhaust manifold', ice: true },
  // ---- the wheel
  tyre: { name: 'Tyre', what: 'The tyre: it holds the air and grips the road.', check: 'Pressures are inside the driver’s door frame: check them cold with a gauge. Look at both sides for bulges and cuts.', diy: 'DIY OR GARAGE', cost: [60, 160], covers: 'one mid-range tyre fitted', looks: 'the tyre itself', mot: /tyre.*(?:cut|bulge|damaged|perish|crack|deteriorat|cord|exposed)|(?:cut|bulge).*tyre/i },
  tread: { name: 'Tread depth', what: 'The tyre’s grooves; the legal minimum is 1.6 mm across the middle three-quarters.', check: 'Put a 20p in the main groove: if you can see its outer band, the tread is near the limit. The small bars across the grooves are the 1.6 mm marks.', diy: 'DIY', cost: [60, 160], covers: 'one tyre fitted', looks: 'the grooves round the tyre, with small bars across them', mot: /tyre.*(?:worn close to|near|approaching|below).*limit|tread depth|tyre.*worn/i },
  rim: { name: 'Wheel', what: 'The wheel the tyre sits on.', check: 'Look for kerb damage, cracks or a bend. A shake at speed is often a wheel out of balance.', diy: 'GARAGE', cost: [15, 200], covers: 'balancing (£10–£20 a wheel), up to a repair', looks: 'the alloy or steel wheel', mot: /road wheel|wheel.*(?:damaged|distorted|cracked)/i },
  disc: { name: 'Brake disc', what: 'The brake disc: a steel disc that turns with the wheel; the pads squeeze it to stop the car.', check: 'Look through the spokes: a deep lip at its outer edge or deep grooves mean worn discs.', diy: 'GARAGE', cost: [200, 380], covers: 'two front discs with pads, fitted', looks: 'the shiny steel disc behind the spokes', mot: /brake disc/i },
  pads: { name: 'Brake pads', what: 'The brake pads: blocks of friction material that grip the disc.', check: 'Look through the wheel at the pad pressed on the disc: less than 3 mm left needs new ones.', diy: 'GARAGE', cost: [100, 220], covers: 'a pair of front pads fitted', looks: 'the pad pressed on the disc, inside the clamp', mot: /brake pad/i },
  caliper: { name: 'Brake caliper', what: 'The clamp over the disc that pushes the pads on.', check: 'After a drive, a wheel far hotter than the others (feel near it, never touch) means a sticking caliper.', diy: 'GARAGE', cost: [150, 320], covers: 'one caliper fitted and the brakes bled', looks: 'the clamp gripping the disc', mot: /caliper/i },
  hub: { name: 'Wheel bearing', what: 'The hub and its wheel bearing: what the wheel bolts to and turns on.', check: 'Car jacked up: rock the wheel top and bottom. Any play, or a rumble when it spins, is a worn bearing.', diy: 'GARAGE', cost: [150, 320], covers: 'a wheel bearing fitted', looks: 'the hub the wheel bolts to, with its studs', mot: /wheel bearing|hub bearing/i },
  shock: { name: 'Shock absorber', what: 'The shock absorber: it stops the car bouncing.', check: 'Push hard down on that corner and let go: it should rise once and settle, not bounce. An oily shock is leaking.', diy: 'GARAGE', cost: [200, 420], covers: 'a pair fitted', looks: 'the tall tube inside the spring', mot: /shock absorber|damper/i },
  spring: { name: 'Coil spring', what: 'The coil spring that holds that corner of the car up.', check: 'Look at the coils: a snapped end, or a corner sitting lower than the others, is a broken spring.', diy: 'GARAGE', cost: [100, 260], covers: 'one spring fitted (a pair is better)', looks: 'the big coil round the shock absorber', mot: /spring/i },
  brake_hose: { name: 'Brake hose', what: 'The flexible hose that takes brake fluid to the caliper.', check: 'Look for cracks, bulges or wet patches; it should not rub on anything when the steering turns.', diy: 'GARAGE', cost: [60, 140], covers: 'a hose fitted and the brakes bled', looks: 'the black rubber hose running to the clamp', mot: /brake (?:hose|pipe|line)/i },
  lower_arm: { name: 'Lower arm and ball joint', what: 'The lower suspension arm, with its ball joint and bushes, that holds the hub in place.', check: 'A clunk over bumps or vague steering; a garage checks for play with a bar.', diy: 'GARAGE', cost: [120, 300], covers: 'an arm fitted and the alignment set', looks: 'the arm from the bottom of the hub to the car', mot: /ball joint|suspension arm|wishbone|bush/i },
  track_rod: { name: 'Track rod end', what: 'The track rod end: it links the steering to the hub and sets the wheel’s alignment.', check: 'Uneven tyre wear on one edge, or the car pulling: a garage checks the alignment.', diy: 'GARAGE', cost: [60, 170], covers: 'a track rod end fitted and the alignment set', looks: 'the rod from the steering to the back of the hub', mot: /track rod/i },
  drop_link: { name: 'Drop link', what: 'A short rod tying the anti-roll bar to the suspension.', check: 'A knock over small bumps at low speed is the classic sign.', diy: 'GARAGE', cost: [60, 140], covers: 'a link fitted', looks: 'the thin rod from the strut down to the anti-roll bar', mot: /anti-roll bar|drop link|stabiliser link|linkage/i },
  abs_sensor: { name: 'ABS sensor', what: 'The sensor that reads the wheel’s speed for the anti-lock brakes.', check: 'A garage reads the ABS light’s code: it names the wheel.', diy: 'GARAGE', cost: [80, 220], covers: 'a sensor fitted', looks: 'a small plug with a wire, at the back of the hub', mot: /\babs\b|anti-lock/i },
  cv_boot: { name: 'Driveshaft boot', what: 'The rubber boot over the joint at the end of the driveshaft: it keeps the grease in.', check: 'Steering on full lock, look behind the wheel: a split boot flings grease about.', diy: 'GARAGE', cost: [100, 300], covers: 'a boot, or the joint, fitted', looks: 'the ribbed rubber boot behind the hub', mot: /(?:cv|constant velocity|drive ?shaft).*(?:boot|gaiter)|(?:boot|gaiter).*(?:cv|drive ?shaft)/i },
  // ---- underneath
  exhaust: { name: 'Exhaust and silencer', what: 'The exhaust pipes and the silencer (back box) that carry the fumes to the back.', check: 'Engine running, listen along the car for puffing; look for holes and rust at the back box.', diy: 'GARAGE', cost: [100, 300], covers: 'a back box or a section fitted', looks: 'the pipe along the underside to the box at the back', mot: /exhaust/i, ice: true },
  cat: { name: 'Catalytic converter', what: 'The catalytic converter: it cleans the exhaust gases.', check: 'A rotten-egg smell, or the engine light; a rattle inside it when tapped means it is breaking up.', diy: 'GARAGE', cost: [300, 1100], covers: 'a converter fitted', looks: 'the fat section of exhaust nearest the engine', mot: /catalyst|catalytic|emission/i, ice: true },
  heat_shield: { name: 'Heat shields', what: 'Thin metal shields above the exhaust that keep its heat off the floor.', check: 'A tinny rattle underneath at some revs: tap the shields; one that buzzes is loose.', diy: 'DIY OR GARAGE', cost: [10, 60], covers: 'a clamp or a fix', looks: 'the thin shiny sheets above the exhaust', ice: true },
  exhaust_mount: { name: 'Exhaust hangers', what: 'The rubber hangers that hold the exhaust up.', check: 'Look for perished or snapped rubbers: the exhaust knocks over bumps.', diy: 'DIY OR GARAGE', cost: [10, 50], covers: 'rubbers fitted', looks: 'the small rubber loops holding the exhaust', mot: /exhaust.*(?:mount|insecure|hanger|bracket)/i, ice: true },
  sump: { name: 'Sump', what: 'The oil pan under the engine.', check: 'Look for fresh oil drips on the ground and an oily sump; check the dipstick.', diy: 'GARAGE', cost: [100, 300], covers: 'a gasket or the drain plug fixed', looks: 'the metal pan at the bottom of the engine', mot: /oil leak/i, ice: true },
  gearbox: { name: 'Gearbox', what: 'The gearbox, beside the engine.', check: 'Look for oil drips under it; a whine that changes with the gear, or crunching into gear.', diy: 'GARAGE', cost: [150, 2500], covers: 'an oil change, up to a rebuilt gearbox', looks: 'the alloy casing beside the engine', mot: /gearbox|transmission/i },
  clutch: { name: 'Clutch', what: 'The clutch, between the engine and the gearbox (manual cars).', check: 'In third gear at low speed, press the accelerator hard: if the revs rise but the car does not speed up, it is slipping.', diy: 'GARAGE', cost: [450, 950], covers: 'a clutch kit fitted', looks: 'the bell-shaped housing between the engine and the gearbox', ice: true },
  driveshaft: { name: 'Driveshafts', what: 'The driveshafts that turn the front wheels.', check: 'Clicking on full lock while pulling away is the outer joint wearing.', diy: 'GARAGE', cost: [150, 400], covers: 'a driveshaft fitted', looks: 'the bars from the gearbox out to each front wheel', mot: /drive ?shaft/i },
  fuel_tank: { name: 'Fuel tank', what: 'The fuel tank, in front of the rear axle, with the pump inside it.', check: 'A fuel smell at the back, or wet patches under the tank: do not start it; a garage.', diy: 'GARAGE', cost: [150, 600], covers: 'a fuel pump, up to the tank', looks: 'the big flat tank in front of the back wheels', mot: /fuel tank/i, ice: true },
  fuel_line: { name: 'Fuel pipes', what: 'The thin pipes that carry fuel from the tank to the engine.', check: 'Look along the underside for wet, smelly patches or rusty pipes.', diy: 'GARAGE', cost: [100, 350], covers: 'a pipe fitted', looks: 'thin pipes along the underside', mot: /fuel (?:pipe|line|hose|leak)/i, ice: true },
  subframe: { name: 'Subframe and floor', what: 'The steel frame under the engine that the suspension bolts to, and the floor and sills.', check: 'Look for heavy flaking rust; rust holes in the floor or sills fail the MOT.', diy: 'GARAGE', cost: [150, 900], covers: 'welding, up to a subframe', looks: 'the steel frame under the engine', mot: /corro|rust/i },
  steering_rack: { name: 'Steering rack', what: 'The steering rack: it turns the steering wheel’s turns into the wheels’ turn.', check: 'Heavy or notchy steering; oil on the rubber gaiters at each end.', diy: 'GARAGE', cost: [300, 800], covers: 'a rack fitted and the alignment set', looks: 'the bar across the car behind the front wheels, with a rubber gaiter at each end', mot: /steering rack|rack gaiter|steering (?:gaiter|boot)|power steering/i },
  starter: { name: 'Starter motor', what: 'The starter motor that turns the engine over when you start it.', check: 'One loud click and nothing, with bright dashboard lights: the starter or its wiring.', diy: 'GARAGE', cost: [200, 450], covers: 'a starter fitted', looks: 'a small cylinder where the engine meets the gearbox', ice: true },
  tyre_wear: { name: 'How the tyres wore', what: 'How the tyres have worn across the tread: it tells the story of the alignment and the pressures.', check: 'Run a hand across the tread: one edge worn more is the alignment; both edges, too little air; the middle, too much.', diy: 'GARAGE', cost: [40, 80], covers: 'a wheel alignment (the tyre itself is extra)', looks: 'the tread across each tyre', mot: /tyre.*(?:edge|inner|outer|uneven)/i },
};

/** Which view a part is seen in. */
export function viewOf(id: PartId): View {
  if ((BAY_IDS as readonly string[]).includes(id)) return 'bay';
  if ((WHEEL_IDS as readonly string[]).includes(id)) return 'wheel';
  if ((UNDER_IDS as readonly string[]).includes(id)) return 'under';
  return 'car';
}

export const ALL_IDS: PartId[] = [...BODY_IDS, ...BAY_IDS, ...WHEEL_IDS, ...UNDER_IDS];
export const isPart = (s: string): s is PartId => (ALL_IDS as string[]).includes(s);

/** "£100–£220" */
export function money(c: [number, number]): string {
  const f = (n: number) => `£${n.toLocaleString('en-GB')}`;
  return c[0] === c[1] ? f(c[0]) : `${f(c[0])}–${f(c[1])}`;
}
/** Every cost is said this way: a range, and a first estimate. */
export const ESTIMATE = 'a first estimate, not a quote';

/** A defect from the MOT history, as the vehicle check gives it. */
export interface MotLine {
  type: string;
  text: string;
  dangerous?: boolean;
  date?: string;
}

/** The MOT lines that point to a part (the latest test's first). */
export function motFor(id: PartId, lines: MotLine[]): MotLine[] {
  const re = PARTS[id].mot;
  return re ? lines.filter((l) => re.test(l.text)) : [];
}
