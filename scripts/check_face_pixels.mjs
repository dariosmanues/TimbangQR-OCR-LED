import sharp from 'sharp';

const faceImg = 'C:\\Users\\Axioo Pongo\\.gemini\\antigravity-ide\\brain\\b2fe221c-3caa-47db-9775-9f13ddb7da4f\\.user_uploaded\\media_1791291376133.png';

async function checkFacePixels() {
  const { data, info } = await sharp(faceImg).raw().toBuffer({ resolveWithObject: true });
  console.log('Face image pixels matching (r>=180, ex>=40, bRatio<=0.35, lum>=130):');
  let samples = [];
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const ex = r - Math.max(g, b);
    const bRatio = b / (r + 1);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (r >= 180 && ex >= 40 && bRatio <= 0.35 && lum >= 130) {
      samples.push({ r, g, b, ex, bRatio: bRatio.toFixed(2), lum: Math.round(lum) });
    }
  }
  console.log('Total:', samples.length);
  console.log('Samples:', samples.slice(0, 10));
}
checkFacePixels();
