"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, QrCode, Pencil, Trash2, Eye } from "lucide-react";
import { downloadArmadaQrCard, type VehicleCardData } from "@/lib/qr-card-canvas";
import ArmadaQrModal from "@/components/ArmadaQrModal";
import ArmadaFormModal from "@/components/ArmadaFormModal";
import ArmadaDeleteModal from "@/components/ArmadaDeleteModal";

interface ArmadaRowActionsProps {
  vehicle: VehicleCardData;
  canManage?: boolean;
  lpsOptions?: Array<{ id: number; name: string }>;
}

export default function ArmadaRowActions({
  vehicle,
  canManage = false,
  lpsOptions = [],
}: ArmadaRowActionsProps) {
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDirectDownload(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      setDownloading(true);
      await downloadArmadaQrCard(vehicle);
    } catch (err) {
      console.error("Gagal mengunduh kartu QR armada:", err);
      alert("Terjadi kesalahan saat mengunduh kartu QR.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          justifyContent: "flex-end",
          whiteSpace: "nowrap",
        }}
      >
        {/* Khusus Super Admin: Tombol Edit & Hapus (CRUD) */}
        {canManage && (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditModalOpen(true)}
              title="Edit data & perizinan armada"
              style={{ padding: "5px 9px", gap: 4 }}
            >
              <Pencil size={13} /> Edit
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setDeleteModalOpen(true)}
              title="Hapus atau nonaktifkan armada"
              style={{
                padding: "5px 8px",
                color: "var(--danger)",
                backgroundColor: "#fff0f0",
                border: "1px solid #fed7d7",
              }}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}

        {/* Tombol Buka Modal Preview & Unduh QR (Semua Role) */}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setQrModalOpen(true)}
          title="Buka pratinjau dan menu unduh QR Armada"
          style={{ gap: 4, padding: "5px 9px" }}
        >
          <QrCode size={13} /> QR
        </button>

        {/* Tombol Unduh Cepat 1-Klik PNG (Semua Role) */}
        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={handleDirectDownload}
          disabled={downloading}
          title="Download langsung Kartu Stiker QR PNG"
          style={{ width: 32, height: 32, padding: 0 }}
        >
          <Download size={13} />
        </button>

        {/* Link ke Halaman Detail Armada (Semua Role) */}
        <Link
          className="btn btn-secondary btn-sm"
          href={`/armada/${vehicle.id}`}
          title="Lihat detail lengkap & riwayat penimbangan armada"
          style={{ width: 32, height: 32, padding: 0, display: "grid", placeItems: "center" }}
        >
          <Eye size={13} />
        </Link>
      </div>

      {/* Modal Dialog QR Card */}
      {qrModalOpen && (
        <ArmadaQrModal
          vehicle={vehicle}
          isOpen
          onClose={() => setQrModalOpen(false)}
        />
      )}

      {/* Modal Dialog Edit & Hapus Armada (Hanya Super Admin) */}
      {canManage && (
        <>
          {editModalOpen && (
            <ArmadaFormModal
              isOpen
              onClose={() => setEditModalOpen(false)}
              mode="edit"
              vehicle={vehicle}
              lpsOptions={lpsOptions}
            />
          )}

          <ArmadaDeleteModal
            isOpen={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            vehicle={vehicle}
          />
        </>
      )}
    </>
  );
}
