"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, Play, RefreshCcw, Truck, XCircle } from "lucide-react";

export type FleetEntry = {
  no: number;
  nomor_polisi: string;
  plate_normalized: string;
  nama_lps: string;
  nomor_izin: string;
};
type Status = "pending" | "running" | "success" | "failed";
type AuditResult = FleetEntry & { status: Status; detail: string; vehicleId?: number };

const normalize = (value: string) =>
  value.normalize("NFKC").toUpperCase().replace(/^LPS[\s._-]+/, "").replace(/[^A-Z0-9]/g, "");

const plate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

function createResults(rows: FleetEntry[]): AuditResult[] {
  return rows.map((row) => ({ ...row, status: "pending", detail: "Belum diuji" }));
}

export default function FleetQrAudit({ fleet }: { fleet: FleetEntry[] }) {
  const [items, setItems] = useState<AuditResult[]>(() => createResults(fleet));
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [startedAt, setStartedAt] = useState("");
  const [fatal, setFatal] = useState("");
  const summary = useMemo(() => ({
    ok: items.filter((item) => item.status === "success").length,
    failed: items.filter((item) => item.status === "failed").length,
    inProgress: items.filter((item) => item.status === "running").length,
  }), [items]);

  function update(no: number, patch: Partial<AuditResult>) {
    setItems((previous) => previous.map((item) => item.no === no ? { ...item, ...patch } : item));
  }

  async function testRow(row: FleetEntry, duplicates: Map<string, number>): Promise<void> {
    update(row.no, { status: "running", detail: "Memvalidasi di Vercel..." });
    const token = "ARMADA-" + row.plate_normalized;
    const needsChoice = (duplicates.get(row.plate_normalized) || 0) > 1;
    const endpoint = "/api/qr/" + encodeURIComponent(token);
    try {
      // This is the SAME authenticated production API used by the camera scanner.
      // It may synchronize missing vehicle/LPS master entries. It never creates a weighing.
      if (needsChoice) {
        const initial = await fetch(endpoint, { credentials: "same-origin", cache: "no-store" });
        const initialData: unknown = await initial.json();
        if (initial.status === 401) throw new Error("Sesi login operator habis.");
        if (!initial.ok) throw new Error(errorText(initialData, initial.status));
        if (!initialData || typeof initialData !== "object" ||
            !("requiresSelection" in initialData) || initialData.requiresSelection !== true ||
            !("choices" in initialData) || !Array.isArray(initialData.choices) ||
            !initialData.choices.some((choice: unknown) =>
              !!choice && typeof choice === "object" && "no" in choice && choice.no === row.no)) {
          throw new Error("QR nomor polisi ganda tidak menyediakan pilihan LPS yang tepat.");
        }
      }

      const response = await fetch(
        endpoint + (needsChoice ? "?masterNo=" + row.no : ""),
        { credentials: "same-origin", cache: "no-store" }
      );
      const data: unknown = await response.json();
      if (response.status === 401) throw new Error("Sesi login operator habis.");
      if (!response.ok) throw new Error(errorText(data, response.status));
      if (!data || typeof data !== "object" || !("vehicle" in data) ||
          !("assignments" in data) || !("selectedMasterNo" in data)) {
        throw new Error("Respons API tidak berisi identitas armada lengkap.");
      }
      const result = data as {
        vehicle: { id: number; plate_number: string; plate_normalized: string };
        assignments: Array<{ lps_id: number; lps_name: string }>;
        selectedMasterNo: number;
      };
      if (!result.vehicle || result.vehicle.plate_normalized !== row.plate_normalized ||
          plate(result.vehicle.plate_number) !== row.plate_normalized ||
          result.selectedMasterNo !== row.no ||
          !Array.isArray(result.assignments) || result.assignments.length === 0 ||
          normalize(result.assignments[0].lps_name) !== normalize(row.nama_lps) ||
          !result.vehicle.id || !result.assignments[0].lps_id) {
        throw new Error("Nomor polisi, LPS, izin, atau ID database tidak sesuai master.");
      }
      update(row.no, {
        status: "success",
        detail: "Terhubung: " + result.vehicle.plate_number + " → " + result.assignments[0].lps_name,
        vehicleId: result.vehicle.id,
      });
    } catch (error) {
      update(row.no, {
        status: "failed",
        detail: error instanceof Error ? error.message : "Gagal memverifikasi QR",
      });
    }
  }

  async function runAll() {
    if (running) return;
    setItems(createResults(fleet));
    setRunning(true);
    setFinished(false);
    setFatal("");
    setStartedAt(new Date().toISOString());

    const duplicates = new Map<string, number>();
    for (const row of fleet) {
      duplicates.set(row.plate_normalized, (duplicates.get(row.plate_normalized) || 0) + 1);
    }
    // Limit concurrency: sync operations take PostgreSQL transactions/locks.
    let next = 0;
    try {
      await Promise.all(Array.from({ length: 3 }, async () => {
        while (next < fleet.length) {
          const current = fleet[next++];
          await testRow(current, duplicates);
        }
      }));
    } catch (error) {
      setFatal(error instanceof Error ? error.message : "Proses audit terhenti.");
    } finally {
      setRunning(false);
      setFinished(true);
    }
  }

  function downloadReport() {
    const quote = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
    const headings = ["No", "Nomor polisi", "Kode QR", "LPS", "Nomor izin", "Status", "Keterangan", "ID kendaraan"];
    const lines = [headings.map(quote).join(",")];
    for (const row of items) {
      lines.push([
        row.no, row.nomor_polisi, "ARMADA-" + row.plate_normalized,
        row.nama_lps, row.nomor_izin, row.status, row.detail, row.vehicleId || "",
      ].map(quote).join(","));
    }
    const blob = new Blob(["\uFEFF", ...lines.map((line) => line + "\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "audit-qr-harapan-jaya-" + new Date().toISOString().slice(0, 10) + ".csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Uji seluruh QR armada Harapan Jaya</h2>
          <p>Uji langsung API scan pada deployment Vercel yang sedang aktif, menggunakan sesi login operator.</p>
        </div>
      </div>
      <div className="card-body">
        <p style={{ marginBottom: 12 }}>
          Pengujian memeriksa setiap QR terhadap master armada, identitas LPS, izin, dan ID PostgreSQL
          dengan endpoint yang sama seperti scanner kamera. Bila master belum ada, endpoint akan
          menyinkronkannya. <strong>Tidak membuat transaksi penimbangan atau tiket palsu.</strong>
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
          <button type="button" className="btn btn-primary" disabled={running} onClick={() => void runAll()}>
            {running ? <LoaderCircle size={17} /> : finished ? <RefreshCcw size={17} /> : <Play size={17} />}
            {running ? "Memeriksa seluruh armada..." : finished ? "Uji ulang seluruh armada" : "Uji 68 QR di Vercel"}
          </button>
          <Link href="/scan" className="btn btn-secondary"><Truck size={17} /> Buka scanner</Link>
          {finished && <button type="button" className="btn btn-secondary" onClick={downloadReport}>Unduh hasil CSV</button>}
        </div>
        <div className="summary-box" style={{ marginBottom: 18 }}>
          <div className="summary-item"><span>Total entri</span><strong>{fleet.length}</strong></div>
          <div className="summary-item"><span>Berhasil</span><strong style={{ color: "#078253" }}>{summary.ok}</strong></div>
          <div className="summary-item"><span>Gagal</span><strong style={{ color: summary.failed ? "#bd2532" : "inherit" }}>{summary.failed}</strong></div>
          <div className="summary-item"><span>Berjalan</span><strong>{summary.inProgress}</strong></div>
        </div>
        {startedAt && (
          <p style={{ marginBottom: 14 }}>
            {finished
              ? summary.failed === 0 && summary.ok === fleet.length
                ? "Seluruh entri berhasil diverifikasi melalui API produksi."
                : "Pengujian selesai. Tinjau entri yang gagal sebelum menggunakan QR terkait."
              : "Sedang memeriksa QR di aplikasi produksi. Jangan tutup halaman sampai selesai."}
          </p>
        )}
        {fatal && <p role="alert" style={{ color: "#bd2532" }}>{fatal}</p>}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #d3ddd7" }}>
                <th style={{ padding: 10 }}>No.</th>
                <th style={{ padding: 10 }}>QR / Polisi</th>
                <th style={{ padding: 10 }}>LPS</th>
                <th style={{ padding: 10 }}>Status</th>
                <th style={{ padding: 10 }}>Hasil Vercel</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.no} style={{ borderBottom: "1px solid #e2e9e5" }}>
                  <td style={{ padding: 10 }}>{item.no}</td>
                  <td style={{ padding: 10 }}>
                    <strong>{item.nomor_polisi}</strong>
                    <div style={{ fontSize: 11, opacity: .7 }}>ARMADA-{item.plate_normalized}</div>
                  </td>
                  <td style={{ padding: 10 }}>{item.nama_lps}</td>
                  <td style={{ padding: 10 }}>
                    {item.status === "success" ? <CheckCircle2 color="#078253" size={19} /> :
                     item.status === "failed" ? <XCircle color="#bd2532" size={19} /> :
                     item.status === "running" ? <LoaderCircle size={19} /> : "—"}
                  </td>
                  <td style={{ padding: 10, fontSize: 13 }}>{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function errorText(data: unknown, status: number) {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return "HTTP " + status + " dari endpoint scanner produksi";
}
