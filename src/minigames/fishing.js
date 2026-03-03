// ============================================================
// Axolittle — Fishing Mini Game
// Competitive fishing: player vs bot axolotl. Click & hold to
// lower your line, release to reel up. Catch the most weight
// in 40 seconds to win!
// Stat reward: Strength  |  Speed stat boosts line descent
// ============================================================

import { completeMiniGame } from '../engine/actions.js';
import { gameState } from '../engine/state.js';

const CANVAS_W = 360;
const CANVAS_H = 640;
const WATERLINE_Y = 140;
const SEABED_Y = 580;
const LINE_DESCEND_BASE = 2.8;
const LINE_DESCEND_SPEED_BONUS = 1.4; // max bonus from speed stat
const LINE_ASCEND_SPEED = 5;
const GAME_DURATION = 40;
const ESCAPE_TIMEOUT = 2000;

const PLAYER_BOAT_X = 90;
const BOT_BOAT_X = 270;
const BOAT_Y = 100;

const FISH_TYPES = {
  minnow:  { weight: 1,  speed: 2.5, depthMin: 200, depthMax: 320, breakFree: 0,    strengthDiv: Infinity, color: '#c0c0c0', w: 16, h: 8  },
  perch:   { weight: 3,  speed: 1.8, depthMin: 280, depthMax: 420, breakFree: 0.20, strengthDiv: 200,      color: '#66bb6a', w: 22, h: 12 },
  bass:    { weight: 6,  speed: 1.2, depthMin: 380, depthMax: 520, breakFree: 0.45, strengthDiv: 150,      color: '#2e7d32', w: 30, h: 16 },
  catfish: { weight: 10, speed: 0.8, depthMin: 460, depthMax: 570, breakFree: 0.70, strengthDiv: 120,      color: '#8d6e63', w: 36, h: 18 },
};

const SPAWN_TABLE = [
  { type: 'minnow',  cumWeight: 0.45 },
  { type: 'perch',   cumWeight: 0.75 },
  { type: 'bass',    cumWeight: 0.93 },
  { type: 'catfish', cumWeight: 1.00 },
];

function pickFishType() {
  const r = Math.random();
  for (const entry of SPAWN_TABLE) {
    if (r <= entry.cumWeight) return entry.type;
  }
  return 'minnow';
}

