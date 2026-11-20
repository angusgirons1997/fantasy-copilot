// The release checklist's render and consistency checks, offline: node tools/test/t_render.js <store export.json>
// Use Settings → Diagnostics → Download test data (Download forecast data works too, but has no Analysis Monster, so the
// Strategy checks are skipped). Never commit the export: it holds league data.
// For each variant (normal, a player in an injured-list spot, an injured player in the lineup, a recent add):
//   every page and sub-page renders with no page errors and no "Something went wrong"
//   Players #1 and its drop = the Week brief's best pickup = Team step 1 (when shown) = Best moves' first pickup
//   that drop reads "A free agent does more"; every sell (surplus or wasted value) is in Best moves
//   Finder shows rostered players only (none of the Players page's free agents)
'use strict';
const fs = require('fs'); const { JSDOM } = require('jsdom'); const { render, variant } = require('./render');
const file = process.argv[2]; if (!file) { console.log('usage: node tools/test/t_render.js <store export.json>'); process.exit(1); }
const rep = JSON.parse(fs.readFileSync(file, 'utf8')); const base = rep.store || rep;
let bad = 0; const ok = (c, m, more) => { console.log((c ? '✓ ' : '✗ ') + m + (!c && more ? '\n    ' + String(more).slice(0, 400) : '')); if (!c) bad++; };
const frag = html => JSDOM.fragment('<div>' + (html || '') + '</div>').firstChild; const tx = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
const nk = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').trim();
const has = (t, name) => nk(t).includes(nk(name));
const SELL = ['Surplus in won categories', 'Value in lost categories']; const LABELS = ['Fits your build', 'A free agent does more', 'Small impact', "Doesn't help you"].concat(SELL);

(async () => { for (const v of ['normal', 'il', 'injured', 'recent']) { console.log(`\n=== ${v}`);
  const r = await render(variant(base, v), { now: rep.at }); const P = r.pages;
  ok(r.tabs.length >= 4, `${r.tabs.length} pages: ${r.tabs.join(', ')}`);
  ok(!r.errors.length, 'no page errors', r.errors.join('\n    '));
  const broken = Object.entries(P).filter(([, p]) => p.broken).map(([k]) => k); ok(!broken.length, 'nothing shows "Something went wrong"', broken.join(', '));
  // Players #1
  const pl = frag(P.players && P.players.html); const top = pl && pl.querySelector('details.pr.fa');
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
  const moves = P['trades:moves'], roster = P['trades:roster'], finder = P['trades:finder'];
  if (!moves || /Waiting for Basketball Monster's Analysis Monster/.test(moves.text)) { console.log('  - Strategy checks skipped: no Analysis Monster in this store (use Download test data)'); continue; }
  ok(has(moves.text, add) && has(moves.text, drop), "Best moves includes the same pickup and drop", moves.text.slice(0, 300));
  { const mi = nk(moves.text).indexOf(nk(add)); const firstFa = faNames.filter(n => n !== add).map(n => nk(moves.text).indexOf(nk(n))).filter(i => i >= 0); ok(mi >= 0 && firstFa.every(i => i > mi), "it's the first free agent in Best moves"); }
  // labels on your players: the drop reads "A free agent does more"; sells are in Best moves
  const lab = {}; [P['trades:roster'], P.team, P.players].filter(Boolean).forEach(p => { const d = frag(p.html); d.querySelectorAll('*').forEach(el => { const t = tx(el); if (!LABELS.includes(t)) return;
    let row = el.parentElement; while (row && row !== d && !row.querySelector('b')) row = row.parentElement; const who = row && row.querySelector('b') ? tx(row.querySelector('b')) : null; if (who && !lab[who]) lab[who] = t; }); });
  // (the label means a top-10 free agent clears your pickup bar in his place: only then, and only when there is a drop)
  if (drop && clears) ok(lab[drop] === 'A free agent does more', `the drop (${drop}) reads "A free agent does more"`, 'reads: ' + (lab[drop] || 'no label found'));
  else console.log(`  - drop label not checked: ${drop ? 'no free agent clears your bar' : 'an empty roster spot, no drop'}`);
  const sells = Object.entries(lab).filter(([, t]) => SELL.includes(t)).map(([n]) => n); const missing = sells.filter(n => !has(moves.text, n));
  ok(!missing.length, `every sell is in Best moves (${sells.length})`, missing.join(', '));
  if (finder) { const fa = faNames.filter(n => has(finder.text, n)); ok(!fa.length, 'Finder shows rostered players only', 'free agents in Finder: ' + fa.join(', ')); }
  if (roster) ok(!roster.broken, 'Roster renders'); }
  console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0); })();
