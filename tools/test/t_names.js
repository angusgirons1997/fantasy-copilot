// The one name rule (firefox/names.js) and Set lineups using it. node tools/test/t_names.js (no export needed)
'use strict';
const path = require('path'); const NM = require(path.join(__dirname, '..', '..', 'firefox', 'names.js'));
const { assign } = require(path.join(__dirname, '..', '..', 'firefox', 'yroster.js'));
let bad = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) bad++; };
// nicknames and short first names
[['Moe Wagner', 'Moritz Wagner'], ['Nic Claxton', 'Nicolas Claxton'], ['Herb Jones', 'Herbert Jones'], ['Cam Johnson', 'Cameron Johnson'], ['KJ Martin', 'Kenyon Martin Jr.'],
  ['Alex Sarr', 'Alexandre Sarr'], ['Nikola Jović', 'Nikola Jovic'], ["De'Aaron Fox", 'DeAaron Fox'], ['P.J. Washington', 'PJ Washington'], ['Jimmy Butler III', 'Jimmy Butler']]
  .forEach(([a, b]) => ok(NM.same(a, b), `${a} = ${b}`));
// different players who share a surname are never mixed up
[['Moritz Wagner', 'Franz Wagner'], ['Amen Thompson', 'Ausar Thompson'], ['Jalen Williams', 'Jaylin Williams'], ['Jalen Smith', 'Jalen Suggs']].forEach(([a, b]) => ok(!NM.same(a, b), `${a} ≠ ${b}`));
// a short form on another team is someone else; the exact name still matches across teams (a traded player)
ok(!NM.same('N. Claxton', 'Nic Claxton', 'DEN', 'BKN') && NM.same('Cam Johnson', 'Cameron Johnson', 'DEN', 'BKN'), 'an initial on another team is someone else; a full name or known nickname survives a trade');
ok(NM.same('N. Claxton', 'Nic Claxton', 'BKN', 'BKN'), 'an initial matches on the same team');
// pick: the one row; two that fit equally → none
const rows = [{ name: 'Franz Wagner', team: 'ORL' }, { name: 'Moritz Wagner', team: 'ORL' }, { name: 'Amen Thompson', team: 'HOU' }, { name: 'Ausar Thompson', team: 'DET' }];
ok(NM.pick(rows, 'Moe Wagner') === rows[1], 'Moe Wagner → Moritz, not Franz');
ok(NM.pick(rows, 'A. Thompson') === null, 'A. Thompson with no team → nobody (two fit)');
ok(NM.pick(rows, 'A. Thompson', 'HOU') === rows[2], 'A. Thompson of Houston → Amen');
// Set lineups: the plan says "Moe Wagner", Yahoo says "Moritz Wagner" and also has Franz: Moritz starts, Franz stays benched
const y = [{ name: 'Franz Wagner', pid: 'f', slot: 'BN', elig: ['SF', 'Util', 'BN'] }, { name: 'Moritz Wagner', pid: 'm', slot: 'BN', elig: ['C', 'Util', 'BN'] }];
const r = assign(y, ['Moe Wagner'], ['Franz Wagner'], [], ['C']);
ok(r.asg.m === 'C' && r.asg.f === 'BN', `Set lineups starts Moritz at centre, Franz on the bench (${JSON.stringify(r.asg)})`);
console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
