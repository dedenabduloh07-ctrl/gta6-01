// Keyboard + mouse. Held keys give a move vector; one-shot presses queue as
// bit flags taken once per frame, so a press between frames is never lost or
// doubled. The mouse aims (screen space) and fires; Space punches on foot and
// works as confirm on menus.

export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_ENTER_CAR = 4;
export const ACT_MELEE = 8;
export const ACT_HORN = 16;
export const ACT_MUTE = 32;
export const ACT_WEAPON_1 = 64;
export const ACT_WEAPON_2 = 128;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'brake',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sprint: false, brake: false };
  let actions = 0;
  let firing = false;
  const mouse = { x: 0, y: 0, down: false };

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (name) {
      held[name] = true;
      if (event.code === 'Space' && !event.repeat) actions |= ACT_MELEE;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'Enter') actions |= ACT_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACT_PAUSE;
    else if (event.code === 'KeyE' || event.code === 'KeyF') actions |= ACT_ENTER_CAR;
    else if (event.code === 'KeyH') actions |= ACT_HORN;
    else if (event.code === 'KeyM') actions |= ACT_MUTE;
    else if (event.code === 'Digit1') actions |= ACT_WEAPON_1;
    else if (event.code === 'Digit2') actions |= ACT_WEAPON_2;
    else return;
    event.preventDefault();
  }

  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
  }

  function trackMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    for (const k of Object.keys(held)) held[k] = false;
    firing = false;
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', trackMouse);
  canvas.addEventListener('pointerdown', (event) => {
    trackMouse(event);
    mouse.down = true;
    firing = true;
    if (event.button === 0) actions |= ACT_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
    firing = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    held,
    mouse,
    /** Normalised move vector from held keys. */
    moveVector() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    isFiring() {
      return firing;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
