/**
 * THE FAULT TABLE (BRIEF-CAR item 3; OWNER-ISSUES 91a "this is what's wrong with it … and how we can fix it"): about forty
 * everyday symptoms in his words — what he or his dad would say — each with its suspects in order of likelihood, the
 * parts to light, the check to do first, DIY or garage, a cost range (UK, a first estimate, never a quote) and a SAFETY
 * line where it matters, never softened ("Brakes: do not drive it; a garage, today."). The MOT history's advisories and
 * failures map to suspects too (pads wearing thin, a tyre near the limit, corrosion, a lamp) and raise their likelihood.
 * Code, no model: the same words always give the same answer. Pure, so the brain's tests read it.
 */
import { ESTIMATE, PARTS, money, viewOf, type Diy, type MotLine, type PartId, type View } from './parts';

export interface SuspectDef {
  id: string;
  /** "Worn brake pads" */
  label: string;
  parts: PartId[];
  /** How likely, before the MOT has its say (the suspects of a symptom sum to about 1). */
  p: number;
  /** The check, short enough for the card: "look at the pads through the wheel". */
  quick: string;
  check?: string;
  diy?: Diy;
  cost?: [number, number];
  covers?: string;
}

export interface Symptom {
  id: string;
  /** In his words: "Grinding when braking". */
  title: string;
  /** Where to look when there is no suspect to go by (a pick looks where its top suspect is). */
  says: RegExp[];
  /** True when the words could be about anything but a car ("it won't start"): they count only with a car word too. */
  needsCar?: boolean;
  view: View;
  safety?: string;
  suspects: SuspectDef[];
}

const BRAKES_NOW = 'Brakes: do not drive it; a garage, today.';

