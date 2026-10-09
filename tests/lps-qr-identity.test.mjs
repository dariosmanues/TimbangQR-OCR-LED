import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePlate,
  normalizeLpsName,
  parseLpsQrToken,
  verifyLpsArmada,
  LpsQrError,
} from "../src/lib/lps-qr-identity.ts";

const realQr = "LPS-BM8081TT-1791568773087";
const identity = parseLpsQrToken(realQr);
const validBody = {
  success: true,
  valid: true,
  data: {
    id: "armada-legacy-lps",
    platNomor: "BM 8081 TT",
    normalizedPlate: "BM8081TT",
    qrCode: realQr,
    namaLps: "Sejahtera Mandiri",
    namaSupir: "RIAN",
    jenisArmada: "PICKUP",
    isActive: true,
  },
};

test("normalisasi pelat Indonesia dan nama LPS", () => {
  assert.equal(normalizePlate(" bm-8081 tt "), "BM8081TT");
  assert.equal(normalizeLpsName("LPS Sejahtera Mandiri"), "SEJAHTERAMANDIRI");
  assert.equal(normalizeLpsName("Sejahtera-Mandiri"), "SEJAHTERAMANDIRI");
});

test("QR asli BM8081TT dikenali dan token lama tetap lewat jalur existing", () => {
  assert.deepEqual(identity, { token: realQr, normalizedPlate: "BM8081TT" });
  assert.equal(parseLpsQrToken("TQR-QR-OLD-1234"), null);
  assert.equal(parseLpsQrToken("BM 8081 TT"), null);
  assert.equal(parseLpsQrToken("LPS-BM8081TT-wrong"), null);
});

test("hanya respons API LPS yang cocok token, nomor polisi dan status aktif yang diterima", () => {
  assert.ok(identity);
  const result = verifyLpsArmada(identity, validBody);
  assert.equal(result.platNomor, "BM 8081 TT");
  assert.equal(result.namaSupir, "RIAN");
  assert.equal(result.namaLps, "Sejahtera Mandiri");
});

test("QR yang ditebak nomor polisinya tanpa token cocok ditolak", () => {
  assert.ok(identity);
  const spoof = structuredClone(validBody);
  spoof.data.qrCode = "LPS-BM8081TT-0000000000000";
  assert.throws(() => verifyLpsArmada(identity, spoof), (error) => error instanceof LpsQrError && error.status === 422);
});

test("jangan terima QR yang diikat ke nomor polisi lain", () => {
  assert.ok(identity);
  const spoof = structuredClone(validBody);
  spoof.data.platNomor = "BM 8106 QP";
  assert.throws(() => verifyLpsArmada(identity, spoof), (error) => error instanceof LpsQrError && error.status === 422);
});

test("QR dinonaktifkan tidak boleh digunakan", () => {
  assert.ok(identity);
  const inactive = structuredClone(validBody);
  inactive.valid = false;
  inactive.data.isActive = false;
  assert.throws(() => verifyLpsArmada(identity, inactive), (error) => error instanceof LpsQrError && error.status === 404);
});

test("respons API rusak atau informasi LPS kosong ditolak", () => {
  assert.ok(identity);
  assert.throws(() => verifyLpsArmada(identity, null), LpsQrError);
  const bad = structuredClone(validBody);
  bad.data.namaLps = "";
  assert.throws(() => verifyLpsArmada(identity, bad), LpsQrError);
});
