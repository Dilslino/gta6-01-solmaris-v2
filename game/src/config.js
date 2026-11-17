// Solmaris — configuration: world size, districts, missions, shops, tuning.
// Every name, place and character here is original.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmaris-save-v1';

// Five districts, west to east, each with its own palette and name.
export const DISTRICTS = [
  { name: 'Marina Bay', x0: 0, x1: 640, ground: '#c9b489', roof: '#e8b04b', accent: '#2e7f9e', label: '#7a5c1e' },
  { name: 'Old Harbor', x0: 640, x1: 1280, ground: '#b7a98c', roof: '#b3543f', accent: '#8a5a2b', label: '#5c2f1d' },
  { name: 'Palm Court', x0: 1280, x1: 1920, ground: '#c4b896', roof: '#4f8f6b', accent: '#d9a441', label: '#2c4a35' },
  { name: 'Sunvale', x0: 1920, x1: 2560, ground: '#cbb98f', roof: '#d97b2f', accent: '#c94f6d', label: '#6b2f1a' },
  { name: 'Coral Heights', x0: 2560, x1: 3200, ground: '#bfae8e', roof: '#7a6fb0', accent: '#3f7fb0', label: '#33284f' },
];

// Road graph: avenues (vertical) and streets (horizontal). Roads are 96 px wide.
export const AVENUES = [320, 640, 960, 1280, 1600, 1920, 2240, 2560, 2880];
export const STREETS = [300, 600, 900, 1200, 1500, 1800, 2100];
export const ROAD_W = 96;

// Player / car tuning.
export const WALK_SPEED = 235;
export const CAR_TOP_SPEED = 560;
export const CAR_ACCEL = 420;
export const CAR_BRAKE = 700;
export const CAR_REVERSE = 220;
export const CAR_TURN = 2.6;

// The six-mission story chain, "The Solmaris Job". All markers sit in open plazas,
// never inside a building. Steps: goto | steal | deliver | lose | fight | finale.
export const MISSIONS = [
  {
    title: '1 — First Light', giver: 'Mara Voss',
    brief: 'Mara is waiting at Palm Plaza. Walk over and hear the job.',
    steps: [{ type: 'goto', x: 1600, y: 1200, text: 'Meet Mara at Palm Plaza' }],
    reward: 150,
  },
  {
    title: '2 — Borrowed Wheels', giver: 'Mara Voss',
    brief: 'A job needs wheels. Take any parked car, then bring it to the Sunvale garage.',
    steps: [
      { type: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', x: 2240, y: 900, text: 'Drive to the Sunvale garage' },
    ],
    reward: 400,
  },
  {
    title: '3 — Dock Pickup', giver: 'Dario Fen',
    brief: 'Dario left a package at the Old Harbor docks. Collect it and run it to Marina Bay.',
    steps: [
      { type: 'goto', x: 960, y: 300, text: 'Collect the package at the Old Harbor docks' },
      { type: 'goto', x: 320, y: 1800, text: 'Deliver the package to Marina Bay' },
    ],
    reward: 650,
  },
  {
    title: '4 — Hot Pursuit', giver: 'Mara Voss',
    brief: 'The harbor patrol spotted you. Lose the heat — get your wanted level to zero.',
    steps: [{ type: 'lose', text: 'Lose the police — wanted level back to zero' }],
    reward: 500,
  },
  {
    title: '5 — The Courier', giver: 'Dario Fen',
    brief: 'A courier is moving the vault codes through Coral Heights. Take down his three guards and grab the case.',
    steps: [
      { type: 'fight', x: 2880, y: 1500, text: 'Take down the 3 guards at Coral Heights' },
      { type: 'goto', x: 2880, y: 1500, text: 'Grab the case' },
    ],
    reward: 1200,
  },
  {
    title: '6 — The Solmaris Job', giver: 'Mara Voss',
    brief: 'The vault codes are yours. Hit the Marina Bay drop, then vanish across Palm Plaza. Finish the job.',
    steps: [
      { type: 'goto', x: 320, y: 600, text: 'Reach the Marina Bay drop' },
      { type: 'goto', x: 1600, y: 1200, text: 'Getaway — reach Palm Plaza to finish the job' },
    ],
    reward: 5000,
  },
];

// Three shops. Buying is done at the shop marker (press E, then 1/2/3, Esc to leave).
export const SHOPS = [
  {
    id: 'food', name: 'Taco Sol', kind: 'food', x: 1280, y: 600,
    items: [
      { name: 'Sun Taco', price: 25, desc: 'Restores 30 health', heal: 30 },
      { name: 'Marina Feast', price: 60, desc: 'Restores full health', heal: 100 },
      { name: 'Cold Limonada', price: 12, desc: 'Restores 15 health', heal: 15 },
    ],
  },
  {
    id: 'clothes', name: 'Lumen Outfits', kind: 'clothes', x: 1920, y: 1500,
    items: [
      { name: 'Plain Jacket', price: 120, desc: 'Wanted cools off faster', cool: 1 },
      { name: 'Harbor Coat', price: 300, desc: 'Wanted cools off much faster', cool: 2 },
      { name: 'Sun Cap', price: 45, desc: 'A little less noticeable', cool: 0.5 },
    ],
  },
  {
    id: 'weapons', name: 'Harbor Arms', kind: 'weapons', x: 960, y: 2100,
    items: [
      { name: 'Pistol + 24 rounds', price: 350, desc: 'A sidearm. Aim with the mouse, click to fire', gun: true, ammo: 24 },
      { name: 'Ammo box (24)', price: 120, desc: '24 pistol rounds', ammo: 24 },
      { name: 'Street Bat', price: 80, desc: 'A solid bat. Press F to swing', bat: true },
    ],
  },
];

export const PLAYER_START = { x: 1600, y: 1320 };
export const START_CASH = 200;
