import sharp from 'sharp';

async function testOtsuSegment(imgPath, label) {
  console.log(`\n=================== ${label} ===================`);
  const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;
  const totalPixels = width * height;

  // Collect luminance of red pixels:
  const redLums = [];
  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4;
    const r = data[off], g = data[off + 1], b = data[off + 2];
    const ex = r - Math.max(g, b);
    if (r >= 140 && ex >= 40) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      redLums.push(Math.round(lum));
    }
  }

  console.log(`Red pixels count: ${redLums.length}`);
  if (redLums.length < 50) {
    console.log('REJECTED: No red display detected.');
    return null;
  }

  // Otsu's threshold on luminance of red pixels to separate glowing segments from dark red acrylic background
  const hist = new Int32Array(256);
  for (const l of redLums) hist[l]++;
  let sumT = 0;
  for (let t = 0; t < 256; t++) sumT += t * hist[t];
  let curMax = 0, otsuLum = 120, sB = 0, wB = 0;
  const totalR = redLums.length;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = totalR - wB;
    if (wF === 0) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (sumT - sB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > curMax) { curMax = v; otsuLum = t; }
  }

  console.log(`Otsu luminance threshold: ${otsuLum}`);
  // Threshold should be at least otsuLum
  const threshLum = Math.max(120, otsuLum);

  // Binarize
  const mask = new Uint8Array(totalPixels);
  let litTotal = 0;
  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4;
    const r = data[off], g = data[off + 1], b = data[off + 2];
    const ex = r - Math.max(g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (r >= 170 && ex >= 40 && lum >= threshLum) {
      mask[i] = 1;
      litTotal++;
    }
  }
  console.log(`Lit segment pixels: ${litTotal} (${((litTotal/totalPixels)*100).toFixed(2)}%)`);

  // Y-Projection
  const ySum = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    let s = 0;
    const rowOff = y * width;
    for (let x = 0; x < width; x++) s += mask[rowOff + x];
    ySum[y] = s;
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
  console.log(`Digit row: y0=${y0}, y1=${y1}, height=${bh}`);

  // X-Projection
  const colSum = new Int32Array(width);
  for (let x = 0; x < width; x++) {
    for (let y = y0; y <= y1; y++) colSum[x] += mask[y * width + x];
  }

  // Find spans
  const spans = [];
  let sStart = -1;
  for (let x = 0; x < width; x++) {
    if (colSum[x] >= 3) {
      if (sStart === -1) sStart = x;
    } else {
      if (sStart !== -1) {
        if (x - sStart >= 4) spans.push({ x0: sStart, x1: x - 1, w: x - sStart });
        sStart = -1;
      }
    }
  }
  if (sStart !== -1 && width - sStart >= 4) spans.push({ x0: sStart, x1: width - 1, w: width - sStart });
  console.log('Spans found:', spans);

  // Split spans:
  // If span width > bh * 0.45: find valleys
  const finalSpans = [];
  function splitSpan(span) {
    const sw = span.w;
    if (sw > bh * 0.45) {
      let minVal = 9999, minX = -1;
      const xStart = span.x0 + Math.floor(sw * 0.22);
      const xEnd = span.x1 - Math.floor(sw * 0.22);
      for (let x = xStart; x <= xEnd; x++) {
        if (colSum[x] < minVal) { minVal = colSum[x]; minX = x; }
      }
      if (minX !== -1) {
        splitSpan({ x0: span.x0, x1: minX - 1, w: minX - span.x0 });
        splitSpan({ x0: minX + 1, x1: span.x1, w: span.x1 - minX });
        return;
      }
    }
    finalSpans.push(span);
  }
  for (const s of spans) splitSpan(s);
  console.log('Final spans:', finalSpans);

  // Recognize digits
  const SEGMENTS = {
    a: [0.25, 0.00, 0.75, 0.20],
    b: [0.70, 0.12, 1.00, 0.45],
    c: [0.70, 0.55, 1.00, 0.88],
    d: [0.25, 0.80, 0.75, 1.00],
    e: [0.00, 0.55, 0.30, 0.88],
    f: [0.00, 0.12, 0.30, 0.45],
    g: [0.38, 0.44, 0.62, 0.56],
  };

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

  function sampleZone(x0, y0, sw, sh, [l, t, r, b]) {
    const fx = Math.max(0, Math.min(width - 1, Math.floor(x0 + sw * l)));
    const tx = Math.max(0, Math.min(width - 1, Math.ceil(x0 + sw * r)));
    const fy = Math.max(0, Math.floor(y0 + sh * t));
    const ty = Math.max(0, Math.ceil(y0 + sh * b));
    let lit = 0, tot = 0;
    for (let y = fy; y <= ty; y++) {
      const off = y * width;
      for (let x = fx; x <= tx; x++) {
        lit += mask[off + x];
        tot++;
      }
    }
    return tot > 0 ? lit / tot : 0;
  }

  let resultStr = "";
  for (const s of finalSpans) {
    const sw = s.w;
    const ratio = sw / bh;
    if (sw < 6 || ratio < 0.12) continue;

    if (ratio <= 0.28) {
      resultStr += "1";
      continue;
    }

    const acts = {
      a: sampleZone(s.x0, y0, sw, bh, SEGMENTS.a),
      b: sampleZone(s.x0, y0, sw, bh, SEGMENTS.b),
      c: sampleZone(s.x0, y0, sw, bh, SEGMENTS.c),
      d: sampleZone(s.x0, y0, sw, bh, SEGMENTS.d),
      e: sampleZone(s.x0, y0, sw, bh, SEGMENTS.e),
      f: sampleZone(s.x0, y0, sw, bh, SEGMENTS.f),
      g: sampleZone(s.x0, y0, sw, bh, SEGMENTS.g),
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
    console.log(`Span [${s.x0}..${s.x1}, w:${sw}, r:${ratio.toFixed(2)}] => ${bestD} (${bestScore.toFixed(2)})`);
    if (bestD && bestScore >= 0.50) resultStr += bestD;
  }
  console.log(`RESULT: "${resultStr}"`);
}

async function main() {
  await testOtsuSegment('scripts/new_crop.png', 'NEW CROP (media_5)');
  await testOtsuSegment('scripts/crop_scale.png', 'OLD CROP (media_3)');
}
main();
