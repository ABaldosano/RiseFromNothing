// ============================
// RISE FROM NOTHING — GAME v1
// ============================

const G = {
  capital:          0,
  totalEarned:      0,
  activeJob:        'beggar',
  unlockedJobs:     ['beggar'],
  ownedBusinesses:  [],
  bizTimers:        {},   // bizId -> setInterval id
  bizProgress:      {},   // bizId -> { startMs, intervalMs }
  offlineEarned:    0,
  rafId:            null,
};

// ── Init ──────────────────────────────────────────────
function initGame() {
  const saved = loadGame();

  if (saved) {
    G.capital         = saved.capital         ?? 0;
    G.totalEarned     = saved.totalEarned     ?? 0;
    G.activeJob       = saved.activeJob       ?? 'beggar';
    G.unlockedJobs    = saved.unlockedJobs    ?? ['beggar'];
    G.ownedBusinesses = saved.ownedBusinesses ?? [];

    // Offline earnings
    if (saved.savedAt && G.ownedBusinesses.length > 0) {
      const offline = calcOfflineEarnings(G.ownedBusinesses, saved.savedAt);
      if (offline > 0) {
        G.capital     += offline;
        G.offlineEarned = offline;
      }
    }
  }

  // Start all owned business timers
  G.ownedBusinesses.forEach(bizId => _startBizTimer(bizId));

  // Auto-save every 30 s
  setInterval(() => saveGame(G), 30_000);

  // Animation loop for progress bars
  G.rafId = requestAnimationFrame(_tick);

  renderAll();

  // Show offline modal after first render
  if (G.offlineEarned > 0) showOfflineModal(G.offlineEarned);
}

// ── rAF tick (progress bars only) ─────────────────────
function _tick() {
  updateBizProgress();
  G.rafId = requestAnimationFrame(_tick);
}

// ── Actions ───────────────────────────────────────────
function doAction(actionId) {
  const job    = JOBS[G.activeJob];
  const action = job?.actions.find(a => a.id === actionId);
  if (!action) return;

  const earned = _rand(action.minIncome, action.maxIncome);
  _addCapital(earned);

  // Spawn floating text near the tapped button
  const btn = document.getElementById('action-' + actionId);
  spawnFloat('+' + fmt(earned), btn);

  saveGame(G);
  renderStats();
  renderUnlockSection();
  renderBusinessSection();
}

// ── Jobs ──────────────────────────────────────────────
function switchJob(jobId) {
  if (!G.unlockedJobs.includes(jobId)) return;
  G.activeJob = jobId;
  renderJobSection();
  renderHeaderBadge();
}

function unlockJob(jobId) {
  const job = JOBS[jobId];
  if (!job)                               return;
  if (G.unlockedJobs.includes(jobId))    return;
  if (G.capital < job.unlockCost)        return;

  G.capital   -= job.unlockCost;
  G.unlockedJobs.push(jobId);
  G.activeJob  = jobId;

  saveGame(G);
  renderAll();
}

// ── Businesses ────────────────────────────────────────
function buyBusiness(bizId) {
  const biz = BUSINESSES[bizId];
  if (!biz)                                  return;
  if (G.ownedBusinesses.includes(bizId))     return;
  if (G.capital < biz.cost)                  return;

  G.capital -= biz.cost;
  G.ownedBusinesses.push(bizId);
  _startBizTimer(bizId);

  saveGame(G);
  renderStats();
  renderBusinessSection();
  renderUnlockSection();
}

function _startBizTimer(bizId) {
  const biz = BUSINESSES[bizId];
  if (!biz) return;

  // Track progress for the bar
  G.bizProgress[bizId] = { startMs: Date.now(), intervalMs: biz.intervalMs };

  G.bizTimers[bizId] = setInterval(() => {
    const earned = _rand(biz.minIncome, biz.maxIncome);
    _addCapital(earned);
    G.bizProgress[bizId].startMs = Date.now();

    spawnBizFloat(bizId, '+' + fmt(earned));
    renderStats();
    renderBusinessSection();
    renderUnlockSection();
    saveGame(G);
  }, biz.intervalMs);
}

// ── Helpers ───────────────────────────────────────────
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
    const biz = BUSINESSES[bizId];
    const avg = (biz.minIncome + biz.maxIncome) / 2;
    total += avg / (biz.intervalMs / 1000);
  });
  return total;
}

// ── Number formatter ──────────────────────────────────
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