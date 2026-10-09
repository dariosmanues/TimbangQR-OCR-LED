import { MultiFormatReader, BarcodeFormat, DecodeHintType, RGBLuminanceSource, BinaryBitmap, HybridBinarizer, GlobalHistogramBinarizer } from "@zxing/library";
import fs from "fs";
import { execSync } from "child_process";

// Dump raw RGBA pixels from python
execSync(`python -c "import cv2, numpy as np; img = cv2.imread(r'C:\\Users\\Axioo Pongo\\.gemini\\antigravity-ide\\brain\\7e01ffce-586a-453f-9c43-b8b0b66eb2f3\\.user_uploaded\\media_1791376804004.png'); rgba = cv2.cvtColor(img, cv2.COLOR_BGR2RGBA); rgba.tofile('scripts/raw_img.bin'); print(img.shape)"`);

const raw = fs.readFileSync('scripts/raw_img.bin');
const width = 736;
const height = 501;

// Test default ZXing
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
hints.set(DecodeHintType.TRY_HARDER, true);

const reader = new MultiFormatReader();
reader.setHints(hints);

const lumSource = new RGBLuminanceSource(new Uint8ClampedArray(raw), width, height);

try {
  const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource));
  const result = reader.decode(bitmap);
  console.log("ZXing HybridBinarizer result:", result.getText());
} catch (e) {
  console.log("ZXing HybridBinarizer failed:", e.message || e);
}

try {
  const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(lumSource));
  const result = reader.decode(bitmap);
  console.log("ZXing GlobalHistogramBinarizer result:", result.getText());
} catch (e) {
  console.log("ZXing GlobalHistogramBinarizer failed:", e.message || e);
}
