import base64
import os
import sys
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
from ultralytics import YOLO

# Pastikan direktori scripts dan root project ada di sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Import Seven-Segment CRNN OCR Engine (Renjith Sasidharan)
try:
    from seven_seg_crnn_engine import predict_seven_segment_ocr, get_seven_seg_model
    HAS_SEVENSEG = True
except Exception as e:
    print(f"[OCR Server] Warning: Gagal memuat Seven-Seg CRNN: {e}")
    HAS_SEVENSEG = False

app = FastAPI(title="TimbangQR OCR Server (YOLO & CRNN)", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "7segment_yolo.pt")
MODEL_PATH = os.path.abspath(MODEL_PATH)

print(f"[YOLO OCR] Memuat model dari: {MODEL_PATH}")
model = YOLO(MODEL_PATH)
print("[YOLO OCR] Model berhasil dimuat!")

if HAS_SEVENSEG:
    try:
        get_seven_seg_model()
        print("[Seven-Seg CRNN] Model siap digunakan!")
    except Exception as e:
        print(f"[Seven-Seg CRNN] Init deferred: {e}")

class OcrRequest(BaseModel):
    image: str  # Base64 string or dataURL
    configuredDigits: Optional[int] = 4
    conf: Optional[float] = 0.15
    colorMode: Optional[str] = "red"  # "red", "green", "auto"
    preprocess: Optional[bool] = True
    engine: Optional[str] = "yolo"  # "yolo" or "sevenseg"


class BoxItem(BaseModel):
    digit: str
    conf: float
    box: List[float]  # [x1, y1, x2, y2]

class OcrResponse(BaseModel):
    success: bool
    digits: str
    weightKg: int
    confidence: float
    digitCount: int
    boxes: List[BoxItem]
    message: str
    engine: str = "yolo"

def decode_base64_image(base64_str: str) -> np.ndarray:
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]
    img_bytes = base64.b64decode(base64_str)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Gagal mendecode gambar base64.")
    return img

def preprocess_led_image(image_bgr: np.ndarray, color_mode: str = "red") -> tuple[np.ndarray, np.ndarray, bool]:
    """
    Pra-pemrosesan OpenCV untuk meningkatkan akurasi deteksi YOLO 7-Segment LED:
    1. Mengubah format warna ke HSV (lebih stabil untuk deteksi spektrum warna LED).
    2. Isolasi warna LED (warna merah memiliki 2 rentang HSV: 0-12 dan 168-180).
    3. Operasi morfologi (Closing + Dilation) dengan kernel kotak (5, 5) untuk:
       - Mengisi celah kosong di antara segmen angka LED yang putus.
       - Menebalkan kontur digit agar terdeteksi solid oleh YOLO.
    4. Bitwise masking untuk membersihkan noise latar belakang (pantulan meja, bayangan 88 redup).
    """
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    if color_mode == "green":
        lower_green = np.array([35, 60, 40])
        upper_green = np.array([85, 255, 255])
        mask_led = cv2.inRange(hsv, lower_green, upper_green)
    else:
        # Default LED merah timbangan (2 rentang HSV)
        lower_red1 = np.array([0, 50, 40])
        upper_red1 = np.array([12, 255, 255])
        lower_red2 = np.array([168, 50, 40])
        upper_red2 = np.array([180, 255, 255])
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_led = cv2.bitwise_or(mask1, mask2)

    non_zero = cv2.countNonZero(mask_led)
    if non_zero < 15:
        return image_bgr, mask_led, False

    # 3. Kernel kotak (5, 5) untuk operasi morfologi
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))

    # Closing untuk mengisi celah kosong di dalam segmen digit
    closed = cv2.morphologyEx(mask_led, cv2.MORPH_CLOSE, kernel)

    # Dilasi (penebalan) untuk menyambung segmen putus dan mempertegas garis angka
    dilated = cv2.dilate(closed, kernel, iterations=1)

    # Masking bitwise: isolasi LED pada latar belakang hitam bersih
    cleaned = cv2.bitwise_and(image_bgr, image_bgr, mask=dilated)
    cleaned = cv2.convertScaleAbs(cleaned, alpha=1.1, beta=5)

    return cleaned, dilated, True

