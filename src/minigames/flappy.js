// ============================================================
// Axolittle — Fish Hooks Mini Game
// Flappy Bird-style game. Tap to swim up, avoid hooks.
// Stat reward: Stamina
// ============================================================

import { completeMiniGame } from '../engine/actions.js';

const CANVAS_W = 360;
const CANVAS_H = 640;
const GRAVITY = 0.35;
const JUMP_FORCE = -6.5;
const HOOK_SPEED = 2.5;
const HOOK_GAP = 160;
const HOOK_WIDTH = 50;
const HOOK_INTERVAL = 1800; // ms between hooks

export function renderFlappy(container) {
  container.innerHTML = `
    <div class="minigame-screen">
      <div class="minigame-header">
        <button class="back-btn">← Back</button>
        <h3>🪝 Fish Hooks</h3>
        <div class="game-score">Score: <span id="flappy-score">0</span></div>
      </div>
      <canvas id="flappy-canvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
      <div id="flappy-overlay" class="game-overlay">
        <div class="overlay-content">
          <h2>🪝 Fish Hooks</h2>
          <p>Tap or click to swim up.<br>Avoid the hooks!</p>
          <button id="flappy-start" class="start-btn">Start</button>
        </div>
      </div>
      <nav class="bottom-nav">
        <button class="nav-btn" data-screen="aquarium">🏠</button>
        <button class="nav-btn" data-screen="stats">📊</button>
        <button class="nav-btn active" data-screen="play">🎮</button>
        <button class="nav-btn" data-screen="shop">🛒</button>
      </nav>
    </div>
  `;

  const canvas = document.getElementById('flappy-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('flappy-overlay');
  const scoreDisplay = document.getElementById('flappy-score');

  let running = false;
  let animFrame = null;
  let score = 0;

  // Player
  let bird = { x: 80, y: CANVAS_H / 2, vy: 0, size: 22 };

  // Hooks
  let hooks = [];
  let lastHookTime = 0;

  function reset() {
    bird = { x: 80, y: CANVAS_H / 2, vy: 0, size: 22 };
    hooks = [];
    lastHookTime = 0;
    score = 0;
    scoreDisplay.textContent = '0';
  }

  function spawnHook() {
    const gapY = 80 + Math.random() * (CANVAS_H - 200);
    hooks.push({
      x: CANVAS_W,
      gapY,
      gap: HOOK_GAP,
      width: HOOK_WIDTH,
      scored: false,
    });
  }

  function jump() {
    if (!running) return;
    bird.vy = JUMP_FORCE;
  }

  function update() {
    const now = performance.now();

    // Bird physics
    bird.vy += GRAVITY;
    bird.y += bird.vy;

    // Spawn hooks
    if (now - lastHookTime > HOOK_INTERVAL) {
      spawnHook();
      lastHookTime = now;
    }

    // Move hooks
    for (const h of hooks) {
      h.x -= HOOK_SPEED;

      // Score
      if (!h.scored && h.x + h.width < bird.x) {
        h.scored = true;
        score++;
        scoreDisplay.textContent = score;
      }

      // Collision
      if (
        bird.x + bird.size > h.x &&
        bird.x - bird.size < h.x + h.width
      ) {
        if (bird.y - bird.size < h.gapY - h.gap / 2 ||
            bird.y + bird.size > h.gapY + h.gap / 2) {
          endGame();
          return;
        }
      }
    }

    // Remove off-screen hooks
    hooks = hooks.filter(h => h.x + h.width > -10);

    // Boundary collision
    if (bird.y + bird.size > CANVAS_H || bird.y - bird.size < 0) {
      endGame();
      return;
    }
  }

  function draw() {
    // Water background
    ctx.fillStyle = '#1a3a4a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Water ripple lines
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.1)';
    for (let y = 0; y < CANVAS_H; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin(performance.now() / 1000 + y) * 3);
      ctx.lineTo(CANVAS_W, y + Math.sin(performance.now() / 1000 + y + 2) * 3);
      ctx.stroke();
    }

    // Hooks
    for (const h of hooks) {
      // Top hook (line from top)
      ctx.fillStyle = '#888';
      ctx.fillRect(h.x, 0, h.width, h.gapY - h.gap / 2);
      // Hook curve at bottom of top section
      ctx.fillStyle = '#aaa';
      ctx.beginPath();
      ctx.arc(h.x + h.width / 2, h.gapY - h.gap / 2, h.width / 2 + 5, 0, Math.PI);
      ctx.fill();

      // Bottom hook (line from bottom)
      ctx.fillStyle = '#888';
      ctx.fillRect(h.x, h.gapY + h.gap / 2, h.width, CANVAS_H - (h.gapY + h.gap / 2));
      // Hook curve at top of bottom section
      ctx.fillStyle = '#aaa';
      ctx.beginPath();
      ctx.arc(h.x + h.width / 2, h.gapY + h.gap / 2, h.width / 2 + 5, Math.PI, 0);
      ctx.fill();
    }

    // Axolotl (simple circle with gills)
    const bx = bird.x, by = bird.y, bs = bird.size;
    ctx.fillStyle = '#E8A0BF';
    ctx.beginPath();
    ctx.arc(bx, by, bs, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(bx + 6, by - 5, 3, 0, Math.PI * 2);
    ctx.arc(bx + 6, by + 5, 3, 0, Math.PI * 2);
    ctx.fill();

    // Gills
    ctx.strokeStyle = '#D48BA8';
    ctx.lineWidth = 2;
    for (const dy of [-12, -8, 8, 12]) {
      ctx.beginPath();
      ctx.moveTo(bx - bs + 2, by + dy);
      ctx.lineTo(bx - bs - 10, by + dy + (dy > 0 ? 4 : -4));
      ctx.stroke();
    }

    // Smile
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx + 10, by, 5, -0.3, Math.PI * 0.3);
    ctx.stroke();
  }

  function gameLoop() {
    if (!running) return;
    update();
    draw();
    animFrame = requestAnimationFrame(gameLoop);
  }

  function startGame() {
    reset();
    overlay.style.display = 'none';
    running = true;
    lastHookTime = performance.now();
    gameLoop();
  }

  function endGame() {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);

    // Determine tier
    let tier = 'normal';
    if (score >= 20) tier = 'exceptional';
    else if (score >= 10) tier = 'good';

    const result = completeMiniGame('stamina', tier);

    overlay.style.display = 'flex';
    overlay.querySelector('.overlay-content').innerHTML = `
      <h2>Game Over!</h2>
      <p>Score: ${score} hooks passed</p>
      <p>Tier: ${tier.toUpperCase()}</p>
      <p class="reward-text">+Stamina  ·  +${result?.bubbles || 0} 💧</p>
      <button id="flappy-start" class="start-btn">Play Again</button>
      <button id="flappy-quit" class="quit-btn">Back to Games</button>
    `;

    document.getElementById('flappy-start').addEventListener('click', startGame);
    document.getElementById('flappy-quit').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'play' }));
    });
  }

  // Event listeners
  document.getElementById('flappy-start').addEventListener('click', startGame);

  canvas.addEventListener('click', jump);
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    jump();
  });

  container.querySelector('.back-btn').addEventListener('click', () => {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'play' }));
  });

  container.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      running = false;
      if (animFrame) cancelAnimationFrame(animFrame);
      window.dispatchEvent(new CustomEvent('navigate', { detail: btn.dataset.screen }));
    });
  });

  // Initial draw
  draw();
}
