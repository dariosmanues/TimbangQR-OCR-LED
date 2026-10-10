"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Keyboard, RefreshCw, ScanLine, Sparkles, Upload } from "lucide-react";
import { tokenFromValue } from "@/lib/qr-token";
import { decodeQrRgba } from "@/lib/qr-image-decode";

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

/** Decode an uploaded image locally. Works without the YOLO/OpenCV server. */
function decodeUploadedQr(img: HTMLImageElement): string | null {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) return null;
  const maxDim = Math.max(width, height);
  const plans = [
    { size: Math.min(1200, maxDim), pad: 0 },
    { size: Math.min(1200, Math.max(500, maxDim)), pad: 18 },
    { size: Math.min(1600, Math.max(900, maxDim)), pad: 36 },
  ];
  for (const plan of plans) {
    const scale = plan.size / maxDim;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const padding = plan.pad;
    const canvas = document.createElement("canvas");
    canvas.width = w + padding * 2;
    canvas.height = h + padding * 2;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) continue;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = scale < 1;
    ctx.drawImage(img, padding, padding, w, h);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = decodeQrRgba(pixels.data, pixels.width, pixels.height);
    if (result) return result;
  }
  return null;
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
                // Local image decoder works on Vercel even when the optional
                // external YOLO/OpenCV QR endpoint is unavailable.
                const pixels = ctx.getImageData(0, 0, w, h);
                const localCode = decodeQrRgba(pixels.data, w, h);
                if (localCode && !isDecodingRef.current) {
                  handleDetected(localCode, "QR Lokal");
                  return;
                }
                const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
                const customYolo = typeof window !== "undefined" ? localStorage.getItem("timbangqr_yolo_url") : null;
                const qrHeaders: Record<string, string> = { "Content-Type": "application/json" };
                if (customYolo) qrHeaders["x-yolo-url"] = customYolo;

                const res = await fetch("/api/qr-decode", {
                  method: "POST",
                  headers: qrHeaders,
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
    setSuccessCode(null);
    setMessage("Membaca QR dari gambar...");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("File gambar gagal dibaca."));
        reader.onload = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(file);
      });
      const img = new Image();
      img.src = dataUrl;
      await img.decode();

      // Main path: works offline on all QR PNGs issued by the LPS generator.
      const decoded = decodeUploadedQr(img);
      if (decoded) {
        handleDetected(decoded, "Foto QR");
        return;
      }

      // Fallback: native browser image recognition.
      if (window.BarcodeDetector) {
        try {
<<<<<<< HEAD
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          const found = await detector.detect(img);
          if (found[0]?.rawValue) {
            handleDetected(found[0].rawValue, "Foto Hardware");
            return;
=======
          const customYolo = typeof window !== "undefined" ? localStorage.getItem("timbangqr_yolo_url") : null;
          const qrHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (customYolo) qrHeaders["x-yolo-url"] = customYolo;

          const res = await fetch("/api/qr-decode", {
            method: "POST",
            headers: qrHeaders,
            body: JSON.stringify({ image: dataUrl }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.text) {
              setUploading(false);
              handleDetected(data.text, "Foto/File");
              return;
            }
>>>>>>> 793cbef (feat: support scanning LPS Harapan Jaya QR codes and enforce one-time use burned QR verification)
          }
        } catch {}
      }

      // Fallback: ZXing decoder.
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const result = await new BrowserQRCodeReader().decodeFromImageElement(img);
        if (result?.getText()) {
          handleDetected(result.getText(), "Foto ZXing");
          return;
        }
      } catch {}

      // Optional server fallback; not required for clean dashboard QR.
      try {
        const response = await fetch("/api/qr-decode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
          signal: AbortSignal.timeout(3500),
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.text) {
            handleDetected(result.text, "Foto Vision");
            return;
          }
        }
      } catch {}
      setMessage("Kode QR tidak terbaca dari gambar. Gunakan foto QR yang jelas dan utuh.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "File gambar gagal diproses.");
    } finally {
      setUploading(false);
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
