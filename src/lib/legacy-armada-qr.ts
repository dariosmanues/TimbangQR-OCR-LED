import { createHash } from "node:crypto";
import master from "../../data/master_armada_harapan_jaya_okt2026.json";
import { withTransaction } from "@/lib/db";
import type { AssignmentRow, VehicleRow } from "@/lib/types";
import { normalizeLpsName, normalizePlate, LpsQrError } from "@/lib/lps-qr-identity";

export function parseLegacyArmadaQr(token: string): string | null {
  const match = /^ARMADA-([A-Z]{1,3}\d{1,6}[A-Z]{0,4})$/i.exec(token.trim());
  return match ? normalizePlate(match[1]) : null;
}

type MasterRow = {
  plate_normalized: string;
  nomor_polisi: string;
  jenis_armada?: string | null;
  nama_lps?: string | null;
  lokasi_tps?: string | null;
  nomor_izin?: string | null;
};

const rows = master as MasterRow[];

function stableCode(prefix: string, text: string) {
  return prefix + createHash("sha256").update(text).digest("hex").slice(0, 18).toUpperCase();
}

type LocalVehicle = VehicleRow & { active: boolean };
type LocalLps = { id: number; name: string; active: boolean };

export async function resolveLegacyArmadaQr(normalizedPlate: string): Promise<{
  vehicle: VehicleRow;
  assignments: AssignmentRow[];
  lpsOptions: Array<{ id: number; name: string }>;
  source: "ARMADA";
  masterCreated: boolean;
}> {
  const candidates = rows.filter((item) => normalizePlate(item.plate_normalized) === normalizedPlate);
  if (candidates.length !== 1) {
    throw new LpsQrError("QR armada tidak ada dalam master Harapan Jaya Oktober 2026.", 404);
  }
  const masterRow = candidates[0];
  if (!masterRow.nama_lps || !masterRow.nomor_polisi) {
    throw new LpsQrError("Data master armada tidak lengkap untuk penimbangan.", 422);
  }

  return withTransaction(async client => {
    // Ensure one new vehicle/LPS/assignment per plate under concurrent scans.
    await client.query("SELECT pg_advisory_xact_lock(419, hashtext($1))", [normalizedPlate]);

    const vehicles = (await client.query<LocalVehicle>(
      "SELECT id, code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active FROM vehicles WHERE plate_normalized = $1 OR UPPER(REGEXP_REPLACE(plate_number, '[^A-Za-z0-9]', '', 'g')) = $1 ORDER BY id LIMIT 3",
      [normalizedPlate]
    )).rows;

    if (vehicles.length > 1) {
      throw new LpsQrError("Nomor polisi terdaftar lebih dari satu kali; operator harus memperbaiki master armada.", 409);
    }
    if (vehicles[0] && !vehicles[0].active) {
      throw new LpsQrError("Armada sudah dinonaktifkan pada master TimbangQR.", 409);
    }

    let vehicle = vehicles[0] || null;
    let masterCreated = false;
    if (!vehicle) {
      const otherPermit = masterRow.nomor_izin ? (await client.query(
        "SELECT id FROM vehicles WHERE nomor_izin = $1 LIMIT 1", [masterRow.nomor_izin]
      )).rows : [];
      if (otherPermit.length) {
        throw new LpsQrError("Nomor izin tercatat pada kendaraan lain. Periksa master.", 409);
      }
      const result = await client.query<LocalVehicle>(
        "INSERT INTO vehicles (code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active, nama_lps, lokasi_tps, nomor_izin) VALUES ($1,$2,$3,$4,$5,NULL,$6,TRUE,$7,$8,$9) RETURNING id, code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active",
        [
          stableCode("ARMADA-", normalizedPlate), masterRow.nomor_polisi,
          normalizedPlate, masterRow.jenis_armada || "PICKUP",
          "SAMPAH RUMAH TANGGA", stableCode("QR-ARMADA-", normalizedPlate),
          masterRow.nama_lps, masterRow.lokasi_tps || "HARAPAN JAYA",
          masterRow.nomor_izin || null
        ]
      );
      vehicle = result.rows[0];
      masterCreated = true;
    }
    if (!vehicle) throw new LpsQrError("Master armada gagal disiapkan.", 500);

    const key = normalizeLpsName(masterRow.nama_lps);
    await client.query("SELECT pg_advisory_xact_lock(420, hashtext($1))", [key]);
    const matches = (await client.query<LocalLps>("SELECT id, name, active FROM lps")).rows
      .filter(row => normalizeLpsName(row.name) === key);
    if (matches.length > 1) throw new LpsQrError("Nama LPS ganda di database.", 409);
    if (matches[0] && !matches[0].active) throw new LpsQrError("LPS pada master sedang tidak aktif.", 409);
    let lps = matches[0] || null;
    if (!lps) {
      const created = await client.query<LocalLps>(
        "INSERT INTO lps (code, name, active) VALUES ($1,$2,TRUE) ON CONFLICT (name) DO NOTHING RETURNING id, name, active",
        [stableCode("LPS-ARM-", key), masterRow.nama_lps]
      );
      lps = created.rows[0] || (await client.query<LocalLps>("SELECT id, name, active FROM lps WHERE name = $1", [masterRow.nama_lps])).rows[0] || null;
    }
    if (!lps || !lps.active) throw new LpsQrError("LPS tidak dapat disiapkan.", 409);
    const assignments = (await client.query<{ id: number; active: boolean }>(
      "SELECT id, active FROM vehicle_assignments WHERE vehicle_id=$1 AND lps_id=$2 ORDER BY id", [vehicle.id, lps.id]
    )).rows;
    if (assignments.length > 1) throw new LpsQrError("Relasi armada-LPS ganda pada master.", 409);
    if (assignments[0]) {
      if (!assignments[0].active) {
        throw new LpsQrError("Relasi armada-LPS dinonaktifkan pada master.", 409);
      }
    } else {
      const exists = (await client.query<{ existing: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM vehicle_assignments WHERE vehicle_id=$1 AND active=TRUE AND is_primary=TRUE) AS existing",
        [vehicle.id]
      )).rows[0]?.existing ?? false;
      await client.query(
        "INSERT INTO vehicle_assignments (vehicle_id,lps_id,driver_name,tare_kg,is_primary,active) VALUES ($1,$2,NULL,NULL,$3,TRUE)",
        [vehicle.id,lps.id,!exists]
      );
    }

    const mapped = (await client.query<AssignmentRow>(
      "SELECT va.id, va.lps_id, l.name AS lps_name, va.driver_name, va.tare_kg, va.is_primary FROM vehicle_assignments va JOIN lps l ON l.id=va.lps_id WHERE va.vehicle_id=$1 AND va.active=TRUE AND l.active=TRUE ORDER BY CASE WHEN va.lps_id=$2 THEN 0 ELSE 1 END, va.is_primary DESC, l.name",
      [vehicle.id,lps.id]
    )).rows;
    const lpsOptions = (await client.query<{ id: number; name: string }>(
      "SELECT id,name FROM lps WHERE active=TRUE ORDER BY name"
    )).rows;
    return { vehicle, assignments: mapped, lpsOptions, source: "ARMADA" as const, masterCreated };
  });
}
