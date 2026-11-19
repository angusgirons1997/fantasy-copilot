NumberFlow 0.6.2 (MIT, https://number-flow.barvian.me), the `.mjs` files from the npm package's `dist/` folder, unminified and renamed to `.js` (with their imports to match) so Firefox serves them as scripts, otherwise unchanged
except one line: in `lite.js` and `ssr-DvIINv8w.js`, `from "esm-env"` reads `from "./esm-env.js"`. `esm-env.js` is the
one-line browser value of esm-env 1.2.2 (MIT, https://github.com/benmccann/esm-env), whose `true.js` is `export default true`.
Loaded by `season.html` as a module; `season.js` uses the `<number-flow>` element to roll numbers that change on a sync.
