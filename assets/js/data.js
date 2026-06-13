// ============================
// RISE FROM NOTHING — DATA v1
// ============================

const CURRENCY    = '₱';
const OFFLINE_CAP = 8 * 60 * 60 * 1000; // 8 hours max offline

// ── Jobs ──────────────────────────────────────────────
const JOBS = {
  beggar: {
    name:        'Beggar',
    emoji:       '🧍',
    description: 'Starting from zero on the street.',
    unlockCost:  0,
    actions: [
      { id: 'ask_change',     name: 'Ask for Change',   minIncome: 1,  maxIncome: 3  },
      { id: 'collect_bottles', name: 'Collect Bottles', minIncome: 2,  maxIncome: 4  },
      { id: 'collect_scrap',  name: 'Collect Scrap',    minIncome: 2,  maxIncome: 5  },
    ],
  },
  street_sweeper: {
    name:        'Street Sweeper',
    emoji:       '🧹',
    description: 'Keeping the city clean, one block at a time.',
    unlockCost:  100,
    actions: [
      { id: 'sweep_block',    name: 'Sweep a Block',    minIncome: 10, maxIncome: 18 },
      { id: 'sweep_market',   name: 'Sweep the Market', minIncome: 15, maxIncome: 25 },
    ],
  },
  garbage_collector: {
    name:        'Garbage Collector',
    emoji:       '🗑️',
    description: 'Early mornings, heavy loads, steady pay.',
    unlockCost:  1000,
    actions: [
      { id: 'collect_route',  name: 'Run a Route',      minIncome: 50, maxIncome: 80  },
      { id: 'collect_bulk',   name: 'Bulk Pickup',      minIncome: 60, maxIncome: 100 },
    ],
  },
};

const JOB_ORDER = ['beggar', 'street_sweeper', 'garbage_collector'];

// ── Businesses ────────────────────────────────────────
const BUSINESSES = {
  food_cart: {
    name:        'Food Cart',
    emoji:       '🍢',
    description: 'Street food that feeds the neighborhood.',
    cost:        5000,
    minIncome:   200,
    maxIncome:   500,
    intervalMs:  10_000, // every 10s
  },
  small_store: {
    name:        'Small Store',
    emoji:       '🏪',
    description: 'Your first real business address.',
    cost:        25_000,
    minIncome:   1000,
    maxIncome:   5000,
    intervalMs:  30_000, // every 30s
  },
};

const BIZ_ORDER = ['food_cart', 'small_store'];