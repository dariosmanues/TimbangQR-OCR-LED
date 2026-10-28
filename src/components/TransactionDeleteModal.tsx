"use client";

import { useState } from "react";
import { X, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { WeighingRow } from "@/lib/types";
import { formatDateTime, formatNumber } from "@/lib/utils";

interface TransactionDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  weighing: WeighingRow | null;
  onSuccess?: () => void;
}

export default function TransactionDeleteModal({
  isOpen,
  onClose,
  weighing,
  onSuccess,
}: TransactionDeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !weighing) return null;

  async function handleDelete() {
    if (!weighing) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/weighings/${weighing.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus transaksi.");
      }

      setSuccessMsg(data.message || "Transaksi berhasil dihapus.");
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      }, 700);
    } catch (err) {
      console.error("Gagal menghapus transaksi:", err);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat menghapus transaksi.");
    } finally {
      setLoading(false);
    }
  }

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
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "520px",
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          backgroundColor: "#ffffff",
        }}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fff5f5",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                backgroundColor: "#fed7d7",
                color: "var(--danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trash2 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", color: "var(--danger)" }}>
                Hapus Transaksi Penimbangan
              </h3>
              <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "12px" }}>
                Konfirmasi penghapusan tiket #{weighing.ticket_number}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ width: 32, height: 32, padding: 0, borderRadius: "50%" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: "20px 22px", display: "grid", gap: "16px" }}>
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
              <AlertTriangle size={17} />
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

          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "var(--surface-2)",
              borderRadius: "12px",
              border: "1px solid var(--line)",
              fontSize: "13px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted">Nomor Tiket:</span>
              <strong>{weighing.ticket_number}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted">Nomor Polisi:</span>
              <strong className="plate">{weighing.plate_number}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted">Pengemudi:</span>
              <span>{weighing.driver_name || "-"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted">LPS:</span>
              <strong>{weighing.lps_name}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="muted">Tanggal:</span>
              <span>{formatDateTime(weighing.weighed_at)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
              <span className="muted">Netto Bersih (Netto 2):</span>
              <strong style={{ color: "var(--primary)", fontSize: 16 }}>
                {formatNumber(weighing.netto_2_kg)} kg
              </strong>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: "13px", color: "var(--text)", lineHeight: 1.5 }}>
            Apakah Anda yakin ingin menghapus data penimbangan ini secara permanen?
            Tindakan ini akan dicatat ke dalam log audit dan data tonnage akan disesuaikan.
          </p>

          {/* Footer Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              paddingTop: 12,
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
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="btn btn-sm"
              style={{
                backgroundColor: "var(--danger)",
                color: "#ffffff",
                gap: 6,
                padding: "8px 16px",
                fontWeight: 600,
              }}
            >
              <Trash2 size={16} />
              <span>{loading ? "Menghapus..." : "Ya, Hapus Transaksi"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
