if (!globalThis.browser && globalThis.chrome) globalThis.browser = chrome;
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  const go = (mode, page) => browser.storage.local.set({ uiMode: mode }).then(() => { location.href = page; });
  $('mSeason').onclick = () => go('season', 'season.html');
  $('mDraft').onclick = () => go('draft', 'panel.html');
  browser.storage.local.get(null).then(all => {
    // the full animation once; a quicker one on every open after that
    if (all.landingSeen) document.body.classList.add('quick'); else browser.storage.local.set({ landingSeen: Date.now() });
    const k = all.landingSeen ? 0.35 : 1;
    // each league's last sync, from the same records the panel's status line reads
    const lgs = Object.keys(all).filter(x => x.startsWith('yr:')).map(x => all[x]).filter(y => y && y.league);
    const st = y => all['sync:' + y.lid] || null; const busy = all.syncLock && Date.now() - (all.syncLock.ts || 0) < 3 * 60e3;
    $('stN').textContent = lgs.length ? lgs.length + ' league' + (lgs.length === 1 ? '' : 's') : '';
    if (busy) { $('stT').textContent = 'Updating in the background'; $('stBar').classList.add('run'); }
    $('lgs').innerHTML = lgs.length ? lgs.map((y, i) => { const s = st(y); const ok = s && s.ok;
      return `<div class="lg" style="animation-delay:${((3 + i * 0.5) * k).toFixed(2)}s"><div>${esc(y.league)}<small>${s ? (ok ? 'Updated ' : 'Last update tried ') + ago(s.ts) : 'Not synced yet'}</small></div><span class="${ok ? 'ok' : 'no'}" role="img" aria-label="${ok ? 'Synced' : 'Needs a sync'}"></span></div>`; }).join('')
      : '<div class="lg" style="animation-delay:0s">Open your team page on Yahoo once and the co-pilot finds your leagues.</div>';
    const syncs = lgs.map(st).filter(Boolean); if (syncs.length) $('sSeason').textContent = 'Numbers from Basketball Monster · updated in the background · last ' + ago(Math.max(...syncs.map(s => s.ts || 0)));
    if (all.mdfLive && all.mdfLive.ts) $('sDraft').textContent = 'Last draft room seen ' + ago(all.mdfLive.ts);
  }).catch(() => {});
})();
