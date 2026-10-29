import test from "node:test";
import assert from "node:assert/strict";
import { findVehicleByPlate, normalizePlateForLookup } from "../src/lib/vehicle-selection.ts";

const vehicles = [
  { id: 21, plate_number: "BM 8081 QQ" },
  { id: 22, plate_number: "BM 8211 TN" },
];

test("normalisasi plat untuk input transaksi manual", () => {
  assert.equal(normalizePlateForLookup("bm-8081 qq"), "BM8081QQ");
});

test("input plat manual hanya memilih armada yang cocok", () => {
  assert.equal(findVehicleByPlate("BM8081QQ", vehicles)?.id, 21);
  assert.equal(findVehicleByPlate("BM 8211 TN", vehicles)?.id, 22);
  assert.equal(findVehicleByPlate("BM 9999 ZZ", vehicles), null);
});
