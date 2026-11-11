# Fantasy co-pilot

A side panel for Yahoo fantasy basketball (head-to-head categories) that reads Basketball Monster's projections and your
Yahoo league, and turns them into plain-words advice: pickups, lineups, your build and trade fits.

- `firefox/` — the Firefox add-on. Every change here is signed by Mozilla automatically (see `.github/workflows/firefox.yml`)
  and published as a release; installed copies update themselves through `updates.json`.

No passwords, keys or league data live in this repository: sign-ins stay in your browser, and the Mozilla signing key is
stored as a GitHub secret.
