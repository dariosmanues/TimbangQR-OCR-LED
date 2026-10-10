import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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

  // 1. Cek apakah token QR ini SUDAH HANGUS di database lokal TimbangQR
  // (pernah digunakan untuk transaksi penimbangan sebelumnya)
  try {
    const burnedCheck = await dbOne<{ ticket_number: string; burned_at: string }>(`
      SELECT ticket_number, burned_at
      FROM burned_qr_tokens
      WHERE qr_token = $1
      UNION ALL
      SELECT ticket_number, weighed_at AS burned_at
      FROM weighings
      WHERE qr_token = $1
      LIMIT 1
    `, [rawToken]);

    if (burnedCheck) {
      return NextResponse.json({
        error: `QR Code ini sudah hangus (sudah pernah digunakan untuk transaksi tiket #${burnedCheck.ticket_number}). Silakan generate QR ulang di aplikasi LPS (https://lps-app-iota.vercel.app/lps/qr-generator).`,
        burned: true,
        ticketNumber: burnedCheck.ticket_number,
      }, { status: 400 });
    }
  } catch (err) {
    console.warn("[QR Lookup] Pengecekan burned_qr_tokens lokal gagal:", err);
  }

  // 2. Format QR ARMADA legacy (ARMADA-BM8264QM)
  const legacyPlate = parseLegacyArmadaQr(rawToken);
  if (/^ARMADA-/i.test(rawToken)) {
    if (!legacyPlate) {
      return NextResponse.json({ error: "Format QR ARMADA tidak dikenali." }, { status: 422 });
    }
    try {
      const choice = new URL(request.url).searchParams.get("masterNo");
      const selectedNo = choice ? Number(choice) : undefined;
      if (choice && (selectedNo === undefined || !Number.isSafeInteger(selectedNo) || selectedNo < 1)) {
        return NextResponse.json({ error: "Pilihan izin armada tidak valid." }, { status: 422 });
      }
      const record = await resolveLegacyArmadaQr(legacyPlate, selectedNo);
      return NextResponse.json({
        ...record,
        qrToken: rawToken,
      }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      if (error instanceof LpsQrError) {
        return NextResponse.json({ error: error.message, burned: error.status === 400 }, { status: error.status });
      }
      console.error("[ARMADA QR] Database mapping error:", error);
      return NextResponse.json({ error: "Gagal memuat armada Harapan Jaya dari master." }, { status: 500 });
    }
  }

  // 3. QR LPS wajib divalidasi secara server-to-server ke aplikasi LPS
  const lpsIdentity = parseLpsQrToken(rawToken);
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
      if (error instanceof LpsQrError) {
        return NextResponse.json({ error: error.message, burned: error.status === 400 }, { status: error.status });
      }
      console.error("[LPS QR] Tidak dapat menghubungkan master:", error);
      return NextResponse.json(
        { error: "Gagal menghubungkan QR LPS dengan master TimbangQR. Hubungi administrator." },
        { status: 500 },
      );
    }
  }

  // 4. Jalur fallback untuk QR internal TimbangQR, nomor polisi, izin, dan kode armada
  const plateCompact = rawToken.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const vehicle = await dbOne<VehicleRow>([
    "SELECT id, code, plate_number, plate_normalized, vehicle_type, waste_type,",
    "default_tare_kg, qr_token, active FROM vehicles WHERE (",
    "qr_token = $1 OR UPPER(plate_number) = UPPER($1)",
    "OR plate_normalized = $2 OR UPPER(code) = UPPER($1)",
    "OR UPPER(COALESCE(nomor_izin, '')) = UPPER($1)",
    ") AND active = TRUE LIMIT 1",
  ].join(" "), [rawToken, plateCompact]);

  if (!vehicle) {
    return NextResponse.json(
      { error: `QR armada (${rawToken}) tidak ditemukan atau belum terdaftar di sistem timbangan.` },
      { status: 404 }
    );
  }

  const assignments = await dbQuery<AssignmentRow>([
    "SELECT va.id, va.lps_id, l.name AS lps_name, va.driver_name, va.tare_kg, va.is_primary",
    "FROM vehicle_assignments va JOIN lps l ON l.id = va.lps_id",
    "WHERE va.vehicle_id = $1 AND va.active = TRUE",
    "ORDER BY va.is_primary DESC, l.name",
  ].join(" "), [vehicle.id]);

  const lpsOptions = await dbQuery<{ id: number; name: string }>(
    "SELECT id, name FROM lps WHERE active = TRUE ORDER BY name"
  );

  return NextResponse.json({
    vehicle,
    assignments,
    lpsOptions,
    qrToken: rawToken,
  });
}
