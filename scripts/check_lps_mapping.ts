import { getPool, closeDatabase } from "../src/lib/db";
import fs from "fs";

async function main() {
  const pool = getPool();
  const octArmada = JSON.parse(fs.readFileSync("data/master_armada_harapan_jaya_okt2026.json", "utf-8"));
  const lpsRows = (await pool.query("SELECT id, code, name FROM lps")).rows;
  const lpsMap = new Map();
  for (const l of lpsRows) {
    lpsMap.set(l.name.toUpperCase().trim(), l);
    lpsMap.set(l.name.toUpperCase().replace(/^LPS\s+/, '').trim(), l);
    lpsMap.set(l.code.toUpperCase().trim(), l);
  }

  let matched = 0;
  for (const a of octArmada) {
    const kel = (a.kelurahan_lps || '').toUpperCase().trim();
    const nama = (a.nama_lps || '').toUpperCase().trim();
    const match = lpsMap.get(nama) || lpsMap.get(`LPS ${nama}`) || lpsMap.get(kel) || lpsMap.get(`LPS ${kel}`);
    if (match) {
      matched++;
    } else {
      console.log(`Failed to match: nama='${a.nama_lps}', kel='${a.kelurahan_lps}'`);
    }
  }

  console.log(`Matched ${matched} of ${octArmada.length} rows.`);
  await closeDatabase();
}

main().catch(console.error);
