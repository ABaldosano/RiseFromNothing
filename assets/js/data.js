// ============================
// RISE FROM NOTHING — DATA v4
// ============================

const CURRENCY    = '$';
const OFFLINE_CAP = 8 * 60 * 60 * 1000;

// ── Jobs ──────────────────────────────────────────────
const JOBS = {
  beggar: {
    name: 'Beggar', emoji: '🧍', icon: 'assets/images/ui/icon_beggar.png',
    description: 'Starting from zero on the street.',
    unlockCost: 0,
    actions: [
      { id: 'ask_change',      name: 'Ask for Change',   minIncome: 1, maxIncome: 3 },
      { id: 'collect_bottles', name: 'Collect Bottles',  minIncome: 2, maxIncome: 4 },
      { id: 'collect_scrap',   name: 'Collect Scrap',    minIncome: 2, maxIncome: 5 },
    ],
  },
  street_sweeper: {
    name: 'Street Sweeper', emoji: '🧹', icon: 'assets/images/ui/icon_sweeper.png',
    description: 'Keeping the city clean, one block at a time.',
    unlockCost: 100,
    actions: [
      { id: 'sweep_block',  name: 'Sweep a Block',    minIncome: 300, maxIncome: 300, trashCount: 300 },
      { id: 'sweep_market', name: 'Sweep the Market', minIncome: 1000, maxIncome: 1000, trashCount: 1000 },
    ],
  },
  garbage_collector: {
    name: 'Garbage Collector', emoji: '🗑️', icon: 'assets/images/ui/icon_trashbin.png',
    description: 'Early mornings, heavy loads, steady pay.',
    unlockCost: 1000,
    actions: [
      { id: 'collect_route', name: 'Run a Route', minIncome: 300, maxIncome: 300  },
      { id: 'collect_bulk',  name: 'Bulk Pickup', minIncome: 400, maxIncome: 400 },
    ],
  },
  courier: {
    name: 'Courier', emoji: '🚴', icon: 'assets/images/ui/icon_courier.png',
    description: 'Fast deliveries across the city.',
    unlockCost: 8_000,
    actions: [
      { id: 'bike_delivery',  name: 'Bike Delivery',  minIncome: 120, maxIncome: 200 },
      { id: 'rush_delivery',  name: 'Rush Delivery',  minIncome: 180, maxIncome: 280 },
    ],
  },
};

const JOB_ORDER = ['beggar', 'street_sweeper', 'garbage_collector', 'courier'];

