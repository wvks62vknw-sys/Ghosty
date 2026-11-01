/**
 * A CAR, A ROBOT, A TV (BRIEF-REST-D 1; OWNER-ISSUES 91: "to the bolt" only as a concept): the real parts named — a motor
 * and its controller, a battery and its chemistry, the sensors, a frame material — each with what it does and a typical
 * price range from October 2026, and the one line "A concept with real parts, not a build plan." Nothing is drawn as if it
 * were a build: no plan, no 3-D, no cut list, no total. Pure.
 */
import type { Design, Kind, Params } from './kits';

export const CONCEPT_LINE = 'A concept with real parts, not a build plan.';

interface ConceptPart {
  role: string;
  name: string;
  why: string;
  typical: string;
}
const CONCEPTS: Partial<Record<Kind, { title: string; summary: string; parts: ConceptPart[]; safety: string[]; law: { title: string; words: string; source: string }[] }>> = {
  car: {
    title: 'A small electric car',
    summary: 'a two-seat electric runabout on a steel frame',
    parts: [
      { role: 'Motor', name: 'A 72 V brushless hub motor, about 5 kW (a QS Motor hub motor is one real make)', why: 'drives a rear wheel directly: no gearbox', typical: '£500–£900' },
      { role: 'Controller', name: 'A 72 V sine-wave brushless motor controller (Kelly’s KLS series is one)', why: 'turns the throttle into current for the motor, and brakes it regeneratively', typical: '£250–£450' },
      { role: 'Battery', name: 'A 72 V lithium iron phosphate (LiFePO4) pack, about 100 Ah (7 kWh), with its battery management system', why: 'LiFePO4 is the safer lithium chemistry: it does not run away into fire as easily', typical: '£2,000–£3,500' },
      { role: 'Charger', name: 'A 72 V LiFePO4 charger, 10–20 A, from a home socket', why: 'a full charge overnight', typical: '£250–£450' },
      { role: 'Sensors', name: 'A hall-effect throttle, wheel-speed sensors, a battery temperature sensor', why: 'the controller and the battery system read them', typical: '£60–£150' },
      { role: 'Frame', name: 'A welded steel tube space frame (S355 square tube, 40 × 40 × 3 mm)', why: 'strong, cheap and weldable at home with training', typical: '£400–£800 of steel' },
      { role: 'Brakes and steering', name: 'Hydraulic disc brakes on all four wheels; a rack-and-pinion steering rack', why: 'the parts a test looks at first', typical: '£400–£900' },
    ],
    safety: ['A 72 V pack can kill and can start a fire: battery work with insulated tools, a fuse and an isolator, and training.', 'Welding a frame is a skill: a college course first, or a fabricator.'],
    law: [{ title: 'On the road', words: 'A home-built car needs Individual Vehicle Approval (IVA) from DVSA before it can be registered and driven on UK roads; without it, private land only.', source: 'gov.uk, Individual Vehicle Approval' }],
  },
  robot: {
    title: 'A small wheeled robot',
    summary: 'a robot that follows a line, avoids walls and can be driven from a phone',
    parts: [
      { role: 'Motors', name: 'Two 12 V DC gear motors with encoders, about 200 rpm (the JGA25-370 is a common one)', why: 'drive the two wheels; the encoders count how far each has turned', typical: '£10–£20 each' },
      { role: 'Motor controller', name: 'A dual H-bridge motor driver (a TB6612FNG board)', why: 'lets the small computer run the motors forwards and back at any speed', typical: '£5–£10' },
      { role: 'Brain', name: 'A Raspberry Pi Pico 2 W (or a Raspberry Pi 5 to add a camera)', why: 'reads the sensors and decides; the W has Wi-Fi for the phone', typical: '£6–£80' },
      { role: 'Battery', name: 'A 2S lithium-ion pack of 18650 cells (7.4 V) with a protection board', why: 'lithium-ion holds a lot for its weight; the board stops it over-charging or running flat', typical: '£15–£30' },
      { role: 'Sensors', name: 'An ultrasonic range finder (HC-SR04), two infrared line sensors (TCRT5000), a motion sensor (MPU-6050)', why: 'see a wall, follow a line, know which way is up', typical: '£8–£15' },
      { role: 'Frame', name: '3 mm aluminium plate or 5 mm acrylic, cut to shape, on a ball castor at the front', why: 'stiff and light; acrylic can be laser-cut at a makerspace', typical: '£10–£25' },
    ],
    safety: ['Lithium cells need their own charger and a protection board: never charge them unattended or when damaged.'],
    law: [],
  },
  tv: {
    title: 'A big screen from a panel',
    summary: 'a 55-inch 4K screen built round a replacement panel',
    parts: [
      { role: 'Panel', name: 'A 55-inch 4K LCD panel with its T-con board (sold as a replacement for a known TV)', why: 'the picture itself; the T-con board drives its rows and columns', typical: '£180–£300' },
      { role: 'Main board', name: 'A universal LCD TV main board matched to the panel’s connector (V-by-One for 4K)', why: 'takes HDMI in and sends the picture to the panel', typical: '£40–£90' },
      { role: 'Backlight', name: 'LED backlight strips matched to the panel', why: 'an LCD makes no light of its own', typical: '£25–£50' },
      { role: 'Power', name: 'A universal LED TV power board', why: 'mains in, the low voltages out', typical: '£25–£45' },
      { role: 'Sound', name: 'Two 10 W speakers', why: 'the main board has the amplifier', typical: '£10–£20' },
      { role: 'Frame', name: 'An aluminium extrusion frame with a VESA mount on the back', why: 'holds the panel flat (it cracks if it twists)', typical: '£40–£80' },
    ],
    safety: ['The power board carries mains voltage: build it only with the right training, and never with it plugged in.', 'A big panel cracks if it bends: two people, flat, always.'],
    law: [],
  },
};

export function conceptDesign(p: Params): Design {
  const c = CONCEPTS[p.kind] ?? CONCEPTS.robot!;
  return {
    params: p, kind: p.kind, title: `${c.title} (a concept)`, concept: true,
    summary: `${c.summary}. ${CONCEPT_LINE}`,
    groups: [], lines: [], boxes: [], views: [], parts: c.parts,
    steps: ['Learn the part that frightens you most first (the battery, the mains, the welding) with a course or a club.', 'Build the smallest version that moves or lights, on a bench, before any frame.', 'Then the frame, then the rest, testing each part as it goes on.'],
    tools: [], hours: 0, safety: c.safety, law: c.law, notes: [...p.notes, CONCEPT_LINE], total: 0,
  };
}
