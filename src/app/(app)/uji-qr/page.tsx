import { ClipboardCheck } from "lucide-react";
import master from "../../../../data/master_armada_harapan_jaya_okt2026.json";
import FleetQrAudit from "@/components/FleetQrAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function LiveQrAuditPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Verifikasi QR Seluruh Armada</h1>
          <p>Pengujian langsung pada aplikasi Vercel produksi Harapan Jaya.</p>
        </div>
        <span className="badge green"><ClipboardCheck size={14} /> Pemeriksaan operasional</span>
      </div>
      <FleetQrAudit fleet={master} />
    </>
  );
}
