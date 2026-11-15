// Lineup setting, end to end: node tools/test/t_lineup.js <store export.json>
// On a real roster (any export with yr:, bx:, ysetp:), offline, with the page's clock at the export's own time:
//   nobody Yahoo tags out (O, INJ, SUSP, NA) is ever planned to start, on any open day
//   a game-time decision (GTD) starts only into a spot no healthy player with a game can fill
//   a player who's left your Yahoo roster is never planned to start
//   "Set lineups": what's sent, applied as Yahoo would, turns every open day's marker green, with the "Done" line; while it runs
//   the markers pulse, and a day Yahoo refused shows red
// Plus the Yahoo-side assignment on its own: only listed starters go in, never anyone out, never a gap filled from the bench list.
'use strict';
const fs = require('fs'); const path = require('path'); const { JSDOM } = require('jsdom'); const { render } = require('./render');
const { assign } = require(path.join(__dirname, '..', '..', 'firefox', 'yroster.js'));
const file = process.argv[2]; if (!file) { console.log('usage: node tools/test/t_lineup.js <store export.json>'); process.exit(1); }
const rep = JSON.parse(fs.readFileSync(file, 'utf8')); const base = rep.store || rep; const NOW = rep.at;
let bad = 0; const ok = (c, m, more) => { console.log((c ? '✓ ' : '✗ ') + m + (!c && more ? '\n    ' + String(more).slice(0, 500) : '')); if (!c) bad++; };
const clone = o => JSON.parse(JSON.stringify(o)); const HARD = /^(O|OUT|INJ|SUSP|NA|OFS)$/i;
const yk = Object.keys(base).find(k => k.startsWith('yr:') && base[k].rows); if (!yk) { console.log('no Yahoo roster (yr:) in this export'); process.exit(1); } const lid = yk.slice(3);
const tagOf = r => String(r.inj || '').trim().split(/\s/)[0];
const luRow = x => ({ name: x.name, slot: x.slot, pid: x.pid, locked: !!x.locked, hasGame: !!x.hasGame, game: x.game || '', inj: x.inj || '', elig: x.elig || [], team: x.team || '' });
async function run(store) { const r = await render(store, { now: NOW }); const pk = Object.keys(r.writes).find(k => k.startsWith('plan:')); const team = JSDOM.fragment('<div>' + ((r.pages.team || {}).html || '') + '</div>').firstChild;
  return { r, plan: pk ? r.writes[pk] : null, team, chips: [...team.querySelectorAll('.dchip')].map(b => ({ date: b.dataset.day, cls: b.className })) }; }
const openDays = plan => plan.days.filter(d => d.open && (d.start.length || d.bench.length));
const starts = (plan, n) => openDays(plan).filter(d => d.start.some(x => x === n)).map(d => d.date);

