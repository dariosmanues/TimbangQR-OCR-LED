import cv2
import numpy as np
import os

img_path = r"C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\7e01ffce-586a-453f-9c43-b8b0b66eb2f3\.user_uploaded\media_1791376804004.png"
img = cv2.imread(img_path)
print("Image shape:", img.shape)

# Test OpenCV QRCodeDetector
detector = cv2.QRCodeDetector()
val, pts, qr_code = detector.detectAndDecode(img)
print("OpenCV QRCodeDetector result:", val)

# Test OpenCV WeChatQRCode (if available) or standard detector with pre-processing
# Let's crop to the phone screen
# In the image, find the bounding box
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
val2, pts2, _ = detector.detectAndDecode(gray)
print("OpenCV Grayscale result:", val2)

# Try with contrast enhancement (CLAHE)
clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
enhanced = clahe.apply(gray)
val3, pts3, _ = detector.detectAndDecode(enhanced)
print("OpenCV CLAHE result:", val3)

# Try pyzbar if available
try:
    from pyzbar.pyzbar import decode
    decoded = decode(img)
    print("pyzbar result:", [d.data.decode() for d in decoded])
except Exception as e:
    print("pyzbar error:", e)

# Try zxing-cpp (zxingcpp)
try:
    import zxingcpp
    zxing_results = zxingcpp.read_barcodes(img)
    print("zxing-cpp result:", [r.text for r in zxing_results])
except Exception as e:
    print("zxing-cpp error:", e)

