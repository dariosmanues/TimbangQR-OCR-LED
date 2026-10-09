import { createHash } from "node:crypto";
import { withTransaction } from "@/lib/db";
import type { AssignmentRow, VehicleRow } from "@/lib/types";

export type LpsIdentity = { token: string; normalizedPlate: string };
export type LpsArmada = {
  id: string;
  platNomor: string;
  normalizedPlate: string;
  namaLps: string;
  namaSupir: string | null;
  jenisArmada: string | null;
  qrCode: string;
  isActive: boolean;
};

export class LpsQrError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "LpsQrError";
  }
}

export function normalizePlate(value: string) {
  return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeLpsName(value: string) {
  return value.normalize("NFKC").toUpperCase()
    .replace(/^LPS[\s._-]+/, "")
    .replace(/[^A-Z0-9]/g, "");
}

// QR yang dibuat LPS berbentuk LPS-{plat tanpa spasi}-{timestamp}.
// Sufiks 8 karakter juga didukung untuk QR lama dari fallback generator LPS.
// Hanya API LPS yang boleh mengesahkan QR; hasil regex BUKAN otorisasi.
export function parseLpsQrToken(value: string): LpsIdentity | null {
  const token = value.trim();
  const match = /^LPS-([A-Z]{1,3}\d{1,6}[A-Z]{0,4})-(\d{10,17}|[A-Fa-f0-9]{8})$/i.exec(token);
  return match ? { token, normalizedPlate: normalizePlate(match[1]) } : null;
}

export function verifyLpsArmada(identity: LpsIdentity, body: unknown): LpsArmada {
  if (!body || typeof body !== "object") {
    throw new LpsQrError("Respons API LPS tidak valid.", 502);
  }
  const response = body as { success?: boolean; valid?: boolean; data?: Partial<LpsArmada> };
  if (response.success !== true || response.valid !== true) {
    throw new LpsQrError("QR LPS tidak ditemukan atau armada tidak aktif.", 404);
  }
  const data = response.data;
  if (!data || typeof data.id !== "string" || !data.id ||
      typeof data.platNomor !== "string" || typeof data.namaLps !== "string" ||
      typeof data.qrCode !== "string" || typeof data.isActive !== "boolean") {
    throw new LpsQrError("Data identitas armada dari API LPS tidak lengkap.", 502);
  }
  if (!data.isActive || data.qrCode !== identity.token ||
      normalizePlate(data.platNomor) !== identity.normalizedPlate ||
      (data.normalizedPlate && normalizePlate(data.normalizedPlate) !== identity.normalizedPlate)) {
    throw new LpsQrError("QR LPS tidak cocok dengan identitas armada yang terdaftar.", 422);
  }
  if (!data.namaLps.trim() || !normalizeLpsName(data.namaLps)) {
    throw new LpsQrError("Nama LPS dari API belum dapat dicocokkan.", 422);
  }
  return {
    id: data.id,
    platNomor: data.platNomor.trim(),
    normalizedPlate: identity.normalizedPlate,
    namaLps: data.namaLps.trim(),
    namaSupir: typeof data.namaSupir === "string" ? data.namaSupir.trim() || null : null,
    jenisArmada: typeof data.jenisArmada === "string" ? data.jenisArmada.trim() || null : null,
    qrCode: data.qrCode,
    isActive: true,
  };
}

export async function fetchVerifiedLpsArmada(identity: LpsIdentity): Promise<LpsArmada> {
  const baseUrl = process.env.LPS_ARMADA_API_URL?.trim()
    || "https://lps-app-iota.vercel.app/api/integrations/timbangqr/armada";
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) {
    throw new LpsQrError("Konfigurasi API LPS harus menggunakan HTTPS.", 503);
  }
  url.searchParams.set("code", identity.token);
  const secret = process.env.LPS_INTEGRATION_SECRET?.trim();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: secret ? { authorization: "Bearer " + secret } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw new LpsQrError("API LPS sedang tidak dapat dihubungi. Coba lagi.", 503);
  }
  if (response.status === 404) {
    throw new LpsQrError("Kode QR tidak terdaftar dalam master armada LPS.", 404);
  }
  if (!response.ok) {
    throw new LpsQrError("Validasi ke API LPS gagal (HTTP " + response.status + ").", 502);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new LpsQrError("Respons API LPS bukan JSON yang valid.", 502);
  }
  return verifyLpsArmada(identity, body);
}

function stableCode(prefix: string, value: string) {
  return prefix + createHash("sha256").update(value).digest("hex").slice(0, 18).toUpperCase();
}

type LpsRecord = { id: number; name: string; active: boolean };
type VehicleLookup = VehicleRow & { active: boolean };
export type ResolvedLpsQr = {
  vehicle: VehicleRow;
  assignments: AssignmentRow[];
  lpsOptions: Array<{ id: number; name: string }>;
  source: "LPS";
  lpsVerified: true;
  externalLpsArmadaId: string;
  masterCreated: boolean;
};

