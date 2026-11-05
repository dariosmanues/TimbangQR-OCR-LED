import { createHash } from "node:crypto";
import { withTransaction } from "@/lib/db";
import type { AssignmentRow, VehicleRow } from "@/lib/types";

import { LpsQrError, normalizeLpsName, verifyLpsArmada } from "./lps-qr-identity";
import type { LpsIdentity, LpsArmada } from "./lps-qr-identity";
export { LpsQrError, parseLpsQrToken } from "./lps-qr-identity";

const DEFAULT_LPS_ARMADA_URL = "https://lps-app-five.vercel.app/api/integrations/timbangqr/armada";
const DEFAULT_LPS_SECRET = "a8f9c4e2b7d013589ef671234abcd567890ef123456789abcdef0123456789ab";

function getTargetLpsArmadaUrl(): string {
  const configured = process.env.LPS_ARMADA_API_URL?.trim();
  if (!configured) return DEFAULT_LPS_ARMADA_URL;
  if (configured.includes("lps-app-iota.vercel.app") || configured.includes("lps-app-fikris-projects")) {
    return DEFAULT_LPS_ARMADA_URL;
  }
  return configured;
}

export async function fetchVerifiedLpsArmada(identity: LpsIdentity): Promise<LpsArmada> {
  const baseUrl = getTargetLpsArmadaUrl();
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) {
    throw new LpsQrError("Konfigurasi API LPS harus menggunakan HTTPS.", 503);
  }
  url.searchParams.set("code", identity.token);
  const secret = process.env.LPS_INTEGRATION_SECRET?.trim() || DEFAULT_LPS_SECRET;
  const headers: Record<string, string> = secret ? { authorization: "Bearer " + secret } : {};
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    // Fallback otomatis ke URL produksi aktif jika URL lama di env mengalami HTTP 402 (DEPLOYMENT_DISABLED)
    if (
      response.status === 402 &&
      url.hostname !== "localhost" &&
      url.origin !== new URL(DEFAULT_LPS_ARMADA_URL).origin
    ) {
      const fallbackUrl = new URL(DEFAULT_LPS_ARMADA_URL);
      fallbackUrl.searchParams.set("code", identity.token);
      response = await fetch(fallbackUrl, {
        method: "GET",
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
      });
    }
  } catch {
    throw new LpsQrError("API LPS sedang tidak dapat dihubungi. Coba lagi.", 503);
  }
  if (response.status === 404) {
    throw new LpsQrError("Kode QR tidak terdaftar dalam master armada LPS.", 404);
  }
  if (response.status === 400) {
    let errBody: any;
    try {
      errBody = await response.json();
    } catch {}
    if (errBody?.burned || errBody?.message?.includes("hangus")) {
      throw new LpsQrError(
        errBody.message || "QR Code ini sudah hangus (sudah pernah digunakan untuk transaksi tiket #...). Silakan Hubungi Ketua Atau Pengurus LPS Anda .",
        400,
      );
    }
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
type VehicleLookup = VehicleRow & { active: boolean; nama_lps: string | null; nomor_izin: string | null };
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
      "SELECT id, code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active, nama_lps, nomor_izin FROM vehicles WHERE plate_normalized = $1 ORDER BY active DESC, id LIMIT 10",
      [armada.normalizedPlate],
    )).rows;
    let candidate: VehicleLookup | null = vehicleRows[0] || null;
    if (vehicleRows.length > 1) {
      const activeRows = vehicleRows.filter(v => v.active);
      const rowsToMatch = activeRows.length > 0 ? activeRows : vehicleRows;
      const matchedPermit = armada.noIzinOperasi
        ? rowsToMatch.filter(v => v.nomor_izin === armada.noIzinOperasi)
        : [];
      const matches = matchedPermit.length
        ? matchedPermit
        : rowsToMatch.filter(v => v.nama_lps && normalizeLpsName(v.nama_lps) === normalizeLpsName(armada.namaLps));
      if (matches.length > 1) {
        const uniqueLps = new Set(matches.map(v => normalizeLpsName(v.nama_lps || "")));
        if (uniqueLps.size === 1) {
          candidate = matches.find(v => v.code && !v.code.startsWith("OLD-")) || matches[0];
        } else {
          candidate = matches[0];
        }
      } else if (matches.length === 1) {
        candidate = matches[0];
      } else {
        candidate = rowsToMatch[0];
      }
    }

    // Jika armada aktif di LPS tetapi nonaktif di TimbangQR, aktifkan otomatis
    // dan sinkronkan qr_token terbaru dari LPS agar selalu terdeteksi.
    if (candidate) {
      if (!candidate.active || (armada.qrCode && candidate.qr_token !== armada.qrCode)) {
        const conflict = armada.qrCode
          ? (await client.query<{ id: number }>(
              "SELECT id FROM vehicles WHERE qr_token = $1 AND id <> $2 LIMIT 1",
              [armada.qrCode, candidate.id],
            )).rows[0]
          : null;
        const nextQrToken = conflict ? candidate.qr_token : (armada.qrCode || candidate.qr_token);
        await client.query(
          "UPDATE vehicles SET active = TRUE, qr_token = $1 WHERE id = $2",
          [nextQrToken, candidate.id],
        );
        candidate.active = true;
        candidate.qr_token = nextQrToken;
      }
    }

    let vehicle = candidate;
    let masterCreated = false;
    if (!vehicle) {
      const code = stableCode("LPS-ARM-", armada.id);
      const rows = await client.query<VehicleLookup>(
        "INSERT INTO vehicles (code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active, nama_lps, lokasi_tps, nomor_izin) VALUES ($1,$2,$3,$4,$5,NULL,$6,TRUE,$7,$8,$9) RETURNING id, code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active, nama_lps, nomor_izin",
        [code, armada.platNomor, armada.normalizedPlate, armada.jenisArmada || "BELUM DIISI", "SAMPAH RUMAH TANGGA", armada.qrCode, armada.namaLps, process.env.LPS_TRANSDEPO || "HARAPAN_JAYA", armada.noIzinOperasi],
      );
      vehicle = rows.rows[0];
      masterCreated = true;
    }
    if (!vehicle) throw new LpsQrError("Gagal menyinkronkan master kendaraan.", 500);

    // Nama LPS juga dilock: dua armada baru dari LPS sama tidak bersaing INSERT.
    await client.query("SELECT pg_advisory_xact_lock(418, hashtext($1))", [normalizeLpsName(armada.namaLps)]);
    const lpsRows = (await client.query<LpsRecord>(
      "SELECT id, name, active FROM lps ORDER BY id",
    )).rows.filter((item) => normalizeLpsName(item.name) === normalizeLpsName(armada.namaLps));

    let lps = lpsRows.find((item) => item.name.trim().toUpperCase() === armada.namaLps.trim().toUpperCase() && item.active)
      || lpsRows.find((item) => item.active)
      || lpsRows[0]
      || null;

    if (lps && !lps.active) {
      await client.query("UPDATE lps SET active = TRUE WHERE id = $1", [lps.id]);
      lps.active = true;
    }
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
    let existingRel = existing[0] || null;
    if (existing.length > 1) {
      existingRel = existing.find((r) => r.active) || existing[0];
      const excessIds = existing.filter((r) => r.id !== existingRel.id).map((r) => r.id);
      if (excessIds.length > 0) {
        await client.query("DELETE FROM vehicle_assignments WHERE id = ANY($1)", [excessIds]);
      }
    }
    if (existingRel) {
      // Saat mengaktifkan relasi lama, jangan melanggar primary unik kendaraan.
      const primaryForOtherLps = (await client.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM vehicle_assignments WHERE vehicle_id = $1 AND lps_id <> $2 AND active = TRUE AND is_primary = TRUE) AS exists",
        [vehicle.id, lps.id],
      )).rows[0]?.exists ?? false;
      await client.query(
        "UPDATE vehicle_assignments SET active = TRUE, is_primary = CASE WHEN $3 THEN FALSE ELSE is_primary END, driver_name = COALESCE($2, driver_name) WHERE id = $1",
        [existingRel.id, armada.namaSupir, primaryForOtherLps],
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
