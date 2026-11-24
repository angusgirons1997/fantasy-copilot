// Multi-player deals (8.4.0): the fairness rule on real numbers, the shortlist, the daily scoring against a fake Trade Monster
// (one page per team, the roster-spot self-check, a failure message) and the Finder. Run: node tools/test/t_multi.js
'use strict';
const assert = require('assert'); const { JSDOM } = require('jsdom');
const { render } = require('./render.js'); const { fakeLeague } = require('./fixtures/fake_league.js');
(async () => {
  const w = new JSDOM('').window; global.DOMParser = w.DOMParser; global.window = global;
  global.browser = { storage: { local: { get: async () => ({}), set: async () => {} } } };
  require('../../firefox/names.js'); require('../../firefox/sync.js'); const S = global.SYNC;

  // 1. fairness, on Mad dogs' Basketball Monster values (24 Nov, value lv, all with a full season left). League: 12 teams x 10 spots.
  const ros = {}; const add = (id, lv) => ros[id] = { n: id, lv, g: 60 };
  for (let i = 1; i <= 200; i++) add('p' + i, 1.5 - i * 0.012); // a smooth league from 1.49 down to -0.9
  Object.entries({ luka: 0.88, wemby: 1.27, cow: 0.18, sug: -0.06, hay: -0.29, mpj: 0.27, smi: 0.17, mur: 0.03, ban: 0.20 }).forEach(([id, lv]) => add(id, lv));
  const W = S.worthOf(ros, 120, 10); const team = ids => W.lineup(ids);
  const theirs = ['luka'].concat(['p20', 'p30', 'p40', 'p50', 'p60', 'p70', 'p80', 'p90', 'p100', 'p110', 'p120', 'p130']);
  assert.match(S.fair(['cow', 'sug'], ['luka'], team(theirs), 0.8), /they'd get back \d+% of what they give/);
  assert.match(S.fair(['cow', 'sug', 'hay'], ['luka'], team(theirs), 0.8), /get back/);
  assert.equal(S.fair(['p30', 'p30b'].map(x => x === 'p30b' ? 'p31' : x), ['p12'], team(['p12', 'p45', 'p55', 'p65', 'p75', 'p85', 'p95', 'p105', 'p115', 'p125', 'p135']), 0.8), '');
  console.log('✓ fair: Coward + Suggs (or + Hayes) for Luka is cut; two players ranked about 30 for one ranked 12 passes');
  // a newcomer below their lineup adds nothing to them
  assert.deepStrictEqual(team(theirs)([], ['hay'])[1], 0); console.log('✓ a player who wouldn\'t start for them adds nothing to their lineup');
  // Yahoo's view (the Finder's note, and Realistic's second test): the same lineup with each player valued at his Yahoo rank
  const yr = { luka: 3, cow: 150, sug: 160 }, yw = id => W.rank(yr[id] || +String(id).slice(1) || 999);
  const [out, back] = W.lineup(theirs, yw)(['luka'], ['cow', 'sug']); assert.ok(out > 0 && back / out < 0.8, 'Yahoo view: ' + back / out);
  console.log('✓ Yahoo view: the same lineup test on Yahoo ranks');

  // 2. the shortlist on the made-up league
  const { at, store } = fakeLeague(); const tm = store['bbmtm:1'], fa = store['bbmfa:1']; const v = store['bx:1'].views.ros;
  const FW = S.worthOf(v, 80, 10); const mine = Object.keys(tm.by).concat(Object.keys(fa.by)).filter((x, i, a) => a.indexOf(x) === i);
  const team3 = tm.by[mine[0]][0].team; const their = Object.values(tm.by).flat().map(r => r.id).filter((x, i, a) => a.indexOf(x) === i);
  const C = S.multiCands(tm, fa, mine, { [team3]: their }, FW, { min: 0.5 });
  assert.ok(C.length > 0 && C.length <= 7, 'up to 5 deals and 2 upgrades per team: ' + C.length);
  assert.ok(C.every(c => !(c.give.length === 1 && c.get.length === 1)), 'no one-for-ones');
  assert.ok(C.every(c => new Set(c.give).size === c.give.length && new Set(c.get).size === c.get.length), 'no player twice');
  assert.ok(new Set(C.filter(c => !c.upgrade).map(c => c.get.slice().sort().join())).size === C.filter(c => !c.upgrade).length, 'no two deals bring back the same players');
  console.log('✓ shortlist: ' + C.length + ' deals for the one team, no one-for-ones, no repeats');

  // 3. scoring against a fake Trade Monster: the add changes the answer (kept), the drop doesn't (switched off and labelled)
  const theirIds = their.slice(0, 6), faId = Object.values(fa.by)[0][0].id; let posts = 0, fail = false;
  const sel = (n, opts) => `<select name="${n}">${opts.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
  const page = (team, extra) => `<html><body><a href="Logout.aspx">out</a><form id="form1"><select name="pageTitleRowLeague"><option value="7" selected>Test League</option></select>
    <select name="DD1"><option selected>My Team</option></select><select name="DD2"><option value="0">-</option><option value="3"${team ? ' selected' : ''}>${team3}</option></select>
    ${mine.map(id => sel('DD1' + id, ['', 'Trade', 'Drop'])).join('')}${team ? theirIds.map(id => sel('DD2' + id, ['', 'Trade', 'Drop'])).join('') : ''}${sel('DD0' + faId, ['', 'To Team 1'])}
    <input type="submit" name="AnalyzeChangesButton" value="Analyze Trade"></form>${extra || ''}</body></html>`;
  const tab = (h, a, b) => `<div class="q-heading">${h}</div><table><tr><th>Name</th><th>Win%</th></tr><tr><td>My Team</td><td>${a}</td></tr><tr><td>${team3}</td><td>${b}</td></tr></table>`;
  global.fetch = async (url, o) => { const body = String((o && o.body) || ''); const q = new URLSearchParams(body); if (fail) return { ok: true, status: 200, text: async () => '<html>Logout.aspx nothing</html>' };
    if (!q.has('AnalyzeChangesButton')) return { ok: true, status: 200, text: async () => page(q.get('DD2') === '3') }; posts++;
    const you = 0.5 + 0.04 + (q.get('DD0' + faId) === 'To Team 1' ? 0.02 : 0), them = 0.5 + 0.01; // a drop changes nothing here
    return { ok: true, status: 200, text: async () => page(true, tab('Projected Standings - Before', 0.5, 0.5) + tab('Projected Standings - After', you, them)) }; };
  const tmOne = { ts: at, by: Object.fromEntries(Object.entries(tm.by).map(([g, r]) => [g, r.filter(x => theirIds.includes(x.id))])) };
  const R1 = await S.bbmMulti({ league: 'Test League' }, tmOne, fa, { W: FW, min: 0.5 });
  assert.ok(R1.deals.length > 0, 'deals scored: ' + JSON.stringify(R1).slice(0, 300)); assert.ok(!R1.err);
  const two1 = R1.deals.find(d => d.give.length > d.get.length), one2 = R1.deals.find(d => d.give.length < d.get.length);
  if (two1) { assert.equal(R1.checks.add, true); assert.equal(two1.add, faId); assert.equal(two1.you, 6); }
  if (one2) { assert.equal(R1.checks.drop, false); assert.equal(one2.drop, null); }
  console.log(`✓ scoring: ${R1.deals.length} deals from one Trade Monster page; the free-agent add counted${one2 ? ', the ignored drop switched off' : ''} (${posts} asks)`);
  // the next day, same rosters: nothing is asked again
  posts = 0; const R2 = await S.bbmMulti({ league: 'Test League' }, tmOne, fa, { W: FW, min: 0.5, prev: R1 });
  assert.equal(posts, 0); assert.equal(R2.deals.length, R1.deals.length); console.log('✓ unchanged rosters: yesterday\'s scores kept, no new asks');
  fail = true; const R3 = await S.bbmMulti({ league: 'Test League' }, tmOne, fa, { W: FW, min: 0.5 }).catch(e => ({ thrown: e.message }));
  assert.ok(R3.thrown || R3.err, 'a failure is reported, not an empty list'); console.log('✓ Trade Monster not answering: reported as a failure');

  // 4. the Finder: over the bar shows (with the roster-spot line), under the bar doesn't, a moved player drops the deal, a failure says so
  const a = C.find(c => c.give.length > c.get.length) || C[0], b = C[1] || C[0];
  store['bbmtm2:1'] = { ts: tm.ts, tried: 3, deals: [{ ...a, you: 6, them: 0, add: null }, { ...b, you: 2, them: 1 }, { ...a, get: a.get.concat('nobody'), you: 9, them: 1 }] };
  store['bbmstand:1'].teams.forEach((t, i) => { t.tot = { b: 100 - i }; if (!t.me) t.vcat = { b: 1 }; }); // Analysis Monster totals, so the Trades page opens
  let r = await render(store, { now: at }); assert.ok(!r.errors.length, r.errors.join('\n'));
  let t = r.pages['trades:finder'].text; assert.match(t, /Multi-player deals/); assert.match(t, /You \+6 · them 0 of 99 ?Get/); assert.doesNotMatch(t, /NaN|undefined/);
  if (a.give.length > a.get.length) assert.match(t, /The open roster spot isn't counted/);
  assert.ok(!/You \+2 · them/.test(t), 'under the bar is left out'); assert.ok(!/You \+9/.test(t), 'a player no longer on that team leaves the deal out');
  console.log('✓ Finder: the deal over the bar shows, one under it and one with a moved player don\'t');
  store['bbmtm2:1'] = { ts: tm.ts, deals: [], tried: 5, fails: 5, err: 'Trade Monster has no team called "X"' };
  r = await render(store, { now: at }); t = r.pages['trades:finder'].text; assert.match(t, /Couldn't score deals with Trade Monster today/);
  console.log('✓ Finder: a failed day says so');
})().catch(e => { console.error(e); process.exit(1); });
