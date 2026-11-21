// Basketball Monster's Trade Monster pages against saved markup (tools/test/fixtures, trimmed, no league data): Find Free Agents
// (bbm-ff.html, real) and Analyze Trade / Add-Drop (bbm-analyze.html, its tables' layout). Run: node tools/test/t_bbm.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const { JSDOM } = require('jsdom');
const w = new JSDOM('').window; global.DOMParser = w.DOMParser; global.window = global;
global.browser = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../../firefox/names.js'); require('../../firefox/sync.js');
const html = f => new w.DOMParser().parseFromString(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'), 'text/html');
assert.deepStrictEqual(global.SYNC.parseFF(html('bbm-ff.html')), [{ id: '6161', d: 0.051 }, { id: '7194', d: 0.04 }, { id: '5853', d: -0.01 }]);
console.log('✓ Find Free Agents: each free agent and the Win% change, current row skipped, signs kept');
const a = global.SYNC.parseAnalyze(html('bbm-analyze.html'));
assert.deepStrictEqual(a.before, { 'Team A': 0.576, 'Team B': 0.384 }); assert.deepStrictEqual(a.after, { 'Team A': 0.606, 'Team B': 0.404 });
assert.deepStrictEqual(a.gains, { p: 0.42, 3: 0.72, r: -0.13, to: -0.43 });
console.log('✓ Analyze: Win% before and after for every team (with or without a leading column), and the Gains row');
{ // Matchup Monster ticked to the planned lineup (7.53.0): started = ticked, benched = unticked; played days and unplanned players untouched
  const d = new w.DOMParser().parseFromString('<form>' + ['a1', 'a2', 'b1', 'b2', 'c1'].map(id => `<input type="checkbox" name="MD_${id}" id="${id}"${/1$/.test(id) || id === 'b2' ? ' checked' : ''}>`).join('') + '</form>', 'text/html');
  const days = [{ date: '2026-11-20' }, { date: '2026-11-21' }]; const G = (cb, day, fin) => ({ cb, day, fin: !!fin });
  const m = { days, players: [{ side: 0, type: 'cur', name: 'Ann Able', games: [G('a1', 0, true), G('a2', 1)] }, { side: 0, type: 'cur', name: 'Bo Bee', games: [G('b1', 0, true), G('b2', 1)] }, { side: 0, type: 'cur', name: 'Cy Sea', games: [null, G('c1', 1)] }] };
  const pl = { days: [{ date: '2026-11-20', open: false, start: ['Bo Bee'], bench: ['Ann Able'] }, { date: '2026-11-21', open: true, start: ['Ann Able'], bench: ['Bo Bee'] }] };
  const n = global.SYNC.tickPlan(d, m, pl, '2026-11-21'); const on = id => d.getElementById(id).hasAttribute('checked');
  assert.strictEqual(n, 2); assert.deepStrictEqual(['a1', 'a2', 'b1', 'b2', 'c1'].map(on), [true, true, true, false, true]);
  console.log('✓ Matchup Monster ticked to the planned lineup: started on, benched off, played days and unplanned players left as imported'); }
console.log('\nall passed');
