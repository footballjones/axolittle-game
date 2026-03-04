// ============================================================
// Axolittle — Game Configuration & Tuning Constants
// All values marked TUNABLE are intended to be adjusted during testing.
// The debug panel (F12) lets you tweak these at runtime.
// ============================================================

export const LIFE_STAGES = {
  BABY: 'baby',
  JUVENILE: 'juvenile',
  ADULT: 'adult',
  ELDER: 'elder',
};

// Duration ranges in real-world days
export const STAGE_DURATION = {
  [LIFE_STAGES.BABY]: { min: 2, max: 4 },
  [LIFE_STAGES.JUVENILE]: { min: 5, max: 7 },
  [LIFE_STAGES.ADULT]: { min: 14, max: 18 }, // XP-bar driven, not timer
  [LIFE_STAGES.ELDER]: { min: 7, max: 10 },
};

// --- Wellbeing decay rates ---
// Values = percentage points lost per real-world HOUR (0-100 scale).
// Water quality: 0.42/hr = needs changing ~2x per 7 days on basic filter
// (35 points restored per water change ÷ 84 hours per half-week ≈ 0.42/hr)
// TUNABLE: these are starting estimates for testing.
export const DECAY_RATES = {
  [LIFE_STAGES.BABY]: {
    hunger: 4.0,
    happiness: 2.5,
    cleanliness: 4.0,
    waterQuality: 0.42,
  },
  [LIFE_STAGES.JUVENILE]: {
    hunger: 3.0,
    happiness: 3.0,
    cleanliness: 3.0,
    waterQuality: 0.42,
  },
  [LIFE_STAGES.ADULT]: {
    hunger: 2.0,
    happiness: 2.0,
    cleanliness: 2.0,
    waterQuality: 0.42,
  },
  [LIFE_STAGES.ELDER]: {
    hunger: 1.0,
    happiness: 1.0,
    cleanliness: 1.0,
    waterQuality: 0.42,
  },
};

// Water quality multiplier on other stats' decay
// At 100 water quality → multiply decay by 0.85 (slows it)
// At 0 water quality   → multiply decay by 1.5  (accelerates it)
export const WATER_QUALITY_MULTIPLIER = {
  best: 0.85,  // at waterQuality = 100
  worst: 1.5,  // at waterQuality = 0
};

// --- Filter tiers ---
export const FILTERS = {
  basic: { label: 'Basic Filter', decayReduction: 0, cost: 0 },
  advanced: { label: 'Advanced Filter', decayReduction: 0.4, cost: 7500 },
  premium: { label: 'Premium Filter', decayReduction: 0.7, cost: 15000 },
};

// --- Growth stats ---
export const GROWTH_STATS = ['stamina', 'strength', 'speed', 'intellect'];

// Soft caps per life stage (0-100)
export const GROWTH_CAPS = {
  [LIFE_STAGES.BABY]: 20,
  [LIFE_STAGES.JUVENILE]: 45,
  [LIFE_STAGES.ADULT]: 80,
  [LIFE_STAGES.ELDER]: 100,
};

// --- Mini game stat rewards (per performance tier) ---
// TUNABLE: exact amounts
export const MINI_GAME_REWARDS = {
  normal: { statGain: 2, bubbles: 15 },
  good: { statGain: 5, bubbles: 35 },
  exceptional: { statGain: 10, bubbles: 75, opalChance: 0.15 },
};

// --- XP bar (adult stage) ---
export const XP_CONFIG = {
  maxXP: 1000,            // TUNABLE: total XP needed to unlock elder
  miniGameXP: 25,         // per session
  miniGameBonusXP: 15,    // exceptional performance bonus
  careTaskXP: 10,
  dailyOpenXP: 5,
  breedingXP: 50,         // one-time per axolotl
};

// --- Currency starting values ---
export const STARTING_CURRENCY = {
  bubbles: 100,
  opals: 0,
};

// --- Neglect thresholds ---
// Average of all four wellbeing stats
export const NEGLECT_THRESHOLDS = {
  neglected: 40,   // stage 1
  struggling: 25,  // stage 2 — growth pauses
  critical: 10,    // stage 3 — needs treatment items
  death: 0,        // stage 4 — only extreme abandonment
};

// --- Care actions ---
export const CARE_ACTIONS = {
  feed: { restores: 'hunger', amount: 10, bubbleCost: 20 },
  clean: { restores: 'cleanliness', amount: 0, bubbleCost: 0, toolMode: true },
  waterChange: { restores: 'waterQuality', amount: 35, bubbleCost: 0 },
  playToy: { restores: 'happiness', amount: 20, bubbleCost: 10 },
};

// --- Treatment items ---
export const TREATMENTS = {
  bloodworms: { restores: 'hunger', amount: 50, bubbleCost: 20 },
  tankCleaner: { restores: 'cleanliness', amount: 50, bubbleCost: 20 },
  playToy: { restores: 'happiness', amount: 50, bubbleCost: 20 },
  waterTreatment: { restores: 'waterQuality', amount: 50, opalCost: 30 },
  miracleTreatment: { restores: 'all', amount: 50, opalCost: 40 },
};

// --- Poop system ---
export const POOP_CONFIG = {
  naturalSpawnHours: 18,          // ~1 poop per 18 hours naturally
  feedsToTrigger: 3,              // 3 feeds triggers a scheduled poop
  feedPoopDelayMinutes: 15,       // poop appears 15 min after 3rd feed
  cleanlinessPerPoop: 8,          // cleanliness restored per poop cleaned
  cleanToolTimeoutMs: 3000,       // 3s to deselect clean tool if no clicks
  dissolveHours: 60,              // poop dissolves into water after 60 hours
  dissolveWaterQualityHit: 10,    // each dissolved poop lowers water quality by 10
};

// --- Ghost Shrimp (live tank item) ---
export const GHOST_SHRIMP_CONFIG = {
  costPer10: 10,                  // 10 opals per 10 shrimp
  maxInTank: 30,                  // max shrimp in tank at any time
  durationHoursPer10: 24,         // 24hrs per 10 shrimp (10→24h, 20→48h, 30→72h)
  poopSpawnReduction: 0.5,        // 50% less poop spawning per 10 shrimp active
  hungerDecayReduction: 0.3,      // 30% less hunger decay per 10 shrimp active
  happinessDecayReduction: 0.2,   // 20% less happiness decay per 10 shrimp active
};

// --- Treasure Hunt rewards ---
export const TREASURE_HUNT_CONFIG = {
  maxOpalsPerDay: 2,              // max opals obtainable per day
  opalChancePerGem: 0.15,         // chance each gem also gives an opal
  bubblesPerGem: 5,               // bubbles per gem collected
  bubblesPerDistance: 0.5,         // bubbles per distance unit
};

// --- Mood system ---
export const MOOD_THRESHOLDS = {
  happy: 70,
  playful: 60,
  tired: 40,
  hungry: 30,     // when hunger specifically is low
  sad: 25,
  sick: 15,
};

// --- Time acceleration for testing ---
// Set > 1 to speed up time in debug mode
export let TIME_SCALE = 1;
export function setTimeScale(s) { TIME_SCALE = s; }
