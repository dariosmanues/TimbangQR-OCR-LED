import { NextResponse } from "next/server";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { dbOne, dbQuery, withTransaction } from "@/lib/db";
import { displayPlate, normalizePlate, toInt } from "@/lib/utils";
import type { VehicleRow } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const vehicleId = Number(id);
  if (isNaN(vehicleId)) {
    return NextResponse.json({ error: "ID armada tidak valid." }, { status: 400 });
  }

  const vehicle = await dbOne<VehicleRow & { primary_lps_id?: number | null; primary_driver_name?: string | null }>(`
    SELECT v.*,
           va.lps_id AS primary_lps_id,
           va.driver_name AS primary_driver_name
    FROM vehicles v
    LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id AND va.is_primary = TRUE AND va.active = TRUE
    WHERE v.id = $1
  `, [vehicleId]);

  if (!vehicle) {
    return NextResponse.json({ error: "Armada tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json(vehicle);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSuperAdmin(user)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Super Administrator yang memiliki izin mengubah data armada." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const vehicleId = Number(id);
  if (isNaN(vehicleId)) {
    return NextResponse.json({ error: "ID armada tidak valid." }, { status: 400 });
  }

  const existing = await dbOne<VehicleRow>(
    "SELECT * FROM vehicles WHERE id = $1",
    [vehicleId]
  );

  if (!existing) {
    return NextResponse.json({ error: "Armada tidak ditemukan." }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Cek apakah ini hanya permintaan toggle status aktif sederhana
    const isOnlyStatusToggle =
      (body.active !== undefined || body.status !== undefined) &&
      !body.plateNumber &&
      !body.vehicleType &&
      body.tareKg === undefined &&
      !body.nomorIzin &&
      !body.namaLps;

    if (isOnlyStatusToggle) {
      let nextActive: boolean | undefined = undefined;
      if (typeof body.active === "boolean") {
        nextActive = body.active;
      } else if (body.status === "active" || body.status === "Aktif") {
        nextActive = true;
      } else if (body.status === "inactive" || body.status === "Nonaktif") {
        nextActive = false;
      }

      if (nextActive === undefined) {
        return NextResponse.json(
          { error: "Field 'active' (boolean) atau 'status' ('active'/'inactive') harus disertakan." },
          { status: 400 }
        );
      }

      const updated = await dbOne<{ id: number; code: string; plate_number: string; active: boolean }>(`
        UPDATE vehicles
        SET active = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, code, plate_number, active
      `, [nextActive, vehicleId]);

      // Audit log
      try {
        await dbQuery(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
          VALUES ($1, $2, 'VEHICLE', $3, $4::jsonb)
        `, [
          user.id,
          nextActive ? "ACTIVATE" : "DEACTIVATE",
          vehicleId,
          JSON.stringify({
            code: existing.code,
            plate_number: existing.plate_number,
            previous_active: existing.active,
            active: nextActive,
          }),
        ]);
      } catch {
        // Non-fatal if audit log fails
      }

      return NextResponse.json({
        ok: true,
        id: updated?.id,
        code: updated?.code,
        plate_number: updated?.plate_number,
        active: updated?.active,
        message: nextActive
          ? `Armada ${updated?.plate_number} berhasil diaktifkan.`
          : `Armada ${updated?.plate_number} berhasil dinonaktifkan.`
      });
    }

    // Full Update logic untuk form edit armada
    const plateNumber = body.plateNumber ? displayPlate(body.plateNumber) : existing.plate_number;
    const normalized = body.plateNumber ? normalizePlate(body.plateNumber) : existing.plate_normalized;
    const vehicleType = body.vehicleType?.trim() || existing.vehicle_type;
    const wasteType = body.wasteType?.trim() || existing.waste_type || "SAMPAH RUMAH TANGGA";

    const tareKg = body.tareKg === "" || body.tareKg === null
      ? null
      : body.tareKg !== undefined
      ? toInt(body.tareKg)
      : existing.default_tare_kg;

    const noUrut = body.noUrut === "" || body.noUrut === null
      ? null
      : body.noUrut !== undefined
      ? toInt(body.noUrut)
      : existing.no_urut;

    const nomorIzin = body.nomorIzin !== undefined ? (body.nomorIzin?.trim() || null) : existing.nomor_izin;
    const namaKetuaLps = body.namaKetuaLps !== undefined ? (body.namaKetuaLps?.trim() || null) : existing.nama_ketua_lps;
    const kelurahanLps = body.kelurahanLps !== undefined ? (body.kelurahanLps?.trim() || null) : existing.kelurahan_lps;
    const kecamatanLps = body.kecamatanLps !== undefined ? (body.kecamatanLps?.trim() || null) : existing.kecamatan_lps;
    const wilayahKerja = body.wilayahKerja !== undefined ? (body.wilayahKerja?.trim() || null) : existing.wilayah_kerja;
    const lokasiTps = body.lokasiTps !== undefined ? (body.lokasiTps?.trim() || "HARAPAN JAYA") : (existing.lokasi_tps || "HARAPAN JAYA");
    const active = typeof body.active === "boolean" ? body.active : existing.active;

    // Resolusi nama LPS
    let resolvedNamaLps = body.namaLps !== undefined ? (body.namaLps?.trim() || null) : existing.nama_lps;
    if (body.lpsId && !resolvedNamaLps) {
      const lpsRow = await dbOne<{ name: string }>("SELECT name FROM lps WHERE id = $1", [body.lpsId]);
      if (lpsRow) resolvedNamaLps = lpsRow.name;
    }

    // Cek duplikasi jika nomor plat berubah
    if (normalized !== existing.plate_normalized) {
      let dupQuery = "SELECT id FROM vehicles WHERE plate_normalized = $1 AND id <> $2";
      const dupParams: unknown[] = [normalized, vehicleId];
      if (nomorIzin) {
        dupQuery += " AND nomor_izin = $3";
        dupParams.push(nomorIzin);
      }
      const duplicate = await dbOne<{ id: number }>(dupQuery, dupParams);
      if (duplicate) {
        return NextResponse.json(
          { error: `Nomor polisi ${plateNumber} sudah digunakan oleh armada lain.` },
          { status: 409 }
        );
      }
    }

    const updated = await withTransaction(async (client) => {
      const updateResult = await client.query<VehicleRow>(`
        UPDATE vehicles SET
          plate_number = $1,
          plate_normalized = $2,
          vehicle_type = $3,
          waste_type = $4,
          default_tare_kg = $5,
          no_urut = $6,
          nomor_izin = $7,
          nama_lps = $8,
          nama_ketua_lps = $9,
          kelurahan_lps = $10,
          kecamatan_lps = $11,
          wilayah_kerja = $12,
          lokasi_tps = $13,
          active = $14,
          updated_at = NOW()
        WHERE id = $15
        RETURNING *
      `, [
        plateNumber,
        normalized,
        vehicleType,
        wasteType,
        tareKg,
        noUrut,
        nomorIzin,
        resolvedNamaLps,
        namaKetuaLps,
        kelurahanLps,
        kecamatanLps,
        wilayahKerja,
        lokasiTps,
        active,
        vehicleId,
      ]);

      // Perbarui penugasan LPS utama di vehicle_assignments jika diberikan lpsId
      if (body.lpsId) {
        const assignCheck = await client.query<{ id: number }>(
          "SELECT id FROM vehicle_assignments WHERE vehicle_id = $1 ORDER BY is_primary DESC, id ASC LIMIT 1",
          [vehicleId]
        );
        if (assignCheck.rows.length > 0) {
          await client.query(`
            UPDATE vehicle_assignments
            SET lps_id = $1, driver_name = $2, tare_kg = $3, is_primary = TRUE, active = TRUE
            WHERE id = $4
          `, [body.lpsId, body.driverName || namaKetuaLps || null, tareKg, assignCheck.rows[0].id]);
        } else {
          await client.query(`
            INSERT INTO vehicle_assignments (vehicle_id, lps_id, driver_name, tare_kg, is_primary, active)
            VALUES ($1, $2, $3, $4, TRUE, TRUE)
          `, [vehicleId, body.lpsId, body.driverName || namaKetuaLps || null, tareKg]);
        }
      }

      // Log audit
      await client.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
        VALUES ($1, 'UPDATE', 'VEHICLE', $2, $3::jsonb, $4::jsonb)
      `, [
        user.id,
        vehicleId,
        JSON.stringify(existing),
        JSON.stringify(updateResult.rows[0]),
      ]);

      return updateResult.rows[0];
    });

    return NextResponse.json({
      ok: true,
      vehicle: updated,
      message: `Data armada ${updated.plate_number} berhasil diperbarui.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memperbarui data armada." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSuperAdmin(user)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Super Administrator yang memiliki izin menghapus data armada." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const vehicleId = Number(id);
  if (isNaN(vehicleId)) {
    return NextResponse.json({ error: "ID armada tidak valid." }, { status: 400 });
  }

  const existing = await dbOne<VehicleRow>(
    "SELECT * FROM vehicles WHERE id = $1",
    [vehicleId]
  );

  if (!existing) {
    return NextResponse.json({ error: "Armada tidak ditemukan." }, { status: 404 });
  }

  // Cek apakah ada transaksi penimbangan yang terkait
  const weighingStats = await dbOne<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM weighings WHERE vehicle_id = $1",
    [vehicleId]
  );
  const count = weighingStats?.count || 0;

  if (count > 0) {
    return NextResponse.json({
      error: `Armada tidak dapat dihapus permanen karena memiliki ${count} riwayat transaksi penimbangan. Anda disarankan menonaktifkan armada ini sebagai gantinya.`,
      hasTransactions: true,
      count,
    }, { status: 409 });
  }

  try {
    await withTransaction(async (client) => {
      // Hapus relasi vehicle_assignments
      await client.query("DELETE FROM vehicle_assignments WHERE vehicle_id = $1", [vehicleId]);

      // Hapus data vehicle
      await client.query("DELETE FROM vehicles WHERE id = $1", [vehicleId]);

      // Log audit
      await client.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data)
        VALUES ($1, 'DELETE', 'VEHICLE', $2, $3::jsonb)
      `, [user.id, vehicleId, JSON.stringify(existing)]);
    });

    return NextResponse.json({
      ok: true,
      message: `Armada ${existing.plate_number} (${existing.code}) berhasil dihapus.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus armada." },
      { status: 500 }
    );
  }
}
