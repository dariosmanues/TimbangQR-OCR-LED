import { getPool, closeDatabase } from "../src/lib/db";
import fs from "fs";

async function main() {
  const pool = getPool();
  const octArmada = JSON.parse(fs.readFileSync("data/master_armada_harapan_jaya_okt2026.json", "utf-8"));
  
  // Existing vehicles
  const dbVehicles = (await pool.query("SELECT * FROM vehicles")).rows;
  const dbByPlate = new Map();
  for (const v of dbVehicles) {
    dbByPlate.set(v.plate_normalized, v);
  }

  // Existing assignments with driver_name & tare
  const assignRows = (await pool.query(`
    SELECT va.*, l.name as lps_name, v.plate_normalized
    FROM vehicle_assignments va
    JOIN vehicles v ON v.id = va.vehicle_id
    JOIN lps l ON l.id = va.lps_id
  `)).rows;

  console.log(`Loaded ${dbVehicles.length} db vehicles and ${assignRows.length} assignments.`);

  // Let's inspect how each of the 68 Oct armada matches
  for (let i = 0; i < octArmada.length; i++) {
    const item = octArmada[i];
    const existingV = dbByPlate.get(item.plate_normalized);
    const existingAssign = assignRows.find((a: any) => a.plate_normalized === item.plate_normalized);
    
    // Check code
    const code = existingV ? existingV.code : `ARM-HJ-${String(i + 1).padStart(4, "0")}`;
    const tare = existingV?.default_tare_kg || existingAssign?.tare_kg || null;
    const driver = existingAssign?.driver_name || null;

    if (!existingV) {
      console.log(`NEW: No ${item.no} | ${item.nomor_polisi} | ${item.nama_lps} | will be ${code}`);
    }
  }

  await closeDatabase();
}

main().catch(console.error);
