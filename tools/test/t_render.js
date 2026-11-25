// The release checklist's render and consistency checks, offline: node tools/test/t_render.js <store export.json>
// Use Settings → Diagnostics → Download test data (Download forecast data works too, but has no Analysis Monster, so the
// Strategy checks are skipped). Never commit the export: it holds league data.
// For each variant (normal, a player in an injured-list spot, an injured player in the lineup, a recent add):
//   every page and sub-page renders with no page errors and no "Something went wrong"
//   Players #1 and its drop = the Week brief's best pickup = Team step 1 (when shown) = Best moves' first pickup
//   that drop reads "A free agent does more" (or a sell, when a trade is worth more)
//   contradictions (owner's review 25 Nov): no drop candidate with an anchor line; every drop candidate's free agent clears the bar;
//   over Yahoo's limit the card's drop is Who to drop's least-missed free choice and no free agent row claims an empty spot
//   Finder shows rostered players only (none of the Players page's free agents)
'use strict';
const fs = require('fs'); const { JSDOM } = require('jsdom'); const { render, variant } = require('./render');
const file = process.argv[2]; if (!file) { console.log('usage: node tools/test/t_render.js <store export.json>'); process.exit(1); }
const rep = JSON.parse(fs.readFileSync(file, 'utf8')); const base = rep.store || rep;
let bad = 0; const ok = (c, m, more) => { console.log((c ? '✓ ' : '✗ ') + m + (!c && more ? '\n    ' + String(more).slice(0, 400) : '')); if (!c) bad++; };
const frag = html => JSDOM.fragment('<div>' + (html || '') + '</div>').firstChild; const tx = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
const nk = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').trim();
const has = (t, name) => nk(t).includes(nk(name));
const SELL = ['Surplus in won categories', 'Value in lost categories']; const LABELS = ['A free agent does more', 'Keep', 'Anchor'].concat(SELL);

