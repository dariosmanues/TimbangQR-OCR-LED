import sharp from 'sharp';

async function testThreshold() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;

  let phoneHits = 0, laptopHits = 0;
  for (let i = 0; i < width * height; i++) {
    const x = i % width;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const bRatio = b / (r + 1);
    const ex = r - Math.max(g, b);

    // Glowing LED segment:
    // High red, low blue ratio (bRatio <= 0.32), intense glow (g >= 75 || lum >= 130)
    if (r >= 200 && ex >= 45 && bRatio <= 0.32 && (g >= 75 || lum >= 130)) {
      if (x < 120) laptopHits++;
      else phoneHits++;
    }
  }
  console.log(`laptopHits: ${laptopHits}, phoneHits: ${phoneHits}`);
}
testThreshold();
