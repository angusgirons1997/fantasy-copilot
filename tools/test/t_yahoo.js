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
// owner's rule (25 Nov): never the Pre-Season rank. The saved page is from before the season (Pre-Season only): no ranks at all.
assert.deepStrictEqual(t.ranks, {}, 'a Pre-Season-only page gives no ranks: ' + JSON.stringify(t.ranks));
// in season Yahoo adds the Current rank beside Pre-Season in the "Rank" group: read that one, labelled Current or not
for (const label of ['Current', 'Curr']) { const d = html('yahoo-team.html'); const tb = [...d.querySelectorAll('table')].find(x => /Pre-Season/.test(x.querySelector('thead').textContent));
  const hr = [...tb.querySelectorAll('thead tr')]; const rk = [...hr[0].querySelectorAll('th')].find(th => /Rank/.test(th.textContent)); rk.setAttribute('colspan', '2');
  const pre = [...hr[1].querySelectorAll('th')].find(th => /Pre-Season/.test(th.textContent)); const th = d.createElement('th'); th.textContent = label; pre.after(th);
  const cur = { 'Cade Cunningham': 31, 'Tyler Herro': 223, 'Jalen Brunson': 12 };
  tb.querySelectorAll('tbody tr').forEach(tr => { const a = tr.querySelector('a.name, .ysf-player-name a'); if (!a) return; const td = d.createElement('td'); td.textContent = cur[(a.getAttribute('title') || a.textContent).trim()]; tr.querySelectorAll('td')[5].after(td); });
  const r = global.SYNC.teamPage(d).ranks; assert.deepStrictEqual(r, cur, label + ' column: ' + JSON.stringify(r)); }
console.log('✓ team page: 3 players, ids; ranks are Yahoo\'s Current only (never Pre-Season), labelled Current or not');
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
