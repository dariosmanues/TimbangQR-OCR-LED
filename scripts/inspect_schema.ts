import { getPool, closeDatabase } from "../src/lib/db";

async function main() {
  const pool = getPool();
  const tables = ['vehicles', 'lps', 'vehicle_assignments'];
  for (const table of tables) {
    const res = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns 
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );
    console.log(`\n=== Table: ${table} ===`);
    console.table(res.rows);
  }
  await closeDatabase();
}

main().catch(console.error);
