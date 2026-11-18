// Solmar Heat: tuning numbers, world layout and the sun-soaked palette.
// The city is a road grid: 8 roads each way, blocks between them, a beach band
// along the south edge. All sizes are world pixels; the view is 1280x720.

export const STEP = 1 / 60;
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const MARGIN = 120;
export const ROAD = 104;
export const BLOCK = 380;
export const PITCH = ROAD + BLOCK;
export const N_ROADS = 8;
export const BEACH_BAND = 420;
export const WORLD_W = MARGIN * 2 + N_ROADS * ROAD + (N_ROADS - 1) * BLOCK;
export const WORLD_H = WORLD_W + BEACH_BAND;
export const BEACH_TOP = WORLD_W;
export const SAND_TOP = WORLD_W + 60;
export const WATER_TOP = WORLD_W + 220;

export const SAVE_KEY = 'solmar-heat.save.v1';
export const SETTINGS_KEY = 'solmar-heat.settings.v1';

/** Centre of road i (0..N_ROADS-1), same spacing on both axes. */
export function roadCenter(i) {
  return MARGIN + ROAD / 2 + i * PITCH;
}
/** Block (bx,by) footprint: x,y,w,h of the land between the roads. */
export function blockRect(bx, by) {
  return {
    x: roadCenter(bx) + ROAD / 2,
    y: roadCenter(by) + ROAD / 2,
    w: BLOCK,
    h: BLOCK,
  };
}

export const PALETTE = {
  grass: '#79a95b',
  grassDry: '#8fb168',
  park: '#5f9c4c',
  sand: '#e7d194',
  sandWet: '#dcc389',
  water: '#2b93ad',
  waterDeep: '#1e7a96',
  foam: '#eaf6f4',
  asphalt: '#4b4b55',
  asphaltDark: '#41414b',
  roadLine: '#e9e4d2',
  sidewalk: '#c8c0ae',
  curb: '#a89e88',
  plaza: '#b7ab8f',
  wall: '#8d8577',
  roofTerra: '#c4704a',
  roofSand: '#d9c193',
  roofWhite: '#e9e4d6',
  roofTeal: '#5f9c8e',
  roofSlate: '#6d7c8c',
  glass: '#86aec9',
  glassDark: '#5d86a3',
  shadow: 'rgba(40,30,20,0.28)',
  leaf: '#4e8f3e',
  leafDark: '#3d7a31',
  palm: '#5da244',
  trunk: '#7a5a3c',
  text: '#f5f1e6',
  hudBg: 'rgba(20,18,26,0.62)',
  gold: '#f2c14e',
  policeBlue: '#3a6fd8',
  policeRed: '#e0483e',
};

export const PLAYER_CFG = {
  walk: 175,
  sprint: 265,
  accel: 1400,
  radius: 13,
  health: 100,
  punchRange: 34,
  punchDamage: 18,
  punchCooldown: 0.42,
};

export const WANTED_CFG = {
  maxStars: 5,
  evadeBase: 4.5,
  evadePerStar: 1.2,
  sightRange: 520,
  bustTouchTime: 1.15,
  bustCarTime: 3.0,
  paintCost: 150,
};

export const MISSION_DEBT = 5000;

export const DISTRICTS = [
  { name: 'Downtown Solmar', x0: 2, y0: 2, x1: 4, y1: 4 },
  { name: 'Palm Beach', x0: 0, y0: 6, x1: 7, y1: 6 },
  { name: 'The Port', x0: 6, y0: 2, x1: 6, y1: 5 },
  { name: 'Westside', x0: 0, y0: 0, x1: 1, y1: 5 },
  { name: 'Parkside', x0: 5, y0: 0, x1: 5, y1: 1 },
  { name: 'Marina Bay', x0: 6, y0: 6, x1: 7, y1: 7 },
  { name: 'Uptown', x0: 2, y0: 0, x1: 4, y1: 1 },
  { name: 'Old Town', x0: 0, y0: 0, x1: 7, y1: 7 },
];

/** District name for a world position (first matching block range wins). */
export function districtAt(x, y) {
  const bx = Math.max(0, Math.min(N_ROADS - 2, Math.floor((x - MARGIN - ROAD) / PITCH)));
  const by = Math.max(0, Math.min(N_ROADS - 2, Math.floor((y - MARGIN - ROAD) / PITCH)));
  if (y >= BEACH_TOP) return 'Palm Beach';
  for (const d of DISTRICTS) {
    if (bx >= d.x0 && bx <= d.x1 && by >= d.y0 && by <= d.y1) return d.name;
  }
  return 'Solmar';
}
