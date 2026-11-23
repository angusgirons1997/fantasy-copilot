// Phone page server (tools/phone/server.js): only the add-on can write, sign-in keys are dropped, files outside firefox/ are refused,
// and pages get the shim. Runs against a throwaway copy location.
'use strict';
const assert = require('assert'), http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
process.env.LOCALAPPDATA = fs.mkdtempSync(path.join(os.tmpdir(), 'phone-'));
const { handle, STORE } = require('../phone/server.js');
const srv = http.createServer(handle).listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const req = (p, o) => new Promise((ok, no) => { const q = http.request(base + p, o || {}, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => ok({ code: r.statusCode, body: b })); }); q.on('error', no); q.end(o && o.body); });
  const body = JSON.stringify({ at: 'x', store: { activeLeague: 'A', bbmAuth: { pass: 'p' }, yapiToken: 't' } });
  try {
    assert.strictEqual((await req('/store', { method: 'POST', headers: { origin: 'https://evil.example' }, body })).code, 403, 'web pages cannot write');
    assert.strictEqual((await req('/store.json')).code, 404, 'no copy yet');
    assert.strictEqual((await req('/store', { method: 'POST', headers: { origin: 'moz-extension://abc' }, body })).code, 200, 'the add-on can write');
    const st = JSON.parse((await req('/store.json')).body).store;
    assert.deepStrictEqual(Object.keys(st), ['activeLeague'], 'sign-in keys dropped');
    const page = (await req('/season.html')).body; assert(/phone-shim\.js[\s\S]*data\.js/.test(page), 'shim before the add-on scripts');
    const home = (await req('/')).body; assert(/phone-shim\.js[\s\S]*home\.js/.test(home) && /Sixth Man/.test(home) && /#0E1A2B/.test(home), 'opens on the Sixth Man landing page, navy for Safari');
    assert.strictEqual((await req('/apple-touch-icon.png')).code, 200, 'the home-screen icon');
    assert.strictEqual((await req('/sounds/whistle.mp3')).code, 200, 'the landing whistle');
    assert.strictEqual((await req('/..%2Fmanifest.json')).code, 404, 'nothing outside firefox/');
    assert.strictEqual((await req('/%2E%2E/tools/phone/server.js')).code, 404, 'nothing outside firefox/');
    assert.strictEqual((await req('/theme.css')).code, 200);
    console.log('phone page ok');
  } finally { srv.close(); fs.rmSync(process.env.LOCALAPPDATA, { recursive: true, force: true }); }
  void STORE;
});
