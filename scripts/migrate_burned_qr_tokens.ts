import { getPool, closeDatabase } from "../src/lib/db";

async function main() {
  const pool = getPool();
  console.log("Migrating TimbangQR Neon database for burned QR tokens...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS burned_qr_tokens (
      qr_token VARCHAR(255) PRIMARY KEY,
      plate_number VARCHAR(50) NOT NULL,
      ticket_number VARCHAR(100),
      vehicle_id INTEGER,
      burned_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("Table burned_qr_tokens created or verified.");

  await pool.query(`
    ALTER TABLE weighings ADD COLUMN IF NOT EXISTS qr_token VARCHAR(255);
  `);
  console.log("Column qr_token added to weighings table.");

  await closeDatabase();
  console.log("Done!");
}

main().catch(console.error);
