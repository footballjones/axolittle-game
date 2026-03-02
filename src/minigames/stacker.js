// ============================================================
// Axolittle — Axolotl Stacker Mini Game
// Drop items onto a growing stack with precision timing.
// Stat reward: Speed
// ============================================================

import { completeMiniGame } from '../engine/actions.js';

const CANVAS_W = 360;
const CANVAS_H = 640;
const BASE_Y = CANVAS_H - 40;
const BLOCK_HEIGHT = 28;
const INITIAL_WIDTH = 120;
const SWING_SPEED_BASE = 2.5;

export function renderStacker(container) {
  container.innerHTML = `
    <div class="minigame-screen">
      <div class="minigame-header">
        <button class="back-btn">← Back</button>
        <h3>🥞 Axolotl Stacker</h3>
        <div class="game-score">Score: <span id="stacker-score">0</span></div>
      </div>
      <canvas id="stacker-canvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
      <div id="stacker-overlay" class="game-overlay">
        <div class="overlay-content">
          <h2>🥞 Axolotl Stacker</h2>
          <p>Tap to drop each block.<br>Line them up to stack higher!</p>
          <button id="stacker-start" class="start-btn">Start</button>
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

  const canvas = document.getElementById('stacker-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('stacker-overlay');
  const scoreDisplay = document.getElementById('stacker-score');

  let running = false;
  let animFrame = null;
  let score = 0;

  // Stack of placed blocks: { x, width, y }
  let stack = [];
  // Current swinging block
  let current = null;
  // Falling pieces (trimmed overhangs)
  let fallingPieces = [];
  // Camera offset (scrolls up as stack grows)
  let cameraY = 0;

  const COLORS = [
    '#E8A0BF', '#A0D2DB', '#C5A3CF', '#F7C59F', '#B5EAD7',
    '#FFB7B2', '#B5B9FF', '#FFDAC1', '#E2F0CB', '#C7CEEA',
  ];

  function reset() {
    stack = [];
    fallingPieces = [];
    score = 0;
    cameraY = 0;
    scoreDisplay.textContent = '0';

    // Base block
    stack.push({
      x: CANVAS_W / 2 - INITIAL_WIDTH / 2,
      width: INITIAL_WIDTH,
      y: BASE_Y,
    });

    spawnBlock();
  }

  function spawnBlock() {
    const top = stack[stack.length - 1];
    const speed = SWING_SPEED_BASE + score * 0.15;
    const width = Math.max(20, top.width - (score > 5 ? 2 : 0));
    current = {
      x: 0,
      width,
      y: top.y - BLOCK_HEIGHT,
      speed,
      direction: 1,
    };
  }

  function dropBlock() {
    if (!running || !current) return;

    const top = stack[stack.length - 1];
    const c = current;

    // Calculate overlap
    const overlapLeft = Math.max(c.x, top.x);
    const overlapRight = Math.min(c.x + c.width, top.x + top.width);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) {
      // Complete miss
      fallingPieces.push({ x: c.x, width: c.width, y: c.y, vy: 0, color: COLORS[score % COLORS.length] });
      endGame();
      return;
    }

    // Place the overlapping portion
    stack.push({
      x: overlapLeft,
      width: overlapWidth,
      y: c.y,
    });

    // Trim pieces fall off
    if (c.x < top.x) {
      // Left overhang
      fallingPieces.push({
        x: c.x, width: top.x - c.x, y: c.y, vy: 0,
        color: COLORS[score % COLORS.length],
      });
    }
    if (c.x + c.width > top.x + top.width) {
      // Right overhang
      fallingPieces.push({
        x: top.x + top.width, width: (c.x + c.width) - (top.x + top.width), y: c.y, vy: 0,
        color: COLORS[score % COLORS.length],
      });
    }

    score++;
    scoreDisplay.textContent = score;

    // Scroll camera up
    const targetCameraY = Math.max(0, (stack.length - 12) * BLOCK_HEIGHT);
    cameraY = targetCameraY;

    if (overlapWidth < 10) {
      // Too narrow, end
      endGame();
      return;
    }

    spawnBlock();
  }

  function update() {
    if (!current) return;

    current.x += current.speed * current.direction;
    if (current.x + current.width > CANVAS_W) {
      current.direction = -1;
    } else if (current.x < 0) {
      current.direction = 1;
    }

    // Falling pieces
    for (const p of fallingPieces) {
      p.vy += 0.4;
      p.y += p.vy;
    }
    fallingPieces = fallingPieces.filter(p => p.y < CANVAS_H + cameraY + 100);
  }

  function draw() {
    ctx.fillStyle = '#0e2233';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid lines
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.04)';
    for (let y = 0; y < CANVAS_H; y += BLOCK_HEIGHT) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(0, cameraY);

    // Draw placed stack
    for (let i = 0; i < stack.length; i++) {
      const b = stack[i];
      const color = i === 0 ? '#556' : COLORS[(i - 1) % COLORS.length];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.width, BLOCK_HEIGHT - 2, 4);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(b.x + 2, b.y + 2, b.width - 4, 6);
    }

    // Draw current swinging block
    if (current && running) {
      ctx.fillStyle = COLORS[score % COLORS.length];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.roundRect(current.x, current.y, current.width, BLOCK_HEIGHT - 2, 4);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Drop guide line
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(current.x, current.y + BLOCK_HEIGHT);
      ctx.lineTo(current.x, BASE_Y);
      ctx.moveTo(current.x + current.width, current.y + BLOCK_HEIGHT);
      ctx.lineTo(current.x + current.width, BASE_Y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Falling pieces
    for (const p of fallingPieces) {
      ctx.fillStyle = p.color || '#888';
      ctx.globalAlpha = 0.6;
      ctx.fillRect(p.x, p.y, p.width, BLOCK_HEIGHT - 2);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Height marker
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Height: ${score}`, CANVAS_W - 10, 24);
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
    current = null;
    if (animFrame) cancelAnimationFrame(animFrame);

    let tier = 'normal';
    if (score >= 20) tier = 'exceptional';
    else if (score >= 10) tier = 'good';

    const result = completeMiniGame('speed', tier);

    overlay.style.display = 'flex';
    overlay.querySelector('.overlay-content').innerHTML = `
      <h2>Game Over!</h2>
      <p>Stack height: ${score}</p>
      <p>Tier: ${tier.toUpperCase()}</p>
      <p class="reward-text">+Speed  ·  +${result?.bubbles || 0} 💧</p>
      <button id="stacker-start" class="start-btn">Play Again</button>
      <button id="stacker-quit" class="quit-btn">Back to Games</button>
    `;
    document.getElementById('stacker-start').addEventListener('click', startGame);
    document.getElementById('stacker-quit').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'play' }));
    });
  }

  document.getElementById('stacker-start').addEventListener('click', startGame);
  canvas.addEventListener('click', dropBlock);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); dropBlock(); });

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
  reset();
  draw();
}
