"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";

export interface ManagedUser {
  id: number;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | "ADMIN_TRANSAKSI" | string;
  active: boolean;
  created_at: string;
  tx_count: number;
}

const ROLE_OPTIONS = [
  {
    value: "SUPER_ADMIN",
    label: "👑 Master ADMIN",
    shortLabel: "Master ADMIN",
    badgeBg: "#fef3c7",
    badgeColor: "#92400e",
    badgeBorder: "#fde68a",
    description:
      "Akses penuh ke seluruh sistem: Scan & Input Manual, CRUD Transaksi, CRUD Master Armada, Rekap Laporan, dan Manajemen User & Role.",
  },
  {
    value: "ADMIN",
    label: "🛡️ Administrator LPS",
    shortLabel: "Administrator LPS",
    badgeBg: "#eff6ff",
    badgeColor: "#1e40af",
    badgeBorder: "#bfdbfe",
    description:
      "Akses operasional timbangan: Scan QR Kamera/Gambar, Simpan Timbangan, Cetak Struk, Lihat Transaksi & Laporan. Menu Master Armada, Input Plat Manual, dan Hapus/Edit Transaksi dikunci.",
  },
  {
    value: "ADMIN_TRANSAKSI",
    label: "📊 Admin Transaksi",
    shortLabel: "Admin Transaksi",
    badgeBg: "#ecfdf5",
    badgeColor: "#065f46",
    badgeBorder: "#a7f3d0",
    description:
      "Akses monitoring operasional, rekap transaksi, laporan harian/bulanan, dan cetak tiket timbangan.",
  },
] as const;

const PERMISSION_MATRIX = [
  {
    feature: "Dashboard & Statistik Timbangan",
    SUPER_ADMIN: true,
    ADMIN: true,
    ADMIN_TRANSAKSI: true,
  },
  {
    feature: "Scan & Timbang via QR (Kamera / Gambar)",
    SUPER_ADMIN: true,
    ADMIN: true,
    ADMIN_TRANSAKSI: true,
  },
  {
    feature: "Input Nomor Plat Manual (Tanpa Scan QR)",
    SUPER_ADMIN: true,
    ADMIN: false,
    ADMIN_TRANSAKSI: false,
  },
  {
    feature: "Lihat Riwayat Transaksi & Cetak Struk",
    SUPER_ADMIN: true,
    ADMIN: true,
    ADMIN_TRANSAKSI: true,
  },
  {
    feature: "Tambah / Edit / Hapus Transaksi",
    SUPER_ADMIN: true,
    ADMIN: false,
    ADMIN_TRANSAKSI: false,
  },
  {
    feature: "Menu & Kelola Master Armada (/armada)",
    SUPER_ADMIN: true,
    ADMIN: false,
    ADMIN_TRANSAKSI: false,
  },
  {
    feature: "Rekap & Export Laporan (Excel / PDF)",
    SUPER_ADMIN: true,
    ADMIN: true,
    ADMIN_TRANSAKSI: true,
  },
  {
    feature: "User & Role Management (/users)",
    SUPER_ADMIN: true,
    ADMIN: false,
    ADMIN_TRANSAKSI: false,
  },
];

function getRoleMeta(role: string) {
  const norm = (role || "").toUpperCase();
  if (norm === "SUPER_ADMIN" || norm === "SUPERADMIN") return ROLE_OPTIONS[0];
  if (norm === "ADMIN_TRANSAKSI") return ROLE_OPTIONS[2];
  return ROLE_OPTIONS[1];
}

