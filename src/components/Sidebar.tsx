"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardCheck,
  Camera,
  FileSpreadsheet,
  Gauge,
  Lock,
  LogOut,
  Menu,
  QrCode,
  Truck,
  Usb,
  Users,
  X,
} from "lucide-react";
import { useUiMode } from "./UiModeProvider";
import UiModeSwitcher from "./UiModeSwitcher";

const items = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: BarChart3 },
  { href: "/scan", label: "Scan & Timbang", shortLabel: "Timbang", icon: Camera, highlight: true },
  { href: "/armada", label: "Master Armada", shortLabel: "Armada", icon: Truck, superAdminOnly: true },
  { href: "/transaksi", label: "Transaksi", shortLabel: "Transaksi", icon: Gauge },
  { href: "/laporan", label: "Rekap & Laporan", shortLabel: "Laporan", icon: FileSpreadsheet },
  { href: "/uji-qr", label: "Uji Semua QR", shortLabel: "Uji QR", icon: ClipboardCheck },
  { href: "/perangkat", label: "Koneksi Timbangan", shortLabel: "Perangkat", icon: Usb },
  { href: "/users", label: "User & Role Management", shortLabel: "Users", icon: Users, masterAdminOnly: true },
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
  const { isMobileMode } = useUiMode();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const roleUpper = (userRole || "").toUpperCase();
  const isSuper = roleUpper === "SUPER_ADMIN" || roleUpper === "SUPERADMIN";
  const isTxAdmin = roleUpper === "ADMIN_TRANSAKSI";
  const isAdmin = roleUpper === "ADMIN" || roleUpper === "ADMINISTRATOR";

  const roleBadge = isSuper ? (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 700,
        backgroundColor: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fde68a",
      }}
    >
      👑 Master ADMIN
    </span>
  ) : isTxAdmin ? (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 600,
        backgroundColor: "#ecfdf5",
        color: "#065f46",
        border: "1px solid #a7f3d0",
      }}
    >
      📊 Admin Transaksi
    </span>
  ) : isAdmin ? (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 600,
        backgroundColor: "#eff6ff",
        color: "#1e40af",
        border: "1px solid #bfdbfe",
      }}
    >
      🛡️ Administrator
    </span>
  ) : (
    <span className="badge" style={{ fontSize: "10px", padding: "1px 6px" }}>
      {userRole}
    </span>
  );

  // Filter out disabled items for the mobile bottom bar so all 4 bottom tabs are active
  const primaryBottomItems = items
    .filter((item) => (!item.superAdminOnly && !item.masterAdminOnly) || isSuper)
    .slice(0, 4);

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="sidebar desktop-sidebar">
        <div className="brand">
          <div className="brand-mark">
            <QrCode size={23} />
          </div>
          <div>
            <strong>TimbangQR</strong>
            <small>Harapan Jaya · Desktop UI</small>
          </div>
        </div>
        <div className="nav-section">Operasional</div>
        <nav>
          {items.map((item) => {
            if (item.masterAdminOnly && !isSuper) {
              return null;
            }
            const Icon = item.icon;
            const isDisabled = Boolean(item.superAdminOnly && !isSuper);
            const active = !isDisabled && (pathname === item.href || pathname.startsWith(item.href + "/"));

            if (isDisabled) {
              return (
                <div
                  key={item.href}
                  className="nav-link disabled"
                  title="Menu Master Armada dinonaktifkan untuk Administrator LPS (Khusus Master ADMIN)"
                  aria-disabled="true"
                  style={{
                    opacity: 0.42,
                    cursor: "not-allowed",
                    userSelect: "none",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Icon size={19} />
                    <span>{item.label}</span>
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.12)",
                      color: "#fcd34d",
                      fontWeight: 700,
                    }}
                  >
                    <Lock size={11} /> Nonaktif
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                className={`nav-link ${active ? "active" : ""}`}
                href={item.href}
                style={item.masterAdminOnly ? { justifyContent: "space-between" } : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Icon size={19} />
                  <span>{item.label}</span>
                </div>
                {item.masterAdminOnly && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 8,
                      background: "rgba(254, 243, 199, 0.18)",
                      color: "#fde68a",
                      fontWeight: 700,
                    }}
                  >
                    👑
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <strong>{userName}</strong>
          <span>{userEmail}</span>
          {userRole && <div style={{ marginTop: 6 }}>{roleBadge}</div>}
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {isMobileMode && (
        <nav className="mobile-bottom-nav no-print" aria-label="Navigasi Bawah Mobile">
          {primaryBottomItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-nav-item ${active ? "active" : ""} ${item.highlight ? "highlight" : ""}`}
                onClick={() => setDrawerOpen(false)}
              >
                <div className="mobile-nav-icon">
                  <Icon size={item.highlight ? 20 : 18} />
                </div>
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={`mobile-nav-item ${drawerOpen ? "active" : ""}`}
            onClick={() => setDrawerOpen((prev) => !prev)}
          >
            <div className="mobile-nav-icon">
              {drawerOpen ? <X size={18} /> : <Menu size={18} />}
            </div>
            <span>Menu</span>
          </button>
        </nav>
      )}

      {/* MOBILE SLIDE-UP MENU DRAWER */}
      {isMobileMode && drawerOpen && (
        <div className="mobile-drawer-backdrop no-print" onClick={() => setDrawerOpen(false)}>
          <div className="mobile-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="brand-mark" style={{ width: 38, height: 38, borderRadius: 11 }}>
                  <QrCode size={19} color="#fff" />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: 15, color: "#15231c" }}>TimbangQR Harapan Jaya</strong>
                  <span style={{ fontSize: 12, color: "#66756d" }}>Menu Operasional Mobile</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDrawerOpen(false)}
                style={{ minHeight: 34, padding: "6px 10px" }}
              >
                <X size={16} /> Tutup
              </button>
            </div>

            <div className="mobile-drawer-user">
              <div>
                <strong style={{ display: "block", fontSize: 14 }}>{userName}</strong>
                <span style={{ fontSize: 12, color: "#66756d" }}>{userEmail}</span>
              </div>
              {userRole && <div>{roleBadge}</div>}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f4f7f5", borderRadius: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#435249" }}>Mode Tampilan:</span>
              <UiModeSwitcher compact />
            </div>

            <div className="mobile-drawer-grid">
              {items.map((item) => {
                if (item.masterAdminOnly && !isSuper) {
                  return null;
                }
                const Icon = item.icon;
                const isDisabled = Boolean(item.superAdminOnly && !isSuper);
                const active = !isDisabled && (pathname === item.href || pathname.startsWith(item.href + "/"));

                if (isDisabled) {
                  return (
                    <div
                      key={item.href}
                      className="mobile-drawer-link"
                      title="Menu Master Armada dinonaktifkan untuk Administrator LPS"
                      style={{
                        opacity: 0.5,
                        cursor: "not-allowed",
                        background: "#f1f5f9",
                        color: "#64748b",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Icon size={17} />
                        <span>{item.label}</span>
                      </div>
                      <Lock size={14} color="#d97706" />
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mobile-drawer-link ${active ? "active" : ""}`}
                    onClick={() => setDrawerOpen(false)}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <form action="/api/auth/logout" method="post" style={{ marginTop: 14 }}>
              <button className="btn btn-danger" type="submit" style={{ width: "100%" }}>
                <LogOut size={16} /> Keluar dari Akun
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
