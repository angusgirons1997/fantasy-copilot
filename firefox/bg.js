// Firefox background: the one place syncs run (the panel asks it), so two syncs never collide on Basketball Monster.
// Checks every 5 minutes whether anything is due, catches up after sleep or a restart, retries failures with growing gaps,
// and picks up straight away when you sign back in to Yahoo or Basketball Monster.
(function () {
  const L = browser.storage.local;
  // ---- updates: new versions are signed and listed on GitHub. Firefox installs them by itself (it checks about once a day, or
  // hourly with extensions.update.interval set to 3600). This also checks the list every hour, asks Firefox to look straight away
  // where it can, and tells the panel when a newer version exists so it can be installed in one tap. No listener on
  // onUpdateAvailable, so Firefox applies a downloaded update immediately. ----
  const UPD = 'https://raw.githubusercontent.com/angusgirons1997/fantasy-copilot/main/updates.json';
  const vnum = v => String(v || '0').split('.').map(Number).reduce((a, x) => a * 1000 + (x || 0), 0);
  async function checkUpdate() { try {
      if (browser.runtime.requestUpdateCheck) { try { await browser.runtime.requestUpdateCheck(); } catch (e) {} }
      const r = await fetch(UPD + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return; const j = await r.json();
      const id = (browser.runtime.getManifest().browser_specific_settings || {}).gecko; const list = ((j.addons || {})[id && id.id] || {}).updates || [];
      const top = list.slice().sort((a, b) => vnum(b.version) - vnum(a.version))[0]; const cur = browser.runtime.getManifest().version;
      await L.set({ updAvail: top && vnum(top.version) > vnum(cur) ? { version: top.version, link: top.update_link, ts: Date.now() } : null });
    } catch (e) {} }
  setTimeout(checkUpdate, 20e3); setInterval(checkUpdate, 60 * 60e3);
  let lastStep = 0;
  const step = m => { if (Date.now() - lastStep > 1500) { lastStep = Date.now(); L.set({ syncProgress: { msg: m, ts: Date.now() } }); } };
  const run = (force, opt) => window.SYNC.auto(!!force, step, Object.assign({ by: 'background', lightMin: 15 }, opt || {}))
    .catch(e => console.error('co-pilot sync', e)).finally(() => L.set({ syncProgress: null }));
  // cheap check (two small keys) before doing anything
  async function watch() { const o = await L.get(['nextDue', 'syncLock']); if (o.syncLock && Date.now() - o.syncLock.ts < 4 * 60e3) return; if (!o.nextDue || Date.now() >= o.nextDue) run(false); }
  browser.alarms.create('copilot-sync', { periodInMinutes: 5, delayInMinutes: 1 });
  browser.alarms.create('copilot-news', { periodInMinutes: 15, delayInMinutes: 2 });
  window.NOTIFY = (id, title, message) => browser.notifications.create(id, { type: 'basic', iconUrl: 'icons/icon-128.png', title, message });
  const SIGNIN = { 'auth-bbm': 'https://basketballmonster.com/Login.aspx', 'auth-yahoo': 'https://login.yahoo.com/?done=' + encodeURIComponent('https://basketball.fantasysports.yahoo.com/nba') };
  browser.notifications.onClicked.addListener(id => { if (SIGNIN[id]) browser.tabs.create({ url: SIGNIN[id] }); });
  // phone page (tools/phone/server.js on this PC): a copy without sign-in data every 5 minutes; nothing listening, nothing happens
  const toPhone = () => L.get(null).then(a => fetch('http://127.0.0.1:8770/store', { method: 'POST', body: JSON.stringify({ at: new Date().toISOString(),
    store: Object.fromEntries(Object.entries(a).filter(([k]) => !/auth|pass|token|secret|cookie|cred/i.test(k))) }) })).catch(() => {});
  browser.alarms.onAlarm.addListener(a => { if (a.name === 'copilot-sync') { watch(); toPhone(); } if (a.name === 'copilot-news') window.SYNC.newsCheck().catch(e => console.error('co-pilot news', e)); });
  browser.runtime.onStartup.addListener(() => setTimeout(() => run(false, { now: true }), 20e3));
  // if the add-on's storage was emptied, put back your leagues and settings from the safety copy and sync straight away
  if (window.KEEP) window.KEEP.restore().then(r => { if (r) setTimeout(() => run(false, { now: true }), 3000); else window.KEEP.backup(); });
  // you just opened a signed-in Yahoo or BBM page while a sign-in was needed: carry on now
  browser.storage.onChanged.addListener((ch, area) => { if (area !== 'local') return; if (ch.ymine && !ch.ymine.oldValue) { run(false, { now: true }); return; } if (!(ch.ypage || ch.bbmSeen)) return;
    L.get('health').then(o => { const a = (o.health || {}).auth || {}; if ((ch.ypage && a.yahoo) || (ch.bbmSeen && a.bbm)) run(false, { now: true }); }); });
  browser.runtime.onMessage.addListener(m => {
    if (!m) return;
    if (m.cmd === 'syncNow') return run(true).then(() => ({ ok: true }));
    if (m.cmd === 'syncDue') return run(false, { lightMin: 15, by: 'panel', now: !!m.now }).then(() => ({ ok: true }));
    if (m.cmd === 'update') return browser.runtime.requestUpdateCheck().then(r => r && r.status, () => null);
    if (m.cmd === 'bbmLogin') return window.SYNC.bbmLogin().then(r => r);
  });
})();
