// ============================================================
// Axolittle — Play Screen (Mini Game Selection)
// ============================================================

export function renderPlay(container) {
  container.innerHTML = `
    <div class="play-screen">
      <h2>🎮 Mini Games</h2>

      <h3 class="section-header">Solo</h3>
      <div class="game-grid">
        <button class="game-card" data-game="flappy">
          <div class="game-icon">🪝</div>
          <div class="game-name">Fish Hooks</div>
          <div class="game-stat">⚡ Stamina</div>
        </button>
        <button class="game-card" data-game="keepey">
          <div class="game-icon">🪁</div>
          <div class="game-name">Keepey Upey</div>
          <div class="game-stat">💪 Strength</div>
        </button>
        <button class="game-card" data-game="math">
          <div class="game-icon">🔢</div>
          <div class="game-name">Math Rush</div>
          <div class="game-stat">🧠 Intellect</div>
        </button>
        <button class="game-card" data-game="stacker">
          <div class="game-icon">🥞</div>
          <div class="game-name">Axolotl Stacker</div>
          <div class="game-stat">🏃 Speed</div>
        </button>
        <button class="game-card" data-game="treasure">
          <div class="game-icon">⛏️</div>
          <div class="game-name">Treasure Hunt</div>
          <div class="game-stat">💧 Bubbles + 🔮 Opals</div>
        </button>
      </div>

      <h3 class="section-header">Multiplayer</h3>
      <div class="game-grid">
        <button class="game-card" data-game="fishing">
          <div class="game-icon">🎣</div>
          <div class="game-name">Fishing</div>
          <div class="game-stat">💧 Bubbles</div>
        </button>
        <button class="game-card" data-game="arena">
          <div class="game-icon">💦</div>
          <div class="game-name">Arena Splash</div>
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
