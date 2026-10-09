"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div style={{ maxWidth: 540, margin: "60px auto", textAlign: "center" }}>
      <div className="card" style={{ padding: "40px 32px" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#fff0f0",
            color: "var(--danger)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 20px",
          }}
        >
          <AlertTriangle size={28} />
        </div>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Gagal Memuat Data</h2>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 24 }}>
          {error?.message?.includes("connect") || error?.message?.includes("timeout")
            ? "Database sedang menyambung kembali (cold start). Silakan coba lagi beberapa saat."
            : "Terjadi kendala saat mengambil data dari server. Silakan klik muat ulang di bawah."}
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={() => reset()}>
            <RefreshCw size={16} /> Coba Lagi
          </button>
          <a className="btn btn-secondary" href="/login">
            <LogIn size={16} /> Masuk Ulang
          </a>
        </div>
      </div>
    </div>
  );
}
