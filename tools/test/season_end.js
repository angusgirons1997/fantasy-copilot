// Late-season scenarios: move a store export forward to the trade deadline, the playoffs and past the season's end, the way
// Yahoo and Basketball Monster would really look then, and check the rendered pages for nonsense. Used by t_season_end.js
// (on a synthetic fixture) and by hand on a real export (keep those out of the repo).
'use strict';
const DAY = 864e5;
const addDay = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);
const days = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY);
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

// the league's calendar from what the store already holds: this week (Yahoo), the playoff weeks and their end, the trade deadline
function calendar(ST, lid, at) {
  const lv = ST['ylive:' + lid] || {}, y = ST['yr:' + lid] || {}, sp = ST['ysetp:' + lid] || {};
  const baseWeek = lv.week || y.week, baseMon = lv.start || y.weekStart; const yr0 = +baseMon.slice(0, 4);
  const md = s => { const m = String(s || '').match(/([A-Z][a-z]{2})\w*\.?\s+(\d{1,2})(?:,\s*(\d{4}))?/); if (!m) return null;
    let d = new Date(Date.UTC(m[3] ? +m[3] : yr0, MON[m[1]], +m[2], 12)).toISOString().slice(0, 10); if (d < baseMon) d = addDay(d, 365); return d; };
  const poEnd = md(sp.poEndText), po = sp.poWeeks, poStart = addDay(poEnd, -7 * po.length + 1), lastReg = po[0] - 1;
  // weeks run Monday to Sunday; the last regular week takes up any slack (Yahoo's long All-Star week)
  const weekNo = d => d >= poStart ? po[0] + Math.floor(days(poStart, d) / 7) : Math.min(lastReg, baseWeek + Math.floor(days(baseMon, d) / 7));
  const monOf = d => addDay(d, -((new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7));
  return { baseWeek, baseMon, poStart, poEnd, po, lastReg, tradeEnd: md(sp.tradeEnd), weekNo, monOf, at };
}

// each scenario: the day it pretends to be, from the calendar
const SCENARIOS = [
  { id: 'a', name: 'trade deadline week (day before the deadline)', day: c => addDay(c.tradeEnd, -1), trades: true },
  { id: 'b', name: 'day after the trade deadline', day: c => addDay(c.tradeEnd, 1) },
  { id: 'c', name: 'first playoff week', day: c => addDay(c.poStart, 1), seed: 1 },
  { id: 'd', name: 'playoffs, you are eliminated', day: c => addDay(c.poStart, 8), out: true },
  { id: 'e', name: 'final week, one day left', day: c => addDay(c.poEnd, -1), seed: 1, few: true },
  { id: 'f', name: 'day after the season ends', day: c => addDay(c.poEnd, 1), over: true },
];

function build(store, at, sc, opt) {
  const ST = JSON.parse(JSON.stringify(store)); const lid = opt.lid; const C = calendar(ST, lid, at);
  const T = sc.day(C); const wkMon = sc.over ? C.monOf(addDay(C.poEnd, 0)) : C.monOf(T); // after the season Yahoo still shows the final week
  const dW = days(C.baseMon, wkMon); const now = new Date(Date.parse(T + 'T17:00:00Z')).toISOString(); const dMs = Date.parse(now) - Date.parse(at);
  const W = C.weekNo(wkMon), dWeek = W - C.baseWeek;
  const isDate = /^\d{4}-\d{2}-\d{2}$/, inDate = /\b(20\d\d-\d\d-\d\d)\b/g, t0 = Date.parse(at);
  const shift = (v, k) => { if (typeof v === 'string') return isDate.test(v) ? addDay(v, dW) : v.replace(inDate, d => addDay(d, dW));
    if (typeof v === 'number') return v > t0 - 120 * DAY && v < t0 + 30 * DAY ? v + dMs : k === 'week' && v >= 1 && v <= 30 ? v + dWeek : v;
    if (Array.isArray(v)) return v.map(x => shift(x)); if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([kk, x]) => [shift(kk), shift(x, kk)])); return v; };
  const OUT = {};
  for (const [k, v] of Object.entries(ST)) { const p = k.split(':')[0];
    if (p === 'nbasched' || p === 'lgweek' || p === 'ysched') { OUT[k] = v; continue; } // the NBA calendar and finished weeks stay as they are
    OUT[shift(k)] = p === 'bx' ? Object.assign(shift(Object.assign({}, v, { views: null, com: null })), { views: v.views, com: v.com }) : shift(v); }
  const ncats = String((OUT['ysetp:' + lid] || {}).cats || '').split('),').length || 9;
  // how much is left: Basketball Monster's games and Yahoo's standings
  const left = d => Math.max(0, days(d, C.poEnd) + 1), f = left(T) / left(C.at.slice(0, 10));
  const poLeft = Math.min(1, left(T) / days(C.poStart, C.poEnd));
  const wkLeft = sc.over ? 0 : Math.max(0, days(T, addDay(wkMon, 6)) + 1) / 7;
  for (const l of (OUT.leagueList || [])) { const bx = OUT['bx:' + l.lid]; if (!bx || !bx.views) continue;
    const scale = (view, k) => { const V = bx.views[view]; if (!V) return; for (const id of Object.keys(V)) { const g = Math.round((V[id].g || 0) * k); if (g <= 0) delete V[id]; else V[id].g = g; } };
    if (sc.over) { ['ros', 'rest', 'next', 'po'].forEach(v => { bx.views[v] = {}; }); }
    else { scale('ros', f); scale('po', poLeft); scale('rest', wkLeft); if (W >= C.po[C.po.length - 1]) bx.views.next = {}; }
    // Basketball Monster's Trade Monster and Find Free Agents have nothing to compare once no games are left
    if (sc.over) { if (OUT['bbmtm:' + l.lid]) OUT['bbmtm:' + l.lid].by = {}; if (OUT['bbmfa:' + l.lid]) OUT['bbmfa:' + l.lid].by = {}; }
    const bs = OUT['bbmstand:' + l.lid]; const doneW = Math.min(W - 1, C.lastReg); const remW = Math.max(0, C.lastReg - doneW);
    if (bs) bs.teams.forEach(t => { if (t.left != null) t.left = Math.round(t.left * remW / Math.max(1, C.lastReg - C.baseWeek + 1)); });
    const ys = OUT['ystand:' + l.lid]; if (ys) { const base = ys.teams[0] ? (ys.teams[0].w + ys.teams[0].l + ys.teams[0].t) / ncats : 1; const k = Math.max(doneW, 1) / Math.max(base, 1);
      ys.teams.forEach(t => { t.w = Math.round(t.w * k); t.l = Math.round(t.l * k); t.t = Math.round(t.t * k); t.pct = +((t.w + t.t / 2) / Math.max(1, t.w + t.l + t.t)).toFixed(3); }); }
  }
  // this league's own matchup: playoff seeding, elimination, the last days
  const y = OUT['yr:' + lid], sp = OUT['ysetp:' + lid] || {}, ys = OUT['ystand:' + lid], lg = y && y.league;
  if (y) { y.date = T; y.week = W; if (sc.over) y.rows.forEach(r => { r.hasGame = false; r.game = ''; }); }
  const seat = rank => { if (!ys) return; const me = ys.teams.find(t => String(t.tid) === String(y.tid)), o = ys.teams.find(t => t.rank === rank); if (!me || !o || me === o) return;
    const r = me.rank; ['w', 'l', 't', 'pct', 'gb'].forEach(x => { const a = me[x]; me[x] = o[x]; o[x] = a; }); me.rank = rank; o.rank = r; ys.teams.sort((a, b) => a.rank - b.rank); };
  if (sc.seed) seat(1);
  if (sc.out) { seat(Math.min(ys ? ys.teams.length : 99, (sp.poTeams || 6) + 2));
    delete OUT['ylive:' + lid]; delete OUT['ynext:' + lid]; if (y) { y.oppTid = null; y.oppName = null; }
    if (lg) { delete OUT['mm:' + lg]; Object.keys(OUT).filter(k => k.startsWith('mmw:' + lg + ':') && k >= 'mmw:' + lg + ':' + wkMon).forEach(k => delete OUT[k]); } }
  const lv = OUT['ylive:' + lid]; if (lv && sc.few) ['me', 'opp'].forEach(s => { const g = lv[s] && lv[s].games; if (g) { g.remaining = Math.min(g.remaining, 3); g.played = g.total - g.remaining; } });
  if (W >= C.po[C.po.length - 1]) { delete OUT['ynext:' + lid]; if (lg) Object.keys(OUT).filter(k => k.startsWith('mmw:' + lg + ':') && k > 'mmw:' + lg + ':' + addDay(C.poEnd, -6)).forEach(k => delete OUT[k]); } // no week after the last one
  return { store: OUT, now, T, W, cal: C };
}

