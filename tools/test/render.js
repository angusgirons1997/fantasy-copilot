// Render the season panel in jsdom from a store export, offline: the release checklist's render and consistency checks without
// Firefox. node tools/test/render.js <store export.json> [--variant normal|il|injured|recent] [--dump dir]
// The network is stubbed (nothing reaches Yahoo or Basketball Monster) and storage writes stay in memory.
'use strict';
const fs = require('fs'), path = require('path'); const { JSDOM, VirtualConsole } = require('jsdom');
const FF = path.join(__dirname, '..', '..', 'firefox');

// variants of your own roster, for the checklist's "normal, injured-list, injured, recent-add" renders
function variant(store, v) { const ST = JSON.parse(JSON.stringify(store)); if (!v || v === 'normal') return ST;
  const yk = Object.keys(ST).filter(k => k.startsWith('yr:') && ST[k] && ST[k].rows); yk.forEach(k => { const rows = ST[k].rows; const act = rows.filter(r => r.slot !== 'BN' && !/^IL/.test(r.slot || ''));
    if (v === 'il' && act[0]) { act[0].slot = 'IL'; act[0].inj = 'O'; }       // a player in an injured-list spot
    if (v === 'injured' && act[1]) { act[1].inj = 'O'; }                    // an injured player still in the lineup
    if (v === 'recent' && rows[rows.length - 1]) { const lg = ST[k].league; const h = ST['hist:' + lg] || { log: [] }; h.log.push({ t: 'add', k: String(rows[rows.length - 1].name).toLowerCase(), ts: Date.now() - 864e5 }); ST['hist:' + lg] = h; } });
  return ST; }

async function render(store, opt) { opt = opt || {};
  const errors = [], writes = {}; const vc = new VirtualConsole();
  vc.on('error', (...a) => errors.push(a.map(x => x && x.stack || String(x)).join(' '))); vc.on('jsdomError', e => errors.push('jsdom: ' + (e.stack || e.message)));
  const html = fs.readFileSync(path.join(FF, 'season.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'moz-extension://test/season.html', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window; const ST = JSON.parse(JSON.stringify(store)); const listeners = [];
  // the page's clock at a fixed moment (the export's own time), so "today" and every freshness check match the data
  if (opt.now) { const off = Date.parse(opt.now) - Date.now(); const D0 = w.Date;
    class FakeDate extends D0 { constructor(...a) { if (a.length) super(...a); else super(D0.now() + off); } static now() { return D0.now() + off; } }
    w.Date = FakeDate; }
  const pick = keys => keys == null ? JSON.parse(JSON.stringify(ST)) : Object.fromEntries((Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys)).filter(k => k in ST).map(k => [k, JSON.parse(JSON.stringify(ST[k]))]));
  w.browser = { storage: { local: { get: async k => pick(k), set: async o => { Object.entries(o).forEach(([k, v]) => { ST[k] = v; writes[k] = v; }); }, remove: async k => { [].concat(k).forEach(x => delete ST[x]); } }, onChanged: { addListener: f => listeners.push(f) } },
    runtime: { getManifest: () => JSON.parse(fs.readFileSync(path.join(FF, 'manifest.json'), 'utf8')), sendMessage: async () => ({ ok: true }), getURL: p => 'moz-extension://test/' + p },
    tabs: { create: async () => ({}), query: async () => [], update: async () => ({}), remove: async () => {} }, notifications: { create: async () => '' }, windows: { create: async () => ({}) } };
  w.fetch = async () => { throw new Error('offline test: no network'); }; w.scrollTo = () => {}; w.CSS = w.CSS || {}; if (!w.CSS.escape) w.CSS.escape = s => String(s).replace(/["\\]/g, '\\$&');
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  w.HTMLElement.prototype.scrollIntoView = function () {};
  const files = [...fs.readFileSync(path.join(FF, 'season.html'), 'utf8').matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  for (const f of files) { try { w.eval(fs.readFileSync(path.join(FF, f), 'utf8') + '\n//# sourceURL=' + f); } catch (e) { errors.push(f + ': ' + (e.stack || e.message)); } }
  const settle = ms => new Promise(z => setTimeout(z, ms || 300)); await settle(600);
  const $ = s => w.document.querySelector(s); const text = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
  const tabs = [...w.document.querySelectorAll('#bnav [data-tab]')].map(b => b.dataset.tab); const pages = {};
  const keep = key => { const out = $('#out'); pages[key] = { html: out ? out.innerHTML : '', text: text(out), broken: /Something went wrong/.test(text(out)) };
    if (opt.dump) { fs.mkdirSync(opt.dump, { recursive: true }); fs.writeFileSync(path.join(opt.dump, (opt.name || 'normal') + '-' + key.replace(':', '-') + '.html'), '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="' + path.join(FF, 'theme.css').replace(/\\/g, '/') + '"><body class="app"><div class="w"><div id="out">' + (out ? out.innerHTML : '') + '</div></div></body>'); } };
  for (const t of tabs) { const b = $(`#bnav [data-tab="${t}"]`); if (b) b.click(); await settle(400); keep(t);
    // a page's own sub-tabs (Strategy: build, best moves, roster, trade block, finder, how it works)
    const subs = [...w.document.querySelectorAll('#out [data-stab]')].map(x => x.dataset.stab);
    for (const s of subs) { const sb = $(`#out [data-stab="${s}"]`); if (sb) sb.click(); await settle(400); keep(t + ':' + s); } }
  w.close(); return { tabs, pages, errors, writes };
}
module.exports = { render, variant };

if (require.main === module) { const args = process.argv.slice(2); const file = args[0]; const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
  if (!file) { console.log('usage: node tools/test/render.js <store export.json> [--variant normal|il|injured|recent] [--dump dir]'); process.exit(1); }
  const rep = JSON.parse(fs.readFileSync(file, 'utf8')); const v = opt('variant') || 'normal';
  render(variant(rep.store || rep, v), { dump: opt('dump'), name: v, now: rep.at }).then(r => { console.log('tabs', r.tabs.join(', '));
    Object.entries(r.pages).forEach(([t, p]) => console.log(`\n== ${t}${p.broken ? ' (BROKEN)' : ''}: ${p.text.length} chars\n${p.text.slice(0, 700)}`));
    console.log('\nerrors', r.errors.length); r.errors.slice(0, 10).forEach(e => console.log('  ' + e.slice(0, 400))); console.log('writes', Object.keys(r.writes).join(', ')); process.exit(0); });
}
