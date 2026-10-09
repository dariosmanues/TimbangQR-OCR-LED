import { getPool, closeDatabase, hashDeviceKey } from "../src/lib/db";
import fs from "fs";
import crypto from "node:crypto";

async function main() {
  const pool = getPool();
  const octArmada = JSON.parse(
    fs.readFileSync("data/master_armada_harapan_jaya_okt2026.json", "utf-8")
  );

  console.log("=== 1. Menyiapkan Kolom Baru pada Tabel vehicles ===");
  await pool.query(`
    ALTER TABLE vehicles 
      ADD COLUMN IF NOT EXISTS no_urut INTEGER,
      ADD COLUMN IF NOT EXISTS nomor_izin TEXT,
      ADD COLUMN IF NOT EXISTS nomor_sk_lps TEXT,
      ADD COLUMN IF NOT EXISTS tanggal_sk_lps TEXT,
      ADD COLUMN IF NOT EXISTS kecamatan TEXT,
      ADD COLUMN IF NOT EXISTS nama_lps TEXT,
      ADD COLUMN IF NOT EXISTS nomor_surat_permohonan TEXT,
      ADD COLUMN IF NOT EXISTS tanggal_permohonan TEXT,
      ADD COLUMN IF NOT EXISTS nama_lps_2 TEXT,
      ADD COLUMN IF NOT EXISTS nama_ketua_lps TEXT,
      ADD COLUMN IF NOT EXISTS alamat_lps TEXT,
      ADD COLUMN IF NOT EXISTS kelurahan_lps TEXT,
      ADD COLUMN IF NOT EXISTS kecamatan_lps TEXT,
      ADD COLUMN IF NOT EXISTS wilayah_kerja TEXT,
      ADD COLUMN IF NOT EXISTS lokasi_tps TEXT DEFAULT 'HARAPAN JAYA',
      ADD COLUMN IF NOT EXISTS tanggal_terbit_izin TEXT,
      ADD COLUMN IF NOT EXISTS lampiran_camat TEXT;

    -- Drop constraint UNIQUE pada plate_normalized agar BM 9601 TZ bisa terdaftar di 2 izin resmi
    ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_plate_normalized_key;
    CREATE INDEX IF NOT EXISTS idx_vehicles_plate_normalized ON vehicles(plate_normalized);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_nomor_izin ON vehicles(nomor_izin);
  `);
  console.log("✓ Kolom baru dan indeks berhasil disiapkan.");

  console.log("\n=== 2. Memuat Data LPS yang Ada ===");
  const lpsRows = (await pool.query("SELECT id, code, name FROM lps")).rows;
  const lpsMap = new Map();
  for (const l of lpsRows) {
    lpsMap.set(l.name.toUpperCase().trim(), l.id);
    lpsMap.set(l.name.toUpperCase().replace(/^LPS\s+/, "").trim(), l.id);
    lpsMap.set(l.code.toUpperCase().trim(), l.id);
  }
  // Custom manual mappings if needed
  lpsMap.set("SUKAMULIA", lpsMap.get("LPS SUKA MULIA"));
  lpsMap.set("SUKA MULIA", lpsMap.get("LPS SUKA MULIA"));

  console.log("\n=== 3. Memuat Data Armada yang Sudah Ada ===");
  const existingVehicles = (await pool.query("SELECT * FROM vehicles")).rows;
  const existingAssignments = (await pool.query("SELECT * FROM vehicle_assignments")).rows;

  // Track plates that belong to Harapan Jaya Oct 2026
  const octPlateSet = new Set(octArmada.map((a: any) => a.plate_normalized));

  // Nonaktifkan armada yang tidak termasuk dalam daftar Update Oktober 2026 Harapan Jaya
  const deactivateResult = await pool.query(
    "UPDATE vehicles SET active = FALSE WHERE plate_normalized NOT IN (" +
      Array.from(octPlateSet).map((_, i) => `$${i + 1}`).join(", ") +
      ") RETURNING id, code, plate_number",
    Array.from(octPlateSet)
  );
  console.log(`✓ Dinonaktifkan ${deactivateResult.rowCount} armada riwayat lama di luar Harapan Jaya Okt 2026.`);

  // Berikan prefix sementara pada seluruh code untuk menghindari benturan vehicles_code_key
  await pool.query("UPDATE vehicles SET code = 'OLD-' || id");
  console.log("✓ Kode lama di-prefix sementara untuk menghindari benturan unique key.");

  console.log("\n=== 4. Sinkronisasi 68 Armada Harapan Jaya Oktober 2026 ===");

  // We assign ARM-HJ-0001 through ARM-HJ-0068 based on sequence in the document
  for (let i = 0; i < octArmada.length; i++) {
    const item = octArmada[i];
    const code = `ARM-HJ-${String(i + 1).padStart(4, "0")}`;
    const plateNormalized = item.plate_normalized;
    const plateNumber = item.nomor_polisi.trim().toUpperCase();
    const vehicleType = item.jenis_armada || "PICKUP";
    const wasteType = "SAMPAH RUMAH TANGGA";

    // Match existing tare if any
    const existingV = existingVehicles.find(
      (v: any) => v.plate_normalized === plateNormalized
    );
    const existingAssign = existingAssignments.find(
      (a: any) => a.vehicle_id === existingV?.id
    );
    const tareKg = existingV?.default_tare_kg || existingAssign?.tare_kg || null;

    // Resolve LPS ID
    const kel = (item.kelurahan_lps || "").toUpperCase().trim();
    const nama = (item.nama_lps || "").toUpperCase().trim();
    let lpsId =
      lpsMap.get(nama) ||
      lpsMap.get(`LPS ${nama}`) ||
      lpsMap.get(kel) ||
      lpsMap.get(`LPS ${kel}`);

    if (!lpsId) {
      console.warn(`Peringatan: LPS tidak ditemukan untuk ${item.nama_lps} / ${item.kelurahan_lps}`);
    }

    // Check if vehicle with this nomor_izin already exists
    const existingByIzin = (
      await pool.query("SELECT id FROM vehicles WHERE nomor_izin = $1", [item.nomor_izin])
    ).rows[0];

    let vehicleId: number;

    if (existingByIzin) {
      vehicleId = existingByIzin.id;
      await pool.query(
        `UPDATE vehicles SET
          code = $1,
          plate_number = $2,
          plate_normalized = $3,
          vehicle_type = $4,
          waste_type = $5,
          default_tare_kg = COALESCE($6, default_tare_kg),
          active = TRUE,
          no_urut = $7,
          nomor_sk_lps = $8,
          tanggal_sk_lps = $9,
          kecamatan = $10,
          nama_lps = $11,
          nomor_surat_permohonan = $12,
          tanggal_permohonan = $13,
          nama_lps_2 = $14,
          nama_ketua_lps = $15,
          alamat_lps = $16,
          kelurahan_lps = $17,
          kecamatan_lps = $18,
          wilayah_kerja = $19,
          lokasi_tps = $20,
          tanggal_terbit_izin = $21,
          lampiran_camat = $22,
          updated_at = NOW()
        WHERE id = $23`,
        [
          code, plateNumber, plateNormalized, vehicleType, wasteType, tareKg,
          item.no, item.nomor_sk_lps, item.tanggal_sk_lps, item.kecamatan,
          item.nama_lps, item.nomor_surat_permohonan, item.tanggal_permohonan,
          item.nama_lps_2, item.nama_ketua_lps, item.alamat_lps,
          item.kelurahan_lps, item.kecamatan_lps, item.wilayah_kerja,
          item.lokasi_tps || "HARAPAN JAYA", item.tanggal_terbit_izin,
          item.lampiran_camat, vehicleId
        ]
      );
    } else {
      // Check if there is an existing vehicle with same plate that does not have nomor_izin yet
      const existingWithoutIzin = (
        await pool.query(
          "SELECT id FROM vehicles WHERE plate_normalized = $1 AND nomor_izin IS NULL LIMIT 1",
          [plateNormalized]
        )
      ).rows[0];

      if (existingWithoutIzin) {
        vehicleId = existingWithoutIzin.id;
        await pool.query(
          `UPDATE vehicles SET
            code = $1,
            plate_number = $2,
            plate_normalized = $3,
            vehicle_type = $4,
            waste_type = $5,
            default_tare_kg = COALESCE($6, default_tare_kg),
            active = TRUE,
            no_urut = $7,
            nomor_izin = $8,
            nomor_sk_lps = $9,
            tanggal_sk_lps = $10,
            kecamatan = $11,
            nama_lps = $12,
            nomor_surat_permohonan = $13,
            tanggal_permohonan = $14,
            nama_lps_2 = $15,
            nama_ketua_lps = $16,
            alamat_lps = $17,
            kelurahan_lps = $18,
            kecamatan_lps = $19,
            wilayah_kerja = $20,
            lokasi_tps = $21,
            tanggal_terbit_izin = $22,
            lampiran_camat = $23,
            updated_at = NOW()
          WHERE id = $24`,
          [
            code, plateNumber, plateNormalized, vehicleType, wasteType, tareKg,
            item.no, item.nomor_izin, item.nomor_sk_lps, item.tanggal_sk_lps, item.kecamatan,
            item.nama_lps, item.nomor_surat_permohonan, item.tanggal_permohonan,
            item.nama_lps_2, item.nama_ketua_lps, item.alamat_lps,
            item.kelurahan_lps, item.kecamatan_lps, item.wilayah_kerja,
            item.lokasi_tps || "HARAPAN JAYA", item.tanggal_terbit_izin,
            item.lampiran_camat, vehicleId
          ]
        );
      } else {
        // Insert new vehicle
        const qrToken = crypto.createHash("sha256")
          .update(`HJ-QR-${plateNormalized}-${item.nomor_izin}`)
          .digest("hex")
          .slice(0, 32);

        const insertRes = await pool.query(
          `INSERT INTO vehicles (
            code, plate_number, plate_normalized, vehicle_type, waste_type,
            default_tare_kg, qr_token, active, no_urut, nomor_izin,
            nomor_sk_lps, tanggal_sk_lps, kecamatan, nama_lps,
            nomor_surat_permohonan, tanggal_permohonan, nama_lps_2,
            nama_ketua_lps, alamat_lps, kelurahan_lps, kecamatan_lps,
            wilayah_kerja, lokasi_tps, tanggal_terbit_izin, lampiran_camat
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
          ) RETURNING id`,
          [
            code, plateNumber, plateNormalized, vehicleType, wasteType,
            tareKg, qrToken, item.no, item.nomor_izin,
            item.nomor_sk_lps, item.tanggal_sk_lps, item.kecamatan,
            item.nama_lps, item.nomor_surat_permohonan, item.tanggal_permohonan,
            item.nama_lps_2, item.nama_ketua_lps, item.alamat_lps,
            item.kelurahan_lps, item.kecamatan_lps, item.wilayah_kerja,
            item.lokasi_tps || "HARAPAN JAYA", item.tanggal_terbit_izin,
            item.lampiran_camat
          ]
        );
        vehicleId = insertRes.rows[0].id;
        console.log(`+ Baris baru disisipkan: ${code} | ${plateNumber} (No. ${item.no})`);
      }
    }

    // Ensure vehicle assignment to LPS exists and is primary
    if (lpsId) {
      await pool.query(
        `INSERT INTO vehicle_assignments (vehicle_id, lps_id, driver_name, tare_kg, is_primary, active)
         VALUES ($1, $2, $3, $4, TRUE, TRUE)
         ON CONFLICT DO NOTHING`,
        [vehicleId, lpsId, item.nama_ketua_lps || null, tareKg]
      );
    }
  }

  console.log("\n=== 5. Verifikasi Hasil Akhir Database ===");
  const activeCount = await pool.query(
    "SELECT COUNT(*)::int AS count FROM vehicles WHERE active = TRUE"
  );
  const totalCount = await pool.query(
    "SELECT COUNT(*)::int AS count FROM vehicles"
  );
  const inactiveCount = await pool.query(
    "SELECT COUNT(*)::int AS count FROM vehicles WHERE active = FALSE"
  );

  console.log(`Jumlah Armada Aktif: ${activeCount.rows[0].count} (Target: 68)`);
  console.log(`Jumlah Total Armada (termasuk riwayat): ${totalCount.rows[0].count}`);
  console.log(`Jumlah Armada Nonaktif (riwayat lama): ${inactiveCount.rows[0].count}`);

  const sample = await pool.query(`
    SELECT no_urut, code, plate_number, nomor_izin, nama_lps, kelurahan_lps, nama_ketua_lps, active
    FROM vehicles
    WHERE active = TRUE
    ORDER BY no_urut ASC
    LIMIT 10
  `);
  console.log("\nSample 10 Armada Aktif:");
  console.table(sample.rows);

  await closeDatabase();
}

main().catch(console.error);
