// Late-scratch alerts (8.0.8): built from today's Yahoo lineup, never a saved plan; the swap is a healthy bench player with a game
// who can play the spot, never one on the injured list. Run: node tools/test/t_alert.js
const assert = require('assert');
global.window = global; let store = {};
global.browser = { storage: { local: { get: async () => store, set: async o => { Object.assign(store, o); } } } };
require('../../firefox/names.js'); require('../../firefox/sync.js');
const S = global.SYNC, today = S.usToday();
const row = (name, slot, o) => Object.assign({ name, slot, elig: ['C', 'Util', 'BN'], hasGame: true, locked: false, inj: '' }, o);
const run = async rows => { store = { bbmnews: { ts: Date.now(), items: [] }, alerted: {}, alerts: [],
  'yr:1': { lid: '1', league: 'L', date: today, ts: Date.now(), rows },
  'plan:L': { league: 'L', days: [{ date: today, open: true, start: ['Old Starter'], bench: ['Injured Guy'] }] } };
  return S.newsCheck(); };
(async () => {
  let out = await run([row('Star', 'C', { inj: 'O' }), row('Injured Guy', 'IL', { inj: 'O' }), row('No Game', 'BN', { hasGame: false }),
    row('Wrong Spot', 'BN', { elig: ['PG', 'BN'] }), row('Doubt', 'BN', { inj: 'O' }), row('Good Sub', 'BN')]);
  assert.strictEqual(out.length, 1); assert.match(out[0].msg, /^Star is out .*Start Good Sub instead\.$/);
  console.log('✓ swap is the healthy bench player with a game who fits the spot (not IL, no-game, wrong spot or out)');
  out = await run([row('Star', 'C', { inj: 'O' }), row('Injured Guy', 'IL')]);
  assert.match(out[0].msg, /Nobody on your bench can take his spot/);
  console.log('✓ no valid swap: says so instead of naming an injured-list player');
  out = await run([row('Star', 'BN', { inj: 'O' }), row('Benched', 'C')]);
  assert.strictEqual(out.length, 0);
  console.log('✓ an out player already on the bench raises nothing (a saved plan saying he starts is ignored)');
})().catch(e => { console.error(e); process.exit(1); });
