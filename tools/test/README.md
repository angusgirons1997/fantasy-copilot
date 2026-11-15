# Tests

Browser-free checks (run from the repo root):

- `node tools/test/t_cal.js` checks that the forecast check recovers a known spread error on synthetic results.
- `node tools/test/t_ilback2.js firefox/season.js` exercises the back-from-injury card.
- `node tools/test/t_advice.js` checks the advice backtest (`tools/advice-backtest.js`) on a hand-built league with a known answer.
- `node tools/test/t_tags.js` tests Basketball Monster analyst-tag parsing. It needs `npm i jsdom`.
- `node tools/test/mkfake.js <store.json> [out.json]` adds synthetic finished weeks, forecasts and projection logs to a store
  export, for `node tools/backtest.js out.json`.
- Lint: `npx eslint --no-eslintrc -c tools/test/eslintrc.json firefox/*.js`. The `eslint_unused.json` config also
  flags unused variables.

Store exports hold the owner's league data: keep them out of the repo. Panel render tests run against the add-on
loaded in Firefox.
