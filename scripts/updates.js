// Adds a signed Firefox version to updates.json, the file Firefox checks to update the add-on by itself.
// Usage: node scripts/updates.js <version>   (run by the GitHub workflow after Mozilla signs the add-on)
const fs = require('fs');
const v = process.argv[2]; if (!v) throw new Error('version missing');
const repo = process.env.GITHUB_REPOSITORY; if (!repo) throw new Error('GITHUB_REPOSITORY missing');
const id = JSON.parse(fs.readFileSync('firefox/manifest.json', 'utf8')).browser_specific_settings.gecko.id;
const u = JSON.parse(fs.readFileSync('updates.json', 'utf8'));
const list = ((u.addons = u.addons || {})[id] = u.addons[id] || { updates: [] }).updates;
if (!list.some(x => x.version === v)) list.push({ version: v, update_link: `https://github.com/${repo}/releases/download/v${v}/fantasy-copilot-${v}.xpi` });
fs.writeFileSync('updates.json', JSON.stringify(u, null, 2) + '\n');
