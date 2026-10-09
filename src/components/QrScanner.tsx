"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Keyboard, RefreshCw, ScanLine, Sparkles, Upload } from "lucide-react";

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
      };
      getSupportedFormats?: () => Promise<string[]>;
    };
    webkitAudioContext?: typeof AudioContext;
  }
}

function tokenFromValue(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const token = url.searchParams.get("token");
    if (token) return token;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length > 0) {
      return decodeURIComponent(parts[parts.length - 1]);
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

export default function QrScanner({ onToken }: { onToken: (token: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isDecodingRef = useRef(false);

  const [message, setMessage] = useState("Tekan aktifkan kamera untuk memindai QR.");
  const [manual, setManual] = useState("");
  const [active, setActive] = useState(false);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [uploading, setUploading] = useState(false);

  const refreshCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const next = devices.filter((device) => device.kind === "videoinput");
      setCameras(next);
      setCameraId((current) => current || next[0]?.deviceId || "");
    } catch {}
  }, []);

  const stop = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {}
      zxingControlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const handleDetected = useCallback(
    (rawVal: string, sourceName = "Scanner") => {
      if (isDecodingRef.current) return;
      isDecodingRef.current = true;

      const token = tokenFromValue(rawVal);
      playBeep();
      setSuccessCode(token);
      setMessage(`QR berhasil terbaca (${sourceName}): ${token}`);
      stop();

      setTimeout(() => {
        onToken(token);
        isDecodingRef.current = false;
      }, 400);
    },
    [onToken, stop]
  );

  async function start() {
    setMessage("Meminta izin kamera HD...");
    setActive(true);
    setSuccessCode(null);
    isDecodingRef.current = false;

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: cameraId ? { exact: cameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: "environment" },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      await refreshCameras();
      setMessage("Kamera aktif. Arahkan QR armada atau layar HP ke dalam kotak.");

      // Setup Tier 1: Native BarcodeDetector (Chrome/Edge hardware ML)
      let nativeDetector: any = null;
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          nativeDetector = new window.BarcodeDetector!({ formats: ["qr_code"] });
        } catch {
          nativeDetector = null;
        }
      }

      // Setup Tier 2: ZXing Reader
      let zxingReader: any = null;
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        zxingReader = new BrowserQRCodeReader();
        zxingControlsRef.current = await zxingReader.decodeFromVideoElement(
          videoRef.current,
          (result: any) => {
            if (result && !isDecodingRef.current) {
              handleDetected(result.getText(), "ZXing");
            }
          }
        );
      } catch {}

      // Setup Tier 1 loop & Tier 3 Server-Assisted Fallback loop (OpenCV CLAHE)
      let frameCount = 0;
      let serverCheckBusy = false;

      scanIntervalRef.current = setInterval(async () => {
        if (isDecodingRef.current || !videoRef.current) return;
        frameCount++;

        // 1. Native BarcodeDetector check (Fast ~50ms)
        if (nativeDetector && videoRef.current.readyState >= 2) {
          try {
            const barcodes = await nativeDetector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
              handleDetected(barcodes[0].rawValue, "Hardware ML");
              return;
            }
          } catch {}
        }

        // 2. Server-Assisted OpenCV check every 350ms (frameCount % 4)
        if (frameCount % 4 === 0 && !serverCheckBusy && videoRef.current.readyState >= 2) {
          serverCheckBusy = true;
          try {
            const v = videoRef.current;
            if (v.videoWidth > 0 && v.videoHeight > 0) {
              const canvas = document.createElement("canvas");
              const maxDim = 800;
              let w = v.videoWidth;
              let h = v.videoHeight;
              if (w > maxDim || h > maxDim) {
                if (w > h) {
                  h = Math.round((h * maxDim) / w);
                  w = maxDim;
                } else {
                  w = Math.round((w * maxDim) / h);
                  h = maxDim;
                }
              }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(v, 0, 0, w, h);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                const res = await fetch("/api/qr-decode", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ image: dataUrl }),
                });
                if (res.ok) {
                  const data = await res.json();
                  if (data.success && data.text && !isDecodingRef.current) {
                    handleDetected(data.text, "OpenCV Vision");
                    return;
                  }
                }
              }
            }
          } catch {} finally {
            serverCheckBusy = false;
          }
        }
      }, 90);
    } catch (error) {
      stop();
      setMessage(error instanceof Error ? error.message : "Kamera tidak dapat diaktifkan.");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("Membaca gambar QR...");

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) {
          setUploading(false);
          return;
        }

        // 1. Try server-assisted OpenCV decoder
        try {
          const res = await fetch("/api/qr-decode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.text) {
              setUploading(false);
              handleDetected(data.text, "Foto/File");
              return;
            }
          }
        } catch {}

        // 2. Fallback to client BarcodeDetector or ZXing
        const img = new Image();
        img.onload = async () => {
          if (typeof window !== "undefined" && "BarcodeDetector" in window) {
            try {
              const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
              const barcodes = await detector.detect(img);
              if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
                setUploading(false);
                handleDetected(barcodes[0].rawValue, "Foto/Hardware");
                return;
              }
            } catch {}
          }

          try {
            const { BrowserQRCodeReader } = await import("@zxing/browser");
            const codeReader = new BrowserQRCodeReader();
            const result = await codeReader.decodeFromImageElement(img);
            if (result) {
              setUploading(false);
              handleDetected(result.getText(), "Foto/ZXing");
              return;
            }
          } catch {}

          setUploading(false);
          setMessage("QR code tidak ditemukan di dalam gambar yang diunggah.");
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploading(false);
      setMessage("Gagal membaca file gambar: " + (err?.message || ""));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>1. Pindai QR armada</h2>
          <p>Gunakan webcam laptop, kamera HP, atau unggah foto/screenshot QR armada.</p>
        </div>
      </div>
      <div className="card-body">
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Kamera QR</label>
          <div style={{ display: "flex", gap: 9 }}>
            <select
              className="select"
              value={cameraId}
              onChange={(event) => setCameraId(event.target.value)}
              disabled={active}
            >
              {cameras.length ? (
                cameras.map((camera, index) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Kamera ${index + 1}`}
                  </option>
                ))
              ) : (
                <option value="">Kamera Utama / Default</option>
              )}
            </select>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => void refreshCameras()}
              disabled={active}
              title="Muat ulang daftar kamera"
              aria-label="Muat ulang daftar kamera"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="scanner" style={{ position: "relative" }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              position: "absolute",
              inset: 0,
            }}
          />

          {/* Scanner viewfinder frame */}
          <div
            className={`scanner-frame ${active && !successCode ? "is-scanning" : ""}`}
            style={{
              borderColor: successCode ? "#10b981" : "#36e49e",
              boxShadow: successCode
                ? "0 0 25px rgba(16, 185, 129, 0.8), 0 0 0 999px rgba(0,0,0,.45)"
                : "0 0 0 999px rgba(0,0,0,.38)",
              transition: "all 0.3s ease",
            }}
          >
            {successCode ? (
              <CheckCircle2
                size={48}
                style={{
                  position: "absolute",
                  inset: "calc(50% - 24px)",
                  color: "#10b981",
                }}
              />
            ) : (
              <ScanLine
                size={34}
                style={{
                  position: "absolute",
                  inset: "calc(50% - 17px)",
                  color: "#36e49e",
                  opacity: active ? 1 : 0.6,
                }}
              />
            )}
          </div>

          <div
            className="scanner-copy"
            style={{
              background: successCode
                ? "rgba(16, 185, 129, 0.9)"
                : "rgba(0, 0, 0, 0.7)",
              padding: "6px 12px",
              borderRadius: "8px",
              backdropFilter: "blur(4px)",
              color: "#fff",
              fontWeight: 500,
            }}
          >
            {message}
          </div>
        </div>

        <div style={{ display: "flex", gap: 9, marginTop: 12, flexWrap: "wrap" }}>
          {!active ? (
            <button className="btn btn-primary" type="button" onClick={start}>
              <Camera size={17} /> Aktifkan kamera
            </button>
          ) : (
            <button
              className="btn btn-danger"
              type="button"
              onClick={() => {
                stop();
                setMessage("Kamera dihentikan.");
              }}
            >
              Hentikan kamera
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Unggah file foto atau screenshot QR"
          >
            <Upload size={16} /> {uploading ? "Menganalisis..." : "Unggah Foto QR"}
          </button>
        </div>

        <div style={{ height: 16 }} />

        <div className="field">
          <label>
            <Keyboard size={14} style={{ verticalAlign: "middle" }} /> Input Nopol / Kode / Token Manual
          </label>
          <div style={{ display: "flex", gap: 9 }}>
            <input
              className="input"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manual.trim()) {
                  e.preventDefault();
                  onToken(tokenFromValue(manual));
                }
              }}
              placeholder="Contoh: BM 8106 QP atau ARM-HJ-0001 atau token..."
            />
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => manual.trim() && onToken(tokenFromValue(manual))}
            >
              Buka
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
