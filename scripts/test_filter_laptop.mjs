import sharp from 'sharp';

async function testFilterLaptop() {
  const { data, info } = await sharp('scripts/new_crop.png').raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;

  // Let's count how many pixels pass in x < 120 (laptop) vs x >= 120 (phone)
  let laptopCount = 0;
  let phoneCount = 0;

  for (let i = 0; i < width * height; i++) {
    const x = i % width;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const ex = r - Math.max(g, b);
    const gRatio = g / (r + 1);
    const bRatio = b / (r + 1);

    // Filter with strict Blue limit (LED emits ~630nm, which has negligible Blue < 45):
    if (r >= 180 && ex >= 50 && gRatio <= 0.65 && bRatio <= 0.35 && b <= 45) {
      if (x < 120) laptopCount++;
      else phoneCount++;
    }
  }

  console.log(`With strict blue limit: laptop pixels: ${laptopCount}, phone pixels: ${phoneCount}`);
}
testFilterLaptop();
