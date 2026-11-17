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
    const th = Object.assign({ dead: 0.15, safe: 0.75 }, (S(m.league) || {}).th || {});
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
      const kind = lockedIn ? 'locked' : (a.x.zero || noGame || HARD_OUT.test(st) || lockedOut || ilY) ? 'out' : a.x.protect ? 'protect' : DOUBTFUL.test(st) ? 'doubt' : 'ok';
      const el = r && r.elig && r.elig.length ? r.elig.filter(e => isStartSlot(e)) : null;
      return Object.assign(a, { r, st, noGame, gone, ilY, kind, name: a.x.name, elig: lockedIn ? (s => s === r.slot) : el ? (s => el.includes(s)) : (s => s === a.x.slot || s === 'Util') }); });
    const byVal = (u, v) => (u.was === 'extra') - (v.was === 'extra') || val(v.name) - val(u.name);
    const cands = info.filter(i => i.kind === 'locked')
      .concat(info.filter(i => i.kind === 'ok' && i.was === 'start'))
      .concat(info.filter(i => i.kind === 'ok' && i.was !== 'start').sort(byVal))
      .concat(info.filter(i => i.kind === 'doubt').sort((u, v) => (v.was === 'start') - (u.was === 'start') || byVal(u, v)));
    const { chosen, slotOf } = fitStarters(slots, cands); const inS = new Set(chosen.map(i => i.name));
    const before = new Set(d.start.map(x => K(x.name)));
    d.start = chosen.map(i => Object.assign({}, i.x, { slot: slotOf[i.name] }));
    d.bench = info.filter(i => !inS.has(i.name)).map(i => Object.assign({}, i.x, i.kind === 'out' ? { zero: true, injY: HARD_OUT.test(i.st) ? i.st : null, gone: i.gone, noGameY: (i.noGame && !i.gone) || i.x.noGameY || false, il: i.x.il || i.ilY, lockedOut: !!(i.r && i.r.locked) } : i.kind === 'doubt' ? { doubt: i.st } : {}));
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
    const ilUsed = y ? y.rows.filter(r => /^IL/.test(r.slot)).length : 0; const ilEligible = y ? y.rows.filter(r => /^(O|INJ|IL|NA|OUT|SUSP)$/i.test(r.inj || '') && !/^IL/.test(r.slot)).map(r => r.name) : [];
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
      h += `<div style="margin-top:8px"><b>Projection scorecard</b><div class="sub">${ps.weeks} week${ps.weeks === 1 ? '' : 's'}: typical miss per game (lower is better), Basketball Monster / Yahoo / the average of both.</div><div class="sub">${C.map(c => `${NM(c)} ${f('bbm', c)} / ${f('yh', c)} / <b>${f('blend', c)}</b>`).join(' · ')}</div><div class="sub">The average is ${ps.blendWins >= Math.ceil(ps.cats * 2 / 3) ? 'clearly' : 'not clearly'} better in ${ps.blendWins} of ${ps.cats} categories.${ps.weeks < 4 ? ' The decision waits for four weeks: switch only if the average is clearly better in two thirds of categories.' : ''}</div></div>`; }
    else h += `<div style="margin-top:8px"><b>Projection scorecard</b><div class="sub">Builds from next week: Basketball Monster's and Yahoo's projections are saved before each Monday and scored against what players did.</div></div>`;
    return h; }
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
  const ctxRefreshing = {};
  function ypageNow() { const yp = ST.ypage; return yp && Date.now() - yp.ts < 30 * 60e3 && ['trade', 'add', 'players'].includes(yp.kind) && leaguesKnown().some(l => l.lid === yp.lid) ? yp : null; }
  // the model also carries what the trade tools need: regular-season weeks left, the bar a deal must clear, Trade Monster's results
  function modelFor(lg) { return memo('model|' + lg, () => { const M = modelForRaw(lg); if (!M) return M; const l = leaguesKnown().find(x => x.league === lg), y = yrFor(lg);
    const sp = (l && ST['ysetp:' + l.lid]) || {}; const po = (sp.poWeeks || [])[0] || null; const cw = l && window.CTX.curWeek(ST, l.lid, y);
    M.weeksLeft = cw && po ? Math.max(1, po - cw) : null; M.tm = l ? ST['bbmtm:' + l.lid] || null : null; M.finish = null; M.needs = tid => teamNeeds(lg, M, tid); return M; }); }
  function modelForRaw(lg) { const l = leaguesKnown().find(x => x.league === lg); if (!l || !window.CTX) return null; const y = yrFor(lg); const m = mm(); const same = m && m.league === lg;
    try { return window.CTX.model(ST, l.lid, { punt: puntFor(lg), yr: y, obj: scoringOf(lg).mode, today: usToday(), rules: rulesFor(lg, y), cats: same ? m.cats.filter(c => E.LBL[c]) : null, weekEnd: same ? m.end : null }); } catch (e) { console.error(e); return null; } }
  // ---- the one measure (every page reads it): expected categories won a week over the rest of the season, against every other
  // team in your league, from Basketball Monster's rest-of-season projections. A player's value to you is what that number loses
  // without him; a pickup is what it gains when he replaces one of your players; a trade is what it gains after the swap. ----
  function boardKeep(lg, M) { const y = yrFor(lg); const s = S(lg); const rm = recentMoves(y, ST['hist:' + lg] || { log: [] }); const ids = ns => (ns || []).map(n => M.find(n)).filter(Boolean);
    // a player in the top half of everyone rostered in the league is never a drop: another team would claim him, so he's traded instead
    const N = M.L.teams.reduce((a, t) => a + t.ids.length, 0); const all = Object.values(M.P).filter(q => q.ros && q.ros.lv != null && (q.ros.g || 0) > 0).sort((a, b) => b.ros.lv - a.ros.lv); const top = new Set(all.slice(0, Math.round(N / 2)).map(q => q.id));
    const mine = (M.L.teams.find(t => t.tid === M.L.me) || { ids: [] }).ids; const claim = mine.filter(id => top.has(id));
    return { keep: new Set([...(M.ilIds || [])].concat(ids(s.protect), ids(rm.adds), claim)), claim: new Set(claim), block: new Set(ids(rm.drops)), taken: takenSet(y) }; }
  // empty roster spots outside the injured list: Yahoo's roster size (starting spots + bench) less the players not on the injured
  // list; else the empty non-injured-list spots Yahoo's team page shows. A pickup into one needs no drop.
  function openSpots(lg) { const y = yrFor(lg); if (!y || !y.rows || !y.rows.length) return 0; const sp = ST['ysetp:' + y.lid] || {};
    const nonIL = y.rows.filter(r => !/^IL/.test(r.slot || '')).length;
    if (sp.slots && sp.slots.length && sp.bench != null) return Math.max(0, sp.slots.length + sp.bench - nonIL);
    return (y.empty || []).filter(x => !/^IL/.test(x)).length; }
  function boardFor(lg, punt) { const M = modelFor(lg); if (!M || !window.H2H || !window.H2H.board) return null; const k = boardKeep(lg, M);
    const fas = M.L.fas.filter(id => !k.block.has(id) && !k.taken.has(K(M.P[id].n)));
    const pu = punt === undefined ? M.ctx.punt : (punt && punt.length ? punt : null); const open = openSpots(lg);
    const sig = [...k.keep].sort().join(',') + '|' + fas.join(',').length + '|' + fas.length + '|' + (pu || []).join(',') + '|' + open;
    return memo('board|' + lg + '|' + sig, () => { const was = M.ctx.punt; M.ctx.punt = pu; try { const b = window.H2H.board(M.ctx, M.L, { keepIds: k.keep, fas, n: 30, open }); if (b) { b.keep = k.keep; b.claim = k.claim; b.punt = pu; } return b; } catch (e) { console.error(e); return null; } finally { M.ctx.punt = was; } }); }
  const seasonBar = lg => (PICK[S(lg).pick] || PICK.std).season; // a pickup's minimum, in categories over the rest of the season
  const tradeBarOf = (lg, M) => S(lg).tradeBar != null ? +S(lg).tradeBar : M.ctx.cats.length >= 11 ? 2 : 1.5; // a trade's, likewise: twice a standard pickup's
  // the decision on the list's number 1 (and the tags every page shows): add now, wait until Monday, or nothing worth an add
  function boardPick(lg, A) { const B = boardFor(lg); const M = modelFor(lg); if (!B || !M || !B.list.length) return null; const y = yrFor(lg); const s = S(lg);
    { const nx = ynextOf(y); M.L.oppNext = nx && nx.oppTid ? String(nx.oppTid) : null; }
    const bar = seasonBar(lg); const pk = Array.isArray(s.pickAdds) ? null : (s.pickAdds || {})[0]; let chosen = pk ? B.list.find(x => K(M.P[x.id].n) === K(pk)) : null;
    const fd = chosen && (s.forceDrop || {})[K(M.P[chosen.id].n)]; let drop = chosen ? chosen.drop : null; if (fd) { const d = B.order.find(o => K(M.P[o.id].n) === fd); if (d) drop = d.id; }
    const top = chosen || B.list[0]; drop = drop || top.drop; const g = chosen ? B.swap(top.id, drop).g : top.gain; const season = g * B.weeks;
    const tm = window.H2H.timing(M.ctx, M.L, top.id, drop) || {}; const adds = A ? A.left : 1;
    const worth = !!chosen || season >= bar; const wait = worth && (!adds || (tm.week != null && tm.week < -0.15));
    return { id: top.id, drop: drop || null, add: M.P[top.id].n, dropName: drop ? M.P[drop].n : null, open: !drop, season, week: tm.week, next: tm.next, worth, wait, why: !adds ? 'adds' : wait ? 'week' : null, chosen: !!chosen, bar }; }
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
      pick: { add: pk.add, drop: pk.dropName, gain: r4(pk.season / B.weeks), worth: pk.worth, wait: pk.wait, chosen: pk.chosen },
      list: B.list.slice(0, 10).map(x => ({ add: n(x.id), drop: n(x.drop), gain: r4(x.gain) })), bbm: alt(bbmTop), hot: alt(hotId), roster: B.mine.map(x => n(x.id)) };
    ST[k] = { v: 1, log: old.log.concat([e]).slice(-500) }; browser.storage.local.set({ [k]: ST[k] }); }
  // ---- player reads on the same measure. Yours: what he's worth to you, whether a free agent does more (he's a drop), and whether
  // a one-for-one trade at his Basketball Monster value adds a clear margin (he's a sell). Other teams' players: what each would
  // add to you in place of your least valuable player. A player who holds up a category (taking him out loses it) is never a sell. ----
  function readsFor(lg, punt) { const M = modelFor(lg); const B = boardFor(lg, punt); if (!M || !B) return null;
    return memo('reads|' + lg + '|' + (B.punt || []).join(','), () => {
      const bar = tradeBarOf(lg, M) / B.weeks, pbar = seasonBar(lg) / B.weeks; const own = {}; M.L.teams.forEach(t => t.ids.forEach(id => own[id] = t.tid));
      const lvOf = id => ((M.P[id] || {}).ros || {}).lv || 0; const others = Object.keys(own).filter(id => own[id] !== M.L.me && M.P[id] && M.P[id].ros && (M.P[id].ros.g || 0) > 0);
      const fasTop = B.list.slice(0, 10).map(x => x.id);
      // the bottom third of your roster by value to you is "small impact" (unless a free agent or a trade beats him)
      const asc = B.mine.map(x => x.val).sort((a, b) => a - b); const low = asc[Math.max(0, Math.floor(asc.length / 3) - 1)];
      const by = {}; B.mine.forEach(x => { const il = M.ilIds.has(x.id); const lv = lvOf(x.id); let fa = null;
        if (!x.keep) fasTop.forEach(f => { const r = B.swap(f, x.id); if (!fa || r.g > fa.g) fa = { id: f, g: r.g }; });
        const trades = il ? [] : others.filter(j => lvOf(j) <= lv + 0.03 && lvOf(j) >= lv - 0.1).map(j => { const r = B.swap(j, x.id); return { id: j, g: r.g, cats: r.cats, own: own[j] }; }).sort((a, b) => b.g - a.g);
        const sell = trades.filter(t => t.g >= bar);
        by[x.id] = { val: x.val, cats: x.cats, fa, trades, sell, il, kind: fa && fa.g >= pbar ? 'costs' : sell.length ? 'sell' : x.val > low ? 'fits' : 'small' }; });
      const d0 = B.order[0]; const league = {}; others.forEach(j => { const r = d0 ? B.swap(j, d0.id) : null; if (r) league[j] = { g: r.g, cats: r.cats, kind: r.g >= pbar ? 'fits' : r.g < 0 ? 'nohelp' : 'small' }; });
      return { by, league, bar, pbar, weeks: B.weeks, B, d0: d0 ? d0.id : null }; }); }
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
    healthNow[lg] = { iss, good }; // shown in the one status line at the top (see syncBar); nothing here needs you to act
    syncBar(); return updHtml() + authHtml(); // sign-in prompts are the only status that sits in the page: they need you
  }
  const healthNow = {};
  // a newer signed version than the one running: Firefox installs it by itself; until it has, one tap here installs it
  const vnum = v => String(v || '0').split('.').map(Number).reduce((a, x) => a * 1000 + (x || 0), 0);
  const updHtml = () => { const u = ST.updAvail; const cur = browser.runtime.getManifest().version; return u && u.version && vnum(u.version) > vnum(cur) && u.link ? `<a class="updbar" href="${esc(u.link)}" target="_blank" rel="noopener"><b>Version ${esc(u.version)} is ready</b><span>Tap to install now · otherwise Firefox installs it by itself</span></a>` : ''; };
  const ICON = { sync: '<svg class="spin ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/></svg>' };

  // ---- Basketball Monster sign-in, saved so the co-pilot can sign back in by itself ----
  const hide = v => { const k = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join(''); return k + '.' + btoa(unescape(encodeURIComponent(v)).split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ k.charCodeAt(i % k.length))).join('')); };
  function bbmAuthHtml() { const a = ST.bbmAuth || {};
    const state = a.user ? (a.lastErr ? `<span class="minus">last attempt failed: ${esc(a.lastErr)}</span>` : a.lastOk ? `<span class="plus">working</span> · last signed in ${ago(a.lastOk)}` : 'saved') : 'not saved';
    return `<details data-k="bbmauth" style="margin-top:8px"><summary>Basketball Monster sign-in: ${a.user ? esc(a.user) : '<span class="sub">not saved</span>'}</summary><div class="yc">
      <div class="sub">When Basketball Monster signs you out, the co-pilot signs back in with these and carries on. They stay in this browser's add-on storage and are only ever sent to basketballmonster.com.</div>
      <input id="bbmUser" placeholder="Basketball Monster email or username" value="${esc(a.user || '')}" autocomplete="off"><input id="bbmPass" type="password" placeholder="${a.pass ? 'Password saved (type to change)' : 'Password'}" autocomplete="new-password">
      <label class="sub" style="display:flex;gap:8px;align-items:flex-start;margin-top:8px"><input type="checkbox" id="bbmKeep" ${ST.bbmAuthKeep ? 'checked' : ''}> Also keep them in the browser's safety copy, so they survive Firefox clearing its data (that copy travels with your Firefox account if you use Sync).</label>
      <div class="row" style="margin-top:8px;gap:8px"><button class="btn small" id="bbmSave">Save and test</button>${a.user ? '<button class="lnk" id="bbmForget">Forget</button>' : ''}</div><div class="msg" id="bbmMsg">Status: ${state}</div></div></details>`; }
  function wireBbm() {
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
    const lv = y && ST['ylive:' + y.lid]; if (M && lv && lv.week === y.week) { const card = window.CTX.liveCard(M, ST, y.lid, y); const m0 = card.match(/<div class="score"><b>([^<]+)<\/b>/), w0 = card.match(/hero-pct">(\d+)%/); if (m0 && w0) rows.push(['good', `Live: <b>${m0[1]}</b> in categories, <b>${w0[1]}%</b> to win the week`]); }
    // in order: 1 the roster move (if one is due), 2 the lineup for the roster you then have
    const d = (p.nowDays || p.days).find(x => x.date === t); const due = p.moves.filter(x => x.date <= t), nxt = p.moves.filter(x => x.date > t);
    if (due.length) due.forEach(x => { const u = yLink(lg, x.add); rows.push(['warn', `<b>1 · Roster:</b> add <b>${esc(x.add)}</b>${x.drop ? ', drop <b>' + esc(x.drop.replace(/\.$/, '')) + '</b>' : x.il ? ' (' + esc(x.il) + ' to IL first)' : ''}${u ? ` · <a href="${esc(u)}" target="_blank" rel="noopener">open on Yahoo</a>` : ''}`]); });
    else rows.push(['good', `<b>1 · Roster:</b> no pickup today${nxt.length ? `. Next: <b>${esc(nxt[0].add)}</b> on ${esc(fmtD(nxt[0].date))}` : p.bd && p.bd.worth && p.bd.wait ? `. Best pickup <b>${esc(p.bd.add)}</b> (${p.bd.dropName ? 'for ' + esc(p.bd.dropName) : 'into your empty spot'}): wait until Monday` : ''}`]);
    if (due.length) rows.push(['', '<b>2 · Lineup:</b> set it after the pickup (it\'s re-planned once Yahoo shows the change)']);
    else if (d && d.open && (d.start.length + d.bench.length)) { const c = dayCheck(d, y ? actualFor(y.lid, t) : null); rows.push(c.known ? (c.changes ? ['warn', `<b>2 · Lineup:</b> <b>${c.changes} change${c.changes > 1 ? 's' : ''}</b> to make today`] : ['good', '<b>2 · Lineup:</b> set correctly for today']) : ['', '<b>2 · Lineup:</b> checking today\'s lineup on Yahoo…']); }
    else rows.push(['good', '<b>2 · Lineup:</b> nobody plays today']);
    if (M && d && !due.length) d.start.forEach(x => { const inj = injFor(y, M, x.name); if (inj && /^(Q|D|GTD|O|OUT|DTD)/i.test(inj)) rows.push(['bad', `<b>${esc(x.name)}</b> is listed <b>${esc(injWord(inj))}</b> and starts today: check before tip-off`]); });
    (ST.alerts || []).filter(a => a.league === lg && Date.now() - a.ts < 12 * 3600e3).forEach(a => rows.push(['bad', esc(a.msg)]));
    if (y) y.rows.filter(r => /^IL/.test(r.slot) && !/^(O|INJ|OUT|IL|NA|SUSP)/i.test(r.inj || '')).forEach(r => rows.push(['warn', `<b>${esc(r.name)}</b> is back from injury but still on IL: he'll need a roster spot`]));
    const A = p.adds; rows.push(['', `${Math.max(0, A.limit - A.used)} of ${A.limit} adds left this week`]);
    return `<div class="card brief"><div class="h"><span>Today: do next</span><span class="sub">${esc(fmtD(t))}</span></div>${rows.map(r => `<div class="brow"><i class="dot d-${r[0]}"></i><div>${r[1]}</div></div>`).join('')}</div>`;
  }
  const injWord = s => ({ Q: 'questionable', D: 'doubtful', O: 'out', GTD: 'a game-time decision', DTD: 'day-to-day', P: 'probable' }[String(s).toUpperCase().split(/\s/)[0]] || String(s).toLowerCase());
  function ctxBlock() {
    // Yahoo's player lists get no card: the Players page shows only the best free agents across the league, not what's on screen
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
    M.board = boardFor(l.league); M.pickBar = seasonBar(l.league);
    let body; try { if (yp.kind === 'trade') body = window.CTX.tradeCard(M, yp); else if (yp.kind === 'add') body = window.CTX.addCard(M, yp); else body = window.CTX.listCard(M, yp).html; } catch (e) { console.error(e); body = `<div class="sub">Couldn't read this page: ${esc(e.message)}</div>`; }

    if (Object.keys(M.yidmap).length !== Object.keys(ST.yidmap || {}).length) { ST.yidmap = M.yidmap; browser.storage.local.set({ yidmap: M.yidmap }); }
    const fr = window.CTX.freshness(M.bx, yp.kind === 'players' ? ['rest', 'ros'] : ['rest', 'ros', 'po']);
    const age = `<span class="sub${fr.worst > 6 * 3600e3 ? ' minus' : ''}">${esc(fr.line)}${ctxRefreshing[yp.lid] ? ' · refreshing…' : ''}</span>`;
    return `<div class="card ctx">${body.replace('<span class="sub" id="ctxAge"></span>', age)}</div>`;
  }
  // ---- one-page app: five pages on a bottom bar. The panel never jumps by itself: the page matching the Yahoo screen
  // you're on just gets a dot, and that page shows what the co-pilot reads from it at the top ----
  const TABS = [['week', 'Week', '<path d="M3 5h18v16H3z"/><path d="M3 10h18M8 3v4M16 3v4"/>'], ['team', 'Team', '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5"/><path d="M16 4.6a3 3 0 0 1 0 6.4M18 14.8c1.8.7 2.9 2.4 3.2 5.2"/>'], ['players', 'Players', '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'], ['strategy', 'Strategy', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'], ['league', 'League', '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 6h3a3 3 0 0 1-3 4M7 6H4a3 3 0 0 0 3 4"/>']];
  const TABPARTS = { week: ['brief', 'live', 'hero', 'next'], team: ['ilback', 'week'], players: ['ctx', 'board'], strategy: ['ctx', 'strategy'], league: ['standings', 'league'] };
  const curTab = () => TABS.some(t => t[0] === ST.uiTab) ? ST.uiTab : 'week';
  // the Yahoo screen you're on (only while it's recent): which league, which page of the co-pilot it belongs to, what to call it
  function yahooOn() { const yp = ST.ypage; if (!yp || Date.now() - yp.ts > 30 * 60e3) return null; const l = leaguesKnown().find(x => x.lid === yp.lid); if (!l) return null;
    let tab = { matchup: 'week', players: 'players', add: 'players', trade: 'strategy', standings: 'league', league: 'league' }[yp.kind] || null; let label = { matchup: 'Matchup', players: 'Player list', add: 'Add a player', trade: 'Trade', standings: 'Standings', league: 'League' }[yp.kind] || '';
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
    const W = p.W.plan;
    let h = '';
    if (stale) h += `<div class="warn">Numbers are ${ago(m.ts).replace(' ago', '')} old. Press Sync before acting.</div>`;
    const cNote = h.length;
    const cs = p.cats.slice().sort((a, b) => b.p - a.p);
    const c0 = h.length;
    const catsMode = p.obj === 'cats';
    { const Wv = catsMode ? (p.Wmaj || 0) : W; const vk = Wv >= 0.6 ? 'g' : Wv >= 0.4 ? 'a' : 'r'; const vt = Wv >= 0.6 ? 'Favourite' : Wv >= 0.4 ? 'Close week' : 'Underdog';
      const fmtT = (c, v) => v == null ? '–' : /%/.test(c.label) ? (v <= 1 ? (v * 100).toFixed(1) : (+v).toFixed(1)) + '%' : (+v).toFixed(v >= 100 ? 0 : 1);
      const heroNum = catsMode ? `${(p.Ecats || 0).toFixed(1)}<small>/${p.ncat}</small>` : pct(W); const tcls = v => v > 0.6 ? 'cs-a' : v >= 0.4 ? 'cs-c' : 'cs-b';
      h += `<div class="hero hv-${vk}"><div class="hero-top"><div class="hero-pct">${heroNum}</div><div class="hero-vs">${catsMode ? 'categories expected against' : 'chance to beat'}<br><b>${esc(p.opp)}</b>${p.playoffs ? ' · playoff week' : ''}</div><div class="hvk"><span class="fk ${vk}">${vt}</span>${catsMode ? `<i>${pct(p.Wmaj || 0)} to take the week</i>` : ''}</div></div>
      <div class="bl">${bottomLine(p)}</div>
      <div class="h" style="margin-top:12px"><span>Chance to win each category</span><span class="sub">you need ${p.need} of ${p.ncat}</span></div>
      <div class="cgrid">${cs.map((c, i) => `<div class="tile ${tcls(c.p)}${i === p.need - 1 ? ' line' : ''}" title="${esc(c.label)}: you ${fmtT(c, c.me)}, them ${fmtT(c, c.opp)}"><b>${esc(c.label.charAt(0).toUpperCase() + c.label.slice(1))}</b><span>${Math.round(c.p * 100)}%</span><i>${fmtT(c, c.me)} v ${fmtT(c, c.opp)}</i></div>`).join('')}</div>
      <div class="sub" style="margin-top:8px">Under each: your projected total against theirs for the week${p.live ? ', including games already played' : ''}${cs.some(c => c.label === 'turnovers') ? ' (fewer turnovers wins)' : ''}.</div>
      <div class="omrow"><span class="sub">Their lineup:</span><span class="seg small"><button data-om="max" class="${p.oppMode === 'max' ? 'on' : ''}" title="Assume the opponent fills every start">fills every start</button><button data-om="set" class="${p.oppMode === 'set' ? 'on' : ''}" title="Opponent lineup exactly as set">as set now</button></span></div></div>`; }
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
    const TAB = curTab(); const yo = yahooOn(); const show = TABPARTS[TAB];
    const yL = yrFor(lg); const yLn = yL ? Object.assign({}, yL, { next: ynextOf(yL) }) : null; const onLg = yo && yo.league === lg;
    const lazy = { ilback: () => ilBackCard(p, lg), brief: () => briefHtml(pThis, lg, M), live: () => M && yL && !pNext ? window.CTX.liveCard(M, ST, yL.lid, yL) : '', next: () => { if (!M || !yLn || pNext) return ''; let ov = null; try { const pn = nxOK ? compute('next') : null; if (pn) ov = { W: pn.obj === 'cats' ? pn.Wmaj : pn.W }; } catch (e) {} return window.CTX.nextCard(M, yLn, ov); }, league: () => leagueCard(lg, M, true), standings: () => standingsCard(lg, true), board: () => boardCard(p, lg, M),
      strategy: () => M ? strategyCard(lg, M, { tid: onLg && yo.kind === 'trade' && ST.ypage && ST.ypage.mid2 ? ST.ypage.mid2 : null }) : `<div class="card">Strategy needs the first full sync from Basketball Monster.</div>`,
      // what the co-pilot reads from the Yahoo screen you're on, shown on the page it belongs to
      ctx: () => onLg && yo.tab === TAB && ['players', 'add', 'trade'].includes(yo.kind) ? `<div id="ctxBox">${ctxBlock()}</div>` : '' };
    const liveH = show.includes('live') ? lazy.live() : ''; lazy.live = () => liveH; // the live card replaces the pre-week forecast once games have been played
    const wbar = nxOK && ['week', 'team', 'players'].includes(TAB) ? weekBar(wsel, m, nextModel(m)) : '';
    const synNote = ''; planFrom[lg] = m.from;
    const body = show.filter(k => !(k === 'hero' && liveH)).map(k => lazy[k] ? (() => { try { return lazy[k](); } catch (e) { console.error(k, e); return ''; } })() : part[k]).join('');
    // alerts on the bottom bar: something on another page needs you
    navAlert = {}; try { if (ilBackCard(p, lg) || ilBlocked(yL)) navAlert.team = 'Roster needs a fix'; } catch (e) {}
    h = yahooLine(yo, TAB, lg) + wbar + healthHtml(lg) + synNote + part.note + (TAB !== 'league' ? ageLine(lg) : '') + (body || `<div class="strnone">Nothing to show here yet.</div>`) + part.settings;
    setNav(lg);
    paint(o, h); wireHealth(); if (M) { wireTrades(lg, M); wireStrategy(lg, M); }
    o.querySelectorAll('[data-wk]').forEach(b => b.onclick = () => { wkPick = { sel: b.dataset.wk, lg, ts: Date.now() }; selDay = null; render(); });
    o.querySelectorAll('[data-om]').forEach(b => b.onclick = () => { s.oppMode = b.dataset.om; saveS(lg); render(); });
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
    fewer: { min: 0.06, swap: 0.08, season: 1.5, t: 'Fewer moves', w: 'A pickup has to add at least 1.5 categories over the rest of the season.' },
    std: { min: 0.03, swap: 0.05, season: 0.75, t: 'Standard', w: 'A pickup has to add at least 0.75 of a category over the rest of the season (about one category every month and a half).' },
    more: { min: 0.015, swap: 0.03, season: 0.4, t: 'More moves', w: 'A pickup has to add at least 0.4 of a category over the rest of the season.' } };
  const pickOf = lg => PICK[S(lg).pick] || PICK.std;
  const fitRule = lg => Object.assign({}, FT_RULE, S(lg).fit || {});
  const showTags = lg => S(lg).showTags !== false;
  function settingsBody(lg, m, A, p) { const s = S(lg); const y = yrFor(lg); const sp = (y && ST['ysetp:' + y.lid]) || null; const STR = window.STRAT; const NM = c => STR ? STR.name(c) : c;
    const cats = m.cats.filter(c => E.LBL[c]); const row = (k, v, note) => `<div class="kvr"><span>${k}</span><b>${v}</b>${note ? `<div class="sub">${note}</div>` : ''}</div>`;
    const miss = '<i class="muted">not found on Yahoo</i>';
    // 1. the league, from Yahoo
    let h = `<div class="card sets" id="set-league"><div class="h"><span>League</span><span class="sub">from Yahoo</span></div>`;
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
      ${(() => { const sc = scoringOf(lg); return `<div class="row" style="margin-top:8px">Scoring<select id="scoring"><option value="auto" ${!s.scoring ? 'selected' : ''}>Use Yahoo's${sc.src !== 'set' ? ' (' + (sc.mode === 'cats' ? 'each category counts' : 'most categories wins') + ')' : ''}</option><option value="cats" ${s.scoring === 'cats' ? 'selected' : ''}>Each category counts</option><option value="win" ${s.scoring === 'win' ? 'selected' : ''}>Most categories wins the week</option></select></div>`; })()}</details></div>`;
    // 2. your build
    const cur = puntFor(lg) || []; const MM = modelFor(lg); const bb = MM && MM.ctx.puntBbm || []; const th = Object.assign({}, STR ? STR.TH0 : {}, s.th || {}); const pc = x => Math.round(x * 100);
    const l = leaguesKnown().find(x => x.league === lg); const snap = l && ST['strat:' + l.lid];
    h += `<div class="card sets" id="set-build"><div class="h"><span>Your build</span></div>
      <div class="sub">Tap categories to punt. This is the only place your punt is set: Basketball Monster's own punt settings don't change anything here.</div>
      <div class="trypick">${cats.map(c => `<button class="pchip${cur.includes(c) ? ' on' : ''}" data-punt="${c}">${esc(NM(c))}</button>`).join('')}</div>
      ${bb.length && bb.slice().sort().join() !== cur.slice().sort().join() ? `<div class="sub"><button class="lnk" id="puntCopy">Copy Basketball Monster's punt (${esc(bb.map(NM).join(', '))})</button></div>` : ''}
      <div class="label lbl2" style="margin-top:12px">Bands</div>
      <div class="sub">How each category is read, from the share of teams Basketball Monster projects you to beat in it.</div>
      <div class="row bandrow"><i class="fd n"></i>Lost under <input class="thin" id="thDead" type="number" min="0" max="50" value="${pc(th.dead)}">%</div>
      <div class="row bandrow"><i class="fd a"></i>Swing up to <input class="thin" id="thSafe" type="number" min="30" max="95" value="${pc(th.safe)}">%</div>
      <div class="row bandrow"><i class="fd gr"></i>Winning up to <input class="thin" id="thLock" type="number" min="50" max="100" value="${pc(th.locked)}">%</div>
      <div class="row bandrow"><i class="fd g"></i>Locked above that</div>
      <div class="sub" style="margin-top:8px">${snap ? `Bands set ${new Date(snap.ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}. They stay put until you set them again.` : 'Bands are set at the first sync with Basketball Monster\'s Analysis Monster.'} <button class="lnk" id="bandsReset">Set again from today's numbers</button></div></div>`;
    // 3. how eager the advice is
    const pk = s.pick && PICK[s.pick] ? s.pick : 'std';
    h += `<div class="card sets" id="set-advice"><div class="h"><span>Advice</span></div>
      <div class="row">Pickups<span class="seg small sortbar" style="margin:0 0 0 auto">${Object.entries(PICK).map(([k, v]) => `<button data-pick="${k}" class="${pk === k ? 'on' : ''}">${v.t}</button>`).join('')}</span></div>
      <div class="sub">${PICK[pk].w} The drop is whoever leaves your team best off. This week and next are timing only: when adding now costs this week, the advice is to wait until Monday.</div>
      <div class="row" style="margin-top:8px"><label><input type="checkbox" id="spare" ${A.spare ? 'checked' : ''}> Keep one add spare for injuries until Saturday</label></div>
      <div class="row" style="margin-top:8px">Trades<span style="margin-left:auto">sell at <input class="thin" id="tradeBar" type="number" step="0.5" min="0.5" value="${(() => { const MM = modelFor(lg); return MM ? tradeBarOf(lg, MM) : 1.5; })()}"> categories</span></div>
      <div class="sub">A player is a sell when a one-for-one trade at his Basketball Monster value adds at least this many categories over the rest of the season. Every number is expected categories won against your league: the same measure on every page.</div>
      <div class="sub" style="margin-top:8px"><button class="lnk" id="setReset">Reset advice and bands to the defaults</button></div></div>`;
    // 4. display
    h += `<div class="card sets" id="set-display"><div class="h"><span>Display</span></div>
      <div class="row"><label><input type="checkbox" id="showTags" ${showTags(lg) ? 'checked' : ''}> Show Basketball Monster's analyst tags (grey labels; they never change advice)</label></div></div>`;
    // 5. sign-ins and diagnostics
    h += `<div class="card sets" id="set-conn"><div class="h"><span>Sign-ins, track record and diagnostics</span></div>
      <div class="row"><label><input type="checkbox" id="swap" ${s.swap ? 'checked' : ''}> I'm Team 2 on Matchup Monster</label></div>${bbmAuthHtml()}${trackHtml(lg)}${diagHtml(lg, p)}</div>`;
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
    const tb = $('tradeBar'); if (tb) tb.onchange = e => set(() => { const v = +e.target.value; s.tradeBar = v > 0 ? v : null; });
    const rs = $('setReset'); if (rs) rs.onclick = () => { set(() => { delete s.pick; delete s.fit; delete s.th; delete s.tradeBar; }); toast('Advice and bands back to the defaults', 'ok'); };
    const br = $('bandsReset'); if (br) br.onclick = () => { const M = modelFor(lg); const l = leaguesKnown().find(x => x.league === lg); const win = l && window.STRAT && M ? window.STRAT.catWin(ST['bbmstand:' + l.lid], M.ctx.cats) : null; if (!win) { br.textContent = 'Waiting for Basketball Monster…'; return; } const sk = 'strat:' + l.lid; ST[sk] = window.STRAT.snapshot(M, win, M.ctx.punt || []); browser.storage.local.set({ [sk]: ST[sk] }); DV++; render(); };
    const yr = $('yReload'); if (yr) yr.onclick = async () => { const y = yrFor(lg); if (!y) return; const k = 'ysetp:' + y.lid; const cur = Object.assign({}, ST[k] || {}, { ts: 0 }); ST[k] = cur; await browser.storage.local.set({ [k]: cur }); yr.textContent = 'Reloading…'; yr.disabled = true; runSync(true); }; }
  // ---- the settings pane: everything you can change, in one place, opened from the gear at the top right ----
  let setOpen = false;
  const setPane = (lg, body) => `<section class="setpane" id="setPane" ${setOpen ? '' : 'hidden'} aria-label="Settings"><div class="seth"><div><div class="t">Settings</div>${lg ? `<div class="sub">${esc(lg)}</div>` : ''}</div><button class="lnk" id="setClose">Done</button></div>${body}</section>`;
  function showSettings(on, k) { setOpen = !!on; const sp = $('setPane'); if (sp) sp.hidden = !setOpen; document.body.classList.toggle('setopen', setOpen);
    const b = $('setBtn'); if (b) { b.classList.toggle('on', setOpen); b.setAttribute('aria-expanded', String(setOpen)); }
    if (setOpen && k) { const d = document.querySelector('#setPane details[data-k=' + k + ']') || $('set-' + k); if (d) { if ('open' in d) d.open = true; setTimeout(() => d.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); } } }
  // the big numbers count up when a page opens (not on every refresh), so a fresh page reads as live
  function countUp(o) { if (REDUCED) return; o.querySelectorAll('.hero-pct, .cgrid .tile span').forEach(e => { const t = e.firstChild; if (!t || t.nodeType !== 3) return; const m = t.textContent.match(/^(\d+(?:\.\d+)?)(%?)$/); if (!m) return;
    const end = +m[1], dp = (m[1].split('.')[1] || '').length, t0 = performance.now(), D = 420; const step = now => { const k = Math.min(1, (now - t0) / D), e2 = 1 - Math.pow(1 - k, 3); t.textContent = (end * e2).toFixed(dp) + m[2]; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }); }
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
    const NUM = '.hero-pct, .score b, .stat b, .tile span, .dchip b, table.pl td.v';
    const before = fresh ? null : [...o.querySelectorAll(NUM)].map(e => e.textContent);
    const sp0 = $('setPane'); const spY = sp0 ? sp0.scrollTop : 0;
    o.innerHTML = h;
    const sp1 = $('setPane'); if (sp1) sp1.scrollTop = spY; document.body.classList.toggle('setopen', setOpen && !!sp1);
    if (!REDUCED) {
      if (fresh) { o.classList.remove('enter', 'from-r', 'from-l', 'from-u'); void o.offsetWidth; o.classList.add('enter', 'from-' + dir); clearTimeout(paint.t); paint.t = setTimeout(() => o.classList.remove('enter', 'from-r', 'from-l', 'from-u'), 900); countUp(o); }
      else if (before) { const now = [...o.querySelectorAll(NUM)]; if (now.length === before.length) now.forEach((e, i) => { if (e.textContent !== before[i]) { e.classList.add('bump'); setTimeout(() => e.classList.remove('bump'), 600); } }); }
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
  function actualFor(lid, date) { const e = LU(lid)[date]; return e && e.rows ? e : null; }
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
  const seasonChip = v => { const a = Math.abs(v); const k = a < 0.5 ? 0 : a < 2 ? 1 : a < 5 ? 2 : 3; return k ? (v > 0 ? ['g', ['', 'Helps a little', 'Helps clearly', 'Helps a lot'][k]] : ['r', ['', 'Costs a little', 'Costs clearly', 'Costs a lot'][k]]) : ['n', 'About even']; };
  const catMoves = (cats, min) => { const L = (cats || []).filter(c => Math.abs(c.d) >= (min || 0.01)); const up = L.filter(c => c.d > 0).sort((a, b) => b.d - a.d).map(c => window.STRAT.name(c.c)), dn = L.filter(c => c.d < 0).sort((a, b) => a.d - b.d).map(c => window.STRAT.name(c.c)); return { up, dn }; };
  // Yahoo's waiver date ("Nov 18", no year) as a date: this year, or next year when that's more than two months back (December → January)
  const wvDate = s => { const m = String(s || '').match(/^([A-Z][a-z]{2}) (\d{1,2})$/); if (/^\d{4}-\d{2}-\d{2}/.test(String(s || ''))) return String(s).slice(0, 10); if (!m) return null;
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m[1]); if (mo < 0) return null; const t = usToday(); let yr = +t.slice(0, 4);
    const iso = y => `${y}-${String(mo + 1).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`; if (iso(yr) < addDay(t, -60)) yr++; return iso(yr); };
  function boardCard(p, lg, M) {
    const B = boardFor(lg); if (!B || !M) return `<div class="card"><div class="h"><span>Free agents</span></div><div class="strnone">Your free-agent list appears once Basketball Monster's rest-of-season projections are in.</div></div>`;
    const bd = p.bd; const A = p.adds || {}; const y = yrFor(lg); const nx = p.week === 'next'; const nm = id => id ? M.P[id].n : '';
    const SL = new Map(((p.streams && p.streams.list) || []).map(x => [K(x.add), x])); const mv = (p.moves || []).find(x => bd && K(x.add) === K(bd.add));
    let h = `<div class="card prim fal"><div class="h"><span>Free agents</span><span class="sub">${nx ? 'next week' : `${Math.max(0, A.left || 0)} of ${A.limit || 0} adds left this week${A.spare ? ' (1 kept spare)' : ''}`}</span></div>`;
    if (bd && bd.worth && !bd.wait) h += `<div class="hl">Add <b class="plus">${esc(bd.add)}</b>${bd.dropName ? `, drop <b>${esc(bd.dropName)}</b>` : ' into your empty roster spot'}${mv ? ` on ${esc(fmtD(mv.date))}` : ''}</div><div class="sub hls"><b class="plus">${cn(bd.season)}</b> categories over the rest of the season${bd.chosen ? ' · your pick' : ''}</div>`;
    else if (bd && bd.worth) h += `<div class="hl"><b>${esc(bd.add)}</b> is the best pickup: wait until Monday</div><div class="sub hls">${bd.why === 'adds' ? 'No adds left this week.' : `${bd.dropName ? 'Dropping ' + esc(sur(bd.dropName)) : 'Adding him'} now costs this week (${cn(bd.week)} categories); from Monday it's ${cn(bd.season)} over the rest of the season.`}</div>`;
    else h += `<div class="hl">No free agent clears your bar</div><div class="sub hls">The best, ${esc(nm(B.list[0].id))}, adds ${cn(B.list[0].gain * B.weeks)} categories over the rest of the season; your bar is ${cn(seasonBar(lg), 2)} (Settings → Advice).</div>`;
    // position filter (Settings-free, remembered per league): guards, forwards or centres among the list, ranks kept from the full list
    const fp = ['G', 'F', 'C'].includes(S(lg).faPos) ? S(lg).faPos : 'all'; const posOK = id => { if (fp === 'all') return true; const ps = String((M.P[id] || {}).pos || '').toUpperCase().split(/[\s,\/]+/);
      return fp === 'G' ? ps.some(q => /^(PG|SG|G)$/.test(q)) : fp === 'F' ? ps.some(q => /^(SF|PF|F)$/.test(q)) : ps.includes('C'); };
    const rows = B.list.map((x, i) => { if (!posOK(x.id)) return ''; const name = nm(x.id); const sel = bd && K(bd.add) === K(name); const drop = sel ? bd.drop : x.drop; const r = sel && bd.drop !== x.drop ? B.swap(x.id, drop) : x;
      const season = (r.g != null ? r.g : r.gain) * B.weeks; const tm = window.H2H.timing(M.ctx, M.L, x.id, drop) || {}; const st = SL.get(K(name)); const av = availOf(y, name);
      const tags = []; if (sel && bd.worth && !bd.wait) tags.push(['g', bd.chosen ? 'Your pick' : 'Best pickup']); if (sel && bd.worth && bd.wait) tags.push(['a', 'Wait until Monday']); if (st) tags.push(['a', 'Stream this week only']);
      if (av && av.st === 'W') { const wd = wvDate(av.wv); tags.push(['n', 'On waivers' + (wd ? ' until ' + fmtD(wd) : '')]); }
      const cm = catMoves(r.cats || x.cats, 0.01); const gk = seasonChip(season);
      const P = M.P[x.id], D = M.P[drop]; const alt = !sel && x.alt ? x.alt : null;
      return `<details class="pr fa" data-k="fa${esc(x.id)}"><summary><div class="l1"><span class="frk">${i + 1}</span><b>${esc(name)}</b><span class="fv${tags.length && tags[0][0] === 'g' ? ' plus' : ''}">${cn(season)}</span></div>
        <div class="l2">${tags.length ? `<div class="ftags">${tags.map(t => `<span class="fk ${t[0]}">${esc(t[1])}</span>`).join('')}</div>` : ''}<div class="ln">${esc(teamN(P.t))}${P.inj ? ` · <span class="minus">${esc(injChip(P.inj))}</span>` : ''} · ${drop ? 'drop ' + esc(sur(nm(drop))) : 'no drop: empty spot'}</div>${cm.up.length ? `<div class="ln"><span>Helps</span> ${esc(listW(cm.up.slice(0, 4)))}</div>` : ''}${cm.dn.length ? `<div class="ln"><span>Costs</span> ${esc(listW(cm.dn.slice(0, 3)))}</div>` : ''}</div></summary>
        <div class="ld"><div class="sub">${drop ? `Test: add ${esc(sur(name))}, drop <b>${esc(nm(drop))}</b>${sel && bd.drop !== x.drop ? ' (your choice)' : ', the drop that leaves your team best off'}.` : `Test: add ${esc(sur(name))} into your empty roster spot, nobody dropped.`}</div>
          <div class="gains"><div><span>This week</span>${tm.week != null ? `<span class="gnum ${tm.week >= 0 ? 'plus' : 'minus'}">${cn(tm.week, 2)}</span>` : '<span class="sub">–</span>'}</div><div><span>Next week</span>${tm.next != null ? `<span class="gnum ${tm.next >= 0 ? 'plus' : 'minus'}">${cn(tm.next, 2)}</span>` : '<span class="sub">–</span>'}</div><div><span>Rest of season</span><span class="fk ${gk[0]}">${gk[1]}</span><span class="gnum ${season >= 0 ? 'plus' : 'minus'}">${cn(season)}</span></div></div>
          <div class="sub">Expected categories won: this week against ${esc(p.opp || 'your opponent')}${M.L.oppNext ? `, next week against ${esc(M.teamName(M.L.oppNext))}` : ''}, and in total over the rest of the season against your league. This week and next are timing only: the order above is the rest of the season.</div>
          ${st ? `<div class="sub" style="margin-top:4px"><b>As a stream:</b> drop ${esc(st.drop)} for ${st.games} game${st.games === 1 ? '' : 's'} from ${esc(fmtD(st.date))}: ${cn(st.net, 2)} categories this week after what the drop costs later.</div>` : ''}
          ${alt ? `<div class="sub" style="margin-top:4px">Or drop ${esc(nm(alt.drop))}: ${cn(alt.g * B.weeks)} over the rest of the season.</div>` : ''}
          ${drop ? statsVs(name, nm(drop)) : ''}
          <div class="sub">${P.ros && P.ros.g != null ? `${P.ros.g} games left projected for ${esc(sur(name))}` : ''}${D && D.ros && D.ros.g != null ? `, ${D.ros.g} for ${esc(sur(nm(drop)))}` : ''}.${P.rank ? ` Basketball Monster rank ${P.rank}.` : ''}${M.hot(name) ? ` <span class="plus">${esc(M.hot(name))}</span>.` : ''}</div>
          <div class="acts">${sel && bd.chosen ? '<button class="lnk" data-unplan>Back to the top pickup</button>' : !sel ? `<button class="lnk" data-plan="${esc(name)}" data-pdrop="${esc(nm(drop))}">Plan this pickup instead</button>` : ''}${(() => { const u = yLink(lg, name); return u ? `<a class="lnk" href="${esc(u)}" target="_blank" rel="noopener">Open on Yahoo</a>` : ''; })()}</div></div></details>`; }).join('');
    h += `<div class="sub" style="margin:8px 0 4px">Every Basketball Monster free agent, ranked by what he adds to your team over the rest of the season: expected categories won against every team in your league, in place of the player he'd replace${B.punt ? ` (punting ${esc(listW(B.punt.map(c => window.STRAT.name(c))))})` : ''}. Your top ${B.list.length}.</div>`;
    h += `<div class="seg small sortbar fapos">${[['all', 'All'], ['G', 'Guards'], ['F', 'Forwards'], ['C', 'Centres']].map(([k, t]) => `<button data-fapos="${k}" class="${fp === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    h += rows || `<div class="strnone">None of your top ${B.list.length} free agents plays ${{ G: 'guard', F: 'forward', C: 'centre' }[fp]}.</div>`;
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
  const FIT = { fits: ['g', 'Fits your build'], holds: ['a', 'Surplus in won categories'], wasted: ['a', 'Value in lost categories'], costs: ['r', 'A free agent does more'], small: ['n', 'Small impact'], nohelp: ['r', 'Doesn\'t help you'] };
  const GDESC = { fits: 'Worth more to you than any free agent, and no trade at his value adds a clear margin', holds: 'A one-for-one trade at his value adds a clear margin: his output sits in categories you already win', wasted: 'A one-for-one trade at his value adds a clear margin: his output sits in categories you\'ve lost', costs: 'A free agent adds more to your team than he does: he\'s the drop on the Players page', small: 'The third of your roster worth least to you. No free agent or trade beats him yet: first in line when one does', nohelp: 'Adds nothing in place of your least valuable player' };
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
        const r = rd && (rd.by[id] || rd.league[id]); if (r) { f.kind = r.kind === 'sell' ? (pos(cv, gg.won) >= pos(cv, gg.lost) ? 'holds' : 'wasted') : r.kind; f.read = r; f.mine = !!rd.by[id]; f.rd = rd; }
        return Object.assign({ id, n: p.n, t: p.t, cv, lv: p.ros.lv || 0, tg: teamLeft(p.t), brank: brank[id] || null, g: p.ros.g || 0, inj: ystat[id] || p.inj || '', tag: STR.tagOf(p), notes: (p.notes || []).filter(n => n.tag), yrank: M.yrank ? M.yrank(id) : null, own: own[id] || null, p }, f); };
      const mineIds = (M.L.teams.find(t => t.tid === M.L.me) || {}).ids || [];
      const mine = mineIds.map(id => line(id)).filter(Boolean);
      const league = all.filter(p => own[p.id] && own[p.id] !== M.L.me && p.ros.cv).map(p => line(p.id)).filter(Boolean); // rostered players only: free agents live on the Players page
      const miss = STR.missing(((ST['lgscan:' + l.lid] || {}).teams || []).filter(t => String(t.tid) !== M.L.me).flatMap(t => t.players || []).filter(n => !/\bplayer notes?\b/i.test(n)), n => M.find(n));
      return { l, snap, winNow, th, band: G.band, grp: G.grp, bandNow, groups, rows, mine, mineIds, league, line, miss, cats, punt, brank, rd: RD }; }); }
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
  function fitWords(r, V, grp) { grp = grp || V.grp; const cv = r.cv; const rd = r.rd; const L = (a) => andL(a.map(NN)); const parts = []; const M = modelFor(league());
    if (!r.read || !rd || !M) return [['', 'Not rated yet']]; const w = rd.weeks; const x = r.read; const top = (cats, sgn) => cats.filter(c => sgn * c.d >= 0.02).sort((a, b) => sgn * (b.d - a.d)).slice(0, 3).map(c => c.c);
    if (r.mine) { parts.push(['Worth', `${cn(x.val * w)} categories to you over the rest of the season`]); const carry = top(x.cats, 1); if (carry.length) parts.push(['Holds up', L(carry)]);
      if (r.kind === 'costs' && x.fa) parts.push(['Free agent', `${M.P[x.fa.id].n} adds ${cn(x.fa.g * w)} in his place`]);
      if ((r.kind === 'holds' || r.kind === 'wasted') && x.sell[0]) { parts.push(['Trade', `${x.sell.length} player${x.sell.length > 1 ? 's' : ''} at his value add up to ${cn(x.sell[0].g * w)}`]); const g = goodAt(cv, r.kind === 'holds' ? grp.won : grp.lost); if (g.length) parts.push([r.kind === 'holds' ? 'Surplus in' : 'Value in', L(g) + (r.kind === 'holds' ? ' (already won)' : ' (lost)')]); }
      if (r.kind === 'fits' && x.trades[0]) parts.push(['Best trade at his value', `${cn(x.trades[0].g * w)}, under your ${cn(rd.bar * w)} bar`]); }
    else { parts.push(['For you', `${cn(x.g * w)} categories over the rest of the season in place of ${rd.d0 ? M.P[rd.d0].n : 'your least valuable player'}`]); const up = top(x.cats, 1), dn = top(x.cats, -1); if (up.length) parts.push(['Helps', L(up)]); if (dn.length) parts.push(['Costs', L(dn)]); }
    return parts; }
  // the stats behind a read: Basketball Monster's projection, this season so far and the last two weeks, per game
  function statsTable(p, cats) { const cols = [['Projection', p.ros], ['Season', p.season], ['Last 2 weeks', p.form]].filter(x => x[1] && x[1].st);
    const v = (st, c) => { if (!st) return '–'; if (c === 'fg%') return st.fga ? (st.fg / st.fga * 100).toFixed(1) + '%' : '–'; if (c === 'ft%') return st.fta ? (st.ft / st.fta * 100).toFixed(1) + '%' : '–'; const x = st[c === '2d' ? '2d' : c]; return x == null ? '–' : (+x).toFixed(c === 's' || c === 'b' || c === '3' || c === 'to' || c === '2d' ? 1 : 1); };
    const vol = (st, c) => c === 'fg%' && st && st.fga ? ` <i>${(+st.fga).toFixed(1)} att</i>` : c === 'ft%' && st && st.fta ? ` <i>${(+st.fta).toFixed(1)} att</i>` : '';
    return `<table class="stt2"><thead><tr><th></th>${cols.map(c => `<th>${c[0]}${c[1].g ? `<i>${c[1].g} g</i>` : ''}</th>`).join('')}</tr></thead><tbody>${cats.map(c => `<tr><td>${esc(window.STRAT.Name(c))}</td>${cols.map(x => `<td>${v(x[1].st, c)}${vol(x[1].st, c)}</td>`).join('')}</tr>`).join('')}${cols[0] && cols[0][1].m ? `<tr><td>Minutes</td>${cols.map(x => `<td>${x[1].m ? (+x[1].m).toFixed(1) : '–'}</td>`).join('')}</tr>` : ''}</tbody></table>`; }
  function strategyCard(lg, M, opt) { const V = strategyState(lg, M); if (!V) return '';
    const sub = [['build', 'Build'], ['moves', 'Best moves'], ['roster', 'Roster'], ['block', 'Trade block'], ['finder', 'Finder']]; if (window.STAB !== 'how' && !sub.some(x => x[0] === window.STAB)) window.STAB = 'build';
    let h = `<div class="seg trtabs stabs">${sub.map(([k, t]) => `<button data-stab="${k}" class="${window.STAB === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    if (!V.snap) return `<div class="card strat">${h}<div class="strnone">Waiting for Basketball Monster's Analysis Monster, which comes with the next sync.<span class="skel" style="width:70%"></span><span class="skel" style="width:45%"></span></div></div>`;
    const N = c => esc(NN(c)); const nOpp = Math.max(1, V.rows.length - 1); const beat = w => w == null ? null : Math.round(w * nOpp);
    const dt = ts => new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }); const owner = tid => tid ? esc(M.teamName(tid)) : 'Free agent';
    const tagChip = t => t && showTags(lg) ? `<span class="chip plain tagl" title="Basketball Monster analyst tag (general fantasy value, not your build): ${esc(t.text)}">${esc(t.by)}: ${esc(t.tag)}</span>` : '';
    const dot = k => `<i class="fd ${FIT[k][0]}"></i>`;
    const BW = { punt: ['Punted', 'n'], dead: ['Lost', 'n'], swing: ['Swing', 'a'], safe: ['Winning', 'gr'], locked: ['Locked', 'g'] };
    // one player: a coloured read in words; the stats behind it on tap
    const playerRow = (r, o) => { o = o || {}; const words = (o.extra || []).concat(fitWords(r, V, o.grp));
      return `<details class="pr" data-k="pr${esc(r.id)}"><summary><div class="l1">${dot(r.kind)}<b>${esc(r.n)}</b><span class="fk ${FIT[r.kind][0]}">${FIT[r.kind][1]}</span>${r.inj ? `<span class="chip lost">${esc(injChip(r.inj))}</span>` : ''}${tagChip(r.tag)}${o.block ? '<span class="chip plain">On the block</span>' : ''}</div>
        <div class="l2">${words.map(w => `<div class="ln">${w[0] ? `<span>${esc(w[0])}</span> ` : ''}${esc(w[1])}</div>`).join('')}${r.tg ? `<div class="ln${r.g < 0.6 * r.tg ? ' warnl' : ''}"><span>Plays</span> ${Math.min(r.g, r.tg)} of ${r.tg} games left${r.g < 0.6 * r.tg ? ` (projected to miss ${r.tg - r.g})` : ''}</div>` : ''}${o.owner ? `<div class="ln muted">${owner(r.own)}</div>` : ''}</div></summary>
        <div class="ld">${o.block != null ? `<div class="row" style="margin-bottom:8px"><button class="lnk blk${o.block ? ' on' : ''}" data-block="${esc(r.id)}">${o.block ? 'Take off the trade block' : 'Put on the trade block'}</button></div>` : ''}${statsTable(r.p, V.cats)}<div class="sub">${r.g} games left${r.brank ? ' · Basketball Monster rank ' + r.brank : ''}${r.yrank ? ' · Yahoo rank ' + r.yrank : ''}</div>${r.notes.map(n => `<div class="sub">${esc(n.by)} (${esc(n.tag)}${n.tagNote ? ' ' + esc(n.tagNote) : ''}): “${esc(n.text)}”</div>`).join('')}</div></details>`; };
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
      h += `<button class="cta" data-findmoves>Find my best moves for this build<i>Sells, what to ask for and who fits, plus the waiver wire</i></button>`;
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
        const rd2 = readsFor(lg, tryP); const R1 = V.mine.slice().sort((a, b) => b.lv - a.lv).slice(0, 6); const R2 = R1.map(r => V.line(r.id, G2.grp, rd2)).filter(Boolean);
        const fit2 = R2.filter(r => r.kind === 'fits'), waste2 = R2.filter(r => r.kind === 'wasted' || r.kind === 'holds');
        h += `<div class="tryres"><div><b>Punting ${andL(tryP.map(N))}</b>: you'd already be winning ${won2.length} of ${V.cats.length - tryP.length} kept categories${won2.length ? ` (${andL(won2.map(N))})` : ''}.</div>
          ${sw2.length ? `<div>Still to fight for: ${andL(sw2.map(N))}.</div>` : ''}${lost2.length ? `<div class="minus">Kept but currently lost: ${andL(lost2.map(N))}.</div>` : ''}
          <div>Your top six by Basketball Monster: ${fit2.length ? `${andL(fit2.map(r => esc(r.n)))} ${fit2.length > 1 ? 'fit' : 'fits'} this build` : 'none fit this build'}${waste2.length ? `; ${andL(waste2.map(r => esc(r.n)))} would be worth more to you traded at ${waste2.length > 1 ? 'their' : 'his'} value` : ''}.</div>
          <div class="sub">This uses your team as it stands. Categories you've been punting will show as lost until the roster changes, so this view leans towards the build you already have.</div>
          <div class="sub">Compare: now you win ${won.length} of ${kept.length}, and ${V.mine.slice().sort((a, b) => b.lv - a.lv).slice(0, 6).filter(r => r.kind === 'fits').length} of your top six fit.</div>
          ${(() => { const rk = BB && BB.rankOf(tryP); return rk ? `<div>Your team would rank <b>${ordN(rk.rank)}</b> of ${BB.n} on the categories kept${BB.current ? ` (now ${ordN(BB.current.rank)})` : ''}.</div>` : ''; })()}
          <div class="row" style="margin-top:4px"><button class="btn small" data-usebuild="${esc(tryP.slice().sort().join(','))}">Use this build</button><button class="lnk" data-tryclear>Clear</button></div></div>`; }
      if (V.miss.length) h += `<div class="sub" style="margin-top:8px">Not in Basketball Monster's projections: ${esc(V.miss.slice(0, 10).join(', '))}${V.miss.length > 10 ? ' and others' : ''}.</div>`;
    } else if (window.STAB === 'moves') { h += movesHtml(lg, M, V, { dot, playerRow, owner, N });
    } else if (window.STAB === 'roster') {
      const block = S(lg).block || []; const ORD = ['wasted', 'holds', 'costs', 'fits', 'small'];
      h += `<div class="legend">${Object.entries(FIT).map(([k, v]) => `<span>${dot(k)}${v[1]}</span>`).join('')}</div>`;
      const gcats = k => { const G = V.grp; const L = a => esc(andL(a.map(NN))); return k === 'wasted' ? (G.lost.length ? 'Your lost categories: ' + L(G.lost) : '') : k === 'fits' || k === 'costs' ? (G.swing.length ? 'Your swing categories: ' + L(G.swing) : '') : k === 'holds' ? (G.won.length ? 'Categories you win: ' + L(G.won) : '') : ''; };
      ORD.forEach(k => { const R = V.mine.filter(r => r.kind === k).sort((a, b) => b.lv - a.lv); if (!R.length) return;
        h += `<div class="grh2 k-${FIT[k][0]}"><div><b>${FIT[k][1]}</b><span class="cnt">${R.length}</span></div><span class="gd">${GDESC[k]}</span>${gcats(k) ? `<span class="gc">${gcats(k)}</span>` : ''}</div>` + R.map(r => playerRow(r, { block: block.includes(r.id) })).join(''); });
    } else if (window.STAB === 'block') {
      const block = (S(lg).block || []).filter(id => V.mine.some(r => r.id === id));
      if (!block.length) h += `<div class="strnone">Nobody on the block yet. Open a player in Roster and tap "Put on the trade block".</div>`;
      block.forEach(id => { const r = V.mine.find(x => x.id === id); if (!r) return; const T = teamNeedsAll(lg, M, r); const rd = V.rd; const tr = r.read ? r.read.trades.filter(t => t.g > 0) : []; const lv = V.league.reduce((m, x) => (m[x.id] = x, m), {});
        h += `<div class="blkc"><div class="l1">${dot(r.kind)}<b>${esc(r.n)}</b><span class="fk ${FIT[r.kind][0]}">${FIT[r.kind][1]}</span><button class="lnk blk on" data-block="${esc(r.id)}">Take off the block</button></div>
          <div class="sub">Worth ${rd ? cn(r.read.val * rd.weeks) : '–'} categories to you over the rest of the season. Below: players at his Basketball Monster value (or a little less) who'd add to your team in a one-for-one, best first.${rd ? ` A clear move is ${cn(rd.bar * rd.weeks)} or more.` : ''}</div>
          ${T.length ? `<div class="sub">Teams fighting for what he's good at: ${T.map(t => `${owner(t.tid)} <span class="muted">(${andL(t.cats.map(N))})</span>`).join(', ')}.</div>` : ''}
          ${tr.length ? tr.slice(0, 8).map(t => lv[t.id] ? playerRow(lv[t.id], { owner: true, extra: [['This trade', `${cn(t.g * rd.weeks)} categories over the rest of the season`]] }) : '').join('') : '<div class="strnone">No player at his value adds to your team in a one-for-one.</div>'}</div>`; });
    } else if (window.STAB === 'finder') {
      const f0 = S(lg).find || {}; const kind = f0.kind === 'all' ? 'all' : 'fits'; const TIER = [[1, 30, 'Stars'], [31, 75, 'Starters'], [76, 130, 'Rotation players'], [131, 9999, 'Depth']];
      const L0 = V.league.filter(x => x.read && (kind === 'all' || x.kind === 'fits')).sort((a, b) => b.read.g - a.read.g);
      h += `<div class="seg small sortbar">${[['fits', FIT.fits[1]], ['all', 'Any']].map(([k, t]) => `<button data-fkind="${k}" class="${kind === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
      h += `<div class="sub" style="margin-bottom:8px">Players on other teams, by what each would add to your team over the rest of the season in place of ${V.rd && V.rd.d0 ? esc(M.P[V.rd.d0].n) + ', your least valuable player' : 'your least valuable player'}. Free agents are on the Players page.</div>`;
      h += TIER.map(([a, b, name], ti) => { const T0 = L0.filter(x => x.brank >= a && x.brank <= b); return T0.length ? `<details class="more"${ti < 2 ? ' open' : ''}><summary>${name}: ${T0.length}</summary>${T0.slice(0, 12).map(x => playerRow(x, { owner: true })).join('')}</details>` : ''; }).join('') || '<div class="strnone">Nobody yet.</div>';
    } else if (window.STAB === 'how') h += howItWorks(lg, V);
    // the rules behind the reads: kept out of the sub-tab row, at the foot of the card
    h += `<div class="stfoot">${window.STAB === 'how' ? '<button class="lnk" data-stab="build">Back to Build</button>' : '<button class="lnk" data-stab="how">How it works</button>'}</div>`;
    return `<div class="card strat">${h}</div>`; }
  // ---- Best moves, on the one measure (current roster only): 1. sells: a one-for-one trade at the player's Basketball Monster
  // value that adds at least your trade bar; the targets are those trades and the profile is what they have in common. A player
  // who holds up a category can't be a sell (taking him out costs that category, so no same-value trade clears the bar).
  // 2. the waiver wire: the Players page's list, top three. 3. who to build around: your most valuable players to you. ----
  function movesHtml(lg, M, V, U) { const { dot, playerRow } = U; const rd = V.rd; if (!rd) return `<div class="strnone">Best moves needs Basketball Monster's rest-of-season projections. They come with the next sync.</div>`;
    const w = rd.weeks; const dt = new Date(V.snap.ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }); const LV = V.league.reduce((m, x) => (m[x.id] = x, m), {});
    let h = `<div class="mvhead"><b>Current roster only</b> · every number is expected categories won against your league over the rest of the season · bands from Analysis Monster, ${esc(dt)}</div>`;
    // 1 · sells
    const sells = V.mine.filter(r => (r.kind === 'holds' || r.kind === 'wasted') && r.read && r.read.sell.length).sort((a, b) => b.read.sell[0].g - a.read.sell[0].g);
    const top4 = V.mine.filter(r => !(r.read && r.read.il)).sort((a, b) => b.lv - a.lv).slice(0, 4).map(r => r.id); const sTop = sells.filter(r => top4.includes(r.id));
    h += `<div class="h mvh"><span>1 · Sell</span><span class="sub">${sells.length} candidate${sells.length === 1 ? '' : 's'} · bar ${cn(rd.bar * w)}</span></div>`;
    if (sTop.length >= 2) h += `<div class="warnt"><b>Your punt doesn't suit your best players</b> (${esc(andL(sTop.map(r => r.n)))}): compare builds before selling. <button class="lnk" data-stab="build">Try a build</button></div>`;
    if (!sells.length) { const near = V.mine.filter(r => r.read && r.read.trades.length).sort((a, b) => b.read.trades[0].g - a.read.trades[0].g)[0];
      h += `<div class="strnone">No one-for-one trade at a player's value adds ${cn(rd.bar * w)} categories over the rest of the season. Your roster is worth more to you than the market would give for it.${near ? ` Closest: ${esc(near.n)} for ${esc(M.P[near.read.trades[0].id].n)}, ${cn(near.read.trades[0].g * w)}.` : ''}</div>`; }
    sells.forEach(r => { const T = r.read.sell; const avg = {}; T.slice(0, 5).forEach(t => t.cats.forEach(c => avg[c.c] = (avg[c.c] || 0) + c.d / Math.min(5, T.length)));
      const up = Object.keys(avg).filter(c => avg[c] >= 0.01).sort((a, b) => avg[b] - avg[a]).slice(0, 3), dn = Object.keys(avg).filter(c => avg[c] <= -0.01).sort((a, b) => avg[a] - avg[b]).slice(0, 3);
      const rk = T.map(t => V.brank[t.id]).filter(Boolean); const lo = rk.length ? Math.min(...rk) : null, hi = rk.length ? Math.max(...rk) : null;
      h += `<div class="mvc"><div class="l1">${dot(r.kind)}<b>${esc(r.n)}</b><span class="fk ${FIT[r.kind][0]}">${FIT[r.kind][1]}</span>${r.brank ? `<span class="muted">rank ${r.brank}</span>` : ''}</div>
        <div class="mvl"><span>Worth to you</span>${cn(r.read.val * w)} <i>over the rest of the season</i></div>
        <div class="mvl"><span>Ask for</span>${up.length ? `<b>more ${esc(andL(up.map(NN)))}</b>` : 'the players below'}${dn.length ? ` <i>giving up some ${esc(andL(dn.map(NN)))}</i>` : ''}</div>
        <div class="mvl"><span>Market</span>${lo ? `Basketball Monster rank ${lo}–${hi}, his value or a little less: ` : ''}<b>${T.length}</b> player${T.length === 1 ? '' : 's'} clear the bar</div>
        ${T.slice(0, 4).map(t => LV[t.id] ? playerRow(LV[t.id], { owner: true, extra: [['This trade', `${cn(t.g * w)} categories over the rest of the season`]] }) : '').join('')}
        ${T.length > 4 ? `<details class="more"><summary>${T.length - 4} more</summary>${T.slice(4, 15).map(t => LV[t.id] ? playerRow(LV[t.id], { owner: true, extra: [['This trade', `${cn(t.g * w)} categories over the rest of the season`]] }) : '').join('')}</details>` : ''}
        <div class="mvf"><button class="lnk${(S(lg).block || []).includes(r.id) ? ' on' : ''}" data-block="${esc(r.id)}">${(S(lg).block || []).includes(r.id) ? 'On the trade block' : 'Put on the trade block'}</button></div></div>`; });
    // 2 · the waiver wire: the Players page's list
    const B = rd.B; const bd = (planNow[lg] || {}).bd;
    h += `<div class="h mvh"><span>2 · Waiver wire</span><span class="sub">the same list as Players</span></div>`;
    h += B.list.length ? B.list.slice(0, 3).map((x, i) => { const sel = bd && K(bd.add) === K(M.P[x.id].n); const tag = sel && bd.worth ? (bd.wait ? ['a', 'Wait until Monday'] : ['g', bd.chosen ? 'Your pick' : 'Best pickup']) : null; const sv = (sel ? B.swap(x.id, bd.drop).g : x.gain) * w;
      return `<div class="mvl"><span>${i + 1}</span><b>${esc(M.P[x.id].n)}</b>${tag ? ` <span class="fk ${tag[0]}">${tag[1]}</span>` : ''} <i>${(sel ? bd.drop : x.drop) ? 'for ' + esc(M.P[sel ? bd.drop : x.drop].n) : 'into your empty spot'}</i> <b>${cn(sv)}</b></div>`; }).join('') + `<div class="mvf"><button class="lnk" data-gotab="players">Open the full list</button></div>` : `<div class="strnone">No free agents to rate yet.</div>`;
    // 3 · build around
    const keep = V.mine.filter(r => r.kind === 'fits' && r.read).sort((a, b) => b.read.val - a.read.val).slice(0, 5);
    h += `<div class="h mvh"><span>3 · Build around</span><span class="sub">${keep.length} player${keep.length === 1 ? '' : 's'}</span></div>` + (keep.length ? `<div class="sub mvsubl">${keep.map(r => `${esc(r.n)} <b class="plus">${cn(r.read.val * w)}</b>`).join(' · ')}: what your team would lose without each, over the rest of the season. No free agent or trade at their value does better.</div>` : `<div class="strnone">Nobody on your roster clearly earns his spot yet.</div>`);
    return h; }
  // the rules behind every read, in plain words (the same thresholds the code uses)
  function howItWorks(lg, V) { const th = V.th; const pc = x => Math.round(x * 100); const PK = pickOf(lg); const M = modelFor(lg); const tb = M ? tradeBarOf(lg, M) : 1.5;
    return `<div class="how"><p><b>Where the numbers come from.</b> Basketball Monster's rest-of-season projections (they already take in this season's games), its Analysis Monster team projections, and Yahoo's rosters, injury statuses and league settings. Nothing else, and no forecasts of the co-pilot's own.</p>
      <p><b>One measure, every page.</b> Your expected categories won a week over the rest of the season, through the end of your playoffs, against every other team in your league, on Basketball Monster's projections (games each player is expected to play, times his per-game stats). Punted categories count as a usual loss, whatever the move. Every decision is a change in that one number: Players, Week, Team, Strategy and the cards on Yahoo's pages all read the same result, so they can't disagree. Changes are shown as categories over the rest of the season.</p>
      <ul><li><b>A player's value to you</b>: what the number loses without him. A player who holds up a category you win is worth a lot to you even if his overall rank is modest, because taking him out costs that category.</li>
      <li><b>A pickup</b>: what the number gains when he replaces one of your players. His drop is whoever leaves your team best off (never a player in an injured-list spot, one you chose to keep, or one you added in the last two weeks). The Players page lists the top 30 of every Basketball Monster free agent this way, with a guard, forward and centre filter.</li>
      <li><b>A trade</b>: what the number gains after the swap. A sell is a player for whom a one-for-one trade at his Basketball Monster value (or a little less) adds at least ${cn(tb)} categories over the rest of the season.</li></ul>
      <p><b>Pickups</b> (${esc(PK.t)}). ${esc(PK.w)} <b>Best pickup</b> is the list's number 1 when it clears that bar. <b>Wait until Monday</b>: it clears the bar but adding now costs this week (more than 0.15 of a category against this week's opponent), or you have no adds left. <b>Stream this week only</b>: not a keeper, but worth more this week in the categories still in play than its drop costs over the next few weeks. This week and next are timing only; they never change the order.</p>
      <p><b>Your build.</b> For each category, the co-pilot counts how many teams Basketball Monster projects you to beat from here. <i class="fd n"></i>Lost: under ${pc(th.dead)}% of teams. <i class="fd a"></i>Swing: up to ${pc(th.safe)}%. <i class="fd gr"></i>Winning: up to ${pc(th.locked)}%. <i class="fd g"></i>Locked: above that. Categories you punt always count as lost. The bands describe your team; the reads below come from the one measure.</p>
      <p><b>Reading your players.</b></p>
      <ul><li><i class="fd r"></i><b>${FIT.costs[1]}</b>: a free agent in the top 10 adds at least your pickup bar in his place. He's the drop on the Players page.</li>
      <li><i class="fd a"></i><b>${FIT.holds[1]}</b> / <b>${FIT.wasted[1]}</b>: a sell (above). Which of the two depends on whether his output sits mostly in categories you win or in ones you've lost.</li>
      <li><i class="fd g"></i><b>${FIT.fits[1]}</b>: none of the above, in the top two thirds of your roster by value to you.</li>
      <li><i class="fd n"></i><b>${FIT.small[1]}</b>: none of the above, in the bottom third.</li></ul>
      <p><b>Other teams' players</b> (Finder, trade targets): what each would add in place of your least valuable player, or in a one-for-one for the player you're moving.</p>
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
  function teamNeedsAll(lg, M, r) { return M.L.teams.filter(t => t.tid !== M.L.me).map(t => { const N = teamNeeds(lg, M, t.tid); if (!N) return null; const cats = N.need.filter(c => (r.cv[c] || 0) >= 0.5); return cats.length ? { tid: t.tid, cats } : null; }).filter(Boolean).sort((a, b) => b.cats.length - a.cats.length).slice(0, 4); }
  function wireStrategy(lg, M) { const o = $('out'); const s0 = S(lg);
    o.querySelectorAll('[data-stab]').forEach(b => b.onclick = () => { window.STAB = b.dataset.stab; render(); });
    o.querySelectorAll('[data-findmoves]').forEach(b => b.onclick = () => { b.classList.add('busy'); b.innerHTML = '<span class="spinner" aria-hidden="true"></span>Reading your roster against Analysis Monster…'; setTimeout(() => { window.STAB = 'moves'; render(); window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); }, REDUCED ? 0 : 650); });
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
    const st = r => String(r.inj || '').trim().toUpperCase();
    return y.rows.some(r => /^IL/.test(r.slot) && !(/^(INJ|O|OUT|IL|NA|SUSP)$/.test(st(r)) || (/\+/.test(r.slot) && /^(GTD|DTD|D|Q)$/.test(st(r))))); }
  // a swap fixes it (an injured player of yours takes his IL spot), there's an open spot, or someone has to be dropped (and who) ----
  function ilBackCard(p, lg) { const y = yrFor(lg); if (!y || !y.rows || Date.now() - y.ts > 36 * 3600e3) return '';
    const st = r => String(r.inj || '').trim().toUpperCase();
    const okIn = (slot, r) => /^(INJ|O|OUT|IL|NA|SUSP)$/.test(st(r)) || (/\+/.test(slot) && /^(GTD|DTD|D|Q)$/.test(st(r)));
    const same = (a, b) => NAMES.same(a, b);
    // 1. must move: healthy but still in an IL spot (Yahoo's own "over the max roster size" warning is the final word; when the
    //    statuses don't single anyone out, the IL player with the mildest status is the one Yahoo now counts as active)
    let back = y.rows.filter(r => /^IL/.test(r.slot) && !okIn(r.slot, r));
    const SEV = r => { const x = st(r); return !x ? 0 : /^(Q|GTD|DTD|P)$/.test(x) ? 1 : /^D$/.test(x) ? 2 : /^(O|OUT)$/.test(x) ? 3 : 4; };
    if (!back.length && y.illegal) { const ils = y.rows.filter(r => /^IL/.test(r.slot)).sort((a, b) => SEV(a) - SEV(b)); if (ils.length) back = [ils[0]]; }
    // 2. the plan starts him: on an IL spot (allowed to stay there) but projected to play, so using him means bringing him back
    const t = usToday(); const pdays = ((p && (p.nowDays || p.days)) || []).filter(d => d.open !== false && d.date >= t);
    const firstStart = n => { const d = pdays.find(d => (d.start || []).some(x => same(x.name, n))); return d ? d.date : null; };
    // (only once Yahoo no longer lists him as out: an out player is exactly who an IL spot is for, so he stays there)
    const ready = y.rows.filter(r => /^IL/.test(r.slot) && !back.includes(r) && !/^(O|OUT|INJ|IL|NA|SUSP)$/.test(st(r)) && firstStart(r.name));
    if (!back.length && !ready.length) return '';
    const nm = r => esc(r.name); const and = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
    const val = n => (p && p.rosVal || []).find(x => same(x.name, n)) || null;
    // open roster spots = non-IL roster spots in the league settings minus players not on the IL. An empty starting slot in
    // the lineup is NOT a free roster spot (a full roster can still show an empty SG), so the lineup's gaps don't count.
    const sp = ST['ysetp:' + y.lid] || {}; const R0 = {};
    const cap = sp.slots && sp.slots.length && sp.bench != null ? sp.slots.length + sp.bench : R0.spots || null;
    const onRoster = y.rows.filter(r => !/^IL/.test(r.slot)).length;
    const openSpots = cap ? Math.max(0, cap - onRoster) : 0;
    const swap = y.rows.filter(r => !/^IL/.test(r.slot) && okIn('IL', r)); // injured players of yours who could take his IL spot
    // who'd go if a drop is needed: your least valuable healthy players not on the IL (plan values for the rest of the season)
    const pool = (p && p.rosVal || []).filter(x => !x.out && !x.keep && y.rows.some(r => same(r.name, x.name) && !/^IL/.test(r.slot)));
    const L = y.lid && y.tid ? `https://basketball.fantasysports.yahoo.com/nba/${y.lid}/${y.tid}` : null;
    let h = `<div class="card ilb"><div class="h"><span>Back from injury</span></div>`;
    if (back.length) { const sure = back.every(r => !okIn(r.slot, r));
      h += `${ilBlocked(y) ? `<div class="vd bad">Yahoo is blocking lineup changes until this is fixed</div>` : ''}<div class="vd warn">${and(back.map(nm))} ${sure ? (back.length > 1 ? 'are' : 'is') + ' healthy but still in an injured-list spot' : `(${esc(st(back[0]) || 'no status')}) is most likely the one Yahoo now counts as active`}</div><div class="sub hls">Yahoo won't accept any lineup change, including the co-pilot's, until ${back.length > 1 ? 'they move' : 'he moves'} off it.</div>`; }
    // one plan for everyone coming off the IL: injured swaps first, then genuinely open roster spots, then a named drop
    // (players who must move now are handled before players the plan only starts later in the week)
    const dropped = []; const left = () => pool.filter(x => !dropped.some(d => same(d.name, x.name)));
    let open = openSpots; const swaps = swap.slice(); const steps = []; let drops = 0;
    const dayOf = d => d === t ? 'Today' : fmtD(d);
    back.forEach(r => {
      if (swaps.length) { const s = swaps.shift(); steps.push(`<b>Now:</b> move <b>${nm(s)}</b> (${esc(st(s))}) into the injured-list spot and <b>${nm(r)}</b> to the bench. No drop needed.`); return; }
      if (open > 0) { open--; steps.push(`<b>Now:</b> move <b>${nm(r)}</b> to the bench. You have an open roster spot, so no drop is needed.`); return; }
      const v = val(r.name); const d = left().concat(v ? [v] : []).sort((x, y) => x.season - y.season)[0]; drops++;
      if (!d) { steps.push(`<b>Now:</b> your roster is full. Drop your least valuable healthy player, then move <b>${nm(r)}</b> to the bench.`); return; }
      if (same(d.name, r.name)) { steps.push(`<b>Now:</b> your roster is full and <b>${nm(r)}</b> is worth less to your team than anyone else on it, so drop <b>${nm(r)}</b> himself.`); return; }
      dropped.push(d); steps.push(`<b>Now:</b> your roster is full. Drop <b>${esc(d.name)}</b>: the lowest rest-of-season value on your roster for your build${d.gp != null ? ` (${d.gp} games projected from next week)` : ''}. Then move <b>${nm(r)}</b> from the injured list to the bench.`); });
    ready.forEach(r => { const when = firstStart(r.name);
      const lead = `<b>${esc(dayOf(when))}:</b> `;
      if (swaps.length) { const s = swaps.shift(); steps.push(lead + `move <b>${nm(s)}</b> into the injured-list spot and <b>${nm(r)}</b> to the bench. No drop needed.`); return; }
      if (open > 0) { open--; steps.push(lead + `move <b>${nm(r)}</b> to the bench. You have an open roster spot.`); return; }
      const v = val(r.name), w = left()[0];
      if (v && w && v.perWk <= w.perWk) { steps.push(`Leave <b>${nm(r)}</b> on the injured list for now: he's worth less to you than <b>${esc(w.name)}</b>, the player you'd have to drop. Don't start him until that changes.`); return; }
      drops++; if (!w) { steps.push(lead + `drop your least valuable healthy player and move <b>${nm(r)}</b> to the bench.`); return; }
      dropped.push(w); steps.push(lead + `drop <b>${esc(w.name)}</b> and move <b>${nm(r)}</b> to the bench (your roster has no spare spot).`); });
    if (ready.length && steps.length > back.length) { const rs = ready.filter(r => steps.some(x => x.includes('<b>' + nm(r) + '</b> to the bench'))); if (rs.length) h += `<div class="vd warn">${and(rs.map(nm))} ${rs.length > 1 ? 'are' : 'is'} on your injured list but the plan starts ${rs.length > 1 ? 'them' : 'him'} from ${esc(fmtD(firstStart(rs[0].name)))}</div>`; }
    h += `<div class="sub hls">${drops ? `${cap ? `${onRoster} of your ${cap} roster spots outside the injured list are filled, so ` : 'Your roster is full, so '}${drops > 1 ? drops + ' players have' : 'one player has'} to be dropped.` : 'No one needs to be dropped.'}</div>`;
    if (!steps.length) return '';
    h += `<ol class="ilsteps">${steps.map(x => `<li>${x}</li>`).join('')}</ol>`;
    if (L) h += `<div class="acts"><a class="btn small" href="${esc(L)}" target="_blank" rel="noopener">Open your team on Yahoo</a></div>`;
    return h + `<div class="sub" style="margin-top:8px">Roster and statuses from your Yahoo team page ${esc(ago(y.ts))}.</div></div>`; }
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
  function syncBar() {
    const lg = league(); const y = leaguesKnown().find(l => l.league === lg); const st = y && ST['sync:' + y.lid]; const lk = ST.syncLock && Date.now() - ST.syncLock.ts < 4 * 60e3;
    const pr = ST.syncProgress && Date.now() - ST.syncProgress.ts < 3 * 60e3 ? ST.syncProgress.msg : '';
    const good = y ? (lastGood(y.lid) || (st && st.ok ? st.ts : 0)) : 0;
    // one status line: what's happening, or the most important thing that's late (amber: it fixes itself; details in Settings)
    const H = healthNow[lg] || { iss: [] }; const top = H.iss.find(i => i[0] === 'bad') || H.iss.find(i => i[0] === 'warn') || H.iss[0];
    const left = syncing || lk ? `<span>${esc(pr ? 'Syncing ' + pr + '…' : 'Syncing…')}</span>` : top ? `<button class="stl" id="healthB" title="${esc(H.iss.map(i => i[1]).join('\n'))}"><i class="dot ${top[0] === 'bad' ? 'd-warn' : ''}"></i>${esc(top[1])}${H.iss.length > 1 ? ` <span class="muted">+${H.iss.length - 1}</span>` : ''}</button>` : `<span>${good ? 'Updated ' + ago(good) : 'Not synced yet'}</span>`;
    $('syncbar').innerHTML = `${left}<button class="lnk${syncing || lk ? ' busy' : ''}" id="syncNow" ${syncing ? 'disabled' : ''}>${ICON.sync} Sync</button>`;
    { const hb = $('healthB'); if (hb) hb.onclick = () => showSettings(true, 'diag'); }
    $('syncNow').onclick = () => runSync(true);
  }
  // syncs run in the background only (never two at once); the panel asks for one and follows its progress
  async function runSync(force, now) {
    if (syncing) return; syncing = !!force; if (force) syncBar();
    let asked = false; try { const r = await browser.runtime.sendMessage({ target: 'bg', cmd: force ? 'syncNow' : 'syncDue', now: !!now }); asked = !!(r && r.ok); } catch (e) {}
    if (!asked && window.SYNC) { syncing = true; syncBar(); try { await window.SYNC.auto(force, m => { ST.syncProgress = { msg: m, ts: Date.now() }; syncBar(); }, { by: 'panel', lightMin: 15, now: !!now }); } catch (e) { console.error(e); } }
    else if (force) { const t0 = Date.now(); await new Promise(z => { const iv = setInterval(() => { const lk = ST.syncLock && Date.now() - ST.syncLock.ts < 4 * 60e3; if ((!lk && Date.now() - t0 > 4000) || Date.now() - t0 > 8 * 60e3) { clearInterval(iv); z(); } }, 1000); }); }
    syncing = false; ST = await browser.storage.local.get(null); DV++; render(); if (force) toast('Synced with Yahoo and Basketball Monster', 'ok');
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
  browser.storage.local.get(null).then(all => { ST = all; DV++; render(); runSync(false); });
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
      if (k === 'yWeek') { re = true; const w = v.newValue; if (w && w.done && !(v.oldValue && v.oldValue.done && v.oldValue.id === w.id)) setTimeout(() => afterWeek(w), 300); } if (k === 'syncLock' || k === 'syncProgress') syncBar(); if (k === 'health' || k === 'bbmAuth') re = true; if (/^(ymine$|leagueList$|mm:|mmw:|yr:|mmLast|tx:|ysetp:|bbmnews$|ylu:|ylive:|ystand:|lgweek:|ysched:|ytrend:|ytrendMy:|bbmstand:|bbmtm:|yavail:|alerts$|bx:|sset:|ypage$)/.test(k)) re = true; });
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
