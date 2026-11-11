// Trades: deals across the league from 1-for-1 to 3-for-3 (uneven ones included), which of your players are worth more to others
// than to you, which teams fit, and the verdict on any deal. Your side is the categories you'd win over the rest of the season
// against the opponents left on your schedule (playoff weeks count for a capped share). Their side is what managers look at:
// Basketball Monster's value of the players (all categories, no punt) and Yahoo's rank, plus whether their own categories improve.
// Pure functions over the same BBM projections the rest of the co-pilot uses. No DOM.
(function (root) {
  const H = root.H2H;
  const views = ctx => ['ros'].concat(ctx.has.po ? ['po'] : []);
  const ncat = ctx => ctx.cats.length;
  // per-game category values from BBM (z-scores) summed over the categories you play for, times games left
  function fitVal(ctx, id) { const p = ctx.P[id]; const x = p && p.ros; if (!x) return -99; const g = x.g || 0;
    if (!x.cv) return (x.lv || 0) * g; let s = 0; ctx.cats.forEach(c => { if (ctx.punt && ctx.punt.includes(c)) return; s += x.cv[c] || 0; }); return s * g; }
  const bbmVal = (ctx, id) => H.worth(ctx, id, 'ros'); // BBM value x games left (sorting lists)
  // what any manager sees: BBM's value over every category in the league (no punt), scaled by the share of games he'll play
  // per game, as Basketball Monster shows it (LeagueV); leagueVal below also scales it by the games he'll play
  function leagueValPG(ctx, id) { const p = ctx.P[id]; const x = p && p.ros; if (!x) return null; const cs = ctx.cats.filter(c => x.cv && x.cv[c] != null); return cs.length ? cs.reduce((a, c) => a + x.cv[c], 0) / cs.length : (x.lv != null ? x.lv : null); }
  function leagueVal(ctx, id) { const p = ctx.P[id]; const x = p && p.ros; if (!x) return -1; const cs = ctx.cats.filter(c => x.cv && x.cv[c] != null);
    const pg = cs.length ? cs.reduce((a, c) => a + x.cv[c], 0) / cs.length : (x.lv || 0); return pg * Math.min(1, (x.g || 0) / (ctx.gMax || 60)); }
  const yVal = r => r ? 1000 / (r + 30) : null;       // Yahoo rank -> a value with diminishing returns (rank 1 ~ 32, rank 100 ~ 8)

  // ---- this season so far, alongside the projection ----
  // Each stat leans on this season's numbers only as fast as that stat becomes reliable. Minutes and shot attempts settle within a
  // few weeks, so they count early; rebounds, assists, blocks and turnovers next; steals and 3-pointers made later; shooting
  // percentages only after hundreds of attempts. Weight on the season = games / (games + K), or attempts / (attempts + K) for
  // percentages. Points are rebuilt from the blended makes, so a hot shooting start is never counted twice.
  const KG = { m: 8, fga: 10, fta: 15, r: 10, a: 10, b: 15, to: 15, '2d': 20, s: 25, 3: 25 };
  const KA = { fg: 300, ft: 120 };
  function blendRos(p) { const x = p && p.ros, s = p && p.season; if (!x || !x.st || !s || !s.st || !(s.g >= 3)) return null;
    const n = s.g, xs = x.st, ss = s.st; const w = k => n / (n + KG[k]);
    const pc = (st, mk, ak, pk) => st[pk] != null ? st[pk] : st[ak] ? (st[mk] || 0) / st[ak] : null;
    const out = Object.assign({}, xs); const pm = x.m, sm = s.m; const mb = pm && sm ? pm * (1 - w('m')) + sm * w('m') : null;
    const bl = k => { if (ss[k] == null || xs[k] == null) return; if (mb) { out[k] = ((xs[k] / pm) * (1 - w(k)) + (ss[k] / sm) * w(k)) * mb; } else out[k] = xs[k] * (1 - w(k)) + ss[k] * w(k); };
    ['fga', 'fta', 'r', 'a', 'b', 'to', '2d', 's', '3'].forEach(bl);
    [['fg', 'fga', 'fgp', KA.fg], ['ft', 'fta', 'ftp', KA.ft]].forEach(([mk, ak, pk, K]) => { const pp = pc(xs, mk, ak, pk), sp = pc(ss, mk, ak, pk); if (pp == null) return; const A = (ss[ak] || 0) * n; const wf = sp == null ? 0 : A / (A + K); const pct = pp * (1 - wf) + (sp || 0) * wf; out[mk] = (out[ak] || 0) * pct; out[pk] = pct; });
    out.p = 2 * (out.fg || 0) + (out['3'] || 0) + (out.ft || 0);
    return Object.assign({}, x, { st: out, m: mb || x.m, blend: { n, wMin: +w('m').toFixed(2), wShot: { fg: +((ss.fga || 0) * n / ((ss.fga || 0) * n + KA.fg)).toFixed(2) } } }); }
  // the same players with blended rest-of-season numbers (projection only where there's no season data yet)
  function blendCtx(ctx) { const P = {}; let n = 0; Object.entries(ctx.P).forEach(([id, p]) => { const b = blendRos(p); if (b) { n++; P[id] = Object.assign({}, p, { ros: b }); } else P[id] = p; }); return { ctx: Object.assign({}, ctx, { P }), n }; }

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
    S.size = me.ids.length;
    // weeks of regular season left (season.js passes Yahoo's; else from the days BBM projects, less 3 playoff weeks) and the bar
    S.weeks = (M && M.weeksLeft) || Math.max(1, Math.round((ctx.days.ros || 140) / 7) - 3); S.bar = (M && M.tradeBar) || (ctx.cats.length >= 11 ? 5 : 4);
    ctx.gMax = Math.max(1, ...Object.values(ctx.P).map(p => (p.ros && p.ros.g) || 0));
    // replacement level: the value of the 10th-best free agent, so a player is only worth what he adds over one
    const fv = (L.fas || []).map(id => leagueVal(ctx, id)).sort((a, b) => b - a); S.repl = fv.length ? fv[Math.min(9, fv.length - 1)] : -0.3;
    return S;
  }
  // your roster after a trade: cut whoever helps your categories least (never someone you just got), or fill from free agents
  function settleMe(S, ids, keep) { const ctx = S.ctx; let out = ids.slice(); const cut = [], fill = [];
    while (out.length > S.size) { const c = out.filter(id => !keep.includes(id)).sort((a, b) => fitVal(ctx, a) - fitVal(ctx, b))[0]; if (!c) break; out = out.filter(x => x !== c); cut.push(c); }
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
    const my = { ros: r.ros[S.me.tid].d, po: r.po ? r.po[S.me.tid].d : null }; my.all = S.comb(my.ros, my.po); my.season = my.all * S.weeks;
    const th = { ros: r.ros[tid].d, po: r.po ? r.po[tid].d : null }; th.all = S.comb(th.ros, th.po); th.season = th.all * S.weeks;
    const cats = S.ctx.cats.map(c => ({ c, label: H.LBL[c], from: S.w0.ros[S.me.tid].cp[c], to: r.ros[S.me.tid].cp[c], d: r.ros[S.me.tid].cp[c] - S.w0.ros[S.me.tid].cp[c] }));
    const theirCats = S.ctx.cats.map(c => ({ c, label: H.LBL[c], d: r.ros[tid].cp[c] - S.w0.ros[tid].cp[c] }));
    const view = theirView(S, team, get, give, theirs.ids);
    // helps both: they gain categories too (at least half a category over the season) and it's fair on value;
    // fair: fair on value, better for you; anything else they'd turn down
    const kind = view.fair ? (th.season >= 0.5 ? 'both' : 'fair') : 'no';
    return { tid, give, get, mine: my, theirs: th, cats, theirCats, cut: mine.cut, fill: mine.fill, theirCut: theirs.cut, theirFill: theirs.fill, accept: Object.assign(view, { kind, verdict: kind === 'both' ? 'accept' : kind === 'fair' ? 'sweetener' : 'unlikely' }) };
  }

  // ---- chips: your players worth more to the league than to you ----
  function chips(S) { const out = [];
    S.me.ids.forEach(id => { const p = S.ctx.P[id]; if (!p || !p.ros) return; const mine = settleMe(S, S.me.ids.filter(x => x !== id), []); const r = S.after({ [S.me.tid]: mine.ids });
      const toMe = -S.comb(r.ros[S.me.tid].d, r.po ? r.po[S.me.tid].d : null); out.push({ id, toMe, bbm: bbmVal(S.ctx, id), yrank: (S.M && S.M.yrank(id)) || null }); });
    // rank both ways: how much the league values him vs how much he's worth to you; the gap is what you can sell
    const byLeague = out.slice().sort((a, b) => b.bbm - a.bbm), byMe = out.slice().sort((a, b) => b.toMe - a.toMe);
    out.forEach(o => { o.leagueRank = byLeague.indexOf(o) + 1; o.myRank = byMe.indexOf(o) + 1; o.gap = o.myRank - o.leagueRank; });
    return out.sort((a, b) => b.gap - a.gap || a.toMe - b.toMe); }

  // ---- each team's standing per category against the league average (per-week totals; turnovers and percentages handled) ----
  function teamZ(S) { const cats = S.ctx.cats; const vec = S.base.ros; const mean = {}, sd = {}, out = {};
    const val = (t, c) => { const m = t.vec.m; if (c === 'fg%') return m.fga ? m.fg / m.fga : 0; if (c === 'ft%') return m.fta ? m.ft / m.fta : 0; return c === 'to' ? -(m.to || 0) : (m[c] || 0); };
    cats.forEach(c => { const xs = vec.map(t => val(t, c)); const mu = xs.reduce((a, b) => a + b, 0) / xs.length; mean[c] = mu; sd[c] = Math.sqrt(xs.reduce((a, b) => a + (b - mu) * (b - mu), 0) / xs.length) || 1; });
    vec.forEach(t => { const z = {}; cats.forEach(c => z[c] = (val(t, c) - mean[c]) / sd[c]); out[t.tid] = z; }); return out; }
  const cvOf = (ctx, id) => ((ctx.P[id] || {}).ros || {}).cv || {};

  // ---- partners: teams weak where your chips are strong; for each, what you'd offer and what you'd take from their surplus ----
  function partners(S, chipList, targetList) { const ctx = S.ctx; const cats = ctx.cats; const punt = ctx.punt || []; const Z = teamZ(S);
    const sellIds = chipList.filter(o => o.gap > 0).slice(0, 8).map(o => o.id);
    return S.base.ros.filter(t => t.tid !== S.me.tid).map(t => { const z = Z[t.tid]; const weak = cats.slice().sort((a, b) => z[a] - z[b]).slice(0, 3);
      // their surplus: their strongest categories that you still play for (not your punts)
      const strong = cats.filter(c => !punt.includes(c) && z[c] > 0.2).sort((a, b) => z[b] - z[a]).slice(0, 2);
      // what each of your chips sells them: his best categories among their weak spots
      const cover = sellIds.map(id => { const cv = cvOf(ctx, id); const hit = weak.filter(c => z[c] < 0 && (cv[c] || 0) >= 0.3).sort((a, b) => (cv[b] || 0) - (cv[a] || 0));
        return { id, s: weak.reduce((a, c) => a + Math.max(0, cv[c] || 0), 0), cats: hit.slice(0, 2) }; }).filter(x => x.s > 0.3 && x.cats.length).sort((a, b) => b.s - a.s);
      const hold = (targetList || []).filter(x => x.tid === t.tid);
      // who carries that surplus: a player from a deal already found with them first, otherwise their best in those categories
      const team = (S.L.teams || []).find(x => x.tid === t.tid) || { ids: [] }; const pool = hold.length ? [...new Set(hold.map(x => x.id))] : team.ids;
      const carrier = strong.length ? pool.map(id => ({ id, s: strong.reduce((a, c) => a + Math.max(0, cvOf(ctx, id)[c] || 0), 0) })).filter(x => x.s > 0.3).sort((a, b) => b.s - a.s).slice(0, 2).map(x => x.id) : [];
      const score = (cover[0] ? cover[0].s : 0) + hold.reduce((a, x) => a + Math.max(0, x.gain), 0) * 0.5;
      return { tid: t.tid, weak, wz: weak.map(c => z[c]), strong, carrier, cover: cover.slice(0, 3), hold: hold.slice(0, 3), score }; }).sort((a, b) => b.score - a.score); }

  // ---- buyers: for each player you could sell, the teams that need what he does best (a team you already have a deal with first) ----
  function buyers(S, chipList, deals) { const ctx = S.ctx; const cats = ctx.cats; const Z = teamZ(S);
    return chipList.filter(o => o.gap > 0).map(o => { const cv = cvOf(ctx, o.id);
      const list = S.base.ros.filter(t => t.tid !== S.me.tid).map(t => { const z = Z[t.tid];
        const need = cats.filter(c => z[c] < 0 && (cv[c] || 0) >= 0.3).sort((a, b) => (cv[b] || 0) * -z[b] - (cv[a] || 0) * -z[a]);
        const s = need.reduce((a, c) => a + (cv[c] || 0) * -z[c], 0); const deal = (deals || []).filter(d => d.tid === t.tid && d.give.includes(o.id)).sort((a, b) => b.mine.season - a.mine.season)[0] || null;
        return { tid: t.tid, cats: need.slice(0, 2), s: s + (deal ? 2 : 0), deal }; }).filter(x => x.cats.length || x.deal).sort((a, b) => b.s - a.s);
      return Object.assign({}, o, { buyers: list.slice(0, 2), best: Object.entries(cv).filter(([c]) => cats.includes(c)).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]) }); }); }

  // ---- the deal search: every team, every shape from 1-for-1 to 3-for-3 (2-for-1 and 3-for-2 both ways) ----
  // A quick screen first: what each player is worth to your categories (weighted to the ones you can still swing) and the same
  // fairness test the full check uses. The most promising deals per team then get the full rest-of-season simulation for both
  // teams. Only deals worth at least the bar for you (4 categories over the season in a 9-category league, 5 in 11) are kept.
  const SHAPES = [[1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3], [3, 3]];
  function combos(arr, k) { const out = []; const rec = (s, cur) => { if (cur.length === k) { out.push(cur.slice()); return; } for (let i = s; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); } }; rec(0, []); return out; }
  function search(S, opt) { opt = opt || {}; const ctx = S.ctx; const bar = opt.bar != null ? opt.bar : S.bar;
    // how many more categories a week you'd win per extra unit of each weekly stat total, against the opponents left on your
    // schedule: a player's quick worth is his weekly stats priced at those rates (the full check replaces it for the shortlist)
    const KEYS = ['p', '3', 'r', 'a', 's', 'b', 'to', '2d', 'fg', 'fga', 'ft', 'fta']; const base = S.base.ros.find(t => t.tid === S.me.tid); const field = S.field('ros', S.me.tid, S.base.ros);
    const Wof = m => field.reduce((a, o) => a + H.matchup(ctx, { m, games: 0 }, o.vec).W, 0) / (field.length || 1);
    const W0 = Wof(base.vec.m); const grad = {}; KEYS.forEach(k => { const h = Math.max(0.5, Math.abs(base.vec.m[k] || 0) * 0.02); const m2 = Object.assign({}, base.vec.m); m2[k] = (m2[k] || 0) + h; grad[k] = (Wof(m2) - W0) / h * ncat(ctx); });
    const wk = Math.max(1, (ctx.days.ros || 140) / 7);
    const quick = id => { const x = ctx.P[id] && ctx.P[id].ros; if (!x || !(x.g > 0)) return -1; const st = x.st || {}; const f = x.g / wk; let s = 0;
      KEYS.forEach(k => { let v = st[k]; if (k === '2d' && v == null) v = ctx.ddRate && ctx.ddRate[id] != null ? ctx.ddRate[id] : 0; if (k === 'fg' && v == null && st.fgp != null) v = st.fgp * (st.fga || 0); if (k === 'ft' && v == null && st.ftp != null) v = st.ftp * (st.fta || 0); s += grad[k] * (v || 0) * f; }); return s; };
    const myQ = {}; S.me.ids.forEach(id => myQ[id] = quick(id)); const faQ = (S.L.fas || []).map(quick).sort((a, b) => b - a)[0] || 0;
    const mySorted = S.me.ids.slice().sort((a, b) => myQ[a] - myQ[b]);
    const teams = S.L.teams.filter(t => t.tid !== S.me.tid && (!opt.only || t.tid === String(opt.only)));
    const found = []; let done = 0; const perShape = opt.only ? 14 : (opt.perShape || 7);
    return new Promise(resolve => {
      const step = () => { const t = teams[done]; if (!t) { finish(); return; }
        const tv = {}; t.ids.forEach(id => tv[id] = leagueVal(ctx, id)); const theirSorted = t.ids.slice().sort((a, b) => tv[a] - tv[b]);
        const tq = {}; t.ids.forEach(id => tq[id] = quick(id));
        const gC = {}, tC = {}; [1, 2, 3].forEach(k => { gC[k] = combos(S.me.ids, k); tC[k] = combos(t.ids, k); });
        const cand = [];
        SHAPES.forEach(([a, b]) => gC[a].forEach(g => tC[b].forEach(r => {
          // your side, roughly: what you get minus what you give, minus whoever you'd cut or plus a free agent
          let mq = 0; r.forEach(id => mq += tq[id]); g.forEach(id => mq -= myQ[id]);
          if (b > a) { let n = b - a; for (const id of mySorted) { if (!n) break; if (g.includes(id)) continue; mq -= myQ[id]; n--; } } else if (a > b) mq += (a - b) * faQ;
          if (mq <= 0) return;
          // their side, roughly: roster value change with their cut / pickup
          let ids = t.ids.filter(id => !r.includes(id)).concat(g); if (ids.length > t.ids.length) { let n = ids.length - t.ids.length; const keep = new Set(g); for (const id of theirSorted) { if (!n) break; if (keep.has(id) || r.includes(id)) continue; ids = ids.filter(x => x !== id); n--; } }
          const v = theirView(S, t, r, g, ids); if (!v.fair) return; cand.push({ g, r, mq }); })));
        // the best few of each shape go to the full check, so a strong 1-for-1 isn't crowded out by uneven deals
        const short = []; SHAPES.forEach(([a, b]) => cand.filter(c => c.g.length === a && c.r.length === b).sort((x, y) => y.mq - x.mq).slice(0, perShape).forEach(c => short.push(c)));
        short.forEach(c => { const d = evalDeal(S, t.tid, c.g, c.r); if (d && d.accept.kind !== 'no' && d.mine.season >= bar) found.push(d); });
        done++; if (opt.onStep) opt.onStep(done, teams.length); setTimeout(step, 0); };
      const finish = () => {
        // a bigger deal only shows when it's clearly better than a smaller one inside it
        const sub = (a, b) => a.every(x => b.includes(x)); const kept = found.filter(d => !found.some(e => e !== d && e.tid === d.tid && sub(e.give, d.give) && sub(e.get, d.get) && (e.give.length + e.get.length) < (d.give.length + d.get.length) && e.mine.season >= d.mine.season - 1));
        kept.sort((a, b) => (b.mine.season + (b.accept.kind === 'both' ? 1.5 : 0)) - (a.mine.season + (a.accept.kind === 'both' ? 1.5 : 0)));
        const used = {}, perTeam = {}, pick = []; const maxTeam = opt.only ? 12 : (opt.maxTeam || 2); const maxUse = opt.maxUse || 2;
        kept.forEach(d => { const k = d.give.concat(d.get); if (pick.length >= (opt.n || 10) || (perTeam[d.tid] || 0) >= maxTeam || k.some(id => (used[id] || 0) >= maxUse)) return; k.forEach(id => used[id] = (used[id] || 0) + 1); perTeam[d.tid] = (perTeam[d.tid] || 0) + 1; pick.push(d); });
        // timing: does Basketball Monster's projection on its own agree? Act now when it does; watch when only the season so far backs it
        if (opt.S0) pick.forEach(d => { const e = evalDeal(opt.S0, d.tid, d.give, d.get); d.proj = e ? e.mine.season : null; d.timing = !S.blended ? null : (d.proj != null && d.proj >= bar) ? 'now' : 'watch'; }); // no season data yet: no timing to give
        resolve(pick); };
      setTimeout(step, 0); }); }

  // ---- what a team needs: its categories ranked by how often it's projected to win them against the league (every category
  // counts for them, whatever you punt). Below 20%: it looks to be giving up on it. 20–45%: it needs help. Above 60%: strong.
  // Your players who'd help most in its needs come with it (BBM category values, scaled by games left).
  function needs(S, tid) { const ctx = S.ctx; const w = S.w0.ros[tid]; if (!w) return null; const cp = w.cp; const order = ctx.cats.slice().sort((a, b) => cp[a] - cp[b]);
    const punt = order.filter(c => cp[c] < 0.2); let need = order.filter(c => cp[c] >= 0.2 && cp[c] < 0.45).slice(0, 3); if (!need.length) need = order.filter(c => cp[c] >= 0.2 && cp[c] < 0.5).slice(0, 2);
    const strong = order.slice().reverse().filter(c => cp[c] > 0.6).slice(0, 3);
    const gs = id => { const x = ctx.P[id] && ctx.P[id].ros; return x ? Math.min(1, (x.g || 0) / (ctx.gMax || 60)) : 0; };
    const helpOf = id => { const x = ctx.P[id] && ctx.P[id].ros; if (!x || !x.cv) return { s: 0, cats: [] }; const cats = need.filter(c => (x.cv[c] || 0) >= 0.5); return { s: need.reduce((a, c) => a + Math.max(0, x.cv[c] || 0), 0) * gs(id), cats }; };
    const helpers = tid === S.me.tid ? [] : S.me.ids.map(id => Object.assign({ id }, helpOf(id))).filter(h => h.cats.length).sort((a, b) => b.s - a.s).slice(0, 3);
    return { tid, cp, need, punt, strong, helpers, helpOf }; }

  root.TRADE = { setup, blendRos, evalDeal, chips, partners, buyers, search, needs, fitVal, bbmVal, leagueVal, leagueValPG };
  if (typeof module !== 'undefined') module.exports = root.TRADE;
})(typeof window !== 'undefined' ? window : globalThis);
