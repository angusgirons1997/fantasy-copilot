// Basketball Monster table reader for the projections pages (Weekly / Daily / Projections): one row per player, keyed by BBM id.
(function (root) {
  const txt = el => (el ? el.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim() : '');
  const num = s => { const v = parseFloat(String(s).replace(/[^\d.+-]/g, '')); return isNaN(v) ? null : v; };
  // header -> per-game stat key
  const STAT = { 'm/g': 'm', 'p/g': 'p', 'pts': 'p', '3/g': '3', '3': '3', 'r/g': 'r', 'reb': 'r', 'a/g': 'a', 'ast': 'a', 's/g': 's', 'stl': 's', 'b/g': 'b', 'blk': 'b', 'fg%': 'fgp', 'fga/g': 'fga', 'fga': 'fga', 'ft%': 'ftp', 'fta/g': 'fta', 'fta': 'fta', 'to/g': 'to', 'to': 'to', '2d/g': '2d', '2d': '2d', 'fg/g': 'fg', 'fgm/g': 'fg', 'ft/g': 'ft', 'ftm/g': 'ft' };
  const VK = { pV: 'p', '3V': '3', rV: 'r', aV: 'a', sV: 's', bV: 'b', 'fg%V': 'fg%', 'ft%V': 'ft%', toV: 'to', '2dV': '2d', fgV: 'fg', ftV: 'ft' };
  function parseTable(doc) {
    const tables = [...doc.querySelectorAll('table')].filter(t => t.querySelectorAll('tbody tr').length > 20);
    let best = null; tables.forEach(t => { const H = [...t.querySelectorAll('thead th')].map(txt); if (H.includes('Name') && (H.includes('g') || H.includes('p/g') || H.includes('pts'))) { if (!best || t.querySelectorAll('tbody tr').length > best.n) best = { t, H, n: t.querySelectorAll('tbody tr').length }; } });
    if (!best) return null; const H = best.H; const ix = h => H.indexOf(h);
    const iN = ix('Name'), iT = ix('Team'), iP = ix('Pos'), iI = ix('Inj'), iG = ix('g'), iLV = ix('LeagV'), iPV = ix('PuntV'), iR = ix('Rank'), iA = ix('Analysts'), iO = ix('Opp'), iM = ix('m/g'), iStat = ix('Status');
    const sc = []; H.forEach((h, i) => { if (STAT[h] && !sc.some(x => x.k === STAT[h])) sc.push({ i, k: STAT[h] }); });
    const vc = []; H.forEach((h, i) => { if (VK[h] && !vc.some(x => x.k === VK[h])) vc.push({ i, k: VK[h] }); });
    const rows = [];
    best.t.querySelectorAll('tbody tr').forEach(tr => {
      const tds = [...tr.children]; const a = tds[iN] && tds[iN].querySelector('a[href*="layerinfo"], a[href*="layerInfo"]'); if (!a) return;
      const id = ((a.getAttribute('href') || '').match(/i=(\d+)/i) || [])[1]; if (!id) return;
      const st = {}; sc.forEach(c => { st[c.k] = num(txt(tds[c.i])); });
      if (st.fg == null && st.fgp != null && st.fga != null) st.fg = st.fgp * st.fga; if (st.ft == null && st.ftp != null && st.fta != null) st.ft = st.ftp * st.fta;
      const cv = {}; vc.forEach(c => { cv[c.k] = num(txt(tds[c.i])); });
      // analyst tags: each badge reads "<analyst> <tag>" (Sell High, Buy Low, Hold, Droppable, Must Add…) with the comment as its tooltip
      const TAGS = ['Sell High', 'Buy Low', 'Hold', 'Droppable', 'Must Add', 'Maybe Add', 'Watch', 'Stream'];
      const badges = iA >= 0 && tds[iA] ? [...tds[iA].querySelectorAll('.badge')] : [];
      const notes = badges.length ? badges.map(bd => { const t0 = txt(bd); const by = t0.split(' ')[0] || 'BBM'; const rest = t0.slice(by.length).trim(); const tag = TAGS.find(x => rest.toLowerCase().indexOf(x.toLowerCase()) === 0) || null;
          const el = bd.querySelector('[data-original-title], [title]'); const raw = el ? (el.getAttribute('data-original-title') || el.getAttribute('title') || '') : ''; const am = raw.match(/\((\d+(?:\.\d+)?)\s*([mhdw])\)\s*$/);
          return { by, tag, tagNote: tag ? rest.slice(tag.length).trim() : '', text: raw.replace(/\s*\(\d+(?:\.\d+)?\s*[mhdw]\)\s*$/, '').trim(), age: am ? +am[1] * ({ m: 1 / 60, h: 1, d: 24, w: 168 }[am[2]]) : null }; }).filter(n => n.text || n.tag)
        : iA >= 0 && tds[iA] ? [...tds[iA].querySelectorAll('[title], [data-original-title]')].map(e => e.getAttribute('data-original-title') || e.getAttribute('title') || '').filter(Boolean).map(raw => { const am = raw.match(/\((\d+(?:\.\d+)?)\s*([mhdw])\)\s*$/); return { by: 'Josh', text: raw.replace(/\s*\(\d+(?:\.\d+)?\s*[mhdw]\)\s*$/, '').trim(), age: am ? +am[1] * ({ m: 1 / 60, h: 1, d: 24, w: 168 }[am[2]]) : null }; }) : [];
      const stat = iStat >= 0 && tds[iStat] ? [...tds[iStat].querySelectorAll('[title], [data-original-title]')].map(e => e.getAttribute('data-original-title') || e.getAttribute('title')).filter(Boolean).join('|') : '';
      rows.push({ id, n: txt(a), t: iT >= 0 ? txt(tds[iT]) : '', pos: iP >= 0 ? txt(tds[iP]) : '', inj: iI >= 0 ? txt(tds[iI]) : '', g: iG >= 0 ? num(txt(tds[iG])) : null, lv: iLV >= 0 ? num(txt(tds[iLV])) : null, pv: iPV >= 0 ? num(txt(tds[iPV])) : null, rank: iR >= 0 ? num(txt(tds[iR])) : null, opp: iO >= 0 ? txt(tds[iO]) : '', m: iM >= 0 ? num(txt(tds[iM])) : null, st, cv, notes, status: stat });
    });
    return { cols: H, stats: sc.map(c => c.k), rows };
  }
  // tiny CSV reader (quoted fields, commas, newlines in quotes)
  function csv(text) {
    const out = []; let row = [], f = '', q = false; text = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) { const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0]) out.push(row); row = []; } else f += c; }
    if (f || row.length) { row.push(f); out.push(row); }
    const H = (out.shift() || []).map(h => h.trim()); return out.map(r => Object.fromEntries(H.map((h, i) => [h, r[i] == null ? '' : r[i]])));
  }
  root.BBMX = { parseTable, csv };
  if (typeof module !== 'undefined') module.exports = root.BBMX;
})(typeof window !== 'undefined' ? window : globalThis);
