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
console.log('\nall passed');
