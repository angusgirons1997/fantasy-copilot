// League tab standings: the 16 Nov Mad dogs numbers (9 categories, top 6) and a Boomers-like case (11 categories, 10 teams, top 4).
// Prints the hand calculation next to what the add-on shows. usage: node t_stand.js <export.json>
const fs = require('fs'); const { JSDOM } = require('jsdom');
const { render } = require('./render');
const rep = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const MAD = { 'Karl': [22, 12, 2, 58], 'Hot Mic': [22, 14, 0, 52], 'Unc': [20, 16, 0, 44], 'sunshine': [19, 16, 1, 43], 'SlavicSlayer': [18, 16, 2, 62], 'baby mamas': [18, 18, 0, 36],
  'Fun in': [17, 19, 0, 69], 'Kumbucket': [15, 18, 3, 38], 'Godfreys': [16, 19, 1, 43], 'Tall White': [15, 20, 1, 58], 'Roy': [14, 21, 1, 34], 'Ryen': [14, 21, 1, 63] };
const CATS9 = 'Field Goal Percentage (FG%), Free Throw Percentage (FT%), 3-point Shots Made (3PTM), Points Scored (PTS), Total Rebounds (REB), Assists (AST), Steals (ST), Blocked Shots (BLK), Turnovers (TO)';
const CATS11 = CATS9 + ', Double-Doubles (DD), Field Goals Made (FGM)';
const tx = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
function setup(boomers) { const S = JSON.parse(JSON.stringify(rep.store || rep)); const lid = Object.keys(S).find(k => /^yr:/.test(k)).slice(3);
  const ys = S['ystand:' + lid]; const bs = S['bbmstand:' + lid]; const sp = S['ysetp:' + lid];
  ys.teams.forEach(t => { const k = Object.keys(MAD).find(k => t.name.includes(k)); const [w, l, tt, r] = MAD[k]; Object.assign(t, { w, l, t: tt, pct: +((w + tt / 2) / (w + l + tt)).toFixed(3) }); t.rate = r; });
  ys.teams.sort((a, b) => b.pct - a.pct).forEach((t, i) => t.rank = i + 1);
  bs.teams.forEach(b => { const t = ys.teams.find(t => t.name === b.name); b.winPct = t.rate / 100; b.vsMe = b.me ? null : { w: 4, l: 4, t: 1 }; }); bs.ts = Date.now() - 21 * 60e3;
  if (boomers) { // 10 teams, 11 categories: 4 weeks done = 44 each; top 4
    const drop = ys.teams.filter(t => !/Ryen/.test(t.name)).slice(-2).map(t => t.name); ys.teams = ys.teams.filter(t => !drop.includes(t.name)); bs.teams = bs.teams.filter(t => !drop.includes(t.name));
    ys.teams.forEach((t, i) => { t.w = 24 - i; t.t = i % 3; t.l = 44 - t.w - t.t; t.pct = +((t.w + t.t / 2) / 44).toFixed(3); t.rank = i + 1; });
    sp.cats = CATS11; sp.poTeams = 4; sp.poWeeks = [20, 21, 22]; } // regular season 19 weeks
  else { sp.cats = CATS9; sp.poTeams = 6; sp.poWeeks = [18, 19, 20]; }
  return { S, ys: ys.teams, bs: bs.teams, sp }; }
(async () => { let bad = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) bad++; };
  for (const boomers of [false, true]) { const { S, ys, bs, sp } = setup(boomers); console.log(`\n=== ${boomers ? 'Boomers-like: 11 categories, 10 teams, top 4' : 'Mad dogs, 16 Nov: 9 categories, top 6'}`);
    const cats = boomers ? 11 : 9; const done = Math.max(...ys.map(t => t.w + t.l + t.t)) / cats; const weeks = (Math.min(...sp.poWeeks) - 1) - done; const per = cats * weeks;
    console.log(`hand: ${done} weeks in Yahoo's standings, ${weeks} left × ${cats} = ${per}`);
    const hand = ys.map(t => { const b = bs.find(b => b.name === t.name); const e = b.winPct * per; const W = t.w + e, L = t.l + per - e; return { name: t.name, e, W, L, T: t.t, pct: (W + t.t / 2) / (W + L + t.t) }; }).sort((a, b) => b.pct - a.pct);
    const r = await render(S, { now: rep.at }); ok(!r.errors.length, 'no page errors ' + r.errors.join('; '));
    const cardOf = k => { const p = r.pages[k]; if (!p) return null; return JSDOM.fragment('<div>' + p.html + '</div>').firstChild.querySelector('.card.stn'); };
    const first = cardOf('league'); ok(first && first.querySelectorAll('.tbl').length === 1 && /Current standings/.test(tx(first.querySelector('.label'))), 'League opens on Current standings, one table');
    const tabsTxt = first ? [...first.querySelectorAll('[data-stntab]')].map(tx) : []; ok(tabsTxt.join('|') === 'Current|Still to win|Projected final', 'tabs at the top: ' + tabsTxt.join(' / '));
    const tbls = []; let card = null;
    for (const [k, title] of [['now', 'Current standings'], ['left', 'Remaining categories to win'], ['final', 'Projected final standings']]) { const c = cardOf('league:stn-' + k);
      const one = c && c.querySelectorAll('.tbl').length === 1 && new RegExp('^' + title).test(tx(c.querySelector('.label'))) && tx(c.querySelector('[data-stntab].on')) === tabsTxt[tbls.length];
      ok(one, `tap ${tabsTxt[tbls.length]}: shows only ${title}`); tbls.push(c && c.querySelector('.tbl')); card = c;
      if (c) console.log('  ' + [...c.querySelectorAll('.label, .sub')].map(tx).join('\n  ')); }
    card = { textContent: [1, 2].map(i => tbls[i] && tbls[i].closest('.card').textContent).join(' ') };
    ok(card.textContent.includes(`${weeks} regular-season weeks left × ${cats} categories = ${per}`), 'header shows the maths');
    const t3 = [...tbls[2].querySelectorAll('.tr')].map(tr => [...tr.children].map(tx));
    const pick = boomers ? hand.slice(0, 3).map(h => h.name).concat([]) : ['Ryen Russangus', 'The Fun in Our Guys', 'Karl ‘n Kon’s Klan'];
    let mis = 0; hand.forEach((h, i) => { const row = t3[i]; const nm = h.name === 'Ryen Russangus' ? 'You' : h.name; const exp = `${Math.round(h.W)}-${Math.round(h.L)}-${h.T}`; const ep = h.pct.toFixed(3).replace(/^0/, '');
      const same = row && row[0] === String(i + 1) && row[1] === nm && row[2] === exp && row[3] === ep;
      if (pick.includes(h.name) || !same) console.log(`  ${pick.includes(h.name) ? 'HAND ' : ''}${h.name}: ${h.W - h.e} + ${h.e.toFixed(2)} = ${h.W.toFixed(2)} W, ${h.L.toFixed(2)} L, ${h.T} T, pct (${h.W.toFixed(2)} + ${h.T}/2) / ${(h.W + h.L + h.T).toFixed(0)} = ${h.pct.toFixed(4)} → #${i + 1} ${exp} ${ep} | add-on: ${row ? row.join(' ') : 'missing'}`);
      if (!same) mis++; });
    ok(!mis, `table 3 matches the hand calculation for all ${hand.length} teams (${mis} differ)`); const cut = [...tbls[2].querySelectorAll('.tr')].findIndex(tr => tr.classList.contains('cut')); ok(cut + 1 === sp.poTeams, 'playoff line after #' + (cut + 1)); }
  console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0); })();
