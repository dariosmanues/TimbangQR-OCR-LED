import { getPool, closeDatabase } from "../src/lib/db";

async function main() {
  const pool = getPool();
  const res = await pool.query('SELECT id, code, name FROM lps ORDER BY name');
  console.log(`Total LPS in DB: ${res.rows.length}`);
  console.table(res.rows);
  await closeDatabase();
}

main().catch(console.error);
