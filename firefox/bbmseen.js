// Basketball Monster pages: note when you're signed in there, so a sync that was waiting for you to sign in carries on straight away.
if (!globalThis.browser && globalThis.chrome) globalThis.browser = chrome;
(function () { try { if (document.querySelector('a[href*="Logout.aspx" i]')) browser.storage.local.set({ bbmSeen: Date.now() }); } catch (e) {} })();
