// Boot and the frame loop: screens (title, how-to, play, pause), the
// fixed-step simulation with an accumulator, clicks on canvas buttons, and
// the two globals the outside world uses — window.__game for the scripted
// playtest and window.__shotReady for the screenshot captures.

import { SEED, STEP, VIEW } from './config.js';
import { createGame, stepGame } from './game.js';
import { drawWorld } from './render.js';
import {
  drawHUD, drawHowTo, drawOverlay, drawPause, drawTitle,
  howToButtons, pauseButtons, titleButtons,
} from './hud.js';
import { hasSave } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const params = new URLSearchParams(window.location.search);
const seedParam = parseInt(params.get('seed') || '', 10);
const seed = Number.isFinite(seedParam) ? seedParam : SEED;
const shotName = params.get('shot');

let game = createGame(canvas, seed);
window.__game = game;

function emptyActions() {
  return { interact: 0, confirm: 0, pause: 0, mute: 0, weapon: 0, horn: 0, punch: 0 };
}

if (shotName) {
  // Screenshot mode: stage the scene, paint one frame, signal readiness.
  stageShot(game, shotName);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      drawWorld(ctx, game);
      drawHUD(ctx, game);
      window.__shotReady = true;
    });
  });
} else {
  let screen = 'title';
  let returnTo = 'title';
  let hoverId = null;
  let attractT = 0;
  let last = performance.now();
  let acc = 0;
  const pending = emptyActions();

  function drainActions() {
    const fresh = game.input.takeActions();
    for (const key of Object.keys(pending)) {
      if (key === 'weapon') {
        if (fresh.weapon) pending.weapon = fresh.weapon;
      } else {
        pending[key] += fresh[key];
      }
    }
  }

  function clearActions() {
    for (const key of Object.keys(pending)) pending[key] = 0;
  }

  function hitButton(buttons, x, y) {
    for (const btn of buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) return btn.id;
    }
    return null;
  }

  function startNewGame() {
    game = createGame(canvas, seed);
    window.__game = game;
    game.audio.unlock();
    clearActions();
    acc = 0;
    screen = 'play';
  }

  function startContinue() {
    game = createGame(canvas, seed);
    game.loadSave();
    window.__game = game;
    game.audio.unlock();
    clearActions();
    acc = 0;
    screen = 'play';
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const clicks = game.input.takeClicks();
    const mx = game.input.mouse.x;
    const my = game.input.mouse.y;
    drainActions();

    if (screen === 'title') {
      attractT += dt;
      game.camera.x = 1866 + Math.cos(attractT * 0.06) * 800;
      game.camera.y = 2100 + Math.sin(attractT * 0.08) * 700;
      game.camera.zoom = 0.55;
      const saveExists = hasSave();
      const buttons = titleButtons(saveExists);
      hoverId = hitButton(buttons, mx, my);
      for (const click of clicks) {
        const hit = hitButton(buttons, click.x, click.y);
        if (hit === 'new') startNewGame();
        else if (hit === 'continue') startContinue();
        else if (hit === 'howto') { returnTo = 'title'; screen = 'howto'; }
      }
      if (pending.confirm > 0) startNewGame();
      if (pending.mute > 0) game.audio.toggleMute();
      clearActions();
      drawWorld(ctx, game);
      drawTitle(ctx, game, saveExists, hoverId);
    } else if (screen === 'howto') {
      const buttons = howToButtons();
      hoverId = hitButton(buttons, mx, my);
      for (const click of clicks) {
        if (hitButton(buttons, click.x, click.y) === 'back') screen = returnTo;
      }
      if (pending.confirm > 0 || pending.pause > 0) screen = returnTo;
      clearActions();
      drawWorld(ctx, game);
      drawHowTo(ctx, hoverId, returnTo === 'pause');
    } else if (screen === 'pause') {
      const buttons = pauseButtons();
      hoverId = hitButton(buttons, mx, my);
      for (const click of clicks) {
        const hit = hitButton(buttons, click.x, click.y);
        if (hit === 'resume') screen = 'play';
        else if (hit === 'howto') { returnTo = 'pause'; screen = 'howto'; }
        else if (hit === 'quit') {
          screen = 'title';
          game.audio.update(0, 0);
          attractT = 0;
        }
      }
      if (pending.pause > 0) screen = 'play';
      if (pending.mute > 0) game.audio.toggleMute();
      clearActions();
      drawWorld(ctx, game);
      drawHUD(ctx, game);
      drawPause(ctx, hoverId);
    } else {
      // Play.
      if (pending.pause > 0) {
        screen = 'pause';
        clearActions();
      } else if (game.pendingOverlay) {
        game.overlayTime += dt;
        if (pending.confirm > 0) game.dismissOverlay();
        if (pending.mute > 0) game.audio.toggleMute();
        clearActions();
      } else {
        acc += dt;
        let steps = 0;
        const actions = { ...pending };
        clearActions();
        while (acc >= STEP && steps < 4) {
          stepGame(game, STEP, steps === 0 ? actions : emptyActions());
          acc -= STEP;
          steps += 1;
          if (game.pendingOverlay) {
            acc = 0;
            break;
          }
        }
        if (steps === 4) acc = 0;
      }
      drawWorld(ctx, game);
      drawHUD(ctx, game);
      if (game.pendingOverlay) drawOverlay(ctx, game);
    }
  }

  requestAnimationFrame(frame);
}
