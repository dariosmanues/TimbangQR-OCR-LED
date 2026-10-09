import cv2
import base64

img = cv2.imread(r"C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\7e01ffce-586a-453f-9c43-b8b0b66eb2f3\.user_uploaded\media_1791376804004.png")
det = cv2.QRCodeDetector()

val, pts, _ = det.detectAndDecode(img)
print("Decoded directly:", val)
