// Solmaris — deterministic screenshot scenes behind ?shot=title|driving|chase|mission.
// Each one plays the real game forward from a fresh seeded world with a
// scripted autopilot, so the frame is what real play looks like and the
// same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';

const SAMPLE = STEP;

// Drive the player's car along the road graph toward a target point.
function driveToward(world, tx, ty) {
  const st = world.state;
  const car = st.player.car;
  if (!car) return { up: false, down: false, axisX: 0 };
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { up: Math.abs(diff) < 1.2, down: false, axisX: Math.max(-1, Math.min(1, diff * 2)) };
}

function fakeInput(over) {
  return {
    axisX: () => over.axisX || 0,
    axisY: () => 0,
    up: () => !!over.up,
    downKey: () => false,
    brake: () => !!over.down,
    handbrake: () => false,
    enterPressed: () => !!over.enter,
    punchPressed: () => false,
    mouse: () => ({ x: 0, y: 0, down: false, pressed: false }),
  };
}

function putPlayerInCar(world, x, y, angle) {
  const st = world.state;
  const car = st.cars.find((c) => c.parked && !c.police);
  if (!car) return false;
  car.x = x; car.y = y; car.angle = angle; car.speed = 0; car.parked = false; car.traffic = false;
  st.player.onFoot = false; st.player.car = car; st.player.x = x; st.player.y = y;
  car.wasDriven = true;
  return true;
}

/** Stage the named scene on `world` and return the screen to draw. */
export function stageShot(name, world) {
  const st = world.state;
  world.reset();
  const audio = { shot() {}, pickup() {}, cash() {}, mission() {}, crash() {}, engine() {}, siren() {}, punch() {} };
  const mouse = { x: 0, y: 0 };
  if (name === 'title') {
    // A few seconds of traffic + pedestrians so the title sits over a living city.
    for (let i = 0; i < 5 / STEP; i++) world.step(STEP, fakeInput({}), mouse, audio);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'driving') {
    // Finish mission 1 first so the shot shows mission 2's drive.
    st.player.x = 1600; st.player.y = 1200;
    world.step(STEP, fakeInput({}), mouse, audio);
    putPlayerInCar(world, 1280, 1200, 0);
    world.stealStepDone(); // the staged car counts as the stolen one
    for (let i = 0; i < 14 / STEP; i++) {
      const input = fakeInput(driveToward(world, 2560, 1200));
      world.step(STEP, input, mouse, audio);
    }
    for (let i = 0; i < 9 / STEP; i++) {
      const input = fakeInput(driveToward(world, 2560, 600));
      world.step(STEP, input, mouse, audio);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    st.player.x = 1600; st.player.y = 1200;
    world.step(STEP, fakeInput({}), mouse, audio);
    putPlayerInCar(world, 1600, 1200, 0);
    world.stealStepDone();
    world.addWanted(4);
    for (let i = 0; i < 2.5 / STEP; i++) {
      const input = fakeInput(driveToward(world, 2880, 1200));
      world.step(STEP, input, mouse, audio);
    }
    world.setToast('', 0); // clean chase frame: stars, police and heli speak for themselves
    return { screen: SCREEN_PLAY };
  }
  // mission: player on foot at Palm Plaza, mission 1 marker live, a car nearby.
  st.player.x = 1600; st.player.y = 1320;
  for (let i = 0; i < 4 / STEP; i++) world.step(STEP, fakeInput({}), mouse, audio);
  world.setToast('Meet Mara at Palm Plaza — Mission 1: First Light', 10);
  return { screen: SCREEN_PLAY };
}
