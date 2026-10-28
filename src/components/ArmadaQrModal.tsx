"use client";

import { useEffect, useState } from "react";
import { X, Download, QrCode, Printer, Check, Copy, ExternalLink, ShieldCheck, Truck, MapPin, User } from "lucide-react";
import Link from "next/link";
import {
  generateArmadaQrCardCanvas,
  downloadArmadaQrCard,
  downloadRawQrPng,
  printArmadaQrCard,
  type VehicleCardData,
} from "@/lib/qr-card-canvas";
import { displayPlate, formatNumber, normalizePlate } from "@/lib/utils";

interface ArmadaQrModalProps {
  vehicle: VehicleCardData | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ArmadaQrModal({ vehicle, isOpen, onClose }: ArmadaQrModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloadingCard, setDownloadingCard] = useState(false);
  const [downloadingRaw, setDownloadingRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !vehicle) {
      setPreviewUrl(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoadingPreview(true);
    setError(null);

    generateArmadaQrCardCanvas(vehicle)
      .then((canvas) => {
        if (!isMounted) return;
        setPreviewUrl(canvas.toDataURL("image/png"));
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Gagal membuat preview kartu QR:", err);
        setError("Gagal memuat pratinjau kartu QR.");
      })
      .finally(() => {
        if (isMounted) setLoadingPreview(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const cleanPlate = vehicle.plate_normalized || normalizePlate(vehicle.plate_number);
  const targetToken = `ARMADA-${cleanPlate}`;
  const formattedPlate = displayPlate(vehicle.plate_number);
  const lpsName = vehicle.nama_lps || vehicle.lps_names || "LPS TPS Harapan Jaya";

  async function handleDownloadCard() {
    if (!vehicle) return;
    try {
      setDownloadingCard(true);
      await downloadArmadaQrCard(vehicle);
    } catch (err) {
      console.error("Gagal mengunduh kartu QR:", err);
      alert("Terjadi kesalahan saat mengunduh kartu QR.");
    } finally {
      setDownloadingCard(false);
    }
  }

  async function handleDownloadRaw() {
    if (!vehicle) return;
    try {
      setDownloadingRaw(true);
      await downloadRawQrPng(vehicle);
    } catch (err) {
      console.error("Gagal mengunduh QR polos:", err);
      alert("Terjadi kesalahan saat mengunduh QR polos.");
    } finally {
      setDownloadingRaw(false);
    }
  }

  async function handlePrint() {
    if (!vehicle) return;
    try {
      await printArmadaQrCard(vehicle);
    } catch (err) {
      console.error("Gagal mencetak kartu QR:", err);
      alert("Terjadi kesalahan saat mencetak kartu.");
    }
  }

  function handleCopyToken() {
    navigator.clipboard.writeText(targetToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          maxWidth: "680px",
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
                <ShieldCheck size={12} /> QR MASTER RESMI
              </span>
              <span className="badge" style={{ fontSize: 11 }}>
                {vehicle.lokasi_tps ? `TPS ${vehicle.lokasi_tps}` : "TPS HARAPAN JAYA"}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: "19px", color: "var(--text)" }}>
              Kartu QR Master Armada: <span style={{ color: "var(--primary)" }}>{formattedPlate}</span>
            </h2>
            <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "12px" }}>
              {lpsName} {vehicle.kelurahan_lps ? `· Kel. ${vehicle.kelurahan_lps}` : ""}
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

        {/* Body Modal */}
        <div style={{ padding: "20px 24px", display: "grid", gap: "18px" }}>
          {/* Quick Info Box */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "10px",
              background: "var(--surface-2)",
              padding: "12px 14px",
              borderRadius: "14px",
              border: "1px solid var(--line)",
            }}
          >
            <div>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                Token Penimbangan
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <code style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                  {targetToken}
                </code>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  style={{
                    border: "none",
                    background: copied ? "var(--primary)" : "#e2e8f0",
                    color: copied ? "white" : "#475569",
                    padding: "3px 7px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 11,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    transition: "all .15s",
                  }}
                  title="Salin token QR ke clipboard"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? "Tersalin" : "Salin"}
                </button>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                Jenis & No. Urut
              </span>
              <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                {vehicle.vehicle_type || "ARMADA"} {vehicle.no_urut ? `· Urut #${vehicle.no_urut}` : ""}
              </p>
            </div>

            <div>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                Tare Acuan
              </span>
              <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                {vehicle.default_tare_kg ? `${formatNumber(vehicle.default_tare_kg)} kg` : "-"}
              </p>
            </div>
          </div>

          {/* Pratinjau Gambar Kartu Beresolusi Tinggi */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              background: "#f1f5f3",
              borderRadius: "16px",
              border: "1px dashed #cbd5e1",
              minHeight: "280px",
              position: "relative",
            }}
          >
            {loadingPreview ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    border: "3px solid #cad8cf",
                    borderTopColor: "var(--primary)",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    margin: "0 auto 12px",
                  }}
                />
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                  Menyiapkan pratinjau kartu QR resolusi tinggi...
                </p>
              </div>
            ) : error ? (
              <div style={{ color: "var(--danger)", fontSize: 13, textAlign: "center" }}>
                {error}
              </div>
            ) : previewUrl ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <img
                  src={previewUrl}
                  alt={`Kartu QR ${formattedPlate}`}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "360px",
                    objectFit: "contain",
                    borderRadius: "12px",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.12)",
                    border: "1px solid #dfe8e2",
                  }}
                />
                <span style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                  Dimensi Asli File Unduhan: <strong>960 x 1320 px (PNG High-Res)</strong> · Siap Cetak & Laminating
                </span>
              </div>
            ) : null}
          </div>

          {/* Tombol Aksi Utama Unduh & Cetak */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "10px",
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownloadCard}
              disabled={downloadingCard || loadingPreview}
              style={{ width: "100%" }}
            >
              <Download size={16} />
              {downloadingCard ? "Mengunduh..." : "Download Kartu QR Lengkap"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadRaw}
              disabled={downloadingRaw || loadingPreview}
              style={{ width: "100%" }}
              title="Unduh file gambar QR Code polos tanpa kartu identitas"
            >
              <QrCode size={16} />
              {downloadingRaw ? "Mengunduh..." : "Download QR Polos (PNG)"}
            </button>

            <button
              type="button"
              className="btn btn-soft"
              onClick={handlePrint}
              disabled={loadingPreview}
              style={{ width: "100%" }}
            >
              <Printer size={16} />
              Cetak Stiker Langsung
            </button>
          </div>
        </div>

        {/* Footer Modal */}
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
          <Link
            className="btn btn-secondary btn-sm"
            href={`/armada/${vehicle.id}`}
            onClick={onClose}
          >
            <ExternalLink size={13} /> Buka Halaman Detail
          </Link>

          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
