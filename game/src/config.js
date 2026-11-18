// Solmar Heat — every tuning number, name and colour in one place. The world is
// a fixed logical size; the renderer scales the 1280x720 view to the window, so
// no rule below depends on the screen size. All simulation randomness comes from
// the single fixed seed, so every run builds the identical city.

export const STEP = 1 / 60;
export const SEED = 20261117;

export const WORLD = { width: 3732, height: 4252 };

// Road centre lines, eight each way, evenly spaced. The grid is the skeleton
// everything else hangs off: traffic, police, pedestrians and mission routing.
export const ROADS = [172, 656, 1140, 1624, 2108, 2592, 3076, 3560];
export const ROAD_HALF = 46;
export const SIDEWALK = 16;

export const BEACH_TOP = 3656;
export const WATER_TOP = 3996;

export const VERTICAL_NAMES = [
  'Bayview Ave', 'Jacaranda Ave', 'Solmar Blvd', 'Founder Ave',
  'Marina Ave', 'Harbor Rd', 'Coral Ave', 'Sunset Ave',
];
export const HORIZONTAL_NAMES = [
  'Uptown St', 'Parkside St', 'Westside St', 'Market St',
  'Downtown St', 'Port St', 'Palm St', 'Ocean Drive',
];

// Road classes: the coastal highway, three avenues, and ordinary streets.
export const HIGHWAY_ROW = 7;
export const AVENUE_COLS = [2, 3, 4];

export function roadClass(vertical, index) {
  if (!vertical && index === HIGHWAY_ROW) return 'highway';
  if (vertical && AVENUE_COLS.includes(index)) return 'avenue';
  return 'street';
}

export function roadName(vertical, index) {
  return vertical ? VERTICAL_NAMES[index] : HORIZONTAL_NAMES[index];
}

// District rectangles, checked in order; the beach band is Palm Beach.
export const DISTRICTS = [
  { name: 'Uptown', x0: 0, y0: 0, x1: 1866, y1: 1240 },
  { name: 'Parkside', x0: 1866, y0: 0, x1: 3732, y1: 1240 },
  { name: 'Westside', x0: 0, y0: 1240, x1: 1240, y1: 2480 },
  { name: 'Downtown Solmar', x0: 1240, y0: 1240, x1: 2480, y1: 2480 },
  { name: 'The Port', x0: 2480, y0: 1240, x1: 3732, y1: 2480 },
  { name: 'Old Town', x0: 0, y0: 2480, x1: 1866, y1: 3656 },
  { name: 'Marina Bay', x0: 1866, y0: 2480, x1: 3732, y1: 3656 },
  { name: 'Palm Beach', x0: 0, y0: 3656, x1: 3732, y1: 4252 },
];

export const PLAYER = {
  radius: 13,
  walk: 235,
  sprint: 345,
  health: 100,
  startMoney: 250,
  debt: 5000,
};

export const CAR = {
  accel: 470,
  brake: 720,
  reverseMax: 190,
  turn: 2.7,
  grip: 6.5,
  drag: 0.55,
  radius: 21,
  health: 100,
};

// Car models: size, top speed, acceleration factor and paint choices.
export const MODELS = {
  sedan: { label: 'Sedan', w: 26, l: 48, top: 470, pep: 1.0, paints: ['#c94f43', '#4a6b8a', '#d8d3c4', '#5a5a5e', '#7a8a4a'] },
  hatch: { label: 'Hatch', w: 24, l: 42, top: 445, pep: 1.05, paints: ['#e0a83e', '#3e7a6a', '#c4c4c4', '#8a4a6a'] },
  van: { label: 'Van', w: 27, l: 52, top: 400, pep: 0.85, paints: ['#e8e4d6', '#6a7a8a', '#a8a090'] },
  coupe: { label: 'Coupe', w: 25, l: 46, top: 525, pep: 1.15, paints: ['#b03a30', '#2e4a6a', '#e8c83e', '#222226'] },
  muscle: { label: 'Muscle', w: 27, l: 50, top: 500, pep: 1.2, paints: ['#7a2a20', '#3a3a3e', '#c97a2e'] },
  taxi: { label: 'Taxi', w: 26, l: 47, top: 460, pep: 1.0, paints: ['#f2c94c'] },
  veloce: { label: 'Veloce GT', w: 25, l: 47, top: 585, pep: 1.35, paints: ['#e0483e'] },
  police: { label: 'Interceptor', w: 26, l: 49, top: 432, pep: 1.1, paints: ['#1d2a38'] },
};

// Wanted and bust tuning (spec section 12 — hard requirements). Stars rise
// ONLY from new witnessed crimes, never from time, proximity, or being chased.
export const WANTED = {
  theftWitness: 200,
  shotWitness: 420,
  hitWitness: 320,
  heatCooldown: 3.0,
  spawnMin: 700,
  spawnMax: 900,
  maxCars: 4,
  bustRadius: 130,
  bustSlow: 60,
  bustFill: 0.22,
  bustDrain: 1.2,
  unseenRadius: 600,
  decayDelay: 10,
  decayEvery: 8,
  ramDamage: 4,
  repaintCost: 150,
  bustFine: 200,
  wastedFine: 100,
};

export const WEAPONS = {
  pistol: { label: 'Pistol', damage: 26, interval: 0.24, range: 540, spread: 0.035, speed: 1150 },
  rifle: { label: 'Rifle', damage: 34, interval: 0.11, range: 720, spread: 0.055, speed: 1400 },
};

export const MISSIONS = [
  { id: 'm1', title: 'Back Behind the Wheel', payout: 300 },
  { id: 'm2', title: 'Getaway Driver', payout: 600 },
  { id: 'm3', title: 'Three Drops', payout: 900 },
  { id: 'm4', title: 'The Veloce GT', payout: 1200 },
  { id: 'm5', title: 'The Big Score', payout: 2500 },
];

export const PALETTE = {
  grass: '#79a75b',
  grassDark: '#6b9a4e',
  sidewalk: '#cfc4ac',
  curb: '#b8ac90',
  asphalt: '#4b4b54',
  asphaltDark: '#41414a',
  line: '#e8e4d6',
  yellow: '#f2c94c',
  sand: '#ecd9a0',
  sandDark: '#e0c888',
  water: '#3f8fb5',
  waterDeep: '#2e7295',
  boardwalk: '#b59a72',
  panel: 'rgba(12, 16, 24, 0.74)',
  panelEdge: 'rgba(255, 255, 255, 0.16)',
  text: '#f2efe6',
  muted: '#b8b4a6',
  accent: '#ffd34d',
  route: '#b46bff',
  routeCombat: '#ff5a4e',
  star: '#ffd34d',
  health: '#6ac86a',
  healthLow: '#e0483e',
  money: '#7ed07e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'solmar-heat.save.v1';

export const VIEW = { width: 1280, height: 720 };
