// ============================================================
// Axolittle — Debug / Testing Panel
// Press F12 or tap the 🔧 button to toggle
// Allows real-time tuning of all TUNABLE values
// ============================================================

import { gameState } from '../engine/state.js';
import * as config from '../data/config.js';

let visible = false;
let panel = null;

export function initDebugPanel() {
  panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.innerHTML = buildPanelHTML();
  document.body.appendChild(panel);

  // Toggle button
  const toggle = document.createElement('button');
  toggle.id = 'debug-toggle';
  toggle.textContent = '🔧';
  toggle.title = 'Debug Panel';
  toggle.addEventListener('click', () => toggleDebug());
  document.body.appendChild(toggle);

  // F12 shortcut (we use F9 to not conflict with browser devtools)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F9') {
      e.preventDefault();
      toggleDebug();
    }
  });

  bindControls();
  updateDisplay();

  // Auto-refresh display
  setInterval(updateDisplay, 1000);
}

function toggleDebug() {
  visible = !visible;
  panel.classList.toggle('visible', visible);
}

function buildPanelHTML() {
  return `
    <div class="debug-header">
      <h3>🔧 Debug Panel</h3>
      <button id="debug-close">✕</button>
    </div>
    <div class="debug-body">
      <section class="debug-section">
        <h4>⏱ Time Controls</h4>
        <label>Time Scale: <input type="range" id="d-timescale" min="1" max="3600" value="1" step="1">
          <span id="d-timescale-val">1x</span></label>
        <div class="debug-row">
          <button id="d-time-1h">+1 Hour</button>
          <button id="d-time-8h">+8 Hours</button>
          <button id="d-time-1d">+1 Day</button>
        </div>
      </section>

      <section class="debug-section">
        <h4>📊 Wellbeing (Active Axolotl)</h4>
        <div id="d-wellbeing-display"></div>
        <div class="debug-row">
          <button id="d-wb-fill">Fill All 100%</button>
          <button id="d-wb-half">Set All 50%</button>
          <button id="d-wb-drain">Drain All 10%</button>
          <button id="d-wb-zero">Set All 0%</button>
        </div>
      </section>

      <section class="debug-section">
        <h4>📈 Growth Stats</h4>
        <div id="d-growth-display"></div>
        <div class="debug-row">
          <button id="d-gr-max">Max All</button>
          <button id="d-gr-zero">Zero All</button>
        </div>
      </section>

      <section class="debug-section">
        <h4>💰 Currency</h4>
        <div id="d-currency-display"></div>
        <div class="debug-row">
          <button id="d-cur-bubbles">+500 💧</button>
          <button id="d-cur-opals">+50 🔮</button>
          <button id="d-cur-rich">Set Rich</button>
        </div>
      </section>

      <section class="debug-section">
        <h4>🦎 Life Stage</h4>
        <div id="d-stage-display"></div>
        <div class="debug-row">
          <button id="d-stage-baby" data-stage="baby">Baby</button>
          <button id="d-stage-juv" data-stage="juvenile">Juvenile</button>
          <button id="d-stage-adult" data-stage="adult">Adult</button>
          <button id="d-stage-elder" data-stage="elder">Elder</button>
        </div>
        <label>XP: <input type="range" id="d-xp" min="0" max="1000" value="0">
          <span id="d-xp-val">0</span></label>
      </section>

      <section class="debug-section">
        <h4>🏠 Aquarium</h4>
        <label>Filter:
          <select id="d-filter">
            <option value="basic">Basic</option>
            <option value="advanced">Advanced</option>
            <option value="premium">Premium</option>
          </select>
        </label>
      </section>

      <section class="debug-section">
        <h4>⚙️ Decay Rates (Current Stage)</h4>
        <div id="d-decay-display"></div>
      </section>

      <section class="debug-section">
        <h4>💾 Save</h4>
        <div class="debug-row">
          <button id="d-save">Save Now</button>
          <button id="d-reset">Reset Game</button>
          <button id="d-export">Export JSON</button>
        </div>
      </section>
    </div>
  `;
}

