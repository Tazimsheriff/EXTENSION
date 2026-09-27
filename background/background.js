/**
 * HackFill background worker. Chrome and Firefox MV3.
 * Menus are rebuilt on install and on browser startup because a service worker does not stay alive.
 */

const ext = (typeof browser !== 'undefined') ? browser : chrome;

function loadPacked(path) {
  try {
    if (typeof importScripts === 'function') {
      importScripts(ext.runtime.getURL(path));
      return Promise.resolve();
    }
  } catch (err) { /* event pages load with a script tag */ }
  if (typeof document === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = ext.runtime.getURL(path);
    script.onload = () => resolve();
    script.onerror = () => resolve();
    (document.head || document.documentElement).appendChild(script);
  });
}

try {
  // Chrome runs this file as a worker. Firefox runs it as an event page, which has no importScripts.
  if (typeof importScripts === 'function') {
    importScripts(ext.runtime.getURL('lib/jsQR.min.js'));
    importScripts(ext.runtime.getURL('lib/qrscan.js'));
  }
} catch (err) {
  // QR open still works from the page when the image can be drawn locally.
}

function scanner() {
  if (typeof hackfillScanQr === 'function') return hackfillScanQr;
  if (typeof self !== 'undefined' && typeof self.hackfillScanQr === 'function') return self.hackfillScanQr;
  return null;
}

function ensureQr() {
  const jobs = [];
  if (!qrDecoder()) jobs.push(loadPacked('lib/jsQR.min.js'));
  if (!scanner()) jobs.push(loadPacked('lib/qrscan.js'));
  return Promise.all(jobs);
}

function qrDecoder() {
  if (typeof self !== 'undefined' && typeof self.jsQR === 'function') return self.jsQR;
  if (typeof jsQR === 'function') return jsQR;
  return null;
}

function safeHttpUrl(text) {
  const raw = String(text || '').trim();
  const accept = (value) => {
    try {
      const url = new URL(value);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch (err) { /* not a url */ }
    return '';
  };
  const direct = accept(raw);
  if (direct) return direct;
  const match = raw.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return '';
  return accept(match[0].replace(/[),.;]+$/, ''));
}

function drawingContext(width, height) {
  if (typeof OffscreenCanvas === 'function') {
    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (ctx) return ctx;
    } catch (err) { /* Firefox event pages can draw on a normal canvas */ }
  }
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas.getContext('2d');
}

async function decodeQrFromUrl(url) {
  await ensureQr();
  const qr = qrDecoder();
  if (!qr || !url || !/^https?:/i.test(url)) return '';
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const blob = await response.blob();
    if (!blob.size || blob.size > 12 * 1024 * 1024) return '';
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = drawingContext(width, height);
    if (!ctx) return '';
    ctx.drawImage(bitmap, 0, 0, width, height);
    if (bitmap.close) bitmap.close();
    const image = ctx.getImageData(0, 0, width, height);
    const scan = scanner();
    if (scan) return scan(qr, image.data, image.width, image.height);
    const code = qr(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
    return code && code.data ? String(code.data) : '';
  } catch (err) {
    return '';
  }
}

let menuJob = Promise.resolve();

function createMenu(item) {
  return Promise.resolve()
    .then(() => ext.contextMenus.create(item))
    .catch(() => {});
}

function whenMenusCleared() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      const cleared = ext.contextMenus.removeAll(finish);
      if (cleared && typeof cleared.then === 'function') cleared.then(finish, finish);
    } catch (err) {
      finish();
    }
  });
}

