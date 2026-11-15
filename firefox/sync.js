// Sync: reads Yahoo (official API when connected, else your signed-in Yahoo pages) and drives BBM Matchup Monster with your BBM session.
// Runs from the add-on's background (no tabs needed) and from the panel. Full sync every ~6 h: this week, next week, league rosters,
// settings, transactions, NBA schedule, last week's result. Light sync every ~30 min: this week. Every request is logged for diagnostics.
if (!globalThis.browser && globalThis.chrome) globalThis.browser = chrome;
(function (root) {
  const BBM = 'https://basketballmonster.com/matchupmonster.aspx';
  const YH = 'https://basketball.fantasysports.yahoo.com';
  const NBA = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';
  const usToday = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } };
  const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const mondayOf = d => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  const strip = s => String(s || '').replace(/\s*\((Yahoo|ESPN|Fantrax|Sleeper)!?\)\s*$/i, '').replace(/\s+/g, ' ').trim();
  const ST = () => root.STORE || browser.storage.local;
  const put = o => ST().set(o);
  // ---------- traced HTTP ----------
  let TR = null; // current trace array
  // the sync lock is refreshed as steps happen, so a long sync is never mistaken for a dead one (two syncs at once would scramble BBM's page state)
  let beat = 0;
  const trace = (step, ok, info) => { if (TR) TR.push({ t: Date.now(), step, ok, info: info == null ? '' : String(info).slice(0, 300) });
    if (lockBy && Date.now() - beat > 20e3) { beat = Date.now(); try { put({ syncLock: { ts: beat, by: lockBy, step } }); } catch (e) {} } };
  const nk = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.'’`]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/gi, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const lastI = s => { const w = nk(s).split(' '); return (w[0] || '')[0] + ' ' + (w[w.length - 1] || ''); };
  // a sign-in problem (as opposed to a site or network problem): the sync stops asking and the panel shows one button to fix it
  const authErr = (site, msg) => { const e = new Error(msg); e.auth = site; return e; };
  const sleep = ms => new Promise(z => setTimeout(z, ms));
  // every request: 45 s timeout, up to 3 tries with a pause when a site is slow, down or busy (network, 5xx, 429, Yahoo's 999)
  async function req(url, opt, label) {
    const t0 = Date.now(); let r = null, text = '', lastErr = null;
    for (let i = 0; i < 3; i++) {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const tm = ctl && setTimeout(() => ctl.abort(), 45e3);
      try { r = await fetch(url, Object.assign({ credentials: 'include', cache: 'no-store' }, opt || {}, ctl ? { signal: ctl.signal } : {})); text = await r.text(); lastErr = null; }
      catch (e) { r = null; lastErr = e; }
      finally { if (tm) clearTimeout(tm); }
      const busy = !r || r.status >= 500 || r.status === 429 || r.status === 999;
      if (!busy || i === 2) break;
      trace(label, true, (r ? 'status ' + r.status : 'network ' + (lastErr && lastErr.name === 'AbortError' ? 'timeout' : 'error')) + ', trying again'); await sleep(i ? 8000 : 2500);
    }
    if (!r) { trace(label, false, 'network error: ' + (lastErr && lastErr.name === 'AbortError' ? 'timed out' : lastErr && lastErr.message));
      // a Yahoo page that won't load is usually Yahoo bouncing you to its sign-in page
      if (/fantasysports\.yahoo\.com/.test(url) && await yahooSignedOut()) throw authErr('yahoo', 'Yahoo signed you out');
      throw new Error(label + ': network error'); }
    trace(label, r.ok, (opt && opt.method || 'GET') + ' ' + url.replace(/^https?:\/\/[^/]+/, '') + ' → ' + r.status + ', ' + Math.round(text.length / 1024) + ' KB, ' + (Date.now() - t0) + ' ms');
    if (/fantasysports\.yahoo\.com/.test(url) && /login\.yahoo\.com/.test(r.url || '')) throw authErr('yahoo', 'Yahoo signed you out');
    if (!r.ok) throw new Error(label + ' returned ' + r.status); return text;
  }
  async function yahooSignedOut() { try { const r = await fetch(YH + '/nba', { credentials: 'include', cache: 'no-store', redirect: 'manual' }); return r.type === 'opaqueredirect' || (r.status >= 300 && r.status < 400); } catch (e) { return false; } }
  // ---------- Basketball Monster sign-in: signed-in pages carry a Logout link; if it's missing, sign in again with your saved details ----------
  const BBMH = 'https://basketballmonster.com';
  const bbmIn = t => /Logout\.aspx/i.test(t);
  const unhide = s => { try { const k = s.split('.'); return decodeURIComponent(escape(atob(k[1]).split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ k[0].charCodeAt(i % k[0].length))).join(''))); } catch (e) { return ''; } };
  async function bbmLogin() {
    const a = (await ST().get('bbmAuth')).bbmAuth; if (!a || !a.user || !a.pass) return { ok: false, why: 'none' };
    // don't hammer BBM with a wrong password: after two failures wait an hour before trying again
    if ((a.fails || 0) >= 2 && Date.now() - (a.failTs || 0) < 3600e3) return { ok: false, why: 'paused' };
    let ok = false, why = '';
    try {
      const page = await req(BBMH + '/Login.aspx', null, 'BBM sign-in page'); if (bbmIn(page)) ok = true;
      else { const d = html(page); const pw = d.querySelector('input[type=password]'); if (!pw) throw new Error('no sign-in form on Basketball Monster');
        const form = pw.closest('form') || d.querySelector('form'); const all = [...form.querySelectorAll('input')];
        const user = all.slice(0, all.indexOf(pw)).reverse().find(i => i.name && /^(text|email|)$/i.test(i.getAttribute('type') || '') && !/search/i.test(i.name + (i.id || '')));
        if (!user) throw new Error('no email box on the sign-in form');
        const b = serialize(d, { __EVENTTARGET: '', __EVENTARGUMENT: '' }, null); b.set(user.name, a.user); b.set(pw.name, unhide(a.pass));
        all.filter(i => i.getAttribute('type') === 'checkbox' && /remember|persist|keep|stay/i.test((i.name || '') + (i.id || '') + ((d.querySelector('label[for="' + i.id + '"]') || {}).textContent || ''))).forEach(i => b.set(i.name, i.getAttribute('value') || 'on'));
        const btn = [...form.querySelectorAll('input[type=submit], button')].find(x => /log ?in|sign ?in|submit/i.test((x.getAttribute('value') || '') + (x.textContent || '') + (x.name || ''))) || form.querySelector('input[type=submit]');
        if (btn && btn.name) b.set(btn.name, btn.getAttribute('value') || '');
        const link = !btn && [...form.querySelectorAll('a[href*="__doPostBack"]')].find(x => /log ?in|sign ?in/i.test(x.textContent || '')); if (link) b.set('__EVENTTARGET', (link.getAttribute('href').match(/__doPostBack\('([^']+)'/) || [])[1] || '');
        const action = new URL(form.getAttribute('action') || 'Login.aspx', BBMH + '/Login.aspx').href;
        // the password only ever goes to Basketball Monster, over https, whatever the sign-in form says
        { const u = new URL(action); if (u.protocol !== 'https:' || !/^(www\.)?basketballmonster\.com$/i.test(u.hostname)) throw new Error('the sign-in form points away from Basketball Monster (' + u.hostname + '): password not sent'); }
        const t = await req(action, { method: 'POST', body: b, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 'BBM sign-in');
        ok = bbmIn(t) || bbmIn(await req(BBMH + '/default.aspx', null, 'BBM sign-in check')); if (!ok) why = 'Basketball Monster didn\'t accept the saved email and password'; }
    } catch (e) { why = e.message; }
    trace('BBM automatic sign-in', ok, ok ? 'signed in' : why);
    const cur = (await ST().get('bbmAuth')).bbmAuth || a; await put({ bbmAuth: Object.assign({}, cur, ok ? { fails: 0, failTs: null, lastOk: Date.now(), lastErr: null } : { fails: (cur.fails || 0) + 1, failTs: Date.now(), lastErr: why }) });
    return { ok, why };
  }
  // open a members page; if BBM has signed you out, sign in again and reopen it
  async function bbmGet(url, label) {
    let t = await req(url, null, label); if (bbmIn(t)) return t;
    const r = await bbmLogin(); if (r.ok) { t = await req(url, null, label + ' (after signing in)'); if (bbmIn(t)) return t; }
    throw authErr('bbm', r.why === 'none' ? 'Basketball Monster signed you out' : 'Basketball Monster signed you out and automatic sign-in failed' + (r.why && r.why !== 'paused' ? ': ' + r.why : ''));
  }
  const html = t => new DOMParser().parseFromString(t, 'text/html');
  // ---------- ASP.NET WebForms postbacks (exactly what the page sends when you click) ----------
  function serialize(doc, over, click, skip) {
    const f = doc.getElementById('form1') || doc.querySelector('form'); const b = new URLSearchParams();
    f.querySelectorAll('input, select, textarea').forEach(el => {
      const n = el.getAttribute('name'); if (!n || el.disabled || (skip && skip.test(n))) return; const t = (el.getAttribute('type') || '').toLowerCase();
      if (['submit', 'button', 'image', 'reset', 'file'].includes(t)) return;
      if ((t === 'checkbox' || t === 'radio') && !el.hasAttribute('checked')) return;
      if (el.tagName === 'SELECT') { const o = el.querySelector('option[selected]') || el.querySelector('option'); if (o) b.append(n, o.getAttribute('value') != null ? o.getAttribute('value') : o.textContent); return; }
      b.append(n, el.getAttribute('value') != null ? el.getAttribute('value') : (t === 'checkbox' || t === 'radio' ? 'on' : (el.textContent || '')));
    });
    Object.entries(over || {}).forEach(([k, v]) => b.set(k, v)); if (click) b.set(click[0], click[1]);
    return b;
  }
  const val = (d, id) => { const s = d.querySelector('select[name="' + id + '"], input[name="' + id + '"]') || d.getElementById(id); if (!s) return null; if (s.tagName === 'SELECT') { const o = s.querySelector('option[selected]'); return o ? o.getAttribute('value') : null; } return s.getAttribute('value'); };
  // any message BBM shows on the page (validation errors etc.), for diagnostics
  const bbmMsg = d => { const el = [...d.querySelectorAll('.alert, .text-danger, .validation-summary-errors, .error, [id$=ErrorLabel], [id$=MessageLabel], span[style*="Red"], font[color=red]')].map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(t => t.length > 3 && t.length < 300); return el[0] || ''; };
  // what the main part of a Matchup Monster page says (after the menus), for diagnostics
  const pageText = d => { const t = ((d.body || d.documentElement || {}).textContent || '').replace(/\s+/g, ' '); const i = Math.max(t.indexOf('Clear All'), t.indexOf('Show Help')); return (i >= 0 ? t.slice(i, i + 260) : t.slice(-260)).trim(); };
  async function post(doc, over, click, label, skip) {
    const t = await req(BBM, { method: 'POST', body: serialize(doc, Object.assign({ __EVENTTARGET: '', __EVENTARGUMENT: '' }, over), click, skip), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, label);
    const d = html(t); if (!d.getElementById('Team1DD')) { trace(label, false, 'response was not Matchup Monster'); if (!bbmIn(t)) throw authErr('bbm', 'Basketball Monster signed you out'); throw new Error('Basketball Monster did not return Matchup Monster'); }
    if (t.length < 400e3) { const msg = bbmMsg(d); trace(label + ' page', true, 'short page' + (msg ? ': ' + msg : '') + ' · dates ' + val(d, 'StartDateTB') + '→' + val(d, 'EndDateTB')); }
    return d;
  }
  // move Matchup Monster to a date range the way you would: its own This/Next/Previous Week buttons when they fit, else typed dates
  async function setDates(d, t, tag) {
    const cur = val(d, 'StartDateTB'); const wk = t.end === addDay(t.start, 6);
    const btn = !wk ? null : cur && addDay(cur, 7) === t.start ? ['NextWeekButon', 'Next Week'] : cur && addDay(cur, -7) === t.start ? ['PreviousWeekButon', 'Previous Week'] : t.start === mondayOf(usToday()) ? ['ThisWeekButon', 'This Week'] : null;
    if (btn) { d = await post(d, {}, btn, tag + ' dates (' + btn[1].toLowerCase() + ')'); if (val(d, 'StartDateTB') === t.start && val(d, 'EndDateTB') === t.end) return d; }
    // typed dates; leave out the old week's game ticks, which don't belong to the new range
    return post(d, { StartDateTB: t.start, EndDateTB: t.end }, ['SetDatesButon', 'Update'], tag + ' dates', /^MD_/);
  }
  // drive Matchup Monster to: league, you, opponent, dates; import Yahoo lineups; process; read
  async function bbmWeek(t, tag) {
    let d = html(await bbmGet(BBM, tag + ' open'));
    if (!d.getElementById('Team1DD')) { trace(tag + ' open', false, 'no Matchup Monster form'); throw new Error('Matchup Monster page looks different (Basketball Monster may be updating)'); }
    const opts = [...d.querySelectorAll('#pageTitleRowLeague option')].map(o => ({ id: o.getAttribute('value'), name: strip(o.textContent) }));
    const lo = opts.find(o => o.name === strip(t.league)) || opts.find(o => strip(t.league).indexOf(o.name) === 0 || o.name.indexOf(strip(t.league)) === 0);
    if (opts.length && !lo) { trace(tag + ' league', false, 'BBM leagues: ' + opts.map(o => o.name).join(', ')); throw new Error('Basketball Monster has no league called "' + t.league + '"'); }
    if (lo && val(d, 'pageTitleRowLeague') !== lo.id) d = await post(d, { __EVENTTARGET: 'pageTitleRowLeague', pageTitleRowLeague: lo.id }, null, tag + ' league');
    if (t.myTid && val(d, 'Team1DD') !== String(t.myTid)) d = await post(d, { __EVENTTARGET: 'Team1DD', Team1DD: String(t.myTid) }, null, tag + ' your team');
    if (val(d, 'StartDateTB') !== t.start || val(d, 'EndDateTB') !== t.end) d = await setDates(d, t, tag);
    if (t.oppTid && ![...d.querySelectorAll('select[name="Team2DD"] option')].some(o => o.getAttribute('value') === String(t.oppTid))) trace(tag + ' opponent', false, 'team ' + t.oppTid + " isn't in Basketball Monster's team list: " + [...d.querySelectorAll('select[name="Team2DD"] option')].map(o => o.getAttribute('value') + '=' + (o.textContent || '').trim()).join(', '));
    if (t.oppTid && val(d, 'Team2DD') !== String(t.oppTid)) d = await post(d, { __EVENTTARGET: 'Team2DD', Team2DD: String(t.oppTid) }, null, tag + ' opponent');
    const fa = val(d, 'TopFreeAgentsDD'); if (fa != null && +fa < 50) d = await post(d, { __EVENTTARGET: 'TopFreeAgentsDD', TopFreeAgentsDD: '50' }, null, tag + ' free agents 50');
    if (!t.noImport) d = await post(d, {}, ['ImportButton', 'Import Provider Selections'], tag + ' import Yahoo lineups');
    d = await post(d, {}, null, tag + ' process');
    const teams = [...d.querySelectorAll('#Team1DD option')].map(o => ({ tid: o.getAttribute('value'), name: (o.textContent || '').trim() })).filter(x => x.tid);
    let m = root.MMPARSE(d);
    // a week that hasn't started can come back without the results table until games are ticked: tick all remaining games and process again
    if (m && m.error && /Final/.test(m.error)) { try { trace(tag + ' empty page', true, pageText(d)); d = await post(d, {}, ['SelectAllRemainingButton', 'Select All Remaining'], tag + ' select all remaining games'); d = await post(d, {}, null, tag + ' process again'); m = root.MMPARSE(d); } catch (e) { trace(tag + ' select all', false, e.message); } }
    // still nothing: let BBM rebuild the week its own way (its week buttons instead of typed dates), then refresh the league's
    // rosters from Yahoo and try once more. Each attempt re-applies league, team, dates and opponent, ticks the remaining games and processes
    if (m && m.error && /Final/.test(m.error)) {
      const redo = async (how) => { try {
          if (how === 'refresh') d = await post(d, {}, ['pageTitleRowRefresh', ''], tag + ' refresh rosters');
          if (lo && val(d, 'pageTitleRowLeague') !== lo.id) d = await post(d, { __EVENTTARGET: 'pageTitleRowLeague', pageTitleRowLeague: lo.id }, null, tag + ' league (again)');
          if (t.myTid && val(d, 'Team1DD') !== String(t.myTid)) d = await post(d, { __EVENTTARGET: 'Team1DD', Team1DD: String(t.myTid) }, null, tag + ' your team (again)');
          const wkBtn = t.start === mondayOf(usToday()) ? ['ThisWeekButon', 'This Week'] : t.start === addDay(mondayOf(usToday()), 7) ? ['ThisWeekButon', 'This Week'] : null;
          if (wkBtn) { d = await post(d, {}, wkBtn, tag + ' this week button'); if (t.start !== mondayOf(usToday()) && val(d, 'StartDateTB') !== t.start) d = await post(d, {}, ['NextWeekButon', 'Next Week'], tag + ' next week button'); }
          if (val(d, 'StartDateTB') !== t.start || val(d, 'EndDateTB') !== t.end) d = await post(d, { StartDateTB: t.start, EndDateTB: t.end }, ['SetDatesButon', 'Update'], tag + ' dates (again)');
          if (t.oppTid && val(d, 'Team2DD') !== String(t.oppTid)) d = await post(d, { __EVENTTARGET: 'Team2DD', Team2DD: String(t.oppTid) }, null, tag + ' opponent (again)');
          if (!t.noImport) d = await post(d, {}, ['ImportButton', 'Import Provider Selections'], tag + ' import Yahoo lineups (again)');
          d = await post(d, {}, ['SelectAllRemainingButton', 'Select All Remaining'], tag + ' select all remaining (again)'); d = await post(d, {}, null, tag + ' process (' + how + ')');
          const m2 = root.MMPARSE(d); trace(tag + ' retry: ' + how, !!(m2 && !m2.error), m2 && m2.error ? m2.error : m2 ? m2.players.length + ' rows' : 'parse failed'); return m2; } catch (e) { trace(tag + ' retry: ' + how, false, e.message); return null; } };
      for (const how of ['week buttons', 'refresh']) { const m2 = await redo(how); if (m2 && !m2.error) { m = m2; break; } } }
    if (!m || m.error) {
      // what Basketball Monster showed, kept for the diagnostics report: the dropdowns' choices and how many game ticks and tables came back
      const opt = id => [...d.querySelectorAll('select[name="' + id + '"] option')].map(o => (o.hasAttribute('selected') ? '*' : '') + o.getAttribute('value') + '=' + (o.textContent || '').trim().slice(0, 24)).join(', ');
      const info = { ts: Date.now(), tag, want: { league: t.league, me: t.myTid, opp: t.oppTid, start: t.start, end: t.end }, league: opt('pageTitleRowLeague'), team1: opt('Team1DD'), team2: opt('Team2DD'), dates: val(d, 'StartDateTB') + '→' + val(d, 'EndDateTB'),
        gameTicks: d.querySelectorAll('input[name^="MD_"]').length, tables: d.querySelectorAll('table').length, msg: bbmMsg(d), text: pageText(d) };
      try { await put({ ['bbmFail:' + (t.league || '')]: info }); } catch (e) {}
      trace(tag + ' read', false, ((m && m.error) || 'parse failed') + ' · team 1 ' + val(d, 'Team1DD') + ', team 2 ' + val(d, 'Team2DD') + ' (wanted ' + t.myTid + ' v ' + t.oppTid + ') · ' + info.gameTicks + ' game ticks · ' + pageText(d));
      throw new Error(/Final/.test((m && m.error) || '') ? 'Basketball Monster showed no results for this matchup (team ' + val(d, 'Team1DD') + ' v ' + val(d, 'Team2DD') + ', ' + t.start + ' to ' + t.end + ')' : (m && m.error) || 'Could not read Matchup Monster'); }
    // BBM can lag behind Yahoo pickups: if your Yahoo roster has players BBM doesn't, ask BBM to refresh rosters and read again
    if (t.yNames && t.yNames.length) { const bb = new Set(m.players.filter(p => p.side === 0 && p.type !== 'fa').map(p => lastI(p.name))); const miss = t.yNames.filter(n => !bb.has(lastI(n)));
      if (miss.length) { trace(tag + ' roster check', false, 'BBM missing ' + miss.join(', ') + ': refreshing rosters');
        try { d = await post(d, {}, ['pageTitleRowRefresh', ''], tag + ' refresh rosters'); if (!t.noImport) d = await post(d, {}, ['ImportButton', 'Import Provider Selections'], tag + ' import Yahoo lineups'); d = await post(d, {}, null, tag + ' process');
          const m2 = root.MMPARSE(d); if (m2 && !m2.error) m = m2; } catch (e) { trace(tag + ' refresh rosters', false, e.message); } }
      else trace(tag + ' roster check', true, 'BBM roster matches Yahoo'); }
    const check = [['league', strip(m.league) === strip(t.league)], ['you', !t.myTid || (m.t1 && m.t1.id === String(t.myTid))], ['opponent', !t.oppTid || (m.t2 && m.t2.id === String(t.oppTid))], ['dates', m.start === t.start]];
    const bad = check.filter(c => !c[1]).map(c => c[0]);
    trace(tag + ' read', !bad.length, `${m.league} · ${m.me} vs ${m.opp} · ${m.start}→${m.end} · ${m.players.length} rows · ${m.cats.length} cats${bad.length ? ' · WRONG: ' + bad.join(', ') : ''}`);
    if (bad.length) throw new Error('Matchup Monster did not switch ' + bad.join(' / ') + ' (stayed on ' + m.start + ', ' + m.me + ' vs ' + m.opp + ')');
    m.ts = Date.now(); m.src = 'sync'; m.teams = teams; return m;
  }
  // ---------- BBM projections exports (Weekly Projections views, projections CSV, Josh comments) ----------
  const WEEKLY = 'https://basketballmonster.com/weeklyprojections.aspx', PROJ = 'https://basketballmonster.com/projections.aspx';
  // how old each piece may get before it's fetched again (minutes)
  const FRESH = { rest: 180, next: 180, ros: 1440, po: 1440, form: 1440, season: 720, proj: 1440, com: 1440 };
  async function postAt(url, doc, over, click, label, expectCsv) {
    const r = await req(url, { method: 'POST', body: serialize(doc, Object.assign({ __EVENTTARGET: '', __EVENTARGUMENT: '' }, over), click), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, label);
    if (expectCsv) { if (/^\s*</.test(r)) { trace(label, false, 'got a web page instead of a CSV (signed out?)'); throw new Error('BBM export did not return a CSV'); } return r; }
    const d = html(r); if (!d.querySelector('[name=pageTitleRowLeague]')) { trace(label, false, 'response was not a BBM page (signed out?)'); throw new Error('Basketball Monster did not return the page (signed out?)'); } return d;
  }
  async function bbmOpen(url, league, tag) {
    let d = html(await bbmGet(url, tag + ' open'));
    if (!d.querySelector('[name=pageTitleRowLeague]')) { trace(tag + ' open', false, 'no league menu on the page'); throw new Error(tag + ' page looks different (Basketball Monster may be updating)'); }
    const opts = [...d.querySelectorAll('[name=pageTitleRowLeague] option')].map(o => ({ id: o.getAttribute('value'), name: strip(o.textContent) }));
    const lo = opts.find(o => o.name === strip(league)) || opts.find(o => strip(league).indexOf(o.name) === 0 || o.name.indexOf(strip(league)) === 0);
    if (!lo) { trace(tag + ' league', false, 'BBM leagues: ' + opts.map(o => o.name).join(', ')); throw new Error('Basketball Monster has no league called "' + league + '"'); }
    if (val(d, 'pageTitleRowLeague') !== lo.id) d = await postAt(url, d, { __EVENTTARGET: 'pageTitleRowLeague', pageTitleRowLeague: lo.id }, null, tag + ' league');
    return d;
  }
  const r3 = x => x == null ? null : Math.round(x * 1000) / 1000;
  const slim = (rows, full) => { const o = {}; rows.forEach(r => { const st = {}; Object.entries(r.st || {}).forEach(([k, v]) => { if (v != null && k !== 'm') st[k] = r3(v); }); o[r.id] = full ? { n: r.n, t: r.t, pos: r.pos, inj: r.inj, g: r.g, lv: r3(r.lv), rank: r.rank, m: r.m, st, cv: r.cv, notes: r.notes, status: r.status } : { g: r.g, lv: r3(r.lv), m: r.m, st }; }); return o; }; // names, notes and values kept once (rest of week, rest of season)
  // your BBM punt settings: PuntV is the average of the category values that aren't punted, so the punted set is the one that reproduces it
  function detectPunt(rows) {
    const R = rows.filter(r => r.cv && r.pv != null && Object.keys(r.cv).length >= 8).slice(0, 200); if (R.length < 30) return null; const cats = Object.keys(R[0].cv);
    const err = S => { let e = 0; R.forEach(r => { let sum = 0, n = 0; cats.forEach(c => { if (!S.includes(c) && r.cv[c] != null) { sum += r.cv[c]; n++; } }); e += Math.abs(sum / Math.max(n, 1) - r.pv); }); return e / R.length; };
    const subs = [[]]; cats.forEach(a => subs.push([a])); cats.forEach((a, i) => cats.slice(i + 1).forEach(b => subs.push([a, b]))); cats.forEach((a, i) => cats.slice(i + 1).forEach((b, j) => cats.slice(i + j + 2).forEach(c => subs.push([a, b, c]))));
    const sc = subs.map(S => ({ S, e: err(S) })).sort((a, b) => a.e - b.e); const best = sc[0];
    return best.e < 0.02 ? { cats: best.S, err: +best.e.toFixed(4), ts: Date.now() } : { cats: [], err: +best.e.toFixed(4), unsure: true, ts: Date.now() };
  }
  // fetch whatever is stale for one league; returns the merged store entry
  async function bx(y0, opt) {
    opt = opt || {}; const key = 'bx:' + y0.lid; const all = await ST().get(key); const cur = all[key] || { ts: {}, views: {}, dd: {}, com: {} };
    const maxAge = Object.assign({}, FRESH, opt.maxAge || {}); const stale = k => opt.force || !cur.ts[k] || Date.now() - cur.ts[k] > maxAge[k] * 60e3;
    const want = ['rest', 'next', 'ros', 'po', 'form', 'season'].filter(k => (!opt.only || opt.only.includes(k)) && stale(k));
    const BTN = { rest: ['RESTWEEK', 'Remaining Week'], next: ['NEXTWEEK', 'Next Week'], ros: ['ROS', 'Remaining Season'], po: ['PLAYOFFS', 'Playoffs Week 1'] };
    const log = []; const Tsave = TR; if (!TR) TR = [];
    try {
      if (want.length) {
        let d = await bbmOpen(WEEKLY, y0.league, 'Weekly projections');
        const pf0 = val(d, 'PlayerFilterControl'), df0 = val(d, 'DateFilterControl');
        if (pf0 !== 'AllPlayers') d = await postAt(WEEKLY, d, { __EVENTTARGET: 'PlayerFilterControl', PlayerFilterControl: 'AllPlayers' }, null, 'Weekly projections all players');
        if (df0 !== 'WeeklyProjections') d = await postAt(WEEKLY, d, { __EVENTTARGET: 'DateFilterControl', DateFilterControl: 'WeeklyProjections' }, null, 'Weekly projections mode');
        for (const k of want.filter(k => BTN[k])) { d = await postAt(WEEKLY, d, {}, BTN[k], 'Weekly projections ' + k); const t = root.BBMX.parseTable(d);
          if (t && (k === 'rest' || k === 'ros') && t.rows.length > 100) { const pu = detectPunt(t.rows); if (pu) { cur.punt = pu; trace('BBM punt settings', true, pu.cats.length ? 'punting ' + pu.cats.join(', ') : 'no punt'); } }
          trace('Weekly projections ' + k + ' read', !!(t && t.rows.length > 100), t ? t.rows.length + ' players, stats ' + t.stats.join(',') : 'no table'); if (t && t.rows.length > 100) { cur.views[k] = slim(t.rows, k === 'rest' || k === 'ros'); cur.ts[k] = Date.now(); log.push(k); } }
        if (want.includes('form')) { d = await postAt(WEEKLY, d, { __EVENTTARGET: 'DateFilterControl', DateFilterControl: 'LastTwoWeeks' }, null, 'Weekly projections last 2 weeks'); const t = root.BBMX.parseTable(d);
          trace('Recent form read', !!(t && t.rows.length > 50), t ? t.rows.length + ' players' : 'no table'); if (t && t.rows.length > 50) { cur.views.form = slim(t.rows, false); cur.ts.form = Date.now(); log.push('form'); } }
        // this season so far (per game, with minutes and shot attempts): used alongside the projections in the trade search.
        // Checked before it's kept: a page showing full-season projections instead (60+ games) is thrown away
        if (want.includes('season')) { d = await postAt(WEEKLY, d, { __EVENTTARGET: 'DateFilterControl', DateFilterControl: 'FullSeason' }, null, 'Season so far'); const t = root.BBMX.parseTable(d);
          const gmax = t && t.rows.length ? Math.max(...t.rows.map(r => r.g || 0)) : 0; const perGame = t && t.rows.length ? Math.max(...t.rows.map(r => (r.st && r.st.p) || 0)) < 60 : false; const sel = val(d, 'DateFilterControl'); const ok = !!(t && t.rows.length > 100 && gmax > 0 && gmax <= 60 && perGame && (sel == null || sel === 'FullSeason'));
          trace('Season so far read', ok, t ? t.rows.length + ' players, most games ' + gmax + (perGame ? '' : ', not per game') + (sel && sel !== 'FullSeason' ? ', page showed ' + sel : '') : 'no table'); if (ok) { cur.views.season = slim(t.rows, false); cur.ts.season = Date.now(); log.push('season'); } }
        // put your BBM page settings back the way they were
        if (want.includes('form') || want.includes('season') || df0 !== 'WeeklyProjections') { const back = df0 || 'WeeklyProjections'; d = await postAt(WEEKLY, d, { __EVENTTARGET: 'DateFilterControl', DateFilterControl: back }, null, 'Weekly projections restore view'); }
        if (pf0 && pf0 !== 'AllPlayers') await postAt(WEEKLY, d, { __EVENTTARGET: 'PlayerFilterControl', PlayerFilterControl: pf0 }, null, 'Weekly projections restore filter');
      }
      if ((!opt.only || opt.only.includes('proj')) && (stale('proj') || stale('com'))) {
        let d = await bbmOpen(PROJ, y0.league, 'Projections');
        if (stale('proj')) { const t = root.BBMX.csv(await postAt(PROJ, d, {}, ['CSVBUTTON', ''], 'Projections CSV', true)); const dd = {};
          // rest-of-season totals to each league's final week: the source for long-term value (per game + games left)
          const tot = {}; const n = x => +x || 0;
          t.forEach(r => { const g = +r.games; if (!r.player_id || !(g > 0)) return; dd[r.player_id] = r3(n(r.double_doubles) / g);
            tot[r.player_id] = { g, m: r3(n(r.minutes) / g), n: ((r.first_name || '') + ' ' + (r.last_name || '')).trim(), st: { p: r3((2 * n(r.field_goals) + n(r.threes) + n(r.free_throws)) / g), 3: r3(n(r.threes) / g), r: r3((n(r.offensive_rebounds) + n(r.defensive_rebounds)) / g), a: r3(n(r.assists) / g), s: r3(n(r.steals) / g), b: r3(n(r.blocks) / g), to: r3(n(r.turnovers) / g), '2d': r3(n(r.double_doubles) / g), fg: r3(n(r.field_goals) / g), fga: r3(n(r.field_goals_attempted) / g), ft: r3(n(r.free_throws) / g), fta: r3(n(r.free_throws_attempted) / g) } }; });
          trace('Projections CSV read', t.length > 100, t.length + ' players'); if (t.length > 100) { cur.dd = dd; cur.tot = tot; cur.ts.proj = Date.now(); log.push('proj'); } }
        if (stale('com')) { const t = root.BBMX.csv(await postAt(PROJ, d, {}, ['JoshCommentsButton', 'Josh Comments CSV'], 'Josh comments CSV', true)); const com = {};
          t.forEach(r => { const n = ((r.first_name || '') + ' ' + (r.last_name || '')).trim(); if (n) com[nk(n) + '|' + String(r.team || '').toUpperCase()] = { rank: +r.rank || null, text: r.comment || '' }; });
          trace('Josh comments read', t.length > 100, t.length + ' players'); if (t.length > 100) { cur.com = com; cur.ts.com = Date.now(); log.push('com'); } }
      }
    } catch (e) { trace('BBM exports', false, e.message); cur.err = e.message; cur.errTs = Date.now(); }
    if (log.length) { cur.err = null; await put({ [key]: cur }); } else if (cur.err) await put({ [key]: cur });
    const steps = TR; TR = Tsave; if (Tsave && steps !== Tsave) Tsave.push.apply(Tsave, steps); else if (!Tsave) await put({ ['bxTrace:' + y0.lid]: { ts: Date.now(), trace: steps } });
    return { updated: log, err: cur.err || null };
  }
  // ---------- Yahoo ----------
  async function yTeam(lid, tid, label) { const d = html(await req(`${YH}/nba/${lid}/${tid}/team`, null, label || 'Yahoo team page')); const r = root.YPARSE(d); if (!r) { trace(label || 'Yahoo team page', false, 'no roster form (signed out, or not your team)'); return null; } r.src = 'sync'; return r; }
  async function yOpp(lid, tid, week) {
    try { const t = await req(`${YH}/nba/${lid}/matchup?week=${week}&mid1=${tid}`, null, 'Yahoo next opponent');
      const m = t.match(new RegExp('mid1=' + tid + '(?:&|&amp;)mid2=(\\d+)')) || t.match(new RegExp('mid2=(\\d+)(?:&|&amp;)mid1=' + tid)); trace('Yahoo next opponent', !!m, m ? 'team ' + m[1] : 'not found'); return m ? m[1] : null; } catch (e) { return null; }
  }
  // Yahoo's own ranking of each player on a team page (Current, else Pre-Season): what other managers see when judging a trade
  function parseRanks(d) { const out = {}; [...d.querySelectorAll('table')].filter(t => /Pre-Season/.test((t.querySelector('thead') || {}).textContent || '')).forEach(tb => {
      const hd = [...[...tb.querySelectorAll('thead tr')].pop().querySelectorAll('th')].map(th => (th.textContent || '').replace(/\s+/g, ' ').trim()); const iC = hd.indexOf('Current'), iP = hd.indexOf('Pre-Season');
      tb.querySelectorAll('tbody tr').forEach(tr => { const a = tr.querySelector('a.name, .ysf-player-name a'); if (!a) return; const tds = tr.querySelectorAll('td'); const num = i => i >= 0 && tds[i] ? +((tds[i].textContent || '').replace(/[^\d]/g, '')) || null : null;
        const r = num(iC) || num(iP); if (r) out[(a.getAttribute('title') || a.textContent || '').trim()] = r; }); }); return out; }
  // every team's roster (names + Yahoo ids) for league-wide category strength
  async function yLeague(lid, teams) {
    const out = [];
    for (const tm of teams) {
      try { const d = html(await req(`${YH}/nba/${lid}/${tm.tid}`, null, 'Yahoo roster ' + tm.tid));
        const names = [...d.querySelectorAll('a.name, .ysf-player-name a')].map(a => (a.getAttribute('title') || a.textContent || '').trim()).filter(n => n && n.length > 3);
        // each player's Yahoo id (for opening a suggested trade on Yahoo with the players already ticked)
        const yids = {}; d.querySelectorAll('a.name, .ysf-player-name a').forEach(a => { const n = (a.getAttribute('title') || a.textContent || '').trim(); const m = (a.getAttribute('data-ys-playerid') || '').match(/\d+/) || (a.getAttribute('href') || '').match(/players\/(\d+)/); if (n && m) yids[n] = m[1] || m[0]; });
        out.push({ tid: tm.tid, name: tm.name, players: [...new Set(names)].slice(0, 20), ranks: parseRanks(d), yids }); } catch (e) { out.push({ tid: tm.tid, name: tm.name, players: [], err: e.message }); }
      await new Promise(z => setTimeout(z, 250));
    }
    trace('Yahoo league rosters', out.filter(t => t.players.length >= 10).length >= teams.length - 1, out.map(t => t.tid + ':' + t.players.length).join(' '));
    return out;
  }
  // every team's adds/drops from Yahoo's transactions page. Each row has one icon per player ("Added Player",
  // "Dropped Player", "Traded Player"), the players in the same order, the team, and a timestamp like "Oct 18, 7:15 am".
  const MON = 'JanFebMarAprMayJunJulAugSepOctNovDec';
  function txWhen(w) { const m = (w || '').match(/([A-Z][a-z]{2}) (\d{1,2}),? (\d{1,2}):(\d{2}) ?([ap]m)/i); if (!m) return null; const mo = MON.indexOf(m[1]) / 3; if (mo < 0 || mo % 1) return null;
    const t = usToday(); let yr = +t.slice(0, 4); if (mo > +t.slice(5, 7)) yr--; let h = +m[3] % 12; if (/pm/i.test(m[5])) h += 12;
    return { date: yr + '-' + String(mo + 1).padStart(2, '0') + '-' + String(+m[2]).padStart(2, '0'), mins: h * 60 + +m[4] }; }
  function parseTx(d, lid) { const rows = [];
    d.querySelectorAll('tr').forEach(tr => {
      const icons = [...tr.querySelectorAll('[title="Added Player"], [title="Dropped Player"], [title="Traded Player"]')].map(e => e.getAttribute('title').split(' ')[0].toLowerCase()); if (!icons.length) return;
      const blocks = [...tr.querySelectorAll('td div.Pbot-xs')].filter(b => b.querySelector('a[href*="/nba/players/"]'));
      const teams = [...tr.querySelectorAll('a.Tst-team-name, a[href]')].map(a => (a.getAttribute('href') || '').match(new RegExp('/nba/' + lid + '/(\\d+)/?$'))).filter(Boolean).map(m => m[1]);
      const ts = (tr.querySelector('.F-timestamp') || {}).textContent || ''; const w = txWhen(ts.replace(/\s+/g, ' ').trim()); const tid = teams[0]; if (!tid || !w) return;
      blocks.forEach((b, i) => { const a = b.querySelector('a[href*="/nba/players/"]'); const name = (a.textContent || '').trim(); const kind = icons[i] || icons[0]; const how = ((b.querySelector('h6') || {}).textContent || '').trim();
        const pm = (a.getAttribute('href') || '').match(/players\/(\d+)/); if (!name || kind === 'traded') return;
        rows.push({ tid, players: [name], pid: pm ? pm[1] : null, add: kind === 'added', drop: kind === 'dropped', date: w.date, mins: w.mins, when: ts.trim(), src: how }); }); });
    return rows; }
  async function yTransactions(lid) {
    try { const d = html(await req(`${YH}/nba/${lid}/transactions`, null, 'Yahoo transactions')); const rows = parseTx(d, lid);
      trace('Yahoo transactions read', rows.length > 0, rows.length + ' moves' + (rows.length ? ', newest ' + rows[0].when : ''));
      // if Yahoo changes the layout, keep a small anonymous sample of the page structure for the diagnostics report
      const sample = rows.length ? null : [...d.querySelectorAll('tr')].slice(0, 6).map(tr => tr.outerHTML.replace(/<(img|svg|script)[^>]*>/g, '').replace(/\s+/g, ' ').slice(0, 600));
      return { ts: Date.now(), rows, src: rows.length ? 'page' : 'none', sample };
    } catch (e) { return { ts: Date.now(), rows: [], err: e.message, src: 'none' }; }
  }
  // this week's category totals from Yahoo's matchup page (the same numbers the API scoreboard gives)
  const MKEY = { 'FG%': 'fg%', 'FT%': 'ft%', '3PTM': '3', 'PTS': 'p', 'REB': 'r', 'AST': 'a', 'ST': 's', 'STL': 's', 'BLK': 'b', 'TO': 'to', 'DD': '2d', 'FGM': 'fg', 'FTM': 'ft' };
  function parseLive(d, lid) { const tb = [...d.querySelectorAll('table')].find(t => /FG%|PTS|REB/.test((t.querySelector('thead') || {}).textContent || '') && t.querySelectorAll('tbody tr').length === 2 && !t.id); if (!tb) return null;
    const hd = [...tb.querySelectorAll('thead th')].map(th => (th.textContent || '').replace(/\*/g, '').trim());
    const teams = [...tb.querySelectorAll('tbody tr')].map(tr => { const tds = [...tr.querySelectorAll('td')]; const a = tr.querySelector('a[href*="/nba/' + lid + '/"]'); const m = a && (a.getAttribute('href') || '').match(/\/nba\/\d+\/(\d+)/);
      const o = { tid: m ? m[1] : null, name: a ? (tr.querySelector('span a') || a).textContent.trim() : '', st: {} };
      hd.forEach((h, i) => { const v = ((tds[i] || {}).textContent || '').trim(); if (!v || v === '-' || v === '-/-') return;
        if (h === 'FGM/A' || h === 'FTM/A') { const [x, y] = v.split('/').map(Number); if (isNaN(x) || isNaN(y)) return; if (h === 'FGM/A') { o.st.fg = x; o.st.fga = y; } else { o.st.ft = x; o.st.fta = y; } }
        else if (MKEY[h] && !isNaN(+v)) o.st[MKEY[h]] = +v; });
      // some leagues show FGM and FG% but not attempts: attempts = made / percentage (needed for the percentage maths)
      if (o.st.fg != null && o.st.fga == null && o.st['fg%'] > 0) o.st.fga = Math.round(o.st.fg / o.st['fg%']);
      if (o.st.ft != null && o.st.fta == null && o.st['ft%'] > 0) o.st.fta = Math.round(o.st.ft / o.st['ft%']);
      o.score = +((tds[tds.length - 1] || {}).textContent || '').trim() || 0; return o; });
    // Yahoo's games count for each side (first team on the page = mid1 = you): played / possible, and remaining
    const rg = d.getElementById('remaining-games'); if (rg && teams.length === 2) { const n = [...rg.querySelectorAll('span')].map(x => (x.textContent || '').trim()).filter(x => /^\d+(\/\d+)?$/.test(x));
      if (n.length >= 4) { const pp = x => { const [a, b] = x.split('/').map(Number); return { played: a, total: b }; }; const a = pp(n[1]), b = pp(n[2]);
        teams[0].games = { played: a.played, total: a.total, remaining: +n[0] }; teams[1].games = { played: b.played, total: b.total, remaining: +n[3] }; } }
    return teams.every(t => t.tid) ? teams : null; }
  async function yLive(y) {
    // without a week number Yahoo opens the current week, so live totals keep coming even when the roster read had no week
    const d = html(await req(`${YH}/nba/${y.lid}/matchup?${y.week ? 'week=' + y.week + '&' : ''}mid1=${y.tid}`, null, 'Yahoo matchup page')); const teams = parseLive(d, y.lid);
    const wk = y.week || (() => { const m = ((d.querySelector('#matchup-wall-header, .matchup-nav, [class*="week"]') || d.body || {}).textContent || '').match(/Week\s+(\d+)/); return m ? +m[1] : null; })();
    if (!teams) { trace('Yahoo live totals', false, 'category table not found'); return null; }
    const me = teams.find(t => String(t.tid) === String(y.tid)), op = teams.find(t => String(t.tid) !== String(y.tid)); if (!me || !op) return null;
    trace('Yahoo live totals', true, 'week ' + wk + ' · ' + Object.keys(me.st).length + ' stats · ' + me.score + '–' + op.score); return { me, op, week: wk };
  }
  // league settings from Yahoo's Settings page (the official rules): scoring type, weekly adds, waivers, playoffs, roster spots
  function parseSettings(d) { const o = {}; d.querySelectorAll('table tr').forEach(tr => { const c = [...tr.querySelectorAll('td, th')].map(x => (x.textContent || '').replace(/\s+/g, ' ').trim()); if (c.length === 2 && c[0].length < 60) o[c[0].replace(/:$/, '')] = c[1]; });
    if (!o['Scoring Type']) return null; const po = (o['Playoffs'] || '').match(/(\d+) teams - Weeks? ([\d, and]+)/); const weeks = po ? po[2].match(/\d+/g).map(Number) : [];
    const pos = (o['Roster Positions'] || '').split(',').map(x => x.trim()).filter(Boolean);
    return { ts: Date.now(), scoring: /Categories/i.test(o['Scoring Type']) ? 'cats' : /One Win|Most/i.test(o['Scoring Type']) ? 'win' : o['Scoring Type'], scoringText: o['Scoring Type'],
      addLimit: +(o['Max Acquisitions per Week'] || '').match(/\d+/) || null, waiverDays: /No waivers/i.test(o['Waiver Time'] || '') ? 0 : (+((o['Waiver Time'] || '').match(/\d+/) || [])[0] || null),
      poTeams: po ? +po[1] : null, poWeeks: weeks, poEndText: ((o['Playoffs'] || '').match(/ends ([^)]+)/) || [])[1] || null, tiebreak: o['Playoff Tie-Breaker'] || null, tradeEnd: o['Trade End Date'] || null,
      ilSlots: pos.filter(x => /^IL/.test(x)).length, bench: pos.filter(x => x === 'BN').length, slots: pos.filter(x => x !== 'BN' && !/^IL/.test(x)), cats: o['Players Stat Categories'] || null }; }
  async function ySettings(lid) { const d = html(await req(`${YH}/nba/${lid}/settings`, null, 'Yahoo league settings')); const st = parseSettings(d);
    trace('Yahoo settings read', !!st, st ? st.scoringText + ' · ' + st.addLimit + ' adds a week · playoffs weeks ' + st.poWeeks.join(', ') : 'settings table not found'); return st; }
  // league table from the league home page: record, rank order, waiver order and season moves per team
  function parseStand(d, lid) { const tb = [...d.querySelectorAll('table')].find(t => /W-L-T/.test((t.querySelector('tr') || {}).textContent || '')); if (!tb) return null;
    const hd = [...tb.querySelectorAll('tr')[0].querySelectorAll('th')].map(th => (th.textContent || '').trim());
    const ix = n => hd.findIndex(h => h === n);
    const teams = [...tb.querySelectorAll('tr[data-target], tr')].filter(tr => tr.querySelector('td')).map((tr, i) => { const tds = [...tr.querySelectorAll('td')]; const a = [...tr.querySelectorAll('a[href]')].find(x => new RegExp('/nba/' + lid + '/\\d+$').test(x.getAttribute('href') || ''));
      const tid = a ? a.getAttribute('href').split('/').pop() : null; const cell = n => ix(n) >= 0 ? ((tds[ix(n)] || {}).textContent || '').trim() : '';
      const [w, l, t] = cell('W-L-T').split('-').map(Number); return { tid, name: a ? [...tr.querySelectorAll('a[href]')].map(x => x.textContent.trim()).filter(Boolean)[0] || '' : '', rank: i + 1, w: w || 0, l: l || 0, t: t || 0, pct: +cell('Pct') || 0, gb: cell('GB'), waiver: +cell('Waiver') || null, moves: +cell('Moves') || 0 }; }).filter(t => t.tid);
    return teams.length >= 4 ? teams : null; }
  async function yStand(lid) {
    const d = html(await req(`${YH}/nba/${lid}`, null, 'Yahoo league page')); const teams = parseStand(d, lid);
    trace('Yahoo standings read', !!teams, teams ? teams.length + ' teams' : 'standings table not found'); return teams ? { ts: Date.now(), teams, src: 'page' } : null;
  }
  // ---------- NBA schedule (public JSON) ----------
  const TRI = { NOP: 'NOR', PHX: 'PHO', SAS: 'SAS', GSW: 'GSW', NYK: 'NYK', BKN: 'BKN', UTA: 'UTA' }; // NBA -> BBM style
  async function nbaSchedule() {
    const t = await req(NBA, { credentials: 'omit' }, 'NBA schedule'); const j = JSON.parse(t); const by = {};
    ((j.leagueSchedule || {}).gameDates || []).forEach(gd => (gd.games || []).forEach(g => {
      const dt = (g.gameDateEst || gd.gameDate || '').slice(0, 10).replace(/^(\d{2})\/(\d{2})\/(\d{4}).*/, '$3-$1-$2'); if (!dt || (g.gameLabel || '').match(/Preseason/i) || (g.gameId || '').startsWith('001')) return;
      [g.homeTeam, g.awayTeam].forEach(tm => { if (!tm || !tm.teamTricode) return; const k = TRI[tm.teamTricode] || tm.teamTricode; (by[k] = by[k] || []).push(dt); }); }));
    Object.keys(by).forEach(k => by[k] = [...new Set(by[k])].sort());
    trace('NBA schedule read', Object.keys(by).length >= 30, Object.keys(by).length + ' teams, ' + (by.LAL || []).length + ' Lakers games'); return { ts: Date.now(), by };
  }
  // ---------- BBM player news (injury status + notes); public page, merged into a rolling 14-day store ----------
  async function bbmNews(prev) {
    const d = html(await req('https://basketballmonster.com/playernews.aspx', null, 'BBM player news')); const now = Date.now(); const items = [];
    const links = [...d.querySelectorAll('a[href]')].filter(a => /playerinfo\.aspx\?i=\d+/i.test(a.getAttribute('href') || ''));
    links.forEach(a => {
      const id = (a.getAttribute('href').match(/i=(\d+)/i) || [])[1];
      // the news block: the nearest ancestor that holds this player link only, plus an age like 7.3h / 1.3d
      let el = a.parentElement, blk = null;
      for (let i = 0; i < 8 && el && el !== d.body; i++, el = el.parentElement) { const n = [...el.querySelectorAll('a[href]')].filter(x => /playerinfo\.aspx/i.test(x.getAttribute('href') || '')).length; if (n > 1) break; if (/\b\d+(?:\.\d+)?\s*[mhd]\b/.test(el.textContent || '')) blk = el; }
      if (!blk) return;
      const leaves = [...blk.querySelectorAll('*')].filter(e => !e.children.length).map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
      const ageL = leaves.find(x => /^\d+(?:\.\d+)?\s*[mhd]$/.test(x)) || ((blk.textContent || '').match(/\b(\d+(?:\.\d+)?\s*[mhd])\b/) || [])[1] || '';
      const am = ageL.match(/(\d+(?:\.\d+)?)\s*([mhd])/); const ageH = am ? +am[1] * ({ m: 1 / 60, h: 1, d: 24 }[am[2]]) : null;
      const ST_RE = /^(OUT FOR SEASON|OUT INDEFINITELY|OUT|DOUBTFUL|QUESTIONABLE|PROBABLE|GTD|DAY-TO-DAY|SUSPENDED|NOTE|ACTIVE|AVAILABLE)$/i;
      const status = (leaves.find(x => ST_RE.test(x) && x === x.toUpperCase()) || leaves.find(x => ST_RE.test(x)) || '').toUpperCase();
      const hl = leaves.find(x => /^[A-Za-z -]+ - [A-Za-z]+ - .{0,40}$/.test(x)); const hp = hl ? hl.split(' - ') : [];
      const name = (a.textContent || '').trim();
      const text = leaves.filter(x => x.length > 25 && x !== hl && x.indexOf(name) !== 0 && !/^https?:/.test(x)).sort((x, y) => y.length - x.length)[0] || '';
      items.push({ bbm: id, name, status, cat: hp[1] || '', detail: (hp[2] || '').trim(), text, ts: ageH != null ? Math.round(now - ageH * 3600e3) : now });
    });
    const seen = new Set(); const merged = items.concat((prev && prev.items) || []).filter(x => now - x.ts < 14 * 864e5).filter(x => { const k = x.bbm + '|' + x.status + '|' + x.text.slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
    trace('BBM player news read', items.length > 0, items.length + ' items, ' + merged.length + ' kept (14 days)'); return { ts: now, items: merged };
  }
  // ---------- one league ----------
  // ---- the whole league, week by week (Yahoo pages) ----
  // every pairing in one week, read from the league home page's Matchups module ("View matchup" links)
  function parsePairs(t, lid, week) { t = String(t || '').replace(/\\\//g, '/').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&');
    const re = new RegExp('/nba/' + lid + '/matchup\\?week=' + week + '&mid1=(\\d+)&mid2=(\\d+)', 'g'); const seen = new Set(), out = []; let m;
    while ((m = re.exec(t))) { const k = [m[1], m[2]].sort((a, b) => a - b).join('-'); if (!seen.has(k)) { seen.add(k); out.push([m[1], m[2]]); } } return out; }
  async function yPairs(lid, week) { const t = await req(`${YH}/nba/${lid}?matchup_week=${week}&module=matchups&lhst=matchups`, null, 'Yahoo week ' + week + ' matchups'); return parsePairs(t, lid, week); }
  // the regular-season schedule (who plays whom each week): read once, a few weeks per sync, and kept for the season
  // (if the league page won't show other weeks, your own matchup page for that week still names your opponent)
  async function ySched(lid, myTid, curWeek, lastWeek, nTeams, prev) {
    const out = { ts: Date.now(), weeks: Object.assign({}, (prev && prev.weeks) || {}), mine: Object.assign({}, (prev && prev.mine) || {}), last: lastWeek }; let n = 0, bad = 0;
    for (let w = Math.max(1, curWeek - 1); w <= lastWeek && n < 6; w++) { if ((out.weeks[w] && out.weeks[w].length) || out.mine[w]) continue; n++;
      try { const pr = await yPairs(lid, w); if (pr.length && (!nTeams || pr.length === Math.floor(nTeams / 2))) out.weeks[w] = pr;
        else { const o = await yOpp(lid, myTid, w); if (o) out.mine[w] = String(o); else bad++; } } catch (e) { bad++; } await sleep(300); }
    out.bad = bad; const have = new Set(Object.keys(out.weeks).concat(Object.keys(out.mine))).size; trace('Yahoo league schedule', bad === 0, have + ' weeks known' + (bad ? ', ' + bad + ' could not be read' : '')); return out; }
  // one finished week for every team: category totals, games and score from each matchup page
  // (with the pairings known, one page per matchup; otherwise each team's own matchup page, skipping teams already covered)
  async function yWeekAll(lid, week, pairs, tids) { const teams = {}; const todo = pairs && pairs.length ? pairs.map(p => p.map(String)) : (tids || []).map(t => [String(t)]);
    for (const [a, b] of todo) { if (teams[a]) continue; const d = html(await req(`${YH}/nba/${lid}/matchup?week=${week}&mid1=${a}${b ? '&mid2=' + b : ''}`, null, 'Yahoo week ' + week + ' matchup ' + a + (b ? ' v ' + b : ''))); const t = parseLive(d, lid);
      if (!t || t.length !== 2 || t.some(x => Object.keys(x.st).length < 5)) { trace('Yahoo league week ' + week, false, 'matchup for team ' + a + ' not readable'); return null; }
      t.forEach((x, i) => { teams[x.tid] = { name: x.name, st: x.st, score: x.score, games: x.games || null, opp: t[1 - i].tid }; }); await sleep(250); }
    const n = Object.keys(teams).length; if (tids && tids.length && n < tids.length) { trace('Yahoo league week ' + week, false, n + ' of ' + tids.length + ' teams'); return null; }
    trace('Yahoo league week ' + week, true, n + ' teams'); return { ts: Date.now(), week, teams }; }
  // Yahoo's Transaction Trends page for free agents in your league, most added first: Yahoo-wide adds and drops today,
  // % rostered, and the waiver date for players on waivers
  function parseTrend(d) { const tb = d.querySelector('table.Tst-table') || [...d.querySelectorAll('table')].find(t => /% Ros/.test((t.querySelector('thead') || {}).textContent || '')); if (!tb) return null;
    const hd = [...tb.querySelectorAll('thead th')].map(th => (th.textContent || '').replace(/\s+/g, ' ').trim()); const ix = n => hd.indexOf(n);
    const num = s => +String(s || '').replace(/[,%\s]/g, '') || 0; const t0 = usToday(); const players = {};
    tb.querySelectorAll('tbody tr').forEach(tr => { const tds = [...tr.querySelectorAll('td')]; const a = tr.querySelector('a.name, .ysf-player-name a'); if (!a) return; const n = (a.getAttribute('title') || a.textContent || '').trim(); if (!n) return;
      const cell = h => ix(h) >= 0 ? ((tds[ix(h)] || {}).textContent || '').replace(/\s+/g, ' ').trim() : '';
      const rs = cell('Roster Status'); const wm = rs.match(/W \(([A-Z][a-z]{2}) (\d{1,2})\)/); let wv = null;
      if (wm) { const mo = MON.indexOf(wm[1]) / 3; if (mo >= 0 && mo % 1 === 0) { let yr = +t0.slice(0, 4); const mk = y => y + '-' + String(mo + 1).padStart(2, '0') + '-' + String(+wm[2]).padStart(2, '0'); let dt = mk(yr);
        const gap = (new Date(dt) - new Date(t0)) / 864e5; if (gap < -180) dt = mk(yr + 1); else if (gap > 180) dt = mk(yr - 1); wv = dt; } }
      const tp = ((((tr.querySelector('.ysf-player-name') || {}).textContent || '').match(/\b([A-Z]{2,4}) - [A-Z]/) || [])[1] || ''); const pm = (a.getAttribute('href') || '').match(/players\/(\d+)/);
      const adds = num(cell('Adds')), drops = num(cell('Drops'));
      players[n] = { pct: num(cell('% Ros')), start: num(cell('% Start')), adds, drops, net: adds - drops, wv, fa: /^FA/.test(rs), team: tp || null, yid: pm ? pm[1] : null }; });
    const list = Object.entries(players).sort((a, b) => b[1].net - a[1].net); list.forEach(([n, v], i) => { v.rank = i + 1; v.hot = i < 10 && v.net > 0; });
    return list.length ? { ts: Date.now(), players, src: 'page' } : null; }
  async function yTrend(lid) { const d = html(await req(`${YH}/nba/${lid}/buzzindex?sort=BI_A&src=combined&bimtab=A&trendtab=O&pos=ALL`, null, 'Yahoo transaction trends')); const r = parseTrend(d);
    trace('Yahoo transaction trends', !!r, r ? Object.keys(r.players).length + ' free agents, most added ' + (Object.entries(r.players).find(([n, v]) => v.rank === 1) || ['?'])[0] : 'trends table not found'); return r; }
  // your own players on Yahoo's Transaction Trends page ("My Players"): how many Yahoo managers are adding and dropping each of
  // them, today and yesterday added together (a player being dropped all over Yahoo is an easy drop for a stream)
  async function yTrendMine(lid) { const out = {}; const t0 = usToday();
    for (const date of [t0, addDay(t0, -1)]) { try { const d = html(await req(`${YH}/nba/${lid}/buzzindex?sort=BI_D&src=combined&bimtab=MY&trendtab=O&pos=ALL&date=${date}`, null, 'Yahoo trends for your players'));
      const r = parseTrend(d); if (!r) continue; Object.entries(r.players).forEach(([n, v]) => { const o = out[n] || (out[n] = { adds: 0, drops: 0, pct: v.pct }); o.adds += v.adds; o.drops += v.drops; }); } catch (e) { trace('Yahoo trends for your players', false, e.message); } }
    trace('Yahoo trends for your players', Object.keys(out).length > 0, Object.keys(out).length + ' players'); return Object.keys(out).length ? { ts: Date.now(), players: out } : null; }
  // ---- Basketball Monster's Analysis Monster: projected H2H standings for the rest of the season ----
  // It counts only the games each team can actually start (bench players at the share of games BBM expects them to get, IR left out),
  // which is why it differs from the Projected Standings page (that one counts every rostered player's games).
  const AM = 'https://basketballmonster.com/analysismonster.aspx';
  function parseAM(d) { const head = [...d.querySelectorAll('.q-heading')].find(e => /Projected Standings/i.test(e.textContent || '')); if (!head) return null;
    let tb = head.closest('div'); tb = tb && tb.parentElement && tb.parentElement.querySelector('table'); if (!tb) return null;
    const hd = [...tb.querySelectorAll('thead th')].map(th => (th.textContent || '').replace(/\s+/g, ' ').trim()); const ix = n => hd.indexOf(n); if (ix('Win%') < 0) return null;
    const iBn = ix('bn g%'), iVal = ix('Value'); const cats = hd.slice(iBn + 1, iVal), vcats = hd.slice(iVal + 1).filter(h => /V$/.test(h));
    const num = s => { const t = String(s || '').replace(/[,%\s]/g, ''); return t === '' || isNaN(+t) ? null : +t; };
    const CK = { pts: 'p', '3': '3', reb: 'r', ast: 'a', stl: 's', blk: 'b', 'fg%': 'fg%', 'ft%': 'ft%', to: 'to', '2d': '2d', fg: 'fg', ft: 'ft' };
    const teams = [...tb.querySelectorAll('tbody tr')].map(tr => { const td = [...tr.querySelectorAll('td')]; if (td.length < hd.length - 1) return null;
      const name = (td[ix('Name')].textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim(); if (!name) return null;
      const me = !!td[ix('Name')].querySelector('[data-original-title="Your Team"], [title="Your Team"]');
      const vs = td[ix('You vs Team')]; const rec = ((vs && vs.querySelector('span') || {}).textContent || '').trim().match(/^(\d+)-(\d+)-(\d+)$/);
      // the coloured letters after the record: green means you're projected to win that category against them, red to lose it
      const vcat = {}; if (vs) [...vs.querySelectorAll('span')].slice(1).forEach(sp => { const k = CK[(sp.textContent || '').trim()] || (sp.textContent || '').trim(); const m = (sp.getAttribute('style') || '').match(/background-color:\s*#([0-9a-f]{6})/i); if (!m) return;
        const r = parseInt(m[1].slice(0, 2), 16), g = parseInt(m[1].slice(2, 4), 16); vcat[k] = g > r + 8 ? 1 : r > g + 8 ? -1 : 0; });
      const tot = {}; cats.forEach((c, i) => { tot[CK[c] || c] = num(td[iBn + 1 + i].textContent); });
      const val = {}; vcats.forEach((c, i) => { const k = c.replace(/V$/, ''); val[CK[k] || ({ p: 'p', r: 'r', a: 'a', s: 's', b: 'b' }[k]) || k] = num(td[iVal + 1 + i].textContent); });
      return { name, me, winPct: num(td[ix('Win%')].textContent), left: num(td[ix('Left')].textContent), vsMe: rec ? { w: +rec[1], l: +rec[2], t: +rec[3] } : null, vcat, tot, val, value: num(td[iVal].textContent) }; }).filter(Boolean);
    return teams.length >= 4 ? { ts: Date.now(), teams, cats: cats.map(c => CK[c] || c), src: 'analysismonster' } : null; }
  async function bbmStand(y0) { let d = await bbmOpen(AM, y0.league, 'Analysis Monster');
    // rest-of-season projections with the H2H table showing (BBM remembers these settings, so this only happens once)
    if (val(d, 'DateFilterControl') && val(d, 'DateFilterControl') !== 'RemainingProjections') d = await postAt(AM, d, { __EVENTTARGET: 'DateFilterControl', DateFilterControl: 'RemainingProjections' }, null, 'Analysis Monster rest of season');
    let r = parseAM(d); if (!r) { d = await postAt(AM, d, { StandingsControlH2H: 'on' }, null, 'Analysis Monster H2H standings'); r = parseAM(d); }
    trace('Analysis Monster standings', !!r, r ? r.teams.length + ' teams' : 'standings table not found'); if (!r) throw new Error('Analysis Monster standings not found'); return r; }
  // ---- Basketball Monster's Trade Monster: for each of your best players, every player in the league he could be swapped for,
  // with BBM's trade values and how much the swap changes your projected win rate and the other team's (1-for-1 only) ----
  const TM = 'https://basketballmonster.com/trademonster.aspx';
  function parseTM(d) { const head = [...d.querySelectorAll('.q-heading')].find(e => /^Trade:/i.test((e.textContent || '').trim())); if (!head) return null;
    const tb = head.parentElement && head.parentElement.querySelector('table'); if (!tb) return null; const num = s => { const t = String(s || '').replace(/[,%+\s]/g, '').replace('−', '-'); return t === '' || isNaN(+t) ? null : +t; };
    const pid = a => ((a && a.getAttribute('href') || '').match(/[?&]i=(\d+)/) || [])[1] || null; let give = null; const rows = [];
    tb.querySelectorAll('tbody tr').forEach(tr => { const td = [...tr.querySelectorAll('td')]; if (td.length < 6) return; const id = pid(td[5].querySelector('a[href*="playerinfo"]')); if (!id) return;
      if (!(td[0].textContent || '').trim().replace(/ /g, '')) { give = id; return; }
      rows.push({ id, diff: num(td[0].textContent), give: num(td[1].textContent), get: num(td[2].textContent), t1: num(td[3].textContent), t2: num(td[4].textContent), team: ((td[6] || {}).textContent || '').replace(/\s*\(\d+\)\s*$/, '').trim() }); });
    return give ? { give, rows } : null; }
  async function bbmTrades(y0, max) { const d0 = await bbmOpen(TM, y0.league, 'Trade Monster'); const out = {};
    // your players as Trade Monster lists them (best first); the first few are the ones worth asking about
    const mine = [...d0.querySelectorAll('select[name^="DD1"]')].map(s => s.getAttribute('name').slice(3)).filter(x => /^\d+$/.test(x)).slice(0, max || 8);
    for (const id of mine) { try { const r = parseTM(await postAt(TM, d0, { ['DD1' + id]: 'Trade' }, ['AnalyzeChangesButton', 'Analyze Trade'], 'Trade Monster ' + id)); if (r) out[r.give] = r.rows; } catch (e) { if (e.auth) throw e; trace('Trade Monster ' + id, false, e.message); } }
    trace('Trade Monster', Object.keys(out).length > 0, Object.keys(out).length + ' of ' + mine.length + ' players'); return { ts: Date.now(), by: out }; }
  // ---- is a player really available? Yahoo's player search shows his roster status in your league ----
  function parseStatus(d) { const tb = [...d.querySelectorAll('table')].find(t => /Roster Status/.test((t.querySelector('thead') || {}).textContent || '')); if (!tb) return null;
    const hr = [...tb.querySelectorAll('thead tr')].pop(); const hd = [...hr.querySelectorAll('th')].map(th => (th.textContent || '').replace(/\s+/g, ' ').trim()); const ix = hd.indexOf('Roster Status'); if (ix < 0) return null;
    return [...tb.querySelectorAll('tbody tr')].map(tr => { const a = tr.querySelector('a.name, .ysf-player-name a'); const tds = [...tr.querySelectorAll('td')]; if (!a || !tds[ix]) return null;
      const st = (tds[ix].textContent || '').replace(/\s+/g, ' ').trim(); const w = st.match(/^W \(([A-Z][a-z]{2}) (\d{1,2})\)/);
      return { name: (a.getAttribute('title') || a.textContent || '').trim(), status: /^FA/.test(st) ? 'FA' : w ? 'W' : st ? 'taken' : null, team: /^(FA|W)/.test(st) ? null : st, wv: w ? w[1] + ' ' + w[2] : null }; }).filter(x => x && x.status); }
  async function yAvail(lid, names) { const out = {};
    for (const n of names) { try { const d = html(await req(`${YH}/nba/${lid}/playersearch?&search=${encodeURIComponent(n)}`, null, 'Yahoo availability ' + n)); const rows = parseStatus(d) || [];
        const hit = rows.find(r => nk(r.name) === nk(n)) || (rows.length === 1 ? rows[0] : null); out[n] = hit ? { st: hit.status, team: hit.team, wv: hit.wv, ts: Date.now() } : { st: 'unknown', ts: Date.now() }; }
      catch (e) { if (e.auth) throw e; out[n] = { st: 'unknown', ts: Date.now(), err: e.message }; } await sleep(200); }
    const k = 'yavail:' + lid; const cur = ((await ST().get(k))[k]) || {}; const merged = Object.assign({}, cur, out); Object.keys(merged).forEach(n => { if (Date.now() - merged[n].ts > 24 * 3600e3) delete merged[n]; }); await put({ [k]: merged }); return out; }
  // ---------- projection scorecard: both sources' per-game projections before a Monday-to-Sunday week, and what players did ----------
  // order of the stored numbers: games, points, threes, rebounds, assists, steals, blocks, FG made, FG attempts, FT made, FT attempts, turnovers
  const PJ = ['p', '3', 'r', 'a', 's', 'b', 'fg', 'fga', 'ft', 'fta', 'to'];
  const RANK = 'https://basketballmonster.com/playerrankings.aspx';
  const num = x => { const v = parseFloat(String(x).replace(/[^0-9.-]/g, '')); return isNaN(v) ? 0 : v; };
  // Yahoo's "Next 7 Days (proj)" for every player on a team in the league, per game (Yahoo's own projections)
  async function yProj(lid, teams) { const out = {}; const pages = Math.ceil(Math.max(10, teams) * 16 / 25);
    for (let i = 0; i < pages; i++) { const d = html(await req(`${YH}/nba/${lid}/players?status=T&pos=P&cut_type=33&stat1=S_PS7&myteam=0&sort=AR&sdir=1&count=${i * 25}`, null, 'Yahoo projections ' + (i + 1)));
      const t = [...d.querySelectorAll('table')].find(x => /GP\*?/.test((x.querySelector('thead') || {}).textContent || '') && /PTS/.test((x.querySelector('thead') || {}).textContent || '')); if (!t) break;
      const head = [...t.querySelectorAll('thead tr:last-child th')].map(x => x.textContent.trim().replace(/\*$/, '')); const ix = k => head.indexOf(k);
      const rows = [...t.querySelectorAll('tbody tr')]; rows.forEach(r => { const c = [...r.querySelectorAll('td')]; const a = c[ix('Players')] && c[ix('Players')].querySelector('a.name, a[class*="name"]'); const name = a ? a.textContent.trim() : null; if (!name) return;
        const gp = num(c[ix('GP')] && c[ix('GP')].textContent); if (!gp) return; const fg = String(c[ix('FGM/A')] ? c[ix('FGM/A')].textContent : '').split('/').map(num), ft = String(c[ix('FTM/A')] ? c[ix('FTM/A')].textContent : '').split('/').map(num);
        const v = { p: num(c[ix('PTS')].textContent), 3: num(c[ix('3PTM')].textContent), r: num(c[ix('REB')].textContent), a: num(c[ix('AST')].textContent), s: num(c[ix('ST')].textContent), b: num(c[ix('BLK')].textContent), fg: fg[0] || 0, fga: fg[1] || 0, ft: ft[0] || 0, fta: ft[1] || 0, to: num(c[ix('TO')].textContent) };
        out[name] = [gp].concat(PJ.map(k => r3(v[k] / gp))); }); if (rows.length < 25) break; }
    return out; }
  // what every player did over a date range, from Basketball Monster's player rankings (totals); your page settings are put back after
  async function bbmRange(start, end) { let d = html(await bbmGet(RANK, 'Player rankings open'));
    const orig = { DateFilterControl: val(d, 'DateFilterControl'), PlayerFilterControl: val(d, 'PlayerFilterControl'), StatDisplayType: val(d, 'StatDisplayType'), DataSetControl: val(d, 'DataSetControl'), s: val(d, 'DateFilterControlSTART'), e: val(d, 'DateFilterControlEND') };
    const cur = (d.querySelector('[name=DataSetControl] option') || {}).getAttribute ? d.querySelector('[name=DataSetControl] option').getAttribute('value') : null; let out = null;
    try {
      if (cur && orig.DataSetControl !== cur) d = await postAt(RANK, d, { __EVENTTARGET: 'DataSetControl', DataSetControl: cur }, null, 'Player rankings this season');
      if (orig.DateFilterControl !== 'DateRange') d = await postAt(RANK, d, { __EVENTTARGET: 'DateFilterControl', DateFilterControl: 'DateRange' }, null, 'Player rankings date range');
      if (orig.PlayerFilterControl !== 'AllPlayers') d = await postAt(RANK, d, { __EVENTTARGET: 'PlayerFilterControl', PlayerFilterControl: 'AllPlayers' }, null, 'Player rankings all players');
      if (orig.StatDisplayType !== 'Total') d = await postAt(RANK, d, { __EVENTTARGET: 'StatDisplayType', StatDisplayType: 'Total' }, null, 'Player rankings totals');
      d = await postAt(RANK, d, { DateFilterControlSTART: start, DateFilterControlEND: end }, ['pageTitleRowRefresh', ''], 'Player rankings ' + start);
      if (val(d, 'DateFilterControlSTART') === start && val(d, 'StatDisplayType') === 'Total') { const t = [...d.querySelectorAll('table')].find(x => x.querySelectorAll('tr').length > 50);
        if (t) { const head = [...t.querySelector('tr').children].map(c => c.textContent.trim()); const ix = k => head.indexOf(k); out = {};
          [...t.querySelectorAll('tr')].slice(1).forEach(r => { const c = [...r.children].map(x => x.textContent.trim()); const n = c[ix('Name')]; const g = num(c[ix('g')]); if (!n || n === 'Name' || !g) return;
            const fga = num(c[ix('fga')]), fta = num(c[ix('fta')]); out[n] = [g, num(c[ix('pts')]), num(c[ix('3')]), num(c[ix('reb')]), num(c[ix('ast')]), num(c[ix('stl')]), num(c[ix('blk')]), Math.round(num(c[ix('fg%')]) * fga), fga, Math.round(num(c[ix('ft%')]) * fta), fta, num(c[ix('to')])]; }); } }
    } finally { // put your page settings back, in reverse
      try { if (orig.StatDisplayType && orig.StatDisplayType !== 'Total') d = await postAt(RANK, d, { __EVENTTARGET: 'StatDisplayType', StatDisplayType: orig.StatDisplayType }, null, 'Player rankings restore stats');
        if (orig.PlayerFilterControl && orig.PlayerFilterControl !== 'AllPlayers') d = await postAt(RANK, d, { __EVENTTARGET: 'PlayerFilterControl', PlayerFilterControl: orig.PlayerFilterControl }, null, 'Player rankings restore players');
        if (orig.DateFilterControl === 'DateRange' && orig.s) d = await postAt(RANK, d, { DateFilterControlSTART: orig.s, DateFilterControlEND: orig.e }, ['pageTitleRowRefresh', ''], 'Player rankings restore dates');
        else if (orig.DateFilterControl && orig.DateFilterControl !== 'DateRange') d = await postAt(RANK, d, { __EVENTTARGET: 'DateFilterControl', DateFilterControl: orig.DateFilterControl }, null, 'Player rankings restore view');
        if (orig.DataSetControl && cur && orig.DataSetControl !== cur) await postAt(RANK, d, { __EVENTTARGET: 'DataSetControl', DataSetControl: orig.DataSetControl }, null, 'Player rankings restore season');
      } catch (e) { trace('Player rankings restore', false, e.message); } }
    trace('Player rankings ' + start + '→' + end, !!out, out ? Object.keys(out).length + ' players' : 'no table'); return out; }
  // before a Monday (the Saturday and Sunday before it): log both projections; after a Sunday: log what happened (one week per sync)
  async function projLog(y, all, log) { const t0 = usToday(); const mon = addDay(mondayOf(t0), 7); const k = 'pjlog:' + y.lid + ':' + mon;
    if (t0 >= addDay(mon, -2) && (!all[k] || Date.now() - all[k].ts > 12 * 3600e3)) { const bx = all['bx:' + y.lid] || {}; const V = bx.views || {}; const nx = V.next || V.rest, ros = V.ros || {};
      if (nx) { log('projection scorecard'); const bbm = {}; const teams = ((all['ystand:' + y.lid] || {}).teams || []).length || 12; const yh = await yProj(y.lid, teams); const want = new Set(Object.keys(yh));
        Object.entries(nx).forEach(([id, r]) => { const n = (ros[id] || {}).n || r.n; if (!n || !want.has(n) || !r.st) return; const st = r.st; bbm[n] = [r.g || 0].concat(PJ.map(q => r3(q === 'fg' && st.fg == null && st.fgp != null ? st.fgp * (st.fga || 0) : q === 'ft' && st.ft == null && st.ftp != null ? st.ftp * (st.fta || 0) : st[q] || 0))); });
        if (Object.keys(yh).length > 30) await put({ [k]: { ts: Date.now(), start: mon, bbm, yh } }); } }
    const want = new Set(Object.keys(all).filter(q => q.startsWith('pjlog:' + y.lid + ':')).map(q => q.split(':').pop()));
    // the advice backtest needs the 4 weeks after each logged decision, whether or not the scorecard logged them
    (((all['advlog:' + y.lid] || {}).log) || []).forEach(e => { if (e.weekEnd) for (let i = 0; i < 4; i++) want.add(addDay(e.weekEnd, 1 + 7 * i)); });
    const done = [...want].filter(st => addDay(st, 6) < t0 && !all['pjact:' + st]).sort();
    if (done.length) { const st = done[0]; const tk = 'pjactTry:' + st; if (all[tk] && Date.now() - all[tk] < 6 * 3600e3) return; log('last week\'s results');
      const r = await bbmRange(st, addDay(st, 6)); await put(r ? { ['pjact:' + st]: { ts: Date.now(), start: st, by: r } } : { [tk]: Date.now() }); } }
  async function syncLeague(y0, mode, onStep) {
    if (lockBy) await put({ syncLock: { ts: Date.now(), by: lockBy } });
    TR = []; const st = { lid: y0.lid, league: y0.league, mode, ts: Date.now(), ok: false }; const log = s => onStep && onStep((y0.league || 'league') + ': ' + s);
    const all = await ST().get(null); st.via = 'pages';
    try {
      log('Yahoo'); let y;
      y = await yTeam(y0.lid, y0.tid);
      if (!y) { if (await yahooSignedOut()) throw authErr('yahoo', 'Yahoo signed you out'); throw new Error('Could not read your Yahoo team page'); }
      st.yOk = true; st.league = y.league || st.league; await put({ ['yr:' + y.lid]: y });
      const start = y.weekStart || mondayOf(y.date || usToday()), end = y.weekEnd || addDay(start, 6);
      // this week's Matchup Monster: if it fails (BBM down or showing no results), the Yahoo side of the sync still runs, and the
      // panel builds the week from BBM's projections instead
      log('this week'); let m;
      try { m = await bbmWeek({ league: y.league, myTid: y.tid, oppTid: y.oppTid, start, end, yNames: y.rows.map(r => r.name) }, 'This week');
        await put({ ['mmw:' + m.league + ':' + m.start]: m, ['mm:' + m.league]: m }); st.mmOk = true; st.this = { opp: m.opp }; }
      catch (e) { if (e.auth) throw e; st.mmErr = e.message; m = { league: strip(y.league), start, end, teams: null, failed: true }; }
      const old = (k, h) => !all[k] || Date.now() - (all[k].ts || 0) > (h || 6) * 3600e3;
      const nStart = y.next && y.next.start || addDay(end, 1), nEnd = y.next && y.next.end || addDay(nStart, 6);
      const nextKey = 'mmw:' + m.league + ':' + nStart;
      if (y.week && (mode === 'full' || old(nextKey))) {
        log('next week'); const on = y.next ? y.next.oppTid : await yOpp(y.lid, y.tid, y.week + 1);
        if (on) await put({ ['ynext:' + y.lid]: { week: (y.week || 0) + 1, oppTid: String(on), start: nStart, end: nEnd, ts: Date.now() } });
        if (on) { try { const n = await bbmWeek({ league: y.league, myTid: y.tid, oppTid: on, start: nStart, end: nEnd }, 'Next week'); await put({ [nextKey]: n }); st.next = { opp: n.opp }; } catch (e) { st.nextErr = e.message; } }
        else st.nextErr = 'next opponent not found on Yahoo';
      }
      if (mode === 'full') {
        if (old('lgscan:' + y.lid)) { log('league rosters'); let teams = null;
          { const tl = m.teams && m.teams.length ? m.teams : ((all['ystand:' + y.lid] || {}).teams || []).map(t => ({ tid: String(t.tid), name: t.name })); if (tl.length) teams = await yLeague(y.lid, tl); }
          if (teams) await put({ ['lgscan:' + y.lid]: { ts: Date.now(), league: y.league, teams, myTid: y.tid } }); }
        // last week's result for the track record (once, after the week ends)
        const prev = (y.weeks || []).find(w => w.end === addDay(start, -1)); const pStart = prev ? prev.start : addDay(start, -7), pEnd = prev ? prev.end : addDay(start, -1), tk = 'track:' + m.league + ':' + pStart;
        if (all[tk] && !all[tk].actual) { try { log('last week result'); const lw = await bbmWeek({ league: y.league, myTid: y.tid, oppTid: all[tk].oppTid, start: pStart, end: pEnd, noImport: true }, 'Last week');
          const me = lw.totals[lw.me] || {}, op = lw.totals[lw.opp] || {}; const actual = {}; lw.cats.forEach(c => { if (me[c] == null || op[c] == null) return; actual[c] = c === 'to' ? (me[c] < op[c] ? 1 : me[c] > op[c] ? 0 : 0.5) : (me[c] > op[c] ? 1 : me[c] < op[c] ? 0 : 0.5); });
          await put({ [tk]: Object.assign({}, all[tk], { actual, final: { me, op }, ts2: Date.now() }) }); } catch (e) { trace('Last week', false, e.message); } }
      }
      // transactions (adds this week, opponent moves), live totals, settings, the league table and trends come from Yahoo's pages
      {
        if (old('tx:' + y.lid, 0.15)) { log('transactions'); const tx = await yTransactions(y.lid); if (tx.rows.length || !all['tx:' + y.lid] || (all['tx:' + y.lid].src !== 'page')) await put({ ['tx:' + y.lid]: tx }); }
        { try { const lv = await yLive(y); if (lv && (lv.week || y.week)) await put({ ['ylive:' + y.lid]: { ts: Date.now(), week: lv.week || y.week, start, end, status: 'live', me: lv.me, opp: lv.op, src: 'page' } }); else if (!lv) trace('Yahoo live totals', false, 'no totals on the matchup page'); } catch (e) { trace('Yahoo live totals', false, e.message); } }
        // last week's final result, straight from Yahoo's matchup page (once per week): feeds the track record and teaches the
        // co-pilot how sure its forecasts should be
        if (y.week > 1) { const pStart = addDay(start, -7), tk = 'track:' + m.league + ':' + pStart, rk = 'h2hres:' + y.lid + ':' + pStart;
          if (all[tk] && !all[tk].actual) { try { const lw = await yLive(Object.assign({}, y, { week: y.week - 1 }));
            if (lw && Object.keys(lw.me.st).length >= 5) { const cats = Object.keys((all[tk].first || all[tk].last || {}).cats || {}); const actual = {};
              const val = (st, c) => c === 'fg%' ? (st['fg%'] != null ? st['fg%'] : st.fga ? st.fg / st.fga : null) : c === 'ft%' ? (st['ft%'] != null ? st['ft%'] : st.fta ? st.ft / st.fta : null) : st[c];
              cats.forEach(c => { const a = val(lw.me.st, c), b = val(lw.op.st, c); if (a == null || b == null) return; actual[c] = c === 'to' ? (a < b ? 1 : a > b ? 0 : 0.5) : (a > b ? 1 : a < b ? 0 : 0.5); });
              if (Object.keys(actual).length >= cats.length - 1) { await put({ [tk]: Object.assign({}, all[tk], { actual, final: { me: lw.me.st, op: lw.op.st, score: [lw.me.score, lw.op.score], meGames: lw.me.games || null, opGames: lw.op.games || null }, ts2: Date.now() }), [rk]: { ts: Date.now(), start: pStart, me: lw.me.st, opp: lw.op.st } });
                trace('Last week result', true, 'week ' + (y.week - 1) + ' · ' + lw.me.score + '–' + lw.op.score); } } } catch (e) { trace('Last week result', false, e.message); } } }
        if (old('ysetp:' + y.lid, 7 * 24)) { try { const sp = await ySettings(y.lid); if (sp) await put({ ['ysetp:' + y.lid]: sp }); } catch (e) { trace('Yahoo league settings', false, e.message); } }
        if (mode === 'full' || old('ystand:' + y.lid, 6) || (all['ystand:' + y.lid] || {}).week !== y.week) { try { const sd = await yStand(y.lid); if (sd) { sd.week = y.week || null; await put({ ['ystand:' + y.lid]: sd }); } } catch (e) { trace('Yahoo standings', false, e.message); } }        if (old('ytrend:' + y.lid, 3)) { try { log('trends'); const tr = await yTrend(y.lid); if (tr) await put({ ['ytrend:' + y.lid]: tr }); } catch (e) { trace('Yahoo transaction trends', false, e.message); } }
        if (old('ytrendMy:' + y.lid, 3)) { try { const tm = await yTrendMine(y.lid); if (tm) await put({ ['ytrendMy:' + y.lid]: tm }); } catch (e) { trace('Yahoo trends for your players', false, e.message); } }
        if (old('bbmstand:' + y.lid, 12)) { try { log('projected standings'); const sd = await bbmStand(y); await put({ ['bbmstand:' + y.lid]: sd }); } catch (e) { trace('Analysis Monster standings', false, e.message); } } // never stops the rest of the sync
        if (old('bbmtm:' + y.lid, 24)) { try { log('Trade Monster'); const tm = await bbmTrades(y); if (Object.keys(tm.by).length) await put({ ['bbmtm:' + y.lid]: tm }); } catch (e) { trace('Trade Monster', false, e.message); } }
      }
      // the league week by week: the regular-season schedule (once) and every team's category results for each finished week
      if (y.week) { try {
        const sp = all['ysetp:' + y.lid] || (await ST().get('ysetp:' + y.lid))['ysetp:' + y.lid] || {}; const lastReg = ((sp.poWeeks || [])[0] || 19) - 1;
        const nTeams = ((all['ystand:' + y.lid] || {}).teams || []).length || ((m.teams || []).length) || 0; let sch = all['ysched:' + y.lid];
        const need = w => !(sch && ((sch.weeks && sch.weeks[w] && sch.weeks[w].length) || (sch.mine && sch.mine[w])));
        let missing = false; for (let w = Math.max(1, y.week - 1); w <= lastReg; w++) if (need(w)) { missing = true; break; }
        if (missing && (!sch || Date.now() - (sch.ts || 0) > (sch.bad ? 24 : 1) * 3600e3 || (mode === 'full' && !sch.bad))) { log('league schedule'); sch = await ySched(y.lid, y.tid, y.week, lastReg, nTeams, sch); await put({ ['ysched:' + y.lid]: sch }); }
        for (let w = 1; w < y.week; w++) { const k = 'lgweek:' + y.lid + ':' + w; if (all[k]) continue;
          let pr = sch && sch.weeks && sch.weeks[w]; if ((!pr || !pr.length) && !(sch && sch.mine && sch.mine[w])) { pr = await yPairs(y.lid, w); if (pr.length) { sch = Object.assign({ ts: Date.now(), weeks: {} }, sch); sch.weeks = Object.assign({}, sch.weeks, { [w]: pr }); await put({ ['ysched:' + y.lid]: sch }); } }
          const tk = 'lgwkTry:' + y.lid, tr = all[tk]; if (tr && tr.w === w && Date.now() - tr.ts < 2 * 3600e3) break; // a failed read waits 2 hours before trying again
          const tids = ((all['ystand:' + y.lid] || (await ST().get('ystand:' + y.lid))['ystand:' + y.lid] || {}).teams || []).map(t => String(t.tid));
          if ((pr && pr.length) || tids.length >= 4) { log('league week ' + w); const lw = await yWeekAll(y.lid, w, pr, tids); if (lw) await put({ [k]: lw, [tk]: null }); else await put({ [tk]: { w, ts: Date.now() } }); }
          else await put({ [tk]: { w, ts: Date.now() } });
          break; } // one finished week per sync
      } catch (e) { trace('Yahoo league weeks', false, e.message); } }
      // the projection scorecard (Basketball Monster against Yahoo, against what players did); never stops the rest of the sync
      try { await projLog(y, Object.assign({}, all, await ST().get(null)), log); } catch (e) { trace('Projection scorecard', false, e.message); }
      // the NBA schedule (every team's game dates for the season): fetched whenever it's missing or 3 days old
      // the NBA schedule ships with the add-on (it doesn't change); once a week the sync also tries NBA's own file, which adds
      // the NBA Cup knockout games once they're set. If NBA's site refuses, nothing changes and nothing is reported.
      const okS = x => x && x.by && Object.keys(x.by).length >= 30;
      if (!okS(all.nbasched) && okS(root.NBA_SCHED)) await put({ nbasched: root.NBA_SCHED, nbaErr: null });
      if (mode === 'full' && (!all.nbaTry || Date.now() - all.nbaTry > 7 * 864e5)) { await put({ nbaTry: Date.now() }); try { const s2 = await nbaSchedule(); if (okS(s2)) await put({ nbasched: Object.assign(s2, { src: 'nba' }) }); } catch (e) {} }
      // your opponent's moves this week: a heads-up the first time each one is seen
      try { const tx = (await ST().get('tx:' + y.lid))['tx:' + y.lid]; const prevSeen = all['oppSeen:' + y.lid] || {}; const seen = Object.assign({}, prevSeen); const news = [];
        if (tx && tx.rows && y.oppTid) tx.rows.filter(r => String(r.tid) === String(y.oppTid) && r.add && r.date && r.date >= start && r.date <= end).forEach(r => { const k = (r.ts || r.date) + '|' + r.players[0]; if (seen[k]) return; seen[k] = Date.now(); news.push(r.players[0]); });
        if (news.length) { const first = !Object.keys(prevSeen).length; await put({ ['oppSeen:' + y.lid]: seen });
          if (!first) { const msg = (y.oppName || 'Your opponent') + ' added ' + news.join(', ') + '. The matchup numbers include them from the next sync.'; const al = (all.alerts || []).filter(a => Date.now() - a.ts < 36 * 3600e3).concat([{ key: 'opp|' + Date.now(), league: y.league, title: y.league + ': opponent move', msg, ts: Date.now(), kind: 'opp' }]).slice(-20); await put({ alerts: al }); try { root.NOTIFY && root.NOTIFY('opp|' + y.lid + '|' + Date.now(), y.league + ': opponent move', msg); } catch (e) {} } } } catch (e) {}
    } catch (e) { st.err = e.message; if (e.auth) st.auth = e.auth; }
    try { log('projections'); st.bx = await bx(y0); } catch (e) { trace('BBM exports', false, e.message); }
    // a sync counts as good when Yahoo was read and no sign-in is needed: a Matchup Monster failure is covered by BBM's projections
    st.ok = !!(st.yOk && !st.auth && !st.err); st.ts = Date.now(); st.trace = TR; TR = null;
    const entry = { lid: st.lid, league: st.league, mode, via: st.via, ts: st.ts, ok: st.ok, mmOk: !!st.mmOk, err: st.err || st.mmErr || null, nextErr: st.nextErr || null, trace: st.trace };
    const diag = (all.diag || []).concat([entry]).slice(-8); const o = { ['sync:' + y0.lid]: st, diag }; if (mode === 'full') o['diagFull:' + y0.lid] = entry; // the last full sync is kept so its trace isn't pushed out
    // health: when each league last synced cleanly, failures in a row, and any sign-in that needs you
    const hp = (await ST().get('health')).health || {}; const H = { lastGood: Object.assign({}, hp.lastGood), fails: Object.assign({}, hp.fails), auth: Object.assign({}, hp.auth), notified: Object.assign({}, hp.notified) };
    if (st.ok) { H.lastGood[st.lid] = st.ts; H.fails[st.lid] = 0; } else H.fails[st.lid] = (H.fails[st.lid] || 0) + 1;
    if (st.yOk) H.auth.yahoo = null; if (st.mmOk || (st.bx && !st.bx.err)) H.auth.bbm = null;
    if (st.auth) { const fresh = !H.auth[st.auth]; H.auth[st.auth] = H.auth[st.auth] || Date.now();
      if (fresh && Date.now() - (H.notified[st.auth] || 0) > 12 * 3600e3) { H.notified[st.auth] = Date.now(); try { root.NOTIFY && root.NOTIFY('auth-' + st.auth, st.auth === 'bbm' ? 'Basketball Monster signed you out' : 'Yahoo signed you out', st.auth === 'bbm' ? 'Click to sign in again. Saving your BBM sign-in in the co-pilot settings stops this happening.' : 'Click to sign in again (tick "Stay signed in"). The co-pilot carries on by itself once you have.'); } catch (e) {} } }
    o.health = H; if (st.yOk) { const ll = (all.leagueList || []).filter(l => l.lid !== st.lid); const yr = (await ST().get('yr:' + st.lid))['yr:' + st.lid]; if (yr) ll.push({ lid: yr.lid, tid: yr.tid, league: yr.league }); o.leagueList = ll; }
    await put(o); return st;
  }
  let running = null, lockBy = null;
  async function syncAll(leagues, mode, onStep) { if (running) return running; running = (async () => { const out = []; for (const y of leagues) out.push(await syncLeague(y, mode || 'full', onStep)); return out; })(); try { return await running; } finally { running = null; } }
  // ---------- late-scratch alerts: a starter today ruled out in BBM news -> notification with the bench swap ----------
  const ALERT_RE = /^(OUT|OUT FOR SEASON|OUT INDEFINITELY|DOUBTFUL|SUSPENDED)$/;
  async function newsCheck(opt) {
    opt = opt || {}; const all = await ST().get(null); let news = all.bbmnews;
    if (!news || Date.now() - news.ts > (opt.maxAgeMin || 12) * 60e3) { const t0 = TR; TR = []; try { news = await bbmNews(news); await put({ bbmnews: news }); } catch (e) {} TR = t0; }
    const today = usToday(); const sent = Object.assign({}, all.alerted || {}); const out = [];
    // Yahoo's own injury status for your roster today (often first), merged with BBM news
    const yflags = {}; Object.keys(all).filter(k => k.startsWith('yr:') && all[k] && all[k].rows && Date.now() - all[k].ts < 3 * 3600e3).forEach(k => all[k].rows.forEach(r => { if (/^(O|INJ|SUSP|OUT)$/i.test(r.inj || '')) yflags[nk(r.name)] = { status: 'OUT', detail: r.inj === 'SUSP' ? 'suspended' : 'Yahoo: ' + r.inj }; }));
    news = news || { items: [] };
    Object.keys(all).filter(k => k.startsWith('plan:') && all[k] && all[k].days).forEach(k => { const pl = all[k]; const d = pl.days.find(x => x.date === today); if (!d || !d.open) return;
      const fresh = news.items.filter(n => Date.now() - n.ts < 6 * 3600e3 && ALERT_RE.test(n.status || ''));
      d.start.forEach(name => { const n = fresh.find(x => nk(x.name) === nk(name) || lastI(x.name) === lastI(name)) || (yflags[nk(name)] && Object.assign({ name }, yflags[nk(name)])); if (!n) return; const key = today + '|' + nk(name) + '|' + (/OUT|SUSP/.test(n.status) ? 'out' : n.status); if (sent[key]) return;
        const swap = (d.bench || []).filter(b => !fresh.some(x => nk(x.name) === nk(b)))[0];
        const msg = name + ' is ' + n.status.toLowerCase() + (n.detail ? ' (' + n.detail + ')' : '') + '. ' + (swap ? 'Start ' + swap + ' instead.' : 'Nobody on your bench plays today: consider a pickup.');
        sent[key] = Date.now(); out.push({ key, league: pl.league, title: pl.league + ': lineup change', msg, ts: Date.now() }); }); });
    if (out.length) { const recent = (all.alerts || []).filter(a => Date.now() - a.ts < 36 * 3600e3).concat(out).slice(-20); await put({ alerted: sent, alerts: recent }); out.forEach(a => { try { root.NOTIFY && root.NOTIFY(a.key, a.title, a.msg); } catch (e) {} }); }
    return out;
  }
  // ---------- self-test: does every source still return sensible data? (catches Yahoo/BBM page changes early) ----------
  function selfTest(all, ls) {
    const checks = []; const ck = (name, ok, info) => checks.push({ name, ok: !!ok, info: info || '' });
    ls.forEach(l => { const bx = all['bx:' + l.lid] || {}; const V = bx.views || {}; const rest = Object.values(V.rest || {});
      const nx = Object.values(V.next || {}); const big = nx.length > rest.length ? nx : rest; // late in the week only players with games left are listed, so judge by the bigger view
      ck(l.league + ': BBM projections', big.length > 300 && big.some(r => r.st && r.st.p > 20) && big.some(r => r.st && r.st.r > 8), rest.length + ' this week, ' + nx.length + ' next week');
      const tot = Object.values(bx.tot || {}); ck(l.league + ': BBM season file', tot.length > 300 && tot.some(r => r.g > 0), tot.length + ' players');
      const y = all['yr:' + l.lid]; ck(l.league + ': Yahoo roster', y && y.rows && y.rows.length >= 10, y && y.rows ? y.rows.length + ' players' : 'missing');
      // this week's Matchup Monster copy: both rosters, and the free agents the pickups are chosen from
      const t0 = usToday(); const m = Object.keys(all).filter(k => k.startsWith('mmw:' + l.league + ':') && all[k] && all[k].start <= t0 && all[k].end >= t0).map(k => all[k]).sort((a, b) => b.ts - a.ts)[0] || all['mm:' + l.league];
      const ros = m && m.players ? m.players.filter(p => p.type !== 'fa').length : 0, fas = m && m.players ? m.players.filter(p => p.type === 'fa').length : 0;
      ck(l.league + ': Matchup Monster', ros >= 16 && fas >= 10 && m.cats && m.cats.length >= 8, m && m.players ? ros + ' rostered, ' + fas + ' free agents' : 'missing');
      const lg = all['lgscan:' + l.lid]; ck(l.league + ': league rosters', lg && lg.teams && lg.teams.filter(t => t.players.length >= 10).length >= Math.max(4, lg.teams.length - 1), lg && lg.teams ? lg.teams.length + ' teams' : 'missing'); });
    ls.forEach(l => { const tx = all['tx:' + l.lid]; ck(l.league + ': Yahoo transactions', tx && tx.src === 'page', tx ? (tx.rows || []).length + ' moves' : 'missing'); });
    ck('NBA schedule', (all.nbasched && Object.keys(all.nbasched.by || {}).length >= 30) || (root.NBA_SCHED && Object.keys(root.NBA_SCHED.by).length >= 30), all.nbasched ? Object.keys(all.nbasched.by || {}).length + ' teams' : (all.nbaErr ? all.nbaErr.err : 'missing'));
    const n = all.bbmnews; ck('BBM news', n && n.items && n.items.length > 0, n && n.items ? n.items.length + ' items' : 'missing');
    return { ts: Date.now(), checks, ok: checks.every(c => c.ok) };
  }
  // which leagues to sync: from Yahoo team pages already read, Yahoo's top bar, or Yahoo's fantasy home page
  async function leagues(all, force) {
    // your leagues: rosters already read, your teams in Yahoo's top bar, the saved league list; if none of
    // those exist (fresh install, or the browser cleared the add-on's data), find them on Yahoo's fantasy home page
    const seen = {}; const add = (lid, tid, league) => { if (lid && tid && !seen[lid]) seen[lid] = { lid: String(lid), tid: String(tid), league: league || '' }; };
    Object.keys(all).filter(k => k.startsWith('yr:') && all[k] && all[k].lid).map(k => all[k]).forEach(y => { add(y.lid, y.tid, y.league); });
    (all.leagueList || []).forEach(l => add(l.lid, l.tid, l.league)); Object.entries(all.ymine || {}).forEach(([lid, tid]) => add(lid, tid, ''));
    if (!Object.keys(seen).length && (force || !all.yFindTs || Date.now() - all.yFindTs > 10 * 60e3)) { const f = await findLeagues(); f.forEach(l => add(l.lid, l.tid, '')); }
    return Object.values(seen).sort((a, b) => (a.league || a.lid) < (b.league || b.lid) ? -1 : 1);
  }
  async function findLeagues() {
    const t0 = TR; TR = []; let out = [];
    try { const t = await req(YH + '/nba', null, 'Yahoo fantasy home'); const mine = {};
      for (const m of t.matchAll(/href="https:\/\/basketball\.fantasysports\.yahoo\.com\/nba\/(\d+)\/(\d+)"[^>]*data-ylk="[^"]*(navtray-fantasy|slk:My Team)/g)) mine[m[1]] = m[2];
      out = Object.entries(mine).map(([lid, tid]) => ({ lid, tid })); trace('Yahoo leagues found', out.length > 0, out.map(l => l.lid + '/' + l.tid).join(', ') || 'none on the page');
      if (out.length) await put({ ymine: Object.assign({}, (await ST().get('ymine')).ymine, mine) });
    } catch (e) { trace('Yahoo leagues found', false, e.message); if (e.auth) { const H = (await ST().get('health')).health || {}; H.auth = Object.assign({}, H.auth, { yahoo: (H.auth || {}).yahoo || Date.now() }); await put({ health: H }); } }
    await put({ yFindTs: Date.now(), yFindTrace: TR }); TR = t0; return out;
  }
  // ---------- housekeeping, once a day: drop what's no longer used or too old to matter (a smaller store loads faster) ----------
  async function tidy(all) { const t0 = usToday(), cut14 = addDay(t0, -14), cut7 = addDay(t0, -7); const rm = []; const set = {};
    Object.keys(all).forEach(k => { const v = all[k];
      if (/^(yauth|ydisc|ydiscErr|yconnDraft|yReadOnly|yThrottle|ylabels|mmCmd|dockMode|dockOpen|dockKey|dockZoom|dockBlocked|lgwkTry:.*)$/.test(k) || /^(yadds|ywaiv|yset):/.test(k)) rm.push(k);
      else if (/^mmw:/.test(k) && v && v.end && v.end < cut14) rm.push(k);
      else if (/^bbmFail:/.test(k) && v && Date.now() - v.ts > 7 * 864e5) rm.push(k);
      else if (/^ylu:/.test(k) && v) { const keep = Object.fromEntries(Object.entries(v).filter(([d]) => d >= cut7)); if (Object.keys(keep).length !== Object.keys(v).length) set[k] = keep; }
      else if (k === 'yCmd' && v && (v.done || Date.now() - v.ts > 864e5)) rm.push(k); });
    if (rm.length) await ST().remove(rm); set.tidyTs = Date.now(); await put(set); return rm.length; }
  // one entry point for the panel and the background: decides full vs light, skips if fresh, one sync at a time
  async function auto(force, onStep, opt) {
    opt = opt || {}; const all = await ST().get(null);
    const lk = all.syncLock; if (lk && Date.now() - lk.ts < 4 * 60e3 && !running) return { skipped: 'busy' };
    // quiet while you're asleep (1–6 am on this computer's clock), as long as there was a sync in the last 8 hours
    if (!force && !opt.now && opt.by === 'background') { const h = new Date().getHours();
      const lastAny = Math.max(0, ...Object.keys(all).filter(k => k.startsWith('sync:')).map(k => (all[k] || {}).ts || 0));
      if (h >= 1 && h < 6 && Date.now() - lastAny < 8 * 3600e3) return { skipped: 'quiet hours' }; }
    if (!all.tidyTs || Date.now() - all.tidyTs > 864e5) { try { await tidy(all); } catch (e) {} }
    const ls = await leagues(all, force); if (!ls.length) return { skipped: 'no leagues' };
    const lastFull = Math.min(...ls.map(l => all['fullsync:' + l.lid] || 0));
    const mode = force || Date.now() - lastFull > 6 * 3600e3 ? 'full' : 'light';
    const every = (opt.lightMin || 15) * 60e3; const st = l => all['sync:' + l.lid]; const H = all.health || {};
    // when each league is next due: on schedule when the last sync worked; after a failure, retry in 5, 10, 20, 40, then every 60 min
    const dueAt = l => { const s0 = st(l); if (!s0) return 0; if (s0.ok) return s0.ts + every; const n = Math.max(1, (H.fails || {})[l.lid] || 1); return s0.ts + Math.min(60, 5 * Math.pow(2, n - 1)) * 60e3; };
    const nextDue = Math.min(...ls.map(dueAt));
    const backingOff = ls.some(l => st(l) && !st(l).ok && Date.now() < dueAt(l));
    if (!force && !opt.now && ((mode === 'light' && Date.now() < nextDue) || (mode === 'full' && backingOff))) { if (all.nextDue !== nextDue) await put({ nextDue }); return { skipped: mode === 'full' ? 'waiting to retry' : 'fresh' }; }
    lockBy = opt.by || 'panel'; await put({ syncLock: { ts: Date.now(), by: lockBy } });
    try { const res = await syncAll(ls, mode, onStep);
      if (mode === 'full' || !all.bbmnews || Date.now() - all.bbmnews.ts > 30 * 60e3) { TR = []; try { await put({ bbmnews: await bbmNews(all.bbmnews) }); } catch (e) { trace('BBM player news', false, e.message); } await put({ bbmnewsTrace: TR }); TR = null; }
      if (mode === 'full') { const o = {}; res.forEach(r => { if (r.ok) o['fullsync:' + r.lid] = Date.now(); }); await put(o); try { await put({ selftest: selfTest(await ST().get(null), ls) }); } catch (e) {} }
      try { const a2 = await ST().get(null); const H2 = a2.health || {}; const due = ls.map(l => { const s0 = a2['sync:' + l.lid]; if (!s0) return Date.now(); if (s0.ok) return s0.ts + every; const n = Math.max(1, (H2.fails || {})[l.lid] || 1); return s0.ts + Math.min(60, 5 * Math.pow(2, n - 1)) * 60e3; }); await put({ nextDue: Math.min(...due) }); } catch (e) {}
      return { mode, res }; }
    finally { lockBy = null; await put({ syncLock: null }); }
  }
  root.SYNC = { parseTM, parseAM, parseRanks, yAvail, parseStatus, parsePairs, parseTrend, parseSettings, bbmLogin, req, parseTx, parseLive, parseStand, txWhen, syncAll, syncLeague, serialize, mondayOf, nbaSchedule, auto, leagues, bbmNews, bx, FRESH, newsCheck };
})(typeof window !== 'undefined' ? window : globalThis);
