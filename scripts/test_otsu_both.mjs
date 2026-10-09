import sharp from 'sharp';

async function testOtsuBoth(imgPath, label) {
  const crop = label.includes('media_5')
    ? { left: 125, top: 225, width: 460, height: 200 }
    : { left: 125, top: 30, width: 450, height: 200 };

  const { data, info } = await sharp(imgPath).extract(crop).raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;

  // Collect lum of red pixels
  const lums = [];
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const ex = r - Math.max(g, b);
    const bRatio = b / (r + 1);
    if (r >= 150 && ex >= 30 && bRatio <= 0.40) {
      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      lums.push(lum);
    }
  }

  // Otsu
  const hist = new Int32Array(256);
  for (const l of lums) hist[l]++;
  let sumT = 0;
  for (let t = 0; t < 256; t++) sumT += t * hist[t];
  let curMax = 0, otsuL = 120, sB = 0, wB = 0;
  const total = lums.length;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sB += t * hist[t];
    const mB = sB / wB, mF = (sumT - sB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > curMax) { curMax = v; otsuL = t; }
  }

  console.log(`${label}: total red pixels: ${total}, Otsu lum: ${otsuL}`);
}

async function main() {
  const dir = 'C:\\Users\\Axioo Pongo\\.gemini\\antigravity-ide\\brain\\b2fe221c-3caa-47db-9775-9f13ddb7da4f\\.user_uploaded\\';
  await testOtsuBoth(dir + 'media_1791290409964.png', 'media_3');
  await testOtsuBoth(dir + 'media_1791294188976.png', 'media_5');
}
main();
