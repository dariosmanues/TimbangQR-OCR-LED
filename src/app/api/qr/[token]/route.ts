import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dbOne, dbQuery } from "@/lib/db";
import { tokenFromValue } from "@/lib/qr-token";
import {
  fetchVerifiedLpsArmada,
  linkVerifiedLpsArmada,
  LpsQrError,
  parseLpsQrToken,
} from "@/lib/lps-qr-integration";
import type { AssignmentRow, VehicleRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = await params;

  // Next.js decodes route params. URLs pasted directly into the scan page
  // still need extracting; scanner upload/camera use the same pure parser.
  const rawToken = tokenFromValue(token);
  if (!rawToken || rawToken.length > 512) {
    return NextResponse.json({ error: "Nilai QR kosong atau terlalu panjang." }, { status: 400 });
  }
  if (/^https?:\/\//i.test(rawToken)) {
    return NextResponse.json({
      error: "QR berisi URL yang tidak memiliki parameter kode armada (code/qrCode/token).",
    }, { status: 422 });
  }
  // Never silently downgrade a malformed LPS QR to the legacy vehicle DB.
  // That downgrade previously reported "QR armada tidak valid" with no clue.
  if (/^LPS(?:-|$)/i.test(rawToken) && !parseLpsQrToken(rawToken)) {
    return NextResponse.json({
      error: "Format kode QR LPS tidak dikenali. Pindai ulang QR yang diterbitkan aplikasi LPS.",
    }, { status: 422 });
  }

  // QR LPS wajib divalidasi secara server-to-server, termasuk jika pernah
  // tersimpan di master lokal. QR LPS yang dicabut tidak boleh diterima.
  const lpsIdentity = parseLpsQrToken(rawToken);
  if (lpsIdentity) {
    try {
      const remoteArmada = await fetchVerifiedLpsArmada(lpsIdentity);
      const result = await linkVerifiedLpsArmada(remoteArmada);
      return NextResponse.json(result, {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch (error) {
      if (error instanceof LpsQrError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      console.error("[LPS QR] Tidak dapat menghubungkan master:", error);
      return NextResponse.json(
        { error: "Gagal menghubungkan QR LPS dengan master TimbangQR. Hubungi administrator." },
        { status: 500 },
      );
    }
  }

  // Jalur lama tetap utuh untuk QR internal TimbangQR, nomor polisi, izin
  // dan kode armada yang digunakan sebelum integrasi.
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
    return NextResponse.json({ error: "QR armada tidak valid atau sudah dinonaktifkan." }, { status: 404 });
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

  return NextResponse.json({ vehicle, assignments, lpsOptions });
}
