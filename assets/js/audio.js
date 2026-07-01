// ============================
// RISE FROM NOTHING — AUDIO v4
// ============================

let _actx = null;
function _ctx() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  if (_actx.state === 'suspended') _actx.resume();
  return _actx;
}

function _beep(freq, duration, type, vol, slideTo) {
  try {
    const ctx  = _ctx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    gain.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function playClick()       { _beep(800,  0.05, 'square',   0.10); }
function playCoin()        { _beep(1200, 0.12, 'square',   0.14, 1800); }
function playPurchase()    { _beep(440,  0.18, 'sawtooth', 0.14, 660); }
function playUpgrade()     { _beep(523,  0.25, 'triangle', 0.16, 1046); }
function playTaskComplete(){ _beep(660,  0.10, 'sine',     0.12, 880); }

function playDumpAll() {
  for (let i = 0; i < 10; i++) {
    setTimeout(() => _beep(1200, 0.12, 'square', 0.14, 1800), i * 55);
  }
}

// ── Background Music Manager ──────────────────────────────────
// Future asset: assets/audio/music/main_theme.mp3
// Replace by dropping the file — no code changes needed.
const Music = (() => {
  let _gain   = null;
  let _source = null;
  let _vol    = 0.18;
  let _active = false;

  // Procedural ambient placeholder: stacked sine drones (A-minor chord)
  function _buildPlaceholder(ctx) {
    const sr  = ctx.sampleRate;
    const len = sr * 8; // 8-second loop
    const buf = ctx.createBuffer(2, len, sr);
    const freqs = [110, 138.6, 165, 220, 277.2]; // Am chord harmonics
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        let s = 0;
        const t = i / sr;
        freqs.forEach((f, idx) => {
          const detune = ch === 1 ? 1.001 : 1; // slight stereo spread
          s += Math.sin(2 * Math.PI * f * detune * t) * (0.06 / (idx + 1));
        });
        // slow tremolo
        s *= 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.2 * t);
        // fade edges to prevent loop click
        const fade = Math.min(i / (sr * 0.1), 1, (len - i) / (sr * 0.1));
        d[i] = s * fade;
      }
    }
    return buf;
  }

  function _playBuffer(buf) {
    const ctx = _ctx();
    if (_source) { try { _source.stop(); } catch (e) {} _source = null; }
    const src = ctx.createBufferSource();
    src.buffer  = buf;
    src.loop    = true;
    src.connect(_gain);
    src.start();
    _source = src;
    _active = true;
  }

  function _tryRealAsset() {
    // Silently try to load the real music file; swap in if found
    fetch('assets/audio/music/main_theme.mp3')
      .then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
      .then(ab => _ctx().decodeAudioData(ab))
      .then(buf => { if (_active) _playBuffer(buf); })
      .catch(() => {}); // placeholder stays on failure
  }

  function start() {
    if (_active) return;
    const ctx = _ctx();
    _gain = ctx.createGain();
    _gain.gain.setValueAtTime(_vol, ctx.currentTime);
    _gain.connect(ctx.destination);
    _tryRealAsset();
    _playBuffer(_buildPlaceholder(ctx)); // plays immediately; replaced if asset found
  }

  function pause() {
    if (!_active || !_gain) return;
    _gain.gain.linearRampToValueAtTime(0, _ctx().currentTime + 0.5);
    _active = false;
  }

  function resume() {
    if (_active || !_gain) return;
    _gain.gain.linearRampToValueAtTime(_vol, _ctx().currentTime + 0.5);
    _active = true;
  }

  function setVolume(v) {
    _vol = Math.max(0, Math.min(1, v));
    if (_gain) _gain.gain.setValueAtTime(_vol, _ctx().currentTime);
  }

  return { start, pause, resume, setVolume };
})();

// ── Footstep SFX Manager ──────────────────────────────────────
// Future assets: assets/audio/sfx/footstep_01.wav … footstep_04.wav
// Drop files in — no code changes needed.
const Footsteps = (() => {
  const _timers  = {}; // entityId → elapsed
  const _assets  = []; // populated if real .wav files found
  const _PATHS   = [
    'assets/audio/sfx/footstep_01.wav',
    'assets/audio/sfx/footstep_02.wav',
    'assets/audio/sfx/footstep_03.wav',
    'assets/audio/sfx/footstep_04.wav',
  ];
  const INTERVALS = { walk: 0.44, run: 0.24 };

  // Try loading real assets (fire-and-forget)
  function _loadAssets() {
    _PATHS.forEach(path => {
      fetch(path)
        .then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
        .then(ab => _ctx().decodeAudioData(ab))
        .then(buf => _assets.push(buf))
        .catch(() => {});
    });
  }

  // Procedural footstep: short filtered noise burst
  function _playStep(isRun) {
    try {
      const ctx = _ctx();
      if (_assets.length) {
        // Use real asset if loaded
        const buf  = _assets[Math.floor(Math.random() * _assets.length)];
        const src  = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = buf;
        gain.gain.setValueAtTime(isRun ? 0.12 : 0.08, ctx.currentTime);
        src.connect(gain); gain.connect(ctx.destination);
        src.start();
        return;
      }
      // Procedural fallback
      const len  = Math.floor(ctx.sampleRate * 0.055);
      const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      }
      const src  = ctx.createBufferSource();
      const filt = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      filt.type      = 'bandpass';
      filt.frequency.value = isRun ? 900 : 600;
      filt.Q.value   = 0.8;
      gain.gain.setValueAtTime(isRun ? 0.11 : 0.07, ctx.currentTime);
      src.buffer = buf;
      src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch (e) {}
  }

  // Call once per frame for each moving entity
  function tick(entityId, avatarState, dt) {
    const moving = avatarState === 'walk' || avatarState === 'run';
    if (!_timers[entityId]) _timers[entityId] = 0;
    if (!moving) { _timers[entityId] = 0; return; }
    _timers[entityId] += dt;
    const interval = avatarState === 'run' ? INTERVALS.run : INTERVALS.walk;
    if (_timers[entityId] >= interval) {
      _timers[entityId] = 0;
      _playStep(avatarState === 'run');
    }
  }

  function remove(entityId) { delete _timers[entityId]; }

  // Kick off asset loading (silent fail)
  setTimeout(_loadAssets, 500);

  return { tick, remove };
})();

// ── Audio unlock (mobile autoplay policy) ─────────────────────
function _unlockAudio() {
  Music.start();
  window.removeEventListener('pointerdown', _unlockAudio);
  window.removeEventListener('keydown',     _unlockAudio);
}
window.addEventListener('pointerdown', _unlockAudio);
window.addEventListener('keydown',     _unlockAudio);