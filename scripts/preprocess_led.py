import cv2
import numpy as np
import sys
import os

def preprocess_led_image(image_path_or_array, output_path='hasil_opencv_bersih.png', crop_coords=None):
    """
    Pra-pemrosesan citra dengan OpenCV untuk meningkatkan akurasi YOLO OCR 7-Segment LED:
    1. Membaca gambar timbangan (atau menerima np.ndarray).
    2. [Opsional] Melakukan crop ke area angka saja.
    3. Mengubah format warna ke HSV (stabil untuk isolasi spektrum LED merah).
    4. Masking 2 rentang warna merah HSV.
    5. Operasi morfologi (Closing + Dilation) dengan kernel (5, 5) untuk menyambung segmen putus.
    6. Menyimpan hasil pra-pemrosesan ke file.
    """
    if isinstance(image_path_or_array, str):
        if not os.path.exists(image_path_or_array):
            raise FileNotFoundError(f"File gambar tidak ditemukan: {image_path_or_array}")
        image = cv2.imread(image_path_or_array)
    else:
        image = image_path_or_array

    if image is None:
        raise ValueError("Gagal membaca gambar.")

    # 1. [Opsional] Crop ke area angka jika koordinat diberikan: (x, y, w, h)
    if crop_coords:
        x, y, w, h = crop_coords
        image = image[y:y+h, x:x+w]

    # 2. Mengubah format warna ke HSV
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # Batas warna merah pada LED (Merah dalam HSV memiliki 2 rentang)
    lower_red1 = np.array([0, 50, 40])
    upper_red1 = np.array([12, 255, 255])
    lower_red2 = np.array([168, 50, 40])
    upper_red2 = np.array([180, 255, 255])

    # Membuat mask untuk mengisolasi warna merah LED
    mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    mask_red = cv2.bitwise_or(mask1, mask2)

    # 3. Operasi Morfologi untuk menyambungkan segmen LED yang terputus
    # Gunakan kernel kotak 5x5 untuk menebalkan garis angka
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))

    # Closing untuk mengisi celah kosong di antara segmen digit
    closed = cv2.morphologyEx(mask_red, cv2.MORPH_CLOSE, kernel)

    # Dilasi (penebalan garis angka)
    dilated = cv2.dilate(closed, kernel, iterations=1)

    # Gambar bersih: LED dipertahankan, latar belakang dan noise dibersihkan
    cleaned_bgr = cv2.bitwise_and(image, image, mask=dilated)

    # 4. Menyimpan hasil pra-pemrosesan
    if output_path:
        cv2.imwrite(output_path, dilated)
        output_cleaned = output_path.replace('.png', '_bgr.png')
        cv2.imwrite(output_cleaned, cleaned_bgr)
        print(f"[OpenCV Preprocess] Berhasil disimpan ke '{output_path}' dan '{output_cleaned}'")

    return dilated, cleaned_bgr

if __name__ == "__main__":
    input_file = sys.argv[1] if len(sys.argv) > 1 else "crop_media2.png"
    out_file = sys.argv[2] if len(sys.argv) > 2 else "hasil_opencv_bersih.png"

    print(f"Memproses gambar: {input_file} ...")
    mask, cleaned = preprocess_led_image(input_file, out_file)
    print("Pra-pemrosesan selesai! Gambar siap dimasukkan ke OCR.")
