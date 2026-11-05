import { requireUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import AppTopbar from "@/components/AppTopbar";
import { UiModeProvider } from "@/components/UiModeProvider";

export const runtime = "nodejs";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <UiModeProvider>
      <div className="app-shell">
        <Sidebar userName={user.name} userEmail={user.email} userRole={user.role} />
        <main className="main">
          <AppTopbar userName={user.name} userRole={user.role} />
          <div className="content">{children}</div>
        </main>
      </div>
    </UiModeProvider>
  );
}
