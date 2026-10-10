import { Pool } from "pg";

async function main() {
  const pool = new Pool({
    connectionString:
      "postgresql://neondb_owner:npg_4lPwUq1YHedR@ep-lingering-bird-azf5emxp-pooler.c-3.ap-southeast-1.aws.neon.tech/timbangqr?sslmode=require",
  });

  const testToken = `LPS-BM8106QP-${Date.now()}`;
  console.log(`Menguji token: ${testToken}`);

  // Login
  const loginRes = await fetch("https://timbangqr-ocr-led.vercel.app/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@lps.local", password: "Admin123!" }),
  });
  const cookie = loginRes.headers.get("set-cookie") || "";

  // 1. Scan pertama (belum hangus)
  const res1 = await fetch(`https://timbangqr-ocr-led.vercel.app/api/qr/${testToken}`, {
    headers: { cookie },
  });
  const d1 = await res1.json();
  console.log("1. Scan Pertama Status (Harus 200):", res1.status, "Armada:", d1.vehicle?.plate_number);

  // 2. Tandai token sebagai hangus (simulasi selesai transaksi timbangan)
  await pool.query(
    "INSERT INTO burned_qr_tokens (qr_token, plate_number, ticket_number, vehicle_id, burned_at) VALUES ($1, $2, $3, $4, NOW())",
    [testToken, "BM 8106 QP", "INV/26/DEMO-HANGUS", 9]
  );
  console.log("2. Token berhasil dicatat sebagai HANGUS di database.");

  // 3. Scan kedua (harus ditolak dengan status 400 & pesan hangus)
  const res2 = await fetch(`https://timbangqr-ocr-led.vercel.app/api/qr/${testToken}`, {
    headers: { cookie },
  });
  const d2 = await res2.json();
  console.log("3. Scan Kedua Status (Harus 400):", res2.status, "Pesan:", d2.error);

  // 4. Bersihkan data test
  await pool.query("DELETE FROM burned_qr_tokens WHERE qr_token = $1", [testToken]);
  await pool.end();
  console.log("4. Data uji dibersihkan.");
}

main().catch(console.error);
