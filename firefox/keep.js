// Safety copy of the few things the co-pilot can't rebuild by itself (which leagues and teams are yours, your settings),
// kept in the browser's separate "sync" storage. If the add-on's main storage is ever emptied (a browser setting that clears
// site data on close, a reinstall), these are put back on the next start and everything else re-downloads by itself.
// Your Basketball Monster sign-in is only copied here if you tick that option in Settings.
(function (root) {
  const A = (root.browser && root.browser.storage) ? root.browser : root.chrome;
  const L = A.storage.local, S = A.storage.sync;
  const KEY = 'copilotKeep';
  async function backup() {
    try { const o = await L.get(['leagueList', 'activeLeague', 'ymine', 'installId', 'bbmAuth', 'bbmAuthKeep']); const ls = o.leagueList || []; if (!ls.length && !o.ymine) return;
      const ss = await L.get(ls.map(l => 'sset:' + l.league)); const sset = {}; Object.entries(ss).forEach(([k, v]) => { if (v && JSON.stringify(v).length < 1500) sset[k] = v; });
      let id = o.installId; if (!id) { id = Math.random().toString(36).slice(2); await L.set({ installId: id }); }
      const keep = { v: 1, ts: Date.now(), installId: id, leagues: ls.map(l => ({ lid: l.lid, tid: l.tid, league: l.league })), ymine: o.ymine || {}, activeLeague: o.activeLeague || null, sset };
      if (o.bbmAuthKeep && o.bbmAuth && o.bbmAuth.user) { keep.bbmAuth = { user: o.bbmAuth.user, pass: o.bbmAuth.pass }; keep.bbmAuthKeep = true; }
      if (JSON.stringify(keep).length > 7500) keep.sset = {};
      await S.set({ [KEY]: keep });
    } catch (e) { console.warn('co-pilot backup', e); }
  }
  // returns true if something was put back
  async function restore() {
    try { const k = (await S.get(KEY))[KEY]; if (!k) return false; const o = await L.get(['leagueList', 'installId', 'ymine', 'bbmAuth']);
      if (k.bbmAuth && !o.bbmAuth) await L.set({ bbmAuth: k.bbmAuth, bbmAuthKeep: true });
      if ((o.leagueList && o.leagueList.length) || (o.ymine && Object.keys(o.ymine).length)) return false;
      const put = { leagueList: k.leagues || [], ymine: k.ymine || {}, installId: k.installId, wiped: { ts: Date.now(), lastBackup: k.ts } };
      if (k.activeLeague) put.activeLeague = k.activeLeague; Object.assign(put, k.sset || {});
      await L.set(put); return true;
    } catch (e) { console.warn('co-pilot restore', e); return false; }
  }
  let last = 0; const soon = () => { if (Date.now() - last < 30 * 60e3) return; last = Date.now(); backup(); };
  A.storage.onChanged.addListener((ch, area) => { if (area === 'local' && (ch.leagueList || ch.activeLeague || ch.ymine || ch.bbmAuth || ch.bbmAuthKeep || Object.keys(ch).some(x => x.startsWith('sset:')))) { last = 0; setTimeout(soon, 2000); } });
  root.KEEP = { backup, restore };
})(globalThis);
