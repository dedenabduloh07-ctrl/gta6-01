// Solmar Heat: boot, the fixed-step loop, and the screens (title, play,
// pause, how-to, and the mission/wasted/busted cards). The city seed is
// fixed, so every player explores the same Solmar.
//
// ?seed=N rebuilds the city from another seed. ?shot=start|drive|chase|
// combat stages a screenshot scene instead of running the loop, paints it
// twice, and sets window.__shotReady.

import { STEP } from './config.js';
import { ACT_CONFIRM, ACT_MELEE, ACT_MUTE, ACT_PAUSE, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import {
  createGame, respawnAfterBusted, respawnAfterWasted, snapshotSave,
  updateAmbient, updateGame,
} from './game.js';
import { defaultSave, loadSave, loadSettings, writeSave, writeSettings } from './save.js';
import { startMission } from './missions.js';
import { stageShot } from './shots.js';

const CITY_SEED = 20261117;
const MAX_FRAME = 0.25;
const TITLE_MENU_Y = 380;
const TITLE_MENU_H = 54;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : CITY_SEED;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const input = createInput(canvas);
const audio = createAudio();
const settings = loadSettings();
audio.setMuted(settings.muted);

function announce(message) {
  status.textContent = message;
}

function saveGame(g) {
  writeSave(snapshotSave(g));
}

function newGame(saveData) {
  const g = createGame(seed, saveData || defaultSave(), audio);
  g.onSave = () => saveGame(g);
  // Debug handle for automated playthroughs; harmless in normal play.
  window.__game = g;
  return g;
}

function runShot(name) {
  const g = newGame(defaultSave());
  const scene = stageShot(name, g);
  let painted = 0;
  function paint() {
    renderer.draw(g, g.camera, g.time);
    if (scene.screen === 'title') {
      hud.drawTitle(['New Game', 'Continue', 'How to Play'], 0, renderer.view, true, false);
    } else {
      hud.drawWorld(g, g.camera, g.time, renderer.view);
    }
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = 'title';
  let returnScreen = 'title';
  let g = newGame(defaultSave());
  let saved = loadSave();
  let menuIndex = 0;
  let navCooldown = 0;
  let accumulator = 0;
  let last = performance.now();
  let titleTime = 0;

  function titleMenu() {
    const items = ['New Game'];
    if (saved) items.push('Continue');
    items.push('How to Play');
    return items;
  }
  function pauseMenu() {
    return ['Resume', 'How to Play', 'Save Game', 'Quit to Title'];
  }
  function currentMenu() {
    return screen === 'title' ? titleMenu() : pauseMenu();
  }

  function toggleMute() {
    settings.muted = !settings.muted;
    audio.setMuted(settings.muted);
    writeSettings(settings);
  }

  function startFresh() {
    g = newGame(defaultSave());
    saved = null;
    screen = 'play';
    announce('Playing. Follow the yellow marker to Vince.');
  }

  function startContinue() {
    const data = loadSave();
    g = newGame(data || defaultSave());
    screen = 'play';
    announce('Continuing your game.');
  }

  function menuConfirm() {
    const items = currentMenu();
    const choice = items[menuIndex];
    audio.click();
    if (screen === 'title') {
      if (choice === 'New Game') startFresh();
      else if (choice === 'Continue') startContinue();
      else if (choice === 'How to Play') {
        returnScreen = 'title';
        screen = 'howto';
      }
    } else if (screen === 'pause') {
      if (choice === 'Resume') screen = 'play';
      else if (choice === 'How to Play') {
        returnScreen = 'pause';
        screen = 'howto';
      } else if (choice === 'Save Game') {
        saveGame(g);
        g.toasts.push({ text: 'Game saved', color: '#8fd08a', life: 2.6, max: 2.6 });
      } else if (choice === 'Quit to Title') {
        saveGame(g);
        saved = loadSave();
        g = newGame(defaultSave());
        screen = 'title';
        menuIndex = 0;
      }
    }
  }

  function menuNavigate(dt) {
    navCooldown = Math.max(0, navCooldown - dt);
    const move = input.moveVector();
    if (navCooldown <= 0 && move.y !== 0) {
      const items = currentMenu();
      menuIndex = (menuIndex + (move.y > 0 ? 1 : -1) + items.length) % items.length;
      navCooldown = 0.22;
      audio.click();
    }
  }

  /** Clicking a menu row selects and confirms it. */
  function menuClick() {
    const mx = (input.mouse.x - renderer.view.ox) / renderer.view.scale;
    const my = (input.mouse.y - renderer.view.oy) / renderer.view.scale;
    if (Math.abs(mx - 640) > 170) return false;
    const items = currentMenu();
    const topY = screen === 'title' ? TITLE_MENU_Y : 262 + (720 - 470) / 2;
    const lineH = screen === 'title' ? TITLE_MENU_H : 50;
    for (let i = 0; i < items.length; i += 1) {
      if (Math.abs(my - (topY + i * lineH)) < 22) {
        menuIndex = i;
        menuConfirm();
        return true;
      }
    }
    return false;
  }

  function overlayConfirm() {
    const overlay = g.pendingOverlay;
    if (!overlay) return;
    audio.click();
    if (overlay.type === 'missionIntro') {
      g.pendingOverlay = null;
      startMission(g.missions, g);
      announce(`Mission started: ${overlay.mission.title}.`);
    } else if (overlay.type === 'missionDone' || overlay.type === 'missionFail' || overlay.type === 'ending') {
      g.pendingOverlay = null;
    } else if (overlay.type === 'wasted') {
      respawnAfterWasted(g);
      announce('You woke up at the hospital.');
    } else if (overlay.type === 'busted') {
      respawnAfterBusted(g);
      announce('You were released from Police HQ.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    audio.unlock();
    if (actions & ACT_MUTE) toggleMute();

    if (screen === 'title') {
      titleTime += dt;
      menuNavigate(dt);
      if (actions & (ACT_CONFIRM | ACT_MELEE)) {
        if (!menuClick()) menuConfirm();
      }
      // Attract mode: the city lives behind the menu, camera drifting.
      accumulator += dt;
      while (accumulator >= STEP) {
        updateAmbient(g, STEP);
        accumulator -= STEP;
      }
      g.camera.x = 1866 + Math.cos(titleTime * 0.07) * 520;
      g.camera.y = 1866 + Math.sin(titleTime * 0.05) * 430;
      g.camera.zoom = 0.92;
      renderer.draw(g, g.camera, g.time);
      hud.drawTitle(titleMenu(), menuIndex, renderer.view, !!saved, settings.muted);
      return;
    }

    if (screen === 'howto') {
      if (actions & (ACT_CONFIRM | ACT_MELEE | ACT_PAUSE)) {
        screen = returnScreen;
        audio.click();
      }
      renderer.draw(g, g.camera, g.time);
      hud.drawHowTo(renderer.view);
      return;
    }

    if (screen === 'pause') {
      menuNavigate(dt);
      if (actions & (ACT_CONFIRM | ACT_MELEE)) {
        if (!menuClick()) menuConfirm();
      } else if (actions & ACT_PAUSE) {
        screen = 'play';
      }
      renderer.draw(g, g.camera, g.time);
      hud.drawPause(g, pauseMenu(), menuIndex, renderer.view, settings.muted);
      return;
    }

    // Playing.
    if (actions & ACT_PAUSE && !g.pendingOverlay) {
      screen = 'pause';
      menuIndex = 0;
      announce('Paused.');
      return;
    }
    if (g.pendingOverlay) {
      if (actions & (ACT_CONFIRM | ACT_MELEE)) overlayConfirm();
      renderer.draw(g, g.camera, g.time);
      hud.drawWorld(g, g.camera, g.time, renderer.view);
      // Confirming the card clears it; only draw what is still pending.
      if (g.pendingOverlay) hud.drawOverlay(g, g.pendingOverlay, renderer.view);
      accumulator = 0;
      return;
    }
    const aimWorld = renderer.screenToWorld(input.mouse.x, input.mouse.y, g.camera);
    accumulator += dt;
    let firstStep = true;
    while (accumulator >= STEP) {
      updateGame(g, STEP, input, firstStep ? actions : 0, aimWorld);
      firstStep = false;
      accumulator -= STEP;
      if (g.pendingOverlay) {
        accumulator = 0;
        break;
      }
    }
    renderer.draw(g, g.camera, g.time);
    hud.drawWorld(g, g.camera, g.time, renderer.view);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play' && !g.pendingOverlay) {
      screen = 'pause';
      menuIndex = 0;
      announce('Paused.');
    }
  });

  announce('Solmar Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
