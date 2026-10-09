import fs from "node:fs";
import path from "node:path";

export function loadEnvIfNeeded() {
  if (process.env.DATABASE_URL?.trim()) return;

  if (typeof (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile === "function") {
    try {
      (process as unknown as { loadEnvFile: (path: string) => void }).loadEnvFile(
        path.resolve(process.cwd(), ".env")
      );
    } catch {}
  }

  if (process.env.DATABASE_URL?.trim()) return;

  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../../../.env"),
  ];

  for (const envPath of candidatePaths) {
    try {
      if (fs.existsSync(/*turbopackIgnore: true*/ envPath)) {
        const content = fs.readFileSync(/*turbopackIgnore: true*/ envPath, "utf-8");
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
          const index = trimmed.indexOf("=");
          const key = trimmed.slice(0, index).trim();
          let val = trimmed.slice(index + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (key && !process.env[key]) {
            process.env[key] = val;
          }
        }
        if (process.env.DATABASE_URL?.trim()) break;
      }
    } catch (error) {
      console.warn("[Env] Gagal membaca path:", envPath, error);
    }
  }
}

// Auto-run when imported
loadEnvIfNeeded();