// nonsense on any page; trade advice after the deadline; pickup advice once the season is over
function check(r, sc, b) { const trades = b ? b.T <= b.cal.tradeEnd : sc.trades;
  const bad = []; r.errors.forEach(e => bad.push('page error: ' + e.slice(0, 200)));
  for (const [k, p] of Object.entries(r.pages)) { const t = p.text;
    if (p.broken) bad.push(k + ': Something went wrong');
    const m = t.match(/.{0,60}(\bNaN\b|\bundefined\b|\bInfinity\b|\btop 0\b|-\d+ games?\b|\bnull\b).{0,60}/); if (m) bad.push(k + ': "' + m[0] + '"');
    if (!trades && /Trade Monster for your|clears your bar.{0,40}swap|Put on the trade block/.test(t)) bad.push(k + ': trade advice after the deadline: "' + (t.match(/.{0,60}(Trade Monster for your|Put on the trade block).{0,40}/) || [''])[0] + '"');
    if (sc.over && /\badds? [+-]?\d[\d.]* of 99\b|\bPick up\b|\bAdd [A-Z][a-z]+ [A-Z]/.test(t)) bad.push(k + ': pickup advice after the season: "' + (t.match(/.{0,60}(adds? [+-]?\d[\d.]* of 99|Pick up|Add [A-Z][a-z]+ [A-Z]).{0,40}/) || [''])[0] + '"');
  }
  return bad;
}

module.exports = { SCENARIOS, build, check, calendar };
