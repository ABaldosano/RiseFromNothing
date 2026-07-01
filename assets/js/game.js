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
  sweepTask:        null,
  sweepCarry:       0,
  sweepCapacity:    500,
  reputation:       0,
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
    G.reputation       = saved.reputation       ?? 0;

    if (saved.savedAt && G.ownedBusinesses.length > 0) {
      const offline = calcOfflineEarnings(G.ownedBusinesses, saved.savedAt, G.workers, G.workerLevel, G.fleetLevel, G.reputation);
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
  _setupHoldToDump();

  const canvas = document.getElementById('world-canvas');
  if (canvas && window.WorldAPI) {
    window.WorldAPI.init(canvas, G, BUSINESSES, BIZ_ORDER);
    window.WorldAPI.setInteractCallback(_onInteractChange);
  }

  // Mobile: auto-pause and save when the tab/app is backgrounded so
  // throttled timers can't drift or double-fire on return.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveGame(G);
      if (!G.paused) pauseGame();
    }
  });
  window.addEventListener('pagehide', () => saveGame(G));
  window.addEventListener('beforeunload', () => saveGame(G));
}

// ── World UI hooks ────────────────────────────────────────────
function _onInteractChange(payload) {
  const btn = document.getElementById('interact-btn');
  if (!btn) return;
  delete btn.dataset.type;
  delete btn.dataset.biz;
  delete btn.dataset.action;
  delete btn.dataset.target;
  if (payload) {
    btn.classList.remove('hidden');
    btn.dataset.type = payload.type;
    if (payload.type === 'business') btn.dataset.biz = payload.bizId;
    if (payload.type === 'beg') {
      btn.dataset.action = payload.actionId;
      btn.dataset.target = payload.targetId;
    }
  } else {
    btn.classList.add('hidden');
  }
}

function togglePanel() {
  if (G.paused) return;
  document.getElementById('panel-sheet').classList.toggle('open');
  playClick();
}

