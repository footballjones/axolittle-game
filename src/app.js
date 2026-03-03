// ============================================================
// Axolittle — App Router & Entry Point
// ============================================================

import { gameState } from './engine/state.js';
import { startGameLoop, stopGameLoop } from './engine/loop.js';
import { initDebugPanel } from './ui/debug.js';
import { renderAquarium } from './screens/aquarium.js';
import { renderStats } from './screens/stats.js';
import { renderPlay } from './screens/play.js';
import { renderShop } from './screens/shop.js';
import { renderFlappy } from './minigames/flappy.js';
import { renderKeepey } from './minigames/keepey.js';
import { renderMath } from './minigames/math.js';
import { renderStacker } from './minigames/stacker.js';
import { renderTreasure } from './minigames/treasure.js';
import { renderFishing } from './minigames/fishing.js';
import { renderArena } from './minigames/arena.js';

const appContainer = document.getElementById('app');
let currentScreen = 'aquarium';

function navigate(screen) {
  currentScreen = screen;
  switch (screen) {
    case 'aquarium':
      renderAquarium(appContainer);
      break;
    case 'stats':
      renderStats(appContainer);
      break;
    case 'play':
      renderPlay(appContainer);
      break;
    case 'shop':
      renderShop(appContainer);
      break;
    case 'minigame-flappy':
      renderFlappy(appContainer);
      break;
    case 'minigame-keepey':
      renderKeepey(appContainer);
      break;
    case 'minigame-math':
      renderMath(appContainer);
      break;
    case 'minigame-stacker':
      renderStacker(appContainer);
      break;
    case 'minigame-treasure':
      renderTreasure(appContainer);
      break;
    case 'minigame-fishing':
      renderFishing(appContainer);
      break;
    case 'minigame-arena':
      renderArena(appContainer);
      break;
    default:
      renderAquarium(appContainer);
  }
}

// Navigation events from screens
window.addEventListener('navigate', (e) => {
  navigate(e.detail);
});

// State change re-renders (debounced)
let renderTimeout = null;
gameState.subscribe(() => {
  if (renderTimeout) return;
  renderTimeout = setTimeout(() => {
    renderTimeout = null;
    // Only re-render non-game screens (mini games manage their own rendering)
    if (!currentScreen.startsWith('minigame-')) {
      navigate(currentScreen);
    }
  }, 500);
});

// --- Boot ---
function boot() {
  console.log('[Axolittle] Booting...');
  gameState.init();
  startGameLoop();
  initDebugPanel();
  navigate('aquarium');
  console.log('[Axolittle] Ready. Press F9 for debug panel.');
}

// Handle visibility (pause/resume)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopGameLoop();
  } else {
    startGameLoop();
    navigate(currentScreen);
  }
});

boot();
