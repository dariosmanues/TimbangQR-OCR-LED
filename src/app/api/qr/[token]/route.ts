import { NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { dbOne, dbQuery } from "@/lib/db";
import { tokenFromValue } from "@/lib/qr-token";
import { parseLegacyArmadaQr, resolveLegacyArmadaQr } from "@/lib/legacy-armada-qr";
import {
  fetchVerifiedLpsArmada,
  linkVerifiedLpsArmada,
  LpsQrError,
  parseLpsQrToken,
} from "@/lib/lps-qr-integration";
import type { AssignmentRow, VehicleRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = await params;

  // Next.js decodes route params. URLs pasted directly into the scan page
  // still need extracting; scanner upload/camera use the same pure parser.
  let rawToken = tokenFromValue(token);
  if (!rawToken || rawToken.length > 512) {
    return NextResponse.json({ error: "Nilai QR kosong atau terlalu panjang." }, { status: 400 });
  }

  // Handle URL format if passed directly
  if (/^https?:\/\//i.test(rawToken)) {
    try {
      const u = new URL(rawToken);
      const extracted =
        u.searchParams.get("code") ||
        u.searchParams.get("qrCode") ||
        u.searchParams.get("token") ||
        u.searchParams.get("plate") ||
        u.searchParams.get("text") ||
        rawToken;
      rawToken = extracted.trim();
    } catch {
      // keep rawToken as is
    }
  }

  // 1. Cek apakah token QR LPS sekali pakai SUDAH HANGUS di database lokal
  // CATATAN PENTING: QR MASTER ARMADA (ARMADA-*, plat nomor, kode master)
  // bersifat PERMANEN dan TIDAK BOLEH PERNAH DITOLAK karena hangus.
  const isMasterArmada = /^ARMADA-/i.test(rawToken) ||
    /^QR-ARMADA-/i.test(rawToken) ||
    Boolean(parseLegacyArmadaQr(rawToken));

  if (/^LPS-/i.test(rawToken) && !isMasterArmada) {
    try {
      const burnedCheck = await dbOne<{ ticket_number: string; burned_at: string }>(`
        SELECT ticket_number, burned_at
        FROM burned_qr_tokens
        WHERE qr_token = $1
        LIMIT 1
      `, [rawToken]);

      if (burnedCheck) {
        return NextResponse.json({
          error: `QR Code LPS ini sudah hangus (sudah pernah digunakan untuk transaksi tiket #${burnedCheck.ticket_number}). Silakan gunakan QR Master Armada atau hubungi pengurus LPS Anda.`,
          burned: true,
          ticketNumber: burnedCheck.ticket_number,
        }, { status: 400 });
      }
    } catch (err) {
      console.warn("[QR Lookup] Pengecekan burned_qr_tokens lokal gagal:", err);
    }
  }

  // 2. Format QR ARMADA Master / Permanen (ARMADA-BM8264QM)
  const legacyPlate = parseLegacyArmadaQr(rawToken);
  if (/^ARMADA-/i.test(rawToken) || (legacyPlate && !/^LPS-/i.test(rawToken))) {
    const plateToResolve = legacyPlate || rawToken.replace(/^ARMADA-/i, "").trim();
    try {
      const choice = new URL(request.url).searchParams.get("masterNo");
      const selectedNo = choice ? Number(choice) : undefined;
      if (choice && (selectedNo === undefined || !Number.isSafeInteger(selectedNo) || selectedNo < 1)) {
        return NextResponse.json({ error: "Pilihan izin armada tidak valid." }, { status: 422 });
      }
      const record = await resolveLegacyArmadaQr(plateToResolve, selectedNo);
      return NextResponse.json({
        ...record,
        qrToken: rawToken,
      }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      console.error("[ARMADA QR] Gagal memuat armada dari master via resolveLegacyArmadaQr:", error);
      // Jangan langsung tolak: lanjutkan ke fallback pencarian database vehicles di bawah
    }
  }

  // 3. QR LPS wajib divalidasi secara server-to-server ke aplikasi LPS
  const lpsIdentity = parseLpsQrToken(rawToken);
  let lpsFetchError: string | null = null;
  if (lpsIdentity) {
    try {
      const remoteArmada = await fetchVerifiedLpsArmada(lpsIdentity);
      const result = await linkVerifiedLpsArmada(remoteArmada);
      return NextResponse.json({
        ...result,
        qrToken: rawToken,
      }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch (error) {
      if (error instanceof LpsQrError && error.status === 400) {
        // QR LPS bersifat temporer / sekali pakai per perjalanan. Jika sudah hangus, tolak transaksi.
        return NextResponse.json(
          { error: error.message, burned: true },
          { status: 400 }
        );
      }
      lpsFetchError = error instanceof Error ? error.message : "Validasi QR LPS gagal.";
      console.warn("[LPS QR] Validasi API LPS gagal / offline. Mencoba fallback master kendaraan:", lpsFetchError);
    }
  }

  // 4. Cek otorisasi: Jika request berasal dari input ketik plat manual (?manual=1),
  // HANYA boleh diakses oleh Master ADMIN. Hasil Scan QR kamera/gambar (termasuk kartu QR
  // yang berisi plat nomor seperti BM8606QQ, kode armada, atau nomor izin) tetap diizinkan.
  const isManualRequest = new URL(request.url).searchParams.get("manual") === "1";
  if (isManualRequest && !isSuperAdmin(user)) {
    return NextResponse.json(
      {
        error: "Akses ditolak: Input nomor plat manual telah dinonaktifkan untuk Administrator. Seluruh transaksi wajib menggunakan Scan Barcode / QR Code resmi armada.",
      },
      { status: 403 }
    );
  }

  // 5. Jalur fallback untuk QR internal TimbangQR, nomor polisi, izin, kode armada, atau LPS token yang offline
  const plateCompact = (lpsIdentity?.normalizedPlate || rawToken).toUpperCase().replace(/[^A-Z0-9]/g, "");
  let vehicle = await dbOne<VehicleRow>([
    "SELECT id, code, plate_number, plate_normalized, vehicle_type, waste_type,",
    "default_tare_kg, qr_token, active FROM vehicles WHERE (",
    "qr_token = $1 OR UPPER(plate_number) = UPPER($1)",
    "OR plate_normalized = $2 OR UPPER(code) = UPPER($1)",
    "OR UPPER(COALESCE(nomor_izin, '')) = UPPER($1)",
    ") ORDER BY active DESC, id LIMIT 1",
  ].join(" "), [rawToken, plateCompact]);

  // Fallback pencocokan jika ada pergantian seri plat (misal BM <-> BA pada kartu fisik lama)
  if (!vehicle && plateCompact.length >= 6) {
    const swapped = plateCompact.startsWith("BM")
      ? plateCompact.replace(/^BM/, "BA")
      : plateCompact.startsWith("BA")
      ? plateCompact.replace(/^BA/, "BM")
      : null;
    if (swapped) {
      vehicle = await dbOne<VehicleRow>(
        "SELECT id, code, plate_number, plate_normalized, vehicle_type, waste_type, default_tare_kg, qr_token, active FROM vehicles WHERE plate_normalized = $1 OR qr_token = $1 ORDER BY active DESC, id LIMIT 1",
        [swapped]
      );
    }
  }

  // Jika kendaraan nonaktif, otomatis aktifkan kembali (JANGAN DITOLAK)
  if (vehicle && !vehicle.active) {
    try {
      await dbQuery("UPDATE vehicles SET active = TRUE WHERE id = $1", [vehicle.id]);
      vehicle.active = true;
    } catch (e) {
      console.warn("[QR Lookup] Auto-activate vehicle gagal:", e);
    }
  }

  // Jika tidak ditemukan di database vehicles, coba cari/daftarkan via resolveLegacyArmadaQr
  if (!vehicle && plateCompact.length >= 3) {
    try {
      const resolved = await resolveLegacyArmadaQr(plateCompact);
      if ("vehicle" in resolved) {
        vehicle = resolved.vehicle;
      }
    } catch (e) {
      console.warn("[QR Lookup] Auto-resolve master armada gagal:", e);
    }
  }

  if (!vehicle) {
    if (lpsFetchError) {
      return NextResponse.json({ error: lpsFetchError }, { status: 400 });
    }
    return NextResponse.json(
      { error: `Nomor polisi / armada (${rawToken}) tidak ditemukan di database Master Armada. Hanya armada yang terdaftar di Master Armada yang dapat ditimbang.` },
      { status: 404 }
    );
  }

  let assignments = await dbQuery<AssignmentRow>([
    "SELECT va.id, va.lps_id, l.name AS lps_name, va.driver_name, va.tare_kg, va.is_primary",
    "FROM vehicle_assignments va JOIN lps l ON l.id = va.lps_id",
    "WHERE va.vehicle_id = $1 AND va.active = TRUE",
    "ORDER BY va.is_primary DESC, l.name",
  ].join(" "), [vehicle.id]);

  if (assignments.length === 0) {
    try {
      await dbQuery("UPDATE vehicle_assignments SET active = TRUE WHERE vehicle_id = $1", [vehicle.id]);
      assignments = await dbQuery<AssignmentRow>([
        "SELECT va.id, va.lps_id, l.name AS lps_name, va.driver_name, va.tare_kg, va.is_primary",
        "FROM vehicle_assignments va JOIN lps l ON l.id = va.lps_id",
        "WHERE va.vehicle_id = $1 AND va.active = TRUE",
        "ORDER BY va.is_primary DESC, l.name",
      ].join(" "), [vehicle.id]);
    } catch (e) {
      console.warn("[QR Lookup] Re-activate vehicle_assignments gagal:", e);
    }
  }

  const lpsOptions = await dbQuery<{ id: number; name: string }>(
    "SELECT id, name FROM lps WHERE active = TRUE ORDER BY name"
  );

  return NextResponse.json({
    vehicle,
    assignments,
    lpsOptions,
    qrToken: rawToken,
    source: "ARMADA",
  });
}
