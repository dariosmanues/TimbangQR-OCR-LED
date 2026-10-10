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
    throw new LpsQrError("QR armada tidak terdaftar di master Harapan Jaya Oktober 2026.", 404);
  }
  if (selectedMasterNo !== undefined) {
    const selected = rows.find(row => row.no === selectedMasterNo);
    if (!selected) throw new LpsQrError("Pilihan nomor izin armada tidak sesuai kode QR.", 422);
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
 * All physical ARMADA-{plate} QR codes are supported. When plate repeats in
 * the source master, operator must explicitly choose which LPS/permit record
 * is being weighed; never guess the first match.
 */
/**
 * LPS owns the current printed QR for an armada. Older ARMADA-{plate}
 * stickers must not be accepted once the kelurahan has regenerated its QR.
 *
 * Unregistered legacy fleet entries can continue scanning from the trusted
 * Harapan Jaya master until an LPS record is registered for that plate.
 * Every scan rechecks LPS online; network/auth errors fail closed.
 */
export async function assertLegacyQrNotRevoked(
  normalizedPlate: string,
  presentedQr: string,
): Promise<void> {
  const base = process.env.LPS_ARMADA_API_URL?.trim()
    || "https://lps-app-iota.vercel.app/api/integrations/timbangqr/armada";
  const url = new URL(base);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) {
    throw new LpsQrError("API LPS harus diakses melalui HTTPS.", 503);
  }
  url.searchParams.delete("code");
  url.searchParams.delete("qrCode");
  url.searchParams.set("plate", normalizedPlate);
  const secret = process.env.LPS_INTEGRATION_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === "production") {
    throw new LpsQrError("Secret API LPS belum dikonfigurasi di TimbangQR.", 503);
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: secret ? { authorization: "Bearer " + secret } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw new LpsQrError("Tidak bisa mengecek status QR LPS. Coba lagi.", 503);
  }
  // The physical sticker is an older fleet-only QR, not yet registered
  // in the kelurahan's LPS generator. Still supported until registered.
  if (response.status === 404) return;
  if (!response.ok) {
    throw new LpsQrError("Gagal memeriksa QR LPS (HTTP " + response.status + ").", 503);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new LpsQrError("Respons validasi QR LPS rusak.", 502);
  }
  if (!body || typeof body !== "object") {
    throw new LpsQrError("Respons validasi QR LPS tidak sesuai.", 502);
  }
  const result = body as {
    success?: boolean;
    valid?: boolean;
    data?: { normalizedPlate?: string; platNomor?: string; qrCode?: string; isActive?: boolean };
  };
  if (result.success !== true || !result.data ||
      typeof result.data.qrCode !== "string" ||
      typeof result.data.platNomor !== "string" ||
      normalizePlate(result.data.platNomor) !== normalizedPlate) {
    throw new LpsQrError("Identitas QR LPS tidak dapat dipastikan.", 502);
  }
  if (result.valid !== true || result.data.isActive !== true) {
    throw new LpsQrError("Armada sedang tidak aktif di LPS.", 403);
  }
  // Exact payload comparison, never "same plate" matching.
  if (result.data.qrCode !== presentedQr) {
    throw new LpsQrError(
      "QR lama sudah tidak berlaku. Gunakan QR baru dari dashboard LPS Kelurahan.",
      410,
    );
  }
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
  const lpsName = row.nama_lps;
  const permit = row.nomor_izin || null;
  if (!plate || !lpsName) throw new LpsQrError("Data master armada tidak lengkap.", 422);

  return withTransaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(419, hashtext($1))", [normalizedPlate]);

    // A plate can legitimately have two *permits*. Identify the correct
    // vehicle by permit before trying a unique plate fallback.
    const vehicles = (await client.query<LocalVehicle>(
      "SELECT id, code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active, nomor_izin FROM vehicles WHERE plate_normalized = $1 OR UPPER(REGEXP_REPLACE(plate_number, '[^A-Za-z0-9]', '', 'g')) = $1 ORDER BY id LIMIT 10",
      [normalizedPlate]
    )).rows;

    const byPermit = permit ? vehicles.filter(v => v.nomor_izin === permit) : [];
    if (byPermit.length > 1) throw new LpsQrError("Izin armada tercatat ganda pada master.", 409);
    let vehicle = byPermit[0] || null;

    if (!vehicle) {
      // Reuse legacy vehicles without an assigned permit when unambiguous;
      // never steal another LPS's permit identity for a duplicate plate.
      const candidates = vehicles.filter(v => !v.nomor_izin);
      if (candidates.length === 1 && vehicles.length === 1 && getMasterRowsForPlate(normalizedPlate).length === 1) vehicle = candidates[0];
    }

    if (vehicle && !vehicle.active) {
      throw new LpsQrError("Kendaraan tercatat tidak aktif di master TimbangQR.", 409);
    }

    let masterCreated = false;
    if (!vehicle) {
      const existingPermit = permit ? (await client.query<{ id: number }>(
        "SELECT id FROM vehicles WHERE nomor_izin = $1 LIMIT 2",
        [permit]
      )).rows : [];
      if (existingPermit.length) {
        throw new LpsQrError("Nomor izin telah dipakai kendaraan lain. Periksa master.", 409);
      }
      const identifier = normalizedPlate + ":" + (permit || row.no);
      const inserted = await client.query<LocalVehicle>(
        "INSERT INTO vehicles (code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active, nama_lps, lokasi_tps, nomor_izin) VALUES ($1,$2,$3,$4,$5,NULL,$6,TRUE,$7,$8,$9) RETURNING id, code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active, nomor_izin",
        [
          stableCode("ARMADA-", identifier), plate, normalizedPlate,
          row.jenis_armada || "PICKUP", "SAMPAH RUMAH TANGGA",
          stableCode("QR-ARMADA-", identifier), lpsName,
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
    if (matches.length > 1) throw new LpsQrError("Nama LPS ganda pada master.", 409);
    if (matches[0] && !matches[0].active) throw new LpsQrError("LPS tidak aktif pada master.", 409);
    let lps = matches[0] || null;
    if (!lps) {
      const result = await client.query<LocalLps>(
        "INSERT INTO lps (code,name,active) VALUES ($1,$2,TRUE) ON CONFLICT (name) DO NOTHING RETURNING id,name,active",
        [stableCode("LPS-ARM-", lpsKey), lpsName]
      );
      lps = result.rows[0] || (await client.query<LocalLps>(
        "SELECT id,name,active FROM lps WHERE name=$1", [lpsName]
      )).rows[0] || null;
    }
    if (!lps || !lps.active) throw new LpsQrError("LPS gagal dihubungkan.", 409);

    const existing = (await client.query<{ id: number; active: boolean }>(
      "SELECT id,active FROM vehicle_assignments WHERE vehicle_id=$1 AND lps_id=$2 ORDER BY id",
      [vehicle.id, lps.id]
    )).rows;
    if (existing.length > 1) throw new LpsQrError("Relasi armada-LPS ganda.", 409);
    if (existing[0]) {
      if (!existing[0].active) throw new LpsQrError("Relasi armada-LPS tidak aktif.", 409);
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
