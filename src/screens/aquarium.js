// ============================================================
// Axolittle — Aquarium Home Screen
// Main game view with axolotl, stats, care buttons
// Click-to-clean poop system, ghost shrimp rendering
// ============================================================

import { gameState } from '../engine/state.js';
import { performCare } from '../engine/actions.js';
import { POOP_CONFIG, GHOST_SHRIMP_CONFIG } from '../data/config.js';

const MOOD_EMOJIS = {
  happy: '😊',
  playful: '🎮',
  tired: '😴',
  hungry: '🤤',
  sad: '😢',
  sick: '🤒',
};

const STAGE_LABELS = {
  baby: '🥚 Baby',
  juvenile: '🐣 Juvenile',
  adult: '🦎 Adult',
  elder: '👴 Elder',
};

// Clean tool state (persists across re-renders within a session)
let cleanToolActive = false;
let cleanToolTimer = null;

function getActiveShrimpCount() {
  const aquarium = gameState.activeAquarium;
  if (!aquarium.ghostShrimp || !aquarium.ghostShrimp.batches) return 0;
  const now = Date.now();
  let total = 0;
  for (const batch of aquarium.ghostShrimp.batches) {
    const durationMs = (batch.count / 10) * GHOST_SHRIMP_CONFIG.durationHoursPer10 * 60 * 60 * 1000;
    const elapsed = now - batch.addedAt;
    if (elapsed < durationMs) {
      const remaining = Math.max(0, Math.round(batch.count * (1 - elapsed / durationMs)));
      total += remaining;
    }
  }
  return total;
}

export function renderAquarium(container) {
  const axo = gameState.activeAxolotl;
  const aquarium = gameState.activeAquarium;
  const wb = axo.wellbeing;
  const shrimpCount = getActiveShrimpCount();

  container.innerHTML = `
    <div class="aquarium-screen">
      <div class="tank-header">
        <div class="tank-name">${aquarium.name}</div>
        <div class="currency-bar">
          <span class="bubble-count">💧 ${gameState.bubbles}</span>
          <span class="opal-count">🔮 ${gameState.opals}</span>
        </div>
      </div>

      <div class="tank-view" id="tank-view">
        <div class="water-bg"></div>
        <div class="axolotl-sprite" data-mood="${axo.mood}" data-stage="${axo.lifeStage}">
          <div class="axolotl-body" style="--axo-color: ${axo.color}"></div>
          <div class="mood-indicator">${MOOD_EMOJIS[axo.mood] || '😊'}</div>
        </div>
        ${renderPoops(aquarium.poops || [])}
        ${renderShrimp(shrimpCount)}
        <div class="bubbles-particles"></div>
        ${cleanToolActive ? '<div class="clean-tool-indicator">🧹 Tap poops to clean!</div>' : ''}
      </div>

      <div class="axo-info">
        <div class="axo-name">${axo.name}</div>
        <div class="axo-stage">${STAGE_LABELS[axo.lifeStage]} · Gen ${axo.generation}</div>
        ${axo.neglectStage > 0 ? `<div class="neglect-warning">⚠️ Neglect Stage ${axo.neglectStage}</div>` : ''}
        ${shrimpCount > 0 ? `<div class="shrimp-info">🦐 ${shrimpCount} shrimp active</div>` : ''}
      </div>

      <div class="stats-panel">
        <div class="stat-row">
          <span class="stat-label">🪱 Hunger</span>
          <div class="stat-bar"><div class="stat-fill hunger" style="width:${wb.hunger}%"></div></div>
          <span class="stat-val">${Math.round(wb.hunger)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">😊 Happy</span>
          <div class="stat-bar"><div class="stat-fill happiness" style="width:${wb.happiness}%"></div></div>
          <span class="stat-val">${Math.round(wb.happiness)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">🧹 Clean${(aquarium.poops && aquarium.poops.length > 0) ? ` <span class="poop-count">(💩${aquarium.poops.length})</span>` : ''}</span>
          <div class="stat-bar"><div class="stat-fill cleanliness" style="width:${wb.cleanliness}%"></div></div>
          <span class="stat-val">${Math.round(wb.cleanliness)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">💧 Water Quality</span>
          <div class="stat-bar"><div class="stat-fill water" style="width:${wb.waterQuality}%"></div></div>
          <span class="stat-val">${Math.round(wb.waterQuality)}</span>
        </div>
      </div>

      <div class="care-buttons">
        <button class="care-btn" data-action="feed">🪱 Feed<br><small>20💧</small></button>
        <button class="care-btn ${cleanToolActive ? 'care-btn-active' : ''}" data-action="clean">🧹 Clean</button>
        <button class="care-btn" data-action="waterChange">💧 Water Change</button>
        <button class="care-btn" data-action="playToy">🎾 Play<br><small>10💧</small></button>
      </div>

      <nav class="bottom-nav">
        <button class="nav-btn active" data-screen="aquarium">🏠</button>
        <button class="nav-btn" data-screen="stats">📊</button>
        <button class="nav-btn" data-screen="play">🎮</button>
        <button class="nav-btn" data-screen="shop">🛒</button>
      </nav>
    </div>
  `;

  // Bind care buttons
  container.querySelectorAll('.care-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;

      if (action === 'clean') {
        // Toggle clean tool mode
        cleanToolActive = !cleanToolActive;
        if (cleanToolActive) {
          resetCleanToolTimer(container);
        } else {
          clearCleanToolTimer();
        }
        renderAquarium(container);
        return;
      }

      // Water change confirmation + 1hr lockout
      if (action === 'waterChange') {
        // Check if water change is already in progress
        if (gameState.data.waterChangeUntil && Date.now() < gameState.data.waterChangeUntil) {
          const minsLeft = Math.ceil((gameState.data.waterChangeUntil - Date.now()) / 60000);
          showToast(container, `Water change in progress — ${minsLeft} min left`);
          return;
        }
        showWaterChangeConfirm(container);
        return;
      }

      // Normal care action
      const result = performCare(action);
      if (!result.success) {
        showToast(container, result.reason);
      } else {
        const actionNames = { feed: 'Fed bloodworms', playToy: 'Played' };
        showToast(container, `${actionNames[action] || action} done!`);
        renderAquarium(container);
      }
    });
  });

  // Bind poop clicking (only in clean tool mode)
  container.querySelectorAll('.tank-poop').forEach(poop => {
    poop.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!cleanToolActive) return;

      const poopIndex = parseInt(poop.dataset.poopIndex);
      const aquarium = gameState.activeAquarium;
      if (aquarium.poops && aquarium.poops[poopIndex] !== undefined) {
        aquarium.poops.splice(poopIndex, 1);

        const axo = gameState.activeAxolotl;
        if (aquarium.poops.length === 0) {
          // All poop cleaned — tank is spotless, full cleanliness
          axo.wellbeing.cleanliness = 100;
          showToast(container, 'Tank is spotless! ✨');
        } else {
          // Still poop left — partial cleanliness restore
          axo.wellbeing.cleanliness = Math.min(100, axo.wellbeing.cleanliness + POOP_CONFIG.cleanlinessPerPoop);
          showToast(container, `Cleaned! ${aquarium.poops.length} 💩 left`);
        }

        gameState.notify();
        gameState.save();

        // Reset the 3-second timer
        resetCleanToolTimer(container);
        renderAquarium(container);
      }
    });
  });

  // Clicking the tank view also resets the clean tool timer (counts as activity)
  const tankView = container.querySelector('#tank-view');
  if (tankView) {
    tankView.addEventListener('click', () => {
      if (cleanToolActive) {
        resetCleanToolTimer(container);
      }
    });
  }

  // Bind nav
  container.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cleanToolActive = false;
      clearCleanToolTimer();
      const screen = btn.dataset.screen;
      window.dispatchEvent(new CustomEvent('navigate', { detail: screen }));
    });
  });
}