(async () => { for (const v of ['normal', 'il', 'injured', 'recent']) { console.log(`\n=== ${v}`);
  const r = await render(variant(base, v), { now: rep.at }); const P = r.pages;
  ok(r.tabs.length >= 4, `${r.tabs.length} pages: ${r.tabs.join(', ')}`);
  ok(!r.errors.length, 'no page errors', r.errors.join('\n    '));
  const broken = Object.entries(P).filter(([, p]) => p.broken).map(([k]) => k); ok(!broken.length, 'nothing shows "Something went wrong"', broken.join(', '));
  ok(!/top 0\b/.test((P.players || {}).text || ''), 'Pickups never says "top 0"');
  // Players #1
  const pl =frag(P.players && P.players.html); const top = pl && pl.querySelector('details.pr.fa');
  if (!top) { ok(true, 'no free agent list on Players (nothing to compare)'); continue; }
  const add = tx(top.querySelector('.l1 b')); const dropEl = top.querySelector('.ld .sub b'); const drop = tx(dropEl); const faNames = [...pl.querySelectorAll('details.pr.fa .l1 b')].map(tx);
  console.log(`  Players #1: ${add}, drop ${drop}`);
  // Week brief
  const brief = frag(P.week && P.week.html); const rl = brief && [...brief.querySelectorAll('.brief .brow')].map(tx).find(t => /Roster:/.test(t));
  const hl = tx(pl.querySelector('.hl')); const clears = /is the best pickup|^Add /.test(hl), none = /No free agent clears your bar/.test(hl); const open = /empty roster spot/.test(hl);
  if (open) ok(!drop && (!rl || !/, drop /.test(rl)), 'an empty roster spot: Players and the Week brief name no drop', rl + ' | Players: ' + hl);
  if (rl && /Best pickup|\badd /i.test(rl)) ok(clears && has(rl, add) && has(rl, drop), 'Week brief names the same pickup and drop, and Players says it clears the bar', rl + ' | Players: ' + hl);
  else ok(!clears, 'Week brief names no pickup, and Players agrees nothing clears the bar (' + (rl || 'no roster line') + ')', 'Players: ' + hl);
  if (none) console.log('  (below your bar: ' + hl + ')');
  // Team step 1 (shown only when a pickup is due now)
  const team = frag(P.team && P.team.html); const s1 = team && [...team.querySelectorAll('.step')].find(s => /Step 1/.test(tx(s)));
  if (s1) ok(has(tx(s1), add) && has(tx(s1), drop), 'Team step 1 is the same pickup and drop', tx(s1)); else ok(!rl || !/Add .* now/.test(rl), 'no Team step 1, and the Week brief isn\'t asking for an add now', rl);
  // Strategy
  const block = P['trades:block'], roster = P['trades:roster'], finder = P['trades:finder'];
  if (!roster || /Waiting for Basketball Monster's Analysis Monster/.test(roster.text)) { console.log('  - Strategy checks skipped: no Analysis Monster in this store (use Download test data)'); continue; }
  ok(!P['trades:moves'], 'no Best trades page (removed in 8.2.0: the Trade block shows its swaps)');
  // the Trade block's Trade Monster swaps: every one clears the +3 bar; the realistic ones (outside the folds) cost them at most 1 of 99
  if (block) { const d = frag(block.html); const rows = [...d.querySelectorAll('.tmd')]; const n99 = (r, w) => { const m = tx(r).match(new RegExp(w + ' ([+−]?)(\\d+)')); return m ? (m[1] === '−' ? -1 : 1) * +m[2] : NaN; };
    ok(rows.map(r => n99(r, 'You')).every(v => v >= 3), 'every Trade Monster swap on the block clears +3 of 99 (' + rows.length + ')');
    const real = rows.filter(r => !r.closest('details')); ok(real.map(r => n99(r, 'them')).every(v => v >= -1), 'realistic swaps cost them at most 1 of 99 (' + real.length + ')'); }
  // labels on your players: the drop reads "A free agent does more"
  const lab = {}; [P['trades:roster'], P.team, P.players].filter(Boolean).forEach(p => { const d = frag(p.html); d.querySelectorAll('*').forEach(el => { const t = tx(el); if (!LABELS.includes(t)) return;
    let row = el.parentElement; while (row && row !== d && !row.querySelector('b')) row = row.parentElement; const who = row && row.querySelector('b') ? tx(row.querySelector('b')) : null; if (who && !lab[who]) lab[who] = t; }); });
  // (the label means a top-10 free agent clears your pickup bar in his place: only then, and only when there is a drop)
  if (drop && clears) ok(['A free agent does more'].concat(SELL).includes(lab[drop]), `the drop (${drop}) reads "A free agent does more"`, 'reads: ' + (lab[drop] || 'no label found'));
  else console.log(`  - drop label not checked: ${drop ? 'no free agent clears your bar' : 'an empty roster spot, no drop'}`);
  // contradictions on your players (owner's review 25 Nov)
  if (roster) { const d = frag(roster.html); const rows = [...d.querySelectorAll('details.pr')].filter(r => /A free agent does more/.test(tx(r.querySelector('.l1'))));
    ok(rows.every(r => !/Anchor without him/.test(tx(r))), 'no drop candidate is also an anchor (' + rows.length + ')', rows.map(tx).join(' | '));
    ok(rows.every(r => { const m = tx(r).match(/in his place: ([+−]?)(\d+) of 99 \(your pickup bar \+(\d+)\)/); return m && (m[1] === '−' ? -m[2] : +m[2]) >= +m[3]; }), "every drop candidate's free agent clears the pickup bar", rows.map(tx).join(' | ')); }
  { const fix = pl.querySelector('.card.ilb'); const dc = pl.querySelector('.card.dropc'); const step = fix && [...fix.querySelectorAll('.ilsteps li')].map(tx).find(x => /^Now: drop /.test(x));
    if (step && dc) { const free = [...dc.querySelectorAll('details.drw')].find(r => !/Recent add|Your keep|Top half|Injured list/.test(tx(r.querySelector('.ftags')))); const nm = free && tx(free.querySelector('.l1 b'));
      ok(nm && has(step, nm), 'over the limit: the card drops the least-missed free choice (' + nm + ')', step);
      ok(![...pl.querySelectorAll('details.pr.fa .l2')].some(r => /empty spot/.test(tx(r))), 'over the limit: no free agent row claims an empty spot'); }
    else console.log('  - over-the-limit checks skipped: the roster fits'); }
  if (finder) { const rowsF = [...frag(finder.html).querySelectorAll('details.pr .l1 b')].map(tx).join(' | '); const fa = faNames.filter(n => has(rowsF, n)); /* player rows only: a multi-player deal may name the free agent it adds */ ok(!fa.length, 'Finder shows rostered players only', 'free agents in Finder: ' + fa.join(', ')); }
  if (roster) ok(!roster.broken, 'Roster renders'); }
  // the Matchup hero (7.53.0): Basketball Monster's Matchup Monster as given, expected categories = the sum of its category chances
  { const st = JSON.parse(JSON.stringify(base)); Object.keys(st).filter(k => k.startsWith('ylive:')).forEach(k => delete st[k]);
    const r = await render(st, { now: rep.at }); const t = (r.pages.week || {}).text || ''; const day = String(rep.at || new Date().toISOString()).slice(0, 10);
    const mw = Object.keys(st).filter(k => k.startsWith('mmw:')).map(k => st[k]).find(x => x.bbmWin && x.start <= day && x.end >= day && x.opp && t.includes(x.opp));
    console.log('\n=== Matchup hero' + (mw ? ' against ' + mw.opp : ''));
    if (!mw) ok(/Matchup Monster hasn't given/.test(t), 'no Matchup Monster week: the hero says so', t.slice(0, 300));
    else { const E = Object.values(mw.bbmWin).reduce((a, v) => a + v, 0); ok(t.includes(E.toFixed(1) + '/') || /chance to beat/.test(t), `the hero is Matchup Monster's ${E.toFixed(1)} categories`, t.slice(0, 300));
      ok(/From Basketball Monster's Matchup Monster/.test(t) && !/fills every start/.test(t), 'the hero names Matchup Monster and has no planner odds switch', t.slice(0, 300)); } }
  // the Yahoo trade card (7.51.0): a one-for-one from Trade Monster's lists, with Analyze Trade's answer stubbed; it shows Trade
  // Monster's numbers and nothing of the co-pilot's own season measure
  { const tmk = Object.keys(base).find(k => k.startsWith('bbmtm:') && base[k].by && Object.keys(base[k].by).length); const lid = tmk && tmk.slice(6); const bx = lid && base['bx:' + lid];
    const [g, rows] = tmk ? Object.entries(base[tmk].by).find(([, r]) => r.length) || [] : []; const t = rows && rows[0] && rows[0].id; const V = bx ? Object.assign({}, bx.views.ros, bx.views.rest) : {};
    if (!t || !V[g] || !V[t]) console.log('\n- Yahoo trade card not checked: no Trade Monster lists in this store');
    else { console.log('\n=== Yahoo trade card: ' + V[g].n + ' for ' + V[t].n); const st = JSON.parse(JSON.stringify(base));
      st.ypage = { kind: 'trade', lid, ts: rep.at ? Date.parse(rep.at) : Date.now(), url: 'x', give: ['y1'], get: ['y2'], players: { y1: { n: V[g].n, t: V[g].t }, y2: { n: V[t].n, t: V[t].t } } };
      const r = await render(st, { now: rep.at, stub: w => { w.SYNC.bbmAnalyze = async () => ({ ts: Date.now(), you: 4, them: 1, gains: {} }); } });
      const h = (r.pages.trades || {}).html || ''; const c = tx(frag(h).querySelector('.card.ctx'));
      ok(!r.errors.length, 'no page errors', r.errors.join('\n    ')); ok(/You \+4 · them \+1 of 99/.test(c), "the card shows Trade Monster's Analyze Trade answer", c.slice(0, 300));
      ok(!/rest of season|over the rest of the season/.test(c), "the card has none of the co-pilot's own season numbers", c.slice(0, 300)); } }
  // the Yahoo pickup card (7.52.0): the best Find Free Agents pair, with Analyze Add/Drop's answer stubbed
  { const fk = Object.keys(base).find(k => k.startsWith('bbmfa:') && base[k].by); const lid = fk && fk.slice(6); const bx = lid && base['bx:' + lid]; const V = bx ? Object.assign({}, bx.views.ros, bx.views.rest) : {};
    const best = fk ? Object.entries(base[fk].by).flatMap(([d, rows]) => rows.map(r => ({ add: r.id, drop: d, d: r.d }))).filter(x => V[x.add] && V[x.drop]).sort((a, b) => b.d - a.d)[0] : null;
    if (!best) console.log('\n- Yahoo pickup card not checked: no Find Free Agents lists in this store');
    else { console.log('\n=== Yahoo pickup card: ' + V[best.add].n + ', drop ' + V[best.drop].n); const st = JSON.parse(JSON.stringify(base));
      st.ypage = { kind: 'add', lid, ts: rep.at ? Date.parse(rep.at) : Date.now(), url: 'x', apid: 'y1', dpid: 'y2', dropChoices: ['y2'], players: { y1: { n: V[best.add].n, t: V[best.add].t }, y2: { n: V[best.drop].n, t: V[best.drop].t } } };
      const r = await render(st, { now: rep.at, stub: w => { w.SYNC.bbmAnalyzeAdd = async () => ({ ts: Date.now(), you: 4 }); } });
      const c = tx(frag((r.pages.players || {}).html).querySelector('.card.ctx'));
      ok(!r.errors.length, 'no page errors', r.errors.join('\n    ')); ok(/\+4 of 99 a week over the rest of the season/.test(c), "the card shows Trade Monster's Analyze Add/Drop answer", c.slice(0, 300));
      ok(!/categor(y|ies) (over|this season)/.test(c), "the card has none of the co-pilot's own season numbers", c.slice(0, 300)); } }
  // the Trade block with every player of yours on it (owner's review 25 Nov): one verdict per card; "Looking for" = the header's
  // swing categories; every player who fits is in his Find Trades list and costs neither side; a player Trade Monster hasn't read
  // never gets "no swap adds"
  { const st = JSON.parse(JSON.stringify(base)); const yk = Object.keys(st).find(k => k.startsWith('yr:') && st[k] && st[k].league === st.activeLeague) || Object.keys(st).find(k => k.startsWith('yr:') && st[k] && st[k].lid);
    const lg = st[yk].league, lid = st[yk].lid; st.activeLeague = lg; const ids = Object.keys((st['bbmfa:' + lid] || {}).by || {}); st['sset:' + lg] = Object.assign(st['sset:' + lg] || {}, { block: ids });
    const r = await render(st, { now: rep.at }); const b = r.pages['trades:block']; console.log(`\n=== Trade block, ${ids.length} players on it`);
    if (!b || !ids.length) console.log('  - skipped: no Trade block or no Find Free Agents in this store');
    else { const d = frag(b.html); const cards = [...d.querySelectorAll('.blkc')]; const tm = (st['bbmtm:' + lid] || {}).by || {};
      ok(!r.errors.length && cards.length, 'renders ' + cards.length + ' cards with no page errors', r.errors.join('\n    '));
      ok(cards.every(c => c.querySelectorAll('.bverd').length === 1), 'every card has one verdict line');
      const look = cards.map(c => [...c.querySelectorAll('.mvl')].map(tx).find(x => /^Looking for/.test(x))); ok(new Set(look).size === 1, 'every card looks for the same swing categories', [...new Set(look)].join(' | '));
      const fitsBad = []; cards.forEach(c => c.querySelectorAll(':scope > details.pr').forEach(p => { const m = tx(p).match(/Trade Monster ?you ([+−]?)(\d+), them ([+−]?)(\d+)/); if (!m || m[1] === '−' || +m[2] === 0 || (m[3] === '−' && +m[4] > 1)) fitsBad.push(tx(p.querySelector('.l1 b'))); }));
      const chips = cards.filter(c => /Trade chip/.test(tx(c))).length; console.log('  trade chip notes: ' + chips + ' of ' + cards.length);
      ok(!fitsBad.length, 'every player who fits shows Trade Monster numbers where you gain and they lose at most 1', fitsBad.join(', '));
      const unread = cards.filter(c => /hasn't read him yet/.test(tx(c.querySelector('.bverd')))); ok(unread.every(c => !/No Trade Monster swap for him adds/.test(tx(c))), 'an unread player never gets "no swap adds" (' + unread.length + ' unread of ' + Object.keys(tm).length + ' read)'); } }
  console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0); })();
