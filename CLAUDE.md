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
- **Pickup** = not this measure since 7.52.0: Basketball Monster's Trade Monster (see "Pickups from Find Free Agents" below).
- **Trade** = not this measure: every trade number is Basketball Monster's Trade Monster (see "Trades from Trade Monster" below).
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

**Player names (7.41.0):** one rule in `firefox/names.js` (`NAMES.key`, `same`, `pick`) for every page, the sync and Set lineups.
Same key (accents, dots, Jr/III dropped, known nicknames like Moe → Moritz), else same surname with one first name the start of
the other (Nic/Nicolas, an initial) and never two different teams. Two players who fit equally → no match, never a guess. Never
match on surname alone. Test: `node tools/test/t_names.js`.

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

- Season → Build starts with your build: the category chips are buttons that punt or unpunt straight away (`setPunt`, with
  Undo), and the bands are set again from today's numbers for the new punt. "Find my best moves" comes after the build.
- **Best available punt** (`bestBuilds`): every build of no punt, any one category, or two of your five weakest. For each,
  Basketball Monster's Analysis Monster team values summed over the kept categories; your rank against the league on that sum.
  Best = highest rank, then fewer punts, then widest margin. It is not the one measure on purpose: on the roster as it stands,
  punting can only lower expected categories won. Shown at the top ("Use this build") and as the top three under Try a different
  build, next to your own preview.

## League tab standings (7.40.0, agreed with the owner)

`standProj` / `standingsCard` in `season.js`. One table at a time, chosen with tabs at the top of the card (Current, Still to
win, Projected final; `S(lg).stnTab`, 7.40.1). The three tables:
1. **Current standings:** Yahoo's rank, W-L-T and pct (a tie counts as half a win), with the playoff line.
2. **Remaining categories to win:** Basketball Monster's Analysis Monster rest-of-season win rate × categories a week × weeks left,
   with the per-opponent "you W-L-T". The maths is in the header.
3. **Projected final standings:** Yahoo W + expected wins; L + the rest of the categories left; ties unchanged, none projected; pct
   as Yahoo works it; playoff line at Yahoo's playoff team count; your gap to the line in categories.

Categories a week come from Yahoo's settings (`ysetp.cats`). Weeks left = (first playoff week − 1) − the weeks already in Yahoo's
standings, counted as (W + L + T) ÷ categories, so a finished week is never counted twice. No model of our own and no adjustments:
the rate is Analysis Monster's as given. Checked by hand against the 16 Nov Mad dogs numbers.

## Trades from Trade Monster (7.50.0, every trade feature since 7.51.0)

