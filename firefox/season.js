// Season co-pilot panel: plans the week from Matchup Monster and carries the daily lineup to Yahoo.
if (!globalThis.browser && globalThis.chrome) globalThis.browser = chrome;
(function () {
  const E = window.SEASON; const K = E.key; const NAMES = window.NAMES; const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = x => x == null ? '–' : Math.round(x * 100) + '%';
  const usToday = window.SYNC.usToday; // today in New York (NBA days), one copy in sync.js
  const sur = n => { const w = String(n).split(' ').filter(x => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(x)); return w[w.length - 1] || n; };
  const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
  // plain words: NBA teams, lineup spots and how much a move helps (the panel shows no abbreviations)
  const TEAMN = window.STRAT ? window.STRAT.TEAMN : {};
  const teamN = c => TEAMN[String(c || '').trim().toUpperCase()] || c || '';
  const oppW = o => String(o || '').replace(/@\s?([A-Za-z]{2,4})\b/g, (a, c) => TEAMN[c.toUpperCase()] ? 'at ' + TEAMN[c.toUpperCase()] : a).replace(/\bvs\.?\s?([A-Za-z]{2,4})\b/g, (a, c) => TEAMN[c.toUpperCase()] ? 'vs ' + TEAMN[c.toUpperCase()] : a).replace(/^([A-Z]{2,4})$/, (a, c) => TEAMN[c] ? 'vs ' + TEAMN[c] : a);
  const SLOTN = { PG: 'Point guard', SG: 'Shooting guard', G: 'Guard', SF: 'Small forward', PF: 'Power forward', F: 'Forward', C: 'Centre', UTIL: 'Utility', BN: 'Bench', IL: 'Injured list', 'IL+': 'Injured list', NA: 'Not active' };
  const slotN = x => SLOTN[String(x || '').toUpperCase()] || (x === '–' ? '' : x || '');
  const lnm = (name, slot, opp) => `<span class="nm"><b>${esc(name)}</b><span class="sub">${esc([slotN(slot), oppW(opp)].filter(Boolean).join(' · '))}</span></span>`;
  // per-game projection for the pickup against the drop: the primitive numbers behind the call
  const statsVs = (add, drop) => { const M = modelFor(league()); if (!M) return ''; const a = M.P[M.find(add)], d = M.P[M.find(drop)]; if (!a || !a.ros || !a.ros.st) return '';
    const cats = M.ctx.cats; const v = (p, c) => { const st = p && p.ros && p.ros.st; if (!st) return '–'; if (c === 'fg%') return st.fga ? (st.fg / st.fga * 100).toFixed(1) : '–'; if (c === 'ft%') return st.fta ? (st.ft / st.fta * 100).toFixed(1) : '–'; return st[c] == null ? '–' : (+st[c]).toFixed(1); };
    const ab = { p: 'Points', 3: '3-pointers', r: 'Rebounds', a: 'Assists', s: 'Steals', b: 'Blocks', to: 'Turnovers', 'fg%': 'Field goal %', 'ft%': 'Free throw %', '2d': 'Double-doubles', fg: 'Field goals', ft: 'Free throws' };
    return `<table class="stt2 svs"><thead><tr><th>Per game, rest of season</th><th>${esc(sur(add))}</th><th>${esc(sur(drop))}</th></tr></thead><tbody>${cats.map(c => { const x = v(a, c), y = v(d, c); const better = x !== '–' && y !== '–' && (c === 'to' ? +x < +y : +x > +y);
      return `<tr><td>${ab[c] || esc(c)}</td><td class="${better ? 'plus' : ''}">${x}</td><td>${y}</td></tr>`; }).join('')}<tr><td>Games left</td><td>${a.ros.g != null ? a.ros.g : '–'}</td><td>${d && d.ros && d.ros.g != null ? d.ros.g : '–'}</td></tr></tbody></table>`; };
  // his team's games left this regular season, from the bundled NBA schedule
  const SCC = { NOP: 'NOR', NO: 'NOR', PHX: 'PHO', GS: 'GSW', SA: 'SAS', NY: 'NYK', UTAH: 'UTA', WSH: 'WAS', BRK: 'BKN', CHO: 'CHA' };
  const teamLeft = t => { const by = (ST.nbasched || window.NBA_SCHED || {}).by; if (!by || !t) return null; const u = String(t).toUpperCase(); const L = by[SCC[u] || u]; if (!L) return null; const d0 = usToday(); return L.filter(d => d >= d0).length; };
  // every piece of advice says when its numbers are old: over 12 hours for Basketball Monster's projections or Yahoo's rosters
  const ageLine = lg => { const y = yrFor(lg); if (!y) return ''; const bx = ST['bx:' + y.lid]; const b = bx && bx.ts && bx.ts.rest, yt = y.ts; const old = [];
    if (b && Date.now() - b > 12 * 3600e3) old.push(`Basketball Monster's projections are ${ago(b).replace(' ago', '')} old`); if (yt && Date.now() - yt > 12 * 3600e3) old.push(`Yahoo's rosters were read ${ago(yt)}`);
    return old.length ? `<div class="agel">${old.join('; ')}. The advice below uses them: sync before acting.</div>` : ''; };
  const listW = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
  const fmtD = date => new Date(date + 'T12:00:00Z').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  let ST = {};
  // league rules: read from each league's own Yahoo settings page (nothing about any particular league is built in).
  // Until that page has been read, only neutral defaults are used.
  const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  // the playoff dates: Yahoo's "ends <date>" and the number of playoff weeks
  function poDates(sp) { const m = String((sp && sp.poEndText) || '').match(/([A-Z][a-z]{2})\w*\.?\s+(\d{1,2})/); if (!m || MON[m[1]] == null || !(sp.poWeeks || []).length) return null;
    const t = usToday(); const y0 = +t.slice(0, 4), mo = MON[m[1]]; const yr = mo < 7 && +t.slice(5, 7) >= 8 ? y0 + 1 : y0; const end = yr + '-' + String(mo + 1).padStart(2, '0') + '-' + String(+m[2]).padStart(2, '0');
    const w = sp.poWeeks; return { start: addDay(end, -7 * w.length + 1), end, label: 'weeks ' + w[0] + (w.length > 1 ? '–' + w[w.length - 1] : '') }; }
  // late season, from Yahoo's settings: trades shut the day after Yahoo's trade end date ("March 4, 2027"); the season is over
  // the day after the playoffs end
  function seasonState(lg) { const y = yrFor(lg); const sp = (y && ST['ysetp:' + y.lid]) || {}; const t = usToday(); const pd = poDates(sp);
    const m = String(sp.tradeEnd || '').match(/([A-Z][a-z]{2})\w*\.?\s+(\d{1,2}),?\s+(\d{4})/); const dl = m && MON[m[1]] != null ? m[3] + '-' + String(MON[m[1]] + 1).padStart(2, '0') + '-' + String(+m[2]).padStart(2, '0') : null;
    return { tradesShut: !!dl && t > dl, tradeEnd: sp.tradeEnd, over: !!pd && t > pd.end, last: !!pd && t > addDay(pd.end, -7), poStart: pd && pd.start, poEnd: pd && pd.end }; }
  // your punt: set in Settings only. The first time, it starts from Basketball Monster's punt so nothing changes under you; after that BBM's punt settings are ignored
  function puntFor(lg) { const s = S(lg); if (Array.isArray(s.punt)) return s.punt;
    const y = yrFor(lg); const b = y && ST['bx:' + y.lid]; if (b && b.punt && !b.punt.unsure && b.punt.cats) { s.punt = b.punt.cats.slice(); s.puntCopied = Date.now(); browser.storage.local.set({ ['sset:' + lg]: s }); return s.punt; }
    return null; }
  function rulesFor(lg, y) { const base = { ilSlots: 0, waiverDays: 0, addLimit: 2 };
    const sp = y && ST['ysetp:' + y.lid]; if (sp) { if (sp.addLimit > 0) base.addLimit = sp.addLimit; if (sp.ilSlots > 0) base.ilSlots = sp.ilSlots; if (sp.waiverDays != null) base.waiverDays = sp.waiverDays; if (sp.poWeeks && sp.poWeeks.length) base.poWeeks = sp.poWeeks; const pd = poDates(sp); if (pd) base.playoffs = pd; if (sp.slots && sp.bench != null) base.spots = sp.slots.length + sp.bench; base.fromYahoo = true; }
    return base; }
  const txDate = r => { if (!r) return null; if (r.date) return r.date; const w = r.when; if (!w) return null; const m = w.match(/([A-Z][a-z]{2}) (\d{1,2})/); if (!m) return null; const mo = 'JanFebMarAprMayJunJulAugSepOctNovDec'.indexOf(m[1]) / 3; if (mo < 0) return null; const t = usToday(); let yr = +t.slice(0, 4); if (mo > +t.slice(5, 7) - 1 + 1) yr--; return yr + '-' + String(mo + 1).padStart(2, '0') + '-' + String(+m[2]).padStart(2, '0'); };
  // projections for league-wide strength: your loaded draft data file if any, else the built-in one
  // league-wide strength from live BBM rest-of-season values when synced; the preseason file only as a last resort
  function zSource(ncat, lid) { const bx = lid && ST['bx:' + lid]; const R = bx && bx.views && bx.views.ros;
    if (R && Object.keys(R).length > 100) { const by = new Map(); Object.values(R).forEach(r => { if (r.n) by.set(K(r.n), { v: r.lv || 0, z: r.cv || {} }); }); return n => by.get(K(n)) || null; }
    return zSourceFile(ncat); }
  function zSourceFile(ncat) { const P0 = (ST.mdfData && Array.isArray(ST.mdfData.P)) ? ST.mdfData.P : (window.P || []); const ORD = ncat === 11 ? ['fg%', 'ft', '3', 'p', 'r', 'a', 's', 'b', 'to', 'fg', '2d'] : ['fg%', 'ft%', '3', 'p', 'r', 'a', 's', 'b', 'to'];
    const by = new Map(); P0.forEach(p => { const zz = ncat === 11 ? p.z11 : p.z; if (!zz) return; const z = {}; ORD.forEach((c, i) => z[c] = zz[i]); by.set(K(p.n), { v: ncat === 11 ? (p.v11 != null ? p.v11 : p.v) : p.v, z }); }); return n => by.get(K(n)) || null; }
  const S = lg => { const k = 'sset:' + lg; ST[k] = ST[k] || {}; return ST[k]; };
  const saveS = lg => { DV++; return browser.storage.local.set({ ['sset:' + lg]: S(lg) }); };
  function leaguesKnown() { const seen = {};
    Object.keys(ST).filter(k => k.startsWith('yr:') && ST[k] && ST[k].lid).map(k => ST[k]).forEach(y => { seen[y.lid] = { lid: y.lid, tid: y.tid, league: y.league }; });
    (ST.leagueList || []).forEach(l => { if (!seen[l.lid] && l.league) seen[l.lid] = { lid: l.lid, tid: l.tid, league: l.league }; });
    return Object.values(seen).sort((a, b) => a.league < b.league ? -1 : 1); }
  function league() { const ls = leaguesKnown(); if (ST.activeLeague && ls.some(l => l.league === ST.activeLeague)) return ST.activeLeague; const y = ST.yrLast && ST['yr:' + ST.yrLast]; if (y && y.league) return y.league; return ls[0] ? ls[0].league : ST.mmLast; }
  function weeks(lg) { return Object.keys(ST).filter(k => k.startsWith('mmw:' + lg + ':') && ST[k] && ST[k].start).map(k => ST[k]).sort((a, b) => a.start < b.start ? -1 : 1); }
  const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  function mmRaw() { const lg = league(); const ws = weeks(lg); const t = usToday(); const cover = ws.filter(w => w.start <= t && w.end >= t).sort((a, b) => b.ts - a.ts); return cover[0] || ws.find(w => w.end >= t) || ST['mm:' + lg] || ws[ws.length - 1]; }
  // when Matchup Monster couldn't be read for this week (no copy, or the copy is over a day old), the week is built from BBM's
  // rest-of-week projections, the NBA schedule and the Yahoo rosters instead, so the plan keeps working
  let synMemo = null;
  function mm() { const m = mmRaw(); const lg = league(); const t = usToday(); if (m && m.start <= t && m.end >= t && Date.now() - (m.ts || 0) < 24 * 3600e3) return m;
    try { const y = yrFor(lg); const l = leaguesKnown().find(x => x.league === lg); const bx = l && ST['bx:' + l.lid]; if (!y || !y.oppTid || !l || !bx || !bx.views || !bx.views.rest || !window.CTX || !window.CTX.weekModel) return m;
      const lv = ST['ylive:' + l.lid]; const dow = (new Date(t + 'T12:00:00Z').getUTCDay() + 6) % 7; const start = lv && lv.start && lv.start <= t && lv.end >= t ? lv.start : y.weekStart && y.weekStart <= t ? y.weekStart : addDay(t, -dow); const end = lv && lv.start === start && lv.end ? lv.end : y.weekEnd && y.weekStart === start ? y.weekEnd : addDay(start, 6);
      const key = [lg, t, start, y.ts, y.oppTid, JSON.stringify(bx.ts || {}), (ST['lgscan:' + l.lid] || {}).ts].join('|'); if (synMemo && synMemo.key === key) return synMemo.m;
      const cats = m && m.cats ? m.cats.filter(c => E.LBL[c]) : null; const M = window.CTX.model(ST, l.lid, { yr: y, obj: scoringOf(lg).mode, today: t, rules: rulesFor(lg, y), cats, weekEnd: end });
      const syn = M && window.CTX.weekModel(M, ST, y, { league: lg, me: y.teamName || (m && m.me) || 'You', cats: cats || M.ctx.cats }, { start, end, oppTid: y.oppTid, view: 'rest', today: t });
      if (syn) { syn.stale = m ? { start: m.start, ts: m.ts } : null; synMemo = { key, m: syn }; return syn; } } catch (e) { console.error(e); }
    return m; }
  function nextOf(m) { if (!m || !m.end) return null; const n = weeks(m.league).find(w => w.start === addDay(m.end, 1)); return n && n.players ? n : null; }
  function yrFor(lgName) { return Object.keys(ST).filter(k => k.startsWith('yr:')).map(k => ST[k]).filter(y => y && y.league && lgName && lgName.indexOf(y.league) === 0).sort((a, b) => b.ts - a.ts)[0]; }
  // your starting spots: the league's roster positions from Yahoo's settings page (an empty spot on the team page still counts),
  // else the filled spots plus any empty ones the team page shows
  function slotsFrom(y) { if (!y) return null; const sp = ST['ysetp:' + y.lid]; if (sp && sp.slots && sp.slots.length >= 5) return sp.slots.slice();
    return y.rows.filter(r => r.slot !== 'BN' && !/^IL/.test(r.slot)).map(r => r.slot).concat((y.empty || []).filter(x => x !== 'BN' && !/^IL/.test(x))); }

  // ---- move history from roster changes (backup when the Yahoo API isn't connected) ----
  function trackRoster(lg, src, keys, ts, weekStart) {
    const hk = 'hist:' + lg; const h = ST[hk] || { log: [] }; const prev = h[src]; let changed = false;
    if (prev && ts > prev.ts) {
      const P0 = new Set(prev.keys), N = new Set(keys); const adds = keys.filter(k => !P0.has(k)), drops = prev.keys.filter(k => !N.has(k));
      if (adds.length <= 4 && drops.length <= 4) { const d = usToday(); const dup = (t, k) => h.log.some(e => e.t === t && e.k === k && (Date.now() - e.ts) < 10 * 864e5);
        // last snapshot was before this week began: the move may have been made last week, so it isn't counted against this week
        const unsure = weekStart && new Date(prev.ts).toISOString().slice(0, 10) < weekStart;
        // a player who "comes back" right after a recorded drop was never really dropped (a page read missed him): undo, don't count an add
        const flick = k => { const i = h.log.findIndex(e => e.t === 'drop' && e.k === k && (Date.now() - e.ts) < 10 * 864e5); if (i < 0) return false; h.log.splice(i, 1); changed = true; return true; };
        adds.forEach(k => { if (flick(k)) return; if (!dup('add', k)) { h.log.push({ t: 'add', k, d, ts: Date.now(), unsure }); changed = true; } }); drops.forEach(k => { if (!dup('drop', k)) { h.log.push({ t: 'drop', k, d, ts: Date.now(), unsure }); changed = true; } }); }
    }
    // Yahoo roster is the truth: anyone on it now wasn't dropped (cleans up drops logged from incomplete page reads)
    if (src === 'y' && (!prev || ts >= prev.ts)) { const N = new Set(keys); const n0 = h.log.length; h.log = h.log.filter(e => !(e.t === 'drop' && N.has(e.k) && !h.log.some(a => a.t === 'add' && a.k === e.k && a.ts > e.ts))); if (h.log.length !== n0) changed = true; }
    if (!prev || ts > prev.ts) { h[src] = { keys, ts }; changed = true; }
    h.log = h.log.filter(e => Date.now() - e.ts < 30 * 864e5);
    if (changed) { ST[hk] = h; browser.storage.local.set({ [hk]: h }); }
    return h;
  }
  // adds used this week: Yahoo's own count (API) > league transactions (API) > roster changes the co-pilot saw
  function addsInfo(m, y, H, limit, spare) {
    const tx = y && ST['tx:' + y.lid]; const inWk = d => d && d >= m.start && d <= m.end;
    const mine = tx && tx.rows && y ? tx.rows.filter(r => String(r.tid) === String(y.tid)) : [];
    let used, src, done; const txOk = !!(tx && tx.rows && tx.src === 'page');
    if (txOk) done = mine.filter(r => inWk(txDate(r))).map(r => ({ t: r.add ? 'add' : 'drop', name: r.players[0] }));
    else done = H.log.filter(e => inWk(e.d) && !e.unsure).map(e => ({ t: e.t, k: e.k }));
    // Yahoo's own counter on your team page ("You have used 1 of your 2 player adds for this week") is the truth when it's this week's
    if (y && y.adds && (!y.date || inWk(y.date)) && Date.now() - y.ts < 12 * 3600e3) { used = y.adds.used; src = 'yahoo'; }
    else if (txOk) { used = done.filter(e => e.t === 'add').length; src = 'transactions';
      // pickups you've made since Yahoo's list was last read (seen on your roster) are added on top
      const inTx = new Set(done.filter(e => e.t === 'add').map(e => K(e.name))); used += H.log.filter(e => e.t === 'add' && !e.unsure && e.ts > tx.ts && inWk(e.d) && !inTx.has(e.k)).length; }
    else { used = H.log.filter(e => e.t === 'add' && inWk(e.d) && !e.unsure).length; src = 'seen'; }
    return { limit, used, spare, left: Math.max(0, limit - used - spare), src, done };
  }
  // what the streaming check needs: how many adds it may use (one is always kept for injuries, until the weekend), the opponent's
  // known weak and strong categories (their Yahoo results so far; Basketball Monster's team values while there are fewer than 3
  // weeks of results), and which of your players Yahoo managers are dropping in numbers
  function streamOpts(m, y, oppTid, A) { if (!y) return null; const cats = (m.cats || []).filter(c => E.LBL[c]); const weak = [], strong = [];
    const PR = window.CTX && window.CTX.profiles ? (() => { try { return window.CTX.profiles(ST, y.lid, cats); } catch (e) { return null; } })() : null; const ot = oppTid && PR && PR.teams[String(oppTid)];
    const bs = ST['bbmstand:' + y.lid];
    const am = bs && oppTid ? amMatch(y.lid, y.tid)[String(oppTid)] || null : null;
    cats.forEach(c => { const k = ot && ot.cat[c]; if (k && k.n >= 3) { const lr = (k.l + k.t / 2) / k.n, wr = (k.w + k.t / 2) / k.n; if (lr >= 0.7) weak.push(c); else if (wr >= 0.7) strong.push(c); return; }
      const v = am && am.val[c]; if (v != null) { if (v <= -1) weak.push(c); else if (v >= 1) strong.push(c); } });
    const tm = ST['ytrendMy:' + y.lid]; const trendDrop = {}; if (tm && tm.players && Date.now() - tm.ts < 2 * 864e5) Object.entries(tm.players).forEach(([n, v]) => { if (v.drops >= 500 && v.drops >= 2 * v.adds) trendDrop[n] = v.drops; });
    // the swing band comes from the strategy's cut-offs, so a category is "in play" by the same definition everywhere
    const th = Object.assign({ dead: 0.25, safe: 0.75 }, (S(m.league) || {}).th || {});
    return { cap: A.left, pattern: { weak, strong }, trendDrop, bands: { dead: th.dead, safe: th.safe }, src: { history: !!ot, bbm: !!am } }; }
  function recentMoves(y, H) { const tx = y && ST['tx:' + y.lid]; const cut = addDay(usToday(), -14);
    if (tx && tx.rows && tx.src === 'page') { const mine = tx.rows.filter(r => String(r.tid) === String(y.tid) && (txDate(r) || '') >= cut); return { adds: mine.filter(r => r.add).map(r => r.players[0]), drops: mine.filter(r => r.drop).map(r => r.players[0]) }; }
    const rec = t => H.log.filter(e => e.t === t && Date.now() - e.ts < 14 * 864e5).map(e => e.k); return { adds: rec('add'), drops: rec('drop') }; }

  // next week: Matchup Monster's own week when it has one, else the same week built from BBM's Next Week projections
  // next week's opponent: from the sync, else from the Yahoo page you're on (a team-page date in a later week shows that week's
  // opponent in its matchup card; next week's matchup page shows both teams). Whatever is found is remembered.
  const thisWeekNo = y => { const lv = y && ST['ylive:' + y.lid]; return (lv && lv.week) || (y && y.src !== 'page' ? y.week : null) || null; };
  function ynextOf(y) {
    if (!y) return null; if (y.next && y.next.oppTid) return y.next; const m0 = mm(); const end = m0 && m0.end; const start = end ? addDay(end, 1) : null;
    const st = ST['ynext:' + y.lid]; if (st && (!end || st.start > end)) return st; if (!start) return st || null;
    let found = null;
    if (y.src === 'page' && y.date && y.date > end && y.date <= addDay(start, 6) && y.oppTid) found = { week: y.week || null, oppTid: String(y.oppTid), start, end: addDay(start, 6), from: 'team page' };
    const yp = ST.ypage; if (!found && yp && yp.kind === 'matchup' && yp.lid === y.lid && yp.teams && yp.teams.length === 2) { const wq = +((yp.url || '').match(/[?&]week=(\d+)/) || [])[1]; const tw = thisWeekNo(y);
      if (wq && tw && wq === tw + 1 && yp.teams.includes(String(y.tid))) found = { week: wq, oppTid: yp.teams.find(t => t !== String(y.tid)), start, end: addDay(start, 6), from: 'matchup page' }; }
    if (found) { found.ts = Date.now(); ST['ynext:' + y.lid] = found; browser.storage.local.set({ ['ynext:' + y.lid]: found }); return found; }
    return st || null; }
  function nextModel(m0) { const n = nextOf(m0); if (n) return n; const y = yrFor(m0.league); const wk = ynextOf(y); if (!wk || !window.CTX || !window.CTX.weekModel) return null;
    if (wk.start && m0.end && wk.start <= m0.end) return null; const M = modelFor(m0.league); if (!M) return null;
    try { return window.CTX.weekModel(M, ST, y, m0, wk); } catch (e) { console.error(e); return null; } }
  // how the league scores a week: 'cats' (Yahoo "Head-to-Head - Categories": every category won counts in the standings) or
  // 'win' (one win per week for taking the most categories). Read from the standings once a week has been played
  // (W+L+T per team is about the number of categories per week in a categories league, 1 in a one-win league), or set in Settings.
  function scoringOf(lg) { const s = S(lg); if (s.scoring === 'cats' || s.scoring === 'win') return { mode: s.scoring, src: 'set' };
    const y = yrFor(lg); const sp = y && ST['ysetp:' + y.lid]; if (sp && (sp.scoring === 'cats' || sp.scoring === 'win')) return { mode: sp.scoring, src: 'Yahoo settings' }; const sd = y && ST['ystand:' + y.lid]; if (sd && sd.teams && sd.teams.length) { const avg = sd.teams.reduce((t, x) => t + (x.w || 0) + (x.l || 0) + (x.t || 0), 0) / sd.teams.length;
      if (avg >= 2) return { mode: 'cats', src: 'standings' }; if (avg >= 0.5) return { mode: 'win', src: 'standings' }; }
    return { mode: 'cats', src: 'default' }; }
  // learned from finished weeks: compare each week's pre-week category forecasts with Yahoo's final results and find how much
  // wider or narrower the forecasts should be (needs about three weeks of results before it moves away from 1)
  function trackCal(lg) { const pairs = []; Object.keys(ST).filter(k => k.startsWith('track:' + lg + ':') && ST[k] && ST[k].actual && ST[k].first).forEach(k => { const t = ST[k];
      Object.entries(t.actual).forEach(([c, a]) => { const q = (t.first.cats || {})[c]; if (q != null && a !== 0.5) pairs.push([q, a]); }); });
    if (pairs.length < 25) return { mul: 1, n: pairs.length };
    const inv = p => { p = Math.min(0.995, Math.max(0.005, p)); let lo = -6, hi = 6; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (E.Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
    let best = { mul: 1, ll: Infinity }; for (let m = 0.6; m <= 1.81; m += 0.05) { let ll = 0; pairs.forEach(([p, y]) => { const q = Math.min(0.995, Math.max(0.005, E.Phi(inv(p) / m))); ll -= y ? Math.log(q) : Math.log(1 - q); }); if (ll < best.ll) best = { mul: +m.toFixed(2), ll }; }
    return { mul: best.mul, n: pairs.length }; }
  // regular season: every category counts, so maximise categories won; playoffs: one matchup a week, so maximise the chance
  // of winning the majority. The switch happens in the first playoff week from Yahoo's settings.
  // how many of their possible games managers actually play (final games played ÷ Yahoo's pre-week possible), from finished weeks
  function utilOf(lg) { let a = 0, b = 0; Object.keys(ST).filter(k => k.startsWith('track:' + lg + ':') && ST[k] && ST[k].final && ST[k].first).forEach(k => { const t = ST[k], F = t.final;
      [[t.first.oppPossible, F.opGames], [t.first.mePossible, F.meGames]].forEach(([pos, pl]) => { if (pos > 0 && pl && pl.played != null) { a += pl.played; b += pos; } }); });
    return b >= 30 ? Math.max(0.7, Math.min(1, a / b)) : 0.93; }
  function playoffWeek(lg, y) { const RL = rulesFor(lg, y); const wk = (RL.poWeeks || [])[0]; return wk || null; }
  function objFor(lg, y, isNext) { const sc = scoringOf(lg).mode; if (sc !== 'cats') return sc; const po = playoffWeek(lg, y); const tw = thisWeekNo(y); if (!po || !tw) return sc; return (tw + (isNext ? 1 : 0)) >= po ? 'win' : 'cats'; }
  // ---- availability: never recommend a player another team has. Three Yahoo sources, most direct last: every team's roster
  // (league scan), the transactions since that scan, and Yahoo's own roster status for each player the plan wants to add ----
  function takenSet(y) { const out = new Set(); if (!y) return out; const me = String(y.tid);
    const lg = ST['lgscan:' + y.lid]; const since = lg ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(lg.ts)) : '0';
    if (lg && lg.teams && Date.now() - lg.ts < 4 * 864e5) lg.teams.forEach(t => { if (String(t.tid) !== me) (t.players || []).forEach(n => out.add(K(n))); });
    const tx = ST['tx:' + y.lid]; if (tx && tx.rows) tx.rows.filter(r => (txDate(r) || '') >= since && String(r.tid) !== me).sort((a, b) => ((txDate(a) || '') + String(a.mins || 0).padStart(4, '0')) < ((txDate(b) || '') + String(b.mins || 0).padStart(4, '0')) ? -1 : 1)
      .forEach(r => (r.players || []).forEach(n => { if (r.add) out.add(K(n)); else if (r.drop) out.delete(K(n)); }));
    const av = ST['yavail:' + y.lid] || {}; Object.entries(av).forEach(([n, v]) => { const age = Date.now() - v.ts; if (v.st === 'taken' && age < 12 * 3600e3) out.add(K(n)); else if ((v.st === 'FA' || v.st === 'W') && age < 3 * 3600e3) out.delete(K(n)); });
    return out; }
  const availOf = (y, n) => { const v = y && (ST['yavail:' + y.lid] || {})[n]; return v && Date.now() - v.ts < (v.st === 'taken' ? 12 : 1.5) * 3600e3 ? v : null; };
  const availBusy = {};
  // ask Yahoo about the players the plan wants to add that haven't been checked lately (a few at a time; the panel re-plans when the answers land)
  function verifyAvail(y, names) { if (!y || !window.SYNC || !window.SYNC.yAvail) return; const need = [...new Set(names)].filter(n => !availOf(y, n) && !(availBusy[y.lid + '|' + n] > Date.now())).slice(0, 8); if (!need.length) return;
    need.forEach(n => availBusy[y.lid + '|' + n] = Date.now() + 10 * 60e3); window.SYNC.yAvail(y.lid, need).catch(e => console.error('co-pilot availability', e)); }
  // ---- speed: a plan or a player model is only rebuilt when the data behind it changed (DV counts data changes) ----
  let DV = 0; const MEMO = {}; const bucket = () => Math.floor(Date.now() / 600e3);
  const memo = (k, f) => { const key = k + '|' + DV + '|' + usToday() + '|' + bucket(); const c = MEMO[k]; if (c && c.key === key) return c.v; const v = f(); MEMO[k] = { key, v }; return v; };
  function compute(which) { return memo('plan|' + league() + '|' + (which || 'this'), () => computeRaw(which)); }
  // ---- self-check: every plan is checked against what Yahoo shows before you see it, and corrected where they disagree ----
  // (a pickup of someone already rostered, a drop of someone you no longer have, a starter Yahoo shows without a game, an empty
  // starting spot while someone with a game sits). Each fix is noted in Diagnostics; nothing is left for you to sort out.
  function selfCheck(p, y, isNext) { const fixes = []; if (!p || !y) { if (p) p.fixes = fixes; return; }
    const onRoster = new Set(y.rows.map(r => K(r.name))); const taken = takenSet(y); const slots = slotsFrom(y) || [];
    p.moves = p.moves.filter(x => { if (taken.has(K(x.add))) { fixes.push(x.add + ' is on another team: pickup removed'); return false; }
      if (onRoster.has(K(x.add))) { fixes.push(x.add + ' is already yours: pickup removed'); return false; }
      if (x.drop && !onRoster.has(K(x.drop)) && !p.moves.some(z => z !== x && K(z.add) === K(x.drop))) { fixes.push(x.drop + ' is no longer on your roster: that swap was removed'); return false; } return true; });
    p.moves.forEach(x => { if (x.alts) x.alts = x.alts.filter(a => !taken.has(K(a.add)) && !onRoster.has(K(a.add))); });
    if (!isNext) [p.nowDays, p.days].filter(Boolean).forEach((days, di) => days.forEach(d => { if (!d.open) return; const act = actualFor(y.lid, d.date); const seen = new Set();
      // no one twice, never both starting and benched, never more starters than spots
      d.start = d.start.filter(x => { const k = K(x.name); if (seen.has(k)) { fixes.push(x.name + ' listed twice on ' + d.date); return false; } seen.add(k); return true; });
      d.bench = d.bench.filter(x => !seen.has(K(x.name)));
      if (slots.length && d.start.length > slots.length) { fixes.push(d.date + ': more starters than spots, trimmed'); d.bench = d.start.slice(slots.length).map(x => Object.assign({}, x)).concat(d.bench); d.start = d.start.slice(0, slots.length); }
      if (di > 0) return; resolveDay(d, y, act, slots, p, fixes); }));
    p.fixes = [...new Set(fixes)]; if (p.fixes.length) { const k = 'selfcheck:' + y.lid; const prev = ST[k]; if (!prev || JSON.stringify(prev.fixes) !== JSON.stringify(p.fixes)) { ST[k] = { ts: Date.now(), fixes: p.fixes }; browser.storage.local.set({ [k]: ST[k] }); } } }
  // ---- Yahoo is the word on injuries and on each day's lineup ----
  // out (never starts, whatever Basketball Monster projects) and game-time decisions (start only into a spot no healthy player
  // with a game can fill). The status is Yahoo's tag on your team page, read from the newest of your roster and that day's page.
  const HARD_OUT = /^(O|OUT|INJ|SUSP|NA|OFS)$/i, DOUBTFUL = /^(GTD|DTD|Q|D)$/i;
  const tag = s => String(s || '').trim().split(/\s/)[0].toUpperCase();
  const sameName = (a, b) => NAMES.same(a, b);
  const rowIn = (rows, n) => NAMES.pick(rows, n); // the one name rule (names.js)
  // the injury tag shown on a player: Yahoo's whenever Yahoo lists him (no tag there = healthy, even if Basketball Monster's
  // status is older or different); Basketball Monster's only for a player Yahoo's roster doesn't show
  const injFor = (y, M, n) => { const r = y && y.rows && rowIn(y.rows, n); if (r) { const t = tag(r.inj); return HARD_OUT.test(t) || DOUBTFUL.test(t) || t === 'P' ? t : ''; }
    const id = M && M.find(n); const v = id && M.P[id] && M.P[id].inj; return v && /^(Q|D|GTD|O|OUT|DTD|P)\b/i.test(v) && !/^Off/i.test(v) ? v : ''; };
  const isStartSlot = s => !!s && s !== 'BN' && !/^IL/.test(s);
  // the most starters (in priority order) that fit the starting spots: each player only in a spot Yahoo lets him play. A player
  // locked in a spot (his game has started) keeps it. Returns { chosen, slotOf } with every chosen player matched to a spot.
  function fitStarters(slots, cands) { const chosen = []; let slotOf = {};
    const match = list => { const m = new Array(slots.length).fill(-1);
      const tryP = (i, seen) => { for (let j = 0; j < slots.length; j++) { if (seen[j] || !list[i].elig(slots[j])) continue; seen[j] = true; if (m[j] < 0 || tryP(m[j], seen)) { m[j] = i; return true; } } return false; };
      for (let i = 0; i < list.length; i++) if (!tryP(i, new Array(slots.length).fill(false))) return null;
      const out = {}; m.forEach((i, j) => { if (i >= 0) out[list[i].name] = slots[j]; }); return out; };
    cands.forEach(c => { if (chosen.length >= slots.length) return; const s = match(chosen.concat([c])); if (s) { chosen.push(c); slotOf = s; } });
    return { chosen, slotOf }; }
  // one open day of the plan, made to match Yahoo: nobody out starts, nobody Yahoo shows without a game starts, a game-time
  // decision only takes a spot nobody healthy can fill, every empty spot gets the best healthy player with a game, and a player
  // whose game has started stays where Yahoo has him. What's left on d.start is exactly what "Set lineups" sends to Yahoo.
  function resolveDay(d, y, act, slots, p, fixes) {
    if (!slots.length || !y || !y.rows) return;
    const yInfo = !!(act && act.rows && act.rows.some(r => r.hasGame)); const dayRows = act && act.rows ? act.rows : null;
    const newer = act && act.ts > (y.ts || 0) ? act.rows : y.rows, older = newer === y.rows ? dayRows : y.rows;
    const statusOf = n => { const r = rowIn(newer, n) || rowIn(older, n) || byId(newer, n) || byId(older, n); return tag(r && r.inj); };
    // by name, else through the Yahoo id ↔ Basketball Monster id map the panel keeps (a name spelt differently on each site)
    const MI = modelFor(league()); const idm = ST.idmap || {};
    const byId = (rows, n) => MI ? (rows || []).find(r => { const id = idm[r.pid]; return id && MI.P[id] && sameName(MI.P[id].n, n); }) : null;
    const rowOf = n => rowIn(dayRows, n) || rowIn(y.rows, n) || byId(dayRows, n) || byId(y.rows, n);
    const val = n => { const v = (p.rosVal || []).find(x => sameName(x.name, n)); return v ? v.perWk : -9; };
    const all = d.start.map(x => ({ x, was: 'start' })).concat(d.bench.map(x => ({ x, was: 'bench' })));
    // someone Yahoo shows playing that the plan doesn't know (no projection yet): a filler after the plan's own players
    if (yInfo) dayRows.filter(r => r.hasGame && !/^IL/.test(r.slot) && !all.some(a => sameName(a.x.name, r.name))).forEach(r => all.push({ x: { name: r.name, opp: (r.game || '').replace(/^\S+ \S+ /, ''), yahooOnly: true }, was: 'extra' }));
    // not on your Yahoo roster at all (Basketball Monster's copy still has a player you dropped): he can't be started
    const fresh = Date.now() - (y.ts || 0) < 6 * 3600e3;
    const info = all.map(a => { const r = rowOf(a.x.name); const st = statusOf(a.x.name); const gone = !r && a.was !== 'extra' && fresh; const noGame = !!(yInfo && r && !r.hasGame) || gone;
      const lockedIn = !!(r && r.locked && isStartSlot(r.slot)), lockedOut = !!(r && r.locked && !isStartSlot(r.slot)), ilY = !!(r && /^IL/.test(r.slot));
      // Yahoo shows him healthy, off the injured list and playing that day: that beats Basketball Monster calling him out
      const yPlays = !!(yInfo && fresh && r && r.hasGame && !ilY && !HARD_OUT.test(st));
      const kind = lockedIn ? 'locked' : ((a.x.zero && !yPlays) || noGame || HARD_OUT.test(st) || lockedOut || ilY) ? 'out' : a.x.protect ? 'protect' : DOUBTFUL.test(st) ? 'doubt' : 'ok';
      const el = r && r.elig && r.elig.length ? r.elig.filter(e => isStartSlot(e)) : null;
      return Object.assign(a, { r, st, noGame, gone, ilY, yPlays, kind, name: a.x.name, elig: lockedIn ? (s => s === r.slot) : el ? (s => el.includes(s)) : (s => s === a.x.slot || s === 'Util') }); });
    const byVal = (u, v) => (u.was === 'extra') - (v.was === 'extra') || val(v.name) - val(u.name);
    const cands = info.filter(i => i.kind === 'locked')
      .concat(info.filter(i => i.kind === 'ok' && i.was === 'start'))
      .concat(info.filter(i => i.kind === 'ok' && i.was !== 'start').sort(byVal))
      .concat(info.filter(i => i.kind === 'doubt').sort((u, v) => (v.was === 'start') - (u.was === 'start') || byVal(u, v)));
    const { chosen, slotOf } = fitStarters(slots, cands); const inS = new Set(chosen.map(i => i.name));
    const before = new Set(d.start.map(x => K(x.name)));
    d.start = chosen.map(i => Object.assign({}, i.x, { slot: slotOf[i.name] }));
    d.bench = info.filter(i => !inS.has(i.name)).map(i => Object.assign({}, i.x, i.kind === 'out' ? { zero: true, injY: HARD_OUT.test(i.st) ? i.st : null, gone: i.gone, noGameY: (i.noGame && !i.gone) || i.x.noGameY || false, il: (i.x.il && !i.yPlays) || i.ilY, lockedOut: !!(i.r && i.r.locked) } : i.kind === 'doubt' ? { doubt: i.st } : {}));
    info.forEach(i => { const was = before.has(K(i.name)), now = inS.has(i.name); if (was === now) return;
      fixes.push(now ? `${i.name} starts on ${d.date}${i.was === 'extra' ? ' (Yahoo shows a game the plan didn\'t have)' : ''}: a spot was free`
        : `${i.name} sits on ${d.date}: ${i.gone ? 'not on your Yahoo roster' : HARD_OUT.test(i.st) ? 'out on Yahoo (' + i.st + ')' : i.noGame ? 'no game on Yahoo' : i.kind === 'doubt' ? 'a game-time decision (' + i.st + ') and a healthy player can take the spot' : i.ilY ? 'in an injured-list spot' : 'locked on the bench'}`); }); }
  // Yahoo's out tag for each of your players, by name (for marking his games before the week is planned)
  function yOut(y) { const m = new Map(); ((y && y.rows) || []).forEach(r => { const t = tag(r.inj); if (HARD_OUT.test(t)) m.set(K(r.name), t); }); return m; }
  function computeRaw(which) {
    const m0 = mm(); if (!m0) return null; const isNext = which === 'next'; const m = isNext ? nextModel(m0) : m0; if (!m) return null;
    const s = S(m.league); const y = yrFor(m.league); const idmap = ST.idmap || {};
    // skip / keep / pick choices are for one week: a new week starts clean so last week's choices don't hide good options
    if (!isNext && m.start && s.choiceWeek !== m.start) { if (s.choiceWeek) { s.exclude = []; s.protect = []; s.pickAdds = {}; s.forceDrop = {}; } s.choiceWeek = m.start; browser.storage.local.set({ ['sset:' + m.league]: s }); }
    const bbmName = {}; m.players.forEach(p => { if (p.bbm) bbmName[p.bbm] = p.name; });
    if (!isNext) { if (y) trackRoster(m.league, 'y', y.rows.map(r => idmap[r.pid] && bbmName[idmap[r.pid]] ? K(bbmName[idmap[r.pid]]) : K(r.name)), y.ts, m.start);
      const meS = s.swap ? 1 : 0; trackRoster(m.league, 'b', [...new Set(m.players.filter(p => p.side === meS && p.type !== 'fa').map(p => K(p.name)))], m.ts, m.start); }
    const H = ST['hist:' + m.league] || { log: [] };
    const RL = rulesFor(m.league, y); const limit = s.addLimit != null ? s.addLimit : y && y.adds && y.adds.max ? y.adds.max : RL.addLimit;
    // adds reset Monday, so from Saturday the injury spare is released (an unused add would be wasted)
    const weekend = m.end && usToday() >= addDay(m.end, -1); const spare = s.spare === false || weekend ? 0 : 1;
    const A = addsInfo(m, y, H, limit, spare); A.weekend = weekend && s.spare !== false; const rm = recentMoves(y, H);
    const yNewer = y && y.ts > m.ts;
    const t0 = performance.now(); const p0src = { w: RL.waiverDays ? 'drops' : null };
    const RC = rosterCheck(y); const ilUsed = RC ? RC.nIL - RC.back.length : 0; const ilEligible = RC ? RC.movable.map(r => r.name) : []; if (RC) RL.ilSlots = RC.ilCap; // Yahoo's own IL count and marks (8.5.0)
    const tx = y && ST['tx:' + y.lid]; const waiverUntil = {};
    if (RL.waiverDays && tx && tx.rows) tx.rows.filter(r => r.drop).forEach(r => { const d = txDate(r); if (!d) return; const until = addDay(d, RL.waiverDays + 1); if (until > usToday()) r.players.forEach(n => waiverUntil[n] = until); });
    // Yahoo's Transaction Trends page shows the real waiver date for the most-added free agents: it wins over the estimate from drops
    { const tw = y && RL.waiverDays && ST['ytrend:' + y.lid]; if (tw && tw.src === 'page' && tw.players && Date.now() - tw.ts < 12 * 3600e3) Object.entries(tw.players).forEach(([n, v]) => { const wd = wvDate(v.wv); if (wd && wd > usToday()) waiverUntil[n] = wd; else if (v.fa) delete waiverUntil[n]; }); }
    const oppTid = (m.t2 && m.t2.id) || (y && y.oppTid); let oppAdds = 0; if (tx && tx.rows && oppTid) { const cut = addDay(usToday(), -28); oppAdds = tx.rows.filter(r => r.add && String(r.tid) === String(oppTid) && (!txDate(r) || txDate(r) >= cut)).length / 4; }
    // how much each category is worth to you from here: the same Analysis Monster numbers the Strategy bands come from (one
    // mechanism for every long-term value). Without them yet, fall back to the league scan.
    let leagueFit = null; { const MI0 = modelFor(m.league); const V0 = MI0 && strategyState(m.league, MI0); const wc = V0 && V0.snap && window.STRAT ? window.STRAT.weights(V0.snap.win, m.cats.filter(c => E.LBL[c]), puntFor(m.league) || []) : null;
      if (wc) leagueFit = { w: wc, teams: V0.rows.length, src: 'Analysis Monster ' + new Date(V0.snap.ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) };
      else { const lgs = y && ST['lgscan:' + y.lid]; if (lgs && lgs.teams) { try { leagueFit = E.leagueFit(lgs.teams, zSource(m.cats.length, y.lid), m.cats.filter(c => E.LBL[c]), y.tid); if (leagueFit) leagueFit.src = 'league scan'; } catch (e) { console.error(e); } } } }
    // Basketball Monster player news (injury status and notes) joins the analyst notes for each player
    const NW = ST.bbmnews && ST.bbmnews.items || []; const byId = {}; NW.forEach(n => { (byId[n.bbm] = byId[n.bbm] || []).push(n); });
    let model = NW.length ? Object.assign({}, m, { players: m.players.map(pl => { const ns = pl.bbm && byId[pl.bbm]; if (!ns) return pl;
      return Object.assign({}, pl, { notes: (pl.notes || []).concat(ns.map(n => ({ by: 'BBM news', text: [n.status && n.status !== 'NOTE' ? n.status.charAt(0) + n.status.slice(1).toLowerCase() + (n.detail ? ' (' + n.detail + ')' : '') + '.' : '', n.text].filter(Boolean).join(' '), age: (Date.now() - n.ts) / 3600e3, status: n.status }))) }); }) }) : m;
    // Yahoo is the truth for who's on your roster: anyone there that Matchup Monster doesn't list at all is filled in from BBM's
    // projections and the NBA schedule (otherwise he'd look like he has no games)
    let filled = []; if (y && y.rows && y.rows.length >= 8 && !m.synthetic && Date.now() - y.ts < 6 * 3600e3 && window.CTX && window.CTX.fillRows) { try { const meS = s.swap ? 1 : 0;
      const mineAll = model.players.filter(pl => pl.side === meS); const has = r => mineAll.some(pl => NAMES.same(pl.name, r.name, pl.team, r.team));
      const miss = y.rows.filter(r => !has(r)); const MI = miss.length && miss.length <= 4 ? modelFor(m.league) : null;
      if (MI) { filled = window.CTX.fillRows(MI, ST, model, miss, meS, usToday()); model = Object.assign({}, model, { players: model.players.concat(filled) }); } } catch (e) { console.error(e); } }
    // players another team already has are taken out before planning
    const taken = takenSet(y); if (taken.size) model = Object.assign({}, model, { players: model.players.filter(pl => !(pl.type === 'fa' && taken.has(K(pl.name)))) });
    const lvG = (() => { const l = y && ST['ylive:' + y.lid]; return l && l.start === m.start && l.opp && l.opp.games ? l.opp.games : null; })(); // Yahoo's games count for your opponent this week
    const lv = y && ST['ylive:' + y.lid]; const liveOk = lv && lv.me && lv.opp && lv.start === m.start && (Object.values(lv.me.st || {}).some(v => v > 0) || Object.values(lv.opp.st || {}).some(v => v > 0));
    const punt = puntFor(m.league) || [];
    const opts = { live: liveOk ? { me: lv.me.st, opp: lv.opp.st } : null, punt, slots: slotsFrom(y), yahooRows: y ? y.rows : [], addsLeft: A.left, roster: (yNewer || (y && Date.now() - y.ts < 2 * 3600e3)) && !m.synthetic ? y.rows.map(r => ({ name: r.name, team: r.team, pid: r.pid })) : null, idmap,
      rules: { ilSlots: RL.ilSlots, ilUsed, ilEligible, waiverUntil }, sched: ST.nbasched || window.NBA_SCHED || null, obj: objFor(m.league, y, isNext), oppGames: lvG && !isNext ? Object.assign({ util: utilOf(m.league) }, lvG) : null, sdMul: trackCal(m.league).mul, scale: (ST['calib:' + m.league] || {}).scale || null, actual: y ? Object.fromEntries(Object.entries(ST['ylu:' + y.lid] || {}).filter(([d, e]) => e && e.rows && e.rows.length && Date.now() - e.ts < 6 * 3600e3).map(([d, e]) => [d, e.rows.filter(r => r.slot !== 'BN' && !/^IL/.test(r.slot)).map(r => r.name)])) : null, playoffs: RL.playoffs || null, leagueFit, oppAdds, recentAdds: rm.adds, recentDrops: rm.drops, oppMode: s.oppMode || 'max', today: usToday(), dropRank: s.dropRank, protect: s.protect || [], exclude: s.exclude || [], allowDrop: s.allowDrop || [], swap: m.synthetic ? false : !!s.swap, lookAhead: 4, next: isNext ? null : nextModel(m), forceDrop: s.forceDrop || {}, pickAdds: Array.isArray(s.pickAdds) ? {} : s.pickAdds || {}, test: s.test || null, streams: streamOpts(m, y, oppTid, A) };
    { const PK = pickOf(m.league); opts.minGain = PK.min; opts.swapMin = PK.swap; }
    // rest-of-season facts for every player (Basketball Monster's projected games left and per-game stats), the end of your
    // playoffs, and how many players the league rosters: what each drop is judged on
    { const MI = modelFor(m.league); const V1 = MI && strategyState(m.league, MI); const BR = (V1 && V1.brank) || {}; // rank by Basketball Monster's value with no punt (its own Rank column follows its site's punt settings)
      if (MI) { model = Object.assign({}, model, { players: model.players.map(pl => { const id = pl.bbm && MI.P[pl.bbm] ? pl.bbm : MI.find(pl.name, pl.team); const q = id && MI.P[id];
        return q && q.ros ? Object.assign({}, pl, { ros: { g: q.ros.g, st: q.ros.st }, sr: BR[id] || null }) : pl; }) }); }
      opts.playoffs = RL.playoffs || null; const sp = y && ST['ysetp:' + y.lid]; const nT = ((y && ST['ystand:' + y.lid]) || {}).teams; opts.rostered = sp && sp.slots ? (sp.slots.length + (sp.bench || 0)) * ((nT && nT.length) || (MI && MI.L.teams.length) || 0) : 0; }
    // the one measure decides who to add and who goes: the planner only picks the day and plans the lineup around it
    const bd = boardPick(m.league, isNext ? null : A); const BD = boardFor(m.league);
    { const MI = modelFor(m.league); if (BD && MI) { const vId = {}; BD.mine.forEach(x => vId[x.id] = x.val);
      const val = n => { const id = MI.find(n); return id && vId[id] != null ? vId[id] : null; };
      const cost = (f, k) => { const a = MI.find(f), d = MI.find(k); return a && d && vId[d] != null && vId[a] == null ? BD.swap(a, d).g : null; };
      const picks = bd && bd.worth && (isNext || !bd.wait) ? [{ add: bd.add, drop: bd.dropName, season: bd.season, picked: bd.chosen }] : [];
      // the board's pick must be plannable even when Matchup Monster's free-agent list doesn't carry him (otherwise Week and Team
      // would show no pickup while Players shows one): fill him in from Basketball Monster's projections and the NBA schedule
      if (picks.length && window.CTX && window.CTX.fillRows) { const meS = s.swap ? 1 : 0; if (!model.players.some(pl => pl.side === meS && pl.type === 'fa' && K(pl.name) === K(bd.add))) { try {
        const add = window.CTX.fillRows(MI, ST, model, [{ name: bd.add, team: (MI.P[bd.id] || {}).t || '' }], meS, usToday()).map(x => Object.assign(x, { type: 'fa' }));
        if (add.length) model = Object.assign({}, model, { players: model.players.concat(add) }); } catch (e) { console.error(e); } } }
      opts.board = { val, cost, picks }; opts.pickAdds = {}; opts.forceDrop = {}; opts.exclude = [];
      if (opts.streams) { const pa = new Set(picks.map(x => K(x.add))), pd = new Set(picks.filter(x => x.drop).map(x => K(x.drop)));
        Object.assign(opts.streams, { only: BD.list.map(x => MI.P[x.id].n).filter(n => !pa.has(K(n))), pool: BD.order.map(x => MI.P[x.id].n).filter(n => !pd.has(K(n))), cost }); } } }
    // Yahoo is the word on who's out: a player of yours Yahoo tags out (O, INJ, SUSP, NA) has no game to start this week, whatever
    // Basketball Monster projects (its projections can lag Yahoo's injury news), so the planner picks who plays in his place
    if (!isNext && y) { const yo = yOut(y); const outIds = new Set((y.rows || []).filter(r => HARD_OUT.test(tag(r.inj)) && idmap[r.pid]).map(r => idmap[r.pid])); const meS = s.swap ? 1 : 0;
      if (yo.size) model = Object.assign({}, model, { players: model.players.map(pl => { if (pl.side !== meS || pl.type === 'fa') return pl; const t = yo.get(K(pl.name)) || (pl.bbm && outIds.has(pl.bbm) ? 'O' : null);
        return t ? Object.assign({}, pl, { inj: t, games: pl.games.map(g => g ? Object.assign({}, g, { zero: true }) : g) }) : pl; }) }); }
    const p = E.plan(model, opts); p.bd = bd;
    // self-check: the plan must carry out exactly the pickup the one measure chose (kept in Diagnostics if it ever doesn't)
    if (!isNext && bd && bd.worth && !bd.wait) { const m0 = p.moves[0]; const ok = !m0 || (K(m0.add) === K(bd.add) && K(m0.drop || '') === K(bd.dropName)); const k = 'selfcheck:uni:' + m.league;
      if (!ok && (!ST[k] || ST[k].add !== bd.add)) { ST[k] = { ts: Date.now(), add: bd.add, drop: bd.dropName, planned: m0 ? m0.add + ' for ' + m0.drop : null }; browser.storage.local.set({ [k]: ST[k] }); } }
    if (opts.board && p.rosVal) { p.rosVal.forEach(x => { const v = opts.board.val(x.name); if (v != null) x.season = +v.toFixed(4); }); p.rosVal.sort((a, b) => a.season - b.season); }
    // the lineup always follows the roster you actually have: planned pickups are step 1, and the lineup is re-planned once Yahoo shows them
    if (!isNext && p.moves.length) { try { const p0 = E.plan(model, Object.assign({}, opts, { addsLeft: 0, next: null, lookAhead: 0, pickAdds: {}, forceDrop: {}, test: null, streams: null, board: null })); p.nowDays = p0.days; p.nowSlots = p0.slots; } catch (e) { console.error(e); } }
    p.live = !!liveOk; p.filled = filled.map(x => x.name); p.punt = punt; p.ms = Math.round(performance.now() - t0); p.waiverSrc = p0src.w; p.newsN = NW.length; p.mmTs = m.ts; p.rules = RL; p.ilUsed = ilUsed; p.leagueFitInfo = leagueFit; p.txRows = tx && tx.rows ? tx.rows.length : null; p.adds = A;
    if (p.recon && p.recon.pairs && p.recon.pairs.length) { const im = Object.assign({}, idmap); let ch = false; p.recon.pairs.forEach(x => { if (im[x.pid] !== x.bbm) { im[x.pid] = x.bbm; ch = true; } }); if (ch) { ST.idmap = im; browser.storage.local.set({ idmap: im }); } }
    { const tk = 'track:' + m.league + ':' + m.start; const tr = ST[tk] || { league: m.league, start: m.start, opp: p.opp, oppTid };
      const snap = { ts: Date.now(), W: p.W.plan, Wmaj: p.Wmaj, Ecats: p.Ecats, obj: p.obj, oppPossible: lvG ? lvG.total : null, mePossible: (() => { const l = y && ST['ylive:' + y.lid]; return l && l.start === m.start && l.me && l.me.games ? l.me.games.total : null; })(), cats: Object.fromEntries(p.cats.map(c => [c.c, +c.p.toFixed(3)])) };
      if (!tr.first) tr.first = snap; if (!tr.last || Date.now() - tr.last.ts > 30 * 60e3) { tr.last = snap; ST[tk] = tr; browser.storage.local.set({ [tk]: tr }); } }
    // remember this league's pre-week calibration for mid-week and next-week plans
    if (!isNext && p.calibrated && p.scale) { const ck = 'calib:' + m.league; if (!ST[ck] || ST[ck].start !== m.start || Date.now() - ST[ck].ts > 6 * 3600e3) { ST[ck] = { ts: Date.now(), start: m.start, scale: p.scale }; browser.storage.local.set({ [ck]: ST[ck] }); } }
    p.playoffs = p.obj === 'win' && scoringOf(m.league).mode === 'cats';
    p.week = isNext ? 'next' : 'this'; p.synthetic = !!m.synthetic; p.start = m.start; p.end = m.end;
    selfCheck(p, y, isNext);
    if (isNext) return p;
    planNow[m.league] = p;
    const planRec = { league: m.league, me: p.me, opp: p.opp, days: (p.nowDays || p.days).map(d => ({ date: d.date, label: d.label, open: d.open, start: d.start.map(x => x.name), bench: d.bench.map(x => x.name), toStart: d.toStart, toBench: d.toBench })), moves: p.moves, ts: Date.now() };
    ST['plan:' + m.league] = planRec; browser.storage.local.set({ ['plan:' + m.league]: planRec });
    return p;
  }

  // two sentences: where you stand, and what decides the week
  function bottomLine(p) {
    const list = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
    if (p.obj === 'cats') { // every category counts: say where the extra category wins are
      const push = p.cats.filter(c => c.p >= 0.3 && c.p <= 0.7).sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5)).slice(0, 4).map(c => c.label);
      const safe = p.cats.filter(c => c.p > 0.7).map(c => c.label), gone = p.cats.filter(c => c.p < 0.3).map(c => c.label);
      return `<b>${(p.Ecats || 0).toFixed(1)} of ${p.ncat}</b> categories expected · ${pct(p.Wmaj || 0)} to take the week.` + (push.length ? ` Most to gain in <b>${list(push)}</b>.` : '') + (safe.length ? ` Safe: ${list(safe)}.` : '') + (gone.length ? ` Unlikely: ${list(gone)}.` : ''); }
    const W = p.W.plan; const po = p.playoffs ? 'Playoff week: only winning the majority counts. ' : '';
    const stance = W >= 0.75 ? 'Clear favourite' : W >= 0.58 ? 'Slight favourite' : W >= 0.45 ? 'Coin flip' : W >= 0.3 ? 'Underdog' : 'Big underdog';
    const swing = p.cats.filter(c => c.p >= 0.35 && c.p <= 0.65).sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5)).slice(0, 3).map(c => c.label);
    return po + `<b>${stance}</b>.` + (swing.length ? ` The week turns on <b>${list(swing)}</b>.` : ' No category is close.');
  }
  // the forecast check, in Settings: how good the pre-week category forecasts have been against Yahoo's final results
  // what the field really does (actual ÷ projected per category) and which projections are closer (Basketball Monster, Yahoo, average)
  function fieldAndProjections(lg) { const y = yrFor(lg); if (!y || !window.CTX.uplift) return ''; const u = window.CTX.uplift(ST, y.lid), ps = window.CTX.projScore(ST); const NM = c => window.STRAT ? window.STRAT.name(c) : c; let h = '';
    const pct = r => (r >= 1 ? '+' : '−') + Math.abs(Math.round((r - 1) * 100)) + '%';
    if (u.weeks) { const L = Object.entries(u.opp).filter(([c]) => !/^(fga|fta)$/.test(c)); h += `<div style="margin-top:8px"><b>Your opponents against their projections</b><div class="sub">${u.weeks} week${u.weeks === 1 ? '' : 's'}. ${L.map(([c, o]) => `${c === 'g' ? 'games' : NM(c)} ${pct(o.ratio)}`).join(' · ')}</div>${Object.keys(u.me).length ? `<div class="sub">You: ${Object.entries(u.me).filter(([c]) => !/^(fga|fta)$/.test(c)).map(([c, o]) => `${c === 'g' ? 'games' : NM(c)} ${pct(o.ratio)}`).join(' · ')}</div>` : ''}<div class="sub">Above 0% means teams beat what their rosters projected (streaming, lineups). Not used in the advice yet: it needs about four weeks first.</div></div>`; }
    else h += `<div style="margin-top:8px"><b>Your opponents against their projections</b><div class="sub">Builds from next week.</div></div>`;
    if (ps.weeks) { const C = Object.keys(ps.bbm).filter(c => ps.bbm[c] != null); const f = (src, c) => ps[src][c] == null ? '–' : /%/.test(c) ? (ps[src][c] * 100).toFixed(1) : ps[src][c].toFixed(2);
      h += `<div style="margin-top:8px"><b>Projection scorecard</b><div class="sub">${ps.weeks} week${ps.weeks === 1 ? '' : 's'}: typical miss per game (lower is better), Basketball Monster / Yahoo / the average of both.</div><div class="sub">${C.map(c => `${NM(c)} ${f('bbm', c)} / ${f('yh', c)} / <b>${f('blend', c)}</b>`).join(' · ')}</div><div class="sub">The average is ${ps.blendWins >= Math.ceil(ps.cats * 2 / 3) ? 'clearly' : 'not clearly'} better in ${ps.blendWins} of ${ps.cats} categories. Basketball Monster stays the base all season: this is tracked for review only.</div></div>`; }
    else h += `<div style="margin-top:8px"><b>Projection scorecard</b><div class="sub">Builds from next week: Basketball Monster's and Yahoo's projections are saved before each Monday and scored against what players did.</div></div>`;
    return h + adviceCheck(lg); }
  // the scorecard the whole tool answers to: did following the board's pickups win more categories than not? (advice.js)
  function adviceCheck(lg) { const y = yrFor(lg); const r = y && window.ADVICE ? window.ADVICE.score(ST, { weeks: 4 })[y.lid] : null;
    const f = x => x == null || !isFinite(x) ? '–' : (x > 0 ? '+' : '') + x.toFixed(2); const pc = x => Math.round(x * 100) + '%'; const cl = x => x > 0 ? 'plus' : x < 0 ? 'minus' : '';
    const h = '<div style="margin-top:8px"><b>Does the advice win?</b>';
    if (!r || !r.scored) return h + `<div class="sub">Builds from the end of next week: each week's top pickup is checked against what the players actually did over the following 4 weeks${r && r.decisions ? ` (${r.decisions} week${r.decisions === 1 ? '' : 's'} of advice logged so far)` : ''}.</div></div>`;
    const vs = [['bbm', "Basketball Monster's top free agent"], ['hot', "Yahoo's most added"]].filter(([k]) => r[k]).map(([k, n]) => `<div class="sub">Against ${n}: <span class="${cl(r[k].boardMinus)}">${f(r[k].boardMinus)}</span> a week, better in ${pc(r[k].boardBetter)} of ${r[k].n} weeks.</div>`).join('');
    return h + `<div class="sub">The co-pilot's pickup: predicted ${f(r.pick.pred)}, actually <span class="${cl(r.pick.real)}">${f(r.pick.real)}</span> categories won a week against your league; better than holding in ${pc(r.pick.positive)} of ${r.scored} weeks.</div>${vs}${r.scored < 8 ? '<div class="sub">Too few weeks to judge yet: an early signal only.</div>' : ''}</div>`; }
  function forecastCheck(lg) { const y = yrFor(lg); if (!y || !window.CTX.calibrate) return ''; const c = window.CTX.calibrate(ST, y.lid); const pc = x => Math.round(x * 100);
    if (!c.n) return `<div style="margin-top:8px"><b>Forecast check</b><div class="sub">Builds from next week: every matchup in your league is forecast before it starts and checked against Yahoo's result.</div></div>` + fieldAndProjections(lg);
    const skill = c.brier != null ? Math.round((1 - c.brier / 0.25) * 100) : null;
    return `<div style="margin-top:8px"><b>Forecast check</b><div class="sub">${c.n} category forecasts over ${c.weeks} week${c.weeks === 1 ? '' : 's'}. Brier score ${c.brier.toFixed(3)} (0.25 is a coin flip${skill != null ? `; ${skill >= 0 ? skill + '% better' : -skill + '% worse'} than one` : ''}).</div>
      <div class="sub">${c.bins.filter(b => b.n).map(b => `forecast ${pc(b.r[0])}–${Math.min(100, pc(b.r[1]))}%: won ${pc(b.won)}% (${b.n})`).join(' · ')}</div>
      <div class="sub">${c.n >= 25 ? `Forecast width ×${c.mul}${c.fit !== c.mul ? ` (best fit ×${c.fit}, eased in until there are 200 results)` : ''}. It applies to every number, the season measure included.` : `The width starts adjusting at 25 results.`}</div></div>` + fieldAndProjections(lg); }
  function trackHtml(lg) {
    const T = Object.keys(ST).filter(k => k.startsWith('track:' + lg + ':') && ST[k] && ST[k].actual).map(k => ST[k]).sort((a, b) => a.start < b.start ? 1 : -1); if (!T.length) return forecastCheck(lg) + '<div class="sub" style="margin-top:8px"><b>Track record</b>: builds from the end of week 1.</div>';
    const b = [[0, .4], [.4, .6], [.6, .8], [.8, 1.01]].map(r => ({ r, n: 0, w: 0 }));
    // judged on the forecast made before each week started (the honest test), not the end-of-week one
    T.forEach(t => { const pr = (t.first || t.last || {}).cats || {}; Object.entries(t.actual).forEach(([c, a]) => { const q = pr[c]; if (q == null) return; const bk = b.find(x => q >= x.r[0] && q < x.r[1]); bk.n++; bk.w += a; }); });
    const wk = T.slice(0, 6).map(t => { const won = Object.values(t.actual).reduce((x, y) => x + y, 0), n = Object.keys(t.actual).length; const f = t.first || t.last || {};
      const exp = f.Ecats != null ? f.Ecats : Object.values(f.cats || {}).reduce((a, b) => a + b, 0);
      return `${esc(t.start.slice(5))} vs ${esc(t.opp || '')}: forecast ${exp.toFixed(1)} of ${n} categories · result ${won}-${n - won} ${won > n / 2 ? '✓' : won < n / 2 ? '✗' : '='}`; }).join('<br>');
    const cal = trackCal(lg); const calLine = cal.n >= 25 ? ` Forecast width adjusted ×${cal.mul} from ${cal.n} results.` : ` Learning from results (${cal.n} of 25 so far).`;
    return forecastCheck(lg) + `<div style="margin-top:8px"><b>Track record</b><div class="sub">${wk}</div><div class="sub" style="margin-top:4px">Categories forecast ${b.filter(x => x.n).map(x => Math.round(x.r[0] * 100) + '–' + Math.min(100, Math.round(x.r[1] * 100)) + '%: won ' + Math.round(x.w) + '/' + x.n).join(' · ')}.${calLine}</div></div>`;
  }
  function diagHtml(lg, p) {
    const y = leaguesKnown().find(l => l.league === lg); const st = y && ST['sync:' + y.lid];
    const lines = (st && st.trace || []).map(t => (t.ok ? '✓ ' : '✗ ') + esc(t.step) + (t.info ? ' — ' + esc(t.info) : '')).join('<br>');
    const extra = [p && p.recon && p.recon.unmatched && p.recon.unmatched.length ? 'Unmatched Yahoo names: ' + esc(p.recon.unmatched.join(', ')) : 'All Yahoo players matched to BBM',
      'Co-pilot version: ' + (browser.runtime && browser.runtime.getManifest ? browser.runtime.getManifest().version : '?'), ST.syncLock && Date.now() - ST.syncLock.ts < 4 * 60e3 ? 'A sync is running (' + esc(ST.syncLock.by) + ', started ' + ago(ST.syncLock.ts) + ')' : '', 'Adds count from: ' + (p && p.adds ? { yahoo: "Yahoo's own count", transactions: 'league transactions', seen: 'roster changes seen (estimate)' }[p.adds.src] + (p.adds.src === 'seen' ? ' · Yahoo\'s transactions page not read yet' : '') : '–'),
      'Waivers from: ' + (p && p.waiverSrc === 'yahoo' ? "Yahoo's waiver list" : p && p.waiverSrc ? 'recent drops (estimate)' : 'no waivers in this league'), 'BBM news items: ' + (p ? p.newsN : 0), (() => { const bx = y && ST['bx:' + y.lid]; const pu = bx && bx.punt; return 'BBM punt settings: ' + (!pu ? 'not read yet' : pu.unsure ? 'unclear (fit ' + pu.err + ')' : pu.cats.length ? pu.cats.map(c => E.LBL[c] || c).join(', ') : 'none'); })(), (() => { const M = modelFor(lg); return 'Model confidence: ' + (M && M.cal && M.cal.n >= 25 ? 'spread x' + M.cal.mul + ' from ' + M.cal.n + ' past category results' : 'learning (' + (M && M.cal ? M.cal.n : 0) + ' of 25 category results so far)'); })(), ST.selftest ? 'Self-test ' + ago(ST.selftest.ts) + ': ' + (ST.selftest.ok ? 'all passed' : ST.selftest.checks.filter(c => !c.ok).map(c => esc(c.name)).join(', ') + ' failed') : 'Self-test: after the next full sync', 'Live totals in the lineup plan: ' + (p && p.live ? 'yes' : 'not yet (needs games played this week)'), (() => { const bx = y && ST['bx:' + y.lid]; if (!bx || !bx.ts) return 'BBM projections: not fetched yet'; const L = { rest: 'this week', next: 'next week', ros: 'rest of season', po: 'playoffs', form: 'last 2 weeks', proj: 'projections file', com: 'Josh comments' };
      return 'BBM projections: ' + Object.keys(L).map(k => L[k] + ' ' + (bx.ts[k] ? ago(bx.ts[k]) : 'missing')).join(' · ') + (bx.err ? ' · <span class="minus">' + esc(bx.err) + '</span>' : ''); })(), 'Category weights: ' + (p && p.leagueFitInfo ? p.leagueFitInfo.src + ', ' + p.leagueFitInfo.teams + ' teams' : 'not yet'), 'Transactions read: ' + (p && p.txRows != null ? p.txRows : 'not yet'), 'NBA schedule: ' + (() => { const x = ST.nbasched || window.NBA_SCHED; return x ? Object.keys(x.by || {}).length + ' teams' + (x.src === 'nba' ? ', from NBA ' + ago(x.ts) : ', built in') : 'missing'; })(), 'Plan built in ' + (p ? p.ms : '–') + ' ms', p && p.fixes && p.fixes.length ? 'Self-check corrected: ' + p.fixes.map(esc).join('; ') : 'Self-check: plan agrees with Yahoo',
      ST.wiped ? '<span class="minus">The browser emptied the add-on\'s storage ' + ago(ST.wiped.ts) + '; your leagues and settings were put back from the safety copy</span>' : '',
      (() => { const y = yrFor(league()); if (!y) return ''; const lv = ST['ylive:' + y.lid], sd = ST['ystand:' + y.lid], tx = ST['tx:' + y.lid];
        return 'Live totals: ' + (lv ? 'week ' + lv.week + ', ' + ago(lv.ts) : 'not yet') + ' · Standings: ' + (sd ? sd.teams.length + ' teams, ' + ago(sd.ts) : 'not yet') + ' · Transactions: ' + (tx ? (tx.rows || []).length + ' moves, ' + ago(tx.ts) : 'not yet'); })()].filter(Boolean).join('<br>');
    return `<details data-k="diag" style="margin-top:8px"><summary>Diagnostics</summary><div class="sub" style="margin-top:4px">${st ? (st.mode || '') + ' sync ' + ago(st.ts) + (st.err ? ' · <span class="minus">' + esc(st.err) + '</span>' : '') : 'No sync yet'}</div><div class="sub mono" style="margin-top:4px">${lines}</div><div class="sub" style="margin-top:4px">${extra}</div><button class="lnk" id="diagDl" style="margin-top:4px">Download report</button> <button class="lnk" id="fcDl" style="margin-top:4px">Download forecast data</button> <button class="lnk" id="testDl" style="margin-top:4px">Download test data</button><div class="sub">Forecast data: projections, rosters, forecasts and weekly results for the forecast check. Test data: everything the panel shows, for checking every page offline before a release. Neither has passwords or sign-ins.</div></details>`;
  }
  // ---- Yahoo connection (official API, one-time) ----

  // ---- page-aware card: answers what you're doing on Yahoo right now (trade, add/drop, player lists) ----
  const ctxRefreshing = {}, tmAsk = {}; // tmAsk: Trade Monster's Analyze Trade answers for the deals ticked on Yahoo, this session
  function ypageNow() { const yp = ST.ypage; return yp && Date.now() - yp.ts < 30 * 60e3 && ['trade', 'add', 'players'].includes(yp.kind) && leaguesKnown().some(l => l.lid === yp.lid) ? yp : null; }
  // the model also carries what the trade tools need: regular-season weeks left, the bar a deal must clear, Trade Monster's results
  function modelFor(lg) { return memo('model|' + lg, () => { const M = modelForRaw(lg); if (!M) return M; const l = leaguesKnown().find(x => x.league === lg), y = yrFor(lg);
    const sp = (l && ST['ysetp:' + l.lid]) || {}; const po = (sp.poWeeks || [])[0] || null; const cw = l && window.CTX.curWeek(ST, l.lid, y);
    M.weeksLeft = cw && po ? Math.max(1, po - cw) : null; M.tm = l ? ST['bbmtm:' + l.lid] || null : null; M.tm2 = l ? ST['bbmtm2:' + l.lid] || null : null; M.fa = l ? ST['bbmfa:' + l.lid] || null : null; M.finish = null; M.needs = tid => teamNeeds(lg, M, tid); return M; }); }
  function modelForRaw(lg) { const l = leaguesKnown().find(x => x.league === lg); if (!l || !window.CTX) return null; const y = yrFor(lg); const m = mm(); const same = m && m.league === lg;
    try { return window.CTX.model(ST, l.lid, { punt: puntFor(lg), yr: y, obj: scoringOf(lg).mode, today: usToday(), rules: rulesFor(lg, y), cats: same ? m.cats.filter(c => E.LBL[c]) : null, weekEnd: same ? m.end : null }); } catch (e) { console.error(e); return null; } }
  // ---- the one measure (every page reads it): expected categories won a week over the rest of the season, against every other
  // team in your league, from Basketball Monster's rest-of-season projections. A player's value to you is what that number loses
  // without him; a pickup is what it gains when he replaces one of your players; a trade is what it gains after the swap. ----
  function boardKeep(lg, M) { const y = yrFor(lg); const s = S(lg); const rm = recentMoves(y, ST['hist:' + lg] || { log: [] }); const ids = ns => (ns || []).map(n => M.find(n)).filter(Boolean);
    // a player in the top half of everyone rostered in the league is never a drop: another team would claim him, so he's traded instead.
    // 8.5.0: on Basketball Monster's value over the rest of the season (per game above the last rostered player, times his share of
    // games left), so a player out for weeks can fall out of the top half
    const N = M.L.teams.reduce((a, t) => a + t.ids.length, 0); const all0 = Object.values(M.P).filter(q => q.ros && q.ros.lv != null && (q.ros.g || 0) > 0).sort((a, b) => b.ros.lv - a.ros.lv);
    const gMax = Math.max(1, ...all0.map(q => q.ros.g)), repl = (all0[Math.min(all0.length - 1, N)] || { ros: { lv: 0 } }).ros.lv; const rv = q => (q.ros.lv - repl) * Math.min(1, q.ros.g / gMax);
    const all = all0.slice().sort((a, b) => rv(b) - rv(a)); const top = new Set(all.slice(0, Math.round(N / 2)).map(q => q.id));
    const mine = (M.L.teams.find(t => t.tid === M.L.me) || { ids: [] }).ids; const claim = mine.filter(id => top.has(id));
    // injured-list players are drops only when that frees a spot: all IL spots taken and an injured player of yours waiting for one
    const rc = rosterCheck(y); const ilDrop = !!rc && rc.ilOpen === 0 && rc.movable.length > 0 && !rc.drops; const hold = new Set(ids(s.protect).concat(ids(rm.adds), claim));
    return { keep: new Set([...(ilDrop ? [] : (M.ilIds || []))].concat([...hold])), hold, ilDrop, claim: new Set(claim), block: new Set(ids(rm.drops)), taken: takenSet(y) }; }
  // ---- who to drop (owner's review 25 Nov): every player of yours, least missed first. A dropped player usually isn't replaced
  // (over the limit, his spot goes to the player coming off the injured list), so each player is measured against the same
  // replacement: Basketball Monster's Find Free Agents numbers averaged over the free agents it tested against every one of your
  // players. That cancels the free agent out and leaves what the player himself is worth to your team. cost = what you'd lose,
  // of 99 a week (negative: your team is better off). best = his best free agent Pickups offers. held = why he isn't a drop:
  // protected, a recent add or a top-half player (shown, never chosen for you). No Find Free Agents yet: Basketball Monster's
  // value over the rest of the season, after everyone who has a number.
  function dropOrder(lg, M) { const k = boardKeep(lg, M); const B = boardFor(lg); const pool = B && B.pool; const F = (M.fa && M.fa.by) || {}; const me = (M.L.teams.find(t => t.tid === M.L.me) || { ids: [] }).ids;
    const lists = me.map(id => F[id]).filter(r => r && r.length); const common = lists.length ? lists.map(r => new Set(r.map(x => x.id))).reduce((a, b) => new Set([...a].filter(x => b.has(x)))) : new Set();
    const typ = id => { const r = (F[id] || []).filter(x => common.has(x.id)); return r.length ? r.reduce((a, x) => a + x.d, 0) / r.length * 99 : null; };
    const best = id => { const r = (F[id] || []).filter(x => !pool || pool.has(x.id)); if (!r.length) return null; const b = r.reduce((a, x) => x.d > a.d ? x : a); return { id: b.id, you: Math.round(b.d * 99) }; };
    const prot = new Set(((S(lg).protect) || []).map(n => M.find(n)).filter(Boolean));
    const why = id => !k.hold.has(id) ? null : prot.has(id) ? 'your keep' : k.claim.has(id) ? 'top half of the league: another team would claim him' : 'a recent add';
    const D = me.map(id => { const t = typ(id), x = (M.P[id] || {}).ros; return { id, name: (M.P[id] || {}).n || id, il: !!(M.ilIds && M.ilIds.has(id)), typ: t, cost: t != null ? -t : x && x.lv != null ? 100 - x.lv * (x.g || 0) : 999, best: best(id), held: why(id) }; }).sort((a, b) => a.cost - b.cost);
    D.common = common.size; return D; }
  // empty roster spots outside the injured list: Yahoo's roster size (starting spots + bench) less the players not on the injured
  // list; else the empty non-injured-list spots Yahoo's team page shows. A pickup into one needs no drop.
  // ---- your roster against Yahoo's limits (8.5.0, owner's review 24 Nov): one count for the injured-list card, Pickups and the
  // planner. Spots outside the injured list: the league settings (starting spots + bench). Injured-list spots: Yahoo's own counter
  // on your team page ("used 3 of 4 IL positions", read every few minutes), over the weekly settings read, so a league change shows
  // at once. Who may go on the injured list: Yahoo's own mark (IL in his position choices on your team page), not a status guess.
  // A player already on the IL who's healthy again (no injury status Yahoo allows there) has to come off it.
  function rosterCheck(y) { if (!y || !y.rows || !y.rows.length) return null; const sp = ST['ysetp:' + y.lid] || {};
    const isIL = r => /^IL/.test(r.slot || ''); const st = r => String(r.inj || '').trim().toUpperCase();
    const okIL = r => /^(INJ|O|OUT|IL|NA|SUSP)$/.test(st(r)) || (/\+/.test(r.slot) && /^(GTD|DTD|D|Q)$/.test(st(r)));
    const activeCap = sp.slots && sp.slots.length && sp.bench != null ? sp.slots.length + sp.bench : null;
    const ilCap = y.il && y.il.max != null ? y.il.max : (sp.ilSlots || 0);
    const il = y.rows.filter(isIL), active = y.rows.filter(r => !isIL(r)); const back = il.filter(r => !okIL(r));
    const movable = active.filter(r => !r.locked && (r.elig || []).some(e => /^IL/.test(e))); // Yahoo lets him go on the IL now
    const ilLeft = il.length - back.length, nAct = active.length + back.length; const ilOpen = Math.max(0, ilCap - ilLeft);
    const moves = movable.slice(0, ilOpen); const after = nAct - moves.length; // first fill open IL spots with injured players
    const drops = activeCap == null ? 0 : Math.max(0, after - activeCap); const open = activeCap == null ? (y.empty || []).filter(x => !/^IL/.test(x)).length : Math.max(0, activeCap - after);
    const need = activeCap == null ? 0 : Math.max(0, nAct - activeCap); // over the limit as things stand: IL moves (then drops) needed now
    return { activeCap, ilCap, nActive: active.length, nIL: il.length, total: y.rows.length, back, movable, moves, need, fix: moves.slice(0, need), ilOpen, drops, open, freeNow: activeCap == null ? open : Math.max(0, activeCap - nAct), illegal: !!y.illegal }; }
  // spots a pickup can use without a drop (after moving injured players into open IL spots); none while the roster is over the limit
  function openSpots(lg) { const rc = rosterCheck(yrFor(lg)); return rc && !rc.drops ? rc.open : 0; }
  function boardFor(lg, punt) { const M = modelFor(lg); if (!M || !window.H2H || !window.H2H.board) return null; const k = boardKeep(lg, M);
    const fas = M.L.fas.filter(id => !k.block.has(id) && !k.taken.has(K(M.P[id].n)));
    const pu = punt === undefined ? M.ctx.punt : (punt && punt.length ? punt : null); const open = openSpots(lg);
    const sig = [...k.keep].sort().join(',') + '|' + fas.join(',').length + '|' + fas.length + '|' + (pu || []).join(',') + '|' + open + '|' + (M.fa ? M.fa.ts : 0);
    return memo('board|' + lg + '|' + sig, () => { const was = M.ctx.punt; M.ctx.punt = pu; try { const b = window.H2H.board(M.ctx, M.L, { keepIds: k.keep, fas, n: 30, open }); if (b) { b.keep = k.keep; b.claim = k.claim; b.punt = pu; bbmBoard(b, M, fas); } return b; } catch (e) { console.error(e); return null; } finally { M.ctx.punt = was; } }); }
  // ---- pickups start from Basketball Monster (7.52.0): Trade Monster's "Find Free Agents" with each of your players as the drop
  // (bbmfa:<lid>, every 2.5 hours and after any league add/drop). Your Win% change x 99 = category matchups won out of 99 a week over the rest of the season. The
  // board keeps its drop rules (never an injured-list spot, a keep, a recent add or a top-half player) and only sifts BBM's lists. ----
  function bbmBoard(b, M, fas) { const F = M.fa; b.bbm = !!(F && F.by && Object.keys(F.by).length); if (!b.bbm) { b.list = []; b.you = () => null; return b; }
    const ok = new Set(fas), mine = new Set(b.mine.map(x => x.id)), pair = {}, best = {}; const nc = M.ctx.cats.length;
    Object.entries(F.by).forEach(([drop, rows]) => { if (!mine.has(drop) || b.keep.has(drop)) return;
      rows.forEach(r => { if (!ok.has(r.id)) return; pair[r.id + '|' + drop] = r.d; (best[r.id] = best[r.id] || []).push({ drop, d: r.d }); }); });
    // shortcut: with an empty roster spot the number shown is with his best drop (a plain add is at least that); the Yahoo card asks Analyze Add/Drop for the plain add
    b.list = Object.entries(best).map(([id, ds]) => { ds.sort((x, y) => y.d - x.d); return { id, drop: b.open ? null : ds[0].drop, you: Math.round(ds[0].d * 99), gain: ds[0].d * nc, atLeast: !!b.open,
      alt: ds[1] ? { drop: ds[1].drop, you: Math.round(ds[1].d * 99) } : null }; }).sort((x, y) => y.gain - x.gain).slice(0, 30);
    b.you = (add, drop) => { const d = pair[add + '|' + drop]; return d == null ? null : Math.round(d * 99); }; b.ts = F.ts; b.pool = ok;
    // shortcut: the week planner's stream costing still prices pairs Basketball Monster didn't list on the old measure; the Matchup phase replaces it
    const s0 = b.swap; b.swap = (a, d) => { const x = pair[a + '|' + d]; const r = s0(a, d); return x == null ? r : Object.assign({}, r, { g: x * nc }); };
    return b; }
  const pick99 = lg => (PICK[S(lg).pick] || PICK.std).b99; // a pickup's minimum, of 99 a week
  // this week in Basketball Monster's Matchup Monster: its win chance per category and its "free agents to consider", with games left
  function mmWeek(lg) { const t = usToday(); return weeks(lg).filter(w => w.start <= t && w.end >= t && !w.synthetic && w.players).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0] || null; }
  const gamesLeft = (m, id) => { const p = m && m.players.find(x => x.bbm === id); return p ? p.games.filter(g => g && !g.fin && !g.zero).length : null; };
  // ---- the Matchup page starts from Basketball Monster (7.53.0): Matchup Monster's Win Probability per category and its totals
  // (games already played included; your games ticked to the planned lineup by the sync, theirs as imported from Yahoo). Expected
  // categories and the chance to take the week only add up its category chances (taken as independent). No model of our own. ----
  function bbmView(m, p) { if (!m || m.synthetic || !m.bbmWin || !m.totals) return null; const W = m.bbmWin, me = m.totals[m.me] || {}, op = m.totals[m.opp] || {};
    const lab = c => ((p.cats || []).find(x => x.c === c) || {}).label || window.STRAT.name(c);
    const cats = (m.cats || []).filter(c => W[c] != null).map(c => ({ c, label: lab(c), p: W[c], me: me[c], opp: op[c] })); if (!cats.length) return null;
    const n = cats.length, Wmaj = window.H2H.weekWin(cats.map(c => c.p), Math.floor(n / 2) + 1);
    return Object.assign({}, p, { cats, ncat: n, Ecats: cats.reduce((a, c) => a + c.p, 0), Wmaj, W: Object.assign({}, p.W, { plan: Wmaj }), bbm: m }); }
  function weekHoles(lg, M) { const m = mmWeek(lg); if (!m || !m.bbmWin) return null; const W = m.bbmWin; const cats = (m.cats || []).filter(c => W[c] != null && !(M.ctx.punt || []).includes(c));
    // in play: Basketball Monster gives you 20 to 80% to win it this week; behind: under 50%
    const play = cats.filter(c => W[c] >= 0.2 && W[c] <= 0.8).sort((a, b) => W[a] - W[b]); const wt = c => W[c] < 0.5 ? 1 : 0.5; const seen = new Set();
    const side = m.t2 && m.me && m.t2.name === m.me ? 1 : 0; // your team's list
    const fas = m.players.filter(p => p.type === 'fa' && p.side === side && p.bbm && !seen.has(p.bbm) && seen.add(p.bbm)).map(p => { const g = gamesLeft(m, p.bbm); const cv = p.catV || {};
      const fills = play.filter(c => (cv[c] || 0) >= 0.5); return { id: p.bbm, n: p.name, g, fills, inj: p.inj, score: (g || 0) * play.reduce((a, c) => a + wt(c) * Math.max(0, cv[c] || 0), 0) }; })
      .filter(x => x.g && x.fills.length).sort((a, b) => b.score - a.score);
    return { m, W, play, fas, n: seen.size }; }
  // ---- trades start from Basketball Monster (7.50.0): Trade Monster's "Find Trades" list for each of your players and its Win% change
  // for both teams, as category matchups won out of 99 (Win% x 99: 11 opponents x 9 categories, or 9 x 11). The co-pilot only checks
  // them: your gain clears the bar (+1 or +2 is inside forecast noise), they don't lose more than themMin, and Yahoo ranks the two
  // players within rankGap of each other. Deals that clear the bar but fail a check are kept, with the reason. ----
  const fairMin = lg => S(lg).fairMin != null ? +S(lg).fairMin : 0.8; // multi-player deals: the share of what they give that they must get back
  const bar99 = lg => S(lg).bar99 != null ? +S(lg).bar99 : 3, themMin = lg => S(lg).themMin != null ? +S(lg).themMin : -1, rankGap = lg => S(lg).rankGap != null ? +S(lg).rankGap : 15;
  const of99 = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
  function tmDeals(lg, M) { const tm = M && M.tm; if (!tm || !tm.by) return null; const bar = bar99(lg), tmin = themMin(lg), gap = rankGap(lg);
    return memo('tm|' + lg + '|' + tm.ts + '|' + bar + '|' + tmin + '|' + gap, () => {
      const own = {}; M.L.teams.forEach(t => t.ids.forEach(id => own[id] = t.tid)); const mine = new Set((M.L.teams.find(t => t.tid === M.L.me) || {}).ids || []);
      const yr = id => (M.yrank && M.yrank(id)) || null; const by = {};
      Object.entries(tm.by).forEach(([give, rows]) => { if (!mine.has(give)) return; // traded away since Trade Monster was read
        const deals = rows.map(r => { const you = Math.round(r.t1 * 0.99), them = Math.round(r.t2 * 0.99), tid = own[r.id] && own[r.id] !== M.L.me ? own[r.id] : null; const ra = yr(give), rb = yr(r.id); const why = [];
          if (!tid) why.push('not on another team any more'); if (them < tmin) why.push('they lose ' + Math.abs(them) + ' of 99');
          if (ra && rb && Math.abs(ra - rb) > gap) why.push('Yahoo ranks them ' + ra + ' and ' + rb);
          return { id: r.id, give, you, them, tid, ra, rb, why }; });
        const score = d => Math.min(d.you, d.them); const clear = deals.filter(d => d.you >= bar);
        by[give] = { ok: clear.filter(d => !d.why.length).sort((a, b) => score(b) - score(a) || b.you - a.you), no: clear.filter(d => d.why.length).sort((a, b) => b.you - a.you), n: rows.length }; });
      const tgt = {}, k = d => (d.why.length ? 0 : 1000) + d.you; Object.values(by).forEach(x => x.ok.concat(x.no).forEach(d => { if (!tgt[d.id] || k(d) > k(tgt[d.id])) tgt[d.id] = d; }));
      return { ts: tm.ts, by, tgt, bar, tmin, gap }; }); }
  // one Trade Monster swap as a line: their player, both teams' numbers, Yahoo rank, injury, why it's unlikely. For a one-for-one
  // Basketball Monster's category gain is his category values less yours; when one category carries over 70% of it, say so.
  function tmLine(M, d, injT, o) { o = o || {}; const p = M.P[d.id] || {}, q = M.P[d.give] || {}; const a = (p.ros || {}).cv || {}, b = (q.ros || {}).cv || {};
    const g = M.ctx.cats.map(c => [c, (a[c] || 0) - (b[c] || 0)]).filter(x => x[1] > 0).sort((x, y) => y[1] - x[1]); const t = g.reduce((s, x) => s + x[1], 0); const cc = g[0] && t > 0 && g[0][1] / t > 0.7 ? g[0][0] : null;
    return `<div class="mvl tmd"><span>${esc(p.n || d.id)}${injT(d.id)}${o.team ? ` <i>${o.team}</i>` : ''}</span><b class="${d.you > 0 ? 'plus' : 'minus'}">You ${of99(d.you)}</b> · <b class="${d.them >= 0 ? 'plus' : 'minus'}">them ${of99(d.them)}</b> <i>of 99${d.rb ? ' · Yahoo rank ' + d.rb : ''}</i>${cc ? `<div class="sub">Most of your gain is in ${esc(NN(cc))}</div>` : ''}${d.why.length ? `<div class="sub">Unlikely: ${esc(d.why.join('; '))}</div>` : ''}${o.warn ? `<div class="sub minus">Warning: ${esc(o.warn)}</div>` : ''}</div>`; }
  // the decision on the list's number 1 (and the tags every page shows): add now, wait until Monday, or nothing worth an add
  function boardPick(lg, A) { const B = boardFor(lg); const M = modelFor(lg); if (!B || !M || !B.list.length) return null; const y = yrFor(lg); const s = S(lg);
    { const nx = ynextOf(y); M.L.oppNext = nx && nx.oppTid ? String(nx.oppTid) : null; }
    const bar = pick99(lg); const pk = Array.isArray(s.pickAdds) ? null : (s.pickAdds || {})[0]; let chosen = pk ? B.list.find(x => K(M.P[x.id].n) === K(pk)) : null;
    const fd = chosen && (s.forceDrop || {})[K(M.P[chosen.id].n)]; let drop = chosen ? chosen.drop : null; if (fd) { const d = B.order.find(o => K(M.P[o.id].n) === fd); if (d) drop = d.id; }
    const top = chosen || B.list[0]; drop = drop || top.drop; const you = drop === top.drop ? top.you : B.you(top.id, drop);
    // timing from Matchup Monster's game grid: adding now costs this week when the drop has more games left this week than the add
    const mw = mmWeek(lg); const ga = gamesLeft(mw, top.id), gd = drop ? gamesLeft(mw, drop) : null; const adds = A ? A.left : 1;
    // the final week has no Monday to wait for: add now or not at all
    const last = seasonState(lg).last; const worth = (!last || adds > 0) && (!!chosen || (you != null && you >= bar)); const wait = worth && !last && (!adds || (ga != null && gd != null && gd > ga));
    // 8.5.0: over Yahoo's limit, no add is possible until the roster fits (the injured-list card names the drop); an IL drop or an
    // open spot that needs an injured player moved first says so
    const rc = rosterCheck(y); const ilDrop = !!(drop && M.ilIds && M.ilIds.has(drop)); const ilMove = rc && (ilDrop || (!drop && rc.freeNow <= 0)) ? ((ilDrop ? rc.movable[0] : rc.moves[0]) || {}).name || null : null;
    if (rc && rc.drops) return { id: top.id, drop: null, add: M.P[top.id].n, dropName: null, open: false, you, season: you, worth: false, wait: false, over: rc.drops, overTxt: `${rc.total} players and room for ${rc.activeCap + rc.ilCap}` };
    return { id: top.id, drop: drop || null, add: M.P[top.id].n, dropName: drop ? M.P[drop].n : null, ilDrop, ilMove, open: !drop, you, season: you, ga, gd, atLeast: top.atLeast, worth, wait, why: !adds ? 'adds' : wait ? 'week' : null, chosen: !!chosen, bar }; }
  // ---- advice log: the board's pick, its top 10 and two simple alternatives, once a day per league. A raw record only (it never
  // feeds advice): tools/advice-backtest.js later checks each pick on what the players actually did, against its prediction and
  // against the alternatives: Basketball Monster's top free agent and Yahoo's most added, each with its own best drop. ----
  function logAdvice(lg) { const y = yrFor(lg); const B = boardFor(lg), M = modelFor(lg); if (!y || !y.lid || !B || !M || !B.list.length) return;
    const k = 'advlog:' + y.lid, day = usToday(); const old = ST[k] || { v: 1, log: [] }; if (old.log.length && old.log[old.log.length - 1].day === day) return;
    const pk = boardPick(lg); if (!pk) return; const n = id => id ? M.P[id].n : null, r4 = x => +x.toFixed(4); const kp = boardKeep(lg, M);
    const fas = M.L.fas.filter(id => !kp.block.has(id) && !kp.taken.has(K(M.P[id].n)));
    const alt = id => { if (!id) return null; if (B.open) return { add: n(id), drop: null, gain: r4(B.swap(id, null).g) }; let b = null; B.order.slice(0, 10).forEach(o => { const g = B.swap(id, o.id).g; if (!b || g > b.g) b = { drop: o.id, g }; }); return b && { add: n(id), drop: n(b.drop), gain: r4(b.g) }; };
    const bbmTop = fas.slice().sort((a, b) => window.H2H.worth(M.ctx, b, 'ros') - window.H2H.worth(M.ctx, a, 'ros'))[0];
    const hotId = fas.map(id => ({ id, t: M.trend(n(id)) })).filter(x => x.t && (x.t.net || 0) > 0).sort((a, b) => (b.t.net || 0) - (a.t.net || 0)).map(x => x.id)[0];
    const wkEnd = y.weekStart && y.weekStart <= day && y.weekEnd >= day ? y.weekEnd : addDay(day, 6 - (new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7);
    const e = { day, week: y.week || null, weekEnd: wkEnd, punt: B.punt || null, cats: M.ctx.cats, weeks: +B.weeks.toFixed(2), sdMul: M.ctx.sdMul || 1, bar: pk.bar,
      pick: { add: pk.add, drop: pk.dropName, you: pk.you, worth: pk.worth, wait: pk.wait, chosen: pk.chosen },
      list: B.list.slice(0, 10).map(x => ({ add: n(x.id), drop: n(x.drop), you: x.you })), bbm: alt(bbmTop), hot: alt(hotId), roster: B.mine.map(x => n(x.id)) };
    ST[k] = { v: 1, log: old.log.concat([e]).slice(-500) }; browser.storage.local.set({ [k]: ST[k] }); }
  // ---- reads on your players (owner's review 25 Nov): one verdict each, from Basketball Monster's numbers only.
  //   best: his best free agent in Find Free Agents (the same free agents Pickups offers: not your recent drops or players taken)
  //   costs ("A free agent does more"): that free agent clears your pickup bar in his place, and no trade does more
  //   sell: Trade Monster has a realistic swap for him that clears your trade bar, worth at least as much as the free agent
  //   keep: everything else
  // Never a drop candidate: injured-list players, your keeps, recent adds and top-half players (boardKeep). Other teams' players
  // are read from their Basketball Monster category values only (fitOf). ----
  function readsFor(lg) { const M = modelFor(lg); const B = boardFor(lg); if (!M || !B) return null; const TD = tmDeals(lg, M);
    return memo('reads|' + lg + '|' + (B.ts || 0) + '|' + (TD ? TD.ts + '|' + TD.bar + '|' + TD.tmin + '|' + TD.gap : ''), () => {
      const pbar = pick99(lg); const F = (M.fa && M.fa.by) || {}; const pool = B.pool || new Set();
      const by = {}; B.mine.forEach(x => { const il = M.ilIds.has(x.id); let best = null;
        (F[x.id] || []).forEach(r => { if (pool.has(r.id) && (!best || r.d > best.d)) best = { id: r.id, d: r.d }; }); if (best) best.you = Math.round(best.d * 99);
        const fa = best && !x.keep && best.you >= pbar ? best : null; const sell = !il && TD && TD.by[x.id] ? TD.by[x.id].ok : [];
        const kind = fa && (!sell.length || fa.you >= sell[0].you) ? 'costs' : sell.length ? 'sell' : 'keep';
        by[x.id] = { cats: x.cats, best, fa, sell, il, held: !!x.keep, kind, pbar }; });
      return { by, league: {}, pbar, weeks: B.weeks, B }; }); }
  // ---- health: is every source fresh enough to trust the advice? ----
  // ---- health: quiet when things are fine; one clear button when only you can fix it (a sign-in) ----
  const SIGNIN = { bbm: 'https://basketballmonster.com/Login.aspx', yahoo: 'https://login.yahoo.com/?done=' + encodeURIComponent('https://basketball.fantasysports.yahoo.com/nba') };
  function authHtml() { const a = (ST.health || {}).auth || {}; const ba = ST.bbmAuth || {}; let h = '';
    // the browser emptied the co-pilot's storage (and so your sign-ins): that's a browser setting, and it explains repeated sign-outs
    if (ST.wiped && Date.now() - ST.wiped.ts < 4 * 864e5 && !ST.wipedSeen) h += `<div class="card authc"><div class="h"><span>Firefox is wiping your sign-ins</span><button class="lnk" id="wipedOk">Got it</button></div><div class="sub">Firefox cleared the co-pilot's data ${ago(ST.wiped.ts)}. When that happens it also signs you out of Yahoo and Basketball Monster, which is why you keep having to sign in again. It's a Firefox privacy setting:</div><ol class="sub" style="margin:0 0 4px 16px;padding:0"><li>Firefox Settings → <b>Privacy &amp; Security</b>.</li><li>Under <b>Cookies and Site Data</b>, untick <b>Delete cookies and site data when Firefox is closed</b>. If you'd rather keep it, press <b>Manage Exceptions</b> and add <b>https://basketballmonster.com</b> and <b>https://yahoo.com</b> as <b>Allow</b>.</li><li>Under <b>History</b>, if it says <b>Use custom settings</b>, make sure <b>Clear history when Firefox closes</b> is off, or that its Settings don't include cookies or site data.</li></ol><div class="sub">Your leagues and settings were restored automatically.${ST.bbmAuthKeep ? '' : ' To have your Basketball Monster sign-in restored too, tick the safety-copy option under Settings → Basketball Monster sign-in.'}</div></div>`;
    if (a.yahoo) h += `<div class="card authc"><div class="h"><span>Yahoo signed you out</span></div><div class="sub">Sign in again and tick <b>Stay signed in</b>. The co-pilot carries on by itself as soon as you open any Yahoo Fantasy page.</div><a class="btn small" href="${SIGNIN.yahoo}" target="_blank" rel="noopener">Sign in to Yahoo</a></div>`;
    if (a.bbm) h += `<div class="card authc"><div class="h"><span>Basketball Monster signed you out</span></div><div class="sub">${ba.user ? (ba.lastErr ? 'Automatic sign-in didn\'t work: ' + esc(ba.lastErr) + '. Check the details in Settings (the gear, top right), or sign in yourself.' : 'Signing in again automatically…') : 'Sign in again, or save your Basketball Monster sign-in in Settings (the gear, top right) so the co-pilot does it for you from now on.'} It carries on by itself once you're signed in.</div><a class="btn small" href="${SIGNIN.bbm}" target="_blank" rel="noopener">Sign in to Basketball Monster</a>${ba.user ? '' : ' <button class="lnk" data-open-bbm>Save sign-in</button>'}</div>`;
    return h; }
  function lastGood(lid) { return ((ST.health || {}).lastGood || {})[lid] || 0; }
  // the status pill only speaks up when the advice could be off (Yahoo or BBM data too old). Everything the co-pilot can fix by
  // itself (retries, Matchup Monster falling back to BBM projections, news checks) happens quietly and is listed in Diagnostics
  function healthHtml(lg) {
    const l = leaguesKnown().find(x => x.league === lg); if (!l) return ''; const st = ST['sync:' + l.lid], bx = ST['bx:' + l.lid], y = ST['yr:' + l.lid]; const iss = [];
    const yAge = y ? Date.now() - y.ts : Infinity, bAge = bx && bx.ts && bx.ts.rest ? Date.now() - bx.ts.rest : Infinity; const good = Math.max(lastGood(l.lid) || 0, Math.min(y ? y.ts : 0, bx && bx.ts && bx.ts.rest || 0));
    if (!y && !st) iss.push(['warn', 'Not synced yet']);
    else if (yAge > 8 * 3600e3) iss.push(['bad', 'Yahoo read ' + ago(y ? y.ts : 0) + ', retrying']);
    if (bAge > 12 * 3600e3 && bAge !== Infinity) iss.push(['bad', 'Basketball Monster ' + ago(bx.ts.rest).replace(' ago', ' old') + ', retrying']);
    else if (!bx || !bx.ts) iss.push(['warn', 'Basketball Monster projections not loaded yet']);
    if (planFrom[lg] === 'bbm-rest') iss.push(['info', "Matchup Monster unavailable: planned from Basketball Monster's projections"]);
    // the sync's own self-check: a read that came back wrong (usually Yahoo or Basketball Monster changed a page) says so here
    ((ST.selftest || {}).checks || []).filter(c => !c.ok && (c.name.startsWith(lg + ': ') || !c.name.includes(': '))).forEach(c => iss.push(['bad', c.name.replace(lg + ': ', '') + " didn't read properly (" + c.info + '): using the last good copy']));
    healthNow[lg] = { iss, good }; // shown in the one status line at the top (see syncBar); nothing here needs you to act
    syncBar(); return updHtml() + authHtml(); // sign-in prompts are the only status that sits in the page: they need you
  }
  const healthNow = {};
  // a newer signed version than the one running: Firefox installs it by itself; until it has, one tap here installs it
  const vnum = v => String(v || '0').split('.').map(Number).reduce((a, x) => a * 1000 + (x || 0), 0);
  const updHtml = () => { const u = ST.updAvail; const cur = browser.runtime.getManifest().version; return u && u.version && vnum(u.version) > vnum(cur) && u.link ? `<button class="updbar" id="updNow"><b>Version ${esc(u.version)} is ready</b><span>Tap to install now · otherwise Firefox installs it by itself</span></button>` : ''; };
  const ICON = { sync: '<svg class="spin ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/><circle cx="12" cy="12" r="4.6" fill="currentColor" stroke="none"/><path d="M7.4 12h9.2M12 7.4v9.2M9 8.6c1.5 1.9 1.5 4.9 0 6.8M15 8.6c-1.5 1.9-1.5 4.9 0 6.8" stroke="var(--bg)" stroke-width="1"/></svg>' };

  // ---- Basketball Monster sign-in, saved so the co-pilot can sign back in by itself ----
  const hide = v => { const k = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join(''); return k + '.' + btoa(unescape(encodeURIComponent(v)).split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ k.charCodeAt(i % k.length))).join('')); };
  function bbmAuthHtml() { const a = ST.bbmAuth || {};
    const state = a.user ? (a.lastErr ? `<span class="minus">last attempt failed: ${esc(a.lastErr)}</span>` : a.lastOk ? `<span class="plus">working</span> · last signed in ${ago(a.lastOk)}` : 'saved') : 'not saved';
    return `<details data-k="bbmauth" style="margin-top:8px"><summary>Basketball Monster sign-in: ${a.user ? esc(a.user) : '<span class="sub">not saved</span>'}</summary><div class="yc">
      <div class="sub">When Basketball Monster signs you out, the co-pilot signs back in with these and carries on. They stay in this browser's add-on storage and are only ever sent to basketballmonster.com.</div>
      <input id="bbmUser" placeholder="Basketball Monster email or username" value="${esc(a.user || '')}" autocomplete="off"><input id="bbmPass" type="password" placeholder="${a.pass ? 'Password saved (type to change)' : 'Password'}" autocomplete="new-password">
      <label class="sub" style="display:flex;gap:8px;align-items:flex-start;margin-top:8px"><input type="checkbox" id="bbmKeep" ${ST.bbmAuthKeep ? 'checked' : ''}> Also keep them in the browser's safety copy, so they survive Firefox clearing its data (that copy travels with your Firefox account if you use Sync).</label>
      <div class="row" style="margin-top:8px;gap:8px"><button class="btn small" id="bbmSave">Save and test</button>${a.user ? '<button class="lnk" id="bbmForget">Forget</button>' : ''}</div><div class="msg" id="bbmMsg">Status: ${state}</div></div></details>`; }
  // Yahoo's API (trial): your own Yahoo app's codes, a one-time sign-in on Yahoo's page, then a roster read checked against the page
  function yapiHtml() { const a = ST.yapi || {}; const state = a.lastErr ? `<span class="minus">${esc(a.lastErr)}</span>` : a.refresh ? `<span class="plus">connected</span> · last checked ${ago(a.lastOk)}` : a.id ? 'codes saved, not connected yet' : 'not set up';
    return `<details data-k="yapi" style="margin-top:8px"><summary>Yahoo connection (trial): ${a.refresh ? 'connected' : '<span class="sub">not connected</span>'}</summary><div class="yc">
      <div class="sub">Your Yahoo developer app's codes. They stay in this browser's add-on storage and are only ever sent to Yahoo. You sign in on Yahoo's own page: the co-pilot never sees your Yahoo password.</div>
      <div class="sub">Your Yahoo app's Redirect URI must be exactly: <b>${esc(window.YAPI && browser.identity ? window.YAPI.redirect() : '')}</b></div>
      <input id="yapiId" placeholder="Client ID" value="${esc(a.id || '')}" autocomplete="off"><input id="yapiSecret" type="password" placeholder="${a.secret ? 'Client Secret saved (type to change)' : 'Client Secret'}" autocomplete="new-password">
      <div class="row" style="margin-top:8px;gap:8px"><button class="btn small" id="yapiGo">Save and connect</button>${a.refresh ? '<button class="lnk" id="yapiTest">Test: read my roster</button><button class="lnk" id="yapiForget">Forget</button>' : ''}</div><div class="msg" id="yapiMsg">Status: ${state}</div></div></details>`; }
  function wireYapi() { const msg = h => { const m = $('yapiMsg'); if (m) m.innerHTML = h; };
    const go = $('yapiGo'); if (go) go.onclick = async () => { const id = $('yapiId').value.trim(), sec = $('yapiSecret').value.trim(); const a = ST.yapi || {}; if (!id || (!sec && !a.secret)) { msg('Enter the Client ID and Client Secret.'); return; }
      ST.yapi = Object.assign({}, id === a.id ? a : {}, { id, secret: sec ? hide(sec) : a.secret }); await browser.storage.local.set({ yapi: ST.yapi }); msg('Opening Yahoo\'s sign-in…');
      try { ST.yapi = await window.YAPI.connect(); msg('<span class="plus">Connected. Press "Test: read my roster".</span>'); render(); } catch (e) { ST = await browser.storage.local.get(null); msg('<span class="minus">' + esc(e.message) + '</span>'); } };
    const ts = $('yapiTest'); if (ts) ts.onclick = async () => { const y = yrFor(league()); if (!y) { msg('Open a league first.'); return; } msg('Reading your roster from Yahoo\'s API…');
      try { const api = await window.YAPI.roster(y.lid, y.tid); const page = (y.rows || []).map(r => r.name); const miss = page.filter(n => !api.some(p => NAMES.same(p.name, n))), extra = api.filter(p => !page.some(n => NAMES.same(p.name, n))).map(p => p.name);
        msg(`Read <b>${api.length}</b> players for ${esc(y.league)}${miss.length || extra.length ? `. <span class="minus">Differs from the team page: ${esc(miss.concat(extra).join(', '))}</span>` : '. <span class="plus">Exactly matches the team page.</span>'}<div class="sub">${esc(api.map(p => `${p.name} (${p.slot || '?'}${p.status ? ', ' + p.status : ''})`).join(' · '))}</div>`); }
      catch (e) { msg('<span class="minus">' + esc(e.message) + '</span>'); } };
    const fg = $('yapiForget'); if (fg) fg.onclick = async () => { ST.yapi = null; await browser.storage.local.remove('yapi'); render(); }; }
  function wireBbm() { wireYapi();
    // Firefox blocks installs from a tab an add-on opens, so ask Firefox itself to fetch and apply the update
    const un = $('updNow'); if (un) un.onclick = async () => { const t = un.querySelector('span'); un.disabled = true; t.textContent = 'Asking Firefox for the update…'; let s = null;
      try { s = await browser.runtime.sendMessage({ target: 'bg', cmd: 'update' }); } catch (e) {}
      t.textContent = s === 'update_available' ? 'Installing: the panel reloads by itself' : 'Firefox hasn\'t picked it up yet: open about:addons, click the gear, then Check for Updates'; };
    const wo = $('wipedOk'); if (wo) wo.onclick = () => { ST.wipedSeen = true; browser.storage.local.set({ wipedSeen: true }); render(); };
    const sv = $('bbmSave'); if (sv) sv.onclick = async () => { const u = $('bbmUser').value.trim(), pw = $('bbmPass').value; const a = ST.bbmAuth || {}; if (!u || (!pw && !a.pass)) { $('bbmMsg').textContent = 'Enter your email and password.'; return; }
      const na = { user: u, pass: pw ? hide(pw) : a.pass, fails: 0, failTs: null, lastErr: null, lastOk: a.lastOk || null }; await browser.storage.local.set({ bbmAuth: na }); ST.bbmAuth = na; $('bbmMsg').textContent = 'Testing…'; sv.disabled = true;
      let r = null; try { r = await browser.runtime.sendMessage({ target: 'bg', cmd: 'bbmLogin' }); } catch (e) {} if (!r && window.SYNC) { try { r = await window.SYNC.bbmLogin(); } catch (e) { r = { ok: false, why: e.message }; } }
      ST = await browser.storage.local.get(null); DV++; $('bbmMsg').innerHTML = r && r.ok ? '<span class="plus">Signed in. The co-pilot will keep you signed in from now on.</span>' : '<span class="minus">' + esc((r && r.why) || 'Could not test it right now') + '</span>'; sv.disabled = false;
      if (r && r.ok && (ST.health || {}).auth && ST.health.auth.bbm) runSync(false, true); };
    const kp = $('bbmKeep'); if (kp) kp.onchange = () => { ST.bbmAuthKeep = kp.checked; browser.storage.local.set({ bbmAuthKeep: kp.checked }); };
    const fg = $('bbmForget'); if (fg) fg.onclick = async () => { await browser.storage.local.remove('bbmAuth'); delete ST.bbmAuth; render(); };
    document.querySelectorAll('[data-open-bbm]').forEach(b => b.onclick = () => { showSettings(true, 'bbmauth'); });
  }
  // ---- today at a glance ----
  function briefHtml(p, lg, M) {
    const y = yrFor(lg); const t = usToday(); const rows = [];
    const lv = y && ST['ylive:' + y.lid]; if (M && lv && lv.week === y.week) { const card = window.CTX.liveCard(M, ST, y.lid, y, bbmView(mmWeek(lg), p)); const m0 = card.match(/<div class="score"><b>([^<]+)<\/b>/), w0 = card.match(/hero-pct">(\d+)%/); if (m0 && w0) rows.push(['good', `Live: <b>${m0[1]}</b> in categories, <b>${w0[1]}%</b> to win the week`]); }
    // in order: 1 the roster move (if one is due), 2 the lineup for the roster you then have
    const d = (p.nowDays || p.days).find(x => x.date === t); const due = p.moves.filter(x => x.date <= t), nxt = p.moves.filter(x => x.date > t);
    if (due.length) due.forEach(x => { const u = yLink(lg, x.add); rows.push(['warn', `<b>1 · Roster:</b> add <b>${esc(x.add)}</b>${x.drop ? ', drop <b>' + esc(x.drop.replace(/\.$/, '')) + '</b>' : x.il ? ' (' + esc(x.il) + ' to IL first)' : ''}${u ? ` · <a href="${esc(u)}" target="_blank" rel="noopener">open on Yahoo</a>` : ''}`]); });
    else if (p.bd && p.bd.over) rows.push(['bad', `<b>1 · Roster:</b> over Yahoo's limit: drop ${p.bd.over > 1 ? p.bd.over + ' players' : 'a player'} before anything else. Who to drop on Pickups names who.`]);
    else rows.push(['good', `<b>1 · Roster:</b> no pickup today${nxt.length ? `. Next: <b>${esc(nxt[0].add)}</b> on ${esc(fmtD(nxt[0].date))}` : p.bd && p.bd.worth && p.bd.wait ? `. Best pickup <b>${esc(p.bd.add)}</b> (${p.bd.dropName ? 'for ' + esc(p.bd.dropName) : 'into your empty spot'}): wait until Monday` : ''}`]);
    if (due.length) rows.push(['', '<b>2 · Lineup:</b> set it after the pickup (it\'s re-planned once Yahoo shows the change)']);
    else if (d && d.open && (d.start.length + d.bench.length)) { const c = dayCheck(d, y ? actualFor(y.lid, t) : null); rows.push(c.known ? (c.changes ? ['warn', `<b>2 · Lineup:</b> <b>${c.changes} change${c.changes > 1 ? 's' : ''}</b> to make today`] : ['good', '<b>2 · Lineup:</b> set correctly for today']) : ['', '<b>2 · Lineup:</b> checking today\'s lineup on Yahoo…']); }
    else rows.push(['good', '<b>2 · Lineup:</b> nobody plays today']);
    if (M && d && !due.length) d.start.forEach(x => { const inj = injFor(y, M, x.name); if (inj && /^(Q|D|GTD|O|OUT|DTD)/i.test(inj)) rows.push(['bad', `<b>${esc(x.name)}</b> is listed <b>${esc(injWord(inj))}</b> and starts today: check before tip-off`]); });
    (ST.alerts || []).filter(a => a.league === lg && Date.now() - a.ts < 12 * 3600e3 && (!/^\d{4}-\d\d-\d\d\|/.test(a.key || '') || a.key.startsWith(t + '|'))) // a lineup alert is for its own day only.forEach(a => rows.push(['bad', esc(a.msg)]));
    if (y) y.rows.filter(r => /^IL/.test(r.slot) && !/^(O|INJ|OUT|IL|NA|SUSP)/i.test(r.inj || '')).forEach(r => rows.push(['warn', `<b>${esc(r.name)}</b> is back from injury but still on IL: he'll need a roster spot`]));
    // 3 · the best realistic swap from Trade Monster (the same list as the Trades page)
    const ss = seasonState(lg); if (ss.tradesShut) rows.push(['good', `<b>3 · Trade:</b> trades closed on ${esc(ss.tradeEnd)} (Yahoo's trade deadline)`]);
    else if (M) try { const TD = tmDeals(lg, M); if (TD) { let bt = null; Object.values(TD.by).forEach(x => { const d = x.ok[0]; if (d && !anchorDrops(lg, M, d.give, d.id).length && (!bt || Math.min(d.you, d.them) > Math.min(bt.you, bt.them))) bt = d; });
      if (bt) rows.push(['warn', `<b>3 · Trade:</b> Trade Monster has realistic swaps for <b>${esc((M.P[bt.give] || {}).n || bt.give)}</b>, the best <b>${of99(bt.you)}</b> of 99 for you and ${of99(bt.them)} for them · <button class="lnk" data-gostab="trades:block" data-blockadd="${esc(bt.give)}">Put him on the trade block</button>`]);
      else rows.push(['good', `<b>3 · Trade:</b> no Trade Monster swap clears ${of99(TD.bar)} of 99 with a realistic chance of a yes`]); } } catch (e) { console.error('brief trade', e); }
    const A = p.adds; rows.push(['', `${Math.max(0, A.limit - A.used)} of ${A.limit} adds left this week`]);
    return `<div class="card brief"><div class="h"><span>Today: do next</span><span class="sub">${esc(fmtD(t))}</span></div>${rows.map(r => `<div class="brow"><i class="dot d-${r[0]}"></i><div>${r[1]}</div></div>`).join('')}</div>`;
  }
  const injWord = s => ({ Q: 'questionable', D: 'doubtful', O: 'out', GTD: 'a game-time decision', DTD: 'day-to-day', P: 'probable' }[String(s).toUpperCase().split(/\s/)[0]] || String(s).toLowerCase());
  function ctxBlock() {
    // Yahoo's player lists get no card: the Pickups page shows only the best free agents across the league, not what's on screen
    const yp = ypageNow(); if (!yp || !window.CTX || yp.kind === 'players') return '';
    const l = leaguesKnown().find(x => x.lid === yp.lid);
    const M = modelFor(l.league);
    // get fresh BBM numbers before advising: none yet, or this week's projections over an hour old
    const bx = ST['bx:' + yp.lid]; const restAge = bx && bx.ts && bx.ts.rest ? Date.now() - bx.ts.rest : Infinity; const busy = ST.syncLock && Date.now() - ST.syncLock.ts < 4 * 60e3;
    if ((!M || restAge > 60 * 60e3) && !ctxRefreshing[yp.lid] && !busy && window.SYNC && window.SYNC.bx) { ctxRefreshing[yp.lid] = true;
      window.SYNC.bx({ lid: l.lid, league: l.league }, M ? { only: ['rest', 'next'], maxAge: { rest: 60, next: 60 } } : {}).catch(() => {}).then(() => { ctxRefreshing[yp.lid] = false; return browser.storage.local.get(null); }).then(a => { ST = a; render(); }); }
    const title = { trade: 'Trade', add: 'Pickup', players: 'Player list' }[yp.kind];
    if (!M) return `<div class="card ctx"><div class="h"><span>${title}</span></div><div class="sub">${ctxRefreshing[yp.lid] || busy ? 'Fetching the latest Basketball Monster projections (the first time takes about 30 seconds)…<span class="skel" style="width:80%"></span><span class="skel" style="width:55%"></span>' : (bx && bx.err ? 'Couldn\'t get Basketball Monster projections: ' + esc(bx.err) : 'Basketball Monster projections not loaded yet. Sign in at basketballmonster.com, then press Sync.')}</div></div>`;
    // the long-term part of every verdict on Yahoo's pages uses the panel's own season measure (one mechanism)
    M.board = boardFor(l.league); M.pickBar = pick99(l.league); M.bar99 = bar99(l.league); M.themMin = themMin(l.league); M.rankGap = rankGap(l.league);
    // the deal as ticked, asked live of Trade Monster (a few seconds); the card shows "Asking…" until it answers
    M.ana = (them, give, get) => { const k = [yp.lid, them, give.slice().sort(), get.slice().sort()].join('|'); if (tmAsk[k]) return tmAsk[k];
      if (!window.SYNC || !window.SYNC.bbmAnalyze || window.PHONE_V) return { err: 'Trade Monster can only be asked from Firefox on the PC' };
      tmAsk[k] = { pending: true }; window.SYNC.bbmAnalyze({ lid: l.lid, league: l.league }, M.teamName(them), give, get).catch(e => ({ err: e.message })).then(r => { tmAsk[k] = r; render(); }); return tmAsk[k]; };
    M.anaAdd = (add, drop) => { const k = [yp.lid, 'add', add, drop || ''].join('|'); if (tmAsk[k]) return tmAsk[k];
      if (!window.SYNC || !window.SYNC.bbmAnalyzeAdd || window.PHONE_V) return { err: 'Trade Monster can only be asked from Firefox on the PC' };
      tmAsk[k] = { pending: true }; window.SYNC.bbmAnalyzeAdd({ lid: l.lid, league: l.league }, add, drop).catch(e => ({ err: e.message })).then(r => { tmAsk[k] = r; render(); }); return tmAsk[k]; };
    { const mw = mmWeek(l.league); M.gl = id => gamesLeft(mw, id); }
    let body; try { if (yp.kind === 'trade') body = window.CTX.tradeCard(M, yp); else if (yp.kind === 'add') body = window.CTX.addCard(M, yp); else body = window.CTX.listCard(M, yp).html; } catch (e) { console.error(e); body = `<div class="sub">Couldn't read this page: ${esc(e.message)}</div>`; }
    // 8.3.0: the anchor warning on Yahoo's trade page (the remove-him test with what comes back)
    if (yp.kind === 'trade') try { const ids = ys => (ys || []).map(y => { const p = (yp.players || {})[y]; return p && M.find(p.n, p.t); }).filter(Boolean);
      const D = anchorDrops(l.league, M, ids(yp.give), ids(yp.get)); if (D.length) body += `<div class="sub minus">Warning: after this trade ${esc(dropWords(D))}</div>`; } catch (e) { console.error('anchor', e); }

    if (Object.keys(M.yidmap).length !== Object.keys(ST.yidmap || {}).length) { ST.yidmap = M.yidmap; browser.storage.local.set({ yidmap: M.yidmap }); }
    const fr = window.CTX.freshness(M.bx, yp.kind === 'players' ? ['rest', 'ros'] : ['rest', 'ros', 'po']);
    const age = `<span class="sub${fr.worst > 6 * 3600e3 ? ' minus' : ''}">${esc(fr.line)}${ctxRefreshing[yp.lid] ? ' · refreshing…' : ''}</span>`;
    return `<div class="card ctx">${body.replace('<span class="sub" id="ctxAge"></span>', age)}</div>`;
  }
  // ---- one-page app: five pages on a bottom bar. The panel never jumps by itself: the page matching the Yahoo screen
  // you're on just gets a dot, and that page shows what the co-pilot reads from it at the top ----
  const TABS = [['week', 'Matchup', '<path d="M3 5h18v16H3z"/><path d="M3 10h18M8 3v4M16 3v4"/>'], ['team', 'Lineup', '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5"/><path d="M16 4.6a3 3 0 0 1 0 6.4M18 14.8c1.8.7 2.9 2.4 3.2 5.2"/>'], ['players', 'Pickups', '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'], ['trades', 'Trades', '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>'], ['season', 'Season', '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 6h3a3 3 0 0 1-3 4M7 6H4a3 3 0 0 0 3 4"/>']];
  const TABPARTS = { week: ['live', 'hero', 'brief', 'next'], team: ['ilback', 'week'], players: ['ctx', 'drop', 'board'], trades: ['ctx', 'strategy'], season: ['standings', 'league', 'strategy'] };
  const OLDTAB = { strategy: 'trades', league: 'season' }; // pages before 7.46.0
  const curTab = () => { const t = OLDTAB[ST.uiTab] || ST.uiTab; return TABS.some(x => x[0] === t) ? t : 'week'; };
  // the Yahoo screen you're on (only while it's recent): which league, which page of the co-pilot it belongs to, what to call it
  function yahooOn() { const yp = ST.ypage; if (!yp || Date.now() - yp.ts > 30 * 60e3) return null; const l = leaguesKnown().find(x => x.lid === yp.lid); if (!l) return null;
    let tab = { matchup: 'week', players: 'players', add: 'players', trade: 'trades', standings: 'season', league: 'season' }[yp.kind] || null; let label = { matchup: 'Matchup', players: 'Player list', add: 'Add a player', trade: 'Trade', standings: 'Standings', league: 'League' }[yp.kind] || '';
    if (yp.kind === 'team') { const y = yrFor(l.league); if (y && String(yp.tid) === String(y.tid)) { tab = 'team'; label = 'Your team'; } }
    return tab ? { league: l.league, lid: l.lid, tab, label, kind: yp.kind } : null; }
  let navAlert = {};
  // the bottom bar keeps its elements between renders, so the selection pill slides and icons don't flicker
  function setNav(lg) { const b = $('bnav'); if (!b) return; const html = navHtml(lg); const sig = html.replace(/ class="on"/g, '').replace(/ class=""/g, '');
    if (b.dataset.sig !== sig) { b.innerHTML = html + '<span class="bnav-ind" aria-hidden="true"></span>'; b.dataset.sig = sig; wireNav(); }
    else b.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === curTab()));
    const i = TABS.findIndex(t => t[0] === curTab()); b.style.setProperty('--i', Math.max(0, i)); b.style.setProperty('--n', TABS.length); }
  function navHtml(lg) { const t0 = curTab(); const yo = yahooOn();
    return TABS.map(([k, l, ic]) => { const yDot = yo && yo.league === lg && yo.tab === k; const al = navAlert[k];
      return `<button data-tab="${k}" class="${t0 === k ? 'on' : ''}" title="${esc(l)}${yDot ? ' · on Yahoo now: ' + esc(yo.label) : ''}${al ? ' · ' + esc(al) : ''}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic}</svg><span>${esc(l)}</span>${al ? '<i class="ndot alert"></i>' : yDot ? '<i class="ndot y"></i>' : ''}</button>`; }).join(''); }
  function wireNav() { document.querySelectorAll('#bnav [data-tab]').forEach(b => b.onclick = () => { if (ST.uiTab === b.dataset.tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; } ST.uiTab = b.dataset.tab; browser.storage.local.set({ uiTab: ST.uiTab }); render(); window.scrollTo(0, 0); }); }
  const yahooLine = (yo, tab, lg) => yo && yo.league === lg && yo.tab === tab ? `<div class="ynow"><i></i>On Yahoo now: <b>${esc(yo.label)}</b></div>` : '';
  // which week the panel shows: the one you're looking at on Yahoo (a team-page date or matchup week after this one means next
  // week), your own pick (until you move to another Yahoo page), and next week automatically once this one is over
  let wkPick = null;
  function weekSel(m0, nextOK) {
    if (!nextOK) return 'this';
    if (wkPick && wkPick.lg === m0.league && Date.now() - wkPick.ts < 6 * 3600e3) return wkPick.sel;
    return m0.end && usToday() > m0.end ? 'next' : 'this'; }
  const weekBar = (sel, m0, mN) => `<div class="seg wkbar"><button data-wk="this" class="${sel === 'this' ? 'on' : ''}">This week<i>vs ${esc(m0.opp || '')}</i></button><button data-wk="next" class="${sel === 'next' ? 'on' : ''}">Next week<i>vs ${esc((mN && mN.opp) || '')}</i></button></div>`;
  function wireHealth() { const b = $('healthB'); if (b) b.onclick = () => { showSettings(true, 'diag'); }; }
  function updateCtx() { const b = $('ctxBox'); if (b) b.innerHTML = ctxBlock(); else render(); }
  function renderB() {
    const m = mm(); const o = $('out');
    if (!m) { const lg0 = league(); const y0 = leaguesKnown().find(l => l.league === lg0); const st0 = y0 && ST['sync:' + y0.lid];
      const why = syncing ? 'Syncing now. The first full sync downloads a lot from Basketball Monster and can take a couple of minutes.' : st0 && st0.err ? 'The first sync hasn\'t worked yet (' + esc(st0.err) + '). It keeps retrying by itself.' : 'Press Sync to fetch this week from Basketball Monster (you\'re signed in there in this browser). The first sync can take a couple of minutes.';
      const yo0 = yahooOn(); const ctxOnly = !!ypageNow() && !!yo0 && yo0.tab === curTab(); setNav(lg0);
      // out of the playoffs or the season is over: no week will come, so say so and keep the standings on Season
      const ss0 = seasonState(lg0), yS = yrFor(lg0); if (ss0.over || (yS && yS.ts && !yS.oppTid && ss0.poStart && usToday() >= ss0.poStart)) {
        paint(o, healthHtml(lg0) + `<div class="card">${ss0.over ? `The season is over: Yahoo's playoffs ended ${esc(fmtD(ss0.poEnd))}.` : `You have no matchup on Yahoo this week.`} There's nothing left to set or pick up.</div>${curTab() === 'season' ? standingsCard(lg0, true) : ''}`);
        o.querySelectorAll('[data-stntab]').forEach(b => b.onclick = () => { S(lg0).stnTab = b.dataset.stntab; saveS(lg0); render(); }); wireConn(); return; }
      paint(o, healthHtml(lg0) + `${ctxOnly ? `<div id="ctxBox">${ctxBlock()}</div>` : ''}<div class="card">${why}</div>${setPane(lg0, `<div class="card sets">${bbmAuthHtml()}${diagHtml(lg0, null)}</div>`)}`); wireConn();
      const dl0 = $('diagDl'); if (dl0) dl0.onclick = () => { const keep = Object.keys(ST).filter(k => /^(bbmFail:|sync:|diag|fullsync:|ysetp:|yWeek|bxTrace:|bx:|ypage|syncLock|yr:)/.test(k)); const rep = { at: new Date().toISOString(), version: (browser.runtime && browser.runtime.getManifest ? browser.runtime.getManifest().version : ''), store: Object.fromEntries(keep.map(k => [k, /^bx:/.test(k) ? { ts: ST[k].ts, err: ST[k].err } : ST[k]])) };
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(rep, null, 1)], { type: 'application/json' })); a.download = 'copilot-diagnostics.json'; document.body.appendChild(a); a.click(); a.remove(); };
      return; }
    const pThis = compute(); const nxOK = !!nextModel(m); const wsel = weekSel(m, nxOK); const pNext = wsel === 'next' ? compute('next') : null;
    // check on Yahoo that the players the plan wants to add are really free (re-plans by itself when the answers arrive)
    { const yv = yrFor(m.league); const cand = []; [pThis, pNext].forEach(pp0 => pp0 && pp0.moves.forEach(x => { cand.push(x.add); (x.alts || []).forEach(a => cand.push(a.add)); })); { const B0 = boardFor(m.league), M0 = modelFor(m.league); if (B0 && M0) B0.list.slice(0, 5).forEach(x => cand.push(M0.P[x.id].n)); } verifyAvail(yv, cand); }
    const p = pNext || pThis; const s = S(m.league); const lg = m.league; const M = modelFor(lg);
    // one scale everywhere: long-term value from the BBM projections model (same numbers as trades and the player list)
    { const yF0 = yrFor(lg); const yF = yF0 ? Object.assign({}, yF0, { next: ynextOf(yF0) }) : null; if (M && yF && yF.next && yF.next.oppTid && M.ctx.has.next) { const fk = 'h2hfc:' + yF.lid + ':' + yF.next.start; if (!ST[fk]) { const me = M.L.teams.find(t => t.tid === M.L.me), op = M.L.teams.find(t => t.tid === String(yF.next.oppTid)); if (me && op) { try { const r = window.H2H.nextWeek(M.ctx, me.ids, op.ids); ST[fk] = { ts: Date.now(), W: r.W, sdMul: M.ctx.sdMul || 1, cats: Object.fromEntries(r.cats.map(c => [c.c, +c.p.toFixed(3)])) }; browser.storage.local.set({ [fk]: ST[fk] }); } catch (e) {} } } } }
    // every matchup in the league next week, forecast before it starts (kept fresh until it does): the forecast check's raw material
    { const yL = yrFor(lg); const nx = yL && ynextOf(yL); const sch = yL && ST['ysched:' + yL.lid]; const wN = yL && yL.week ? yL.week + 1 : null; const pr = sch && wN && sch.weeks && sch.weeks[wN];
      if (M && nx && nx.start && pr && pr.length && M.ctx.has.next && usToday() < nx.start) { const fk = 'lgfc:' + yL.lid + ':' + nx.start; const old = ST[fk];
        if (!old || Date.now() - old.ts > 6 * 3600e3) { const was = M.ctx.valuing; try { M.ctx.valuing = false; const T = {}; M.L.teams.forEach(t => T[t.tid] = t);
          const tot = {}; const tw = id => { const v = window.H2H.teamWeek(M.ctx, T[id].ids, 'next'); tot[id] = Object.fromEntries(Object.entries(v.m).map(([k, x]) => [k, +x.toFixed(2)])); tot[id].g = +v.games.toFixed(1); return v; };
          const out = pr.map(([a, b]) => { const A = T[String(a)], B = T[String(b)]; if (!A || !B) return null; const r = window.H2H.matchup(M.ctx, tw(String(a)), tw(String(b))); return { a: String(a), b: String(b), cp: Object.fromEntries(M.ctx.cats.map(c => [c, +r.cp[c].toFixed(3)])) }; }).filter(Boolean);
          if (out.length) { ST[fk] = { ts: Date.now(), week: wN, start: nx.start, sdMul: M.ctx.sdMul || 1, me: M.L.me, pairs: out, tot }; browser.storage.local.set({ [fk]: ST[fk] }); } } catch (e) { console.error(e); } finally { M.ctx.valuing = was; } } } }
    try { logAdvice(lg); } catch (e) { console.error(e); } // the advice backtest's raw material
    const stale = Date.now() - m.ts > 3 * 3600e3;
    // the hero is Basketball Monster's Matchup Monster for the week shown (bbmView), nothing of the planner's own odds
    const q = bbmView(pNext ? nextOf(m) : m, p); const W = q ? q.W.plan : null;
    let h = '';
    if (stale) h += `<div class="warn">Numbers are ${ago(m.ts).replace(' ago', '')} old. Press Sync before acting.</div>`;
    const cNote = h.length;
    const cs = (q ? q.cats.slice() : []).sort((a, b) => b.p - a.p);
    const c0 = h.length;
    const catsMode = p.obj === 'cats';
    if (!q) h += `<div class="card"><div class="h"><span>${pNext ? 'Next week' : 'This week'} against ${esc(p.opp)}</span></div><div class="strnone">Basketball Monster's Matchup Monster hasn't given its win chances for this week yet. They're read with every sync.</div></div>`;
    else { const Wv = catsMode ? (q.Wmaj || 0) : W; const vk = Wv >= 0.6 ? 'g' : Wv >= 0.4 ? 'a' : 'r'; const vt = Wv >= 0.6 ? 'Favourite' : Wv >= 0.4 ? 'Close week' : 'Underdog';
      const fmtT = (c, v) => v == null ? '–' : /%/.test(c.label) ? (v <= 1 ? (v * 100).toFixed(1) : (+v).toFixed(1)) + '%' : (+v).toFixed(v >= 100 ? 0 : 1);
      const heroNum = catsMode ? `${(q.Ecats || 0).toFixed(1)}<small>/${q.ncat}</small>` : pct(W); const tcls = v => v > 0.6 ? 'cs-a' : v >= 0.4 ? 'cs-c' : 'cs-b';
      h += `<div class="hero hv-${vk}"><div class="hero-top"><div class="hero-pct">${heroNum}</div><div class="hero-vs">${catsMode ? 'categories expected against' : 'chance to beat'}<br><b>${esc(p.opp)}</b>${p.playoffs ? ' · playoff week' : ''}</div><div class="hvk"><span class="fk ${vk}">${vt}</span>${catsMode ? `<i>${pct(q.Wmaj || 0)} to take the week</i>` : ''}</div></div>
      <div class="bl">${bottomLine(q)}</div>
      <div class="h" style="margin-top:12px"><span>Chance to win each category</span><span class="sub">you need ${p.need} of ${q.ncat}</span></div>
      <div class="cgrid">${cs.map((c, i) => `<div class="tile ${tcls(c.p)}${i === p.need - 1 ? ' line' : ''}" title="${esc(c.label)}: you ${fmtT(c, c.me)}, them ${fmtT(c, c.opp)}"><b>${esc(c.label.charAt(0).toUpperCase() + c.label.slice(1))}</b><span>${Math.round(c.p * 100)}%</span><i>${fmtT(c, c.me)} v ${fmtT(c, c.opp)}</i></div>`).join('')}</div>
      <div class="sub" style="margin-top:8px">Under each: Matchup Monster's projected total for you against theirs, including games already played${cs.some(c => c.label === 'turnovers') ? ' (fewer turnovers wins)' : ''}.</div>
      <div class="sub">From Basketball Monster's Matchup Monster: ${q.bbm.planned ? 'your games ticked to the lineup the Lineup page plans, theirs as set on Yahoo' : 'both lineups as set on Yahoo'}. Read ${esc(ago(q.bbm.ts))}.</div></div>`; }
    const c1 = h.length; const A = p.adds;
    const c2 = h.length;
    // LINEUP: the plan for each day, checked against what's actually set on Yahoo for that day
    h += lineupCard(p, lg);
    const c3 = h.length;
    const c4 = h.length;
    h += setPane(lg, settingsBody(lg, m, A, p));
    // show only what the Yahoo page you're on needs (or everything, if you ask)
    const part = { warn: h.slice(0, cNote), note: h.slice(cNote, c0), hero: h.slice(c0, c1), pick: h.slice(c1, c2), week: h.slice(c2, c3), watch: h.slice(c3, c4), settings: h.slice(c4) };
    // next week's cards talk about next week
    if (pNext) { const nw = x => x.replace(/(\d+) games? this week/g, (a, n) => n + (n === '1' ? ' game' : ' games') + ' next week').replace(/adds used this week/g, 'adds used next week').replace(/>This week</g, '>Next week<').replace(/>Each week after</g, '>Each week after that<');
      ['hero', 'pick', 'week'].forEach(k => part[k] = nw(part[k])); }
    const TAB = curTab(); const yo = yahooOn(); let show = TABPARTS[TAB];
    // late season: no week to plan once your matchups are over (out of the playoffs, or the season ended), no trades after the deadline
    const ss = seasonState(lg); const noWeek = ss.over || m.end < usToday(); let shut = '';
    if (noWeek && ['week', 'team', 'players'].includes(TAB)) shut = ss.over ? `The season is over: Yahoo's playoffs ended ${esc(fmtD(ss.poEnd))}. There's nothing left to set or pick up. The final standings are under Season.`
      : `You have no matchup on Yahoo this week (your last one ended ${esc(fmtD(m.end))}). If you're out of the playoffs, there's nothing left to set or pick up. Standings are under Season.`;
    else if (ss.tradesShut && TAB === 'trades') shut = `Trades closed on ${esc(ss.tradeEnd)} (Yahoo's trade deadline). Trade Monster's swaps come back next season.`;
    if (shut) show = [];
    const yL = yrFor(lg); const yLn = yL ? Object.assign({}, yL, { next: ynextOf(yL) }) : null; const onLg = yo && yo.league === lg;
    const lazy = { ilback: () => ilBackCard(p, lg), brief: () => briefHtml(pThis, lg, M), live: () => M && yL && !pNext ? window.CTX.liveCard(M, ST, yL.lid, yL, bbmView(m, pThis)) : '', next: () => { if (!M || !yLn || pNext) return ''; return window.CTX.nextCard(M, yLn, bbmView(nextOf(m), pThis)); }, league: () => leagueCard(lg, M, true), standings: () => standingsCard(lg, true), drop: () => dropCard(p, lg, M), board: () => boardCard(p, lg, M),
      strategy: () => { if (!M) return `<div class="card">This page needs the first full sync from Basketball Monster.</div>`; const c = strategyCard(lg, M, { page: TAB, tid: onLg && yo.kind === 'trade' && ST.ypage && ST.ypage.mid2 ? ST.ypage.mid2 : null });
        // Season: the build folds away (closed until you open it; the page remembers)
        if (TAB !== 'season' || !c) return c; const pu = puntFor(lg) || [];
        return `<details class="bfold" data-k="buildfold"><summary class="card"><b>Your build</b><span class="sub">${pu.length ? 'Punting ' + esc(andL(pu.map(NN))) : 'No punt'}</span></summary>${c}</details>`; },
      // what the co-pilot reads from the Yahoo screen you're on, shown on the page it belongs to
      ctx: () => onLg && yo.tab === TAB && ['players', 'add', 'trade'].includes(yo.kind) ? `<div id="ctxBox">${ctxBlock()}</div>` : '' };
    const liveH = show.includes('live') ? lazy.live() : ''; lazy.live = () => liveH; // the live card replaces the pre-week forecast once games have been played
    const wbar = nxOK && !shut && ['week', 'team', 'players'].includes(TAB) ? weekBar(wsel, m, nextModel(m)) : '';
    const synNote = ''; planFrom[lg] = m.from;
    const body = show.filter(k => !(k === 'hero' && liveH)).map(k => lazy[k] ? (() => { try { return lazy[k](); } catch (e) { console.error(k, e); return ''; } })() : part[k]).join('');
    // alerts on the bottom bar: something on another page needs you
    navAlert = {}; try { if (ilBackCard(p, lg) || ilBlocked(yL)) navAlert.team = 'Roster needs a fix'; } catch (e) {}
    h = yahooLine(yo, TAB, lg) + wbar + healthHtml(lg) + synNote + part.note + (TAB !== 'season' ? ageLine(lg) : '') + (shut ? `<div class="card">${shut}</div>` : body || `<div class="strnone">Nothing to show here yet.</div>`) + part.settings;
    setNav(lg);
    paint(o, h); wireHealth(); if (M) { wireTrades(lg, M); wireStrategy(lg, M); }
    o.querySelectorAll('[data-wk]').forEach(b => b.onclick = () => { wkPick = { sel: b.dataset.wk, lg, ts: Date.now() }; selDay = null; render(); });
    o.querySelectorAll('[data-skip]').forEach(b => b.onclick = () => { s.exclude = (s.exclude || []).concat([b.dataset.skip]); saveS(lg); soon(); });
    o.querySelectorAll('[data-keep]').forEach(b => b.onclick = () => { s.protect = (s.protect || []).concat([b.dataset.keep]); saveS(lg); soon(); });
    const rx = $('resetX'); if (rx) rx.onclick = () => { s.exclude = []; s.protect = []; s.forceDrop = {}; s.pickAdds = {}; saveS(lg); soon(); };
    // the free-agent list: plan another player than the top one (with his drop), or go back to the top one
    o.querySelectorAll('[data-fapos]').forEach(b => b.onclick = () => { s.faPos = b.dataset.fapos; saveS(lg); render(); });
    o.querySelectorAll('[data-stntab]').forEach(b => b.onclick = () => { s.stnTab = b.dataset.stntab; saveS(lg); render(); });
    o.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => { s.pickAdds = { 0: b.dataset.plan }; s.forceDrop = b.dataset.pdrop ? { [K(b.dataset.plan)]: K(b.dataset.pdrop) } : {}; saveS(lg); toast('Planning ' + b.dataset.plan, 'ok'); soon(30); });
    o.querySelectorAll('[data-unplan]').forEach(b => b.onclick = () => { s.pickAdds = {}; s.forceDrop = {}; saveS(lg); toast('Back to the top pickup', 'ok'); soon(30); });
    wireSettings(lg);
    const hc = $('hideConn'); if (hc) hc.onclick = () => { s.hideConn = true; saveS(lg); render(); };
    wireConn();
    // everything the panel reads, for the offline render checks (tools/test/t_render.js); sign-in data never leaves: any key named
    // like a sign-in is left out (the Basketball Monster email and password live only in bbmAuth)
    const tdl = $('testDl'); if (tdl) tdl.onclick = () => { const keep = Object.keys(ST).filter(k => !/auth|pass|token|secret|cookie|cred/i.test(k));
      const rep = { at: new Date().toISOString(), version: (browser.runtime && browser.runtime.getManifest ? browser.runtime.getManifest().version : ''), store: Object.fromEntries(keep.map(k => [k, ST[k]])) };
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(rep)], { type: 'application/json' })); a.download = 'copilot-test-data.json'; document.body.appendChild(a); a.click(); a.remove(); toast('Saved to Downloads', 'ok'); };
    // the forecast check's and the advice backtest's raw material (allow-list: projections, rosters, schedules, forecasts, results,
    // the advice log and player weeks; never sign-in data)
    const fdl = $('fcDl'); if (fdl) fdl.onclick = () => { const keep = Object.keys(ST).filter(k => /^(lgweek|lgfc|h2hfc|h2hres|track|ysched|lgscan|yr|ystand|ysetp|sset|calib|bx|ytrend|ylive|advlog|pjlog|pjact):/.test(k) || /^(idmap|yidmap|activeLeague)$/.test(k));
      const rep = { at: new Date().toISOString(), version: (browser.runtime && browser.runtime.getManifest ? browser.runtime.getManifest().version : ''), store: Object.fromEntries(keep.map(k => [k, ST[k]])) };
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(rep)], { type: 'application/json' })); a.download = 'copilot-forecast-data.json'; document.body.appendChild(a); a.click(); a.remove(); toast('Saved to Downloads', 'ok'); };
    const dl = $('diagDl'); if (dl) dl.onclick = () => { const keep = Object.keys(ST).filter(k => /^(selfcheck:|bbmFail:|sync:|diag|hist:|track:|sset:|idmap|fullsync:|ysetp:|yWeek|bxTrace:|ypage|yidmap|yr:|tx:|ylive:|ystand:|nbaErr|yadds:|selftest|health$|wiped$|yFindTrace$|ymine$|leagueList$|nextDue$|syncLock$|installId$)/.test(k)); if (ST.bbmAuth) { keep.push('bbmAuthInfo'); ST.bbmAuthInfo = { user: !!ST.bbmAuth.user, lastOk: ST.bbmAuth.lastOk, lastErr: ST.bbmAuth.lastErr, fails: ST.bbmAuth.fails }; } keep.push('nbaschedInfo'); ST.nbaschedInfo = ST.nbasched ? { ts: ST.nbasched.ts, teams: Object.keys(ST.nbasched.by || {}).length } : null; const rep = { at: new Date().toISOString(), version: (browser.runtime && browser.runtime.getManifest ? browser.runtime.getManifest().version : ''), plan: p ? { W: p.W, adds: p.adds, moves: p.moves.map(x => ({ add: x.add, drop: x.drop, il: x.il, week: x.week, futWk: x.futWk, alts: (x.alts || []).map(a => a.add) })), recon: p.recon, fit: p.fit, ms: p.ms } : null, store: Object.fromEntries(keep.map(k => [k, ST[k]])) };
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(rep, null, 1)], { type: 'application/json' })); a.download = 'copilot-diagnostics.json'; document.body.appendChild(a); a.click(); a.remove(); };
    const wb = $('weekB'); if (wb) wb.onclick = () => { { const y3 = yrFor(lg); if (ilBlocked(y3)) { wbNote = 'Yahoo will refuse every change until your roster is legal: fix the injured-list player first (Back from injury, above).'; render(); return; } } const pl2 = ST['plan:' + lg]; const y2 = yrFor(lg); wb.disabled = true; wb.textContent = 'Setting…'; if (!pl2 || !y2) { wbNote = !y2 ? 'Open your team page on Yahoo once so the co-pilot knows your team, then press again.' : 'The plan is still being worked out. Press again in a moment.'; render(); return; } sendWeek(y2, pl2); };
    o.querySelectorAll('.dchip').forEach(b => b.onclick = () => { selDay = b.dataset.day; luAll = false; render(); });
    o.querySelectorAll('[data-luv]').forEach(b => b.onclick = () => { luAll = b.dataset.luv === 'all'; render(); });
    const db = $('dayB'); if (db) db.onclick = () => { const pl2 = ST['plan:' + lg]; const y2 = yrFor(lg); if (!pl2 || !y2) { wbNote = 'The plan is still being worked out. Press again in a moment.'; render(); return; } db.disabled = true; db.textContent = 'Setting…'; sendWeek(y2, pl2, selDay); };
  }
  // replace the panel without losing open sections, focus or scroll
  const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
  // ---- Settings: the league's rules as read from Yahoo, your build, how eager the advice is, display, sign-ins ----
  // Every rule the co-pilot follows reads its numbers from here, so "How it works" and the advice always match.
  const PICK = {
    fewer: { min: 0.06, swap: 0.08, b99: 3, t: 'Fewer moves', w: 'A pickup has to add at least +3 of 99 a week over the rest of the season in Basketball Monster\'s Find Free Agents.' },
    std: { min: 0.03, swap: 0.05, b99: 2, t: 'Standard', w: 'A pickup has to add at least +2 of 99 a week over the rest of the season in Basketball Monster\'s Find Free Agents.' },
    more: { min: 0.015, swap: 0.03, b99: 1, t: 'More moves', w: 'A pickup has to add at least +1 of 99 a week over the rest of the season in Basketball Monster\'s Find Free Agents.' } };
  const pickOf = lg => PICK[S(lg).pick] || PICK.std;
  const fitRule = lg => Object.assign({}, FT_RULE, S(lg).fit || {});
  const showTags = lg => S(lg).showTags !== false;
  function settingsBody(lg, m, A, p) { const s = S(lg); const y = yrFor(lg); const sp = (y && ST['ysetp:' + y.lid]) || null; const STR = window.STRAT; const NM = c => STR ? STR.name(c) : c;
    const cats = m.cats.filter(c => E.LBL[c]); const row = (k, v, note) => `<div class="kvr"><span>${k}</span><b>${v}</b>${note ? `<div class="sub">${note}</div>` : ''}</div>`;
    const miss = '<i class="muted">not found on Yahoo</i>';
    // 1. the league, from Yahoo
    // (8.2.0) every group is a card that shows only its heading until tapped
    const fold = (id, title, sub) => `<details class="card sets sfold" id="set-${id}" data-k="set-${id}"><summary class="h"><span>${title}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</summary>`;
    let h = fold('league', 'League', 'from Yahoo');
    if (!sp) h += `<div class="sub">Yahoo's league settings haven't been read yet. They load with the next sync.</div>`;
    else { const po = sp.poWeeks && sp.poWeeks.length ? `${sp.poTeams || '?'} teams, weeks ${sp.poWeeks[0]}–${sp.poWeeks[sp.poWeeks.length - 1]}${sp.poEndText ? ' (ends ' + esc(sp.poEndText) + ')' : ''}` : miss;
      h += row('Scoring', sp.scoringText ? esc(sp.scoringText) : sp.scoring === 'cats' ? 'Each category counts' : sp.scoring === 'win' ? 'Most categories wins the week' : miss)
        + row('Categories', esc(cats.map(NM).join(', ')) + ` <span class="muted">(${cats.length})</span>`)
        + row('Roster', sp.slots && sp.slots.length ? `${sp.slots.length} starting spots, ${sp.bench} bench, ${sp.ilSlots} injured list` : miss)
        + row('Weekly adds', sp.addLimit ? String(sp.addLimit) : miss)
        + row('Waivers', sp.waiverDays == null ? miss : sp.waiverDays ? `${sp.waiverDays} day${sp.waiverDays > 1 ? 's' : ''} after a drop` : 'No waivers')
        + row('Playoffs', po) + (sp.tradeEnd ? row('Trade deadline', esc(sp.tradeEnd)) : '');
      h += `<div class="sub" style="margin-top:8px">Read ${sp.ts ? ago(sp.ts) : ''}. Yahoo's settings are checked again every week. <button class="lnk" id="yReload">Reload from Yahoo now</button></div>`; }
    h += `<details class="more" data-k="lgover"${s.addLimit != null || s.scoring ? ' open' : ''}><summary>Change what Yahoo says${s.addLimit != null || s.scoring ? ' (changed)' : ''}</summary>
      <div class="row">Weekly adds <input id="adds" type="number" min="0" max="10" placeholder="${sp && sp.addLimit ? sp.addLimit : A.limit}" value="${s.addLimit != null ? s.addLimit : ''}"> <span class="sub">empty: use Yahoo's</span></div>
      ${(() => { const sc = scoringOf(lg); return `<div class="row" style="margin-top:8px">Scoring<select id="scoring"><option value="auto" ${!s.scoring ? 'selected' : ''}>Use Yahoo's${sc.src !== 'set' ? ' (' + (sc.mode === 'cats' ? 'each category counts' : 'most categories wins') + ')' : ''}</option><option value="cats" ${s.scoring === 'cats' ? 'selected' : ''}>Each category counts</option><option value="win" ${s.scoring === 'win' ? 'selected' : ''}>Most categories wins the week</option></select></div>`; })()}</details></details>`;
    // 2. your build
    const cur = puntFor(lg) || []; const MM = modelFor(lg); const bb = MM && MM.ctx.puntBbm || []; const th = Object.assign({}, STR ? STR.TH0 : {}, s.th || {}); const pc = x => Math.round(x * 100);
    const l = leaguesKnown().find(x => x.league === lg); const snap = l && ST['strat:' + l.lid];
    h += `${fold('build', 'Your build')}
      <div class="sub">Tap categories to punt. This is the only place your punt is set: Basketball Monster's own punt settings don't change anything here.</div>
      <div class="trypick">${cats.map(c => `<button class="pchip${cur.includes(c) ? ' on' : ''}" data-punt="${c}">${esc(NM(c))}</button>`).join('')}</div>
      ${bb.length && bb.slice().sort().join() !== cur.slice().sort().join() ? `<div class="sub"><button class="lnk" id="puntCopy">Copy Basketball Monster's punt (${esc(bb.map(NM).join(', '))})</button></div>` : ''}
      <div class="label lbl2" style="margin-top:12px">Bands</div>
      <div class="sub">How each category is read, from the share of teams Basketball Monster projects you to beat in it.</div>
      <div class="row bandrow"><i class="fd n"></i>Lost under <input class="thin" id="thDead" type="number" min="0" max="50" value="${pc(th.dead)}">%</div>
      <div class="row bandrow"><i class="fd a"></i>Swing up to <input class="thin" id="thSafe" type="number" min="30" max="95" value="${pc(th.safe)}">%</div>
      <div class="row bandrow"><i class="fd gr"></i>Winning up to <input class="thin" id="thLock" type="number" min="50" max="100" value="${pc(th.locked)}">%</div>
      <div class="row bandrow"><i class="fd g"></i>Locked above that</div>
      <div class="sub" style="margin-top:8px">${snap ? `Bands set ${new Date(snap.ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}. They stay put until you set them again.` : 'Bands are set at the first sync with Basketball Monster\'s Analysis Monster.'} <button class="lnk" id="bandsReset">Set again from today's numbers</button></div></details>`;
    // 3. how eager the advice is
    const pk = s.pick && PICK[s.pick] ? s.pick : 'std';
    h += `${fold('advice', 'Advice')}
      <div class="row">Pickups<span class="seg small sortbar" style="margin:0 0 0 auto">${Object.entries(PICK).map(([k, v]) => `<button data-pick="${k}" class="${pk === k ? 'on' : ''}">${v.t}</button>`).join('')}</span></div>
      <div class="sub">${PICK[pk].w} The drop is whoever leaves your team best off. This week and next are timing only: when adding now costs this week, the advice is to wait until Monday.</div>
      <div class="row" style="margin-top:8px"><label><input type="checkbox" id="spare" ${A.spare ? 'checked' : ''}> Keep one add spare for injuries until Saturday</label></div>
      <div class="row" style="margin-top:8px">Trade bar<span style="margin-left:auto"><input class="thin" id="bar99" type="number" step="1" min="1" value="${bar99(lg)}"> of 99</span></div>
      <div class="row" style="margin-top:4px">They lose at most<span style="margin-left:auto"><input class="thin" id="themMin" type="number" step="1" max="0" value="${-themMin(lg)}"> of 99</span></div>
      <div class="row" style="margin-top:4px">Yahoo ranks within<span style="margin-left:auto"><input class="thin" id="rankGap" type="number" step="1" min="1" value="${rankGap(lg)}"> places</span></div>
      <div class="row" style="margin-top:4px">Multi-player deals: they get back at least<span style="margin-left:auto"><input class="thin" id="fairMin" type="number" step="5" min="50" max="100" value="${Math.round(fairMin(lg) * 100)}"> %</span></div>
      <div class="sub">Trades start from Basketball Monster's Trade Monster. Its Win% change × 99 is category matchups won out of 99. A swap is shown when it adds at least the bar for you; it's realistic when the other team loses no more than the second number and Yahoo ranks the two players within the third.</div>
      <div class="sub" style="margin-top:8px"><button class="lnk" id="setReset">Reset advice and bands to the defaults</button></div></details>`;
    // 4. display
    h += `${fold('display', 'Display')}
      <div class="row"><label><input type="checkbox" id="showTags" ${showTags(lg) ? 'checked' : ''}> Show Basketball Monster's analyst tags (grey labels; they never change advice)</label></div></details>`;
    // 5. sign-ins and diagnostics
    h += `${fold('conn', 'Sign-ins, track record and diagnostics')}
      <div class="row"><label><input type="checkbox" id="swap" ${s.swap ? 'checked' : ''}> I'm Team 2 on Matchup Monster</label></div>${bbmAuthHtml()}${yapiHtml()}${trackHtml(lg)}${diagHtml(lg, p)}</details>`;
    return h; }
  function wireSettings(lg) { const s = S(lg); const set = (f) => { f(); saveS(lg); render(); };
    const ad = $('adds'); if (ad) ad.onchange = e => set(() => { const v = String(e.target.value).trim(); s.addLimit = v === '' ? null : Math.max(0, +v || 0); });
    const sc = $('scoring'); if (sc) sc.onchange = e => set(() => { s.scoring = e.target.value === 'auto' ? null : e.target.value; });
    const sp = $('spare'); if (sp) sp.onchange = e => set(() => { s.spare = e.target.checked; });
    const sw = $('swap'); if (sw) sw.onchange = e => set(() => { s.swap = e.target.checked; });
    const tg = $('showTags'); if (tg) tg.onchange = e => set(() => { s.showTags = e.target.checked; });
    document.querySelectorAll('#setPane [data-punt]').forEach(b => b.onclick = () => { const cur = (puntFor(lg) || []).slice(); const c = b.dataset.punt; const on = cur.includes(c); set(() => { s.punt = on ? cur.filter(x => x !== c) : cur.concat([c]); }); resetBands(lg); render(); toast(`${window.STRAT ? window.STRAT.Name(c) : c} ${on ? 'back in play' : 'punted'}`, 'ok'); });
    const pc = $('puntCopy'); if (pc) pc.onclick = () => set(() => { const MM = modelFor(lg); s.punt = ((MM && MM.ctx.puntBbm) || []).slice(); });
    document.querySelectorAll('#setPane [data-pick]').forEach(b => b.onclick = () => { set(() => { s.pick = b.dataset.pick === 'std' ? null : b.dataset.pick; }); toast('Pickups: ' + PICK[b.dataset.pick].t, 'ok'); });
    [['thDead', 'dead'], ['thSafe', 'safe'], ['thLock', 'locked']].forEach(([id, k]) => { const e = $(id); if (e) e.onchange = () => set(() => { s.th = Object.assign({}, s.th || {}, { [k]: Math.max(0, Math.min(100, +e.value || 0)) / 100 }); }); });
    const b9 = $('bar99'); if (b9) b9.onchange = e => set(() => { const v = Math.round(+e.target.value); s.bar99 = v >= 1 ? v : null; });
    const tmn = $('themMin'); if (tmn) tmn.onchange = e => set(() => { const v = Math.round(Math.abs(+e.target.value)); s.themMin = isNaN(v) ? null : -v; });
    const rg = $('rankGap'); if (rg) rg.onchange = e => set(() => { const v = Math.round(+e.target.value); s.rankGap = v >= 1 ? v : null; });
    const fm = $('fairMin'); if (fm) fm.onchange = e => set(() => { const v = Math.round(+e.target.value); s.fairMin = v >= 50 && v <= 100 ? v / 100 : null; });
    const rs = $('setReset'); if (rs) rs.onclick = () => { set(() => { delete s.pick; delete s.fit; delete s.th; delete s.tradeBar; delete s.bar99; delete s.themMin; delete s.rankGap; delete s.fairMin; }); toast('Advice and bands back to the defaults', 'ok'); };
    const br = $('bandsReset'); if (br) br.onclick = () => { const M = modelFor(lg); const l = leaguesKnown().find(x => x.league === lg); const win = l && window.STRAT && M ? window.STRAT.catWin(ST['bbmstand:' + l.lid], M.ctx.cats) : null; if (!win) { br.textContent = 'Waiting for Basketball Monster…'; return; } const sk = 'strat:' + l.lid; ST[sk] = window.STRAT.snapshot(M, win, M.ctx.punt || []); browser.storage.local.set({ [sk]: ST[sk] }); DV++; render(); };
    const yr = $('yReload'); if (yr) yr.onclick = async () => { const y = yrFor(lg); if (!y) return; const k = 'ysetp:' + y.lid; const cur = Object.assign({}, ST[k] || {}, { ts: 0 }); ST[k] = cur; await browser.storage.local.set({ [k]: cur }); yr.textContent = 'Reloading…'; yr.disabled = true; runSync(true); }; }
  // ---- the settings pane: everything you can change, in one place, opened from the gear at the top right ----
  let setOpen = false;
  const setPane = (lg, body) => `<section class="setpane" id="setPane" ${setOpen ? '' : 'hidden'} aria-label="Settings"><div class="seth"><div><div class="t">Settings</div>${lg ? `<div class="sub">${esc(lg)}</div>` : ''}</div><button class="lnk" id="setClose">Done</button></div>${body}</section>`;
  function showSettings(on, k) { setOpen = !!on; const sp = $('setPane'); if (sp) sp.hidden = !setOpen; document.body.classList.toggle('setopen', setOpen);
    const b = $('setBtn'); if (b) { b.classList.toggle('on', setOpen); b.setAttribute('aria-expanded', String(setOpen)); }
    if (setOpen && k) { const d = document.querySelector('#setPane details[data-k=' + k + ']') || $('set-' + k); if (d) { for (let e = d; e; e = e.parentElement && e.parentElement.closest('details')) e.open = true; setTimeout(() => d.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); } } }
  // the big numbers count up when a page opens (not on every refresh), so a fresh page reads as live
  function countUp(o) { if (REDUCED) return; o.querySelectorAll('.hero-pct, .cgrid .tile span').forEach(e => { const t = e.firstChild; if (!t || t.nodeType !== 3) return; const m = t.textContent.match(/^(\d+(?:\.\d+)?)(%?)$/); if (!m) return;
    const end = +m[1], dp = (m[1].split('.')[1] || '').length, t0 = performance.now(), D = 420; const step = now => { const k = Math.min(1, (now - t0) / D), e2 = 1 - Math.pow(1 - k, 3); t.textContent = (end * e2).toFixed(dp) + m[2]; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }); }
  // the week's big number and the trade numbers roll digit by digit when a sync changes them (NumberFlow, vendor/number-flow),
  // then go back to the plain text the page drew; false when the change isn't a plain number, and the caller pulses it instead
  function roll(e, was) {
    const t = e.firstChild, num = s => s && s.match(/^([+−]?)(\d+(?:\.\d+)?)(%?)/), a = num(was), b = t && t.nodeType === 3 && num(t.textContent);
    if (!a || !b || a[3] !== b[3] || !window.customElements || !customElements.get('number-flow')) return false;
    const val = m => (m[1] === '−' ? -1 : 1) * m[2] * (m[3] ? 0.01 : 1), dp = (b[2].split('.')[1] || '').length;
    const nf = document.createElement('number-flow');
    nf.format = { style: b[3] ? 'percent' : 'decimal', minimumFractionDigits: dp, maximumFractionDigits: dp, signDisplay: b[1] ? 'exceptZero' : 'auto' };
    t.replaceWith(nf); nf.update(val(a)); requestAnimationFrame(() => nf.update(val(b)));
    const back = () => { if (nf.isConnected) nf.replaceWith(t); }; nf.addEventListener('animationsfinish', back, { once: true }); setTimeout(back, 1500);
    return true;
  }
  // a small confirmation above the bottom bar after anything you change
  function toast(msg, kind, act) { let t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.className = 'toast ' + (kind || ''); t.innerHTML = `<i></i>${esc(msg)}${act ? ` <button class="lnk tact">${esc(act.label)}</button>` : ''}`; void t.offsetWidth; t.classList.add('show');
    if (act) t.querySelector('.tact').onclick = () => { t.classList.remove('show'); act.fn(); };
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), act ? 6000 : 1900); }
  function paint(o, h) {
    const open = {}; o.querySelectorAll('details[data-k]').forEach(d => open[d.dataset.k] = d.open);
    const ae = document.activeElement; const fid = ae && ae.id && o.contains(ae) ? ae.id : null; const sel = fid && ae.selectionStart != null ? [ae.selectionStart, ae.selectionEnd] : null; const y = window.scrollY;
    // motion: cards ease in only when you arrive on a different page or league; numbers that changed give a small pulse
    const vk = league() + '|' + curTab() + '|' + (window.STAB || ''); const fresh = vk !== paint.vk; const daySwap = !fresh && paint.day !== selDay;
    const ti = TABS.findIndex(t => t[0] === curTab()), dir = paint.ti == null || ti === paint.ti ? 'u' : ti > paint.ti ? 'r' : 'l'; paint.vk = vk; paint.day = selDay; paint.ti = ti;
    const NUM = '.hero-pct, .score b, .stat b, .tile span, .dchip b, table.pl td.v, .tcs-n b';
    const before = fresh ? null : [...o.querySelectorAll(NUM)].map(e => e.textContent);
    const sp0 = $('setPane'); const spY = sp0 ? sp0.scrollTop : 0;
    o.innerHTML = h;
    const sp1 = $('setPane'); if (sp1) sp1.scrollTop = spY; document.body.classList.toggle('setopen', setOpen && !!sp1);
    if (!REDUCED) {
      if (fresh) { o.classList.remove('enter', 'from-r', 'from-l', 'from-u'); void o.offsetWidth; o.classList.add('enter', 'from-' + dir); clearTimeout(paint.t); paint.t = setTimeout(() => o.classList.remove('enter', 'from-r', 'from-l', 'from-u'), 900); countUp(o); }
      else if (before) { const now = [...o.querySelectorAll(NUM)]; if (now.length === before.length) now.forEach((e, i) => { if (e.textContent !== before[i] && !(e.matches('.hero-pct, .tcs-n b') && roll(e, before[i]))) { e.classList.add('bump'); setTimeout(() => e.classList.remove('bump'), 600); } }); }
      if (daySwap) { const lu = o.querySelector('.lu'); if (lu) { lu.classList.add('dayswap'); setTimeout(() => lu.classList.remove('dayswap'), 400); } }
    }
    o.querySelectorAll('details[data-k]').forEach(d => { if (open[d.dataset.k] != null) d.open = open[d.dataset.k]; });
    if (fid) { const el = $(fid); if (el) { el.focus({ preventScroll: true }); try { if (sel) el.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
    window.scrollTo(0, y);
  }
  let soonT = null; function soon(ms) { clearTimeout(soonT); soonT = setTimeout(render, ms == null ? 30 : ms); }
  function wireConn() { wireBbm(); }


  // ---- lineup management: plan vs what Yahoo actually has set, day by day ----
  let selDay = null, luAll = false, wbNote = ''; const luBusy = {}, luFail = {};
  const LU = lid => ST['ylu:' + lid] || {};
  // a day's Yahoo lineup; when it was read before your latest roster read, injury tags and injured-list spots come from the latest
  // read (they're roster-wide and change daily) and anyone no longer on your roster is left out
  function actualFor(lid, date) { const e = LU(lid)[date]; if (!e || !e.rows) return null; const y = ST['yr:' + lid]; if (!y || !y.rows || (y.ts || 0) <= (e.ts || 0)) return e;
    const rows = e.rows.map(r => { const c = rowIn(y.rows, r.name); if (!c) return null; const il = /^IL/.test(c.slot || '');
      return Object.assign({}, r, { inj: c.inj || '', slot: il ? c.slot : /^IL/.test(r.slot || '') ? 'BN' : r.slot }); }).filter(Boolean);
    return Object.assign({}, e, { rows }); }
  // fetch each open day's real Yahoo lineup (API when connected, else your Yahoo team page for that date)
  // what's kept of a Yahoo team page for one date: who's where, and whether Yahoo shows him playing that day
  const luRow = x => ({ name: x.name, slot: x.slot, pid: x.pid, locked: !!x.locked, hasGame: !!x.hasGame, game: x.game || '', inj: x.inj || '', elig: x.elig || [], team: x.team || '' });
  async function refreshLineups(lg, dates, force) {
    const y = yrFor(lg); if (!y) return; const lid = y.lid; const cur = Object.assign({}, LU(lid)); const got = [];
    // a day read before your latest roster read, with different players on it (a pickup or drop since): read it again now
    const sig = rows => (rows || []).map(r => K(r.name)).sort().join('|'); const ySig = sig(y.rows);
    for (const d of dates) { const e = cur[d]; const near = d === usToday() || d === selDay; const moved = e && y.ts > e.ts && sig(e.rows) !== ySig;
      if (!force && e && !moved && Date.now() - e.ts < (near ? 5 : 30) * 60e3) continue; if (luBusy[lid + d] || (!force && luFail[lid + d] > Date.now())) continue; luBusy[lid + d] = true;
      try { let rows = null, emp = [];
        { const r = await fetch(`https://basketball.fantasysports.yahoo.com/nba/${lid}/${y.tid}/team?date=${d}`, { credentials: 'include', cache: 'no-store' }); const doc = new DOMParser().parseFromString(await r.text(), 'text/html'); const yr = window.YPARSE && window.YPARSE(doc); if (yr && yr.date === d) { rows = yr.rows.map(luRow); emp = yr.empty || []; } }
        if (rows && rows.length) { cur[d] = { ts: Date.now(), rows, empty: emp }; got.push(d); } }
      catch (e) { luFail[lid + d] = Date.now() + 5 * 60e3; console.warn('lineup check', d, e.message); } // a failed read waits 5 minutes
      luBusy[lid + d] = false; }
    // only the days read here go into the latest saved copy: Set lineups may have saved other days during these reads
    if (got.length) { const latest = Object.assign({}, LU(lid)); got.forEach(d => { latest[d] = cur[d]; });
      ST['ylu:' + lid] = latest; await browser.storage.local.set({ ['ylu:' + lid]: latest }); }
  }
  // your roster as Yahoo has it right now, read from your team page (after a pickup or drop on Yahoo the panel doesn't wait for the
  // next sync or for you to open your team page): written the same way the team page itself writes it, so everything follows
  const rosterBusy = {};
  async function rosterNow(lg, why) { const y = yrFor(lg); if (!y || !y.tid || rosterBusy[y.lid] > Date.now()) return; rosterBusy[y.lid] = Date.now() + 20e3;
    try { const r = await fetch(`https://basketball.fantasysports.yahoo.com/nba/${y.lid}/${y.tid}/team`, { credentials: 'include', cache: 'no-store' }); const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      const yr = window.YPARSE && window.YPARSE(doc); if (!yr || yr.lid !== String(y.lid) || !yr.rows || yr.rows.length < 5) { rosterBusy[y.lid] = Date.now() + 5 * 60e3; return; } yr.src = 'page'; yr.why = why || '';
      ST['yr:' + yr.lid] = yr; await browser.storage.local.set({ ['yr:' + yr.lid]: yr, yrLast: yr.lid }); }
    catch (e) { rosterBusy[y.lid] = Date.now() + 5 * 60e3; console.warn('roster read', e.message); } }
  // compare one day: who must move in, who must sit
  function dayCheck(d, act, onRosterKeys) {
    const isStart = r => r.slot !== 'BN' && !/^IL/.test(r.slot);
    const act0 = act ? act.rows : null; const find = n => act0 && NAMES.pick(act0, n);
    // a locked player (his game has started) can't be moved any more, so he's never counted as a change
    const start = d.start.map(x => { const r = find(x.name); return Object.assign({}, x, { onY: !!r, now: r ? r.slot : null, locked: !!(r && r.locked), moveIn: !!(r && !isStart(r) && !r.locked) }); });
    const play = d.bench.filter(x => !x.zero);
    const sit = play.map(x => { const r = find(x.name); return Object.assign({}, x, { onY: !!r, now: r ? r.slot : null, locked: !!(r && r.locked), moveOut: !!(r && isStart(r) && !r.locked) }); });
    // someone out still sitting in a starting spot on Yahoo costs nothing by himself (he won't play): "Set lineups" benches him
    // anyway, but he only makes the day need changes when a planned starter needs his spot (that starter shows as "move in")
    const out = d.bench.filter(x => x.zero);
    const noGame = act0 ? act0.filter(r => !d.start.concat(d.bench).some(x => NAMES.same(x.name, r.name)) && !/^IL/.test(r.slot)).map(r => r.name) : [];
    const changes = start.filter(x => x.moveIn).length + sit.filter(x => x.moveOut).length;
    return { start, sit, out, noGame, changes, known: !!act0 };
  }
  // the league so far: every team's category results from Yahoo's finished weeks, and your remaining schedule (results only:
  // nothing here feeds the recommendations except the schedule, which sets who "each week after" is measured against)
  function leagueCard(lg, M, open) {
    const y = yrFor(lg); const C = window.CTX; if (!y || !C || !C.profiles) return '';
    const cats = (M && M.ctx.cats) || ((mm() || {}).cats) || []; if (!cats.length) return '';
    const PR = C.profiles(ST, y.lid, cats), sch = C.schedOf(ST, y.lid, y, true); if (!PR && !sch.length) return '';
    const stand = (ST['ystand:' + y.lid] || {}).teams || []; const rec = tid => stand.find(t => String(t.tid) === String(tid));
    const nameOf = tid => { const r = rec(tid); return (r && r.name) || (PR && PR.teams[tid] && PR.teams[tid].name) || (M ? M.teamName(tid) : 'Team ' + tid); };
    const me = String(y.tid), cw = C.curWeek(ST, y.lid, y); const nx = (sch.find(r => r.week === cw + 1) || {}).opp || null;
    const nth = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
    const fs = (c, v) => /%$/.test(c) ? v.toFixed(3).replace(/^0/, '') : String(Math.round(v * 10) / 10);
    let h = `<div class="card lg"><div class="h"><span>League so far</span><span class="sub">${PR ? 'Yahoo results, week' + (PR.weeks.length > 1 ? 's ' + PR.weeks[0] + ' to ' + PR.weeks[PR.weeks.length - 1] : ' ' + PR.weeks[0]) : 'Yahoo schedule'}</span></div>`; h += `<details class="more" data-k="lgsofar"${open ? ' open' : ''}><summary>Category results and your schedule</summary>`;
    if (PR) { const sc = t => t.w + t.t / 2;
      const order = Object.keys(PR.teams).sort((a, b) => { const ra = rec(a), rb = rec(b); return ra && rb ? ra.rank - rb.rank : sc(PR.teams[b]) - sc(PR.teams[a]); });
      h += `<div class="sub">Weeks each team has won each category. Green: won it most weeks. Red: lost it most weeks.${nx && PR.teams[nx] ? ' Your next opponent is in blue.' : ''}</div><div class="lgw"><table class="lgt"><tr><th></th>${cats.map(c => `<th>${esc(E.LBL[c] || c)}</th>`).join('')}<th>Record</th></tr>`;
      order.forEach(tid => { const t = PR.teams[tid];
        h += `<tr class="${tid === me ? 'me' : tid === nx ? 'nx' : ''}"><td class="nm" title="${esc(nameOf(tid))}${tid === nx ? ' (your next opponent)' : ''}">${tid === me ? 'You' : esc(nameOf(tid))}</td>` + cats.map(c => { const k = t.cat[c]; if (!k || !k.n) return '<td class="muted">·</td>';
          const r = (k.w + k.t / 2) / k.n; return `<td class="${r > 0.6 ? 'cs-a' : r >= 0.4 ? 'cs-c' : 'cs-b'}" title="${esc(E.LBL[c] || c)}: won ${k.w}, lost ${k.l}${k.t ? ', tied ' + k.t : ''} · weekly average ${fs(c, k.sum / k.n)}">${k.t ? (k.w || '') + '½' : k.w}</td>`; }).join('') + `<td class="rec">${t.w}-${t.l}-${t.t}</td></tr>`; });
      h += `</table></div>`; }
    if (sch.length) { const row = r => { const t = rec(r.opp); return `<div class="pr"><div><span class="muted">Week ${r.week}${r.week === cw ? ' (now)' : ''}</span> · <b style="font-weight:600">${esc(nameOf(r.opp))}</b></div><span>${t ? nth(t.rank) + ', ' + t.w + '-' + t.l + '-' + t.t : ''}</span></div>`; };
      h += `<div class="label" style="margin-top:12px">Your schedule</div>` + sch.slice(0, 4).map(row).join('') + (sch.length > 4 ? `<details style="margin-top:4px"><summary>All ${sch.length} regular-season weeks</summary>${sch.slice(4).map(row).join('')}</details>` : ''); }
    return h + '</details></div>';
  }
  // Basketball Monster's team for each Yahoo team: same name, else the closest name among those left (a team renamed on Yahoo
  // keeps its old name on BBM until BBM refreshes its rosters)
  function amMatch(lid, myTid) { const bs = ST['bbmstand:' + lid], ys = (ST['ystand:' + lid] || {}).teams || []; const out = {}; if (!bs) return out;
    const nk = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const toks = s => new Set(String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3));
    let left = bs.teams.slice(); const meA = left.find(t => t.me); if (meA && myTid) { out[String(myTid)] = meA; left = left.filter(t => t !== meA); }
    const rest = ys.filter(t => !out[String(t.tid)]);
    rest.forEach(t => { const a = left.find(x => nk(x.name) === nk(t.name)); if (a) { out[String(t.tid)] = a; left = left.filter(x => x !== a); } });
    rest.filter(t => !out[String(t.tid)]).forEach(t => { const tt = toks(t.name); let best = null, sc = 0; left.forEach(x => { const n = [...toks(x.name)].filter(w => tt.has(w)).length; if (n > sc) { sc = n; best = x; } });
      if (!best && left.length === 1 && rest.filter(r => !out[String(r.tid)]).length === 1) best = left[0]; if (best) { out[String(t.tid)] = best; left = left.filter(x => x !== best); } });
    return out; }
  // ---- streaming: this week only, the categories still in play, and only when a stream is clearly worth an add ----
  // ---- Players: one list. The top 30 of every Basketball Monster free agent, ranked by the one measure (what he adds to your
  // expected categories over the rest of the season, replacing his best drop). The tags are the only advice: Best pickup,
  // Wait until Monday, Stream this week only. Tap a player to test him: his drop, this week, next week, the season, per game. ----
  const cn = (v, d) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d == null ? 1 : d);
  // Yahoo's waiver date ("Nov 18", no year) as a date: this year, or next year when that's more than two months back (December → January)
  const wvDate = s => { const m = String(s || '').match(/^([A-Z][a-z]{2}) (\d{1,2})$/); if (/^\d{4}-\d{2}-\d{2}/.test(String(s || ''))) return String(s).slice(0, 10); if (!m) return null;
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m[1]); if (mo < 0) return null; const t = usToday(); let yr = +t.slice(0, 4);
    const iso = y => `${y}-${String(mo + 1).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`; if (iso(yr) < addDay(t, -60)) yr++; return iso(yr); };
  // Basketball Monster's category values for a swap: his per-game values less the drop's (what he adds, what you give up)
  const cvSwap = (M, add, drop) => { const a = ((M.P[add] || {}).ros || {}).cv || {}, b = ((M.P[drop] || {}).ros || {}).cv || {}; const cs = M.ctx.cats.filter(c => !(M.ctx.punt || []).includes(c)).map(c => ({ c, d: (a[c] || 0) - (drop ? b[c] || 0 : 0) }));
    return { up: cs.filter(x => x.d >= 0.3).sort((x, y) => y.d - x.d).map(x => window.STRAT.name(x.c)), dn: cs.filter(x => x.d <= -0.3).sort((x, y) => x.d - y.d).map(x => window.STRAT.name(x.c)) }; };
  // this week's holes and the free agents Matchup Monster suggests that fill them (timing only: the list below is the rest of season)
  function holesHtml(lg, M, B) { const H = weekHoles(lg, M); if (!H) return ''; const pc = v => Math.round(v * 100) + '%'; const NM = c => window.STRAT.name(c);
    let h = `<div class="label lbl2">This week: categories in play</div>`;
    if (!H.play.length) return h + `<div class="sub">Matchup Monster has every category this week below 20% or above 80%: no pickup changes this week much.</div>`;
    h += `<div class="mts">${H.play.map(c => `<span class="mt plain${H.W[c] < 0.5 ? ' minus' : ''}" title="Basketball Monster's chance you win it this week"><b>${esc(NM(c))}</b> ${pc(H.W[c])}</span>`).join('')}</div>`;
    const top = H.fas.slice(0, 5);
    h += top.length ? `<div class="sub" style="margin-top:4px">From Matchup Monster's ${H.n} free agents to consider, the ones strong in those categories, most games left this week first:</div>` + top.map(x => { const r = B.list.findIndex(z => z.id === x.id);
      return `<div class="mvl"><span>${esc(x.n)}${x.inj ? ` <span class="minus">${esc(injChip(x.inj))}</span>` : ''}</span>${x.g} game${x.g === 1 ? '' : 's'} left · strong in <b>${esc(listW(x.fills.map(NM)))}</b>${r >= 0 ? ` · <i>number ${r + 1} below</i>` : B.list.length ? ` · <i>a stream: not in the top ${B.list.length} for the rest of the season</i>` : ""}</div>`; }).join('')
      : `<div class="sub" style="margin-top:4px">None of Matchup Monster's ${H.n} free agents to consider is strong in those categories with games left.</div>`;
    return h + `<div class="sub">From Basketball Monster's Matchup Monster against ${esc(H.m.opp || 'your opponent')} (${esc(fmtD(H.m.start))} to ${esc(fmtD(H.m.end))}).</div>`; }
  // ---- Who to drop (owner's ask, 25 Nov), above the free agents. Over Yahoo's limit it starts with the Lineup page's card (the
  // same function, so the two never disagree); then every player of yours, least missed first (dropOrder): the top five, the
  // rest folded. A protected player or a recent add is listed with the reason, never chosen for you. ----
  function dropCard(p, lg, M) { if (!M || p.week === 'next') return ''; const y = yrFor(lg); const D = dropOrder(lg, M); if (!D.length) return '';
    const fix = ilBackCard(p, lg); const rc = rosterCheck(y); const over = !!rc && rc.drops > 0; const bd = p.bd; const pair = bd && !bd.over && bd.worth && bd.dropName;
    const HL = { 'your keep': 'Your keep', 'a recent add': 'Recent add' }; const T = M.fa && M.fa.ts;
    const row = (d, i) => { const r = y && y.rows ? y.rows.find(z => NAMES.same(z.name, d.name)) : null; const inj = r && r.inj; const nb = d.best && M.P[d.best.id] ? M.P[d.best.id].n : null;
      const tags = []; if (pair && NAMES.same(bd.dropName, d.name)) tags.push(['g', 'Pickups pairs him with ' + bd.add]); if (d.held) tags.push(['n', HL[d.held] || 'Top half of the league']); if (d.il) tags.push(['n', 'Injured list']);
      const v = d.typ != null ? Math.round(d.typ) : null;
      return `<details class="pr dr drw" data-k="dr${esc(d.id)}"><summary><div class="l1"><span class="frk">${i + 1}</span><b>${esc(d.name)}</b>${inj ? `<span class="chip lost">${esc(injChip(inj))}</span>` : ''}<span class="fv${v != null && v >= 0 ? ' plus' : ''}">${v != null ? of99(v) : '–'}</span></div>
        <div class="l2">${tags.length ? `<div class="ftags">${tags.map(t => `<span class="fk ${t[0]}">${esc(t[1])}</span>`).join('')}</div>` : ''}<div class="ln">${v != null ? `A typical free agent in his place: ${of99(v)} of 99` : "No Find Free Agents number yet: placed by Basketball Monster's value"}${nb ? ` · his best free agent, ${esc(nb)}: ${of99(d.best.you)}` : ''}</div></div></summary>
        <div class="ld">${d.held ? `<div class="sub">Not chosen for you: ${esc(d.held)}.</div>` : ''}${d.il ? `<div class="sub">On the injured list: dropping him only frees a spot when an injured player of yours can move into his.</div>` : ''}<div class="sub">${M.P[d.id] && M.P[d.id].ros && M.P[d.id].ros.g != null ? M.P[d.id].ros.g + ' games left projected.' : ''}${M.P[d.id] && M.P[d.id].rank ? ' Basketball Monster rank ' + M.P[d.id].rank + '.' : ''}</div></div></details>`; };
    let h = fix + `<div class="card fal dropc"><div class="h"><span>Who to drop</span>${over ? '<span class="sub">drop only, no add</span>' : ''}</div>`;
    h += `<div class="sub" style="margin-bottom:4px">${D.common ? `Least missed first. Each player is measured against the same ${D.common} free agents in Basketball Monster's Find Free Agents, so the number is what losing him does to your team, of 99 matchups a week (above 0: you'd be better off).${T ? ' Read ' + esc(ago(T)) + '.' : ''}` : "Basketball Monster's Find Free Agents has no free agent in common across your players yet, so this is in order of Basketball Monster's rest-of-season value."}</div>`;
    h += D.slice(0, 5).map(row).join('');
    if (D.length > 5) h += `<details class="more"><summary class="lnk">Everyone else (${D.length - 5})</summary>${D.slice(5).map((d, i) => row(d, i + 5)).join('')}</details>`;
    return h + '</div>'; }
  function boardCard(p, lg, M) {
    const B = boardFor(lg); if (!B || !M) return `<div class="card"><div class="h"><span>Free agents</span></div><div class="strnone">Your free-agent list appears once Basketball Monster's rest-of-season projections are in.</div></div>`;
    const bd = p.bd; const A = p.adds || {}; const y = yrFor(lg); const nx = p.week === 'next'; const nm = id => id ? M.P[id].n : '';
    const SL = new Map(((p.streams && p.streams.list) || []).map(x => [K(x.add), x])); const mv = (p.moves || []).find(x => bd && K(x.add) === K(bd.add));
    const o99 = (v, al) => v == null ? '–' : (al ? '≥ ' : '') + of99(v);
    let h = `<div class="card prim fal"><div class="h"><span>Free agents</span><span class="sub">${nx ? 'next week' : `${Math.max(0, A.left || 0)} of ${A.limit || 0} adds left this week${A.spare ? ' (1 kept spare)' : ''}`}</span></div>`;
    if (!B.bbm) return h + `<div class="strnone">Basketball Monster's Find Free Agents is being read for this league. The background sync reads it every 2 to 3 hours and after every add or drop in the league.</div>${nx ? "" : holesHtml(lg, M, B)}</div>`;
    if (!B.list.length) return h + `<div class="strnone">Find Free Agents lists no available free agent for any player you'd drop (your keeps, injured-list spots and recent adds are never drops).</div>${nx ? "" : holesHtml(lg, M, B)}</div>`;
    if (bd && bd.over) h += `<div class="hl">Fix your roster first</div><div class="sub hls">Yahoo won't take any pickup until ${bd.over > 1 ? bd.over + ' players are' : 'one player is'} dropped: see Who to drop above.</div>`;
    else if (bd && bd.worth && !bd.wait) h += `<div class="hl">Add <b class="plus">${esc(bd.add)}</b>${bd.dropName ? `, drop <b>${esc(bd.dropName)}</b>${bd.ilDrop && bd.ilMove ? ` (injured list), then move <b>${esc(bd.ilMove)}</b> into his spot` : ''}` : bd.ilMove ? ` after moving <b>${esc(bd.ilMove)}</b> to the injured list (no drop needed)` : ' into your empty roster spot'}${mv ? ` on ${esc(fmtD(mv.date))}` : ''}</div><div class="sub hls"><b class="plus">${o99(bd.you, bd.atLeast)}</b> of 99 a week over the rest of the season${bd.chosen ? ' · your pick' : ''}</div>`;
    else if (bd && bd.worth) h += `<div class="hl"><b>${esc(bd.add)}</b> is the best pickup: wait until Monday</div><div class="sub hls">${bd.why === 'adds' ? 'No adds left this week.' : `${esc(sur(bd.dropName))} has ${bd.gd} game${bd.gd === 1 ? '' : 's'} left this week and ${esc(sur(bd.add))} ${bd.ga}, so adding now costs games; from Monday it's ${o99(bd.you, bd.atLeast)} of 99 a week.`}</div>`;
    else h += `<div class="hl">No free agent clears your bar</div><div class="sub hls">The best, ${esc(nm(B.list[0].id))}, adds ${o99(B.list[0].you, B.list[0].atLeast)} of 99 a week${B.list[0].drop ? ' for ' + esc(sur(nm(B.list[0].drop))) : ''}; your bar is ${of99(pick99(lg))} (Settings → Advice).</div>`;
    const H = nx ? null : weekHoles(lg, M); const NMc = c => window.STRAT.name(c); const bar = pick99(lg);
    const fillsOf = id => { if (!H || !H.play.length) return []; const z = H.fas.find(q => q.id === id); if (z) return z.fills; const cv = ((M.P[id] || {}).ros || {}).cv || {}; return H.play.filter(c => (cv[c] || 0) >= 0.5); };
    if (H && H.play.length) h += `<div class="sub" style="margin-top:6px">In play this week (Matchup Monster's chance you win it): ${H.play.map(c => `<b${H.W[c] < 0.5 ? ' class="minus"' : ''}>${esc(NMc(c))} ${Math.round(H.W[c] * 100)}%</b>`).join(', ')}.</div>`;
    // position filter (Settings-free, remembered per league): guards, forwards or centres among the list, ranks kept from the full list
    const fp = ['G', 'F', 'C'].includes(S(lg).faPos) ? S(lg).faPos : 'all'; const posOK = id => { if (fp === 'all') return true; const ps = String((M.P[id] || {}).pos || '').toUpperCase().split(/[\s,\/]+/);
      return fp === 'G' ? ps.some(q => /^(PG|SG|G)$/.test(q)) : fp === 'F' ? ps.some(q => /^(SF|PF|F)$/.test(q)) : ps.includes('C'); };
    const mw = mmWeek(lg);
    const rows = B.list.map((x, i) => { if (!posOK(x.id)) return ''; const name = nm(x.id); const sel = bd && !bd.over && K(bd.add) === K(name); const drop = sel ? bd.drop : x.drop; const you = sel ? bd.you : x.you;
      const st = SL.get(K(name)); const av = availOf(y, name); const ga = gamesLeft(mw, x.id), gd = drop ? gamesLeft(mw, drop) : null;
      const tags = []; if (sel && bd.worth && !bd.wait) tags.push(['g', bd.chosen ? 'Your pick' : 'Best pickup']); if (sel && bd.worth && bd.wait) tags.push(['a', 'Wait until Monday']); if (st) tags.push(['a', 'Stream this week only']); if (!x.atLeast && you === bar) tags.push(['n', 'At your bar (' + of99(bar) + ')']);
      if (av && av.st === 'W') { const wd = wvDate(av.wv); tags.push(['n', 'On waivers' + (wd ? ' until ' + fmtD(wd) : '')]); }
      const cm = cvSwap(M, x.id, drop); const P = M.P[x.id], D = M.P[drop]; const alt = !sel && x.alt ? x.alt : null;
      return `<details class="pr fa" data-k="fa${esc(x.id)}"><summary><div class="l1"><span class="frk">${i + 1}</span><b>${esc(name)}</b><span class="fv${tags.length && tags[0][0] === 'g' ? ' plus' : ''}">${o99(you, x.atLeast)}</span></div>
        <div class="l2">${tags.length ? `<div class="ftags">${tags.map(t => `<span class="fk ${t[0]}">${esc(t[1])}</span>`).join('')}</div>` : ''}<div class="ln">${esc(teamN(P.t))}${P.inj ? ` · <span class="minus">${esc(injChip(P.inj))}</span>` : ''} · ${drop ? 'drop ' + esc(sur(nm(drop))) : bd && bd.over ? 'after your roster fits' : 'no drop: empty spot'}</div>${ga != null || fillsOf(x.id).length ? `<div class="ln"><span>This week</span> ${ga != null ? ga + ' game' + (ga === 1 ? '' : 's') : ''}${ga != null && fillsOf(x.id).length ? ' · ' : ''}${fillsOf(x.id).length ? 'fills ' + esc(listW(fillsOf(x.id).map(NMc))) : ''}</div>` : ''}${cm.up.length ? `<div class="ln"><span>Helps</span> ${esc(listW(cm.up.slice(0, 4)))}</div>` : ''}${cm.dn.length ? `<div class="ln"><span>Costs</span> ${esc(listW(cm.dn.slice(0, 3)))}</div>` : ''}</div></summary>
        <div class="ld"><div class="sub">${drop ? `Add ${esc(sur(name))}, drop <b>${esc(nm(drop))}</b>${sel && bd.drop !== x.drop ? ' (your choice)' : `: Trade Monster's best drop for him`}.` : `Add ${esc(sur(name))} into your empty roster spot, nobody dropped (shown with his best drop: a plain add is at least that).`}</div>
          <div class="gains"><div><span>This week</span>${ga != null ? `<span class="gnum">${ga} game${ga === 1 ? '' : 's'} left${gd != null ? `, ${esc(sur(nm(drop)))} ${gd}` : ''}</span>` : '<span class="sub">–</span>'}</div><div><span>Rest of season</span><span class="gnum ${you >= 0 ? 'plus' : 'minus'}">${o99(you, x.atLeast)} of 99</span></div></div>
          ${st ? `<div class="sub" style="margin-top:4px"><b>As a stream:</b> drop ${esc(st.drop)} for ${st.games} game${st.games === 1 ? '' : 's'} from ${esc(fmtD(st.date))}.</div>` : ''}
          ${alt ? `<div class="sub" style="margin-top:4px">Or drop ${esc(nm(alt.drop))}: ${of99(alt.you)} of 99.</div>` : ''}
          ${drop ? statsVs(name, nm(drop)) : ''}
          <div class="sub">${P.ros && P.ros.g != null ? `${P.ros.g} games left projected for ${esc(sur(name))}` : ''}${D && D.ros && D.ros.g != null ? `, ${D.ros.g} for ${esc(sur(nm(drop)))}` : ''}.${P.rank ? ` Basketball Monster rank ${P.rank}.` : ''}${M.hot(name) ? ` <span class="plus">${esc(M.hot(name))}</span>.` : ''}</div>
          <div class="acts">${sel && bd.chosen ? '<button class="lnk" data-unplan>Back to the top pickup</button>' : !sel ? `<button class="lnk" data-plan="${esc(name)}" data-pdrop="${esc(nm(drop))}">Plan this pickup instead</button>` : ''}${(() => { const u = yLink(lg, name); return u ? `<a class="lnk" href="${esc(u)}" target="_blank" rel="noopener">Open on Yahoo</a>` : ''; })()}</div></div></details>`; }).join('');
    h += `<div class="sub" style="margin:8px 0 4px">Your top ${B.list.length}, best for you first. The number: Basketball Monster's Find Free Agents, matchups won out of 99 a week over the rest of the season, with the drop that leaves you best off (your bar ${of99(bar)}). This week: games left and categories in play from Matchup Monster. Helps and Costs: his category values less the drop's. Read ${esc(ago(B.ts))}.</div>`;
    h += `<div class="seg small sortbar fapos">${[['all', 'All'], ['G', 'Guards'], ['F', 'Forwards'], ['C', 'Centres']].map(([k, t]) => `<button data-fapos="${k}" class="${fp === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    h += rows || `<div class="strnone">None of your top ${B.list.length} free agents plays ${{ G: 'guard', F: 'forward', C: 'centre' }[fp]}.</div>`;
    const wk = H ? H.fas.slice(0, 5).filter(z => !B.list.some(q => q.id === z.id) && M.P[z.id] && posOK(z.id)) : [];
    h += wk.map(z => { const P = M.P[z.id]; const u = yLink(lg, P.n); return `<details class="pr fa" data-k="fw${esc(z.id)}"><summary><div class="l1"><span class="frk">–</span><b>${esc(P.n)}</b><span class="fv">–</span></div>
      <div class="l2"><div class="ftags"><span class="fk a">This week only</span></div><div class="ln">${esc(teamN(P.t))}${z.inj ? ` · <span class="minus">${esc(injChip(z.inj))}</span>` : ''}</div><div class="ln"><span>This week</span> ${z.g} game${z.g === 1 ? '' : 's'} · fills ${esc(listW(z.fills.map(NMc)))}</div></div></summary>
      <div class="ld"><div class="sub">Matchup Monster suggests him for this week, but he isn't in your top ${B.list.length} for the rest of the season: a stream, not a keeper.</div>${u ? `<div class="acts"><a class="lnk" href="${esc(u)}" target="_blank" rel="noopener">Open on Yahoo</a></div>` : ''}</div></details>`; }).join('');
    return h + '</div>'; }

  // ---- projected standings: Basketball Monster's Analysis Monster (rest of season, counting only games each team can start)
  // added to the record each team already has on Yahoo ----
  // projected final table: Yahoo record now + each team's share of categories for the weeks left (Basketball Monster's Analysis
  // Monster). dShare: { yahooTid: change in that team's share of categories won } — how a trade moves the table
  const nth = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  // standings: Yahoo's actual table and Basketball Monster's Analysis Monster projection, each exactly as its source gives it
  // The three tables, all from numbers as their sources give them (no model of our own):
  //   1. Yahoo's standings now (W-L-T, Yahoo's pct: a tie counts as half a win)
  //   2. remaining categories to win: Basketball Monster's rest-of-season win rate × categories a week × weeks left
  //   3. projected final standings: Yahoo's record now + table 2 (the rest of the categories left count as losses, ties stay)
  // Weeks left = regular-season weeks (Yahoo's playoffs start week − 1) less the weeks already in Yahoo's standings, counted
  // from the standings themselves (W + L + T ÷ categories a week), so a week Yahoo has already counted is never counted twice.
  const yPct = (w, l, t) => { const n = w + l + t; return n ? (w + t / 2) / n : 0; };
  const pct3 = x => x.toFixed(3).replace(/^0/, '');
  function standProj(y) { const sp = ST['ysetp:' + y.lid] || {}; const ys = (ST['ystand:' + y.lid] || {}).teams || []; const bs = ST['bbmstand:' + y.lid];
    const out = { poN: sp.poTeams || null, ys, bs, why: '' };
    const cats = (String(sp.cats || '').match(/\([^)]+\)/g) || []).length || String(sp.cats || '').split(',').filter(s => s.trim()).length;
    const lastReg = sp.poWeeks && sp.poWeeks.length ? Math.min(...sp.poWeeks) - 1 : null;
    if (!ys.length) { out.why = "Yahoo's standings arrive with the next sync."; return out; }
    if (!bs || !bs.teams || !bs.teams.length || !bs.teams.some(t => t.winPct != null)) { out.why = "Basketball Monster's projection arrives with the next sync."; return out; }
    if (!cats || !lastReg) { out.why = "Yahoo's league settings (categories and playoff weeks) arrive with the next sync."; return out; }
    const played = ys.map(t => t.w + t.l + t.t); const done = Math.max(...played) / cats;
    if (!Number.isInteger(done)) { out.why = `Yahoo's standings show ${Math.max(...played)} categories played, which isn't a whole number of ${cats}-category weeks, so the projection is left out.`; return out; }
    const weeks = Math.max(0, lastReg - done), per = cats * weeks;
    if (!weeks) { out.why = "The regular season is over: Yahoo's current standings are the final ones."; return out; }
    const rate = t => t.winPct == null ? null : t.winPct > 1 ? t.winPct / 100 : t.winPct;
    // each Yahoo team's Basketball Monster team: the same matcher as the rest of the League tab (copes with a renamed team)
    const am = amMatch(y.lid, y.tid); const rows = ys.map(yt => { const b = am[String(yt.tid)]; const r = b && rate(b); if (r == null) return null;
      const exp = r * per; const W = yt.w + exp, L = yt.l + (per - exp), T = yt.t;
      return { tid: String(yt.tid), name: yt.name, me: String(yt.tid) === String(y.tid), rate: r, exp, vsMe: b.vsMe, now: yt, W, L, T, pct: yPct(W, L, T) }; }).filter(Boolean);
    return Object.assign(out, { cats, lastReg, done, weeks, per, rows, missing: ys.filter(t => !rows.some(r => r.tid === String(t.tid))).map(t => t.name) }); }
  // one table at a time, chosen with the tabs at the top of the card (remembered per league)
  const STN_TABS = [['now', 'Current'], ['left', 'Still to win'], ['final', 'Projected final']];
  function standingsCard(lg, open) { const y = yrFor(lg); if (!y) return ''; const J = standProj(y); const { ys, bs, poN } = J; const isMe = t => String(t.tid) === String(y.tid);
    const tab = STN_TABS.some(([k]) => k === S(lg).stnTab) ? S(lg).stnTab : 'now';
    let h = `<div class="card stn"><div class="h"><span>Standings</span></div>`;
    h += `<div class="seg small sortbar stntab">${STN_TABS.map(([k, t]) => `<button data-stntab="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    // 1. Yahoo now
    if (tab === 'now') { if (!ys.length) return h + `<div class="sub" style="margin-top:8px">Yahoo's standings arrive with the next sync.</div></div>`;
      return h + `<div class="label lbl2">Current standings <span class="muted">· Yahoo</span></div><div class="tbl">${ys.map(t => `<div class="tr${isMe(t) ? ' me' : ''}${poN && t.rank === poN ? ' cut' : ''}"><span>${t.rank}</span><span class="nm">${isMe(t) ? 'You' : esc(t.name)}</span><span>${t.w}-${t.l}-${t.t}</span><span class="muted" title="Yahoo's win percentage: a tie counts as half a win">${pct3(t.pct != null ? t.pct : yPct(t.w, t.l, t.t))}</span></div>`).join('')}</div>${poN ? `<div class="sub">Top ${poN} make the playoffs.</div>` : ''}</div>`; }
    if (!J.rows) return h + `<div class="sub" style="margin-top:8px">${esc(J.why)}</div></div>`;
    const age = `<span class="muted">· projection · Analysis Monster · ${esc(ago(bs.ts))}</span>`;
    const miss = J.missing.length ? `<div class="sub minus">Not matched to Basketball Monster, so left out of the projection: ${esc(J.missing.join(', '))}.</div>` : '';
    // 2. remaining categories to win
    if (tab === 'left') { const R2 = J.rows.slice().sort((a, b) => b.exp - a.exp);
      return h + `<div class="label lbl2">Remaining categories to win ${age}</div>
      <div class="sub">${J.weeks} regular-season week${J.weeks === 1 ? '' : 's'} left × ${J.cats} categories = ${J.per} categories per team. Expected wins = Basketball Monster's win rate × ${J.per}.</div>
      <div class="tbl c5">${R2.map((t, i) => `<div class="tr${t.me ? ' me' : ''}"><span>${i + 1}</span><span class="nm">${t.me ? 'You' : esc(t.name)}</span><span title="Share of categories Basketball Monster projects them to win from here">${Math.round(t.rate * 100)}%</span><span title="Expected categories won in the ${J.weeks} weeks left">${Math.round(t.exp)}</span><span class="muted" title="Categories Basketball Monster projects you to win, lose and tie against them">${t.vsMe ? `you ${t.vsMe.w}-${t.vsMe.l}-${t.vsMe.t}` : ''}</span></div>`).join('')}</div>
      <div class="sub">Basketball Monster's own rate: the share of categories each team wins from here, counting only the games each team can start. It ignores results so far.</div>${miss}</div>`; }
    // 3. projected final standings
    const R3 = J.rows.slice().sort((a, b) => b.pct - a.pct || b.W - a.W);
    h += `<div class="label lbl2">Projected final standings ${age}</div>
      <div class="tbl">${R3.map((t, i) => `<div class="tr${t.me ? ' me' : ''}${poN && i + 1 === poN ? ' cut' : ''}"><span>${i + 1}</span><span class="nm">${t.me ? 'You' : esc(t.name)}</span><span title="Yahoo now ${t.now.w}-${t.now.l}-${t.now.t}, plus ${Math.round(t.exp)} expected wins and ${Math.round(J.per - t.exp)} losses">${Math.round(t.W)}-${Math.round(t.L)}-${t.T}</span><span class="muted" title="Win percentage worked out as Yahoo does: a tie counts as half a win">${pct3(t.pct)}</span></div>`).join('')}</div>`;
    const mi = R3.findIndex(t => t.me);
    if (poN && mi >= 0 && R3.length > poN) { const sc = t => t.W + t.T / 2; const me = R3[mi];
      const g = mi >= poN ? sc(R3[poN - 1]) - sc(me) : sc(me) - sc(R3[poN]); const gr = Math.round(g); const other = mi >= poN ? R3[poN - 1] : R3[poN];
      h += `<div class="sub"><b class="${mi >= poN ? 'minus' : 'plus'}">${gr === 0 ? `Level with ${esc(other.name)}` : mi >= poN ? `${gr} categor${gr === 1 ? 'y' : 'ies'} behind the playoff line` : `${gr} categor${gr === 1 ? 'y' : 'ies'} above the playoff line`}</b> (${mi >= poN ? `${nth(poN)}, ${esc(other.name)}` : `${nth(poN + 1)}, ${esc(other.name)}`}). Top ${poN} make the playoffs.</div>`; }
    h += `<div class="sub">Yahoo's record now plus the expected wins from Still to win (${J.weeks} weeks × ${J.cats} categories = ${J.per}); the rest of the ${J.per} count as losses. Ties so far stay as they are, and none are projected. It adds results so far to Basketball Monster's rate.</div>`;
    return h + miss + '</div>'; }
  // (no automatic deal search any more: trades are judged by you, with the trade block and the deal check on Yahoo's trade page)
  // ---- Strategy page: plain, colour-coded reads of your build and players, with the stats behind each one a tap away ----
  // The logic (also in "How this works" on the page):
  //  · Bands: your share of teams beaten in each category on Basketball Monster's Analysis Monster, cut at your thresholds and
  //    set once. Punted categories always count as lost.
  //  · A player's fit: where his Basketball Monster category values land for your build. Most of his plus value in lost
  //    categories → "value in punted categories"; clearly positive in swing categories → "fits your build"; clearly positive in
  //    the categories you win and not in swing ones → "surplus in won categories" (spare value: a sell, like lost-category value); clearly negative in swing categories → "costs you"; else
  //    "small impact". Analyst tags are shown as grey labels and never change a read.
  window.STAB = window.STAB || 'build';
  const FIT = { costs: ['r', 'A free agent does more'], holds: ['a', 'Surplus in won categories'], wasted: ['a', 'Value in lost categories'], anchor: ['g', 'Anchor'], keep: ['g', 'Keep'] };
  const GDESC = { keep: 'No free agent beats him by your pickup bar, and Trade Monster has no realistic swap for him that clears your trade bar. Most valuable to you first', holds: 'Trade Monster has a realistic swap for him, and you\'d still win every category without him: his output there is spare', anchor: 'Trade Monster has a swap for him, but without him a category you win or contest drops a band: keep him unless the return covers it',wasted: 'Trade Monster has a realistic swap for him that clears your bar: his output sits in categories you\'ve lost', costs: 'A free agent adds at least your pickup bar to your team in his place: a drop candidate (see Who to drop on Pickups)' };
  const FT_RULE = { fits: 0.5, wasted: 1.0, share: 0.5, holds: 1.5, costs: -1.0 }; // in Basketball Monster category values (0 is an average player)
  function fitOf(cv, grp, FT) { FT = FT || FT_RULE; const sum = cs => cs.reduce((a, c) => a + (cv[c] || 0), 0), pos = cs => cs.reduce((a, c) => a + Math.max(0, cv[c] || 0), 0);
    const lost = pos(grp.lost), swing = sum(grp.swing), won = sum(grp.won); const plus = lost + Math.max(0, swing) + Math.max(0, won);
    const kind = lost >= FT.wasted && plus > 0 && lost / plus >= FT.share ? 'wasted' : swing >= FT.fits ? 'fits' : won >= FT.holds && swing < FT.fits ? 'holds' : swing <= FT.costs ? 'costs' : 'small';
    return { kind, lost, swing, won }; }
  function strategyState(lg, M) { const STR = window.STRAT; const l = leaguesKnown().find(x => x.league === lg); if (!STR || !l || !M) return null;
    return memo('strat|' + lg, () => { const cats = M.ctx.cats; const punt = M.ctx.punt || []; const sk = 'strat:' + l.lid; let snap = ST[sk];
      const winNow = STR.catWin(ST['bbmstand:' + l.lid], cats);
      if (!snap && winNow) { snap = STR.snapshot(M, winNow, punt); ST[sk] = snap; browser.storage.local.set({ [sk]: snap }); }
      if (!snap) return { l, snap: null, winNow };
      const th = Object.assign({}, STR.TH0, S(lg).th || {}); const groups = (pu, win) => { const band = STR.bands(win, cats, pu, th); return { band, grp: { lost: cats.filter(c => band[c] === 'punt' || band[c] === 'dead'), swing: cats.filter(c => band[c] === 'swing'), won: cats.filter(c => band[c] === 'safe' || band[c] === 'locked') } }; };
      const FR = fitRule(lg); const G = groups(punt, snap.win); const bandNow = winNow ? STR.bands(winNow, cats, punt, th) : null;
      const rows = Object.entries(amMatch(l.lid, M.L.me)).map(([tid, t]) => ({ tid, val: t.val || {}, tot: t.tot || {} }));
      const all = Object.values(M.P).filter(p => p.ros && p.ros.lv != null && (p.ros.g || 0) > 0).sort((a, b) => b.ros.lv - a.ros.lv); const brank = {}; all.forEach((p, i) => brank[p.id] = i + 1);
      const own = {}; M.L.teams.forEach(t => t.ids.forEach(id => own[id] = t.tid));
      const ystat = {}; ((yrFor(lg) || {}).rows || []).forEach(r => { const id = M.find(r.name, r.team); if (id) ystat[id] = r.inj || ''; });
      // the read (kind) comes from the one measure; the category sums only say where his output sits (won or lost categories)
      const RD = readsFor(lg); const pos = (cv, cs) => cs.reduce((a, c) => a + Math.max(0, cv[c] || 0), 0);
      const line = (id, grp, rd) => { const p = M.P[id]; if (!p || !p.ros) return null; const cv = p.ros.cv || {}; const gg = grp || G.grp; const f = fitOf(cv, gg, FR); rd = rd || RD;
        const r = rd && (rd.by[id] || rd.league[id]); if (r) { f.kind = r.kind === 'sell' ? (pos(cv, gg.won) >= pos(cv, gg.lost) ? 'holds' : 'wasted') : r.kind; f.read = r; f.mine = !!rd.by[id]; f.rd = rd;
          // 8.3.0: an anchor is never a sell; a keeper who is one shows it as a warning
          // 25 Nov: measured against his own best free agent (the one Find Free Agents would put in his place), never on a drop candidate
          if (f.mine && !grp && f.kind !== 'costs') { f.anc = anchorDrops(lg, M, id, r.best ? r.best.id : null, { snap, rows, mineIds, cats, punt, th }); if (f.anc.length && (f.kind === 'holds' || f.kind === 'wasted')) f.kind = 'anchor'; } }
        return Object.assign({ id, n: p.n, t: p.t, cv, lv: p.ros.lv || 0, tg: teamLeft(p.t), brank: brank[id] || null, g: p.ros.g || 0, inj: ystat[id] || p.inj || '', tag: STR.tagOf(p), notes: (p.notes || []).filter(n => n.tag), yrank: M.yrank ? M.yrank(id) : null, own: own[id] || null, p }, f); };
      const mineIds = (M.L.teams.find(t => t.tid === M.L.me) || {}).ids || [];
      const mine = mineIds.map(id => line(id)).filter(Boolean);
      const league = all.filter(p => own[p.id] && own[p.id] !== M.L.me && p.ros.cv).map(p => line(p.id)).filter(Boolean); // rostered players only: free agents live on the Pickups page
      const miss = STR.missing(((ST['lgscan:' + l.lid] || {}).teams || []).filter(t => String(t.tid) !== M.L.me).flatMap(t => t.players || []).filter(n => !/\bplayer notes?\b/i.test(n)), n => M.find(n));
      return { l, snap, winNow, th, band: G.band, grp: G.grp, bandNow, groups, rows, mine, mineIds, league, line, miss, cats, punt, brank, rd: RD }; }); }
  // 8.3.0, the remove-him test (owner's rule): take a player's Basketball Monster rest-of-season output out of your Analysis Monster
  // totals (in proportion to how much of your roster's output Analysis Monster counts), add any players coming back, and re-count the
  // teams you beat. A category that drops a band (won → contested, contested → lost) is load-bearing: he's an anchor there.
  // Drops within a band (locked → safe) don't count: that cushion is the surplus you can trade from.
  const BANDW = { dead: 'lost', punt: 'lost', swing: 'contested', safe: 'won', locked: 'won' }, BANDR = { dead: 0, punt: 0, swing: 1, safe: 2, locked: 2 };
  function anchorDrops(lg, M, give, get, V0) { const V = V0 || (M && strategyState(lg, M)); if (!V || !V.snap || !V.snap.win) return [];
    give = [].concat(give || []); get = [].concat(get || []);
    return memo('anc|' + lg + '|' + give.join() + '|' + get.join(), () => { const me = V.rows.find(r => r.tid === String(M.L.me)), opp = V.rows.filter(r => r !== me && r.tot);
      if (!me || !me.tot || opp.length < 3) return [];
      // with nothing coming back his spot isn't left empty: Basketball Monster's best free agent (rest-of-season value) fills it
      if (!get.length) { const own = new Set(M.L.teams.flatMap(t => t.ids)); let fa = null; Object.entries(M.P).forEach(([id, p]) => { if (!own.has(id) && p.ros && p.ros.st && (p.ros.g || 0) > 0 && (!fa || (p.ros.lv || 0) > (M.P[fa].ros.lv || 0))) fa = id; }); if (fa) get = [fa]; }
      const raw = ids => { const t = {}; ids.forEach(id => { const q = (M.P[id] || {}).ros; if (q && q.st) Object.entries(q.st).forEach(([k, v]) => t[k] = (t[k] || 0) + (v || 0) * (q.g || 0)); }); return t; };
      const R0 = raw(V.mineIds), R1 = raw(V.mineIds.filter(id => !give.includes(id)).concat(get)); const PCT = { 'fg%': ['fg', 'fga'], 'ft%': ['ft', 'fta'] };
      const after = c => { const v = me.tot[c]; if (v == null) return null; const P = PCT[c];
        if (P) return R0[P[1]] && R1[P[1]] ? v + R1[P[0]] / R1[P[1]] - R0[P[0]] / R0[P[1]] : v; return R0[c] ? v * R1[c] / R0[c] : v; };
      const beat = (c, v) => opp.reduce((a, o) => o.tot[c] == null ? a : a + (v === o.tot[c] ? 0.5 : (c === 'to' ? v < o.tot[c] : v > o.tot[c]) ? 1 : 0), 0);
      // today's Analysis Monster totals before and after, counted the same way (not the bands' saved snapshot)
      const win0 = {}, win1 = {}; V.cats.forEach(c => { const v1 = after(c); if (me.tot[c] == null || v1 == null) return; win0[c] = beat(c, me.tot[c]) / opp.length; win1[c] = beat(c, v1) / opp.length; });
      const b0 = window.STRAT.bands(win0, V.cats, V.punt, V.th), b1 = window.STRAT.bands(win1, V.cats, V.punt, V.th); const n = x => Math.round((x || 0) * opp.length);
      return V.cats.filter(c => win0[c] != null && BANDR[b1[c]] < BANDR[b0[c]]).map(c => ({ c, from: BANDW[b0[c]], to: BANDW[b1[c]], n0: n(win0[c]), n1: n(win1[c]) })); }); }
  // "rebounds drops from won to contested (you'd beat 7 teams, not 10)"
  const dropWords = D => D.map(x => `${NN(x.c)} drops from ${x.from} to ${x.to} (you'd beat ${x.n1} team${x.n1 === 1 ? '' : 's'}, not ${x.n0})`).join('; ');
  // a team's categories from Basketball Monster's team values, cut by the same bands: the share of teams it beats in each
  function teamNeeds(lg, M, tid) { const l = leaguesKnown().find(x => x.league === lg); const STR = window.STRAT; if (!l || !STR) return null;
    const rows = Object.entries(amMatch(l.lid, M.L.me)).map(([t, r]) => ({ tid: t, val: r.val || {} })); const me = rows.find(r => r.tid === String(tid)); if (!me || rows.length < 4) return null;
    const th = Object.assign({}, STR.TH0, S(lg).th || {}); const share = c => { const o = rows.filter(r => r.tid !== me.tid && r.val[c] != null); return me.val[c] == null || !o.length ? null : o.filter(r => r.val[c] < me.val[c]).length / o.length; };
    const cats = M.ctx.cats; const sh = {}; cats.forEach(c => sh[c] = share(c));
    const need = cats.filter(c => sh[c] != null && sh[c] >= th.dead && sh[c] < th.safe), strong = cats.filter(c => sh[c] != null && sh[c] >= th.safe), punt = cats.filter(c => sh[c] != null && sh[c] < th.dead);
    const mine = (M.L.teams.find(t => t.tid === M.L.me) || { ids: [] }).ids; const helpOf = id => ({ cats: need.filter(c => ((((M.P[id] || {}).ros || {}).cv || {})[c] || 0) >= 0.5) });
    const helpers = mine.map(id => ({ id, cats: helpOf(id).cats })).filter(x => x.cats.length).sort((a, b) => b.cats.length - a.cats.length).slice(0, 6);
    return { need, strong, punt, share: sh, helpOf, helpers }; }
  // ---- plain words ----
  const andL = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
  const NN = c => window.STRAT.name(c);
  // Yahoo's status codes in words (the panel shows no abbreviations)
  const INJW = { Q: 'Questionable', D: 'Doubtful', P: 'Probable', O: 'Out', OUT: 'Out', INJ: 'Injured', GTD: 'Game-time decision', DTD: 'Day-to-day', NA: 'Not active', SUSP: 'Suspended', IL: 'Injured list', 'IL+': 'Injured list' };
  const injChip = x => { const s = String(x || '').trim(); const k = s.split(/\s+/)[0].toUpperCase(); return INJW[k] ? INJW[k] + s.slice(k.length) : s; };
  // what a player is good and bad at, in words (category values of +0.5 / −0.5 and beyond)
  const goodAt = (cv, cs) => cs.filter(c => (cv[c] || 0) >= 0.5).sort((a, b) => cv[b] - cv[a]);
  // a player's read as short lines, one statement each: [label, categories]
  // trades read from Basketball Monster's Trade Monster (tmDeals); strengths are its category values (+0.5 and up, −0.5 and down)
  function fitWords(r, V, grp) { grp = grp || V.grp; const cv = r.cv || {}; const L = (a) => andL(a.map(NN)); const parts = []; const lg = league(); const M = modelFor(lg);
    if (!M) return [['', 'Not rated yet']]; const TD = tmDeals(lg, M), bar = bar99(lg); const x = r.read; const cats = Object.keys(cv); const weakAt = cs => cs.filter(c => (cv[c] || 0) <= -0.5).sort((a, b) => cv[a] - cv[b]);
    const good = goodAt(cv, cats).slice(0, 3), weak = weakAt(cats).slice(0, 3); const pl = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
    if (r.mine) { if (good.length) parts.push(['Strong in', L(good)]);
      if (r.anc && r.anc.length) parts.push(['Anchor', 'without him ' + dropWords(r.anc)]);
      if (x && x.best && M.P[x.best.id]) parts.push(['Free agent', `${M.P[x.best.id].n} in his place: ${of99(x.best.you)} of 99 (your pickup bar ${of99(x.pbar)})${x.held && x.best.you >= x.pbar ? ', but he\'s ' + (x.il ? 'on the injured list' : 'protected (a keep, a recent add or a top-half player)') : ''}`]);
      if (r.kind === 'holds' || r.kind === 'wasted') { const g = goodAt(cv, r.kind === 'holds' ? grp.won : grp.lost); if (g.length) parts.push([r.kind === 'holds' ? 'Surplus in' : 'Value in', L(g) + (r.kind === 'holds' ? ' (already won)' : ' (lost)')]); }
      const X = TD && TD.by[r.id]; if (X && X.ok[0]) parts.push(['Trade Monster', `${pl(X.ok.length, 'realistic swap')}, best: ${M.P[X.ok[0].id] ? M.P[X.ok[0].id].n : X.ok[0].id}, you ${of99(X.ok[0].you)} · them ${of99(X.ok[0].them)} of 99`]);
      else if (X && X.no[0]) parts.push(['Trade Monster', `${pl(X.no.length, 'swap')} add ${of99(bar)} or more for you, none likely to be accepted`]); else if (TD) parts.push(['Trade Monster', `no swap at his trade value adds ${of99(bar)} of 99 or more`]); }
    else { const d = TD && TD.tgt[r.id]; parts.push(['Trade Monster', d ? `for your ${M.P[d.give] ? M.P[d.give].n : d.give}: you ${of99(d.you)} · them ${of99(d.them)} of 99${d.why.length ? ' (unlikely: ' + d.why.join('; ') + ')' : ''}` : `not paired with any of yours for ${of99(bar)} of 99 or more`]);
      if (good.length) parts.push(['Strong in', L(good)]); if (weak.length) parts.push(['Weak in', L(weak)]); }
    return parts; }
  // the stats behind a read: Basketball Monster's projection, this season so far and the last two weeks, per game
  function statsTable(p, cats) { const cols = [['Projection', p.ros], ['Season', p.season], ['Last 2 weeks', p.form]].filter(x => x[1] && x[1].st);
    const v = (st, c) => { if (!st) return '–'; if (c === 'fg%') return st.fga ? (st.fg / st.fga * 100).toFixed(1) + '%' : '–'; if (c === 'ft%') return st.fta ? (st.ft / st.fta * 100).toFixed(1) + '%' : '–'; const x = st[c === '2d' ? '2d' : c]; return x == null ? '–' : (+x).toFixed(c === 's' || c === 'b' || c === '3' || c === 'to' || c === '2d' ? 1 : 1); };
    const vol = (st, c) => c === 'fg%' && st && st.fga ? ` <i>${(+st.fga).toFixed(1)} att</i>` : c === 'ft%' && st && st.fta ? ` <i>${(+st.fta).toFixed(1)} att</i>` : '';
    return `<table class="stt2"><thead><tr><th></th>${cols.map(c => `<th>${c[0]}${c[1].g ? `<i>${c[1].g} g</i>` : ''}</th>`).join('')}</tr></thead><tbody>${cats.map(c => `<tr><td>${esc(window.STRAT.Name(c))}</td>${cols.map(x => `<td>${v(x[1].st, c)}${vol(x[1].st, c)}</td>`).join('')}</tr>`).join('')}${cols[0] && cols[0][1].m ? `<tr><td>Minutes</td>${cols.map(x => `<td>${x[1].m ? (+x[1].m).toFixed(1) : '–'}</td>`).join('')}</tr>` : ''}</tbody></table>`; }
  function strategyCard(lg, M, opt) { const V = strategyState(lg, M); if (!V) return '';
    // Trades holds the trade sub-pages; Season the occasional ones (7.46.0). Each page remembers its own sub-page.
    const season = opt.page === 'season'; const sub = season ? [['build', 'Build'], ['how', 'How it works']] : [['roster', 'Roster'], ['block', 'Trade block'], ['finder', 'Finder']];
    const SB = window.STABS = window.STABS || {}; if (sub.some(x => x[0] === window.STAB)) SB[opt.page] = window.STAB; else window.STAB = SB[opt.page] || sub[0][0];
    let h = `<div class="seg trtabs stabs">${sub.map(([k, t]) => `<button data-stab="${k}" class="${window.STAB === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    if (!V.snap) return `<div class="card strat">${h}<div class="strnone">Waiting for Basketball Monster's Analysis Monster, which comes with the next sync.<span class="skel" style="width:70%"></span><span class="skel" style="width:45%"></span></div></div>`;
    const N = c => esc(NN(c)); const nOpp = Math.max(1, V.rows.length - 1); const beat = w => w == null ? null : Math.round(w * nOpp);
    const dt = ts => new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }); const owner = tid => tid ? esc(M.teamName(tid)) : 'Free agent';
    const tagChip = t => t && showTags(lg) ? `<span class="chip plain tagl" title="Basketball Monster analyst tag (general fantasy value, not your build): ${esc(t.text)}">${esc(t.by)}: ${esc(t.tag)}</span>` : '';
    const dot = k => `<i class="fd ${FIT[k][0]}"></i>`;
    const BW = { punt: ['Punted', 'n'], dead: ['Lost', 'n'], swing: ['Swing', 'a'], safe: ['Winning', 'gr'], locked: ['Locked', 'g'] };
    // one player: a coloured read in words; the stats behind it on tap
    const playerRow = (r, o) => { o = o || {}; const words = (o.extra || []).concat(fitWords(r, V, o.grp));
      return `<details class="pr" data-k="pr${esc(r.id)}"><summary><div class="l1">${r.mine ? dot(r.kind) : ''}<b>${esc(r.n)}</b>${r.mine ? `<span class="fk ${FIT[r.kind][0]}">${FIT[r.kind][1]}</span>` : ''}${r.inj ? `<span class="chip lost">${esc(injChip(r.inj))}</span>` : ''}${tagChip(r.tag)}${o.block != null ? `<button class="lnk blk${o.block ? ' on' : ''}" data-block="${esc(r.id)}">${o.block ? 'On the trade block' : 'Put on the trade block'}</button>` : ''}</div>
        <div class="l2">${words.map(w => `<div class="ln">${w[0] ? `<span>${esc(w[0])}</span> ` : ''}${esc(w[1])}</div>`).join('')}${r.tg ? `<div class="ln${r.g < 0.6 * r.tg ? ' warnl' : ''}"><span>Plays</span> ${Math.min(r.g, r.tg)} of ${r.tg} games left${r.g < 0.6 * r.tg ? ` (projected to miss ${r.tg - r.g})` : ''}</div>` : ''}${o.owner ? `<div class="ln muted">${owner(r.own)}</div>` : ''}</div></summary>
        <div class="ld">${statsTable(r.p, V.cats)}<div class="sub">${r.g} games left${r.brank ? ' · Basketball Monster rank ' + r.brank : ''}${r.yrank ? ' · Yahoo rank ' + r.yrank : ''}</div>${r.notes.map(n => `<div class="sub">${esc(n.by)} (${esc(n.tag)}${n.tagNote ? ' ' + esc(n.tagNote) : ''}): “${esc(n.text)}”</div>`).join('')}</div></details>`; };
    if (window.STAB === 'build') {
      const B = V.band; const ord = ['locked', 'safe', 'swing', 'dead', 'punt']; const by = k => V.cats.filter(c => B[c] === k);
      const won = by('locked').concat(by('safe')), sw = by('swing'), lost = by('dead').concat(by('punt'));
      const kept = V.cats.filter(c => B[c] !== 'punt'); const need = Math.floor(V.cats.length / 2) + 1;
      // your rule: look at the build again after a trade, a long-term injury, or every two weeks
      { const own = {}; M.L.teams.forEach(t => t.ids.forEach(id => own[id] = t.tid)); const sn = V.snap; const why = [];
        const days = Math.floor((Date.now() - sn.ts) / 864e5); if (days >= 14) why.push(`it's been ${days} days`);
        const tin = V.mineIds.filter(id => sn.own && sn.own[id] && sn.own[id] !== M.L.me), tout = (sn.mine || []).filter(id => own[id] && own[id] !== M.L.me);
        if (tin.length || tout.length) why.push('your roster has changed by trade' + (tin.length ? ` (in: ${andL(tin.map(id => esc(M.P[id] ? M.P[id].n : id)))})` : ''));
        const inj = V.mineIds.filter(id => window.STRAT.longInj(M.P[id]) && !(sn.inj || []).includes(id)); if (inj.length) why.push(`${andL(inj.map(id => esc(M.P[id].n)))} ${inj.length > 1 ? 'are' : 'is'} now out long term`);
        if (why.length) h += `<div class="rebands"><b>Worth setting your bands again:</b> ${why.join('; ')}. <button class="lnk" data-strev>Set again from today's numbers</button></div>`; }
      // 1 · your build: tap a category to punt it or bring it back (it changes your punt straight away, with Undo), and the best
      // available punt next to it. 2 · then your moves for that build.
      const BB = bestBuilds(lg, M, V); const ordN = n => nth(n);
      { const pu = V.cats.filter(c => B[c] === 'punt'); const cur = BB && BB.current; const best = BB && BB.list[0]; const same = best && cur && best.P.join() === cur.P.join();
        h += `<div class="puntbar"><div class="pbh"><span>${pu.length ? `Punting <b>${andL(pu.map(N))}</b>` : 'No punt: playing every category'}</span>${cur ? `<span class="muted">${ordN(cur.rank)} of ${BB.n}</span>` : ''}</div>
          <div class="sub" style="margin:2px 0 0">Tap a category to punt it or bring it back.</div>
          <div class="onoff">${V.cats.map(c => `<button class="oo ${B[c] === 'punt' ? 'off' : 'on'}" data-setp="${esc(c)}" aria-pressed="${B[c] === 'punt' ? 'false' : 'true'}" title="${B[c] === 'punt' ? 'Punted: tap to play for it again' : 'Playing for it: tap to punt'}"><i></i>${N(c)}</button>`).join('')}</div>
          ${best ? (same ? `<div class="bbest ok"><b>This is your best available punt.</b> Your team ranks ${ordN(cur.rank)} of ${BB.n} on the categories you play for.</div>`
            : `<div class="bbest"><div><b>Best available punt:</b> ${best.P.length ? `punt ${andL(best.P.map(N))}` : 'no punt'}. Your team would rank <b>${ordN(best.rank)}</b> of ${BB.n} on the categories kept${cur ? ` (now ${ordN(cur.rank)})` : ''}.</div><button class="btn small" data-usebuild="${esc(best.P.join(','))}">Use this build</button></div>`) : ''}</div>`; }
      h += `<button class="cta" data-findmoves>See your roster for this build<i>Who to sell, who fits, and who to put on the trade block</i></button>`;
      h += `<div class="hlbig">You're built to win <b>${andL(won.map(N))}</b>.${sw.length ? ` <b>${andL(sw.map(N)).replace(/^./, x => x.toUpperCase())}</b> decide${sw.length > 1 ? '' : 's'} your weeks.` : ''}</div>
        <div class="sub hls">Winning ${won.length} of ${kept.length} categories you play for; a week needs ${need} of ${V.cats.length}.${lost.length ? ` Not competing in ${andL(lost.map(N))}.` : ''}</div>`;
      h += `<div class="cbd2">${V.cats.slice().sort((a, b) => ord.indexOf(B[a]) - ord.indexOf(B[b])).map(c => { const b = B[c], bn = V.bandNow ? V.bandNow[c] : b; const w = V.snap.win[c]; const me = V.rows.find(r => r.tid === M.L.me); const rk = me && me.val[c] != null ? 1 + V.rows.filter(r => r.tid !== me.tid && r.val[c] != null && r.val[c] > me.val[c]).length : null;
        return `<details class="cb" data-k="cb${esc(c)}"><summary><i class="fd ${BW[b][1]}"></i><b>${N(c).replace(/^./, x => x.toUpperCase())}</b><span class="fk ${BW[b][1]}">${BW[b][0]}</span><span class="muted">${b === 'punt' ? 'by choice' : `beats ${beat(w)} of ${nOpp} teams`}</span>${bn !== b && b !== 'punt' ? `<span class="chip toss-up">now ${BW[bn][0].toLowerCase()}</span>` : ''}</summary>
          <div class="sub">${rk ? `${nth(rk)} of ${V.rows.length} on Basketball Monster's rest-of-season team values. ` : ''}${me && me.tot && me.tot[c] != null ? `Projected team total: ${me.tot[c]}. ` : ''}${bn !== b && b !== 'punt' && V.winNow ? `Today it beats ${beat(V.winNow[c])} of ${nOpp}: that would count as ${BW[bn][0].toLowerCase()}. Nothing changes until you set the bands again.` : ''}</div></details>`; }).join('')}</div>`;
      h += `<div class="sub" style="margin-top:8px">Bands set ${dt(V.snap.ts)} from Basketball Monster's Analysis Monster. <button class="lnk" data-strev>Set again from today's numbers</button></div>`;
      // try a different build: pick categories to punt and see what changes, without touching your set punt
      const tryP = (S(lg).tryPunt || []).filter(c => V.cats.includes(c));
      h += `<div class="h" style="margin-top:16px"><span>Try a different build</span></div>`;
      // the best available builds: your team's rank on Basketball Monster's team values, summed over the categories each build keeps
      if (BB && BB.list.length) { const curK = BB.current ? BB.current.P.join() : null;
        h += `<div class="label lbl2">Best available punts</div><div class="bbl">${BB.list.slice(0, 3).map((b, i) => `<div class="bbr${b.P.join() === curK ? ' cur' : ''}"><span class="bbn">${i + 1}</span><div class="bbw"><b>${b.P.length ? 'Punt ' + esc(andL(b.P.map(NN))) : 'No punt'}</b><small>${ordN(b.rank)} of ${BB.n} on the categories kept${b.P.join() === curK ? ' · your build' : ''}</small></div>${b.P.join() === curK ? '' : `${b.P.length ? `<button class="lnk" data-tryset="${esc(b.P.join(','))}">Preview</button>` : ''}<button class="btn small" data-usebuild="${esc(b.P.join(','))}">Use</button>`}</div>`).join('')}</div>
          <div class="sub">Every build of no punt, any one category, or two of your five weakest: Basketball Monster's team values added up over the categories kept, your team ranked against the league on the same categories. Ties go to fewer punts.</div>`; }
      h += `<div class="label lbl2">Or pick your own</div><div class="sub">Tap categories to preview a punt. Nothing changes until you press Use.</div><div class="trypick">${V.cats.map(c => `<button class="pchip${tryP.includes(c) ? ' on' : ''}" data-tryp="${esc(c)}">${N(c)}</button>`).join('')}</div>`;
      if (tryP.length) { const G2 = V.groups(tryP, V.snap.win); const won2 = V.cats.filter(c => G2.band[c] === 'safe' || G2.band[c] === 'locked'), sw2 = G2.grp.swing, lost2 = V.cats.filter(c => G2.band[c] === 'dead');
        const R1 = V.mine.slice().sort((a, b) => b.lv - a.lv).slice(0, 6); const R2 = R1.map(r => V.line(r.id, G2.grp)).filter(Boolean);
        const waste2 = R2.filter(r => r.kind === 'wasted' || r.kind === 'holds');
        h += `<div class="tryres"><div><b>Punting ${andL(tryP.map(N))}</b>: you'd already be winning ${won2.length} of ${V.cats.length - tryP.length} kept categories${won2.length ? ` (${andL(won2.map(N))})` : ''}.</div>
          ${sw2.length ? `<div>Still to fight for: ${andL(sw2.map(N))}.</div>` : ''}${lost2.length ? `<div class="minus">Kept but currently lost: ${andL(lost2.map(N))}.</div>` : ''}
          ${waste2.length ? `<div>Of your top six by Basketball Monster, ${andL(waste2.map(r => esc(r.n)))} would be worth more to you traded at ${waste2.length > 1 ? 'their' : 'his'} value.</div>` : ''}
          <div class="sub">This uses your team as it stands. Categories you've been punting will show as lost until the roster changes, so this view leans towards the build you already have.</div>
          <div class="sub">Compare: now you win ${won.length} of ${kept.length}.</div>
          ${(() => { const rk = BB && BB.rankOf(tryP); return rk ? `<div>Your team would rank <b>${ordN(rk.rank)}</b> of ${BB.n} on the categories kept${BB.current ? ` (now ${ordN(BB.current.rank)})` : ''}.</div>` : ''; })()}
          <div class="row" style="margin-top:4px"><button class="btn small" data-usebuild="${esc(tryP.slice().sort().join(','))}">Use this build</button><button class="lnk" data-tryclear>Clear</button></div></div>`; }
      if (V.miss.length) h += `<div class="sub" style="margin-top:8px">Not in Basketball Monster's projections: ${esc(V.miss.slice(0, 10).join(', '))}${V.miss.length > 10 ? ' and others' : ''}.</div>`;
    } else if (window.STAB === 'roster') {
      const block = S(lg).block || []; const ORD = ['costs', 'wasted', 'holds', 'anchor', 'keep'];
      h += `<div class="legend">${Object.entries(FIT).map(([k, v]) => `<span>${dot(k)}${v[1]}</span>`).join('')}</div>`;
      const gcats = k => { const G = V.grp; const L = a => esc(andL(a.map(NN))); return k === 'wasted' ? (G.lost.length ? 'Your lost categories: ' + L(G.lost) : '') : k === 'keep' || k === 'costs' ? (G.swing.length ? 'Your swing categories: ' + L(G.swing) : '') : k === 'holds' || k === 'anchor' ? (G.won.length ? 'Categories you win: ' + L(G.won) : '') : ''; };
      const lose = r => r.read && r.read.best ? r.read.best.you : -99; // keeps: what his best free agent would cost you, most first
      ORD.forEach(k => { const R = V.mine.filter(r => r.kind === k).sort((a, b) => k === 'keep' ? lose(a) - lose(b) : b.lv - a.lv); if (!R.length) return;
        // each group is a dropdown, closed when the page opens (8.2.0: the full list was too many names at once)
        h += `<details class="rgrp" data-k="rg-${k}"><summary class="grh2 k-${FIT[k][0]}"><div><b>${FIT[k][1]}</b><span class="cnt">${R.length}</span><i class="garr" aria-hidden="true"></i></div><span class="gd">${GDESC[k]}</span>${gcats(k) ? `<span class="gc">${gcats(k)}</span>` : ''}</summary>` + R.map(r => playerRow(r, { block: block.includes(r.id) })).join('') + '</details>'; });
    } else if (window.STAB === 'block') {
      // 8.1.0, owner's ask: the block matches profiles, Basketball Monster's numbers only: your needed categories (Analysis Monster
      // team values) → other teams' players at his Basketball Monster rank who are strong in them, and the teams that need what he brings
      const block = (S(lg).block || []).filter(id => V.mine.some(r => r.id === id)); const LV = V.league.concat(V.mine).reduce((m, x) => (m[x.id] = x, m), {});
      const injT = id => { const st = LV[id] && LV[id].inj; return st ? `<span class="fk r">${esc(injWord(st))}</span>` : ''; };
      const myNeed = ((M.needs && M.needs(M.L.me)) || {}).need || [];
      if (!block.length) h += `<div class="strnone">Nobody on the block yet. Tap "Put on the trade block" next to a player under Roster.</div>`;
      block.forEach(id => { const r = V.mine.find(x => x.id === id); if (!r) return; const T = teamNeedsAll(lg, M, r); const F = blockFits(r, V.league, myNeed, T.map(t => t.tid));
        const str = goodAt(r.cv || {}, Object.keys(r.cv || {})).slice(0, 3);
        h += `<div class="blkc"><div class="l1">${dot(r.kind)}<b>${esc(r.n)}</b>${injT(id)}<span class="fk ${FIT[r.kind][0]}">${FIT[r.kind][1]}</span>${r.brank ? `<span class="muted">Basketball Monster rank ${r.brank}</span>` : ''}<button class="lnk blk on" data-block="${esc(r.id)}">Take off the block</button></div>
          <div class="mvl"><span>Offering</span>${str.length ? `strong in <b>${esc(andL(str.map(NN)))}</b>` : 'no standout category'}</div>
          <div class="mvl"><span>Looking for</span>${myNeed.length ? `<b>${esc(andL(myNeed.map(NN)))}</b>, your swing categories` : 'no swing category to target'}</div>
          <div class="h mvh"><span>Teams that need what he brings</span></div>
          ${T.length ? T.map(t => `<div class="mvl"><span>${owner(t.tid)}</span>needs <b>${esc(andL(t.cats.map(NN)))}</b></div>`).join('') : `<div class="strnone">No team's swing categories match his strengths.</div>`}
          <div class="h mvh"><span>Players who fit</span><span class="sub">ranked ${F.lo} to ${F.hi} by Basketball Monster, strong (+0.5 or more) in what you need</span></div>
          ${F.list.length ? F.list.slice(0, 8).map(x => playerRow(x, { owner: true, extra: [['Brings', andL(x.hit.map(NN))]].concat(x.wants ? [['', 'His team needs what ' + r.n + ' brings']] : []) })).join('') : `<div class="strnone">${myNeed.length ? 'Nobody near his rank on another team is strong in ' + esc(andL(myNeed.map(NN))) + '.' : 'Set once Basketball Monster team values show a swing category.'}</div>`}
          ${tmBlock(lg, M, r, injT)}</div>`; });
    } else if (window.STAB === 'finder') {
      const f0 = S(lg).find || {}; const kind = f0.kind === 'all' ? 'all' : 'fits'; const TIER = [[1, 30, 'Stars'], [31, 75, 'Starters'], [76, 130, 'Rotation players'], [131, 9999, 'Depth']]; const TD = tmDeals(lg, M);
      // other teams' players Trade Monster pairs with one of yours, by your gain (realistic only, or any that clears your bar)
      const L0 = TD ? V.league.filter(x => TD.tgt[x.id] && (kind === 'all' || !TD.tgt[x.id].why.length)).sort((a, b) => TD.tgt[b.id].you - TD.tgt[a.id].you || TD.tgt[b.id].them - TD.tgt[a.id].them) : [];
      h += `<div class="seg small sortbar">${[['fits', 'Realistic'], ['all', 'Any']].map(([k, t]) => `<button data-fkind="${k}" class="${kind === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
      h += `<div class="sub" style="margin-bottom:8px">Players on other teams that Trade Monster's "Find Trades" pairs with one of yours for ${of99(bar99(lg))} of 99 or more, best for you first. Free agents are on the Pickups page.</div>`;
      h += !TD ? `<div class="strnone">Trade Monster hasn't been read for this league yet. It's read once a day with the full sync.</div>` : TIER.map(([a, b, name], ti) => { const T0 = L0.filter(x => (x.brank || 9999) >= a && (x.brank || 9999) <= b); return T0.length ? `<details class="more"${ti < 2 ? ' open' : ''}><summary>${name}: ${T0.length}</summary>${T0.slice(0, 12).map(x => playerRow(x, { owner: true })).join('')}</details>` : ''; }).join('') || '<div class="strnone">Nobody yet.</div>';
      // multi-player deals (8.4.0): Analyze Trade's numbers from the daily sync, only while every player is still where he was.
      // Hidden only by your bar and (Realistic) the other team losing more than your limit; Yahoo's view is a note, never a filter.
      { const T2 = M.tm2, bar = bar99(lg), tmin = themMin(lg); const own = {}; M.L.teams.forEach(t => t.ids.forEach(id => own[id] = t.tid)); const nm = id => esc((M.P[id] || {}).n || id);
        const y0 = yrFor(lg), sp = (y0 && ST['ysetp:' + y0.lid]) || {}; const W = window.SYNC && window.SYNC.worthOf && M.bx && M.bx.views ? window.SYNC.worthOf(M.bx.views.ros, M.L.teams.length * ((sp.slots || []).length || 10), (sp.slots || []).length || 10) : null;
        // Yahoo's view: the same lineup test with each player valued at his Yahoo rank, as the other manager sees the deal. Realistic
        // needs both views to pass (Basketball Monster's passed before scoring); Any shows the rest with this note.
        const yahooNote = d => { if (!W || !M.yrank) return ''; const yw = id => W.rank(M.yrank(id) || 999); const t = M.L.teams.find(x => x.tid === own[d.get[0]]); if (!t) return '';
          const [out, back] = W.lineup(t.ids, yw)(d.get, d.give);
          return out > 0 && back < fairMin(lg) * out ? `Yahoo's ranks make this look uneven to them: they'd see ${Math.round(back / out * 100)}% of what they give back` : ''; };
        const D = ((T2 && T2.deals) || []).filter(d => d.you >= bar && (kind === 'all' || (d.them >= tmin && !yahooNote(d))) && d.give.every(id => own[id] === M.L.me) && d.get.every(id => own[id] && own[id] === own[d.get[0]] && own[id] !== M.L.me)).sort((a, b) => b.you - a.you || b.them - a.them);
        const spot = d => d.get.length === d.give.length ? '' : d.add ? `Includes adding ${nm(d.add)} (free agent) to fill the open spot` : d.drop ? `Includes dropping ${nm(d.drop)} to make room` : d.get.length < d.give.length ? 'The open roster spot isn\'t counted' : 'The extra player you\'d have to drop isn\'t counted';
        h += `<div class="h mvh"><span>Multi-player deals</span><span class="sub">2-for-1 to 3-for-3, ${of99(bar)} of 99 or more</span></div>`;
        if (!T2) h += `<div class="strnone">Not scored yet. Trade Monster's Analyze Trade scores them once a day with the full sync.</div>`;
        else if (T2.err) h += `<div class="strnone">Couldn't score deals with Trade Monster today (${esc(T2.err)}). It tries again with the next full sync.</div>`;
        else h += (D.length ? D.slice(0, 15).map(d => { const A = anchorDrops(lg, M, d.give, d.get), yn = yahooNote(d), sp1 = spot(d);
          return `<div class="mvl tmd"><span>${esc(M.teamName(own[d.get[0]]))} <i>${d.give.length}-for-${d.get.length}${d.upgrade ? ' · upgrade' : ''}</i></span><b class="plus">You ${of99(d.you)}</b> · <b class="${d.them >= 0 ? 'plus' : 'minus'}">them ${of99(d.them)}</b> <i>of 99</i><div class="sub">Get ${d.get.map(nm).join(', ')} · give ${d.give.map(nm).join(', ')}</div>${sp1 ? `<div class="sub">${sp1}</div>` : ''}${d.them < tmin ? `<div class="sub">Unlikely: they lose ${Math.abs(d.them)} of 99</div>` : ''}${yn ? `<div class="sub">${esc(yn)}</div>` : ''}${A.length ? `<div class="sub minus">Warning: after this trade ${esc(dropWords(A))}</div>` : ''}</div>`; }).join('')
          : `<div class="strnone">None of the ${T2.deals.length} deals Trade Monster scored clears ${of99(bar)}${kind === 'all' ? '' : ' as a realistic deal'}.</div>`)
          + `<div class="sub tcf">Scored by Trade Monster's Analyze Trade (${esc(ago(T2.ts))}): ${T2.tried || 0} new today${T2.fails ? `, ${T2.fails} couldn't be scored` : ''}. Only deals where the other team gets back at least ${Math.round(fairMin(lg) * 100)}% of what they give (on Basketball Monster's values, as their best lineup) are asked about.</div>`; }
    } else if (window.STAB === 'how') h += howItWorks(lg, V);
    // the rules behind the reads: kept out of the sub-tab row, at the foot of the card
    return `<div class="card strat">${h}</div>`; }
  // ---- one block player's Trade Monster swaps, as Best trades showed them before 8.2.0: the teams with a realistic deal (best deal
  // first, then how many of the categories they need he brings), up to three deals each; then the ones good for you only ----
  function tmBlock(lg, M, r, injT) { const TD = tmDeals(lg, M), bar = bar99(lg); const X = TD && TD.by[r.id];
    if (!TD) return `<div class="strnone">Trade Monster hasn't been read for this league yet. It's read once a day with the full sync.</div>`;
    const tn = tid => esc(((M.L.teams.find(t => t.tid === tid) || {}).name) || 'another team'); const dealRow = d => { const D = anchorDrops(lg, M, d.give, d.id); return tmLine(M, d, injT, { warn: D.length ? 'after this swap ' + dropWords(D) : '' }); };
    let h = `<div class="h mvh"><span>Trade Monster's swaps</span><span class="sub">"Find Trades" · category matchups won out of 99 a week · bar ${of99(bar)} · read ${esc(ago(TD.ts))}</span></div>`;
    if (!X || !(X.ok.length || X.no.length)) return h + `<div class="strnone">No Trade Monster swap for him adds ${of99(bar)} of 99 or more.</div>`;
    const str = goodAt(r.cv || {}, Object.keys(r.cv || {})).slice(0, 3); const teams = {}; X.ok.forEach(d => (teams[d.tid] = teams[d.tid] || []).push(d));
    const fit = tid => { const N = M.needs && M.needs(tid); return N ? N.need.filter(c => str.includes(c)) : []; };
    const order = Object.keys(teams).sort((a, b) => Math.min(teams[b][0].you, teams[b][0].them) - Math.min(teams[a][0].you, teams[a][0].them) || fit(b).length - fit(a).length);
    const team = tid => { const nf = fit(tid); return `<div class="tmteam"><div class="mvl"><span>${tn(tid)}</span>${nf.length ? `needs <b>${esc(andL(nf.map(NN)))}</b>, which he brings` : 'gains from the swap'}</div>${teams[tid].slice(0, 3).map(dealRow).join('')}</div>`; };
    h += order.length ? order.slice(0, 4).map(team).join('') : `<div class="strnone">No realistic deal: every swap that clears the bar fails a check below.</div>`;
    if (order.length > 4) h += `<details class="more"><summary>${order.length - 4} more team${order.length - 4 === 1 ? '' : 's'}</summary>${order.slice(4).map(team).join('')}</details>`;
    if (X.no.length) h += `<details class="more"><summary>Good for you, unlikely to be accepted (${X.no.length})</summary>${X.no.slice(0, 10).map(dealRow).join('')}</details>`;
    return h; }
  // the rules behind every read, in plain words (the same thresholds the code uses)
  function howItWorks(lg, V) { const th = V.th; const pc = x => Math.round(x * 100); const PK = pickOf(lg);
    return `<div class="how"><p><b>Where the numbers come from.</b> Basketball Monster's rest-of-season projections (they already take in this season's games), its Analysis Monster team projections, and Yahoo's rosters, injury statuses and league settings. Nothing else, and no forecasts of the co-pilot's own.</p>
      <p><b>One measure, every page.</b> Your expected categories won a week over the rest of the season, through the end of your playoffs, against every other team in your league, on Basketball Monster's projections (games each player is expected to play, times his per-game stats). Punted categories count as a usual loss, whatever the move. Every decision is a change in that one number: Matchup, Lineup, Pickups, Trades and the cards on Yahoo's pages all read the same result, so they can't disagree. Changes are shown as categories over the rest of the season.</p>
      <ul><li><b>A player's value to you</b>: what the number loses without him. A player who holds up a category you win is worth a lot to you even if his overall rank is modest, because taking him out costs that category.</li>
      <li><b>A pickup</b> comes from Basketball Monster's Trade Monster, not this measure: "Find Free Agents" with each of your players as the drop, every 6 hours. The number is your projected Win% change × 99: category matchups won out of 99 a week over the rest of the season. Each free agent shows with the drop that leaves you best off (never a player in an injured-list spot, one you chose to keep, or one you added in the last two weeks). The Pickups page lists the top 30, with a guard, forward and centre filter.</li>
      <li><b>A trade</b> comes from Basketball Monster's Trade Monster, not this measure: "Find Trades" for each of your players once a day, and "Analyze Trade" for the deal you tick on Yahoo. Both teams' Win% change is shown as category matchups won out of 99 a week. A swap shows when you gain ${of99(bar99(lg))} or more; it's realistic when they lose no more than ${Math.abs(themMin(lg))} and Yahoo ranks the two players within ${rankGap(lg)} of each other.</li>
      <li><b>Multi-player deals</b> (Finder): once a day the co-pilot builds 2-for-1 to 3-for-3 deals for every team and asks Trade Monster's Analyze Trade to score them, counting the free agent that fills an open spot or the player you'd drop. It only asks about deals the other manager could take seriously: on Basketball Monster's values, their best lineup gets back at least ${Math.round(fairMin(lg) * 100)}% of what it loses. The number shown is always Trade Monster's.</li></ul>
      <p><b>Pickups</b> (${esc(PK.t)}). ${esc(PK.w)} <b>Best pickup</b> is the list's number 1 when it clears that bar. <b>Wait until Monday</b>: it clears the bar but the drop has more games left this week than the pickup in Matchup Monster, or you have no adds left. <b>In play this week</b>: the categories Matchup Monster gives you a 20 to 80% chance to win. Each free agent's row shows his games left this week and which of those he fills (Basketball Monster category value +0.5 or more). That is timing only: it never changes the order. Matchup Monster's own picks that aren't in your season list are added at the end as <b>This week only</b>. <b>Who to drop</b> (above the list): every player of yours, least missed first, each measured against the same free agents in Find Free Agents so the free agent cancels out. Over Yahoo's limit it starts with the steps to fix your roster. Protected players and recent adds are listed with the reason but never chosen for you. <b>Stream this week only</b> still comes from the week planner until the Matchup phase.</p>
      <p><b>Your build.</b> For each category, the co-pilot counts how many teams Basketball Monster projects you to beat from here. <i class="fd n"></i>Lost: under ${pc(th.dead)}% of teams. <i class="fd a"></i>Swing: up to ${pc(th.safe)}%. <i class="fd gr"></i>Winning: up to ${pc(th.locked)}%. <i class="fd g"></i>Locked: above that. Categories you punt always count as lost. The bands describe your team; the reads below come from the one measure.</p>
      <p><b>Reading your players.</b></p>
      <ul><li><i class="fd r"></i><b>${FIT.costs[1]}</b>: his best free agent in Basketball Monster's Find Free Agents (one Pickups offers) adds at least your pickup bar in his place, and no realistic trade does more. A drop candidate. Never an injured-list player, a keep, a recent add or a top-half player.</li>
      <li><i class="fd a"></i><b>${FIT.holds[1]}</b> / <b>${FIT.wasted[1]}</b>: a sell (above). Which of the two depends on whether his output sits mostly in categories you win or in ones you've lost.</li>
      <li><i class="fd g"></i><b>${FIT.anchor[1]}</b>: the remove-him test. Swap his Basketball Monster output for his best free agent's in your Analysis Monster totals and count the teams you'd beat again: if any category drops a band (won to contested, or contested to lost), he's holding it up. An anchor is never a sell; a keeper who is one shows it among his reasons, and any trade that drops a band shows a warning naming the category. A drop inside a band (locked to winning) doesn't count: that lead is the surplus you can trade from.</li>
      <li><i class="fd g"></i><b>${FIT.keep[1]}</b>: none of the above. Every player shows his best free agent's number next to your pickup bar, so you can see how close each one is. An anchor is only ever a keep or a sell, never a drop candidate.</li></ul>
      <p><b>Other teams' players</b> (Finder, trade block, Yahoo's trade page): Trade Monster's one-for-one with the player of yours it pairs him with.</p>
      <p><b>Your punt doesn't suit your best players</b> appears when two or more of your top four by Basketball Monster value are sells: the build may be wrong, not the players. Compare builds before selling.</p>
      <p><b>Analyst tags</b> (Sell High, Buy Low, Droppable…) are Basketball Monster's view of general fantasy value, not your build. They're shown in grey and never change a read.</p>
      <p><button class="lnk" data-openset="build">Change these in Settings</button></p></div>`; }
  // ---- the best available punt (agreed with the owner, 7.39.0): for each build (no punt, any one category, or two of your five
  // weakest categories), Basketball Monster's Analysis Monster team values summed over the categories kept, for every team; your
  // rank against the league on that sum. Best = highest rank, then fewer punts, then the widest margin. Not the one measure: on
  // the roster as it stands, punting can only lower expected categories won, so builds are compared on team strength instead. ----
  function bestBuilds(lg, M, V) { return memo('builds|' + lg, () => { const rows = (V.rows || []).filter(r => r.val && Object.keys(r.val).length); const me = rows.find(r => r.tid === M.L.me);
    if (!me || rows.length < 4) return null; const cats = V.cats; const others = rows.filter(r => r !== me);
    const sum = (r, P) => cats.reduce((a, c) => a + (P.includes(c) ? 0 : (+r.val[c] || 0)), 0);
    const rankOf = P => { P = P.slice().sort(); const mine = sum(me, P); const os = others.map(r => sum(r, P)).sort((a, b) => b - a); const rank = 1 + os.filter(x => x > mine).length;
      const above = os.filter(x => x > mine).pop(), below = os.find(x => x <= mine); return { P, rank, margin: rank === 1 ? mine - (os[0] == null ? mine : os[0]) : mine - above, mine, next: below }; };
    const share = c => others.filter(r => (+r.val[c] || 0) < (+me.val[c] || 0)).length / others.length; const weak = cats.slice().sort((a, b) => share(a) - share(b)).slice(0, 5);
    const cand = [[]].concat(cats.map(c => [c])); weak.forEach((a, i) => weak.slice(i + 1).forEach(b => cand.push([a, b])));
    const list = cand.map(rankOf).sort((a, b) => a.rank - b.rank || a.P.length - b.P.length || b.margin - a.margin);
    const cur = (M.ctx.punt || []).filter(c => cats.includes(c)); return { list, current: rankOf(cur), rankOf, n: rows.length }; }); }
  // your punt, changed from the Build page: every page re-reads with it, and the bands are set again from today's numbers for it
  function setPunt(lg, P, quiet) { const s = S(lg); const prev = (puntFor(lg) || []).slice(); s.punt = P.slice().sort(); saveS(lg); resetBands(lg); render();
    if (!quiet) toast(P.length ? 'Punting ' + andL(P.map(NN)) : 'No punt: playing every category', 'ok', { label: 'Undo', fn: () => setPunt(lg, prev, true) }); }
  function resetBands(lg) { const l = leaguesKnown().find(x => x.league === lg); const M = modelFor(lg); if (!l || !M || !window.STRAT) return; const win = window.STRAT.catWin(ST['bbmstand:' + l.lid], M.ctx.cats);
    const sk = 'strat:' + l.lid; const old = ST[sk]; if (!win && !old) return; ST[sk] = window.STRAT.snapshot(M, win || old.win, M.ctx.punt || []); browser.storage.local.set({ [sk]: ST[sk] }); DV++; }
  // teams fighting for (swing band) a category the player is good at
  // other teams' players at the block player's Basketball Monster rank or a little below (5 places above to 20 below) who are strong
  // in your needs; most needs met first, then those on a team that needs what he brings, then their category values in your needs
  function blockFits(r, league, need, wantTids) { const b = r.brank || 9999, lo = Math.max(1, b - 5), hi = b + 20;
    const list = league.filter(x => x.brank && x.brank >= lo && x.brank <= hi).map(x => Object.assign({}, x, { hit: goodAt(x.cv || {}, need), wants: wantTids.includes(x.own), sum: need.reduce((s, c) => s + Math.max(0, (x.cv || {})[c] || 0), 0) }))
      .filter(x => x.hit.length).sort((a, c) => c.hit.length - a.hit.length || c.wants - a.wants || c.sum - a.sum);
    return { lo, hi, list }; }
  function teamNeedsAll(lg, M, r) { return M.L.teams.filter(t => t.tid !== M.L.me).map(t => { const N = teamNeeds(lg, M, t.tid); if (!N) return null; const cats = N.need.filter(c => (r.cv[c] || 0) >= 0.5); return cats.length ? { tid: t.tid, cats } : null; }).filter(Boolean).sort((a, b) => b.cats.length - a.cats.length).slice(0, 4); }
  function wireStrategy(lg, M) { const o = $('out'); const s0 = S(lg);
    o.querySelectorAll('[data-stab]').forEach(b => b.onclick = () => { window.STAB = b.dataset.stab; render(); });
    // a link to another page's sub-page (Do next → Trade block, Build → Roster); data-blockadd also puts that player on the block
    const goSub = v => { const [pg, sb] = v.split(':'); window.STAB = sb; (window.STABS = window.STABS || {})[pg] = sb; ST.uiTab = pg; browser.storage.local.set({ uiTab: pg }); render(); window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); };
    o.querySelectorAll('[data-gostab]').forEach(b => b.onclick = () => { const id = b.dataset.blockadd; if (id && !(s0.block || []).includes(id)) { s0.block = (s0.block || []).concat([id]); saveS(lg); } goSub(b.dataset.gostab); });
    o.querySelectorAll('[data-findmoves]').forEach(b => b.onclick = () => { b.classList.add('busy'); b.innerHTML = '<span class="spinner" aria-hidden="true"></span>Reading your roster against Analysis Monster…'; setTimeout(() => goSub('trades:roster'), REDUCED ? 0 : 650); });
    o.querySelectorAll('[data-strev]').forEach(b => b.onclick = () => { const V = strategyState(lg, M); if (!V || !V.winNow) { b.textContent = 'Waiting for Basketball Monster…'; return; } const sk = 'strat:' + V.l.lid; ST[sk] = window.STRAT.snapshot(M, V.winNow, M.ctx.punt || []); browser.storage.local.set({ [sk]: ST[sk] }); DV++; render(); toast('Bands set from today\'s numbers', 'ok'); });
    o.querySelectorAll('[data-openset]').forEach(b => b.onclick = () => showSettings(true, b.dataset.openset));
    o.querySelectorAll('[data-setp]').forEach(b => b.onclick = () => { const c = b.dataset.setp; const cur = (puntFor(lg) || []).slice(); setPunt(lg, cur.includes(c) ? cur.filter(x => x !== c) : cur.concat([c])); });
    o.querySelectorAll('[data-usebuild]').forEach(b => b.onclick = () => { s0.tryPunt = []; saveS(lg); setPunt(lg, b.dataset.usebuild ? b.dataset.usebuild.split(',') : []); window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); });
    o.querySelectorAll('[data-tryset]').forEach(b => b.onclick = () => { s0.tryPunt = b.dataset.tryset ? b.dataset.tryset.split(',') : []; saveS(lg); render(); });
    o.querySelectorAll('[data-tryclear]').forEach(b => b.onclick = () => { s0.tryPunt = []; saveS(lg); render(); });
    o.querySelectorAll('[data-tryp]').forEach(b => b.onclick = () => { const c = b.dataset.tryp; const L = (s0.tryPunt || []).slice(); const i = L.indexOf(c); if (i >= 0) L.splice(i, 1); else L.push(c); s0.tryPunt = L; saveS(lg); render(); });
    o.querySelectorAll('[data-gotab]').forEach(b => b.onclick = () => { ST.uiTab = b.dataset.gotab; browser.storage.local.set({ uiTab: ST.uiTab }); render(); window.scrollTo(0, 0); });
    o.querySelectorAll('[data-fkind]').forEach(b => b.onclick = () => { s0.find = { kind: b.dataset.fkind }; saveS(lg); render(); });
    o.querySelectorAll('[data-block]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); const id = b.dataset.block; const L = (s0.block || []).slice(); const i = L.indexOf(id); if (i >= 0) L.splice(i, 1); else L.push(id); s0.block = L; saveS(lg); render(); const nm0 = M.P[id] ? M.P[id].n : 'Player'; toast(i >= 0 ? `${nm0} taken off the trade block` : `${nm0} is on the trade block`, i >= 0 ? '' : 'ok'); }); }
  // links that open a trade on Yahoo: in the Yahoo tab you're looking at (a new tab only if that isn't possible)
  function wireTrades(lg, M) { const o = $('out');
    o.querySelectorAll('[data-yurl]').forEach(b => b.onclick = e => { if (!browser.tabs || !browser.tabs.query) return; e.preventDefault(); browser.tabs.query({ active: true, currentWindow: true }).then(ts => { const t = ts && ts[0]; if (t && /fantasysports\.yahoo\.com/.test(t.url || '')) return browser.tabs.update(t.id, { url: b.dataset.yurl }); return browser.tabs.create({ url: b.dataset.yurl }); }).catch(() => window.open(b.dataset.yurl, '_blank')); }); }
  // a link that opens the player on Yahoo: the add page when his Yahoo id is known, Yahoo's player search otherwise
  function yLink(lg, name) { const l = leaguesKnown().find(x => x.league === lg); if (!l) return null; const M = modelFor(lg); const id = M && M.find(name);
    const yid = id ? Object.keys(ST.yidmap || {}).find(k => ST.yidmap[k] === id) : null; const tr = (ST['ytrend:' + l.lid] || {}).players || {}; const t = Object.entries(tr).find(([n]) => K(n) === K(name));
    const y2 = yid || (t && t[1].yid); return y2 ? `https://basketball.fantasysports.yahoo.com/nba/${l.lid}/addplayer?apid=${y2}` : `https://basketball.fantasysports.yahoo.com/nba/${l.lid}/players?status=A&pos=P&search=${encodeURIComponent(name)}`; }
  // step 1 of 2: the roster move comes before the lineup
  function stepOne(lg, pend) { return `<div class="step"><span class="sn">Step 1</span><div class="sb"><b>Make the pickup first</b>${pend.map(x => `<div class="sl">Add <b>${esc(x.add)}</b>${x.drop ? `, drop <b>${esc(x.drop.replace(/\.$/, ''))}</b>` : x.il ? ` (move ${esc(x.il)} to IL first)` : ''}</div>`).join('')}
      <div class="sub">The lineup below is for your roster as it is now. It's re-planned once Yahoo shows the change.</div>
      <div class="acts">${pend.map(x => { const u = yLink(lg, x.add); if (!availOf(yrFor(lg), x.add)) return `<span class="sub">Checking on Yahoo that ${esc(sur(x.add))} is still free…</span>`; return u ? `<a class="btn small" href="${esc(u)}" target="_blank" rel="noopener">Add ${esc(sur(x.add))} on Yahoo</a>` : ''; }).join('')}${pend.map(x => `<button class="lnk" data-skip="${esc(x.add)}">Skip ${esc(sur(x.add))}</button>`).join('')}</div></div></div>
      <div class="step two"><span class="sn">Step 2</span><div class="sb"><b>Then set the lineup</b></div></div>`; }
  // ---- a player back from injury still in an IL spot: Yahoo blocks every lineup change until he's moved off it. Says whether
  // Yahoo refuses every lineup change while a player who isn't eligible for an IL spot sits in one (Error #160)
  function ilBlocked(y) { if (!y || !y.rows || Date.now() - y.ts > 36 * 3600e3) return false; if (y.illegal) return true;
    const rc = rosterCheck(y); return !!rc && (rc.back.length > 0 || rc.need > 0); }
  // the card counts (8.5.0, owner's review 24 Nov): players against spots, from rosterCheck. In order: healthy players come off the
  // IL; injured players fill open IL spots; anyone still over the limit is dropped, cheapest to lose first on Basketball Monster's
  // Find Free Agents, injured or not (an IL player only when an injured player of yours can then take his spot) ----
  function ilBackCard(p, lg) { const y = yrFor(lg); if (!y || !y.rows || Date.now() - y.ts > 36 * 3600e3) return '';
    const rc = rosterCheck(y); if (!rc) return ''; const M = modelFor(lg); const same = (a, b) => NAMES.same(a, b);
    const st = r => String(r.inj || '').trim().toUpperCase(); const nm = r => esc(r.name); const and = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
    // the plan starts him: on an IL spot (allowed there) but no longer listed out, so using him means bringing him back
    const t = usToday(); const pdays = ((p && (p.nowDays || p.days)) || []).filter(d => d.open !== false && d.date >= t);
    const firstStart = n => { const d = pdays.find(d => (d.start || []).some(x => same(x.name, n))); return d ? d.date : null; };
    const ready = y.rows.filter(r => /^IL/.test(r.slot) && !rc.back.includes(r) && !/^(O|OUT|INJ|IL|NA|SUSP)$/.test(st(r)) && firstStart(r.name));
    const unexplained = rc.illegal && !rc.back.length && !rc.need;
    if (!rc.back.length && !rc.need && !ready.length && !unexplained) return '';
    const D = M ? dropOrder(lg, M) : []; const rowOf = d => y.rows.find(r => same(r.name, d.name)); const used = [];
    const movable = rc.movable.filter(r => !rc.fix.includes(r)); // injured players still waiting for an IL spot after the open ones are filled
    // the next drop: an active player, or an IL player when an injured player of yours can take his spot
    const nextDrop = () => { const d = D.find(x => !used.includes(x) && rowOf(x) && !x.held && (!x.il || movable.length)); if (d) used.push(d); return d || null; };
    const L = y.lid && y.tid ? `https://basketball.fantasysports.yahoo.com/nba/${y.lid}/${y.tid}` : null;
    const capTxt = rc.activeCap != null ? `${rc.activeCap} spots outside the injured list and ${rc.ilCap} on it` : `${rc.ilCap} injured-list spots`;
    let h = `<div class="card ilb"><div class="h"><span>${rc.drops ? 'Roster over the limit' : 'Back from injury'}</span></div>`;
    if (ilBlocked(y)) h += `<div class="vd bad">Yahoo is blocking lineup changes until this is fixed</div>`;
    const steps = [];
    rc.back.forEach(r => steps.push(st(r) ? `<b>Now:</b> <b>${nm(r)}</b> is only ${esc(injChip(st(r)))} now, which Yahoo doesn't allow in an injured-list spot: move him to the bench.` : `<b>Now:</b> <b>${nm(r)}</b> is healthy but still in an injured-list spot: move him to the bench.`));
    rc.fix.forEach(r => steps.push(`<b>Now:</b> move <b>${nm(r)}</b> (${esc(st(r) || 'injured')}) into an open injured-list spot.`));
    for (let i = 0; i < rc.drops; i++) { const d = nextDrop();
      if (!d) { steps.push(`<b>Now:</b> drop one more player: everyone left is protected (your keeps, recent adds or a top-half player), so choose on Yahoo.`); continue; }
      if (d.il) { const mv = movable.shift(); steps.push(`<b>Now:</b> drop <b>${esc(d.name)}</b> (injured list), then move <b>${nm(mv)}</b> (${esc(st(mv))}) into his injured-list spot.`); }
      else steps.push(`<b>Now:</b> drop <b>${esc(d.name)}</b>${st(rowOf(d)) ? ` (${esc(st(rowOf(d)))})` : ''}: the player your team would miss least (Basketball Monster's Find Free Agents, see Who to drop on Pickups).`); }
    // ready: brought back when the plan starts him, if he's worth more than the player who'd make room
    let open = rc.open; const spare = rc.moves.filter(r => !rc.fix.includes(r)); const dayOf = d => d === t ? 'Today' : fmtD(d); const costOf = n => { const x = D.find(d => same(d.name, n)); return x ? x.cost : null; };
    ready.forEach(r => { const lead = `<b>${esc(dayOf(firstStart(r.name)))}:</b> `;
      if (open > 0) { open--; steps.push(lead + `move <b>${nm(r)}</b> to the bench. You have an open roster spot.`); return; }
      if (spare.length) { const s = spare.shift(); movable.splice(movable.indexOf(s), 1); steps.push(lead + `move <b>${nm(s)}</b> into the injured-list spot and <b>${nm(r)}</b> to the bench. No drop needed.`); return; }
      const w = D.find(x => !used.includes(x) && !x.il && !x.held && rowOf(x)); const c = costOf(r.name);
      if (w && c != null && c <= w.cost) { steps.push(`Leave <b>${nm(r)}</b> on the injured list for now: he's cheaper to lose than <b>${esc(w.name)}</b>, the player you'd have to drop.`); return; }
      if (w) used.push(w); steps.push(lead + (w ? `drop <b>${esc(w.name)}</b> and move <b>${nm(r)}</b> to the bench (your roster has no spare spot).` : `drop a player and move <b>${nm(r)}</b> to the bench.`)); });
    const go = `${rc.drops > 1 ? rc.drops + ' players have' : 'one player has'} to go`;
    if (rc.drops && rc.total > rc.activeCap + rc.ilCap) h += `<div class="vd warn">You have ${rc.total} players and room for ${rc.activeCap + rc.ilCap} (${capTxt}), so ${go}</div>`;
    else if (rc.drops && rc.back.length) h += `<div class="vd warn">${and(rc.back.map(r => nm(r) + (st(r) ? ' (' + esc(injChip(st(r))) + ')' : '')))} can't stay on the injured list and your ${rc.activeCap} other spots are full, so ${go}</div>`;
    else if (rc.drops) h += `<div class="vd warn">You have ${rc.nActive + rc.back.length} players outside the injured list and room for ${rc.activeCap}, and nobody else can go on the injured list, so ${go}</div>`;
    else if (rc.need) h += `<div class="vd warn">You have ${rc.nActive + rc.back.length} players outside the injured list and room for ${rc.activeCap}: an open injured-list spot fixes it</div>`;
    else if (rc.back.length) h += `<div class="vd warn">${and(rc.back.map(nm))} ${rc.back.length > 1 ? 'are' : 'is'} healthy but still in an injured-list spot</div>`;
    else if (ready.length) h += `<div class="vd warn">${and(ready.map(nm))} ${ready.length > 1 ? 'are' : 'is'} on your injured list but the plan starts ${ready.length > 1 ? 'them' : 'him'}</div>`;
    if (unexplained) h += `<div class="sub hls">Yahoo says your roster is over the limit, but the counts the co-pilot read look fine (${rc.total} players; ${capTxt}). Your league may have just changed its roster spots: open your team on Yahoo to see which spot it means.</div>`;
    else h += `<div class="sub hls">${rc.drops ? `Yahoo won't accept a lineup change or a pickup until the roster fits. Drop only: an add-and-drop leaves you just as over.` : 'No one needs to be dropped.'}</div>`;
    if (steps.length) h += `<ol class="ilsteps">${steps.map(x => `<li>${x}</li>`).join('')}</ol>`;
    if (L) h += `<div class="acts"><a class="btn small" href="${esc(L)}" target="_blank" rel="noopener">Open your team on Yahoo</a></div>`;
    return h + `<div class="sub" style="margin-top:8px">Roster, statuses and injured-list spots from your Yahoo team page ${esc(ago(y.ts))}.</div></div>`; }
  function lineupCard(p, lg) { const MI = modelFor(lg); const y = yrFor(lg);
    // injury tag on a player's row: Yahoo's first (it's what decides who starts), else Basketball Monster's
    const injOf = n => injFor(y, MI, n);
    const lid = y && y.lid; const t = usToday(); const days = p.nowDays || p.days;
    // the "Set lineups" run in progress (or just finished): each day's marker follows it live
    const W8 = ST.yWeek && ST.yWeek.lid === lid && Date.now() - ST.yWeek.id < 6 * 3600e3 ? ST.yWeek : null; const busy = W8 && !W8.done && Date.now() - W8.id < 15 * 60e3;
    const resOf = date => W8 && Date.now() - W8.id < 30 * 60e3 ? (W8.results || []).find(r => r.date === date) || null : null;
    const due = p.nowDays ? p.moves.filter(x => x.date <= t) : [], later = p.nowDays ? p.moves.filter(x => x.date > t) : [];
    const open = days.filter(d => d.open && d.date >= t).map(d => d.date);
    if (lid && open.length) setTimeout(() => refreshLineups(lg, open, false), 50);
    if (y && Date.now() - (y.ts || 0) > 10 * 60e3) setTimeout(() => rosterNow(lg, 'older than 10 minutes'), 80);
    // default day: the date showing on your Yahoo team page, else today
    // the day shown is the one you tap (today to start with); it never follows the Yahoo screen by itself
    if (!selDay || !days.some(d => d.date === selDay)) selDay = (days.find(d => d.date >= t) || days[days.length - 1] || {}).date;
    const slots = p.slots.length;
    const chk = {}; days.forEach(d => { chk[d.date] = dayCheck(d, lid ? actualFor(lid, d.date) : null); });
    // a player Yahoo shows playing that the plan doesn't have is settled once he's where the free starting spots put him
    const extraOpen = (d, g) => { const free = Math.max(0, slots - d.start.length); return g.extra.filter((r, i) => i < free && (r.slot === 'BN' || /^IL/.test(r.slot))); }; // beyond the free spots he'd only start in place of a planned starter, which shows as a change anyway
    const stripF = () => days.map(d => { const c = chk[d.date]; const g0 = groups(d, c); const games = g0.playing;
      const rs = resOf(d.date); const running = busy && (W8.days || []).includes(d.date) && !rs; const todo = !c.known ? false : c.changes || extraOpen(d, g0).length;
      const st = !d.open ? 'past' : !games ? 'none' : running ? 'busy' : rs && !rs.ok && todo ? 'fail' : !c.known ? 'unk' : todo ? 'chg' : 'ok';
      const tip = { busy: 'Setting this day on Yahoo…', fail: 'Yahoo didn\'t take this day: ' + ((rs && rs.msg) || 'press Set again'), ok: 'Set on Yahoo and checked', chg: 'Needs changes on Yahoo', unk: 'Checking Yahoo…' }[st] || '';
      return `<button class="dchip ${st}${d.date === selDay ? ' sel' : ''}" data-day="${d.date}"${tip ? ` title="${esc(tip)}"` : ''}><span>${esc(fmtD(d.date).split(',')[0])}</span><b>${new Date(d.date + 'T12:00:00Z').getUTCDate()}</b><i title="${games} of your players play">${games}</i></button>`; }).join('');
    // every player on your Yahoo roster for a day, in one of five groups. Yahoo's own page for that date says who has a game;
    // anyone Yahoo shows playing that the plan doesn't know about is listed on his own, never hidden under "no game"
    const groups = (d, c) => { const act = lid ? actualFor(lid, d.date) : null; const yRows = (act && act.rows) || (y && y.rows) || [];
      const yInfo = !!(act && act.rows.some(r => r.hasGame)); const fy = n => NAMES.pick(yRows, n);
      const inPlan = n => d.start.concat(d.bench).some(x => NAMES.same(x.name, n));
      const extra = yInfo ? yRows.filter(r => !/^IL/.test(r.slot) && r.hasGame && !inPlan(r.name) && !/^(O|OUT|INJ|SUSP)$/i.test(r.inj || '')) : [];
      const il = yRows.filter(r => /^IL/.test(r.slot) && !inPlan(r.name)).map(r => r.name);
      const noGame = c.noGame.filter(n => !extra.some(r => r.name === n) && !il.includes(n));
      const yNo = n => { if (!yInfo) return false; const r = fy(n); return !!(r && !r.hasGame); };
      const known = n => (p.mineNames || []).some(x => NAMES.same(x, n)); extra.forEach(r => { r._known = known(r.name); });
      return { start: c.start, sit: c.sit, extra, out: c.out, noGame, il, yNo, playing: c.start.length + c.sit.length + extra.length }; };
    const d = days.find(x => x.date === selDay) || days[0]; const c = chk[d.date]; const act = lid ? actualFor(lid, d.date) : null; const G = groups(d, c);
    const games = G.playing; const crowded = games > slots;
    let h = `<div class="card lu"><div class="h"><span>Lineup</span><span class="sub">${act ? 'Checked against Yahoo ' + ago(act.ts) : 'Checking Yahoo…'}</span></div><div class="dstrip">${stripF()}</div><div class="sub dcap">Number under each date: how many of your players have a game.</div>`;
    h += `<div class="seg luv"><button data-luv="day" class="${luAll ? '' : 'on'}">One day</button><button data-luv="all" class="${luAll ? 'on' : ''}">Whole week</button></div>`;
    if (due.length) h += stepOne(lg, due);
    if (luAll) { h += days.filter(x => x.open).map(x => { const g = groups(x, chk[x.date]); if (!g.playing) return `<div class="wkday"><div class="wkh"><b>${esc(fmtD(x.date))}</b><span class="sub">no games</span></div></div>`;
        const nmS = z => esc(sur(z.name)); const must = g.playing - slots;
        return `<div class="wkday${x.date === selDay ? ' sel' : ''}"><div class="wkh"><b>${esc(fmtD(x.date))}</b><span class="sub">${g.playing} with games for ${slots} spots${must > 0 ? ` · <b class="minus">${must} must sit</b>` : ''}</span></div>
          <div class="wkl"><span class="lab st">Start</span><span>${g.start.map(z => `<span class="wn">${nmS(z)}</span>`).join('')}</span></div>
          ${g.sit.length ? `<div class="wkl"><span class="lab bn">Bench</span><span>${g.sit.map(z => `<span class="wn sitn">${nmS(z)}</span>`).join('')}</span></div>` : ''}
          ${g.extra.length ? `<div class="wkl"><span class="lab ck">Check</span><span>${g.extra.map(z => `<span class="wn chk" title="Yahoo shows a game the plan doesn't have: open this day for details">${nmS(z)}</span>`).join('')}</span></div>` : ''}
          ${g.out.length || g.noGame.length ? `<div class="wkl dim"><span class="lab">Not playing</span><span>${g.out.map(z => `<span class="wn">${nmS(z)}${z.noGameY ? '' : ' (out)'}</span>`).join('')}${g.noGame.map(n => `<span class="wn">${esc(sur(n))}</span>`).join('')}</span></div>` : ''}</div>`; }).join('');
    } else {
    h += `<div class="dayhead"><b>${esc(fmtD(d.date))}</b><span class="sub">${games} with games for ${slots} spots${crowded ? ` · <b class="minus">${games - slots} must sit</b>` : ''}</span></div>`;
    if (!d.open) h += `<div class="sub" style="margin:8px 0 2px">This day is done.</div>`;
    else if (!games) h += `<div class="sub" style="margin:8px 0 2px">Nobody on your roster plays.</div>`;
    else if (ilBlocked(y)) h += `<div class="vd bad">Yahoo is blocking lineup changes until your roster is legal (see Back from injury above)</div>`;
    else if (extraOpen(d, G).length) h += `<div class="vd warn">Check ${esc(extraOpen(d, G).map(x => sur(x.name)).join(', '))}: Yahoo shows a game the plan doesn't have</div>`;
    else h += c.known ? (c.changes ? `<div class="vd warn">${c.changes} change${c.changes > 1 ? 's' : ''} to make on Yahoo</div>` : `<div class="vd good">Lineup is set correctly</div>`) : `<div class="vd">Checking your Yahoo lineup…</div>`;
    const lat = later.filter(x => x.date <= d.date);
    if (lat.length && !due.length) h += `<div class="sub" style="margin:0 0 12px">${lat.map(x => `Pickup planned for ${esc(fmtD(x.date))}: <b>${esc(x.add)}</b>${x.drop ? ' for ' + esc(sur(x.drop)) : ''}.`).join(' ')} This day's lineup changes once you've made it.</div>`;
    if (d.open && games) {
      h += `<div class="label lbl2">Start <span>${d.start.length} of ${slots}</span></div>` + d.start.map(x => { const s0 = c.start.find(z => z.name === x.name) || {};
        return `<div class="lrow">${lnm(x.name, x.slot || '–', x.opp || '')}${G.yNo(x.name) ? '<span class="chip lost" title="Yahoo shows no game for him this day">Yahoo: no game</span>' : ''}${injOf(x.name) ? `<span class="chip ${/^(O|OUT|D)/i.test(injOf(x.name)) ? 'lost' : 'toss-up'}">${esc(injWord(injOf(x.name)).replace(/^a /, ''))}</span>` : ''}${s0.moveIn && /^IL/.test(s0.now || '') ? '<span class="chip chase" title="He is on your injured list: see Back from injury for who to drop first">Off the injured list: drop someone first</span>' : s0.moveIn ? '<span class="chip safe">Move in</span>' : s0.locked && s0.now && /^(BN|IL)/.test(s0.now) ? '<span class="chip">Locked on bench</span>' : !s0.onY && act ? '<span class="chip chase">After pickup</span>' : ''}</div>`; }).join('');
      if (c.sit.length) h += `<div class="label lbl2 bnl">Bench <span>has a game, sits</span></div>` + c.sit.map(x => `<div class="lrow sit">${lnm(x.name, 'BN', x.opp || '')}${x.protect ? `<span class="chip toss-up" title="Sitting him protects a close ${esc(x.protect)}">Sit: protects ${esc(x.protect)}</span>` : x.doubt ? `<span class="chip toss-up" title="Yahoo lists him as ${esc(injWord(x.doubt))}: he only starts when no healthy player can take the spot">${esc(x.doubt)}: sits while a healthy player can start</span>` : x.yahooOnly ? '<span class="chip" title="Yahoo shows a game; Basketball Monster has no projection for him yet">No projection: sits</span>' : ''}${x.moveOut ? '<span class="chip lost">Move to bench</span>' : x.locked && x.now && !/^(BN|IL)/.test(x.now) ? '<span class="chip">Locked in</span>' : !x.onY && act ? '<span class="chip chase">After pickup</span>' : ''}</div>`).join('')
      if (G.extra.length) { const free = slots - d.start.length; h += `<div class="label lbl2 chkl">Check <span>Yahoo shows a game the plan doesn't have</span></div>` + G.extra.map((r, i) => `<div class="lrow sit">${lnm(r.name, r.slot, (r.game || '').replace(/^\S+ \S+ /, ''))}${i < free ? '<span class="chip safe" title="A starting spot is empty this day">Spot free: start him</span>' : r._known ? '<span class="chip toss-up" title="Yahoo shows a game this day; Basketball Monster\'s schedule doesn\'t, so the plan left him out">Basketball Monster shows no game: your call</span>' : '<span class="chip toss-up" title="Yahoo shows a game, but Basketball Monster has no projection for him yet, so the plan can\'t weigh him">No projection: your call</span>'}</div>`).join(''); }
      if (G.out.length || G.noGame.length || G.il.length) h += `<div class="label lbl2">Not playing</div>` + G.out.map(x => `<div class="lrow dim">${lnm(x.name, 'BN', x.opp || '')}${x.gone ? '<span class="chip">Not on your roster</span>' : x.noGameY ? '<span class="chip">No game</span>' : `<span class="chip lost">${x.il ? 'Injured list' : x.injY ? 'Out on Yahoo (' + esc(x.injY) + ')' : 'Out'}</span>`}</div>`).join('')
        + G.noGame.map(n => `<div class="lrow dim">${lnm(n, 'BN', '')}<span class="chip">No game</span></div>`).join('')
        + G.il.map(n => `<div class="lrow dim">${lnm(n, 'IL', '')}</div>`).join('');
    }
    }
    // actions
    const pl = ST['plan:' + lg]; const wd = pl ? weekDays(pl) : []; const pend = days.filter(x => x.open && chk[x.date].known && chk[x.date].changes).length;
    if (busy) h += `<div class="setbar"><span class="sub">Setting lineups on Yahoo… ${W8.results.length} of ${(W8.days || []).length} days done${W8.tab ? ' (in a background Yahoo tab)' : ''}${W8.retry ? ' · second pass' : ''}</span></div>`;
    // what happened, day by day, for half an hour after a run
    if (W8 && W8.done && W8.results && W8.results.length && Date.now() - W8.id < 30 * 60e3) { const okN = W8.results.filter(r => r.ok).length, bad = W8.results.filter(r => !r.ok);
      h += `<div class="setres ${bad.length ? 'bad' : 'good'}"><b>${bad.length ? `${okN} of ${W8.results.length} days set on Yahoo` : `Done: all ${W8.results.length} days set on Yahoo and checked`}</b>${W8.results.map(r => `<div class="srr"><i class="${r.ok ? 'plus' : 'minus'}">${r.ok ? '✓' : '✗'}</i>${esc(fmtD(r.date))}<span class="sub">${r.ok ? (r.changes ? r.changes + ' change' + (r.changes > 1 ? 's' : '') : 'already right') : esc(r.msg || 'failed')}</span></div>`).join('')}</div>`; }
    if (!busy) { if (due.length) h += `<div class="setbar"><span class="sub">Make the pickup in step 1 first (or skip it), then set the lineups.</span></div>`;
      h += `<button class="btn ${pend ? '' : 'ghost'}" id="weekB" ${y && wd.length ? '' : 'disabled'}>${pend ? `Set lineups for the rest of the week (${pend} day${pend > 1 ? 's' : ''} need changes)` : 'Set lineups for the rest of the week'}</button>${wd.length ? `<div class="sub" style="text-align:center;margin-top:4px">${esc(fmtD(wd[0].date).split(',')[0])} ${new Date(wd[0].date + 'T12:00:00Z').getUTCDate()} to ${esc(fmtD(wd[wd.length - 1].date).split(',')[0])} ${new Date(wd[wd.length - 1].date + 'T12:00:00Z').getUTCDate()}: every day left in this matchup</div>` : ''}`;
      if (d.open && games && c.changes) h += `<button class="btn quiet" id="dayB">Only set ${esc(fmtD(d.date))}</button>`; }
    h += `<div class="msg" id="wbmsg">${W8 && W8.err ? esc(W8.err) : wbNote ? esc(wbNote) : ''}</div></div>`;
    return h;
  }
  function weekDays(pl) { const t = usToday(); const il = (pl.moves || []).filter(x => x.type === 'il'); return pl.days.filter(d => d.date >= t && (d.start.length || d.bench.length || il.length)).map(d => ({ date: d.date, start: d.start, bench: d.bench, il: il.filter(x => x.date <= d.date).map(x => x.il) })); }
  // lineups for the rest of the week: through the Yahoo API when connected (no tab needed), else through an open Yahoo tab
  async function sendWeek(y, pl, onlyDate, retry) {
    // exactly the lineup the panel shows for each day (resolveDay already settled injuries, games and free spots against Yahoo):
    // what's sent is what's checked afterwards, so a day that took turns green
    const days = weekDays(pl).filter(d => !onlyDate || (Array.isArray(onlyDate) ? onlyDate.includes(d.date) : d.date === onlyDate));
    if (!days.length) { wbNote = 'Nothing left to set this week: every remaining day is already played or has no games.'; render(); return; } wbNote = ''; const id = Date.now();
    const W = { id, lid: y.lid, lg: pl.league, done: false, days: days.map(d => d.date), results: [], retry: !!retry };
    await browser.storage.local.set({ yWeek: W, yCmd: { cmd: 'week', lid: y.lid, tid: y.tid, days, ts: id } });
    bgRun(y.lid, y.tid, id);
  }
  // lineups are saved by a Yahoo page (Yahoo only accepts them from its own site). If no Yahoo page picks the job up within
  // 2.5 s, the co-pilot opens your team page in a background tab, lets it do the job, and closes it afterwards
  function bgRun(lid, tid, id) {
    setTimeout(async () => { const c0 = (await browser.storage.local.get('yCmd')).yCmd; if (!c0 || c0.ts !== id || c0.done) return;
      let tab = null; try { tab = await browser.tabs.create({ url: `https://basketball.fantasysports.yahoo.com/nba/${lid}/${tid}/team`, active: false }); } catch (e) {}
      if (tab) { const w = (await browser.storage.local.get('yWeek')).yWeek; if (w && w.id === id) await browser.storage.local.set({ yWeek: Object.assign({}, w, { tab: tab.id }) }); }
      const t0 = Date.now(); const iv = setInterval(async () => { const w = (await browser.storage.local.get('yWeek')).yWeek; const c1 = (await browser.storage.local.get('yCmd')).yCmd;
        const finished = w && w.id === id && w.done; const stuck = Date.now() - t0 > (c1 && c1.done ? 4 * 60e3 : 25e3);
        if (finished || stuck) { clearInterval(iv); if (tab) { try { await browser.tabs.remove(tab.id); } catch (e) {} }
          if (!finished && w && w.id === id) await browser.storage.local.set({ yWeek: Object.assign({}, w, { done: true, err: c1 && c1.done ? 'Yahoo stopped responding part-way. Press again to finish the remaining days.' : 'Couldn\'t reach your Yahoo team page (are you signed in to Yahoo?). Open your team page on Yahoo, then press again.' }) }); } }, 1000); }, 2500);
  }
  // a run that stops part-way (you moved to another Yahoo page, or the page reloaded) is picked up again after 20 seconds of
  // silence: the days already set are kept and the rest of the matchup is finished, up to three times
  async function resumeWeek() { const o = await browser.storage.local.get(['yWeek', 'yCmd']); const w = o.yWeek, c = o.yCmd;
    if (!w || w.done || !c || c.cmd !== 'week' || c.ts !== w.id || Date.now() - w.id > 15 * 60e3) return; if (Date.now() - (w.beat || w.id) < 20e3) return;
    if ((w.resumes || 0) >= 3) { await browser.storage.local.set({ yWeek: Object.assign({}, w, { done: true, err: 'Yahoo kept stopping part-way. Press again to finish the remaining days.' }) }); return; }
    await browser.storage.local.set({ yWeek: Object.assign({}, w, { beat: Date.now(), resumes: (w.resumes || 0) + 1 }), yCmd: Object.assign({}, c, { done: false, rs: Date.now() }) });
    bgRun(c.lid, c.tid, c.ts); }
  setInterval(() => { resumeWeek().catch(() => {}); }, 8e3);
  // after a run: re-read every day from Yahoo, and if a planned starter still isn't in a starting spot, run those days once more
  const afterDone = {};
  async function afterWeek(W) { if (!W || afterDone[W.id]) return; afterDone[W.id] = true; const lg = W.lg || (leaguesKnown().find(l => l.lid === W.lid) || {}).league; if (!lg) return;
    try { await refreshLineups(lg, W.days || [], true); } catch (e) {} DV++; render();
    const pl = ST['plan:' + lg], y = yrFor(lg); if (!pl || !y || W.retry) return; const isS = r => r.slot !== 'BN' && !/^IL/.test(r.slot);
    const left = (W.days || []).filter(date => { const pd = pl.days.find(x => x.date === date), a = actualFor(y.lid, date); if (!pd || !a) return false;
      const f = n => NAMES.pick(a.rows, n); return pd.start.some(n => { const r = f(n); return r && !r.locked && r.hasGame && !isS(r); }); });
    if (left.length) sendWeek(y, pl, left, true); }
  // ---------- sync ----------
  let syncing = false; const planFrom = {}, planNow = {};
  function syncTick() { const sb = $('syncNow'); if (!sb) return; sb.dataset.tick = 1; sb.classList.remove('busy', 'err'); sb.classList.add('done');
    clearTimeout(window.__tickT); window.__tickT = setTimeout(() => { delete sb.dataset.tick; sb.classList.remove('done'); syncBar(); }, 1600); }
  function syncBar() {
    const lg = league(); const y = leaguesKnown().find(l => l.league === lg); const st = y && ST['sync:' + y.lid]; const lk = ST.syncLock && Date.now() - ST.syncLock.ts < 4 * 60e3;
    const pr = ST.syncProgress && Date.now() - ST.syncProgress.ts < 3 * 60e3 ? ST.syncProgress.msg : '';
    const good = y ? (lastGood(y.lid) || (st && st.ok ? st.ts : 0)) : 0;
    // one status line: what's happening, or the most important thing that's late (amber: it fixes itself; details in Settings)
    const H = healthNow[lg] || { iss: [] }; const top = H.iss.find(i => i[0] === 'bad') || H.iss.find(i => i[0] === 'warn') || H.iss[0];
    const left = syncing || lk ? `<span>${esc(pr ? 'Syncing ' + pr + '…' : 'Syncing…')}</span>` : top ? `<button class="stl" id="healthB" title="${esc(H.iss.map(i => i[1]).join('\n'))}"><i class="dot ${top[0] === 'bad' ? 'd-warn' : ''}"></i>${esc(top[1])}${H.iss.length > 1 ? ` <span class="muted">+${H.iss.length - 1}</span>` : ''}</button>` : `<span>${good ? 'Updated ' + ago(good) : 'Not synced yet'}</span>`;
    $('syncbar').innerHTML = left;
    // the sync button sits in the top bar: just the arrows (spinning while a sync runs), a green tick for a moment when one finishes
    // (8.2.0) arrows round a basketball: orange and spinning while a sync runs, red after a failed sync, green otherwise
    const sb = $('syncNow'); const run = !!(syncing || lk), err = !run && !!(st && st.err); sb.classList.toggle('busy', run); sb.classList.toggle('err', err); sb.disabled = syncing; if (!sb.innerHTML) sb.innerHTML = ICON.sync;
    sb.title = run ? 'Syncing…' : err ? 'The last sync failed: tap to sync again' : 'Synced: tap to sync now'; sb.setAttribute('aria-label', sb.title);
    { const hb = $('healthB'); if (hb) hb.onclick = () => showSettings(true, 'diag'); }
    sb.onclick = () => runSync(true);
  }
  // syncs run in the background only (never two at once); the panel asks for one and follows its progress
  async function runSync(force, now) {
    if (syncing) return; syncing = !!force; if (force) syncBar();
    let asked = false; try { const r = await browser.runtime.sendMessage({ target: 'bg', cmd: force ? 'syncNow' : 'syncDue', now: !!now }); asked = !!(r && r.ok); } catch (e) {}
    if (!asked && window.SYNC) { syncing = true; syncBar(); try { await window.SYNC.auto(force, m => { ST.syncProgress = { msg: m, ts: Date.now() }; syncBar(); }, { by: 'panel', lightMin: 15, now: !!now }); } catch (e) { console.error(e); } }
    else if (force) { const t0 = Date.now(); await new Promise(z => { const iv = setInterval(() => { const lk = ST.syncLock && Date.now() - ST.syncLock.ts < 4 * 60e3; if ((!lk && Date.now() - t0 > 4000) || Date.now() - t0 > 8 * 60e3) { clearInterval(iv); z(); } }, 1000); }); }
    syncing = false; ST = await browser.storage.local.get(null); DV++; render(); if (force) { toast('Synced with Yahoo and Basketball Monster', 'ok'); syncTick(); }
  }
  function render() {
    const ls = leaguesKnown(); const lg = league();
    const yoL = yahooOn(); // the other league gets a dot when it's the one on your Yahoo screen (the panel doesn't switch by itself)
    $('lgTabs').innerHTML = ls.map(l => `<button data-lg="${esc(l.league)}" class="${l.league === lg ? 'on' : ''}" title="${esc(l.league)}${yoL && yoL.league === l.league && l.league !== lg ? ' · on Yahoo now' : ''}"><span>${esc(l.league)}</span>${yoL && yoL.league === l.league && l.league !== lg ? '<i class="ldot"></i>' : ''}</button>`).join('');
    $('lgTabs').querySelectorAll('[data-lg]').forEach(b => b.onclick = () => { ST.activeLeague = b.dataset.lg; browser.storage.local.set({ activeLeague: b.dataset.lg }); render(); });
    syncBar();
    // no leagues yet: the background finds them on Yahoo by itself (your teams are in Yahoo's top bar); only a Yahoo sign-in needs you
    if (!ls.length) { const found = Object.keys(ST.ymine || {}).length; const busy = syncing || (ST.syncLock && Date.now() - ST.syncLock.ts < 4 * 60e3);
      paint($('out'), authHtml() + `<div class="card"><b>${found || busy ? 'Setting up your leagues…' : 'Finding your Yahoo leagues…'}</b><div class="sub" style="margin-top:8px">${found ? 'Found ' + found + (found === 1 ? ' league' : ' leagues') + ' on Yahoo. The first sync downloads a lot from Basketball Monster and takes a couple of minutes.' : 'This happens by itself. If it takes more than a minute, open any Yahoo Fantasy page in a tab and it picks your leagues up from there.'}</div></div>${setPane('', `<div class="card sets">${bbmAuthHtml()}</div>`)}`); wireConn();
      if (!busy && Date.now() - (window.__findTs || 0) > 60e3) { window.__findTs = Date.now(); runSync(true); } return; }
    try { renderB(); } catch (e) { $('out').innerHTML = '<div class="card">Something went wrong: ' + esc(e.message) + '</div>'; console.error(e); }
  }
  $('toDraft').onclick = () => { location.href = 'home.html'; };
  $('setBtn').onclick = () => { if (!$('setPane')) { setOpen = true; render(); showSettings(true); return; } showSettings(!setOpen); };
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#setClose')) showSettings(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && setOpen) showSettings(false); });
  // trade finder buttons can live in any card (including the live page card)
  // player list: tap a row to show or hide its category pills
  $('out').addEventListener('click', e => { const r = e.target.closest && e.target.closest('tr[data-plr]'); if (!r) return; const id = r.dataset.plr; const S = globalThis.__plOpen || (globalThis.__plOpen = new Set());
    const d = r.parentElement.querySelector('tr[data-pld="' + CSS.escape(id) + '"]'); const on = !S.has(id); if (on) S.add(id); else S.delete(id);
    r.classList.toggle('open', on); const c = r.querySelector('.caret'); if (c) c.textContent = on ? '▾' : '▸'; if (d) d.hidden = !on; });
  // opening never starts a sync: the background keeps everything current (bg.js), so the page shows the last copy straight away
  browser.storage.local.get(null).then(all => { ST = all; DV++; render(); if (leaguesKnown().some(l => !ST['bbmfa:' + l.lid])) runSync(false, true); });
  setInterval(() => runSync(false), 5 * 60e3);
  setInterval(() => { if (window.__pendR && !(ST.syncLock && Date.now() - ST.syncLock.ts < 4 * 60e3)) { window.__pendR = false; render(); } }, 20e3);
  // the panel also checks injury news while it's open (the background does it when it's closed)
  if (browser.notifications && browser.notifications.create) window.NOTIFY = (id, title, message) => browser.notifications.create(id, { type: 'basic', iconUrl: 'icons/icon-128.png', title, message });
  setInterval(() => { if (window.SYNC && window.SYNC.newsCheck) window.SYNC.newsCheck().catch(() => {}); }, 15 * 60e3);
  browser.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return; let re = false;
    // you've just left a Yahoo add/drop page (a pickup made or cancelled): read your roster now, so the plan and the day markers follow
    if (ch.ypage) { const a = ch.ypage.newValue, b = ch.ypage.oldValue; if (b && b.kind === 'add' && (!a || a.url !== b.url)) { const l = leaguesKnown().find(x => String(x.lid) === String(b.lid)); if (l) setTimeout(() => rosterNow(l.league, 'after add/drop'), 1500); } }
    if (ch.ydate && ch.ydate.newValue) { ST.ydate = ch.ydate.newValue; if (Object.keys(ch).length === 1) { render(); return; } }
    let data = false;
    Object.entries(ch).forEach(([k, v]) => { ST[k] = v.newValue; if (!/^(trseen:|ydate|syncProgress|syncLock|yWeek|yCmd|yLock|plan:|selfcheck:|nextDue|diag|selftest|bxTrace:|bbmnewsTrace|keepTs|tidyTs)/.test(k)) { DV++; data = true; }
      if (k === 'yWeek') { re = true; const w = v.newValue; if (w && w.done && !(v.oldValue && v.oldValue.done && v.oldValue.id === w.id)) setTimeout(() => afterWeek(w), 300); } if (k === 'syncLock' || k === 'syncProgress') syncBar(); if (k === 'syncLock' && v.oldValue && !v.newValue && !syncing) syncTick(); if (k === 'health' || k === 'bbmAuth') re = true; if (/^(ymine$|leagueList$|mm:|mmw:|yr:|mmLast|tx:|ysetp:|bbmnews$|ylu:|ylive:|ystand:|lgweek:|ysched:|ytrend:|ytrendMy:|bbmstand:|bbmtm2?:|yavail:|alerts$|bx:|sset:|ypage$)/.test(k)) re = true; });
    // while the background sync is writing, the panel waits and redraws once when it finishes (not after every write)
    const bgSync = syncing || (ST.syncLock && Date.now() - ST.syncLock.ts < 4 * 60e3); const urgent = Object.keys(ch).some(k => /^(yWeek|health|ypage|yavail:|ylu:|sset:|bbmAuth)/.test(k));
    if (data && bgSync && !urgent) { if (Date.now() - (window.__lastR || 0) > 20e3) window.__lastR = Date.now(); else { window.__pendR = true; re = false; } }
    if (('syncLock' in ch || 'syncProgress' in ch) && !ST.syncLock && !syncing && window.__pendR) { window.__pendR = false; re = true; }
    Object.entries(ch).forEach(([k, v]) => { const y = v.newValue; if (!k.startsWith('yr:') || !y || !y.date || y.src !== 'page') return; const key = 'ylu:' + y.lid; const cur = Object.assign({}, ST[key] || {}); cur[y.date] = { ts: Date.now(), rows: y.rows.map(luRow), empty: y.empty || [] }; ST[key] = cur; browser.storage.local.set({ [key]: cur }); });
    // a roster change seen on a Yahoo page (e.g. a pickup) re-syncs straight away
    Object.entries(ch).forEach(([k, v]) => { if (!k.startsWith('yr:') || !v.newValue || v.newValue.src !== 'page') return; const a = (v.oldValue && v.oldValue.rows || []).map(r => r.name).sort().join('|'), b = v.newValue.rows.map(r => r.name).sort().join('|'); if (a && a !== b) { clearTimeout(window.__rs); window.__rs = setTimeout(() => runSync(true), 4000); } });
    // never redraw under you while you're typing in a box (e.g. a password); wait until you're done
    const typing = () => { const a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && $('out').contains(a); };
    if (re) { clearTimeout(window.__rr); const tryR = () => { if (typing()) { window.__rr = setTimeout(tryR, 1500); return; } render(); }; window.__rr = setTimeout(tryR, 150); }
    else if (ch.ypage || Object.keys(ch).some(k => k.startsWith('bx:'))) { clearTimeout(window.__rc); window.__rc = setTimeout(() => { const a = ch.ypage && ch.ypage.newValue, b = ch.ypage && ch.ypage.oldValue; if (a && (!b || a.lid !== b.lid || a.kind !== b.kind || a.url !== b.url)) render(); else updateCtx(); }, 120); }
  });
})();
