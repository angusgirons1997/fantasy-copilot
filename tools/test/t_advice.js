// Advice backtest on a hand-built league where the answer is worked out by hand: node tools/test/t_advice.js
// Categories points, rebounds, field goal %. You (team 1) against teams 2 and 3, weeks 2 and 3 after a week-1 decision.
// Week 2 you kept the drop (he's in your totals); week 3 you'd made the add (he's in them instead). Either way, with the add:
// 120 points, 50 rebounds, 44/100; with the drop: 100, 50, 40/100. Team 2 (110, 50, 42/100): 2.5 against 0.5 categories.
// Team 3 (130, 40, 45/100): 1 against 1. Realized gain = (2 + 0) / 2 = 1.0 a week.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ok = (c, m) => { if (!c) { console.log('✗ ' + m); process.exitCode = 1; } else console.log('✓ ' + m); };
const pl = (g, p, r, fg, fga) => [g, p, 0, r, 0, 0, 0, fg, fga, 0, 0, 0]; // [games, points, 3s, rebounds, assists, steals, blocks, fg, fga, ft, fta, to]
const act = { 'Nikola Jokic': pl(3, 30, 5, 8, 10), 'Drop Guy': pl(3, 10, 5, 4, 10), 'Same As Drop': pl(3, 10, 5, 4, 10) };
const opp = { 2: { st: { p: 110, r: 50, fg: 42, fga: 100 } }, 3: { st: { p: 130, r: 40, fg: 45, fga: 100 } } };
const entry = (day, week, roster) => ({ day, week, weekEnd: week === 1 ? '2026-11-08' : week === 3 ? '2026-11-22' : null, punt: null, cats: ['p', 'r', 'fg%'], weeks: 20,
  pick: { add: 'Nikola Jokić', drop: 'Drop Guy', gain: 0.5, worth: true }, list: [{ add: 'Nikola Jokić', drop: 'Drop Guy', gain: 0.5 }],
  bbm: { add: 'Same As Drop', drop: 'Drop Guy', gain: 0.3 }, hot: null, roster });
const store = {
  'yr:1': { tid: 1, league: 'test league' },
  'advlog:1': { v: 1, log: [entry('2026-11-03', 1, ['Drop Guy', 'Someone']), entry('2026-11-17', 3, ['Nikola Jokić', 'Someone'])] },
  'lgweek:1:2': { week: 2, teams: Object.assign({ 1: { st: { p: 100, r: 50, fg: 40, fga: 100 } } }, opp) },
  'lgweek:1:3': { week: 3, teams: Object.assign({ 1: { st: { p: 120, r: 50, fg: 44, fga: 100 } } }, opp) },
  'pjact:2026-11-09': { start: '2026-11-09', by: act }, 'pjact:2026-11-16': { start: '2026-11-16', by: act } };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'advice-')); const f = path.join(dir, 'store.json'); fs.writeFileSync(f, JSON.stringify({ store }));
const txt = cp.execFileSync(process.execPath, [path.join(__dirname, '..', 'advice-backtest.js'), f, '--weeks', '4', '--json'], { encoding: 'utf8' });
const r = JSON.parse(fs.readFileSync(f.replace(/\.json$/, '.advice.json'), 'utf8'))['1']; const d0 = r.rows[0];
ok(r.decisions === 2 && r.scored === 1, 'one decision per Yahoo week; the week-3 one waits for weeks after it');
ok(d0.n === 2 && Math.abs(d0.real - 1) < 1e-9, 'week-1 decision: realized +1.0 a week over weeks 2 and 3 (roster kept the drop, then made the add)');
ok(r.bbm && Math.abs(r.bbm.real) < 1e-9 && r.bbm.boardMinus > 0.99, "an alternative identical to the drop realizes 0; the board beats it by 1");
ok(Math.abs(r.slope - 2) < 1e-9, 'realized ≈ 2 × predicted when 1.0 came of a predicted 0.5');
fs.rmSync(dir, { recursive: true, force: true }); if (!process.exitCode) console.log('all passed'); else console.log(txt);
