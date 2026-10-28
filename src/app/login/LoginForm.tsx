"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Zap } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Ambil parameter redirect dan yolo_url
  const redirectParam = searchParams.get("redirect") || searchParams.get("next") || "";
  const yoloUrlParam = searchParams.get("yolo_url") || searchParams.get("yoloUrl") || "";

  // Simpan yolo_url ke localStorage segera agar tidak hilang
  useEffect(() => {
    if (yoloUrlParam && typeof window !== "undefined") {
      localStorage.setItem("timbangqr_yolo_url", yoloUrlParam.trim());
    }
  }, [yoloUrlParam]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login gagal");

      // Tentukan target redirect: utamakan redirectParam, lalu scan jika ada yolo_url, atau dashboard
      let target = redirectParam;
      if (!target) {
        if (yoloUrlParam) {
          target = `/scan?yolo_url=${encodeURIComponent(yoloUrlParam)}`;
        } else {
          target = "/dashboard";
        }
      }

      router.replace(target);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <div>
        <h2>Masuk ke aplikasi</h2>
        <p>Gunakan akun operator atau administrator.</p>
      </div>

      {yoloUrlParam && (
        <div style={{
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          borderRadius: 8,
          padding: "10px 12px",
          fontSize: 12,
          color: "#065f46",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14
        }}>
          <Zap size={16} color="#059669" />
          <div>
            <strong>Koneksi YOLO AI Cloud Aktif</strong>
            <div style={{ fontSize: 11, color: "#047857" }}>
              Setelah masuk, Anda akan otomatis dialihkan ke halaman Scan & Timbang.
            </div>
          </div>
        </div>
      )}

      <div className="field">
        <label>Email</label>
        <input
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="email@lps.local"
          required
        />
      </div>
      <div className="field">
        <label>Kata sandi</label>
        <input
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="••••••••"
          required
        />
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary" disabled={loading} type="submit" style={{ marginTop: 8 }}>
        <LogIn size={18} /> {loading ? "Memeriksa..." : yoloUrlParam ? "Masuk & Lanjut ke Timbang" : "Masuk"}
      </button>
    </form>
  );
}
