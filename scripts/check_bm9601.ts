import { getPool, closeDatabase } from "../src/lib/db";

async function main() {
  const pool = getPool();
  const res = await pool.query("SELECT * FROM vehicles WHERE plate_normalized = 'BM9601TZ'");
  console.log("BM9601TZ in DB:", res.rows);
  if (res.rows[0]) {
    const a = await pool.query(
      "SELECT va.*, l.name as lps_name FROM vehicle_assignments va JOIN lps l ON l.id = va.lps_id WHERE va.vehicle_id = $1",
      [res.rows[0].id]
    );
    console.log("Assignments in DB:", a.rows);
  }
  await closeDatabase();
}

main().catch(console.error);
