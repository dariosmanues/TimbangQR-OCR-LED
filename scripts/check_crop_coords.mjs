import sharp from 'sharp';

async function checkCropCoords() {
  const f = 'C:\\Users\\Axioo Pongo\\.gemini\\antigravity-ide\\brain\\b2fe221c-3caa-47db-9775-9f13ddb7da4f\\.user_uploaded\\media_1791294188976.png';
  const { data: fullData, info: fullInfo } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
  let minX = 9999, maxX = -1, minY = 9999, maxY = -1;
  for (let y = 10; y < 400; y++) {
    for (let x = 10; x < fullInfo.width - 10; x++) {
      const idx = (y * fullInfo.width + x) * fullInfo.channels;
      const r = fullData[idx], g = fullData[idx+1], b = fullData[idx+2];
      const isGreen = (g > 150 && r < 50 && b > 80 && b < 160);
      if (isGreen) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log('Border green:', { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY });
}
checkCropCoords();
