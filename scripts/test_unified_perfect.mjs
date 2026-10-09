import sharp from 'sharp';

const dir = 'C:/Users/Axioo Pongo/.gemini/antigravity-ide/brain/b2fe221c-3caa-47db-9775-9f13ddb7da4f/.user_uploaded/';
const files = [
  { name: 'media_1791290409964.png', crop: { left: 126, top: 31, width: 455, height: 198 } },
  { name: 'media_1791294188976.png', crop: { left: 125, top: 225, width: 460, height: 200 } },
  { name: 'media_1791296798288.png', crop: { left: 125, top: 200, width: 455, height: 200 } },
];

async function run() {
  for (const f of files) {
    const { data, info } = await sharp(dir + f.name).extract(f.crop).raw().toBuffer({ resolveWithObject: true });
    const width = info.width, height = info.height;

    let maxR = 0, maxG = 0, maxExcess = 0, maxLum = 0;
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const ex = r - Math.max(g, b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (b / (r + 1) <= 0.35) {
        if (r > maxR) maxR = r;
        if (g > maxG) maxG = g;
        if (ex > maxExcess) maxExcess = ex;
        if (lum > maxLum) maxLum = lum;
      }
    }

    const mask = new Uint8Array(width * height);
    const hasBacklitBloom = maxExcess >= 180 && maxLum >= 125 && maxG >= 60;

    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const ex = r - Math.max(g, b);
      const bRatio = b / (r + 1);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (bRatio <= 0.35 && r >= 155) {
        if (hasBacklitBloom) {
          // Intense backlit / phone bloom: lit segments have hot white-yellow core (high green & lum)
          if (r >= 195 && ex >= 40 && (lum >= 116 || g >= 62)) {
            mask[i] = 1;
          }
        } else {
          // Direct physical LED: pure deep red with dark background
          if (r >= Math.max(165, Math.round(maxR * 0.72)) && ex >= Math.max(65, Math.round(maxExcess * 0.60))) {
            mask[i] = 1;
          }
        }
      }
    }

    // Row projection
    const ySum = new Int32Array(height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) ySum[y] += mask[y * width + x];
    }
    const maxY = Math.max(...ySum);
    let y0 = -1, y1 = -1;
    for (let y = 0; y < height; y++) {
      if (ySum[y] >= maxY * 0.20) {
        if (y0 === -1) y0 = y;
        y1 = y;
      }
    }
    const bh = y1 - y0 + 1;

    // Col projection
    const colSum = new Int32Array(width);
    for (let x = 0; x < width; x++) {
      for (let y = y0; y <= y1; y++) colSum[x] += mask[y * width + x];
    }

    const spans = [];
    let start = -1;
    for (let x = 0; x < width; x++) {
      if (colSum[x] >= 3) {
        if (start === -1) start = x;
      } else {
        if (start !== -1) {
          if (x - start >= 4) spans.push({ x0: start, x1: x - 1, w: x - start });
          start = -1;
        }
      }
    }
    if (start !== -1 && width - start >= 4) spans.push({ x0: start, x1: width - 1, w: width - start });

    // Valley split
    const splitSpans = [];
    function split(sp) {
      if (sp.w > bh * 0.52) {
        let minVal = 9999, minX = -1, maxVal = 0;
        for (let x = sp.x0; x <= sp.x1; x++) {
          if (colSum[x] > maxVal) maxVal = colSum[x];
        }
        const xStart = sp.x0 + Math.floor(sp.w * 0.20);
        const xEnd = sp.x1 - Math.floor(sp.w * 0.20);
        for (let x = xStart; x <= xEnd; x++) {
          if (colSum[x] < minVal) { minVal = colSum[x]; minX = x; }
        }
        if (minX !== -1 && minVal <= maxVal * 0.35) {
          split({ x0: sp.x0, x1: minX - 1, w: minX - sp.x0 });
          split({ x0: minX + 1, x1: sp.x1, w: sp.x1 - minX });
          return;
        }
      }
      splitSpans.push(sp);
    }
    for (const s of spans) split(s);

    const digitSpans = splitSpans.filter(s => s.w >= 5 && (s.w / bh) >= 0.10 && (s.w / bh) <= 0.60);

    const DIGIT_MAP = {
      '0': { on: ['a', 'b', 'c', 'd', 'e', 'f'], off: ['g'] },
      '1': { on: ['b', 'c'], off: ['a', 'd', 'e', 'f', 'g'] },
      '2': { on: ['a', 'b', 'g', 'e', 'd'], off: ['c', 'f'] },
      '3': { on: ['a', 'b', 'g', 'c', 'd'], off: ['e', 'f'] },
      '4': { on: ['f', 'g', 'b', 'c'], off: ['a', 'd', 'e'] },
      '5': { on: ['a', 'f', 'g', 'c', 'd'], off: ['b', 'e'] },
      '6': { on: ['a', 'f', 'g', 'e', 'c', 'd'], off: ['b'] },
      '7': { on: ['a', 'b', 'c'], off: ['d', 'e', 'f', 'g'] },
      '8': { on: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], off: [] },
      '9': { on: ['a', 'b', 'c', 'd', 'f', 'g'], off: ['e'] },
    };

    function sampleZone(x0, y0, sw, sh, [l, t, r, b]) {
      const fx = Math.max(0, Math.min(width - 1, Math.floor(x0 + sw * l)));
      const tx = Math.max(0, Math.min(width - 1, Math.ceil(x0 + sw * r)));
      const fy = Math.max(0, Math.floor(y0 + sh * t));
      const ty = Math.max(0, Math.ceil(y0 + sh * b));
      let lit = 0, tot = 0;
      for (let y = fy; y <= ty; y++) {
        for (let x = fx; x <= tx; x++) {
          lit += mask[y * width + x];
          tot++;
        }
      }
      return tot > 0 ? lit / tot : 0;
    }

    let resStr = '';
    for (const s of digitSpans) {
      const ratio = s.w / bh;
      if (ratio <= 0.28) {
        resStr += '1';
        continue;
      }
      const gUp = sampleZone(s.x0, y0, s.w, bh, [0.35, 0.30, 0.65, 0.45]);
      const gDown = sampleZone(s.x0, y0, s.w, bh, [0.35, 0.45, 0.65, 0.58]);
      const acts = {
        a: sampleZone(s.x0, y0, s.w, bh, [0.20, 0.00, 0.80, 0.22]),
        b: sampleZone(s.x0, y0, s.w, bh, [0.65, 0.10, 1.00, 0.48]),
        c: sampleZone(s.x0, y0, s.w, bh, [0.65, 0.52, 1.00, 0.90]),
        d: sampleZone(s.x0, y0, s.w, bh, [0.20, 0.75, 0.80, 1.00]),
        e: sampleZone(s.x0, y0, s.w, bh, [0.00, 0.52, 0.35, 0.90]),
        f: sampleZone(s.x0, y0, s.w, bh, [0.00, 0.10, 0.35, 0.48]),
        g: Math.max(gUp, gDown),
      };
      let bestD = null, bestScore = -999;
      for (const [d, rule] of Object.entries(DIGIT_MAP)) {
        if (d === '1') continue;
        let score = 0;
        for (const onSeg of rule.on) score += acts[onSeg];
        for (const offSeg of rule.off) score += (1 - acts[offSeg]);
        const norm = score / 7;
        if (norm > bestScore) {
          bestScore = norm;
          bestD = d;
        }
      }
      resStr += bestD;
    }
    console.log(`${f.name} => "${resStr}" (spans: ${digitSpans.length}, bh: ${bh})`);
  }
}

run().catch(console.error);
