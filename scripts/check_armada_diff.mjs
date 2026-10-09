import { getPool, closeDatabase } from "../src/lib/db";
import fs from "fs";

async function main() {
  const pool = getPool();
  const octArmada = JSON.parse(fs.readFileSync("data/master_armada_harapan_jaya_okt2026.json", "utf-8"));
  const octPlates = new Set(octArmada.map(a => a.plate_normalized));

  const dbVehicles = (await pool.query("SELECT * FROM vehicles ORDER BY id")).rows;
  console.log(`DB has ${dbVehicles.length} vehicles.`);
  console.log(`Oct list has ${octArmada.length} rows (${octPlates.size} unique plates).`);

  const notInOct = dbVehicles.filter(v => !octPlates.has(v.plate_normalized));
  console.log(`Vehicles in DB but not in Oct list: ${notInOct.length}`);

  for (const v of notInOct) {
    const tx = await pool.query("SELECT count(*)::int as count FROM weighings WHERE vehicle_id = $1", [v.id]);
    console.log(`- ${v.code} | ${v.plate_number} (${v.plate_normalized}): ${tx.rows[0].count} transactions`);
  }

  const notInDb = octArmada.filter(a => !dbVehicles.some(v => v.plate_normalized === a.plate_normalized));
  console.log(`Armada in Oct list but not in DB: ${notInDb.length}`);
  for (const a of notInDb) {
    console.log(`+ No ${a.no} | ${a.nomor_polisi} | ${a.nama_lps} | ${a.wilayah_kerja}`);
  }

  await closeDatabase();
}

main().catch(console.error);
