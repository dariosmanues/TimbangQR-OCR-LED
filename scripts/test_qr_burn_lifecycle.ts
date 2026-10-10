import { getPool, closeDatabase, dbOne } from "../src/lib/db";
import type { VehicleRow } from "../src/lib/types";

async function runTest() {
  console.log("=== MEMULAI TEST SIKLUS QR SCAN & HANGUS ===");
  const pool = getPool();

  const plateNumber = "BM 8106 QP";
  const plateCompact = "BM8106QP";
  const timestamp = Date.now();
  const testQrToken = `LPS-${plateCompact}-${timestamp}`;

  console.log(`1. Uji QR baru yang di-generate: ${testQrToken}`);

  // Simulasi cek via database TimbangQR seperti pada route GET /api/qr/[token]
  const burnedCheck1 = await dbOne<{ ticket_number: string }>(`
    SELECT ticket_number FROM burned_qr_tokens WHERE qr_token = $1
    UNION ALL
    SELECT ticket_number FROM weighings WHERE qr_token = $1
    LIMIT 1
  `, [testQrToken]);

  if (burnedCheck1) {
    throw new Error(`FAIL: QR baru terdeteksi hangus padahal belum dipakai!`);
  }
  console.log("✓ PASS: QR baru belum hangus.");

  // Lookup armada
  const vehicle = await dbOne<VehicleRow>(`
    SELECT id, code, plate_number, plate_normalized, vehicle_type, waste_type,
      default_tare_kg, qr_token, active
    FROM vehicles
    WHERE (
      plate_normalized = $1
      OR plate_normalized = $2
      OR qr_token = $3
      OR UPPER(plate_number) = UPPER($3)
    ) AND active = TRUE
    LIMIT 1
  `, [plateCompact, plateCompact, testQrToken]);

  if (!vehicle) {
    throw new Error(`FAIL: Armada ${plateNumber} tidak ditemukan di database!`);
  }
  console.log(`✓ PASS: Armada berhasil ditemukan: ID=${vehicle.id}, Plat=${vehicle.plate_number}`);

  // 2. Simulasi penimbangan selesai (Save weighing transaction dengan testQrToken)
  const fakeTicket = `TEST-INV/${Date.now()}`;
  console.log(`2. Menyimpan transaksi penimbangan dengan tiket ${fakeTicket} menggunakan token ${testQrToken}...`);

  await pool.query(`
    INSERT INTO burned_qr_tokens (qr_token, plate_number, ticket_number, vehicle_id, burned_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (qr_token) DO UPDATE SET ticket_number = EXCLUDED.ticket_number, burned_at = NOW()
  `, [testQrToken, vehicle.plate_number, fakeTicket, vehicle.id]);

  console.log("✓ PASS: Token QR berhasil dicatat ke burned_qr_tokens.");

  // 3. Uji coba scan ulang QR yang sama
  console.log(`3. Uji coba scan ulang QR yang sudah dipakai (${testQrToken})...`);
  const burnedCheck2 = await dbOne<{ ticket_number: string }>(`
    SELECT ticket_number FROM burned_qr_tokens WHERE qr_token = $1
    UNION ALL
    SELECT ticket_number FROM weighings WHERE qr_token = $1
    LIMIT 1
  `, [testQrToken]);

  if (!burnedCheck2) {
    throw new Error("FAIL: QR yang sudah dipakai TIDAK terdeteksi hangus!");
  }
  console.log(`✓ PASS: QR terdeteksi HANGUS dengan pesan tiket #${burnedCheck2.ticket_number}`);

  // 4. Simulasi generate QR ulang
  const newTimestamp = Date.now() + 1000;
  const newQrToken = `LPS-${plateCompact}-${newTimestamp}`;
  console.log(`4. Uji QR baru setelah Generate Ulang: ${newQrToken}`);

  const burnedCheck3 = await dbOne<{ ticket_number: string }>(`
    SELECT ticket_number FROM burned_qr_tokens WHERE qr_token = $1
    UNION ALL
    SELECT ticket_number FROM weighings WHERE qr_token = $1
    LIMIT 1
  `, [newQrToken]);

  if (burnedCheck3) {
    throw new Error("FAIL: QR baru setelah generate ulang terdeteksi hangus!");
  }
  console.log("✓ PASS: QR baru setelah generate ulang valid dan siap di-scan untuk trip berikutnya!");

  // Bersihkan data test
  await pool.query("DELETE FROM burned_qr_tokens WHERE qr_token = $1", [testQrToken]);
  console.log("✓ Data test dibersihkan.");

  console.log("=== SEMUA TEST SIKLUS QR & HANGUS BERHASIL (100% PASS) ===");
  await closeDatabase();
}

runTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
