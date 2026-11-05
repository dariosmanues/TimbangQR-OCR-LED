import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, ShieldCheck } from "lucide-react";
import PrintButton from "@/components/PrintButton";
import TransactionDetailActions from "@/components/TransactionDetailActions";
import { getSession, canManageTransactions } from "@/lib/auth";
import { dbOne, dbQuery } from "@/lib/db";
import { getLpsList } from "@/lib/queries";
import { formatDateTime, formatNumber, displayPlate } from "@/lib/utils";
import type { WeighingRow } from "@/lib/types";
import type { TransactionFormVehicle } from "@/components/TransactionFormModal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TicketData = WeighingRow & {
  device_code?: string | null;
  vehicle_code?: string | null;
  nomor_izin?: string | null;
  wilayah_kerja?: string | null;
  kelurahan_lps?: string | null;
  kecamatan_lps?: string | null;
  nama_ketua_lps?: string | null;
  assignment_driver_name?: string | null;
  creator_name?: string | null;
};

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  const canManage = canManageTransactions(user);

  const { id } = await params;
  const row = await dbOne<TicketData>(`
    SELECT 
      w.*,
      d.device_code,
      v.code AS vehicle_code,
      v.nomor_izin,
      v.wilayah_kerja,
      v.kelurahan_lps,
      v.kecamatan_lps,
      v.nama_ketua_lps,
      va.driver_name AS assignment_driver_name,
      u.name AS creator_name
    FROM weighings w
    LEFT JOIN weighbridge_devices d ON d.id = w.device_id
    LEFT JOIN vehicles v ON v.id = w.vehicle_id
    LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id AND va.active = TRUE AND va.is_primary = TRUE
    LEFT JOIN users u ON u.id = w.created_by
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

  const effectiveDriver = row.driver_name || row.assignment_driver_name || row.nama_ketua_lps || "-";
  const effectivePlate = displayPlate(row.plate_number);
  const nowWib = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <style>{`
        @page {
          size: 9.5in 11in;
          margin: 8mm 12mm 8mm 12mm;
        }

        @media print {
          *, *:before, *:after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          html, body {
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, 'Lucida Console', monospace !important;
            font-size: 11pt !important;
            letter-spacing: 0.8px !important;
            word-spacing: 3.5px !important;
            line-height: 1.55 !important;
            overflow: visible !important;
            -webkit-font-smoothing: antialiased !important;
          }

          .no-print, .sidebar, .topbar, header, nav, aside {
            display: none !important;
          }

          .app-shell, .main, .content {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            height: auto !important;
            background: transparent !important;
            overflow: visible !important;
          }

          .ticket-card {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: 1.5px solid #000000 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, 'Lucida Console', monospace !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .ticket-body {
            padding: 14px 18px !important;
            font-family: 'Courier New', Courier, 'Lucida Console', monospace !important;
          }

          /* KOP RESMI */
          .ticket-kop {
            border-bottom: 2px solid #000000 !important;
            padding-bottom: 8px !important;
            margin-bottom: 10px !important;
            text-align: center !important;
            line-height: 1.4 !important;
          }

          .ticket-kop-instansi {
            font-size: 11pt !important;
            font-weight: 700 !important;
            letter-spacing: 2px !important;
            word-spacing: 5px !important;
            color: #000000 !important;
            text-transform: uppercase !important;
          }

          .ticket-kop-dinas {
            font-size: 13.5pt !important;
            font-weight: 700 !important;
            letter-spacing: 2px !important;
            word-spacing: 6px !important;
            color: #000000 !important;
            text-transform: uppercase !important;
            margin: 2px 0 !important;
          }

          .ticket-kop-upt {
            font-size: 11.5pt !important;
            font-weight: 700 !important;
            letter-spacing: 1.5px !important;
            word-spacing: 4px !important;
            color: #000000 !important;
            text-transform: uppercase !important;
          }

          .ticket-kop-alamat {
            font-size: 9.5pt !important;
            letter-spacing: 0.8px !important;
            word-spacing: 3px !important;
            color: #000000 !important;
            margin-top: 2px !important;
          }

          /* HEADER ROW: JUDUL TIKET & JAM */
          .ticket-header-row {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 10px !important;
            line-height: 1.4 !important;
          }

          .ticket-title-label {
            font-size: 10.5pt !important;
            font-weight: 700 !important;
            letter-spacing: 1.5px !important;
            word-spacing: 4px !important;
            text-transform: uppercase !important;
            color: #000000 !important;
          }

          .ticket-title-number {
            font-size: 17pt !important;
            font-weight: 700 !important;
            letter-spacing: 2.5px !important;
            word-spacing: 4px !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000000 !important;
          }

          .ticket-time-label {
            font-size: 9.5pt !important;
            letter-spacing: 1px !important;
            color: #000000 !important;
          }

          .ticket-time-value {
            font-size: 11.5pt !important;
            font-weight: 700 !important;
            letter-spacing: 1.2px !important;
            color: #000000 !important;
          }

          /* HIGHLIGHT BOX: NOMOR POLISI, KODE ARMADA, JENIS, LOKASI */
          .ticket-highlight-box {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 10px !important;
            padding: 8px 12px !important;
            margin-bottom: 10px !important;
            border: 1.5px solid #000000 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          .ticket-highlight-label {
            font-size: 9.5pt !important;
            letter-spacing: 0.8px !important;
            word-spacing: 2px !important;
            color: #000000 !important;
            margin-bottom: 3px !important;
          }

          .ticket-highlight-value {
            font-size: 11.5pt !important;
            font-weight: 700 !important;
            letter-spacing: 1.2px !important;
            word-spacing: 3px !important;
            color: #000000 !important;
          }

          .plate-box {
            display: inline-block !important;
            border: 2px solid #000000 !important;
            color: #000000 !important;
            background: #ffffff !important;
            font-size: 14pt !important;
            padding: 2px 7px !important;
            font-weight: 700 !important;
            letter-spacing: 3px !important;
            word-spacing: 6px !important;
            font-family: 'Courier New', Courier, monospace !important;
          }

          /* INFO SECTION: OPERASIONAL & WILAYAH */
          .ticket-info-section {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 16px !important;
            margin-bottom: 10px !important;
          }

          .ticket-info-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .ticket-info-table td {
            padding: 8px 4px !important;
            font-size: 10.5pt !important;
            letter-spacing: 1px !important;
            word-spacing: 3.5px !important;
            line-height: 1.8 !important;
            border-bottom: none !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000000 !important;
            vertical-align: top !important;
          }

          .ticket-info-label {
            width: 145px !important;
            font-weight: 600 !important;
            letter-spacing: 0.9px !important;
            line-height: 1.8 !important;
          }

          .ticket-info-sep {
            width: 14px !important;
            text-align: center !important;
            font-weight: 600 !important;
            line-height: 1.8 !important;
          }

          .ticket-info-val {
            letter-spacing: 1.1px !important;
            word-spacing: 3.5px !important;
            line-height: 1.8 !important;
          }

          /* TONASE TABLE 5 KOLOM */
          .ticket-tonase-section {
            margin-bottom: 10px !important;
          }

          .ticket-table-bordered {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .ticket-table-bordered th, 
          .ticket-table-bordered td {
            border: 1.5px solid #000000 !important;
            padding: 6px 4px !important;
            text-align: center !important;
            font-family: 'Courier New', Courier, monospace !important;
            color: #000000 !important;
          }

          .ticket-table-bordered th {
            font-size: 10pt !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-weight: 700 !important;
            letter-spacing: 1px !important;
            word-spacing: 3px !important;
            line-height: 1.35 !important;
          }

          .ticket-table-bordered td {
            font-size: 12pt !important;
            font-weight: 600 !important;
            letter-spacing: 1.2px !important;
            word-spacing: 3px !important;
            line-height: 1.4 !important;
          }

          .ticket-netto-box {
            border: 2px solid #000000 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 15pt !important;
            padding: 7px 5px !important;
            font-weight: 700 !important;
            letter-spacing: 1.5px !important;
          }

          .ticket-formula-note {
            font-size: 9pt !important;
            letter-spacing: 0.8px !important;
            word-spacing: 2px !important;
            line-height: 1.35 !important;
            margin-top: 3px !important;
            text-align: right !important;
            color: #000000 !important;
          }

          /* TANDA TANGAN */
          .ticket-signature-section {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 50px !important;
            margin-top: 12px !important;
            text-align: center !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .ticket-sign-title {
            font-size: 10.5pt !important;
            font-weight: 700 !important;
            letter-spacing: 1.2px !important;
            word-spacing: 3.5px !important;
            color: #000000 !important;
          }

          .signature-space {
            height: 42px !important;
          }

          .ticket-sign-name {
            border-top: 1.5px solid #000000 !important;
            padding-top: 3px !important;
            font-weight: 700 !important;
            font-size: 11pt !important;
            letter-spacing: 1.2px !important;
            word-spacing: 3.5px !important;
            color: #000000 !important;
          }

          .ticket-sign-role {
            font-size: 9.5pt !important;
            letter-spacing: 0.8px !important;
            word-spacing: 2.5px !important;
            color: #000000 !important;
          }

          /* FOOTER */
          .ticket-footer {
            margin-top: 10px !important;
            padding-top: 5px !important;
            border-top: 1px dashed #000000 !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            font-size: 9pt !important;
            letter-spacing: 0.8px !important;
            word-spacing: 2.5px !important;
            line-height: 1.35 !important;
            color: #000000 !important;
          }
        }

        .ticket-card {
          max-width: 820px;
          margin: 0 auto;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.05);
          font-family: 'Courier New', Courier, 'Lucida Console', monospace;
          letter-spacing: 0.6px;
          word-spacing: 2.5px;
          line-height: 1.55;
        }

        .ticket-body {
          padding: 24px 28px;
        }

        .ticket-table-bordered {
          width: 100%;
          border-collapse: collapse;
          text-align: center;
        }

        .ticket-table-bordered th {
          background: #f8fafc;
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 8px 6px;
          border: 1px solid #cbd5e1;
          color: #334155;
          letter-spacing: 0.8px;
          word-spacing: 2px;
        }

        .ticket-table-bordered td {
          padding: 8px 6px;
          border: 1px solid #cbd5e1;
          font-size: 13px;
          letter-spacing: 0.8px;
        }

        .ticket-info-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }

        .ticket-info-table td {
          padding: 8px 4px;
          vertical-align: top;
          border-bottom: none;
          letter-spacing: 0.6px;
          line-height: 1.8;
        }

        .ticket-info-label {
          width: 145px;
          font-weight: 600;
        }

        .ticket-info-sep {
          width: 14px;
          text-align: center;
        }

        .ticket-info-val {
          letter-spacing: 0.7px;
        }
      `}</style>

      {/* Header Halaman (Tidak dicetak) */}
      <div className="page-head no-print">
        <div>
          <Link className="muted" href="/transaksi" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <ArrowLeft size={15} /> Kembali ke daftar transaksi
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Tiket Timbang #{row.ticket_number}</h1>
            <span className="badge" style={{ fontSize: 11, fontWeight: 600, backgroundColor: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" }}>
              🖨️ Kertas Printer: 9.5 x 11 Inci (Continuous Form) — Pas 1 Halaman
            </span>
            {canManage && (
              <span className="badge green" style={{ fontSize: 11 }}>
                <ShieldCheck size={12} /> AKSES EDIT & HAPUS
              </span>
            )}
          </div>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
            Format cetak anti-dempet dioptimalkan khusus printer continuous form / dot-matrix 9.5 x 11 inches.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {canManage && (
            <TransactionDetailActions
              weighing={row}
              lpsOptions={lpsList}
              vehicleOptions={vehicles}
            />
          )}
          <PrintButton label='Cetak Tiket (9.5 x 11")' />
        </div>
      </div>

      {/* Lembar Tiket Siap Cetak (Match 9.5 x 11 inches - Format Bersih Anti-Dempet) */}
      <article className="ticket-card">
        <div className="ticket-body">
          {/* KOP Resmi Jembatan Timbang */}
          <div
            className="ticket-kop"
            style={{
              textAlign: "center",
              borderBottom: "3px double #1e293b",
              paddingBottom: 10,
              marginBottom: 12,
            }}
          >
            <div className="ticket-kop-instansi" style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", color: "#475569", letterSpacing: 1.5 }}>
              PEMERINTAH KOTA PEKANBARU
            </div>
            <div className="ticket-kop-dinas" style={{ fontSize: 15.5, fontWeight: 700, textTransform: "uppercase", margin: "2px 0", color: "#0f172a", letterSpacing: 2 }}>
              DINAS LINGKUNGAN HIDUP DAN KEBERSIHAN (DLHK)
            </div>
            <div className="ticket-kop-upt" style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#047857", letterSpacing: 1.5 }}>
              UPT PENGELOLAAN SAMPAH — JEMBATAN TIMBANG TRANSDEPO HARAPAN JAYA
            </div>
            <div className="ticket-kop-alamat" style={{ fontSize: 11, color: "#64748b", marginTop: 2, letterSpacing: 0.8 }}>
              Jl. Imam Munandar / Harapan Jaya, Kec. Bukit Raya, Kota Pekanbaru, Riau
            </div>
          </div>

          {/* Baris Judul Tiket & Nomor Tiket */}
          <div className="ticket-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div>
              <div className="ticket-title-label" style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5 }}>
                SURAT BUKTI TIMBANG (WEIGHING TICKET)
              </div>
              <div className="ticket-title-number" style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", fontFamily: "'Courier New', Courier, monospace", letterSpacing: 2.5 }}>
                {String(row.ticket_number)}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div className="ticket-time-label" style={{ fontSize: 11, color: "#64748b", letterSpacing: 0.8 }}>Waktu Timbang (WIB)</div>
              <div className="ticket-time-value" style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", letterSpacing: 1.2 }}>
                {formatDateTime(String(row.weighed_at))}
              </div>
            </div>
          </div>

          {/* Highlight Box: Nomor Polisi & Identitas Armada */}
          <div
            className="ticket-highlight-box"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              padding: "10px 12px",
              backgroundColor: "#f8fafc",
              border: "1.5px solid #cbd5e1",
              borderRadius: 6,
              marginBottom: 12,
            }}
          >
            <div>
              <div className="ticket-highlight-label" style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: 0.8 }}>Nomor Polisi (Plat)</div>
              <div
                className="plate-box"
                style={{
                  display: "inline-block",
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: "'Courier New', Courier, monospace",
                  padding: "3px 8px",
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                  borderRadius: 4,
                  marginTop: 3,
                  letterSpacing: 3,
                }}
              >
                {effectivePlate}
              </div>
            </div>

            <div>
              <div className="ticket-highlight-label" style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: 0.8 }}>Kode Armada & Izin DLHK</div>
              <div className="ticket-highlight-value" style={{ fontSize: 13, fontWeight: 700, marginTop: 4, letterSpacing: 1.2 }}>
                {row.vehicle_code || "-"}
              </div>
              {row.nomor_izin && (
                <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'Courier New', Courier, monospace", letterSpacing: 1 }}>
                  {row.nomor_izin}
                </div>
              )}
            </div>

            <div>
              <div className="ticket-highlight-label" style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: 0.8 }}>Jenis Kendaraan</div>
              <div className="ticket-highlight-value" style={{ fontSize: 13, fontWeight: 700, marginTop: 4, letterSpacing: 1.2 }}>
                {String(row.vehicle_type || "PICKUP")}
              </div>
            </div>

            <div>
              <div className="ticket-highlight-label" style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: 0.8 }}>Lokasi TPS Tujuan</div>
              <div className="ticket-highlight-value" style={{ fontSize: 13, fontWeight: 700, color: "#047857", marginTop: 4, letterSpacing: 1.2 }}>
                TRANSDEPO HARAPAN JAYA
              </div>
            </div>
          </div>

          {/* Tabel Informasi Rincian Operasional & Wilayah */}
          <div className="ticket-info-section" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 14 }}>
            {/* Kolom Kiri: LPS & Pengemudi */}
            <table className="ticket-info-table">
              <tbody>
                <tr>
                  <td className="ticket-info-label" style={{ width: 145, color: "#475569", fontWeight: 600, lineHeight: 1.8 }}>Pengirim / LPS</td>
                  <td className="ticket-info-sep" style={{ width: 14, textAlign: "center", lineHeight: 1.8 }}>:</td>
                  <td className="ticket-info-val" style={{ lineHeight: 1.8 }}><strong>{String(row.lps_name || "-")}</strong></td>
                </tr>
                <tr>
                  <td className="ticket-info-label" style={{ color: "#475569", fontWeight: 600, lineHeight: 1.8 }}>Ketua / Pengelola</td>
                  <td className="ticket-info-sep" style={{ textAlign: "center", lineHeight: 1.8 }}>:</td>
                  <td className="ticket-info-val" style={{ lineHeight: 1.8 }}>{row.nama_ketua_lps || "-"}</td>
                </tr>
                <tr>
                  <td className="ticket-info-label" style={{ color: "#475569", fontWeight: 600, lineHeight: 1.8 }}>Nama Pengemudi</td>
                  <td className="ticket-info-sep" style={{ textAlign: "center", lineHeight: 1.8 }}>:</td>
                  <td className="ticket-info-val" style={{ lineHeight: 1.8 }}><strong>{effectiveDriver}</strong></td>
                </tr>
                <tr>
                  <td className="ticket-info-label" style={{ color: "#475569", fontWeight: 600, lineHeight: 1.8 }}>Jenis Sampah</td>
                  <td className="ticket-info-sep" style={{ textAlign: "center", lineHeight: 1.8 }}>:</td>
                  <td className="ticket-info-val" style={{ lineHeight: 1.8 }}>{String(row.waste_type || "SAMPAH RUMAH TANGGA")}</td>
                </tr>
              </tbody>
            </table>

            {/* Kolom Kanan: Wilayah & Perangkat */}
            <table className="ticket-info-table">
              <tbody>
                <tr>
                  <td className="ticket-info-label" style={{ width: 145, color: "#475569", fontWeight: 600, lineHeight: 1.8 }}>Kelurahan / Kec.</td>
                  <td className="ticket-info-sep" style={{ width: 14, textAlign: "center", lineHeight: 1.8 }}>:</td>
                  <td className="ticket-info-val" style={{ lineHeight: 1.8 }}>
                    {row.kelurahan_lps ? `${row.kelurahan_lps} / ${row.kecamatan_lps || "-"}` : "-"}
                  </td>
                </tr>
                <tr>
                  <td className="ticket-info-label" style={{ color: "#475569", fontWeight: 600, lineHeight: 1.8 }}>Wilayah Kerja</td>
                  <td className="ticket-info-sep" style={{ textAlign: "center", lineHeight: 1.8 }}>:</td>
                  <td className="ticket-info-val" style={{ lineHeight: 1.8 }}>
                    <span style={{ fontSize: 11.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {row.wilayah_kerja || "-"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="ticket-info-label" style={{ color: "#475569", fontWeight: 600, lineHeight: 1.8 }}>Metode / Sumber</td>
                  <td className="ticket-info-sep" style={{ textAlign: "center", lineHeight: 1.8 }}>:</td>
                  <td className="ticket-info-val" style={{ lineHeight: 1.8 }}>
                    <span style={{ fontWeight: 600 }}>
                      {row.source === "OCR_LED" ? "Kamera OCR LED Otomatis" : row.source === "SERIAL_BRIDGE" ? "TimbangQR Bridge (RS232/RS485)" : (row.source || "Aplikasi")}
                    </span>
                    {row.device_code && <span style={{ fontSize: 11, color: "#64748b" }}> ({row.device_code})</span>}
                  </td>
                </tr>
                {row.source_note && (
                  <tr>
                    <td className="ticket-info-label" style={{ color: "#475569", fontWeight: 600, lineHeight: 1.8 }}>Catatan</td>
                    <td className="ticket-info-sep" style={{ textAlign: "center", lineHeight: 1.8 }}>:</td>
                    <td className="ticket-info-val" style={{ fontSize: 11.5, lineHeight: 1.8 }}>{row.source_note}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TABEL RINCIAN TONASE / TIMBANGAN (Format 5 Kolom Match 9.5 x 11 Inci) */}
          <div className="ticket-tonase-section" style={{ marginBottom: 14 }}>
            <table className="ticket-table-bordered">
              <thead>
                <tr>
                  <th style={{ width: "20%" }}>1. GROSS (KOTOR)</th>
                  <th style={{ width: "20%" }}>2. TARE (KOSONG)</th>
                  <th style={{ width: "20%" }}>3. NETTO 1</th>
                  <th style={{ width: "15%" }}>4. RAFAKSI</th>
                  <th style={{ width: "25%", backgroundColor: "#fef3c7", color: "#92400e" }}>
                    5. NETTO 2 (BERSIH)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700, fontFamily: "'Courier New', Courier, monospace", fontSize: 13.5 }}>
                    {formatNumber(Number(row.gross_kg))} kg
                  </td>
                  <td style={{ fontWeight: 700, fontFamily: "'Courier New', Courier, monospace", fontSize: 13.5 }}>
                    {formatNumber(Number(row.tare_kg))} kg
                  </td>
                  <td style={{ fontWeight: 700, fontFamily: "'Courier New', Courier, monospace", fontSize: 13.5 }}>
                    {formatNumber(Number(row.netto_1_kg))} kg
                  </td>
                  <td style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 13.5 }}>
                    {formatNumber(Number(row.rafaksi_kg))} kg
                  </td>
                  <td
                    className="ticket-netto-box"
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      fontFamily: "'Courier New', Courier, monospace",
                      color: "#047857",
                      backgroundColor: "#f0fdf4",
                      padding: "8px 6px",
                    }}
                  >
                    {formatNumber(Number(row.netto_2_kg))} kg
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="ticket-formula-note" style={{ fontSize: 11, color: "#64748b", marginTop: 4, textAlign: "right" }}>
              * Perhitungan: Netto 1 = (Gross - Tare) | Netto 2 = (Netto 1 - Rafaksi) | Ritasi: {row.ritasi || 1}
            </div>
          </div>

          {/* Bagian Tanda Tangan (2 Kolom Seimbang) */}
          <div
            className="ticket-signature-section"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 60,
              marginTop: 18,
              textAlign: "center",
              pageBreakInside: "avoid",
              breakInside: "avoid",
            }}
          >
            <div>
              <div className="ticket-sign-title" style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>
                Pengemudi / Sopir Armada
              </div>
              <div className="signature-space" style={{ height: 46 }} />
              <div className="ticket-sign-name" style={{ borderTop: "1.5px solid #000000", paddingTop: 4, fontWeight: 700, fontSize: 12.5 }}>
                ( {effectiveDriver !== "-" ? effectiveDriver : "..................................."} )
              </div>
              <div className="ticket-sign-role" style={{ fontSize: 10.5, color: "#64748b" }}>Tanda tangan & Nama Jelas</div>
            </div>

            <div>
              <div className="ticket-sign-title" style={{ fontSize: 11.5, fontWeight: 700, color: "#475569" }}>
                Petugas Jembatan Timbang
              </div>
              <div className="signature-space" style={{ height: 46 }} />
              <div className="ticket-sign-name" style={{ borderTop: "1.5px solid #000000", paddingTop: 4, fontWeight: 700, fontSize: 12.5 }}>
                ( {row.creator_name || "Petugas Timbang Harapan Jaya"} )
              </div>
              <div className="ticket-sign-role" style={{ fontSize: 10.5, color: "#64748b" }}>UPT Pengelolaan Sampah DLHK</div>
            </div>
          </div>

          {/* Footer Catatan Tiket & Timestamp Cetak */}
          <div
            className="ticket-footer"
            style={{
              marginTop: 18,
              paddingTop: 8,
              borderTop: "1px dashed #cbd5e1",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 10,
              color: "#64748b",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <div>
              Tiket ini adalah bukti sah penimbangan sampah di TPS Harapan Jaya Pekanbaru.
            </div>
            <div>
              Dicetak pada: {nowWib} WIB | TimbangQR Harapan Jaya
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
