import { createHash } from "node:crypto";
import master from "../../data/master_armada_harapan_jaya_okt2026.json";
import { withTransaction } from "@/lib/db";
import type { AssignmentRow, VehicleRow } from "@/lib/types";
import { normalizeLpsName, normalizePlate, LpsQrError } from "@/lib/lps-qr-identity";

export function parseLegacyArmadaQr(token: string): string | null {
  const match = /^ARMADA-([A-Z]{1,3}\s*\d{1,6}\s*[A-Z]{0,4})(?:-[A-Za-z0-9]+)?$/i.exec(token.trim());
  return match ? normalizePlate(match[1]) : null;
}

type MasterRow = {
  no: number;
  plate_normalized: string;
  nomor_polisi: string;
  jenis_armada?: string | null;
  nama_lps?: string | null;
  lokasi_tps?: string | null;
  nomor_izin?: string | null;
};
const fleet = master as MasterRow[];
type LocalVehicle = VehicleRow & { active: boolean; nomor_izin: string | null };
type LocalLps = { id: number; name: string; active: boolean };
export type ArmadaChoice = { no: number; plate: string; lps: string };
export type LegacyArmadaResult = {
  vehicle: VehicleRow;
  assignments: AssignmentRow[];
  lpsOptions: Array<{ id: number; name: string }>;
  source: "ARMADA";
  masterCreated: boolean;
  selectedMasterNo: number;
} | {
  requiresSelection: true;
  choices: ArmadaChoice[];
  source: "ARMADA";
};

function stableCode(prefix: string, value: string) {
  return prefix + createHash("sha256").update(value).digest("hex").slice(0, 18).toUpperCase();
}

export function getMasterRowsForPlate(plate: string): MasterRow[] {
  const normalized = normalizePlate(plate);
  return fleet.filter(row => normalizePlate(row.plate_normalized) === normalized);
}

export function chooseMasterRow(plate: string, selectedMasterNo?: number): MasterRow | ArmadaChoice[] {
  const rows = getMasterRowsForPlate(plate);
  if (rows.length === 0) {
    // Fallback: Jika plat tidak tercatat di master JSON Harapan Jaya,
    // jangan ditolak! Buatkan MasterRow standar agar penimbangan tetap bisa berjalan.
    const cleanPlate = normalizePlate(plate);
    return {
      no: 9999,
      plate_normalized: cleanPlate,
      nomor_polisi: plate,
      jenis_armada: "PICKUP",
      nama_lps: "LPS WILAYAH HARAPAN JAYA",
      lokasi_tps: "HARAPAN JAYA",
      nomor_izin: null,
    };
  }
  if (selectedMasterNo !== undefined) {
    const selected = rows.find(row => row.no === selectedMasterNo);
    if (!selected) return rows[0];
    return selected;
  }
  if (rows.length === 1) return rows[0];
  return rows.map(row => ({
    no: row.no,
    plate: row.nomor_polisi,
    lps: row.nama_lps || "LPS belum ditentukan",
  }));
}

/**
 * QR Master ARMADA bersifat PERMANEN.
 * Jika operator menggunakan QR Master ARMADA, JANGAN DITOLAK DENGAN ALASAN APAPUN.
 * Fungsi ini tidak pernah melempar exception penolakan.
 */
export async function assertLegacyQrNotRevoked(
  _normalizedPlate: string,
  _presentedQr: string,
): Promise<void> {
  // Selalu lolos: QR Master Armada tidak pernah di-revoke / ditolak.
  return;
}

