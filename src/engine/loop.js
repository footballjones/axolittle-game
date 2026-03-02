// ============================================================
// Axolittle — Game Loop & Decay Engine
// Processes real-time decay, offline catch-up, mood updates
// New poop system: ~1/day natural + feed-triggered
// Ghost shrimp: reduce hunger decay and poop spawning
// ============================================================

import { gameState } from './state.js';
import {
  DECAY_RATES,
  WATER_QUALITY_MULTIPLIER,
  FILTERS,
  NEGLECT_THRESHOLDS,
  MOOD_THRESHOLDS,
  GROWTH_CAPS,
  TIME_SCALE,
  POOP_CONFIG,
  GHOST_SHRIMP_CONFIG,
} from '../data/config.js';

const TICK_INTERVAL_MS = 1000; // tick every second
let tickTimer = null;

// --- Helpers ---

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getWaterQualityMultiplier(wq) {
  const t = wq / 100; // 0 = worst, 1 = best
  return lerp(WATER_QUALITY_MULTIPLIER.worst, WATER_QUALITY_MULTIPLIER.best, t);
}

function getFilterReduction(aquarium) {
  const filter = FILTERS[aquarium.filterTier];
  return filter ? filter.decayReduction : 0;
}

// Per-batch duration: 24hrs per 10 shrimp (10→24h, 20→48h, 30→72h)
function getBatchDurationMs(batch) {
  return (batch.count / 10) * GHOST_SHRIMP_CONFIG.durationHoursPer10 * 60 * 60 * 1000;
}

// Count active ghost shrimp in an aquarium (linearly decay over lifespan)
function getActiveShrimpCount(aquarium) {
  if (!aquarium.ghostShrimp || !aquarium.ghostShrimp.batches) return 0;
  const now = Date.now();
  let total = 0;
  for (const batch of aquarium.ghostShrimp.batches) {
    const durationMs = getBatchDurationMs(batch);
    const elapsed = now - batch.addedAt;
    if (elapsed < durationMs) {
      // Shrimp gradually get eaten over the lifespan
      const remaining = Math.max(0, Math.round(batch.count * (1 - elapsed / durationMs)));
      total += remaining;
    }
  }
  return total;
}

// Clean up expired shrimp batches
function cleanExpiredShrimp(aquarium) {
  if (!aquarium.ghostShrimp || !aquarium.ghostShrimp.batches) return;
  const now = Date.now();
  aquarium.ghostShrimp.batches = aquarium.ghostShrimp.batches.filter(b => now - b.addedAt < getBatchDurationMs(b));
}

// Get shrimp reduction factor (0-1, where 0 = no reduction, approaching 1 = max reduction)
// Each batch of 10 gives its percentage reduction, stacking up to max 30 shrimp
function getShrimpHungerReduction(aquarium) {
  const count = getActiveShrimpCount(aquarium);
  if (count <= 0) return 0;
  const batches = Math.ceil(count / 10);
  return 1 - Math.pow(1 - GHOST_SHRIMP_CONFIG.hungerDecayReduction, batches);
}

function getShrimpHappinessReduction(aquarium) {
  const count = getActiveShrimpCount(aquarium);
  if (count <= 0) return 0;
  const batches = Math.ceil(count / 10);
  return 1 - Math.pow(1 - GHOST_SHRIMP_CONFIG.happinessDecayReduction, batches);
}

function getShrimpPoopReduction(aquarium) {
  const count = getActiveShrimpCount(aquarium);
  if (count <= 0) return 0;
  const batches = Math.ceil(count / 10);
  return 1 - Math.pow(1 - GHOST_SHRIMP_CONFIG.poopSpawnReduction, batches);
}

// --- Core decay calculation ---

