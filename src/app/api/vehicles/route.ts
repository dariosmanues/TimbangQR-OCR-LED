import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { dbOne, dbQuery, withTransaction } from "@/lib/db";
import { displayPlate, normalizePlate, toInt } from "@/lib/utils";
import type { VehicleRow } from "@/lib/types";

export const runtime = "nodejs";
const createSchema = z.object({
  plateNumber: z.string().min(3, "Nomor polisi minimal 3 karakter"),
  driverName: z.string().optional().default(""),
  vehicleType: z.string().min(1).default("PICKUP"),
  wasteType: z.string().min(1).default("SAMPAH RUMAH TANGGA"),
  tareKg: z.union([z.string(), z.number()]).optional().nullable(),
  lpsId: z.preprocess(
    (value) => value === "" || value == null ? undefined : value,
    z.coerce.number().int().positive().optional().nullable()
  ),
  nomorIzin: z.string().optional().nullable(),
  noUrut: z.preprocess(
    (value) => value === "" || value == null ? undefined : value,
    z.coerce.number().int().optional().nullable()
  ),
  namaLps: z.string().optional().nullable(),
  namaKetuaLps: z.string().optional().nullable(),
  kelurahanLps: z.string().optional().nullable(),
  kecamatanLps: z.string().optional().nullable(),
  wilayahKerja: z.string().optional().nullable(),
  lokasiTps: z.string().optional().default("HARAPAN JAYA"),
  active: z.boolean().optional().default(true),
});

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const q = `%${url.searchParams.get("q") || ""}%`;
  const rows = await dbQuery<VehicleRow>(`
    SELECT id, code, plate_number, plate_normalized, vehicle_type, waste_type,
      default_tare_kg, qr_token, active, no_urut, nomor_izin, nama_lps,
      kelurahan_lps, kecamatan_lps, wilayah_kerja, lokasi_tps
    FROM vehicles
    WHERE plate_number ILIKE $1 OR code ILIKE $1 OR nomor_izin ILIKE $1 OR nama_lps ILIKE $1
    ORDER BY no_urut ASC NULLS LAST, plate_normalized
  `, [q]);
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSuperAdmin(user)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Super Administrator yang memiliki izin menambah armada." },
      { status: 403 }
    );
  }

  try {
    const input = createSchema.parse(await request.json());
    const normalized = normalizePlate(input.plateNumber);
    const plateNumber = displayPlate(input.plateNumber);

    // Cek duplikasi armada
    let existingQuery = "SELECT id FROM vehicles WHERE plate_normalized = $1";
    const existingParams: unknown[] = [normalized];
    if (input.nomorIzin && input.nomorIzin.trim()) {
      existingQuery += " AND nomor_izin = $2";
      existingParams.push(input.nomorIzin.trim());
    }
    const existing = await dbOne<{ id: number }>(existingQuery, existingParams);
    if (existing) {
      return NextResponse.json(
        { error: `Armada dengan nomor polisi ${plateNumber} sudah terdaftar.` },
        { status: 409 }
      );
    }

    let resolvedNamaLps = input.namaLps?.trim() || null;
    if (input.lpsId && !resolvedNamaLps) {
      const lpsRow = await dbOne<{ name: string }>("SELECT name FROM lps WHERE id = $1", [input.lpsId]);
      if (lpsRow) resolvedNamaLps = lpsRow.name;
    }

    const tareKg = input.tareKg === "" || input.tareKg == null ? null : toInt(input.tareKg);

    const result = await withTransaction(async (client) => {
      // Menjaga pembuatan kode armada tetap unik
      await client.query("SELECT pg_advisory_xact_lock($1)", [903202609]);

      const maxCodeResult = await client.query<{ max_code: string | null }>(
        "SELECT MAX(code) AS max_code FROM vehicles WHERE code LIKE 'ARM-HJ-%'"
      );
      let nextSeq = 1;
      if (maxCodeResult.rows[0]?.max_code) {
        const match = maxCodeResult.rows[0].max_code.match(/ARM-HJ-(\d+)/);
        if (match) {
          nextSeq = parseInt(match[1], 10) + 1;
        }
      }
      const code = `ARM-HJ-${String(nextSeq).padStart(4, "0")}`;

      const baseToken = `ARMADA-${normalized}`;
      const tokenExists = await client.query("SELECT id FROM vehicles WHERE qr_token = $1", [baseToken]);
      const qrToken = tokenExists.rows.length === 0 ? baseToken : `${baseToken}-${nextSeq}`;

      const inserted = await client.query<{ id: number }>(`
        INSERT INTO vehicles (
          code, plate_number, plate_normalized, vehicle_type, waste_type,
          default_tare_kg, qr_token, active, no_urut, nomor_izin,
          nama_lps, nama_ketua_lps, kelurahan_lps, kecamatan_lps,
          wilayah_kerja, lokasi_tps
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING id
      `, [
        code,
        plateNumber,
        normalized,
        input.vehicleType,
        input.wasteType,
        tareKg,
        qrToken,
        input.active ?? true,
        input.noUrut ?? null,
        input.nomorIzin?.trim() || null,
        resolvedNamaLps,
        input.namaKetuaLps?.trim() || null,
        input.kelurahanLps?.trim() || null,
        input.kecamatanLps?.trim() || null,
        input.wilayahKerja?.trim() || null,
        input.lokasiTps?.trim() || "HARAPAN JAYA",
      ]);
      const id = inserted.rows[0].id;

      if (input.lpsId) {
        await client.query(`
          INSERT INTO vehicle_assignments (vehicle_id, lps_id, driver_name, tare_kg, is_primary, active)
          VALUES ($1, $2, $3, $4, TRUE, TRUE)
        `, [id, input.lpsId, input.driverName || input.namaKetuaLps || null, tareKg]);
      }

      await client.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
        VALUES ($1, 'CREATE', 'VEHICLE', $2, $3::jsonb)
      `, [user.id, id, JSON.stringify({
        code,
        plateNumber,
        normalized,
        tareKg,
        namaLps: resolvedNamaLps,
      })]);

      return { id, code, plateNumber };
    });

    return NextResponse.json({
      ok: true,
      id: result.id,
      code: result.code,
      plateNumber: result.plateNumber,
      message: `Armada ${result.plateNumber} (${result.code}) berhasil ditambahkan.`,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Data armada tidak valid.",
    }, { status: 400 });
  }
}
