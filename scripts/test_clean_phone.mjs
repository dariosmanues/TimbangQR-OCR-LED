import sharp from 'sharp';

async function testCleanPhoneDigits() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;

  // Mask of active glowing red LED segments:
  // r >= 180, b <= 45, bRatio <= 0.35, and either (g >= 70 || lum >= 130)
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const bRatio = b / (r + 1);

    if (r >= 180 && b <= 45 && bRatio <= 0.35 && (g >= 70 || lum >= 130)) {
      mask[i] = 1;
    }
  }

  // Row projection
  const ySum = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) ySum[y] += mask[y * width + x];
  }

  // Find the digit band:
  // The digits are between y=0 and where y drops below threshold before the bottom bezel
  console.log('Y-sums:');
  for (let y = 0; y < height; y += 5) {
    console.log(`y=${y}: ${ySum[y]}`);
  }

  // Find digit band:
  let y0 = 0, y1 = 0;
  for (let y = 0; y < 110; y++) {
    if (ySum[y] >= 20) y1 = y;
  }
  const bh = y1 - y0 + 1;
  console.log(`Digit band: y0=${y0}, y1=${y1}, bh=${bh}`);

  // Column sums inside the digit band [y0..y1]
  const colSum = new Int32Array(width);
  for (let x = 0; x < width; x++) {
    for (let y = y0; y <= y1; y++) colSum[x] += mask[y * width + x];
  }

  // Find digit spans
  const spans = [];
  let sStart = -1;
  for (let x = 0; x < width; x++) {
    if (colSum[x] >= 5) {
      if (sStart === -1) sStart = x;
    } else {
      if (sStart !== -1) {
        if (x - sStart >= 5) spans.push({ x0: sStart, x1: x - 1, w: x - sStart });
        sStart = -1;
      }
    }
  }
  if (sStart !== -1) spans.push({ x0: sStart, x1: width - 1, w: width - sStart });

  console.log('Spans found in phone display:', spans);

  // If a span width is wider than 0.50 * bh, check if it's conjoined and needs valley splitting:
  const splitSpans = [];
  function splitSpan(span) {
    const sw = span.w;
    if (sw > bh * 0.48) {
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
    splitSpans.push(span);
  }
  for (const s of spans) splitSpan(s);

  console.log('Spans after splitting:', splitSpans);

  // Recognition
  const SEGMENTS = {
    a: [0.20, 0.00, 0.80, 0.25],
    b: [0.65, 0.10, 1.00, 0.48],
    c: [0.65, 0.52, 1.00, 0.90],
    d: [0.20, 0.75, 0.80, 1.00],
    e: [0.00, 0.52, 0.35, 0.90],
    f: [0.00, 0.10, 0.35, 0.48],
    g: [0.35, 0.40, 0.65, 0.60],
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
      for (let x = fx; x <= tx; x++) {
        lit += mask[y * width + x];
        tot++;
      }
    }
    return tot > 0 ? lit / tot : 0;
  }

  let res = "";
  for (const s of splitSpans) {
    const sw = s.w;
    const ratio = sw / bh;
    if (sw < 8 || ratio < 0.10) continue;

    // Narrow single bar
    if (ratio <= 0.25) {
      res += "1";
      console.log(`Span [${s.x0}..${s.x1}, w:${sw}] => 1`);
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
    console.log(`Span [${s.x0}..${s.x1}, w:${sw}, r:${ratio.toFixed(2)}] => ${bestD} (${bestScore.toFixed(2)}) acts:`, acts);
    res += bestD;
  }
  console.log(`FINAL RESULT: "${res}"`);
}
testCleanPhoneDigits();
