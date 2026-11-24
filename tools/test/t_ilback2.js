// Injured-list card (8.5.0): players counted against spots, Yahoo's own injured-list marks and counter, drops ranked on Basketball
// Monster's Find Free Agents (injured players included), on the real Boomers vs Brits roster of 24 Nov. Run: node tools/test/t_ilback2.js firefox/season.js
const fs = require('fs'); const src = fs.readFileSync(process.argv[2], 'utf8');
const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error('markers moved: ' + from); return src.slice(a, b); };
const code = cut('  function rosterCheck(y)', '  // spots a pickup can use') + cut('  // Yahoo refuses every lineup change', '  function lineupCard(p, lg) {');
const esc = s => String(s); const ago = () => 'just now'; const usToday = () => '2026-11-24'; const fmtD = d => ({ '2026-11-25': 'Wed, 25 Nov' })[d] || d;
const NAMES = require(require('path').join(__dirname, '..', '..', 'firefox', 'names.js'));
let Y; const ST = { 'ysetp:99377': { slots: ['PG', 'SG', 'G', 'G', 'SF', 'PF', 'F', 'C', 'Util', 'Util'], bench: 4, ilSlots: 4 } };
// Find Free Agents on 24 Nov: what dropping each player for the best free agent costs you (of 99 a week); SGA and Duren are top-half keeps
const COST = { 'Stephon Castle': -1, 'Kelly Oubre Jr.': 0, 'Norman Powell': 0, 'Rui Hachimura': 0, 'Devin Vassell': 0, 'Nic Claxton': 1, 'Aday Mara': 1, 'Matisse Thybulle': 2, 'Paolo Banchero': 2, "Kel'el Ware": 2, 'Paul Reed': 3, 'Caleb Wilson': 5, 'Moussa Diabaté': 6, 'Nickeil Alexander-Walker': 7, 'Amen Thompson': 7, 'Franz Wagner': 9 };
const dropOrder = () => Y.rows.filter(r => COST[r.name] != null).map(r => ({ id: r.name, name: r.name, il: /^IL/.test(r.slot), cost: COST[r.name] })).sort((a, b) => a.cost - b.cost);
const f = new Function('esc', 'ago', 'yrFor', 'usToday', 'fmtD', 'ST', 'NAMES', 'modelFor', 'dropOrder', code + '; return [ilBackCard, ilBlocked, rosterCheck];')(esc, ago, () => Y, usToday, fmtD, ST, NAMES, () => ({}), dropOrder);
const [card, blocked, check] = f; const strip = h => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
let bad = 0; const ok = (c, m, h) => { console.log((c ? '✓ ' : '✗ ') + m + (c || !h ? '' : '\n    ' + strip(h).slice(0, 700))); if (!c) bad++; };
const G = ['PG', 'SG', 'G', 'Util', 'BN'], F = ['SF', 'PF', 'F', 'Util', 'BN'], C = ['C', 'Util', 'BN'];
const row = (name, slot, elig, inj) => ({ name, slot, elig: elig.concat(inj === 'O' ? ['IL'] : []), inj: inj || '' });
// the roster read at 9:28 pm on 24 Nov (4 injured-list spots, all used)
const base = () => [row('Amen Thompson', 'PG', G), row('Devin Vassell', 'SG', G), row('Matisse Thybulle', 'G', G), row('Stephon Castle', 'G', G), row('Franz Wagner', 'SF', F),
  row('Paul Reed', 'PF', F), row('Rui Hachimura', 'F', F), row('Moussa Diabaté', 'C', C), row("Kel'el Ware", 'Util', C), row('Nic Claxton', 'Util', C),
  row('Kelly Oubre Jr.', 'BN', F), row('Shai Gilgeous-Alexander', 'BN', G), row('Nickeil Alexander-Walker', 'BN', G), row('Aday Mara', 'BN', C, 'O'),
  row('Norman Powell', 'IL', G, 'O'), row('Jalen Duren', 'IL', C, 'O'), row('Paolo Banchero', 'IL', F, 'O'), row('Caleb Wilson', 'IL', F, 'O')];
