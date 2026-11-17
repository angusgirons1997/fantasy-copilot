// A healthy Yahoo player with a stale Basketball Monster "P" / "Q" must show no injury badge or warning.
// usage: node t_inj.js <export.json>
const fs = require('fs');
const { render } = require('./render');
const rep = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const ST = rep.store || rep;
const yk = Object.keys(ST).find(k => /^yr:/.test(k)); const healthy = ST[yk].rows.filter(r => !r.inj && !/^IL/.test(r.slot) && r.slot !== 'BN');
const names = healthy.slice(0, 2).map(r => r.name); let hits = 0;
const walk = o => { if (!o || typeof o !== 'object') return; if (typeof o.n === 'string' && 'inj' in o && names.includes(o.n)) { o.inj = o.n === names[0] ? 'P' : 'Q'; hits++; } Object.values(o).forEach(walk); };
walk(ST); console.log('stale statuses planted on', names.join(', '), '(' + hits + ' records)');
(async () => { const r = await render(ST, { now: rep.at }); let bad = 0;
  for (const pg of ['team', 'week']) { const t = (r.pages[pg] && r.pages[pg].text) || '';
    names.forEach(n => { const i = t.indexOf(n); const near = i >= 0 ? t.slice(i, i + n.length + 60) : '';
      const wrong = /probable|questionable|is listed/i.test(near); console.log((wrong ? '✗ ' : '✓ ') + pg + ': ' + n + (wrong ? ' -> ' + near : ' shows no injury')); if (wrong) bad++; }); }
  console.log('errors:', r.errors.length); process.exit(bad || r.errors.length ? 1 : 0); })();
