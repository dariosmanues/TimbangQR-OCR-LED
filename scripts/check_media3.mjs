import sharp from 'sharp';

const img3 = 'C:\\Users\\Axioo Pongo\\.gemini\\antigravity-ide\\brain\\b2fe221c-3caa-47db-9775-9f13ddb7da4f\\.user_uploaded\\media_1791290409964.png';
const crop3 = { left: 126, top: 31, width: 455, height: 198 };

async function checkMedia3() {
  const { data, info } = await sharp(img3).extract(crop3).raw().toBuffer({ resolveWithObject: true });
  // Find where lit digits are (x=245..350, y=45..115)
  console.log('Media 3 lit digit pixels:');
  for (let x = 255; x <= 340; x += 20) {
    const idx = (70 * info.width + x) * 4;
    const r = data[idx], g = data[idx+1], b = data[idx+2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const ex = r - Math.max(g, b);
    const bRatio = b / (r + 1);
    console.log(`x=${x}, y=70: rgb(${r}, ${g}, ${b}), ex=${ex}, lum=${Math.round(lum)}, bRatio=${bRatio.toFixed(2)}`);
  }
}
checkMedia3();
