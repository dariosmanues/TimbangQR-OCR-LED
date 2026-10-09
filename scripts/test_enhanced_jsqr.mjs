import jsQR from "jsqr";
import fs from "fs";
import { execSync } from "child_process";

for (const name of ['stretched', 'otsu', 'adapt']) {
  execSync(`python -c "import cv2; img = cv2.imread('scripts/${name}.png', cv2.IMREAD_GRAYSCALE); rgba = cv2.cvtColor(img, cv2.COLOR_GRAY2RGBA); rgba.tofile('scripts/${name}.bin')"`);
  const raw = fs.readFileSync(`scripts/${name}.bin`);
  const code = jsQR(new Uint8ClampedArray(raw), 350, 350, {
    inversionAttempts: "attemptBoth"
  });
  console.log(`jsQR on ${name}:`, code ? code.data : "null");
}
