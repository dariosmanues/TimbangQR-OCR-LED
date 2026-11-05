import Link from "next/link";
import { Filter, Search, Camera, Crown, Calendar, User } from "lucide-react";
import { getSession, canManageTransactions } from "@/lib/auth";
import { getLpsList, listWeighings } from "@/lib/queries";
import { dbQuery } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/utils";
import TransactionRowActions from "@/components/TransactionRowActions";
import TransactionCreateButton from "@/components/TransactionCreateButton";
import type { TransactionFormVehicle } from "@/components/TransactionFormModal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; month?: string; lps?: string }>;
}) {
  const user = await getSession();
  const canManage = canManageTransactions(user);

  const params = await searchParams;
  const q = params.q || "";
  const month = params.month || "";
  const lps = params.lps || "";

  const [rows, lpsList, vehicles] = await Promise.all([
    listWeighings({ search: q, month, lps, limit: 300 }),
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
      <div className="page-head">
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            {canManage ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 10px",
                  borderRadius: "12px",
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #fde68a",
                }}
              >
                <Crown size={13} /> Hak Akses: Master ADMIN (CRUD Transaksi Aktif)
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 10px",
                  borderRadius: "12px",
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: "#f8fafc",
                  color: "#64748b",
                  border: "1px solid #cbd5e1",
                }}
              >
                🔒 Hak Akses: Administrator (Lihat Data Saja — CRUD Khusus Master ADMIN)
              </span>
            )}
          </div>
          <h1>Transaksi penimbangan</h1>
          <p>
            Menampilkan maksimal 300 data sesuai filter.
            {canManage && " Anda memiliki akses untuk Tambah, Edit, dan Hapus data transaksi."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {canManage && (
            <TransactionCreateButton
              lpsOptions={lpsList}
              vehicleOptions={vehicles}
            />
          )}
          <Link className="btn btn-secondary" href="/scan" style={{ gap: 6 }}>
            <Camera size={16} />
            <span>Scan & Timbang</span>
          </Link>
        </div>
      </div>

      <form className="card card-body" method="get" style={{ marginBottom: 18 }}>
        <div className="form-row">
          <div className="field">
            <label>Pencarian</label>
            <input className="input" name="q" defaultValue={q} placeholder="No. tiket, no. polisi, pengemudi..." />
          </div>
          <div className="field">
            <label>Bulan</label>
            <input className="input" type="month" name="month" defaultValue={month} />
          </div>
          <div className="field">
            <label>LPS</label>
            <select className="select" name="lps" defaultValue={lps}>
              <option value="">Semua LPS</option>
              {lpsList.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ alignContent: "end" }}>
            <button className="btn btn-secondary" type="submit"><Filter size={17} /> Terapkan filter</button>
          </div>
        </div>
      </form>

      {/* DESKTOP MODE: FULL TABLE VIEW */}
      <article className="card desktop-only-view">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>No. tiket</th>
                <th>No. polisi</th>
                <th>Pengemudi</th>
                <th>LPS</th>
                <th className="num">Gross</th>
                <th className="num">Tare</th>
                <th className="num">Netto 1</th>
                <th className="num">Rafaksi</th>
                <th className="num">Netto 2</th>
                <th className="num" style={{ minWidth: canManage ? 160 : 80 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.weighed_at)}</td>
                  <td><strong>{row.ticket_number}</strong></td>
                  <td className="plate">{row.plate_number}</td>
                  <td>{row.driver_name || "-"}</td>
                  <td>{row.lps_name}</td>
                  <td className="num">{formatNumber(row.gross_kg)}</td>
                  <td className="num">{formatNumber(row.tare_kg)}</td>
                  <td className="num">{formatNumber(row.netto_1_kg)}</td>
                  <td className="num">{formatNumber(row.rafaksi_kg)}</td>
                  <td className="num"><strong>{formatNumber(row.netto_2_kg)}</strong></td>
                  <td className="num">
                    <TransactionRowActions
                      weighing={row}
                      canManage={canManage}
                      lpsOptions={lpsList}
                      vehicleOptions={vehicles}
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="empty">
                    <Search size={28} />
                    <p>Data tidak ditemukan.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* MOBILE MODE: RECEIPT CARD LIST VIEW */}
      <div className="mobile-only-view mobile-card-list">
        {rows.map((row) => (
          <article key={row.id} className="card mobile-data-card">
            <div className="mobile-card-top">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="plate mobile-plate-badge">{row.plate_number}</span>
                <span className="badge green" style={{ fontSize: 11 }}>
                  #{row.ticket_number}
                </span>
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Calendar size={12} /> {formatDateTime(row.weighed_at)}
              </span>
            </div>

            <div className="mobile-card-body">
              <div className="mobile-card-lps">
                <strong>{row.lps_name}</strong>
                <span className="muted" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <User size={12} /> {row.driver_name || "-"}
                </span>
              </div>

              <div className="mobile-weight-pills">
                <div className="weight-pill">
                  <span>Gross</span>
                  <strong>{formatNumber(row.gross_kg)} kg</strong>
                </div>
                <div className="weight-pill">
                  <span>Tare</span>
                  <strong>{formatNumber(row.tare_kg)} kg</strong>
                </div>
                <div className="weight-pill highlight">
                  <span>Netto 2</span>
                  <strong>{formatNumber(row.netto_2_kg)} kg</strong>
                </div>
              </div>
            </div>

            <div className="mobile-card-footer">
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                Rafaksi: {formatNumber(row.rafaksi_kg)} kg
              </span>
              <TransactionRowActions
                weighing={row}
                canManage={canManage}
                lpsOptions={lpsList}
                vehicleOptions={vehicles}
              />
            </div>
          </article>
        ))}

        {rows.length === 0 && (
          <article className="card empty">
            <Search size={28} />
            <p>Data tidak ditemukan.</p>
          </article>
        )}
      </div>
    </>
  );
}
