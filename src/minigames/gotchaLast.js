// ============================================================
// Axolittle — Gotcha Last Mini Game
// Real-time 4-player tag game vs bots. Bite-based elimination.
// When tagged by "It", you get a bite. 3 bites = out.
// If timer ends with 2+ players, whoever is NOT "It" wins.
// Reward: Bubbles only (no stat gain).
// ============================================================

import { completeMiniGame } from '../engine/actions.js';
import { gameState } from '../engine/state.js';

const CANVAS_W = 360;
const CANVAS_H = 640;

// Arena boundaries
const ARENA_TOP = 60;
const ARENA_BOTTOM = 580;
const ARENA_LEFT = 10;
const ARENA_RIGHT = 350;

// Player
const AXO_RADIUS = 18;
const BASE_SPEED = 3;
const ACCELERATION = 0.3;
const DECELERATION = 0.2;

// Dash
const DASH_DISTANCE = 60;
const DASH_DURATION = 200;
const DASH_COOLDOWN_BASE = 5000;
const DASH_INVULN_MS = 200;

// Tag / Bite
const TAG_INVULN_MS = 2500;
const TAG_SPEED_BOOST_MS = 2500;
const TAG_SPEED_BOOST_MULT = 1.9;
const MAX_BITES = 3;

// Match
const MATCH_DURATION = 120;
const HAZARD_START_TIME = 40;
const KELP_SLOW_FACTOR = 0.5;

// Joystick
const JOY_MAX_R = 50;
const JOY_DEAD = 8;
const DASH_BTN_X = 310;
const DASH_BTN_Y = 540;
const DASH_BTN_R = 30;

// Arena elements
const WALLS = [
  { x: 60,  y: 160, w: 50, h: 16 },
  { x: 250, y: 160, w: 50, h: 16 },
  { x: 145, y: 310, w: 70, h: 16 },
  { x: 60,  y: 440, w: 50, h: 16 },
  { x: 250, y: 440, w: 50, h: 16 },
];

const KELP_ZONES = [
  { cx: 80,  cy: 300, r: 35 },
  { cx: 280, cy: 300, r: 35 },
  { cx: 180, cy: 480, r: 30 },
];

