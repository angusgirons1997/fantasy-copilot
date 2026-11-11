(() => {
  const OWS = window.WebSocket; if (!OWS || OWS.__mdf) return;
  const post = d => { try { window.postMessage({ __mdflive: 1, d }, '*'); } catch (e) {} };
  function W(url, prot) {
    const ws = prot !== undefined ? new OWS(url, prot) : new OWS(url);
    ws.addEventListener('message', ev => { if (typeof ev.data === 'string' && /^(0\||D\||O\|draft-labels)/.test(ev.data)) post(ev.data.slice(0, 50000)); });
    return ws;
  }
  W.prototype = OWS.prototype; W.CONNECTING = 0; W.OPEN = 1; W.CLOSING = 2; W.CLOSED = 3; W.__mdf = 1;
  window.WebSocket = W;
})();
