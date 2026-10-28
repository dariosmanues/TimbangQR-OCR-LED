import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { dbOne, withTransaction } from "@/lib/db";
import { syncCompletedWeighingToLps, deleteWeighingFromLps } from "@/lib/lps-sync";
import type { WeighingRow } from "@/lib/types";

export const runtime = "nodejs";

const patchSchema = z.object({
  vehicleId: z.coerce.number().int().positive().optional().nullable(),
  plateNumber: z.string().min(1).max(20).optional(),
  driverName: z.string().max(100).optional().nullable(),
  lpsId: z.coerce.number().int().positive().optional().nullable(),
  lpsName: z.string().min(1).max(150).optional(),
  vehicleType: z.string().max(50).optional(),
  wasteType: z.string().max(100).optional(),
  grossKg: z.coerce.number().int().positive(),
  tareKg: z.coerce.number().int().nonnegative(),
  rafaksiKg: z.coerce.number().int().nonnegative().default(0),
  tareSource: z.enum(["DATABASE", "ACTUAL_WEIGHING", "MANUAL"]).default("DATABASE"),
  status: z.enum(["COMPLETED", "CANCELLED", "PENDING"]).default("COMPLETED"),
  weighedAt: z.string().optional(),
  sourceNote: z.string().max(500).optional().nullable(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const weighingId = Number(id);
  if (isNaN(weighingId)) {
    return NextResponse.json({ error: "ID transaksi tidak valid." }, { status: 400 });
  }

  const row = await dbOne<WeighingRow & Record<string, unknown>>(`
    SELECT w.*, d.device_code
    FROM weighings w
    LEFT JOIN weighbridge_devices d ON d.id = w.device_id
    WHERE w.id = $1
  `, [weighingId]);

  if (!row) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSuperAdmin(user)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Super Administrator yang memiliki izin mengubah data transaksi." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const weighingId = Number(id);
  if (isNaN(weighingId)) {
    return NextResponse.json({ error: "ID transaksi tidak valid." }, { status: 400 });
  }

  const existing = await dbOne<Record<string, unknown>>(
    "SELECT * FROM weighings WHERE id = $1",
    [weighingId]
  );
  if (!existing) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
  }

  try {
    const input = patchSchema.parse(await request.json());

    if (input.grossKg <= input.tareKg) {
      return NextResponse.json(
        { error: "Berat kotor (Gross) harus lebih besar daripada berat kosong (Tare)." },
        { status: 400 }
      );
    }

    const netto1 = input.grossKg - input.tareKg;
    const netto2 = netto1 - input.rafaksiKg;
    if (netto2 <= 0) {
      return NextResponse.json(
        { error: "Berat bersih (Netto 2) harus lebih besar dari 0 kg." },
        { status: 400 }
      );
    }

    // Resolve vehicle details if vehicleId provided
    let plateNumber = input.plateNumber?.trim() || String(existing.plate_number);
    let vehicleType = input.vehicleType?.trim() || String(existing.vehicle_type);
    let wasteType = input.wasteType?.trim() || String(existing.waste_type);

    if (input.vehicleId && input.vehicleId !== existing.vehicle_id) {
      const v = await dbOne<{ plate_number: string; vehicle_type: string; waste_type: string }>(
        "SELECT plate_number, vehicle_type, waste_type FROM vehicles WHERE id = $1",
        [input.vehicleId]
      );
      if (v) {
        plateNumber = input.plateNumber?.trim() || v.plate_number;
        vehicleType = input.vehicleType?.trim() || v.vehicle_type;
        wasteType = input.wasteType?.trim() || v.waste_type;
      }
    }

    // Resolve LPS details if lpsId provided
    let lpsName = input.lpsName?.trim() || String(existing.lps_name);
    if (input.lpsId && input.lpsId !== existing.lps_id) {
      const l = await dbOne<{ name: string }>(
        "SELECT name FROM lps WHERE id = $1",
        [input.lpsId]
      );
      if (l) {
        lpsName = input.lpsName?.trim() || l.name;
      }
    }

    const weighedAt = input.weighedAt && !isNaN(new Date(input.weighedAt).getTime())
      ? new Date(input.weighedAt).toISOString()
      : String(existing.weighed_at);

    const updated = await withTransaction(async (client) => {
      const updateResult = await client.query<WeighingRow>(`
        UPDATE weighings
        SET
          vehicle_id = COALESCE($1, vehicle_id),
          plate_number = $2,
          driver_name = $3,
          vehicle_type = $4,
          lps_id = COALESCE($5, lps_id),
          lps_name = $6,
          waste_type = $7,
          gross_kg = $8,
          tare_kg = $9,
          netto_1_kg = $10,
          rafaksi_kg = $11,
          netto_2_kg = $12,
          tare_source = $13,
          status = $14,
          weighed_at = $15::timestamptz,
          source_note = COALESCE($16, source_note),
          updated_at = NOW()
        WHERE id = $17
        RETURNING *
      `, [
        input.vehicleId ?? null,
        plateNumber,
        input.driverName ?? null,
        vehicleType,
        input.lpsId ?? null,
        lpsName,
        wasteType,
        input.grossKg,
        input.tareKg,
        netto1,
        input.rafaksiKg,
        netto2,
        input.tareSource,
        input.status,
        weighedAt,
        input.sourceNote ?? null,
        weighingId,
      ]);

      const newRow = updateResult.rows[0];

      await client.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
        VALUES ($1, 'UPDATE', 'WEIGHING', $2, $3::jsonb, $4::jsonb)
      `, [
        user.id,
        weighingId,
        JSON.stringify(existing),
        JSON.stringify(newRow),
      ]);

      return newRow;
    });

    // Real-time sinkronisasi pembaruan transaksi ke Dashboard LPS
    try {
      await syncCompletedWeighingToLps({
        ticketNumber: String(updated.ticket_number),
        plateNumber: String(updated.plate_number),
        lpsName: String(updated.lps_name),
        transdepo: process.env.LPS_TRANSDEPO || "HARAPAN_JAYA",
        weighedAt: String(updated.weighed_at),
        grossKg: Number(updated.gross_kg),
        tareKg: Number(updated.tare_kg),
        rafaksiKg: Number(updated.rafaksi_kg || 0),
        nettoKg: Number(updated.netto_2_kg),
        driverName: updated.driver_name ? String(updated.driver_name) : undefined,
        vehicleType: String(updated.vehicle_type),
        wasteType: String(updated.waste_type),
      });
    } catch (syncErr) {
      console.error("[Weighings Update] LPS sync error:", syncErr);
    }

    revalidatePath("/dashboard");
    revalidatePath("/transaksi");
    revalidatePath(`/transaksi/${weighingId}`);
    revalidatePath("/laporan");

    return NextResponse.json({
      ok: true,
      message: "Data transaksi berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Format data tidak valid." }, { status: 400 });
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Gagal memperbarui transaksi.",
    }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSuperAdmin(user)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Super Administrator yang memiliki izin menghapus data transaksi." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const weighingId = Number(id);
  if (isNaN(weighingId)) {
    return NextResponse.json({ error: "ID transaksi tidak valid." }, { status: 400 });
  }

  const existing = await dbOne<Record<string, unknown>>(
    "SELECT * FROM weighings WHERE id = $1",
    [weighingId]
  );
  if (!existing) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
  }

  try {
    await withTransaction(async (client) => {
      // Jika transaksi memiliki tiket_number di burned_qr_tokens, hapus agar QR slip bisa dipulihkan jika perlu
      if (existing.ticket_number) {
        try {
          await client.query(
            "DELETE FROM burned_qr_tokens WHERE ticket_number = $1",
            [existing.ticket_number]
          );
        } catch (e) {
          console.warn("[Weighings Delete] Gagal membersihkan burned_qr_tokens:", e);
        }
      }

      await client.query("DELETE FROM weighings WHERE id = $1", [weighingId]);

      await client.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
        VALUES ($1, 'DELETE', 'WEIGHING', $2, $3::jsonb, $4::jsonb)
      `, [
        user.id,
        weighingId,
        JSON.stringify(existing),
        JSON.stringify({ deleted_at: new Date().toISOString(), deleted_by: user.name }),
      ]);
    });

    // Real-time sinkronisasi penghapusan transaksi ke Dashboard LPS
    if (existing.ticket_number) {
      try {
        await deleteWeighingFromLps(String(existing.ticket_number));
      } catch (syncErr) {
        console.error("[Weighings Delete] LPS sync delete error:", syncErr);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/transaksi");
    revalidatePath("/laporan");

    return NextResponse.json({
      ok: true,
      message: `Transaksi dengan nomor tiket ${existing.ticket_number} berhasil dihapus.`,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Gagal menghapus transaksi.",
    }, { status: 500 });
  }
}
