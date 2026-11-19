// The add-on's panel on a phone: stands in for Firefox's browser.* API (as tools/test/render.js does). Storage is the PC's last copy;
// changes stay in this tab; a sync request just re-reads the PC's newest copy (the panel asks every 5 minutes and on "Sync").
// Nothing is sent anywhere but this page's own server: requests to other sites fail straight away.
(() => {
  let S = null; const clone = x => JSON.parse(JSON.stringify(x));
  const load = () => S || (S = fetch('store.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('No copy from the PC yet'); return r.json(); }).then(j => j.store)
    .catch(e => { S = null; document.getElementById('out').innerHTML = '<div class="card">' + e.message + '</div>'; return {}; }));
  const pick = (st, k) => k == null ? st : Object.fromEntries((Array.isArray(k) ? k : typeof k === 'string' ? [k] : Object.keys(k)).filter(x => x in st).map(x => [x, st[x]]));
  const nop = { addListener() {}, removeListener() {} };
  window.browser = {
    storage: { local: { get: async k => clone(pick(await load(), k)), set: async o => { Object.assign(await load(), clone(o)); }, remove: async k => { const s = await load(); [].concat(k).forEach(x => delete s[x]); } }, onChanged: nop },
    runtime: { getManifest: () => ({ version: window.PHONE_V || '' }), sendMessage: async m => { if (m && /^sync/.test(m.cmd)) S = null; return { ok: true }; }, getURL: p => p, onMessage: nop },
    tabs: { create: async o => { if (o && o.url) window.open(o.url, '_blank'); return {}; }, query: async () => [], update: async () => ({}), remove: async () => {} },
    notifications: { create: async () => '' }, windows: { create: async () => ({}) }
  };
  const f0 = window.fetch.bind(window);
  window.fetch = (u, o) => new URL(u instanceof Request ? u.url : u, location.href).origin === location.origin ? f0(u, o) : Promise.reject(new Error('phone copy: no network'));
})();
