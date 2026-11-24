// Late season, rehearsed on a made-up league (fixtures/fake_league.js): the trade deadline, the playoffs, being knocked out, the
// last days and the day after the season. Every page renders without errors or nonsense, there's no trade advice after the
// deadline and no week, lineup or pickup advice once your matchups are over. Run: node tools/test/t_season_end.js
'use strict';
const assert = require('assert');
const { render } = require('./render.js'); const SE = require('./season_end.js'); const { fakeLeague } = require('./fixtures/fake_league.js');
(async () => {
  const { at, store } = fakeLeague(); let fails = 0;
  const base = await render(store, { now: at }); const b0 = SE.check(base, { trades: true });
  assert.ok(/categories expected/.test(base.pages.week.text), 'the fixture renders a normal week'); assert.deepStrictEqual(b0, [], 'normal week: ' + b0.join('; '));
  const expect = {
    a: p => !/Trades closed/.test(p.trades.text) && /Trade Monster/.test(p.week.text),
    b: p => /Trades closed on February 4, 2027/.test(p.trades.text) && /trades closed/.test(p.week.text),
    c: p => /playoff week/.test(p.week.text) && /regular season is over/.test(p['season:stn-left'].text),
    d: p => ['week', 'team', 'players'].every(k => /no matchup on Yahoo this week/.test(p[k].text)) && /Current standings/.test(p.season.text),
    e: p => /playoff week/.test(p.week.text) && !/Wait until Monday|: wait until Monday/.test(p.week.text + p.players.text),
    f: p => ['week', 'team', 'players'].every(k => /The season is over/.test(p[k].text)),
  };
  for (const sc of SE.SCENARIOS) { const b = SE.build(store, at, sc, { lid: '1' });
    if (sc.id === 'e') b.store['yr:1'].adds.used = 3; // no adds left in the final week: nothing to wait for
    const r = await render(b.store, { now: b.now }); const bad = SE.check(r, sc, b);
    const ok = !bad.length && expect[sc.id](r.pages); if (!ok) fails++;
    console.log((ok ? '✓ ' : '✗ ') + sc.name + ' (' + b.T + ')' + (ok ? '' : '\n  ' + (bad.length ? bad.join('\n  ') : 'expected text missing: ' + Object.entries(r.pages).map(([k, p]) => k + ': ' + p.text.slice(0, 160)).join('\n  ')))); }
  // knocked out with no Matchup Monster week stored at all: the same message, and Season still shows the standings
  { const b = SE.build(store, at, SE.SCENARIOS[3], { lid: '1' }); Object.keys(b.store).filter(k => /^mmw?:/.test(k)).forEach(k => delete b.store[k]);
    const r = await render(b.store, { now: b.now }); const bad = SE.check(r, SE.SCENARIOS[3], b); const ok = !bad.length && expect.d(r.pages); if (!ok) fails++;
    console.log((ok ? '✓ ' : '✗ ') + 'knocked out, no Matchup Monster week stored' + (ok ? '' : '\n  ' + bad.concat(Object.entries(r.pages).map(([k, p]) => k + ': ' + p.text.slice(0, 160))).join('\n  '))); }
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
