"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardCheck,
  Camera,
  FileSpreadsheet,
  Gauge,
  QrCode,
  Truck,
  Usb,
} from "lucide-react";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/scan", label: "Scan & Timbang", icon: Camera },
  { href: "/uji-qr", label: "Uji Semua QR", icon: ClipboardCheck },
  { href: "/armada", label: "Master Armada", icon: Truck },
  { href: "/transaksi", label: "Transaksi", icon: Gauge },
  { href: "/laporan", label: "Rekap & Laporan", icon: FileSpreadsheet },
  { href: "/perangkat", label: "Koneksi Timbangan", icon: Usb },
];

export default function Sidebar({
  userName,
  userEmail,
  userRole,
}: {
  userName: string;
  userEmail: string;
  userRole?: string;
}) {
  const pathname = usePathname();
  const roleUpper = (userRole || "").toUpperCase();
  const isSuper = roleUpper === "SUPER_ADMIN" || roleUpper === "SUPERADMIN";
  const isAdmin = roleUpper === "ADMIN" || roleUpper === "ADMINISTRATOR";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><QrCode size={23} /></div>
        <div>
          <strong>TimbangQR</strong>
          <small>Harapan Jaya</small>
        </div>
      </div>
      <div className="nav-section">Operasional</div>
      <nav>
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} className={`nav-link ${active ? "active" : ""}`} href={item.href}>
              <Icon size={19} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-user">
        <strong>{userName}</strong>
        <span>{userEmail}</span>
        {userRole && (
          <div style={{ marginTop: 6 }}>
            {isSuper ? (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                backgroundColor: "#fef3c7",
                color: "#92400e",
                border: "1px solid #fde68a"
              }}>
                👑 Super Admin
              </span>
            ) : isAdmin ? (
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 600,
                backgroundColor: "#eff6ff",
                color: "#1e40af",
                border: "1px solid #bfdbfe"
              }}>
                🛡️ Administrator
              </span>
            ) : (
              <span className="badge" style={{ fontSize: "10px", padding: "1px 6px" }}>
                {userRole}
              </span>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
