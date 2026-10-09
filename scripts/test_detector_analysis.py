import cv2
import numpy as np

img = cv2.imread(r"C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\7e01ffce-586a-453f-9c43-b8b0b66eb2f3\.user_uploaded\media_1791376804004.png")
h, w, _ = img.shape

# Let's crop to the green box area (around center: x: 170 to 520, y: 100 to 450)
crop = img[100:450, 170:520]
cv2.imwrite("scripts/crop_box.png", crop)

# Test OpenCV on crop
det = cv2.QRCodeDetector()
val, pts, _ = det.detectAndDecode(crop)
print("Crop OpenCV decode:", val)

# What makes OpenCV succeed?
# Let's see how OpenCV detects finder patterns compared to zxing
print("Points:", pts)
