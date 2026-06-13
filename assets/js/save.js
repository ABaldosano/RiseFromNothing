// ============================
// RISE FROM NOTHING — SAVE v1
// ============================

const SAVE_KEY = 'rfn_save_v1';

function saveGame(state) {
  try {
    const payload = {
      capital:           state.capital,
      totalEarned:       state.totalEarned,
      activeJob:         state.activeJob,
      unlockedJobs:      state.unlockedJobs,
      ownedBusinesses:   state.ownedBusinesses,
      savedAt:           Date.now(),
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

/**
 * Calculate earnings from owned businesses during time offline.
 * Uses average income per tick, capped at OFFLINE_CAP ms.
 */
function calcOfflineEarnings(ownedBusinesses, savedAt) {
  const now      = Date.now();
  const elapsed  = Math.min(now - savedAt, OFFLINE_CAP);
  let   total    = 0;

  ownedBusinesses.forEach(bizId => {
    const biz = BUSINESSES[bizId];
    if (!biz) return;
    const ticks   = Math.floor(elapsed / biz.intervalMs);
    const avgTick = (biz.minIncome + biz.maxIncome) / 2;
    total += ticks * avgTick;
  });

  return Math.floor(total);
}