(async () => {
  // ---- 1. the Yahoo side on its own ----
  { const R = (name, slot, o) => Object.assign({ pid: name, name, slot, elig: ['PG', 'Util', 'BN', 'IL'], locked: false, hasGame: true, inj: '' }, o || {});
    const rows = [R('A', 'PG'), R('Bout', 'BN', { inj: 'O' }), R('Cout', 'Util', { inj: 'O' }), R('D', 'BN'), R('Eil', 'IL', { inj: 'INJ' })];
    const { asg } = assign(rows, ['A', 'NotHere'], ['Bout', 'D'], [], []);
    ok(asg.A === 'PG', 'assign: a listed starter gets a starting spot');
    ok(asg.Bout === 'BN' && asg.Cout === 'BN', 'assign: nobody out goes into (or stays in) a starting spot, even with a starter missing', JSON.stringify(asg));
    ok(asg.D === 'BN', 'assign: a missing starter\'s spot is never filled from the bench list', JSON.stringify(asg));
    ok(asg.Eil === 'IL', 'assign: injured-list players stay on the injured list'); }

  // ---- 2. your roster as exported ----
  const y0 = base[yk]; const outNames = y0.rows.filter(r => HARD.test(tagOf(r))).map(r => r.name);
  const a = await run(clone(base)); ok(a.r.errors.length === 0 && a.plan, 'the season panel renders and plans the week', a.r.errors.join('\n'));
  if (!a.plan) { console.log('\nno plan: stopping'); process.exit(1); }
  const od = openDays(a.plan); console.log(`  open days: ${od.map(d => d.date).join(', ') || 'none'} · out on Yahoo: ${outNames.join(', ') || 'nobody'}`);
  ok(outNames.every(n => !starts(a.plan, n).length), 'nobody Yahoo tags out is planned to start', outNames.map(n => n + ': ' + starts(a.plan, n).join(',')).join('; '));
  const today = od[0]; if (!today) { console.log('\nno open day with games in this export: the rest needs one'); process.exit(bad ? 1 : 0); }
  const healthy = today.start.filter(n => { const r = y0.rows.find(x => x.name === n); return r && !tagOf(r); });

  // ---- 3. a healthy starter turns out on Yahoo ----
  if (healthy.length) { const s = clone(base); const n = healthy[0]; s[yk].rows.find(r => r.name === n).inj = 'O'; const b = await run(s);
    ok(!starts(b.plan, n).length, `${n} tagged out on Yahoo: no longer planned to start on any day`, starts(b.plan, n).join(','));
    ok(/Out on Yahoo \(O\)/.test(b.team.textContent), 'the Team page says why: "Out on Yahoo (O)"'); }

  // ---- 4. game-time decisions: sit while a healthy player can take the spot, start into a spare one ----
  if (healthy.length >= 3) { const n = healthy[0];
    { const s = clone(base); s[yk].rows.find(r => r.name === n).inj = 'GTD'; const b = await run(s); const d = openDays(b.plan).find(x => x.date === today.date);
      const spare = (base['ysetp:' + lid].slots.length) > healthy.length; ok(!spare || d.start.includes(n), `${n} GTD with spare spots (${healthy.length} healthy for ${base['ysetp:' + lid].slots.length}): still starts`, JSON.stringify(d.start)); }
    // one spot fewer than healthy players with games: k Util spots, plus a C spot (settings need at least 5 spots) that none of them
    // can play, so only k of them fit
    const canC = healthy.filter(h => ((y0.rows.find(r => r.name === h) || {}).elig || []).includes('C'));
    if (!canC.length) { const s = clone(base); s[yk].rows.find(r => r.name === n).inj = 'GTD'; const k = healthy.length - 1; s['ysetp:' + lid] = Object.assign({}, s['ysetp:' + lid], { slots: new Array(k).fill('Util').concat(new Array(Math.max(0, 5 - k)).fill('C')) });
      const b = await run(s); const d = openDays(b.plan).find(x => x.date === today.date);
      ok(d && !d.start.includes(n) && healthy.filter(x => x !== n).every(x => d.start.includes(x)), `${n} GTD with only ${k} spots for ${healthy.length} healthy players: sits, and the healthy ones start`, d && JSON.stringify(d.start));
      ok(/GTD: sits while a healthy player can start/.test(b.team.textContent), 'the Team page says why he sits'); } }

  // ---- 5. a starter you've dropped on Yahoo (Basketball Monster still lists him) ----
  if (healthy.length) { const s = clone(base); const n = healthy[healthy.length - 1]; s[yk].rows = s[yk].rows.filter(r => r.name !== n); const b = await run(s);
    ok(!starts(b.plan, n).length, `${n} no longer on your Yahoo roster: never planned to start`, starts(b.plan, n).join(',')); }

  // ---- 6. "Set lineups", as Yahoo would apply it ----
  { const s = clone(base); const t0 = Date.parse(NOW); const lu = {};
    // each open day as Yahoo shows it, with one planned starter left on the bench so the day needs a change
    od.forEach(d => { const rows = s[yk].rows.map(r => Object.assign(luRow(r), { hasGame: d.date === y0.date ? !!r.hasGame : d.start.concat(d.bench).includes(r.name) })); lu[d.date] = { ts: t0 - 60e3, rows, empty: [] }; });
    const n0 = today.start.find(n => { const r = lu[today.date].rows.find(x => x.name === n); return r && r.slot !== 'BN' && !/^IL/.test(r.slot); });
    if (n0) { const r = lu[today.date].rows.find(x => x.name === n0); r.slot = 'BN'; }
    s['ylu:' + lid] = lu; const b = await run(s); const chip = c => (b.chips.find(x => x.date === c) || {}).cls || '';
    ok(!n0 || / chg/.test(chip(today.date)), `before: ${today.date} needs a change (${n0} is on the bench on Yahoo)`, chip(today.date));
    // what "Set lineups" sends, applied the way Yahoo would
    const sent = openDays(b.plan); const after = clone(lu);
    sent.forEach(d => { const e = after[d.date]; if (!e) return; const { asg } = assign(e.rows, d.start, d.bench, [], e.empty); e.rows.forEach(r => { if (asg[r.pid]) r.slot = asg[r.pid]; }); e.ts = t0 + 30e3; });
    const s2 = clone(s); s2['ylu:' + lid] = after; const id = t0 + 1e3;
    // while it runs: markers pulse
    { const s3 = clone(s); s3.yWeek = { id, lid, days: sent.map(d => d.date), done: false, results: [], beat: id }; const c = await run(s3);
      ok(sent.every(d => / busy/.test((c.chips.find(x => x.date === d.date) || {}).cls || '') || !d.start.length), 'while Set runs, each day still to do pulses', JSON.stringify(c.chips)); }
    // a day Yahoo refused: red
    { const s4 = clone(s); s4.yWeek = { id, lid, days: [today.date], done: true, results: [{ date: today.date, ok: false, msg: 'Yahoo said: test refusal' }] }; const c = await run(s4);
      ok(/ fail/.test((c.chips.find(x => x.date === today.date) || {}).cls || ''), 'a day Yahoo refused shows red', JSON.stringify(c.chips)); }
    s2.yWeek = { id, lid, days: sent.map(d => d.date), done: true, results: sent.map(d => ({ date: d.date, ok: true, changes: 1 })) };
    const c = await run(s2); const greens = sent.filter(d => d.start.length).map(d => ({ d: d.date, cls: (c.chips.find(x => x.date === d.date) || {}).cls || '' }));
    ok(greens.length && greens.every(g => / ok/.test(g.cls)), 'after Set: every open day\'s marker is green', JSON.stringify(greens));
    ok(/Done: all \d+ days? set on Yahoo and checked/.test(c.team.textContent), 'and the page says "Done: all … set on Yahoo and checked"');
    ok(outNames.every(nm => { const r = after[today.date].rows.find(x => x.name === nm); return !r || r.slot === 'BN' || /^IL/.test(r.slot) || !r.hasGame; }), 'after Set, nobody out is in a starting spot with a game', outNames.join(', ')); }

  console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0); })();
