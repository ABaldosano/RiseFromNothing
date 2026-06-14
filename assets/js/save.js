// ============================
// RISE FROM NOTHING — SAVE v4
// ============================

const SAVE_KEY = 'rfn_save_v1'; // keep key for compatibility

function saveGame(state) {
  try {
    const payload = {
      capital:         state.capital,
      totalEarned:     state.totalEarned,
      activeJob:       state.activeJob,
      unlockedJobs:    state.unlockedJobs,
      ownedBusinesses: state.ownedBusinesses,
      workers:         state.workers,
      workerLevel:     state.workerLevel,
      fleetLevel:      state.fleetLevel,   // v4
      savedAt:         Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Load failed:', e);
    return null;
  }
}

function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

function calcOfflineEarnings(ownedBusinesses, savedAt, workers, workerLevel, fleetLevel) {
  const now     = Date.now();
  const elapsed = Math.min(now - savedAt, OFFLINE_CAP);
  let   total   = 0;

  ownedBusinesses.forEach(bizId => {
    const biz = BUSINESSES[bizId];
    if (!biz) return;
    const ticks      = Math.floor(elapsed / biz.intervalMs);
    const avg        = (biz.minIncome + biz.maxIncome) / 2;
    const wCount     = (workers     && workers[bizId])     || 0;
    const wLevel     = (workerLevel && workerLevel[bizId]) || 1;
    const workerMult = 1 + wCount * biz.workerBonus;
    const levelMult  = [1, 1.5, 2][wLevel - 1];
    // v4: apply fleet multiplier for transport businesses
    const fLevel     = (fleetLevel  && fleetLevel[bizId])  || 1;
    const fleetMult  = biz.category === 'transport'
      ? [1, 1, 1.6, 2.5][fLevel] ?? 1
      : 1;
    total += ticks * avg * workerMult * levelMult * fleetMult;
  });

  return Math.floor(total);
}