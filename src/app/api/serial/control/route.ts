import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { callSerialBridge } from "@/lib/serialBridge";
import { dbOne } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["connect", "disconnect", "activate", "deactivate"]),
  device_code: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const input = schema.parse(body);
    const shouldActivate = input.action === "connect" || input.action === "activate";
    const targetCode = (input.device_code || process.env.SERIAL_DEVICE_ID || "TIMBANG-HJ-SERIAL-01").trim();

    // 1. Update database device status
    let updated = await dbOne<{ id: number; device_code: string; active: boolean }>(`
      UPDATE weighbridge_devices
      SET active = $1
      WHERE device_code = $2
      RETURNING id, device_code, active
    `, [shouldActivate, targetCode]);

    if (!updated) {
      updated = await dbOne<{ id: number; device_code: string; active: boolean }>(`
        UPDATE weighbridge_devices
        SET active = $1
        WHERE id = (
          SELECT id FROM weighbridge_devices
          ORDER BY last_seen_at DESC NULLS LAST, id ASC
          LIMIT 1
        )
        RETURNING id, device_code, active
      `, [shouldActivate]);
    }

    if (!updated && shouldActivate) {
      updated = await dbOne<{ id: number; device_code: string; active: boolean }>(`
        INSERT INTO weighbridge_devices
          (device_code, location_name, api_key_hash, firmware_version, connection_type, port_name, baud_rate, protocol, active, last_seen_at)
        VALUES ($1, 'Transdepo Harapan Jaya', 'default', 'PC-SERIAL-BRIDGE', 'RS232', 'COM1', 9600, 'DIRECT_SERIAL', TRUE, NOW())
        ON CONFLICT (device_code) DO UPDATE SET active = TRUE
        RETURNING id, device_code, active
      `, [targetCode]);
    }

    // 2. If running locally with serial bridge (not cloud/Vercel), also notify local bridge daemon
    try {
      const bridgeMode = (process.env.SERIAL_BRIDGE_MODE || "").trim().toLowerCase();
      const isRemote = bridgeMode === "remote" || Boolean((process.env.VERCEL || "").trim());
      if (!isRemote) {
        await callSerialBridge(shouldActivate ? "/connect" : "/disconnect", { method: "POST", body: "{}" });
      }
    } catch {
      // Ignore local bridge communication error if running in cloud
    }

    return NextResponse.json({
      ok: true,
      action: input.action,
      active: shouldActivate,
      device_code: updated?.device_code || targetCode,
      message: shouldActivate
        ? "Timbangan berhasil diaktifkan. Sinyal pembacaan indikator kembali diterima."
        : "Timbangan berhasil didiskoneksi. Pembacaan otomatis dinonaktifkan.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Aksi kontrol timbangan tidak valid." },
      { status: 400 }
    );
  }
}

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const device = await dbOne<{ id: number; device_code: string; active: boolean; last_seen_at: string | null }>(`
    SELECT id, device_code, active, last_seen_at
    FROM weighbridge_devices
    ORDER BY last_seen_at DESC NULLS LAST, id ASC
    LIMIT 1
  `);

  return NextResponse.json({
    ok: true,
    active: device ? Boolean(device.active) : true,
    device_code: device?.device_code || "TIMBANG-HJ-SERIAL-01",
    last_seen_at: device?.last_seen_at || null,
  });
}
