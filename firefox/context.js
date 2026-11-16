// Page-aware cards: reads what you're doing on Yahoo (trade, add/drop, player lists) and answers it from live BBM projections.
(function (root) {
  const H = root.H2H;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nk = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.'’`]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/gi, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const TEAMC = { NOR: 'NOP', NO: 'NOP', PHO: 'PHX', GS: 'GSW', SA: 'SAS', NY: 'NYK', UTAH: 'UTA', WSH: 'WAS', BRK: 'BKN', CHO: 'CHA' };
  const tc = t => { t = String(t || '').toUpperCase(); return TEAMC[t] || t; };
  const sur = n => { const w = String(n).split(' ').filter(x => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(x)); return w[w.length - 1] || n; };
  // values are shown in the league's own currency: extra categories won a week (categories leagues) or win-chance points
  let UNIT = null; const WWC = () => UNIT ? 'categories won a week' : 'weekly win chance';
  const pts = v => { if (UNIT) { const r = Math.round(v * UNIT * 100) / 100; return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(2); } const r = Math.round(v * 1000) / 10; return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(Math.abs(r) >= 10 ? 0 : 1); };
  const gw = n => n == null ? '' : n === 1 ? '1 game this week' : n + ' games this week';
  // how much something helps, in words (the number sits in the detail): per-week changes, or totals over the season
  const GW = (v, season) => { const c = season ? v : UNIT ? v * UNIT : v * 10; const a = Math.abs(c); const T = season ? [0.5, 2, 5] : [0.05, 0.2, 0.5]; const k = a < T[0] ? 0 : a < T[1] ? 1 : a < T[2] ? 2 : 3;
    if (!k) return ['n', 'About even']; return c > 0 ? ['g', ['', 'Helps you a little', 'Helps you clearly', 'Helps you a lot'][k]] : ['r', ['', 'Costs you a little', 'Costs you clearly', 'Costs you a lot'][k]]; };
  const GC = (v, season) => { const g = GW(v, season); return `<span class="fk ${g[0]}">${g[1]}</span>`; };
  const tn = c => ((root.STRAT && root.STRAT.TEAMN) || {})[String(c || '').trim().toUpperCase()] || c || '';
  const pctTo = c => `${Math.round(c.from * 100)}% → ${Math.round(c.to * 100)}%`;
  const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min old' : Math.round(m / 60) + ' h old'; };
  // a league's categories: the ones Matchup Monster shows for it, else the value columns Basketball Monster keeps for it
  const CATORDER = ['p', '3', 'r', 'a', 's', 'b', 'fg%', 'ft%', '2d', 'fg', 'ft', 'to'];
  const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);

  // ---- the data model for one league: players (all views), name lookup, teams, free agents ----
  function model(ST, lid, o) {
    const bx = ST['bx:' + lid]; if (!bx || !bx.views || !(bx.views.ros || bx.views.rest)) return null;
    const V = bx.views; const P = {}; const byName = {};
    new Set(Object.keys(V.rest || {}).concat(Object.keys(V.ros || {}))).forEach(id => { const b = (V.rest || {})[id] || {}, r = (V.ros || {})[id] || {};
      // rest of season: BBM's totals file (games left to your league's final week) with the value from the Remaining Season view
      const tot = bx.tot && bx.tot[id]; const rv = (V.ros && V.ros[id]) || (V.rest && V.rest[id]);
      const ros = tot ? { g: tot.g, m: tot.m || (rv ? rv.m : null), lv: rv ? rv.lv : 0, st: tot.st, cv: rv ? rv.cv : null } : (V.ros && V.ros[id]);
      const p = { id, n: b.n || r.n, t: tc(b.t || r.t), pos: b.pos || r.pos, inj: b.inj || r.inj, notes: (b.notes || []).concat(r.notes || []), rank: r.rank || b.rank, rest: V.rest && V.rest[id], next: V.next && V.next[id], ros, po: V.po && V.po[id], form: V.form && V.form[id], season: V.season && V.season[id] };
      if (!p.n) return; P[id] = p; (byName[nk(p.n)] = byName[nk(p.n)] || []).push(id); });
    // name match, then known nicknames, then surname + team (Cameron/Cam Johnson, Nicolas/Nic Claxton…)
    const ALIAS = { 'cameron johnson': 'cam johnson', 'nicolas claxton': 'nic claxton', 'herbert jones': 'herb jones', 'alexandre sarr': 'alex sarr', 'kenyon martin': 'kj martin', 'moe wagner': 'moritz wagner' };
    const last = n => { const w = nk(n).split(' '); return w[w.length - 1]; };
    const find = (n, t) => { let c = byName[nk(n)] || byName[ALIAS[nk(n)] || ''] || Object.entries(ALIAS).filter(([a, b]) => b === nk(n)).map(([a]) => byName[a]).find(Boolean) || [];
      if (!c.length && t) c = Object.keys(P).filter(id => P[id].t === tc(t) && last(P[id].n) === last(n));
      if (c.length <= 1) return c[0] || null; return c.find(id => P[id].t === tc(t)) || c[0]; };
    const yidmap = Object.assign({}, ST.yidmap || {});
    const ofYid = (yid, info) => { if (yidmap[yid] && P[yidmap[yid]]) return yidmap[yid]; const id = info ? find(info.n, info.t) : null; if (id) yidmap[yid] = id; return id; };
    const y = o.yr; const lg = ST['lgscan:' + lid];
    const teams = (lg && lg.teams || []).map(t => ({ tid: String(t.tid), name: t.name, ids: t.players.map(n => find(n)).filter(Boolean) })).filter(t => t.ids.length >= 5);
    if (y && y.rows && y.rows.length) { const mine = y.rows.map(r => find(r.name, r.team)).filter(Boolean); const t = teams.find(t => t.tid === String(y.tid)); if (t) t.ids = mine; else teams.push({ tid: String(y.tid), name: y.teamName, ids: mine }); }
    const taken = new Set(); teams.forEach(t => t.ids.forEach(id => taken.add(id)));
    // your players in injured-list spots: dropping one frees no roster spot, so they're never offered as a pickup's drop
    const ilIds = new Set(y && y.rows ? y.rows.filter(r => /^IL/.test(r.slot || '')).map(r => find(r.name, r.team)).filter(Boolean) : []);
    const fas = Object.keys(P).filter(id => !taken.has(id) && P[id].ros && P[id].ros.g > 0 && !/out for season/i.test(P[id].inj || ''));
    const today = o.today; const wkEnd = (y && y.weekEnd) || o.weekEnd || addDay(today, 6 - ((new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7));
    const seasonEnd = (o.rules && o.rules.playoffs && o.rules.playoffs.end) || addDay(today, 150);
    const cvKeys = (() => { const v = V.ros || V.rest || {}; const k = new Set(); Object.values(v).slice(0, 50).forEach(r => Object.keys((r && r.cv) || {}).forEach(c => { if (r.cv[c] != null) k.add(c); })); return CATORDER.filter(c => k.has(c)); })();
    const cats = (o.cats && o.cats.length ? o.cats : cvKeys.length >= 5 ? cvKeys : ['p', '3', 'r', 'a', 's', 'b', 'fg%', 'ft%', 'to']);
    const slots = y && y.rows ? Math.max(8, y.rows.filter(r => r.slot !== 'BN' && !/^IL/.test(r.slot)).length) : 10;
    // playoffs: all three playoff weeks on the real NBA schedule (BBM's own view covers only the first)
    const PO = o.rules && o.rules.playoffs; const SCH = (ST.nbasched && ST.nbasched.by) || (globalThis.NBA_SCHED && globalThis.NBA_SCHED.by); let poDays = 7, has3 = false;
    if (PO && SCH) { const key = t => t === 'NOP' ? 'NOR' : t === 'PHX' ? 'PHO' : t; poDays = daysBetween(PO.start, PO.end) + 1;
      Object.values(P).forEach(p => { const L0 = SCH[key(p.t)] || SCH[p.t]; if (!L0 || !p.ros) return; const g = L0.filter(d => d >= PO.start && d <= PO.end).length; p.po = { g, lv: p.ros.lv, st: p.ros.st }; has3 = true; }); }
    UNIT = o.obj === 'cats' ? cats.length : null;
    const ctx = { obj: o.obj === 'cats' ? 'cats' : 'win', P, cats, slots, days: { rest: Math.max(1, daysBetween(today, wkEnd) + 1), next: 7, ros: Math.max(7, daysBetween(today, seasonEnd) + 1), po: has3 ? poDays : 7 }, ddRate: bx.dd || {}, has: { rest: !!V.rest, ros: !!V.ros, po: has3 || !!V.po, next: !!V.next } };
    // rest of season: the opponents actually left on your schedule
    const sched = y && y.weeks ? y.weeks.filter(w => w.start > wkEnd && (!PO || w.start < PO.start) && w.oppTid).map(w => String(w.oppTid)) : [];
    // without the API: the opponents left on your schedule come from Yahoo's league page (read once and kept)
    if (!sched.length && y) schedOf(ST, lid, y).forEach(r => sched.push(r.opp));
    const L = { me: y ? String(y.tid) : null, teams, oppNow: y && y.oppTid ? String(y.oppTid) : null, fas, sched: sched.filter(t => teams.some(x => x.tid === t)) };
    // how much playoffs count: their share of the weeks left
    const stand = ST['ystand:' + lid], sp = ST['ysetp:' + lid] || {}; const ys = { numPlayoffTeams: sp.poTeams || null, playoffStartWeek: (sp.poWeeks || [])[0] || null }; let standing = null;
    if (stand && stand.teams && y) { const me = stand.teams.find(t => String(t.tid) === String(y.tid)); const nPO = (ys && ys.numPlayoffTeams) || Math.round(stand.teams.length / 2); const poWeek = (ys && ys.playoffStartWeek) || 18;
      const phase = Math.max(0, Math.min(1, ((stand.week || 1) - 1) / Math.max(1, poWeek - 1))); const rank = me ? me.rank : null;
      const secure = rank && phase > 0.3 && rank <= nPO - 2, bubble = rank && phase > 0.3 && Math.abs(rank - nPO) <= 1;
      // playoff weeks count by their share of the weeks left (3 playoff weeks against the regular-season weeks still to play)
      const regLeft = Math.max(0, poWeek - (stand.week || 1)); const wpo = 3 / (regLeft + 3);
      standing = { rank, of: stand.teams.length, nPO, phase, wpo, secure, bubble, rec: me ? me.w + '-' + me.l + (me.t ? '-' + me.t : '') : '' }; ctx.wpo = wpo; }
    else ctx.wpo = 0.2;
    // your punt, set in the co-pilot's Settings (Basketball Monster's own punt settings are only offered as a one-off copy)
    ctx.punt = Array.isArray(o.punt) && o.punt.filter(c => cats.includes(c)).length ? o.punt.filter(c => cats.includes(c)) : null;
    ctx.puntBbm = bx.punt && !bx.punt.unsure && bx.punt.cats ? bx.punt.cats.filter(c => cats.includes(c)) : null;
    // self-correction: how sure the model should be, learned from past weeks' forecasts against Yahoo's final results
    const cal = calibrate(ST, lid); ctx.sdMul = cal.mul;
    // other managers: who'd grab a player you drop, and who Yahoo is grabbing right now
    const fasW = fas.map(id => (P[id].ros ? (P[id].ros.lv || 0) * (P[id].ros.g || 0) : -99)).sort((a, b) => b - a); const snapBar = fasW[2] != null ? fasW[2] : -99;
    const snapRisk = id => { const p = P[id]; return !!(p && p.ros && (p.ros.lv || 0) * (p.ros.g || 0) > snapBar && snapBar > -99); };
    const TR = (ST['ytrend:' + lid] || {}).players || {}; const trByName = {}; Object.entries(TR).forEach(([n, v]) => trByName[nk(n)] = v); const trend = n => trByName[nk(n)] || null;
    // one of the 10 most-added free agents on Yahoo today (net adds across all Yahoo leagues), or the API's ownership jump
    const hot = n => { const t = trend(n); if (!t) return ''; if (t.hot) return 'most added on Yahoo today (+' + t.net.toLocaleString('en-US') + ')'; if (t.delta >= 5) return 'rising: +' + Math.round(t.delta) + '% rostered on Yahoo'; return ''; };
    const com = (n, t) => (bx.com || {})[nk(n) + '|' + tc(t)] || (bx.com || {})[nk(n) + '|' + String(t || '').toUpperCase()] || Object.entries(bx.com || {}).find(([k]) => k.split('|')[0] === nk(n)) && Object.entries(bx.com || {}).find(([k]) => k.split('|')[0] === nk(n))[1] || null;
    // Yahoo's ranking for every rostered player (from the team pages), for judging what other managers will accept
    const yrk = {}; ((lg && lg.teams) || []).forEach(t => Object.entries(t.ranks || {}).forEach(([n, r]) => { const id = find(n); if (id) yrk[id] = r; }));
    // Yahoo player ids: from the league's team pages, then anything seen on Yahoo pages (players you've looked at, trends)
    const yidOf = {}; ((lg && lg.teams) || []).forEach(t => Object.entries(t.yids || {}).forEach(([n, y]) => { const id = find(n); if (id) yidOf[id] = y; }));
    Object.entries(yidmap).forEach(([y, id]) => { if (!yidOf[id]) yidOf[id] = y; }); Object.entries((ST['ytrend:' + lid] || {}).players || {}).forEach(([n, v]) => { const id = v.yid && find(n); if (id && !yidOf[id]) yidOf[id] = v.yid; });
    return { ilIds, yid: id => yidOf[id] || null, yrank: id => yrk[id] || null, prof: profiles(ST, lid, cats), bx, P, ctx, L, standing, cal, snapRisk, trend, hot, find, ofYid, yidmap, com, teamName: tid => (teams.find(t => t.tid === String(tid)) || {}).name || ('team ' + tid) };
  }
  // ---- the league so far, from Yahoo's final matchup results (raw results only: they don't feed the recommendations) ----
  const curWeek = (ST, lid, y) => (ST['ylive:' + lid] || {}).week || (y && y.src !== 'page' ? y.week : null) || null;
  // your remaining regular-season opponents, week by week
  function schedOf(ST, lid, y, all) { const S = ST['ysched:' + lid]; const w0 = curWeek(ST, lid, y); if (!S || !S.weeks || !w0 || !y) return []; const me = String(y.tid);
    const ws = [...new Set(Object.keys(S.weeks).concat(Object.keys(S.mine || {})))].map(Number);
    return ws.filter(w => all ? w >= w0 : w > w0).sort((a, b) => a - b).map(w => { const pr = (S.weeks[w] || []).find(p => p.map(String).includes(me)); if (pr) return { week: w, opp: String(pr[0]) === me ? String(pr[1]) : String(pr[0]) };
      return S.mine && S.mine[w] ? { week: w, opp: String(S.mine[w]) } : null; }).filter(Boolean); }
  const VAL = (st, c) => c === 'fg%' ? (st.fga ? st.fg / st.fga : st['fg%']) : c === 'ft%' ? (st.fta ? st.ft / st.fta : st['ft%']) : st[c];
  // every team: categories won, lost and tied in each category across the finished weeks
  function profiles(ST, lid, cats) {
    const wk = Object.keys(ST).filter(k => k.startsWith('lgweek:' + lid + ':') && ST[k] && ST[k].teams).map(k => ST[k]).sort((a, b) => a.week - b.week); if (!wk.length) return null; const T = {};
    wk.forEach(W => Object.entries(W.teams).forEach(([tid, x]) => { const o = W.teams[x.opp]; if (!o || !x.st || !o.st) return;
      const t = T[tid] = T[tid] || { tid, name: x.name, weeks: 0, w: 0, l: 0, t: 0, cat: {} }; t.weeks++; t.name = x.name || t.name;
      cats.forEach(c => { const a = VAL(x.st, c), b = VAL(o.st, c); if (a == null || b == null || isNaN(a) || isNaN(b)) return; const k = t.cat[c] = t.cat[c] || { w: 0, l: 0, t: 0, n: 0, sum: 0 }; k.n++; k.sum += a;
        if (a === b) { k.t++; t.t++; } else if (c === 'to' ? a < b : a > b) { k.w++; t.w++; } else { k.l++; t.l++; } }); }));
    return { weeks: wk.map(w => w.week), teams: T };
  }
  // freshness line + what needs fetching before a verdict can be trusted
  function freshness(bx, need) { const ts = bx && bx.ts || {}; const ages = need.map(k => ts[k] ? Date.now() - ts[k] : Infinity); const worst = Math.max(...ages); return { worst, line: isFinite(worst) ? "BBM data " + ago(Date.now() - worst) : "BBM data not loaded" }; }

  const joshLine = (M, id) => { const p = M.P[id]; if (!p) return ''; const c = M.com(p.n, p.t); const note = (p.notes || []).slice().sort((a, b) => (a.age || 1e9) - (b.age || 1e9))[0];
    const t = note ? note.text : c ? c.text : ''; if (!t) return ''; return `<div class="nt" title="${esc(t)}"><b>Josh on ${esc(sur(p.n))}:</b> “${esc(t.length > 140 ? t.slice(0, 137) + '…' : t)}”</div>`; };
  const g = (M, id) => M.P[id] && M.P[id].rest ? M.P[id].rest.g : null;

  // ---- one trade, laid out the same everywhere (the deal list, Build, and Yahoo's trade and offer pages) ----
  // o.tm: Basketball Monster's Trade Monster results ({ by: { yourPlayer: [rows] } }); o.offer: an offer you received
  function dealView(M, d, o) { o = o || {};
    const yr = id => (M.yrank && M.yrank(id)) || null; const gl = id => ((M.P[id] || {}).ros || {}).g;
    const who = id => { const p = M.P[id] || {}; const r = yr(id); return `<span class="tdp"><b>${esc(p.n || id)}</b><small>${[r ? 'Yahoo rank ' + r : '', gl(id) != null ? gl(id) + ' games left' : ''].filter(Boolean).join(' · ')}</small></span>`; };
    const nm = id => esc((M.P[id] || {}).n || id);
    const cs = v => { const r = Math.round(v * 10) / 10; return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(1); };
    const cw = v => { const r = Math.round(v * 100) / 100; return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(2); };

    const pills = d.cats.filter(c => Math.abs(c.d) >= 0.01).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 8).map(c => `<span class="mt plain" title="Share of weeks you win ${esc(c.label)}: now, then after the trade"><b>${esc(c.label)}</b> ${pctTo(c)}</span>`).join('') || '<span class="sub">no category changes by 1 point or more</span>';
    const tc = (d.theirCats || []).filter(c => Math.abs(c.d) >= 0.03).sort((a, b) => b.d - a.d); const up = tc.filter(c => c.d > 0).slice(0, 3).map(c => c.label), dn = tc.filter(c => c.d < 0).slice(-3).reverse().map(c => c.label);
    // Basketball Monster's own view of a 1-for-1 (Trade Monster), when it has looked at that swap
    let tmL = ''; if (o.tm && o.tm.by && d.give.length === 1 && d.get.length === 1) { const row = (o.tm.by[d.give[0]] || []).find(x => x.id === d.get[0]);
      if (row) tmL = `<div class="sub">Basketball Monster's Trade Monster: your win rate ${row.t1 >= 0 ? '+' : ''}${row.t1}%, theirs ${row.t2 >= 0 ? '+' : ''}${row.t2}% · trade value ${row.give} given for ${row.get}.</div>`; }
    // the season so far next to the projection, for the players in the deal who have played enough to say anything
    const SL = { m: 'minutes', p: 'points', 3: '3-pointers', r: 'rebounds', a: 'assists', s: 'steals', b: 'blocks' }; const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
    const trend = id => { const p = M.P[id]; const x = p && p.ros, z = p && p.season; if (!x || !z || !(z.g >= 3) || !x.st || !z.st) return '';
      const ks = ['p', '3', 'r', 'a', 's', 'b'].filter(k => x.st[k] != null && z.st[k] != null).map(k => ({ k, d: Math.abs(z.st[k] - x.st[k]) / Math.max(0.5, x.st[k]) })).sort((a, b) => b.d - a.d).slice(0, 3).map(o => o.k);
      const bits = (x.m && z.m ? [`${f1(z.m)} minutes (${f1(x.m)})`] : []).concat(ks.map(k => `${SL[k]} ${f1(z.st[k])} (${f1(x.st[k])})`));
      return `<div class="sub"><b>${esc(p.n)}</b>, ${z.g} games: ${bits.join(' · ')}</div>`; };
    const trendH = d.get.concat(d.give).map(trend).join('');
    const timeH = '';
    const body = `${timeH}${trendH ? `<div class="label lbl2">This season so far (projection in brackets)</div>${trendH}` : ''}<div class="label lbl2">Your categories, rest of season</div><div class="mts">${pills}</div>
        <div class="sub"><b>${cs(d.mine.season)}</b> categories over the rest of the season: ${cw(d.mine.ros)} categories a week ${d.mine.board ? 'against your league through the end of your playoffs' : 'for the rest of the regular season'}${d.mine.po != null ? ` · ${cw(d.mine.po)} a week in the playoff weeks` : ''}.${d.cut.length ? ` You'd drop ${d.cut.map(nm).join(', ')} to make room.` : ''}${d.fill.length ? ` Frees ${d.fill.length > 1 ? d.fill.length + ' spots' : 'a spot'}: pick up ${d.fill.map(nm).join(', ')}.` : ''}</div>
        ${o.offer ? '' : `<div class="label lbl2">Their side</div><div class="sub">${d.theirs.season >= 0.5 ? `Helps them too (${cs(d.theirs.season)} categories this season)` : d.theirs.season > -0.5 ? 'About even for their categories' : `Costs them (${cs(d.theirs.season)} categories this season)`}${up.length ? `, stronger in ${esc(up.join(', '))}` : ''}${dn.length ? `, weaker in ${esc(dn.join(', '))}` : ''}.${d.theirCut.length ? ` They'd drop ${d.theirCut.map(nm).join(', ')}.` : ''}</div>
        ${tmL}`}`;
    return `<div class="tdl"><div class="tdl-t"><div class="tdl-sides"><div class="tds"><span class="lab plus">Get</span><span>${d.get.map(who).join('')}</span></div><div class="tds"><span class="lab minus">Give</span><span>${d.give.map(who).join('')}</span></div><div class="sub">${esc(M.teamName(d.tid))} · ${d.give.length}-for-${d.get.length}</div>${(() => { const N = o.needs; if (!N || !N.need.length || o.offer) return ''; const f = [...new Set(d.give.flatMap(id => N.helpOf(id).cats))]; return f.length ? `<div class="sub plus">Covers their need for ${esc(f.map(c => H.LBL[c]).join(', '))}</div>` : ''; })()}</div>
        <div class="tdl-n">${GC(d.mine.season, true)}<span>rest of season</span>${(() => { const f = M.finish && M.finish(d); return f ? `<span class="fin ${f.to < f.from ? 'plus' : f.to > f.from ? 'minus' : ''}" title="Projected finish in Basketball Monster's standings">${ordinal(f.from)} → ${ordinal(f.to)}</span>` : ''; })()}${d.timing ? `<span class="chip ${d.timing === 'now' ? 'safe' : 'toss-up'}" title="${d.timing === 'now' ? 'The season so far and Basketball Monster\'s projection both back it' : 'The season so far backs it; Basketball Monster\'s projection doesn\'t yet'}">${d.timing === 'now' ? 'Act now' : 'Watch'}</span>` : ''}${!o.offer && d.theirs && d.theirs.season >= 0.5 ? `<span class="chip safe">Helps both teams</span>` : ''}</div></div>
      ${o.open ? body : `<details class="tdd"><summary>Why</summary>${body}</details>`}${o.link || ''}</div>`; }

  // ---- trade card: the deal on Yahoo's screen, whether you're building it or it was offered to you ----
  function tradeCard(M, yp) {
    const ofY = y => M.ofYid(y, (yp.players || {})[y]); const me = M.L.teams.find(t => t.tid === M.L.me);
    const ownerOf = id => { const t = M.L.teams.find(t => t.ids.includes(id)); return t ? t.tid : null; };
    // rosters straight from the trade page when it lists them (freshest), only when they clearly are the right team's
    const overlap = (ids, t) => t && ids.filter(id => t.ids.includes(id)).length >= Math.min(ids.length, t.ids.length) / 2;
    if (yp.myRoster && yp.myRoster.length && me) { const ids = yp.myRoster.map(ofY).filter(Boolean); if (ids.length >= 8 && overlap(ids, me)) me.ids = ids; }
    // the other team's id on the page being your own means you're looking at it from the receiving end: an offer to you
    let them = String(yp.mid2 || ''); const toMe = !!them && them === String(M.L.me); if (toMe) them = '';
    if (yp.theirRoster && yp.theirRoster.length && them) { const ids = yp.theirRoster.map(ofY).filter(Boolean); const t = M.L.teams.find(t => t.tid === them); if (t && ids.length >= 8 && overlap(ids, t)) t.ids = ids; }
    // which side each player is on comes from whose roster he's on (an offer you received lists the other manager's side first)
    const giveY = yp.give || [], getY = yp.get || []; let listed = giveY.map(y => [y, 'give']).concat(getY.map(y => [y, 'get']));
    const offer = (!!yp.offer && !listed.length) || toMe;
    if (offer && !listed.length) listed = Object.keys(yp.players || {}).map(y => [y, null]);
    const miss = [], give = [], get = [];
    listed.forEach(([y, side]) => { const id = ofY(y); if (!id) { if (side) miss.push((yp.players[y] || {}).n || y); return; } const own = ownerOf(id);
      if (own === M.L.me || (!own && side === 'give')) { if (!give.includes(id)) give.push(id); } else if (own || side === 'get') { if (!get.includes(id)) get.push(id); } });
    const owners = [...new Set(get.map(ownerOf).filter(Boolean))]; if (owners.length === 1) them = owners[0];
    const name = them ? M.teamName(them) : 'another team';
    const S = root.TRADE && them ? root.TRADE.setup(M.ctx, M.L, M) : null; const N = them && M.needs ? M.needs(them) : null;
    const L = cs => cs.map(c => (root.STRAT ? root.STRAT.name(c) : H.LBL[c])); const and = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
    const sn = id => esc(sur((M.P[id] || {}).n || id));
    let h = `<div class="h"><span>${offer ? 'Offer from ' : 'Trade with '}${esc(name)}</span><span class="sub" id="ctxAge"></span></div>`;
    // building a trade: the companion (every player on both rosters priced as an addition to the deal as ticked)
    if (!offer && them && S) return h + companion(M, S, them, give, get, N, miss, L);
    // first thing to read: what this team needs (and what it's strong in or has given up on)
    if (N && N.need.length) { h += `<div class="hl">${esc(name)}'s swing categories: <b>${esc(and(L(N.need)))}</b></div>`;
      const bits = []; if (N.strong.length) bits.push('already winning ' + and(L(N.strong))); if (N.punt.length) bits.push('losing ' + and(L(N.punt)));
      if (bits.length) h += `<div class="sub hls">${esc(bits.join(' · ').replace(/^./, c => c.toUpperCase()))} (Basketball Monster's team values, your band cut-offs)</div>`; }
    if (offer && (owners.length > 1 || give.length > 3 || get.length > 3 || !give.length || !get.length)) return h + `<div class="sub">Open a single trade offer to see the verdict on it.</div>`;
    if (!give.length || !get.length) {
      if (N && N.helpers.length) h += `<div class="hlp"><span class="label">Your players who help there</span>${N.helpers.map(x => `<span class="hlpr"><b>${sn(x.id)}</b> <span class="muted">${esc(L(x.cats).join(', '))}</span></span>`).join('')}</div>`;
      return h + `<div class="sub" style="margin-top:8px">Tick players on both sides for the verdict.</div>` + (miss.length ? `<div class="sub minus">Not found in Basketball Monster: ${esc(miss.join(', '))}</div>` : ''); }
    if (owners.length > 1) return h + `<div class="sub">The players you've ticked are on more than one team.</div>`;
    const d = S && root.TRADE.evalDeal(S, them, give, get);
    if (!d) return h + `<div class="sub">Couldn't find ${esc(name)}'s roster yet. It arrives with the next sync.</div>`;
    // the verdict, in one line, with the same bar the deal list uses (+4 categories over the season, +5 in an 11-category league)
    const gv = GW(d.mine.season, true); h += `<div class="vd ${{ g: 'good', n: '', r: 'bad' }[gv[0]]}">${gv[1]} over the rest of the season</div>`;
    // does what you send fill their needs?
    if (N && N.need.length && !offer) { const fill = [...new Set(give.flatMap(id => N.helpOf(id).cats))];
      h += `<div class="sub hls">${fill.length ? `What you send is strong in <b>${esc(and(L(fill)))}</b>, ${fill.length > 1 ? 'all swing categories' : 'a swing category'} for them.` : `What you send isn't strong in any of their swing categories.`}</div>`; }
    h += dealView(M, d, { offer, tm: M.tm, needs: N });
    if (miss.length) h += `<div class="sub minus">Not found in Basketball Monster, left out: ${esc(miss.join(', '))}</div>`;
    { const extra = (M.ctx.punt ? `<div class="sub">Ignoring ${M.ctx.punt.map(c => H.LBL[c]).join(', ')} (your punt).</div>` : '') + (M.standing && d.mine.po != null ? `<div class="sub">Playoff weeks count for ${Math.round(S.wpo * 100)}% of the season total: their share of the weeks left.</div>` : '') + get.map(id => joshLine(M, id)).join('');
      if (extra) h += `<details class="more"><summary>Analyst notes and assumptions</summary>${extra}</details>`; }
    return h;
  }
  // ---- trade companion: while you build a trade on Yahoo, every player on their roster (what he'd add to the deal as it stands)
  // and on yours (what sending him would cost), in categories over the rest of the season on the one measure. Ticking players on
  // Yahoo re-prices everything against the new deal. The full verdict follows once both sides have a player. ----
  function companion(M, S, them, give, get, N, miss, L) {
    const and = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
    const team = M.L.teams.find(t => t.tid === them); const name = M.teamName(them);
    if (!team || !team.ids.length) return `<div class="sub">Couldn't find ${esc(name)}'s roster yet. It arrives with the next sync.</div>`;
    const cn = v => { const r = Math.round(v * 10) / 10; return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(1); };
    const tone = v => v >= 0.05 ? 'plus' : v <= -0.05 ? 'minus' : 'muted';
    const nm = id => esc((M.P[id] || {}).n || id);
    let h = '';
    // their categories, as chips: the swing ones are what they'll trade for
    if (N && (N.need.length || N.strong.length || N.punt.length)) h += `<div class="tcn">${N.need.length ? `<span class="tcn-l">They need</span>${L(N.need).map(c => `<span class="fk a">${esc(c)}</span>`).join('')}` : ''}${N.strong.length || N.punt.length ? `<div class="sub">${[N.strong.length ? 'Winning ' + and(L(N.strong)) : '', N.punt.length ? 'losing ' + and(L(N.punt)) : ''].filter(Boolean).join(' · ')}</div>` : ''}</div>`;
    // the deal so far
    const cur = root.TRADE.mySide(S, give, get); const both = give.length && get.length;
    h += `<div class="tcs"><div class="tcs-sides"><div><span class="lab plus">Get</span>${get.length ? get.map(nm).join(', ') : '<span class="muted">tick their players</span>'}</div><div><span class="lab minus">Give</span>${give.length ? give.map(nm).join(', ') : '<span class="muted">tick yours</span>'}</div>${cur.cut.length ? `<div class="sub">You'd drop ${cur.cut.map(nm).join(', ')} to make room</div>` : ''}${cur.fill.length ? `<div class="sub">Frees a spot for ${cur.fill.map(nm).join(', ')}</div>` : ''}</div>
      <div class="tcs-n ${give.length || get.length ? tone(cur.season) : 'muted'}"><b>${give.length || get.length ? cn(cur.season) : '0.0'}</b><span>for you, rest of season</span></div></div>`;
    // one row per player: tick state, name, the number; tap for what it does to your categories
    const LB = c => esc(root.STRAT ? root.STRAT.name(c) : H.LBL[c]);
    const row = (x, mine) => { const p = M.P[x.id] || {}; const fills = mine && N ? N.helpOf(x.id).cats : [];
      const up = (x.cats || []).filter(c => c.d >= 0.02).sort((a, b) => b.d - a.d).slice(0, 3).map(c => LB(c.c)), dn = (x.cats || []).filter(c => c.d <= -0.02).sort((a, b) => a.d - b.d).slice(0, 3).map(c => LB(c.c));
      const gl = p.ros && p.ros.g != null ? p.ros.g + ' games left' : '';
      return `<details class="tcr${x.inDeal ? ' in' : ''}" data-k="tcr${esc(x.id)}"><summary><i class="tck" aria-label="${x.inDeal ? 'In the deal' : 'Not in the deal'}"></i><span class="tcr-w"><b>${esc(p.n || x.id)}</b><small>${[p.pos, p.t].filter(Boolean).map(esc).join(' · ')}${fills.length ? ` · <span class="hint">fills their ${esc(and(L(fills)))}</span>` : ''}</small></span><span class="tcr-v ${tone(x.v)}">${cn(x.v)}</span></summary>
        <div class="tcr-d">${up.length ? `<div><span>Helps you</span>${up.join(', ')}</div>` : ''}${dn.length ? `<div><span>Costs you</span>${dn.join(', ')}</div>` : ''}${!up.length && !dn.length ? '<div>Barely moves any of your categories</div>' : ''}${(give.length || get.length) ? `<div><span>This deal</span>${x.inDeal ? `${cn(x.with)} with him, ${cn(x.without)} without${x.withoutFill && x.withoutFill.length ? ` (you'd pick up ${x.withoutFill.map(nm).join(', ')} instead)` : ''}` : `${cn(x.without)} now, ${cn(x.with)} with him`}</div>` : `<div><span>On his own</span>${mine ? 'sent for nothing, his spot filled from free agents' : S.board && S.board.open ? 'into your empty roster spot' : 'in place of your least valuable player'}</div>`}${gl ? `<div><span>Plays</span>${gl}</div>` : ''}${M.yrank && M.yrank(x.id) ? `<div><span>Yahoo rank</span>${M.yrank(x.id)}</div>` : ''}</div></details>`; };
    const sortIn = a => a.sort((x, y) => (y.inDeal - x.inDeal) || (y.v - x.v));
    const theirs = sortIn(root.TRADE.marginal(S, give, get, team.ids, 'get'));
    const mine = sortIn(root.TRADE.marginal(S, give, get, S.me.ids, 'give'));
    h += `<div class="tch"><span>${esc(name)}</span><span class="sub">what each adds to this deal</span></div><div class="tcl">${theirs.map(x => row(x, false)).join('')}</div>`;
    h += `<div class="tch"><span>Your roster</span><span class="sub">what sending each costs you</span></div><div class="tcl">${mine.map(x => row(x, true)).join('')}</div>`;
    h += `<div class="sub tcf">Categories won over the rest of the season against your league, the same measure as every page. Tick players on Yahoo and every number updates. Tap a player for what he does to your categories.</div>`;
    if (miss.length) h += `<div class="sub minus">Not found in Basketball Monster, left out: ${esc(miss.join(', '))}</div>`;
    // both sides ticked: the full verdict
    if (both) { const d = root.TRADE.evalDeal(S, them, give, get);
      if (d) { const gv = GW(d.mine.season, true); h += `<div class="vd ${{ g: 'good', n: '', r: 'bad' }[gv[0]]}" style="margin-top:12px">${gv[1]} over the rest of the season</div>` + dealView(M, d, { tm: M.tm, needs: N });
        const extra = (M.ctx.punt ? `<div class="sub">Ignoring ${M.ctx.punt.map(c => H.LBL[c]).join(', ')} (your punt).</div>` : '') + get.map(id => joshLine(M, id)).join('');
        if (extra) h += `<details class="more"><summary>Analyst notes and assumptions</summary>${extra}</details>`; } }
    return h; }
  // ---- add/drop card ----
  // the long-term part comes from the panel's one measure when it's available (M.board: categories over the rest of the season
  // against every team in your league); the this-week part stays this week's matchup
  const seasonDiff = (M, add, drop) => { if (!M.board) return null; return M.board.swap(add, drop).g * M.board.weeks; };
  const seasonFirst = (M, add, drops) => { if (!M.board) return drops; drops.forEach(d => { const sd = seasonDiff(M, add, d.drop); if (sd != null) { d.seas = sd; d.score = sd + d.week; } });
    return drops.slice().sort((a, b) => (b.seas != null ? b.seas : b.score) - (a.seas != null ? a.seas : a.score) || b.week - a.week); };
  const SGW = d => d.seas != null ? GW(d.seas, true) : GW(d.ros);
  function addCard(M, yp) {
    const add = M.ofYid(yp.apid, yp.players[yp.apid]); const an = (yp.players[yp.apid] || {}).n || 'this player';
    let h = `<div class="h"><span>Pickup</span><span class="sub" id="ctxAge"></span></div>`;
    if (!add) return h + `<div class="sub">${esc(an)} isn't in BBM's projections, so no verdict.</div>`;
    const mineNoIL = ((M.L.teams.find(t => t.tid === M.L.me) || {}).ids || []).filter(id => !(M.ilIds && M.ilIds.has(id))); // injured-list spots free no roster spot
    const choices = (yp.dropChoices && yp.dropChoices.length ? yp.dropChoices : []).map(y => M.ofYid(y, yp.players[y])).filter(id => id && !(M.ilIds && M.ilIds.has(id)));
    // an empty roster spot (and Yahoo isn't asking for a drop): a plain add, judged the same way as the Players page
    if (M.board && M.board.open && !choices.length) { const p = M.P[add]; const s = M.board.swap(add, null).g * M.board.weeks; const bar = M.pickBar || 0.75; const rk = M.board.list.findIndex(x => x.id === add);
      return h + `<div class="pname plus">+ ${esc(p.n)}</div><div class="when">${esc(tn(p.t))} · ${gw(g(M, add))}</div><div style="height:10px"></div><div class="vd ${s >= bar ? 'good' : ''}">${s >= bar ? 'Worth adding' : 'Not worth an add'}</div>
        <div class="sub hls">No drop needed: you have an empty roster spot. ${(s >= 0 ? '+' : '−') + Math.abs(s).toFixed(1)} categories over the rest of the season.${rk >= 0 ? ` Number ${rk + 1} of your top ${M.board.list.length} free agents on the Players page.` : ''}</div>` + joshLine(M, add); }
    // the same drop pool as the Players page: never a player the board keeps (injured list, your keeps, recent adds, top-half players)
    const keep = (M.board && M.board.keep) || new Set(); const pool = choices.filter(id => !keep.has(id));
    const r = H.pickup(M.ctx, M.L, add, pool.length ? pool : M.board ? M.board.order.map(x => x.id).slice(0, 10) : mineNoIL); if (r.err) return h + `<div class="sub">${esc(r.err)}</div>`;
    const p = M.P[add]; const nm = id => esc(sur(M.P[id].n));
    h += `<div class="pname plus">+ ${esc(p.n)}</div><div class="when">${esc(tn(p.t))} · ${gw(g(M, add))}${M.hot(p.n) ? ` · <span class="plus">${esc(M.hot(p.n))}</span>` : ''}</div><div style="height:10px"></div>`;
    r.drops = seasonFirst(M, add, r.drops); const top = r.drops.slice(0, 2); const b0 = top[0];
    if (b0 && b0.seas != null) { // the same bar and timing as the Players page
      const bar = M.pickBar || 0.75; const v = b0.seas >= bar ? (b0.week < -0.15 ? ['warn', 'Worth adding: wait until Monday (it costs this week)'] : ['good', 'Worth adding']) : b0.week >= 0.15 ? ['warn', 'Helps this week only'] : ['', 'Not worth an add'];
      const rk = M.board.list.findIndex(x => x.id === add); h += `<div class="vd ${v[0]}">${v[1]}</div>${rk >= 0 ? `<div class="sub hls">Number ${rk + 1} of your top ${M.board.list.length} free agents on the Players page.</div>` : ''}`; }
    else if (b0) { const gR = SGW(b0)[0], gW = GW(b0.week)[0]; const v = b0.score < 0 ? ['bad', 'Not worth an add right now'] : gR === 'g' && gW !== 'r' ? ['good', 'Worth adding'] : gR === 'g' ? ['good', 'Worth it long term, costs a little this week'] : gW === 'g' ? ['warn', 'Helps this week only'] : ['', 'Barely changes your team: probably not worth an add'];
      h += `<div class="vd ${v[0]}">${v[1]}</div>`; }
    const sm = (lab, v, season) => `<div class="gn"><span>${lab}</span><span>${GC(v, season)}<span class="gnum ${v >= 0 ? 'plus' : 'minus'}">${season ? (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + ' categories this season' : pts(v) + ' ' + WWC()}</span></span></div>`;
    h += `<div class="label" style="margin-top:4px">Best drops</div>` + top.map((d, i) => `<div class="drow${i ? '' : ' best'}"><div class="who"><b>${esc(M.P[d.drop].n)}</b><div class="when">${gw(g(M, d.drop))}${M.snapRisk(d.drop) ? ' · <span class="minus">likely snapped up</span>' : ''}</div></div><div class="nums">${sm('This week', d.week)}${d.seas != null ? sm('Rest of season', d.seas, true) : sm('Rest of season', d.ros)}</div></div>`).join('');
    const chosen = yp.dpid && M.ofYid(yp.dpid, yp.players[yp.dpid]);
    if (chosen) { const c = r.drops.find(d => d.drop === chosen); const b = r.drops[0];
      if (c && b && c.drop !== b.drop) h += `<div class="warn" style="margin-top:8px">You've picked <b>${nm(chosen)}</b>: dropping <b>${nm(b.drop)}</b> instead is better for your team${b.seas != null && c.seas != null ? ` (${(b.seas - c.seas).toFixed(1)} categories more over the season)` : ` (${pts(b.score - c.score)} ${WWC()})`}.</div>`;
      else if (c) h += `<div class="vd good">${nm(chosen)} is the right drop.</div>`; }
    h += joshLine(M, add);
    return h;
  }
  // ---- player lists: labels next to each available player + your top 3 ----
  // ---- Yahoo's player list: one list of free agents lives on the Players page (every Basketball Monster free agent, ranked by
  // the one measure). Here: which of the players on this Yahoo page are in it, at what rank ----
  function listCard(M, yp) {
    const B = M.board; let html = `<div class="h"><span>Players on this page</span><span class="sub" id="ctxAge"></span></div>`;
    if (!B) return { html: html + '<div class="sub">Your free-agent list appears once Basketball Monster\'s rest-of-season projections are in.</div>', labels: {} };
    const ids = [...new Set((yp.rows || []).filter(r => r.avail).map(r => M.ofYid(r.yid, yp.players[r.yid])).filter(Boolean))];
    if (!ids.length) return { html: html + '<div class="sub">No available players on this page. Filter Yahoo\'s list to available players.</div>', labels: {} };
    const hits = B.list.map((x, i) => ({ x, i })).filter(z => ids.includes(z.x.id));
    html += `<div class="hl">${hits.length ? `${hits.length} of the ${ids.length} available players here ${hits.length > 1 ? 'are' : 'is'} in your top ${B.list.length}` : `None of the ${ids.length} available players here make your top ${B.list.length}`}</div>`;
    if (hits.length) html += `<table class="pl">${hits.map(({ x, i }) => { const s = x.gain * B.weeks; return `<tr class="plr"><td><b>${i + 1}. ${esc(M.P[x.id].n)}</b><div class="sub">${esc(tn(M.P[x.id].t))} · ${x.drop ? 'drop ' + esc(sur(M.P[x.drop].n)) : 'no drop: empty spot'}</div></td><td class="v"><div class="gnum">${(s >= 0 ? '+' : '−') + Math.abs(s).toFixed(1)} this season</div></td></tr>`; }).join('')}</table>`;
    html += `<div class="sub" style="margin-top:4px">The full list, every Basketball Monster free agent ranked the same way, is below.</div>`;
    return { html, labels: {} };
  }
  // ---- forecast check: every pre-week category forecast (every matchup in the league, logged before the week starts, plus your own
  // next-week forecast from before) against Yahoo's final results. Fits how wide the forecasts should be (the spread multiplier that
  // makes them most likely given what happened) and scores them: the Brier score (0 = perfect, 0.25 = a coin flip). ----
  const resVal = (st, c) => !st ? null : c === 'fg%' ? (st['fg%'] != null ? st['fg%'] : st.fga ? st.fg / st.fga : null) : c === 'ft%' ? (st['ft%'] != null ? st['ft%'] : st.fta ? st.ft / st.fta : null) : st[c];
  function forecastPairs(ST, lid) { const pairs = []; const weeks = new Set();
    Object.keys(ST).filter(k => k.startsWith('lgfc:' + lid + ':')).forEach(k => { const fc = ST[k], lw = fc && ST['lgweek:' + lid + ':' + fc.week]; if (!lw || !lw.teams || !fc.pairs) return; weeks.add(fc.start);
      fc.pairs.forEach(m => { const A = lw.teams[m.a], B = lw.teams[m.b]; if (!A || !B) return;
        Object.entries(m.cp).forEach(([c, q]) => { const a = resVal(A.st, c), b = resVal(B.st, c); if (a == null || b == null || isNaN(a) || isNaN(b) || a === b) return; pairs.push({ p: q, y: (c === 'to' ? a < b : a > b) ? 1 : 0, s: fc.sdMul || 1, c, w: fc.week, src: 'league' }); }); }); });
    Object.keys(ST).filter(k => k.startsWith('h2hfc:' + lid + ':')).forEach(k => { const st = k.split(':').pop(); if (weeks.has(st)) return; const fc = ST[k], res = ST['h2hres:' + lid + ':' + st]; if (!fc || !res || !res.me || !res.opp) return;
      Object.entries(fc.cats || {}).forEach(([c, q]) => { const a = resVal(res.me, c), b = resVal(res.opp, c); if (a == null || b == null || isNaN(a) || isNaN(b) || a === b) return; pairs.push({ p: q, y: (c === 'to' ? a < b : a > b) ? 1 : 0, s: fc.sdMul || 1, c, w: st, src: 'mine' }); }); });
    return pairs; }
  // ---- the field: what each team actually produced against what its roster projected before the week (streaming, lineups,
  // injuries all show up here). Per category, actual ÷ projected, for your opponents and for you. ----
  function uplift(ST, lid) { const R = { opp: {}, me: {} }; let weeks = 0;
    Object.keys(ST).filter(k => k.startsWith('lgfc:' + lid + ':')).forEach(k => { const fc = ST[k], lw = fc && fc.tot && ST['lgweek:' + lid + ':' + fc.week]; if (!lw || !lw.teams) return; weeks++;
      Object.entries(fc.tot).forEach(([tid, pr]) => { const a = lw.teams[tid]; if (!a || !a.st) return; const side = String(tid) === String(fc.me) ? R.me : R.opp;
        ['p', '3', 'r', 'a', 's', 'b', 'to', 'fg', 'ft', 'fga', 'fta', '2d'].forEach(c => { if (pr[c] > 0 && a.st[c] != null) { const o = side[c] = side[c] || { a: 0, p: 0, n: 0 }; o.a += a.st[c]; o.p += pr[c]; o.n++; } });
        if (pr.g && a.games && a.games.played) { const o = side.g = side.g || { a: 0, p: 0, n: 0 }; o.a += a.games.played; o.p += pr.g; o.n++; } }); });
    const fin = S => Object.fromEntries(Object.entries(S).map(([c, o]) => [c, { ratio: +(o.a / o.p).toFixed(3), n: o.n }]));
    return { weeks, opp: fin(R.opp), me: fin(R.me) }; }
  // ---- projection scorecard: Basketball Monster, Yahoo and their average, each against what players did per game over the
  // same Monday-to-Sunday week. Error is games-weighted root mean square per category; lower is better. ----
  const nkey = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '').replace(/[^a-z]/g, '');
  function projScore(ST) { const CATS = ['p', '3', 'r', 'a', 's', 'b', 'fg%', 'ft%', 'to']; const IX = { p: 1, 3: 2, r: 3, a: 4, s: 5, b: 6, to: 11 }; const acc = {}; const weeks = [];
    ['bbm', 'yh', 'blend'].forEach(src => acc[src] = Object.fromEntries(CATS.map(c => [c, { e: 0, w: 0 }])));
    Object.keys(ST).filter(k => k.startsWith('pjlog:')).forEach(k => { const L = ST[k], A = ST['pjact:' + (L && L.start)]; if (!L || !A || !A.by) return; if (weeks.includes(L.start)) return; weeks.push(L.start);
      const act = {}; Object.entries(A.by).forEach(([n, r]) => act[nkey(n)] = r); const yh = {}; Object.entries(L.yh || {}).forEach(([n, r]) => yh[nkey(n)] = r);
      Object.entries(L.bbm || {}).forEach(([n, b]) => { const kk = nkey(n), y = yh[kk], a = act[kk]; if (!y || !a || !a[0]) return; const g = a[0];
        const per = i => a[i] / g; const bl = b.map((x, i) => i ? (x + y[i]) / 2 : x);
        [['bbm', b], ['yh', y], ['blend', bl]].forEach(([src, P]) => {
          Object.entries(IX).forEach(([c, i]) => { const e = P[i] - per(i); acc[src][c].e += g * e * e; acc[src][c].w += g; });
          [['fg%', 7, 8], ['ft%', 9, 10]].forEach(([c, mi, ai]) => { if (!a[ai] || !P[ai]) return; const e = P[mi] / P[ai] - a[mi] / a[ai]; acc[src][c].e += a[ai] * e * e; acc[src][c].w += a[ai]; }); }); }); });
    const out = { weeks: weeks.length }; ['bbm', 'yh', 'blend'].forEach(src => out[src] = Object.fromEntries(CATS.map(c => [c, acc[src][c].w ? Math.sqrt(acc[src][c].e / acc[src][c].w) : null])));
    out.blendWins = CATS.filter(c => out.blend[c] != null && out.bbm[c] != null && out.blend[c] < out.bbm[c] * 0.98).length; out.cats = CATS.length; return out; }
  function calibrate(ST, lid) {
    const pairs = forecastPairs(ST, lid); const n = pairs.length; const weeks = new Set(pairs.map(x => x.w)).size;
    const inv = p => { p = Math.min(0.995, Math.max(0.005, p)); let lo = -6, hi = 6; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (H.Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
    const at = (x, m) => Math.min(0.995, Math.max(0.005, H.Phi(inv(x.p) * x.s / m))); // the forecast as it would have been with spread multiplier m
    const brier = f => pairs.reduce((a, x) => a + (f(x) - x.y) ** 2, 0) / (n || 1);
    const bins = [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.01]].map(r => { const B = pairs.filter(x => x.p >= r[0] && x.p < r[1]); return { r, n: B.length, p: B.reduce((a, x) => a + x.p, 0) / (B.length || 1), won: B.reduce((a, x) => a + x.y, 0) / (B.length || 1) }; });
    const out = { mul: 1, n, weeks, brier: n ? brier(x => x.p) : null, bins };
    if (n < 25) return out;
    let best = { mul: 1, ll: Infinity }; for (let m = 0.4; m <= 2.51; m += 0.05) { let ll = 0; pairs.forEach(x => { const q = at(x, m); ll -= x.y ? Math.log(q) : Math.log(1 - q); }); if (ll < best.ll) best = { mul: +m.toFixed(2), ll }; }
    // shrink toward no change while there are few results (a week of one league is about 50 categories)
    const k = Math.min(1, n / 200); out.mul = +(1 + (best.mul - 1) * k).toFixed(2); out.fit = best.mul; out.brierFit = brier(x => at(x, out.mul)); return out;
  }
  const ordinal = n => n ? n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th') : '–';
  // ---- trade finder ----
  // ---- live matchup ----
  function liveCard(M, ST, lid, y) {
    const lv = ST['ylive:' + lid]; if (!lv || !y || lv.week !== y.week || !lv.me || !lv.opp) return '';
    const played = Object.values(lv.me.st || {}).some(v => v > 0) || Object.values(lv.opp.st || {}).some(v => v > 0); if (!played) return '';
    const me = M.L.teams.find(t => t.tid === M.L.me), op = M.L.teams.find(t => t.tid === String(y.oppTid)); if (!me || !op) return '';
    const r = H.live(M.ctx, me.ids, op.ids, { me: lv.me.st, opp: lv.opp.st });
    const now = r.cats.reduce((a, c) => { const d = c.nowMe == null || c.nowOpp == null ? 0 : c.c === 'to' ? c.nowOpp - c.nowMe : c.nowMe - c.nowOpp; if (d > 0) a[0]++; else if (d < 0) a[1]++; else a[2]++; return a; }, [0, 0, 0]);
    // Yahoo's own score when the matchup page gave one (the rest are ties), so the panel always matches Yahoo
    if (lv.me && lv.opp && typeof lv.me.score === 'number' && typeof lv.opp.score === 'number' && lv.me.score + lv.opp.score > 0) { now[0] = lv.me.score; now[1] = lv.opp.score; now[2] = Math.max(0, r.cats.length - now[0] - now[1]); }
    const fmt = (c, v) => v == null ? '–' : c.unit === 'pct' ? v.toFixed(3).replace(/^0/, '') : Math.round(v);
    const grp = s => r.cats.filter(c => c.state === s);
    const need = c => c.unit === 'pct' ? (c.gap >= 0 ? 'ahead by ' : 'behind by ') + Math.abs(c.gap).toFixed(3).replace(/^0/, '') : (c.gap >= 0 ? 'up ' : 'down ') + Math.abs(Math.round(c.gap));
    const vk = r.W >= 0.6 ? 'g' : r.W >= 0.4 ? 'a' : 'r'; const vt = r.W >= 0.6 ? 'Favourite this week' : r.W >= 0.4 ? 'Close week' : 'Underdog this week';
    const yg = lv.me.games && lv.opp.games ? [lv.me.games.remaining, lv.opp.games.remaining] : null; // Yahoo's own count when available
    let h = `<div class="hero hv-${vk} live"><div class="hero-top"><div class="hero-pct">${Math.round(r.W * 100)}%</div><div class="hero-vs">to win, live against<br><b>${esc(lv.opp.name || y.oppName || 'opponent')}</b></div><div class="score"><b>${now[0]}–${now[1]}${now[2] ? '–' + now[2] : ''}</b><span>right now</span></div></div>
      <div class="hvk" style="margin:4px 0 0"><span class="fk ${vk}">${vt}</span></div>
      <div class="h" style="margin-top:12px"><span>Chance to win each category</span><span class="sub">at the finish</span></div>
      <div class="cgrid">${r.cats.slice().sort((a, b) => b.p - a.p).map(c => `<div class="tile ${c.p > 0.6 ? 'cs-a' : c.p >= 0.4 ? 'cs-c' : 'cs-b'}"><b>${esc(c.label.charAt(0).toUpperCase() + c.label.slice(1))}</b><span>${Math.round(c.p * 100)}%</span><i>now ${fmt(c, c.nowMe)} v ${fmt(c, c.nowOpp)}</i></div>`).join('')}</div>
      <div class="sub">Games left: <b>${yg ? yg[0] : r.gamesLeft.me}</b> for you, <b>${yg ? yg[1] : r.gamesLeft.opp}</b> for them${yg ? ' (Yahoo)' : ''}. ${(() => { const mins = Math.round((Date.now() - (lv.ts || 0)) / 60000); const when = mins < 2 ? 'just now' : mins < 90 ? mins + ' min ago' : Math.round(mins / 60) + ' h ago'; return mins > 45 ? `<span class="warnt">Yahoo's totals read ${when}: open your matchup on Yahoo to refresh them.</span>` : `Yahoo's totals read ${when}${lv.src === 'tab' ? ' from the open matchup page' : ''}.`; })()}</div>
      <details class="hwhy" data-k="lwhy"><summary>Why</summary><div class="sub">Banked so far plus what Basketball Monster projects for the games left.</div><table class="stt2 inv"><thead><tr><th></th><th>You now</th><th>Them now</th><th>You at the end</th><th>Them at the end</th></tr></thead><tbody>${r.cats.slice().sort((a, b) => b.p - a.p).map(c => `<tr><td>${esc(c.label.charAt(0).toUpperCase() + c.label.slice(1))}</td><td>${fmt(c, c.nowMe)}</td><td>${fmt(c, c.nowOpp)}</td><td>${fmt(c, c.me)}</td><td>${fmt(c, c.opp)}</td></tr>`).join('')}</tbody></table><div class="sub">${Math.round(r.W * 100)}% chance to win the week.</div></details></div>`;
    // plain instructions
    const lines = []; const chase = grp('toss').concat(grp('chase')).sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5));
    if (chase.length) lines.push(['warn', 'Swing categories', chase.map(c => `<b>${esc(c.label)}</b> (${need(c)})`).join(', ') + '. Pick up or start players who help these.']);
    const safe = grp('safe'); if (safe.length) lines.push(['good', 'Safe', safe.map(c => esc(c.label)).join(', ') + ': no need to chase these.']);
    const lost = grp('lost'); if (lost.length) lines.push(['', 'Gone', lost.map(c => esc(c.label)).join(', ') + ': ignore them when choosing starters.']);
    const pctC = r.cats.filter(c => c.unit === 'pct' && c.state !== 'safe' && c.state !== 'lost' && c.gap > 0); if (pctC.length) lines.push(['warn', 'Protect', pctC.map(c => esc(c.label)).join(', ') + ': avoid adding inefficient shooters.']);
    if (lines.length) h += `<div class="card"><div class="h"><span>What to do this week</span></div>${lines.map(l => `<div class="brow"><i class="dot d-${l[0]}"></i><div><b>${l[1]}</b><div class="sub">${l[2]}</div></div></div>`).join('')}</div>`;
    return h;
  }
  // ---- a week Matchup Monster hasn't opened yet (usually next week), built from the same Basketball Monster data:
  // the Weekly Projections "Next Week" view (per-game stats and projected games), Yahoo rosters and the NBA schedule.
  // Shaped like a Matchup Monster week so the weekly planner treats it exactly the same way.
  // a Yahoo roster player Matchup Monster doesn't list at all (BBM's copy of your roster can lag a pickup): built from BBM's
  // projections for this week and the real NBA schedule, so the lineup still knows the days he plays
  function fillRows(M, ST, m, rows, side, today) {
    const V = (M.bx && M.bx.views) || {}; const SCH = (ST.nbasched && ST.nbasched.by) || (globalThis.NBA_SCHED && globalThis.NBA_SCHED.by); if (!SCH || !m || !m.days) return [];
    const key = t => t === 'NOP' ? 'NOR' : t === 'PHX' ? 'PHO' : t;
    // (someone BBM has no projection for at all is left out: the lineup card lists him separately as your call)
    return rows.map(r => { const id = M.find(r.name, r.team); const p = id && M.P[id]; const rv = id && V.rest && V.rest[id]; const vw = rv || (id && V.ros && V.ros[id]); if (!vw) return null;
      const team = (p && p.t) || tc(r.team); const L0 = SCH[key(team)] || SCH[team] || [];
      const plays = m.days.map(d => !!(d.date && (!today || d.date >= today) && L0.includes(d.date))); const n = plays.filter(Boolean).length;
      const st = Object.assign({}, (vw && vw.st) || {}); if (st['2d'] == null && M.bx.dd && id && M.bx.dd[id] != null) st['2d'] = M.bx.dd[id];
      const g = rv ? rv.g : null; const out = /^(O|OUT|INJ|SUSP)$/i.test(r.inj || '') || (g === 0 && n > 0); const f = n > 0 && g > 0 ? Math.min(1, g / n) : 1;
      if (f < 1) Object.keys(st).forEach(k => { if (k !== 'fgp' && k !== 'ftp' && typeof st[k] === 'number') st[k] = st[k] * f; });
      const games = m.days.map((d, i) => plays[i] ? { day: i, opp: '', cb: null, on: false, fin: false, zero: out, val: vw ? vw.lv : null, min: vw ? vw.m : null } : null);
      return { side, type: /^IL/.test(r.slot || '') ? 'ir' : 'cur', name: r.name, bbm: id || null, team, pos: String((p && p.pos) || r.pos || '').split(/[\s,\/]+/).filter(Boolean), rank: (p && p.rank) || null, leagV: vw ? vw.lv : null, inj: (p && p.inj) || r.inj || '',
        st, games, sv: p && p.ros ? p.ros.lv : null, sr: (p && p.rank) || null, bars: [], cv: {}, catV: null, notes: (p && p.notes) || [], _filled: true }; }).filter(Boolean); }
  function weekModel(M, ST, y, cur, wk) {
    const V = (M.bx && M.bx.views) || {}; const VV = wk && wk.view === 'rest' ? V.rest : V.next; if (!VV || !wk || !wk.oppTid || !wk.start) return null; const from = wk.view === 'rest' ? (wk.today || '') : '';
    const SCH = (ST.nbasched && ST.nbasched.by) || (globalThis.NBA_SCHED && globalThis.NBA_SCHED.by); if (!SCH) return null;
    const key = t => t === 'NOP' ? 'NOR' : t === 'PHX' ? 'PHO' : t; const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const end = wk.end || addDay(wk.start, 6); const days = [];
    for (let i = 0; i < 14; i++) { const d = addDay(wk.start, i); if (d > end) break; const dt = new Date(d + 'T12:00:00Z'); days.push({ label: DN[dt.getUTCDay()] + ' ' + dt.getUTCDate(), dom: dt.getUTCDate(), date: d }); }
    const me = M.L.teams.find(t => t.tid === M.L.me), op = M.L.teams.find(t => t.tid === String(wk.oppTid)); if (!me || !op) return null;
    const ir = new Set(((y && y.rows) || []).filter(r => /^IL/.test(r.slot)).map(r => M.find(r.name, r.team)).filter(Boolean));
    const mk = (id, side, type) => { const p = M.P[id]; if (!p) return null; const nx = VV[id];
      const st = Object.assign({}, (nx && nx.st) || (p.ros && p.ros.st) || {}); if (st['2d'] == null && M.bx.dd && M.bx.dd[id] != null) st['2d'] = M.bx.dd[id];
      const L0 = SCH[key(p.t)] || SCH[p.t] || []; const plays = days.map(d => L0.includes(d.date) && d.date >= from); const n = plays.filter(Boolean).length;
      // BBM projecting no games means he's out all week; fewer games than his team plays (rest, minor knocks) is spread across
      // the week so his weekly total matches BBM's projection exactly
      const g = (nx && nx.g) || 0; const out = n > 0 && g <= 0; const f = n > 0 && g > 0 ? Math.min(1, g / n) : 1;
      if (f < 1) Object.keys(st).forEach(k => { if (k !== 'fgp' && k !== 'ftp' && typeof st[k] === 'number') st[k] = st[k] * f; });
      const games = days.map((d, i) => plays[i] ? { day: i, opp: '', cb: null, on: false, fin: false, zero: out, val: nx ? nx.lv : null, min: nx ? nx.m : null } : null);
      return { side, type: type || (ir.has(id) ? 'ir' : 'cur'), name: p.n, bbm: id, team: p.t, pos: String(p.pos || '').split(/[\s,\/]+/).filter(Boolean), rank: p.rank || null, leagV: nx ? nx.lv : null, inj: p.inj || '',
        st, games, sv: p.ros ? p.ros.lv : null, sr: p.rank || null, bars: [], cv: {}, catV: null, notes: p.notes || [] }; };
    const players = me.ids.map(id => mk(id, 0)).concat(op.ids.map(id => mk(id, 1, 'cur'))).filter(Boolean);
    M.L.fas.filter(id => VV[id] && VV[id].g > 0).sort((a, b) => (VV[b].lv || -9) - (VV[a].lv || -9)).slice(0, 120).forEach(id => { const x = mk(id, 0, 'fa'); if (x) players.push(x); });
    const oppName = M.teamName(wk.oppTid);
    return { league: cur.league, me: cur.me, opp: oppName, t1: { id: String(M.L.me), name: cur.me }, t2: { id: String(wk.oppTid), name: oppName }, start: wk.start, end, cats: cur.cats, totals: {}, bbmWin: {}, teams: [cur.me, oppName], days, players, ts: (M.bx.ts || {})[wk.view === 'rest' ? 'rest' : 'next'] || Date.now(), synthetic: true, from: wk.view === 'rest' ? 'bbm-rest' : 'bbm-next' };
  }
  // ---- next week ----
  function nextCard(M, y, ov) {
    if (!y || !y.next || !y.next.oppTid || !M.ctx.has.next) return ''; const me = M.L.teams.find(t => t.tid === M.L.me), op = M.L.teams.find(t => t.tid === String(y.next.oppTid)); if (!me || !op) return '';
    const r = H.nextWeek(M.ctx, me.ids, op.ids); if (ov && ov.W != null) r.W = ov.W; const nm = id => esc(M.P[id].n); // the panel's own forecast for next week, so the page shows one number
    const strong = r.cats.filter(c => c.p < 0.4).map(c => c.label), weak = r.cats.filter(c => c.p > 0.6).map(c => c.label);
    const streams = M.L.fas.filter(id => M.P[id].next && M.P[id].next.g >= 4).sort((a, b) => (M.P[b].next.lv || 0) * M.P[b].next.g - (M.P[a].next.lv || 0) * M.P[a].next.g).slice(0, 3);
    let h = `<div class="card"><div class="h"><span>Next week vs ${esc(M.teamName(y.next.oppTid))}</span><span class="sub">${esc(y.next.start || '')} to ${esc(y.next.end || '')}</span></div>`;
    h += `<div class="hl3"><i class="fd ${r.W >= 0.6 ? 'g' : r.W >= 0.4 ? 'a' : 'r'}"></i><span><b>${r.W >= 0.6 ? 'Favourite' : r.W >= 0.4 ? 'Close' : 'Underdog'}</b> (${Math.round(r.W * 100)}% to win) on Basketball Monster's projections · <b>${r.games.me}</b> games for you, <b>${r.games.opp}</b> for them</span></div>`;
    // their actual Yahoo results so far (shown as facts; the forecast above comes from BBM projections only)
    const pf = M.prof && M.prof.teams[String(y.next.oppTid)];
    if (pf && pf.weeks) { const lb = c => ((H && H.LBL) || {})[c] || c; const by = M.ctx.cats.filter(c => pf.cat[c] && pf.cat[c].n).map(c => ({ c, r: (pf.cat[c].w + pf.cat[c].t / 2) / pf.cat[c].n }));
      const won = by.filter(x => x.r > 0.6).map(x => lb(x.c)), lost = by.filter(x => x.r < 0.4).map(x => lb(x.c)); const one = pf.weeks === 1;
      h += `<div class="sub" style="margin-top:8px">Their Yahoo results so far (${pf.weeks} week${one ? '' : 's'}, ${pf.w}-${pf.l}-${pf.t}):${won.length ? ` ${one ? 'won' : 'won most weeks in'} <b>${esc(won.join(', '))}</b>` : ''}${won.length && lost.length ? ';' : ''}${lost.length ? ` ${one ? 'lost' : 'lost most weeks in'} <b>${esc(lost.join(', '))}</b>` : ''}${!won.length && !lost.length ? ' even across categories' : ''}.</div>`; }
    if (strong.length) h += `<div class="sub" style="margin-top:8px">They're stronger in <b>${esc(strong.join(', '))}</b>${weak.length ? `; you're stronger in <b>${esc(weak.join(', '))}</b>` : ''}.</div>`;
    if (streams.length) h += `<div class="label" style="margin-top:12px">Four-game free agents next week</div>` + streams.map(id => `<div class="pr"><b>${nm(id)}</b><span>${M.P[id].next.g} games</span></div>`).join('');
    return h + '</div>';
  }
  root.CTX = { calibrate, forecastPairs, uplift, projScore, fillRows, profiles, schedOf, curWeek, weekModel, model, freshness, tradeCard, dealView, addCard, listCard, liveCard, nextCard };
})(typeof window !== 'undefined' ? window : globalThis);
