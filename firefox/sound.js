// Sixth Man landing sounds (8.0.5): court squeaks as the lines draw, ball bounces as it lands, the whistle when the bar fills,
// the swish on Let's play. All four are recordings the owner picked: sounds/whistle.mp3 ("Referee whistle blow, gymnasium") and
// sounds/bounce.mp3 ("basketball"), both freesound_community on Pixabay (Pixabay Content License); sounds/squeak.mp3 and
// sounds/swish.mp3, files the owner supplied. Browsers only allow sound after a tap on the page; until then SND.at() plays nothing
// (it never queues stale sounds).
(function () {
  let C = null, out = null; const REC = {};
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // iPhone: play with the ring switch off (iOS 17+)
  const ac = () => { if (!C) { C = new (window.AudioContext || window.webkitAudioContext)(); const comp = C.createDynamicsCompressor(); out = C.createGain(); out.gain.value = 0.8; out.connect(comp); comp.connect(C.destination); } return C; };
  // a recording: from `start` in its file for `len` seconds, faded out over the last third (v: volume)
  const rec = (t, name, v, rate) => { const R = REC[name]; if (!R || !R.buf) return; const s = C.createBufferSource(); s.buffer = R.buf; s.playbackRate.value = rate || 1; const g = C.createGain(), a = v == null ? 1 : v;
    g.gain.setValueAtTime(a, t); g.gain.setValueAtTime(a, t + R.len * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + R.len); s.connect(g); g.connect(out); s.start(t, R.start, R.len + 0.05); };
  const S = {
    squeak(t, f0) { rec(t, 'squeak', 0.9, (f0 || 1000) / 1000); },
    bounce(t, v) { rec(t, 'bounce', v); },
    whistle(t) { rec(t, 'whistle', 0.9); },
    swish(t) { rec(t, 'swish', 1); }
  };
  window.SND = {
    on: () => !!C && C.state === 'running',
    // call inside a tap: wakes sound up (a silent sample too, for older iPhones)
    unlock() { try { ac(); const s = C.createBufferSource(); s.buffer = C.createBuffer(1, 1, 22050); s.connect(C.destination); s.start(0); if (C.state !== 'running') C.resume(); } catch (e) {} },
    // play a sound in `dt` seconds, only if sound is already allowed
    at(name, dt, ...a) { try { if (!C || C.state !== 'running') return false; S[name](C.currentTime + Math.max(0.01, dt || 0), ...a); return true; } catch (e) { return false; } }
  };
  try { ac(); if (C.state !== 'running') C.resume().catch(() => {}); } catch (e) {} // where a page may start sound by itself, it does
  // the recordings, decoded once on open. Where the sound sits in each file was measured once, so playback starts on the sound itself.
  [['whistle', 0.144, 1.0], ['bounce', 9.441, 0.5], ['squeak', 0.121, 0.7], ['swish', 0.402, 0.8]].forEach(([n, start, len]) => { REC[n] = { start, len };
    try { fetch('sounds/' + n + '.mp3').then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => C.decodeAudioData(b, ok, no))).then(b => { REC[n].buf = b; }, () => {}); } catch (e) {} });
})();
