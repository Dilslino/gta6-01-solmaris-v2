// Solmaris — boot and the one loop. Fixed 1/60 s steps, screens:
// title, play, paused, wasted, busted, plus the shop overlay.
// ?seed=N fixes the city. ?shot=title|driving|chase|mission stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, SAVE_KEY, SHOPS } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_WASTED, SCREEN_BUSTED } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  // Debug / play-test hook: the live world, readable from the console.
  window.__solmaris = { world, get screen() { return screen; } };
  const hadSave = (() => { try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; } })();

  function mouseWorld() {
    const m = input.mouse();
    return renderer.screenToWorld(m.x, m.y);
  }
  function buyItem(shop, idx) {
    const item = shop.items[idx];
    if (!item) return;
    const st = world.state, p = st.player;
    if (st.cash < item.price) { audio.denied(); world.setToast('Not enough cash.'); return; }
    st.cash -= item.price;
    if (item.heal) p.hp = Math.min(100, p.hp + item.heal);
    if (item.cool) p.coolMul = Math.max(p.coolMul, item.cool);
    if (item.gun) { p.hasGun = true; p.ammo += item.ammo; }
    else if (item.ammo) {
      if (!p.hasGun) { audio.denied(); world.setToast('You need a pistol first.'); st.cash += item.price; return; }
      p.ammo += item.ammo;
    }
    if (item.bat) p.hasBat = true;
    audio.cash();
    world.setToast(`Bought ${item.name}.`);
    world.save();
  }

  function frame(now) {
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    if (screen === SCREEN_TITLE) {
      if (input.confirmPressed()) {
        audio.ensure(); audio.startMusic();
        // Continue the save if there is one; a fresh world otherwise.
        if (hadSave) world.load();
        screen = SCREEN_PLAY;
        world.setToast('Welcome to Solmaris. Follow the gold marker.');
      }
    } else if (screen === SCREEN_PLAY) {
      const st = world.state;
      if (st.shopOpen) {
        const shop = SHOPS.find((s) => s.id === st.shopOpen);
        const d = input.digitPressed();
        if (d > 0 && shop) buyItem(shop, d - 1);
        if (input.enterPressed() || input.pausePressed()) st.shopOpen = null;
      } else {
        if (input.pausePressed()) screen = SCREEN_PAUSED;
        else {
          accumulator += dt;
          while (accumulator >= STEP) {
            world.step(STEP, input, mouseWorld(), audio);
            accumulator -= STEP;
          }
          if (st.status === 'wasted') screen = SCREEN_WASTED;
          else if (st.status === 'busted') screen = SCREEN_BUSTED;
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.pausePressed() || input.confirmPressed()) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_WASTED || screen === SCREEN_BUSTED) {
      if (input.confirmPressed()) {
        world.respawn();
        screen = SCREEN_PLAY;
      }
    }
    renderer.draw(world, screen, 0);
    status.textContent = screen === SCREEN_PLAY
      ? `Solmaris: ${world.currentMission() ? world.currentMission().title : 'free roam'} — $${world.state.cash}, wanted ${world.state.wanted}`
      : `Solmaris — ${screen}`;
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