function bindControls() {
  // Close
  panel.querySelector('#debug-close').addEventListener('click', toggleDebug);

  // Time scale
  panel.querySelector('#d-timescale').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    config.setTimeScale(val);
    panel.querySelector('#d-timescale-val').textContent = `${val}x`;
  });

  // Time jumps
  panel.querySelector('#d-time-1h').addEventListener('click', () => timeJump(1));
  panel.querySelector('#d-time-8h').addEventListener('click', () => timeJump(8));
  panel.querySelector('#d-time-1d').addEventListener('click', () => timeJump(24));

  // Wellbeing shortcuts
  panel.querySelector('#d-wb-fill').addEventListener('click', () => setAllWellbeing(100));
  panel.querySelector('#d-wb-half').addEventListener('click', () => setAllWellbeing(50));
  panel.querySelector('#d-wb-drain').addEventListener('click', () => setAllWellbeing(10));
  panel.querySelector('#d-wb-zero').addEventListener('click', () => setAllWellbeing(0));

  // Growth shortcuts
  panel.querySelector('#d-gr-max').addEventListener('click', () => setAllGrowth(100));
  panel.querySelector('#d-gr-zero').addEventListener('click', () => setAllGrowth(0));

  // Currency
  panel.querySelector('#d-cur-bubbles').addEventListener('click', () => { gameState.data.bubbles += 500; gameState.notify(); });
  panel.querySelector('#d-cur-opals').addEventListener('click', () => { gameState.data.opals += 50; gameState.notify(); });
  panel.querySelector('#d-cur-rich').addEventListener('click', () => {
    gameState.data.bubbles = 99999;
    gameState.data.opals = 9999;
    gameState.notify();
  });

  // Life stage
  panel.querySelectorAll('[data-stage]').forEach(btn => {
    btn.addEventListener('click', () => {
      gameState.activeAxolotl.lifeStage = btn.dataset.stage;
      gameState.activeAxolotl.stageStartTime = Date.now();
      gameState.notify();
    });
  });

  // XP slider
  panel.querySelector('#d-xp').addEventListener('input', (e) => {
    gameState.activeAxolotl.xp = parseInt(e.target.value);
    panel.querySelector('#d-xp-val').textContent = e.target.value;
    gameState.notify();
  });

  // Filter
  panel.querySelector('#d-filter').addEventListener('change', (e) => {
    gameState.activeAquarium.filterTier = e.target.value;
    gameState.notify();
  });

  // Save controls
  panel.querySelector('#d-save').addEventListener('click', () => gameState.save());
  panel.querySelector('#d-reset').addEventListener('click', () => {
    if (confirm('Reset all game data?')) {
      gameState.reset();
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'aquarium' }));
    }
  });
  panel.querySelector('#d-export').addEventListener('click', () => {
    const json = JSON.stringify(gameState.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'axolittle-save.json';
    a.click();
  });
}

function timeJump(hours) {
  // Simulate offline time by rolling back lastTickAt
  gameState.data.lastTickAt -= hours * 60 * 60 * 1000;
  gameState.notify();
}

function setAllWellbeing(val) {
  const wb = gameState.activeAxolotl.wellbeing;
  wb.hunger = val;
  wb.happiness = val;
  wb.cleanliness = val;
  wb.waterQuality = val;
  gameState.notify();
}

function setAllGrowth(val) {
  const g = gameState.activeAxolotl.growth;
  g.stamina = val;
  g.strength = val;
  g.speed = val;
  g.intellect = val;
  gameState.notify();
}

function updateDisplay() {
  if (!visible || !gameState.data) return;

  const axo = gameState.activeAxolotl;
  const aqua = gameState.activeAquarium;
  const wb = axo.wellbeing;
  const g = axo.growth;

  // Wellbeing
  const wbDiv = panel.querySelector('#d-wellbeing-display');
  if (wbDiv) {
    wbDiv.innerHTML = `
      Hunger: ${wb.hunger.toFixed(1)} | Happy: ${wb.happiness.toFixed(1)}<br>
      Clean: ${wb.cleanliness.toFixed(1)} | Water: ${wb.waterQuality.toFixed(1)}<br>
      Mood: ${axo.mood} | Neglect: Stage ${axo.neglectStage}
    `;
  }

  // Growth
  const grDiv = panel.querySelector('#d-growth-display');
  if (grDiv) {
    grDiv.innerHTML = `
      Stam: ${g.stamina.toFixed(1)} | Str: ${g.strength.toFixed(1)}<br>
      Spd: ${g.speed.toFixed(1)} | Int: ${g.intellect.toFixed(1)}
    `;
  }

  // Currency
  const curDiv = panel.querySelector('#d-currency-display');
  if (curDiv) {
    curDiv.innerHTML = `💧 ${gameState.bubbles} | 🔮 ${gameState.opals}`;
  }

  // Stage
  const stageDiv = panel.querySelector('#d-stage-display');
  if (stageDiv) {
    stageDiv.innerHTML = `${axo.lifeStage} · XP: ${axo.xp} · Gen ${axo.generation}`;
  }

  // Decay rates
  const decayDiv = panel.querySelector('#d-decay-display');
  const rates = config.DECAY_RATES[axo.lifeStage];
  if (decayDiv && rates) {
    decayDiv.innerHTML = `
      Hunger: ${rates.hunger}/hr | Happy: ${rates.happiness}/hr<br>
      Clean: ${rates.cleanliness}/hr | Water: ${rates.waterQuality}/hr
    `;
  }

  // Sync sliders
  panel.querySelector('#d-xp').value = axo.xp;
  panel.querySelector('#d-xp-val').textContent = axo.xp;
  panel.querySelector('#d-filter').value = aqua.filterTier;
}
