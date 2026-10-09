import sharp from 'sharp';

// Test current detectSsocrLed logic on scripts/new_crop.png
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

function sampleZone(mask, width, x0, y0, sw, sh, [l, t, r, b]) {
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

async function debugNewCrop() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;
  const totalPixels = width * height;
  const binaryMask = new Uint8Array(totalPixels);

  let maxR = 0, maxG = 0, maxExcess = 0;
  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4;
    const r = data[off], g = data[off + 1], b = data[off + 2];
    if (r > maxR) maxR = r;
    if (g > maxG) maxG = g;
    const ex = r - Math.max(g, b);
    if (ex > maxExcess) maxExcess = ex;
  }
  console.log('maxR:', maxR, 'maxExcess:', maxExcess);

  let threshMain = Math.max(175, Math.round(maxR * 0.81));
  let threshExcess = Math.max(65, Math.round(maxExcess * 0.68));
  console.log('threshMain:', threshMain, 'threshExcess:', threshExcess);

  let litTotal = 0;
  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4;
    const r = data[off], g = data[off + 1], b = data[off + 2];
    const ex = r - Math.max(g, b);
    const gRatio = g / (r + 1);
    const bRatio = b / (r + 1);
    if (r >= threshMain && ex >= threshExcess && gRatio <= 0.52 && bRatio <= 0.42) {
      binaryMask[i] = 1;
      litTotal++;
    }
  }
  console.log('litTotal:', litTotal);

  const ySum = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    let s = 0;
    const rowOff = y * width;
    for (let x = 0; x < width; x++) s += binaryMask[rowOff + x];
    ySum[y] = s;
  }
  const maxYSum = Math.max(...ySum);
  console.log('maxYSum:', maxYSum);

  let y0 = -1, y1 = -1;
  const threshRow = Math.max(3, Math.round(maxYSum * 0.18));
  for (let y = 0; y < height; y++) {
    if (ySum[y] >= threshRow) {
      if (y0 === -1) y0 = y;
      y1 = y;
    }
  }
  const bh = y1 - y0 + 1;
  console.log(`Band: y0=${y0}, y1=${y1}, bh=${bh}`);

  const colSum = new Int32Array(width);
  for (let x = 0; x < width; x++) {
    let s = 0;
    for (let y = y0; y <= y1; y++) s += binaryMask[y * width + x];
    colSum[x] = s;
  }

  const rawSpans = [];
  let sStart = -1;
  for (let x = 0; x < width; x++) {
    if (colSum[x] >= 3) {
      if (sStart === -1) sStart = x;
    } else {
      if (sStart !== -1) {
        if (x - sStart >= 3) rawSpans.push({ x0: sStart, x1: x - 1, w: x - sStart });
        sStart = -1;
      }
    }
  }
  if (sStart !== -1 && width - sStart >= 3) rawSpans.push({ x0: sStart, x1: width - 1, w: width - sStart });
  console.log('rawSpans:', rawSpans);

  const segmentedSpans = [];
  function splitSpan(span) {
    const sw = span.w;
    if (sw > bh * 0.44) {
      let minVal = 99999, minX = -1;
      const xStart = span.x0 + Math.floor(sw * 0.22);
      const xEnd = span.x1 - Math.floor(sw * 0.22);
      for (let x = xStart; x <= xEnd; x++) {
        if (colSum[x] < minVal) {
          minVal = colSum[x];
          minX = x;
        }
      }
      if (minX !== -1) {
        splitSpan({ x0: span.x0, x1: minX - 1, w: minX - span.x0 });
        splitSpan({ x0: minX + 1, x1: span.x1, w: span.x1 - minX });
        return;
      }
    }
    segmentedSpans.push(span);
  }
  for (const s of rawSpans) splitSpan(s);
  console.log('segmentedSpans:', segmentedSpans);

  for (const s of segmentedSpans) {
    const sw = s.w;
    const ratio = sw / bh;
    const acts = {
      a: sampleZone(binaryMask, width, s.x0, y0, sw, bh, SEGMENTS.a),
      b: sampleZone(binaryMask, width, s.x0, y0, sw, bh, SEGMENTS.b),
      c: sampleZone(binaryMask, width, s.x0, y0, sw, bh, SEGMENTS.c),
      d: sampleZone(binaryMask, width, s.x0, y0, sw, bh, SEGMENTS.d),
      e: sampleZone(binaryMask, width, s.x0, y0, sw, bh, SEGMENTS.e),
      f: sampleZone(binaryMask, width, s.x0, y0, sw, bh, SEGMENTS.f),
      g: sampleZone(binaryMask, width, s.x0, y0, sw, bh, SEGMENTS.g),
    };

    let bestD = null, bestScore = -999;
    for (const [d, rule] of Object.entries(DIGIT_MAP)) {
      if (d === "1") continue;
      let score = 0;
      for (const onSeg of rule.on) score += acts[onSeg];
      for (const offSeg of rule.off) score += (1 - acts[offSeg]);
      const norm = score / 7;
      if (norm > bestScore) {
        bestScore = norm;
        bestD = d;
      }
    }
    console.log(`Span [${s.x0}..${s.x1}, w:${sw}, r:${ratio.toFixed(2)}] => ratio<=0.28? ${ratio<=0.28}: bestD=${bestD} (${bestScore.toFixed(2)}) acts:`, acts);
  }
}
debugNewCrop();