function applyDecay(axolotl, aquarium, elapsedHours) {
  const stage = axolotl.lifeStage;
  const rates = DECAY_RATES[stage];
  if (!rates) return;

  const wb = axolotl.wellbeing;
  const wqMult = getWaterQualityMultiplier(wb.waterQuality);
  const filterRed = getFilterReduction(aquarium);

  // Clean expired shrimp
  cleanExpiredShrimp(aquarium);
  const shrimpHungerRed = getShrimpHungerReduction(aquarium);
  const shrimpHappinessRed = getShrimpHappinessReduction(aquarium);

  // Water quality decays independently (only affected by filter)
  const wqDecay = rates.waterQuality * (1 - filterRed) * elapsedHours;
  wb.waterQuality = Math.max(0, Math.min(100, wb.waterQuality - wqDecay));

  // Hunger decay (reduced by ghost shrimp)
  const hungerDecay = rates.hunger * wqMult * (1 - shrimpHungerRed) * elapsedHours;
  wb.hunger = Math.max(0, Math.min(100, wb.hunger - hungerDecay));

  // Happiness decay (reduced by ghost shrimp — they're fun to watch)
  const happinessDecay = rates.happiness * wqMult * (1 - shrimpHappinessRed) * elapsedHours;
  wb.happiness = Math.max(0, Math.min(100, wb.happiness - happinessDecay));

  // --- Poop system ---
  if (!aquarium.poops) aquarium.poops = [];

  // Poop slots — fixed positions so they never overlap
  const POOP_SLOTS = [
    { x: 15, y: 75 }, { x: 40, y: 78 }, { x: 65, y: 74 }, { x: 85, y: 80 },
    { x: 25, y: 85 }, { x: 55, y: 88 }, { x: 78, y: 86 }, { x: 10, y: 90 },
  ];

  function nextPoopPos() {
    const usedSlots = new Set(aquarium.poops.map(p => `${p.x},${p.y}`));
    for (const slot of POOP_SLOTS) {
      if (!usedSlots.has(`${slot.x},${slot.y}`)) return { ...slot, spawnedAt: Date.now() };
    }
    return { x: 20 + Math.random() * 60, y: 74 + Math.random() * 18, spawnedAt: Date.now() };
  }

  // Natural poop spawning: ~1 per 18 hours
  if (aquarium.lastNaturalPoopTime == null) {
    aquarium.lastNaturalPoopTime = Date.now();
  }

  const shrimpPoopRed = getShrimpPoopReduction(aquarium);
  const effectivePoopHours = POOP_CONFIG.naturalSpawnHours / (1 - shrimpPoopRed || 1);

  // Probability-based natural poop (per tick)
  const poopChance = elapsedHours / effectivePoopHours;
  if (Math.random() < poopChance) {
    aquarium.poops.push(nextPoopPos());
    console.log('[Loop] Natural poop spawned');
  }

  // Ghost shrimp clean existing poops over time
  // Rate: ~1 poop cleaned per day per 10 active shrimp
  if (aquarium.poops.length > 0 && getActiveShrimpCount(aquarium) > 0) {
    const shrimpCount = getActiveShrimpCount(aquarium);
    const cleansPerHour = shrimpCount / 10 / 24; // 1/day per 10 shrimp → per hour
    const shrimpCleanChance = cleansPerHour * elapsedHours;
    if (Math.random() < shrimpCleanChance && aquarium.poops.length > 0) {
      aquarium.poops.pop();
      console.log('[Loop] Ghost shrimp cleaned a poop');
    }
  }

  // Check feed-triggered poops (3 feeds → poop in 15 min)
  if (aquarium.scheduledPoops && aquarium.scheduledPoops.length > 0) {
    const now = Date.now();
    const stillPending = [];
    for (const scheduled of aquarium.scheduledPoops) {
      if (now >= scheduled.time) {
        aquarium.poops.push(nextPoopPos());
        console.log('[Loop] Feed-triggered poop spawned');
      } else {
        stillPending.push(scheduled);
      }
    }
    aquarium.scheduledPoops = stillPending;
  }

  // --- Poop dissolves after 60 hours, polluting water quality ---
  const dissolveMs = POOP_CONFIG.dissolveHours * 60 * 60 * 1000;
  const now2 = Date.now();
  const dissolved = [];
  aquarium.poops = aquarium.poops.filter(p => {
    // Backfill spawnedAt for old saves that lack it
    if (!p.spawnedAt) p.spawnedAt = now2;
    if (now2 - p.spawnedAt >= dissolveMs) {
      dissolved.push(p);
      return false; // remove dissolved poop
    }
    return true;
  });
  if (dissolved.length > 0) {
    const wqHit = POOP_CONFIG.dissolveWaterQualityHit * dissolved.length;
    wb.waterQuality = Math.max(0, wb.waterQuality - wqHit);
    console.log(`[Loop] ${dissolved.length} poop(s) dissolved — water quality -${wqHit}`);
  }

  // --- Cleanliness is driven by poop ---
  // Only decays when there IS poop in the tank; no poop = full cleanliness
  if (aquarium.poops.length > 0) {
    const cleanDecay = rates.cleanliness * wqMult * elapsedHours;
    wb.cleanliness = Math.max(0, Math.min(100, wb.cleanliness - cleanDecay));
  } else {
    wb.cleanliness = 100;
  }
}