// Satu transaksi DB mengikat kendaraan, LPS, dan supir agar pemilihan ID
// pada POST /api/weighings selalu mengacu ke master internal TimbangQR.
export async function linkVerifiedLpsArmada(armada: LpsArmada): Promise<ResolvedLpsQr> {
  return withTransaction(async (client) => {
    // Cegah dua scan simultan membuat kendaraan/LPS yang sama secara paralel.
    await client.query("SELECT pg_advisory_xact_lock(417, hashtext($1))", [armada.normalizedPlate]);

    const vehicleRows = (await client.query<VehicleLookup>(
      "SELECT id, code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active FROM vehicles WHERE plate_normalized = $1 ORDER BY active DESC, id LIMIT 3",
      [armada.normalizedPlate],
    )).rows;
    if (vehicleRows.length > 1) {
      throw new LpsQrError("Nomor polisi memiliki lebih dari satu master armada. Periksa duplikasi sebelum menimbang.", 409);
    }
    if (vehicleRows[0] && !vehicleRows[0].active) {
      throw new LpsQrError("Armada pada TimbangQR sudah dinonaktifkan. Aktifkan melalui master armada dahulu.", 409);
    }

    let vehicle = vehicleRows[0] || null;
    let masterCreated = false;
    if (!vehicle) {
      const code = stableCode("LPS-ARM-", armada.id);
      const rows = await client.query<VehicleLookup>(
        "INSERT INTO vehicles (code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active, nama_lps, lokasi_tps) VALUES ($1,$2,$3,$4,$5,NULL,$6,TRUE,$7,$8) RETURNING id, code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active",
        [code, armada.platNomor, armada.normalizedPlate, armada.jenisArmada || "BELUM DIISI", "SAMPAH RUMAH TANGGA", armada.qrCode, armada.namaLps, process.env.LPS_TRANSDEPO || "HARAPAN_JAYA"],
      );
      vehicle = rows.rows[0];
      masterCreated = true;
    }
    if (!vehicle) throw new LpsQrError("Gagal menyinkronkan master kendaraan.", 500);

    const lpsRows = (await client.query<LpsRecord>(
      "SELECT id, name, active FROM lps ORDER BY id",
    )).rows.filter((item) => normalizeLpsName(item.name) === normalizeLpsName(armada.namaLps));

    if (lpsRows.length > 1) {
      throw new LpsQrError("Nama LPS ambigu pada master TimbangQR. Perbaiki duplikasi LPS terlebih dahulu.", 409);
    }
    if (lpsRows[0] && !lpsRows[0].active) {
      throw new LpsQrError("LPS asal sedang dinonaktifkan pada TimbangQR.", 409);
    }
    let lps = lpsRows[0] || null;
    if (!lps) {
      const lpsCode = stableCode("LPS-EXT-", normalizeLpsName(armada.namaLps));
      const created = await client.query<LpsRecord>(
        "INSERT INTO lps (code, name, active) VALUES ($1,$2,TRUE) ON CONFLICT (code) DO NOTHING RETURNING id, name, active",
        [lpsCode, armada.namaLps],
      );
      lps = created.rows[0] || (await client.query<LpsRecord>(
        "SELECT id, name, active FROM lps WHERE code = $1", [lpsCode],
      )).rows[0] || null;
    }
    if (!lps || !lps.active || normalizeLpsName(lps.name) !== normalizeLpsName(armada.namaLps)) {
      throw new LpsQrError("Identitas LPS tidak dapat disinkronkan dengan aman.", 409);
    }

    // Lock kendaraan sudah melindungi sinkronisasi assignment untuk kendaraan ini.
    const existing = (await client.query<{ id: number; active: boolean }>(
      "SELECT id, active FROM vehicle_assignments WHERE vehicle_id = $1 AND lps_id = $2 ORDER BY active DESC, id",
      [vehicle.id, lps.id],
    )).rows;
    if (existing.length > 1) {
      throw new LpsQrError("Ditemukan beberapa relasi armada-LPS. Perbaiki data master dahulu.", 409);
    }
    if (existing[0]) {
      await client.query(
        "UPDATE vehicle_assignments SET active = TRUE, driver_name = COALESCE($2, driver_name) WHERE id = $1",
        [existing[0].id, armada.namaSupir],
      );
    } else {
      const primaryExists = (await client.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM vehicle_assignments WHERE vehicle_id = $1 AND active = TRUE AND is_primary = TRUE) AS exists",
        [vehicle.id],
      )).rows[0]?.exists ?? false;
      await client.query(
        "INSERT INTO vehicle_assignments (vehicle_id, lps_id, driver_name, tare_kg, is_primary, active) VALUES ($1,$2,$3,NULL,$4,TRUE)",
        [vehicle.id, lps.id, armada.namaSupir, !primaryExists],
      );
    }

    const assignments = (await client.query<AssignmentRow>(
      "SELECT va.id, va.lps_id, l.name AS lps_name, va.driver_name, va.tare_kg, va.is_primary FROM vehicle_assignments va JOIN lps l ON l.id = va.lps_id WHERE va.vehicle_id = $1 AND va.active = TRUE AND l.active = TRUE ORDER BY CASE WHEN va.lps_id = $2 THEN 0 ELSE 1 END, va.is_primary DESC, l.name",
      [vehicle.id, lps.id],
    )).rows;
    const lpsOptions = (await client.query<{ id: number; name: string }>(
      "SELECT id, name FROM lps WHERE active = TRUE ORDER BY name",
    )).rows;
    return {
      vehicle,
      assignments,
      lpsOptions,
      source: "LPS" as const,
      lpsVerified: true as const,
      externalLpsArmadaId: armada.id,
      masterCreated,
    };
  });
}
