import sharp from 'sharp';

const newImg = 'C:\\Users\\Axioo Pongo\\.gemini\\antigravity-ide\\brain\\b2fe221c-3caa-47db-9775-9f13ddb7da4f\\.user_uploaded\\media_1791294188976.png';

async function locateNewCrop() {
  const { data, info } = await sharp(newImg).raw().toBuffer({ resolveWithObject: true });
  console.log('Image dimensions:', info.width, info.height);

  // In the image, find the green guide box (#10b981 or similar green border: rgb around 16..40, 170..210, 110..150)
  let minX = 9999, maxX = -1, minY = 9999, maxY = -1;
  for (let y = 50; y < 500; y++) {
    for (let x = 50; x < info.width - 50; x++) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      // Border green: #10b981 is r=16, g=185, b=129
      if (g > 150 && r < 50 && b > 80 && b < 160) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log('Green guide box:', { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY });

  // Save the cropped region
  if (maxX > minX && maxY > minY) {
    const cropBox = { left: minX + 3, top: minY + 3, width: maxX - minX - 6, height: maxY - minY - 6 };
    await sharp(newImg).extract(cropBox).toFile('scripts/new_crop.png');
    console.log('Saved scripts/new_crop.png');
  }
}
locateNewCrop();
