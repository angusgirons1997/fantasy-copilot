if (!globalThis.browser && globalThis.chrome) globalThis.browser = chrome;
(function () {
  const $ = id => document.getElementById(id);
  const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  // ---- the whistle and crowd cheer when the connection checks out: made right here with Web Audio (nothing to download, so it's
  // instant). Browsers only allow sound after a tap, so if it's blocked it plays on your first tap instead. ----
  let AC = null; const ctx = () => AC || (AC = new (window.AudioContext || window.webkitAudioContext)());
  function whistle(C, t) { const g = C.createGain(); g.connect(C.destination); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.02); g.gain.setValueAtTime(0.16, t + 0.42); g.gain.linearRampToValueAtTime(0, t + 0.5);
    // a pea whistle: two close tones with a fast warble from the pea
    [2950, 3120].forEach(f => { const o = C.createOscillator(), l = C.createOscillator(), d = C.createGain(); o.frequency.value = f; l.frequency.value = 27; d.gain.value = 140;
      l.connect(d); d.connect(o.frequency); o.connect(g); o.start(t); l.start(t); o.stop(t + 0.52); l.stop(t + 0.52); }); }
  function crowd(C, t) { const n = 2.8, b = C.createBuffer(1, C.sampleRate * n, C.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1;
    const s = C.createBufferSource(); s.buffer = b; const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.6;
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; const g = C.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.45); g.gain.setValueAtTime(0.5, t + 1.3); g.gain.exponentialRampToValueAtTime(0.001, t + n);
    // voices rise and fall: a slow wobble on the volume
    const w = C.createOscillator(), wd = C.createGain(); w.frequency.value = 3.3; wd.gain.value = 0.12; w.connect(wd); wd.connect(g.gain);
    s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(C.destination); s.start(t); w.start(t); s.stop(t + n); w.stop(t + n); }
  let played = false, pending = false;
  const play = () => { if (played) return true; try { const C = ctx(); if (C.state !== 'running') return false; const t = C.currentTime + 0.05; whistle(C, t); crowd(C, t + 0.35); played = true; return true; } catch (e) { return true; } };
  const tryPlay = () => { try { const C = ctx(); (C.state === 'running' ? Promise.resolve() : C.resume()).then(() => { if (!play()) pending = true; }, () => { pending = true; }); setTimeout(() => { if (!played) pending = true; }, 300); } catch (e) {} };
  addEventListener('pointerdown', () => { if (pending && !played) { ctx().resume().then(play).catch(() => {}); } }, { capture: true });
  const go = (mode, page) => browser.storage.local.set({ uiMode: mode }).then(() => { setTimeout(() => { location.href = page; }, pending && !played ? 550 : 0); });
  $('mSeason').onclick = () => go('season', 'season.html');
  $('mDraft').onclick = () => { pending = false; go('draft', 'panel.html'); };
  // ---- the connection check: the bar fills as the latest Yahoo and Basketball Monster copy is read; green when the background
  // sync is current (within 40 minutes), amber when it's late (on the phone: the PC may be asleep) ----
  const bar = $('stBar'); let P = 0; const set = p => { if (p > P) { P = p; bar.style.setProperty('--p', p); } }; // only ever fills forward
  requestAnimationFrame(() => set(0.35));
  const onPhone = /^https?:/.test(location.protocol);
  browser.storage.local.get(null).then(all => { const pc = !onPhone || Object.keys(all).length > 0; // the phone's copy comes from the PC: none means the PC can't be reached
    if (all.landingSeen) document.body.classList.add('quick'); else browser.storage.local.set({ landingSeen: Date.now() });
    const ls = Object.keys(all).filter(x => x.startsWith('yr:')).map(x => all[x]).filter(y => y && y.league);
    const sy = ls.map(y => all['sync:' + y.lid]).filter(Boolean); const last = sy.length ? Math.max(...sy.map(s => s.ts || 0)) : 0;
    const live = pc && last && Date.now() - last < 40 * 60e3 && sy.every(s => s.ok);
    setTimeout(() => { set(1); bar.classList.add(live ? 'live' : 'stale');
      setTimeout(() => {
        $('stT').innerHTML = `<i class="dot ${live ? 'd-good' : 'd-warn'}"></i>${live ? 'Live' : !pc ? "Can't reach the PC" : 'Catching up'}`;
        $('stN').textContent = !pc ? 'showing the last copy' : last ? 'updated ' + ago(last) : 'not synced yet';
        if (live) tryPlay(); }, 600); }, document.body.classList.contains('quick') ? 350 : 1600);
    if (all.mdfLive && all.mdfLive.ts) $('sDraft').textContent = 'Last draft room seen ' + ago(all.mdfLive.ts);
  }).catch(() => {});
})();
