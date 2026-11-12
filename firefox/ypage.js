// Yahoo page reader for the co-pilot: which league page you're on, the players on it, and what you've selected
// (trade players ticked, the player being added and the drop chosen). It only reads; nothing is added to Yahoo's pages.
if (!globalThis.browser && globalThis.chrome) globalThis.browser = chrome;
(function () {
  if (/^(moz|chrome)-extension:/.test(location.protocol)) return;
  const pm = location.pathname.match(/^\/nba\/(\d+)(?:\/(\d+))?/); if (!pm) return;
  const lid = pm[1];
  const txt = el => (el ? el.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim() : '');
  const qp = k => new URLSearchParams(location.search).get(k);
  function kind() { const p = location.pathname;
    if (/trade/i.test(p) && !/playertrades|transactions/i.test(p)) return 'trade'; if (/addplayer|dropplayer/.test(p)) return 'add';
    if (/\/standings/.test(p)) return 'standings'; if (/\/players\/?$|buzzindex|playersearch/.test(p)) return 'players'; if (/matchup/.test(p)) return 'matchup';
    if (/^\/nba\/\d+\/\d+(\/team)?\/?$/.test(p)) return 'team'; if (/^\/nba\/\d+\/?$/.test(p)) return 'league'; return 'other'; }
  function players() { const out = {};
    document.querySelectorAll('a.name[data-ys-playerid], a[data-ys-playerid].name').forEach(a => { const id = a.getAttribute('data-ys-playerid'); if (!id || out[id]) return;
      const box = a.closest('.ysf-player-name') || a.parentElement; const tp = txt(box && box.querySelector('.Fz-xxs')).match(/^([A-Za-z]{2,4})\s*-\s*([A-Z,]+)/);
      const row = a.closest('tr'); const st = txt(row && row.querySelector('.ysf-player-status, .F-injury, abbr[class*="injury"]'));
      out[id] = { n: a.getAttribute('title') || txt(a), t: tp ? tp[1].toUpperCase() : '', pos: tp ? tp[2] : '', inj: /^(O|INJ|GTD|DTD|Q|P|D|OUT|SUSP|NA)$/i.test(st) ? st : '' }; });
    return out; }
  const vals = sel => [...new Set([...document.querySelectorAll(sel)].map(i => i.value).filter(Boolean))];
  const picked = sel => [...new Set([...document.querySelectorAll(sel)].filter(i => i.type === 'hidden' || i.checked).map(i => i.value).filter(Boolean))];
  function read() {
    const k = kind(); const o = { kind: k, lid, tid: pm[2] || null, url: location.href, title: document.title, ts: Date.now(), players: players() };
    // matchup page: the two teams in it (for next week's opponent)
    if (k === 'matchup') { const ts = []; document.querySelectorAll('#matchup-wall-header a[href], table.Datatable a[href]').forEach(a => { const m = (a.getAttribute('href') || '').match(/\/nba\/\d+\/(\d+)\/?$/); if (m && !ts.includes(m[1])) ts.push(m[1]); }); o.teams = ts.slice(0, 2); }
    if (k === 'trade') {
      o.mid2 = (document.querySelector('input[name=mid2]') || {}).value || qp('mid2') || null;
      o.give = picked('input[name="tpids[]"]'); o.get = picked('input[name="tpids2[]"]');
      o.myRoster = vals('input[name="tpids[]"][type=checkbox]'); o.theirRoster = vals('input[name="tpids2[]"][type=checkbox]');
      o.stage = (document.querySelector('input[name=stage]') || {}).value || qp('stage') || '';
      o.evaluate = /eval|from_evaluate/.test(location.search) || !!document.getElementById('sendtradeproposal');
      // an offer you received: no tick boxes, just the players in the deal (the co-pilot works out whose side each is on)
      o.trid = qp('trid') || (document.querySelector('input[name=trid]') || {}).value || null;
      o.offer = !o.give.length && !o.get.length && !o.myRoster.length && !o.theirRoster.length;
    }
    if (k === 'add') {
      const f = document.querySelector('form[action*="/addplayer"], form[action*="/dropplayer"]'); const am = f && (f.getAttribute('action') || '').match(/\/nba\/\d+\/(\d+)\//); if (am) o.tid = am[1];
      o.apid = (document.querySelector('input[name=apid]') || {}).value || qp('apid') || null;
      o.dropChoices = vals('input[name=dpid][type=radio], input[name=dpid][type=checkbox]'); o.dpid = picked('input[name=dpid]')[0] || null;
      o.stage = (document.querySelector('input[name=stage]') || {}).value || '';
    }
    if (k === 'players') {
      o.rows = []; document.querySelectorAll('table tbody tr').forEach(tr => { const a = tr.querySelector('a.name[data-ys-playerid]'); if (!a) return; const st = [...tr.querySelectorAll('td')].map(txt).find(x => /^(FA|W \(.+\)|[A-Z][\w ]+)$/.test(x) && x.length < 30); o.rows.push({ yid: a.getAttribute('data-ys-playerid'), avail: /^FA$/.test(st || '') ? 'FA' : /^W \(/.test(st || '') ? st : '' }); });
    }
    return o;
  }
  // your matchup open on Yahoo: copy its category totals into the co-pilot straight away, so the live card matches the page
  const MKEY = { 'FG%': 'fg%', 'FT%': 'ft%', '3PTM': '3', 'PTS': 'p', 'REB': 'r', 'AST': 'a', 'ST': 's', 'STL': 's', 'BLK': 'b', 'TO': 'to', 'DD': '2d', 'FGM': 'fg', 'FTM': 'ft' };
  let liveSig = '';
  function liveFromPage() { if (kind() !== 'matchup') return;
    const tb = [...document.querySelectorAll('table')].find(t => /FG%|PTS|REB/.test(txt(t.querySelector('thead'))) && t.querySelectorAll('tbody tr').length === 2 && /Score/i.test(txt(t.querySelector('thead')))); if (!tb) return;
    const hd = [...tb.querySelectorAll('thead th')].map(th => txt(th).replace(/\*/g, ''));
    const teams = [...tb.querySelectorAll('tbody tr')].map(tr => { const tds = [...tr.querySelectorAll('td')]; const a = tr.querySelector('a[href*="/nba/' + lid + '/"]'); const m = a && (a.getAttribute('href') || '').match(/\/nba\/\d+\/(\d+)/);
      const o = { tid: m ? m[1] : null, name: a ? txt(a) : '', st: {} };
      hd.forEach((h, i) => { const v = txt(tds[i]); if (!v || v === '-' || v === '-/-') return; if (h === 'FGM/A' || h === 'FTM/A') { const [x, y] = v.split('/').map(Number); if (isNaN(x) || isNaN(y)) return; if (h === 'FGM/A') { o.st.fg = x; o.st.fga = y; } else { o.st.ft = x; o.st.fta = y; } } else if (MKEY[h] && !isNaN(+v)) o.st[MKEY[h]] = +v; });
      if (o.st.fg != null && o.st.fga == null && o.st['fg%'] > 0) o.st.fga = Math.round(o.st.fg / o.st['fg%']); if (o.st.ft != null && o.st.fta == null && o.st['ft%'] > 0) o.st.fta = Math.round(o.st.ft / o.st['ft%']);
      o.score = +txt(tds[tds.length - 1]) || 0; return o; });
    const wk = +(qp('week') || ((txt(document.querySelector('#matchup-wall-header')) || txt(document.body)).match(/Week\s+(\d+)/) || [])[1]) || null;
    const sig = JSON.stringify([wk, teams]); if (sig === liveSig) return; liveSig = sig;
    const k = 'ylive:' + lid; browser.storage.local.get([k, 'ymine']).then(o => { const cur = o[k]; const myTid = (o.ymine || {})[lid] || (cur && cur.me && cur.me.tid);
      const me = teams.find(t => t.tid && String(t.tid) === String(myTid)), op = teams.find(t => t !== me); if (!me || !op || !cur || !wk || cur.week !== wk) return; // only this week's matchup, and only yours
      browser.storage.local.set({ [k]: Object.assign({}, cur, { ts: Date.now(), me: Object.assign({}, cur.me, { st: me.st, score: me.score }), opp: Object.assign({}, cur.opp, { st: op.st, score: op.score }), src: 'tab' }) }); }).catch(() => {}); }
  let last = ''; function push(force) { try { liveFromPage(); } catch (e) {} if (document.visibilityState === 'hidden' && !force) return; try { const o = read(); const sig = JSON.stringify([o.kind, o.url, o.give, o.get, o.apid, o.dpid, Object.keys(o.players).length, o.teams]); if (sig === last && !force) return; last = sig; browser.storage.local.set({ ypage: o }); } catch (e) {} }
  push(true);
  // your own team in every league, from Yahoo's top bar (works on any Yahoo Fantasy page): the co-pilot never loses track of your leagues
  try { const mine = {}; document.querySelectorAll('a[data-ylk*="navtray-fantasy"][href*="/nba/"], a[data-ylk*="slk:My Team"][href*="/nba/"]').forEach(a => { const m = (a.getAttribute('href') || '').match(/basketball\.fantasysports\.yahoo\.com\/nba\/(\d+)\/(\d+)\/?$/); if (m) mine[m[1]] = m[2]; });
    if (Object.keys(mine).length) browser.storage.local.get('ymine').then(o => { const cur = o.ymine || {}; const next = Object.assign({}, cur, mine); if (JSON.stringify(next) !== JSON.stringify(cur)) browser.storage.local.set({ ymine: next }); }).catch(() => {}); } catch (e) {}
  document.addEventListener('change', e => { if (e.target && /^(tpids|tpids2|dpid)/.test(e.target.name || '')) push(true); }, true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { last = ''; push(true); } });
  window.addEventListener('focus', () => { last = ''; push(true); });
  const ours = n => n && n.nodeType === 1 && (n.classList.contains('mdf-lab') || n.id === 'mdf-lab-css');
  const mo = new MutationObserver(ms => { if (ms.every(m => ours(m.target) || ((m.addedNodes.length || m.removedNodes.length) && [...m.addedNodes, ...m.removedNodes].every(ours)))) return; clearTimeout(push.t); push.t = setTimeout(() => push(false), 700); }); mo.observe(document.documentElement, { childList: true, subtree: true });
  // remove any value labels an earlier version put on the page (everything now lives in the co-pilot)
  const clean = () => document.querySelectorAll('.mdf-lab, #mdf-lab-css').forEach(e => e.remove()); clean(); setTimeout(clean, 1500);
})();
