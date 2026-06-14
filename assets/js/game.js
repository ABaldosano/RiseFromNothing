// ============================
// RISE FROM NOTHING — GAME v5
// ============================

const G = {
  capital:          0,
  totalEarned:      0,
  activeJob:        'beggar',
  unlockedJobs:     ['beggar'],
  ownedBusinesses:  [],
  workers:          {},
  workerLevel:      {},
  bizTimers:        {},
  bizProgress:      {},
  offlineEarned:    0,
  rafId:            null,
  fleetLevel:       {},
  activeRoutes:     {},
  paused:           false,
};

// ── Pause System ──────────────────────────────────────────────
function pauseGame() {
  if (G.paused) return;
  G.paused = true;
  // Pause all biz timers
  Object.keys(G.bizTimers).forEach(bizId => {
    clearInterval(G.bizTimers[bizId]);
    G.bizTimers[bizId] = null;
    // Record time remaining
    if (G.bizProgress[bizId]) {
      G.bizProgress[bizId].pausedAt = Date.now();
    }
  });
  if (window.WorldAPI?.setPaused) window.WorldAPI.setPaused(true);
  showPauseMenu();
}

function resumeGame() {
  if (!G.paused) return;
  G.paused = false;
  // Resume biz timers accounting for pause offset
  G.ownedBusinesses.forEach(bizId => {
    const prog = G.bizProgress[bizId];
    if (prog?.pausedAt) {
      const pausedElapsed = Date.now() - prog.pausedAt;
      prog.startMs += pausedElapsed;
      delete prog.pausedAt;
    }
    _startBizTimer(bizId);
  });
  if (window.WorldAPI?.setPaused) window.WorldAPI.setPaused(false);
  hidePauseMenu();
}

function togglePause() {
  if (G.paused) resumeGame();
  else pauseGame();
}

window.togglePause = togglePause;

function showPauseMenu() {
  const el = document.getElementById('pause-menu');
  if (el) el.classList.remove('hidden');
}
function hidePauseMenu() {
  const el = document.getElementById('pause-menu');
  if (el) el.classList.add('hidden');
}

// ── Init ──────────────────────────────────────────────────────
function initGame() {
  const saved = loadGame();

  if (saved) {
    G.capital          = saved.capital          ?? 0;
    G.totalEarned      = saved.totalEarned      ?? 0;
    G.activeJob        = saved.activeJob        ?? 'beggar';
    G.unlockedJobs     = saved.unlockedJobs     ?? ['beggar'];
    G.ownedBusinesses  = saved.ownedBusinesses  ?? [];
    G.workers          = saved.workers          ?? {};
    G.workerLevel      = saved.workerLevel      ?? {};
    G.fleetLevel       = saved.fleetLevel       ?? {};

    if (saved.savedAt && G.ownedBusinesses.length > 0) {
      const offline = calcOfflineEarnings(G.ownedBusinesses, saved.savedAt, G.workers, G.workerLevel);
      if (offline > 0) {
        G.capital      += offline;
        G.offlineEarned = offline;
      }
    }
  }

  G.ownedBusinesses.forEach(bizId => _startBizTimer(bizId));
  setInterval(() => { if (!G.paused) saveGame(G); }, 30_000);
  G.rafId = requestAnimationFrame(_tick);
  renderAll();
  if (G.offlineEarned > 0) showOfflineModal(G.offlineEarned);

  const canvas = document.getElementById('world-canvas');
  if (canvas && window.WorldAPI) {
    window.WorldAPI.init(canvas, G, BUSINESSES, BIZ_ORDER);
    window.WorldAPI.setInteractCallback(_onInteractChange);
  }
}

// ── World UI hooks ────────────────────────────────────────────
function _onInteractChange(bizId) {
  const btn = document.getElementById('interact-btn');
  if (!btn) return;
  if (bizId) {
    btn.classList.remove('hidden');
    btn.dataset.biz = bizId;
  } else {
    btn.classList.add('hidden');
    delete btn.dataset.biz;
  }
}

