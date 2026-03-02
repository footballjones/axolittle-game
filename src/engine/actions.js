// ============================================================
// Axolittle — Player Actions (Care, Items, Growth)
// Feed-triggered poop system, clean is now tool-mode only
// ============================================================

import { gameState } from './state.js';
import {
  CARE_ACTIONS,
  TREATMENTS,
  FILTERS,
  MINI_GAME_REWARDS,
  XP_CONFIG,
  GROWTH_CAPS,
  LIFE_STAGES,
  POOP_CONFIG,
} from '../data/config.js';

// --- Care actions ---

export function performCare(actionKey) {
  const action = CARE_ACTIONS[actionKey];
  if (!action) return { success: false, reason: 'Unknown action' };

  // Clean is now tool-mode only — handled by UI, no direct stat change
  if (action.toolMode) {
    return { success: true, toolMode: true };
  }

  const state = gameState.data;
  if (action.bubbleCost > 0 && state.bubbles < action.bubbleCost) {
    return { success: false, reason: 'Not enough Bubbles' };
  }

  const axo = gameState.activeAxolotl;
  if (action.amount > 0) {
    if (action.restores === 'all') {
      for (const key of Object.keys(axo.wellbeing)) {
        axo.wellbeing[key] = Math.min(100, axo.wellbeing[key] + action.amount);
      }
    } else {
      axo.wellbeing[action.restores] = Math.min(100, axo.wellbeing[action.restores] + action.amount);
    }
  }

  state.bubbles -= action.bubbleCost || 0;
  state.totalCareActions++;

  // --- Feed-triggered poop: track feed count ---
  if (actionKey === 'feed') {
    const aquarium = gameState.activeAquarium;
    if (!aquarium.feedCount) aquarium.feedCount = 0;
    if (!aquarium.lastFeedTime) aquarium.lastFeedTime = 0;

    // Reset feed count if more than 1 hour since last feed
    const now = Date.now();
    if (now - aquarium.lastFeedTime > 60 * 60 * 1000) {
      aquarium.feedCount = 0;
    }

    aquarium.feedCount++;
    aquarium.lastFeedTime = now;

    // After POOP_CONFIG.feedsToTrigger feeds, schedule a poop
    if (aquarium.feedCount >= POOP_CONFIG.feedsToTrigger) {
      if (!aquarium.scheduledPoops) aquarium.scheduledPoops = [];
      const poopTime = now + POOP_CONFIG.feedPoopDelayMinutes * 60 * 1000;
      aquarium.scheduledPoops.push({ time: poopTime });
      aquarium.feedCount = 0; // Reset counter
      console.log(`[Actions] Poop scheduled in ${POOP_CONFIG.feedPoopDelayMinutes} minutes`);
    }
  }

  // Care gives small XP in adult stage
  if (axo.lifeStage === LIFE_STAGES.ADULT) {
    axo.xp = Math.min(XP_CONFIG.maxXP, axo.xp + XP_CONFIG.careTaskXP);
  }

  gameState.notify();
  gameState.save();
  return { success: true };
}

// --- Treatment items ---

export function useTreatment(itemKey) {
  const item = TREATMENTS[itemKey];
  if (!item) return { success: false, reason: 'Unknown item' };

  const state = gameState.data;
  if (item.opalCost && state.opals < item.opalCost) {
    return { success: false, reason: 'Not enough Opals' };
  }
  if (item.bubbleCost && state.bubbles < item.bubbleCost) {
    return { success: false, reason: 'Not enough Bubbles' };
  }

  const axo = gameState.activeAxolotl;
  if (item.restores === 'all') {
    for (const key of Object.keys(axo.wellbeing)) {
      axo.wellbeing[key] = Math.min(100, axo.wellbeing[key] + item.amount);
    }
  } else {
    axo.wellbeing[item.restores] = Math.min(100, axo.wellbeing[item.restores] + item.amount);
  }

  if (item.opalCost) state.opals -= item.opalCost;
  if (item.bubbleCost) state.bubbles -= item.bubbleCost;

  gameState.notify();
  gameState.save();
  return { success: true };
}

// --- Mini game completion ---

export function completeMiniGame(statKey, tier = 'normal') {
  const rewards = MINI_GAME_REWARDS[tier];
  if (!rewards) return;

  const state = gameState.data;
  const axo = gameState.activeAxolotl;

  // Growth stat gain (respect soft caps) — skip if no stat key (e.g. treasure hunt)
  let effectiveGain = 0;
  if (statKey) {
    const cap = GROWTH_CAPS[axo.lifeStage] || 100;
    const current = axo.growth[statKey] || 0;

    // Diminishing returns near cap
    const headroom = cap - current;
    effectiveGain = Math.min(rewards.statGain, headroom * 0.5);
    axo.growth[statKey] = Math.min(cap, current + Math.max(1, effectiveGain));
  }

  // Bubbles
  state.bubbles += rewards.bubbles;

  // Opal chance
  if (rewards.opalChance && Math.random() < rewards.opalChance) {
    state.opals += 5;
    console.log('[Actions] Opal drop!');
  }

  // XP
  if (axo.lifeStage === LIFE_STAGES.ADULT) {
    let xpGain = XP_CONFIG.miniGameXP;
    if (tier === 'exceptional') xpGain += XP_CONFIG.miniGameBonusXP;
    axo.xp = Math.min(XP_CONFIG.maxXP, axo.xp + xpGain);
  }

  state.totalMiniGamesPlayed++;
  gameState.notify();
  gameState.save();

  return {
    statGain: effectiveGain,
    bubbles: rewards.bubbles,
    opalDrop: rewards.opalChance ? Math.random() < rewards.opalChance : false,
  };
}

// --- Life stage progression ---

export function checkStageProgression() {
  const axo = gameState.activeAxolotl;
  const now = Date.now();
  const daysInStage = (now - axo.stageStartTime) / (1000 * 60 * 60 * 24);

  switch (axo.lifeStage) {
    case LIFE_STAGES.BABY:
      if (daysInStage >= 2) return { canProgress: true, nextStage: LIFE_STAGES.JUVENILE };
      break;
    case LIFE_STAGES.JUVENILE:
      if (daysInStage >= 5) return { canProgress: true, nextStage: LIFE_STAGES.ADULT };
      break;
    case LIFE_STAGES.ADULT:
      if (axo.xp >= XP_CONFIG.maxXP) return { canProgress: true, nextStage: LIFE_STAGES.ELDER };
      break;
    case LIFE_STAGES.ELDER:
      // Player-initiated rebirth
      return { canProgress: true, nextStage: 'rebirth' };
  }
  return { canProgress: false };
}

export function progressStage() {
  const axo = gameState.activeAxolotl;
  const check = checkStageProgression();
  if (!check.canProgress || check.nextStage === 'rebirth') return false;

  axo.lifeStage = check.nextStage;
  axo.stageStartTime = Date.now();
  console.log(`[Actions] Progressed to ${check.nextStage}`);
  gameState.notify();
  gameState.save();
  return true;
}

// --- Filter upgrade ---

export function upgradeFilter(tier) {
  const filter = FILTERS[tier];
  if (!filter) return { success: false };

  const state = gameState.data;
  if (state.bubbles < filter.cost) return { success: false, reason: 'Not enough Bubbles' };

  state.bubbles -= filter.cost;
  gameState.activeAquarium.filterTier = tier;
  gameState.notify();
  gameState.save();
  return { success: true };
}
