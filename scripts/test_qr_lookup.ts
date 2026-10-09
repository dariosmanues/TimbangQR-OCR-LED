import { dbOne, closeDatabase } from "../src/lib/db";
import type { VehicleRow } from "../src/lib/types";

async function main() {
  const token = "BM 8106 QP";
  const rawToken = decodeURIComponent(token).trim();
  const plateCompact = rawToken.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const vehicle = await dbOne<VehicleRow>(`
    SELECT id, code, plate_number, plate_normalized, vehicle_type, waste_type,
      default_tare_kg, qr_token, active
    FROM vehicles
    WHERE (
      qr_token = $1
      OR UPPER(plate_number) = UPPER($1)
      OR plate_normalized = $2
      OR UPPER(code) = UPPER($1)
    ) AND active = TRUE
    LIMIT 1
  `, [rawToken, plateCompact]);

  console.log("Found vehicle for token 'BM 8106 QP':", vehicle);
  await closeDatabase();
}

main().catch(console.error);