Every trade number is Basketball Monster's: both teams' Win% change in Trade Monster, shown as category matchups won out of 99 a
week (Win% x 99). The co-pilot has no trade maths of its own (`trade.js` and `H2H.side`'s "for them" were removed in 7.51.0).
- **Find Trades** (`bbmTrades` in `sync.js`, daily with the full sync, `bbmtm:<lid>`): each of your players' one-for-ones.
  `tmDeals` in `season.js` applies the bar (`bar99`, +3), the acceptance checks (`themMin` −1, `rankGap` 15) and indexes the
  deals by your player (`by`) and by theirs (`tgt`). Best trades, the Trade block, Finder, the Roster trade lines and its sell
  labels (a sell = a realistic swap that clears the bar) all read it.
- **Analyze Trade** (`bbmAnalyze` in `sync.js`, asked live via `M.ana` in `ctxBlock`): the deal ticked on Yahoo's trade or offer
  page, with Basketball Monster's category "Gains" row. `tmVerdict` in `context.js` shows it. The companion (`companion`) lists
  both rosters with Find Trades' one-for-one for each player. The phone page can't ask Trade Monster and says so.
- The co-pilot only adds detail: what the other team needs, Yahoo ranks, injuries, the season so far, Josh's notes, and the
  "most of the gain is in one category" note (over 70% of Basketball Monster's positive category gain).

## Pickups from Find Free Agents (7.52.0)

- **Find Free Agents** (`bbmFAs` in `sync.js`, every 2.5 hours and after any league add/drop, `bbmfa:<lid>`): each of your players set to Drop, its top 20 free agents
  with your Win% change. `bbmBoard` in `season.js` rebuilds the board's `list` from it (best drop per free agent, the old drop rules
  kept: never an injured-list spot, a keep, a recent add or a top-half player) and `B.you(add, drop)` gives any listed pair, x 99.
  The bar is `pick99` (Settings → Advice: +3 / +2 / +1 of 99). Pickups, the Week brief, Lineup step 1 and the drop label all read it.
- **Wait until Monday**: the drop has more games left this week than the add in Matchup Monster's grid (`mmWeek`, `gamesLeft`).
- **This week: categories in play** (`weekHoles`): Matchup Monster's category win chances (20 to 80%) and its free agents to consider
  strong in them (category value +0.5 or more), most games left first. Timing only: it never reorders the list.
- **Analyze Add/Drop** (`bbmAnalyzeAdd`, live via `M.anaAdd`): the Yahoo add card's swap. Empty roster spot: the list shows each
  free agent with his best drop ("≥"); the Yahoo card asks for the plain add.
- Not yet on Basketball Monster (the Lineup phase): the week planner's streams and `b.swap` for pairs it didn't list.

## Matchup from Matchup Monster (7.53.0)

- **The hero, the live card and the next-week card** read `bbmView(m, p)` in `season.js`: Matchup Monster's Win Probability per
  category (`bbmWin`) and its totals, as given. Expected categories = their sum; the chance to take the week = `H2H.weekWin` on them
  (categories taken as independent). No odds of our own; the planner's "their lineup" switch is gone from the hero.
- **Your planned lineup is ticked** before the read: `tickPlan` in `sync.js` sets your game ticks to `plan:<league>` (under 12 hours
  old) and processes again (`m.planned`). Started = ticked, benched = not; played days and players the plan doesn't list keep
  Yahoo's imported ticks. The opponent is as imported from Yahoo. Next week is as set on Yahoo.
- **Live:** Yahoo's score and totals so far are the facts; the chances and the totals at the finish are Matchup Monster's.
- No Matchup Monster week (a failed read or a synthetic week): the card says so instead of showing numbers.
- Still the old measure, on purpose: the forecast logs (`h2hfc`, `lgfc`) that feed the forecast check.

**Basketball Monster first (7.50.0, owner's founding rule):** advice starts from BBM's own outputs. The add-on's existing logic sifts and adds detail to them, but never replaces them with its own numbers. Nothing existing is removed. Trades: sync.js `bbmTrades` runs Trade Monster's "Find Trades" (button FINDTRADES, DD2 blank = whole league) for each of your players once a day, stored as `bbmtm:<lid>`. `tmDeals` in season.js turns Team1+/Team2+ (Win% points) into category matchups out of 99 (× 0.99). A swap is shown when you gain at least `bar99` (default +3). It's realistic when they lose at most `themMin` (default −1) and the Yahoo ranks are within `rankGap` (default 15). Otherwise it goes under "Good for you, unlikely to be accepted", with the reason. All three are per-league settings. Best trades shows the profile you're selling, then the teams he fits (their needs from teamNeeds) and their players. The co-pilot's own category breakdown only adds the ">70% in one category" note. Do next names your player only. Next phases: Pickups from Matchup Monster's "Free Agents to Consider" and BBM weekly projections (fill the week's category holes), then Matchup, then Lineup.

**Sixth Man brand (7.54.0, locked by the owner):** the add-on is called Sixth Man (the gecko id stays the same, or updates break).
- Colours: court navy #0E1A2B, ball orange #F26B1D, orange for text on cream #C24E0C, hardwood cream #F5F1EA. Light theme = cream,
  dark = navy, never white or black (`theme.css` `:root` and its dark block; `--brand-*` tokens).
- Type: Poppins for text, Barlow Condensed 800 for the wordmark and the hero number (`--wordmark`), Graduate for the 6. All three are
  bundled in `firefox/fonts` (open font licence), never loaded from the web.
- Icon: an orange ball, both curved seams, the Graduate 6 between them, on a rounded navy square; 16 and 32 px drop the seams.
  Drawn by `tools/icons.html` (needs the repo served over http). The phone's home-screen icon is a full navy square (iOS rounds it).
- Landing page: `home.html` replaced the Draft / In season menu. The full animation plays on the very first open (`landingSeen`), a
  quicker one after, none with reduced motion. "Check this week" opens the season panel; Draft is a small link under it.
- Phone: opens on the landing page, navy `theme-color` for Safari's home-screen app.
- The repo folder is `sixth-man` (renamed from `fantasy-copilot` on 22 Nov 2026); the GitHub repo and release names are unchanged.

**Phone page (7.47.0, owner has an iPhone):** `tools/phone/server.js` serves the add-on's own panel read-only on this PC (127.0.0.1:8770), using `tools/phone/shim.js` in place of Firefox's browser API. The background (bg.js `toPhone`) posts its storage there every 5 minutes, leaving out sign-in keys, and only posts from moz-extension origins are accepted. The copy is kept in %LOCALAPPDATA%\fantasy-copilot\phone-store.json, outside the repo. The phone reaches it through Tailscale (`tailscale serve --bg 8770`), never a public address. It starts at login from Startup\fantasy-copilot-phone.vbs. It also reopens Firefox minimised if it isn't running on two checks 2.5 minutes apart; an empty "no-firefox" file in that folder pauses this. The PC must be awake with Firefox open. On the phone it is view-only, and Sync re-reads the PC's newest copy. Test: t_phone.

**Navigation (7.46.0, agreed with the owner):** one bottom tab per decision: Matchup (key `week`: Do next across roster, lineup and
trades, then the full weekly estimate; never hide the estimate), Lineup (`team`), Pickups (`players`: free agents and waivers), Trades
(`trades`: Best trades, Roster, Trade block, Finder, and the Yahoo trade-page card; Roster moved here from Season in 7.49.0 because the
owner puts players on the block from it), Season (`season`: standings, League so far, then Build, How it works). Old stored `strategy`/`league` map to the new keys (`OLDTAB`). `strategyCard` takes `page`; `data-gostab="page:sub"`
links across pages. Best trades has no waiver section (that is Pickups).

**UI polish and NumberFlow (7.45.0):** no UI frameworks: the add-on stays plain JavaScript (React libraries would need a
bundler and AMO source submission). The v13 block at the end of `theme.css` is the polish pass. `firefox/vendor/number-flow/`
is NumberFlow 0.6.2, readable and unchanged apart from what its README lists; keep library files `.js`, never `.mjs`. `roll()` in
`season.js` rolls `.hero-pct` and `.tcs-n b` when a sync changes them, then restores the plain text; without the library they pulse as before.

## Reliability (7.42.0)

- **Reading Yahoo and Basketball Monster pages:** match what a thing is (a player link goes to `/players/<id>`), never what it
  isn't (class names change). Yahoo markup is tested against `tools/test/fixtures` (`t_yahoo.js`).
- **Last good copy:** a read that comes back implausible never overwrites a good one (league rosters: `okScan` in `sync.js`).
- **Loud failures:** `selfTest` runs after every full sync. Failed checks show in the panel's status line, and a newly failing
  check sends one Firefox notification.
- **Release gate:** `node tools/test/all.js` runs in the release workflow before signing.

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
- **The scorecard everything answers to (7.43.0):** the scoring lives in `firefox/advice.js` (`ADVICE.score`), shared by the panel
  (League tab, "Does the advice win?" under Forecast check) and the offline tool. A feature or model change should show it moves
  this number.
- **Scoring the advice offline:** `node tools/advice-backtest.js copilot-forecast-data.json [--weeks 4]` scores each weekly
  decision on the following weeks' actual player totals (`pjact`) and actual league totals (`lgweek`), in the board's unit,
  against holding and both alternatives. It reports:
  - realized vs predicted gain
  - how well the board's order holds up
- **Tests:** browser-free tests are in `tools/test`. Panel render tests run against the add-on loaded in
  Firefox (`web-ext run`). Never commit store exports: they hold the owner's league data.

## 8.0.1 fixes
- Opening a page never starts a sync; the background (bg.js alarms) keeps the store current and the page shows the last copy at once.
- Status dots (`.dot`, `.fd`, `.ndot`, `.ldot`, `.dchip::after`, landing ticks) are drawn as little basketballs (`--ball` mask in theme.css), same colours.
- Season → Build sits in a fold (`details.bfold`, data-k `buildfold`), closed by default.
- iPhone home-screen app: the page starts below the status bar (`env(safe-area-inset-top)`), with a page-coloured strip behind the clock.
- The in-app punt is app-wide inside Sixth Man but never changes BBM's own punt settings (BBM's value ranks follow BBM's settings).

## 8.0.2
- Landing: one connection bar (green "Live" when the newest sync is under 40 min old and every league's last sync worked; amber otherwise), then a whistle and crowd cheer made with Web Audio in home.js (no sound files). Browsers block sound before a tap, so then it plays on the first tap.
- Sync button is in the top bar (`#syncNow` in season.html): arrows only, spinning while a sync runs, a green tick for 1.6 s when one finishes (`syncTick`).
- Matchup page order: live / chances first, then "Today: do next", then next week.
- Light syncs every 15 min in the background; the page asks for one at once if a league has no Find Free Agents list yet.
- Ball glyphs: 24-unit mask with three seams, 12–14 px.

## 8.0.3
- Landing sounds live in `sound.js` (Web Audio, no files): court lines drawing = shoe squeaks, the ball's drop = two bounces (at 55% and 85% of the `drop` keyframes), bar full = a short whistle, Let's play = swish then crowd cheer (the page waits 1.7 s so it's heard). Each fires from the animation's own `animationstart`, so it stays in time at either speed. `SND.at` plays nothing until sound is allowed (most phones need a tap first) and never queues stale sounds.
- The Matchup Monster health check allows few free agents in the last two days of a week (only players with games left are listed then).
- 8.0.4: the Let's play cheer is a recording, `firefox/sounds/cheer.mp3` ("Short crowd cheer" by Driken5482 on Pixabay, Pixabay Content License: free in apps, no credit needed), decoded once on open and faded out at 1.65 s. The whistle is about 0.4 s. The phone server serves .mp3.

## 8.0.5 lineup truth
- Each day's Yahoo lineup (`ylu:<lid>`) is re-read by the background sync: today every sync, other days left this week every 2 hours or after a roster change. Before this, day copies were only read while the panel was open and could be a week old.
- `actualFor` overlays the newest roster read (`yr:`) on an older day copy: injury tags and injured-list spots come from the newest read, and players no longer on the roster drop out.
- `resolveDay`: a player Yahoo shows healthy, off the injured list and with a game that day is never kept out by Basketball Monster's zero / IL flag (`yPlays`). Yahoo out tags still bench a player.
- Landing sounds are all recordings (`firefox/sounds/`): squeak and swish are files the owner supplied, whistle and bounce are Pixabay (Pixabay Content License). Start offsets were measured once and live in `sound.js`. No crowd cheer; Let's play is the swish only.

## 8.0.6
- Landing: where the page can't play sound yet (iPhone Safari always; Firefox if it blocks), the intro holds paused behind "Tap to tip off" (`body.wait` / `body.tap`, `#tip` in home.html); the tap turns sound on and starts the intro, so squeak, bounce and whistle play. Where sound is already allowed, or with reduced motion, it starts at once as before.
- `SND.at` after a tap (`armed`) waits for Safari's `resume()` instead of dropping the sound.
