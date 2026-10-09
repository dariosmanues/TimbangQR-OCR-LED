import jsQR from "jsqr";
import { MultiFormatReader, BarcodeFormat, DecodeHintType, RGBLuminanceSource, BinaryBitmap, HybridBinarizer } from "@zxing/library";
import fs from "fs";
import { execSync } from "child_process";

execSync(`python -c "import cv2; img = cv2.imread('scripts/crop_box.png'); rgba = cv2.cvtColor(img, cv2.COLOR_BGR2RGBA); rgba.tofile('scripts/crop_box.bin'); print(img.shape)"`);

const raw = fs.readFileSync("scripts/crop_box.bin");
const height = 350;
const width = 350;

// Test jsQR on crop
const code = jsQR(new Uint8ClampedArray(raw), width, height, {
  inversionAttempts: "attemptBoth"
});
console.log("jsQR on crop:", code ? code.data : "null");

// Test ZXing on crop
try {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  const lumSource = new RGBLuminanceSource(new Uint8ClampedArray(raw), width, height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource));
  const result = reader.decode(bitmap);
  console.log("ZXing on crop:", result.getText());
} catch (e) {
  console.log("ZXing on crop failed:", e.message || e);
}
