import sharp from 'sharp';

async function plotNewCrop() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  const y0 = 0, y1 = 113;
  console.log('Column sums from x=130 to 350:');
  for (let x = 130; x <= 350; x += 2) {
    let cnt = 0;
    for (let y = y0; y <= y1; y++) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const ex = r - Math.max(g, b);
      if (r >= 200 && ex >= 120 && g / (r + 1) <= 0.52 && b / (r + 1) <= 0.42) cnt++;
    }
    const bar = '#'.repeat(Math.round(cnt / 3));
    console.log(`x=${x.toString().padStart(3)}: [${bar.padEnd(38)}] (${cnt})`);
  }
}
plotNewCrop();
