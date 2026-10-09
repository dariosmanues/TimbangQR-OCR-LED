import sharp from 'sharp';

async function checkValues() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  // Let's check row y=50 across columns x=130 to 340
  console.log('Row y=50 values:');
  for (let x = 130; x <= 340; x += 5) {
    const idx = (50 * info.width + x) * 4;
    const r = data[idx], g = data[idx+1], b = data[idx+2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    console.log(`x=${x}: R=${r}, G=${g}, B=${b}, Lum=${Math.round(lum)}`);
  }
}
checkValues();
