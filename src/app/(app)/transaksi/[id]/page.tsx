import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Crown } from "lucide-react";
import PrintButton from "@/components/PrintButton";
import TransactionDetailActions from "@/components/TransactionDetailActions";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { dbOne, dbQuery } from "@/lib/db";
import { getLpsList } from "@/lib/queries";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { WeighingRow } from "@/lib/types";
import type { TransactionFormVehicle } from "@/components/TransactionFormModal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  const canManage = isSuperAdmin(user);

  const { id } = await params;
  const row = await dbOne<WeighingRow & { device_code?: string | null }>(`
    SELECT w.*, d.device_code
    FROM weighings w
    LEFT JOIN weighbridge_devices d ON d.id = w.device_id
    WHERE w.id = $1
  `, [Number(id)]);

  if (!row) return notFound();

  const [lpsList, vehicles] = await Promise.all([
    getLpsList(),
    canManage
      ? dbQuery<TransactionFormVehicle>(`
          SELECT id, plate_number, code, vehicle_type, waste_type, default_tare_kg, nama_lps
          FROM vehicles
          WHERE active = TRUE
          ORDER BY plate_number ASC
        `)
      : Promise.resolve([]),
  ]);

  return (
    <>
      <div className="page-head no-print">
        <div>
          <Link className="muted" href="/transaksi">
            <ArrowLeft size={15} style={{ verticalAlign: "middle" }} /> Kembali ke daftar transaksi
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <h1 style={{ margin: 0 }}>Tiket timbang</h1>
            {canManage ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #fde68a",
                }}
              >
                <Crown size={12} /> Super Admin
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: "#eff6ff",
                  color: "#1e40af",
                  border: "1px solid #bfdbfe",
                }}
              >
                <ShieldCheck size={12} /> Administrator (Read-Only)
              </span>
            )}
          </div>
          <p>{String(row.ticket_number)}</p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {canManage && (
            <TransactionDetailActions
              weighing={row}
              lpsOptions={lpsList}
              vehicleOptions={vehicles}
            />
          )}
          <PrintButton />
        </div>
      </div>

      <article className="card" style={{ maxWidth: 780, margin: "0 auto" }}>
        <div className="card-body" style={{ padding: 34 }}>
          <div style={{ textAlign: "center", borderBottom: "2px solid var(--text)", paddingBottom: 18, marginBottom: 22 }}>
            <h2 style={{ margin: 0 }}>TRANSDEPO HARAPAN JAYA</h2>
            <div className="muted">TIKET PENIMBANGAN ARMADA SAMPAH</div>
          </div>

          <div className="summary-box">
            <div className="summary-item">
              <span>No. tiket</span>
              <strong>{String(row.ticket_number)}</strong>
            </div>
            <div className="summary-item">
              <span>Tanggal</span>
              <strong style={{ fontSize: 14 }}>{formatDateTime(String(row.weighed_at))}</strong>
            </div>
            <div className="summary-item">
              <span>No. polisi</span>
              <strong className="plate">{String(row.plate_number)}</strong>
            </div>
          </div>

          <div style={{ height: 18 }} />
          <table>
            <tbody>
              <tr><td>Nama pengemudi</td><td><strong>{String(row.driver_name || "-")}</strong></td></tr>
              <tr><td>Jenis kendaraan</td><td><strong>{String(row.vehicle_type)}</strong></td></tr>
              <tr><td>Pengirim / LPS</td><td><strong>{String(row.lps_name)}</strong></td></tr>
              <tr><td>Jenis sampah</td><td><strong>{String(row.waste_type)}</strong></td></tr>
              <tr><td>Perangkat</td><td><strong>{String(row.device_code || "INPUT MANUAL")}</strong></td></tr>
              {row.source_note && (
                <tr><td>Catatan Sumber</td><td><span className="badge">{String(row.source_note)}</span></td></tr>
              )}
            </tbody>
          </table>

          <div style={{ height: 18 }} />
          <div className="summary-box">
            <div className="summary-item">
              <span>Gross</span>
              <strong>{formatNumber(Number(row.gross_kg))} kg</strong>
            </div>
            <div className="summary-item">
              <span>Tare</span>
              <strong>{formatNumber(Number(row.tare_kg))} kg</strong>
            </div>
            <div className="summary-item">
              <span>Netto 1</span>
              <strong>{formatNumber(Number(row.netto_1_kg))} kg</strong>
            </div>
          </div>

          <div style={{ height: 18 }} />
          <div className="summary-box" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}>
            <div className="summary-item">
              <span>Rafaksi</span>
              <strong>{formatNumber(Number(row.rafaksi_kg))} kg</strong>
            </div>
            <div className="summary-item">
              <span>Netto 2 (Bersih)</span>
              <strong style={{ fontSize: 18, color: "var(--accent)" }}>
                {formatNumber(Number(row.netto_2_kg))} kg
              </strong>
            </div>
            <div className="summary-item">
              <span>Status</span>
              <strong>{String(row.status)}</strong>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
