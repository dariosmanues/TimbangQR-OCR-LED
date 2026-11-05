import Link from "next/link";
import { BarChart3, Camera, Lock, ShieldCheck, Users } from "lucide-react";
import UserRoleManager from "@/components/UserRoleManager";
import { getSession, isSuperAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function UsersRoleManagementPage() {
  const user = await getSession();
  const canManage = isSuperAdmin(user);

  if (!user || !canManage) {
    return (
      <article
        className="card"
        style={{
          maxWidth: 640,
          margin: "32px auto",
          textAlign: "center",
          padding: "36px 24px",
        }}
      >
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
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>
          Akses Khusus Master ADMIN
        </h1>
        <p
          className="muted"
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            margin: "0 auto 24px",
            maxWidth: 480,
          }}
        >
          Menu <strong>User & Role Management</strong> hanya dapat diakses oleh akun{" "}
          <strong>👑 Master ADMIN</strong> untuk mengelola akun pengguna dan pembagian hak akses.
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

  return (
    <>
      <div className="page-head">
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
              flexWrap: "wrap",
            }}
          >
            <span
              className="badge"
              style={{
                background: "#fef3c7",
                color: "#92400e",
                border: "1px solid #fde68a",
                fontWeight: 700,
              }}
            >
              👑 Khusus Master ADMIN
            </span>
            <span className="badge green">
              <ShieldCheck size={14} /> KONTROL AKSES & ROLE SISTEM
            </span>
          </div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={26} /> User & Role Management
          </h1>
          <p>
            Kelola akun pengguna, atur pembagian role (<strong>Master ADMIN</strong>,{" "}
            <strong>Administrator LPS</strong>, <strong>Admin Transaksi</strong>), aktifkan/nonaktifkan akses login, dan reset password.
          </p>
        </div>
      </div>

      <UserRoleManager currentUserId={user.id} />
    </>
  );
}

