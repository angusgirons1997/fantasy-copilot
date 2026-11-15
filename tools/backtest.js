// Forecast backtest for the co-pilot: node tools/backtest.js copilot-forecast-data.json
// 1. Out of sample: forecasts logged before each week (every league matchup, and your own next-week forecast) against
//    Yahoo's final results: Brier score, calibration bins, best spread multiplier.
// 2. Retro, league-wide, for weeks with no logged forecast: each team's current roster at Basketball Monster's
//    rest-of-season per-game projections, scaled to the games that team actually played that week. Rosters have changed
//    since, and games are known in hindsight, so this tests the per-game spread and the means, not the full forecast.
// Prints a report; with --json writes the numbers too.
'use strict';
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '..', 'firefox') + path.sep; globalThis.window = globalThis;
require(F + 'h2h.js'); require(F + 'strategy.js'); require(F + 'context.js');
const rep = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const ST = rep.store || rep;
const H = window.H2H, CTX = window.CTX;
const val = (st, c) => !st ? null : c === 'fg%' ? (st['fg%'] != null ? st['fg%'] : st.fga ? st.fg / st.fga : null) : c === 'ft%' ? (st['ft%'] != null ? st['ft%'] : st.fta ? st.ft / st.fta : null) : st[c];
const inv = p => { p = Math.min(0.995, Math.max(0.005, p)); let lo = -8, hi = 8; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (H.Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
function score(pairs, label) { const n = pairs.length; if (!n) return { label, n: 0 };
  const at = (x, m) => Math.min(0.995, Math.max(0.005, H.Phi(inv(x.p) * (x.s || 1) / m)));
  const ll = m => pairs.reduce((a, x) => { const q = at(x, m); return a - (x.y ? Math.log(q) : Math.log(1 - q)); }, 0);
  let best = { m: 1, ll: Infinity }; for (let m = 0.3; m <= 3.01; m += 0.025) { const v = ll(m); if (v < best.ll) best = { m: +m.toFixed(3), ll: v }; }
  // rough 80% interval for the multiplier: within 0.82 log-likelihood units (chi-square, 1 df) of the best
  const ok = []; for (let m = 0.3; m <= 3.01; m += 0.025) if (ll(m) - best.ll <= 0.82) ok.push(+m.toFixed(3));
  const brier = f => pairs.reduce((a, x) => a + (f(x) - x.y) ** 2, 0) / n;
  const bins = [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.01]].map(r => { const B = pairs.filter(x => x.p >= r[0] && x.p < r[1]); return { range: r.map(v => Math.round(v * 100)).join('–') + '%', n: B.length, forecast: B.length ? +(B.reduce((a, x) => a + x.p, 0) / B.length).toFixed(3) : null, won: B.length ? +(B.reduce((a, x) => a + x.y, 0) / B.length).toFixed(3) : null }; });
  const byCat = {}; pairs.forEach(x => { (byCat[x.c] = byCat[x.c] || []).push(x); });
  const catFit = Object.fromEntries(Object.entries(byCat).map(([c, P]) => { let b = { m: 1, ll: Infinity }; for (let m = 0.3; m <= 3.01; m += 0.05) { const v = P.reduce((a, x) => { const q = at(x, m); return a - (x.y ? Math.log(q) : Math.log(1 - q)); }, 0); if (v < b.ll) b = { m: +m.toFixed(2), ll: v }; } return [c, { n: P.length, fit: b.m }]; }));
  return { label, n, weeks: new Set(pairs.map(x => x.w)).size, brier: +brier(x => x.p).toFixed(4), brierAtFit: +brier(x => at(x, best.m)).toFixed(4), coinFlip: 0.25, fit: best.m, range80: [ok[0], ok[ok.length - 1]], bins, byCategory: catFit }; }

const leagues = [...new Set(Object.keys(ST).filter(k => k.startsWith('yr:')).map(k => k.slice(3)))];
const out = {};
leagues.forEach(lid => { const y = ST['yr:' + lid]; const lg = y.league; const res = { league: lg };
  // 1. out of sample
  const oos = CTX.forecastPairs(ST, lid).map(x => ({ p: x.p, y: x.y, s: x.s, c: x.c, w: x.w }));
  Object.keys(ST).filter(k => k.startsWith('track:' + lg + ':')).forEach(k => { const t = ST[k]; if (!t.actual || !t.first) return; if (oos.some(x => x.w === t.start)) return;
    Object.entries(t.actual).forEach(([c, a]) => { const q = (t.first.cats || {})[c]; if (q != null && a !== 0.5) oos.push({ p: q, y: a, s: 1, c, w: t.start }); }); });
  res.outOfSample = score(oos, 'forecasts made before each week');
  // 2. retro, league-wide
  let M = null; try { const ss = ST['sset:' + lg] || {}; M = CTX.model(ST, lid, { punt: null, yr: y, obj: 'cats', today: (rep.at || new Date().toISOString()).slice(0, 10), rules: {} }); } catch (e) { res.retroErr = 'model: ' + e.message; }
  const retro = [], bias = {};
  if (M) { const ctx = M.ctx; ctx.valuing = false; ctx.sdMul = 1; const T = {}; M.L.teams.forEach(t => T[t.tid] = t);
    Object.keys(ST).filter(k => k.startsWith('lgweek:' + lid + ':')).forEach(k => { const lw = ST[k]; if (!lw || !lw.teams) return; const done = new Set();
      const vec = tid => { const t = T[tid], r = lw.teams[tid]; if (!t || !r || !r.games || !r.games.played) return null; const A = H.teamWeek(ctx, t.ids, 'ros'); if (!A.games) return null; const f = r.games.played / A.games; const m = {}; Object.keys(A.m).forEach(q => m[q] = A.m[q] * f); return { m, games: r.games.played }; };
      Object.entries(lw.teams).forEach(([a, ra]) => { const b = String(ra.opp); if (done.has(a) || done.has(b)) return; done.add(a); done.add(b); const A = vec(a), B = vec(b), rb = lw.teams[b]; if (!A || !B || !rb) return;
        const mu = H.matchup(ctx, A, B);
        ctx.cats.forEach(c => { const x = val(ra.st, c), z = val(rb.st, c); if (x == null || z == null || isNaN(x) || isNaN(z) || x === z) return; retro.push({ p: mu.cp[c], y: (c === 'to' ? x < z : x > z) ? 1 : 0, s: 1, c, w: lw.week });
          // means: projected vs actual totals for both teams (counting categories), as actual ÷ projected
          if (!/%$/.test(c)) [[A, x], [B, z]].forEach(([V, act]) => { const pr = V.m[c]; if (pr > 0) { (bias[c] = bias[c] || []).push(act / pr); } }); }); }); }); }
  res.retro = score(retro, 'retro: current rosters, actual games, rest-of-season per-game projections');
  res.retroMeans = Object.fromEntries(Object.entries(bias).map(([c, L]) => { const s = L.slice().sort((a, b) => a - b); return [c, { n: L.length, actualOverProjected: +s[Math.floor(s.length / 2)].toFixed(3) }]; }));
  res.spreadNow = { SD_SCALE: 2.5, learned: CTX.calibrate(ST, lid).mul };
  out[lid] = res; });

Object.keys(out).forEach(lid => { out[lid].field = CTX.uplift(ST, lid); }); const PS = CTX.projScore(ST);
const pct = x => x == null ? '–' : Math.round(x * 100) + '%';
Object.values(out).forEach(r => { console.log(`\n=== ${r.league}`);
  [r.outOfSample, r.retro].forEach(s => { if (!s || !s.n) { console.log(`${s ? s.label : ''}: no data`); return; }
    console.log(`${s.label}: ${s.n} category results over ${s.weeks} weeks`);
    console.log(`  Brier ${s.brier} (coin flip 0.25) → ${s.brierAtFit} at the best spread`);
    console.log(`  best spread multiplier ×${s.fit} (80% range ×${s.range80[0]}–×${s.range80[1]}); below 1 = forecasts too cautious, above 1 = too confident`);
    console.log('  calibration: ' + s.bins.filter(b => b.n).map(b => `${b.range}: forecast ${pct(b.forecast)}, won ${pct(b.won)} (${b.n})`).join(' · '));
    console.log('  by category: ' + Object.entries(s.byCategory).map(([c, v]) => `${c} ×${v.fit} (${v.n})`).join(', ')); });
  if (Object.keys(r.retroMeans).length) console.log('  actual ÷ projected totals (median): ' + Object.entries(r.retroMeans).map(([c, v]) => `${c} ${v.actualOverProjected}`).join(', '));
  if (r.retroErr) console.log('  ' + r.retroErr);
  if (r.field && r.field.weeks) { const f = o => Object.entries(o).map(([c, v]) => `${c} ${Math.round((v.ratio - 1) * 100)}%`).join(', '); console.log(`  the field over ${r.field.weeks} weeks (actual vs projected): opponents ${f(r.field.opp)}; you ${f(r.field.me)}`); } });
if (PS.weeks) { console.log(`\n=== projection scorecard, ${PS.weeks} weeks (typical miss per game: Basketball Monster / Yahoo / average)`); Object.keys(PS.bbm).forEach(c => console.log(`  ${c}: ${[PS.bbm[c], PS.yh[c], PS.blend[c]].map(x => x == null ? '–' : x.toFixed(3)).join(' / ')}`)); console.log(`  average clearly better in ${PS.blendWins} of ${PS.cats} categories`); }
if (process.argv.includes('--json')) fs.writeFileSync(process.argv[2].replace(/\.json$/, '') + '.backtest.json', JSON.stringify({ leagues: out, projections: PS }, null, 1));
