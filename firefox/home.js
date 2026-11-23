if (!globalThis.browser && globalThis.chrome) globalThis.browser = chrome;
(function () {
  const $ = id => document.getElementById(id);
  const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  // ---- sounds (sound.js), each on its own moment of the animation: court lines drawing = shoe squeaks, the ball landing = bounces,
  // the bar full = whistle, Let's play = swish then the crowd. Sound needs a tap first on most phones; a tap anywhere turns it on. ----
  const SND = window.SND || { on: () => false, unlock() {}, at() {} }; const secs = el => parseFloat(getComputedStyle(el).animationDuration) || 0;
  ['touchend', 'pointerdown'].forEach(ev => addEventListener(ev, () => SND.unlock(), { capture: true, passive: true }));
  const court = document.querySelector('.court path'); if (court) court.addEventListener('animationstart', () => { const d = secs(court); SND.at('squeak', 0.05, 900); SND.at('squeak', d * 0.42, 1180); SND.at('squeak', d * 0.78, 1020); });
  const ball = document.querySelector('.ball'); if (ball) ball.addEventListener('animationstart', e => { if (e.target !== ball) return; const d = secs(ball); SND.at('bounce', d * 0.55, 1); SND.at('bounce', d * 0.85, 0.45); }); // the drop keyframes land at 55% and 85%
  const go = (mode, page) => browser.storage.local.set({ uiMode: mode }).then(() => { location.href = page; });
  // Let's play: the swish and the crowd, then on to the page once they've had their moment
  const cheer = () => SND.at('swish', 0.02) && SND.at('cheer', 0.2);
  // (on the very first tap sound may take a moment to wake up, so one quick retry)
  $('mSeason').onclick = () => { SND.unlock(); const s = cheer(); const next = ok => setTimeout(() => go('season', 'season.html'), ok ? 1900 : 0); if (s) next(true); else setTimeout(() => next(cheer()), 80); };
  $('mDraft').onclick = () => go('draft', 'panel.html');
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
        SND.at('whistle', 0); }, 600); }, document.body.classList.contains('quick') ? 350 : 1600); // the whistle as the bar lands full
    if (all.mdfLive && all.mdfLive.ts) $('sDraft').textContent = 'Last draft room seen ' + ago(all.mdfLive.ts);
  }).catch(() => {});
})();