function resetCleanToolTimer(container) {
  clearCleanToolTimer();
  cleanToolTimer = setTimeout(() => {
    cleanToolActive = false;
    cleanToolTimer = null;
    renderAquarium(container);
  }, POOP_CONFIG.cleanToolTimeoutMs);
}

function clearCleanToolTimer() {
  if (cleanToolTimer) {
    clearTimeout(cleanToolTimer);
    cleanToolTimer = null;
  }
}

function renderPoops(poops) {
  return poops.map((p, i) =>
    `<div class="tank-poop ${cleanToolActive ? 'poop-clickable' : ''}" data-poop-index="${i}" style="left:${p.x}%;top:${p.y}%">💩</div>`
  ).join('');
}

function renderShrimp(count) {
  if (count <= 0) return '';
  // Show some shrimp icons scattered in the tank
  const shrimp = [];
  const displayed = Math.min(count, 10); // Show max 10 shrimp visually
  for (let i = 0; i < displayed; i++) {
    // Deterministic positions based on index
    const x = 10 + ((i * 37 + 13) % 80);
    const y = 60 + ((i * 23 + 7) % 30);
    shrimp.push(`<div class="tank-shrimp" style="left:${x}%;top:${y}%">🦐</div>`);
  }
  return shrimp.join('');
}

function showWaterChangeConfirm(container) {
  // Remove existing dialog if present
  const existing = container.querySelector('.water-confirm-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'water-confirm-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    display: flex; align-items: center; justify-content: center; z-index: 100;
  `;
  overlay.innerHTML = `
    <div style="
      background: #1a2a3a; border-radius: 14px; padding: 24px; max-width: 300px;
      text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.5); color: #eee;
    ">
      <h3 style="margin: 0 0 12px; font-size: 18px;">💧 Water Change</h3>
      <p style="margin: 0 0 16px; font-size: 14px; color: #aaa; line-height: 1.4;">
        Are you sure you want to do a water change?<br>
        <strong style="color: #ef9a9a;">Mini games will be unavailable for 1 hour</strong>
        while the water is changed.
      </p>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="wc-cancel" style="
          padding: 10px 20px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);
          background: transparent; color: #aaa; cursor: pointer; font-size: 14px;
        ">Cancel</button>
        <button id="wc-confirm" style="
          padding: 10px 20px; border-radius: 8px; border: none;
          background: #4fc3f7; color: #111; cursor: pointer; font-weight: bold; font-size: 14px;
        ">Change Water</button>
      </div>
    </div>
  `;
  container.appendChild(overlay);

  overlay.querySelector('#wc-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#wc-confirm').addEventListener('click', () => {
    overlay.remove();
    const result = performCare('waterChange');
    if (!result.success) {
      showToast(container, result.reason);
    } else {
      // Set 1-hour lockout
      gameState.data.waterChangeUntil = Date.now() + 60 * 60 * 1000;
      gameState.save();
      showToast(container, 'Water change started! 1 hour until complete.');
      renderAquarium(container);
    }
  });
}

function showToast(container, msg) {
  const existing = container.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}
