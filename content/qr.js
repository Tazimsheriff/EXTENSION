/**
 * Point at a QR code on the page to open its link.
 * http(s) images are decoded in the extension background so cross-origin posters still work.
 */
(() => {
  if (window.__HACKFILL_QR__) return;
  window.__HACKFILL_QR__ = true;
  if (location.protocol === 'chrome-extension:' || location.protocol === 'moz-extension:') return;

  const ext = (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  const results = new WeakMap();
  const bySrc = new Map();
  let activeEl = null;
  let scanTimer = 0;
  let hideTimer = 0;
  let scanToken = 0;

  function qrFn() {
    if (typeof self.jsQR === 'function') return self.jsQR;
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

  function openLink(href) {
    const safe = safeHttpUrl(href);
    if (!safe) return;
    runtimeSend({ action: 'OPEN_LINK', url: safe });
  }

  function runtimeSend(message) {
    return new Promise((resolve) => {
      if (!ext || !ext.runtime || !ext.runtime.sendMessage) { resolve(null); return; }
      let done = false;
      const finish = (value) => { if (!done) { done = true; resolve(value); } };
      try {
        const ret = ext.runtime.sendMessage(message, (res) => {
          const err = ext.runtime.lastError;
          finish(err ? null : res);
        });
        if (ret && typeof ret.then === 'function') ret.then((res) => finish(res), () => finish(null));
      } catch (err) {
        finish(null);
      }
    });
  }

  function qrScanner(asyncScan) {
    const root = typeof self !== 'undefined' ? self : null;
    if (asyncScan && root && typeof root.hackfillScanQrAsync === 'function') return root.hackfillScanQrAsync;
    if (typeof hackfillScanQr === 'function') return hackfillScanQr;
    if (root && typeof root.hackfillScanQr === 'function') return root.hackfillScanQr;
    return null;
  }

  function decodeImageData(imageData, shouldStop) {
    const qr = qrFn();
    if (!qr || !imageData) return Promise.resolve('');
    const scan = qrScanner(true);
    if (typeof scan === 'function') return Promise.resolve(scan(qr, imageData.data, imageData.width, imageData.height, shouldStop));
    try {
      const code = qr(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
      return Promise.resolve(code && code.data ? String(code.data) : '');
    } catch (err) {
      return Promise.resolve('');
    }
  }

  function decodeDrawable(source, shouldStop) {
    const sw = source.naturalWidth || source.width || 0;
    const sh = source.naturalHeight || source.height || 0;
    if (!sw || !sh) return Promise.resolve('');
    const scale = Math.min(1, 1000 / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    try {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(source, 0, 0, w, h);
      return decodeImageData(ctx.getImageData(0, 0, w, h), shouldStop);
    } catch (err) {
      return Promise.resolve('');
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image'));
      img.src = src;
    });
  }

  async function decodeSrcLocal(src) {
    try {
      const img = await loadImage(src);
      return decodeDrawable(img);
    } catch (err) {
      return '';
    }
  }

  function sourceOf(el) {
    if (!el) return '';
    if (el.tagName === 'IMG') return el.currentSrc || el.src || '';
    if (el.tagName === 'CANVAS') return '';
    const bg = getComputedStyle(el).backgroundImage || '';
    const match = /url\((['"]?)(.*?)\1\)/.exec(bg);
    return match ? match[2] : '';
  }

  function bigEnough(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    const rect = el.getBoundingClientRect();
    return rect.width >= 64 && rect.height >= 64;
  }

  function findCandidate(node) {
    let el = node && node.nodeType === 1 ? node : null;
    for (let depth = 0; el && el !== document.body && depth < 5; depth += 1) {
      if (el.id === 'hackfill-qr' || el.id === 'hackfill-host') return null;
      if (el.tagName === 'IMG' || el.tagName === 'CANVAS') return bigEnough(el) ? el : null;
      el = el.parentElement;
    }
    return null;
  }

  function ensureUi() {
    let host = document.getElementById('hackfill-qr');
    if (host) return host.shadowRoot;
    host = document.createElement('div');
    host.id = 'hackfill-qr';
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;display:none;width:max-content;height:max-content;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        button {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          max-width: 240px;
          border: 1px solid transparent;
          color: #fff;
          cursor: pointer;
          text-align: left;
          border-radius: 14px;
          padding: 8px 12px;
          font: 600 12px "Segoe UI", sans-serif;
          background:
            linear-gradient(180deg, #3a1612, #140807) padding-box,
            linear-gradient(120deg, #fff, #ffd0bf, #ff4b2b, #9be7ff) border-box;
          box-shadow: 0 10px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.28);
        }
        small { font-weight: 500; color: #d7dee6; font-size: 11px; }
      </style>
      <button type="button" id="open"><span id="label">Open link</span><small id="sub"></small></button>`;
    document.documentElement.appendChild(host);
    shadow.getElementById('open').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (host.dataset.href) openLink(host.dataset.href);
      else if (host.dataset.text) copyText(host.dataset.text);
    });
    return shadow;
  }

  function hideChip() {
    const host = document.getElementById('hackfill-qr');
    if (host) host.style.display = 'none';
  }

  function placeChip(el) {
    const host = document.getElementById('hackfill-qr');
    if (!host) return;
    const rect = el.getBoundingClientRect();
    const width = 220;
    const left = Math.max(8, Math.min(rect.left + 8, window.innerWidth - width - 8));
    const top = Math.max(8, rect.top + 8);
    host.style.left = left + 'px';
    host.style.top = top + 'px';
  }

  function pretty(href) {
    try {
      const url = new URL(href);
      const path = (url.pathname + url.search).replace(/\/$/, '');
      const shown = url.host + (path && path !== '/' ? path : '');
      return shown.length > 46 ? shown.slice(0, 44) + '…' : shown;
    } catch (err) {
      return href.slice(0, 46);
    }
  }

  function showChip(el, hit) {
    if (!hit || (!hit.href && !hit.text)) { hideChip(); return; }
    const shadow = ensureUi();
    const host = document.getElementById('hackfill-qr');
    shadow.getElementById('label').textContent = hit.href ? 'Open link' : 'Copy QR text';
    shadow.getElementById('sub').textContent = hit.href ? pretty(hit.href) : String(hit.text).slice(0, 80);
    host.dataset.href = hit.href || '';
    host.dataset.text = hit.text || '';
    placeChip(el);
    host.style.display = 'block';
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    const shadow = ensureUi();
    shadow.getElementById('label').textContent = 'Copied';
    setTimeout(hideChip, 900);
  }

  let openAfter = null;

  function pixelsOf(el, shouldStop) {
    try {
      if (el.tagName === 'CANVAS') {
        const ctx = el.getContext('2d', { willReadFrequently: true });
        const scale = Math.min(1, 1000 / Math.max(el.width, el.height));
        if (scale === 1) return decodeImageData(ctx.getImageData(0, 0, el.width, el.height), shouldStop);
        const copy = document.createElement('canvas');
        copy.width = Math.max(1, Math.round(el.width * scale));
        copy.height = Math.max(1, Math.round(el.height * scale));
        const copyCtx = copy.getContext('2d', { willReadFrequently: true });
        copyCtx.drawImage(el, 0, 0, copy.width, copy.height);
        return decodeImageData(copyCtx.getImageData(0, 0, copy.width, copy.height), shouldStop);
      }
      if (el.tagName === 'IMG' && el.naturalWidth) return decodeDrawable(el, shouldStop);
    } catch (err) {
      return Promise.resolve('');
    }
    return Promise.resolve('');
  }

  async function readQr(el, shouldStop) {
    const local = await pixelsOf(el, shouldStop);
    if (local) return local;
    if (shouldStop && shouldStop()) return '';
    const src = sourceOf(el);
    if (!src) return '';
    if (src.startsWith('blob:') || src.startsWith('data:')) return decodeSrcLocal(src);
    const res = await runtimeSend({ action: 'DECODE_QR', url: src });
    return res && res.text ? res.text : '';
  }

  async function runScan(el, token) {
    const stop = () => token !== scanToken;
    const src = sourceOf(el);
    if (src && bySrc.has(src)) {
      const cached = bySrc.get(src);
      results.set(el, cached);
      if (!stop() && activeEl === el && cached.href) showChip(el, cached);
      if (openAfter === el && cached.href) openLink(cached.href);
      return;
    }
    const text = await readQr(el, stop);
    if (stop()) return;
    const hit = { text: text || '', href: safeHttpUrl(text) };
    results.set(el, hit);
    if (src) bySrc.set(src, hit);
    if (activeEl === el && hit.href) showChip(el, hit);
    if (openAfter === el && hit.href) {
      openAfter = null;
      openLink(hit.href);
    }
  }

  function scheduleScan(el, force) {
    if (!force && el === activeEl) return;
    activeEl = el;
    clearTimeout(hideTimer);
    clearTimeout(scanTimer);
    const known = results.get(el);
    if (known && known.href) showChip(el, known);
    if (known) return;
    const token = ++scanToken;
    scanTimer = setTimeout(() => runScan(el, token), force ? 0 : 450);
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      activeEl = null;
      clearTimeout(scanTimer);
      scanToken += 1;
      hideChip();
    }, 180);
  }

  document.addEventListener('mouseover', (e) => {
    const host = document.getElementById('hackfill-qr');
    if (host && e.composedPath && e.composedPath().includes(host)) {
      clearTimeout(hideTimer);
      return;
    }
    const el = findCandidate(e.target);
    if (el) scheduleScan(el);
    else scheduleHide();
  }, true);

  document.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const host = document.getElementById('hackfill-qr');
    if (host && e.composedPath && e.composedPath().includes(host)) return;
    const el = findCandidate(e.target);
    if (!el) return;
    const hit = results.get(el);
    if (hit && hit.href) {
      e.preventDefault();
      e.stopPropagation();
      openLink(hit.href);
      return;
    }
    if (hit) return;
    openAfter = el;
    scheduleScan(el, true);
  }, true);

  window.addEventListener('scroll', () => { if (activeEl) placeChip(activeEl); }, true);
  window.addEventListener('resize', () => { if (activeEl) placeChip(activeEl); });

  if (ext && ext.runtime && ext.runtime.onMessage) {
    ext.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'DECODE_QR_SRC') {
        decodeSrcLocal(request.url || '').then((text) => sendResponse({ text }));
        return true;
      }
      if (request.action === 'QR_NOTICE') {
        const href = safeHttpUrl(request.text);
        if (href) openLink(href);
        else if (request.text) {
          const shadow = ensureUi();
          const host = document.getElementById('hackfill-qr');
          shadow.getElementById('label').textContent = 'Copied QR text';
          shadow.getElementById('sub').textContent = String(request.text).slice(0, 80);
          host.dataset.href = '';
          host.dataset.text = request.text;
          host.style.left = '16px';
          host.style.top = '16px';
          host.style.display = 'block';
          copyText(request.text);
        } else {
          const shadow = ensureUi();
          const host = document.getElementById('hackfill-qr');
          shadow.getElementById('label').textContent = 'No QR code in this image';
          shadow.getElementById('sub').textContent = '';
          host.dataset.href = '';
          host.style.left = '16px';
          host.style.top = '16px';
          host.style.display = 'block';
          setTimeout(hideChip, 1400);
        }
        sendResponse({ ok: true });
        return false;
      }
      return undefined;
    });
  }
})();
