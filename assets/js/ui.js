// ============================
// RISE FROM NOTHING — UI  v2
// ============================

const LEVEL_NAMES = ['', 'Basic Staff', 'Trained Staff', 'Expert Staff'];

// ── Master render ─────────────────────────────────────
function renderAll() {
  renderStats();
  renderHeaderBadge();
  renderJobSection();
  renderUnlockSection();
  renderBusinessSection();
}

// ── Header ────────────────────────────────────────────
function renderStats() {
  document.getElementById('capital-display').textContent = fmt(G.capital);
  document.getElementById('total-earned').textContent    = fmt(G.totalEarned);
  document.getElementById('income-per-sec').textContent  = fmtRate(getIncomePerSec());
}

function renderHeaderBadge() {
  const job = JOBS[G.activeJob];
  document.getElementById('current-job-name').textContent = job?.name ?? '';
}

// ── Job Section ───────────────────────────────────────
function renderJobSection() {
  _renderJobTabs();
  _renderActions();
}

function _renderJobTabs() {
  const wrap = document.getElementById('job-tabs');
  wrap.innerHTML = '';
  G.unlockedJobs.forEach(jobId => {
    const job = JOBS[jobId];
    const btn = document.createElement('button');
    btn.className   = 'job-tab' + (jobId === G.activeJob ? ' active' : '');
    btn.textContent = job.emoji + ' ' + job.name;
    btn.onclick     = () => switchJob(jobId);
    wrap.appendChild(btn);
  });
}

function _renderActions() {
  const grid = document.getElementById('actions-grid');
  grid.innerHTML = '';
  const job = JOBS[G.activeJob];
  if (!job) return;
  job.actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.id        = 'action-' + action.id;
    btn.innerHTML = `
      <span class="action-name">${action.name}</span>
      <span class="action-income">${CURRENCY}${action.minIncome}–${CURRENCY}${action.maxIncome}</span>
    `;
    btn.onclick = () => doAction(action.id);
    grid.appendChild(btn);
  });
}

// ── Unlock Section ────────────────────────────────────
function renderUnlockSection() {
  const list   = document.getElementById('unlock-list');
  list.innerHTML = '';
  const locked = JOB_ORDER.filter(id => !G.unlockedJobs.includes(id));

  if (locked.length === 0) {
    list.innerHTML = '<p class="all-unlocked">All career upgrades unlocked! 🎉</p>';
    return;
  }

  locked.forEach(jobId => {
    const job       = JOBS[jobId];
    const progress  = Math.min(G.capital / job.unlockCost, 1);
    const canAfford = G.capital >= job.unlockCost;
    const maxJob    = job.actions.reduce((a, b) => Math.max(a, b.maxIncome), 0);

    const card = document.createElement('div');
    card.className = 'unlock-card';
    card.innerHTML = `
      <div class="unlock-left">
        <span class="unlock-emoji">${job.emoji}</span>
        <div class="unlock-info">
          <div class="unlock-name">${job.name}</div>
          <div class="unlock-desc">${job.description}</div>
          <div class="unlock-income">Up to ${CURRENCY}${maxJob} per tap</div>
          <div class="unlock-progress">
            <div class="unlock-progress-fill" style="width:${(progress * 100).toFixed(1)}%"></div>
          </div>
          <div class="unlock-cost-label">${fmt(G.capital)} / ${fmt(job.unlockCost)}</div>
        </div>
      </div>
      <button class="btn-unlock" onclick="unlockJob('${jobId}')" ${canAfford ? '' : 'disabled'}>
        ${canAfford ? 'HIRE' : fmt(job.unlockCost)}
      </button>
    `;
    list.appendChild(card);
  });
}

