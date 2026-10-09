# Test Lokal: QR + OCR LED Timbangan

Fitur timbang pada versi ini memakai dua kamera dan **tidak memakai TimbangQR Bridge, COM, RS232, atau serial agent**.

## Jalankan aplikasi

Di folder proyek, buka terminal dan jalankan:

```powershell
# Jalankan server YOLO Vision AI (Port 5001)
python scripts/yolo_ocr_server.py
```

Buka terminal kedua untuk web app Next.js:
```powershell
npm install
npm run dev
```

Atau cukup gunakan **`MULAI_WINDOWS.bat`** yang otomatis menjalankan web dan server YOLO OCR sekaligus.

Buka alamat yang ditampilkan terminal (biasanya `http://localhost:3000`), masuk ke aplikasi, lalu buka menu **Scan & Timbang**.

## Mesin OCR yang Tersedia

1. **YOLO Vision AI (Rekomendasi Utama)**:
   - Menggunakan Deep Learning YOLO terlatih khusus 7-segmen display timbangan (`models/7segment_yolo.pt`).
   - Kebal terhadap wajah manusia, lampu ruangan, dan pantulan meja (100% menolak non-digit).
   - Memiliki filter pintar memisahkan angka LED yang aktif menyala dari segmen latar belakang '88' yang mati.
2. **SSOCR Vision**: Algoritma filter piksel fisik LED merah di browser canvas.
3. **Tesseract.js Wasm**: Mesin OCR Tesseract open-source berbasis WebAssembly.

## Perangkat yang diperlukan

- Kamera 1 menghadap QR armada.
- Kamera 2 menghadap angka LED merah indikator timbangan.
- Browser Chrome/Edge yang mengizinkan akses dua kamera.

## Alur uji

1. Pada kotak **Pindai QR armada**, pilih kamera 1 lalu aktifkan kamera dan pindai QR kendaraan.
2. Pada kotak **Pindai display LED timbangan**, pilih kamera 2 lalu aktifkan kamera LED.
3. Dekatkan kamera 2 dan luruskan ke angka LED merah sampai hasil pembacaan muncul.
   Jika lambat atau belum terbaca, tekan **Atur area LED** lalu tarik kotak kuning hanya mengelilingi deretan angka LED merah. OCR kemudian hanya memproses area tersebut.
4. Tunggu status **OCR LED STABIL**. Sistem memakai tiga pembacaan berturut-turut dengan selisih maksimal 1 kg.
5. Nilai Gross akan terisi otomatis dari OCR LED dan tombol simpan akan aktif setelah QR, LPS, netto, serta OCR stabil tersedia.

## Jika angka belum terbaca

- Pastikan yang terlihat kamera hanya area angka LED merah, bukan seluruh meja/indikator.
- Kurangi pantulan cahaya pada kaca indikator.
- Coba pilihan **Jumlah digit display**: mulai dari `Otomatis`, lalu coba `4`, `5`, atau `6 digit` sesuai tampilan indikator.
- Pastikan kamera QR dan kamera LED adalah perangkat yang berbeda.

## Sumber transaksi

Setiap transaksi yang disimpan dari halaman ini ditandai sebagai `OCR_LED`. Nilai serial lama tidak dipakai oleh alur ini.