export default function UserRoleManager({ currentUserId }: { currentUserId: number }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [showMatrix, setShowMatrix] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<"SUPER_ADMIN" | "ADMIN" | "ADMIN_TRANSAKSI">("ADMIN");
  const [formPassword, setFormPassword] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memuat data user.");
      }
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data user.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesRole =
        roleFilter === "ALL" ||
        (roleFilter === "SUPER_ADMIN" &&
          (u.role.toUpperCase() === "SUPER_ADMIN" || u.role.toUpperCase() === "SUPERADMIN")) ||
        u.role.toUpperCase() === roleFilter;
      if (!matchesRole) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const superCount = users.filter((u) =>
      ["SUPER_ADMIN", "SUPERADMIN"].includes(u.role.toUpperCase())
    ).length;
    const adminCount = users.filter((u) => u.role.toUpperCase() === "ADMIN").length;
    const txAdminCount = users.filter((u) => u.role.toUpperCase() === "ADMIN_TRANSAKSI").length;
    const activeCount = users.filter((u) => u.active).length;
    return { total, superCount, adminCount, txAdminCount, activeCount };
  }, [users]);

  function openCreateModal() {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormRole("ADMIN");
    setFormPassword("");
    setFormActive(true);
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(user: ManagedUser) {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    const norm = user.role.toUpperCase();
    setFormRole(
      norm === "SUPER_ADMIN" || norm === "SUPERADMIN"
        ? "SUPER_ADMIN"
        : norm === "ADMIN_TRANSAKSI"
        ? "ADMIN_TRANSAKSI"
        : "ADMIN"
    );
    setFormPassword("");
    setFormActive(user.active);
    setError(null);
    setModalOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            email: formEmail.trim(),
            role: formRole,
            active: formActive,
            password: formPassword.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal memperbarui user.");
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? data.user : u)));
        setNotice(
          formPassword.trim()
            ? `User "${data.user.name}" & password berhasil diperbarui.`
            : `Data user "${data.user.name}" berhasil diperbarui.`
        );
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            email: formEmail.trim(),
            role: formRole,
            password: formPassword.trim(),
            active: formActive,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal membuat user baru.");
        setUsers((prev) => [...prev, data.user]);
        setNotice(`User baru "${data.user.name}" (${data.user.email}) berhasil ditambahkan.`);
      }
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickRoleChange(
    user: ManagedUser,
    nextRole: "SUPER_ADMIN" | "ADMIN" | "ADMIN_TRANSAKSI"
  ) {
    if (user.id === currentUserId && nextRole !== "SUPER_ADMIN") {
      setError("Anda tidak dapat menurunkan role akun Master ADMIN yang sedang Anda gunakan.");
      return;
    }
    setBusyId(user.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah role user.");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
      setNotice(`Role untuk "${user.name}" berhasil diubah menjadi ${getRoleMeta(nextRole).label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah role.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(user: ManagedUser) {
    if (user.id === currentUserId && user.active) {
      setError("Anda tidak dapat menonaktifkan akun Master ADMIN yang sedang Anda gunakan.");
      return;
    }
    setBusyId(user.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status akun.");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
      setNotice(
        `Status akun "${user.name}" berhasil diubah menjadi ${
          data.user.active ? "Aktif" : "Nonaktif"
        }.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status akun.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteUser(user: ManagedUser) {
    if (user.id === currentUserId) {
      setError("Anda tidak dapat menghapus akun Master ADMIN yang sedang Anda gunakan.");
      return;
    }
    const ok = window.confirm(
      `Hapus akun user "${user.name}" (${user.email})?\n\nRiwayat transaksi penimbangan yang pernah dicatat oleh user ini akan tetap tersimpan dengan aman.`
    );
    if (!ok) return;

    setBusyId(user.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus user.");
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setNotice(data.message || `User "${user.name}" berhasil dihapus.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus user.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* KPI CARDS */}
      <div className="kpi-grid">
        <div className="card kpi-card">
          <span>Total Akun Terdaftar</span>
          <strong>{stats.total}</strong>
          <small>{stats.activeCount} akun aktif dapat login</small>
        </div>
        <div className="card kpi-card" style={{ borderLeft: "4px solid #f59e0b" }}>
          <span>👑 Master ADMIN</span>
          <strong>{stats.superCount}</strong>
          <small>Akses penuh seluruh fitur & master data</small>
        </div>
        <div className="card kpi-card" style={{ borderLeft: "4px solid #2563eb" }}>
          <span>🛡️ Administrator LPS</span>
          <strong>{stats.adminCount}</strong>
          <small>Akses operasional scan QR & cetak tiket</small>
        </div>
        <div className="card kpi-card" style={{ borderLeft: "4px solid #059669" }}>
          <span>📊 Admin Transaksi</span>
          <strong>{stats.txAdminCount}</strong>
          <small>Akses monitoring transaksi & rekap laporan</small>
        </div>
      </div>

      {/* NOTICES & ERRORS */}
      {notice && (
        <div
          className="alert alert-success"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderRadius: 12,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            fontWeight: 600,
          }}
        >
          <span>✅ {notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#065f46" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div
          className="alert alert-danger"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderRadius: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontWeight: 600,
          }}
        >
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#991b1b" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ROLE PERMISSION MATRIX CARD */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: showMatrix ? 14 : 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#fef3c7",
                color: "#92400e",
                display: "grid",
                placeItems: "center",
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Matriks Hak Akses Role (Role Permissions)</h3>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                Pengaturan pembagian wewenang antara Master ADMIN, Administrator LPS, dan Admin Transaksi
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowMatrix((v) => !v)}
          >
            {showMatrix ? "Sembunyikan Matriks" : "Tampilkan Matriks"}
          </button>
        </div>

        {showMatrix && (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Fitur / Modul Sistem</th>
                  <th style={{ textAlign: "center" }}>👑 Master ADMIN</th>
                  <th style={{ textAlign: "center" }}>🛡️ Administrator LPS</th>
                  <th style={{ textAlign: "center" }}>📊 Admin Transaksi</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MATRIX.map((row) => (
                  <tr key={row.feature}>
                    <td style={{ fontWeight: 600 }}>{row.feature}</td>
                    <td style={{ textAlign: "center" }}>
                      {row.SUPER_ADMIN ? (
                        <span style={{ color: "#15803d", fontWeight: 700 }}>✅ Diizinkan</span>
                      ) : (
                        <span style={{ color: "#b91c1c", fontWeight: 600 }}>🔒 Dikunci</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {row.ADMIN ? (
                        <span style={{ color: "#15803d", fontWeight: 700 }}>✅ Diizinkan</span>
                      ) : (
                        <span style={{ color: "#b91c1c", fontWeight: 600 }}>🔒 Dikunci</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {row.ADMIN_TRANSAKSI ? (
                        <span style={{ color: "#15803d", fontWeight: 700 }}>✅ Diizinkan</span>
                      ) : (
                        <span style={{ color: "#b91c1c", fontWeight: 600 }}>🔒 Dikunci</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* USER LIST & CONTROLS */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <h2 className="card-title" style={{ marginBottom: 4 }}>
              Daftar Akun User & Pengaturan Role
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Ubah role secara langsung, atur status aktif/nonaktif, reset password, atau tambahkan akun baru.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchUsers}
              disabled={loading}
            >
              <RefreshCw size={16} /> Segarkan
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreateModal}>
              <UserPlus size={16} /> + Tambah User Baru
            </button>
          </div>
        </div>

        {/* FILTER BAR */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ position: "relative" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#64748b",
              }}
            />
            <input
              type="text"
              className="input"
              placeholder="Cari nama user atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: "100%" }}
            />
          </div>
          <select
            className="input"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">Semua Role ({users.length})</option>
            <option value="SUPER_ADMIN">👑 Master ADMIN ({stats.superCount})</option>
            <option value="ADMIN">🛡️ Administrator LPS ({stats.adminCount})</option>
            <option value="ADMIN_TRANSAKSI">📊 Admin Transaksi ({stats.txAdminCount})</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
            Memuat data user & role...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
            Tidak ada user yang cocok dengan pencarian Anda.
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE VIEW */}
            <div className="table-wrap desktop-only-view">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nama & Email User</th>
                    <th>Role Sistem (Ubah Cepat)</th>
                    <th>Status Akun</th>
                    <th>Riwayat Timbang</th>
                    <th>Terdaftar</th>
                    <th style={{ textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const meta = getRoleMeta(user.role);
                    const isSelf = user.id === currentUserId;
                    const isBusy = busyId === user.id;
                    const normalizedRole =
                      user.role.toUpperCase() === "SUPERADMIN"
                        ? "SUPER_ADMIN"
                        : (user.role.toUpperCase() as "SUPER_ADMIN" | "ADMIN" | "ADMIN_TRANSAKSI");

                    return (
                      <tr key={user.id} style={{ opacity: user.active ? 1 : 0.6 }}>
                        <td className="mono">#{user.id}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <strong>{user.name}</strong>
                            {isSelf && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  background: "#dcfce7",
                                  color: "#166534",
                                }}
                              >
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="muted mono" style={{ fontSize: 12 }}>
                            {user.email}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <select
                              className="input"
                              disabled={isSelf || isBusy}
                              value={normalizedRole}
                              onChange={(e) =>
                                handleQuickRoleChange(
                                  user,
                                  e.target.value as "SUPER_ADMIN" | "ADMIN" | "ADMIN_TRANSAKSI"
                                )
                              }
                              style={{
                                padding: "6px 10px",
                                fontSize: 12,
                                fontWeight: 700,
                                borderRadius: 10,
                                backgroundColor: meta.badgeBg,
                                color: meta.badgeColor,
                                borderColor: meta.badgeBorder,
                                minWidth: 185,
                                cursor: isSelf ? "not-allowed" : "pointer",
                              }}
                              title={
                                isSelf
                                  ? "Role akun Master ADMIN yang sedang digunakan tidak dapat diubah"
                                  : "Klik untuk mengubah role user ini"
                              }
                            >
                              {ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            disabled={isSelf || isBusy}
                            onClick={() => handleToggleActive(user)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "5px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              border: user.active ? "1px solid #86efac" : "1px solid #fecaca",
                              background: user.active ? "#f0fdf4" : "#fef2f2",
                              color: user.active ? "#15803d" : "#b91c1c",
                              cursor: isSelf ? "not-allowed" : "pointer",
                            }}
                            title={
                              isSelf
                                ? "Tidak dapat menonaktifkan akun sendiri"
                                : "Klik untuk mengaktifkan / menonaktifkan akun"
                            }
                          >
                            {user.active ? (
                              <>
                                <CheckCircle2 size={13} /> Aktif
                              </>
                            ) : (
                              <>
                                <XCircle size={13} /> Nonaktif
                              </>
                            )}
                          </button>
                        </td>
                        <td>
                          <span className="badge">{user.tx_count} transaksi</span>
                        </td>
                        <td className="muted" style={{ fontSize: 12 }}>
                          {new Date(user.created_at).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditModal(user)}
                              disabled={isBusy}
                              title="Edit Nama, Email, Role, atau Reset Password"
                            >
                              <Pencil size={14} /> Edit / Password
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleDeleteUser(user)}
                                disabled={isBusy}
                                title="Hapus User"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARD VIEW */}
            <div className="mobile-only-view" style={{ display: "grid", gap: 12 }}>
              {filteredUsers.map((user) => {
                const meta = getRoleMeta(user.role);
                const isSelf = user.id === currentUserId;
                const isBusy = busyId === user.id;
                const normalizedRole =
                  user.role.toUpperCase() === "SUPERADMIN"
                    ? "SUPER_ADMIN"
                    : (user.role.toUpperCase() as "SUPER_ADMIN" | "ADMIN" | "ADMIN_TRANSAKSI");

                return (
                  <div
                    key={user.id}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: "1px solid #e2e8f0",
                      background: user.active ? "#ffffff" : "#f8fafc",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <strong style={{ fontSize: 15 }}>{user.name}</strong>
                          {isSelf && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: 6,
                                background: "#dcfce7",
                                color: "#166534",
                              }}
                            >
                              Anda
                            </span>
                          )}
                        </div>
                        <div className="muted mono" style={{ fontSize: 12 }}>
                          {user.email}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isSelf || isBusy}
                        onClick={() => handleToggleActive(user)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          border: user.active ? "1px solid #86efac" : "1px solid #fecaca",
                          background: user.active ? "#f0fdf4" : "#fef2f2",
                          color: user.active ? "#15803d" : "#b91c1c",
                        }}
                      >
                        {user.active ? "Aktif" : "Nonaktif"}
                      </button>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>
                        Role Sistem:
                      </label>
                      <select
                        className="input"
                        disabled={isSelf || isBusy}
                        value={normalizedRole}
                        onChange={(e) =>
                          handleQuickRoleChange(
                            user,
                            e.target.value as "SUPER_ADMIN" | "ADMIN" | "ADMIN_TRANSAKSI"
                          )
                        }
                        style={{
                          width: "100%",
                          fontWeight: 700,
                          backgroundColor: meta.badgeBg,
                          color: meta.badgeColor,
                          borderColor: meta.badgeBorder,
                        }}
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: 8,
                        borderTop: "1px solid #f1f5f9",
                      }}
                    >
                      <span className="muted" style={{ fontSize: 12 }}>
                        {user.tx_count} transaksi dicatat
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(user)}
                          disabled={isBusy}
                        >
                          <Pencil size={14} /> Edit / Password
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteUser(user)}
                            disabled={isBusy}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* CREATE / EDIT USER MODAL */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => !submitting && setModalOpen(false)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 500, margin: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18 }}>
                {editingUser ? `Edit User: ${editingUser.name}` : "Tambah User Baru"}
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
                  Nama Lengkap / Jabatan User
                </label>
                <input
                  type="text"
                  className="input"
                  required
                  minLength={2}
                  placeholder="Contoh: Operator Timbangan Shift 1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
                  Email Login
                </label>
                <input
                  type="email"
                  className="input"
                  required
                  placeholder="Contoh: operator@lps.local"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
                  Role & Tingkat Hak Akses
                </label>
                <select
                  className="input"
                  value={formRole}
                  disabled={Boolean(editingUser && editingUser.id === currentUserId)}
                  onChange={(e) =>
                    setFormRole(e.target.value as "SUPER_ADMIN" | "ADMIN" | "ADMIN_TRANSAKSI")
                  }
                  style={{ width: "100%", fontWeight: 700 }}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <small className="muted" style={{ display: "block", marginTop: 6, fontSize: 12 }}>
                  {getRoleMeta(formRole).description}
                </small>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
                  <KeyRound size={13} style={{ display: "inline", marginRight: 5 }} />
                  {editingUser
                    ? "Password Baru (Kosongkan jika tidak ingin mengubah password)"
                    : "Password Login (Minimal 6 karakter)"}
                </label>
                <input
                  type="password"
                  className="input"
                  required={!editingUser}
                  minLength={editingUser ? undefined : 6}
                  placeholder={
                    editingUser
                      ? "Ketik password baru untuk reset password..."
                      : "Minimal 6 karakter"
                  }
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  cursor:
                    editingUser && editingUser.id === currentUserId ? "not-allowed" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={formActive}
                  disabled={Boolean(editingUser && editingUser.id === currentUserId)}
                  onChange={(e) => setFormActive(e.target.checked)}
                />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Akun Aktif (Diizinkan masuk ke sistem TimbangQR)
                </span>
              </label>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 6,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting
                    ? "Menyimpan..."
                    : editingUser
                    ? "Simpan Perubahan"
                    : "Buat Akun User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

