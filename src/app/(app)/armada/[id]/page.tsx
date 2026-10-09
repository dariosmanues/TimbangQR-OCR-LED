import { notFound } from "next/navigation";
import { ArrowLeft, Gauge, ShieldCheck, FileText, MapPin, User, Calendar, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import PrintButton from "@/components/PrintButton";
import { getVehicle } from "@/lib/queries";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getVehicle(Number(id));
  if (!result) return notFound();
  const { vehicle, assignments, weighings } = result;

  return (
    <>
      <div className="page-head no-print">
        <div>
          <Link className="muted" href="/armada">
            <ArrowLeft size={15} style={{ verticalAlign: "middle" }} /> Kembali ke master armada
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <h1 style={{ margin: 0 }}>{vehicle.plate_number}</h1>
            <span className={`badge ${vehicle.active ? "green" : "red"}`}>
              <span className="dot" /> {vehicle.active ? "Aktif" : "Nonaktif"}
            </span>
          </div>
          <p style={{ marginTop: 4 }}>
            <strong>{vehicle.code}</strong> · {vehicle.vehicle_type}
            {vehicle.nomor_izin && ` · Izin: ${vehicle.nomor_izin}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link className="btn btn-secondary" href={`/scan?token=${vehicle.qr_token}`}>
            <Gauge size={17} /> Timbang armada
          </Link>
          <PrintButton />
        </div>
      </div>

      <section className="grid equal">
        <article className="card qr-card">
          <Image
            src={`/api/vehicles/${vehicle.id}/qr`}
            alt={`QR ${vehicle.plate_number}`}
            width={240}
            height={240}
            unoptimized
          />
          <h2 style={{ letterSpacing: "0.08em" }}>{vehicle.plate_number}</h2>
          <p style={{ marginBottom: 6 }}>{vehicle.code}</p>
          {vehicle.nomor_izin && (
            <span className="badge" style={{ fontSize: 11, marginBottom: 8, fontFamily: "monospace" }}>
              {vehicle.nomor_izin}
            </span>
          )}
          <span className={`badge ${vehicle.active ? "green" : "red"}`}>
            {vehicle.active ? "QR AKTIF · SIAP TIMBANG" : "NONAKTIF"}
          </span>
          <div className="help" style={{ marginTop: 14 }}>
            Tempelkan QR pada kaca depan atau bodi armada untuk scan cepat di jembatan timbang.
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <div>
              <h2>Data Izin & Spesifikasi</h2>
              <p>Legalitas operasional DLHK Kota Pekanbaru.</p>
            </div>
            {vehicle.no_urut && (
              <span className="badge green">No. Urut: {vehicle.no_urut}</span>
            )}
          </div>
          <div className="card-body">
            <div className="summary-box">
              <div className="summary-item">
                <span>Tare acuan</span>
                <strong>{vehicle.default_tare_kg ? `${formatNumber(vehicle.default_tare_kg)} kg` : "-"}</strong>
              </div>
              <div className="summary-item">
                <span>Jenis armada</span>
                <strong style={{ fontSize: 14 }}>{vehicle.vehicle_type}</strong>
              </div>
              <div className="summary-item">
                <span>Lokasi TPS</span>
                <strong style={{ fontSize: 14, color: "var(--primary)" }}>{vehicle.lokasi_tps || "HARAPAN JAYA"}</strong>
              </div>
            </div>

            <div style={{ marginTop: 18, display: "grid", gap: 10, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                <span className="muted">Nomor Izin Operasional</span>
                <strong>{vehicle.nomor_izin || "-"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                <span className="muted">Nama LPS</span>
                <strong>{vehicle.nama_lps || vehicle.nama_lps_2 || "-"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                <span className="muted">Ketua LPS</span>
                <span>{vehicle.nama_ketua_lps || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                <span className="muted">Kelurahan / Kecamatan</span>
                <span>{vehicle.kelurahan_lps || "-"} / {vehicle.kecamatan_lps || vehicle.kecamatan || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                <span className="muted">Alamat LPS</span>
                <span style={{ maxWidth: "60%", textAlign: "right" }}>{vehicle.alamat_lps || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                <span className="muted">Wilayah Kerja</span>
                <span style={{ maxWidth: "60%", textAlign: "right", fontWeight: 600 }}>{vehicle.wilayah_kerja || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                <span className="muted">Nomor SK LPS</span>
                <span>{vehicle.nomor_sk_lps || "-"} ({vehicle.tanggal_sk_lps || "-"})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                <span className="muted">Surat Permohonan</span>
                <span>{vehicle.nomor_surat_permohonan || "-"} ({vehicle.tanggal_permohonan || "-"})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                <span className="muted">Tgl. Terbit Izin Operasional</span>
                <span>{vehicle.tanggal_terbit_izin || "-"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 2 }}>
                <span className="muted">Lampiran Camat</span>
                <span>{vehicle.lampiran_camat || "-"}</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <div style={{ height: 18 }} />

      <article className="card no-print">
        <div className="card-head">
          <div>
            <h2>Penugasan LPS ({assignments.length})</h2>
            <p>Daftar LPS tempat armada ini bertugas.</p>
          </div>
        </div>
        <div className="card-body">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>LPS</th>
                  <th>Pengemudi</th>
                  <th className="num">Tare</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.lps_name}</strong></td>
                    <td>{a.driver_name || vehicle.nama_ketua_lps || "-"}</td>
                    <td className="num">{a.tare_kg ? `${formatNumber(a.tare_kg)} kg` : "-"}</td>
                    <td>
                      {a.is_primary ? (
                        <span className="badge green">Utama</span>
                      ) : (
                        <span className="badge">Alternatif</span>
                      )}
                    </td>
                  </tr>
                ))}
                {assignments.length === 0 && (
                  <tr><td colSpan={4} className="empty">Belum ada penugasan LPS.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <div style={{ height: 18 }} />

      <article className="card no-print">
        <div className="card-head">
          <div>
            <h2>Riwayat Penimbangan</h2>
            <p>Transaksi penimbangan terakhir untuk armada ini.</p>
          </div>
        </div>
        <div className="card-body">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Tiket</th>
                  <th>LPS</th>
                  <th>Pengemudi</th>
                  <th className="num">Gross</th>
                  <th className="num">Tare</th>
                  <th className="num">Netto 2</th>
                </tr>
              </thead>
              <tbody>
                {weighings.map((w) => (
                  <tr key={w.id}>
                    <td>{formatDateTime(w.weighed_at)}</td>
                    <td><strong>{w.ticket_number}</strong></td>
                    <td>{w.lps_name}</td>
                    <td>{w.driver_name || "-"}</td>
                    <td className="num">{formatNumber(w.gross_kg)}</td>
                    <td className="num">{formatNumber(w.tare_kg)}</td>
                    <td className="num"><strong>{formatNumber(w.netto_2_kg)}</strong></td>
                  </tr>
                ))}
                {weighings.length === 0 && (
                  <tr><td className="empty" colSpan={7}>Belum ada transaksi penimbangan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </>
  );
}
