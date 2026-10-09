import sharp from 'sharp';

const imgPath = 'scripts/crop_scale.png';

async function analyzeCrop() {
  const { data, info } = await sharp(imgPath).raw().toBuffer({ resolveWithObject: true });
  console.log('Size:', info.width, info.height);

  // Let's print out where the bright red pixels are!
  // In each column x, what is the maximum R and maximum (R - max(G,B))?
  let xStats = [];
  for (let x = 0; x < info.width; x += 5) {
    let maxR = 0, maxExcess = 0, yOfMax = 0;
    for (let y = 0; y < info.height; y++) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const excess = r - Math.max(g, b);
      if (excess > maxExcess) {
        maxExcess = excess;
        maxR = r;
        yOfMax = y;
      }
    }
    if (maxExcess > 30) {
      xStats.push({ x, maxR, maxExcess, yOfMax });
    }
  }
  console.log('Columns with active red pixels (>30 excess):');
  console.log(xStats.map(s => `x:${s.x}(ex:${s.maxExcess},y:${s.yOfMax})`).join(' '));
}
analyzeCrop();
