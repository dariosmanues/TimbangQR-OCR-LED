import sharp from 'sharp';

const img3 = 'C:\\Users\\Axioo Pongo\\.gemini\\antigravity-ide\\brain\\b2fe221c-3caa-47db-9775-9f13ddb7da4f\\.user_uploaded\\media_1791290409964.png';
const crop3 = { left: 126, top: 31, width: 455, height: 198 };

async function checkBackground() {
  const { data, info } = await sharp(img3).extract(crop3).raw().toBuffer({ resolveWithObject: true });
  console.log('Unlit background on media_3 (e.g. x=200, 220, 260, 305):');
  for (let x of [200, 220, 263, 308, 335, 345]) {
    const idx = (70 * info.width + x) * 4;
    console.log(`x=${x}, y=70: rgb(${data[idx]}, ${data[idx+1]}, ${data[idx+2]})`);
  }
}
checkBackground();
