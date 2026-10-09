import cv2
import numpy as np

img = cv2.imread("scripts/crop_box.png")
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Check histogram / min / max
print(f"Min: {gray.min()}, Max: {gray.max()}, Mean: {gray.mean():.1f}")

# The phone screen is bright (max ~255), black modules are around 60-120
# Let's normalize contrast: stretch [60, 240] to [0, 255]
p_min, p_max = np.percentile(gray, (5, 95))
print(f"5th percentile: {p_min}, 95th percentile: {p_max}")

stretched = np.clip((gray - p_min) * (255.0 / (p_max - p_min)), 0, 255).astype(np.uint8)
cv2.imwrite("scripts/stretched.png", stretched)

# Let's test Otsu threshold
_, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
cv2.imwrite("scripts/otsu.png", otsu)

# Let's test adaptive threshold
adapt = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 5)
cv2.imwrite("scripts/adapt.png", adapt)
