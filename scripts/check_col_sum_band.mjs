import sharp from 'sharp';

async function checkColSumInBand() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  // In new_crop.png, the digits are at y=0..85
  console.log('Column sums in y=5..85 for x=130..350:');
  for (let x = 135; x <= 345; x += 2) {
    let s = 0;
    for (let y = 5; y <= 85; y++) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (r >= 200 && (g >= 70 || lum >= 130)) s++;
    }
    const bar = '#'.repeat(Math.round(s / 2));
    console.log(`x=${x}: [${bar.padEnd(40)}] (${s})`);
  }
}
checkColSumInBand();
