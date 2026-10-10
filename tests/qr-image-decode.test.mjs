import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import { decodeQrRgba } from "../src/lib/qr-image-decode.ts";

const fleet = JSON.parse(await fs.readFile(
  new URL("../data/master_armada_harapan_jaya_okt2026.json", import.meta.url), "utf8"
));

async function qrPixels(value, size = 250) {
  const png = await QRCode.toBuffer(value, {
    errorCorrectionLevel: "H", width: size, margin: 4, type: "png"
  });
  const image = PNG.sync.read(png);
  return {
    data: new Uint8ClampedArray(image.data),
    width: image.width,
    height: image.height,
  };
}

test("semua 68 gambar QR ARMADA Harapan Jaya terbaca langsung dari pixel PNG", async () => {
  assert.equal(fleet.length, 68);
  let checked = 0;
  for (const row of fleet) {
    const raw = "ARMADA-" + row.plate_normalized;
    const { data, width, height } = await qrPixels(raw);
    assert.equal(decodeQrRgba(data, width, height), raw,
      "QR image could not be decoded for " + row.nomor_polisi + " / " + row.nama_lps);
    checked++;
  }
  assert.equal(checked, 68);
});

test("gambar QR asli BM 8204 MS dengan ukuran tampilan 250 piksel bisa diproses", async () => {
  const { data, width, height } = await qrPixels("ARMADA-BM8204MS", 250);
  assert.equal(decodeQrRgba(data, width, height), "ARMADA-BM8204MS");
});

test("QR LPS hasil Generate Ulang dapat dibaca untuk semua kendaraan", async () => {
  for (const row of fleet) {
    const code = "LPS-" + row.plate_normalized + "-17915687739990001";
    const { data, width, height } = await qrPixels(code, 250);
    assert.equal(decodeQrRgba(data, width, height), code,
      "New LPS QR image failed for " + row.nomor_polisi);
  }
});

test("gambar kosong atau dimensi tidak sesuai ditolak", () => {
  assert.equal(decodeQrRgba(new Uint8ClampedArray(0), 0, 0), null);
  assert.equal(decodeQrRgba(new Uint8ClampedArray(250 * 250 * 4), 249, 250), null);
});
