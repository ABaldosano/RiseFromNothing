// ============================
// RISE FROM NOTHING — DATA v2
// ============================

const CURRENCY    = '₱';
const OFFLINE_CAP = 8 * 60 * 60 * 1000;

// ── Jobs ──────────────────────────────────────────────
const JOBS = {
  beggar: {
    name: 'Beggar', emoji: '🧍',
    description: 'Starting from zero on the street.',
    unlockCost: 0,
    actions: [
      { id: 'ask_change',      name: 'Ask for Change',   minIncome: 1, maxIncome: 3 },
      { id: 'collect_bottles', name: 'Collect Bottles',  minIncome: 2, maxIncome: 4 },
      { id: 'collect_scrap',   name: 'Collect Scrap',    minIncome: 2, maxIncome: 5 },
    ],
  },
  street_sweeper: {
    name: 'Street Sweeper', emoji: '🧹',
    description: 'Keeping the city clean, one block at a time.',
    unlockCost: 100,
    actions: [
      { id: 'sweep_block',  name: 'Sweep a Block',    minIncome: 10, maxIncome: 18 },
      { id: 'sweep_market', name: 'Sweep the Market', minIncome: 15, maxIncome: 25 },
    ],
  },
  garbage_collector: {
    name: 'Garbage Collector', emoji: '🗑️',
    description: 'Early mornings, heavy loads, steady pay.',
    unlockCost: 1000,
    actions: [
      { id: 'collect_route', name: 'Run a Route', minIncome: 50, maxIncome: 80  },
      { id: 'collect_bulk',  name: 'Bulk Pickup', minIncome: 60, maxIncome: 100 },
    ],
  },
};

const JOB_ORDER = ['beggar', 'street_sweeper', 'garbage_collector'];

// ── Businesses ────────────────────────────────────────
// workerBonus : +X income multiplier per worker  (e.g. 0.30 = +30% each)
// upgradeCosts: [cost→lvl2, cost→lvl3]  level multipliers: 1x, 1.5x, 2x
const BUSINESSES = {
  food_cart: {
    name: 'Food Cart', emoji: '🍢',
    description: 'Street food that feeds the neighborhood.',
    cost: 5_000, minIncome: 200, maxIncome: 500, intervalMs: 10_000,
    workerCost: 800,  workerMax: 3, workerBonus: 0.30,
    upgradeCosts: [3_000, 10_000],
  },
  small_store: {
    name: 'Small Store', emoji: '🏪',
    description: 'Your first real business address.',
    cost: 25_000, minIncome: 1_000, maxIncome: 5_000, intervalMs: 30_000,
    workerCost: 3_000, workerMax: 5, workerBonus: 0.25,
    upgradeCosts: [10_000, 35_000],
  },
  convenience_store: {
    name: 'Convenience Store', emoji: '🛒',
    description: 'Open 24/7. Customers keep coming.',
    cost: 75_000, minIncome: 3_000, maxIncome: 8_000, intervalMs: 45_000,
    workerCost: 8_000, workerMax: 5, workerBonus: 0.25,
    upgradeCosts: [25_000, 80_000],
  },
  mini_market: {
    name: 'Mini Market', emoji: '🏬',
    description: 'A full market under your name.',
    cost: 200_000, minIncome: 10_000, maxIncome: 25_000, intervalMs: 60_000,
    workerCost: 20_000, workerMax: 8, workerBonus: 0.20,
    upgradeCosts: [60_000, 200_000],
  },
};

const BIZ_ORDER = ['food_cart', 'small_store', 'convenience_store', 'mini_market'];