function interactWithBusiness() {
  if (G.paused) return;
  const btn  = document.getElementById('interact-btn');
  const type = btn?.dataset.type;

  if (type === 'beg') {
    doBegAction(btn.dataset.action, btn.dataset.target);
    return;
  }
  if (type === 'sweep_bin') {
    if (!_holdActive) depositSweepTrash();
    return;
  }

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

// ── Beggar ────────────────────────────────────────────────────
function doBegAction(actionId, targetId) {
  if (G.paused || G.activeJob !== 'beggar') return;
  const action = JOBS.beggar.actions.find(a => a.id === actionId);
  if (!action) return;

  const earned = _rand(action.minIncome, action.maxIncome);
  _addCapital(earned);
  playCoin();
  spawnFloat('+' + fmt(earned), document.getElementById('interact-btn'));

  window.WorldAPI?.setBegTargetCooldown(targetId);

  saveGame(G);
  renderStats();
  renderUnlockSection();
  renderBusinessSection();
}

// ── Street Sweeper ────────────────────────────────────────────
function startSweepTask(actionId) {
  if (G.paused || G.sweepTask || G.activeJob !== 'street_sweeper') return;
  const action = JOBS.street_sweeper.actions.find(a => a.id === actionId);
  if (!action) return;

  G.sweepTask  = { type: actionId, total: action.trashCount, collected: 0, deposited: 0 };
  G.sweepCarry = 0;

  window.WorldAPI?.startSweepArea(actionId);
  playClick();
  saveGame(G);
  renderJobSection();

  const panel = document.getElementById('panel-sheet');
  if (panel) panel.classList.remove('open');
}

function cancelSweepTask() {
  if (!G.sweepTask) return;
  G.sweepTask  = null;
  G.sweepCarry = 0;
  window.WorldAPI?.clearSweepArea();
  saveGame(G);
  renderJobSection();
}

function completeSweepTask() {
  G.sweepTask  = null;
  G.sweepCarry = 0;
  window.WorldAPI?.clearSweepArea();
  saveGame(G);
  renderJobSection();
}

function depositSweepTrash() {
  if (G.paused || !G.sweepTask || G.sweepCarry <= 0) return;

  const earned = _sweepItemReward(G.sweepTask.type);
  _addCapital(earned);
  G.sweepCarry--;
  G.sweepTask.deposited++;

  playCoin();
  spawnFloat('+' + fmt(earned), document.getElementById('interact-btn'));
  window.WorldAPI?.setCarryCount(G.sweepCarry);

  saveGame(G);
  renderStats();
  renderJobSection();

  if (G.sweepTask.collected >= G.sweepTask.total && G.sweepCarry === 0) {
    completeSweepTask();
  }
}

function _sweepItemReward(actionId) {
  const action = JOBS.street_sweeper.actions.find(a => a.id === actionId);
  const n      = action.trashCount;
  const perMin = Math.max(1, Math.floor(action.minIncome / n));
  const perMax = Math.max(perMin, Math.ceil(action.maxIncome / n));
  return _rand(perMin, perMax);
}

function onTrashCollected() {
  if (!G.sweepTask) return;
  G.sweepCarry++;
  G.sweepTask.collected++;
  window.WorldAPI?.setCarryCount(G.sweepCarry);
  playClick();
  renderJobSection();
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
  if (biz.category === 'franchise') {
    G.reputation += biz.repGain || 10;
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
  if (biz.category === 'franchise') G.reputation += 2;

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
  if (biz.category === 'franchise') G.reputation += 8;

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

function getReputationMult() {
  return 1 + Math.min(G.reputation * REPUTATION_PER_INCOME, REPUTATION_INCOME_CAP);
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
  const repMult    = biz.category === 'franchise' ? getReputationMult() : 1;
  return Math.floor(base * workerMult * levelMult * fleetMult * repMult);
}

// ── Hold-to-Dump (sweep bin) ─────────────────────────────────
const DUMP_ALL_HOLD_MS = 1000;
const DUMP_TICK_MS     = 140;
let _holdTimer  = null;
let _holdStart  = 0;
let _holdDone   = false;
let _holdActive = false;

function _startBinHold() {
  if (G.paused || _holdTimer) return;
  const btn = document.getElementById('interact-btn');
  if (!btn || btn.dataset.type !== 'sweep_bin') return;
  _holdActive = true;
  _holdStart  = Date.now();
  _holdDone   = false;
  _binHoldTick();
  _holdTimer = setInterval(_binHoldTick, DUMP_TICK_MS);
}

function _binHoldTick() {
  const btn = document.getElementById('interact-btn');
  if (G.paused || _holdDone || !G.sweepTask || G.sweepCarry <= 0 || !btn || btn.dataset.type !== 'sweep_bin') {
    _stopBinHold();
    return;
  }
  if (Date.now() - _holdStart >= DUMP_ALL_HOLD_MS) {
    _holdDone = true;
    dumpAllSweepTrash();
    _stopBinHold();
    return;
  }
  depositSweepTrash();
}

function _stopBinHold() {
  if (_holdTimer) { clearInterval(_holdTimer); _holdTimer = null; }
  setTimeout(() => { _holdActive = false; }, 250);
}

function dumpAllSweepTrash() {
  if (G.paused || !G.sweepTask || G.sweepCarry <= 0) return;
  const count = G.sweepCarry;
  for (let i = 0; i < count; i++) {
    G.sweepTask.deposited++;
    _addCapital(_sweepItemReward(G.sweepTask.type));
  }
  G.sweepCarry = 0;
  playDumpAll();
  spawnFloat('DUMPED ALL!', document.getElementById('interact-btn'));
  window.WorldAPI?.setCarryCount(0);

  saveGame(G);
  renderStats();
  renderJobSection();

  if (G.sweepTask.collected >= G.sweepTask.total && G.sweepCarry === 0) {
    completeSweepTask();
  }
}

function _setupHoldToDump() {
  const btn = document.getElementById('interact-btn');
  if (btn) {
    btn.addEventListener('pointerdown', _startBinHold);
    btn.addEventListener('pointerup', _stopBinHold);
    btn.addEventListener('pointercancel', _stopBinHold);
    btn.addEventListener('pointerleave', _stopBinHold);
  }
  window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'e') _startBinHold();
  });
  window.addEventListener('keyup', e => {
    if (e.key.toLowerCase() === 'e') _stopBinHold();
  });
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
    const repMult    = biz.category === 'franchise' ? getReputationMult() : 1;
    total += (avg * workerMult * levelMult * fleetMult * repMult) / (biz.intervalMs / 1000);
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