// ── Business Section ──────────────────────────────────
function renderBusinessSection() {
  const grid = document.getElementById('business-grid');
  grid.innerHTML = '';

  BIZ_ORDER.forEach(bizId => {
    const biz       = BUSINESSES[bizId];
    const owned     = G.ownedBusinesses.includes(bizId);
    const canAfford = !owned && G.capital >= biz.cost;

    const card = document.createElement('div');
    card.className = 'business-card' + (owned ? ' owned' : '');
    card.id        = 'biz-card-' + bizId;

    const intervalSec = (biz.intervalMs / 1000).toFixed(0);
    const rateLabel   = `${CURRENCY}${biz.minIncome}–${CURRENCY}${biz.maxIncome} / ${intervalSec}s`;

    let footer = '';
    if (owned) {
      const wCount    = G.workers[bizId]     || 0;
      const wLevel    = G.workerLevel[bizId] || 1;
      const hireCost  = _workerHireCost(bizId);
      const canHire   = wCount < biz.workerMax && G.capital >= hireCost;
      const maxed     = wCount >= biz.workerMax;
      const canUpgrade   = wLevel < 3 && G.capital >= biz.upgradeCosts[wLevel - 1];
      const upgradeMaxed = wLevel >= 3;
      const upgradeCost  = wLevel < 3 ? biz.upgradeCosts[wLevel - 1] : 0;

      // effective income range with current workers/level
      const workerMult = 1 + wCount * biz.workerBonus;
      const levelMult  = [1, 1.5, 2][wLevel - 1];
      const effMin = Math.floor(biz.minIncome * workerMult * levelMult);
      const effMax = Math.floor(biz.maxIncome * workerMult * levelMult);

      footer = `
        <div class="biz-timer-wrap">
          <div class="biz-timer-bar">
            <div class="biz-timer-fill" id="biz-bar-${bizId}" style="width:0%"></div>
          </div>
        </div>
        <div class="worker-section">
          <div class="worker-row">
            <div class="worker-info">
              <span class="worker-label">👷 Workers</span>
              <span class="worker-count">${wCount} / ${biz.workerMax}</span>
            </div>
            <button class="btn-worker ${canHire ? 'can-afford' : ''}"
              onclick="hireWorker('${bizId}')"
              ${canHire ? '' : 'disabled'}>
              ${maxed ? 'MAXED' : 'HIRE ' + fmt(hireCost)}
            </button>
          </div>
          <div class="worker-row">
            <div class="worker-info">
              <span class="worker-label">⭐ Staff Level</span>
              <span class="worker-level-badge lv${wLevel}">${LEVEL_NAMES[wLevel]}</span>
            </div>
            <button class="btn-worker ${canUpgrade ? 'can-afford' : ''}"
              onclick="upgradeWorkers('${bizId}')"
              ${canUpgrade ? '' : 'disabled'}>
              ${upgradeMaxed ? 'MAX LV' : 'UPGRADE ' + fmt(upgradeCost)}
            </button>
          </div>
          <div class="worker-effective">
            Effective: ${CURRENCY}${effMin.toLocaleString()}–${CURRENCY}${effMax.toLocaleString()} / ${intervalSec}s
          </div>
        </div>`;
    } else {
      footer = `
        <button class="btn-buy ${canAfford ? 'can-afford' : ''}"
          onclick="buyBusiness('${bizId}')"
          ${canAfford ? '' : 'disabled'}>
          ${canAfford ? '✓ BUY — ' + fmt(biz.cost) : 'NEED ' + fmt(biz.cost)}
        </button>`;
    }

    card.innerHTML = `
      <div class="business-header">
        <span class="business-emoji">${biz.emoji}</span>
        <div class="business-info">
          <div class="business-name">${biz.name}</div>
          <div class="business-rate">${rateLabel}</div>
          <div class="business-desc">${biz.description}</div>
        </div>
        ${owned ? '<span class="business-owned-badge">OWNED</span>' : ''}
      </div>
      ${footer}
    `;
    grid.appendChild(card);
  });
}

// Progress bars
function updateBizProgress() {
  G.ownedBusinesses.forEach(bizId => {
    const prog = G.bizProgress[bizId];
    const bar  = document.getElementById('biz-bar-' + bizId);
    if (!prog || !bar) return;
    const elapsed = Date.now() - prog.startMs;
    bar.style.width = (Math.min(elapsed / prog.intervalMs, 1) * 100).toFixed(1) + '%';
  });
}

// ── Floating Text ─────────────────────────────────────
function spawnFloat(text, anchorEl) {
  const container = document.getElementById('float-container');
  const el        = document.createElement('div');
  el.className    = 'float-text';
  el.textContent  = text;

  if (anchorEl) {
    const rect    = anchorEl.getBoundingClientRect();
    el.style.left = (rect.left + rect.width / 2 - 30) + 'px';
    el.style.top  = (rect.top - 10) + 'px';
  } else {
    el.style.left = '50%';
    el.style.top  = '40%';
  }

  container.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function spawnBizFloat(bizId, text) {
  const card = document.getElementById('biz-card-' + bizId);
  spawnFloat(text, card);
}

// ── Offline Modal ─────────────────────────────────────
function showOfflineModal(earned) {
  document.getElementById('offline-amount').textContent = '+' + fmt(earned);
  document.getElementById('offline-modal').classList.remove('hidden');
}

function closeOfflineModal() {
  document.getElementById('offline-modal').classList.add('hidden');
}

// ── Reset ─────────────────────────────────────────────
function resetGame() {
  if (!confirm('Wipe all progress and start over?')) return;
  Object.values(G.bizTimers).forEach(clearInterval);
  cancelAnimationFrame(G.rafId);
  deleteSave();
  location.reload();
}