export function renderGotchaLast(container) {
  container.innerHTML = `
    <div class="minigame-screen">
      <div class="minigame-header">
        <button class="back-btn">\u2190 Back</button>
        <h3>🦷 Gotcha Last</h3>
        <div class="game-score"><span id="gotcha-status">Ready</span></div>
      </div>
      <canvas id="gotcha-canvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas>
      <div id="gotcha-overlay" class="game-overlay">
        <div class="overlay-content">
          <h2>🦷 Gotcha Last</h2>
          <p>Don't get bitten!<br>Each tag = 1 bite. 3 bites = you're out!<br>Joystick to move, button to dash.<br>2 minute match — last one standing!</p>
          <button id="gotcha-start" class="start-btn">Start</button>
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

  const canvas = document.getElementById('gotcha-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('gotcha-overlay');
  const statusDisplay = document.getElementById('gotcha-status');

  let running = false;
  let animFrame = null;
  let matchStart = 0;
  let timeLeft = MATCH_DURATION;
  let hazardRadius = 0;

  // Stats
  let speedStat = 0;
  let staminaStat = 0;

  // Entities
  let player = null;
  let bot = null;
  let bot2 = null;
  let bot3 = null;

  // Input
  let joystick = { active: false, originX: 0, originY: 0, curX: 0, curY: 0, touchId: null };
  let keys = { up: false, down: false, left: false, right: false };
  let dashTouchId = null;

  // --- Entity factory ---
  function createEntity(x, y, topSpeed, dashCdMs) {
    return {
      x, y, vx: 0, vy: 0,
      topSpeed, dashCdMs,
      facingX: 0, facingY: 1,
      isIt: false, bites: 0, eliminated: false,
      dashCooldown: 0, isDashing: false, dashEndTime: 0,
      dashDirX: 0, dashDirY: 0,
      invulnUntil: 0, speedBoostUntil: 0,
      chaseLockUntil: 0,
      // Bot AI fields
      dx: 0, dy: 0, inputMag: 0,
      lockTarget: null, lockUntil: 0,
      fleeAngle: (Math.random() - 0.5) * 1.2,
      fleeAngleNext: 0,
      wallAvoidDx: 0, wallAvoidDy: 0, wallAvoidUntil: 0,
    };
  }

  // --- helpers ---
  function getAlive() {
    return [player, bot, bot2, bot3].filter(e => !e.eliminated);
  }

  // --- Reset ---
  function reset() {
    const axo = gameState.activeAxolotl;
    speedStat = axo?.growth?.speed || 0;
    staminaStat = axo?.growth?.stamina || 0;

    const pTop = BASE_SPEED * (1 + 0.05 + (speedStat / 100) * 0.07);
    const pDashCd = DASH_COOLDOWN_BASE * (1 - (staminaStat / 100) * 0.3);
    const bTop = BASE_SPEED * (1 + 0.05 + 0.40 * 0.07);
    const bDashCd = DASH_COOLDOWN_BASE * (1 - 0.40 * 0.3);

    player = createEntity(ARENA_LEFT + 40, ARENA_TOP + 40, pTop, pDashCd);
    bot = createEntity(ARENA_RIGHT - 40, ARENA_BOTTOM - 40, bTop, bDashCd);
    bot2 = createEntity(ARENA_RIGHT - 40, ARENA_TOP + 40, bTop, bDashCd);
    bot3 = createEntity(ARENA_LEFT + 40, ARENA_BOTTOM - 40, bTop, bDashCd);

    // Random starting It among all 4
    const r = Math.random();
    if (r < 0.25) player.isIt = true;
    else if (r < 0.50) bot.isIt = true;
    else if (r < 0.75) bot2.isIt = true;
    else bot3.isIt = true;

    const now = performance.now();
    matchStart = now;
    timeLeft = MATCH_DURATION;
    hazardRadius = 0;
    joystick.active = false;
    updateStatusDisplay();
  }

  function updateStatusDisplay() {
    const alive = getAlive();
    const biteIcons = (e) => '🦷'.repeat(e.bites) + '♡'.repeat(MAX_BITES - e.bites);
    statusDisplay.textContent = `You:${biteIcons(player)} | ${alive.length} left`;
  }

  // --- Input helpers ---
  function canvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (CANVAS_W / rect.width),
      y: (clientY - rect.top) * (CANVAS_H / rect.height),
    };
  }

  function getJoystickInput() {
    if (!joystick.active) return { dx: 0, dy: 0, mag: 0 };
    const jdx = joystick.curX - joystick.originX;
    const jdy = joystick.curY - joystick.originY;
    const dist = Math.sqrt(jdx * jdx + jdy * jdy);
    if (dist < JOY_DEAD) return { dx: 0, dy: 0, mag: 0 };
    const clamped = Math.min(dist, JOY_MAX_R);
    return { dx: jdx / dist, dy: jdy / dist, mag: clamped / JOY_MAX_R };
  }

  function getKeyboardInput() {
    let dx = 0, dy = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { dx: 0, dy: 0, mag: 0 };
    return { dx: dx / len, dy: dy / len, mag: 1 };
  }

  // --- Dash ---
  function tryDash(entity) {
    const now = performance.now();
    if (entity.isDashing || now < entity.dashCooldown || entity.eliminated) return;
    entity.isDashing = true;
    entity.dashEndTime = now + DASH_DURATION;
    entity.invulnUntil = Math.max(entity.invulnUntil, now + DASH_INVULN_MS);
    entity.dashCooldown = now + entity.dashCdMs;
    entity.dashDirX = entity.facingX;
    entity.dashDirY = entity.facingY;
    const len = Math.sqrt(entity.dashDirX ** 2 + entity.dashDirY ** 2);
    if (len > 0) { entity.dashDirX /= len; entity.dashDirY /= len; }
    else { entity.dashDirY = -1; }
  }

  // --- Movement ---
  function updateMovement(entity, dx, dy, mag, now) {
    if (entity.eliminated) return;

    if (entity.isDashing) {
      if (now >= entity.dashEndTime) {
        entity.isDashing = false;
      } else {
        const dashSpd = DASH_DISTANCE / (DASH_DURATION / 16.67);
        entity.vx = entity.dashDirX * dashSpd;
        entity.vy = entity.dashDirY * dashSpd;
        applyPos(entity);
        return;
      }
    }

    let targetSpeed = entity.topSpeed * mag;
    if (now < entity.speedBoostUntil) targetSpeed *= TAG_SPEED_BOOST_MULT;

    // Kelp slowdown
    for (const k of KELP_ZONES) {
      const kd = Math.sqrt((entity.x - k.cx) ** 2 + (entity.y - k.cy) ** 2);
      if (kd < k.r) { targetSpeed *= KELP_SLOW_FACTOR; break; }
    }

    const tvx = dx * targetSpeed;
    const tvy = dy * targetSpeed;
    if (mag > 0) {
      entity.vx += (tvx - entity.vx) * ACCELERATION;
      entity.vy += (tvy - entity.vy) * ACCELERATION;
      entity.facingX = dx;
      entity.facingY = dy;
    } else {
      entity.vx *= (1 - DECELERATION);
      entity.vy *= (1 - DECELERATION);
      if (Math.abs(entity.vx) < 0.1) entity.vx = 0;
      if (Math.abs(entity.vy) < 0.1) entity.vy = 0;
    }
    applyPos(entity);
  }

  function applyPos(entity) {
    let nx = entity.x + entity.vx;
    let ny = entity.y + entity.vy;

    // Wall collision
    for (const w of WALLS) {
      const ex = w.x - AXO_RADIUS;
      const ey = w.y - AXO_RADIUS;
      const ew = w.w + AXO_RADIUS * 2;
      const eh = w.h + AXO_RADIUS * 2;
      if (nx > ex && nx < ex + ew && ny > ey && ny < ey + eh) {
        const oL = nx - ex, oR = (ex + ew) - nx;
        const oT = ny - ey, oB = (ey + eh) - ny;
        const min = Math.min(oL, oR, oT, oB);
        if (min === oL) { nx = ex; entity.vx = 0; }
        else if (min === oR) { nx = ex + ew; entity.vx = 0; }
        else if (min === oT) { ny = ey; entity.vy = 0; }
        else { ny = ey + eh; entity.vy = 0; }
      }
    }

    // Arena bounds
    nx = Math.max(ARENA_LEFT + AXO_RADIUS, Math.min(ARENA_RIGHT - AXO_RADIUS, nx));
    ny = Math.max(ARENA_TOP + AXO_RADIUS, Math.min(ARENA_BOTTOM - AXO_RADIUS, ny));
    entity.x = nx;
    entity.y = ny;
  }

  // --- Tag / Bite ---
  function checkTag(now) {
    const alive = getAlive();
    const tagger = alive.find(e => e.isIt);
    if (!tagger) return;
    if (now < tagger.invulnUntil) return;

    for (const target of alive) {
      if (target === tagger) continue;
      if (target.eliminated) continue;
      if (now < target.invulnUntil) continue;
      const dx = tagger.x - target.x;
      const dy = tagger.y - target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > AXO_RADIUS * 2) continue;

      // Bite landed!
      target.bites++;
      tagger.isIt = false;
      target.isIt = true;
      target.invulnUntil = now + TAG_INVULN_MS;
      target.chaseLockUntil = now + 1000;
      target.dashCooldown = now + 5000;
      target.speedBoostUntil = 0;
      tagger.speedBoostUntil = now + TAG_SPEED_BOOST_MS;
      tagger.dashCooldown = 0;

      // Check elimination
      if (target.bites >= MAX_BITES) {
        target.eliminated = true;
        target.isIt = false;
        // Pass "It" to a random alive non-eliminated player
        const remaining = getAlive();
        if (remaining.length > 1) {
          const candidates = remaining.filter(e => e !== target);
          const newIt = candidates[Math.floor(Math.random() * candidates.length)];
          newIt.isIt = true;
          newIt.invulnUntil = now + TAG_INVULN_MS;
          newIt.chaseLockUntil = now + 1000;
        }
        // Check if game should end (1 or fewer alive)
        if (remaining.length <= 1) {
          endGame();
          return;
        }
      }

      updateStatusDisplay();
      break; // Only one tag per frame
    }
  }

  // --- Hazard ---
  function updateHazard() {
    if (timeLeft > HAZARD_START_TIME) { hazardRadius = 0; return; }
    hazardRadius = 120 * ((HAZARD_START_TIME - timeLeft) / HAZARD_START_TIME);
    for (const e of getAlive()) pushFromHazard(e);
  }

  function pushFromHazard(e) {
    const cx = 180, cy = 320;
    const dx = e.x - cx, dy = e.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < hazardRadius && dist > 0) {
      e.vx += (dx / dist) * 1.5;
      e.vy += (dy / dist) * 1.5;
    }
  }

  // --- Bot helpers ---
  function getBotSeparation(b) {
    const allBots = [bot, bot2, bot3].filter(e => !e.eliminated);
    let sepX = 0, sepY = 0;
    for (const ob of allBots) {
      if (ob === b) continue;
      const sd = Math.sqrt((b.x - ob.x) ** 2 + (b.y - ob.y) ** 2);
      if (sd < 70 && sd > 0) {
        const force = (70 - sd) / 70;
        sepX += ((b.x - ob.x) / sd) * force * 0.6;
        sepY += ((b.y - ob.y) / sd) * force * 0.6;
      }
    }
    return { sepX, sepY };
  }

  function getHazardAvoidance(b) {
    if (hazardRadius <= 0) return { hx: 0, hy: 0 };
    const hcx = 180, hcy = 320;
    const hdx = b.x - hcx, hdy = b.y - hcy;
    const hDist = Math.sqrt(hdx * hdx + hdy * hdy);
    const avoidRadius = hazardRadius + 40;
    if (hDist < avoidRadius && hDist > 0) {
      const urgency = (avoidRadius - hDist) / avoidRadius;
      const strength = urgency * 2.0;
      return { hx: (hdx / hDist) * strength, hy: (hdy / hDist) * strength };
    }
    return { hx: 0, hy: 0 };
  }

  function applyWallAvoidance(b, dx, dy, target, now) {
    if (now < b.wallAvoidUntil) {
      return { dx: b.wallAvoidDx, dy: b.wallAvoidDy };
    }

    const pad = AXO_RADIUS + 4;
    const fX = b.x + dx * 45;
    const fY = b.y + dy * 45;

    for (const w of WALLS) {
      const ex = w.x - pad, ey = w.y - pad;
      const ew = w.w + pad * 2, eh = w.h + pad * 2;

      if (fX > ex && fX < ex + ew && fY > ey && fY < ey + eh) {
        const corners = [
          { x: ex - 2, y: ey - 2 },
          { x: ex + ew + 2, y: ey - 2 },
          { x: ex - 2, y: ey + eh + 2 },
          { x: ex + ew + 2, y: ey + eh + 2 },
        ];

        let bestCorner = null;
        let bestScore = Infinity;

        for (const c of corners) {
          const botToC = Math.sqrt((b.x - c.x) ** 2 + (b.y - c.y) ** 2);
          let score;
          if (target) {
            const cToT = Math.sqrt((c.x - target.x) ** 2 + (c.y - target.y) ** 2);
            score = botToC * 0.4 + cToT;
          } else {
            const cFromCenter = Math.sqrt((c.x - 180) ** 2 + (c.y - 320) ** 2);
            score = botToC * 0.4 - cFromCenter;
          }
          if (score < bestScore) { bestScore = score; bestCorner = c; }
        }

        if (bestCorner) {
          const cdx = bestCorner.x - b.x;
          const cdy = bestCorner.y - b.y;
          const clen = Math.sqrt(cdx * cdx + cdy * cdy);
          if (clen > 0) {
            const avDx = cdx / clen;
            const avDy = cdy / clen;
            b.wallAvoidDx = avDx;
            b.wallAvoidDy = avDy;
            b.wallAvoidUntil = now + 350;
            return { dx: avDx, dy: avDy };
          }
        }

        return { dx: -dy, dy: dx };
      }
    }
    return { dx, dy };
  }

  function norm(dx, dy) {
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) return { dx: dx / len, dy: dy / len };
    return { dx: 0, dy: 0 };
  }

  // --- Bot AI ---
  function updateBotAI(b, now) {
    if (b.eliminated) { b.dx = 0; b.dy = 0; b.inputMag = 0; return; }

    const alive = getAlive();

    if (b.isIt) {
      // ===== CHASE MODE =====
      if (now < b.chaseLockUntil) {
        b.dx = 0; b.dy = 0; b.inputMag = 0;
        return;
      }

      // Target selection: prioritize player with LEAST bites (they are "winning")
      const others = alive.filter(e => e !== b);
      const needNewTarget = !b.lockTarget || now > b.lockUntil
        || !others.includes(b.lockTarget) || b.lockTarget.eliminated;

      if (needNewTarget) {
        const minBites = Math.min(...others.map(e => e.bites));
        let bestTarget = null;
        let bestPriority = -Infinity;

        for (const e of others) {
          const d = Math.sqrt((b.x - e.x) ** 2 + (b.y - e.y) ** 2);
          const distPriority = 300 / (d + 30);
          // Strongly prefer targets with fewer bites (they're "winning")
          const winnerBonus = (e.bites <= minBites) ? 2.5 : 0;
          const priority = distPriority + winnerBonus;
          if (priority > bestPriority) { bestPriority = priority; bestTarget = e; }
        }

        b.lockTarget = bestTarget;
        b.lockUntil = now + 2000 + Math.random() * 2000;
      }

      const chaseTarget = b.lockTarget;
      if (!chaseTarget) { b.dx = 0; b.dy = 0; b.inputMag = 0; return; }

      const chaseDist = Math.sqrt((b.x - chaseTarget.x) ** 2 + (b.y - chaseTarget.y) ** 2);

      let n = norm(chaseTarget.x - b.x, chaseTarget.y - b.y);
      let dx = n.dx, dy = n.dy;

      const wa = applyWallAvoidance(b, dx, dy, chaseTarget, now);
      dx = wa.dx; dy = wa.dy;

      const { hx, hy } = getHazardAvoidance(b);
      dx += hx; dy += hy;

      const { sepX, sepY } = getBotSeparation(b);
      dx += sepX * 0.3; dy += sepY * 0.3;
      n = norm(dx, dy); dx = n.dx; dy = n.dy;

      b.dx = dx; b.dy = dy; b.inputMag = 1;

      if (chaseDist < 80 && now >= b.dashCooldown && Math.random() < 0.015) {
        tryDash(b);
      }

    } else {
      // ===== FLEE MODE =====
      const itEntity = alive.find(e => e.isIt);
      if (!itEntity) { b.dx = 0; b.dy = 0; b.inputMag = 0; return; }

      const distToIt = Math.sqrt((b.x - itEntity.x) ** 2 + (b.y - itEntity.y) ** 2);

      if (now > b.fleeAngleNext) {
        b.fleeAngle = (Math.random() - 0.5) * 1.4;
        b.fleeAngleNext = now + 1500 + Math.random() * 2000;
      }

      let awayX = (b.x - itEntity.x) / Math.max(distToIt, 1);
      let awayY = (b.y - itEntity.y) / Math.max(distToIt, 1);

      const cosA = Math.cos(b.fleeAngle), sinA = Math.sin(b.fleeAngle);
      const rotX = awayX * cosA - awayY * sinA;
      const rotY = awayX * sinA + awayY * cosA;
      awayX = rotX; awayY = rotY;

      const centerX = (ARENA_LEFT + ARENA_RIGHT) / 2;
      const centerY = (ARENA_TOP + ARENA_BOTTOM) / 2;
      const tcX = centerX - b.x, tcY = centerY - b.y;
      const tcLen = Math.sqrt(tcX * tcX + tcY * tcY);
      const tcNx = tcLen > 0 ? tcX / tcLen : 0;
      const tcNy = tcLen > 0 ? tcY / tcLen : 0;

      const edgeFactor = Math.max(
        Math.max(0, 1 - (b.x - ARENA_LEFT) / 70),
        Math.max(0, 1 - (ARENA_RIGHT - b.x) / 70),
        Math.max(0, 1 - (b.y - ARENA_TOP) / 70),
        Math.max(0, 1 - (ARENA_BOTTOM - b.y) / 70),
      );
      const centerWeight = edgeFactor * 0.7;

      let dx = awayX * (1 - centerWeight) + tcNx * centerWeight;
      let dy = awayY * (1 - centerWeight) + tcNy * centerWeight;

      const { hx, hy } = getHazardAvoidance(b);
      dx += hx; dy += hy;

      const { sepX, sepY } = getBotSeparation(b);
      dx += sepX; dy += sepY;

      let n = norm(dx, dy); dx = n.dx; dy = n.dy;

      const wa = applyWallAvoidance(b, dx, dy, null, now);
      dx = wa.dx; dy = wa.dy;

      b.dx = dx; b.dy = dy; b.inputMag = 0.85 + Math.random() * 0.15;

      if (distToIt < 60 && now >= b.dashCooldown && Math.random() < 0.025) {
        tryDash(b);
      }
    }
  }

  // --- Update ---
  function update() {
    const now = performance.now();
    timeLeft = Math.max(0, MATCH_DURATION - (now - matchStart) / 1000);
    if (timeLeft <= 0) { endGame(); return; }

    // Check if only 1 alive
    const alive = getAlive();
    if (alive.length <= 1) { endGame(); return; }

    // Player input (if alive)
    if (!player.eliminated) {
      const jIn = getJoystickInput();
      const kIn = getKeyboardInput();
      const input = jIn.mag > 0 ? jIn : kIn;
      updateMovement(player, input.dx, input.dy, input.mag, now);
    }

    if (!bot.eliminated) {
      updateBotAI(bot, now);
      updateMovement(bot, bot.dx, bot.dy, bot.inputMag, now);
    }
    if (!bot2.eliminated) {
      updateBotAI(bot2, now);
      updateMovement(bot2, bot2.dx, bot2.dy, bot2.inputMag, now);
    }
    if (!bot3.eliminated) {
      updateBotAI(bot3, now);
      updateMovement(bot3, bot3.dx, bot3.dy, bot3.inputMag, now);
    }

    checkTag(now);
    updateHazard();
  }

  // --- Draw ---
  function draw() {
    const now = performance.now();

    // Background
    ctx.fillStyle = '#0d1f2d';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Arena floor
    ctx.fillStyle = '#132d3f';
    ctx.fillRect(ARENA_LEFT, ARENA_TOP, ARENA_RIGHT - ARENA_LEFT, ARENA_BOTTOM - ARENA_TOP);

    // Arena border
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ARENA_LEFT, ARENA_TOP, ARENA_RIGHT - ARENA_LEFT, ARENA_BOTTOM - ARENA_TOP);

    // Kelp zones
    for (const k of KELP_ZONES) {
      const grad = ctx.createRadialGradient(k.cx, k.cy, 0, k.cx, k.cy, k.r);
      grad.addColorStop(0, 'rgba(76, 175, 80, 0.15)');
      grad.addColorStop(1, 'rgba(76, 175, 80, 0.02)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(k.cx, k.cy, k.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(76, 175, 80, 0.3)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const sx = k.cx - k.r * 0.6 + i * k.r * 0.3;
        ctx.beginPath();
        ctx.moveTo(sx, k.cy + k.r * 0.5);
        ctx.quadraticCurveTo(
          sx + Math.sin(now * 0.002 + i) * 5, k.cy,
          sx + Math.sin(now * 0.003 + i) * 3, k.cy - k.r * 0.5
        );
        ctx.stroke();
      }
    }

    // Hazard zone
    if (hazardRadius > 0) {
      const hg = ctx.createRadialGradient(180, 320, 0, 180, 320, hazardRadius);
      hg.addColorStop(0, 'rgba(239, 83, 80, 0.25)');
      hg.addColorStop(0.7, 'rgba(239, 83, 80, 0.10)');
      hg.addColorStop(1, 'rgba(239, 83, 80, 0.02)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(180, 320, hazardRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(239, 83, 80, ${0.3 + Math.sin(now * 0.005) * 0.15})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Coral walls
    for (const w of WALLS) {
      ctx.fillStyle = '#6b4a38';
      ctx.beginPath();
      ctx.roundRect(w.x, w.y, w.w, w.h, 4);
      ctx.fill();
      ctx.fillStyle = '#7d5a48';
      ctx.beginPath();
      ctx.roundRect(w.x + 2, w.y + 2, w.w - 4, w.h - 4, 3);
      ctx.fill();
    }

    // Axolotls (alive ones only, eliminated ones as ghosts)
    drawAxo(player, '#E8A0BF', '#D48BA8', now);
    drawAxo(bot, '#A0D2DB', '#80B8C8', now);
    drawAxo(bot2, '#A8D8A0', '#88B880', now);
    drawAxo(bot3, '#C8A0D8', '#B088C0', now);

    // HUD
    drawHUD(now);

    // Joystick
    if (joystick.active && !player.eliminated) drawJoystick();

    // Dash button
    if (!player.eliminated) drawDashBtn(now);
  }

  function drawAxo(e, bodyCol, gillCol, now) {
    // Eliminated — draw as faded ghost
    if (e.eliminated) {
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(e.x, e.y, AXO_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#555';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OUT', e.x, e.y + 4);
      ctx.globalAlpha = 1;
      return;
    }

    // Invuln blink
    if (now < e.invulnUntil && Math.floor(now / 80) % 2 === 0) return;

    // Glow
    if (e.isIt) {
      const g = ctx.createRadialGradient(e.x, e.y, AXO_RADIUS, e.x, e.y, AXO_RADIUS + 15);
      g.addColorStop(0, 'rgba(255, 100, 50, 0.4)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, AXO_RADIUS + 15, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const g = ctx.createRadialGradient(e.x, e.y, AXO_RADIUS, e.x, e.y, AXO_RADIUS + 10);
      g.addColorStop(0, 'rgba(100, 200, 150, 0.3)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, AXO_RADIUS + 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dash trail
    if (e.isDashing) {
      ctx.fillStyle = e.isIt ? 'rgba(255, 150, 100, 0.3)' : 'rgba(100, 200, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(e.x - e.vx * 2, e.y - e.vy * 2, AXO_RADIUS * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body
    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.arc(e.x, e.y, AXO_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Bite marks on body
    if (e.bites > 0) {
      ctx.fillStyle = '#0d1f2d';
      for (let i = 0; i < e.bites; i++) {
        const angle = (i * 2.1) - 0.5;
        const bx = e.x + Math.cos(angle) * (AXO_RADIUS - 3);
        const by = e.y + Math.sin(angle) * (AXO_RADIUS - 3);
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Eyes
    const ex = e.facingX * 3;
    const ey = e.facingY * 3;
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(e.x + ex - 4, e.y + ey - 4, 2.5, 0, Math.PI * 2);
    ctx.arc(e.x + ex + 4, e.y + ey - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Gills
    ctx.strokeStyle = gillCol;
    ctx.lineWidth = 1.5;
    const bx = -e.facingX;
    for (const off of [-6, -3, 3, 6]) {
      ctx.beginPath();
      ctx.moveTo(e.x + bx * (AXO_RADIUS - 2), e.y + off);
      ctx.lineTo(e.x + bx * (AXO_RADIUS + 6), e.y + off + (off > 0 ? 2 : -2));
      ctx.stroke();
    }

    // IT label
    if (e.isIt) {
      ctx.fillStyle = '#ef5350';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('IT', e.x, e.y - AXO_RADIUS - 8);
    }

    // Bite counter below
    if (e.bites > 0) {
      ctx.fillStyle = '#ef5350';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🦷'.repeat(e.bites), e.x, e.y + AXO_RADIUS + 14);
    }
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, CANVAS_W, ARENA_TOP);

    // Timer
    ctx.fillStyle = timeLeft < 30 ? '#ef5350' : 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    const mins = Math.floor(timeLeft / 60);
    const secs = Math.ceil(timeLeft % 60);
    ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, CANVAS_W / 2, 20);

    // Bite status row
    ctx.font = 'bold 11px sans-serif';
    const scoreY = 46;
    const gap = CANVAS_W / 4;
    ctx.textAlign = 'center';

    const entities = [
      { e: player, col: '#E8A0BF', label: 'You' },
      { e: bot, col: '#A0D2DB', label: 'B1' },
      { e: bot2, col: '#A8D8A0', label: 'B2' },
      { e: bot3, col: '#C8A0D8', label: 'B3' },
    ];

    entities.forEach(({ e, col, label }, i) => {
      ctx.fillStyle = e.eliminated ? '#555' : col;
      const hearts = e.eliminated ? 'OUT' : '♡'.repeat(MAX_BITES - e.bites);
      ctx.fillText(`${label}:${hearts}`, gap * (i + 0.5), scoreY);
    });
  }

  function drawJoystick() {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joystick.originX, joystick.originY, JOY_MAX_R, 0, Math.PI * 2);
    ctx.stroke();

    let jdx = joystick.curX - joystick.originX;
    let jdy = joystick.curY - joystick.originY;
    const dist = Math.sqrt(jdx * jdx + jdy * jdy);
    if (dist > JOY_MAX_R) { jdx = (jdx / dist) * JOY_MAX_R; jdy = (jdy / dist) * JOY_MAX_R; }

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(joystick.originX + jdx, joystick.originY + jdy, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDashBtn(now) {
    const ready = now >= player.dashCooldown;
    const pct = ready ? 1 : 1 - Math.max(0, (player.dashCooldown - now) / player.dashCdMs);

    ctx.fillStyle = ready ? 'rgba(79, 195, 247, 0.3)' : 'rgba(100, 100, 100, 0.2)';
    ctx.beginPath();
    ctx.arc(DASH_BTN_X, DASH_BTN_Y, DASH_BTN_R, 0, Math.PI * 2);
    ctx.fill();

    if (!ready) {
      ctx.strokeStyle = 'rgba(79, 195, 247, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(DASH_BTN_X, DASH_BTN_Y, DASH_BTN_R, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(79, 195, 247, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(DASH_BTN_X, DASH_BTN_Y, DASH_BTN_R, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = ready ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DASH', DASH_BTN_X, DASH_BTN_Y);
    ctx.textBaseline = 'alphabetic';
  }

  // --- Game loop ---
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

    const alive = getAlive();
    const playerAlive = !player.eliminated;

    // Determine winner
    let resultText = '';
    let emoji = '😅';
    let tier = 'normal';

    if (alive.length === 1) {
      // Last one standing
      if (alive[0] === player) {
        resultText = 'Last one standing!';
        emoji = '🏆';
        tier = 'exceptional';
      } else {
        resultText = 'You were eliminated!';
        emoji = '😅';
      }
    } else if (alive.length >= 2 && timeLeft <= 0) {
      // Timer ran out — whoever is NOT "it" among alive wins
      const itEntity = alive.find(e => e.isIt);
      if (itEntity === player) {
        resultText = "Time's up — you were It!";
        emoji = '😅';
      } else if (playerAlive) {
        resultText = "Time's up — you survived!";
        emoji = '🏆';
        tier = player.bites === 0 ? 'exceptional' : 'good';
      } else {
        resultText = 'You were eliminated!';
        emoji = '😅';
      }
    } else {
      resultText = 'Game over!';
    }

    const result = completeMiniGame(null, tier);

    const biteReport = [
      `You: ${'🦷'.repeat(player.bites)}${player.eliminated ? ' (OUT)' : ''}`,
      `B1: ${'🦷'.repeat(bot.bites)}${bot.eliminated ? ' (OUT)' : ''}`,
      `B2: ${'🦷'.repeat(bot2.bites)}${bot2.eliminated ? ' (OUT)' : ''}`,
      `B3: ${'🦷'.repeat(bot3.bites)}${bot3.eliminated ? ' (OUT)' : ''}`,
    ].join(' · ');

    overlay.style.display = 'flex';
    overlay.querySelector('.overlay-content').innerHTML = `
      <h2>${emoji} ${resultText}</h2>
      <p style="font-size:12px">${biteReport}</p>
      <p>Tier: ${tier.toUpperCase()}</p>
      <p class="reward-text">+${result?.bubbles || 0} 💧</p>
      <button id="gotcha-start" class="start-btn">Play Again</button>
      <button id="gotcha-quit" class="quit-btn">Back to Games</button>
    `;
    document.getElementById('gotcha-start').addEventListener('click', startGame);
    document.getElementById('gotcha-quit').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'play' }));
    });
  }

  // --- Touch events ---
  function handleTouchStart(e) {
    e.preventDefault();
    if (!running || player.eliminated) return;
    for (const t of e.changedTouches) {
      const c = canvasCoords(t.clientX, t.clientY);
      const dd = Math.sqrt((c.x - DASH_BTN_X) ** 2 + (c.y - DASH_BTN_Y) ** 2);
      if (dd < DASH_BTN_R + 15) {
        dashTouchId = t.identifier;
        tryDash(player);
        continue;
      }
      if (c.x < CANVAS_W / 2 && !joystick.active) {
        joystick.active = true;
        joystick.touchId = t.identifier;
        joystick.originX = c.x;
        joystick.originY = c.y;
        joystick.curX = c.x;
        joystick.curY = c.y;
      }
    }
  }

  function handleTouchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joystick.touchId) {
        const c = canvasCoords(t.clientX, t.clientY);
        joystick.curX = c.x;
        joystick.curY = c.y;
      }
    }
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joystick.touchId) {
        joystick.active = false;
        joystick.touchId = null;
      }
      if (t.identifier === dashTouchId) {
        dashTouchId = null;
      }
    }
  }

  // --- Keyboard events ---
  function handleKeydown(e) {
    if (!running || player.eliminated) return;
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = true;
    if (e.key === 'ArrowDown' || e.key === 's') keys.down = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === ' ') { e.preventDefault(); tryDash(player); }
  }

  function handleKeyup(e) {
    if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
    if (e.key === 'ArrowDown' || e.key === 's') keys.down = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
  }

  // --- Register events ---
  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', handleTouchEnd);
  canvas.addEventListener('touchcancel', handleTouchEnd);

  canvas.addEventListener('click', (e) => {
    if (!running || player.eliminated) return;
    const c = canvasCoords(e.clientX, e.clientY);
    const dd = Math.sqrt((c.x - DASH_BTN_X) ** 2 + (c.y - DASH_BTN_Y) ** 2);
    if (dd < DASH_BTN_R + 10) tryDash(player);
  });

  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('keyup', handleKeyup);

  function cleanup() {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('keyup', handleKeyup);
  }

  // Start button
  document.getElementById('gotcha-start').addEventListener('click', startGame);

  // Navigation
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
