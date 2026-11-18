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
// Yahoo's API roster. shortcut: the fixture follows Yahoo's documented format, not a captured response; replace it with a real
// one (trimmed) after the first live connection.
const Y = require('../../firefox/yapi.js');
const api = Y.players(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'yahoo-api-roster.json'), 'utf8')));
assert.deepStrictEqual(api, [
  { id: '6512', name: 'Cade Cunningham', team: 'DET', pos: 'PG,SG', slot: 'PG', status: '' },
  { id: '6044', name: 'Jalen Brunson', team: 'NYK', pos: 'PG', slot: 'BN', status: 'GTD' },
  { id: '5638', name: 'Kawhi Leonard', team: 'LAC', pos: 'SF,PF', slot: 'IL', status: 'INJ' }], 'api: ' + JSON.stringify(api));
console.log('✓ API roster: names, ids, teams, slots and injury tags');
console.log('\nall passed');
