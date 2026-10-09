import sharp from 'sharp';

async function testProperValleySplit() {
  const imgPath = 'C:\\Users\\Axioo Pongo\\.gemini\\antigravity-ide\\brain\\b2fe221c-3caa-47db-9775-9f13ddb7da4f\\.user_uploaded\\media_1791294188976.png';
  const crop = { left: 125, top: 225, width: 460, height: 200 };
  const { data, info } = await sharp(imgPath).extract(crop).raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;

  // Mask
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const bRatio = b / (r + 1);
    const ex = r - Math.max(g, b);
    if (r >= 200 && ex >= 45 && bRatio <= 0.32 && (g >= 75 || lum >= 130)) {
      mask[i] = 1;
    }
  }

  // Row projection
  const ySum = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) ySum[y] += mask[y * width + x];
  }

  let y0 = -1, y1 = -1;
  const maxY = Math.max(...ySum);
  for (let y = 0; y < height; y++) {
    if (ySum[y] >= maxY * 0.20) {
      if (y0 === -1) y0 = y;
      y1 = y;
    }
  }
  const bh = y1 - y0 + 1;

  // Column sums inside the band
  const colSum = new Int32Array(width);
  for (let x = 0; x < width; x++) {
    for (let y = y0; y <= y1; y++) colSum[x] += mask[y * width + x];
  }

  const spans = [];
  let sStart = -1;
  for (let x = 0; x < width; x++) {
    if (colSum[x] >= 6) {
      if (sStart === -1) sStart = x;
    } else {
      if (sStart !== -1) {
        if (x - sStart >= 6) spans.push({ x0: sStart, x1: x - 1, w: x - sStart });
        sStart = -1;
      }
    }
  }
  if (sStart !== -1) spans.push({ x0: sStart, x1: width - 1, w: width - sStart });

  const finalSpans = [];
  function splitSpan(span) {
    const sw = span.w;
    if (sw > bh * 0.55) {
      let minVal = 9999, minX = -1;
      let maxVal = 0;
      for (let x = span.x0; x <= span.x1; x++) {
        if (colSum[x] > maxVal) maxVal = colSum[x];
      }
      const xStart = span.x0 + Math.floor(sw * 0.20);
      const xEnd = span.x1 - Math.floor(sw * 0.20);
      for (let x = xStart; x <= xEnd; x++) {
        if (colSum[x] < minVal) { minVal = colSum[x]; minX = x; }
      }
      if (minX !== -1 && minVal <= maxVal * 0.35) {
        splitSpan({ x0: span.x0, x1: minX - 1, w: minX - span.x0 });
        splitSpan({ x0: minX + 1, x1: span.x1, w: span.x1 - minX });
        return;
      }
    }
    finalSpans.push(span);
  }
  for (const s of spans) splitSpan(s);

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

  const DIGIT_MAP = {
    "0": { on: ["a", "b", "c", "d", "e", "f"], off: ["g"] },
    "1": { on: ["b", "c"], off: ["a", "d", "e", "f", "g"] },
    "2": { on: ["a", "b", "g", "e", "d"], off: ["c", "f"] },
    "3": { on: ["a", "b", "g", "c", "d"], off: ["e", "f"] },
    "4": { on: ["f", "g", "b", "c"], off: ["a", "d", "e"] },
    "5": { on: ["a", "f", "g", "c", "d"], off: ["b", "e"] },
    "6": { on: ["a", "f", "g", "e", "c", "d"], off: ["b"] },
    "7": { on: ["a", "b", "c"], off: ["d", "e", "f", "g"] },
    "8": { on: ["a", "b", "c", "d", "e", "f", "g"], off: [] },
    "9": { on: ["a", "b", "c", "d", "f", "g"], off: ["e"] },
  };

  let result = "";
  for (const s of finalSpans) {
    const sw = s.w;
    const ratio = sw / bh;
    if (sw < 8 || ratio < 0.10) continue;

    // Narrow single column bar = 1 (ratio <= 0.30)
    if (ratio <= 0.30) {
      result += "1";
      console.log(`Span [${s.x0}..${s.x1}, w:${sw}, r:${ratio.toFixed(2)}] => 1 (narrow vertical bar)`);
      continue;
    }

    const acts = {
      a: sampleZone(s.x0, y0, sw, bh, [0.20, 0.00, 0.80, 0.22]),
      b: sampleZone(s.x0, y0, sw, bh, [0.65, 0.10, 1.00, 0.48]),
      c: sampleZone(s.x0, y0, sw, bh, [0.65, 0.52, 1.00, 0.90]),
      d: sampleZone(s.x0, y0, sw, bh, [0.20, 0.75, 0.80, 1.00]),
      e: sampleZone(s.x0, y0, sw, bh, [0.00, 0.52, 0.35, 0.90]),
      f: sampleZone(s.x0, y0, sw, bh, [0.00, 0.10, 0.35, 0.48]),
      g: Math.max(
        sampleZone(s.x0, y0, sw, bh, [0.35, 0.30, 0.65, 0.45]),
        sampleZone(s.x0, y0, sw, bh, [0.35, 0.45, 0.65, 0.58])
      ),
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
    console.log(`Span [${s.x0}..${s.x1}, w:${sw}, r:${ratio.toFixed(2)}] => ${bestD} (${bestScore.toFixed(2)}) acts:`, acts);
    result += bestD;
  }
  console.log(`\n===> FINAL RESULT: "${result}" <===`);
}
testProperValleySplit();