// ── Businesses ────────────────────────────────────────
// workerBonus : +X income multiplier per worker  (e.g. 0.30 = +30% each)
// upgradeCosts: [cost→lvl2, cost→lvl3]  level multipliers: 1x, 1.5x, 2x
const BUSINESSES = {
  food_cart: {
    name: 'Food Cart', emoji: '🍢', icon: 'assets/images/ui/icon_foodcart.png',
    description: 'Street food that feeds the neighborhood.',
    cost: 5_000, minIncome: 200, maxIncome: 500, intervalMs: 10_000,
    workerCost: 800,  workerMax: 3, workerBonus: 0.30,
    upgradeCosts: [3_000, 10_000],
    category: 'retail',
  },
  small_store: {
    name: 'Small Store', emoji: '🏪', icon: 'assets/images/ui/icon_storefront.png',
    description: 'Your first real business address.',
    cost: 25_000, minIncome: 1_000, maxIncome: 5_000, intervalMs: 30_000,
    workerCost: 3_000, workerMax: 5, workerBonus: 0.25,
    upgradeCosts: [10_000, 35_000],
    category: 'retail',
  },
  convenience_store: {
    name: 'Convenience Store', emoji: '🛒', icon: 'assets/images/ui/icon_storefront.png',
    description: 'Open 24/7. Customers keep coming.',
    cost: 75_000, minIncome: 3_000, maxIncome: 8_000, intervalMs: 45_000,
    workerCost: 8_000, workerMax: 5, workerBonus: 0.25,
    upgradeCosts: [25_000, 80_000],
    category: 'retail',
  },
  mini_market: {
    name: 'Mini Market', emoji: '🏬', icon: 'assets/images/ui/icon_storefront.png',
    description: 'A full market under your name.',
    cost: 200_000, minIncome: 10_000, maxIncome: 25_000, intervalMs: 60_000,
    workerCost: 20_000, workerMax: 8, workerBonus: 0.20,
    upgradeCosts: [60_000, 200_000],
    category: 'retail',
  },

  // ── Transportation ────────────────────────────────────
  bicycle_courier: {
    name: 'Bicycle Courier', emoji: '🚲', icon: 'assets/images/ui/icon_vehicle_bicycle.png',
    description: 'Pedal-powered deliveries across the district.',
    cost: 15_000, minIncome: 800, maxIncome: 1_800, intervalMs: 12_000,
    workerCost: 2_000, workerMax: 4, workerBonus: 0.28,
    upgradeCosts: [8_000, 25_000],
    category: 'transport',
    vehicleType: 'bicycle',
  },
  motorcycle_courier: {
    name: 'Motorcycle Courier', emoji: '🏍️', icon: 'assets/images/ui/icon_vehicle_motorcycle.png',
    description: 'Faster, farther, more profitable.',
    cost: 60_000, minIncome: 3_500, maxIncome: 7_000, intervalMs: 20_000,
    workerCost: 8_000, workerMax: 5, workerBonus: 0.25,
    upgradeCosts: [20_000, 65_000],
    category: 'transport',
    vehicleType: 'motorcycle',
  },
  delivery_van: {
    name: 'Delivery Van', emoji: '🚐', icon: 'assets/images/ui/icon_vehicle_van.png',
    description: 'Bulk deliveries, bigger margins.',
    cost: 180_000, minIncome: 12_000, maxIncome: 24_000, intervalMs: 35_000,
    workerCost: 22_000, workerMax: 6, workerBonus: 0.22,
    upgradeCosts: [55_000, 180_000],
    category: 'transport',
    vehicleType: 'van',
  },
  logistics_company: {
    name: 'Logistics Company', emoji: '🚛', icon: 'assets/images/ui/icon_vehicle_truck.png',
    description: 'Fleet of trucks. City-wide supply chains.',
    cost: 500_000, minIncome: 40_000, maxIncome: 90_000, intervalMs: 60_000,
    workerCost: 60_000, workerMax: 10, workerBonus: 0.18,
    upgradeCosts: [150_000, 500_000],
    category: 'transport',
    vehicleType: 'truck',
  },

  // ── Real Estate ────────────────────────────────────────
  boarding_house: {
    name: 'Boarding House', emoji: '🏠', icon: 'assets/images/ui/icon_re_house.png',
    description: 'Small rooms, steady rent.',
    cost: 700_000, minIncome: 35_000, maxIncome: 70_000, intervalMs: 60_000,
    workerCost: 80_000, workerMax: 6, workerBonus: 0.18,
    upgradeCosts: [220_000, 700_000],
    category: 'property', propertyType: 'rental_house',
  },
  apartment: {
    name: 'Apartment', emoji: '🏢', icon: 'assets/images/ui/ico_re_apartment.png',
    description: 'Multi-unit residential income.',
    cost: 1_500_000, minIncome: 70_000, maxIncome: 150_000, intervalMs: 75_000,
    workerCost: 180_000, workerMax: 8, workerBonus: 0.16,
    upgradeCosts: [450_000, 1_500_000],
    category: 'property', propertyType: 'apartment',
  },
  commercial_unit: {
    name: 'Commercial Unit', emoji: '🏬', icon: 'assets/images/ui/ico_re_apartment.png',
    description: 'Leased retail and office space.',
    cost: 3_500_000, minIncome: 160_000, maxIncome: 320_000, intervalMs: 90_000,
    workerCost: 400_000, workerMax: 10, workerBonus: 0.14,
    upgradeCosts: [1_000_000, 3_500_000],
    category: 'property', propertyType: 'apartment',
  },
  office_building: {
    name: 'Office Building', emoji: '🏙️', icon: 'assets/images/ui/ico_re_apartment.png',
    description: 'Corporate tenants, premium rent.',
    cost: 8_000_000, minIncome: 380_000, maxIncome: 750_000, intervalMs: 120_000,
    workerCost: 900_000, workerMax: 12, workerBonus: 0.12,
    upgradeCosts: [2_400_000, 8_000_000],
    category: 'property', propertyType: 'office',
  },
};

const BIZ_ORDER = [
  'food_cart', 'small_store', 'convenience_store', 'mini_market',
  'bicycle_courier', 'motorcycle_courier', 'delivery_van', 'logistics_company',
  'boarding_house', 'apartment', 'commercial_unit', 'office_building',
];

// ── Delivery Routes (v4) ──────────────────────────────
// Each route defines waypoints for vehicle NPC paths in world.js
const DELIVERY_ROUTES = {
  bicycle_courier:   [{ x: -5, z: -10 }, { x:  5, z: 10  }, { x: 0, z: 30  }],
  motorcycle_courier:[{ x: -5, z: -25 }, { x: 10, z:  0  }, { x: 0, z: 40  }],
  delivery_van:      [{ x: -5, z: -40 }, { x:  5, z: -10 }, { x: 5, z: 30  }],
  logistics_company: [{ x: -5, z: -55 }, { x:  0, z: -20 }, { x: 0, z: 50  }],
};