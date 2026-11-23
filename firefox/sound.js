// Sixth Man landing sounds (8.0.3), all made here with Web Audio: nothing to download, so they're instant.
// squeak (court shoes), bounce (the ball), whistle (bar full), swish + cheer (Let's play). The cheer is a recording; the rest are made in code.
// Browsers only allow sound after a tap on the page; until then SND.at() plays nothing (it never queues stale sounds).
(function () {
  let C = null, out = null, NB = null, CB = null;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // iPhone: play with the ring switch off (iOS 17+)
  const ac = () => { if (!C) { C = new (window.AudioContext || window.webkitAudioContext)(); const comp = C.createDynamicsCompressor(); out = C.createGain(); out.gain.value = 0.8; out.connect(comp); comp.connect(C.destination); } return C; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const filt = (type, f, q) => { const b = C.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  // attack / hold / release on a gain; returns when it's silent
  const env = (g, t, a, peak, hold, rel) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel); return t + a + hold + rel; };
  const noise = () => { if (!NB) { NB = C.createBuffer(1, C.sampleRate * 2, C.sampleRate); const x = NB.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1; } const s = C.createBufferSource(); s.buffer = NB; s.loop = true; return s; };
  const S = {
    // a sneaker on hardwood: a rubbery saw tone that jumps up and settles, with a fast judder
    squeak(t, f0) { f0 = f0 || 950; const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.05); o.frequency.exponentialRampToValueAtTime(f0 * 1.45, t + 0.13);
      const v = C.createOscillator(), vd = C.createGain(); v.frequency.value = 55; vd.gain.value = f0 * 0.05; v.connect(vd); vd.connect(o.frequency);
      const g = C.createGain(); const end = env(g, t, 0.008, 0.55, 0.07, 0.06); chain(o, filt('bandpass', 2400, 2.5), filt('highpass', 800), g, out); o.start(t); v.start(t); o.stop(end); v.stop(end); },
    // the ball on the floor: a falling low thump, the floor's slap and the ball's hollow ping (v: how hard)
    bounce(t, v) { v = v || 1; const o = C.createOscillator(); o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.12); const g = C.createGain(); chain(o, g, out); o.start(t); o.stop(env(g, t, 0.003, 0.9 * v, 0, 0.18));
      const r = C.createOscillator(); r.frequency.value = 440; const rg = C.createGain(); chain(r, rg, out); r.start(t); r.stop(env(rg, t, 0.002, 0.1 * v, 0, 0.14));
      const n = noise(), ng = C.createGain(); chain(n, filt('lowpass', 1500), ng, out); n.start(t); n.stop(env(ng, t, 0.001, 0.6 * v, 0, 0.035)); },
    // one short referee's blast: two close tones with the pea's warble
    whistle(t) { const g = C.createGain(); g.connect(out); const end = env(g, t, 0.015, 0.13, 0.36, 0.05); // about 0.4 s
      [2950, 3110].forEach(f => { const o = C.createOscillator(), l = C.createOscillator(), d = C.createGain(); o.frequency.value = f; l.frequency.value = 28; d.gain.value = 130; l.connect(d); d.connect(o.frequency); o.connect(g); o.start(t); l.start(t); o.stop(end); l.stop(end); }); },
    // nothing but net: a bright air sweep falling in pitch, twice (ball, then the net snapping back)
    swish(t) { [[0, 1], [0.06, 0.55]].forEach(([dt, a]) => { const n = noise(), bp = filt('bandpass', 6500, 1); bp.frequency.setValueAtTime(6500, t + dt); bp.frequency.exponentialRampToValueAtTime(2000, t + dt + 0.28);
      const g = C.createGain(); chain(n, bp, filt('highpass', 1200), g, out); n.start(t + dt); n.stop(env(g, t + dt, 0.03, 0.5 * a, 0.05, 0.22)); }); },
    // the crowd: a real recording (sounds/cheer.mp3, "Short crowd cheer" by Driken5482, Pixabay Content License), faded out at the end
    cheer(t) { if (!CB) return; const s = C.createBufferSource(); s.buffer = CB; const g = C.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.setValueAtTime(0.9, t + 1.35); g.gain.linearRampToValueAtTime(0.0001, t + 1.65); chain(s, g, out); s.start(t); s.stop(t + 1.7); }
  };
  window.SND = {
    on: () => !!C && C.state === 'running',
    // call inside a tap: wakes sound up (a silent sample too, for older iPhones)
    unlock() { try { ac(); const s = C.createBufferSource(); s.buffer = C.createBuffer(1, 1, 22050); s.connect(C.destination); s.start(0); if (C.state !== 'running') C.resume(); } catch (e) {} },
    // play a sound in `dt` seconds, only if sound is already allowed
    at(name, dt, ...a) { try { if (!C || C.state !== 'running') return false; S[name](C.currentTime + Math.max(0.01, dt || 0), ...a); return true; } catch (e) { return false; } }
  };
  try { ac(); if (C.state !== 'running') C.resume().catch(() => {}); } catch (e) {}
  // the cheer is decoded once on open, so Let's play has it ready
  try { fetch('sounds/cheer.mp3').then(r => r.arrayBuffer()).then(b => new Promise((ok, no) => C.decodeAudioData(b, ok, no))).then(b => { CB = b; }, () => {}); } catch (e) {} // where a page may start sound by itself, it does
})();
