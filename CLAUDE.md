# Fantasy co-pilot: notes for every coding session

Firefox add-on (Manifest V2, sidebar) for Yahoo head-to-head categories fantasy basketball, built on
Basketball Monster (BBM) projections and Yahoo league pages. The code is in `firefox/`. There is no Chrome
build: don't make one, mention one or add steps for one.

The tool must work for any league, roster, build or punt. Nothing may be specific to the owner's own teams.

## The one measure (every page reads it)

Expected categories won per week over the rest of the season, through the end of the playoffs, against
every other team in the league. It comes from BBM rest-of-season projections (`ros` view: games × per-game
stats), with punted categories held at a usual loss. It is `H2H.board` in `h2h.js`, memoized per league in
`boardFor(lg)` in `season.js`.

- **Player value to you** = what the number loses without him (`board.mine[].val`).
- **Pickup** = what the number gains when he replaces one of your players. His drop is the one that leaves
  you best off (`board.list`: top 30 of all BBM free agents; the Players page filters it by guard, forward or centre, keeping
  overall ranks. Yahoo's player-list pages get no card: Players shows only the best free agents across the league).
- **Trade** = the gain after the swap (`board.of(ids)`, also used by `trade.js`).
- **Empty roster spot** (7.39.0): `openSpots` in `season.js` (Yahoo's starting spots + bench, less players not on the injured
  list). When one is open, every pickup is a plain add (`board.list[].drop` is null) on every page: Players, Week, Team, Best
  moves, Yahoo's add page, and the trade companion's roster size. The planner adds without a drop.
- **Same pickup everywhere:** the planner gets the board's pick even when Matchup Monster's free-agent list lacks him (filled in
  from Basketball Monster's projections), and Yahoo's add page never offers a drop the board keeps.
- **Never droppable:** players in injured-list spots, players the user chose to keep, players added in the
  last 2 weeks, and anyone in the top half of all rostered players (another team would claim them).
- **Sell** = a one-for-one trade at the player's BBM value (lv from −0.1 to +0.03) clears the trade bar
  (`readsFor`). A player who holds up a category never clears it.
- **Labels (`readsFor`):**
  - costs = a top-10 free agent clears the pickup bar in his place
  - holds/wasted = sell
  - small = bottom third by value to you
  - fits = otherwise
- **This week and next** are timing only (`H2H.timing`): they produce "Wait until Monday" and never
  reorder anything.
- The planner (`engine.js` `E.plan`) gets `opts.board`. It only picks the day and plans the lineup for the
  pickup the board chose.

Any new feature that values a player must use the board. A second valuation path is a bug: it is what made
pages contradict each other before 7.32.0.

## Owner's rules for advice (apply in code and copy)

- Current roster only, unless trades are explicitly assumed.
- BBM numbers with the snapshot date. Don't present noise-level differences as decisions.
- Category bands: dead (<~15% of teams beaten), swing (~25–75%), locked (>~90%). Waste = value in dead
  categories, or surplus in locked ones.
- Trades are evaluated one at a time. Never recommend specific player-for-player deals: give the profile
  (category strengths, market tier) and the players who fit it.
- The app never makes roster changes. Never change BBM's punt settings unless asked. Restore BBM page
  settings after postbacks.
- UI: no abbreviations, light and dark themes, plain colour-coded words plus the primitive numbers.

## Lineups (agreed with the owner, 7.37.0: don't re-decide these)

- **Injuries:** Yahoo's tag on the team page decides. `HARD_OUT` (O, OUT, INJ, SUSP, NA, OFS) never starts. The player's games
  are marked `zero` before `E.plan`, whatever Basketball Monster projects. A `DOUBTFUL` player (GTD, DTD, Q, D) starts only into a
  spot no healthy player with a game can fill.
- **One pass per day:** `resolveDay` in `season.js` runs on every open day. It benches:
  - anyone out
  - anyone with no Yahoo game
  - anyone no longer on the Yahoo roster
  - anyone in an IL spot

  It then fills free spots with the best healthy player with a game, using Yahoo's eligibility, and leaves locked players where
  they are. What the Team page shows is exactly what "Set lineups" sends (`plan:` → `weekDays` → `yroster.js` `assign`).
- **The Yahoo side:** `assign` starts only the listed starters. It never fills a gap from the bench list.
- **After a pickup or drop:** leaving a Yahoo add/drop page re-reads the roster (`rosterNow`), as does a roster older than 10
  minutes. Any day read before a roster change is read again. The owner then presses Set: lineups are never pushed without the
  click.
- **Day markers:**
  - pulse while Set runs
  - green once Yahoo has re-read and confirmed that day
  - red if Yahoo refused it

  An out player left in a starting spot doesn't make a day yellow by himself. Set benches him anyway.
- **Test:** `node tools/test/t_lineup.js <export>` covers all of the above, including a simulated Set turning every day green.

## Build page (agreed with the owner, 7.39.0: don't re-decide these)

- Strategy → Build starts with your build: the category chips are buttons that punt or unpunt straight away (`setPunt`, with
  Undo), and the bands are set again from today's numbers for the new punt. "Find my best moves" comes after the build.
- **Best available punt** (`bestBuilds`): every build of no punt, any one category, or two of your five weakest. For each,
  Basketball Monster's Analysis Monster team values summed over the kept categories; your rank against the league on that sum.
  Best = highest rank, then fewer punts, then widest margin. It is not the one measure on purpose: on the roster as it stands,
  punting can only lower expected categories won. Shown at the top ("Use this build") and as the top three under Try a different
  build, next to your own preview.

## League tab standings (7.40.0, agreed with the owner)

`standProj` / `standingsCard` in `season.js`. Three tables, in this order:
1. **Current standings:** Yahoo's rank, W-L-T and pct (a tie counts as half a win), with the playoff line.
2. **Remaining categories to win:** Basketball Monster's Analysis Monster rest-of-season win rate × categories a week × weeks left,
   with the per-opponent "you W-L-T". The maths is in the header.
3. **Projected final standings:** Yahoo W + expected wins; L + the rest of the categories left; ties unchanged, none projected; pct
   as Yahoo works it; playoff line at Yahoo's playoff team count; your gap to the line in categories.

Categories a week come from Yahoo's settings (`ysetp.cats`). Weeks left = (first playoff week − 1) − the weeks already in Yahoo's
standings, counted as (W + L + T) ÷ categories, so a finished week is never counted twice. No model of our own and no adjustments:
the rate is Analysis Monster's as given. Checked by hand against the 16 Nov Mad dogs numbers.

## Trade companion (7.38.0)

On Yahoo's propose-trade page, `companion` in `context.js` prices every player on their roster and on yours as an addition to the
deal as ticked (`TRADE.marginal`: the deal with him against the deal without him, on the one measure via `TRADE.mySide`). Ticking
on Yahoo re-prices everything. The full verdict (`dealView`) follows once both sides have a player. The panel only reads Yahoo's
page: it never ticks boxes itself. "How it works" sits at the foot of the Strategy card, not in the sub-tab row.

## Security

- Never type passwords. The BBM password is only in the add-on's local storage (obfuscated) and is only
  sent to basketballmonster.com.
- AMO signing secrets live in GitHub secrets and are entered by the owner. Never handle them.

## Release checklist

1. Lint:
   - `eslint --no-eslintrc -c <config>` with no-undef and no-unused-vars on the changed files.
   - boot.js, content.js, panel.js and yroster.js have known content-script globals.
2. Render every tab with test stores (normal, injured-list, injured, recent-add variants) and check the items below.
   `node tools/test/t_render.js <copilot-test-data.json>` does the render and the step 3 consistency check offline, in jsdom.
   Settings → Diagnostics → Download test data gives the export: everything except sign-ins. Contrast still needs Firefox.
   - no page errors
   - contrast and size audit in light and dark
3. Consistency check: Players #1 and its drop must equal:
   - the Week brief
   - the Team step 1
   - the Best moves waiver #1

   The drop must read "A free agent does more". Every sell must be in Best moves. Finder shows rostered
   players only.
4. Bump `firefox/manifest.json` version, commit, push to `main`. GitHub Actions signs the add-on with
   Mozilla and publishes the release.
5. Wait for the run to finish, check the .xpi URL returns 200, then give the owner the direct link:
   `https://github.com/angusgirons1997/fantasy-copilot/releases/download/vX.Y.Z/fantasy-copilot-X.Y.Z.xpi`

## Forecast check (calibration)

- **Data:**
  - Each week the panel logs a pre-week forecast for every league matchup (`lgfc:<lid>:<start>`, via the
    `next` view).
  - Sync stores every team's final weekly totals (`lgweek:<lid>:<week>`).
- **In-app fit:** `CTX.calibrate` fits the spread multiplier `ctx.sdMul` from those pairs, eased in until
  200 results. It applies to every probability, including the one measure. Settings → Forecast check shows
  the Brier score and the calibration bins.
- **Offline:** `node tools/backtest.js copilot-forecast-data.json` (Settings → Diagnostics → Download
  forecast data) gives:
  - out-of-sample scores
  - a league-wide retro (current rosters × actual games, so it is optimistic about width)
  - per-category fits and actual ÷ projected means
- The pickup and trade bars are in units of the one measure. If the spread moves a lot, check the bars
  against the owner's stated trade bar.
- **Spread per category:** `SCALE` in `h2h.js`, measured on the 2025-26 season (`tools/spread-study.js`). This
  replaced a single 2.5.
- **The field:** `lgfc` also stores each team's projected totals. `CTX.uplift` compares them with actual totals
  (streaming and lineups). It is shown in Settings only, not used in advice, until about four weeks of data.
- **Projection scorecard:** from Saturday before each Monday, sync saves BBM `next` per-game projections and
  Yahoo "Next 7 Days" projections for rostered players (`pjlog:<lid>:<monday>`). After the Sunday, BBM player
  rankings for that date range give the actuals (`pjact:<monday>`, restoring the owner's page settings).
  `CTX.projScore` compares BBM, Yahoo and their average. Agreed rule: switch to the average only if, after four
  weeks, it is clearly better (≥2% lower error) in two thirds of categories.
- **Advice backtest:** the forecast check tests probabilities, not whether the advice wins. Once a day, when the season
  panel renders, `logAdvice` in `season.js` keeps `advlog:<lid>`. It's a raw record only and never feeds advice. It holds:
  - the board's pick with its predicted gain, and the top 10
  - Basketball Monster's top free agent and Yahoo's most added, each with its best drop
  - your roster
- **Scoring the advice offline:** `node tools/advice-backtest.js copilot-forecast-data.json [--weeks 4]` scores each weekly
  decision on the following weeks' actual player totals (`pjact`) and actual league totals (`lgweek`), in the board's unit,
  against holding and both alternatives. It reports:
  - realized vs predicted gain
  - how well the board's order holds up
- **Tests:** browser-free tests are in `tools/test`. Panel render tests run against the add-on loaded in
  Firefox (`web-ext run`). Never commit store exports: they hold the owner's league data.