function togglePanel() {
  if (G.paused) return;
  document.getElementById('panel-sheet').classList.toggle('open');
  playClick();
}

function interactWithBusiness() {
  if (G.paused) return;
  const panel = document.getElementById('panel-sheet');
  playClick();
  if (panel.classList.contains('open')) {
    panel.classList.remove('open');
    return;
  }
  panel.classList.add('open');
}

window.openBizPanel = function(bizId) {
  if (G.paused) return;
  const panel = document.getElementById('panel-sheet');
  playClick();
  panel.classList.add('open');
  const bizTabBtn = document.querySelector('.panel-tab[onclick*="business"]');
  if (bizTabBtn && typeof switchPanelTab === 'function') switchPanelTab('business', bizTabBtn);
  setTimeout(() => {
    const card = document.getElementById('biz-card-' + bizId);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 60);
};

// ── rAF tick ──────────────────────────────────────────────────
function _tick() {
  if (!G.paused) updateBizProgress();
  G.rafId = requestAnimationFrame(_tick);
}

// ── Actions ───────────────────────────────────────────────────
function doAction(actionId) {
  if (G.paused) return;
  const job    = JOBS[G.activeJob];
  const action = job?.actions.find(a => a.id === actionId);
  if (!action) return;

  const earned = _rand(action.minIncome, action.maxIncome);
  _addCapital(earned);
  playCoin();

  const btn = document.getElementById('action-' + actionId);
  spawnFloat('+' + fmt(earned), btn);

  saveGame(G);
  renderStats();
  renderUnlockSection();
  renderBusinessSection();
}

// ── Jobs ──────────────────────────────────────────────────────
function switchJob(jobId) {
  if (!G.unlockedJobs.includes(jobId)) return;
  G.activeJob = jobId;
  playClick();
  renderJobSection();
  renderHeaderBadge();
}

function unlockJob(jobId) {
  const job = JOBS[jobId];
  if (!job || G.unlockedJobs.includes(jobId) || G.capital < job.unlockCost) return;
  G.capital -= job.unlockCost;
  G.unlockedJobs.push(jobId);
  G.activeJob = jobId;
  playUpgrade();
  saveGame(G);
  renderAll();
}

// ── Businesses ────────────────────────────────────────────────
function buyBusiness(bizId) {
  const biz = BUSINESSES[bizId];
  if (!biz || G.ownedBusinesses.includes(bizId) || G.capital < biz.cost) return;
  G.capital -= biz.cost;
  G.ownedBusinesses.push(bizId);
  if (!G.workers[bizId])     G.workers[bizId]     = 0;
  if (!G.workerLevel[bizId]) G.workerLevel[bizId] = 1;
  if (biz.category === 'transport') {
    if (!G.fleetLevel[bizId]) G.fleetLevel[bizId] = 1;
  }
  _startBizTimer(bizId);
  playPurchase();
  saveGame(G);
  renderStats();
  renderBusinessSection();
  renderUnlockSection();
  window.WorldAPI?.updateWorld(G, BUSINESSES);
}

// ── Workers ───────────────────────────────────────────────────
function hireWorker(bizId) {
  const biz     = BUSINESSES[bizId];
  const current = G.workers[bizId] || 0;
  if (!biz || current >= biz.workerMax) return;
  const cost = _workerHireCost(bizId);
  if (G.capital < cost) return;

  G.capital         -= cost;
  G.workers[bizId]   = current + 1;

  playUpgrade();
  saveGame(G);
  renderStats();
  renderBusinessSection();
  window.WorldAPI?.updateWorld(G, BUSINESSES);
}

function upgradeWorkers(bizId) {
  const biz   = BUSINESSES[bizId];
  const level = G.workerLevel[bizId] || 1;
  if (!biz || level >= 3) return;
  const cost = biz.upgradeCosts[level - 1];
  if (G.capital < cost) return;

  G.capital           -= cost;
  G.workerLevel[bizId] = level + 1;

  playUpgrade();
  saveGame(G);
  renderStats();
  renderBusinessSection();
}

function _workerHireCost(bizId) {
  const biz     = BUSINESSES[bizId];
  const current = G.workers[bizId] || 0;
  return Math.floor(biz.workerCost * Math.pow(1.5, current));
}

// ── Fleet Upgrade ─────────────────────────────────────────────
const FLEET_LEVEL_NAMES   = ['', 'Standard', 'Upgraded', 'Premium'];
const FLEET_LEVEL_MULT    = [1, 1, 1.6, 2.5];

function upgradeFleet(bizId) {
  const biz   = BUSINESSES[bizId];
  if (!biz || biz.category !== 'transport') return;
  const level = G.fleetLevel[bizId] || 1;
  if (level >= 3) return;
  const cost = biz.upgradeCosts[level - 1];
  if (G.capital < cost) return;

  G.capital          -= cost;
  G.fleetLevel[bizId] = level + 1;

  playUpgrade();
  saveGame(G);
  renderStats();
  renderBusinessSection();
  window.WorldAPI?.updateWorld(G, BUSINESSES);
}

// ── Business timer ────────────────────────────────────────────
function _startBizTimer(bizId) {
  const biz = BUSINESSES[bizId];
  if (!biz) return;
  if (G.bizTimers[bizId]) clearInterval(G.bizTimers[bizId]);

  G.bizProgress[bizId] = { startMs: Date.now(), intervalMs: biz.intervalMs };

  G.bizTimers[bizId] = setInterval(() => {
    if (G.paused) return;
    const earned = _calcBizIncome(bizId);
    _addCapital(earned);
    G.bizProgress[bizId].startMs = Date.now();

    playCoin();
    spawnBizFloat(bizId, '+' + fmt(earned));
    renderStats();
    renderBusinessSection();
    renderUnlockSection();
    saveGame(G);
  }, biz.intervalMs);
}

function _calcBizIncome(bizId) {
  const biz        = BUSINESSES[bizId];
  const base       = _rand(biz.minIncome, biz.maxIncome);
  const wCount     = G.workers[bizId]     || 0;
  const wLevel     = G.workerLevel[bizId] || 1;
  const workerMult = 1 + wCount * biz.workerBonus;
  const levelMult  = [1, 1.5, 2][wLevel - 1];
  const fleetMult  = biz.category === 'transport'
    ? FLEET_LEVEL_MULT[G.fleetLevel[bizId] || 1]
    : 1;
  return Math.floor(base * workerMult * levelMult * fleetMult);
}

// ── Helpers ───────────────────────────────────────────────────
function _addCapital(amount) {
  G.capital     += amount;
  G.totalEarned += amount;
}

function _rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getIncomePerSec() {
  let total = 0;
  G.ownedBusinesses.forEach(bizId => {
    const biz        = BUSINESSES[bizId];
    const avg        = (biz.minIncome + biz.maxIncome) / 2;
    const wCount     = G.workers[bizId]     || 0;
    const wLevel     = G.workerLevel[bizId] || 1;
    const workerMult = 1 + wCount * biz.workerBonus;
    const levelMult  = [1, 1.5, 2][wLevel - 1];
    const fleetMult  = biz.category === 'transport'
      ? FLEET_LEVEL_MULT[G.fleetLevel[bizId] || 1]
      : 1;
    total += (avg * workerMult * levelMult * fleetMult) / (biz.intervalMs / 1000);
  });
  return total;
}

function fmt(n) {
  n = Math.floor(n);
  if (n >= 1_000_000) return CURRENCY + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return CURRENCY + (n / 1_000).toFixed(1) + 'K';
  return CURRENCY + n.toLocaleString();
}

function fmtRate(n) {
  if (n >= 1000) return CURRENCY + (n / 1000).toFixed(1) + 'K/s';
  if (n > 0)     return CURRENCY + n.toFixed(1) + '/s';
  return CURRENCY + '0/s';
}