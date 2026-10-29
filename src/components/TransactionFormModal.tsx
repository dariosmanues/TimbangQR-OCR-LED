"use client";

import { useState } from "react";
import { X, Gauge, Save, AlertCircle, CheckCircle2, Scale, Truck, Calendar, User, Info } from "lucide-react";
import type { WeighingRow } from "@/lib/types";
import { findVehicleByPlate } from "@/lib/vehicle-selection";

export interface TransactionFormVehicle {
  id: number;
  plate_number: string;
  code: string;
  vehicle_type: string;
  waste_type: string;
  default_tare_kg: number | null;
  nama_lps?: string | null;
}

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  weighing?: WeighingRow | null;
  lpsOptions: Array<{ id: number; name: string }>;
  vehicleOptions?: TransactionFormVehicle[];
  onSuccess?: () => void;
}

function toLocalDatetimeString(isoOrDateStr?: string | null): string {
  if (!isoOrDateStr) {
    const now = new Date();
    // Offset local timezone to format YYYY-MM-DDTHH:mm
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  }
  try {
    const d = new Date(isoOrDateStr);
    if (isNaN(d.getTime())) return "";
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

export default function TransactionFormModal({
  isOpen,
  onClose,
  mode,
  weighing,
  lpsOptions = [],
  vehicleOptions = [],
  onSuccess,
}: TransactionFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  // The component mounts only when its dialog opens, so form values can be
  // derived once here instead of synchronously resetting state in an effect.
  const editWeighing = mode === "edit" ? weighing : null;
  const matchedLps = editWeighing && !editWeighing.lps_id
    ? lpsOptions.find(
        (lps) => lps.name.toLowerCase().trim() === (editWeighing.lps_name || "").toLowerCase().trim()
      )
    : null;
  const [vehicleId, setVehicleId] = useState<string>(() =>
    editWeighing?.vehicle_id ? String(editWeighing.vehicle_id) : ""
  );
  const [plateNumber, setPlateNumber] = useState(() => editWeighing?.plate_number || "");
  const [driverName, setDriverName] = useState(() => editWeighing?.driver_name || "");
  const [lpsId, setLpsId] = useState<string>(() => {
    if (editWeighing?.lps_id) return String(editWeighing.lps_id);
    if (matchedLps) return String(matchedLps.id);
    return lpsOptions[0]?.id ? String(lpsOptions[0].id) : "";
  });
  const [vehicleType, setVehicleType] = useState(() => editWeighing?.vehicle_type || "PICKUP");
  const [wasteType, setWasteType] = useState(() => editWeighing?.waste_type || "SAMPAH RUMAH TANGGA");

  const [grossKg, setGrossKg] = useState<string>(() => String(editWeighing?.gross_kg || ""));
  const [tareKg, setTareKg] = useState<string>(() => String(editWeighing?.tare_kg || ""));
  const [rafaksiKg, setRafaksiKg] = useState<string>(() => String(editWeighing?.rafaksi_kg ?? 0));
  const [tareSource, setTareSource] = useState<string>(() => editWeighing?.tare_source || "DATABASE");
  const [status, setStatus] = useState<string>(() => editWeighing?.status || "COMPLETED");
  const [weighedAt, setWeighedAt] = useState<string>(() => toLocalDatetimeString(editWeighing?.weighed_at));
  const [sourceNote, setSourceNote] = useState<string>(() =>
    editWeighing ? editWeighing.source_note || "" : "Input manual oleh Super Admin / Admin"
  );

  // Handle vehicle dropdown selection
  function handleVehicleSelect(selectedId: string) {
    setVehicleId(selectedId);
    if (!selectedId) return;

    const v = vehicleOptions.find((veh) => String(veh.id) === selectedId);
    if (!v) return;

    setPlateNumber(v.plate_number);
    setVehicleType(v.vehicle_type || "PICKUP");
    setWasteType(v.waste_type || "SAMPAH RUMAH TANGGA");
    if (v.default_tare_kg != null) {
      setTareKg(String(v.default_tare_kg));
      setTareSource("DATABASE");
    }

    if (v.nama_lps) {
      const matched = lpsOptions.find(
        (l) => l.name.toLowerCase().trim() === v.nama_lps?.toLowerCase().trim()
      );
      if (matched) {
        setLpsId(String(matched.id));
      }
    }
  }

  // Calculated weights
  const numGross = Number(grossKg) || 0;
  const numTare = Number(tareKg) || 0;
  const numRafaksi = Number(rafaksiKg) || 0;
  const netto1 = Math.max(0, numGross - numTare);
  const netto2 = Math.max(0, netto1 - numRafaksi);
  const isValidWeight = numGross > numTare && netto2 > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (numGross <= numTare) {
      setError("Berat kotor (Gross) harus lebih besar daripada berat kosong (Tare).");
      setLoading(false);
      return;
    }

    if (netto2 <= 0) {
      setError("Berat bersih (Netto 2) harus lebih besar dari 0 kg.");
      setLoading(false);
      return;
    }

    try {
      if (mode === "create") {
        const selectedVehicle = vehicleId
          ? vehicleOptions.find((vehicle) => vehicle.id === Number(vehicleId)) ?? null
          : findVehicleByPlate(plateNumber, vehicleOptions);

        if (!selectedVehicle) {
          throw new Error(
            "Pilih armada terdaftar atau masukkan nomor polisi yang terdaftar di Master Armada."
          );
        }
        if (!lpsId) {
          throw new Error("Pilih LPS penanggung jawab.");
        }

        const payload = {
          vehicleId: selectedVehicle.id,
          lpsId: Number(lpsId),
          driverName: driverName.trim(),
          grossKg: numGross,
          tareKg: numTare,
          rafaksiKg: numRafaksi,
          tareSource,
          measurementSource: "MANUAL",
          weighedAt: weighedAt ? new Date(weighedAt).toISOString() : undefined,
          sourceNote: sourceNote.trim() || "Input manual oleh admin",
        };

        const res = await fetch("/api/weighings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal membuat transaksi baru.");
        }

        setSuccessMsg(`Transaksi berhasil dicatat dengan Nomor Tiket: ${data.ticketNumber}`);
      } else {
        if (!weighing) throw new Error("Data transaksi tidak ditemukan.");

        const payload = {
          vehicleId: vehicleId ? Number(vehicleId) : null,
          plateNumber: plateNumber.trim(),
          driverName: driverName.trim() || null,
          lpsId: lpsId ? Number(lpsId) : null,
          vehicleType,
          wasteType,
          grossKg: numGross,
          tareKg: numTare,
          rafaksiKg: numRafaksi,
          tareSource,
          status,
          weighedAt: weighedAt ? new Date(weighedAt).toISOString() : undefined,
          sourceNote: sourceNote.trim() || null,
        };

        const res = await fetch(`/api/weighings/${weighing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Gagal memperbarui transaksi.");
        }

        setSuccessMsg("Data transaksi berhasil diperbarui.");
      }

      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      }, 700);
    } catch (err) {
      console.error("Kesalahan submit transaksi:", err);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "760px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          backgroundColor: "#ffffff",
        }}
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
          }}
        >
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span className="badge green" style={{ fontSize: 11 }}>
                <Gauge size={12} /> MENU TRANSAKSI
              </span>
              <span className="badge" style={{ fontSize: 11 }}>
                {mode === "edit" ? "MODE EDIT TRANSAKSI" : "TRANSAKSI MANUAL BARU"}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: "19px", color: "var(--text)" }}>
              {mode === "edit" ? (
                <>
                  Edit Transaksi: <span style={{ color: "var(--primary)" }}>{weighing?.ticket_number}</span>
                </>
              ) : (
                "Tambah Transaksi Penimbangan Manual"
              )}
            </h2>
            <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "12px" }}>
              {mode === "edit"
                ? "Perbarui berat, nomor polisi, nama pengemudi, atau keterangan penimbangan."
                : "Khusus Admin: catat penimbangan armada sampah secara langsung ke sistem."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ width: 34, height: 34, padding: 0, borderRadius: "50%" }}
            title="Tutup Modal"
          >
            <X size={17} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", overflowY: "auto", display: "grid", gap: "16px" }}>
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

          {/* Section 1: Armada, Pengemudi & LPS */}
          <div
            style={{
              background: "var(--surface-2)",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
            }}
          >
            <h4 style={{ margin: "0 0 12px", fontSize: 13, textTransform: "uppercase", color: "var(--primary)", letterSpacing: "0.05em" }}>
              1. Identitas Armada & Pengemudi
            </h4>
            <div className="form-row">
              {vehicleOptions.length > 0 && (
                <div className="field">
                  <label>Pilih Armada dari Database</label>
                  <select
                    className="select"
                    value={vehicleId}
                    onChange={(e) => handleVehicleSelect(e.target.value)}
                  >
                    <option value="">-- Pilih armada atau ketik plat yang sudah terdaftar --</option>
                    {vehicleOptions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate_number} ({v.code}) - {v.nama_lps || "Umum"} {v.default_tare_kg ? `[Tare: ${v.default_tare_kg} kg]` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                <label>Nama Pengemudi</label>
                <input
                  className="input"
                  placeholder="Nama pengemudi / sopir"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Lembaga Pengelola Sampah (LPS) *</label>
                <select
                  className="select"
                  value={lpsId}
                  onChange={(e) => setLpsId(e.target.value)}
                  required
                >
                  <option value="">-- Pilih LPS --</option>
                  {lpsOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
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
                <label>Waktu Penimbangan *</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={weighedAt}
                  onChange={(e) => setWeighedAt(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Berat & Kalkulasi Netto */}
          <div
            style={{
              background: "var(--surface-2)",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
            }}
          >
            <h4 style={{ margin: "0 0 12px", fontSize: 13, textTransform: "uppercase", color: "var(--primary)", letterSpacing: "0.05em" }}>
              2. Data Penimbangan (Gross, Tare, Rafaksi & Netto)
            </h4>
            <div className="form-row">
              <div className="field">
                <label>Berat Kotor (Gross) (kg) *</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Contoh: 3250"
                  value={grossKg}
                  onChange={(e) => setGrossKg(e.target.value)}
                  required
                  style={{ fontWeight: 700, fontSize: 16 }}
                />
              </div>

              <div className="field">
                <label>Berat Kosong (Tare) (kg) *</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Contoh: 1450"
                  value={tareKg}
                  onChange={(e) => setTareKg(e.target.value)}
                  required
                  style={{ fontWeight: 700, fontSize: 16 }}
                />
              </div>

              <div className="field">
                <label>Potongan Rafaksi (kg)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={rafaksiKg}
                  onChange={(e) => setRafaksiKg(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Sumber Tare</label>
                <select
                  className="select"
                  value={tareSource}
                  onChange={(e) => setTareSource(e.target.value)}
                >
                  <option value="DATABASE">DATABASE (Acuan Master)</option>
                  <option value="ACTUAL_WEIGHING">ACTUAL_WEIGHING (Timbang Langsung)</option>
                  <option value="MANUAL">MANUAL (Koreksi Admin)</option>
                </select>
              </div>

              {mode === "edit" && (
                <div className="field">
                  <label>Status Transaksi</label>
                  <select
                    className="select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="COMPLETED">COMPLETED (Selesai)</option>
                    <option value="CANCELLED">CANCELLED (Dibatalkan)</option>
                    <option value="PENDING">PENDING (Tertunda)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Live Kalkulasi Netto Highlight Box */}
            <div
              style={{
                marginTop: 14,
                padding: "14px 18px",
                borderRadius: "12px",
                background: isValidWeight ? "var(--primary-soft)" : "#fff0f0",
                border: isValidWeight ? "1px solid #bbf7d0" : "1px solid #fed7d7",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
                textAlign: "center",
              }}
            >
              <div>
                <small style={{ color: "var(--muted)", display: "block" }}>Gross</small>
                <strong style={{ fontSize: 16 }}>{numGross.toLocaleString("id-ID")} kg</strong>
              </div>
              <div>
                <small style={{ color: "var(--muted)", display: "block" }}>Tare</small>
                <strong style={{ fontSize: 16 }}>{numTare.toLocaleString("id-ID")} kg</strong>
              </div>
              <div>
                <small style={{ color: "var(--muted)", display: "block" }}>Netto 1 (Gross - Tare)</small>
                <strong style={{ fontSize: 16 }}>{netto1.toLocaleString("id-ID")} kg</strong>
              </div>
              <div>
                <small style={{ color: "var(--muted)", display: "block" }}>Rafaksi</small>
                <strong style={{ fontSize: 16 }}>{numRafaksi.toLocaleString("id-ID")} kg</strong>
              </div>
              <div style={{ background: "#ffffff", padding: "6px 12px", borderRadius: 8 }}>
                <small style={{ color: "var(--primary)", fontWeight: 700, display: "block" }}>NETTO 2 BERSIH</small>
                <strong style={{ fontSize: 22, color: isValidWeight ? "var(--primary)" : "var(--danger)" }}>
                  {netto2.toLocaleString("id-ID")} kg
                </strong>
              </div>
            </div>
            {!isValidWeight && numGross > 0 && (
              <small style={{ color: "var(--danger)", display: "block", marginTop: 6 }}>
                * Perhatian: Gross harus lebih besar daripada Tare dan Netto 2 harus bernilai positif (&gt; 0).
              </small>
            )}
          </div>

          {/* Section 3: Catatan / Keterangan */}
          <div className="field">
            <label>Catatan / Alasan Input / Perubahan</label>
            <input
              className="input"
              placeholder="Contoh: Input manual penimbangan armada cadangan LPS"
              value={sourceNote}
              onChange={(e) => setSourceNote(e.target.value)}
            />
          </div>

          {/* Footer Actions */}
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
              disabled={loading || !isValidWeight}
              style={{ gap: 6 }}
            >
              <Save size={16} />
              <span>{loading ? "Menyimpan..." : mode === "edit" ? "Simpan Perubahan" : "Simpan Transaksi"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
