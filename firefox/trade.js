// Trades: the verdict on one deal you're looking at on Yahoo's trade page. Your side is the categories you'd win over the rest of
// the season against the opponents left on your schedule (playoff weeks count for a capped share). Their side is what managers look
// at: Basketball Monster's value of the players (all categories, no punt) and Yahoo's rank, plus whether their own categories
// improve. Pure functions over the same BBM projections the rest of the co-pilot uses. No DOM.
(function (root) {
  const H = root.H2H;
  const views = ctx => ['ros'].concat(ctx.has.po ? ['po'] : []);
  const ncat = ctx => ctx.cats.length;
  // per-game category values from BBM (z-scores) summed over the categories you play for, times games left
  function fitVal(ctx, id) { const p = ctx.P[id]; const x = p && p.ros; if (!x) return -99; const g = x.g || 0;
    if (!x.cv) return (x.lv || 0) * g; let s = 0; ctx.cats.forEach(c => { if (ctx.punt && ctx.punt.includes(c)) return; s += x.cv[c] || 0; }); return s * g; }
  function leagueVal(ctx, id) { const p = ctx.P[id]; const x = p && p.ros; if (!x) return -1; const cs = ctx.cats.filter(c => x.cv && x.cv[c] != null);
    const pg = cs.length ? cs.reduce((a, c) => a + x.cv[c], 0) / cs.length : (x.lv || 0); return pg * Math.min(1, (x.g || 0) / (ctx.gMax || 60)); }
  const yVal = r => r ? 1000 / (r + 30) : null;       // Yahoo rank -> a value with diminishing returns (rank 1 ~ 32, rank 100 ~ 8)


  // ---- the league as the finder sees it: every team's weekly totals per view, and your baseline ----
  function setup(ctx, L, M) {
    const me = L.teams.find(t => t.tid === L.me); if (!me) return null; let blended = 0; ctx = Object.assign({}, ctx); // Basketball Monster's projections only: no blending in this season's stats if (ctx.valuing !== false) ctx.valuing = true;
    const S = { ctx, L, M, me, V: views(ctx), base: {}, w0: {}, wpo: ctx.wpo || 0.2, blended };
    S.V.forEach(v => { S.base[v] = L.teams.map(t => ({ tid: t.tid, ids: t.ids, vec: H.teamWeek(ctx, t.ids, v) })); });
    S.field = (v, tid, list) => v === 'ros' && tid === L.me && L.sched && L.sched.length ? L.sched.map(x => list.find(t => t.tid === x)).filter(Boolean) : list.filter(t => t.tid !== tid);
    // other teams are judged on every category (your punt is yours, not theirs)
    const ctxN = Object.assign({}, ctx, { punt: null });
    S.winOf = (v, tid, list) => { const t = list.find(x => x.tid === tid); const f = S.field(v, tid, list); let W = 0; const cp = {}; ctx.cats.forEach(c => cp[c] = 0); const cx = tid === L.me ? ctx : ctxN;
      f.forEach(o => { const r = H.matchup(cx, t.vec, o.vec); W += r.W / (f.length || 1); ctx.cats.forEach(c => cp[c] += r.cp[c] / (f.length || 1)); }); return { W, cp }; };
    S.V.forEach(v => { S.w0[v] = {}; L.teams.forEach(t => { S.w0[v][t.tid] = S.winOf(v, t.tid, S.base[v]); }); });
    // categories won per week, rest of season blended with the playoff weeks
    S.comb = (r, p) => (1 - S.wpo) * r + S.wpo * (p == null ? r : p);
    // a team's result after its roster changes (other teams unchanged)
    S.after = (changes) => { const out = {}; S.V.forEach(v => { const list = S.base[v].map(t => changes[t.tid] ? { tid: t.tid, ids: changes[t.tid], vec: H.teamWeek(ctx, changes[t.tid], v) } : t);
      out[v] = {}; Object.keys(changes).forEach(tid => { const r = S.winOf(v, tid, list); out[v][tid] = { d: (r.W - S.w0[v][tid].W) * ncat(ctx), cp: r.cp }; }); }); return out; };
    S.size = me.ids.length; S.board = (M && M.board) || null; // the panel's one measure, when it's there
    // weeks of regular season left (season.js passes Yahoo's; else from the days BBM projects, less 3 playoff weeks). The trade
    // bar is tradeBarOf in season.js (Settings → Advice): the one bar for sells and trades.
    S.weeks = (M && M.weeksLeft) || Math.max(1, Math.round((ctx.days.ros || 140) / 7) - 3);
    ctx.gMax = Math.max(1, ...Object.values(ctx.P).map(p => (p.ros && p.ros.g) || 0));
    // replacement level: the value of the 10th-best free agent, so a player is only worth what he adds over one
    const fv = (L.fas || []).map(id => leagueVal(ctx, id)).sort((a, b) => b - a); S.repl = fv.length ? fv[Math.min(9, fv.length - 1)] : -0.3;
    return S;
  }
  // your roster after a trade: cut whoever helps your categories least (never someone you just got), or fill from free agents
  function settleMe(S, ids, keep) { const ctx = S.ctx; let out = ids.slice(); const cut = [], fill = [];
    const bv = id => { const b = S.board && S.board.mine.find(x => x.id === id); return b ? b.val : fitVal(ctx, id); };
    while (out.length > S.size) { const c = out.filter(id => !keep.includes(id)).sort((a, b) => bv(a) - bv(b))[0]; if (!c) break; out = out.filter(x => x !== c); cut.push(c); }
    const pool = (S.L.fas || []).filter(id => !out.includes(id)).sort((a, b) => fitVal(ctx, b) - fitVal(ctx, a));
    while (out.length < S.size && pool.length) { const f = pool.shift(); out.push(f); fill.push(f); } return { ids: out, cut, fill }; }
  // their roster after a trade: they cut their lowest-valued player (never one they just got), or pick up the best free agent
  function settleThem(S, team, ids, keep) { const ctx = S.ctx; let out = ids.slice(); const cut = [], fill = [];
    while (out.length > team.ids.length) { const c = out.filter(id => !keep.includes(id)).sort((a, b) => leagueVal(ctx, a) - leagueVal(ctx, b))[0]; if (!c) break; out = out.filter(x => x !== c); cut.push(c); }
    const pool = (S.L.fas || []).filter(id => !out.includes(id)).sort((a, b) => leagueVal(ctx, b) - leagueVal(ctx, a));
    while (out.length < team.ids.length && pool.length) { const f = pool.shift(); out.push(f); fill.push(f); } return { ids: out, cut, fill }; }

  // ---- would they say yes? ----
  // Each player is worth what he adds over a free agent, with stars counting for more than their raw value (a manager won't swap
  // one star for two players who add up to him). The same on Yahoo's rank. A deal is fair when their roster's total doesn't drop
  // by more than a few percent of what they send on either measure; when they send the best player in the deal, it has to go up.
  function theirView(S, team, sends, gets, after) { const ctx = S.ctx, M = S.M; const C = S.vc || (S.vc = { b: {}, y: {} });
    const sur = id => { if (id in C.b) return C.b[id]; const x = Math.max(0, leagueVal(ctx, id) - S.repl); return (C.b[id] = Math.pow(x, 1.4)); };
    const yr = id => (M && M.yrank && M.yrank(id)) || null; const ysur = id => { if (id in C.y) return C.y[id]; const r = yr(id); return (C.y[id] = r ? Math.pow(Math.max(0, yVal(r) - yVal(150)), 1.4) : null); };
    const sumB = ids => ids.reduce((a, id) => a + sur(id), 0);
    const dB = sumB(after) - sumB(team.ids), sentB = sumB(sends) || 0.01;
    const noY = sends.some(id => ysur(id) == null) || gets.some(id => ysur(id) == null);
    let dY = null, sentY = 1; if (!noY) { const sumY = ids => ids.reduce((a, id) => a + (ysur(id) || 0), 0); dY = sumY(after) - sumY(team.ids); sentY = sumY(sends) || 0.01; }
    let best = null, bv = -1e9; sends.concat(gets).forEach(id => { const v = sur(id); if (v > bv) { bv = v; best = id; } }); const giveBest = sends.includes(best);
    const tolB = giveBest ? 0.05 * sentB : -0.05 * sentB, tolY = giveBest ? 0.05 * sentY : -0.05 * sentY; // a premium when they give the best player
    const okB = dB >= tolB, okY = noY || dY >= tolY;
    return { fair: okB && okY, dB: dB / sentB, dY: noY ? null : dY / sentY, noY, giveBest }; }

  // ---- one deal, fully assessed ----
  function evalDeal(S, tid, give, get) { const team = S.L.teams.find(t => t.tid === tid); if (!team) return null;
    const mine = settleMe(S, S.me.ids.filter(id => !give.includes(id)).concat(get), get);
    const theirs = settleThem(S, team, team.ids.filter(id => !get.includes(id)).concat(give), give);
    const r = S.after({ [S.me.tid]: mine.ids, [tid]: theirs.ids });
    let my = { ros: r.ros[S.me.tid].d, po: r.po ? r.po[S.me.tid].d : null }; my.all = S.comb(my.ros, my.po); my.season = my.all * S.weeks;
    // your side on the one measure every page uses: expected categories a week against the league, over the rest of the season
    const B = S.board && S.board.of(mine.ids); if (B) my = { ros: B.g, po: null, all: B.g, season: B.g * S.board.weeks, board: true };
    const th = { ros: r.ros[tid].d, po: r.po ? r.po[tid].d : null }; th.all = S.comb(th.ros, th.po); th.season = th.all * S.weeks;
    const cats = B ? S.ctx.cats.map(c => ({ c, label: H.LBL[c], from: S.board.cp[c], to: B.cp[c], d: B.cp[c] - S.board.cp[c] })) : S.ctx.cats.map(c => ({ c, label: H.LBL[c], from: S.w0.ros[S.me.tid].cp[c], to: r.ros[S.me.tid].cp[c], d: r.ros[S.me.tid].cp[c] - S.w0.ros[S.me.tid].cp[c] }));
    const theirCats = S.ctx.cats.map(c => ({ c, label: H.LBL[c], d: r.ros[tid].cp[c] - S.w0.ros[tid].cp[c] }));
    const view = theirView(S, team, get, give, theirs.ids);
    // helps both: they gain categories too (at least half a category over the season) and it's fair on value;
    // fair: fair on value, better for you; anything else they'd turn down
    const kind = view.fair ? (th.season >= 0.5 ? 'both' : 'fair') : 'no';
    return { tid, give, get, mine: my, theirs: th, cats, theirCats, cut: mine.cut, fill: mine.fill, theirCut: theirs.cut, theirFill: theirs.fill, accept: Object.assign(view, { kind, verdict: kind === 'both' ? 'accept' : kind === 'fair' ? 'sweetener' : 'unlikely' }) };
  }

  root.TRADE = { setup, evalDeal };
  if (typeof module !== 'undefined') module.exports = root.TRADE;
})(typeof window !== 'undefined' ? window : globalThis);
