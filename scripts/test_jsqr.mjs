import jsQR from "jsqr";
import fs from "fs";

const raw = fs.readFileSync("scripts/raw_img.bin");
const width = 736;
const height = 501;

const code = jsQR(new Uint8ClampedArray(raw), width, height, {
  inversionAttempts: "attemptBoth"
});

console.log("jsQR result:", code ? code.data : "null");
