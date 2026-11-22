if (!globalThis.browser && globalThis.chrome) globalThis.browser = chrome;
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  const go = (mode, page) => browser.storage.local.set({ uiMode: mode }).then(() => { location.href = page; });
  $('mSeason').onclick = () => go('season', 'season.html');
  $('mDraft').onclick = () => go('draft', 'panel.html');
  const TICK = '<svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5 8.5 14 15 7" fill="none" stroke="var(--bg)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  browser.storage.local.get(null).then(all => {
    // the full animation once; a quicker one on every open after that
    if (all.landingSeen) document.body.classList.add('quick'); else browser.storage.local.set({ landingSeen: Date.now() });
    const k = all.landingSeen ? 0.35 : 1;
    // each league's last sync, from the same records the panel's status line reads
    const lgs = Object.keys(all).filter(x => x.startsWith('yr:')).map(x => all[x]).filter(y => y && y.league);
    const st = y => all['sync:' + y.lid] || null; const busy = all.syncLock && Date.now() - (all.syncLock.ts || 0) < 3 * 60e3;
    $('stN').textContent = lgs.length ? lgs.length + ' league' + (lgs.length === 1 ? '' : 's') : '';
    if (busy) { $('stT').textContent = 'Syncing Basketball Monster and Yahoo'; $('stBar').classList.add('run'); }
    $('lgs').innerHTML = lgs.length ? lgs.map((y, i) => { const s = st(y); const ok = s && s.ok;
      return `<div class="lg" style="animation-delay:${((3 + i * 0.5) * k).toFixed(2)}s"><div>${esc(y.league)}<small>${s ? (ok ? 'Synced ' : 'Last sync attempt ') + ago(s.ts) : 'Not synced yet'}</small></div><span class="${ok ? 'ok' : 'no'}" role="img" aria-label="${ok ? 'Synced' : 'Needs a sync'}">${ok ? TICK : ''}</span></div>`; }).join('')
      : '<div class="lg" style="animation-delay:0s">Open your team page on Yahoo once and the co-pilot finds your leagues.</div>';
    const syncs = lgs.map(st).filter(Boolean); if (syncs.length) $('sSeason').textContent = 'Numbers from Basketball Monster · last synced ' + ago(Math.max(...syncs.map(s => s.ts || 0)));
    if (all.mdfLive && all.mdfLive.ts) $('sDraft').textContent = 'Last draft room seen ' + ago(all.mdfLive.ts);
  }).catch(() => {});
})();
