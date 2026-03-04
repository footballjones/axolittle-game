// ============================================================
// Axolittle — Play Screen (Mini Game Selection)
// ============================================================

import { gameState } from '../engine/state.js';

export function renderPlay(container) {
  // Check water change lockout
  const wcUntil = gameState.data.waterChangeUntil || 0;
  const waterChanging = Date.now() < wcUntil;
  const minsLeft = waterChanging ? Math.ceil((wcUntil - Date.now()) / 60000) : 0;

  container.innerHTML = `
    <div class="play-screen">
      <h2>🎮 Mini Games</h2>

      ${waterChanging ? `
        <div class="water-change-banner" style="
          background: rgba(79, 195, 247, 0.12); border: 1px solid rgba(79, 195, 247, 0.25);
          border-radius: 10px; padding: 12px 16px; margin-bottom: 14px;
          text-align: center; color: #aaa; font-size: 13px;
        ">
          💧 <strong style="color: #4fc3f7;">Water change in progress</strong><br>
          Mini games unavailable for <strong>${minsLeft} min</strong>
        </div>
      ` : ''}

      <h3 class="section-header">Solo</h3>
      <div class="game-grid">
        <button class="game-card ${waterChanging ? 'disabled' : ''}" data-game="flappy">
          <div class="game-icon">🪝</div>
          <div class="game-name">Fish Hooks</div>
          <div class="game-stat">⚡ Stamina</div>
        </button>
        <button class="game-card ${waterChanging ? 'disabled' : ''}" data-game="keepey">
          <div class="game-icon">🪁</div>
          <div class="game-name">Keepey Upey</div>
          <div class="game-stat">💪 Strength</div>
        </button>
        <button class="game-card ${waterChanging ? 'disabled' : ''}" data-game="math">
          <div class="game-icon">🔢</div>
          <div class="game-name">Math Rush</div>
          <div class="game-stat">🧠 Intellect</div>
        </button>
        <button class="game-card ${waterChanging ? 'disabled' : ''}" data-game="stacker">
          <div class="game-icon">🥞</div>
          <div class="game-name">Axolotl Stacker</div>
          <div class="game-stat">🏃 Speed</div>
        </button>
        <button class="game-card ${waterChanging ? 'disabled' : ''}" data-game="treasure">
          <div class="game-icon">⛏️</div>
          <div class="game-name">Treasure Hunt</div>
          <div class="game-stat">💧 Bubbles + 🔮 Opals</div>
        </button>
        <button class="game-card ${waterChanging ? 'disabled' : ''}" data-game="coralcode">
          <div class="game-icon">🪸</div>
          <div class="game-name">Coral Code</div>
          <div class="game-stat">🧠 Intellect</div>
        </button>
      </div>

      <h3 class="section-header">Multiplayer</h3>
      <div class="game-grid">
        <button class="game-card ${waterChanging ? 'disabled' : ''}" data-game="fishing">
          <div class="game-icon">🎣</div>
          <div class="game-name">Fishing</div>
          <div class="game-stat">💧 Bubbles</div>
        </button>
        <button class="game-card ${waterChanging ? 'disabled' : ''}" data-game="arena">
          <div class="game-icon">💦</div>
          <div class="game-name">Arena Splash</div>
          <div class="game-stat">💧 Bubbles</div>
        </button>
        <button class="game-card ${waterChanging ? 'disabled' : ''}" data-game="gotcha">
          <div class="game-icon">🦷</div>
          <div class="game-name">Gotcha Last</div>
          <div class="game-stat">💧 Bubbles</div>
        </button>
      </div>

      <nav class="bottom-nav">
        <button class="nav-btn" data-screen="aquarium">🏠</button>
        <button class="nav-btn" data-screen="stats">📊</button>
        <button class="nav-btn active" data-screen="play">🎮</button>
        <button class="nav-btn" data-screen="shop">🛒</button>
      </nav>
    </div>
  `;

  container.querySelectorAll('.game-card:not(.disabled)').forEach(card => {
    card.addEventListener('click', () => {
      const game = card.dataset.game;
      window.dispatchEvent(new CustomEvent('navigate', { detail: `minigame-${game}` }));
    });
  });

  container.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: btn.dataset.screen }));
    });
  });
}
