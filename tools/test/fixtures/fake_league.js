// A made-up 8-team Yahoo categories league with Basketball Monster data, for tests that need a whole store (no real league data).
// Shapes follow what sync.js stores. Deterministic: the same store every run. fakeLeague() → { at, store }
'use strict';
function fakeLeague() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; const r2 = x => +x.toFixed(2);
  const at = '2026-11-23T22:00:00.000Z', mon = '2026-11-23', day = n => new Date(Date.parse(mon + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const ts = Date.parse(at) - 3600e3, lid = '1', lg = 'Test League', NT = 8;
  const FIRST = ['Avery', 'Blake', 'Casey', 'Drew', 'Emery', 'Finley', 'Gray', 'Harper', 'Indy', 'Jules', 'Kai', 'Logan'];
  const LAST = ['Ashby', 'Brook', 'Crane', 'Dale', 'Ellis', 'Frost', 'Glenn', 'Hale', 'Irwin', 'Joyce', 'Knox', 'Lowe'];
  const NBA = ['BOS', 'DEN', 'MIA', 'PHX', 'LAL', 'NYK', 'DAL', 'CHI', 'MIL', 'OKC'], POS = [['PG'], ['SG'], ['SF'], ['PF'], ['C'], ['PG', 'SG'], ['SF', 'PF']];
  const CATS = ['p', '3', 'r', 'a', 's', 'b', 'fg%', 'ft%', 'to'];
  const teams = Array.from({ length: NT }, (_, i) => ({ tid: String(i + 1), name: 'Team ' + 'ABCDEFGH'[i] }));
  // 8 x 13 rostered players, then 40 free agents; rank = index + 1
  const P = Array.from({ length: NT * 13 + 40 }, (_, i) => { const q = 1 - i / (NT * 13 + 40); const fga = 6 + 10 * q, fta = 1 + 5 * q, fgp = 0.42 + 0.12 * rnd(), ftp = 0.65 + 0.23 * rnd();
    const st = { 3: r2(0.5 + 2.5 * rnd()), p: r2(8 + 20 * q), r: r2(3 + 7 * rnd()), a: r2(1 + 6 * rnd()), s: r2(0.5 + rnd()), b: r2(0.2 + 1.5 * rnd()), fgp: r2(fgp), fga: r2(fga), ftp: r2(ftp), fta: r2(fta), to: r2(1 + 2 * q), fg: r2(fgp * fga), ft: r2(ftp * fta) };
    const cv = Object.fromEntries(CATS.map(c => [c, r2(3 * q - 1.5 + rnd() - 0.5)]));
    return { id: String(1000 + i), n: FIRST[i % 12] + ' ' + LAST[Math.floor(i / 12) % 12] + (i >= 144 ? ' ' + i : ''), t: NBA[i % NBA.length], pos: POS[i % POS.length], st, cv, lv: r2(q - 0.5), rank: i + 1, m: Math.round(20 + 14 * q) }; });
  const owner = id => { const i = +id - 1000; return i < NT * 13 ? String((i % NT) + 1) : null; };
  const roster = tid => P.filter(p => owner(p.id) === tid);
  const row = (p, g) => ({ n: p.n, t: p.t, pos: p.pos.join(' '), inj: '', g, lv: p.lv, rank: p.rank, m: p.m, st: p.st, cv: p.cv, notes: [], status: '' });
  const view = g => Object.fromEntries(P.map(p => [p.id, row(p, g)]));
  const me = roster('1'), fas = P.filter(p => !owner(p.id));
  const SLOTS = ['PG', 'SG', 'G', 'SF', 'PF', 'F', 'C', 'Util', 'Util', 'Util'];
  const elig = p => p.pos.concat(p.pos.some(x => /G/.test(x)) ? ['G'] : [], p.pos.some(x => /F/.test(x)) ? ['F'] : [], ['Util', 'BN']);
  const rows = me.map((p, i) => ({ pid: p.id, name: p.n, slot: i < 10 ? SLOTS[i] : i < 12 ? 'BN' : 'IL', elig: elig(p).concat(i === 12 ? ['IL'] : []), locked: false, team: p.t, pos: p.pos.join(','), game: '7:00 pm vs BOS', hasGame: true, inj: i === 12 ? 'O' : '' }));
  const sched = {}; for (let w = 1; w <= 17; w++) { const o = teams.map(t => t.tid); const rot = o.slice(1); for (let k = 0; k < (w - 1) % 7; k++) rot.push(rot.shift()); const a = ['1'].concat(rot); sched[w] = Array.from({ length: NT / 2 }, (_, k) => [a[k], a[NT - 1 - k]]); }
  const days = Array.from({ length: 7 }, (_, d) => ({ label: new Date(Date.parse(day(d) + 'T12:00:00Z')).toUTCString().slice(0, 3) + ' ' + (23 + d), dom: 23 + d, date: day(d) }));
  const mmP = (p, side, type) => ({ side, type, name: p.n, bbm: p.id, team: p.t, pos: p.pos, rank: p.rank, leagV: p.lv, puntV: p.lv, inj: '', role: '', status: '', st: Object.assign({ m: p.m }, p.st), tnum: side ? '2' : '1', catV: p.cv,
    games: days.map((_, d) => d % 2 ? null : { day: d, opp: 'BOS', cb: type === 'fa' ? null : 'MD_' + p.id + '_' + d, on: type === 'cur', fin: false, zero: false, val: p.lv, min: p.m }) });
  const tot = side => Object.fromEntries(CATS.map(c => [c, /%/.test(c) ? 0.47 : Math.round(100 + 50 * rnd())]).concat([['g', 40]]));
  const days0 = d => Math.round((Date.parse(d) - Date.parse(mon)) / 864e5);
  const mmWeek = (start, o) => ({ league: lg, me: teams[0].name, opp: o.name, t1: { id: '1', name: teams[0].name }, t2: { id: o.tid, name: o.name }, start, end: day(days0(start) + 6), cats: CATS,
    totals: { [teams[0].name]: tot(0), [o.name]: tot(1) }, bbmWin: Object.fromEntries(CATS.map((c, i) => [c, r2(0.3 + 0.05 * i)])), teams, days: days.map((d, i) => Object.assign({}, d, { date: day(days0(start) + i) })),
    players: me.map((p, i) => mmP(p, 0, i < 12 ? 'cur' : 'ir')).concat(roster(o.tid).map(p => mmP(p, 1, 'cur')), fas.map(p => mmP(p, 0, 'fa'))), ts, url: '', src: 'sync' });
  const store = {
    leagueList: [{ lid, tid: '1', league: lg }], activeLeague: lg, yrLast: lid,
    ['ysetp:' + lid]: { ts, scoring: 'cats', scoringText: 'Head-to-Head - Categories', addLimit: 3, waiverDays: 0, poTeams: 4, poWeeks: [18, 19, 20], poEndText: 'Sunday, Mar 21', tiebreak: 'Higher seed wins', tradeEnd: 'February 4, 2027', ilSlots: 2, bench: 2, slots: SLOTS,
      cats: 'Field Goal Percentage (FG%), Free Throw Percentage (FT%), 3-point Shots Made (3PTM), Points Scored (PTS), Total Rebounds (REB), Assists (AST), Steals (ST), Blocked Shots (BLK), Turnovers (TO)' },
    ['yr:' + lid]: { lid, tid: '1', date: mon, league: lg, teamName: teams[0].name, rows, empty: [], adds: { used: 0, max: 3 }, il: { used: 1, max: 2 }, waiverPriority: 3, illegal: null, week: 6, oppTid: '2', oppName: teams[1].name, ts, url: '', src: 'sync' },
    ['ylive:' + lid]: { ts, week: 6, start: mon, end: day(6), status: 'live', me: { tid: '1', name: teams[0].name, st: {}, score: 0, games: { played: 0, total: 40, remaining: 40 } }, opp: { tid: '2', name: teams[1].name, st: {}, score: 0, games: { played: 0, total: 40, remaining: 40 } }, src: 'page' },
    ['ynext:' + lid]: { week: 7, oppTid: '3', start: day(7), end: day(13), ts },
    ['ystand:' + lid]: { ts, teams: teams.map((t, i) => ({ tid: t.tid, name: t.name, rank: i + 1, w: 30 - 2 * i, l: 15 + 2 * i, t: 0, pct: +((30 - 2 * i) / 45).toFixed(3), gb: i ? String(i) : '-', waiver: i + 1, moves: 3 })) },
    ['ysched:' + lid]: { ts, weeks: sched, mine: {}, last: 17, bad: 0 },
    ['lgscan:' + lid]: { ts, league: lg, myTid: '1', teams: teams.map(t => ({ tid: t.tid, name: t.name, players: roster(t.tid).map(p => p.n), ranks: Object.fromEntries(roster(t.tid).map(p => [p.n, p.rank])), yids: Object.fromEntries(roster(t.tid).map(p => [p.n, p.id])) })) },
    ['bx:' + lid]: { ts: { rest: ts, next: ts, ros: ts, po: ts, form: ts, season: ts }, views: { rest: view(3), next: view(3), ros: view(60), po: view(10), form: view(10), season: view(15) }, dd: {}, com: {}, punt: { cats: [], err: 0, ts }, tot: {}, err: null },
    ['bbmstand:' + lid]: { ts, src: 'analysismonster', cats: CATS, teams: teams.map((t, i) => ({ name: t.name, me: i === 0, winPct: r2(0.6 - 0.03 * i), left: 108, vsMe: i ? { w: 5, l: 4, t: 0 } : null, vcat: {}, tot: {}, val: Object.fromEntries(CATS.map(c => [c, r2(rnd() * 2 - 1)])), value: r2(0.5 - 0.1 * i) })) },
    ['bbmfa:' + lid]: { ts, by: Object.fromEntries(me.slice(0, 12).map((p, i) => [p.id, fas.slice(0, 5).map((f, k) => ({ id: f.id, d: r2(i === 11 && !k ? 0.05 : -0.02 * (k + 1)) }))])) },
    ['bbmtm:' + lid]: { ts, by: Object.fromEntries(me.slice(0, 3).map(p => [p.id, roster('3').slice(0, 3).map(o => ({ id: o.id, diff: 0, give: p.lv, get: o.lv, t1: 4, t2: 1, team: teams[2].name }))])) },
    ['mm:' + lg]: mmWeek(mon, teams[1]), ['mmw:' + lg + ':' + day(-7)]: Object.assign(mmWeek(day(-7), teams[3]), { ts: ts - 7 * 864e5 }), ['mmw:' + lg + ':' + mon]: mmWeek(mon, teams[1]), ['mmw:' + lg + ':' + day(7)]: mmWeek(day(7), teams[2]),
    ['sset:' + lg]: { punt: [], exclude: [], protect: [], forceDrop: {}, pickAdds: {} },
    ['sync:' + lid]: { lid, league: lg, mode: 'full', ts, ok: true }, ['fullsync:' + lid]: ts,
  };
  return { at, store };
}
module.exports = { fakeLeague };
