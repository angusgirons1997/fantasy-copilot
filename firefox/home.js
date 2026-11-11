if (!globalThis.browser && globalThis.chrome) globalThis.browser = chrome;
(function () {
  const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  const go = (mode, page) => browser.storage.local.set({ uiMode: mode }).then(() => { location.href = page; });
  document.getElementById('mSeason').onclick = () => go('season', 'season.html');
  document.getElementById('mDraft').onclick = () => go('draft', 'panel.html');
  browser.storage.local.get(null).then(all => {
    const syncs = Object.keys(all).filter(k => k.startsWith('sync:')).map(k => all[k]).filter(Boolean);
    if (syncs.length) { const last = Math.max(...syncs.map(s => s.ts || 0)); document.getElementById('sSeason').textContent = (syncs.every(s => s.ok) ? 'Last synced ' : 'Last sync attempt ') + ago(last); }
    { const names = [...new Set(Object.keys(all).filter(k => k.startsWith('yr:')).map(k => all[k] && all[k].league).filter(Boolean))]; if (names.length) document.getElementById('lgList').textContent = names.join(' · '); }
    if (all.mdfLive && all.mdfLive.ts) document.getElementById('sDraft').textContent = 'Last draft room seen ' + ago(all.mdfLive.ts);
    document.getElementById(all.uiMode === 'draft' ? 'mDraft' : 'mSeason').classList.add('last');
  }).catch(() => {});
})();
