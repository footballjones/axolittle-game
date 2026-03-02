// ============================================================
// Axolittle — Keepey Upey Mini Game
// Keep the axolotl afloat by tapping. Survival / bounce game.
// Stat reward: Strength
// ============================================================

import { completeMiniGame } from '../engine/actions.js';

const CANVAS_W = 360;
const CANVAS_H = 640;
const GRAVITY_BASE = 0.25;
const GRAVITY_RAMP = 0.004;       // +0.004 per second survived
const BOUNCE_FORCE_BASE = -7;
const BOUNCE_WEAKEN = 0.02;       // bounce weakens over time
const OBSTACLE_SPEED_BASE = 1.5;
const OBSTACLE_SPEED_RAMP = 0.04; // faster ramp than before

export function renderKeepey(container) {
  container.innerHTML = `
    <div class="minigame-screen">
      <div class="minigame-header">
        <button class="back-btn">← Back</button>
        <h3>🪁 Keepey Upey</h3>
        <div class="game-score">Score: <span id="keepey-score">0</span></div>
      </div>
      <canvas id="keepey-canvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
      <div id="keepey-overlay" class="game-overlay">
        <div class="overlay-content">
          <h2>🪁 Keepey Upey</h2>
          <p>Tap to bounce upward.<br>Stay afloat as long as you can!</p>
          <button id="keepey-start" class="start-btn">Start</button>
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

  const canvas = document.getElementById('keepey-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('keepey-overlay');
  const scoreDisplay = document.getElementById('keepey-score');

  let running = false;
  let animFrame = null;
  let score = 0;
  let startTime = 0;

  let axo = { x: CANVAS_W / 2, y: CANVAS_H / 2, vy: 0, size: 24 };
  let obstacles = [];
  let bubbles = [];
  let lastObstacleTime = 0;

  function reset() {
    axo = { x: CANVAS_W / 2, y: CANVAS_H / 2, vy: 0, size: 24 };
    obstacles = [];
    bubbles = [];
    lastObstacleTime = 0;
    score = 0;
    startTime = performance.now();
    scoreDisplay.textContent = '0';
  }

  function bounce() {
    if (!running) return;
    // Bounce gets weaker over time — harder to stay up
    const force = Math.min(-3, BOUNCE_FORCE_BASE + score * BOUNCE_WEAKEN);
    axo.vy = force;
    // Spawn decorative bubble
    bubbles.push({ x: axo.x, y: axo.y + axo.size, size: 4 + Math.random() * 6, life: 1 });
  }

  function spawnObstacle() {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const y = 50 + Math.random() * (CANVAS_H - 150);
    // Obstacles grow wider and taller over time
    const widthGrow = Math.min(60, score * 1.5);
    const width = 60 + Math.random() * 80 + widthGrow;
    const height = 18 + Math.random() * 12 + Math.min(20, score * 0.5);
    const speed = (OBSTACLE_SPEED_BASE + score * OBSTACLE_SPEED_RAMP) * (side === 'left' ? 1 : -1);
    obstacles.push({ x: side === 'left' ? -width : CANVAS_W, y, width, height, speed });

    // After 15s, chance of a second obstacle from the other side
    if (score > 15 && Math.random() < Math.min(0.6, (score - 15) * 0.03)) {
      const otherSide = side === 'left' ? 'right' : 'left';
      const y2 = 50 + Math.random() * (CANVAS_H - 150);
      const w2 = 50 + Math.random() * 70 + widthGrow * 0.5;
      const h2 = 16 + Math.random() * 10 + Math.min(14, score * 0.3);
      const spd2 = (OBSTACLE_SPEED_BASE + score * OBSTACLE_SPEED_RAMP) * (otherSide === 'left' ? 1 : -1);
      obstacles.push({ x: otherSide === 'left' ? -w2 : CANVAS_W, y: y2, width: w2, height: h2, speed: spd2 });
    }
  }

  function update() {
    const now = performance.now();
    const elapsed = (now - startTime) / 1000;
    score = Math.floor(elapsed);
    scoreDisplay.textContent = score;

    // Axo physics — gravity increases over time
    const gravity = GRAVITY_BASE + score * GRAVITY_RAMP;
    axo.vy += gravity;
    axo.y += axo.vy;

    // Horizontal drift toward center
    axo.x += (CANVAS_W / 2 - axo.x) * 0.01;

    // Spawn obstacles — interval shrinks over time, lower floor
    const interval = Math.max(500, 2000 - score * 25);
    if (now - lastObstacleTime > interval) {
      spawnObstacle();
      lastObstacleTime = now;
    }

    // Move obstacles
    for (const ob of obstacles) {
      ob.x += ob.speed;
    }
    obstacles = obstacles.filter(ob => ob.x > -200 && ob.x < CANVAS_W + 200);

    // Collision with obstacles
    for (const ob of obstacles) {
      if (
        axo.x + axo.size > ob.x &&
        axo.x - axo.size < ob.x + ob.width &&
        axo.y + axo.size > ob.y &&
        axo.y - axo.size < ob.y + ob.height
      ) {
        endGame();
        return;
      }
    }

    // Floor / ceiling
    if (axo.y + axo.size > CANVAS_H || axo.y - axo.size < 0) {
      endGame();
      return;
    }

    // Update bubbles
    for (const b of bubbles) {
      b.y += 1;
      b.life -= 0.02;
    }
    bubbles = bubbles.filter(b => b.life > 0);
  }

  function draw() {
    // Background
    ctx.fillStyle = '#132a38';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle gradient at bottom (floor danger zone)
    const grad = ctx.createLinearGradient(0, CANVAS_H - 60, 0, CANVAS_H);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(239, 83, 80, 0.15)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, CANVAS_H - 60, CANVAS_W, 60);

    // Water particles
    ctx.fillStyle = 'rgba(100, 200, 255, 0.06)';
    for (let i = 0; i < 20; i++) {
      const px = (i * 73 + performance.now() * 0.01) % CANVAS_W;
      const py = (i * 137 + performance.now() * 0.008) % CANVAS_H;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Decorative bubbles
    for (const b of bubbles) {
      ctx.fillStyle = `rgba(100, 200, 255, ${b.life * 0.4})`;
      ctx.beginPath();
      ctx.arc(b.x + Math.sin(b.y * 0.1) * 5, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Obstacles (rocks / coral)
    for (const ob of obstacles) {
      ctx.fillStyle = '#5a3a2a';
      ctx.beginPath();
      ctx.roundRect(ob.x, ob.y, ob.width, ob.height, 6);
      ctx.fill();
      ctx.fillStyle = '#6b4a38';
      ctx.beginPath();
      ctx.roundRect(ob.x + 3, ob.y + 3, ob.width - 6, ob.height - 6, 4);
      ctx.fill();
    }

    // Axolotl
    const bx = axo.x, by = axo.y, bs = axo.size;
    // Body
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
    for (const dy of [-10, -6, 6, 10]) {
      ctx.beginPath();
      ctx.moveTo(bx - bs + 2, by + dy);
      ctx.lineTo(bx - bs - 8, by + dy + (dy > 0 ? 3 : -3));
      ctx.stroke();
    }

    // Timer display
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${score}s`, CANVAS_W / 2, 30);
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
    gameLoop();
  }

  function endGame() {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);

    let tier = 'normal';
    if (score >= 30) tier = 'exceptional';
    else if (score >= 15) tier = 'good';

    const result = completeMiniGame('strength', tier);

    overlay.style.display = 'flex';
    overlay.querySelector('.overlay-content').innerHTML = `
      <h2>Game Over!</h2>
      <p>Survived: ${score} seconds</p>
      <p>Tier: ${tier.toUpperCase()}</p>
      <p class="reward-text">+Strength  ·  +${result?.bubbles || 0} 💧</p>
      <button id="keepey-start" class="start-btn">Play Again</button>
      <button id="keepey-quit" class="quit-btn">Back to Games</button>
    `;
    document.getElementById('keepey-start').addEventListener('click', startGame);
    document.getElementById('keepey-quit').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'play' }));
    });
  }

  document.getElementById('keepey-start').addEventListener('click', startGame);
  canvas.addEventListener('click', bounce);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); bounce(); });

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

  draw();
}
