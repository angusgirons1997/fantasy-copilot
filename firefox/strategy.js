// Team strategy data helpers: Basketball Monster's numbers only, no verdicts.
//  · bands: your projected share of teams beaten in each category (Analysis Monster), cut at your thresholds, set once
//  · analyst tags: read for display only. They judge general fantasy value, not your build, so they never drive anything.
(function (root) {
  const TH0 = { dead: 0.15, safe: 0.75, locked: 0.9 };            // below dead: dead; up to safe: swing; up to locked: safe; above: locked
  // full category names: the panel never shows abbreviations
  const NAME = { p: 'points', 3: '3-pointers', r: 'rebounds', a: 'assists', s: 'steals', b: 'blocks', 'fg%': 'field goal %', 'ft%': 'free throw %', to: 'turnovers', '2d': 'double-doubles', fg: 'field goals made', ft: 'free throws made' };
  const name = c => NAME[c] || c; const Name = c => { const n = name(c); return n.charAt(0).toUpperCase() + n.slice(1); };
  const LONG_INJ_GAMES = 10;
  // NBA team codes in words (Yahoo and Basketball Monster both use codes)
  const TEAMN = { ATL: 'Atlanta', BOS: 'Boston', BKN: 'Brooklyn', BRK: 'Brooklyn', CHA: 'Charlotte', CHO: 'Charlotte', CHI: 'Chicago', CLE: 'Cleveland', DAL: 'Dallas', DEN: 'Denver', DET: 'Detroit', GS: 'Golden State', GSW: 'Golden State', HOU: 'Houston', IND: 'Indiana', LAC: 'LA Clippers', LAL: 'LA Lakers', MEM: 'Memphis', MIA: 'Miami', MIL: 'Milwaukee', MIN: 'Minnesota', NO: 'New Orleans', NOP: 'New Orleans', NY: 'New York', NYK: 'New York', OKC: 'Oklahoma City', ORL: 'Orlando', PHI: 'Philadelphia', PHO: 'Phoenix', PHX: 'Phoenix', POR: 'Portland', SAC: 'Sacramento', SA: 'San Antonio', SAS: 'San Antonio', TOR: 'Toronto', UTA: 'Utah', UTAH: 'Utah', WAS: 'Washington', WSH: 'Washington' };

  // your projected share of teams beaten in each category (BBM's "You vs Team" colours: win 1, tie ½, loss 0)
  function catWin(bs, cats) { if (!bs || !bs.teams) return null; const opp = bs.teams.filter(t => !t.me && t.vcat && Object.keys(t.vcat).length); if (opp.length < 3) return null;
    const out = {}; cats.forEach(c => { const v = opp.map(t => t.vcat[c]).filter(x => x != null); if (v.length) out[c] = v.reduce((a, x) => a + (x > 0 ? 1 : x === 0 ? 0.5 : 0), 0) / v.length; }); return out; }
  function bands(win, cats, punt, th) { th = Object.assign({}, TH0, th || {}); const out = {};
    cats.forEach(c => { const w = win ? win[c] : null; out[c] = (punt || []).includes(c) ? 'punt' : w == null ? 'swing' : w < th.dead ? 'dead' : w < th.safe ? 'swing' : w < th.locked ? 'safe' : 'locked'; }); return out; }

  // the latest analyst tag on a player, word for word (e.g. "Droppable 12 teams"), ignoring ones over a month old. Display only.
  function tagOf(p, maxH) { maxH = maxH || 30 * 24; const n = ((p && p.notes) || []).filter(x => x && x.tag && (x.age == null || x.age <= maxH)).sort((a, b) => (a.age || 0) - (b.age || 0))[0];
    return n ? { tag: n.tag + (n.tagNote ? ' ' + n.tagNote : ''), by: n.by, text: n.text || '', age: n.age } : null; }
  const longInj = p => { const s = String((p && p.inj) || ''); const m = s.match(/INJ\s*(\d+)\s*g/i); return /out for season/i.test(s) || (m && +m[1] >= LONG_INJ_GAMES); };

  // names on other rosters that BBM's list doesn't carry (usually long injuries): shown, never silently skipped
  function missing(names, find) { return (names || []).filter(n => !find(n)); }

  // ---- the bands, set once: the win shares they were cut from and the roster at the time ----
  function snapshot(M, win, punt) { const own = {}; M.L.teams.forEach(t => t.ids.forEach(id => own[id] = t.tid)); const mine = (M.L.teams.find(t => t.tid === M.L.me) || { ids: [] }).ids;
    return { ts: Date.now(), win, punt: (punt || []).slice().sort(), own, mine: mine.slice(), inj: mine.filter(id => longInj(M.P[id])) }; }
  root.STRAT = { NAME, name, Name, TEAMN, TH0, catWin, bands, tagOf, missing, snapshot, longInj };
  if (typeof module !== 'undefined') module.exports = root.STRAT;
})(typeof window !== 'undefined' ? window : globalThis);
