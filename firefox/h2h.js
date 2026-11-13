// Head-to-head evaluator on live BBM projections: rosters -> weekly category totals -> category and matchup win chances.
// Used for trades, add/drop checks and player labels. Pure functions, no DOM.
(function (root) {
  const LBL = { p: 'points', 3: '3-pointers', r: 'rebounds', a: 'assists', s: 'steals', b: 'blocks', to: 'turnovers', '2d': 'double-doubles', fg: 'field goals made', ft: 'free throws made', 'fg%': 'field goal %', 'ft%': 'free throw %' } // full names: the panel shows no abbreviations;
  const VARK = { p: 2.2, 3: 1.4, r: 1.6, a: 1.6, s: 1.2, b: 1.5, to: 1.2, fg: 1.0, ft: 1.6, '2d': 1.0 };
  const KEYS = ['p', '3', 'r', 'a', 's', 'b', 'to', '2d', 'fg', 'fga', 'ft', 'fta'];
  const RATIO = { 'fg%': ['fg', 'fga'], 'ft%': ['ft', 'fta'] };
  const SD_SCALE = 2.5; // week-to-week swings are wider than box-score noise alone (calibrated earlier against Matchup Monster)
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
  function weekWin(ps, need) { let dp = [1]; ps.forEach(p => { const n = new Array(dp.length + 1).fill(0); dp.forEach((x, i) => { n[i] += x * (1 - p); n[i + 1] += x * p; }); dp = n; }); let w = 0; for (let i = need; i < dp.length; i++) w += dp[i]; return w; }

  // ctx: { P: {bbmId: player}, cats, slots, days: {view: n}, ddRate: {bbmId: dd per game} }
  // player[view] = { g, lv, st: per-game stats }
  function teamWeek(ctx, ids, view) {
    const days = ctx.days[view] || 7, weeks = Math.max(days / 7, 1 / 7); const cap = ctx.slots * days * 0.9;
    const L = ids.map(id => ctx.P[id]).filter(p => p && p[view] && p[view].g > 0).sort((a, b) => (b[view].lv || -9) - (a[view].lv || -9));
    const m = {}; KEYS.forEach(k => m[k] = 0); let used = 0;
    L.forEach(p => { const v = p[view]; const take = Math.max(0, Math.min(v.g, cap - used)); used += take; if (!take) return; const w = take / weeks; const st = v.st || {};
      KEYS.forEach(k => { let x = st[k]; if (k === '2d' && x == null) x = ctx.ddRate && ctx.ddRate[p.id] != null ? ctx.ddRate[p.id] : 0; if (k === 'fg' && x == null && st.fgp != null) x = st.fgp * (st.fga || 0); if (k === 'ft' && x == null && st.ftp != null) x = st.ftp * (st.fta || 0); m[k] += (x || 0) * w; }); });
    return { m, games: used / weeks };
  }
  const sdm = ctx => SD_SCALE * (ctx.sdMul || 1);
  function catP(ctx, A, B, c) {
    if (RATIO[c]) { const [mk, ak] = RATIO[c]; const pa = A.m[ak] ? A.m[mk] / A.m[ak] : 0, pb = B.m[ak] ? B.m[mk] / B.m[ak] : 0;
      const va = A.m[ak] ? pa * (1 - pa) * 1.3 / A.m[ak] : 0, vb = B.m[ak] ? pb * (1 - pb) * 1.3 / B.m[ak] : 0; const sd = Math.sqrt(va + vb) * sdm(ctx) || 0.01; return Phi((pa - pb) / sd); }
    const d = A.m[c] - B.m[c]; const sd = Math.sqrt((VARK[c] || 1) * (A.m[c] + B.m[c])) * sdm(ctx) || 1; return Phi((c === 'to' ? -d : d) / sd);
  }
  function matchup(ctx, A, B) { const cp = {}; ctx.cats.forEach(c => cp[c] = ctx.valuing && ctx.punt && ctx.punt.includes(c) ? 0.2 : catP(ctx, A, B, c)); /* punted categories: assume you usually lose them, whatever the move */ return { W: ctx.obj === 'cats' ? ctx.cats.reduce((t, c) => t + cp[c], 0) / ctx.cats.length : weekWin(ctx.cats.map(c => cp[c]), Math.floor(ctx.cats.length / 2) + 1), cp }; } // categories league: share of categories won
  // average over a set of opponents (rest of season / playoffs) or one opponent (this week)
  function vsField(ctx, ids, opps, view) {
    const A = teamWeek(ctx, ids, view); const cp = {}; ctx.cats.forEach(c => cp[c] = 0); let W = 0; const n = opps.length || 1;
    opps.forEach(o => { const r = matchup(ctx, A, o.vec || teamWeek(ctx, o.ids, view)); W += r.W / n; ctx.cats.forEach(c => cp[c] += r.cp[c] / n); });
    return { W, cp, A };
  }
  const vecs = (ctx, teams, view) => teams.map(t => ({ tid: t.tid, ids: t.ids, vec: teamWeek(ctx, t.ids, view) }));
  // overall worth of a player on a view: value per game x games (used for picking who to cut or fill)
  const worth = (ctx, id, view) => { const p = ctx.P[id]; const v = p && (p[view] || p.ros); return v ? (v.lv || 0) * (v.g || 0) : -99; };
  // keep the roster legal after an uneven trade: cut the weakest, or fill with the best free agent
  // league = { me: tid, teams: [{tid, ids}], oppNow: tid, fas: [ids] }
  function evalChange(ctx, L, myAfter, theirTid, theirAfter) { const was = ctx.valuing; ctx.valuing = true; try { return evalChange0(ctx, L, myAfter, theirTid, theirAfter); } finally { ctx.valuing = was; } }
  function evalChange0(ctx, L, myAfter, theirTid, theirAfter) {
    // ctx.weekView = 'next' values "this week" as next week instead (Next Week projections vs next week's opponent); the result
    // still goes under 'rest' so every caller reads it the same way
    const wv = ctx.weekView === 'next' && ctx.has.next ? 'next' : 'rest';
    const views = [wv, 'ros', 'po'].filter(v => ctx.has[v]); const out = {};
    const teamsAfter = L.teams.map(t => t.tid === L.me ? { tid: t.tid, ids: myAfter } : (theirTid && t.tid === theirTid ? { tid: t.tid, ids: theirAfter } : t));
    views.forEach(v => {
      const before = L.teams; const me0 = before.find(t => t.tid === L.me), me1 = teamsAfter.find(t => t.tid === L.me);
      // rest of season: the opponents still on your schedule (with repeats); playoffs: the whole league
      const field = tlist => v === 'rest' ? tlist.filter(t => t.tid === L.oppNow) : v === 'next' ? tlist.filter(t => t.tid === L.oppNext) : v === 'ros' && L.sched && L.sched.length ? L.sched.map(tid => tlist.find(t => t.tid === tid)).filter(Boolean) : tlist.filter(t => t.tid !== L.me);
      const f0 = vecs(ctx, field(before), v), f1 = vecs(ctx, field(teamsAfter), v);
      if (!f0.length) return;
      const a = vsField(ctx, me0.ids, f0, v), b = vsField(ctx, me1.ids, f1, v);
      const r = { before: a.W, after: b.W, d: b.W - a.W, cats: ctx.cats.map(c => ({ c: LBL[c], from: a.cp[c], to: b.cp[c], d: b.cp[c] - a.cp[c] })) };
      if (theirTid) { const t0 = before.find(t => t.tid === theirTid), t1 = teamsAfter.find(t => t.tid === theirTid);
        const g0 = vecs(ctx, before.filter(t => t.tid !== theirTid), v), g1 = vecs(ctx, teamsAfter.filter(t => t.tid !== theirTid), v);
        if (v !== 'rest' && t0 && t1) { r.theirs = vsField(ctx, t1.ids, g1, v).W - vsField(ctx, t0.ids, g0, v).W; } }
      out[v === 'next' ? 'rest' : v] = r; });
    return out;
  }
  // a trade: give (my ids) for get (their ids); returns verdict, effects and a counter-offer
  // pickup: add one player, best drops ranked (this week vs your opponent + rest of season)
  function pickup(ctx, L, add, candidates) {
    const me = L.teams.find(t => t.tid === L.me); if (!me) return { err: 'Your roster is not loaded yet' };
    const list = (candidates || me.ids).filter(id => me.ids.includes(id)).map(drop => { const ev = evalChange(ctx, L, me.ids.filter(x => x !== drop).concat([add]), null, null);
      const wk = ev.rest ? ev.rest.d : 0, rs = ev.ros ? ev.ros.d : 0; return { drop, week: wk, ros: rs, po: ev.po ? ev.po.d : null, score: wk + 3 * rs, ev }; }).sort((a, b) => b.score - a.score);
    return { add, drops: list };
  }
  // ---- live matchup: what's banked this week plus what's still to come ----
  // actual: { me: {p,3,...,fg,fga,ft,fta}, opp: {...} } from Yahoo's scoreboard
  function live(ctx, myIds, oppIds, actual) {
    const days = ctx.days.rest || 1, weeks = days / 7; const A = teamWeek(ctx, myIds, 'rest'), B = teamWeek(ctx, oppIds, 'rest');
    const rem = X => { const m = {}; KEYS.forEach(k => m[k] = (X.m[k] || 0) * weeks); return m; }; const ra = rem(A), rb = rem(B);
    const am = actual.me || {}, ao = actual.opp || {}; const out = []; const ps = [];
    ctx.cats.forEach(c => { let p, me, op, gap = null, unit = '';
      if (RATIO[c]) { const [mk, ak] = RATIO[c]; const mM = (am[mk] || 0) + ra[mk], mA = (am[ak] || 0) + ra[ak], oM = (ao[mk] || 0) + rb[mk], oA = (ao[ak] || 0) + rb[ak];
        me = mA ? mM / mA : 0; op = oA ? oM / oA : 0; const va = mA ? me * (1 - me) * 1.3 * Math.max(ra[ak], 1) / (mA * mA) : 0, vb = oA ? op * (1 - op) * 1.3 * Math.max(rb[ak], 1) / (oA * oA) : 0;
        const sd = Math.sqrt(va + vb) * sdm(ctx) || 0.004; p = Phi((me - op) / sd); gap = me - op; unit = 'pct'; }
      else { me = (am[c] || 0) + ra[c]; op = (ao[c] || 0) + rb[c]; const sd = Math.sqrt((VARK[c] || 1) * Math.max(ra[c] + rb[c], 0.5)) * sdm(ctx); const d = c === 'to' ? op - me : me - op; p = Phi(d / sd); gap = d; }
      ps.push(p); out.push({ c, label: LBL[c], p, me, opp: op, gap, unit, nowMe: RATIO[c] ? ((am[RATIO[c][1]] ? am[RATIO[c][0]] / am[RATIO[c][1]] : null)) : (am[c] || 0), nowOpp: RATIO[c] ? ((ao[RATIO[c][1]] ? ao[RATIO[c][0]] / ao[RATIO[c][1]] : null)) : (ao[c] || 0),
        state: p >= 0.85 ? 'safe' : p >= 0.6 ? 'lean' : p >= 0.4 ? 'toss' : p >= 0.15 ? 'chase' : 'lost' }); });
    const W = weekWin(ps, Math.floor(ctx.cats.length / 2) + 1);
    return { W, cats: out, gamesLeft: { me: Math.round(A.games * weeks), opp: Math.round(B.games * weeks) } };
  }
  // ---- next week's matchup on next week's projections ----
  function nextWeek(ctx, myIds, oppIds) { const A = teamWeek(ctx, myIds, 'next'), B = teamWeek(ctx, oppIds, 'next'); const r = matchup(ctx, A, B); return { W: r.W, cats: ctx.cats.map(c => ({ c, label: LBL[c], p: r.cp[c] })), games: { me: Math.round(A.games), opp: Math.round(B.games) } }; }
  // ---- the one measure every page reads: expected categories won per week over the rest of the season, against every other
  // team in the league (Basketball Monster's rest-of-season projections, punted categories held at a usual loss).
  // Every decision is a change in that number: a player's value to you is what it drops by without him; a pickup is what it
  // gains when he replaces your least valuable droppable player (the best of those drops is his drop).
  // o: { fas: [ids], keepIds: Set (never dropped: injured-list spots, players you chose to keep, recent adds), n: list size }
  function board(ctx, L, o) {
    o = o || {}; const me = L.teams.find(t => t.tid === L.me); if (!me || !ctx.has.ros) return null;
    const was = ctx.valuing; ctx.valuing = true;
    try {
      const F = vecs(ctx, L.teams.filter(t => t.tid !== L.me), 'ros'); if (!F.length) return null;
      const E = ids => { const r = vsField(ctx, ids, F, 'ros'); let e = 0; ctx.cats.forEach(c => e += r.cp[c]); return { e, cp: r.cp }; };
      const base = E(me.ids); const keepIds = o.keepIds || new Set();
      const delta = (a, b) => ctx.cats.map(c => ({ c, d: a.cp[c] - b.cp[c] }));
      // each of your players: what the number loses without him
      const mine = me.ids.map(id => { const r = E(me.ids.filter(x => x !== id)); return { id, val: base.e - r.e, cats: delta(base, r), keep: keepIds.has(id) }; });
      const order = mine.filter(x => !x.keep).sort((a, b) => a.val - b.val); // the drop order: least valuable first
      // any roster of yours against the same field: the change in the number, and each category's share of weeks won before and after
      const pu = ctx.punt; // later calls are judged on the same punt as the board, whatever the context holds by then
      const of = ids => { const w = ctx.valuing, p0 = ctx.punt; ctx.valuing = true; ctx.punt = pu; try { const r = E(ids); return { g: r.e - base.e, cats: delta(r, base), cp: r.cp }; } finally { ctx.valuing = w; ctx.punt = p0; } };
      const swap = (add, drop) => of(me.ids.filter(x => x !== drop).concat([add]));
      // every free agent against your least valuable player first, then the best 40 against every droppable player
      const fas = (o.fas || L.fas || []).filter(id => ctx.P[id] && ctx.P[id].ros && (ctx.P[id].ros.g || 0) > 0);
      const d0 = order[0]; if (!d0) return { base: base.e, cp: base.cp, mine, order, list: [], swap, of, weeks: (ctx.days.ros || 140) / 7 };
      const pre = fas.map(id => ({ id, g: swap(id, d0.id).g })).sort((a, b) => b.g - a.g).slice(0, Math.max(o.depth || 40, o.n || 20));
      const tryDrops = order.slice(0, o.drops || 10);
      const list = pre.map(x => { let best = null; const all = [];
        tryDrops.forEach(d => { const r = swap(x.id, d.id); all.push({ drop: d.id, g: r.g, cats: r.cats }); if (!best || r.g > best.g) best = { drop: d.id, g: r.g, cats: r.cats }; });
        all.sort((a, b) => b.g - a.g); return { id: x.id, gain: best.g, drop: best.drop, cats: best.cats, alt: all[1] || null }; })
        .sort((a, b) => b.gain - a.gain).slice(0, o.n || 20);
      return { base: base.e, cp: base.cp, mine, order, list, swap, of, weeks: (ctx.days.ros || 140) / 7 };
    } finally { ctx.valuing = was; }
  }
  // the timing of one swap (add for drop): this week against your opponent and next week against next week's, in expected
  // categories. Timing only: it never changes the order above.
  function timing(ctx, L, add, drop) {
    const me = L.teams.find(t => t.tid === L.me); if (!me) return {}; const was = ctx.valuing; ctx.valuing = true;
    try { const after = me.ids.filter(x => x !== drop).concat([add]); const out = {};
      [['rest', L.oppNow], ['next', L.oppNext]].forEach(([v, tid]) => { const op = tid && L.teams.find(t => t.tid === String(tid)); if (!op || !ctx.has[v]) return;
        const B = teamWeek(ctx, op.ids, v); const a = matchup(ctx, teamWeek(ctx, me.ids, v), B), b = matchup(ctx, teamWeek(ctx, after, v), B);
        let d = 0; ctx.cats.forEach(c => d += b.cp[c] - a.cp[c]); out[v === 'rest' ? 'week' : 'next'] = d; });
      return out; } finally { ctx.valuing = was; }
  }
  root.H2H = { live, nextWeek, teamWeek, matchup, pickup, worth, LBL, weekWin, Phi, board, timing };
  if (typeof module !== 'undefined') module.exports = root.H2H;
})(typeof window !== 'undefined' ? window : globalThis);
