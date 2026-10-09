import sharp from 'sharp';

async function testSegmentExtraction() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  console.log('Testing segment extraction on new_crop.png:');

  // Print ASCII map where lit segment has high luminance / green
  for (let y = 10; y < 110; y += 8) {
    let line = '';
    for (let x = 120; x < 360; x += 3) {
      const idx = (y * info.width + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // Lit segment criterion:
      const isLit = (r >= 200 && (g >= 75 || lum >= 135));
      line += isLit ? '#' : '.';
    }
    console.log(`y=${y.toString().padStart(3)}: |${line}|`);
  }
}
testSegmentExtraction();
