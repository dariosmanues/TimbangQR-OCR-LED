import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const imgPath = 'C:\\Users\\Axioo Pongo\\.gemini\\antigravity-ide\\brain\\b2fe221c-3caa-47db-9775-9f13ddb7da4f\\.user_uploaded\\media_1791294188976.png';

async function testTesseractPhone() {
  const worker = await createWorker('eng');
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789',
    tessedit_pageseg_mode: '7',
  });

  // Green guide box is at: left: 125, top: 225, width: 460, height: 200
  // Phone display is roughly at left: 240, top: 220, width: 220, height: 180
  console.log('Testing full guide crop and phone crop with Tesseract:');

  // 1. Phone crop inverted
  const phoneBuf = await sharp(imgPath)
    .extract({ left: 250, top: 220, width: 220, height: 160 })
    .grayscale()
    .negate()
    .toBuffer();

  const res1 = await worker.recognize(phoneBuf);
  console.log('Phone crop grayscale inverted:', JSON.stringify(res1.data.text.trim()), 'conf:', res1.data.confidence);

  // 2. Thresholded black on white
  const { data, info } = await sharp(imgPath)
    .extract({ left: 250, top: 220, width: 220, height: 160 })
    .raw().toBuffer({ resolveWithObject: true });

  const bw = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const isLit = (r >= 200 && (g >= 70 || lum >= 130));
    bw[i] = isLit ? 0 : 255;
  }
  const bwBuf = await sharp(bw, { raw: { width: info.width, height: info.height, channels: 1 } })
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: { r: 255, g: 255, b: 255 } })
    .png().toBuffer();

  for (const psm of ['7', '6', '8']) {
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: psm,
    });
    const resBw = await worker.recognize(bwBuf);
    console.log(`Binarized PSM ${psm}:`, JSON.stringify(resBw.data.text.trim()), 'conf:', resBw.data.confidence);
  }

  await worker.terminate();
}
testTesseractPhone().catch(console.error);
