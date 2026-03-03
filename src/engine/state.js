// ============================================================
// Axolittle — Game State Manager
// Central state with save/load to localStorage
// ============================================================

import {
  LIFE_STAGES,
  STARTING_CURRENCY,
  FILTERS,
} from '../data/config.js';

const STORAGE_KEY = 'axolittle_save';

function createDefaultAxolotl(name = 'Axo') {
  return {
    name,
    generation: 1,
    lifeStage: LIFE_STAGES.BABY,
    stageStartTime: Date.now(),
    xp: 0,

    // Wellbeing (0-100)
    wellbeing: {
      hunger: 80,
      happiness: 80,
      cleanliness: 80,
      waterQuality: 90,
    },

    // Growth (0-100)
    growth: {
      stamina: 0,
      strength: 0,
      speed: 0,
      intellect: 0,
    },

    // Mood derived from wellbeing
    mood: 'happy',

    // Neglect stage (0-4)
    neglectStage: 0,

    // Color / appearance
    color: '#E8A0BF', // pink axolotl default

    // Lineage
    parentTraits: null,
  };
}

function createDefaultAquarium(name = 'My Tank') {
  return {
    name,
    filterTier: 'basic',
    decorations: [],
    memorials: [],
    poops: [],                     // { x, y } positions in tank (% based)
    lastNaturalPoopTime: Date.now(),
    feedCount: 0,                  // rolling feed counter for poop trigger
    lastFeedTime: 0,
    scheduledPoops: [],            // { time } — feed-triggered poops pending
    ghostShrimp: { batches: [] },  // { count, addedAt } per batch
  };
}

function createDefaultState() {
  return {
    version: 1,
    createdAt: Date.now(),
    lastTickAt: Date.now(),

    // Currency
    bubbles: STARTING_CURRENCY.bubbles,
    opals: STARTING_CURRENCY.opals,

    // Active axolotl index
    activeSlot: 0,

    // Up to 4 axolotl + aquarium pairs
    axolotls: [createDefaultAxolotl()],
    aquariums: [createDefaultAquarium()],

    // Nursery
    nursery: { egg: null },

    // Water change lockout (minigames blocked for 1hr)
    waterChangeUntil: 0,

    // Stats tracking
    totalMiniGamesPlayed: 0,
    totalCareActions: 0,
    loginStreak: 0,
    lastLoginDate: null,

    // Treasure hunt opal tracking
    treasureHunt: {
      lastOpalDate: null,
      opalsToday: 0,
    },

    // Daily limits
    dailyAdWatched: 0,
    dailySpinUsed: false,
  };
}

class GameState {
  constructor() {
    this.data = null;
    this.listeners = new Set();
  }

  init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.data = JSON.parse(saved);
        console.log('[State] Loaded save from localStorage');
      } catch {
        console.warn('[State] Corrupt save, creating new');
        this.data = createDefaultState();
      }
    } else {
      this.data = createDefaultState();
      console.log('[State] New game created');
    }
    return this;
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = createDefaultState();
    this.notify();
    console.log('[State] Game reset');
  }

  // --- Convenience accessors ---

  get activeAxolotl() {
    return this.data.axolotls[this.data.activeSlot];
  }

  get activeAquarium() {
    return this.data.aquariums[this.data.activeSlot];
  }

  get bubbles() { return this.data.bubbles; }
  set bubbles(v) { this.data.bubbles = Math.max(0, v); }

  get opals() { return this.data.opals; }
  set opals(v) { this.data.opals = Math.max(0, v); }

  // --- Observer pattern ---

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) fn(this.data);
  }
}

export const gameState = new GameState();
export { createDefaultAxolotl, createDefaultAquarium };
