"use client";

import { useState, useMemo } from "react";
import { Download, QrCode, Search, X, ShieldCheck, Check } from "lucide-react";
import { downloadArmadaQrCard, type VehicleCardData } from "@/lib/qr-card-canvas";
import { displayPlate, normalizePlate } from "@/lib/utils";
import ArmadaQrModal from "@/components/ArmadaQrModal";

interface ArmadaQuickQrModalProps {
  vehicles: VehicleCardData[];
}

export default function ArmadaQuickQrModal({ vehicles }: ArmadaQuickQrModalProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCardData | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const filteredVehicles = useMemo(() => {
    if (!search.trim()) return vehicles.slice(0, 30);
    const q = search.toLowerCase().trim();
    const qNorm = q.replace(/[^a-z0-9]/g, "");

    return vehicles.filter((v) => {
      const plate = (v.plate_number || "").toLowerCase();
      const plateNorm = (v.plate_normalized || normalizePlate(v.plate_number)).toLowerCase();
      const lps = (v.nama_lps || v.lps_names || "").toLowerCase();
      const driver = (v.nama_ketua_lps || "").toLowerCase();
      const kel = (v.kelurahan_lps || "").toLowerCase();
      const code = (v.code || "").toLowerCase();
      const izin = (v.nomor_izin || "").toLowerCase();

      return (
        plate.includes(q) ||
        plateNorm.includes(qNorm) ||
        lps.includes(q) ||
        driver.includes(q) ||
        kel.includes(q) ||
        code.includes(q) ||
        izin.includes(q)
      );
    });
  }, [vehicles, search]);

  async function handleDownload(vehicle: VehicleCardData, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      setDownloadingId(vehicle.id);
      await downloadArmadaQrCard(vehicle);
    } catch (err) {
      console.error("Gagal mengunduh kartu QR:", err);
      alert("Terjadi kesalahan saat mengunduh kartu QR.");
    } finally {
      setDownloadingId(null);
    }
  }

  function handleOpenPreview(vehicle: VehicleCardData) {
    setSelectedVehicle(vehicle);
    setPreviewModalOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setOpen(true)}
        title="Menu cari dan unduh QR Kartu Master Armada"
      >
        <Download size={16} /> Unduh QR Armada
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(10, 25, 18, 0.72)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9990,
            padding: "16px",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "20px",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.45)",
              border: "1px solid var(--line)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
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
                    <ShieldCheck size={12} /> MENU DOWNLOAD QR
                  </span>
                  <span className="badge" style={{ fontSize: 11 }}>
                    MASTER ARMADA
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: "20px", color: "var(--text)" }}>
                  Pusat Unduh QR Master Armada
                </h2>
                <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "13px" }}>
                  Pilih armada untuk mengunduh Kartu Identitas QR (format PNG resolusi tinggi dengan Nomor Plat & Nama LPS).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-secondary btn-sm"
                style={{ width: 34, height: 34, padding: 0, borderRadius: "50%" }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Search Input Box */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)", background: "#ffffff" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search
                  size={16}
                  style={{ position: "absolute", left: 14, color: "var(--muted)", pointerEvents: "none" }}
                />
                <input
                  type="text"
                  className="input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ketik nomor plat atau nama LPS (contoh: BM 8185 BI, Sukamaju)..."
                  style={{ paddingLeft: 38, paddingRight: search ? 36 : 14 }}
                  autoFocus
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    style={{
                      position: "absolute",
                      right: 12,
                      border: "none",
                      background: "transparent",
                      color: "var(--muted)",
                      cursor: "pointer",
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                <span>
                  {search
                    ? `Ditemukan ${filteredVehicles.length} armada`
                    : `Menampilkan ${filteredVehicles.length} dari total ${vehicles.length} armada`}
                </span>
                <span>Klik &quot;Download PNG&quot; untuk unduh langsung atau &quot;Pratinjau&quot;</span>
              </div>
            </div>

            {/* Vehicle List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px" }}>
              {filteredVehicles.length === 0 ? (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--muted)" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Tidak ada armada yang cocok dengan kata kunci &quot;{search}&quot;</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12 }}>Periksa kembali penulisan nomor plat atau nama LPS.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {filteredVehicles.map((v) => {
                    const formattedPlate = displayPlate(v.plate_number);
                    const lps = v.nama_lps || v.lps_names || "LPS TPS Harapan Jaya";
                    const isDownloading = downloadingId === v.id;

                    return (
                      <div
                        key={v.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: "12px",
                          border: "1px solid var(--line)",
                          background: "var(--surface)",
                          gap: 12,
                          transition: "background .15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "10px",
                              background: "var(--primary-soft)",
                              color: "var(--primary)",
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            <QrCode size={20} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <strong style={{ fontSize: 15, letterSpacing: "0.04em" }}>{formattedPlate}</strong>
                              <span className="badge" style={{ fontSize: 10 }}>
                                {v.vehicle_type || "ARMADA"}
                              </span>
                              {v.no_urut && (
                                <span className="badge green" style={{ fontSize: 10 }}>
                                  #{v.no_urut}
                                </span>
                              )}
                            </div>
                            <p
                              style={{
                                margin: "2px 0 0",
                                fontSize: 12,
                                color: "var(--muted)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              <strong>{lps}</strong>
                              {v.kelurahan_lps ? ` · Kel. ${v.kelurahan_lps}` : ""}
                              {v.nama_ketua_lps ? ` · ${v.nama_ketua_lps}` : ""}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenPreview(v)}
                            title="Buka pratinjau kartu stiker ukuran penuh"
                          >
                            Pratinjau
                          </button>

                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={(e) => handleDownload(v, e)}
                            disabled={isDownloading}
                            title="Download langsung Kartu Stiker QR PNG"
                          >
                            <Download size={13} />
                            {isDownloading ? "Mengunduh..." : "Download PNG"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fbfcfb",
                borderBottomLeftRadius: "20px",
                borderBottomRightRadius: "20px",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Format file unduhan: <strong>PNG 960 x 1320 px (High-Resolution)</strong>
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pratinjau Modal untuk kendaraan yang dipilih */}
      {previewModalOpen && selectedVehicle && (
        <ArmadaQrModal
          vehicle={selectedVehicle}
          isOpen
          onClose={() => {
            setPreviewModalOpen(false);
            setSelectedVehicle(null);
          }}
        />
      )}
    </>
  );
}
