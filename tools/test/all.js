// Every check that needs no store export: lint (undefined names) and the browser-free tests. The release workflow runs this
// before signing, so a failing check blocks the release. Run: node tools/test/all.js (needs eslint 8 and jsdom installed)
const { spawnSync } = require('child_process');
const steps = [
  ['lint', 'npx', ['eslint', '--no-eslintrc', '-c', 'tools/test/eslintrc.json', 'firefox/*.js']],
  ['t_cal', 'node', ['tools/test/t_cal.js']],
  ['t_ilback2', 'node', ['tools/test/t_ilback2.js', 'firefox/season.js']],
  ['t_tags', 'node', ['tools/test/t_tags.js']],
  ['t_advice', 'node', ['tools/test/t_advice.js']],
  ['t_names', 'node', ['tools/test/t_names.js']],
  ['t_yahoo', 'node', ['tools/test/t_yahoo.js']],
  ['t_phone', 'node', ['tools/test/t_phone.js']],
  ['t_bbm', 'node', ['tools/test/t_bbm.js']],
  ['t_alert', 'node', ['tools/test/t_alert.js']],
  ['t_season_end', 'node', ['tools/test/t_season_end.js']],
  ['t_anchor', 'node', ['tools/test/t_anchor.js']],
];
let bad = 0;
for (const [name, cmd, args] of steps) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  const ok = r.status === 0; if (!ok) bad++;
  console.log((ok ? '✓ ' : '✗ ') + name + (ok ? '' : '\n' + (r.stdout || '') + (r.stderr || '')));
}
console.log(bad ? `\n${bad} failed` : '\nall passed'); process.exit(bad ? 1 : 0);
