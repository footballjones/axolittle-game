// ============================================================
// Axolittle — Treasure Hunt Cave Mini Game
// Navigate a cave, collect gems, avoid obstacles.
// Seed-based generation for future async multiplayer.
// Reward: Bubbles + Opals only (no stat gain). 2 opals/day cap.
// ============================================================

import { gameState } from '../engine/state.js';
import { TREASURE_HUNT_CONFIG } from '../data/config.js';

const CANVAS_W = 360;
const CANVAS_H = 640;
const AXO_SIZE = 18;
const SCROLL_SPEED_BASE = 1.8;

// Simple seeded RNG for reproducible caves
function seededRNG(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getOpalsEarnedToday() {
  const state = gameState.data;
  if (!state.treasureHunt) state.treasureHunt = {};
  const today = getTodayKey();
  if (state.treasureHunt.lastOpalDate !== today) {
    state.treasureHunt.lastOpalDate = today;
    state.treasureHunt.opalsToday = 0;
  }
  return state.treasureHunt.opalsToday || 0;
}

function addOpalToday() {
  const state = gameState.data;
  if (!state.treasureHunt) state.treasureHunt = {};
  const today = getTodayKey();
  if (state.treasureHunt.lastOpalDate !== today) {
    state.treasureHunt.lastOpalDate = today;
    state.treasureHunt.opalsToday = 0;
  }
  state.treasureHunt.opalsToday = (state.treasureHunt.opalsToday || 0) + 1;
  state.opals += 1;
}

export function renderTreasure(container) {
  container.innerHTML = `
    <div class="minigame-screen">
      <div class="minigame-header">
        <button class="back-btn">← Back</button>
        <h3>⛏️ Treasure Hunt</h3>
        <div class="game-score">
          💎 <span id="treasure-gems">0</span>
          &nbsp;|&nbsp;
          🫁 <span id="treasure-air">100</span>
        </div>
      </div>
      <canvas id="treasure-canvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
      <div id="treasure-overlay" class="game-overlay">
        <div class="overlay-content">
          <h2>⛏️ Treasure Hunt Cave</h2>
          <p>Swipe or tap sides to navigate.<br>Collect gems, avoid rocks!<br>Watch your air meter.</p>
          <div class="seed-display" id="treasure-seed"></div>
          <button id="treasure-start" class="start-btn">Start</button>
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

  const canvas = document.getElementById('treasure-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('treasure-overlay');
  const gemsDisplay = document.getElementById('treasure-gems');
  const airDisplay = document.getElementById('treasure-air');
  const seedDisplay = document.getElementById('treasure-seed');

  let running = false;
  let animFrame = null;
  let gems = 0;
  let opalsEarned = 0;
  let bubblesEarned = 0;
  let air = 100;
  let distance = 0;
  let seed = 0;
  let rng = null;

  let axo = { x: CANVAS_W / 2, y: CANVAS_H - 120, targetX: CANVAS_W / 2 };

  // Cave walls
  let caveSegments = []; // { y, leftWall, rightWall }
  // Gems
  let gemList = [];
  // Rocks (obstacles)
  let rocks = [];
  // Scroll offset (increases over time to move cave downward on screen)
  let scrollY = 0;

  function generateSeed() {
    return Math.floor(Math.random() * 999999);
  }

  function generateCave() {
    caveSegments = [];
    gemList = [];
    rocks = [];

    let leftWall = 40;
    let rightWall = CANVAS_W - 40;

    // Minimum passage width: axolotl diameter + generous buffer for controls
    const MIN_GAP = AXO_SIZE * 2 + 30; // ~66px — always passable

    for (let i = 0; i < 500; i++) {
      const y = -i * 30;
      // Walls meander — drift increases slightly with depth
      const drift = Math.min(1.0, i / 400); // 0→1 over 400 segments
      leftWall += (rng() - 0.45) * (18 + drift * 8);
      rightWall += (rng() - 0.55) * (18 + drift * 8);

      // Progressive narrowing: max width shrinks with depth
      const maxWidth = Math.max(MIN_GAP, (CANVAS_W - 80) - i * 0.25);
      const center = (leftWall + rightWall) / 2;

      leftWall = Math.max(10, Math.min(center - MIN_GAP / 2, leftWall));
      rightWall = Math.max(center + MIN_GAP / 2, Math.min(CANVAS_W - 10, rightWall));

      // Narrow passages at higher distances — gradual difficulty
      if (i > 50 && rng() < 0.08 + i * 0.0002) {
        const maxSqueeze = Math.min(25, 10 + i * 0.03);
        const squeeze = rng() * maxSqueeze;
        leftWall += squeeze;
        rightWall -= squeeze;
      }

      // ALWAYS enforce minimum passable gap after all adjustments
      const gap = rightWall - leftWall;
      if (gap < MIN_GAP) {
        const mid = (leftWall + rightWall) / 2;
        leftWall = mid - MIN_GAP / 2;
        rightWall = mid + MIN_GAP / 2;
        // Re-clamp to canvas bounds
        if (leftWall < 10) { leftWall = 10; rightWall = leftWall + MIN_GAP; }
        if (rightWall > CANVAS_W - 10) { rightWall = CANVAS_W - 10; leftWall = rightWall - MIN_GAP; }
      }

      caveSegments.push({ y, leftWall, rightWall });

      // Gems - appear from segment 3 onward
      if (i > 2 && rng() < 0.15) {
        const gx = leftWall + 20 + rng() * (rightWall - leftWall - 40);
        gemList.push({ x: gx, y: y + 15, collected: false });
      }

      // Rocks - appear from segment 10 onward, increasing frequency
      // But ONLY when the passage is wide enough that the player can navigate around them
      if (i > 10 && rng() < 0.08 + i * 0.0003) {
        const passageWidth = rightWall - leftWall;
        // Rock size scales down in narrow passages
        const maxRockSize = Math.min(22, (passageWidth - MIN_GAP) * 0.4);
        // Only spawn if there's room for a meaningful rock AND passage around it
        // Player needs AXO_SIZE + rock.size*0.6 clearance from rock center,
        // plus AXO_SIZE clearance from wall — so rock must leave enough space on one side
        if (maxRockSize >= 8) {
          const rockSize = 8 + rng() * (maxRockSize - 8);
          const clearance = AXO_SIZE + rockSize * 0.6 + 4; // space player needs to pass
          // Position rock so player can always pass on at least one side
          const minRockX = leftWall + clearance;
          const maxRockX = rightWall - clearance;
          if (maxRockX > minRockX) {
            const rx = minRockX + rng() * (maxRockX - minRockX);
            rocks.push({ x: rx, y: y + 10, size: rockSize });
          }
        }
      }
    }
  }

  function reset() {
    seed = generateSeed();
    rng = seededRNG(seed);
    seedDisplay.textContent = `Seed: ${seed}`;

    axo = { x: CANVAS_W / 2, y: CANVAS_H - 120, targetX: CANVAS_W / 2 };
    gems = 0;
    opalsEarned = 0;
    bubblesEarned = 0;
    air = 100;
    distance = 0;
    scrollY = 0;
    gemsDisplay.textContent = '0';
    airDisplay.textContent = '100';

    generateCave();
  }

  function moveAxo(direction) {
    if (!running) return;
    axo.targetX += direction * 40;
    axo.targetX = Math.max(30, Math.min(CANVAS_W - 30, axo.targetX));
  }

  function update() {
    const scrollSpeed = SCROLL_SPEED_BASE + distance * 0.0002;
    // Scroll cave downward: increase scrollY so negative-y cave elements move into view
    scrollY += scrollSpeed;
    distance += scrollSpeed;

    // Air depletes
    air -= 0.03 + distance * 0.000005;
    air = Math.max(0, air);
    airDisplay.textContent = Math.round(air);

    if (air <= 0) {
      endGame('air');
      return;
    }

    // Smooth axo movement
    axo.x += (axo.targetX - axo.x) * 0.12;

    // Check wall collision — find which cave segment the axolotl is at
    // Axo is at fixed screen position axo.y. Cave segment screen position = seg.y + scrollY.
    // When seg.y + scrollY = axo.y → seg.y = axo.y - scrollY
    // Since seg.y = -i * 30, we get i = (scrollY - axo.y) / 30
    const segIndex = Math.floor((scrollY - axo.y) / 30);
    if (segIndex >= 0 && segIndex < caveSegments.length) {
      const seg = caveSegments[segIndex];
      if (axo.x - AXO_SIZE < seg.leftWall || axo.x + AXO_SIZE > seg.rightWall) {
        endGame('wall');
        return;
      }
    }

    // Check gem collection
    for (const g of gemList) {
      if (g.collected) continue;
      const screenGY = g.y + scrollY;
      const dx = axo.x - g.x;
      const dy = axo.y - screenGY;
      if (Math.sqrt(dx * dx + dy * dy) < AXO_SIZE + 10) {
        g.collected = true;
        gems++;
        air = Math.min(100, air + 3); // Gems restore a bit of air
        gemsDisplay.textContent = gems;

        // Award bubbles per gem
        bubblesEarned += TREASURE_HUNT_CONFIG.bubblesPerGem;
        gameState.data.bubbles += TREASURE_HUNT_CONFIG.bubblesPerGem;

        // Opal chance (respecting daily cap)
        const opalsToday = getOpalsEarnedToday();
        if (opalsToday < TREASURE_HUNT_CONFIG.maxOpalsPerDay && Math.random() < TREASURE_HUNT_CONFIG.opalChancePerGem) {
          addOpalToday();
          opalsEarned++;
        }
      }
    }

    // Check rock collision — end on collision
    for (const r of rocks) {
      const screenRY = r.y + scrollY;
      const dx = axo.x - r.x;
      const dy = axo.y - screenRY;
      if (Math.sqrt(dx * dx + dy * dy) < AXO_SIZE + r.size * 0.6) {
        endGame('rock');
        return;
      }
    }

    // Check if reached end of cave
    if (distance > 500 * 30 * 0.8) {
      endGame('end');
      return;
    }
  }

  function draw() {
    // Dark cave background
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw cave walls
    ctx.fillStyle = '#1a1408';

    // Left wall fill
    ctx.beginPath();
    ctx.moveTo(0, 0);
    let drewLeft = false;
    for (const seg of caveSegments) {
      const screenY = seg.y + scrollY;
      if (screenY > CANVAS_H + 30 || screenY < -30) continue;
      ctx.lineTo(seg.leftWall, screenY);
      drewLeft = true;
    }
    if (drewLeft) {
      ctx.lineTo(0, CANVAS_H);
      ctx.closePath();
      ctx.fill();
    }

    // Right wall fill
    ctx.beginPath();
    ctx.moveTo(CANVAS_W, 0);
    let drewRight = false;
    for (const seg of caveSegments) {
      const screenY = seg.y + scrollY;
      if (screenY > CANVAS_H + 30 || screenY < -30) continue;
      ctx.lineTo(seg.rightWall, screenY);
      drewRight = true;
    }
    if (drewRight) {
      ctx.lineTo(CANVAS_W, CANVAS_H);
      ctx.closePath();
      ctx.fill();
    }

    // Wall edges
    ctx.strokeStyle = '#3a2a10';
    ctx.lineWidth = 2;
    for (let i = 1; i < caveSegments.length; i++) {
      const prev = caveSegments[i - 1];
      const curr = caveSegments[i];
      const py = prev.y + scrollY;
      const cy = curr.y + scrollY;
      if (cy > CANVAS_H + 30 && py > CANVAS_H + 30) continue;
      if (cy < -30 && py < -30) continue;

      ctx.beginPath();
      ctx.moveTo(prev.leftWall, py);
      ctx.lineTo(curr.leftWall, cy);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(prev.rightWall, py);
      ctx.lineTo(curr.rightWall, cy);
      ctx.stroke();
    }

    // Draw gems
    for (const g of gemList) {
      if (g.collected) continue;
      const sy = g.y + scrollY;
      if (sy < -20 || sy > CANVAS_H + 20) continue;
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💎', g.x, sy + 6);
    }

    // Draw rocks
    for (const r of rocks) {
      const sy = r.y + scrollY;
      if (sy < -30 || sy > CANVAS_H + 30) continue;
      ctx.fillStyle = '#4a3a2a';
      ctx.beginPath();
      ctx.arc(r.x, sy, r.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a4a38';
      ctx.beginPath();
      ctx.arc(r.x - 2, sy - 2, r.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw axolotl with hard hat
    const bx = axo.x, by = axo.y;
    // Body
    ctx.fillStyle = '#E8A0BF';
    ctx.beginPath();
    ctx.arc(bx, by, AXO_SIZE, 0, Math.PI * 2);
    ctx.fill();
    // Hard hat
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath();
    ctx.arc(bx, by - AXO_SIZE + 4, AXO_SIZE + 2, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffca28';
    ctx.fillRect(bx - AXO_SIZE - 4, by - AXO_SIZE + 3, (AXO_SIZE + 4) * 2, 5);
    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(bx - 5, by - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(bx + 5, by - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Headlamp glow
    const lampGrad = ctx.createRadialGradient(bx, by - AXO_SIZE, 5, bx, by - AXO_SIZE - 80, 120);
    lampGrad.addColorStop(0, 'rgba(255, 250, 200, 0.12)');
    lampGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = lampGrad;
    ctx.beginPath();
    ctx.moveTo(bx - 60, by - AXO_SIZE - 200);
    ctx.lineTo(bx + 60, by - AXO_SIZE - 200);
    ctx.lineTo(bx + 8, by - AXO_SIZE);
    ctx.lineTo(bx - 8, by - AXO_SIZE);
    ctx.closePath();
    ctx.fill();

    // Air meter
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(10, 10, 100, 12);
    const airColor = air > 30 ? '#4fc3f7' : '#ef5350';
    ctx.fillStyle = airColor;
    ctx.fillRect(10, 10, air, 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.strokeRect(10, 10, 100, 12);

    // Distance
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Depth: ${Math.floor(distance)}m`, 10, 38);

    // Opal status
    const opalsToday = getOpalsEarnedToday();
    if (opalsToday >= TREASURE_HUNT_CONFIG.maxOpalsPerDay) {
      ctx.fillStyle = 'rgba(255,200,100,0.6)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('All opals found today!', CANVAS_W - 10, 38);
    }
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

  function endGame(reason) {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);

    // Award distance-based bubbles
    const distBubbles = Math.floor(distance * TREASURE_HUNT_CONFIG.bubblesPerDistance);
    bubblesEarned += distBubbles;
    gameState.data.bubbles += distBubbles;
    gameState.save();

    const reasonText = {
      air: 'Out of air!',
      wall: 'Hit the wall!',
      rock: 'Crashed into a rock!',
      end: 'Reached the end!',
    };

    const opalsToday = getOpalsEarnedToday();
    const opalCapNote = opalsToday >= TREASURE_HUNT_CONFIG.maxOpalsPerDay
      ? '<p style="font-size:11px;color:#ffd54f;margin-top:4px">All opals found for today!</p>'
      : '';

    overlay.style.display = 'flex';
    overlay.querySelector('.overlay-content').innerHTML = `
      <h2>${reasonText[reason] || 'Game Over!'}</h2>
      <p>💎 ${gems} gems · ${Math.floor(distance)}m depth</p>
      <p class="reward-text">+${bubblesEarned} 💧${opalsEarned > 0 ? `  ·  +${opalsEarned} 🔮` : ''}</p>
      ${opalCapNote}
      <p style="font-size:11px;color:#8bbad0;margin-top:8px">Seed: ${seed}</p>
      <button id="treasure-start" class="start-btn">Play Again</button>
      <button id="treasure-quit" class="quit-btn">Back to Games</button>
    `;
    document.getElementById('treasure-start').addEventListener('click', startGame);
    document.getElementById('treasure-quit').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'play' }));
    });
  }

  // Controls — tap left/right side of canvas
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < CANVAS_W / 2) moveAxo(-1);
    else moveAxo(1);
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    if (x < CANVAS_W / 2) moveAxo(-1);
    else moveAxo(1);
  });

  // Keyboard (named handler so we can remove on exit)
  function handleKeydown(e) {
    if (!running) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') moveAxo(-1);
    if (e.key === 'ArrowRight' || e.key === 'd') moveAxo(1);
  }
  document.addEventListener('keydown', handleKeydown);

  function cleanup() {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    document.removeEventListener('keydown', handleKeydown);
  }

  document.getElementById('treasure-start').addEventListener('click', startGame);

  container.querySelector('.back-btn').addEventListener('click', () => {
    cleanup();
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'play' }));
  });
  container.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cleanup();
      window.dispatchEvent(new CustomEvent('navigate', { detail: btn.dataset.screen }));
    });
  });

  // Initial draw
  reset();
  draw();
}
