// Solmaris — the world: player, cars, traffic AI, pedestrians, police,
// wanted level, combat, missions, economy and the save. One fixed-step
// update; the renderer only reads state, it never changes it.
import {
  WORLD_W, WORLD_H, STEP, WALK_SPEED, CAR_TOP_SPEED, CAR_ACCEL, CAR_BRAKE,
  CAR_REVERSE, CAR_TURN, MISSIONS, SHOPS, PLAYER_START, START_CASH, SAVE_KEY,
  AVENUES, STREETS,
} from './config.js';
import { buildCity, buildGraph, nearestNode, collideCircle, pointInBuilding, districtAt } from './city.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

export function createWorld(rng) {
  const city = buildCity(rng);
  const graph = buildGraph();
  const state = freshState();

  function freshState() {
    return {
      time: 0, status: 'playing', // playing | wasted | busted | done
      player: {
        x: PLAYER_START.x, y: PLAYER_START.y, angle: -Math.PI / 2, hp: 100,
        onFoot: true, car: null, aim: -Math.PI / 2,
        hasGun: false, ammo: 0, hasBat: false, coolMul: 1,
      },
      cars: [], peds: [], enemies: [], bullets: [], particles: [],
      wanted: 0, hiddenT: 0, bustedT: 0, heliAngle: 0,
      cash: START_CASH, missionIdx: 0, stepIdx: 0, stepStarted: false,
      toast: '', toastT: 0, message: '', allDone: false, shopOpen: null,
      kills: 0, carsStolen: 0, roadblockDone: false,
    };
  }

  function spawnTraffic() {
    for (let i = 0; i < 14; i++) {
      const node = rng.int(0, graph.nodes.length - 1);
      const n = graph.nodes[node];
      const next = n.links[rng.int(0, n.links.length - 1)];
      state.cars.push({
        x: n.x + rng.range(-30, 30), y: n.y + rng.range(-30, 30),
        angle: Math.atan2(graph.nodes[next].y - n.y, graph.nodes[next].x - n.x),
        speed: rng.range(90, 140), color: rng.pick(city.carColors),
        traffic: true, police: false, parked: false, node, next,
      });
    }
    for (const p of city.parked) {
      state.cars.push({ ...p, traffic: false, police: false, node: -1, next: -1 });
    }
  }
  function spawnPeds() {
    const cols = ['#e8b04b', '#c94f6d', '#3f7fb0', '#4f8f6b', '#d9d9d9', '#8a5a2b', '#7a6fb0', '#e87b2f'];
    for (let i = 0; i < 26; i++) {
      const av = rng.pick(AVENUES), st = rng.pick(STREETS);
      const x = clamp(av + rng.range(-70, 70), 130, WORLD_W - 20);
      const y = clamp(st + rng.range(-70, 70), 20, WORLD_H - 20);
      state.peds.push({ x, y, angle: rng.range(0, TAU), speed: rng.range(28, 52), tx: x, ty: y, color: rng.pick(cols), flee: 0, hp: 100 });
    }
  }
  function reset() {
    const s = freshState();
    Object.keys(state).forEach((k) => delete state[k]);
    Object.assign(state, s);
    spawnTraffic();
    spawnPeds();
    setToast('Welcome to Solmaris. Follow the gold marker.');
  }
  reset();

  function setToast(t, dur) { state.toast = t; state.toastT = dur ?? 4; }
  function addWanted(n) {
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.hiddenT = 0;
    if (state.wanted >= 3 && !state.roadblockDone) {
      state.roadblockDone = true;
      spawnRoadblock();
    }
    if (state.wanted < 3) state.roadblockDone = false;
  }
  function spawnRoadblock() {
    const p = state.player;
    for (const off of [-1, 1]) {
      const a = p.angle + (off > 0 ? 0.35 : -0.35);
      const x = clamp(p.x + Math.cos(p.angle) * 420 + Math.cos(a) * 40, 200, WORLD_W - 200);
      const y = clamp(p.y + Math.sin(p.angle) * 420 + Math.sin(a) * 40, 200, WORLD_H - 200);
      state.cars.push({ x, y, angle: p.angle + Math.PI / 2, speed: 0, color: '#20242e', traffic: false, police: true, parked: true, node: -1, next: -1, roadblock: true });
    }
    setToast('Roadblock ahead!');
  }
  function policeCount() { return state.cars.filter((c) => c.police && !c.roadblock).length; }
  function spawnPolice() {
    const want = state.wanted;
    while (policeCount() < want) {
      const a = rng.range(0, TAU);
      const d = rng.range(650, 900);
      const x = clamp(state.player.x + Math.cos(a) * d, 200, WORLD_W - 200);
      const y = clamp(state.player.y + Math.sin(a) * d, 200, WORLD_H - 200);
      const node = nearestNode(graph, x, y);
      state.cars.push({
        x, y, angle: 0, speed: 0, color: '#20242e', traffic: false, police: true,
        parked: false, node, next: graph.nodes[node].links[0],
      });
    }
  }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < (n || 10); i++) {
      const a = rng.range(0, TAU), s = rng.range(20, speed || 160);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rng.range(0.3, 0.8), color, size: rng.range(2, 5) });
    }
  }

  // --- cars ------------------------------------------------------------
  function nearestCar(x, y, maxD, filter) {
    let best = null, bd = maxD;
    for (const c of state.cars) {
      if (filter && !filter(c)) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function enterCar(car, audio) {
    const p = state.player;
    if (car.police) { setToast('That is a police car.'); return; }
    p.onFoot = false; p.car = car;
    car.parked = false; car.traffic = false;
    if (car.speed === undefined) car.speed = 0;
    if (!car.wasDriven) {
      car.wasDriven = true;
      if (car.moving) { addWanted(1); state.carsStolen++; setToast('Car stolen! Wanted +1 star.'); }
      else { state.carsStolen++; }
    }
    if (audio) audio.pickup();
    missionEvent('steal');
  }
  function exitCar() {
    const p = state.player, car = p.car;
    if (!car) return;
    const a = car.angle + Math.PI / 2;
    const pos = collideCircle(city, car.x + Math.cos(a) * 34, car.y + Math.sin(a) * 34, 14);
    p.x = pos.x; p.y = pos.y; p.onFoot = true; p.car = null;
    car.speed = 0; car.parked = true;
  }

  // --- combat ----------------------------------------------------------
  function shootAt(wx, wy, from, audio) {
    const p = state.player;
    if (from === 'player') {
      if (!p.hasGun || p.ammo <= 0) return;
      p.ammo--;
      const a = Math.atan2(wy - p.y, wx - p.x);
      state.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, from, life: 1.2, dmg: 34 });
      if (audio) audio.shot();
      addWanted(0); // firing in public draws eyes
      for (const ped of state.peds) if (dist(ped.x, ped.y, p.x, p.y) < 260) ped.flee = 3;
    } else {
      const a = Math.atan2(p.y - wy, p.x - wx);
      state.bullets.push({ x: wx, y: wy, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, from, life: 1.4, dmg: 9 });
      if (audio) audio.shot();
    }
  }
  function punch(audio) {
    const p = state.player;
    const dmg = p.hasBat ? 45 : 25;
    const range = p.hasBat ? 52 : 42;
    let hitAny = false;
    const tryHit = (e) => {
      if (dist(p.x, p.y, e.x, e.y) < range && Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.aim)) < 1.1) {
        e.hp -= dmg; hitAny = true; burst(e.x, e.y, '#ffd34d', 6, 120);
        return true;
      }
      return false;
    };
    for (const e of state.enemies) tryHit(e);
    for (const ped of state.peds) {
      if (tryHit(ped)) { ped.flee = 4; addWanted(1); }
    }
    if (audio) audio.punch();
    return hitAny;
  }

  // --- missions --------------------------------------------------------
  function currentMission() { return MISSIONS[state.missionIdx] || null; }
  function currentStep() {
    const m = currentMission();
    return m ? m.steps[state.stepIdx] : null;
  }
  function startStep() {
    const step = currentStep();
    state.stepStarted = true;
    if (!step) return;
    if (step.type === 'fight') {
      state.enemies = [];
      for (let i = 0; i < 3; i++) {
        state.enemies.push({
          x: step.x + (i - 1) * 90 + rng.range(-20, 20), y: step.y + rng.range(-60, 60),
          hp: 70, angle: 0, shootCd: rng.range(0.5, 1.5), color: '#5a2b2b',
        });
      }
      setToast('Three guards. Take them down.');
    }
    if (step.type === 'lose') { addWanted(3); spawnPolice(); setToast('Lose the heat!'); }
  }
  function completeStep(audio) {
    const m = currentMission();
    state.stepIdx++;
    if (state.stepIdx >= m.steps.length) {
      state.cash += m.reward;
      if (audio) audio.cash();
      setToast(`${m.title} complete — +$${m.reward}`, 5);
      state.missionIdx++; state.stepIdx = 0; state.stepStarted = false;
      if (state.missionIdx >= MISSIONS.length) {
        state.allDone = true;
        setToast('THE SOLMARIS JOB — DONE. The city is yours.', 8);
        if (audio) audio.mission();
      } else if (audio) audio.mission();
    } else {
      state.stepStarted = false;
      if (audio) audio.pickup();
    }
  }
  function missionEvent(kind) {
    const step = currentStep();
    if (!step) return;
    if (kind === 'steal' && step.type === 'steal') completeStep(null);
  }

  // --- save ------------------------------------------------------------
  function save() {
    try {
      const p = state.player;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        x: p.x, y: p.y, cash: state.cash, missionIdx: state.missionIdx,
        stepIdx: state.stepIdx, wanted: state.wanted, hp: p.hp,
        hasGun: p.hasGun, ammo: p.ammo, hasBat: p.hasBat, coolMul: p.coolMul,
      }));
    } catch { /* storage off: progress lasts this visit only */ }
  }
  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      const p = state.player;
      p.x = d.x; p.y = d.y; p.hp = d.hp || 100;
      p.hasGun = !!d.hasGun; p.ammo = d.ammo || 0; p.hasBat = !!d.hasBat; p.coolMul = d.coolMul || 1;
      state.cash = d.cash; state.missionIdx = d.missionIdx || 0; state.stepIdx = d.stepIdx || 0;
      state.wanted = d.wanted || 0; state.stepStarted = false;
      setToast('Save loaded. Welcome back to Solmaris.');
      return true;
    } catch { return false; }
  }

  // --- per-frame update --------------------------------------------------
  function step(dt, input, mouseWorld, audio) {
    if (state.status !== 'playing') return;
    state.time += dt;
    if (state.toastT > 0) state.toastT -= dt;
    const p = state.player;
    if (!state.stepStarted) startStep();
    const stepObj = currentStep();

    // Aim follows the mouse on foot.
    if (p.onFoot && mouseWorld) p.aim = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);

    // Enter / exit car.
    if (input.enterPressed()) {
      if (p.onFoot) {
        const car = nearestCar(p.x, p.y, 52, (c) => !c.police || c.roadblock);
        if (car) enterCar(car, audio);
        else {
          const shop = SHOPS.find((s) => dist(p.x, p.y, s.x, s.y) < 80);
          if (shop) state.shopOpen = shop.id;
        }
      } else exitCar();
    }
    if (input.punchPressed() && p.onFoot) punch(audio);
    if (mouseWorld && input.mouse().pressed && p.onFoot && p.hasGun) shootAt(mouseWorld.x, mouseWorld.y, 'player', audio);

    // --- player movement
    if (p.onFoot) {
      const ax = input.axisX(), ay = input.axisY();
      const len = Math.hypot(ax, ay) || 1;
      const nx = p.x + (ax / len) * WALK_SPEED * dt * (ax || ay ? 1 : 0);
      const ny = p.y + (ay / len) * WALK_SPEED * dt * (ax || ay ? 1 : 0);
      const c1 = collideCircle(city, nx, p.y, 14);
      const c2 = collideCircle(city, c1.x, ny, 14);
      p.x = c2.x; p.y = c2.y;
      if (ax || ay) p.angle = Math.atan2(ay, ax);
    } else if (p.car) {
      const car = p.car;
      const fwd = input.up() ? 1 : 0;
      const rev = input.brake() ? 1 : 0;
      if (fwd) car.speed += CAR_ACCEL * dt;
      if (rev) car.speed -= (car.speed > 0 ? CAR_BRAKE : CAR_ACCEL * 0.6) * dt;
      if (!fwd && !rev) car.speed *= Math.pow(0.4, dt); // drag
      if (input.handbrake()) car.speed *= Math.pow(0.05, dt);
      car.speed = clamp(car.speed, -CAR_REVERSE, CAR_TOP_SPEED);
      const steer = input.axisX();
      const spdF = clamp(Math.abs(car.speed) / 220, 0, 1) * (car.speed < 0 ? -1 : 1);
      car.angle += steer * CAR_TURN * spdF * dt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const c = collideCircle(city, nx, ny, 22);
      if (c.hit && Math.abs(car.speed) > 120) { if (audio) audio.crash(); burst(car.x, car.y, '#ffb14d', 8, 140); }
      if (c.hit) car.speed *= -0.25;
      car.x = c.x; car.y = c.y;
      p.x = car.x; p.y = car.y; p.angle = car.angle; p.aim = car.angle;
      // running over a pedestrian is a crime
      for (const ped of state.peds) {
        if (Math.abs(car.speed) > 120 && dist(ped.x, ped.y, car.x, car.y) < 26) {
          ped.hp = 0; burst(ped.x, ped.y, '#e84b4b', 12, 180);
          addWanted(1); setToast('You hit a pedestrian!');
        }
      }
      if (audio) audio.engine(clamp(Math.abs(car.speed) / CAR_TOP_SPEED, 0, 1), true);
    } else if (audio) audio.engine(0, false);

    // --- traffic AI: follow the road graph, slow for the car ahead
    for (const car of state.cars) {
      if (!car.traffic || car === p.car) continue;
      const target = graph.nodes[car.next];
      if (!target) continue;
      const d = dist(car.x, car.y, target.x, target.y);
      const wantAngle = Math.atan2(target.y - car.y, target.x - car.x);
      car.angle += clamp(angDiff(wantAngle, car.angle), -2.4 * dt, 2.4 * dt);
      let targetSpeed = 130;
      for (const o of state.cars) {
        if (o === car) continue;
        const od = dist(car.x, car.y, o.x, o.y);
        if (od < 70 && Math.abs(angDiff(Math.atan2(o.y - car.y, o.x - car.x), car.angle)) < 0.7) { targetSpeed = 0; break; }
      }
      if (d < 30) {
        car.node = car.next;
        const links = graph.nodes[car.node].links;
        car.next = links[rng.int(0, links.length - 1)];
      }
      car.speed += clamp(targetSpeed - car.speed, -260 * dt, 200 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.moving = car.speed > 20;
    }

    // --- pedestrians: stroll the sidewalks, flee danger
    for (const ped of state.peds) {
      if (ped.hp <= 0) continue;
      const danger = state.bullets.length > 0 || (p.car && Math.abs(p.car.speed) > 150 && dist(ped.x, ped.y, p.x, p.y) < 170);
      if (danger) ped.flee = 2;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const a = Math.atan2(ped.y - p.y, ped.x - p.x);
        ped.angle = a;
        const pos = collideCircle(city, ped.x + Math.cos(a) * 150 * dt, ped.y + Math.sin(a) * 150 * dt, 10);
        ped.x = pos.x; ped.y = pos.y;
        continue;
      }
      if (dist(ped.x, ped.y, ped.tx, ped.ty) < 12) {
        const av = rng.pick(AVENUES), st = rng.pick(STREETS);
        ped.tx = clamp(av + rng.range(-70, 70), 130, WORLD_W - 20);
        ped.ty = clamp(st + rng.range(-70, 70), 20, WORLD_H - 20);
      }
      const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
      ped.angle = a;
      const pos = collideCircle(city, ped.x + Math.cos(a) * ped.speed * dt, ped.y + Math.sin(a) * ped.speed * dt, 10);
      ped.x = pos.x; ped.y = pos.y;
    }
    state.peds = state.peds.filter((pd) => pd.hp > 0);
    // keep the streets populated
    while (state.peds.length < 22) {
      const av = rng.pick(AVENUES), st = rng.pick(STREETS);
      state.peds.push({ x: clamp(av + 60, 130, WORLD_W - 20), y: clamp(st + 60, 20, WORLD_H - 20), angle: 0, speed: 40, tx: av, ty: st, color: '#e8b04b', flee: 0, hp: 100 });
    }

    // --- police AI
    if (state.wanted > 0) spawnPolice();
    for (const car of state.cars) {
      if (!car.police || car.roadblock) continue;
      const d = dist(car.x, car.y, p.x, p.y);
      const wantAngle = Math.atan2(p.y - car.y, p.x - car.x);
      const top = state.wanted >= 4 ? 620 : 520;
      car.angle += clamp(angDiff(wantAngle, car.angle), -3.2 * dt, 3.2 * dt);
      car.speed = clamp(car.speed + (d > 90 ? 320 * dt : -160 * dt), 0, top);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const c = collideCircle(city, nx, ny, 22);
      if (c.hit) car.speed *= 0.4;
      car.x = c.x; car.y = c.y;
      // ramming the player
      if (d < 34) {
        if (p.onFoot) {
          state.bustedT += dt;
          if (state.bustedT > 1.1) { bust(audio); return; }
        } else if (car.speed > 60) {
          p.hp -= 14 * dt * 4;
          if (Math.random() < dt * 2) { if (audio) audio.crash(); burst(p.x, p.y, '#ffb14d', 6, 120); }
        }
      }
    }
    if (state.wanted >= 4) state.heliAngle += dt * 0.5;
    if (audio) audio.siren(state.wanted > 0);

    // --- wanted decay: cool off while unseen and far from police
    const nearestCop = state.cars.reduce((m, c) => (c.police ? Math.min(m, dist(c.x, c.y, p.x, p.y)) : m), Infinity);
    if (state.wanted > 0 && nearestCop > 620) {
      state.hiddenT += dt;
      const need = (state.wanted >= 4 ? 30 : 12) / p.coolMul;
      if (state.hiddenT > need) { state.wanted--; state.hiddenT = 0; if (state.wanted < 3) state.roadblockDone = false; }
    } else state.hiddenT = 0;

    // --- enemies (mission 5 guards)
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.shootCd -= dt;
      if (d < 520 && e.shootCd <= 0) { e.shootCd = rng.range(1.4, 2.2); shootAt(e.x, e.y, 'enemy', audio); }
      if (d > 60) {
        const pos = collideCircle(city, e.x + Math.cos(e.angle) * 55 * dt, e.y + Math.sin(e.angle) * 55 * dt, 12);
        e.x = pos.x; e.y = pos.y;
      }
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0);
    if (stepObj && stepObj.type === 'fight' && state.stepStarted && state.enemies.length === 0) completeStep(audio);

    // --- bullets
    for (const b of state.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (pointInBuilding(city, b.x, b.y)) { b.life = 0; burst(b.x, b.y, '#ffd34d', 4, 80); continue; }
      if (b.from === 'player') {
        for (const e of state.enemies) {
          if (e.hp > 0 && dist(b.x, b.y, e.x, e.y) < 18) { e.hp -= b.dmg; b.life = 0; burst(e.x, e.y, '#e84b4b', 8, 140); if (e.hp <= 0) { state.kills++; addWanted(1); } break; }
        }
        if (b.life > 0) for (const car of state.cars) {
          if (car.police && dist(b.x, b.y, car.x, car.y) < 26) { b.life = 0; addWanted(1); burst(car.x, car.y, '#ffd34d', 6, 100); break; }
        }
      } else if (b.from === 'enemy') {
        if (dist(b.x, b.y, p.x, p.y) < (p.onFoot ? 16 : 24)) {
          b.life = 0; p.hp -= b.dmg; burst(p.x, p.y, '#e84b4b', 6, 120);
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD_W && b.y > 0 && b.y < WORLD_H);

    // --- particles
    for (const pt of state.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
    state.particles = state.particles.filter((pt) => pt.life > 0);

    // --- mission progress
    if (stepObj) {
      if (stepObj.type === 'goto' && dist(p.x, p.y, stepObj.x, stepObj.y) < 75) completeStep(audio);
      if (stepObj.type === 'lose' && state.wanted === 0) completeStep(audio);
    }
    if (p.hp <= 0) { waste(audio); return; }
    if (state.time % 5 < dt) save();
  }

  function bust(audio) {
    state.status = 'busted';
    state.wanted = 0; state.bustedT = 0;
    state.cash = Math.max(0, state.cash - 100);
    if (audio) audio.busted();
    save();
  }
  function waste(audio) {
    state.status = 'wasted';
    state.player.hp = 0;
    if (audio) audio.wasted();
    save();
  }
  function respawn() {
    const p = state.player;
    p.hp = 100; p.x = PLAYER_START.x; p.y = PLAYER_START.y;
    p.onFoot = true; p.car = null;
    state.wanted = 0; state.status = 'playing'; state.bustedT = 0;
    state.enemies = [];
    // police scatter
    state.cars = state.cars.filter((c) => !c.police);
    setToast('Back on your feet. Stay sharp.');
    save();
  }

  return {
    state, city, graph, reset, step, save, load, respawn,
    currentMission, currentStep, addWanted, setToast, enterCar, exitCar, nearestCar,
    // Used by the deterministic ?shot= scenes: the staged car counts as stolen.
    stealStepDone() { missionEvent('steal'); },
    districtAt: (x) => districtAt(x),
  };
}
