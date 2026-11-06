import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { callSerialBridge } from "@/lib/serialBridge";
import { dbOne, dbQuery } from "@/lib/db";

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

    // 1. Simpan master switch permanen di tabel settings
    await dbQuery(`
      INSERT INTO settings (key, value)
      VALUES ('scale_active', $1)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [shouldActivate ? "true" : "false"]);

    // 2. Update status active pada semua perangkat timbangan di database
    await dbQuery(`
      UPDATE weighbridge_devices
      SET active = $1
    `, [shouldActivate]);

    // 3. Bersihkan whitespace / trailing newline jika ada pada device_code
    await dbQuery(`
      UPDATE weighbridge_devices
      SET device_code = TRIM(device_code)
      WHERE device_code != TRIM(device_code)
    `);

    // 4. Pastikan perangkat default ada jika aktivasi
    if (shouldActivate) {
      await dbQuery(`
        INSERT INTO weighbridge_devices
          (device_code, location_name, api_key_hash, firmware_version, connection_type, port_name, baud_rate, protocol, active, last_seen_at)
        VALUES ($1, 'Transdepo Harapan Jaya', 'default', 'PC-SERIAL-BRIDGE', 'RS232', 'COM1', 9600, 'DIRECT_SERIAL', TRUE, NOW())
        ON CONFLICT (device_code) DO UPDATE SET active = TRUE
      `, [targetCode]);
    }

    // 5. Notifikasi bridge lokal jika dijalankan di PC lokal (bukan Vercel)
    try {
      const bridgeMode = (process.env.SERIAL_BRIDGE_MODE || "").trim().toLowerCase();
      const isRemote = bridgeMode === "remote" || Boolean((process.env.VERCEL || "").trim());
      if (!isRemote) {
        await callSerialBridge(shouldActivate ? "/connect" : "/disconnect", { method: "POST", body: "{}" });
      }
    } catch {
      // Ignore
    }

    return NextResponse.json({
      ok: true,
      action: input.action,
      active: shouldActivate,
      manuallyDisabled: !shouldActivate,
      device_code: targetCode,
      message: shouldActivate
        ? "Timbangan berhasil diaktifkan kembali. Sinyal bridge diterima."
        : "Timbangan berhasil dinonaktifkan secara manual. Status akan tetap nonaktif sampai diaktifkan kembali oleh operator.",
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

  const scaleSetting = await dbOne<{ value: string }>(`
    SELECT value FROM settings WHERE key = 'scale_active' LIMIT 1
  `);
  const isScaleActive = scaleSetting ? scaleSetting.value !== "false" : true;

  const device = await dbOne<{ id: number; device_code: string; active: boolean; last_seen_at: string | null }>(`
    SELECT id, TRIM(device_code) as device_code, active, last_seen_at
    FROM weighbridge_devices
    ORDER BY last_seen_at DESC NULLS LAST, id ASC
    LIMIT 1
  `);

  return NextResponse.json({
    ok: true,
    active: isScaleActive,
    manuallyDisabled: !isScaleActive,
    device_code: device?.device_code || "TIMBANG-HJ-SERIAL-01",
    last_seen_at: device?.last_seen_at || null,
  });
}
