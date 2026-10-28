import Link from "next/link";
import { Filter, Search, Camera, ShieldCheck, Crown } from "lucide-react";
import { getSession, isSuperAdmin } from "@/lib/auth";
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
  const canManage = isSuperAdmin(user);

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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
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
                <Crown size={13} /> Hak Akses: Super Admin (CRUD Transaksi Aktif)
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
                  backgroundColor: "#eff6ff",
                  color: "#1e40af",
                  border: "1px solid #bfdbfe",
                }}
              >
                <ShieldCheck size={13} /> Hak Akses: Administrator (Hanya Baca / Read-Only)
              </span>
            )}
          </div>
          <h1>Transaksi penimbangan</h1>
          <p>
            Menampilkan maksimal 300 data sesuai filter.
            {canManage ? " Anda memiliki akses untuk Tambah, Edit, dan Hapus data transaksi." : " Mode hanya lihat transaksi (Read-Only)."}
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

      <article className="card">
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
    </>
  );
}
