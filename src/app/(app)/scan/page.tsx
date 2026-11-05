import WeighingWorkspace from "@/components/WeighingWorkspace";
import { requireUser, isSuperAdmin } from "@/lib/auth";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await requireUser();
  const canManualInput = isSuperAdmin(user);
  const { token } = await searchParams;
  return (
    <div className="grid">
      <div className="page-head">
        <div>
          <h1>Scan QR & OCR Timbang</h1>
          <p>Pindai QR armada dengan kamera pertama, lalu baca angka merah LED indikator timbangan dengan kamera kedua.</p>
        </div>
        <span className={`badge ${canManualInput ? "green" : "orange"}`}>
          {canManualInput ? "Hak Akses: Master ADMIN" : "Hak Akses: Administrator (Wajib Scan QR — Input Plat Dinonaktifkan)"}
        </span>
      </div>
      <WeighingWorkspace initialToken={token} canManualInput={canManualInput} />
    </div>
  );
}
