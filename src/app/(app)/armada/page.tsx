import Link from "next/link";
import { Search, ShieldCheck, Truck, MapPin, User, Lock, BarChart3, Camera } from "lucide-react";
import VehicleCreateForm from "@/components/VehicleCreateForm";
import VehicleStatusToggle from "@/components/VehicleStatusToggle";
import ArmadaRowActions from "@/components/ArmadaRowActions";
import ArmadaQuickQrModal from "@/components/ArmadaQuickQrModal";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { getLpsList, listVehicles, getVehicleCounts } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ArmadaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: "active" | "all" | "inactive" | "harapan_jaya" | "air_hitam" | "palas" }>;
}) {
  const user = await getSession();
  const canManage = isSuperAdmin(user);

  if (!canManage) {
    return (
      <article className="card" style={{ maxWidth: 640, margin: "32px auto", textAlign: "center", padding: "36px 24px" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "#fef3c7",
            color: "#d97706",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 16px",
            border: "1px solid #fde68a",
          }}
        >
          <Lock size={30} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <span
            className="badge"
            style={{
              backgroundColor: "#eff6ff",
              color: "#1e40af",
              border: "1px solid #bfdbfe",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            🛡️ {user?.name || "Administrator LPS"} ({user?.email || "admin@lps.local"})
          </span>
        </div>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Menu Master Armada Dinonaktifkan</h1>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: "0 auto 24px", maxWidth: 480 }}>
          Akses ke menu <strong>Master Armada</strong> telah dinonaktifkan khusus untuk akun{" "}
          <strong>Administrator LPS ({user?.email || "admin@lps.local"})</strong>. Halaman ini hanya dapat diakses oleh{" "}
          <strong>👑 Master ADMIN</strong>.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard" className="btn btn-secondary">
            <BarChart3 size={16} /> Ke Dashboard
          </Link>
          <Link href="/scan" className="btn btn-primary">
            <Camera size={16} /> Scan & Timbang
          </Link>
        </div>
      </article>
    );
  }

  const params = await searchParams;
  const q = params.q || "";
  const filter = params.status || "active";
  const [vehicles, lps, counts] = await Promise.all([
    listVehicles(q, filter),
    getLpsList(),
    getVehicleCounts(),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            <span className="badge green">
              <ShieldCheck size={14} /> TPS WILAYAH HARAPAN JAYA
            </span>
            <span className="badge">UPDATE OKTOBER 2026</span>
            {canManage ? (
              <span className="badge" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", fontWeight: 700 }}>
                👑 Hak Akses: Master ADMIN (CRUD Master Armada Aktif)
              </span>
            ) : (
              <span className="badge" style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #cbd5e1" }}>
                🔒 Hak Akses: Administrator (Mode Lihat Saja — CRUD Khusus Master ADMIN)
              </span>
            )}
          </div>
          <h1>Master Armada</h1>
          <p>
            {formatNumber(vehicles.length)} armada terdaftar dalam database jembatan timbang Harapan Jaya
            ({counts.harapanJaya || counts.active} Aktif).
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <ArmadaQuickQrModal vehicles={vehicles} />
          {canManage && <VehicleCreateForm lpsOptions={lps} />}
        </div>
      </div>

      <div className="toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <form className="search" method="get" style={{ display: "flex", gap: 9, minWidth: "min(100%, 420px)" }}>
          <input type="hidden" name="status" value={filter} />
          <input
            className="input"
            name="q"
            defaultValue={q}
            placeholder="Cari no. polisi, no. izin, LPS, ketua, kelurahan..."
          />
          <button className="btn btn-secondary" type="submit">
            <Search size={17} /> Cari
          </button>
        </form>

        <div className="filter-pills" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link
            href={`/armada?status=active${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`btn btn-sm ${filter === "active" ? "btn-primary" : "btn-secondary"}`}
          >
            Harapan Jaya ({counts.harapanJaya || counts.active} Aktif)
          </Link>
          <Link
            href={`/armada?status=all${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-secondary"}`}
          >
            Total ({counts.total})
          </Link>
          {counts.inactive > 0 && (
            <Link
              href={`/armada?status=inactive${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`btn btn-sm ${filter === "inactive" ? "btn-primary" : "btn-secondary"}`}
            >
              Nonaktif ({counts.inactive})
            </Link>
          )}
        </div>
      </div>

      {/* DESKTOP MODE: FULL TABLE VIEW */}
      <article className="card desktop-only-view">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 60, textAlign: "center" }}>No</th>
                <th>Kode & No. Izin</th>
                <th>No. Polisi</th>
                <th>LPS & Pengelola</th>
                <th>Kelurahan / Kecamatan</th>
                <th>Wilayah Kerja</th>
                <th className="num">Tare Acuan</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th className="num">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle, idx) => (
                <tr key={vehicle.id}>
                  <td style={{ textAlign: "center", fontWeight: 700, color: "var(--muted)" }}>
                    {vehicle.no_urut || idx + 1}
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <strong>{vehicle.code}</strong>
                      {vehicle.nomor_izin ? (
                        <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
                          {vehicle.nomor_izin}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>-</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span className="plate" style={{ fontSize: 14 }}>{vehicle.plate_number}</span>
                      <span className="badge" style={{ fontSize: 10, width: "fit-content" }}>
                        <Truck size={10} style={{ marginRight: 2 }} /> {vehicle.vehicle_type}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <strong style={{ color: "var(--text)" }}>
                        {vehicle.nama_lps || vehicle.lps_names || <span className="muted">Belum ditetapkan</span>}
                      </strong>
                      {vehicle.nama_ketua_lps && (
                        <span style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                          <User size={12} /> {vehicle.nama_ketua_lps}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>{vehicle.kelurahan_lps || "-"}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{vehicle.kecamatan_lps || vehicle.kecamatan || "-"}</span>
                    </div>
                  </td>
                  <td style={{ maxWidth: 280, fontSize: 12 }}>
                    {vehicle.wilayah_kerja && vehicle.wilayah_kerja !== "-" ? (
                      <span title={vehicle.wilayah_kerja} style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {vehicle.wilayah_kerja}
                      </span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td className="num">
                    {vehicle.default_tare_kg ? (
                      <strong>{formatNumber(vehicle.default_tare_kg)} kg</strong>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <VehicleStatusToggle
                      vehicleId={vehicle.id}
                      initialActive={vehicle.active}
                      plateNumber={vehicle.plate_number}
                      code={vehicle.code}
                      disabled={!canManage}
                    />
                  </td>
                  <td className="num">
                    <ArmadaRowActions vehicle={vehicle} lpsOptions={lps} canManage={canManage} />
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty" style={{ textAlign: "center", padding: "32px 16px" }}>
                    Tidak ada armada yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* MOBILE MODE: CARD LIST VIEW */}
      <div className="mobile-only-view mobile-card-list">
        {vehicles.map((vehicle, idx) => (
          <article key={vehicle.id} className="card mobile-data-card">
            <div className="mobile-card-top">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="mobile-card-index">#{vehicle.no_urut || idx + 1}</span>
                <span className="plate mobile-plate-badge">{vehicle.plate_number}</span>
                <span className="badge" style={{ fontSize: 10 }}>
                  <Truck size={11} /> {vehicle.vehicle_type}
                </span>
              </div>
              <VehicleStatusToggle
                vehicleId={vehicle.id}
                initialActive={vehicle.active}
                plateNumber={vehicle.plate_number}
                code={vehicle.code}
                disabled={!canManage}
              />
            </div>

            <div className="mobile-card-body">
              <div className="mobile-card-lps">
                <strong>{vehicle.nama_lps || vehicle.lps_names || "Belum ditetapkan"}</strong>
                {vehicle.nama_ketua_lps && (
                  <span className="muted" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <User size={12} /> {vehicle.nama_ketua_lps}
                  </span>
                )}
              </div>

              <div className="mobile-card-meta-grid">
                <div>
                  <span className="meta-label">Kode & No. Izin</span>
                  <strong>{vehicle.code}</strong>
                  <small>{vehicle.nomor_izin || "-"}</small>
                </div>
                <div>
                  <span className="meta-label">Tare Acuan</span>
                  <strong>{vehicle.default_tare_kg ? `${formatNumber(vehicle.default_tare_kg)} kg` : "-"}</strong>
                  <small>{vehicle.kelurahan_lps || vehicle.kecamatan_lps || "-"}</small>
                </div>
              </div>

              {vehicle.wilayah_kerja && vehicle.wilayah_kerja !== "-" && (
                <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                  <MapPin size={12} />
                  <span>{vehicle.wilayah_kerja}</span>
                </div>
              )}
            </div>

            <div className="mobile-card-footer">
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Aksi Armada & QR:</span>
              <ArmadaRowActions vehicle={vehicle} lpsOptions={lps} canManage={canManage} />
            </div>
          </article>
        ))}

        {vehicles.length === 0 && (
          <article className="card empty">
            Tidak ada armada yang cocok dengan kriteria pencarian.
          </article>
        )}
      </div>
    </>
  );
}
