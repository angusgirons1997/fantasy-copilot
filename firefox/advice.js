// Advice scorecard: did the board's pickups win more categories than holding, by as much as it predicted, and more than
// Basketball Monster's top free agent or Yahoo's most added? Shared by the panel (Settings) and tools/advice-backtest.js.
// Method and limits: see tools/advice-backtest.js.
(function (root) {
const NM = root.NAMES || require('./names.js'); let seed = 7;
const nkey = s => NM.key(s);
const IX = { p: 1, 3: 2, r: 3, a: 4, s: 5, b: 6, fg: 7, fga: 8, ft: 9, fta: 10, to: 11 };
const RATIO = { 'fg%': ['fg', 'fga'], 'ft%': ['ft', 'fta'] };
const addDay = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

// player weeks: monday -> { name key -> stats }
function score(ST, o) { o = o || {}; const H = o.weeks || 4, ACTIVE = o.active || 1; seed = 7;
const ACT = {}; Object.keys(ST).filter(k => k.startsWith('pjact:')).forEach(k => { const A = ST[k]; if (!A || !A.by) return; const m = {};
  Object.entries(A.by).forEach(([n, r]) => { const o = {}; Object.entries(IX).forEach(([c, i]) => o[c] = (r[i] || 0) * ACTIVE); m[nkey(n)] = o; }); ACT[A.start || k.slice(6)] = m; });
const statOf = (wk, name) => wk[nkey(name)] || null; // not in the table: no games that week

const val = (st, c) => { if (RATIO[c]) { const [m, a] = RATIO[c]; if (st[m] != null && st[a]) return st[m] / st[a]; return null; } return st[c] != null ? st[c] : null; };
const plus = (st, p, sign) => { const o = Object.assign({}, st); if (!p) return o; Object.keys(IX).forEach(c => { if (o[c] != null) o[c] += sign * (p[c] || 0); }); return o; };
function catsWon(A, B, cats) { let w = 0, n = 0; cats.forEach(c => { const a = val(A, c), b = val(B, c); if (a == null || b == null) return; n++; w += a === b ? 0.5 : (c === 'to' ? a < b : a > b) ? 1 : 0; }); return { w, n }; }

// one swap in one week: categories a week against the league with the add, minus with the drop
function weekGain(lw, me, wk, add, drop, roster, cats) {
  const mine = lw.teams[me]; if (!mine || !mine.st) return null; const on = new Set((roster || []).map(nkey));
  let base = mine.st; [add, drop].forEach(n => { if (on.has(nkey(n))) base = plus(base, statOf(wk, n), -1); });
  const A = plus(base, statOf(wk, add), 1), B = plus(base, statOf(wk, drop), 1);
  const field = Object.entries(lw.teams).filter(([t, x]) => t !== me && x && x.st); if (!field.length) return null;
  let g = 0; field.forEach(([, x]) => { g += catsWon(A, x.st, cats).w - catsWon(B, x.st, cats).w; }); return g / field.length;
}

const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mean = L => L.length ? L.reduce((a, x) => a + x, 0) / L.length : null;
const boot = (L, f, n = 2000) => { if (L.length < 3) return null; const r = []; for (let i = 0; i < n; i++) { const s = L.map(() => L[Math.floor(rnd() * L.length)]); const v = f(s); if (v != null && isFinite(v)) r.push(v); } r.sort((a, b) => a - b); return [r[Math.floor(r.length * 0.1)], r[Math.floor(r.length * 0.9)]]; };
const rank = L => { const s = L.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(L.length); s.forEach(([, i], k) => r[i] = k); return r; };
const spearman = (x, y) => { const n = x.length; if (n < 5) return null; const rx = rank(x), ry = rank(y); const mx = mean(rx), my = mean(ry); let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { a += (rx[i] - mx) * (ry[i] - my); b += (rx[i] - mx) ** 2; c += (ry[i] - my) ** 2; } return b && c ? a / Math.sqrt(b * c) : null; };

const out = {};
Object.keys(ST).filter(k => k.startsWith('advlog:')).forEach(k => { const lid = k.slice(7); const log = (ST[k] && ST[k].log) || []; const y = ST['yr:' + lid] || {}; const me = String(y.tid || '');
  if (!log.length || !me) return;
  // the start of each Yahoo week: from the forecasts and the log itself, else counted from the nearest known week
  const known = {}; Object.keys(ST).filter(q => q.startsWith('lgfc:' + lid + ':')).forEach(q => { const f = ST[q]; if (f && f.week && f.start) known[f.week] = f.start; });
  log.forEach(e => { if (e.week && e.weekEnd && !known[e.week]) known[e.week] = addDay(e.weekEnd, -6); });
  const kw = Object.keys(known).map(Number);
  const startOf = w => known[w] || (kw.length ? (() => { const w0 = kw.reduce((a, b) => Math.abs(b - w) < Math.abs(a - w) ? b : a); return addDay(known[w0], 7 * (w - w0)); })() : null);
  // your roster in a week: the first log made in it, else the last one before it
  const rosterIn = w => { const s = startOf(w); if (!s) return null; const e = log.find(x => x.day >= s && x.day <= addDay(s, 6)) || log.filter(x => x.day < s).pop(); return e ? e.roster : null; };
  // one decision per Yahoo week: the first log of it
  const seen = new Set(); const dec = log.filter(e => e.week && !seen.has(e.week) && seen.add(e.week));
  const realize = (e, s) => { if (!s || !s.add || !s.drop) return null; const cats = (e.cats || []).filter(c => !(e.punt || []).includes(c) && c !== '2d'); const g = [];
    for (let w = e.week + 1; w <= e.week + H; w++) { const lw = ST['lgweek:' + lid + ':' + w], st = startOf(w), wk = st && ACT[st]; if (!lw || !lw.teams || !wk) continue;
      const v = weekGain(lw, me, wk, s.add, s.drop, rosterIn(w) || e.roster, cats); if (v != null) g.push(v); }
    return g.length ? { real: mean(g), n: g.length } : null; };
  const rows = dec.map(e => { const r = { day: e.day, week: e.week, add: e.pick.add, drop: e.pick.drop, pred: e.pick.gain, worth: e.pick.worth };
    const p = realize(e, e.pick); if (!p) return null; Object.assign(r, p);
    ['bbm', 'hot'].forEach(b => { const q = e[b] && realize(e, e[b]); if (q) r[b] = { add: e[b].add, drop: e[b].drop, pred: e[b].gain, real: q.real }; });
    const L = (e.list || []).map(x => ({ pred: x.gain, q: realize(e, x) })).filter(x => x.q); r.list = L.map(x => ({ pred: x.pred, real: x.q.real }));
    r.rho = spearman(L.map(x => x.pred), L.map(x => x.q.real)); return r; }).filter(Boolean);
  const res = { league: y.league || lid, decisions: dec.length, scored: rows.length, horizonWeeks: H, active: ACTIVE, rows };
  if (rows.length) {
    const P = rows.map(r => r.pred), R = rows.map(r => r.real);
    res.pick = { pred: mean(P), real: mean(R), realCI: boot(R, mean), ratio: R.reduce((a, x) => a + x, 0) / (P.reduce((a, x) => a + x, 0) || NaN), positive: R.filter(x => x > 0).length / R.length };
    const ratioOf = rs => { const sp = rs.reduce((a, r) => a + r.pred, 0); return sp ? rs.reduce((a, r) => a + r.real, 0) / sp : null; }; res.pick.ratioCI = boot(rows, ratioOf);
    const W = rows.filter(r => r.worth), N = rows.filter(r => !r.worth); res.worth = { n: W.length, real: mean(W.map(r => r.real)) }; res.notWorth = { n: N.length, real: mean(N.map(r => r.real)) };
    ['bbm', 'hot'].forEach(b => { const both = rows.filter(r => r[b]); if (!both.length) return; const d = both.map(r => r.real - r[b].real);
      res[b] = { n: both.length, real: mean(both.map(r => r[b].real)), boardMinus: mean(d), boardMinusCI: boot(d, mean), boardBetter: d.filter(x => x > 0).length / d.length }; });
    const all = rows.flatMap(r => r.list); const sp2 = all.reduce((a, x) => a + x.pred * x.pred, 0); res.slope = sp2 ? all.reduce((a, x) => a + x.pred * x.real, 0) / sp2 : null; res.listPairs = all.length;
    const rh = rows.map(r => r.rho).filter(x => x != null); res.rankCorr = rh.length ? { n: rh.length, mean: mean(rh) } : null; }
  out[lid] = res; });
  return out; }

const A = { score }; if (typeof module !== 'undefined' && module.exports) module.exports = A; root.ADVICE = A;
})(typeof window !== 'undefined' ? window : globalThis);
