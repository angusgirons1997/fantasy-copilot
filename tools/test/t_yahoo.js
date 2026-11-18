// Yahoo page reading against saved Yahoo markup (tools/test/fixtures). When Yahoo changes a page, save a fresh copy of it here
// (trimmed, no tokens or league links) and this test shows what broke. Run: node tools/test/t_yahoo.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const { JSDOM } = require('jsdom');
const w = new JSDOM('').window; global.DOMParser = w.DOMParser; global.window = global;
global.browser = { storage: { local: { get: async () => ({}), set: async () => {} } } };
require('../../firefox/names.js'); require('../../firefox/sync.js');
const html = f => new w.DOMParser().parseFromString(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'), 'text/html');

const t = global.SYNC.teamPage(html('yahoo-team.html'));
assert.deepStrictEqual(t.players, ['Cade Cunningham', 'Tyler Herro', 'Jalen Brunson'], 'players: ' + JSON.stringify(t.players));
assert.deepStrictEqual(t.yids, { 'Cade Cunningham': '6512', 'Tyler Herro': '6175', 'Jalen Brunson': '6044' });
assert.deepStrictEqual(t.ranks, { 'Cade Cunningham': 9, 'Tyler Herro': 57, 'Jalen Brunson': 23 }, 'ranks: ' + JSON.stringify(t.ranks));
console.log('✓ team page: 3 players, ids and ranks (note icons and Video Forecast skipped)');
console.log('\nall passed');