// --- Mood derivation ---

function deriveMood(axolotl) {
  const wb = axolotl.wellbeing;
  const avg = (wb.hunger + wb.happiness + wb.cleanliness + wb.waterQuality) / 4;

  if (avg <= MOOD_THRESHOLDS.sick) return 'sick';
  if (wb.hunger <= MOOD_THRESHOLDS.hungry) return 'hungry';
  if (avg <= MOOD_THRESHOLDS.sad) return 'sad';
  if (avg <= MOOD_THRESHOLDS.tired) return 'tired';
  if (wb.happiness >= MOOD_THRESHOLDS.playful && avg >= MOOD_THRESHOLDS.playful) return 'playful';
  if (avg >= MOOD_THRESHOLDS.happy) return 'happy';
  return 'tired';
}

// --- Neglect stage ---

function deriveNeglectStage(axolotl) {
  const wb = axolotl.wellbeing;
  const avg = (wb.hunger + wb.happiness + wb.cleanliness + wb.waterQuality) / 4;

  if (avg <= NEGLECT_THRESHOLDS.death) return 4;
  if (avg <= NEGLECT_THRESHOLDS.critical) return 3;
  if (avg <= NEGLECT_THRESHOLDS.struggling) return 2;
  if (avg <= NEGLECT_THRESHOLDS.neglected) return 1;
  return 0;
}

// --- Main tick ---

function tick() {
  const now = Date.now();
  const state = gameState.data;
  const elapsedMs = (now - state.lastTickAt) * TIME_SCALE;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  // Process each axolotl
  for (let i = 0; i < state.axolotls.length; i++) {
    const axolotl = state.axolotls[i];
    const aquarium = state.aquariums[i];
    if (!axolotl || !aquarium) continue;

    applyDecay(axolotl, aquarium, elapsedHours);
    axolotl.mood = deriveMood(axolotl);
    axolotl.neglectStage = deriveNeglectStage(axolotl);
  }

  state.lastTickAt = now;

  // Auto-save every 30 ticks (~30 seconds)
  if (now % 30000 < TICK_INTERVAL_MS) {
    gameState.save();
  }

  gameState.notify();
}

// --- Start / stop ---

export function startGameLoop() {
  if (tickTimer) return;
  // On start, process any offline time first
  const now = Date.now();
  const state = gameState.data;
  const offlineMs = now - state.lastTickAt;
  if (offlineMs > 5000) {
    console.log(`[Loop] Processing ${(offlineMs / 1000 / 60).toFixed(1)} minutes of offline time`);
    const offlineHours = (offlineMs * TIME_SCALE) / (1000 * 60 * 60);
    for (let i = 0; i < state.axolotls.length; i++) {
      applyDecay(state.axolotls[i], state.aquariums[i], offlineHours);
      state.axolotls[i].mood = deriveMood(state.axolotls[i]);
      state.axolotls[i].neglectStage = deriveNeglectStage(state.axolotls[i]);
    }
    state.lastTickAt = now;
    gameState.save();
    gameState.notify();
  }

  tickTimer = setInterval(tick, TICK_INTERVAL_MS);
  console.log('[Loop] Game loop started');
}

export function stopGameLoop() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
    gameState.save();
    console.log('[Loop] Game loop stopped');
  }
}
