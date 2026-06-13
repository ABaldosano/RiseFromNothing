// ============================
// RISE FROM NOTHING — AUDIO v3
// Minimal WebAudio placeholder SFX (<1s, replaceable)
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
  } catch (e) { /* audio unavailable */ }
}

function playClick()        { _beep(800, 0.05, 'square', 0.10); }
function playCoin()          { _beep(1200, 0.12, 'square', 0.14, 1800); }
function playPurchase()       { _beep(440, 0.18, 'sawtooth', 0.14, 660); }
function playUpgrade()         { _beep(523, 0.25, 'triangle', 0.16, 1046); }
function playTaskComplete()     { _beep(660, 0.10, 'sine', 0.12, 880); }

// unlock audio on first user gesture (mobile autoplay policies)
function _unlockAudio() {
  _ctx();
  window.removeEventListener('pointerdown', _unlockAudio);
  window.removeEventListener('keydown', _unlockAudio);
}
window.addEventListener('pointerdown', _unlockAudio);
window.addEventListener('keydown', _unlockAudio);