@app.get("/", response_class=HTMLResponse)
def root():
    engine_name = "YOLO 7-Segment & Renjith CRNN" if HAS_SEVENSEG else "YOLO 7-Segment"
    return f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>TimbangQR OCR AI Server</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
    body {{ background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }}
    .card {{ background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; max-width: 540px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }}
    .badge {{ display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; border: 1px solid rgba(16, 185, 129, 0.3); }}
    .dot {{ width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #10b981; }}
    h1 {{ font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #fff; }}
    p {{ color: #94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 20px; }}
    .info-box {{ background: #0f172a; border-radius: 8px; padding: 14px; margin-bottom: 20px; border: 1px solid #334155; }}
    .info-row {{ display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; color: #cbd5e1; }}
    .info-row span:first-child {{ color: #64748b; }}
    .links {{ display: flex; flex-direction: column; gap: 10px; }}
    .btn {{ display: inline-flex; align-items: center; justify-content: center; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; transition: all 0.2s; }}
    .btn-primary {{ background: #2563eb; color: #fff; }}
    .btn-primary:hover {{ background: #1d4ed8; }}
    .btn-secondary {{ background: #334155; color: #e2e8f0; }}
    .btn-secondary:hover {{ background: #475569; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span class="dot"></span> Server YOLO OCR Aktif</div>
    <h1>TimbangQR Vision AI Server</h1>
    <p>Ini adalah backend API Python untuk deteksi angka timbangan LED (YOLO) dan QR code scanner. Port 5001 ini berjalan normal dan siap menerima request.</p>
    
    <div class="info-box">
      <div class="info-row"><span>Status</span><b style="color: #10b981;">Online & Siap</b></div>
      <div class="info-row"><span>Model OCR</span><span>{engine_name}</span></div>
      <div class="info-row"><span>Port</span><span>5001</span></div>
    </div>

    <div class="links">
      <a href="http://localhost:3000" class="btn btn-primary">Buka Web Dashboard (http://localhost:3000)</a>
      <a href="/docs" class="btn btn-secondary">Dokumentasi API Interactive (Swagger /docs)</a>
      <a href="/health" class="btn btn-secondary">Cek Status JSON (/health)</a>
    </div>
  </div>
</body>
</html>"""

@app.get("/health")
def health():
    return {
        "status": "ok",
        "yolo": True,
        "sevenseg": HAS_SEVENSEG,
        "engines": ["yolo", "sevenseg"] if HAS_SEVENSEG else ["yolo"],
        "model": "YOLO 7-Segment & Renjith CRNN" if HAS_SEVENSEG else "YOLO 7-Segment",
        "model_path": MODEL_PATH,
        "classes": list(model.names.values())
    }

@app.post("/ocr/sevenseg", response_model=OcrResponse)
def process_sevenseg_ocr(req: OcrRequest):
    if not HAS_SEVENSEG:
        raise HTTPException(status_code=500, detail="Seven-Segment CRNN engine tidak tersedia.")
    try:
        img_bgr = decode_base64_image(req.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    res = predict_seven_segment_ocr(
        image_bgr=img_bgr,
        configured_digits=req.configuredDigits if req.configuredDigits is not None else 4,
        color_mode=req.colorMode or "red",
        preprocess=req.preprocess is not False
    )

    return OcrResponse(
        success=res["success"],
        digits=res["digits"],
        weightKg=res["weightKg"],
        confidence=res["confidence"],
        digitCount=res["digitCount"],
        boxes=[],
        message=res["message"],
        engine="sevenseg"
    )

@app.post("/ocr", response_model=OcrResponse)
def process_ocr(req: OcrRequest):
    # Jika client meminta engine Seven-Segment CRNN
    if req.engine == "sevenseg":
        return process_sevenseg_ocr(req)

    try:
        img_bgr = decode_base64_image(req.image)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    h, w = img_bgr.shape[:2]
    conf_thresh = max(0.05, min(0.9, req.conf or 0.15))
    
    # Pra-pemrosesan OpenCV untuk isolasi LED & penghapusan noise background
    target_img = img_bgr
    if req.preprocess:
        cleaned_img, dilated_mask, applied = preprocess_led_image(img_bgr, color_mode=req.colorMode or "red")

        if applied:
            target_img = cleaned_img

    # Jalankan YOLO predict
    results = model.predict(target_img, conf=conf_thresh, verbose=False)[0]

    # Fallback ke gambar asli jika pada hasil pre-process tidak ditemukan box
    if len(results.boxes) == 0 and target_img is not img_bgr:
        results = model.predict(img_bgr, conf=conf_thresh, verbose=False)[0]
        target_img = img_bgr
    
    raw_boxes = []
    for box in results.boxes:
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        conf_val = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        
        patch = target_img[max(0, int(y1)):min(h, int(y2)), max(0, int(x1)):min(w, int(x2))]
        if patch.size == 0:
            continue
        
        mean_b = float(patch[:, :, 0].mean())
        mean_g = float(patch[:, :, 1].mean())
        mean_r = float(patch[:, :, 2].mean())
        red_excess = mean_r - max(mean_g, mean_b)
        
        raw_boxes.append({
            'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
            'center_x': (x1 + x2) / 2.0,
            'width': x2 - x1,
            'height': y2 - y1,
            'cls': cls_name,
            'conf': conf_val,
            'mean_r': mean_r,
            'red_excess': red_excess,
        })
    
    # Ambil digit (kelas D0..D9)
    digits = [b for b in raw_boxes if b['cls'].startswith('D')]
    if not digits:
        return OcrResponse(
            success=False,
            digits="",
            weightKg=0,
            confidence=0.0,
            digitCount=0,
            boxes=[],
            message="Tidak ada digit LED terdeteksi (Latar belakang / bukan timbangan)",
            engine="yolo"
        )
    
    # Urutkan dari kiri ke kanan berdasarkan koordinat X
    digits.sort(key=lambda b: b['center_x'])
    
    # Hilangkan overlap (misal D1 dan D7 terdeteksi di koordinat yang sama)
    filtered = []
    for d in digits:
        if not filtered:
            filtered.append(d)
            continue
        prev = filtered[-1]
        overlap = min(prev['x2'], d['x2']) - max(prev['x1'], d['x1'])
        if overlap > 0.4 * min(prev['width'], d['width']):
            if d['conf'] > prev['conf']:
                filtered[-1] = d
        else:
            filtered.append(d)
    
    # Filter segmen mati (unlit / bayangan 88)
    max_excess = max([d['red_excess'] for d in filtered], default=0.0)
    max_mean_r = max([d['mean_r'] for d in filtered], default=0.0)
    
    active_digits = []
    for d in filtered:
        is_active = True
        if max_excess > 50:
            if d['red_excess'] < max(35.0, max_excess * 0.62):
                is_active = False
        elif max_mean_r > 120:
            if d['mean_r'] < max_mean_r * 0.70:
                is_active = False
        
        if is_active:
            active_digits.append(d)
            
    # Jika dikonfigurasi jumlah digit tetap (misal 4 digit), sesuaikan atau tunggu sampai digit lengkap
    if req.configuredDigits and req.configuredDigits > 0:
        if len(active_digits) > req.configuredDigits:
            active_digits = active_digits[-req.configuredDigits:]
        elif len(active_digits) < req.configuredDigits:
            return OcrResponse(
                success=False,
                digits="",
                weightKg=0,
                confidence=0.0,
                digitCount=len(active_digits),
                boxes=[],
                message=f"Terdeteksi {len(active_digits)} digit (menunggu {req.configuredDigits} digit display)",
                engine="yolo"
            )
        
    if not active_digits:
        return OcrResponse(
            success=False,
            digits="",
            weightKg=0,
            confidence=0.0,
            digitCount=0,
            boxes=[],
            message="Semua segmen terdeteksi redup / non-aktif",
            engine="yolo"
        )
        
    digit_str = ''.join(d['cls'].replace('D', '') for d in active_digits)
    avg_conf = sum(d['conf'] for d in active_digits) / len(active_digits)
    
    try:
        val = int(digit_str)
    except ValueError:
        val = 0
        
    return OcrResponse(
        success=True,
        digits=digit_str,
        weightKg=val,
        confidence=round(avg_conf, 3),
        digitCount=len(active_digits),
        boxes=[
            BoxItem(
                digit=d['cls'].replace('D', ''),
                conf=round(d['conf'], 2),
                box=[round(d['x1'], 1), round(d['y1'], 1), round(d['x2'], 1), round(d['y2'], 1)]
            )
            for d in active_digits
        ],
        message=f"YOLO Vision: Terbaca {digit_str} KG ({round(avg_conf * 100)}%)",
        engine="yolo"
    )

qr_detector = cv2.QRCodeDetector()

class QrRequest(BaseModel):
    image: str

class QrResponse(BaseModel):
    success: bool
    text: str = ""
    message: str = ""

@app.post("/qr", response_model=QrResponse)
def decode_qr_endpoint(req: QrRequest):
    try:
        img = decode_base64_image(req.image)
        # 1. Direct detection
        text, pts, _ = qr_detector.detectAndDecode(img)
        if text and len(text.strip()) > 0:
            return QrResponse(success=True, text=text.strip(), message="QR terdeteksi langsung")
            
        # 2. Grayscale detection
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        text, pts, _ = qr_detector.detectAndDecode(gray)
        if text and len(text.strip()) > 0:
            return QrResponse(success=True, text=text.strip(), message="QR terdeteksi (grayscale)")
            
        # 3. CLAHE enhancement (ideal for screen reflections & bloom)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        text, pts, _ = qr_detector.detectAndDecode(enhanced)
        if text and len(text.strip()) > 0:
            return QrResponse(success=True, text=text.strip(), message="QR terdeteksi (CLAHE)")
            
        # 4. Adaptive thresholding
        thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 5)
        text, pts, _ = qr_detector.detectAndDecode(thresh)
        if text and len(text.strip()) > 0:
            return QrResponse(success=True, text=text.strip(), message="QR terdeteksi (threshold)")
            
        return QrResponse(success=False, text="", message="QR code tidak terdeteksi")
    except Exception as e:
        return QrResponse(success=False, text="", message=str(e))

if __name__ == "__main__":
    port = int(os.environ.get("YOLO_PORT", 5001))
    print(f"[YOLO OCR] Menjalankan server pada http://127.0.0.1:{port} (host: 0.0.0.0)")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
