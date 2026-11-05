"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useUiMode } from "./UiModeProvider";

export default function UiModeSwitcher({ compact = false }: { compact?: boolean }) {
  const { uiMode, setUiMode } = useUiMode();

  return (
    <div
      className="ui-mode-switcher no-print"
      role="group"
      aria-label="Pilih Mode Tampilan UI"
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "#e8f0ec",
        padding: 3,
        borderRadius: 12,
        border: "1px solid #cfe0d6",
        gap: 2,
      }}
    >
      <button
        type="button"
        onClick={() => setUiMode("desktop")}
        title="Tampilan Desktop (Layar Lebar / Tabel Lengkap)"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: compact ? "5px 9px" : "6px 12px",
          borderRadius: 9,
          border: "none",
          fontSize: 12,
          fontWeight: 700,
          background: uiMode === "desktop" ? "#08784f" : "transparent",
          color: uiMode === "desktop" ? "#ffffff" : "#43584e",
          boxShadow: uiMode === "desktop" ? "0 2px 8px rgba(8,120,79,0.25)" : "none",
          transition: "all 0.16s ease",
        }}
      >
        <Monitor size={14} />
        <span>{compact ? "Desktop" : "Desktop Mode"}</span>
      </button>
      <button
        type="button"
        onClick={() => setUiMode("mobile")}
        title="Tampilan Mobile (Mode HP / Kartu Ringkas)"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: compact ? "5px 9px" : "6px 12px",
          borderRadius: 9,
          border: "none",
          fontSize: 12,
          fontWeight: 700,
          background: uiMode === "mobile" ? "#08784f" : "transparent",
          color: uiMode === "mobile" ? "#ffffff" : "#43584e",
          boxShadow: uiMode === "mobile" ? "0 2px 8px rgba(8,120,79,0.25)" : "none",
          transition: "all 0.16s ease",
        }}
      >
        <Smartphone size={14} />
        <span>{compact ? "Mobile" : "Mobile Mode"}</span>
      </button>
    </div>
  );
}

