import test from "node:test";
import assert from "node:assert/strict";
import { tokenFromValue } from "../src/lib/qr-token.ts";

const token = "LPS-BM8081TT-1791568773087";
test("QR asli dari LPS tetap utuh", () => {
  assert.equal(tokenFromValue(token), token);
});
test("QR LPS dalam URL ?code= dapat dibaca", () => {
  assert.equal(tokenFromValue("https://lps-app-iota.vercel.app/api/qr-generator?code=" + token + "&format=svg"), token);
});
test("dukungan ?qrCode, ?text dan ?token", () => {
  assert.equal(tokenFromValue("https://lps-app-iota.vercel.app/api/qr-generator?qrCode=" + token), token);
  assert.equal(tokenFromValue("https://lps-app-iota.vercel.app/api/qr-generator?text=" + token), token);
  assert.equal(tokenFromValue("https://timbangqr-ocr-led.vercel.app/scan?token=LEGACY-QR"), "LEGACY-QR");
});
test("kode URL harus di-decode, bukan pathname generik", () => {
  assert.equal(tokenFromValue("https://lps-app-iota.vercel.app/api/qr-generator?code=BM%208081%20TT"), "BM 8081 TT");
  assert.equal(tokenFromValue("https://lps-app-iota.vercel.app/api/qr-generator"), "https://lps-app-iota.vercel.app/api/qr-generator");
});
test("URL path token, input manual dan nilai kosong", () => {
  assert.equal(tokenFromValue("https://timbangqr-ocr-led.vercel.app/qr/LEGACY-QR-123"), "LEGACY-QR-123");
  assert.equal(tokenFromValue(" BM 8081 TT "), "BM 8081 TT");
  assert.equal(tokenFromValue("\uFEFF" + token + "\n"), token);
  assert.equal(tokenFromValue(""), "");
});