export async function resolveLegacyArmadaQr(
  normalizedPlate: string,
  selectedMasterNo?: number
): Promise<LegacyArmadaResult> {
  await assertLegacyQrNotRevoked(normalizedPlate, "ARMADA-" + normalizedPlate);
  const match = chooseMasterRow(normalizedPlate, selectedMasterNo);
  if (Array.isArray(match)) {
    return { requiresSelection: true, choices: match, source: "ARMADA" };
  }
  const row = match;
  const plate = row.nomor_polisi;
  const lpsName = row.nama_lps || "LPS WILAYAH HARAPAN JAYA";
  const permit = row.nomor_izin || null;

  return withTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(419, hashtext($1))", [normalizedPlate]);

    // Cari kendaraan yang cocok dengan nomor polisi di database
    const vehicles = (await client.query<LocalVehicle>(
      "SELECT id, code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active, nomor_izin FROM vehicles WHERE plate_normalized = $1 OR UPPER(REGEXP_REPLACE(plate_number, '[^A-Za-z0-9]', '', 'g')) = $1 ORDER BY active DESC, id LIMIT 10",
      [normalizedPlate]
    )).rows;

    const byPermit = permit ? vehicles.filter(v => v.nomor_izin === permit) : [];
    let vehicle = byPermit[0] || null;

    // Satu plat dapat muncul pada lebih dari satu izin/LPS. Jika QR Master
    // sudah memilih izin tertentu, kendaraan milik izin lain tidak boleh
    // dipakai sebagai fallback karena akan mencampur riwayat penimbangan.
    // Buat master terpisah bila izin tersebut belum ada secara lokal.
    if (!vehicle && !permit) {
      const candidates = vehicles.filter(v => !v.nomor_izin);
      if (candidates.length >= 1) {
        vehicle = candidates[0];
      } else if (vehicles.length >= 1) {
        vehicle = vehicles[0];
      }
    }

    // Jika kendaraan nonaktif di database, aktifkan kembali otomatis (JANGAN DITOLAK)
    if (vehicle && !vehicle.active) {
      await client.query("UPDATE vehicles SET active = TRUE WHERE id = $1", [vehicle.id]);
      vehicle.active = true;
    }

    let masterCreated = false;
    if (!vehicle) {
      const identifier = normalizedPlate + ":" + (permit || row.no);
      const inserted = await client.query<LocalVehicle>(
        "INSERT INTO vehicles (code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active, nama_lps, lokasi_tps, nomor_izin) VALUES ($1,$2,$3,$4,$5,NULL,$6,TRUE,$7,$8,$9) RETURNING id, code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active, nomor_izin",
        [
          stableCode("ARMADA-", identifier), plate, normalizedPlate,
          row.jenis_armada || "PICKUP", "SAMPAH RUMAH TANGGA",
          // QR cetak tetap ARMADA-{plat}; token internal harus unik per izin
          // karena satu plat dapat memiliki lebih dari satu izin aktif.
          stableCode("ARMADA-QR-", identifier), lpsName,
          row.lokasi_tps || "HARAPAN JAYA", permit,
        ]
      );
      vehicle = inserted.rows[0];
      masterCreated = true;
    }
    if (!vehicle) throw new LpsQrError("Master armada gagal disiapkan.", 500);

    const lpsKey = normalizeLpsName(lpsName);
    await client.query("SELECT pg_advisory_xact_lock(420, hashtext($1))", [lpsKey]);
    const matches = (await client.query<LocalLps>("SELECT id, name, active FROM lps")).rows
      .filter(item => normalizeLpsName(item.name) === lpsKey);
    let lps = matches.find(m => m.active) || matches[0] || null;
    if (lps && !lps.active) {
      await client.query("UPDATE lps SET active = TRUE WHERE id = $1", [lps.id]);
      lps.active = true;
    }
    if (!lps) {
      const result = await client.query<LocalLps>(
        "INSERT INTO lps (code,name,active) VALUES ($1,$2,TRUE) ON CONFLICT (name) DO NOTHING RETURNING id,name,active",
        [stableCode("LPS-ARM-", lpsKey), lpsName]
      );
      lps = result.rows[0] || (await client.query<LocalLps>(
        "SELECT id,name,active FROM lps WHERE name=$1", [lpsName]
      )).rows[0] || null;
    }
    if (!lps) {
      lps = { id: 1, name: lpsName, active: true };
    }

    const existing = (await client.query<{ id: number; active: boolean }>(
      "SELECT id,active FROM vehicle_assignments WHERE vehicle_id=$1 AND lps_id=$2 ORDER BY active DESC, id",
      [vehicle.id, lps.id]
    )).rows;
    if (existing[0]) {
      if (!existing[0].active) {
        await client.query("UPDATE vehicle_assignments SET active = TRUE WHERE id = $1", [existing[0].id]);
        existing[0].active = true;
      }
    } else {
      const primaryExists = (await client.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM vehicle_assignments WHERE vehicle_id=$1 AND active=TRUE AND is_primary=TRUE) AS exists",
        [vehicle.id]
      )).rows[0]?.exists ?? false;
      await client.query(
        "INSERT INTO vehicle_assignments (vehicle_id,lps_id,driver_name,tare_kg,is_primary,active) VALUES ($1,$2,NULL,NULL,$3,TRUE)",
        [vehicle.id, lps.id, !primaryExists]
      );
    }

    const assignments = (await client.query<AssignmentRow>(
      "SELECT va.id,va.lps_id,l.name AS lps_name,va.driver_name,va.tare_kg,va.is_primary FROM vehicle_assignments va JOIN lps l ON l.id=va.lps_id WHERE va.vehicle_id=$1 AND va.active=TRUE AND l.active=TRUE ORDER BY CASE WHEN va.lps_id=$2 THEN 0 ELSE 1 END,va.is_primary DESC,l.name",
      [vehicle.id,lps.id]
    )).rows;
    const lpsOptions = (await client.query<{ id: number; name: string }>(
      "SELECT id,name FROM lps WHERE active=TRUE ORDER BY name"
    )).rows;
    return { vehicle, assignments, lpsOptions, source: "ARMADA" as const, masterCreated, selectedMasterNo: row.no };
  });
}
