// How wide a fantasy week swings around its forecast, per category: the numbers behind SCALE in firefox/h2h.js.
//
// Data (read 15 Nov 2026 from Basketball Monster's player rankings, 2025-26 season, Total stats, All Players):
// every player's totals for each Monday-to-Sunday week from 27 Oct 2025 to 12 Apr 2026 (24 weeks), plus the full season.
// Collected with ASP.NET postbacks (DataSetControl 160, DateFilterControl DateRange, one refresh per week); the owner's page
// settings were put back afterwards.
//
// Method: 1,500 random 13-man rosters from the 156 players with the most minutes. For each week:
//   z = (actual team total - forecast) / sqrt(VARK[c] × forecast)
// for counting categories, and the binomial version (× 1.3) for percentages. The standard deviation of z is the scale the
// model needs (it multiplies sqrt(VARK × mean)). Forecasts:
//   oracle, games known: season per-game averages × games actually played (pure game-to-game randomness)
//   oracle, games average: season per-game averages × season games per week
//   naive: each player's previous 4 weeks (rates and games); weeks 5-24, rosters with all 13 players forecastable
// Results (standard deviation of z):
//             points 3s   reb  ast  stl  blk  TO   FG%  FT%  FGM  FTM
//   known     2.05  1.13 1.41 1.22 1.10 0.94 1.14 0.86 0.84
//   average   3.25  1.65 2.27 1.91 1.43 1.17 1.67 0.98
//   naive     3.16  1.63 2.37 1.93 1.51 1.37 1.76 1.02 1.15 2.85 1.86
// The model used 2.5 for every category before 7.34.0: too narrow for points, about right for rebounds, and too wide for
// everything else, most of all blocks and the percentages. SCALE now uses the naive row: Basketball Monster's projections
// should do no worse than a 4-week average, so it errs wide. The forecast check (ctx.sdMul) adjusts it from league results.
//
// To re-run: on basketballmonster.com/playerrankings.aspx (signed in), collect weeks into
// window.W = { 'YYYY-MM-DD': { 'Name|TEAM': [g, min, pts, 3, reb, ast, stl, blk, fgm, fga, ftm, fta, to] } } and the
// season into window.S (same shape). Then paste study() below into the console. Restore the page settings afterwards.
function study(W, S) {
  const wk = Object.keys(W).sort();
  const VARK = { p: 2.2, 3: 1.4, r: 1.6, a: 1.6, s: 1.2, b: 1.5, to: 1.2, fg: 1.0, ft: 1.6 };
  const IX = { p: 2, 3: 3, r: 4, a: 5, s: 6, b: 7, to: 12, fg: 8, ft: 10 };
  const pool = Object.keys(S).filter(k => S[k][0] >= 20).sort((a, b) => S[b][1] - S[a][1]).slice(0, 156);
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const prior = {}; wk.forEach((w, j) => { if (j < 4) return; prior[w] = {}; pool.forEach(k => { const tot = new Array(13).fill(0); for (let q = j - 4; q < j; q++) { const r = W[wk[q]][k]; if (r) r.forEach((x, i) => tot[i] += x); } if (tot[0] >= 3) prior[w][k] = { m: tot.map(x => x / tot[0]), g: tot[0] / 4 }; }); });
  const z = {}; Object.keys(IX).concat(['fg%', 'ft%']).forEach(c => z[c] = []);
  for (let t = 0; t < 1500; t++) { const team = []; while (team.length < 13) { const k = pool[Math.floor(rnd() * pool.length)]; if (!team.includes(k)) team.push(k); }
    wk.forEach((w, j) => { if (j < 4) return; const P = prior[w]; if (team.some(k => !P[k])) return; const act = new Array(13).fill(0), e = new Array(13).fill(0); let gw = 0;
      team.forEach(k => { const r = W[w][k]; if (r) { gw += r[0]; r.forEach((x, i) => act[i] += x); } P[k].m.forEach((x, i) => e[i] += x * P[k].g); }); if (gw < 15) return;
      Object.entries(IX).forEach(([c, i]) => z[c].push((act[i] - e[i]) / Math.sqrt(VARK[c] * e[i])));
      [['fg%', 8, 9], ['ft%', 10, 11]].forEach(([c, mi, ai]) => { if (!act[ai]) return; const p = e[mi] / e[ai]; if (p > 0 && p < 1) z[c].push((act[mi] / act[ai] - p) / Math.sqrt(p * (1 - p) * 1.3 / e[ai])); }); }); }
  return Object.fromEntries(Object.entries(z).map(([c, L]) => { const m = L.reduce((a, x) => a + x, 0) / L.length; return [c, +Math.sqrt(L.reduce((a, x) => a + (x - m) ** 2, 0) / L.length).toFixed(2)]; }));
}
if (typeof module !== 'undefined') module.exports = { study };
