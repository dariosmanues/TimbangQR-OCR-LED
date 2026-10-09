import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { dbOne } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const vehicle = await dbOne<{ plate_number: string; qr_token: string }>(
    "SELECT plate_number, qr_token FROM vehicles WHERE id = $1 AND active = TRUE",
    [Number(id)]
  );

  if (!vehicle) return new NextResponse("Armada tidak ditemukan", { status: 404 });

  // Gunakan nomor polisi armada sebagai isi QR agar matrix sangat sederhana (Version 1, 21x21)
  // dengan blok modul besar yang cepat terbaca oleh kamera dan scanner.
  const target = vehicle.plate_number;
  const svg = await QRCode.toString(target, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
  });

  return new NextResponse(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "private, max-age=3600",
    },
  });
}
