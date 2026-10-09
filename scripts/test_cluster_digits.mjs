import sharp from 'sharp';

async function testClusterDigits() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;

  // Let's inspect the RGB of the phone display vs the laptop sticker:
  // On the phone display, the background is DARK (low brightness when not lit)
  // On the laptop, it's a silver sticker
  for (let x of [70, 150, 190, 250, 300]) {
    const idx = (60 * info.width + x) * 4;
    console.log(`x=${x}, y=60: rgb(${data[idx]}, ${data[idx+1]}, ${data[idx+2]})`);
  }
}
testClusterDigits();
