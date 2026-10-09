import sharp from 'sharp';

async function checkDigitOne() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  console.log('Digit 1 pixels at x=145..158, y=20..70:');
  for (let y = 20; y <= 70; y += 10) {
    for (let x = 145; x <= 158; x += 3) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      console.log(`x=${x}, y=${y}: rgb(${r}, ${g}, ${b}), lum=${Math.round(lum)}`);
    }
  }
}
checkDigitOne();