export function renderFishing(container) {
  container.innerHTML = `
    <div class="minigame-screen">
      <div class="minigame-header">
        <button class="back-btn">← Back</button>
        <h3>🎣 Fishing</h3>
        <div class="game-score"><span id="fishing-score">0kg vs 0kg</span></div>
      </div>
      <canvas id="fishing-canvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
      <div id="fishing-overlay" class="game-overlay">
        <div class="overlay-content">
          <h2>🎣 Fishing</h2>
          <p>Hold to lower your line.<br>Release to reel in your catch!<br>Don't hold too long or the fish escapes.</p>
          <button id="fishing-start" class="start-btn">Start</button>
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

  const canvas = document.getElementById('fishing-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('fishing-overlay');
  const scoreDisplay = document.getElementById('fishing-score');

  let running = false;
  let animFrame = null;
  let gameStartTime = 0;
  let timeLeft = GAME_DURATION;

  // Stats
  let strength = 0;
  let speed = 0;
  let lineDescendSpeed = LINE_DESCEND_BASE;

  // Player state
  let pState = 'IDLE'; // IDLE, CASTING, HOOKED, REELING
  let pLineY = BOAT_Y;
  let pScore = 0;
  let pHooked = null;
  let pHookTime = 0;
  let isHolding = false;

  // Bot state
  let bState = 'BOT_IDLE';
  let bLineY = BOAT_Y;
  let bScore = 0;
  let bHooked = null;
  let bHookTime = 0;
  let bReelDelay = 0;
  let bTargetDepth = 300;
  let bNextCast = 0;

  // Fish
  let fish = [];
  let lastSpawn = 0;

  // Escape effects
  let escapeEffects = [];

  function reset() {
    const axo = gameState.activeAxolotl;
    strength = axo?.growth?.strength || 0;
    speed = axo?.growth?.speed || 0;
    // Speed stat gives 0 to LINE_DESCEND_SPEED_BONUS extra px/frame
    lineDescendSpeed = LINE_DESCEND_BASE + (speed / 100) * LINE_DESCEND_SPEED_BONUS;

    pState = 'IDLE';
    pLineY = BOAT_Y;
    pScore = 0;
    pHooked = null;
    pHookTime = 0;
    isHolding = false;

    bState = 'BOT_IDLE';
    bLineY = BOAT_Y;
    bScore = 0;
    bHooked = null;
    bHookTime = 0;
    bTargetDepth = 300;
    bNextCast = 0;

    fish = [];
    lastSpawn = 0;
    escapeEffects = [];
    timeLeft = GAME_DURATION;
    gameStartTime = performance.now();
    scoreDisplay.textContent = '0kg vs 0kg';
  }

  // ---- Fish spawning ----
  function spawnFish() {
    const typeName = pickFishType();
    const type = FISH_TYPES[typeName];
    const direction = Math.random() < 0.5 ? 1 : -1;
    const f = {
      typeName,
      type,
      x: direction === 1 ? -type.w : CANVAS_W + type.w,
      y: type.depthMin + Math.random() * (type.depthMax - type.depthMin),
      baseY: 0,
      direction,
      speed: type.speed * (0.8 + Math.random() * 0.4),
      caught: false,
      phase: Math.random() * Math.PI * 2,
    };
    f.baseY = f.y;
    fish.push(f);
  }

  // ---- Player update ----
  function updatePlayer(now) {
    switch (pState) {
      case 'IDLE':
        pLineY = BOAT_Y;
        if (isHolding) pState = 'CASTING';
        break;

      case 'CASTING':
        if (!isHolding) { pState = 'REELING'; break; }
        pLineY = Math.min(SEABED_Y, pLineY + lineDescendSpeed);
        // Check fish collision
        for (const f of fish) {
          if (f.caught) continue;
          const dx = Math.abs(f.x - PLAYER_BOAT_X);
          const dy = Math.abs(f.y - pLineY);
          if (dx < f.type.w * 0.8 && dy < f.type.h * 0.8) {
            // Roll break-free
            const chance = f.type.breakFree * Math.max(0, 1 - strength / f.type.strengthDiv);
            if (Math.random() < chance) {
              addEscape(PLAYER_BOAT_X, pLineY);
              break;
            }
            f.caught = true;
            pHooked = f;
            pState = 'HOOKED';
            pHookTime = now;
            break;
          }
        }
        break;

      case 'HOOKED':
        if (pHooked) {
          pHooked.x = PLAYER_BOAT_X;
          pHooked.y = pLineY;
        }
        if (!isHolding) { pState = 'REELING'; break; }
        if (now - pHookTime > ESCAPE_TIMEOUT) {
          addEscape(PLAYER_BOAT_X, pLineY);
          if (pHooked) { pHooked.caught = false; removeFish(pHooked); }
          pHooked = null;
          pState = 'REELING';
        }
        break;

      case 'REELING':
        pLineY = Math.max(BOAT_Y, pLineY - LINE_ASCEND_SPEED);
        if (pHooked) { pHooked.x = PLAYER_BOAT_X; pHooked.y = pLineY; }
        // Catch fish on the way up if hook is empty and still underwater
        if (!pHooked && pLineY > WATERLINE_Y) {
          for (const f of fish) {
            if (f.caught) continue;
            const dx = Math.abs(f.x - PLAYER_BOAT_X);
            const dy = Math.abs(f.y - pLineY);
            if (dx < f.type.w * 0.8 && dy < f.type.h * 0.8) {
              const chance = f.type.breakFree * Math.max(0, 1 - strength / f.type.strengthDiv);
              if (Math.random() < chance) {
                addEscape(PLAYER_BOAT_X, pLineY);
                break;
              }
              f.caught = true;
              pHooked = f;
              break;
            }
          }
        }
        if (pLineY <= WATERLINE_Y) {
          if (pHooked) {
            pScore += pHooked.type.weight;
            removeFish(pHooked);
            pHooked = null;
          }
          pState = 'IDLE';
        }
        break;
    }
  }

  // ---- Bot update ----
  const BOT_CATCH_RATES = { minnow: 0.90, perch: 0.68, bass: 0.45, catfish: 0.15 };

  function botTryCatch(now) {
    for (const f of fish) {
      if (f.caught) continue;
      if (Math.abs(f.x - BOT_BOAT_X) < 55 && Math.abs(f.y - bLineY) < 40) {
        if (Math.random() < (BOT_CATCH_RATES[f.typeName] || 0.5)) {
          f.caught = true;
          bHooked = f;
          bHookTime = now;
          bReelDelay = 300 + Math.random() * 1200;
          bState = 'BOT_HOOKED';
          return true;
        }
      }
    }
    return false;
  }

  function updateBot(now) {
    switch (bState) {
      case 'BOT_IDLE':
        bLineY = BOAT_Y;
        if (now >= bNextCast) {
          bTargetDepth = 220 + Math.random() * 320;
          bState = 'BOT_CASTING';
        }
        break;

      case 'BOT_CASTING':
        bLineY = Math.min(bTargetDepth, bLineY + LINE_DESCEND_BASE * 1.4);
        // Actively scan for fish while descending
        if (bLineY > WATERLINE_Y) botTryCatch(now);
        if (bState === 'BOT_HOOKED') break; // caught one
        // If reached target depth without a catch, reel up
        if (bLineY >= bTargetDepth) bState = 'BOT_REELING';
        break;

      case 'BOT_HOOKED':
        if (bHooked) { bHooked.x = BOT_BOAT_X; bHooked.y = bLineY; }
        if (now - bHookTime > bReelDelay) bState = 'BOT_REELING';
        break;

      case 'BOT_REELING':
        bLineY = Math.max(BOAT_Y, bLineY - LINE_ASCEND_SPEED);
        if (bHooked) { bHooked.x = BOT_BOAT_X; bHooked.y = bLineY; }
        // Catch fish on the way up too
        if (!bHooked && bLineY > WATERLINE_Y) botTryCatch(now);
        if (bState === 'BOT_HOOKED') break;
        if (bLineY <= WATERLINE_Y) {
          if (bHooked) {
            bScore += bHooked.type.weight;
            removeFish(bHooked);
            bHooked = null;
          }
          bState = 'BOT_IDLE';
          bNextCast = now + 1200 + Math.random() * 1400;
        }
        break;
    }
  }

  function removeFish(f) {
    fish = fish.filter(x => x !== f);
  }

  function addEscape(x, y) {
    escapeEffects.push({ x, y, life: 1 });
  }

  // ---- Main update ----
  function update() {
    const now = performance.now();
    timeLeft = Math.max(0, GAME_DURATION - (now - gameStartTime) / 1000);
    if (timeLeft <= 0) { endGame(); return; }

    // Spawn fish
    if (now - lastSpawn > 800 + Math.random() * 700) {
      spawnFish();
      lastSpawn = now;
    }

    // Move fish
    for (const f of fish) {
      if (f.caught) continue;
      f.x += f.speed * f.direction;
      f.y = f.baseY + Math.sin(f.phase + f.x * 0.015) * 8;
    }
    fish = fish.filter(f => f.caught || (f.x > -60 && f.x < CANVAS_W + 60));
    while (fish.length < 6) spawnFish();

    updatePlayer(now);
    updateBot(now);

    // Escape effects
    for (const e of escapeEffects) e.life -= 0.03;
    escapeEffects = escapeEffects.filter(e => e.life > 0);

    scoreDisplay.textContent = `${pScore}kg vs ${bScore}kg`;
  }

  // ---- Drawing ----
  function draw() {
    const now = performance.now();

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, WATERLINE_Y);
    sky.addColorStop(0, '#4a90b8');
    sky.addColorStop(1, '#2a6090');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, WATERLINE_Y);

    // Water
    const water = ctx.createLinearGradient(0, WATERLINE_Y, 0, SEABED_Y);
    water.addColorStop(0, '#1a5070');
    water.addColorStop(0.4, '#0f3550');
    water.addColorStop(1, '#081820');
    ctx.fillStyle = water;
    ctx.fillRect(0, WATERLINE_Y, CANVAS_W, SEABED_Y - WATERLINE_Y);

    // Seabed
    const sand = ctx.createLinearGradient(0, SEABED_Y, 0, CANVAS_H);
    sand.addColorStop(0, '#3a2a10');
    sand.addColorStop(1, '#1a1408');
    ctx.fillStyle = sand;
    ctx.fillRect(0, SEABED_Y, CANVAS_W, CANVAS_H - SEABED_Y);

    // Waterline ripple
    ctx.strokeStyle = 'rgba(150, 220, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < CANVAS_W; x += 2) {
      const y = WATERLINE_Y + Math.sin(x * 0.03 + now * 0.002) * 3;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Water particles
    ctx.fillStyle = 'rgba(100, 200, 255, 0.06)';
    for (let i = 0; i < 15; i++) {
      const px = (i * 73 + now * 0.008) % CANVAS_W;
      const py = WATERLINE_Y + 20 + (i * 137 + now * 0.005) % (SEABED_Y - WATERLINE_Y - 40);
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Depth zone lines (subtle)
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.04)';
    ctx.lineWidth = 1;
    for (const y of [320, 420, 520]) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }

    // Fish (uncaught)
    for (const f of fish) {
      if (!f.caught) drawFish(f);
    }

    // Boats
    drawBoat(PLAYER_BOAT_X, BOAT_Y);
    drawBoat(BOT_BOAT_X, BOAT_Y);

    // Axolotls on boats
    drawAxolotl(PLAYER_BOAT_X, BOAT_Y - 18, '#E8A0BF', '#D48BA8');
    drawAxolotl(BOT_BOAT_X, BOAT_Y - 18, '#A0D2DB', '#80B8C8');

    // Fishing lines
    drawLine(PLAYER_BOAT_X, pLineY, pHooked ? '#ffd54f' : '#ffffff');
    drawLine(BOT_BOAT_X, bLineY, bHooked ? '#ffd54f' : '#888888');

    // Hooked fish (on lines)
    if (pHooked) drawFish(pHooked);
    if (bHooked) drawFish(bHooked);

    // Escape effects
    for (const e of escapeEffects) {
      ctx.fillStyle = `rgba(255, 100, 100, ${e.life * 0.8})`;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💨', e.x, e.y - (1 - e.life) * 30);
    }

    // Timer
    ctx.fillStyle = timeLeft < 10 ? '#ef5350' : 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(timeLeft)}s`, CANVAS_W / 2, 30);

    // Scores on canvas
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#E8A0BF';
    ctx.fillText(`You: ${pScore}kg`, 10, 55);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#A0D2DB';
    ctx.fillText(`Bot: ${bScore}kg`, CANVAS_W - 10, 55);

    // Hold indicator when casting
    if (pState === 'HOOKED' && pHooked) {
      const elapsed = performance.now() - pHookTime;
      const pct = Math.min(1, elapsed / ESCAPE_TIMEOUT);
      // Danger bar above hooked fish
      const barW = 30;
      const barX = PLAYER_BOAT_X - barW / 2;
      const barY = pLineY - 18;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(barX, barY, barW, 5);
      ctx.fillStyle = pct > 0.7 ? '#ef5350' : '#ffd54f';
      ctx.fillRect(barX, barY, barW * pct, 5);
    }
  }

  function drawBoat(x, y) {
    ctx.fillStyle = '#6b4232';
    ctx.beginPath();
    ctx.moveTo(x - 32, y + 8);
    ctx.lineTo(x - 26, y + 22);
    ctx.lineTo(x + 26, y + 22);
    ctx.lineTo(x + 32, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7d5240';
    ctx.fillRect(x - 22, y + 8, 44, 3);
    // Mast
    ctx.strokeStyle = '#5a3520';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 8);
    ctx.lineTo(x + 12, y - 8);
    ctx.stroke();
  }

  function drawAxolotl(x, y, bodyColor, gillColor) {
    // Body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x + 4, y - 3, 2, 0, Math.PI * 2);
    ctx.arc(x + 4, y + 3, 2, 0, Math.PI * 2);
    ctx.fill();
    // Gills
    ctx.strokeStyle = gillColor;
    ctx.lineWidth = 1.5;
    for (const dy of [-5, -2, 2, 5]) {
      ctx.beginPath();
      ctx.moveTo(x - 10, y + dy);
      ctx.lineTo(x - 16, y + dy + (dy > 0 ? 2 : -2));
      ctx.stroke();
    }
  }

  function drawLine(boatX, lineY, color) {
    if (lineY <= BOAT_Y + 2) return; // no line when fully reeled
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(boatX + 12, BOAT_Y - 6); // rod tip
    ctx.lineTo(boatX, lineY);
    ctx.stroke();
    // Hook
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(boatX, lineY + 3, 4, 0, Math.PI);
    ctx.stroke();
  }

  function drawFish(f) {
    const { x, y, type, direction } = f;
    const dir = direction;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 2, type.w / 2, type.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = type.color;
    ctx.beginPath();
    ctx.ellipse(x, y, type.w / 2, type.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(x - dir * type.w / 2, y);
    ctx.lineTo(x - dir * (type.w / 2 + 7), y - type.h / 3);
    ctx.lineTo(x - dir * (type.w / 2 + 7), y + type.h / 3);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + dir * type.w / 4, y - type.h / 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + dir * type.w / 4, y - type.h / 6, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Game loop ----
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
    bNextCast = performance.now() + 1500;
    gameLoop();
  }

  function endGame() {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);

    let tier = 'normal';
    if (pScore >= 30) tier = 'exceptional';
    else if (pScore >= 15) tier = 'good';

    const result = completeMiniGame(null, tier);

    const won = pScore > bScore;
    const tied = pScore === bScore;
    const emoji = tied ? '🤝' : (won ? '🏆' : '😅');
    const text = tied ? "It's a tie!" : (won ? 'You win!' : 'Bot wins!');

    overlay.style.display = 'flex';
    overlay.querySelector('.overlay-content').innerHTML = `
      <h2>${emoji} ${text}</h2>
      <p>You: ${pScore}kg · Bot: ${bScore}kg</p>
      <p>Tier: ${tier.toUpperCase()}</p>
      <p class="reward-text">+${result?.bubbles || 0} 💧</p>
      <button id="fishing-start" class="start-btn">Play Again</button>
      <button id="fishing-quit" class="quit-btn">Back to Games</button>
    `;
    document.getElementById('fishing-start').addEventListener('click', startGame);
    document.getElementById('fishing-quit').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'play' }));
    });
  }

  // ---- Input ----
  canvas.addEventListener('mousedown', (e) => { e.preventDefault(); isHolding = true; });
  canvas.addEventListener('mouseup', () => { isHolding = false; });
  canvas.addEventListener('mouseleave', () => { isHolding = false; });
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); isHolding = true; });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); isHolding = false; });
  canvas.addEventListener('touchcancel', () => { isHolding = false; });

  // ---- Start button ----
  document.getElementById('fishing-start').addEventListener('click', startGame);

  // ---- Navigation ----
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
