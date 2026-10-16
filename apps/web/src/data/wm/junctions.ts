/**
 * Motorway junctions of the West Midlands: where a National Highways report like "M6 southbound
 * between J6 and J5" is, since the reports carry no coordinates. One entry per junction (both
 * carriageways' slip-road nodes averaged), [latitude, longitude, name]. Source: OpenStreetMap
 * (© OpenStreetMap contributors, ODbL; https://www.openstreetmap.org/copyright), Overpass query
 * run on 2026-10-16. Regenerate with the query in this comment when a junction changes.
 *
 * Overpass queries (POST as form field data=..., bounding box south,west,north,east).
 * Query 1, the junction nodes:
 *   [out:json][timeout:90];
 *   node["highway"="motorway_junction"]["ref"](52.20,-2.50,52.80,-1.20);
 *   out body;
 * Query 2, the motorway ways that contain those nodes, so each node is attributed to a road:
 *   [out:json][timeout:90];
 *   node["highway"="motorway_junction"]["ref"](52.20,-2.50,52.80,-1.20)->.j;
 *   way(bn.j)["highway"="motorway"]["ref"];
 *   out body;
 * Query 3, M54 J7 (just west of the box) and the A38(M), which carries no numbered junctions:
 *   [out:json][timeout:90];
 *   node["highway"="motorway_junction"]["ref"](52.68,-2.60,52.75,-2.50)->.j7;
 *   way(bn.j7)["highway"="motorway"]["ref"]->.w7;
 *   way["highway"="motorway"]["ref"="A38(M)"](52.45,-1.95,52.55,-1.80)->.wa;
 *   node(w.wa)["highway"="motorway_junction"]->.ja;
 *   (.j7; .w7; .ja;);
 *   out body;
 *   .wa out geom;
 * Then: each junction node belongs to the motorway way that contains it (where two roads share the
 * node, the road that runs through it); nodes are grouped by road and junction ref (trimmed,
 * upper-cased), their coordinates averaged to 5 decimals, and the most common name tag kept.
 * Roads kept: M6, M5, M42, M54, M6 Toll (T1-T8), A38(M), M69.
 */
export const WM_JUNCTIONS: Record<string, Record<string, [number, number, string]>> = {
  'M6': {
    '1': [52.40829, -1.24639, 'Rugby'],
    '2': [52.43857, -1.42607, 'Ansty Interchange'],
    '3': [52.46281, -1.49449, 'Exhall Interchange'],
    '3A': [52.47566, -1.67651, 'Coleshill Interchange'],
    '4': [52.48094, -1.70894, 'Coleshill Interchange'],
    '4A': [52.51215, -1.75107, 'Water Orton Interchange'],
    '5': [52.50938, -1.78777, 'Castle Bromwich Interchange'],
    '6': [52.51174, -1.86381, 'Gravelly Hill Interchange'],
    '7': [52.55216, -1.93137, 'Great Barr Interchange'],
    '8': [52.55621, -1.96261, 'Ray Hall Interchange'],
    '9': [52.56679, -2.00328, 'Wednesbury Interchange'],
    '10': [52.58565, -2.01436, 'Bentley Interchange'],
    '10A': [52.62716, -2.04551, 'Essington Interchange'],
    '11': [52.65891, -2.06426, 'Laney Green Interchange'],
    '11A': [52.67470, -2.08327, 'Saredon'],
    '12': [52.69055, -2.10307, 'Gailey Interchange'],
    '13': [52.76330, -2.10743, 'Dunston Interchange'],
  },
  'M5': {
    '1': [52.51258, -1.97492, 'West Bromwich Interchange'],
    '2': [52.49283, -2.01881, 'Oldbury'],
    '3': [52.44978, -2.01479, 'Quinton Interchange'],
    '4': [52.37881, -2.04831, 'Lydiate Ash'],
    '4A': [52.35095, -2.07487, 'Catshill'],
    '5': [52.28793, -2.12006, 'Rashwood Interchange'],
    '6': [52.21227, -2.15754, 'Warndon Interchange'],
  },
  'M42': {
    '1': [52.35531, -2.04051, 'Harvester Island'],
    '2': [52.36150, -1.94914, 'Hopwood Park'],
    '3': [52.35481, -1.88602, 'Portway Island'],
    '3A': [52.34931, -1.81622, 'Umberslade'],
    '4': [52.38046, -1.78554, 'Monkspath Interchange'],
    '5': [52.40510, -1.74778, 'Copt Hill Interchange'],
    '5A': [52.41988, -1.72279, 'Catherine-de-Barnes Interchange'],
    '6': [52.44694, -1.71100, 'Bickenhill Interchange'],
    '7': [52.47222, -1.71151, 'Coleshill Interchange'],
    '7A': [52.49117, -1.71604, 'Coleshill Interchange'],
    '8': [52.51971, -1.72637, 'Water Orton Interchange'],
    '9': [52.53448, -1.72648, 'Dunton Interchange'],
    '10': [52.60313, -1.64267, 'Tamworth Interchange'],
    '11': [52.68946, -1.54846, 'Appleby Magna'],
  },
  'M54': {
    '1': [52.63837, -2.08522, 'Featherstone Interchange'],
    '2': [52.63842, -2.13066, 'Coven Heath Interchange'],
    '3': [52.65841, -2.29968, 'Tong Interchange'],
    '4': [52.67931, -2.40615, 'Castle Farm Interchange'],
    '5': [52.68371, -2.44959, 'Forge Interchange'],
    '6': [52.68865, -2.48771, 'Ketley Dingle Interchange'],
    '7': [52.69053, -2.54145, ''],
  },
  'M6 TOLL': {
    'T1': [52.52912, -1.72964, 'Dunton Interchange'],
    'T2': [52.55206, -1.73773, ''],
    'T3': [52.57273, -1.77280, 'Langley Mill'],
    'T4': [52.63840, -1.81206, 'Weeford Interchange'],
    'T5': [52.64968, -1.84001, ''],
    'T6': [52.66172, -1.92633, ''],
    'T7': [52.67186, -2.01144, 'Churchbridge'],
    'T8': [52.66543, -2.05447, 'Wedges Mills'],
  },
  // The Aston Expressway's junctions carry no numbers in OSM (nor on the road), so they are keyed
  // by the junction's name, upper-cased: Dartmouth Circus (A4540), Park Circus, and the M6 J6 end.
  'A38(M)': {
    'DARTMOUTH CIRCUS': [52.49354, -1.88821, 'Dartmouth Circus'],
    'GRAVELLY HILL INTERCHANGE': [52.50904, -1.87126, 'Gravelly Hill Interchange'],
    'PARK CIRCUS': [52.50573, -1.87956, 'Park Circus'],
  },
  'M69': {
    '1': [52.51508, -1.36156, 'Stretton Baskerville'],
    '2': [52.54440, -1.31308, 'Hinckley'],
    '3': [52.60087, -1.20140, ''],
  },
};
