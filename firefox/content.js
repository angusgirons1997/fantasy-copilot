if (!globalThis.browser) globalThis.browser = chrome;
try { const __c = "(() => {\n  const OWS = window.WebSocket; if (!OWS || OWS.__mdf) return;\n  const post = d => { try { window.postMessage({ __mdflive: 1, d }, '*'); } catch (e) {} };\n  function W(url, prot) {\n    const ws = prot !== undefined ? new OWS(url, prot) : new OWS(url);\n    ws.addEventListener('message', ev => { if (typeof ev.data === 'string' && /^(0\\||D\\||O\\|draft-labels)/.test(ev.data)) post(ev.data.slice(0, 50000)); });\n    return ws;\n  }\n  W.prototype = OWS.prototype; W.CONNECTING = 0; W.OPEN = 1; W.CLOSING = 2; W.CLOSED = 3; W.__mdf = 1;\n  window.WebSocket = W;\n})();\n"; const sc = document.createElement('script'); sc.textContent = __c; (document.head || document.documentElement).appendChild(sc); sc.remove(); } catch (e) {}
try { if (!document.documentElement.dataset.mdfInj) { document.documentElement.dataset.mdfInj = '1'; const s = document.createElement('script'); s.src = browser.runtime.getURL('inject.js'); (document.head || document.documentElement).appendChild(s); s.onload = () => s.remove(); } } catch (e) {}
const __mdfQ = []; const __mdfEarly = ev => { if (ev.data && ev.data.__mdflive === 1) __mdfQ.push(ev.data); };
window.addEventListener('message', __mdfEarly);
function __mdfMain() {
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’`]/g, "'").replace(/\./g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ABBR = { NOR: 'NOP', PHO: 'PHX', SA: 'SAS', NY: 'NYK', GS: 'GSW', UTAH: 'UTA' };
  const idName = Object.assign({}, YID);
  const myTeam = (location.pathname.match(/draftclient\/nba\/\d+\/(\d+)/) || [])[1];
  const picks = {};
  let clock = '', dirty = true, rounds = 0, myNext = 0, secs = null; const liveAdp = {}; const liveInj = {};
  function matchShort(short, tm) {
    const m = short.match(/^([A-Za-z])[a-z]*\.?\s+(.+)$/); if (!m) return null;
    const f = m[1].toLowerCase(), last = norm(m[2]); tm = ABBR[tm] || tm;
    let c = P.filter(p => { const k = norm(p.n), i = k.indexOf(' '); return k[0] === f && k.slice(i + 1) === last; });
    if (c.length > 1 && tm) c = c.filter(p => p.t === tm);
    if (!c.length && tm) c = P.filter(p => norm(p.n).endsWith(' ' + last) && p.t === tm);
    return c.length === 1 ? c[0].n : null;
  }
  window.addEventListener('message', ev => {
    const m = ev.data; if (!m || m.__mdflive !== 1) return; const d = m.d;
    if (d.startsWith('0|')) { const [, o, pid, team, pos] = d.split('|'); picks[o] = { o: +o, pid, team, pos, name: idName[pid] || null }; dirty = true; }
    else if (d.startsWith('O|draft-labels')) { for (const x of d.matchAll(/"playerId":(\d+),"playerName":"([^"]+)"[^}]*?"adpRank":([\d.]+)/g)) { const n = P.find(p => norm(p.n) === norm(x[2])); if (n) { idName[x[1]] = n.n; liveAdp[n.n] = +x[3]; dirty = true; } }
      for (const x of d.matchAll(/"playerId":(\d+),"playerName":"([^"]+)"/g)) { const n = P.find(p => norm(p.n) === norm(x[2])); if (n) idName[x[1]] = n.n; } }
  });
  function learnDom() {
    document.querySelectorAll('[data-id]').forEach(el => {
      const id = el.getAttribute('data-id'); if (!/^\d{3,6}$/.test(id)) return;
      const t = (el.closest('tr') || el).innerText || '';
      { const sm = t.match(/^\s*[A-Z][a-z]*\.\s+[^\n]+?\s*\n\s*(Q|O|INJ|GTD|DTD|NA|P)\s*\n/m); const nn = idName[id]; if (nn) { const v = sm ? sm[1] : null; if (liveInj[nn] !== v) { if (v) liveInj[nn] = v; else delete liveInj[nn]; dirty = true; } } }
      if (!idName[id]) { const mm = t.match(/([A-Z][a-z]*\.\s+[^\n]+?)\s*\n(?:[A-Z]{1,3}\s*\n)?[A-Z,]+\s*\n?\s*([A-Z]{2,4})\b/); if (mm) { const n = matchShort(mm[1].trim(), mm[2]); if (n) idName[id] = n; } }
      const n = idName[id]; if (n) { const flat = t.replace(/\s+/g, ' '); const am = flat.match(/\b[A-Z]{2,4} (\d{1,3}|-) (\d{1,3}|-) (\d{1,3}\.\d)\b/); if (am) { const a = +am[3]; if (a > 0 && liveAdp[n] !== a) { liveAdp[n] = a; dirty = true; } } }
    });
    const txt = document.body ? document.body.innerText : '';
    const rt = txt.match(/YOUR TEAM\s*\((\d+)\s*\/\s*(\d+)\)/i); if (rt && +rt[2] !== rounds) { rounds = +rt[2]; dirty = true; }
    const tm = txt.match(/(\d{1,2}):(\d{2})\s*\n[^\n]*Round \d+, Pick \d+/); const ns = tm ? (+tm[1]) * 60 + (+tm[2]) : null; if (ns !== secs) { secs = ns; dirty = true; }
    const h = txt.match(/^.*Round \d+, Pick \d+.*$/m); if (h && h[0] !== clock) { clock = h[0]; dirty = true;
      const pk = h[0].match(/Pick (\d+)/), up = h[0].match(/up in (\d+) Picks?/i), now = /your (pick|turn)|on the clock/i.test(h[0]) && !up;
      if (pk) { const nx = up ? +pk[1] + +up[1] : (now ? +pk[1] : 0); if (nx) myNext = nx; } }
    const i = txt.indexOf('\nPicks\n');
    if (i >= 0) {
      const L = txt.slice(i).split('\n').map(s => s.trim()).filter(Boolean);
      for (let k = 0; k < L.length - 3; k++) {
        if (!/^\d{1,3}$/.test(L[k]) || !/^[A-Z][a-z]*\.\s/.test(L[k + 2]) || /^\d/.test(L[k + 1])) continue;
        const o = L[k]; let j = k + 3; while (j < L.length && /^(Q|O|P|D|GTD|INJ|NA)$/.test(L[j])) j++;
        const tm = L[j + 1]; const name = matchShort(L[k + 2], tm);
        if (!picks[o]) { picks[o] = { o: +o, pid: null, team: null, you: L[k + 1] === 'You', tname: L[k + 1], name: name || L[k + 2] + ' (' + tm + ')' }; dirty = true; }
        else { if (!picks[o].tname) { picks[o].tname = L[k + 1]; dirty = true; } if (!picks[o].name && name) { picks[o].name = name; dirty = true; } if (L[k + 1] === 'You' && !picks[o].you) { picks[o].you = true; dirty = true; } }
      }
    }
    { const LL = txt.split('\n').map(s => s.trim()).filter(Boolean); const byN = {}; P.forEach(p => byN[norm(p.n)] = p.n);
      for (let k = 1; k < LL.length; k++) { const om = LL[k].match(/^(\d{1,3})(st|nd|rd|th)$/); if (!om) continue;
        for (let b = 1; b <= 3 && k - b >= 0; b++) { const nm = byN[norm(LL[k - b])]; if (nm) { const o = om[1]; const tn = k - b - 1 >= 0 ? LL[k - b - 1] : null;
          if (!picks[o]) { picks[o] = { o: +o, pid: null, team: null, you: false, tname: tn, name: nm }; dirty = true; } else if (!picks[o].name) { picks[o].name = nm; dirty = true; } break; } } }
    }
    Object.values(picks).forEach(p => { if (!p.name && p.pid && idName[p.pid]) { p.name = idName[p.pid]; dirty = true; } });
  }
  function push() {
    learnDom(); if (!dirty) return; dirty = false;
    const curPk = +((clock.match(/Pick (\d+)/) || [])[1] || 0); const wsMax = Math.max(0, ...Object.values(picks).filter(p => p.pid).map(p => p.o)); const lim = Math.max(curPk, wsMax + 1) || 1e9;
    const list = Object.values(picks).filter(p => p.o <= lim).sort((a, b) => a.o - b.o).map(p => ({ o: p.o, n: p.name || ('Unknown player ' + (p.pid || '')), mine: p.you || (myTeam && p.team === myTeam) || false, team: p.team, tn: p.tname || null }));
    browser.storage.local.set({ mdfLive: { picks: list, myTeam, draft: (location.pathname.match(/draftclient\/nba\/(\d+)/) || [])[1] || null, clock, rounds, myNext, secs, adp: liveAdp, inj: liveInj, url: location.pathname, ts: Date.now() } });
  }
  function TEAMS_GUESS() { return 0; }
  const queued = new Set();
  function idOf(name) { return Object.keys(idName).find(k => idName[k] === name); }
  function clickStar(row) {
    const cands = [...row.querySelectorAll('button,[role="button"],a,svg')].filter(e => /queue|star|watch/i.test((e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '') + ' ' + (e.getAttribute('data-tst') || '')) || (e.tagName.toLowerCase() === 'svg' && /M11 \.7a1\.07/.test(e.innerHTML)));
    const t = cands[0]; if (!t) return false; const b = t.closest('button,[role="button"],a') || t; b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); return true;
  }
  browser.storage.onChanged.addListener((ch, a) => {
    if (a !== 'local' || !ch.mdfCmd || !ch.mdfCmd.newValue || ch.mdfCmd.newValue.cmd !== 'queue') return;
    const ok = [], miss = [], skip = [];
    for (const n of ch.mdfCmd.newValue.names) {
      if (queued.has(n)) { skip.push(n); continue; }
      const id = idOf(n); const el = id && document.querySelector('[data-id="' + id + '"]'); const row = el && (el.closest('tr') || el);
      if (row && clickStar(row)) { queued.add(n); ok.push(n); } else miss.push(n);
    }
    const msg = (ok.length ? 'Queued: ' + ok.join(', ') + '. ' : '') + (skip.length ? 'Already queued: ' + skip.join(', ') + '. ' : '') + (miss.length ? 'Not visible on Yahoo\'s Players tab, add by hand: ' + miss.join(', ') + '.' : '');
    browser.storage.local.set({ mdfCmdResult: { id: Date.now(), msg } });
  });
  setInterval(push, 1000);
}
browser.storage.local.get('mdfData').then(r => { const d = r && r.mdfData; if (d && Array.isArray(d.P)) { P = d.P; if (d.YID) YID = Object.assign({}, YID, d.YID); } }).catch(() => {}).then(() => {
  __mdfMain(); window.removeEventListener('message', __mdfEarly); __mdfQ.forEach(m => window.postMessage(m, '*'));
});
