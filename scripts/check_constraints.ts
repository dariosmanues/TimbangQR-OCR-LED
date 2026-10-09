import { getPool, closeDatabase } from "../src/lib/db";

async function main() {
  const pool = getPool();
  const res = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'vehicles'::regclass
  `);
  console.table(res.rows);
  await closeDatabase();
}

main().catch(console.error);
