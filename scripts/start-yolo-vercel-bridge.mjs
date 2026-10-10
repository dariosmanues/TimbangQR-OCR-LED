import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const rootDir = process.cwd();
console.log("====================================================");
console.log("   TIMBANGQR - YOLO CLOUD BRIDGE (VERCEL)           ");
console.log("====================================================");

// 1. Jalankan Python YOLO OCR Server
console.log("\n[1/3] Menjalankan server Python YOLO OCR (Port 5001)...");
const pythonProc = spawn("python", ["scripts/yolo_ocr_server.py"], {
  cwd: rootDir,
  stdio: "pipe",
});

pythonProc.stdout.on("data", (data) => {
  const line = data.toString().trim();
  if (line.includes("Uvicorn running") || line.includes("Model berhasil dimuat")) {
    console.log(`[Python] ${line}`);
  }
});

pythonProc.stderr.on("data", (data) => {
  const line = data.toString().trim();
  if (line.includes("Uvicorn running")) {
    console.log(`[Python] ${line}`);
  }
});

pythonProc.on("error", (err) => {
  console.error("[Python Error]:", err.message);
});

// 2. Jalankan Cloudflare Tunnel
console.log("[2/3] Menghubungkan tunnel aman HTTPS Cloudflare...");
const cloudflaredBin = path.join(rootDir, "cloudflared.exe");
if (!fs.existsSync(cloudflaredBin)) {
  console.error("cloudflared.exe tidak ditemukan di direktori proyek!");
  process.exit(1);
}

const cfProc = spawn(cloudflaredBin, ["tunnel", "--url", "http://127.0.0.1:5001"], {
  cwd: rootDir,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let tunnelUrl = "";

function handleCloudflareLine(line) {
  const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (match && !tunnelUrl) {
    tunnelUrl = match[0];
    console.log(`\n====================================================`);
    console.log(`[Cloudflare] Tunnel Publik Aktif: ${tunnelUrl}`);
    console.log(`====================================================\n`);

    // 3. Sinkronkan URL ke Vercel jika diperlukan
    console.log("[3/3] Memperbarui konfigurasi YOLO_OCR_URL di Vercel...");
    try {
      const tempFile = path.join(rootDir, "_temp_yolo_url.txt");
      fs.writeFileSync(tempFile, tunnelUrl, "utf8");
      execSync(`npx vercel env add YOLO_OCR_URL production --force --yes < "${tempFile}"`, {
        cwd: rootDir,
        stdio: "ignore",
        shell: true,
      });
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      console.log("[Vercel] Sukses! YOLO_OCR_URL berhasil disinkronkan ke Vercel.");
    } catch (err) {
      console.warn("[Vercel] Info update env Vercel:", err.message);
    }

    console.log("\n>>> STATUS: YOLO Vision AI SIAP DIGUNAKAN! <<<");
    console.log(`Link Tunnel Anda : ${tunnelUrl}`);
    console.log("Membuka browser otomatis dengan link tunnel aktif...");
    try {
      execSync(`start "" "https://timbangqr-ocr-led.vercel.app/scan?yolo_url=${encodeURIComponent(tunnelUrl)}"`, {
        stdio: "ignore",
        shell: true,
      });
    } catch {}
    console.log("Biarkan jendela ini tetap terbuka selama menimbang.\n");
  }
}

const rlErr = readline.createInterface({ input: cfProc.stderr });
rlErr.on("line", handleCloudflareLine);

const rlOut = readline.createInterface({ input: cfProc.stdout });
rlOut.on("line", handleCloudflareLine);

cfProc.on("error", (err) => {
  console.error("[Cloudflare Error]:", err.message);
});

process.on("SIGINT", () => {
  console.log("\nMematikan server...");
  pythonProc.kill();
  cfProc.kill();
  process.exit(0);
});
