// One rule, used everywhere, for "is this the same NBA player?" across Yahoo, Basketball Monster and Matchup Monster.
// key: accents, dots, apostrophes and Jr/Sr/II/III/IV dropped, known nicknames turned into the full first name (Moe → Moritz).
// same: the same key, or the same surname with one first name the start of the other (Nic/Nicolas, Herb/Herbert), and never
// two different NBA teams when both are known (an exact name still matches across teams: a player traded since one site last read). pick: the one row in a list that is this player, or null when it can't be told.
(function (root) {
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.'’`]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/gi, '').toLowerCase().replace(/\s+/g, ' ').trim();
  // first names that aren't simply the start of the full one (the rest, like Cam/Cameron, are caught by same())
  const NICK = { moe: 'moritz', kj: 'kenyon', bub: 'carlton', gg: 'gregory', bones: 'nahshon', herb: 'herbert', nic: 'nicolas', cam: 'cameron', alex: 'alexandre' };
  const key = s => { const w = norm(s).split(' '); if (w.length > 1 && NICK[w[0]]) w[0] = NICK[w[0]]; return w.join(' '); };
  const TEAM = { NOR: 'NOP', NO: 'NOP', PHO: 'PHX', GS: 'GSW', SA: 'SAS', NY: 'NYK', UTAH: 'UTA', WSH: 'WAS', BRK: 'BKN', CHO: 'CHA' };
  const team = t => { t = String(t || '').toUpperCase().trim(); return TEAM[t] || t; };
  const same = (a, b, ta, tb) => { const x = key(a), y = key(b); if (!x || !y) return false;
    if (x === y) return true; if (ta && tb && team(ta) !== team(tb)) return false; // (a traded player keeps his exact-name match)
    const i = x.indexOf(' '), j = y.indexOf(' '); if (i < 1 || j < 1 || x.slice(i) !== y.slice(j)) return false;
    const f = x.slice(0, i), g = y.slice(0, j); return f.startsWith(g) || g.startsWith(f); };
  const pick = (list, n, t, nameOf = r => r.name, teamOf = r => r.team) => { list = list || [];
    const ex = list.filter(r => key(nameOf(r)) === key(n)); const c = ex.length ? ex : list.filter(r => same(nameOf(r), n, teamOf(r), t));
    if (c.length <= 1) return c[0] || null; const ct = t ? c.filter(r => team(teamOf(r)) === team(t)) : []; return ct.length === 1 ? ct[0] : null; };
  const N = { norm, key, team, same, pick };
  if (typeof module !== 'undefined' && module.exports) module.exports = N; root.NAMES = N;
})(typeof window !== 'undefined' ? window : globalThis);
