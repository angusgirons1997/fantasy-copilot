// Phone page: serves the add-on's own panel, read-only, from the PC's last synced copy, so a phone can open it through Tailscale.
// The add-on (bg.js) posts its storage here every 5 minutes, without sign-in data. Listens on this PC only (127.0.0.1); the phone
// reaches it through `tailscale serve --bg 8770`, which only your own Tailscale devices can open. The copy is kept outside the repo.
// node tools/phone/server.js   (started at login by the Startup folder entry; see CLAUDE.md "Phone page")
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = 8770, FF = path.join(__dirname, '..', '..', 'firefox'), SHIM = path.join(__dirname, 'shim.js');
const DIR = path.join(process.env.LOCALAPPDATA || require('os').homedir(), 'fantasy-copilot'), STORE = path.join(DIR, 'phone-store.json');
const TYPE = { html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2' };
const SECRET = /auth|pass|token|secret|cookie|cred/i; // same rule as the panel's test-data download

function handle(q, r) {
  const send = (code, body, type) => { r.writeHead(code, { 'content-type': type || 'text/plain', 'cache-control': 'no-store' }); r.end(body); };
  const url = decodeURIComponent(q.url.split('?')[0]);
  if (q.method === 'POST' && url === '/store') {
    // only the add-on may write: web pages always send an http(s) Origin on a POST, the add-on's background sends moz-extension://
    if (!/^moz-extension:\/\//.test(q.headers.origin || '')) return send(403, 'no');
    const parts = []; q.on('data', c => parts.push(c)); q.on('end', () => {
      try { const j = JSON.parse(Buffer.concat(parts).toString('utf8')); if (!j || typeof j.store !== 'object') throw new Error('no store');
        Object.keys(j.store).forEach(k => { if (SECRET.test(k)) delete j.store[k]; });
        fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(STORE + '.tmp', JSON.stringify(j)); fs.renameSync(STORE + '.tmp', STORE); send(200, 'ok');
      } catch (e) { send(400, 'bad copy'); } });
    return;
  }
  if (q.method !== 'GET') return send(405, 'no');
  if (url === '/store.json') return fs.readFile(STORE, (e, d) => e ? send(404, 'No copy yet: open Firefox on the PC with the co-pilot installed') : send(200, d, TYPE.json));
  if (url === '/phone-shim.js') return fs.readFile(SHIM, (e, d) => e ? send(500, 'shim missing') : send(200, d, TYPE.js));
  const f = path.join(FF, url === '/' ? 'season.html' : url);
  if (!f.startsWith(FF + path.sep)) return send(404, 'not found');
  const ext = f.split('.').pop();
  fs.readFile(f, (e, d) => {
    if (e || !TYPE[ext]) return send(404, 'not found');
    if (ext !== 'html') return send(200, d, TYPE[ext]);
    const v = (() => { try { return JSON.parse(fs.readFileSync(path.join(FF, 'manifest.json'), 'utf8')).version; } catch (x) { return ''; } })();
    // the shim goes in before the add-on's first script; the icon is for "Add to Home Screen"
    send(200, String(d).replace('<script', `<script>window.PHONE_V=${JSON.stringify(v)}</script><script src="phone-shim.js"></script><script`)
      .replace('</head>', '<link rel="apple-touch-icon" href="icons/icon-128.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Co-pilot"></head>'), TYPE.html);
  });
}

// Firefox has to stay open for the add-on to sync. If it isn't running on two checks in a row (2.5 minutes apart, so a Firefox
// restart for an update isn't caught), open it minimised. To pause this, create an empty file named "no-firefox" in DIR.
function keepFirefox() {
  const { execFile, spawn } = require('child_process'); const FX = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe'; let missed = 0;
  setInterval(() => execFile('tasklist', ['/FI', 'IMAGENAME eq firefox.exe', '/NH'], (e, out) => {
    if (e || fs.existsSync(path.join(DIR, 'no-firefox')) || !fs.existsSync(FX)) return;
    missed = /firefox\.exe/i.test(out) ? 0 : missed + 1;
    if (missed >= 2) { missed = 0; spawn('powershell', ['-NoProfile', '-Command', `Start-Process -FilePath '${FX}' -WindowStyle Minimized`], { stdio: 'ignore', windowsHide: true }).unref(); } // not detached: that stops Start-Process opening anything
  }), 150e3);
}

if (require.main === module) { http.createServer(handle).listen(PORT, '127.0.0.1', () => console.log('phone page on http://127.0.0.1:' + PORT)); if (process.platform === 'win32') keepFirefox(); }
module.exports = { handle, PORT, STORE };
