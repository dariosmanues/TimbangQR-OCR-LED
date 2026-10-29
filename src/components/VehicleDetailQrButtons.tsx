"use client";

import { useState } from "react";
import { Download, QrCode, Printer, ShieldCheck } from "lucide-react";
import { downloadArmadaQrCard, downloadRawQrPng, printArmadaQrCard, type VehicleCardData } from "@/lib/qr-card-canvas";
import ArmadaQrModal from "@/components/ArmadaQrModal";

interface VehicleDetailQrButtonsProps {
  vehicle: VehicleCardData;
}

export default function VehicleDetailQrButtons({ vehicle }: VehicleDetailQrButtonsProps) {
  const [downloadingCard, setDownloadingCard] = useState(false);
  const [downloadingRaw, setDownloadingRaw] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  async function handleDownloadCard() {
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
    try {
      await printArmadaQrCard(vehicle);
    } catch (err) {
      console.error("Gagal mencetak kartu QR:", err);
      alert("Terjadi kesalahan saat mencetak kartu.");
    }
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: 14 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleDownloadCard}
          disabled={downloadingCard}
          style={{ width: "100%", justifyContent: "center" }}
        >
          <Download size={16} />
          {downloadingCard ? "Menyiapkan Unduhan..." : "Download Kartu QR Lengkap (PNG)"}
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDownloadRaw}
            disabled={downloadingRaw}
            style={{ justifyContent: "center" }}
            title="Download QR Code saja tanpa background kartu"
          >
            <QrCode size={14} />
            {downloadingRaw ? "Mengunduh..." : "QR Polos (PNG)"}
          </button>

          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={() => setModalOpen(true)}
            style={{ justifyContent: "center" }}
            title="Buka pratinjau kartu stiker ukuran penuh"
          >
            <ShieldCheck size={14} />
            Pratinjau Kartu
          </button>
        </div>
      </div>

      {modalOpen && (
        <ArmadaQrModal
          vehicle={vehicle}
          isOpen
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
