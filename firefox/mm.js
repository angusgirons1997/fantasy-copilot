// Matchup Monster reader: parses basketballmonster.com/matchupmonster.aspx into a plain model,
// stores it, and applies selection commands (tick game cells, then Process).
if (!globalThis.browser && globalThis.chrome) globalThis.browser = chrome;
(function () {
  const txt = el => (el ? el.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim() : '');
  const num = s => { const v = parseFloat(String(s).replace(/[^\d.+-]/g, '')); return isNaN(v) ? null : v; };
  const STAT = { 'm/g': 'm', 'p/g': 'p', '3/g': '3', 'r/g': 'r', 'a/g': 'a', 's/g': 's', 'b/g': 'b', 'fg%': 'fgp', 'fga/g': 'fga', 'ft%': 'ftp', 'fta/g': 'fta', 'to/g': 'to', '2d/g': '2d', 'fg/g': 'fg', 'ft/g': 'ft',
    'm': 'm', 'p': 'p', '3': '3', 'r': 'r', 'a': 'a', 's': 's', 'b': 'b', 'fga': 'fga', 'fta': 'fta', 'to': 'to', '2d': '2d', 'fg': 'fg', 'ft': 'ft' };
  function parse(doc) {
    const h = doc.querySelector('.page-header--compact, .page-header') || doc.body;
    const lm = txt(h).match(/Matchup Monster\s+(.+?)\s+\((Yahoo|ESPN|Fantrax|Sleeper)!?\)/i);
    const league = lm ? lm[1] : (txt(doc.querySelector('[name=pageTitleRowLeague] option[selected], #pageTitleRowLeague option:checked')) || 'League');
    const leagueName = String(league).replace(/\s*\((Yahoo|ESPN|Fantrax|Sleeper)!?\)\s*$/i, '').trim();
    const sel = id => { const s = doc.getElementById(id); const o = s && (s.querySelector('option[selected]') || s.options && s.options[s.selectedIndex]); return o ? { id: o.value, name: txt(o) } : null; };
    const t1 = sel('Team1DD'), t2 = sel('Team2DD');
    const start = (doc.getElementById('StartDateTB') || {}).value || null, end = (doc.getElementById('EndDateTB') || {}).value || null;
    const h3s = [...doc.querySelectorAll('h3')];
    const finH = h3s.find(x => txt(x) === 'Final'); if (!finH) return { error: 'No Final table: press Process on Matchup Monster first.' };
    const ft = finH.nextElementSibling && finH.nextElementSibling.tagName === 'TABLE' ? finH.nextElementSibling : finH.parentElement.querySelector('table');
    const cats = [...ft.querySelectorAll('thead th')].map(txt).slice(2);
    const totals = {}, bbmWin = {};
    [...ft.querySelectorAll('tr')].forEach(tr => {
      const c = [...tr.children].map(txt); if (!c.length) return;
      if (c[0] === 'Win Probability') { cats.forEach((k, i) => { const v = num(c[i + 2]); if (v != null) bbmWin[k] = v / 100; }); }
      else if (c[0] && c[0] !== 'Compare' && c[0] !== 'Select Targets' && c[0] !== 'Team' && c.length >= cats.length + 2) { totals[c[0]] = { g: num(c[1]) }; cats.forEach((k, i) => totals[c[0]][k] = num(c[i + 2])); }
    });
    const teams = h3s.filter(x => x !== finH && totals[txt(x)] !== undefined).map(x => ({ name: txt(x), table: x.nextElementSibling && x.nextElementSibling.tagName === 'TABLE' ? x.nextElementSibling : x.parentElement.querySelector('table') }));
    let days = null; const players = [];
    teams.forEach((tm, ti) => {
      const ths = [...tm.table.querySelectorAll('thead th')];
      const H = ths.map(th => txt(th));
      const dayIdx = []; H.forEach((t, i) => { const m = t.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*(\d{1,2})/); if (m) dayIdx.push({ i, label: m[1] + ' ' + m[2], dom: +m[2] }); });
      if (!days) days = dayIdx.map(d => ({ label: d.label, dom: d.dom }));
      const nameI = H.indexOf('Name'), teamI = H.indexOf('Team'), posI = H.indexOf('Pos'), rankI = H.indexOf('Rank'), leagI = H.indexOf('LeagV'), puntI = H.indexOf('PuntV'), anI = H.indexOf('Analysts'), injI = H.indexOf('Inj'), gI = H.indexOf('g'), roleI = H.indexOf('Role'), statusI = H.indexOf('Status');
      const statCols = []; H.forEach((t, i) => { if (i > (gI < 0 ? 0 : gI) && STAT[t] && !statCols.find(s => s.k === STAT[t])) statCols.push({ i, k: STAT[t], per: /\/g$|%$/.test(t) || t === 'fg%' }); });
      const VK = { pV: 'p', '3V': '3', rV: 'r', aV: 'a', sV: 's', bV: 'b', 'fg%V': 'fg%', 'ft%V': 'ft%', toV: 'to', '2dV': '2d', fgV: 'fg', ftV: 'ft' };
      const vCols = []; H.forEach((t, i) => { if (VK[t] && !vCols.find(v => v.k === VK[t])) vCols.push({ i, k: VK[t] }); });
      const cvCols = []; ths.forEach((th, i) => { const a = th.querySelector('a[title]'); const tt = a ? a.getAttribute('title') || '' : ''; const mm = tt.match(/^\d+\s*;\s*[^;]+;\s*([^;]+?)\s*;\s*(Total Games|Per Game) Value/i); if (mm) cvCols.push({ i, name: mm[1].trim(), type: mm[2] }); });
      const perGame = statCols.some(s => /\/g/.test(H[s.i]));
      [...tm.table.querySelectorAll('tbody tr, tr')].forEach(tr => {
        if (tr.parentElement.tagName === 'THEAD') return;
        const cls = tr.className || ''; if (!/matchup-(current|freeagent|ir)-player/.test(cls)) return;
        const tds = [...tr.children]; if (tds.length < H.length - 2) return;
        const a = tds[0].querySelector('a'); const bid = a && (a.getAttribute('href') || '').match(/i=(\d+)/);
        const games = dayIdx.map((d, di) => {
          const td = tds[d.i]; if (!td || !td.querySelector('.matchup-game')) return null;
          const cb = td.querySelector('input[type=checkbox]'); const lab = txt(td.querySelector('label')) || txt(td.querySelector('.shortcb'));
          const sm = td.querySelector('span.small'); const vm = sm ? txt(sm).match(/(-?\d*\.\d+)\s*(\d+)?/) : null; const zm = txt(td).match(/(\d+)m\b/);
          return { day: di, opp: lab, cb: cb ? cb.id : null, on: cb ? cb.checked : /selectedgame/.test(td.className), fin: /finished/.test(td.className), zero: /zerominutes/.test(td.className), val: vm ? +vm[1] : null, min: vm && vm[2] ? +vm[2] : (zm ? +zm[1] : null) };
        });
        const st = {}; statCols.forEach(s => { st[s.k] = num(txt(tds[s.i])); });
        const g = gI >= 0 ? num(txt(tds[gI])) : null;
        if (!perGame && g) Object.keys(st).forEach(k => { if (k !== 'fgp' && k !== 'ftp' && k !== 'm' && st[k] != null) st[k] = st[k] / g; });
        if (st.fgp != null && st.fga != null && st.fg == null) st.fg = st.fgp * st.fga;
        if (st.ftp != null && st.fta != null && st.ft == null) st.ft = st.ftp * st.fta;
        if (st.fg != null && st.fga == null && st.fgp) st.fga = st.fg / st.fgp;
        const bars = [...tr.querySelectorAll('.bm-tooltip-wrap')].map(w => { const t = w.querySelector('.mbar-tip-title'); if (!t) return null; const c = w.querySelector('.monster-bar-cell'); return { t: txt(t), v: num(txt(w.querySelector('.mbar-tip-value'))), r: num(txt(w.querySelector('.mbar-tip-rank'))), g: c ? num(txt(c.querySelector('.monster-bar-games'))) : null, m: c ? num(txt(c.querySelector('.monster-bar-measure'))) : null }; }).filter(Boolean);
        const cv = {}; cvCols.forEach(c => { cv[c.name] = num(txt(tds[c.i])); });
        const catV = {}; vCols.forEach(c => { catV[c.k] = num(txt(tds[c.i])); });
        // analyst notes (BBM 'Analysts' column): who, text, age in hours
        const notes = anI >= 0 && tds[anI] ? [...tds[anI].querySelectorAll('.badge')].map(b => { const t = b.querySelector('[title]'); const raw = t ? t.getAttribute('title') || '' : ''; if (!raw) return null;
          const am = raw.match(/\((\d+(?:\.\d+)?)\s*([mhdw])\)\s*$/); const age = am ? +am[1] * ({ m: 1 / 60, h: 1, d: 24, w: 168 }[am[2]]) : null;
          return { by: txt(b).trim(), text: raw.replace(/\s*\(\d+(?:\.\d+)?\s*[mhdw]\)\s*$/, '').trim(), age }; }).filter(Boolean) : [];
        let sv = null, sr = null; const tip = [...tr.querySelectorAll('.mbar-tip')].find(t => /Josh Projections/.test(txt(t.querySelector('.mbar-tip-title')))) || tr.querySelector('.mbar-tip');
        if (tip) { sv = num(txt(tip.querySelector('.mbar-tip-value'))); sr = num(txt(tip.querySelector('.mbar-tip-rank'))); }
        const ts = (tds.find((x, i) => i > 0 && i < 3 && /^[A-Z]{2,3}$/.test(txt(x))));
        const cbTeam = (games.find(x => x && x.cb) || {}).cb; const tnum = cbTeam ? cbTeam.split('_').pop() : null;
        players.push({ side: ti === 0 ? 0 : 1, type: /freeagent/.test(cls) ? 'fa' : (/ir-player/.test(cls) ? 'ir' : 'cur'), name: txt(a) || txt(tds[0]), bbm: bid ? bid[1] : null,
          team: teamI >= 0 ? txt(tds[teamI]) : txt(ts), pos: posI >= 0 ? txt(tds[posI]).split(/[\s,]+/).filter(Boolean) : [], rank: rankI >= 0 ? num(txt(tds[rankI])) : null,
          leagV: leagI >= 0 ? num(txt(tds[leagI])) : null, puntV: puntI >= 0 ? num(txt(tds[puntI])) : null, inj: injI >= 0 ? txt(tds[injI]) : '', role: roleI >= 0 ? txt(tds[roleI]) : '', status: statusI >= 0 ? txt(tds[statusI]) : '',
          st, games, tnum, sv, sr, bars, cv, catV, notes });
      });
    });
    // dates for day columns
    if (days && start) { const s0 = new Date(start + 'T12:00:00Z'); days.forEach((d, i) => { const x = new Date(s0.getTime() + i * 864e5); d.date = x.toISOString().slice(0, 10); }); }
    return { league: leagueName, me: t1 && t1.name, opp: t2 && t2.name, t1, t2, start, end, cats, totals, bbmWin, teams: teams.map(t => t.name), days: days || [], players, ts: Date.now(), url: (doc.location || {}).href || '' };
  }
  if (typeof module !== 'undefined') { module.exports = { parse }; return; }
  if (/^(moz|chrome)-extension:/.test(location.protocol)) { globalThis.MMPARSE = parse; return; }
  // what you see on Matchup Monster updates the co-pilot's copy of that week, with two guards: if you're looking at other teams
  // the synced matchup is kept, and if your view lists fewer free agents the synced free agents are kept (pickups need them)
  function push() { try { const m = parse(document); if (m && !m.error) { const wk = 'mm' + 'w:' + m.league + ':' + m.start;
      browser.storage.local.get(wk).then(got => { const old = got[wk]; const id = t => t && t.id != null ? String(t.id) : null;
        if (old && old.players && (id(old.t1) !== id(m.t1) || id(old.t2) !== id(m.t2))) return;
        const fa = x => (x.players || []).filter(p => p.type === 'fa');
        if (old && fa(old).length > fa(m).length) { const have = new Set(m.players.map(p => p.name)); m.players = m.players.filter(p => p.type !== 'fa').concat(fa(old).filter(p => !have.has(p.name))); m.faFrom = 'sync'; }
        const o = { ['mm:' + m.league]: m, mmLast: m.league }; if (m.start) o[wk] = m; browser.storage.local.set(o); }).catch(() => {});
        browser.storage.local.get(null).then(all => { const cut = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10); const old = Object.keys(all).filter(x => x.startsWith('mmw:') && all[x] && all[x].end && all[x].end < cut); if (old.length) browser.storage.local.remove(old); }).catch(() => {}); } else if (m && m.error) browser.storage.local.set({ mmErr: { msg: m.error, ts: Date.now() } }); } catch (e) { browser.storage.local.set({ mmErr: { msg: String(e), ts: Date.now() } }); } }
  push();
  browser.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch.mmCmd || !ch.mmCmd.newValue) return; const c = ch.mmCmd.newValue; if (c.done) return;
    if (c.cmd === 'select') {
      let n = 0, miss = 0;
      Object.entries(c.set || {}).forEach(([id, on]) => { const el = document.getElementById(id); if (!el) { miss++; return; } if (el.checked !== on) { el.checked = on; n++; } });
      browser.storage.local.set({ mmCmd: Object.assign({}, c, { done: true, changed: n, miss }) });
      if (c.process) { const b = document.getElementById('RefreshButton'); if (b) setTimeout(() => b.click(), 150); }
    }
    if (c.cmd === 'reparse') push();
    if (c.cmd === 'process') { const b = document.getElementById('RefreshButton'); browser.storage.local.set({ mmCmd: Object.assign({}, c, { done: true, ok: !!b }) }); if (b) setTimeout(() => b.click(), 100); }
  });
})();
