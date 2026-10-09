import fs from "fs";

function updateSeed() {
  const seed = JSON.parse(fs.readFileSync("data/seed.json", "utf-8")) as any;
  const oct = JSON.parse(fs.readFileSync("data/master_armada_harapan_jaya_okt2026.json", "utf-8")) as any[];

  // Check how seed.vehicles can be augmented with the official DLHK data
  const octByPlate = new Map(oct.map((a: any) => [a.plate_normalized, a]));

  for (const v of seed.vehicles) {
    const o = octByPlate.get(v.plateNormalized);
    if (o) {
      v.nomorIzin = o.nomor_izin;
      v.nomorSkLps = o.nomor_sk_lps;
      v.tanggalSkLps = o.tanggal_sk_lps;
      v.namaLps = o.nama_lps;
      v.namaKetuaLps = o.nama_ketua_lps;
      v.alamatLps = o.alamat_lps;
      v.kelurahanLps = o.kelurahan_lps;
      v.kecamatanLps = o.kecamatan_lps;
      v.wilayahKerja = o.wilayah_kerja;
      v.lokasiTps = o.lokasi_tps;
      v.tanggalTerbitIzin = o.tanggal_terbit_izin;
      v.lampiranCamat = o.lampiran_camat;
      v.noUrut = o.no;
      v.active = true;
    } else {
      v.active = false;
    }
  }

  // Also add the 7 new ones from oct if missing
  for (let i = 0; i < oct.length; i++) {
    const o = oct[i];
    const exists = seed.vehicles.some((v: any) => v.plateNormalized === o.plate_normalized);
    if (!exists) {
      seed.vehicles.push({
        code: `ARM-HJ-${String(seed.vehicles.length + 1).padStart(4, "0")}`,
        plateNumber: o.nomor_polisi,
        plateNormalized: o.plate_normalized,
        vehicleType: o.jenis_armada,
        wasteType: "SAMPAH RUMAH TANGGA",
        defaultTareKg: null,
        qrToken: `hj-qr-${o.plate_normalized}-${o.no}`,
        active: true,
        nomorIzin: o.nomor_izin,
        nomorSkLps: o.nomor_sk_lps,
        tanggalSkLps: o.tanggal_sk_lps,
        namaLps: o.nama_lps,
        namaKetuaLps: o.nama_ketua_lps,
        alamatLps: o.alamat_lps,
        kelurahanLps: o.kelurahan_lps,
        kecamatanLps: o.kecamatan_lps,
        wilayahKerja: o.wilayah_kerja,
        lokasiTps: o.lokasi_tps,
        tanggalTerbitIzin: o.tanggal_terbit_izin,
        lampiranCamat: o.lampiran_camat,
        noUrut: o.no
      });
    }
  }

  seed.meta.harapanJayaActiveVehicleCount = 68;
  seed.meta.updatedAt = new Date().toISOString();
  seed.meta.updateNote = "Master Armada disesuaikan dengan Update Armada Oktober 2026 TPS Wilayah Harapan Jaya (68 armada)";

  fs.writeFileSync("data/seed.json", JSON.stringify(seed, null, 2), "utf-8");
  console.log("data/seed.json updated successfully.");
}

updateSeed();