const p = { nowDays: [] };
// 1. the owner's screenshot: the league now has 3 injured-list spots, Powell is on the bench, Yahoo shows Error #160
Y = { ts: Date.now(), lid: '99377', tid: '9', rows: base().map(r => r.name === 'Norman Powell' ? Object.assign(r, { slot: 'BN' }) : r), il: { used: 3, max: 3 }, illegal: 'You are over the max roster size. (Error #160)' };
let h = card(p, 'BvB'), s = strip(h);
ok(/18 players and room for 17 \(14 spots outside the injured list and 3 on it\), so one player has to go/.test(s), 'screenshot: counts players against spots', h);
ok(/drop Stephon Castle: the cheapest player on your roster to lose/.test(s) && !/Mara.*into/.test(s) && !/Duren/.test(s), 'screenshot: names the cheapest drop, no Mara swap, no guess about Duren', h);
ok(blocked(Y), 'screenshot: blocked');
// 2. same roster with 4 spots and one free: Mara (O, Yahoo lets him on the IL) moves in, nobody is dropped
Y.il = { used: 3, max: 4 }; Y.illegal = null; s = strip(card(p, 'BvB'));
ok(/move Aday Mara \(O\) into an open injured-list spot/.test(s) && /No one needs to be dropped/.test(s), 'open IL spot: Mara moves in, no drop', s);
// 3. Yahoo's mark decides: Mara listed O but Yahoo doesn't offer him the IL, so he can't move; Powell (on the bench, O) can
Y.rows = Y.rows.map(r => r.name === 'Aday Mara' ? Object.assign({}, r, { elig: C }) : r); s = strip(card(p, 'BvB'));
ok(/move Norman Powell \(O\) into an open injured-list spot/.test(s) && !/move Aday Mara/.test(s), 'no IL in his Yahoo choices: Mara stays, Powell (who Yahoo does allow) takes the spot', s);
// 4. a healthy player still on the IL comes off; with the roster full that means a drop too
Y = { ts: Date.now(), lid: '99377', tid: '9', rows: base().map(r => r.name === 'Caleb Wilson' ? Object.assign(r, { inj: '' }) : r), il: { used: 4, max: 4 }, illegal: null };
s = strip(card(p, 'BvB')); ok(/Caleb Wilson is healthy but still in an injured-list spot: move him to the bench/.test(s), 'healthy on the IL: off it', s);
ok(/move Aday Mara \(O\) into an open injured-list spot/.test(s) && !/has to go/.test(s), 'his IL spot goes to Mara: no drop needed', s);
// 5. a drop can be an injured-list player when an injured player of yours then takes his spot (the cheapest here is Powell, on the IL)
Y = { ts: Date.now(), lid: '99377', tid: '9', rows: base().concat([row('Ty Jerome', 'BN', G)]), il: { used: 4, max: 4 }, illegal: null };
COST['Ty Jerome'] = 4; COST['Norman Powell'] = -2; s = strip(card(p, 'BvB'));
ok(/drop Norman Powell \(injured list\), then move Aday Mara \(O\) into his injured-list spot/.test(s), 'IL drop when an injured bench player takes his spot', s);
// 6. Yahoo says over the limit but the counts are fine: say so honestly, no guess
Y = { ts: Date.now(), lid: '99377', tid: '9', rows: base(), il: { used: 4, max: 4 }, illegal: 'You are over the max roster size. (Error #160)' };
s = strip(card(p, 'BvB')); ok(/counts the co-pilot read look fine/.test(s) && !/most likely/.test(s), 'unexplained Yahoo warning: honest message', s);
// 7. nothing to fix: no card, not blocked
Y.illegal = null; ok(card(p, 'BvB') === '' && !blocked(Y), 'legal roster: no card');
// 8. the count itself
const rc = check(Object.assign({}, Y, { il: { used: 4, max: 3 } })); ok(rc.ilCap === 3 && rc.activeCap === 14, "Yahoo's IL counter wins over the weekly settings");
console.log(bad ? bad + ' FAILED' : 'all passed'); process.exit(bad ? 1 : 0);
