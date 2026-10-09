import { getPool, closeDatabase } from "../src/lib/db";
import fs from "fs";

async function main() {
  const pool = getPool();
  const octArmada = JSON.parse(fs.readFileSync("data/master_armada_harapan_jaya_okt2026.json", "utf-8"));
  
  const vRows = (await pool.query("SELECT * FROM vehicles")).rows;
  const vMap = new Map(vRows.map(v => [v.plate_normalized, v]));

  let withTare = 0;
  let withoutTare = 0;
  for (const a of octArmada) {
    const existing = vMap.get(a.plate_normalized);
    if (existing && existing.default_tare_kg) {
      withTare++;
    } else {
      withoutTare++;
      console.log(`No tare for No ${a.no} | ${a.nomor_polisi}`);
    }
  }

  console.log(`With tare: ${withTare}, without tare: ${withoutTare}`);
  await closeDatabase();
}

main().catch(console.error);
