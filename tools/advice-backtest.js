// Advice backtest: did the board's pickups actually win more categories, by as much as it predicted, and more than simple
// alternatives? node tools/advice-backtest.js copilot-forecast-data.json [--weeks 4] [--active 1] [--json]
//
// Raw material (all kept by the add-on):
//   advlog:<lid>   once a day: the board's pick (add, drop, predicted gain), its top 10, Basketball Monster's top free agent and
//                  Yahoo's most added (each with its best drop), and your roster
//   lgweek:<lid>:<w>  every team's final category totals for Yahoo week w
//   pjact:<monday>    every player's totals for that Monday-to-Sunday week (Basketball Monster player rankings)
//
// Method, for each decision (the first log of each Yahoo week) and each of the following --weeks weeks:
//   your actual totals, minus whichever of the add and the drop was on your roster that week, plus the add's actual week
//   (scenario A) or the drop's (scenario B). Each scenario is scored against every other team's actual totals that week, in
//   the categories the board scores (punts left out, as the board holds them fixed). The realized gain is A's categories won
//   minus B's, averaged over the league: the same unit as the board's prediction (expected categories a week against the league).
// Limits: lineup slots are ignored (a player's whole week counts; --active 0.9 counts 90% of it), double-doubles can't be
// moved player by player, and a dropped player's stats count even if he was hurt (that is part of what the advice risks).
'use strict';
const fs = require('fs');
const args = process.argv.slice(2); const file = args.find(a => !a.startsWith('--') && !/^\d/.test(a));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && args[i + 1] != null ? +args[i + 1] : d; };
const H = opt('weeks', 4), ACTIVE = opt('active', 1);
if (!file) { console.log('usage: node tools/advice-backtest.js <store export.json> [--weeks 4] [--active 1] [--json]'); process.exit(1); }
const ADVICE = require('../firefox/advice.js');
const rep = JSON.parse(fs.readFileSync(file, 'utf8')); const ST = rep.store || rep;

const out = ADVICE.score(ST, { weeks: H, active: ACTIVE });
const f = (x, d = 3) => x == null || !isFinite(x) ? '–' : (x > 0 ? '+' : '') + x.toFixed(d); const ci = c => c ? ` (80% range ${f(c[0])} to ${f(c[1])})` : '';
const pct = x => x == null ? '–' : Math.round(x * 100) + '%';
if (!Object.keys(out).length) console.log('No advice log yet: the add-on starts one (advlog:<league>) the first day the season panel opens after this version.');
Object.values(out).forEach(r => { console.log(`\n=== ${r.league}: ${r.scored} of ${r.decisions} weekly decisions scored over the next ${r.horizonWeeks} weeks`);
  if (!r.scored) { console.log('  nothing to score yet: needs finished Yahoo weeks (lgweek) and Basketball Monster week totals (pjact) after each decision'); return; }
  console.log('  units: categories a week against the league (the board\'s own unit); hold = 0');
  console.log(`  board's pick: predicted ${f(r.pick.pred)}, realized ${f(r.pick.real)}${ci(r.pick.realCI)}; realized ÷ predicted ${f(r.pick.ratio, 2)}${ci(r.pick.ratioCI && r.pick.ratioCI.map(x => +x.toFixed(2)))}; better than holding in ${pct(r.pick.positive)}`);
  console.log(`  picks above your pickup bar: ${r.worth.n}, realized ${f(r.worth.real)} · below it: ${r.notWorth.n}, realized ${f(r.notWorth.real)}`);
  [['bbm', "Basketball Monster's top free agent"], ['hot', "Yahoo's most added"]].forEach(([b, lbl]) => { const x = r[b]; if (!x) return;
    console.log(`  vs ${lbl}: realized ${f(x.real)}; board minus it ${f(x.boardMinus)}${ci(x.boardMinusCI)}, board better in ${pct(x.boardBetter)} of ${x.n}`); });
  if (r.slope != null) console.log(`  all top-10 swaps (${r.listPairs}): realized ≈ ${r.slope.toFixed(2)} × predicted (1 = predictions right on average, below 1 = overstated)`);
  if (r.rankCorr) console.log(`  does the board's order hold up? rank correlation predicted vs realized ${r.rankCorr.mean.toFixed(2)} over ${r.rankCorr.n} decisions (0 = no better than chance)`);
  console.log('  by decision: ' + r.rows.map(x => `wk ${x.week} ${x.add} for ${x.drop}: ${f(x.pred, 2)} → ${f(x.real, 2)}`).join(' · ')); });
if (args.includes('--json')) fs.writeFileSync(file.replace(/\.json$/, '') + '.advice.json', JSON.stringify(out, null, 1));
