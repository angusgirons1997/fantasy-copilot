// Anchors (8.3.0, the remove-him test), on the made-up league: put his spot's best free agent in his place, re-count the teams you
// beat on Analysis Monster's totals. The player holding up blocks is an anchor; a low-blocks player isn't. Run: node tools/test/t_anchor.js
'use strict';
const assert = require('assert'); const { JSDOM } = require('jsdom');
const { render } = require('./render.js'); const { fakeLeague } = require('./fixtures/fake_league.js');
(async () => {
  const { at, store } = fakeLeague(); const v = store['bx:1'].views.ros; const mineN = new Set(store['yr:1'].rows.map(r => r.name));
  const own = new Set(((store['lgscan:1'] || {}).teams || []).flatMap(t => t.players || []).concat([...mineN]));
  const blk = p => p.st.b * p.g; const mine = Object.values(v).filter(p => mineN.has(p.n)); const raw = mine.reduce((a, p) => a + blk(p), 0);
  const fa = Object.values(v).filter(p => !own.has(p.n) && p.g > 0).sort((a, b) => b.lv - a.lv)[0];
  const big = mine.slice().sort((a, b) => blk(b) - blk(a))[0], small = mine.slice().sort((a, b) => blk(a) - blk(b))[0];
  const afterBig = raw - blk(big) + blk(fa), afterSmall = raw - blk(small) + blk(fa);
  assert.ok(afterBig + 2 < raw && afterBig + 2 < afterSmall, 'fixture: the big blocks player matters more than the free agent');
  // four teams sit just above you without him; the rest well below: blocks are won (beat all 7), and drop to contested without him
  const bs = store['bbmstand:1']; let k = 0;
  bs.teams.forEach(t => { t.tot = { b: t.me ? raw : k++ < 4 ? afterBig + 1 : raw * 0.5 }; if (!t.me) t.vcat = { b: 1 }; });
  const r = await render(store, { now: at }); assert.ok(!r.errors.length, r.errors.join('\n'));
  const d = new JSDOM(r.pages['trades:roster'].html).window.document; const row = n => [...d.querySelectorAll('details.pr')].find(p => p.querySelector('.l1 b').textContent === n);
  const tx = el => el.textContent.replace(/\s+/g, ' ');
  assert.ok(row(big.n), big.n + ' is on the roster page');
  assert.match(tx(row(big.n)), /Anchor/); assert.match(tx(row(big.n)), /without him blocks drops from won to contested \(you'd beat 3 teams, not 7\)/);
  console.log('✓ ' + big.n + ' holds up blocks: an anchor, with the band drop named');
  assert.ok(!/Anchor/.test(tx(row(small.n))), small.n + ' is not an anchor');
  console.log('✓ ' + small.n + ' (few blocks, the free agent covers him) is not an anchor');
  assert.ok(![...d.querySelectorAll('details.rgrp')].some(g => /Surplus in won|Value in lost/.test(g.querySelector('summary b').textContent) && /Anchor/.test(tx(g))), 'no anchor in a sell group');
  console.log('✓ no anchor sits in a sell group');
})().catch(e => { console.error(e); process.exit(1); });
