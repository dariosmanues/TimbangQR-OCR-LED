"use client";

import { Printer } from "lucide-react";

export default function PrintButton({
  label = 'Cetak Tiket (9.5 x 11")',
  className = "btn btn-primary no-print",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      className={className}
      onClick={() => window.print()}
      title="Cetak Tiket Timbangan (Format Kertas 9.5 x 11 Inci Continuous Form)"
      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      <Printer size={17} /> {label}
    </button>
  );
}
