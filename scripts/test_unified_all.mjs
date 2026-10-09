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
    const w = info.width, h = info.height;

    let maxR = 0, maxG = 0, maxLum = 0, maxEx = 0;
    for (let i = 0; i < w * h; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const ex = r - Math.max(g, b);
      if (r > maxR) maxR = r;
      if (g > maxG) maxG = g;
      if (lum > maxLum) maxLum = lum;
      if (ex > maxEx) maxEx = ex;
    }

    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const ex = r - Math.max(g, b);
      const bRatio = b / (r + 1);

      if (r >= 160 && bRatio <= 0.35) {
        if (maxR >= 240 && maxLum >= 120) {
          if (lum >= Math.min(125, maxLum * 0.72) || g >= 65) {
            mask[i] = 1;
          }
        } else {
          if (r >= maxR * 0.78 && ex >= 65) {
            mask[i] = 1;
          }
        }
      }
    }

    const ySum = new Int32Array(h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) ySum[y] += mask[y * w + x];
    }
    const maxY = Math.max(...ySum);
    let y0 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      if (ySum[y] >= maxY * 0.20) {
        if (y0 === -1) y0 = y;
        y1 = y;
      }
    }
    const bh = y1 - y0 + 1;

    const colSum = new Int32Array(w);
    for (let x = 0; x < w; x++) {
      for (let y = y0; y <= y1; y++) colSum[x] += mask[y * w + x];
    }

    const spans = [];
    let start = -1;
    for (let x = 0; x < w; x++) {
      if (colSum[x] >= 3) {
        if (start === -1) start = x;
      } else {
        if (start !== -1) {
          if (x - start >= 4) spans.push({ x0: start, x1: x - 1, w: x - start });
          start = -1;
        }
      }
    }
    if (start !== -1 && w - start >= 4) spans.push({ x0: start, x1: w - 1, w: w - start });

    const digitSpans = spans.filter(s => s.w >= 5 && (s.w / bh) >= 0.10 && (s.w / bh) <= 0.60);

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
      const fx = Math.max(0, Math.min(w - 1, Math.floor(x0 + sw * l)));
      const tx = Math.max(0, Math.min(w - 1, Math.ceil(x0 + sw * r)));
      const fy = Math.max(0, Math.floor(y0 + sh * t));
      const ty = Math.max(0, Math.ceil(y0 + sh * b));
      let lit = 0, tot = 0;
      for (let y = fy; y <= ty; y++) {
        for (let x = fx; x <= tx; x++) {
          lit += mask[y * w + x];
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
