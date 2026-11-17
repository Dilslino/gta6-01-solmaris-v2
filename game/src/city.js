// Solmaris — the city. A road graph (avenues x streets) over five districts,
// with buildings filling the blocks between roads, plus parks, palms, the
// beach and the sea. Everything is generated from the seed, so the city is
// the same every run with the same seed.
import { WORLD_W, WORLD_H, DISTRICTS, AVENUES, STREETS, ROAD_W, SHOPS } from './config.js';

const PALETTE = ['#e8e0c8', '#d9c9a3', '#c9b8d9', '#f0d9a8', '#cfe0d4', '#e8c9c0', '#d4d4e8', '#e8d9b0'];
const ROOFS = ['#b3543f', '#4f8f6b', '#d97b2f', '#7a6fb0', '#2e7f9e', '#c94f6d', '#8a5a2b', '#5a7f3f'];

export function districtAt(x) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1) return d;
  return DISTRICTS[DISTRICTS.length - 1];
}

export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  // Buildings fill each block between neighbouring roads, including the
  // edge strips out to the world border (but never on the western beach).
  const avs = [0, ...AVENUES, WORLD_W];
  const sts = [0, ...STREETS, WORLD_H];
  for (let ai = 0; ai < avs.length - 1; ai++) {
    for (let si = 0; si < sts.length - 1; si++) {
      const x0 = avs[ai] + (ai === 0 ? 14 : ROAD_W / 2 + 14);
      const x1 = avs[ai + 1] - (ai === avs.length - 2 ? 14 : ROAD_W / 2 + 14);
      const y0 = sts[si] + (si === 0 ? 14 : ROAD_W / 2 + 14);
      const y1 = sts[si + 1] - (si === sts.length - 2 ? 14 : ROAD_W / 2 + 14);
      if (x0 < 152 || x1 - x0 < 60 || y1 - y0 < 60) continue; // beach / sliver
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const d = districtAt(cx);
      if (rng.chance(0.14)) { // a park instead of buildings
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 7; t++) trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 15) });
        continue;
      }
      // 1-4 buildings per block.
      const cols = rng.chance(0.5) ? 2 : 1;
      const rows = rng.chance(0.4) ? 2 : 1;
      const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const bx = x0 + c * cw + 8, by = y0 + r * ch + 8;
          const bw = cw - 16, bh = ch - 16;
          if (bw < 40 || bh < 40) continue;
          const hgt = rng.int(1, 4);
          buildings.push({
            x: bx, y: by, w: bw, h: bh, hgt,
            color: rng.pick(PALETTE), roof: rng.pick(ROOFS),
            district: d.name,
            // a shaded parapet line gives the roof a second, higher plane
            roofInset: 8 + hgt * 2,
          });
        }
      }
      if (rng.chance(0.6)) trees.push({ x: cx + rng.range(-60, 60), y: cy + rng.range(-50, 50), r: rng.range(10, 16) });
    }
  }
  // Palm-lined beach + sea along the whole west edge.
  const palms = [];
  for (let y = 60; y < WORLD_H; y += 90) palms.push({ x: 56 + rng.range(-8, 8), y: y + rng.range(-14, 14), r: 12 });
  // Parked cars along the avenues (on the road shoulder).
  const parked = [];
  const carColors = ['#c94f4f', '#3f7fb0', '#e8b04b', '#4f8f6b', '#d9d9d9', '#5a4a6b', '#e87b2f', '#2b2b33'];
  for (let i = 0; i < 22; i++) {
    const av = rng.pick(AVENUES), st = rng.pick(STREETS);
    const vertical = rng.chance(0.5);
    parked.push({
      x: vertical ? av + (rng.chance(0.5) ? 26 : -26) : rng.range(200, WORLD_W - 200),
      y: vertical ? rng.range(200, WORLD_H - 200) : st + (rng.chance(0.5) ? 26 : -26),
      angle: vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
      color: rng.pick(carColors), parked: true, speed: 0,
    });
  }
  return { buildings, trees, parks, palms, parked, carColors, shops: SHOPS };
}

// --- collision helpers -------------------------------------------------
export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
  }
  return null;
}

// Push a circle (x,y,r) out of buildings and the world edge. Returns corrected {x,y,hit}.
export function collideCircle(city, x, y, r) {
  let hit = false;
  if (x < r + 4) { x = r + 4; hit = true; }
  if (x > WORLD_W - r - 4) { x = WORLD_W - r - 4; hit = true; }
  if (y < r + 4) { y = r + 4; hit = true; }
  if (y > WORLD_H - r - 4) { y = WORLD_H - r - 4; hit = true; }
  // The sea is west of x=110: nobody walks or drives into it.
  if (x < 118) { x = 118; hit = true; }
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r; y = ny + (dy / d) * r;
      } else {
        // centre inside the building: push out along the smallest overlap
        const left = x - b.x, right = b.x + b.w - x, top = y - b.y, bot = b.y + b.h - y;
        const m = Math.min(left, right, top, bot);
        if (m === left) x = b.x - r; else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r; else y = b.y + b.h + r;
      }
    }
  }
  return { x, y, hit };
}

// --- road graph --------------------------------------------------------
// Nodes are the intersections; edges join neighbouring intersections.
export function buildGraph() {
  const nodes = [];
  const index = new Map();
  for (const y of STREETS) for (const x of AVENUES) {
    index.set(`${x},${y}`, nodes.length);
    nodes.push({ x, y, links: [] });
  }
  const id = (x, y) => index.get(`${x},${y}`);
  for (let si = 0; si < STREETS.length; si++) {
    for (let ai = 0; ai < AVENUES.length; ai++) {
      const n = id(AVENUES[ai], STREETS[si]);
      if (ai + 1 < AVENUES.length) { const m = id(AVENUES[ai + 1], STREETS[si]); nodes[n].links.push(m); nodes[m].links.push(n); }
      if (si + 1 < STREETS.length) { const m = id(AVENUES[ai], STREETS[si + 1]); nodes[n].links.push(m); nodes[m].links.push(n); }
    }
  }
  return { nodes };
}
export function nearestNode(graph, x, y) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i];
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
