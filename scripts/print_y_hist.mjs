import sharp from 'sharp';

async function printYHist() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  console.log('Y-Histogram for new_crop.png:');
  for (let y = 0; y < info.height; y += 4) {
    let s = 0;
    for (let x = 0; x < info.width; x++) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (r >= 200 && (g >= 70 || lum >= 130)) s++;
    }
    const bar = '#'.repeat(Math.round(s / 4));
    console.log(`y=${y.toString().padStart(3)}: [${bar.padEnd(35)}] (${s})`);
  }
}
printYHist();
