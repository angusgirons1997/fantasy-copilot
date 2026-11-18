// Yahoo Fantasy API: Yahoo's data for programs, which doesn't change when Yahoo redesigns its pages. It uses the owner's own
// Yahoo app: its Client ID and Secret stay in this browser's add-on storage (the secret obfuscated) and are only ever sent to
// api.login.yahoo.com. Sign-in happens on Yahoo's own page (launchWebAuthFlow); the add-on never sees the Yahoo password.
(function (root) {
  const AUTH = 'https://api.login.yahoo.com/oauth2/', API = 'https://fantasysports.yahooapis.com/fantasy/v2/';
  const load = async () => (await browser.storage.local.get('yapi')).yapi || {};
  const redirect = () => browser.identity.getRedirectURL();
  async function tokenCall(a, body) {
    const r = await fetch(AUTH + 'get_token', { method: 'POST', headers: { Authorization: 'Basic ' + btoa(a.id + ':' + root.SYNC.unhide(a.secret)), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.assign({ redirect_uri: redirect() }, body)) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) { await browser.storage.local.set({ yapi: Object.assign({}, a, { lastErr: j.error_description || j.error || 'refused (' + r.status + ')' }) }); throw new Error('Yahoo refused: ' + (j.error_description || j.error || r.status)); }
    const na = Object.assign({}, a, { access: j.access_token, exp: Date.now() + ((j.expires_in || 3600) - 60) * 1000, refresh: j.refresh_token || a.refresh, lastOk: Date.now(), lastErr: null });
    await browser.storage.local.set({ yapi: na }); return na; }
  // one-time: Yahoo's sign-in page in a pop-up, then the code it hands back is swapped for tokens (kept, and renewed by themselves)
  async function connect() { const a = await load(); if (!a.id || !a.secret) throw new Error('Save your Client ID and Client Secret first');
    const url = AUTH + 'request_auth?' + new URLSearchParams({ client_id: a.id, redirect_uri: redirect(), response_type: 'code', language: 'en-us', scope: 'fspt-w' });
    // fspt-w asks for Fantasy Sports read/write: without it Yahoo answers every fantasy call "This application is not authorized"
    const back = await browser.identity.launchWebAuthFlow({ url, interactive: true }); const code = new URL(back).searchParams.get('code');
    if (!code) throw new Error("Yahoo didn't hand back a sign-in code"); return tokenCall(a, { grant_type: 'authorization_code', code }); }
  async function get(path) { let a = await load(); if (!a.refresh) throw new Error('Not connected to Yahoo yet');
    if (!a.access || Date.now() > a.exp) a = await tokenCall(a, { grant_type: 'refresh_token', refresh_token: a.refresh });
    const r = await fetch(API + path + (path.includes('?') ? '&' : '?') + 'format=json', { headers: { Authorization: 'Bearer ' + a.access } });
    if (!r.ok) { const t = (await r.text().catch(() => '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200); throw new Error('Yahoo API answered ' + r.status + (t ? ': ' + t : '')); }
    return r.json(); }
  // Yahoo's JSON nests each player as arrays of one-key objects: flattened to { id, name, team, pos, slot, status }
  function players(j) { const out = [];
    (function walk(o) { if (!o || typeof o !== 'object') return;
      if (Array.isArray(o.player)) { const f = {}; o.player.flat(2).forEach(x => { if (x && typeof x === 'object' && !Array.isArray(x)) Object.assign(f, x); });
        if (f.name && f.name.full) { const sp = [].concat(f.selected_position || []).find(x => x && x.position);
          out.push({ id: String(f.player_id), name: f.name.full, team: f.editorial_team_abbr || '', pos: f.display_position || '', slot: sp ? sp.position : null, status: f.status || '' }); return; } }
      Object.values(o).forEach(walk); })(j);
    return out; }
  // 'nba' is Yahoo's code for the current NBA season
  const roster = async (lid, tid) => players(await get(`team/nba.l.${lid}.t.${tid}/roster`));
  const Y = { connect, get, players, roster, redirect };
  if (typeof module !== 'undefined' && module.exports) module.exports = Y; root.YAPI = Y;
})(typeof window !== 'undefined' ? window : globalThis);
