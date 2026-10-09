import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

async function testTessCleanRow() {
  const worker = await createWorker('eng');
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789',
    tessedit_pageseg_mode: '7',
  });

  // Extract digits from new_crop.png (x: 150..330, y: 0..90)
  const rowBuf = await sharp('scripts/new_crop.png')
    .extract({ left: 155, top: 0, width: 175, height: 90 })
    .toBuffer();

  await sharp(rowBuf).toFile('scripts/phone_digits.png');

  // Inverted grayscale
  const inv = await sharp(rowBuf)
    .grayscale()
    .negate()
    .resize(350, 180)
    .extend({ top: 30, bottom: 30, left: 30, right: 30, background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  const res = await worker.recognize(inv);
  console.log('Tesseract on phone_digits.png:', JSON.stringify(res.data.text.trim()), 'conf:', res.data.confidence);

  await worker.terminate();
}
testTessCleanRow().catch(console.error);
