# Tests

Browser-free checks (run from the repo root):

- `node tools/test/all.js` (or `npm test`) runs lint and every test below that needs no store export. The release workflow runs
  it before signing: a failure stops the release.
- `node tools/test/t_yahoo.js` reads saved Yahoo markup (`fixtures/`). When Yahoo changes a page, save a trimmed copy there
  (no tokens or league links) and fix the reader until this passes.

- `node tools/test/t_cal.js` checks that the forecast check recovers a known spread error on synthetic results.
- `node tools/test/t_ilback2.js firefox/season.js` exercises the back-from-injury card.
- `node tools/test/t_render.js <copilot-test-data.json>` renders every page and sub-page of the season panel offline (jsdom,
  no network) in four roster variants. It checks for page errors and runs the release consistency check. Get the export from
  Settings → Diagnostics → Download test data. `render.js` is the harness behind it (`--dump dir` saves each page's HTML).
- `node tools/test/t_lineup.js <export>` checks lineup setting end to end on a real roster, offline, at the export's own time:
  - nobody out starts
  - a game-time decision only takes a spare spot
  - a dropped player never starts
  - a simulated "Set lineups" turns every day's marker green, with pulsing markers while it runs and red for a refused day

  It also covers the Yahoo-side assignment on its own.
- `node tools/test/t_advice.js` checks the advice backtest (`tools/advice-backtest.js`) on a hand-built league with a known answer.
- `node tools/test/t_names.js` checks the one player-name rule (`firefox/names.js`): nicknames, shared surnames, teams, and
  Set lineups starting the right Wagner.
- `node tools/test/t_stand.js <export>` checks the League tab's three standings tabs against a hand calculation (the 16 Nov
  Mad dogs numbers, and an 11-category, 10-team, top-4 league).
- `node tools/test/t_inj.js <export>` checks that a stale Basketball Monster injury status never shows on a player Yahoo lists
  as healthy.
- `node tools/test/t_tags.js` tests Basketball Monster analyst-tag parsing. It needs `npm i jsdom`.
- `node tools/test/mkfake.js <store.json> [out.json]` adds synthetic finished weeks, forecasts and projection logs to a store
  export, for `node tools/backtest.js out.json`.
- Lint: `npx eslint --no-eslintrc -c tools/test/eslintrc.json firefox/*.js`. The `eslint_unused.json` config also
  flags unused variables.

Store exports hold the owner's league data: keep them out of the repo. Panel render tests run against the add-on
loaded in Firefox.
