"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, Power, PowerOff, RefreshCw, Usb } from "lucide-react";

type RemoteReading = {
  id?: number | string;
  device_id?: number | string;
  device_code?: string;
  weight_kg?: number;
  stable?: boolean;
  indicator_raw?: string | null;
  recorded_at?: string | null;
};

type RemoteDevice = {
  id?: number | string;
  device_code?: string;
  location_name?: string;
  port_name?: string | null;
  connection_type?: string;
  baud_rate?: number;
  last_seen_at?: string | null;
  active?: boolean;
};

function dateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export default function RemoteSerialStatusPanel() {
  const [reading, setReading] = useState<RemoteReading | null>(null);
  const [device, setDevice] = useState<RemoteDevice | null>(null);
  const [serverLastSeen, setServerLastSeen] = useState<string | null>(null);
  const [serverBridgeOnline, setServerBridgeOnline] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/serial/latest", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membaca data timbangan dari Vercel.");
      setReading(data.reading || null);
      setDevice(data.device || null);
      setServerLastSeen(data.lastSeenAt || data.device?.last_seen_at || data.reading?.recorded_at || null);
      setServerBridgeOnline(Boolean(data.bridgeOnline));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca data timbangan dari Vercel.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const handleToggleActive = async (action: "connect" | "disconnect") => {
    setToggling(true);
    setActionFeedback(null);
    try {
      const response = await fetch("/api/serial/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, device_code: device?.device_code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mengubah status timbangan.");
      setActionFeedback(data.message || (action === "connect" ? "Timbangan berhasil diaktifkan." : "Timbangan berhasil didiskoneksi."));
      await refresh(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status timbangan.");
    } finally {
      setToggling(false);
    }
  };

  useEffect(() => {
    const initial = window.setTimeout(() => {
      setNow(Date.now());
      void refresh();
    }, 0);
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refresh(true);
    }, 5000);
    const clock = window.setInterval(() => setNow(Date.now()), 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, [refresh]);

  const isDeviceActive = device ? device.active !== false : true;
  const lastSeen = serverLastSeen || device?.last_seen_at || reading?.recorded_at || null;
  const isFresh = useMemo(() => {
    if (!isDeviceActive) return false;
    if (serverBridgeOnline) return true;
    if (!lastSeen) return false;
    const timestamp = Date.parse(lastSeen);
    if (Number.isNaN(timestamp)) return false;
    return now - timestamp <= 15 * 60 * 1000;
  }, [isDeviceActive, serverBridgeOnline, lastSeen, now]);

  const weight = reading?.weight_kg;
  const raw = reading?.indicator_raw || (isFresh ? "PING_TEST (Bridge Terhubung)" : "-");
  const deviceCode = device?.device_code || reading?.device_code || "TIMBANG-HJ-SERIAL-01";
  const portInfo = device?.port_name
    ? `${device.port_name} (${device.connection_type || "RS232"})`
    : `REMOTE / ${device?.connection_type || "RS232"}`;

  return (
    <div className="grid equal">
      <article className="card">
        <div className="card-head">
          <div>
            <h2>Status Bridge cloud</h2>
            <p>Status berdasarkan data terbaru yang benar-benar sudah diterima Vercel dan tersimpan di PostgreSQL.</p>
          </div>
          <span className={`badge ${!isDeviceActive ? "red" : isFresh ? "green" : "orange"}`}>
            <span className="dot" /> {!isDeviceActive ? "Timbangan dinonaktifkan" : isFresh ? "Bridge online" : (reading || device?.last_seen_at) ? "Menunggu sinyal baru" : "Belum ada data"}
          </span>
        </div>
        <div className="card-body">
          <div className="serial-status-grid">
            <div className="summary-item"><span>Perangkat</span><strong className="small-value">{deviceCode}</strong></div>
            <div className="summary-item"><span>Port / Mode</span><strong>{portInfo}</strong></div>
            <div className="summary-item"><span>Terakhir diterima</span><strong className="small-value">{dateTime(lastSeen)}</strong></div>
          </div>

          <div style={{ height: 14 }} />
          <div className="serial-note">
            <Cloud size={25} color="var(--primary)" />
            <div>
              <strong>COM dikontrol dari TimbangQR Bridge Windows</strong>
              <div className="muted">Vercel menerima pembacaan indikator & sinyal koneksi dari TimbangQR Bridge.</div>
              <div className="help">Panel ini memantau hasil kiriman Bridge melalui API aplikasi. Jika status Bridge online, jalur indikator → Bridge → Vercel → PostgreSQL sudah terhubung.</div>
            </div>
          </div>

          <div className="serial-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="btn btn-secondary" type="button" onClick={() => void refresh()} disabled={loading || toggling}>
              <RefreshCw size={16} /> Perbarui sekarang
            </button>
            {!isDeviceActive ? (
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void handleToggleActive("connect")}
                disabled={toggling}
                style={{ background: "#08784f", borderColor: "#08784f", color: "#fff" }}
              >
                <Power size={16} /> {toggling ? "Mengaktifkan..." : "Aktivasi Timbangan"}
              </button>
            ) : (
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => void handleToggleActive("disconnect")}
                disabled={toggling}
                style={{ borderColor: "#fca5a5" }}
              >
                <PowerOff size={16} /> {toggling ? "Memproses..." : "Diskoneksi Timbangan"}
              </button>
            )}
          </div>

          {!isDeviceActive && (
            <div style={{ background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginTop: 14, color: "#991b1b", fontSize: 13, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Timbangan Dinonaktifkan (Manual)</strong>
                <div style={{ marginTop: 2, color: "#7f1d1d" }}>
                  Sinyal dari TimbangQR Bridge dijeda dan tidak diterima oleh server Vercel. Klik tombol <b>Aktivasi Timbangan</b> di atas saat jembatan timbang siap digunakan kembali.
                </div>
              </div>
            </div>
          )}

          {actionFeedback && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginTop: 14, color: "#166534", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} /> {actionFeedback}
            </div>
          )}

          {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
        </div>
      </article>

      <article className="card">
        <div className="card-head">
          <div><h2>Pembacaan dari Vercel</h2><p>Nilai terbaru dari tabel device_readings.</p></div>
          <Usb size={21} />
        </div>
        <div className="card-body">
          <div className="weight-display compact-weight">
            <div>
              <strong style={{ color: !isDeviceActive ? "#94a3b8" : undefined }}>
                {!isDeviceActive ? "0" : weight == null ? "0" : new Intl.NumberFormat("id-ID").format(weight)}
              </strong>
              <span>
                {!isDeviceActive
                  ? "TIMBANGAN DINONAKTIFKAN (MANUAL)"
                  : reading?.stable
                    ? "BERAT STABIL · KG"
                    : weight == null
                      ? (isFresh ? "BRIDGE ONLINE · MENUNGGU BEBAN (KG)" : "MENUNGGU DATA · KG")
                      : "BERAT BELUM STABIL · KG"}
              </span>
            </div>
          </div>
          <div className="field">
            <label>String mentah indikator</label>
            <div className="code serial-raw">
              {!isDeviceActive ? "TIMBANGAN DINONAKTIFKAN · KLIK AKTIVASI UNTUK MENYAMBUNGKAN" : raw}
            </div>
          </div>
          <div className="help">Timestamp pembacaan: {dateTime(reading?.recorded_at || lastSeen)}</div>
        </div>
      </article>
    </div>
  );
}