export const SYMPTOMS: Symptom[] = [
  {
    id: 'brake_grind', title: 'Grinding when braking', view: 'wheel', safety: BRAKES_NOW,
    says: [/\bgrind\w*\b.*\bbrak\w*/, /\bbrak\w*\b.*\bgrind\w*/, /metal (?:on|against) metal/, /scrap\w* (?:noise |sound )?when (?:i |he |she |you |we )?brak/],
    suspects: [
      { id: 'pads_gone', label: 'Brake pads worn to the metal', parts: ['pads', 'disc'], p: 0.6, quick: 'look at the pads through the wheel' },
      { id: 'discs_scored', label: 'Discs scored or worn with a lip', parts: ['disc'], p: 0.22, quick: 'feel for a lip at the disc’s outer edge' },
      { id: 'stone', label: 'A stone caught in the brake', parts: ['disc', 'caliper'], p: 0.1, quick: 'it came on suddenly after a gravel road?', check: 'A grind that started suddenly after a gravel road is often a stone between the disc and its shield; reversing a few metres can free it. If it stays, a garage.', diy: 'GARAGE', cost: [0, 60], covers: 'freeing it at a garage' },
      { id: 'caliper_seized', label: 'A sticking caliper', parts: ['caliper'], p: 0.08, quick: 'one wheel much hotter after a drive?' },
    ],
  },
  {
    id: 'brake_squeal', title: 'Squealing when braking', view: 'wheel', safety: 'Brakes: have them checked this week; if it starts grinding, do not drive it.',
    says: [/\b(?:squeal|squeak|screech|squeel)\w*\b.*\bbrak\w*/, /\bbrak\w*\b.*\b(?:squeal|squeak|screech|squeel)\w*/],
    suspects: [
      { id: 'pads_indicator', label: 'Pads down to their wear squealer', parts: ['pads'], p: 0.5, quick: 'look at the pads through the wheel' },
      { id: 'glazed', label: 'Glazed pads or discs', parts: ['pads', 'disc'], p: 0.25, quick: 'a shiny, glassy disc face' },
      { id: 'damp', label: 'Damp or dust (fine if it stops after a few stops)', parts: ['disc'], p: 0.15, quick: 'does it stop after the first few stops?', check: 'A squeal on the first stops of a damp morning that then goes is just surface rust and dust: normal.', diy: 'DIY', cost: [0, 0], covers: 'nothing, if it goes away' },
      { id: 'shims', label: 'Missing anti-squeal shims', parts: ['caliper'], p: 0.1, quick: 'after new pads were fitted?' },
    ],
  },
  {
    id: 'soft_pedal', title: 'A soft or long brake pedal', view: 'bay', safety: BRAKES_NOW,
    says: [/\b(?:soft|spongy|squishy|long|low)\b (?:brake )?pedal/, /pedal (?:goes|sinks|went|sank) (?:to the floor|down|right down)/, /brakes? (?:feel|feels|are|is) (?:soft|spongy|weak)/, /pedal (?:feels|is) (?:soft|spongy)/],
    suspects: [
      { id: 'fluid_low', label: 'Low brake fluid: a leak', parts: ['brake_fluid', 'brake_hose'], p: 0.45, quick: 'is the brake fluid between MIN and MAX?' },
      { id: 'air', label: 'Air in the brake pipes', parts: ['brake_hose'], p: 0.25, quick: 'after brake work?', check: 'A soft pedal after brake work is often air in the system: they bleed it out.', diy: 'GARAGE', cost: [50, 90], covers: 'bleeding the brakes' },
      { id: 'old_fluid', label: 'Old fluid that has taken in water', parts: ['brake_fluid'], p: 0.15, quick: 'dark brown fluid in the pot?' },
      { id: 'master', label: 'A worn master cylinder', parts: ['brake_fluid'], p: 0.15, quick: 'the pedal sinks slowly while held', check: 'Held down hard at a standstill, a pedal that slowly sinks points to the master cylinder.', diy: 'GARAGE', cost: [200, 450], covers: 'a master cylinder fitted and bled' },
    ],
  },
  {
    id: 'pull_brake', title: 'Pulls to one side when braking', view: 'wheel', safety: BRAKES_NOW,
    says: [/pull\w* (?:to (?:the )?(?:one side|left|right)|sideways|left|right)\b.*\bbrak/, /\bbrak\w*\b.*\bpull\w* (?:to|left|right)/],
    suspects: [
      { id: 'caliper_stick', label: 'A sticking caliper on one side', parts: ['caliper'], p: 0.45, quick: 'one wheel hotter after a drive?' },
      { id: 'pads_uneven', label: 'Pads worn or oily on one side', parts: ['pads'], p: 0.25, quick: 'look at the pads both sides' },
      { id: 'hose_collapsed', label: 'A collapsed brake hose', parts: ['brake_hose'], p: 0.15, quick: 'a cracked or swollen hose?' },
      { id: 'pressures_b', label: 'Uneven tyre pressures', parts: ['tyre'], p: 0.15, quick: 'check all four pressures', diy: 'DIY', cost: [0, 2], covers: 'air at a garage forecourt' },
    ],
  },
  {
    id: 'pull_drive', title: 'Pulls to one side', view: 'wheel', needsCar: true,
    says: [/pull\w* (?:to (?:the )?(?:one side|left|right)|left|right)/, /drift\w* (?:to (?:the )?)?(?:left|right|one side)/],
    suspects: [
      { id: 'pressure_low', label: 'A tyre low on air', parts: ['tyre'], p: 0.4, quick: 'check all four pressures', diy: 'DIY', cost: [0, 2], covers: 'air at a garage forecourt' },
      { id: 'alignment', label: 'The wheel alignment is out', parts: ['track_rod', 'tyre_wear'], p: 0.35, quick: 'one edge of a tyre more worn?' },
      { id: 'tyre_worn', label: 'A worn or mismatched tyre', parts: ['tread'], p: 0.15, quick: 'compare the tread on the two fronts' },
      { id: 'brake_drag', label: 'A brake dragging', parts: ['caliper'], p: 0.1, quick: 'one wheel hotter after a drive?' },
    ],
  },
  {
    id: 'judder_brake', title: 'Judder through the wheel when braking', view: 'wheel', safety: 'Brakes: have them checked this week.',
    says: [/\b(?:judder|shudder|vibrat|shak|wobbl|pulsat)\w*\b.*\bbrak\w*/, /\bbrak\w*\b.*\b(?:judder|shudder|vibrat|shak|pulsat)\w*/],
    suspects: [
      { id: 'disc_uneven', label: 'Uneven (warped) brake discs', parts: ['disc'], p: 0.6, quick: 'worse when braking from speed?' },
      { id: 'caliper_judder', label: 'A sticking caliper', parts: ['caliper'], p: 0.2, quick: 'one wheel hotter after a drive?' },
      { id: 'bushes_judder', label: 'Worn suspension bushes', parts: ['lower_arm'], p: 0.2, quick: 'a clunk over bumps too?' },
    ],
  },
  {
    id: 'wobble_speed', title: 'A wobble or shake at speed', view: 'wheel', safety: 'If a tyre has a bulge, or the shake is violent, do not drive on it: change the wheel or call for help.',
    says: [/\b(?:wobbl|vibrat|shak|shimmy|judder)\w*\b.*\b(?:speed|mph|motorway|fast)\b/, /\bat (?:speed|\d0 ?mph|motorway speed)\b.*\b(?:wobbl|vibrat|shak)\w*/, /steering wheel (?:shakes|vibrates|wobbles|shudders)/],
    suspects: [
      { id: 'balance', label: 'A wheel out of balance', parts: ['rim'], p: 0.55, quick: 'starts at about 50–70 mph?' },
      { id: 'bulge', label: 'A damaged tyre (a bulge)', parts: ['tyre'], p: 0.2, quick: 'look at both sides of each tyre for a bulge' },
      { id: 'bearing_w', label: 'A worn wheel bearing', parts: ['hub'], p: 0.15, quick: 'a hum that rises with speed?' },
      { id: 'bent', label: 'A bent wheel (a kerb or pothole)', parts: ['rim'], p: 0.1, quick: 'a recent pothole or kerb?' },
    ],
  },
  {
    id: 'clunk_bumps', title: 'A clunk over bumps', view: 'wheel', safety: 'A broken spring or a worn joint can affect the steering: have it checked this week.',
    says: [/\b(?:clunk|knock|bang|thud|clonk)\w*\b.*\b(?:bumps?|potholes?|speed ?bumps?|rough roads?|kerbs?)\b/, /over (?:bumps|speed bumps|potholes)\b.*\b(?:clunk|knock|bang|thud|clonk)/],
    suspects: [
      { id: 'droplink', label: 'Worn drop links', parts: ['drop_link'], p: 0.4, quick: 'a knock over small bumps at low speed' },
      { id: 'spring_broken', label: 'A broken coil spring', parts: ['spring'], p: 0.25, quick: 'is one corner sitting lower?' },
      { id: 'shock_worn', label: 'A worn shock absorber or top mount', parts: ['shock', 'strut_top'], p: 0.2, quick: 'push the corner down: does it bounce?' },
      { id: 'balljoint', label: 'A worn ball joint or bush', parts: ['lower_arm'], p: 0.15, quick: 'vague steering too?' },
    ],
  },
  {
    id: 'no_start_click', title: 'Won’t start: just clicks', view: 'bay', needsCar: true, safety: 'Jump-starting: red to + first, black last to bare metal on the engine, away from the battery.',
    says: [/(?:won'?t|wont|doesn'?t|does not|not|isn'?t) (?:start|turn over|crank)\w*\b.*\bclick/, /\bclick\w*\b.*(?:won'?t|wont|doesn'?t|does not|not) start/, /just clicks/],
    suspects: [
      { id: 'battery_flat_c', label: 'A flat battery', parts: ['battery'], p: 0.6, quick: 'are the dashboard lights dim?' },
      { id: 'terminals_c', label: 'Loose or corroded battery terminals', parts: ['battery_terminals'], p: 0.25, quick: 'twist each clamp by hand' },
      { id: 'starter_c', label: 'The starter motor', parts: ['starter'], p: 0.15, quick: 'one loud click, bright lights?' },
    ],
  },
  {
    id: 'no_start_dead', title: 'Won’t start: nothing at all', view: 'bay', needsCar: true, safety: 'Jump-starting: red to + first, black last to bare metal on the engine, away from the battery.',
    says: [/(?:won'?t|wont|doesn'?t|does not) start\b.*\b(?:nothing|dead|no (?:lights|power))/, /(?:completely |totally )?dead\b.*\b(?:no lights|nothing happens|won'?t start)/, /nothing happens when (?:i |he |she )?turn (?:the )?key/],
    suspects: [
      { id: 'battery_dead', label: 'A completely flat battery', parts: ['battery'], p: 0.6, quick: 'no dashboard lights at all?' },
      { id: 'terminals_d', label: 'A battery terminal come loose', parts: ['battery_terminals'], p: 0.3, quick: 'twist each clamp by hand' },
      { id: 'main_fuse', label: 'A main fuse', parts: ['fuse_box'], p: 0.1, quick: 'look at the big fuses by the battery' },
    ],
  },
  {
    id: 'no_start_crank', title: 'Cranks but won’t start', view: 'bay', needsCar: true,
    says: [/(?:turns over|cranks?|cranking|turning over)\b.*(?:won'?t|wont|doesn'?t|does not|not|but no|never) (?:start|fire|catch|go)/, /(?:won'?t|wont) (?:fire|catch)/],
    suspects: [
      { id: 'no_fuel', label: 'Out of fuel, or the fuel pump', parts: ['fuel_tank', 'fuel_line'], p: 0.35, quick: 'how much fuel is showing?' },
      { id: 'plugs', label: 'Spark plugs or coils (petrol)', parts: ['coils'], p: 0.25, quick: 'did it run rough before?' },
      { id: 'weak_battery', label: 'A weak battery turning it too slowly', parts: ['battery'], p: 0.2, quick: 'does it crank slowly?' },
      { id: 'pump_fuse', label: 'The fuel pump’s fuse or relay', parts: ['fuse_box'], p: 0.2, quick: 'a hum from the back when the key goes on?' },
    ],
  },
  {
    id: 'battery_light', title: 'The battery light is on', view: 'bay', safety: 'If the temperature gauge climbs too, stop the engine: the same belt often drives the water pump.',
    says: [/battery (?:light|warning|symbol|lamp)/, /charging (?:light|warning)/],
    suspects: [
      { id: 'alternator', label: 'The alternator is not charging', parts: ['alternator'], p: 0.5, quick: 'about 14 volts at the battery, engine running?' },
      { id: 'belt', label: 'The drive belt slipping or snapped', parts: ['drive_belt'], p: 0.35, quick: 'a squeal, or no belt on the pulleys?' },
      { id: 'terminals_bl', label: 'A loose battery terminal', parts: ['battery_terminals'], p: 0.15, quick: 'twist each clamp by hand' },
    ],
  },
  {
    id: 'oil_light', title: 'The oil light is on', view: 'bay', safety: 'Oil light: stop the engine as soon as it is safe. Driving on can wreck the engine in minutes.',
    says: [/oil (?:light|warning|pressure light|pressure warning|symbol|lamp|can light)/, /red oil can/],
    suspects: [
      { id: 'oil_low', label: 'The oil level is low', parts: ['dipstick', 'oil_cap'], p: 0.6, quick: 'check the dipstick, level ground, engine off' },
      { id: 'oil_leak', label: 'An oil leak', parts: ['sump'], p: 0.2, quick: 'oil drips where it is parked?' },
      { id: 'oil_pump', label: 'The oil pump or its pressure switch', parts: ['sump'], p: 0.2, quick: 'the level is fine but the light stays?', check: 'With the level right and the light still on, it is the oil pressure or its switch: do not drive it, a garage.', diy: 'GARAGE', cost: [40, 600], covers: 'a pressure switch, up to an oil pump' },
    ],
  },
  {
    id: 'engine_light', title: 'The engine light is on', view: 'bay', safety: 'If the engine light flashes, the engine is misfiring: drive gently to a garage, or stop.',
    says: [/(?:engine|check engine|engine management|emissions?|orange engine|amber engine|yellow engine) (?:light|warning|symbol|lamp)/, /\beml\b/, /\bmil\b (?:light|lamp)/],
    suspects: [
      { id: 'misfire_el', label: 'A misfire: plugs or a coil', parts: ['coils'], p: 0.3, quick: 'is it running rough?' },
      { id: 'sensor', label: 'An exhaust sensor or the converter', parts: ['cat'], p: 0.25, quick: 'a garage reads the code (often free)' },
      { id: 'egr', label: 'The EGR valve or the particulate filter (diesels)', parts: ['exhaust_manifold', 'exhaust'], p: 0.2, quick: 'a diesel doing short trips?' },
      { id: 'fuel_cap_el', label: 'A loose fuel cap', parts: ['fuel_cap'], p: 0.15, quick: 'click the fuel cap tight' },
      { id: 'air_leak', label: 'An air leak or a dirty sensor at the air box', parts: ['air_box'], p: 0.1, quick: 'a split pipe after the air box?' },
    ],
  },
  {
    id: 'abs_light', title: 'The ABS light is on', view: 'wheel', safety: 'The brakes still work, but without anti-lock: leave more room and have it checked soon. If the red brake light is on too, stop.',
    says: [/\babs\b (?:light|warning|symbol|lamp)/, /anti-?lock (?:light|warning)/],
    suspects: [
      { id: 'abs_sensor', label: 'A wheel speed (ABS) sensor', parts: ['abs_sensor'], p: 0.55, quick: 'a garage reads which wheel' },
      { id: 'fluid_abs', label: 'Low brake fluid', parts: ['brake_fluid'], p: 0.2, quick: 'is the brake fluid between MIN and MAX?' },
      { id: 'hub_abs', label: 'A worn wheel bearing (it carries the sensor’s ring)', parts: ['hub'], p: 0.15, quick: 'a hum that rises with speed?' },
      { id: 'abs_fuse', label: 'The ABS fuse', parts: ['fuse_box'], p: 0.1, quick: 'look at the ABS fuse' },
    ],
  },
  {
    id: 'overheating', title: 'Overheating', view: 'bay', needsCar: true, safety: 'Overheating: stop the engine. Never open the coolant cap while it is hot: it can scald.',
    says: [/overheat\w*/, /temperature (?:gauge |light |warning )?(?:is |going |goes |gone |went )?(?:high|up|red|hot|into the red)/, /steam\w* (?:from|out of) (?:the )?(?:bonnet|engine|hood)/, /temp (?:gauge )?(?:is )?(?:high|in the red)/, /running hot/],
    suspects: [
      { id: 'coolant_low', label: 'Low coolant: a leak', parts: ['coolant_tank', 'top_hose'], p: 0.45, quick: 'coolant between MIN and MAX (engine cold)?' },
      { id: 'fan_dead', label: 'The cooling fan not starting', parts: ['fan'], p: 0.2, quick: 'does the fan start when it gets hot?' },
      { id: 'stat', label: 'A stuck thermostat', parts: ['thermostat'], p: 0.15, quick: 'the top hose cold while the engine is hot?' },
      { id: 'pump_oh', label: 'The water pump', parts: ['water_pump'], p: 0.1, quick: 'a crusty trail under its pulley?' },
      { id: 'gasket_oh', label: 'A head gasket', parts: ['engine_cover', 'coolant_tank'], p: 0.1, quick: 'white smoke and coolant vanishing?', diy: 'GARAGE', cost: [800, 1600], covers: 'a head gasket' },
    ],
  },
  {
    id: 'white_smoke', title: 'White smoke from the exhaust', view: 'under', needsCar: true, safety: 'Thick white smoke that smells sweet means coolant is burning: do not drive it far.',
    says: [/white smoke/, /smoke is white/],
    suspects: [
      { id: 'steam', label: 'Just condensation on a cold morning', parts: ['exhaust'], p: 0.4, quick: 'does it go once the engine is warm?', check: 'Thin white vapour on a cold morning that goes once the engine warms up is water: normal.', diy: 'DIY', cost: [0, 0], covers: 'nothing, if it goes' },
      { id: 'gasket_ws', label: 'A head gasket leaking coolant', parts: ['engine_cover', 'coolant_tank'], p: 0.4, quick: 'is the coolant level dropping?', diy: 'GARAGE', cost: [800, 1600], covers: 'a head gasket' },
      { id: 'egr_cooler', label: 'An EGR cooler (diesels)', parts: ['exhaust_manifold'], p: 0.2, quick: 'a diesel losing coolant?' },
    ],
  },
  {
    id: 'blue_smoke', title: 'Blue smoke from the exhaust', view: 'bay', needsCar: true,
    says: [/blue (?:smoke|exhaust)/, /burning oil/],
    suspects: [
      { id: 'rings', label: 'Worn valve seals or piston rings', parts: ['engine_cover'], p: 0.5, quick: 'a puff of blue on starting?', diy: 'GARAGE', cost: [300, 2000], covers: 'valve seals, up to an engine rebuild' },
      { id: 'turbo_seals', label: 'Turbo oil seals', parts: ['turbo'], p: 0.35, quick: 'blue smoke under hard acceleration?' },
      { id: 'overfilled', label: 'Too much oil in the engine', parts: ['dipstick'], p: 0.15, quick: 'is the dipstick above MAX?' },
    ],
  },
  {
    id: 'black_smoke', title: 'Black smoke from the exhaust', view: 'bay', needsCar: true,
    says: [/black smoke/],
    suspects: [
      { id: 'air_filter', label: 'A blocked air filter', parts: ['air_box'], p: 0.35, quick: 'lift the air box lid: is the filter black?' },
      { id: 'injectors', label: 'Leaking injectors', parts: ['engine_cover'], p: 0.3, quick: 'worse fuel economy too?', diy: 'GARAGE', cost: [150, 800], covers: 'cleaning, up to injectors' },
      { id: 'egr_bs', label: 'The EGR valve or turbo', parts: ['exhaust_manifold', 'turbo'], p: 0.35, quick: 'down on power too?' },
    ],
  },
  {
    id: 'knock', title: 'A knock from the engine', view: 'bay', safety: 'A deep knock that gets louder with revs: stop driving it; it can wreck the engine.',
    says: [/\b(?:knock|knocking|tapping|ticking|pinking|pinging)\b.*\bengine\b/, /\bengine\b.*\b(?:knock|knocks|knocking|tapping|ticking|pinking)\b/],
    suspects: [
      { id: 'oil_low_k', label: 'Low oil', parts: ['dipstick'], p: 0.4, quick: 'check the dipstick' },
      { id: 'pinking', label: 'Pinking: the wrong fuel or carbon', parts: ['fuel_cap'], p: 0.2, quick: 'only when pulling hard uphill?', check: 'A rattle like marbles when pulling hard: the wrong grade of petrol or carbon build-up.', diy: 'DIY OR GARAGE', cost: [0, 200], covers: 'the right fuel, up to a clean' },
      { id: 'bearings', label: 'Worn engine bearings', parts: ['sump'], p: 0.25, quick: 'a deep knock that rises with revs', diy: 'GARAGE', cost: [1500, 3500], covers: 'an engine rebuild' },
      { id: 'tappets', label: 'A ticking valve (tappets)', parts: ['engine_cover'], p: 0.15, quick: 'a light tick, worst when cold', diy: 'GARAGE', cost: [100, 500], covers: 'an oil change, up to the valve gear' },
    ],
  },
  {
    id: 'rattle', title: 'A rattle underneath', view: 'under', needsCar: true,
    says: [/\brattl\w*/],
    suspects: [
      { id: 'heat_shield', label: 'A loose heat shield', parts: ['heat_shield'], p: 0.45, quick: 'tap the shields over the exhaust' },
      { id: 'exhaust_hanger', label: 'A broken exhaust hanger or bracket', parts: ['exhaust_mount'], p: 0.3, quick: 'does the exhaust swing by hand (cold)?' },
      { id: 'droplink_r', label: 'A worn drop link', parts: ['drop_link'], p: 0.15, quick: 'over small bumps?' },
      { id: 'cat_r', label: 'A converter breaking up inside', parts: ['cat'], p: 0.1, quick: 'a rattle from it when tapped?' },
    ],
  },
  {
    id: 'stalling', title: 'Keeps stalling', view: 'bay', needsCar: true, safety: 'If it stalls at junctions or on fast roads, do not drive it until it is fixed: you lose the steering and brake help.',
    says: [/\bstall\w*/, /cuts? out\b/, /keeps (?:dying|cutting out)/],
    suspects: [
      { id: 'throttle', label: 'A dirty throttle body or idle control', parts: ['air_box'], p: 0.3, quick: 'stalls when coming to a stop?' },
      { id: 'vacuum', label: 'An air leak in a pipe', parts: ['top_hose', 'air_box'], p: 0.25, quick: 'a hiss with the engine running?' },
      { id: 'fuel_supply', label: 'Fuel supply: the pump or a filter', parts: ['fuel_line', 'fuel_tank'], p: 0.25, quick: 'cuts out under load?' },
      { id: 'alt_stall', label: 'Low charging', parts: ['alternator'], p: 0.2, quick: 'the battery light flickers?' },
    ],
  },
  {
    id: 'rough_idle', title: 'Rough idle or misfiring', view: 'bay', needsCar: true,
    says: [/rough (?:idle|idling|running)/, /(?:idle|idling) (?:is )?(?:rough|lumpy|shaky|up and down)/, /shak\w* (?:at|when) (?:idle|the lights|stopped|standing still)/, /misfir\w*/, /hesitat\w* when (?:i )?(?:accelerat|pull)/],
    suspects: [
      { id: 'coils_ri', label: 'Spark plugs or a coil', parts: ['coils'], p: 0.4, quick: 'the engine light on or flashing?' },
      { id: 'mount_ri', label: 'A worn engine mount', parts: ['engine_mount'], p: 0.25, quick: 'the engine lurches when put in gear?' },
      { id: 'vacuum_ri', label: 'An air leak in a pipe', parts: ['top_hose'], p: 0.2, quick: 'a hiss with the engine running?' },
      { id: 'throttle_ri', label: 'A dirty throttle body', parts: ['air_box'], p: 0.15, quick: 'worse when the engine is cold?' },
    ],
  },
  {
    id: 'fuel_smell', title: 'A smell of fuel', view: 'under', safety: 'A fuel smell: no smoking or flames near it. If it is strong or dripping, do not start it.',
    says: [/(?:smell|smells|stink|stinks|reek|reeks) (?:of|like) (?:petrol|diesel|fuel|gas)/, /(?:petrol|diesel|fuel) (?:smell|fumes)/],
    suspects: [
      { id: 'fuel_line_s', label: 'A leaking fuel pipe', parts: ['fuel_line'], p: 0.35, quick: 'wet patches under the car?' },
      { id: 'fuel_cap_s', label: 'A loose or worn fuel cap', parts: ['fuel_cap'], p: 0.3, quick: 'click the fuel cap tight' },
      { id: 'injector_seal', label: 'An injector seal on the engine', parts: ['engine_cover'], p: 0.2, quick: 'strongest under the bonnet?', diy: 'GARAGE', cost: [80, 300], covers: 'injector seals' },
      { id: 'tank_s', label: 'The fuel tank or its pump seal', parts: ['fuel_tank'], p: 0.15, quick: 'strongest at the back?' },
    ],
  },
  {
    id: 'burning_smell', title: 'A burning smell', view: 'under', needsCar: true, safety: 'Smoke from the bonnet: pull over, switch off and get everyone out.',
    says: [/burning smell/, /smell\w* (?:of |like )?burn\w*/, /(?:smell|smells) (?:of |like )?(?:burnt|hot) (?:plastic|rubber|oil)/],
    suspects: [
      { id: 'oil_on_exhaust', label: 'Oil dripping onto the hot exhaust', parts: ['sump', 'exhaust'], p: 0.35, quick: 'oil drips where it is parked?' },
      { id: 'clutch_burn', label: 'A slipping clutch', parts: ['clutch'], p: 0.25, quick: 'after a hill start?' },
      { id: 'brake_burn', label: 'A brake dragging', parts: ['caliper'], p: 0.25, quick: 'one wheel much hotter?' },
      { id: 'electrical', label: 'Something electrical overheating', parts: ['fuse_box'], p: 0.15, quick: 'a hot plastic smell inside?', check: 'A hot plastic smell inside the car is electrical: switch off and have it looked at before driving.', diy: 'GARAGE', cost: [80, 400], covers: 'finding and fixing the fault' },
    ],
  },
  {
    id: 'sweet_smell', title: 'A sweet smell', view: 'bay', needsCar: true, safety: 'Watch the temperature gauge: if it climbs, stop the engine.',
    says: [/sweet (?:smell|smelling)/, /smells? sweet/, /smells? (?:of|like) (?:syrup|maple|antifreeze|coolant|pancakes?|candy)/],
    suspects: [
      { id: 'coolant_leak_s', label: 'A coolant leak in the bay', parts: ['coolant_tank', 'top_hose'], p: 0.5, quick: 'coolant level dropping?' },
      { id: 'heater_matrix', label: 'The heater matrix (misty windows, a damp carpet)', parts: ['heater_hoses'], p: 0.35, quick: 'misty windows and a sweet smell inside?' },
      { id: 'gasket_ss', label: 'A head gasket', parts: ['engine_cover'], p: 0.15, quick: 'white smoke too?', diy: 'GARAGE', cost: [800, 1600], covers: 'a head gasket' },
    ],
  },
  {
    id: 'aircon_warm', title: 'Aircon blowing warm', view: 'bay',
    says: [/(?:air ?con|a\/c|aircon|air conditioning|\bac\b)\b.*\b(?:warm|hot|not cold|isn'?t cold|not working|doesn'?t work|stopped)/, /(?:warm|hot) air from the (?:air ?con|vents)/],
    suspects: [
      { id: 'regas', label: 'The gas has run low: a regas', parts: ['condenser'], p: 0.55, quick: 'has it had a regas in the last few years?', diy: 'GARAGE', cost: [50, 90], covers: 'a regas' },
      { id: 'compressor', label: 'The compressor not switching on', parts: ['aircon_compressor', 'drive_belt'], p: 0.2, quick: 'does its pulley’s centre click in?' },
      { id: 'condenser_dmg', label: 'A damaged condenser', parts: ['condenser'], p: 0.15, quick: 'a stone hole behind the grille?' },
      { id: 'ac_fuse', label: 'A fuse or relay', parts: ['fuse_box'], p: 0.1, quick: 'look at the aircon fuse' },
    ],
  },
  {
    id: 'battery_flat', title: 'Battery going flat overnight', view: 'bay', needsCar: true,
    says: [/battery (?:keeps |is |goes |went |keeps going )?(?:going )?(?:flat|dead)/, /(?:flat|dead) battery/, /(?:flat|dead) (?:every|each|in the) (?:morning|night)/, /drain\w* (?:the )?battery/],
    suspects: [
      { id: 'old_battery', label: 'An old battery that no longer holds charge', parts: ['battery'], p: 0.4, quick: 'more than five years old?' },
      { id: 'drain', label: 'Something left drawing power', parts: ['fuse_box'], p: 0.3, quick: 'a boot light, a dashcam left on?', check: 'A garage finds what draws power with the car locked by pulling fuses one at a time.', diy: 'GARAGE', cost: [60, 200], covers: 'finding the drain' },
      { id: 'alt_flat', label: 'The alternator not charging', parts: ['alternator'], p: 0.2, quick: 'the battery light on while driving?' },
      { id: 'short_trips', label: 'Only short trips', parts: ['battery'], p: 0.1, quick: 'mostly drives under 20 minutes?', check: 'Short trips never put back what starting took: a long drive weekly, or a smart charger.', diy: 'DIY', cost: [30, 60], covers: 'a smart charger' },
    ],
  },
  {
    id: 'tyre_edge', title: 'A tyre wearing on one edge', view: 'under', safety: 'If the tyre’s cords or wires show, or the tread is under 1.6 mm, do not drive on it.',
    says: [/(?:tyre|tire)s?\b.*\b(?:wear\w*|worn)\b.*\b(?:edge|inside|outside|one side|unevenly)/, /uneven (?:tyre|tire) wear/, /(?:edge|inside|outside) of (?:the |a |my )?(?:tyre|tire)/],
    suspects: [
      { id: 'align_t', label: 'The wheel alignment is out', parts: ['tyre_wear', 'track_rod'], p: 0.55, quick: 'one edge worn more than the other' },
      { id: 'pressure_t', label: 'Running with too little air', parts: ['tyre_wear'], p: 0.25, quick: 'both edges worn?', diy: 'DIY', cost: [0, 2], covers: 'air at a garage forecourt' },
      { id: 'susp_t', label: 'Worn suspension', parts: ['lower_arm', 'shock'], p: 0.2, quick: 'a clunk over bumps too?' },
    ],
  },
  {
    id: 'clutch_slip', title: 'The clutch slipping', view: 'under',
    says: [/clutch (?:is )?(?:slipping|slips|biting (?:very )?high|smells)/, /revs? (?:go|goes|rise|rises|climb|climbs)\b.*\b(?:but|and) (?:the car )?(?:doesn'?t|does not|won'?t) (?:speed up|go faster|accelerate)/],
    suspects: [
      { id: 'clutch_worn', label: 'A worn clutch', parts: ['clutch'], p: 0.75, quick: 'third gear, low speed, foot down: revs rise, no speed?' },
      { id: 'clutch_oil', label: 'Oil on the clutch (a leaking seal)', parts: ['gearbox'], p: 0.15, quick: 'oil drips under the gearbox?' },
      { id: 'clutch_hyd', label: 'The clutch’s hydraulics (it shares the brake fluid)', parts: ['brake_fluid'], p: 0.1, quick: 'is the brake fluid low?' },
    ],
  },
  {
    id: 'gears_grind', title: 'Gears grinding', view: 'under',
    says: [/\b(?:grind|crunch)\w*\b.*\bgears?\b/, /\bgears?\b.*\b(?:grind|crunch)\w*/, /(?:hard|difficult) to (?:get into|find) gear/, /won'?t go into gear/, /gear ?(?:stick|change) (?:is )?(?:stiff|notchy)/],
    suspects: [
      { id: 'clutch_drag', label: 'The clutch not fully letting go', parts: ['clutch'], p: 0.45, quick: 'grinds into first or reverse when stopped?' },
      { id: 'synchros', label: 'Low gearbox oil or worn synchros', parts: ['gearbox'], p: 0.35, quick: 'grinds on a quick change between gears?' },
      { id: 'clutch_fluid', label: 'Clutch fluid low (it shares the brake fluid)', parts: ['brake_fluid'], p: 0.2, quick: 'is the brake fluid low?' },
    ],
  },
  {
    id: 'lights_flicker', title: 'Lights flickering', view: 'bay', needsCar: true,
    says: [/lights? (?:keep |are |is )?(?:flicker\w*|dim\w*|flash\w* on and off|going dim)/, /(?:dash(?:board)?|headlights?) (?:flicker|dim)\w*/],
    suspects: [
      { id: 'alt_fl', label: 'The alternator', parts: ['alternator'], p: 0.45, quick: 'brighter when revved?' },
      { id: 'terminals_fl', label: 'A loose battery terminal or earth', parts: ['battery_terminals'], p: 0.35, quick: 'twist each clamp by hand' },
      { id: 'battery_fl', label: 'A failing battery', parts: ['battery'], p: 0.2, quick: 'slow starting too?' },
    ],
  },
  {
    id: 'headlamp_out', title: 'A headlamp out', view: 'car', safety: 'A headlamp out is illegal at night and makes the car hard to see: fix it before driving in the dark.',
    says: [/(?:headlight|headlamp|head light|head lamp)s?\b.*\b(?:out|not working|gone|blown|broken|doesn'?t work|dead|isn'?t working)/, /(?:one|a|my|the) (?:headlight|headlamp) (?:is |has )?(?:out|gone)/],
    suspects: [
      { id: 'bulb_h', label: 'A blown bulb (an MOT fail)', parts: ['headlamp'], p: 0.75, quick: 'lights on, walk round the front' },
      { id: 'fuse_h', label: 'Its fuse', parts: ['fuse_box'], p: 0.15, quick: 'look at that side’s headlamp fuse' },
      { id: 'plug_h', label: 'Its plug or wiring', parts: ['headlamp'], p: 0.1, quick: 'a new bulb did not help?', diy: 'GARAGE', cost: [40, 150], covers: 'finding and fixing the wire' },
    ],
  },
  {
    id: 'plate_lamp_out', title: 'The number plate lamp out', view: 'car',
    says: [/(?:number ?plate|plate|reg plate|registration plate) (?:light|lamp|bulb)s?\b.*\b(?:out|not working|gone|blown|broken)/, /(?:light|lamp) (?:over|above|on|for) the (?:number |reg )?plate\b.*\b(?:out|not working|gone)/],
    suspects: [
      { id: 'bulb_p', label: 'A blown bulb (an MOT fail, and illegal at night)', parts: ['plate_lamp'], p: 0.8, quick: 'lights on, look at the back plate' },
      { id: 'fuse_p', label: 'Its fuse', parts: ['fuse_box'], p: 0.1, quick: 'look at the rear lights’ fuse' },
      { id: 'holder_p', label: 'A corroded bulb holder', parts: ['plate_lamp'], p: 0.1, quick: 'green crust in the holder?' },
    ],
  },
  {
    id: 'brake_lamp_out', title: 'A brake light out', view: 'car', safety: 'A brake light out: the car behind cannot see you stop. Fix it before you drive.',
    says: [/brake ?lights?\b.*\b(?:out|not working|gone|blown|stuck on|don'?t work|doesn'?t work)/, /stop ?lights?\b.*\b(?:out|not working)/],
    suspects: [
      { id: 'bulb_b', label: 'A blown bulb', parts: ['brake_lamp', 'tail_lamp'], p: 0.6, quick: 'back up to a window, press the pedal' },
      { id: 'switch_b', label: 'The switch at the pedal (all of them out, or stuck on)', parts: ['brake_lamp'], p: 0.25, quick: 'all of them out, or all stuck on?', diy: 'GARAGE', cost: [30, 120], covers: 'a switch fitted' },
      { id: 'fuse_b', label: 'Its fuse', parts: ['fuse_box'], p: 0.15, quick: 'look at the brake lights’ fuse' },
    ],
  },
  {
    id: 'exhaust_blow', title: 'The exhaust blowing or loud', view: 'under', safety: 'Exhaust fumes can get into the car: keep a window open and get it fixed soon.',
    says: [/exhaust\b.*\b(?:blowing|loud|blown|hole|roar\w*|noisy|leak\w*|banging|louder)/, /(?:loud|blowing|roaring|noisy) exhaust/],
    suspects: [
      { id: 'backbox', label: 'A hole in the silencer (back box)', parts: ['exhaust'], p: 0.45, quick: 'listen at the back with it running' },
      { id: 'joint', label: 'A blown joint along the pipe', parts: ['exhaust', 'exhaust_mount'], p: 0.3, quick: 'soot marks at a joint?' },
      { id: 'manifold_e', label: 'A cracked manifold or its gasket', parts: ['exhaust_manifold'], p: 0.15, quick: 'a tick from the engine, worst when cold' },
      { id: 'flexi', label: 'The flexi joint near the front', parts: ['cat'], p: 0.1, quick: 'loud under the front seats?' },
    ],
  },
  {
    id: 'wet_footwell', title: 'A wet footwell', view: 'bay',
    says: [/(?:wet|damp|soaked|soggy|soaking) (?:footwell|carpets?|floor)/, /water (?:in|inside|coming into|getting into) (?:the )?(?:car|footwell)/, /(?:footwell|carpets?) (?:is |are )?(?:wet|damp|soaked|soaking)/],
    suspects: [
      { id: 'scuttle', label: 'Blocked drains under the windscreen', parts: ['scuttle_drain'], p: 0.4, quick: 'leaves under the panel below the windscreen?' },
      { id: 'seal', label: 'A door seal or the sheet inside the door', parts: ['door_seal'], p: 0.25, quick: 'wettest by a door?' },
      { id: 'matrix_w', label: 'The heater matrix (sweet smell, misty windows)', parts: ['heater_hoses'], p: 0.2, quick: 'sticky and sweet-smelling?' },
      { id: 'ac_drain', label: 'The aircon’s drain blocked', parts: ['condenser'], p: 0.15, quick: 'wet after using the aircon?', diy: 'GARAGE', cost: [40, 90], covers: 'clearing the drain' },
    ],
  },
  {
    id: 'slow_windows', title: 'Slow or stuck windows', view: 'car', needsCar: true,
    says: [/(?:electric )?windows?\b.*\b(?:slow|stuck|won'?t (?:go|close|open|move)|not working|stopped|struggl\w*)/, /window (?:motor|regulator)/],
    suspects: [
      { id: 'regulator', label: 'That door’s window motor or regulator', parts: ['door_window'], p: 0.65, quick: 'only one window?' },
      { id: 'channels', label: 'Dry or dirty window channels', parts: ['door_window'], p: 0.2, quick: 'slow in the cold?', check: 'A slow window in cold weather often just needs its rubber channels cleaned and treated with silicone spray.', diy: 'DIY', cost: [5, 10], covers: 'a can of silicone spray' },
      { id: 'battery_w', label: 'A weak battery', parts: ['battery'], p: 0.15, quick: 'every window slow with the engine off?' },
    ],
  },
  {
    id: 'horn', title: 'The horn not working', view: 'bay',
    says: [/\bhorn\b.*\b(?:not working|doesn'?t work|won'?t|stopped|quiet|weak|dead|broken|isn'?t working)/, /(?:no|weak) horn/],
    suspects: [
      { id: 'fuse_horn', label: 'Its fuse', parts: ['fuse_box'], p: 0.4, quick: 'look at the horn fuse' },
      { id: 'horn_unit', label: 'The horn itself (an MOT fail)', parts: ['horn'], p: 0.35, quick: 'a click but no sound?' },
      { id: 'clock_spring', label: 'The connection inside the steering wheel', parts: ['horn'], p: 0.25, quick: 'the airbag light on too?', check: 'If the airbag light is on as well, it is the coil inside the steering wheel: a garage.', diy: 'GARAGE', cost: [120, 260], covers: 'a clock spring fitted' },
    ],
  },
  {
    id: 'wipers', title: 'Wipers not working', view: 'car', safety: 'Wipers that do not clear the screen: do not drive in rain or spray.',
    says: [/wipers?\b.*\b(?:not working|stopped|won'?t|smear\w*|streak\w*|judder\w*|squeak\w*|slow|stuck|broken|don'?t)/],
    suspects: [
      { id: 'blades', label: 'Worn wiper blades (smears)', parts: ['wiper'], p: 0.45, quick: 'smears or a split rubber edge?' },
      { id: 'wiper_motor', label: 'The wiper motor or linkage', parts: ['wiper_motor'], p: 0.35, quick: 'a hum but no movement?' },
      { id: 'fuse_w', label: 'Its fuse', parts: ['fuse_box'], p: 0.2, quick: 'look at the wiper fuse' },
    ],
  },
  {
    id: 'heavy_steering', title: 'Heavy steering', view: 'under', safety: 'Steering suddenly heavy: slow down and pull over somewhere safe.',
    says: [/\bsteering\b.*\b(?:heavy|stiff|hard|tight|notchy)/, /(?:heavy|stiff|hard) steering/, /power steering\b.*\b(?:gone|failed|not working|light|warning)/],
    suspects: [
      { id: 'pressures_s', label: 'Front tyres low on air', parts: ['tyre'], p: 0.35, quick: 'check the front pressures', diy: 'DIY', cost: [0, 2], covers: 'air at a garage forecourt' },
      { id: 'rack', label: 'The power steering or its rack', parts: ['steering_rack'], p: 0.4, quick: 'a steering warning light?' },
      { id: 'belt_s', label: 'The drive belt (older cars’ steering pump)', parts: ['drive_belt'], p: 0.25, quick: 'a squeal when turning?' },
    ],
  },
  {
    id: 'click_turning', title: 'Clicking when turning', view: 'wheel',
    says: [/\bclick\w*\b.*\b(?:turn\w*|full lock|corner\w*|steer\w*)/, /\b(?:turning|full lock|cornering)\b.*\bclick\w*/],
    suspects: [
      { id: 'cv', label: 'A worn driveshaft joint', parts: ['cv_boot', 'driveshaft'], p: 0.75, quick: 'clicks on full lock pulling away?' },
      { id: 'droplink_c', label: 'A worn drop link', parts: ['drop_link'], p: 0.15, quick: 'over bumps too?' },
      { id: 'strut_c', label: 'A strut top bearing', parts: ['strut_top'], p: 0.1, quick: 'a clunk turning on the spot?' },
    ],
  },
  {
    id: 'hum_speed', title: 'A hum that rises with speed', view: 'wheel', safety: 'A worn wheel bearing can fail: have it checked this week.',
    says: [/\b(?:hum|humming|drone|droning|whine|whining|roar|roaring|rumbl\w*)\b.*\b(?:speed|mph|faster|motorway)/, /(?:louder|gets louder) (?:with|as) (?:speed|i go faster|it goes faster)/],
    suspects: [
      { id: 'bearing', label: 'A worn wheel bearing', parts: ['hub'], p: 0.55, quick: 'changes when weaving gently left and right?' },
      { id: 'tyre_noise', label: 'Tyre noise from uneven wear', parts: ['tyre_wear'], p: 0.35, quick: 'run a hand over the tread: is it saw-toothed?' },
      { id: 'gearbox_hum', label: 'The gearbox', parts: ['gearbox'], p: 0.1, quick: 'changes with the gear?' },
    ],
  },
  {
    id: 'tpms_light', title: 'Tyre pressure light or a puncture', view: 'wheel', safety: 'Check all four tyres now; a soft tyre can overheat and fail at speed.',
    says: [/tyre (?:pressure )?(?:light|warning)/, /\btpms\b/, /(?:tyre|tire) (?:keeps )?(?:going (?:down|flat)|losing air|deflating|is flat|flat)/, /(?:slow )?puncture/, /flat (?:tyre|tire)/],
    suspects: [
      { id: 'puncture', label: 'A tyre losing air (a puncture)', parts: ['tyre'], p: 0.6, quick: 'check all four with a gauge' },
      { id: 'cold', label: 'Cold weather dropping the pressures', parts: ['tyre'], p: 0.25, quick: 'came on on a cold morning?', diy: 'DIY', cost: [0, 2], covers: 'air at a garage forecourt' },
      { id: 'tpms_sensor', label: 'A tyre sensor’s battery', parts: ['rim'], p: 0.15, quick: 'pressures right but the light stays?', diy: 'GARAGE', cost: [40, 90], covers: 'a sensor fitted' },
    ],
  },
];

/** The symptoms where a safety line must be said, first and once. */
export const DANGEROUS = ['brake_grind', 'brake_squeal', 'soft_pedal', 'pull_brake', 'judder_brake', 'wobble_speed', 'clunk_bumps', 'oil_light', 'overheating', 'engine_light', 'abs_light', 'fuel_smell', 'burning_smell', 'white_smoke', 'knock', 'heavy_steering', 'tyre_edge', 'tpms_light', 'headlamp_out', 'brake_lamp_out', 'exhaust_blow', 'hum_speed', 'stalling', 'wipers'];

/** A word that makes it about a car (for the symptoms whose words alone could be about anything). */
export const CAR_WORDS = /\b(?:car|cars|van|motor|vehicle|engine|bonnet|exhaust|clutch|gears?|gearbox|tyres?|tires?|wheels?|steering|dash(?:board)?|mot|mph|motorway|driving|drive|drives|drove|ignition|accelerat\w*|brak\w*|idle|idling|revs?|starter|alternator|motorbike|jeep|truck)\b/;

const norm = (t: string) => String(t ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

/** Which symptom his words describe (the longest match wins; the table's order breaks a tie), or null. */
export function symptomOf(text: string): Symptom | null {
  const t = norm(text);
  if (!t || t.length > 300) return null;
  const car = CAR_WORDS.test(t);
  let best: { s: Symptom; n: number } | null = null;
  for (const s of SYMPTOMS) {
    if (s.needsCar && !car) continue;
    for (const re of s.says) {
      const m = re.exec(t);
      if (m && (!best || m[0].length > best.n)) best = { s, n: m[0].length };
    }
  }
  return best?.s ?? null;
}

/** A suspect, with its check, verdict and cost filled in from its first part's sheet where it has none of its own. */
export interface Suspect {
  id: string;
  label: string;
  parts: PartId[];
  /** 0–1, after the MOT's say. */
  likely: number;
  quick: string;
  check: string;
  diy: Diy;
  cost: [number, number];
  covers: string;
  /** What the MOT said that points to it. */
  mot?: MotLine;
}

export interface FaultPick {
  symptom: Symptom;
  suspects: Suspect[];
  safety?: string;
  view: View;
  /** The parts to light, the most likely first. */
  lit: PartId[];
  /** NEXT STEP: the check to do first. */
  next: string;
  /** Suspects left out because the car has no such part (an electric car's exhaust). */
  dropped: number;
}

/**
 * The suspects for his words, most likely first. The MOT history (the latest tests' advisories and failures) raises the
 * suspects whose parts it names; an electric car drops what it does not have.
 */
export function pickFault(text: string, opts: { lines?: MotLine[]; electric?: boolean } = {}): FaultPick | null {
  const symptom = symptomOf(text);
  return symptom ? faultFor(symptom, opts) : null;
}

export function faultFor(symptom: Symptom, opts: { lines?: MotLine[]; electric?: boolean } = {}): FaultPick {
  const lines = opts.lines ?? [];
  let dropped = 0;
  const raw = symptom.suspects.flatMap((d) => {
    if (opts.electric && d.parts.every((p) => PARTS[p].ice)) {
      dropped++;
      return [];
    }
    const first = PARTS[d.parts[0]!];
    const mot = lines.find((l) => d.parts.some((p) => PARTS[p].mot?.test(l.text)));
    return [{ id: d.id, label: d.label, parts: d.parts, likely: d.p * (mot ? (/fail|major|dangerous/i.test(mot.type) ? 2.4 : 1.8) : 1), quick: d.quick, check: d.check ?? first.check, diy: d.diy ?? first.diy, cost: d.cost ?? first.cost, covers: d.covers ?? first.covers, ...(mot ? { mot } : {}) }];
  });
  const sum = raw.reduce((s, x) => s + x.likely, 0) || 1;
  const suspects = raw.map((x) => ({ ...x, likely: Math.round((x.likely / sum) * 100) / 100 })).sort((a, b) => b.likely - a.likely);
  // the view is the top suspect's (the wheel for the brakes, the bay for the battery); what is seen there lights first
  const top = suspects[0];
  const view = top ? viewOf(top.parts[0]!) : symptom.view;
  const lit: PartId[] = [];
  for (const s of suspects.slice(0, 3)) for (const p of s.parts) if (!lit.includes(p) && viewOf(p) === view) lit.push(p);
  for (const s of suspects.slice(0, 3)) for (const p of s.parts) if (!lit.includes(p)) lit.push(p);
  return {
    symptom,
    suspects,
    ...(symptom.safety ? { safety: symptom.safety } : {}),
    view,
    lit,
    next: top ? top.check : 'That does not fit this car: say what you notice in other words.',
    dropped,
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The card's line: the top suspect, its quick check, its cost — a first estimate. */
export function faultLine(f: FaultPick): string {
  const top = f.suspects[0];
  if (!top) return 'That does not fit this car: say what you notice in other words.';
  const cost = top.cost[1] === 0 ? 'Usually nothing to pay' : `${money(top.cost)}, a first estimate`;
  const check = top.quick.endsWith('?') ? cap(top.quick) : `${cap(top.quick)}.`;
  return `Likely: ${top.label.charAt(0).toLowerCase()}${top.label.slice(1)}. ${check} ${cost}.`;
}

/** The cost in words for a sheet or a list: "£100–£220: a pair of front pads fitted. A first estimate, not a quote." */
export function costWords(s: Pick<Suspect, 'cost' | 'covers'>): string {
  if (s.cost[1] === 0) return `Nothing to pay: ${s.covers}.`;
  return `${money(s.cost)}: ${s.covers}. ${cap(ESTIMATE)}.`;
}

// ---------------------------------------------------------------- his words that open the views (no model)

/** "open the bonnet" → bay; "show me the brakes" → wheel; "what's under it" → under; "show me the car" → car; else null. */
export function viewAsked(text: string): View | null {
  const t = norm(text).replace(/[.!?]+$/, '').replace(/^(?:ghosty,? |please |can you |could you |hey ghosty,? )+/, '').replace(/ please$/, '');
  if (/^(?:open|lift|pop|raise|put up|get up) (?:the |its |his |her |my |dad'?s |the car'?s )?(?:bonnet|hood)(?: up)?$|^bonnet up$|^(?:show|let me see) (?:me )?(?:the |its )?engine(?: bay)?$|^(?:show me |let me see )?(?:what'?s|what is) under the (?:bonnet|hood)$|^show me under the (?:bonnet|hood)$/.test(t)) return 'bay';
  if (/^(?:show|let me see) (?:me )?(?:the |its )?(?:brakes?|brake pads|pads|brake discs?|discs?|wheels?|tyres?|suspension|wheel and brakes)$|^take (?:a|the|one) wheel off$|^wheel off$/.test(t)) return 'wheel';
  if (/^(?:show me |let me see )?(?:what'?s|what is) under(?:neath)? (?:it|the car|there)$|^show me (?:the )?under(?:side|neath)(?: of (?:it|the car))?$|^(?:show me )?underneath$|^lift (?:it|the car) up$|^show me the exhaust$/.test(t)) return 'under';
  if (/^show me the (?:car|outside)$|^close the (?:bonnet|hood)$|^(?:put the wheel back on|wheel back on)$/.test(t)) return 'car';
  return null;
}

/** Whose car his words are about: "my dad's car" → "dad", "Haris's van" → "haris", "my car" → "me"; '' when unsaid. */
export function whoseIn(text: string): string {
  const t = norm(text);
  const m = /\b(?:my\s+(?:[a-z]+\s+)?([a-z][a-z-]*)'s?|([a-z][a-z-]*)'s|(my|our))\s+(?:car|van|motor|motorbike|truck|jeep)\b/.exec(t);
  if (!m) return '';
  return m[3] ? 'me' : (m[1] ?? m[2] ?? '').replace(/'s$/, '');
}
