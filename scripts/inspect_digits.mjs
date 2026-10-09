import sharp from 'sharp';

async function inspectDigits() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  console.log('Size:', info.width, info.height);

  // In new_crop.png, let's sample rows y=20, y=50, y=80 across all x
  // Let's print out an ASCII map of the image!
  for (let y = 10; y < 110; y += 8) {
    let line = '';
    for (let x = 120; x < 360; x += 3) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const ex = r - Math.max(g, b);
      const isLit = (r >= 200 && ex >= 100);
      line += isLit ? '#' : ' ';
    }
    console.log(`y=${y.toString().padStart(3)}: |${line}|`);
  }
}
inspectDigits();
