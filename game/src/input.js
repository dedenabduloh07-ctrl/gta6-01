// Keyboard and mouse state. The loop polls `held` keys every step and drains
// one-shot `actions` (interact, confirm, pause, mute, weapon switches, horn)
// so a single key press never fires twice. Mouse position is kept in logical
// view coordinates (1280x720) so aiming matches the render transform exactly.

export function createInput(canvas) {
  const held = new Set();
  const actions = {
    interact: 0,
    confirm: 0,
    pause: 0,
    mute: 0,
    weapon: 0,
    horn: 0,
    punch: 0,
  };
  const mouse = { x: 640, y: 360, down: false, clicked: null };
  let clickQueue = [];

  function toView(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 1280,
      y: ((clientY - rect.top) / rect.height) * 720,
    };
  }

  function onKeyDown(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    held.add(key);
    if (key === 'e' || key === 'f') actions.interact += 1;
    if (key === 'Enter') actions.confirm += 1;
    if (key === 'p' || key === 'Escape') actions.pause += 1;
    if (key === 'm') actions.mute += 1;
    if (key === '1') actions.weapon = 1;
    if (key === '2') actions.weapon = 2;
    if (key === 'h') actions.horn += 1;
    if (key === ' ') actions.punch += 1;
  }

  function onKeyUp(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    held.delete(key);
  }

  function onMove(event) {
    const p = toView(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  }

  function onDown(event) {
    const p = toView(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    if (event.button === 0) mouse.down = true;
  }

  function onUp(event) {
    if (event.button === 0) mouse.down = false;
  }

  function onClick(event) {
    clickQueue.push(toView(event.clientX, event.clientY));
  }

  function onBlur() {
    held.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('click', onClick);

  function axis(negative, positive) {
    let value = 0;
    if (held.has(negative)) value -= 1;
    if (held.has(positive)) value += 1;
    return value;
  }

  return {
    held,
    mouse,
    // Movement axes in screen space: x right, y down.
    moveX() {
      return axis('a', 'd') + axis('ArrowLeft', 'ArrowRight');
    },
    moveY() {
      return axis('w', 's') + axis('ArrowUp', 'ArrowDown');
    },
    sprinting() {
      return held.has('Shift');
    },
    handbrake() {
      return held.has(' ');
    },
    takeActions() {
      const snapshot = { ...actions };
      actions.interact = 0;
      actions.confirm = 0;
      actions.pause = 0;
      actions.mute = 0;
      actions.weapon = 0;
      actions.horn = 0;
      actions.punch = 0;
      return snapshot;
    },
    takeClicks() {
      const clicks = clickQueue;
      clickQueue = [];
      return clicks;
    },
    // Convert a view point to world coordinates through the camera.
    viewToWorld(vx, vy, camera) {
      return {
        x: (vx - 640) / camera.zoom + camera.x,
        y: (vy - 360) / camera.zoom + camera.y,
      };
    },
  };
}
