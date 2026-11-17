// Solmaris — keyboard + mouse input. Keys are tracked by code so WASD and
// arrows both work; mouse aim is in screen space, converted by the renderer.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_ENTER = 'enter';
export const ACTION_PUNCH = 'punch';
export const ACTION_SHOOT = 'shoot';

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered: cleared each frame by endFrame()
  let mouseX = 0, mouseY = 0, mouseDown = false, mousePressed = false;
  let anyKey = false;

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) { keys.add(e.code); pressed.add(e.code); }
    anyKey = true;
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
  }
  function onMouseDown(e) { mouseDown = true; mousePressed = true; onMouseMove(e); }
  function onMouseUp() { mouseDown = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  const down = (...codes) => codes.some((c) => keys.has(c));
  const hit = (...codes) => codes.some((c) => pressed.has(c));
  return {
    // Movement axes, -1..1.
    axisX() { return (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0); },
    axisY() { return (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0); },
    up() { return down('KeyW', 'ArrowUp'); },
    downKey() { return down('KeyS', 'ArrowDown'); },
    brake() { return down('KeyS', 'ArrowDown', 'Space'); },
    handbrake() { return down('Space'); },
    enterPressed() { return hit('KeyE'); },
    punchPressed() { return hit('KeyF'); },
    pausePressed() { return hit('KeyP', 'Escape'); },
    confirmPressed() { return hit('Enter', 'Space') || mousePressed; },
    anyPressed() { const v = anyKey || mousePressed; anyKey = false; return v; },
    digitPressed() {
      for (const d of ['Digit1', 'Digit2', 'Digit3']) if (pressed.has(d)) return Number(d.slice(-1));
      return 0;
    },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown, pressed: mousePressed }; },
    endFrame() { pressed.clear(); mousePressed = false; },
  };
}