function createContextMenus() {
  menuJob = menuJob.then(async () => {
    await whenMenusCleared();
    await createMenu({
      id: 'hackfill_root',
      title: 'HackFill',
      contexts: ['editable', 'page']
    });
    await createMenu({
      parentId: 'hackfill_root',
      id: 'hackfill_autofill_page',
      title: 'Fill this page',
      contexts: ['editable', 'page']
    });
    await createMenu({
      parentId: 'hackfill_root',
      id: 'hackfill_sep1',
      type: 'separator',
      contexts: ['editable']
    });
    const items = [
      ['hackfill_my_secid', 'Insert college / roll ID'],
      ['hackfill_my_github', 'Insert GitHub'],
      ['hackfill_my_linkedin', 'Insert LinkedIn'],
      ['hackfill_my_resume', 'Insert resume link'],
      ['hackfill_my_portfolio', 'Insert portfolio'],
      ['hackfill_my_email', 'Insert email']
    ];
    for (const [id, title] of items) {
      await createMenu({
        parentId: 'hackfill_root',
        id,
        title,
        contexts: ['editable']
      });
    }
    await createMenu({
      id: 'hackfill_scan_qr',
      title: 'Open link in this QR',
      contexts: ['image']
    });
  }).catch(() => {});
  return menuJob;
}

ext.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const current = await ext.storage.local.get(['hasInitialized', 'profile']);
    if (!current.hasInitialized) {
      await ext.storage.local.set({
        profile: current.profile || {},
        teammates: [],
        snippets: [],
        tracker: [],
        team: { size: 1, slots: [] },
        hasInitialized: true
      });
    }
  }
  await createContextMenus();
});

ext.runtime.onStartup.addListener(() => createContextMenus());
createContextMenus();

async function fillPayload() {
  const data = await ext.storage.local.get(['profile', 'teammates', 'team', 'snippets']);
  return {
    profile: data.profile || {},
    teammates: data.teammates || [],
    team: data.team || null,
    snippets: data.snippets || []
  };
}

async function openQrFromImage(info, tab) {
  const src = info.srcUrl || '';
  let text = '';
  try {
    if (src.startsWith('blob:') || src.startsWith('data:')) {
      const res = await ext.tabs.sendMessage(tab.id, { action: 'DECODE_QR_SRC', url: src });
      text = res && res.text ? res.text : '';
    } else {
      text = await decodeQrFromUrl(src);
    }
  } catch (err) {
    text = '';
  }
  const href = safeHttpUrl(text);
  if (href) {
    ext.tabs.create({ url: href });
    return;
  }
  try {
    await ext.tabs.sendMessage(tab.id, { action: 'QR_NOTICE', text: text || '' });
  } catch (err) { /* page cannot show a notice */ }
}

ext.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === 'hackfill_scan_qr') {
    await openQrFromImage(info, tab);
    return;
  }
  const payload = await fillPayload();
  if (info.menuItemId === 'hackfill_autofill_page') {
    ext.tabs.sendMessage(tab.id, { action: 'AUTOFILL_PAGE', payload });
    return;
  }
  const profile = payload.profile;
  const map = {
    hackfill_my_secid: profile.secId,
    hackfill_my_github: profile.github,
    hackfill_my_linkedin: profile.linkedin,
    hackfill_my_resume: profile.resume,
    hackfill_my_portfolio: profile.portfolio,
    hackfill_my_email: profile.email
  };
  const text = map[info.menuItemId] || '';
  if (text) ext.tabs.sendMessage(tab.id, { action: 'INSERT_SNIPPET', text });
});

ext.commands.onCommand.addListener(async (command) => {
  if (command !== 'autofill_form') return;
  const tabs = await ext.tabs.query({ active: true, currentWindow: true });
  const tab = tabs && tabs[0];
  if (!tab || !tab.id) return;
  const payload = await fillPayload();
  ext.tabs.sendMessage(tab.id, { action: 'AUTOFILL_PAGE', payload });
});

ext.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'DECODE_QR') {
    decodeQrFromUrl(request.url).then((text) => sendResponse({ text: text || '' }));
    return true;
  }
  if (request.action === 'OPEN_LINK') {
    const href = safeHttpUrl(request.url);
    if (href) ext.tabs.create({ url: href });
    sendResponse({ ok: Boolean(href) });
    return true;
  }
  if (request.action !== 'OPEN_SETTINGS') return undefined;
  ext.windows.create({
    url: ext.runtime.getURL('popup/popup.html?standalone=true'),
    type: 'popup',
    width: 480,
    height: 760
  });
  sendResponse({ success: true });
  return true;
});
