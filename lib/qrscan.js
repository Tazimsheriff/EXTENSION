/**
 * Find one QR code in a poster, including a code that only fills a corner.
 * jsQR misses those when it has to read the whole picture at once.
 */
(function (root) {
  function crop(data, width, x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row += 1) {
      const start = ((y + row) * width + x) * 4;
      out.set(data.subarray(start, start + w * 4), row * w * 4);
    }
    return out;
  }

  function read(qr, data, width, height) {
    if (width < 29 || height < 29) return '';
    try {
      const code = qr(data, width, height, { inversionAttempts: 'attemptBoth' });
      return code && code.data ? String(code.data) : '';
    } catch (err) {
      return '';
    }
  }

  function tiles(width, height) {
    const list = [[0, 0, width, height]];
    const base = Math.min(width, height);
    [0.72, 0.5, 0.34].forEach((fraction) => {
      const win = Math.round(base * fraction);
      if (win < 80 || (win >= width && win >= height)) return;
      const step = Math.max(32, Math.round(win * 0.46));
      const xs = [];
      const ys = [];
      for (let x = 0; x + win <= width; x += step) xs.push(x);
      for (let y = 0; y + win <= height; y += step) ys.push(y);
      const lastX = Math.max(0, width - win);
      const lastY = Math.max(0, height - win);
      if (!xs.length || xs[xs.length - 1] !== lastX) xs.push(lastX);
      if (!ys.length || ys[ys.length - 1] !== lastY) ys.push(lastY);
      for (let yi = ys.length - 1; yi >= 0; yi -= 1) {
        for (let xi = xs.length - 1; xi >= 0; xi -= 1) {
          list.push([xs[xi], ys[yi], Math.min(win, width), Math.min(win, height)]);
        }
      }
    });
    return list;
  }

  function scan(qr, data, width, height, shouldStop) {
    if (!qr || !data || !width || !height) return '';
    const boxes = tiles(width, height);
    for (let i = 0; i < boxes.length; i += 1) {
      if (shouldStop && shouldStop()) return '';
      const box = boxes[i];
      const x = box[0];
      const y = box[1];
      const w = box[2];
      const h = box[3];
      const part = x === 0 && y === 0 && w === width && h === height
        ? data
        : crop(data, width, x, y, w, h);
      const text = read(qr, part, w, h);
      if (text) return text;
    }
    return '';
  }

  function scanAsync(qr, data, width, height, shouldStop) {
    return new Promise((resolve) => {
      if (!qr || !data || !width || !height) { resolve(''); return; }
      const boxes = tiles(width, height);
      let index = 0;
      function step() {
        if (shouldStop && shouldStop()) { resolve(''); return; }
        const started = Date.now();
        while (index < boxes.length && Date.now() - started < 8) {
          const box = boxes[index];
          index += 1;
          const x = box[0];
          const y = box[1];
          const w = box[2];
          const h = box[3];
          const part = x === 0 && y === 0 && w === width && h === height
            ? data
            : crop(data, width, x, y, w, h);
          const text = read(qr, part, w, h);
          if (text) { resolve(text); return; }
          if (shouldStop && shouldStop()) { resolve(''); return; }
        }
        if (index >= boxes.length) resolve('');
        else setTimeout(step, 0);
      }
      step();
    });
  }

  root.hackfillScanQr = scan;
  root.hackfillScanQrAsync = scanAsync;
})(typeof self !== 'undefined' ? self : this);
