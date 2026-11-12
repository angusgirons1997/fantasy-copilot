// Season engine: weekly H2H forecast, daily lineup optimiser, add/drop planner. Pure functions (no DOM).
(function (root) {
  const LBL = { p: 'points', 3: '3-pointers', r: 'rebounds', a: 'assists', s: 'steals', b: 'blocks', to: 'turnovers', '2d': 'double-doubles', fg: 'field goals made', ft: 'free throws made', 'fg%': 'field goal %', 'ft%': 'free throw %' } // full names: the panel shows no abbreviations;
  const VARK = { p: 2.2, 3: 1.4, r: 1.6, a: 1.6, s: 1.2, b: 1.5, to: 1.2, fg: 1.0, ft: 1.6 };
  const RATIO = { 'fg%': ['fg', 'fga'], 'ft%': ['ft', 'fta'] };
  const KEYS = ['p', '3', 'r', 'a', 's', 'b', 'to', '2d', 'fg', 'fga', 'ft', 'fta'];
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));
  const phi = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  function PhiInv(p) { p = Math.min(0.999, Math.max(0.001, p)); let lo = -6, hi = 6; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.'’`]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/gi, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ALIAS = { 'nicolas claxton': 'nic claxton', 'herb jones': 'herbert jones', 'kelly oubre': 'kelly oubre', 'robert williams': 'robert williams', 'alexandre sarr': 'alex sarr', 'derrick jones': 'derrick jones', 'cameron johnson': 'cam johnson' };
  const key = s => { const n = norm(s); return ALIAS[n] || n; };
  const TEAMC = { NOR: 'NOP', NO: 'NOP', PHO: 'PHX', GS: 'GSW', SA: 'SAS', NY: 'NYK', UTAH: 'UTA', WSH: 'WAS', BRK: 'BKN', CHO: 'CHA' };
  const tc = t => { t = String(t || '').toUpperCase(); return TEAMC[t] || t; };
  const last = n => { const w = norm(n).split(' '); return w[w.length - 1] || ''; };
  // match Yahoo roster entries to BBM rows: saved id link, exact name, last name + team, initial + last name
  function matchPlayers(yrows, bbm, idmap) {
    const pairs = [], unmatched = [], used = new Set();
    yrows.forEach(y => {
      const nm = typeof y === 'string' ? y : y.name, team = typeof y === 'string' ? '' : y.team, pid = typeof y === 'string' ? null : y.pid;
      let hit = null;
      if (pid && idmap && idmap[pid]) hit = bbm.find(b => b.bbm === idmap[pid] && !used.has(b));
      if (!hit) hit = bbm.find(b => !used.has(b) && key(b.name) === key(nm));
      if (!hit && team) { const c = bbm.filter(b => !used.has(b) && last(b.name) === last(nm) && tc(b.team) === tc(team)); if (c.length === 1) hit = c[0]; }
      if (!hit) { const c = bbm.filter(b => !used.has(b) && last(b.name) === last(nm) && norm(b.name)[0] === norm(nm)[0]); if (c.length === 1) hit = c[0]; }
      if (hit) { used.add(hit); pairs.push({ y: nm, pid, b: hit }); } else unmatched.push(nm);
    });
    return { pairs, unmatched };
  }
  // seeded normals so simulated numbers don't flicker between refreshes
  function normals(n, seed) { let a = seed >>> 0; const r = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const z = new Float64Array(n); for (let i = 0; i < n; i += 2) { const u = Math.max(1e-12, r()), v = r(); const m = Math.sqrt(-2 * Math.log(u)); z[i] = m * Math.cos(2 * Math.PI * v); if (i + 1 < n) z[i + 1] = m * Math.sin(2 * Math.PI * v); } return z; }
  const MC_N = 1200, SIG_M = 0.07; let ZBUF = null;
  // week win with correlated categories: each team's counting stats share a volume shock (games, minutes, pace)
  function weekWinMC(ctx, cp, A, B) {
    const cs = ctx.cats, nc = cs.length, W = nc + 2; if (!ZBUF || ZBUF.length < MC_N * W) ZBUF = normals(MC_N * 13, 20261019);
    const par = cs.map(c => { const q = cp[c]; const raw = q.me - q.opp; if (RATIO[c]) return { raw, fa: 0, fb: 0, rs: q.sd, low: false };
      const ma = Math.max(0, catStat(A, c)), mb = Math.max(0, catStat(B, c)); const fv = (ma * ma + mb * mb) * SIG_M * SIG_M; const rs = Math.sqrt(Math.max(q.sd * q.sd - fv, 0.25 * q.sd * q.sd));
      return { raw, fa: ma * SIG_M, fb: mb * SIG_M, rs, low: c === 'to' }; });
    let win = 0;
    for (let i = 0; i < MC_N; i++) { const o = i * 13, ea = ZBUF[o], eb = ZBUF[o + 1]; let w = 0;
      for (let j = 0; j < nc; j++) { const q = par[j]; const d = q.raw + q.fa * ea - q.fb * eb + q.rs * ZBUF[o + 2 + j]; if (q.low ? d < 0 : d > 0) w++; }
      if (w >= ctx.need) win++; }
    return win / MC_N;
  }
  // ---------- analyst notes (BBM 'Analysts' column) -> sentiment in [-1, 1] ----------
  const NPOS = [[/\b(love|loving)\b/, 2], [/\breally like\b/, 2], [/\b(must[- ]add|pick(ing)? him up|grab him|add him|buy)\b/, 2], [/\bbreak ?out\b/, 2], [/\b(like|liked|likes)\b/, 1], [/\b(great|excellent|insane|huge|elite|fantastic|terrific)\b/, 1], [/\b(good|solid|nice|strong|encouraging|promising|impressive)\b/, 1],
    [/\b(upside|starter|starting|start(s)? (for|at)|more minutes|minutes (are )?(up|rising|increase)|bigger role|role (is )?(growing|expand)|on (the )?radars?)\b/, 1], [/\b(efficient|efficiency|interesting)\b/, 0.5]];
  const NNEG = [[/\b(don'?t|do not|doesn'?t|can'?t|not) (like|love|trust|see)\b/, 2], [/\b(drop|cut|sell|avoid|fade)\b/, 2], [/\b(fail|failing|disappoint\w*|concern\w*|worr\w*|struggl\w*|poor|bad|awful|ugly)\b/, 1],
    [/\b(inconsistent|limit\w*|split|bench|6th man|sixth man|backup|foul trouble|injur\w*|out for|no minutes|not enough minutes|minutes (are )?(down|dropping))\b/, 1], [/\b(low|lower|little|under)\b.{0,20}\b(upside|usage|minutes|ceiling)\b/, 1], [/\bupside is (a little |very )?low\b/, 1], [/\bnot blowing\b/, 0.5], [/\ball he (may|will|does) do is\b/, 1]];
  function noteScore(t) { t = String(t || '').toLowerCase(); let p = 0, n = 0; NPOS.forEach(([re, w]) => { if (re.test(t)) p += w; }); NNEG.forEach(([re, w]) => { if (re.test(t)) n += w; });
    if (/\bupside\b/.test(t) && /\b(low|little|limit)/.test(t)) p = Math.max(0, p - 1); if (/\b(don'?t|not) like\b/.test(t)) p = Math.max(0, p - 1);
    return Math.max(-1, Math.min(1, (p - n) / (p + n + 1))); }
  // recent notes count more (half-life 10 days); returns {s: -1..1, text, by, age} for the freshest note
  function noteView(pl) { const N = (pl.notes || []).filter(x => x && x.text); if (!N.length) return null; let sw = 0, ww = 0; N.forEach(x => { const w = Math.pow(0.5, (x.age || 48) / 240); sw += w * noteScore(x.text); ww += w; });
    const f = N.slice().sort((a, b) => (a.age || 1e9) - (b.age || 1e9))[0]; return { s: +(sw / (ww || 1) * Math.min(1, ww)).toFixed(2), text: f.text, by: f.by, age: f.age }; }
  const DEFSLOTS = { 9: ['PG', 'SG', 'G', 'SF', 'PF', 'F', 'C', 'Util', 'Util', 'Util'], 11: ['PG', 'SG', 'G', 'G', 'SF', 'PF', 'F', 'C', 'Util', 'Util'] };
  function eligFromPos(pos) { const e = new Set(['Util']); (pos || []).forEach(p => { e.add(p); if (p === 'PG' || p === 'SG') e.add('G'); if (p === 'SF' || p === 'PF') e.add('F'); }); return e; }

  // ---------- aggregation ----------
  function gameStats(pl) { const s = pl.st || {}; const o = {}; KEYS.forEach(k => o[k] = +s[k] || 0); if (!o.fg && s.fgp && s.fga) o.fg = s.fgp * s.fga; if (!o.ft && s.ftp && s.fta) o.ft = s.ftp * s.fta; return o; }
  function agg(list) { // list of {pl, g} started games
    const m = {}, v = {}; KEYS.forEach(k => { m[k] = 0; v[k] = 0; });
    list.forEach(({ pl }) => { const s = pl._gs || (pl._gs = gameStats(pl)); KEYS.forEach(k => { m[k] += s[k]; }); Object.keys(VARK).forEach(k => v[k] += VARK[k] * s[k]); v['2d'] += s['2d'] * (1 - Math.min(1, s['2d'])); });
    return { m, v, n: list.length };
  }
  function catStat(A, c) { // value for category c from aggregate
    if (RATIO[c]) { const [mk, ak] = RATIO[c]; return A.m[ak] > 0 ? A.m[mk] / A.m[ak] : 0; }
    return A.m[c];
  }
  function catSd(A, B, c) {
    if (RATIO[c]) { const [mk, ak] = RATIO[c]; const f = X => { const a = X.m[ak]; if (!a) return 0; const p = X.m[mk] / a; return a * p * (1 - p) * 1.3 / (a * a); }; return Math.sqrt(f(A) + f(B)) || 0.01; }
    return Math.sqrt((A.v[c] || 0) + (B.v[c] || 0)) || 0.01; // no games left: the banked totals decide it
  }
  // live weeks: what's already banked on Yahoo is added to the projected rest of the week (no uncertainty on the banked part)
  function bankAdd(ctx, X, side) { if (!ctx.bank) return X; const b = ctx.bank[side] || {}; const m = Object.assign({}, X.m); KEYS.forEach(k => { m[k] = (m[k] || 0) + (b[k] || 0); }); return { m, v: X.v, n: X.n }; }
  function catProbs(ctx, A0, B0) { // returns {c: {p, z, d, sd, me, opp}}
    const out = {}; const A = bankAdd(ctx, A0, 0), B = bankAdd(ctx, B0, 1);
    ctx.cats.forEach(c => {
      const me = catStat(A, c) + (ctx.off[0][c] || 0), op = catStat(B, c) + (ctx.off[1][c] || 0);
      let sd = catSd(A0, B0, c) * (ctx.scale[c] || 1);
      if (ctx.bank && RATIO[c]) { const ak = RATIO[c][1]; const fa = A0.m[ak] / Math.max(A.m[ak], 1), fb = B0.m[ak] / Math.max(B.m[ak], 1); sd = sd * Math.max(0.05, Math.sqrt((fa * fa + fb * fb) / 2)); } // only the attempts still to come can move a percentage
      let d = me - op; if (c === 'to') d = -d;
      const z = d / sd; out[c] = { p: Phi(z), z, d, sd, me, opp: op };
    });
    return out;
  }
  function weekWin(ps, need) { // DP over category wins
    let dp = [1]; ps.forEach(p => { const n = new Array(dp.length + 1).fill(0); dp.forEach((x, i) => { n[i] += x * (1 - p); n[i + 1] += x * p; }); dp = n; });
    let w = 0; for (let i = need; i < dp.length; i++) w += dp[i]; return w;
  }
  // what a week is worth. 'cats' leagues (Yahoo "Head-to-Head - Categories") count every category won in the standings, so a
  // lineup's value is the share of categories it's expected to win; 'win' leagues (most categories takes the week) value the
  // chance of winning the majority.
  const objective = (ctx, cp, A, B) => ctx.obj === 'cats' ? ctx.cats.reduce((t, c) => t + cp[c].p, 0) / ctx.cats.length : weekWinMC(ctx, cp, A, B);
  function leverage(ctx, cp) { // dW/dp_c
    const cs = ctx.cats; const ps = cs.map(c => cp[c].p); const out = {};
    if (ctx.obj === 'cats') { cs.forEach(c => out[c] = 1 / cs.length); return out; } // every category is worth the same
    cs.forEach((c, i) => { const a = ps.slice(); a[i] = 1; const b = ps.slice(); b[i] = 0; out[c] = weekWin(a, ctx.need) - weekWin(b, ctx.need); });
    return out;
  }
  // marginal value weights per raw stat key, from leverage and current state
  function statWeights(ctx, A0, B0, cp) {
    const A = bankAdd(ctx, A0, 0), B = bankAdd(ctx, B0, 1); const L = leverage(ctx, cp); const w = {}; KEYS.forEach(k => w[k] = 0);
    ctx.cats.forEach(c => {
      const q = cp[c]; const dens = phi(q.z) / q.sd * L[c];
      if (RATIO[c]) { const [mk, ak] = RATIO[c]; const a = A.m[ak] || 1; const p = A.m[mk] / a; w[mk] += dens / a; w[ak] += -dens * p / a; }
      else w[c] += (c === 'to' ? -1 : 1) * dens;
    });
    return w;
  }
  const gameMV = (w, pl) => { const s = pl._gs || (pl._gs = gameStats(pl)); let v = 0; KEYS.forEach(k => v += w[k] * s[k]); return v; };

  // ---------- slots / matching ----------
  function canFit(players, slots, eligOf) { // bipartite matching
    const match = new Array(slots.length).fill(-1);
    function tryP(i, seen) { for (let j = 0; j < slots.length; j++) { if (seen[j] || !eligOf(players[i]).has(slots[j])) continue; seen[j] = true; if (match[j] < 0 || tryP(match[j], seen)) { match[j] = i; return true; } } return false; }
    for (let i = 0; i < players.length; i++) if (!tryP(i, new Array(slots.length).fill(false))) return null;
    const asg = {}; match.forEach((i, j) => { if (i >= 0) asg[players[i].name] = slots[j]; }); return asg;
  }

  // ---------- context ----------
  function build(model, opts) {
    opts = opts || {};
    const cats = model.cats.filter(c => LBL[c]);
    const need = Math.floor(cats.length / 2) + 1;
    const nd = model.days.length;
    const slots = opts.slots || DEFSLOTS[cats.length] || DEFSLOTS[9];
    const yel = {}; (opts.yahooRows || []).forEach(r => yel[key(r.name)] = new Set(r.elig.filter(x => x !== 'BN' && x !== 'IL' && x !== 'IL+')));
    const eligOf = pl => pl._el || (pl._el = yel[key(pl.name)] || eligFromPos(pl.pos));
    const today = opts.today || null; // 'YYYY-MM-DD' US date
    const open = model.days.map((d, i) => !(today && d.date && d.date < today));
    const meSide = opts.swap ? 1 : 0;
    const P = model.players.map((p, i) => Object.assign({}, p, { idx: i }));
    // Yahoo is the word on the injured list: a player of yours in an IL spot whom Yahoo still lists as out stays there and is never
    // planned as a starter (BBM can show him as only questionable). He's planned back once Yahoo clears him.
    const yIL = new Set((opts.yahooRows || []).filter(r => /^IL/.test(r.slot || '') && /^(O|OUT|INJ|IL|NA|SUSP)$/i.test(String(r.inj || '').trim())).map(r => key(r.name)));
    const markIL = () => { if (yIL.size) P.forEach(p => { if (p.side === meSide && p.type !== 'fa' && yIL.has(key(p.name))) p.type = 'ir'; }); }; markIL();
    // anyone in an injured-list spot on Yahoo, whatever his status: dropping him frees no roster spot, so he's never a pickup's drop
    const ilSlot = new Set((opts.yahooRows || []).filter(r => /^IL/.test(r.slot || '')).map(r => key(r.name)));
    // reconcile with a newer Yahoo roster (BBM can lag hours behind pickups)
    ctx0reconcile: if (opts.roster && opts.roster.length >= 8) {
      const meS = opts.swap ? 1 : 0; const pool = []; const seenK = new Set(); P.filter(p => p.side === meS).sort((a, b) => (a.type === 'fa') - (b.type === 'fa')).forEach(p => { const k = key(p.name); if (!seenK.has(k)) { seenK.add(k); pool.push(p); } });
      const mt = matchPlayers(opts.roster, pool, opts.idmap || {}); const onY = new Set(mt.pairs.map(x => x.b));
      P._recon = { gone: [], joined: [], unmatched: mt.unmatched, pairs: mt.pairs.filter(x => x.pid && x.b.bbm).map(x => ({ pid: x.pid, bbm: x.b.bbm })) };
      const joined = mt.pairs.map(x => x.b).filter(p => p.type === 'fa');
      // gone: on BBM's copy of your roster but not on Yahoo's. A Yahoo name BBM can't match only holds back a player with the same surname
      const unL = new Set(mt.unmatched.map(n => last(n)));
      const gone = P.filter(p => p.side === meS && p.type !== 'fa' && !onY.has(pool.find(q => key(q.name) === key(p.name))) && !unL.has(last(p.name)));
      if (gone.length > 4 || joined.length > 4) break ctx0reconcile; // too different: don't guess
      gone.forEach(p => { p.type = 'fa'; p.games = p.games.map(g => g && Object.assign({}, g, { on: false })); p._gone = true; });
      joined.forEach(j => P.filter(p => p.side === meS && key(p.name) === key(j.name)).forEach(p => { p.type = 'cur'; p._joined = true; }));
      P._recon.gone = gone.map(p => p.name); P._recon.joined = joined.map(p => p.name);
    }
    markIL(); // again, for players BBM didn't yet show on your roster (they come back from the reconcile as 'cur')
    const mine = P.filter(p => p.side === meSide && p.type !== 'fa');
    const opp = P.filter(p => p.side !== meSide && p.type !== 'fa');
    const fas = P.filter(p => p.side === meSide && p.type === 'fa');
    const ctx = { recon: P._recon || null, model, cats, need, nd, slots, eligOf, open, mine, opp, fas, scale: {}, off: [{}, {}], meName: meSide ? model.opp : model.me, oppName: meSide ? model.me : model.opp };
    ctx.ilSlot = ilSlot;
    ctx.obj = opts.obj === 'cats' ? 'cats' : 'win'; ctx.punt = (opts.punt || []).filter(c => cats.includes(c)); ctx.oppGames = opts.oppGames || null;
    // thresholds (minimum gain for a pickup, tolerance for keeping Yahoo's lineup) are set in win-chance units; in a categories
    // league the same decision is worth less per category, so they're scaled to match
    { const half = cats.map(() => 0.5); const a = half.slice(); a[0] = 1; const b = half.slice(); b[0] = 0; const Lw = weekWin(a, need) - weekWin(b, need); ctx.Lw = Lw || 0.27; ctx.unit = ctx.obj === 'cats' ? (1 / cats.length) / ctx.Lw : 1; }
    // current (as-set) lineups from BBM checkboxes
    const setList = arr => { const L = []; arr.forEach(pl => pl.games.forEach(g => { if (g && g.on) L.push({ pl, g }); })); return L; };
    const Am = agg(setList(mine)), Bo = agg(setList(opp));
    const tm = model.totals[ctx.meName] || {}, to = model.totals[ctx.oppName] || {};
    cats.forEach(c => { const tc = c; if (tm[tc] != null) ctx.off[0][c] = tm[tc] - catStat(Am, c); if (to[tc] != null) ctx.off[1][c] = to[tc] - catStat(Bo, c); });
    // calibrate per-category scale to BBM win probabilities
    // (only before the week starts: once games are played BBM's win chances include the results, so they can't be compared with
    // projections alone; doing so made the plan wildly over-confident mid-week)
    const raw = catProbs(Object.assign({}, ctx, { scale: {} }), Am, Bo); const sc = [];
    if (open.every(Boolean)) cats.forEach(c => { let pb = model.bbmWin[c]; if (pb == null) return; if (meSide) pb = 1 - pb; const zb = PhiInv(pb), zm = raw[c].z; if (Math.abs(zb) > 0.12 && Math.abs(zm) > 0.05 && Math.sign(zb) === Math.sign(zm)) { const s = Math.min(8, Math.max(0.4, zm / zb)); ctx.scale[c] = s; sc.push(s); } });
    // no calibration possible (mid-week, or a week Matchup Monster hasn't opened): use this league's last pre-week calibration,
    // else the typical value (~2.8). Leaving it at 1 made those weeks far too sure of the result.
    const prior = opts.scale || {}; const pv = Object.values(prior).filter(x => x > 0).sort((a, b) => a - b); const pmed = pv.length ? pv[Math.floor(pv.length / 2)] : 2.8;
    if (sc.length) { ctx.calibrated = true; const med = sc.sort((a, b) => a - b)[Math.floor(sc.length / 2)]; cats.forEach(c => { if (!ctx.scale[c]) ctx.scale[c] = med; }); }
    else cats.forEach(c => { ctx.scale[c] = prior[c] > 0 ? prior[c] : pmed; });
    // learned from finished weeks: how far the forecasts were from Yahoo's final results (1 until there are enough weeks)
    ctx.scaleBase = Object.assign({}, ctx.scale); if (opts.sdMul && opts.sdMul !== 1) cats.forEach(c => { ctx.scale[c] *= opts.sdMul; });
    ctx.setMine = setList(mine); ctx.setOpp = setList(opp);
    // live week: Yahoo's banked category totals replace the projections for days already played
    if (opts.live && opts.live.me && opts.live.opp && open.some(o => !o)) { const toM = st => { const o = {}; KEYS.forEach(k => { o[k] = +st[k] || 0; }); if (!o.fga && o.fg && st['fg%'] > 0) o.fga = o.fg / st['fg%']; if (!o.fta && o.ft && st['ft%'] > 0) o.fta = o.ft / st['ft%']; return o; };
      ctx.bank = [toM(meSide ? opts.live.opp : opts.live.me), toM(meSide ? opts.live.me : opts.live.opp)]; ctx.off = [{}, {}];
      ctx.setMine = ctx.setMine.filter(x => open[x.g.day]); ctx.setOpp = ctx.setOpp.filter(x => open[x.g.day]); }
    return ctx;
  }

  // roster: [{pl, from, to}] availability by day index (inclusive)
  // returns started list [{pl,g}] for the week
  function lineup(ctx, roster, mode, w, fixed) {
    const out = [];
    for (let d = 0; d < ctx.nd; d++) {
      const avail = roster.filter(r => d >= r.from && d <= r.to).map(r => r.pl).filter(pl => pl.games[d]);
      if (!ctx.open[d]) { if (ctx.bank) continue; avail.forEach(pl => { const g = pl.games[d]; if (g.on) out.push({ pl, g }); }); continue; } // live: past days are in the banked totals
      let cand = avail.filter(pl => !pl.games[d].zero && pl.type !== 'ir');
      let score;
      if (mode === 'max') score = pl => (pl.games[d].val != null ? pl.games[d].val : (pl.leagV || 0)) + 5;
      else score = pl => gameMV(w, pl);
      cand = cand.map(pl => ({ pl, s: score(pl) })).sort((a, b) => b.s - a.s);
      const chosen = [];
      for (const c of cand) { if (mode !== 'max' && c.s <= 0) continue; if (chosen.length >= ctx.slots.length) break; const t = chosen.concat([c.pl]); if (canFit(t, ctx.slots, ctx.eligOf)) chosen.push(c.pl); }
      // never leave a spot empty while someone with a game sits: fill what's left with the best remaining players
      for (const c of cand) { if (chosen.length >= ctx.slots.length) break; if (chosen.includes(c.pl)) continue; const t = chosen.concat([c.pl]); if (canFit(t, ctx.slots, ctx.eligOf)) chosen.push(c.pl); }
      chosen.forEach(pl => out.push({ pl, g: pl.games[d] }));
    }
    return out;
  }
  function oppAgg(ctx, L) { const B = agg(L); const b = ctx.boost; if (b) KEYS.forEach(k => { B.m[k] += b.m[k] || 0; B.v[k] += b.v[k] || 0; });
    // Yahoo's count of your opponent's games (remaining once the week is under way, the week's total before it) replaces our
    // assumption about how many they'll play: their per-game production stays BBM's, only the number of games is Yahoo's
    // Yahoo's "possible" games are a ceiling: managers fill only part of them (util, measured from finished weeks; ~0.93 so far)
    const g = ctx.oppGames; if (g && L.length) { const u = g.util || 0.93; const target = ctx.bank ? (g.remaining != null ? g.remaining * u : null) : (g.total != null ? g.total * u : null); if (target != null && target >= 0) { const f = Math.max(0.6, Math.min(1.4, target / L.length)); if (Math.abs(f - 1) > 0.02) KEYS.forEach(k => { B.m[k] *= f; B.v[k] *= f; }); } }
    return B; }
  // the week's value ignoring punted categories: pickups are never chosen because they help a category you're punting
  function noPunt(ctx, cp) { const P = ctx.punt; if (!P || !P.length) return null;
    if (ctx.obj === 'cats') return ctx.cats.reduce((t, c) => t + (P.includes(c) ? 0 : cp[c].p), 0) / ctx.cats.length;
    return weekWin(ctx.cats.map(c => P.includes(c) ? (ctx.puntBase && ctx.puntBase[c] != null ? ctx.puntBase[c] : cp[c].p) : cp[c].p), ctx.need); }
  function optimise(ctx, roster, oppList, iters) {
    const B = oppAgg(ctx, oppList);
    // re-weighting can bounce between two lineups; keep the best one seen rather than whichever came last
    const score = L => { const A = agg(L); const cp = catProbs(ctx, A, B); return { list: L, cp, W: objective(ctx, cp, A, B), A }; };
    let cur = lineup(ctx, roster, 'max'); let best = score(cur);
    for (let it = 0; it < (iters || 3); it++) { const A = agg(cur); const cp = catProbs(ctx, A, B); const w = statWeights(ctx, A, B, cp); cur = lineup(ctx, roster, 'win', w); const sc = score(cur); if (sc.W > best.W + 1e-9) best = sc; }
    const np = noPunt(ctx, best.cp); return { list: best.list, cp: best.cp, W: best.W, Wnp: np == null ? best.W : np };
  }
  function evalList(ctx, meList, oppList) { const A = agg(meList), B = oppAgg(ctx, oppList); const cp = catProbs(ctx, A, B); return { cp, W: objective(ctx, cp, A, B), Wmaj: weekWinMC(ctx, cp, A, B), Wind: weekWin(ctx.cats.map(c => cp[c].p), ctx.need) }; }

  function P_find(ctx, name) { const k = key(name); return ctx.fas.find(f => key(f.name) === k) || null; }
  function plan(model, opts) {
    opts = opts || {};
    const ctx = build(model, opts);
    const full = pl => ({ pl, from: 0, to: ctx.nd - 1 });
    // expected opponent streaming this week (their recent add rate x replacement-level free-agent games); applied to every comparison
    { const outNow = pl => { const g = (pl.games || []).filter(Boolean); return g.length > 0 && g.every(x => x.zero); }; const openDays = ctx.open.filter(Boolean).length;
      // an estimate of your opponent's streaming is the tool's own guess, so it's off unless switched on (opts.oppStream)
      if (opts.oppStream && opts.oppAdds > 0 && openDays) { const n = Math.min(opts.oppAdds * openDays / ctx.nd, 3); const seen = new Set(); const repl = ctx.fas.filter(f => !outNow(f) && !seen.has(key(f.name)) && seen.add(key(f.name))).sort((a, b) => (b.sv || -9) - (a.sv || -9)).slice(3, 13);
        if (repl.length) { const m = {}, v = {}; KEYS.forEach(k => { m[k] = 0; v[k] = 0; }); repl.forEach(f => { const st = f._gs || (f._gs = gameStats(f)); KEYS.forEach(k => m[k] += st[k] / repl.length); });
          const g = n * 2.2; KEYS.forEach(k => { m[k] *= g; v[k] = (VARK[k] || 1) * m[k]; }); ctx.boost = { m, v, adds: n }; } } }
    const oppMax = lineup(ctx, ctx.opp.map(full), 'max');
    const oppList = opts.oppMode === 'set' ? ctx.setOpp : oppMax;
    const asSet = evalList(ctx, ctx.setMine, ctx.setOpp);
    const asSetVsMax = evalList(ctx, ctx.setMine, oppMax);
    const baseRoster = ctx.mine.map(full);
    let opt = optimise(ctx, baseRoster, oppList, 3);
    if (ctx.punt.length) { ctx.puntBase = {}; ctx.punt.forEach(c => ctx.puntBase[c] = opt.cp[c].p); const np = noPunt(ctx, opt.cp); opt = Object.assign({}, opt, { Wnp: np }); }
    // ---------- beyond-this-week value (win-chance points per future week) ----------
    const firstOpen = ctx.open.indexOf(true); const moves = []; let roster = baseRoster, best = opt;
    const H = opts.lookAhead == null ? 4 : opts.lookAhead; let Heff = 0; for (let h = 1; h <= H; h++) Heff += Math.pow(0.9, h);
    // typical lineups for scaling: as set on Yahoo/BBM, or (a week nobody has set yet) the best lineups
    const Aset = agg(ctx.setMine.length >= 5 ? ctx.setMine : opt.list), Bset = agg(ctx.setOpp.length >= 5 ? ctx.setOpp : oppList);
    const half = {}; ctx.cats.forEach(c => half[c] = { p: 0.5 }); const L0 = leverage(ctx, half)[ctx.cats[0]];
    const sdW = {}; ctx.cats.forEach(c => sdW[c] = catSd(Aset, Bset, c) * (ctx.scale[c] || 1));
    const topMine = ctx.mine.slice().sort((a, b) => (b.sv || -9) - (a.sv || -9)).slice(0, 10);
    const T = {}; ctx.cats.forEach(c => T[c] = topMine.reduce((t, pl) => t + ((pl.catV || {})[c] || 0), 0));
    const wfit = {}; ctx.cats.forEach(c => wfit[c] = opts.leagueFit && opts.leagueFit.w[c] != null ? opts.leagueFit.w[c] : Math.exp(-0.5 * Math.pow(T[c] / 4.5, 2)));
    (opts.punt || []).forEach(c => { if (wfit[c] != null) wfit[c] = 0.05; }); const wm = ctx.cats.reduce((t, c) => t + wfit[c], 0) / ctx.cats.length; ctx.cats.forEach(c => wfit[c] /= (wm || 1));
    const bar = (pl, re) => (pl.bars || []).find(b => re.test(b.t));
    const health = pl => { const b = bar(pl, /^Josh Projections$/) || bar(pl, /Projections/); return b && b.g ? Math.min(1, Math.max(0.2, b.g / 80)) : 0.85; };
    const fwCache = new Map();
    // injured-now players have zero projections this week; value their future from BBM season value instead
    const isOut = pl => { const g = (pl.games || []).filter(Boolean); return g.length > 0 && g.every(x => x.zero); };
    let regA = 0, regB = 0;
    const fwk = pl => { if (fwCache.has(pl)) return fwCache.get(pl); const st = pl._gs || (pl._gs = gameStats(pl)); let v = 0;
      ctx.cats.forEach(c => { let d; if (RATIO[c]) { const [mk, ak] = RATIO[c]; const pt = Aset.m[ak] ? Aset.m[mk] / Aset.m[ak] : 0.47; d = (st[mk] - pt * st[ak]) / (Aset.m[ak] || 300); } else d = c === 'to' ? -st.to : st[c]; v += wfit[c] * L0 * phi(0) * d / (sdW[c] || 1); });
      let out = 3.4 * health(pl) * v; if (isOut(pl) && pl.sv != null && regB) out = Math.max(out, regA + regB * pl.sv); fwCache.set(pl, out); return out; };
    { const pts = ctx.mine.concat(ctx.fas, ctx.opp).filter(pl => !isOut(pl) && pl.sv != null); const xs = pts.map(pl => pl.sv), ys = pts.map(pl => { const st = pl._gs || (pl._gs = gameStats(pl)); let v = 0; ctx.cats.forEach(c => { let d; if (RATIO[c]) { const [mk, ak] = RATIO[c]; const pt = Aset.m[ak] ? Aset.m[mk] / Aset.m[ak] : 0.47; d = (st[mk] - pt * st[ak]) / (Aset.m[ak] || 300); } else d = c === 'to' ? -st.to : st[c]; v += wfit[c] * L0 * phi(0) * d / (sdW[c] || 1); }); return 3.4 * health(pl) * v; });
      const n = xs.length; if (n > 10) { const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) * (x - mx); }); regB = sxx ? sxy / sxx : 0; regA = my - regB * mx; } }
    // real NBA schedule for the weeks after this one (falls back to 3.4 games a week)
    const SCH = opts.sched && opts.sched.by; const addD = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const gamesIn = (team, a, b) => { const L = SCH && SCH[tc(team) === 'NOP' ? 'NOR' : tc(team) === 'PHX' ? 'PHO' : tc(team)] || (SCH && SCH[team]); if (!L) return null; let n = 0; for (const d of L) { if (d > b) break; if (d >= a) n++; } return n; };
    const wks = []; for (let h = 1; h <= H; h++) { const a = addD(model.start, 7 * h); wks.push({ a, b: addD(a, 6), w: Math.pow(0.9, h) }); }
    const NOTE_W = 0; // analyst comments never change a player's value (their tags are shown as they are)
    const noteAdj = pl => { const nv = noteView(pl); return nv ? NOTE_W * nv.s * Math.abs(fwk(pl) / 3.4) : 0; };
    // value per game played: Basketball Monster's projection (which already takes in this season's games) and its projected
    // availability, nothing else. No recent-form adjustment and no reading of analyst comments: hot and cold streaks only count
    // once BBM moves its own projection.
    const pgv = pl => fwk(pl) / 3.4 + noteAdj(pl);
    const seasonOut = pl => (pl.notes || []).some(n => (n.age == null || n.age < 30 * 24) && (/OUT FOR SEASON/i.test(n.status || '') || /\bout for (the )?season\b|season[- ]ending|torn (his )?(achilles|acl)\b/i.test(n.text || '')));
    const fwH = pl => seasonOut(pl) ? 0 : wks.reduce((t, w) => { const g = gamesIn(pl.team, w.a, w.b); return t + w.w * (g == null ? 3.4 * 1 : g) * pgv(pl); }, 0);
    const fwH1 = pl => { if (!wks.length) return 0; const g = gamesIn(pl.team, wks[0].a, wks[0].b); return wks[0].w * (g == null ? 3.4 : g) * pgv(pl); };
    const avgG = pl => { if (!wks.length) return 3.4; const gs = wks.map(w => gamesIn(pl.team, w.a, w.b)); return gs.every(g => g == null) ? 3.4 : gs.reduce((t, g) => t + (g == null ? 3.4 : g), 0) / gs.length; };
    const fwkS = pl => seasonOut(pl) ? 0 : avgG(pl) * pgv(pl); // typical week after this one, on the real schedule
    const PO = opts.playoffs; const poGames = pl => PO ? gamesIn(pl.team, PO.start, PO.end) : null;
    // ---- rest-of-season value: what every drop is judged on ----
    // The games his team plays from next week to the end of your playoffs, counting only the games Basketball Monster expects him
    // to play (its rest-of-season projection already allows for injuries), times his value per game for your build. An injured
    // player is taken to miss his next games and then play the rest: the weeks he's out count as nothing, nothing more is taken off.
    const RO = opts.ros || {}; const SEND = (PO && PO.end) || opts.seasonEnd || null; const sFrom = addD(model.start, 7);
    const vPer = st => { let v = 0; ctx.cats.forEach(c => { let d; if (RATIO[c]) { const [mk, ak] = RATIO[c]; const pt = Aset.m[ak] ? Aset.m[mk] / Aset.m[ak] : 0.47; d = ((st[mk] || 0) - pt * (st[ak] || 0)) / (Aset.m[ak] || 300); } else d = c === 'to' ? -(st.to || 0) : (st[c] || 0); v += wfit[c] * L0 * phi(0) * d / (sdW[c] || 1); }); return v; };
    const schedOf = team => { const L = SCH && (SCH[tc(team) === 'NOP' ? 'NOR' : tc(team) === 'PHX' ? 'PHO' : tc(team)] || SCH[team]); return L || null; };
    const SI = new Map();
    const seasonInfo = pl => { if (SI.has(pl)) return SI.get(pl); const r = pl.ros || RO[key(pl.name)] || null; const L = schedOf(pl.team);
      const n = SEND && L ? L.filter(d => d >= sFrom && d <= SEND).length : null; // his team's games after this week
      const thisWk = (pl.games || []).filter(g => g && !g.zero).length;
      let gp = r && r.g != null ? Math.max(0, r.g - thisWk) : null; if (gp != null && n != null) gp = Math.min(gp, n); if (gp == null && n != null) gp = n * health(pl);
      const per = r && r.st && Object.keys(r.st).length ? vPer(r.st) : pgv(pl) / (health(pl) || 1);
      const miss = n != null && gp != null ? Math.max(0, n - gp) : 0; const out = isOut(pl) || /^(O|OUT|INJ)$/i.test(String(pl.inj || '').trim());
      const ret = out && L && miss >= 1 ? (L.filter(d => d >= sFrom && (!SEND || d <= SEND))[Math.round(miss)] || null) : null;
      const done = seasonOut(pl) || (out && gp != null && gp < 1) || (out && PO && PO.start && ret && ret >= PO.start);
      const o = { val: seasonOut(pl) ? 0 : (gp == null ? fwkS(pl) * 10 : gp * per), gp, n, ret, done: !!done, out, per, rank: pl.sr || pl.rank || null }; SI.set(pl, o); return o; };
    const sVal = pl => seasonInfo(pl).val;
    const fut = R => R.filter(r => r.to === ctx.nd - 1).reduce((t, r) => t + fwH(r.pl), 0);
    const fut1 = R => R.filter(r => r.to === ctx.nd - 1).reduce((t, r) => t + fwH1(r.pl), 0);
    const fwCats = pl => { const st = pl._gs || (pl._gs = gameStats(pl)); const o = {}; ctx.cats.forEach(c => { let d; if (RATIO[c]) { const [mk, ak] = RATIO[c]; const pt = Aset.m[ak] ? Aset.m[mk] / Aset.m[ak] : 0.47; d = (st[mk] - pt * st[ak]) / (Aset.m[ak] || 300); } else d = c === 'to' ? -st.to : st[c]; o[c] = 3.4 * health(pl) * phi(0) * d / (sdW[c] || 1); }); return o; };
    const catDiff = (a, b) => ctx.cats.map(c => ({ c: LBL[c], d: a[c] - b[c] }));
    const form = pl => { const s = bar(pl, /^Josh Projections$/), w3 = bar(pl, /\(3 Weeks\)/), m2 = bar(pl, /\(2 Months\)/); const f = (w3 && w3.g >= 4) ? w3 : (m2 && m2.g >= 6 ? m2 : null); if (!s || !f || s.v == null || f.v == null) return null; return { d: +(f.v - s.v).toFixed(2), win: f.t.replace(/^NBA\s*/, ''), g: f.g }; };
    const horizon = pl => ({ tags: (pl.notes || []).filter(n => n && n.tag), po: poGames(pl), out: isOut(pl), fw: +fwkS(pl).toFixed(4), sr: pl.sr || null, sv: pl.sv, health: +health(pl).toFixed(2), form: form(pl), next: (pl.cv || {})['Next Week'] != null ? pl.cv['Next Week'] : null, playoffs: (pl.cv || {})['Fantasy Playoffs'] != null ? pl.cv['Fantasy Playoffs'] : null, short: (pl.cv || {})['Short-Term'] != null ? pl.cv['Short-Term'] : null, wk: pl.games.filter((g, d) => g && d >= Math.max(0, firstOpen) && !g.zero).length, note: noteView(pl), seasonOut: seasonOut(pl) });
    // next week's real matchup (if that Matchup Monster week has been opened)
    let NX = null;
    if (opts.next && opts.next.players && H > 0) {
      const c2 = build(opts.next, Object.assign({}, opts, { today: null, oppMode: 'max' }));
      const byK = new Map(); c2.model.players.forEach(pl => { const k = key(pl.name); if (!byK.has(k) || pl.type !== 'fa') byK.set(k, Object.assign({}, pl)); });
      const oppN = lineup(c2, c2.opp.map(pl => ({ pl, from: 0, to: c2.nd - 1 })), 'max');
      const memo = new Map();
      const evalNames = names => { const sig = names.slice().sort().join('|'); if (memo.has(sig)) return memo.get(sig); const R = []; let miss = 0;
        names.forEach(n => { const pl = c2.mine.find(x => key(x.name) === n) || byK.get(n); if (pl) R.push({ pl, from: 0, to: c2.nd - 1 }); else miss++; });
        const W = optimise(c2, R, oppN, 2).W; const out = { W, miss }; memo.set(sig, out); return out; };
      const baseN = evalNames(ctx.mine.map(pl => key(pl.name)));
      NX = { opp: c2.oppName, start: opts.next.start, end: opts.next.end, ts: opts.next.ts, base: baseN.W,
        delta: R => { const r = evalNames(R.filter(x => x.to === ctx.nd - 1).map(x => key(x.pl.name))); return r.miss ? null : r.W - baseN.W; },
        games: name => { const pl = byK.get(key(name)); return pl ? pl.games.filter(g => g && !g.zero).length : null; } };
    }
    // add/drop planner: score = this-week gain + next week (real matchup if loaded) + discounted typical weeks
    const adds = Math.max(0, opts.addsLeft == null ? 2 : opts.addsLeft);
    const dropRank = opts.dropRank || (ctx.cats.length === 11 ? 100 : 120); const seasonTol = opts.seasonTol == null ? 0.3 : opts.seasonTol; const protect = new Set((opts.protect || []).concat(opts.recentAdds || []).map(key)); const allow = new Set((opts.allowDrop || []).map(key));
    const blocked = new Set((opts.exclude || []).concat(opts.recentDrops || []).map(key));
    const seenFA = new Set(); const fas = ctx.fas.filter(f => { const k = key(f.name); if (seenFA.has(k)) return false; seenFA.add(k); return firstOpen >= 0 && !blocked.has(k) && !seasonOut(f); });
    const R0 = opts.rules || {}; let ilFree = Math.max(0, (R0.ilSlots || 0) - (R0.ilUsed || 0)); const ilOK = new Set((R0.ilEligible || []).map(key));
    const waitTill = {}; Object.entries(R0.waiverUntil || {}).forEach(([k, d]) => waitTill[key(k)] = d);
    const dayOK = (f, d) => !waitTill[key(f.name)] || (model.days[d] && model.days[d].date >= waitTill[key(f.name)]);
    // a drop candidate is anyone a free agent beats on the same measure (this week plus the weeks after); no rank cut-off
    const canDrop = r => r.to === ctx.nd - 1 && !protect.has(key(r.pl.name)) && !r.added && r.pl.type !== 'ir' && !ctx.ilSlot.has(key(r.pl.name));
    // a pickup may cost a little over the season if it wins now, but no more than this (about 0.3 categories across the season)
    const seasonCost = (f, k) => sVal(k) - sVal(f); const SEASON_TOL = 3 * (opts.minGain || 0.03) * ctx.unit;
    const gamesFrom = (pl, d) => pl.games.filter((g, i) => g && i >= d && !g.zero).length;
    // the reason for a drop, in facts: where he sits on your roster over the rest of the season, his projected games, his return
    const dropWhy = (pl, f) => { const si = seasonInfo(pl), fi = seasonInfo(f); const mine = roster.filter(r => r.to === ctx.nd - 1 && r.pl.type !== 'ir' && !ctx.ilSlot.has(key(r.pl.name)) && !r.added).map(r => r.pl).sort((a, b) => sVal(a) - sVal(b));
      const pos = mine.indexOf(pl); const N = (opts.rostered || 0); return { order: pos >= 0 ? pos + 1 : null, of: mine.length, gp: si.gp != null ? Math.round(si.gp) : null, n: si.n, ret: si.ret, out: si.out, rank: si.rank,
        addGp: fi.gp != null ? Math.round(fi.gp) : null, seasonGain: +(sVal(f) - sVal(pl)).toFixed(3), claim: !!(N && si.rank && si.rank <= N / 2) }; };
    const verdictOf = (fw, nx) => fw >= 0.01 ? 'long' : (fw >= -0.002 || (nx != null && nx >= 0.01)) ? 'few' : 'week';
    const injNow = pl => { const g = pl.games.filter(Boolean); return g.length > 0 && g.every(x => x.zero); };
    const pickAt = opts.pickAdds && !Array.isArray(opts.pickAdds) ? opts.pickAdds : {}; const force = opts.forceDrop || {}; const minGain = (opts.minGain || 0.03) * ctx.unit; // pickAdds: {step: player key} chosen among the options shown for that pickup
    // a swap that only helps this week must be clearly worth the add
    const swapMin = opts.swapMin == null ? 0.05 : opts.swapMin; const okMove = c => c.il || !(fwkS(c.f) - fwkS(c.k.pl) < -0.004 && c.week < swapMin); // a worse long-term player only for a clear gain this week
    const roster0 = roster, best0 = best; // the roster and lineup as they stand, before any planned pickup (streams start from here)
    for (let step = 0; step < adds && firstOpen >= 0; step++) {
      // (tried from the lowest long-term value up; the 8 lowest are enough, a free agent doesn't beat the top of your roster)
      const droppable = roster.filter(canDrop).sort((a, b) => sVal(a.pl) - sVal(b.pl)).filter((r, i) => i < 8 || allow.has(key(r.pl.name)));
      const futNow = fut(roster), fut1Now = fut1(roster);
      const B0 = agg(oppList), A0 = agg(best.list), cp0 = catProbs(ctx, A0, B0), w0 = statWeights(ctx, A0, B0, cp0);
      // shortlist: best overall (this week + later weeks), plus the best streamers for this week alone. The weights come from the
      // live score, so mid-week a player who helps a category you're narrowly losing rises to the top even if he's no long-term keeper.
      const scored = fas.filter(f => !roster.some(r => r.pl === f)).map(f => { let mv = 0; f.games.forEach((g, d) => { if (g && d >= firstOpen && !g.zero) mv += Math.max(0, gameMV(w0, f)); }); return { f, mv, s: mv + fwH(f) }; });
      const pre = scored.slice().sort((a, b) => b.s - a.s).slice(0, opts.faDepth || 30); scored.slice().sort((a, b) => b.mv - a.mv).slice(0, 12).forEach(x => { if (!pre.includes(x)) pre.push(x); });
      // make sure a pickup you chose is evaluated even if it falls outside the shortlist
      fas.filter(f => pickAt[step] && key(f.name) === key(pickAt[step]) && !roster.some(r => r.pl === f) && !pre.some(x => x.f === f)).forEach(f => pre.push({ f, s: 0 }));
      const bestByF = new Map(); const keep = c => { const kk = key(c.f.name); const pv = bestByF.get(kk); if (!pv || c.score > pv.score) bestByF.set(kk, c); };
      const evalSwap = (f, k, d) => { const R = roster.filter(r => r !== k).concat([{ pl: k.pl, from: k.from, to: d - 1, dropped: true }, { pl: f, from: d, to: ctx.nd - 1, added: true }]);
        const o = optimise(ctx, R, oppList, 2); const fd = fut(R) - futNow; const nx = NX ? NX.delta(R) : null; const later = nx != null ? 0.9 * nx + (fd - (fut1(R) - fut1Now)) : fd;
        return { o, R, f, k, d, score: (o.Wnp - best.Wnp) + later, week: o.Wnp - best.Wnp, later, nx }; };
      for (const { f } of pre) {
        const fk = force[key(f.name)];
        const fkRow0 = k => k && roster.some(r => r.to === ctx.nd - 1 && !r.added && key(r.pl.name) === k);
        let days = []; f.games.forEach((g, d) => { if (g && d >= firstOpen && !g.zero && dayOK(f, d)) days.push(d); }); if (!days.length) { const d0 = model.days.findIndex((x, d) => d >= firstOpen && dayOK(f, d)); if (d0 < 0) continue; days = [d0]; }
        // IL move: an injured player goes to an open IL slot, so the add needs no drop
        if (ilFree > 0 && !fkRow0(fk)) roster.filter(r => r.to === ctx.nd - 1 && !r.added && ilOK.has(key(r.pl.name))).forEach(k => { const d = days[0];
          const R = roster.filter(r => r !== k).concat([{ pl: k.pl, from: k.from, to: d - 1, il: true }, { pl: f, from: d, to: ctx.nd - 1, added: true }]);
          const o = optimise(ctx, R, oppList, 2); const weak = R.filter(r => r.to === ctx.nd - 1 && !r.added && !protect.has(key(r.pl.name))).sort((a, b) => fwH(a.pl) - fwH(b.pl))[0];
          const later = 0.75 * (fwH(f) - (weak ? fwH(weak.pl) : 0)) + 0.25 * fwH(f); keep({ o, R, f, k, d, score: (o.Wnp - best.Wnp) + later, week: o.Wnp - best.Wnp, later, nx: null, il: true }); });
        // a drop you chose is always allowed, even outside the usual drop pool
        const fkRow = fk ? roster.filter(r => r.to === ctx.nd - 1 && !r.added && key(r.pl.name) === fk) : []; const drops = fkRow.length ? fkRow : droppable; // a stale choice (player gone) falls back to the usual pool
        for (const k of drops) for (const d of days) {
          if (k.from > d) continue;
          if (!fkRow.length && !allow.has(key(k.pl.name)) && seasonCost(f, k.pl) > SEASON_TOL) continue; // the replacement has to hold up over the rest of the season
          keep(evalSwap(f, k, d));
        }
      }
      const ranked = [...bestByF.values()].filter(okMove).sort((a, b) => b.score - a.score);
      const lead = ranked[0]; const picked = pickAt[step] ? ranked.find(c => key(c.f.name) === key(pickAt[step])) : null;
      const top = picked && picked.score > 0 ? picked : lead;
      if (!top || (top !== picked && top.score < minGain)) break;
      // other pickups worth considering: up to 4 more that are each worth making (the best one is always offered if you picked another)
      const alts = ranked.filter(c => c !== top && (c === lead || c.score >= minGain)).slice(0, 4).map(c => ({ add: c.f.name, addTeam: c.f.team, addPos: c.f.pos, il: c.il ? c.k.pl.name : null, drop: c.il ? null : c.k.pl.name,
        date: model.days[c.d].date, label: model.days[c.d].label, week: c.week, futWk: c.il ? fwkS(c.f) : fwkS(c.f) - fwkS(c.k.pl), score: c.score, verdict: c.il ? 'long' : verdictOf(fwkS(c.f) - fwkS(c.k.pl), c.nx), games: gamesFrom(c.f, c.d), dropGames: c.il ? null : gamesFrom(c.k.pl, c.d), note: noteView(c.f), best: c === lead }));
      const catWeekOf = o => ctx.cats.map(c => ({ c: LBL[c], from: best.cp[c].p, to: o.cp[c].p }));
      if (top.il) { ilFree--;
        moves.push({ type: 'il', il: top.k.pl.name, dropOpts: [], alts, score: top.score, picked: top === picked, catWeek: catWeekOf(top.o), catLater: catDiff(fwCats(top.f), Object.fromEntries(ctx.cats.map(c => [c, 0]))), add: top.f.name, addTeam: top.f.team, addPos: top.f.pos, drop: null, day: top.d, date: model.days[top.d].date, label: model.days[top.d].label, from: best.W, to: top.o.W, week: top.o.W - best.W, futWk: fwkS(top.f), later: top.later, score: top.score, cats: [], verdict: 'long', games: gamesFrom(top.f, top.d), hAdd: horizon(top.f), next: null });
        roster = top.R; best = top.o; continue; }
      const cats = ctx.cats.map(c => ({ c, d: top.o.cp[c].p - best.cp[c].p })).filter(x => Math.abs(x.d) >= 0.03).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 4).map(x => (x.d > 0 ? '+' : '−') + LBL[x.c]);
      const futWk = fwkS(top.f) - fwkS(top.k.pl);
      // two drop options for this pickup, each with its own effect, so switching between them is instant
      const optOf = c => ({ name: c.k.pl.name, score: c.score, week: c.week, futWk: fwkS(top.f) - fwkS(c.k.pl), day: c.d, date: model.days[c.d].date, label: model.days[c.d].label, injured: injNow(c.k.pl), rank: c.k.pl.sr || c.k.pl.rank, games: gamesFrom(c.k.pl, c.d), addGames: gamesFrom(top.f, c.d),
        catWeek: catWeekOf(c.o), catLater: catDiff(fwCats(top.f), fwCats(c.k.pl)), verdict: verdictOf(fwkS(top.f) - fwkS(c.k.pl), c.nx), next: c.nx, note: noteView(c.k.pl), why: dropWhy(c.k.pl, top.f) });
      const pool = roster.filter(r => canDrop(r) && r !== top.k && seasonCost(top.f, r.pl) <= SEASON_TOL).sort((a, b) => sVal(a.pl) - sVal(b.pl)).slice(0, 6);
      const others = pool.map(k => { let b2 = null; let dl = []; top.f.games.forEach((g, d) => { if (g && d >= firstOpen && !g.zero && dayOK(top.f, d)) dl.push(d); }); if (!dl.length) dl = [top.d];
        dl.forEach(d => { if (k.from > d) return; const c = evalSwap(top.f, k, d); if (!b2 || c.score > b2.score) b2 = c; }); return b2; }).filter(Boolean).sort((a, b) => b.score - a.score);
      const dropOpts = [optOf(top)].concat(others.filter(c => c.score >= minGain).slice(0, 1).map(optOf)).sort((a, b) => b.score - a.score);
      moves.push({ dropOpts, alts, score: top.score, picked: top === picked, catWeek: catWeekOf(top.o), catLater: catDiff(fwCats(top.f), fwCats(top.k.pl)), forced: !!force[key(top.f.name)], add: top.f.name, addTeam: top.f.team, addPos: top.f.pos, drop: top.k.pl.name, day: top.d, date: model.days[top.d].date, label: model.days[top.d].label, from: best.W, to: top.o.W, week: top.o.W - best.W, futWk, later: top.later, score: top.score, cats,
        verdict: verdictOf(futWk, top.nx), season: +(((top.f.sv != null ? top.f.sv : top.f.leagV || 0) - (top.k.pl.sv != null ? top.k.pl.sv : top.k.pl.leagV || 0))).toFixed(2),
        addRank: top.f.sr || top.f.rank, dropRank: top.k.pl.sr || top.k.pl.rank, games: gamesFrom(top.f, top.d), dropGames: gamesFrom(top.k.pl, top.d), hAdd: horizon(top.f), hDrop: horizon(top.k.pl), next: top.nx, nextGames: NX ? [NX.games(top.f.name), NX.games(top.k.pl.name)] : null });
      roster = top.R; best = top.o;
    }
    // ---------- streams: this week only, for the categories still in play ----------
    // A category is in play when it's in the swing band (the same cut-offs as the strategy: 15% to 75% by default) for this
    // week's matchup. A stream is credited only for what it adds in play; whatever it costs in other categories counts against it.
    // Drops come from your three least valuable players for the rest of the season, plus anyone Yahoo managers are dropping in
    // numbers (unless he's in the top half of your roster). What a drop costs later (up to four weeks, as the planner counts it) is
    // taken off. A stream is only suggested when what's left is worth at least 0.15 categories this week.
    let streams = null;
    if (opts.streams) { const SO = opts.streams; const ncat = ctx.cats.length; const catsOf = v => ctx.obj === 'cats' ? v * ncat : v / (ctx.Lw || 0.27);
      const punted = c => (ctx.punt || []).includes(c); const pat = SO.pattern || {}; const MIN = SO.min == null ? 0.15 : SO.min;
      const pOf = c => best0.cp[c].p;
      const BL = Object.assign({ dead: 0.15, safe: 0.75 }, SO.bands || {}); // the strategy's swing band, one definition everywhere
      const inPlay = ctx.cats.filter(c => !punted(c) && pOf(c) >= BL.dead && pOf(c) < BL.safe);
      const banked = ctx.cats.filter(c => !punted(c) && !inPlay.includes(c) && pOf(c) >= 0.5), gone = ctx.cats.filter(c => !punted(c) && !inPlay.includes(c) && pOf(c) < 0.5);
      const list = []; let R = roster0, B = best0; const usedAdd = new Set(), usedDrop = new Set(); let considered = 0;
      const cap = Math.max(0, SO.cap || 0);
      const full = R.filter(r => r.to === ctx.nd - 1 && !r.added && !protect.has(key(r.pl.name)) && r.pl.type !== 'ir' && !ctx.ilSlot.has(key(r.pl.name)) && !seasonInfo(r.pl).out).sort((a, b) => sVal(a.pl) - sVal(b.pl));
      const trend = {}; Object.entries(SO.trendDrop || {}).forEach(([n, v]) => { trend[key(n)] = v; }); const half = Math.ceil(full.length / 2);
      const pool0 = full.filter((r, i) => i < 3 || (trend[key(r.pl.name)] && i < half));
      for (let step = 0; step < cap && inPlay.length && firstOpen >= 0; step++) {
        const A0 = agg(B.list), B0 = agg(oppList), cp0 = catProbs(ctx, A0, B0), w0 = statWeights(ctx, A0, B0, cp0);
        const pre = fas.filter(f => !R.some(r => r.pl === f) && !usedAdd.has(key(f.name))).map(f => { let mv = 0, g = 0; f.games.forEach((x, d) => { if (x && d >= firstOpen && !x.zero && dayOK(f, d)) { mv += Math.max(0, gameMV(w0, f)); g++; } }); return { f, mv, g }; }).filter(x => x.g > 0).sort((a, b) => b.mv - a.mv).slice(0, 15);
        const pool = pool0.filter(k => R.includes(k) && !usedDrop.has(key(k.pl.name)));
        let top = null;
        for (const { f } of pre) { const d = f.games.findIndex((x, i) => x && i >= firstOpen && !x.zero && dayOK(f, i)); if (d < 0) continue;
          for (const k of pool) { if (k.from > d) continue; considered++;
            const R2 = R.filter(r => r !== k).concat([{ pl: k.pl, from: k.from, to: d - 1, dropped: true }, { pl: f, from: d, to: ctx.nd - 1, added: true }]);
            const o = optimise(ctx, R2, oppList, 2);
            const dc = ctx.cats.map(c => ({ c, d: o.cp[c].p - B.cp[c].p }));
            const gain = dc.reduce((t, x) => t + (punted(x.c) ? 0 : inPlay.includes(x.c) ? x.d : Math.min(0, x.d)), 0);
            const cost = Math.max(0, catsOf((fwkS(k.pl) - fwkS(f)) * Heff));
            const net = gain - cost;
            if (!top || net > top.net) top = { f, k, d, o, R2, gain, cost, net, dc }; } }
        if (!top || top.gain < MIN || top.net < MIN) break;
        list.push({ add: top.f.name, addTeam: top.f.team, addPos: top.f.pos, drop: top.k.pl.name, date: model.days[top.d].date, label: model.days[top.d].label, games: gamesFrom(top.f, top.d), dropGames: gamesFrom(top.k.pl, top.d),
          gain: +top.gain.toFixed(3), cost: +top.cost.toFixed(3), net: +top.net.toFixed(3), cats: top.dc.filter(x => Math.abs(x.d) >= 0.01 && !punted(x.c)).sort((a, b) => b.d - a.d).map(x => ({ c: LBL[x.c], d: +x.d.toFixed(3), from: +B.cp[x.c].p.toFixed(3), inPlay: inPlay.includes(x.c) })),
          trendDrop: trend[key(top.k.pl.name)] || null, note: noteView(top.f) });
        usedAdd.add(key(top.f.name)); usedDrop.add(key(top.k.pl.name)); R = top.R2; B = top.o; }
      streams = { bands: BL, inPlay: inPlay.map(c => LBL[c]), banked: banked.map(c => LBL[c]), gone: gone.map(c => LBL[c]), probs: Object.fromEntries(ctx.cats.map(c => [LBL[c], +pOf(c).toFixed(3)])), cap, list, considered, pool: pool0.map(k => k.pl.name),
        reason: !cap ? 'adds' : !inPlay.length ? 'none-in-play' : !list.length ? 'below-bar' : null, min: MIN }; }
    // best holds beyond this week (regardless of this week's games)
    const injuredNow = pl => { const g = pl.games.filter(Boolean); return g.length > 0 && g.every(x => x.zero); };
    const endDrops = roster.filter(r => r.to === ctx.nd - 1 && !protect.has(key(r.pl.name)) && !r.added && !injuredNow(r.pl)); const worst = endDrops.filter(r => r.pl.type !== 'ir' && !ctx.ilSlot.has(key(r.pl.name))).slice().sort((a, b) => sVal(a.pl) - sVal(b.pl))[0];
    const holds = worst ? fas.filter(f => !roster.some(r => r.pl === f) && !f._gone).map(f => ({ f, g: (isOut(f) && ilFree > 0) ? fwkS(f) : fwkS(f) - fwkS(worst.pl) })).filter(x => x.g >= -0.005).sort((a, b) => b.g - a.g).slice(0, 6)
      .map(x => ({ name: x.f.name, team: x.f.team, pos: x.f.pos, perWk: x.g, drop: worst.pl.name, stash: isOut(x.f) && ilFree > 0, h: horizon(x.f), catLater: catDiff(fwCats(x.f), fwCats(worst.pl)) })) : [];
    // every player on your roster now, worth per typical week from here (what a returning injured player is weighed against)
    const rosVal = roster0.map(r => { const si = seasonInfo(r.pl); return { name: r.pl.name, perWk: +fwkS(r.pl).toFixed(4), season: +si.val.toFixed(3), gp: si.gp != null ? Math.round(si.gp) : null, ret: si.ret, done: si.done, out: injuredNow(r.pl), il: r.pl.type === 'ir', keep: protect.has(key(r.pl.name)) }; }).sort((a, b) => a.season - b.season);
    let test = null;
    if (opts.test && opts.test.add && opts.test.drop) {
      const f = P_find(ctx, opts.test.add), k = roster.find(r => key(r.pl.name) === key(opts.test.drop) && r.to === ctx.nd - 1);
      if (f && k) { let dd = f.games.findIndex((g, d) => g && d >= Math.max(0, firstOpen) && !g.zero); if (dd < 0) dd = Math.max(0, firstOpen);
        const R = roster.filter(r => r !== k).concat([{ pl: k.pl, from: k.from, to: dd - 1, dropped: true }, { pl: f, from: dd, to: ctx.nd - 1, added: true }]);
        const o = optimise(ctx, R, oppList, 2); const nx = NX ? NX.delta(R) : null;
        test = { add: f.name, drop: k.pl.name, day: model.days[dd].label, week: o.W - best.W, next: nx, futWk: fwkS(f) - fwkS(k.pl), W: o.W, catWeek: ctx.cats.map(c => ({ c: LBL[c], from: best.cp[c].p, to: o.cp[c].p })), catLater: catDiff(fwCats(f), fwCats(k.pl)) };
      } else test = { err: !f ? 'Player not found among free agents on Matchup Monster' : 'That player is not on your roster' };
    }
    // stick with the lineup already set on Yahoo when the plan's alternative is worth less than ~0.4% win chance:
    // the advice doesn't flip back and forth on tiny changes, and it only ever asks for changes that matter
    { const TOL = (opts.stickTol == null ? 0.004 : opts.stickTol) * ctx.unit; let cur = best.list, curW = best.W, changed = false;
      const setOn = d => { const date = model.days[d] && model.days[d].date; const A = opts.actual && opts.actual[date];
        const pool = roster.filter(r => d >= r.from && d <= r.to && r.pl.games[d] && !r.pl.games[d].zero && r.pl.type !== 'ir').map(r => r.pl);
        if (A) { const ks = new Set(A.map(key)); return pool.filter(pl => ks.has(key(pl.name))); }
        const S = ctx.setMine.filter(x => x.g.day === d).map(x => x.pl); return S.length ? pool.filter(pl => S.includes(pl)) : null; };
      for (let d = 0; d < ctx.nd; d++) { if (!ctx.open[d]) continue; const act = setOn(d); if (!act) continue;
        const planned = cur.filter(x => x.g.day === d); if (act.length < planned.length || !canFit(act, ctx.slots, ctx.eligOf)) continue; // Yahoo leaves a spot empty: always change
        if (act.length === planned.length && act.every(pl => planned.some(x => x.pl === pl))) continue;
        const cand = cur.filter(x => x.g.day !== d).concat(act.map(pl => ({ pl, g: pl.games[d] }))); const e = evalList(ctx, cand, oppList);
        if (e.W >= best.W - TOL) { cur = cand; curW = e.W; changed = true; } } // the total cost of keeping Yahoo's lineup stays within the tolerance
      if (changed) { const e = evalList(ctx, cur, oppList); best = Object.assign({}, best, { list: cur, W: e.W, cp: e.cp }); } }
    // ratio protection: on the last two days of the week, once every counting category is decided, sit a player whose
    // shooting or turnovers would put a close FG% / FT% / TO at risk, but only if that's worth at least 0.2 categories
    const sitFor = {}; { const RC = ctx.cats.filter(c => RATIO[c] || c === 'to');
      if (RC.length && opts.ratioProtect !== false) { let e = evalList(ctx, best.list, oppList); const thr = ctx.obj === 'cats' ? 0.2 / ctx.cats.length : 0.2 * ctx.Lw; // 0.2 categories, in the objective's own units
        const decided = ctx.cats.filter(c => !RATIO[c] && c !== 'to').every(c => e.cp[c].p < 0.1 || e.cp[c].p > 0.9);
        const days = [...Array(ctx.nd).keys()].filter(d => ctx.open[d] && d >= ctx.nd - 2);
        if (decided && days.length) { let cur = best.list;
          for (const d of days) { const today = cur.filter(x => x.g.day === d).sort((a, b) => gameMV(statWeights(ctx, agg(cur), oppAgg(ctx, oppList), e.cp), a.pl) - gameMV(statWeights(ctx, agg(cur), oppAgg(ctx, oppList), e.cp), b.pl));
            for (const x of today) { const cand = cur.filter(y => y !== x); const e2 = evalList(ctx, cand, oppList);
              if (e2.W - e.W >= thr) { const helped = RC.filter(c => e2.cp[c].p - e.cp[c].p > 0.01).map(c => LBL[c]); sitFor[x.pl.name + '|' + d] = helped.join(', ') || 'percentages'; cur = cand; e = e2; } } }
          if (cur !== best.list) best = Object.assign({}, best, { list: cur, W: e.W, cp: e.cp }); } } }
    // per-day lineup summary vs as-set
    const startedKey = L => { const s = new Set(); L.forEach(x => s.add(x.pl.name + '|' + x.g.day)); return s; };
    const setK = startedKey(ctx.setMine), planK = startedKey(best.list), optK = startedKey(opt.list);
    const days = model.days.map((dd, d) => {
      const pool = roster.filter(r => d >= r.from && d <= r.to && r.pl.games[d]).map(r => r.pl);
      const start = pool.filter(pl => planK.has(pl.name + '|' + d)), bench = pool.filter(pl => !planK.has(pl.name + '|' + d));
      const asg = canFit(start, ctx.slots, ctx.eligOf) || {};
      return { label: dd.label, date: dd.date, open: ctx.open[d], start: start.map(pl => ({ name: pl.name, slot: asg[pl.name], opp: pl.games[d].opp, mv: null })), bench: bench.map(pl => ({ name: pl.name, opp: pl.games[d].opp, zero: pl.games[d].zero || pl.type === 'ir', il: pl.type === 'ir', protect: sitFor[pl.name + '|' + d] || null })), // a player on IL can't start, so he's never 'should sit'
        toStart: start.filter(pl => !setK.has(pl.name + '|' + d)).map(pl => pl.name), toBench: ctx.setMine.filter(x => x.g.day === d && !planK.has(x.pl.name + '|' + d)).map(x => x.pl.name + (roster.some(r => r.pl.name === x.pl.name && d >= r.from && d <= r.to) ? '' : ' (dropped)')) };
    });
    // BBM checkbox targets for my side (includes FA rows of added players)
    const select = {}; const meSide = opts.swap ? 1 : 0;
    model.players.filter(p => p.side === meSide).forEach(p => p.games.forEach((g, d) => { if (g && g.cb && ctx.open[d]) select[g.cb] = planK.has(p.name + '|' + d) && roster.some(r => r.pl.name === p.name && d >= r.from && d <= r.to); }));
    const oppSelect = {}; const oppK = startedKey(oppMax); model.players.filter(p => p.side !== meSide && p.type !== 'fa').forEach(p => p.games.forEach((g, d) => { if (g && g.cb && ctx.open[d]) oppSelect[g.cb] = oppK.has(p.name + '|' + d); }));
    const tag = p => p >= 0.8 ? 'safe' : p <= 0.2 ? 'lost' : p >= 0.4 && p <= 0.6 ? 'toss-up' : p > 0.6 ? 'lean' : 'chase';
    const L = leverage(ctx, best.cp);
    const cats = ctx.cats.map(c => ({ c, label: LBL[c], me: best.cp[c].me, opp: best.cp[c].opp, bbm: model.bbmWin[c] != null ? (opts.swap ? 1 - model.bbmWin[c] : model.bbmWin[c]) : null, set: asSet.cp[c].p, p: best.cp[c].p, tag: tag(best.cp[c].p), lev: L[c] }));
    return { league: model.league, me: ctx.meName, opp: ctx.oppName, start: model.start, end: model.end, need: ctx.need, ncat: ctx.cats.length,
      obj: ctx.obj, Ecats: ctx.cats.reduce((t, c) => t + best.cp[c].p, 0), Wmaj: evalList(ctx, best.list, oppList).Wmaj,
      scale: Object.assign({}, ctx.scaleBase || ctx.scale), calibrated: !!ctx.calibrated, sdMul: opts.sdMul || 1, W: { asSet: asSet.W, asSetVsMax: asSetVsMax.W, lineupOnly: opt.W, plan: best.W }, oppMode: opts.oppMode === 'set' ? 'set' : 'max',
      oppGames: { set: ctx.setOpp.length, max: oppMax.length }, myGames: { set: ctx.setMine.length, plan: best.list.length },
      cats, moves, holds, test, streams, rosVal, ilFree, sched: !!SCH, oppBoost: ctx.boost ? +ctx.boost.adds.toFixed(1) : 0, fitSrc: opts.leagueFit ? 'league' : 'roster', Wind: asSet.Wind, faNames: [...new Set(ctx.fas.map(f => f.name))].sort(), rosterNames: roster.filter(r => r.to === ctx.nd - 1).map(r => r.pl.name), mineNames: ctx.mine.map(p => p.name), recon: ctx.recon, lookAhead: H, nextWeek: NX ? { opp: NX.opp, start: NX.start, end: NX.end, ts: NX.ts } : null, fit: Object.fromEntries(ctx.cats.map(c => [LBL[c], +wfit[c].toFixed(2)])), days, select, oppSelect, slots: ctx.slots, scale: ctx.scale };
  }
  // league-wide category strength -> weights on the categories you can still swing
  function leagueFit(teams, zOf, cats, myTid) {
    const tot = teams.map(t => { const zs = t.players.map(n => zOf(n)).filter(Boolean).sort((a, b) => b.v - a.v).slice(0, 10); const o = { tid: t.tid, n: zs.length }; cats.forEach(c => o[c] = zs.reduce((s, z) => s + (z.z[c] || 0), 0)); return o; }).filter(o => o.n >= 8);
    const me = tot.find(o => String(o.tid) === String(myTid)); if (!me || tot.length < 4) return null;
    const w = {}, rank = {}; cats.forEach(c => { const xs = tot.map(o => o[c]); const mu = xs.reduce((a, b) => a + b, 0) / xs.length; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) * (b - mu), 0) / xs.length) || 1;
      const zme = (me[c] - mu) / sd; w[c] = Math.exp(-0.5 * zme * zme / 1.2); rank[c] = 1 + xs.filter(x => (c === 'to' ? x > me[c] : x > me[c])).length; });
    return { w, rank, teams: tot.length };
  }
  const api = { plan, build, noteScore, noteView, weekWin, weekWinMC, key, LBL, Phi, matchPlayers, leagueFit };
  if (typeof module !== 'undefined') module.exports = api; else root.SEASON = api;
})(typeof window !== 'undefined' ? window : globalThis);
