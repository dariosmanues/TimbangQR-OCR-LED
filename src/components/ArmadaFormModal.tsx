"use client";

import { useState } from "react";
import { X, Truck, Save, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import type { VehicleRow } from "@/lib/types";
import type { VehicleCardData } from "@/lib/qr-card-canvas";

interface ArmadaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  vehicle?: VehicleRow | VehicleCardData | null;
  lpsOptions: Array<{ id: number; name: string }>;
  onSuccess?: () => void;
}

export default function ArmadaFormModal({
  isOpen,
  onClose,
  mode,
  vehicle,
  lpsOptions,
  onSuccess,
}: ArmadaFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  // The modal is mounted only while open. Initialising from its inputs keeps a
  // freshly opened form in sync without cascading state updates in an effect.
  const editVehicle = mode === "edit" ? vehicle : null;
  const matchedLps = editVehicle
    ? lpsOptions.find(
        (lps) => lps.name.toLowerCase().trim() === (editVehicle.nama_lps || "").toLowerCase().trim()
      )
    : null;
  const [plateNumber, setPlateNumber] = useState(() => editVehicle?.plate_number || "");
  const [vehicleType, setVehicleType] = useState(() => editVehicle?.vehicle_type || "PICKUP");
  const [tareKg, setTareKg] = useState<string>(() =>
    editVehicle?.default_tare_kg != null ? String(editVehicle.default_tare_kg) : ""
  );
  const [wasteType, setWasteType] = useState(() => editVehicle?.waste_type || "SAMPAH RUMAH TANGGA");
  const [active, setActive] = useState(() => editVehicle?.active ?? true);

  const [lpsId, setLpsId] = useState<string>(() => (matchedLps ? String(matchedLps.id) : ""));
  const [namaLps, setNamaLps] = useState(() => editVehicle?.nama_lps || editVehicle?.lps_names || "");
  const [driverName, setDriverName] = useState("");
  const [namaKetuaLps, setNamaKetuaLps] = useState(() => editVehicle?.nama_ketua_lps || "");

  const [nomorIzin, setNomorIzin] = useState(() => editVehicle?.nomor_izin || "");
  const [noUrut, setNoUrut] = useState<string>(() =>
    editVehicle?.no_urut != null ? String(editVehicle.no_urut) : ""
  );
  const [kelurahanLps, setKelurahanLps] = useState(() => editVehicle?.kelurahan_lps || "");
  const [kecamatanLps, setKecamatanLps] = useState(() =>
    editVehicle?.kecamatan_lps || editVehicle?.kecamatan || ""
  );
  const [wilayahKerja, setWilayahKerja] = useState(() => editVehicle?.wilayah_kerja || "");
  const [lokasiTps, setLokasiTps] = useState(() => editVehicle?.lokasi_tps || "HARAPAN JAYA");

  if (!isOpen) return null;

  function handleLpsSelect(selectedId: string) {
    setLpsId(selectedId);
    if (!selectedId) return;
    const found = lpsOptions.find((l) => String(l.id) === selectedId);
    if (found) {
      setNamaLps(found.name);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      plateNumber: plateNumber.trim().toUpperCase(),
      vehicleType,
      wasteType,
      tareKg: tareKg.trim() !== "" ? Number(tareKg) : null,
      lpsId: lpsId ? Number(lpsId) : undefined,
      namaLps: namaLps.trim() || undefined,
      driverName: driverName.trim() || undefined,
      namaKetuaLps: namaKetuaLps.trim() || undefined,
      nomorIzin: nomorIzin.trim() || undefined,
      noUrut: noUrut.trim() !== "" ? Number(noUrut) : null,
      kelurahanLps: kelurahanLps.trim() || undefined,
      kecamatanLps: kecamatanLps.trim() || undefined,
      wilayahKerja: wilayahKerja.trim() || undefined,
      lokasiTps: lokasiTps.trim() || "HARAPAN JAYA",
      active,
    };

    try {
      const url = mode === "edit" && vehicle?.id ? `/api/vehicles/${vehicle.id}` : "/api/vehicles";
      const method = mode === "edit" ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan data armada.");
      }

      setSuccessMsg(data.message || (mode === "edit" ? "Data berhasil diperbarui." : "Armada berhasil dibuat."));
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(10, 25, 18, 0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          maxWidth: "760px",
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.45)",
          border: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(180deg, #ffffff 0%, #f8faf9 100%)",
            borderTopLeftRadius: "20px",
            borderTopRightRadius: "20px",
          }}
        >
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span className="badge green" style={{ fontSize: 11 }}>
                <ShieldCheck size={12} /> TPS HARAPAN JAYA
              </span>
              <span className="badge" style={{ fontSize: 11 }}>
                {mode === "edit" ? "MODE EDIT ARMADA" : "TAMBAH ARMADA BARU"}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: "19px", color: "var(--text)" }}>
              {mode === "edit" ? (
                <>
                  Edit Armada: <span style={{ color: "var(--primary)" }}>{vehicle?.plate_number}</span> ({vehicle?.code})
                </>
              ) : (
                "Registrasi Armada Baru"
              )}
            </h2>
            <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "12px" }}>
              {mode === "edit"
                ? "Perbarui spesifikasi teknis, tare acuan, data perizinan, atau pengelola LPS."
                : "Nomor kode armada dan token QR resmi akan di-generate otomatis."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ width: 34, height: 34, padding: 0, borderRadius: "50%" }}
            title="Tutup Modal"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", display: "grid", gap: "18px" }}>
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                backgroundColor: "#fff0f0",
                color: "var(--danger)",
                borderRadius: "10px",
                border: "1px solid #fed7d7",
                fontSize: "13px",
              }}
            >
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                backgroundColor: "var(--primary-soft)",
                color: "var(--primary)",
                borderRadius: "10px",
                border: "1px solid #bbf7d0",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={17} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Bagian 1: Identitas Armada & Status */}
          <div
            style={{
              background: "var(--surface-2)",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
            }}
          >
            <h4 style={{ margin: "0 0 12px", fontSize: 13, textTransform: "uppercase", color: "var(--primary)", letterSpacing: "0.05em" }}>
              1. Identitas Kendaraan & Spesifikasi
            </h4>
            <div className="form-row">
              <div className="field">
                <label>Nomor Polisi (Plat) *</label>
                <input
                  className="input"
                  style={{ textTransform: "uppercase", fontWeight: 700 }}
                  placeholder="Contoh: BM 8123 AQ"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="field">
                <label>Jenis Kendaraan</label>
                <select
                  className="select"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                >
                  <option value="PICKUP">PICKUP</option>
                  <option value="DUMP TRUCK">DUMP TRUCK</option>
                  <option value="TRUK">TRUK</option>
                  <option value="MOTOR RODA 3">MOTOR RODA 3</option>
                  <option value="LAINNYA">LAINNYA</option>
                </select>
              </div>

              <div className="field">
                <label>Tare Acuan (kg)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  placeholder="Contoh: 1200"
                  value={tareKg}
                  onChange={(e) => setTareKg(e.target.value)}
                />
                <span className="help" style={{ fontSize: 11 }}>Berat kosong kendaraan standar jembatan timbang.</span>
              </div>

              <div className="field">
                <label>Status Operasional</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, height: 44 }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: "var(--primary)" }}
                    />
                    <span className={active ? "badge green" : "badge red"}>
                      {active ? "Armada Aktif" : "Nonaktif / Ditangguhkan"}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Bagian 2: Pengelola LPS & Wilayah Penugasan */}
          <div
            style={{
              background: "var(--surface-2)",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
            }}
          >
            <h4 style={{ margin: "0 0 12px", fontSize: 13, textTransform: "uppercase", color: "var(--primary)", letterSpacing: "0.05em" }}>
              2. Pengelola LPS & Wilayah Penugasan
            </h4>
            <div className="form-row">
              <div className="field">
                <label>Pilih LPS Terdaftar</label>
                <select
                  className="select"
                  value={lpsId}
                  onChange={(e) => handleLpsSelect(e.target.value)}
                >
                  <option value="">-- Pilih dari database LPS --</option>
                  {lpsOptions.map((lps) => (
                    <option key={lps.id} value={lps.id}>
                      {lps.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Nama LPS (Teks Bebas)</label>
                <input
                  className="input"
                  placeholder="Contoh: LPS Labuai Mandiri"
                  value={namaLps}
                  onChange={(e) => setNamaLps(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Nama Ketua LPS / Penanggung Jawab</label>
                <input
                  className="input"
                  placeholder="Contoh: H. Ahmad"
                  value={namaKetuaLps}
                  onChange={(e) => setNamaKetuaLps(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Nama Pengemudi / Sopir</label>
                <input
                  className="input"
                  placeholder="Nama pengemudi bertugas"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Kelurahan</label>
                <input
                  className="input"
                  placeholder="Contoh: Tangkerang Labuai"
                  value={kelurahanLps}
                  onChange={(e) => setKelurahanLps(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Kecamatan</label>
                <input
                  className="input"
                  placeholder="Contoh: Bukit Raya"
                  value={kecamatanLps}
                  onChange={(e) => setKecamatanLps(e.target.value)}
                />
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Wilayah Kerja / Rute Angkutan</label>
                <input
                  className="input"
                  placeholder="Contoh: RW 01, RW 02, RW 03, Jl. Harapan Raya"
                  value={wilayahKerja}
                  onChange={(e) => setWilayahKerja(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Bagian 3: Legalitas & Penomoran Resmi */}
          <div
            style={{
              background: "var(--surface-2)",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
            }}
          >
            <h4 style={{ margin: "0 0 12px", fontSize: 13, textTransform: "uppercase", color: "var(--primary)", letterSpacing: "0.05em" }}>
              3. Legalitas & Penomoran Resmi DLHK
            </h4>
            <div className="form-row">
              <div className="field">
                <label>Nomor Izin Operasional</label>
                <input
                  className="input"
                  placeholder="Contoh: 027/DLHK-OPS/IX/2026"
                  value={nomorIzin}
                  onChange={(e) => setNomorIzin(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Nomor Urut Dokumen</label>
                <input
                  className="input"
                  type="number"
                  placeholder="Contoh: 15"
                  value={noUrut}
                  onChange={(e) => setNoUrut(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Lokasi TPS Tujuan</label>
                <input
                  className="input"
                  value={lokasiTps}
                  onChange={(e) => setLokasiTps(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Jenis Sampah</label>
                <input
                  className="input"
                  value={wasteType}
                  onChange={(e) => setWasteType(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Footer Aksi */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              paddingTop: 8,
              borderTop: "1px solid var(--line)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !plateNumber.trim()}
              style={{ minWidth: 160 }}
            >
              <Save size={16} />
              {loading ? "Menyimpan..." : mode === "edit" ? "Perbarui Armada" : "Simpan Armada"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
