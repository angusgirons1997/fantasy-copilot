// Yahoo team page reader: lineup slots + eligibility for the shown date; applies a planned lineup.
if (!globalThis.browser && globalThis.chrome) globalThis.browser = chrome;
(function () {
  const txt = el => (el ? el.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim() : '');
  function parse(doc) {
    const form = doc.querySelector('form[action*="/editroster"]'); if (!form) return null;
    const am = form.getAttribute('action').match(/\/nba\/(\d+)\/(\d+)\/editroster/); if (!am) return null;
    const date = (form.querySelector('input[name=date]') || {}).value || null;
    const title = txt(doc.querySelector('title'));
    const tm = title.match(/^(.+?) - (.+?) \|/);
    const rows = [], empty = [];
    form.querySelectorAll('tr').forEach(tr => {
      // a player whose game has started (or finished) today has no position menu: Yahoo has locked him in place
      const sel = tr.querySelector('select'); const pl = tr.querySelector('.pos-label[data-pos]'); if (!pl) return;
      const a = tr.querySelector('.ysf-player-name a.name') || tr.querySelector('a.name[data-ys-playerid]') || tr.querySelector('a.name');
      // a starting spot with nobody in it ("(Empty)"): it still has to be counted and can be filled
      if (!a && /\(?\s*empty\s*\)?/i.test(txt(tr))) { empty.push(pl.getAttribute('data-pos')); return; }
      const pid = sel ? sel.getAttribute('name') : (a && a.getAttribute('data-ys-playerid')); if (!pid || !a) return;
      const tpm = txt(tr.querySelector('.ysf-player-name')).match(/\b([A-Z]{2,4}) - ([A-Z]{1,2}(?:,[A-Z]{1,2})*)\b/); const tp = tpm ? tpm[1] + ' - ' + tpm[2] : '';
      const gs = txt(tr.querySelector('.ysf-game-status'));
      const st = txt(tr.querySelector('.ysf-player-status, .F-injury, abbr.F-injury'));
      const slot = pl.getAttribute('data-pos');
      rows.push({ pid, name: a.getAttribute('title') || txt(a), slot, elig: sel ? [...sel.options].map(o => o.value) : [slot], locked: !sel,
        team: (tp.split(' - ')[0] || '').trim(), pos: (tp.split(' - ')[1] || '').trim(), game: gs, hasGame: /\d|@|vs/i.test(gs) && !/no game/i.test(gs), inj: st });
    });
    // Yahoo's own counters above the roster: "You have used 1 of your 2 player adds for this week", IL spots, waiver priority
    const bt = txt(doc.body); const am2 = bt.match(/You have used (\d+) of your (\d+) player adds/i), il2 = bt.match(/You have used (\d+) of (\d+) IL positions/i), wp = bt.match(/Waiver Priority:\s*(\d+)/i);
    // Yahoo's own warning when the roster is illegal (a player back from injury still on the IL pushes you over the roster size):
    // "You are over the max roster size... (Error #160)". While it shows, Yahoo refuses every lineup change
    const em = bt.match(/You are over the max roster size[^(]{0,240}\(Error #\d+\)/i) || bt.match(/[A-Z][^.!?()]{10,200}[.!]?\s*\(Error #\d+\)/); const illegal = em ? em[0].replace(/\s+/g, ' ').trim() : null;
    const card = doc.querySelector('#team-card-matchup'); const ca = card && card.querySelector('a[href*="/nba/"]'); const wk = card && txt(card).match(/Week (\d+)/);
    const om = ca && (ca.getAttribute('href') || '').match(/\/nba\/\d+\/(\d+)/);
    return { lid: am[1], tid: am[2], date, league: tm ? tm[1] : '', teamName: tm ? tm[2] : '', rows, empty, adds: am2 ? { used: +am2[1], max: +am2[2] } : null, il: il2 ? { used: +il2[1], max: +il2[2] } : null, waiverPriority: wp ? +wp[1] : null, illegal, week: wk ? +wk[1] : null, oppTid: om ? om[1] : null, oppName: ca ? txt(ca) : null, ts: Date.now(), url: (doc.location || {}).href || '' };
  }
  // the visible alert Yahoo shows after a lineup post (e.g. why a move was refused)
  function yahooMsg(doc) { const el = [...doc.querySelectorAll('.Alert-critical, .Alert-warning, .Alert-error, .errors, .ysf-error, .Alert')].find(e => !e.classList.contains('Hidden') && txt(e.querySelector('.Message') || e).length > 3);
    return el ? txt(el.querySelector('.Message') || el).slice(0, 160) : ''; }
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.'’`]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/gi, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ALIAS = { 'nicolas claxton': 'nic claxton', 'herb jones': 'herbert jones', 'alexandre sarr': 'alex sarr', 'cameron johnson': 'cam johnson' };
  const K = s => { const n = norm(s); return ALIAS[n] || n; };
  // planned starters -> Yahoo slots for one day's roster. Names are matched the way the panel matches them (exact, else a
  // surname that only one player on the roster has), so a "Nic"/"Nicolas" difference never leaves a starter on the bench.
  function assign(rows, start, bench, il, empty) {
    const last = n => { const w = K(n).split(' '); return w[w.length - 1]; };
    const rowFor = n => rows.find(r => K(r.name) === K(n)) || (() => { const c = rows.filter(r => last(r.name) === last(n)); return c.length === 1 ? c[0] : null; })();
    const pidsOf = list => [...new Set((list || []).map(rowFor).filter(Boolean).map(r => r.pid))];
    const startP = pidsOf(start), benchP = pidsOf(bench).filter(x => !startP.includes(x)), ilP = new Set(pidsOf(il));
    const isAct = x => x && x !== 'BN' && !/^IL/.test(x);
    // locked players (game started) keep their slot; only the remaining slots can be filled (empty starting spots included)
    const lockedRows = rows.filter(r => r.locked); const act = rows.filter(r => isAct(r.slot)).map(r => r.slot).concat((empty || []).filter(isAct));
    lockedRows.forEach(r => { const i = act.indexOf(r.slot); if (i >= 0) act.splice(i, 1); });
    const free = rows.filter(r => !r.locked);
    const st = new Set(startP), playing = new Set(startP.concat(benchP)); const order = startP.concat(benchP);
    const want = free.filter(r => st.has(r.pid) && !/^IL/.test(r.slot));
    // planned starters not on this roster yet (pickup not made): fill with planned bench players who play
    const missing = Math.max(0, (start || []).length - startP.length);
    if (missing) free.filter(r => !st.has(r.pid) && playing.has(r.pid) && !/^IL/.test(r.slot)).sort((a, b) => order.indexOf(a.pid) - order.indexOf(b.pid)).slice(0, missing).forEach(r => want.push(r));
    const match = new Array(act.length).fill(-1);
    const tryP = (i, seen) => { for (let j = 0; j < act.length; j++) { if (seen[j] || !want[i].elig.includes(act[j])) continue; seen[j] = true; if (match[j] < 0 || tryP(match[j], seen)) { match[j] = i; return true; } } return false; };
    want.forEach((_, i) => tryP(i, new Array(act.length).fill(false)));
    const asg = {}; free.forEach(r => { asg[r.pid] = /^IL/.test(r.slot) ? r.slot : (ilP.has(r.pid) && r.elig.some(e => /^IL/.test(e)) ? r.elig.find(e => /^IL/.test(e)) : 'BN'); });
    const used = {}; match.forEach((i, j) => { if (i >= 0) { asg[want[i].pid] = act[j]; used[act[j]] = (used[act[j]] || 0) + 1; } });
    const cap = {}; act.forEach(x => cap[x] = (cap[x] || 0) + 1);
    free.forEach(r => { if (!playing.has(r.pid) && asg[r.pid] === 'BN' && isAct(r.slot) && (used[r.slot] || 0) < cap[r.slot]) { asg[r.pid] = r.slot; used[r.slot] = (used[r.slot] || 0) + 1; } });
    const changes = free.filter(r => (ilP.has(r.pid) && asg[r.pid] !== r.slot) || (playing.has(r.pid) && isAct(r.slot) !== isAct(asg[r.pid]))).length;
    lockedRows.forEach(r => { asg[r.pid] = r.slot; });
    return { asg, changes };
  }
  if (typeof module !== 'undefined') { module.exports = { parse, assign, yahooMsg }; return; }
  if (/^(moz|chrome)-extension:/.test(location.protocol)) { globalThis.YPARSE = parse; globalThis.YASSIGN = assign; return; }
  // Firefox: content.fetch runs as the page (same origin, cookies, referer); Chrome content scripts already do
  const pfetch = (typeof content !== 'undefined' && content && content.fetch) ? content.fetch.bind(content) : fetch.bind(window);
  // each day's lineup as Yahoo now has it goes straight to the panel, so its day markers turn green as each day is done
  const luRow = x => ({ name: x.name, slot: x.slot, pid: x.pid, locked: !!x.locked, hasGame: !!x.hasGame, game: x.game || '', inj: x.inj || '', elig: x.elig || [], team: x.team || '' });
  async function saveDay(lid, r) { try { const k = 'ylu:' + lid; const cur = Object.assign({}, (await browser.storage.local.get(k))[k] || {}); cur[r.date] = { ts: Date.now(), rows: r.rows.map(luRow), empty: r.empty || [] }; await browser.storage.local.set({ [k]: cur }); } catch (e) {} }
  async function setWeek(c) {
    // a run that was interrupted (the Yahoo page it ran in was left or reloaded) carries on where it stopped: days already set
    // are kept, only the rest are done
    const prev = (await browser.storage.local.get('yWeek')).yWeek; const prior = prev && prev.id === c.ts ? (prev.results || []).filter(r => r.ok) : [];
    const out = prior.slice(); const base = location.origin; const todo = c.days.filter(d => !prior.some(r => r.date === d.date));
    const report = () => browser.storage.local.get('yWeek').then(o => browser.storage.local.set({ yWeek: Object.assign({}, o.yWeek && o.yWeek.id === c.ts ? o.yWeek : {}, { id: c.ts, lid: c.lid, days: c.days.map(d => d.date), done: out.length >= c.days.length, results: out.slice().sort((a, b) => a.date < b.date ? -1 : 1), beat: Date.now() }) }));
    report();
    for (const d of todo) {
      try {
        const url = `${base}/nba/${c.lid}/${c.tid}/team?date=${d.date}`;
        const html = await (await pfetch(url, { credentials: 'include' })).text();
        const doc = new DOMParser().parseFromString(html, 'text/html'); const r = parse(doc); const form = doc.querySelector('form[action*="/editroster"]');
        if (!r || !form || r.date !== d.date) { out.push({ date: d.date, ok: false, msg: 'could not open that day' }); report(); continue; }
        const { asg, changes } = assign(r.rows, d.start, d.bench, d.il, r.empty);
        if (!changes) { out.push({ date: d.date, ok: true, changes: 0 }); await saveDay(c.lid, r); report(); continue; }
        const body = new URLSearchParams(); form.querySelectorAll('input[type=hidden]').forEach(i => body.append(i.name, i.value));
        r.rows.forEach(x => { if (!x.locked) body.append(x.pid, asg[x.pid] || x.slot); });
        const res = await pfetch(new URL(form.getAttribute('action'), base).href, { method: 'POST', credentials: 'include', body: body.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        let yErr = ''; try { const rd = new DOMParser().parseFromString(await res.text(), 'text/html'); yErr = yahooMsg(rd); } catch (e) {}
        // verify by re-reading the day
        const html2 = await (await pfetch(url, { credentials: 'include' })).text(); const r2 = parse(new DOMParser().parseFromString(html2, 'text/html'));
        const bad = r2 ? r2.rows.filter(x => !x.locked && asg[x.pid] && x.slot !== asg[x.pid]).length : -1;
        if (r2 && r2.date === d.date) await saveDay(c.lid, r2);
        out.push({ date: d.date, ok: res.ok && bad === 0, changes, msg: bad > 0 ? (yErr ? 'Yahoo said: ' + yErr : bad + ' slot(s) did not stick') : (res.ok ? '' : 'Yahoo refused (' + res.status + ')' + (yErr ? ': ' + yErr : '')) });
      } catch (e) { out.push({ date: d.date, ok: false, msg: String(e.message || e) }); }
      report(); await new Promise(z => setTimeout(z, 700));
    }
    if (out.some(x => x.date === (parse(document) || {}).date && x.changes)) setTimeout(() => location.reload(), 600);
  }
  // the page is re-read when Yahoo changes it, but only written to storage when something you'd see actually changed
  // (Yahoo's pages change constantly for ads and clocks, and every write would make the panel redraw)
  let lastSig = '';
  function push() { try { const r = parse(document); if (!r) return; r.src = 'page'; const sig = JSON.stringify(Object.assign({}, r, { ts: 0 })); if (sig === lastSig) return; lastSig = sig;
      browser.storage.local.set({ ['yr:' + r.lid]: r, yrLast: r.lid }); } catch (e) {} }
  push(); const mo = new MutationObserver(() => { clearTimeout(push.t); push.t = setTimeout(push, 800); }); mo.observe(document.documentElement, { childList: true, subtree: true });
  // the day you pick on your Yahoo team page shows in the panel at once: the date is sent the moment you click, before Yahoo
  // has loaded that day (previous / next arrows, the day menu, or any link to your team page for a date)
  { const me = (() => { const f = document.querySelector('form[action*="/editroster"]'); const am = f && (f.getAttribute('action') || '').match(/\/nba\/(\d+)\/(\d+)\//); return am ? { lid: am[1], tid: am[2] } : null; })();
    const dateOf = u => { const m = String(u || '').match(/[?&]date=(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null; };
    const mine = u => me && new RegExp('/nba/' + me.lid + '/' + me.tid + '(/team)?\\b').test(String(u || ''));
    let lastSent = ''; const tell = date => { if (!me || !date || date === lastSent) return; lastSent = date; try { browser.storage.local.set({ ydate: { lid: me.lid, tid: me.tid, date, ts: Date.now() } }); } catch (e) {} };
    if (me) {
      document.addEventListener('click', e => { const el = e.target && e.target.closest && e.target.closest('a[href*="date="], [data-value*="date="], option[value*="date="]'); if (!el) return;
        const u = el.getAttribute('href') || el.getAttribute('data-value') || el.getAttribute('value'); if (mine(u)) tell(dateOf(u)); }, true);
      document.addEventListener('change', e => { const t = e.target; if (t && t.tagName === 'SELECT' && t.name === 'date' && mine(t.value)) tell(dateOf(t.value)); }, true);
      const d0 = (parse(document) || {}).date; if (d0) tell(d0); } }
  // several Yahoo tabs may be open: one is elected with a short storage lock to run the week
  function claimWeek(c) { const me = Math.random().toString(36).slice(2); const lid = c.ts + ':' + (c.rs || 0);
    setTimeout(() => browser.storage.local.get('yLock').then(o => { if (o.yLock && o.yLock.id === lid) return; browser.storage.local.set({ yLock: { id: lid, who: me } }).then(() => setTimeout(() => browser.storage.local.get('yLock').then(o2 => { if (o2.yLock && o2.yLock.who === me) { browser.storage.local.set({ yCmd: Object.assign({}, c, { done: true }) }); setWeek(c); } }), 350)); }), Math.random() * 250); }
  // a page opened just to run a waiting job (the co-pilot opens one in the background when no Yahoo tab is open) picks it up on load
  browser.storage.local.get('yCmd').then(o => { const c = o.yCmd; if (c && !c.done && c.cmd === 'week' && c.tid && Date.now() - (c.rs || c.ts) < 90e3 && location.hostname === 'basketball.fantasysports.yahoo.com') claimWeek(c); }).catch(() => {});
  browser.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local' || !ch.yCmd || !ch.yCmd.newValue) return; const c = ch.yCmd.newValue; if (c.done) return;
    if (c.cmd === 'week' && c.tid && location.hostname === 'basketball.fantasysports.yahoo.com') { claimWeek(c); return; }
    const form = document.querySelector('form[action*="/editroster"]'); const r = parse(document);
    if (!form || !r || r.lid !== c.lid || (c.cmd !== 'week' && r.date !== c.date)) { browser.storage.local.set({ yCmd: Object.assign({}, c, { done: true, err: 'Open your team page for ' + c.date + ' first.' }) }); return; }
    if (c.cmd === 'week') { browser.storage.local.set({ yCmd: Object.assign({}, c, { done: true }) }); setWeek(Object.assign({}, c, { tid: r.tid })); return; }
    if (c.cmd === 'highlight') {
      document.querySelectorAll('.mdf-hl').forEach(e => { e.classList.remove('mdf-hl'); e.style.outline = ''; });
      Object.entries(c.marks || {}).forEach(([pid, col]) => { const s = form.querySelector('select[name="' + pid + '"]'); const tr = s && s.closest('tr'); if (tr) { tr.classList.add('mdf-hl'); tr.style.outline = '2px solid ' + col; tr.style.outlineOffset = '-2px'; } });
      browser.storage.local.set({ yCmd: Object.assign({}, c, { done: true }) }); return;
    }
    if (c.cmd === 'lineup') {
      let n = 0;
      Object.entries(c.assign).forEach(([pid, slot]) => { const s = form.querySelector('select[name="' + pid + '"]'); if (s && s.value !== slot && [...s.options].some(o => o.value === slot)) { s.value = slot; s.dispatchEvent(new Event('change', { bubbles: true })); n++; } });
      browser.storage.local.set({ yCmd: Object.assign({}, c, { done: true, changed: n }) });
      if (n && c.submit) setTimeout(() => form.submit(), 200);
    }
  });
})();
