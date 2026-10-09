import sharp from 'sharp';

async function testOnMedia3() {
  const imgPath = 'C:\\Users\\Axioo Pongo\\.gemini\\antigravity-ide\\brain\\b2fe221c-3caa-47db-9775-9f13ddb7da4f\\.user_uploaded\\media_1791290409964.png';
  const crop = { left: 126, top: 31, width: 455, height: 198 };
  const { data, info } = await sharp(imgPath).extract(crop).raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;

  // In media_3:
  // The lit digits have: r >= 180, ex >= 80, bRatio <= 0.32
  // Let's check how many pixels pass:
  let count = 0;
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const bRatio = b / (r + 1);
    const ex = r - Math.max(g, b);
    if (r >= 180 && ex >= 70 && bRatio <= 0.32) {
      count++;
    }
  }
  console.log('Media 3 lit pixels with ex >= 70:', count);
}
testOnMedia3();
