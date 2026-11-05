import { LogOut, QrCode } from "lucide-react";
import UiModeSwitcher from "./UiModeSwitcher";

export default function AppTopbar({
  userName,
  userRole,
}: {
  userName?: string;
  userRole?: string;
}) {
  const now = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  const roleUpper = (userRole || "").toUpperCase();
  const isSuper = roleUpper === "SUPER_ADMIN" || roleUpper === "SUPERADMIN";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-mobile-brand">
          <QrCode size={18} />
        </div>
        <div className="topbar-title">
          <strong>Transdepo Harapan Jaya</strong>
          <span className="topbar-date">{now}</span>
          {userName && (
            <span className="topbar-mobile-user">
              {isSuper ? "👑 Master ADMIN" : "🛡️ Administrator"} · {userName}
            </span>
          )}
        </div>
      </div>

      <div className="topbar-actions">
        <UiModeSwitcher />
        <form action="/api/auth/logout" method="post">
          <button className="btn btn-secondary btn-sm topbar-logout-btn" type="submit" title="Keluar dari akun">
            <LogOut size={15} />
            <span className="logout-label">Keluar</span>
          </button>
        </form>
      </div>
    </header>
  );
}
