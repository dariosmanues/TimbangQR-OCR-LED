import { listVehicles } from "../src/lib/queries";
import { closeDatabase } from "../src/lib/db";

async function main() {
  const activeVehicles = await listVehicles("", "active");
  console.log(`Active vehicles count: ${activeVehicles.length}`);
  console.log("First 3 active:");
  for (const v of activeVehicles.slice(0, 3)) {
    console.log(`- ${v.no_urut} | ${v.code} | ${v.plate_number} | ${v.nomor_izin} | ${v.nama_lps} | ${v.wilayah_kerja}`);
  }
  console.log("Last 3 active:");
  for (const v of activeVehicles.slice(-3)) {
    console.log(`- ${v.no_urut} | ${v.code} | ${v.plate_number} | ${v.nomor_izin} | ${v.nama_lps} | ${v.wilayah_kerja}`);
  }

  const allVehicles = await listVehicles("", "all");
  console.log(`Total all vehicles (with history): ${allVehicles.length}`);
  await closeDatabase();
}

main().catch(console.error);
