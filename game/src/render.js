// Solmaris — the renderer. A 2.5D top-down canvas view of the city with
// cheap depth cues: drop shadows under every car and person, roofs drawn
// as a raised plane with a parapet line and a height-shaded south edge,
// and a warm sun gradient over the whole scene.
import { WORLD_W, WORLD_H, DISTRICTS, AVENUES, STREETS, ROAD_W, MISSIONS, SHOPS } from './config.js';
import { districtAt } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, cam = { x: 0, y: 0, scale: 1 };
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function updateCam(px, py) {
    const scale = Math.max(W / 1500, H / 950);
    cam.scale = scale;
    cam.x = clamp(px - W / 2 / scale, 0, Math.max(0, WORLD_W - W / scale));
    cam.y = clamp(py - H / 2 / scale, 0, Math.max(0, WORLD_H - H / scale));
  }
  function screenToWorld(sx, sy) {
    return { x: cam.x + sx / cam.scale, y: cam.y + sy / cam.scale };
  }

  function drawCar(c, isPlayer) {
    const s = cam.scale;
    ctx.save();
    ctx.translate(c.x, c.y);
    // drop shadow, offset south-east
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath(); ctx.ellipse(5, 8, 24, 12, c.angle, 0, TAU); ctx.fill();
    ctx.rotate(c.angle);
    const body = c.police ? '#20242e' : c.color;
    rr(ctx, -24, -11, 48, 22, 6);
    ctx.fillStyle = body; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    // roof + windshield, lighter toward the sun
    ctx.fillStyle = shade(body, 1.25);
    rr(ctx, -8, -9, 18, 18, 3); ctx.fill();
    ctx.fillStyle = 'rgba(180,220,240,0.85)';
    ctx.fillRect(-19, -8, 7, 16);
    ctx.fillRect(11, -8, 5, 16);
    if (c.police) {
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(-2, -11, 5, 22);
      ctx.fillStyle = '#d93838'; ctx.fillRect(-2, -11, 5, 6);
      ctx.fillStyle = '#2b5fd9'; ctx.fillRect(-2, 5, 5, 6);
    }
    if (isPlayer) { ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2; rr(ctx, -24, -11, 48, 22, 6); ctx.stroke(); }
    ctx.restore();
  }
  function drawPerson(x, y, angle, color, isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath(); ctx.ellipse(3, 5, 10, 6, 0, 0, TAU); ctx.fill();
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(4, 0, 4.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.beginPath(); ctx.arc(7, -2.5, 1.6, 0, TAU); ctx.arc(7, 2.5, 1.6, 0, TAU); ctx.fill();
    if (isPlayer) { ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  function drawWorld(world) {
    const st = world.state;
    const city = world.city;
    const p = st.player;
    updateCam(p.x, p.y);
    ctx.save();
    ctx.translate(-cam.x * cam.scale, -cam.y * cam.scale);
    ctx.scale(cam.scale, cam.scale);
    const vx0 = cam.x - 60, vy0 = cam.y - 60, vx1 = cam.x + W / cam.scale + 60, vy1 = cam.y + H / cam.scale + 60;

    // ground: district bands
    for (const d of DISTRICTS) ctx.fillStyle = d.ground, ctx.fillRect(d.x0, 0, d.x1 - d.x0, WORLD_H);
    // sea + beach on the west edge
    ctx.fillStyle = '#2e7f9e'; ctx.fillRect(0, 0, 110, WORLD_H);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let y = 0; y < WORLD_H; y += 90) ctx.fillRect(88, y, 22, 34);
    ctx.fillStyle = '#e8d9a8'; ctx.fillRect(110, 0, 42, WORLD_H);
    // parks
    for (const pk of city.parks) {
      if (pk.x > vx1 || pk.x + pk.w < vx0 || pk.y > vy1 || pk.y + pk.h < vy0) continue;
      ctx.fillStyle = '#7fb069'; ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(pk.x, pk.y, pk.w, 10);
    }
    // roads
    ctx.fillStyle = '#3a3f4a';
    for (const x of AVENUES) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD_H);
    for (const y of STREETS) ctx.fillRect(0, y - ROAD_W / 2, WORLD_W, ROAD_W);
    // sidewalks
    ctx.fillStyle = '#c9c2ae';
    for (const x of AVENUES) { ctx.fillRect(x - ROAD_W / 2 - 12, 0, 12, WORLD_H); ctx.fillRect(x + ROAD_W / 2, 0, 12, WORLD_H); }
    for (const y of STREETS) { ctx.fillRect(0, y - ROAD_W / 2 - 12, WORLD_W, 12); ctx.fillRect(0, y + ROAD_W / 2, WORLD_W, 12); }
    // lane dashes
    ctx.fillStyle = '#e8d9a0';
    for (const x of AVENUES) for (let y = 0; y < WORLD_H; y += 64) ctx.fillRect(x - 2, y, 4, 30);
    for (const y of STREETS) for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x, y - 2, 30, 4);
    // district labels painted on the ground
    ctx.textAlign = 'center'; ctx.font = 'bold 44px sans-serif';
    for (const d of DISTRICTS) {
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillText(d.name.toUpperCase(), (d.x0 + d.x1) / 2, 2100);
    }

    // buildings: shadow, walls, raised roof plane, shaded south edge
    for (const b of city.buildings) {
      if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
      const sh = 6 + b.hgt * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + sh, b.y + sh + 4, b.w, b.h);
      ctx.fillStyle = shade(b.color, 0.82);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      // parapet: inner raised plane
      ctx.fillStyle = shade(b.roof, 1.22);
      ctx.fillRect(b.x + b.roofInset, b.y + b.roofInset, b.w - b.roofInset * 2, b.h - b.roofInset * 2);
      // south edge shading = height cue
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.fillRect(b.x + 4, b.y + b.h - 8 - b.hgt * 2, b.w - 8, 4 + b.hgt * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 3);
      // windows
      ctx.fillStyle = 'rgba(20,30,50,0.55)';
      for (let wx = b.x + 16; wx < b.x + b.w - 14; wx += 26)
        for (let wy = b.y + 16; wy < b.y + b.h - 14; wy += 26)
          ctx.fillRect(wx, wy, 12, 9);
    }
    // trees + palms
    for (const t of city.trees) {
      if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3f7f3f'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5fae5f'; ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, TAU); ctx.fill();
    }
    for (const t of city.palms) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.6, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7a5a2b'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(t.x, t.y + 8); ctx.lineTo(t.x, t.y - 6); ctx.stroke();
      ctx.fillStyle = '#4f9e4f';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ctx.beginPath(); ctx.ellipse(t.x + Math.cos(a) * 10, t.y - 6 + Math.sin(a) * 7, 11, 4, a, 0, TAU); ctx.fill();
      }
    }

    // shops: awning + sign
    for (const s of SHOPS) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(s.x - 34, s.y - 22, 68, 48);
      ctx.fillStyle = '#f5efe0'; ctx.fillRect(s.x - 36, s.y - 26, 72, 46);
      ctx.fillStyle = s.kind === 'food' ? '#c94f4f' : s.kind === 'clothes' ? '#7a6fb0' : '#2e7f9e';
      ctx.fillRect(s.x - 36, s.y - 26, 72, 16);
      ctx.fillStyle = '#20242e'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(s.name.toUpperCase(), s.x, s.y + 14);
    }

    // mission marker: pulsing gold ring in the open
    const step = world.currentStep();
    if (step && step.x !== undefined) {
      const pulse = 1 + Math.sin(st.time * 4) * 0.12;
      ctx.save();
      ctx.translate(step.x, step.y);
      ctx.fillStyle = 'rgba(255,211,77,0.18)';
      ctx.beginPath(); ctx.arc(0, 0, 58 * pulse, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 46 * pulse, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(16, 10); ctx.lineTo(-16, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // cars
    const sortedCars = [...st.cars].sort((a, b) => a.y - b.y);
    for (const c of sortedCars) drawCar(c, p.car === c);
    // pedestrians + enemies
    for (const ped of st.peds) {
      if (ped.hp <= 0) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.color, false);
    }
    for (const e of st.enemies) {
      if (e.hp <= 0) continue;
      drawPerson(e.x, e.y, e.angle, '#5a2b2b', false);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - 16, e.y - 24, 32, 5);
      ctx.fillStyle = '#e84b4b'; ctx.fillRect(e.x - 16, e.y - 24, 32 * clamp(e.hp / 70, 0, 1), 5);
    }
    // player on foot
    if (p.onFoot) drawPerson(p.x, p.y, p.aim, '#2b5fd9', true);
    // bullets + particles
    ctx.fillStyle = '#ffd34d';
    for (const b of st.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, TAU); ctx.fill(); }
    for (const pt of st.particles) {
      ctx.globalAlpha = clamp(pt.life * 2, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // helicopter searchlight at wanted 4+
    if (st.wanted >= 4) {
      const hx = p.x + Math.cos(st.heliAngle) * 260, hy = p.y + Math.sin(st.heliAngle) * 260 - 120;
      const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 240);
      grad.addColorStop(0, 'rgba(255,255,200,0.20)'); grad.addColorStop(1, 'rgba(255,255,200,0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(p.x, p.y, 240, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(hx + 6, hy + 8, 26, 13, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#20242e';
      ctx.beginPath(); ctx.ellipse(hx, hy, 24, 12, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.restore();

    // warm sun wash + vignette
    const sun = ctx.createLinearGradient(0, 0, W, H);
    sun.addColorStop(0, 'rgba(255,220,140,0.10)'); sun.addColorStop(1, 'rgba(255,160,80,0.03)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  function drawMinimap(world) {
    const st = world.state;
    const R = 92, cx = W - R - 18, cy = R + 18;
    const k = (R * 2) / WORLD_W;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    ctx.fillStyle = '#1d2733'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(cx - R + d.x0 * k, cy - R, (d.x1 - d.x0) * k, R * 2);
    }
    ctx.fillStyle = '#2e7f9e'; ctx.fillRect(cx - R, cy - R, 110 * k, R * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5;
    for (const x of AVENUES) { ctx.beginPath(); ctx.moveTo(cx - R + x * k, cy - R); ctx.lineTo(cx - R + x * k, cy + R); ctx.stroke(); }
    for (const y of STREETS) { ctx.beginPath(); ctx.moveTo(cx - R, cy - R + y * (R * 2 / WORLD_H)); ctx.lineTo(cx + R, cy - R + y * (R * 2 / WORLD_H)); ctx.stroke(); }
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(cx - R + x * k, cy - R + y * (R * 2 / WORLD_H), r, 0, TAU); ctx.fill();
    };
    const step = world.currentStep();
    if (step && step.x !== undefined) dot(step.x, step.y, '#ffd34d', 6);
    for (const s of SHOPS) dot(s.x, s.y, '#7fe0a0', 3);
    for (const c of st.cars) if (!c.parked) dot(c.x, c.y, c.police ? '#ff5a5a' : '#d9d9d9', c.police ? 4 : 2.5);
    dot(st.player.x, st.player.y, '#ffffff', 5);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SOLMARIS', cx, cy + R + 16);
  }

  function drawHUD(world) {
    const st = world.state;
    const p = st.player;
    const m = world.currentMission();
    // top-left panel: cash, health, wanted
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    rr(ctx, 14, 14, 250, 96, 10); ctx.fill();
    ctx.fillStyle = '#7fe0a0'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`$${st.cash.toLocaleString('en-US')}`, 28, 48);
    ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
    ctx.fillText(districtAt(p.x).name, 28, 70);
    // health bar
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(28, 80, 150, 10);
    ctx.fillStyle = p.hp > 40 ? '#7fe0a0' : '#e84b4b';
    ctx.fillRect(28, 80, 150 * clamp(p.hp / 100, 0, 1), 10);
    // wanted stars, right side of the panel
    ctx.font = '22px sans-serif';
    let sx = 196;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < st.wanted ? '#ffd34d' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', sx, 48); sx += 22;
    }
    ctx.fillStyle = '#ffd34d'; ctx.font = 'bold 26px sans-serif';
    // mission objective, top centre
    if (m) {
      const step = world.currentStep();
      const text = step ? step.text : m.brief;
      ctx.font = 'bold 15px sans-serif';
      const wdt = ctx.measureText(text).width + 120;
      ctx.fillStyle = 'rgba(10,14,20,0.72)';
      rr(ctx, W / 2 - wdt / 2, 14, wdt, 56, 10); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.textAlign = 'center';
      ctx.fillText(m.title.toUpperCase(), W / 2, 36);
      ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
      ctx.fillText(text, W / 2, 56);
    }
    // weapon / controls hint, bottom left
    ctx.textAlign = 'left'; ctx.font = '13px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const hint = p.onFoot
      ? `WASD move · E enter car / shop · F punch${p.hasBat ? ' (bat)' : ''}${p.hasGun ? ` · Click shoot (${p.ammo} rounds)` : ''} · P pause`
      : `W/S drive · A/D steer · Space brake · E get out · P pause`;
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    const hw = ctx.measureText(hint).width + 20;
    rr(ctx, 14, H - 34, hw, 24, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(hint, 24, H - 17);
    // toast
    if (st.toastT > 0 && st.toast) {
      ctx.font = 'bold 17px sans-serif';
      const tw = ctx.measureText(st.toast).width + 32;
      ctx.fillStyle = 'rgba(10,14,20,0.78)';
      rr(ctx, W / 2 - tw / 2, H - 108, tw, 36, 10); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.textAlign = 'center';
      ctx.fillText(st.toast, W / 2, H - 84);
    }
    drawMinimap(world);
  }

  function panel(title, lines, accent) {
    ctx.fillStyle = 'rgba(8,12,18,0.82)';
    rr(ctx, W / 2 - 330, H / 2 - 190, 660, 380, 16); ctx.fill();
    ctx.strokeStyle = accent || '#ffd34d'; ctx.lineWidth = 2;
    rr(ctx, W / 2 - 330, H / 2 - 190, 660, 380, 16); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || '#ffd34d'; ctx.font = 'bold 46px sans-serif';
    ctx.fillText(title, W / 2, H / 2 - 110);
    ctx.fillStyle = '#fff'; ctx.font = '17px sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 - 60 + i * 30));
  }

  function drawShop(world) {
    const st = world.state;
    const shop = SHOPS.find((s) => s.id === st.shopOpen);
    if (!shop) return;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,12,18,0.92)';
    rr(ctx, W / 2 - 300, H / 2 - 170, 600, 340, 16); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d'; ctx.font = 'bold 30px sans-serif';
    ctx.fillText(shop.name.toUpperCase(), W / 2, H / 2 - 120);
    ctx.fillStyle = '#7fe0a0'; ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Cash: $${st.cash}`, W / 2, H / 2 - 88);
    ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
    shop.items.forEach((it, i) => {
      ctx.fillText(`${i + 1}. ${it.name} — $${it.price} · ${it.desc}`, W / 2, H / 2 - 48 + i * 32);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '14px sans-serif';
    ctx.fillText('Press 1 / 2 / 3 to buy · E or Esc to leave', W / 2, H / 2 + 76);
  }

  function draw(world, screen, best) {
    const st = world.state;
    if (screen === SCREEN_TITLE) {
      drawWorld(world);
      ctx.fillStyle = 'rgba(8,12,18,0.55)'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd34d'; ctx.font = 'bold 84px sans-serif';
      ctx.fillText('SOLMARIS', W / 2, H / 2 - 70);
      ctx.fillStyle = '#fff'; ctx.font = '22px sans-serif';
      ctx.fillText('A sun-soaked open-world crime story', W / 2, H / 2 - 28);
      ctx.font = '17px sans-serif';
      ctx.fillText('Steal cars · Outrun the police · Run the six missions of The Solmaris Job', W / 2, H / 2 + 8);
      ctx.fillStyle = '#ffd34d'; ctx.font = 'bold 19px sans-serif';
      ctx.fillText('Press ENTER to play', W / 2, H / 2 + 62);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '15px sans-serif';
      ctx.fillText('Continue — your last save is kept on this machine', W / 2, H / 2 + 96);
      ctx.fillText('WASD move · E enter a car · Mouse aim · Click shoot · F punch · P pause', W / 2, H / 2 + 124);
      return;
    }
    drawWorld(world);
    drawHUD(world);
    if (world.state.shopOpen) drawShop(world);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8,12,18,0.6)'; ctx.fillRect(0, 0, W, H);
      panel('PAUSED', ['The city waits for no one — except right now.', 'Press P or Esc to keep playing', 'Progress saves automatically.'], '#7fb0ff');
    } else if (screen === SCREEN_WASTED) {
      ctx.fillStyle = 'rgba(20,4,4,0.6)'; ctx.fillRect(0, 0, W, H);
      panel('WASTED', ['Solmaris chewed you up.', 'Press ENTER to get back on your feet', `Cash kept: $${st.cash}`], '#e84b4b');
    } else if (screen === SCREEN_BUSTED) {
      ctx.fillStyle = 'rgba(4,8,20,0.6)'; ctx.fillRect(0, 0, W, H);
      panel('BUSTED', ['The harbor patrol caught you. Bail cost $100.', 'Press ENTER to walk free', `Cash kept: $${st.cash}`], '#7fb0ff');
    }
    if (st.allDone && screen === SCREEN_PLAY) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd34d'; ctx.font = 'bold 22px sans-serif';
      ctx.fillText('★ THE SOLMARIS JOB — COMPLETE ★', W / 2, 92);
    }
  }

  return { draw, resize, screenToWorld, get size() { return { w: W, h: H }; } };
}
