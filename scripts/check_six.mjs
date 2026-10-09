import sharp from 'sharp';

async function checkSixProfile() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  console.log('Vertical profile of x=195..215 (digit 6):');
  for (let y = 0; y < 90; y += 3) {
    let row = '';
    for (let x = 188; x <= 218; x += 2) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const bRatio = b / (r + 1);
      const ex = r - Math.max(g, b);
      const isLit = (r >= 200 && ex >= 45 && bRatio <= 0.32 && (g >= 75 || lum >= 130));
      row += isLit ? '#' : '.';
    }
    console.log(`y=${y.toString().padStart(2)}: |${row}|`);
  }
}
checkSixProfile();
