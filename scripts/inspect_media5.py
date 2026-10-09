import cv2
import numpy as np

img = cv2.imread(r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791294188976.png')
print("img shape:", img.shape)
# Find where high red is located in this image
r = img[:,:,2]
g = img[:,:,1]
b = img[:,:,0]
red_mask = (r > 150) & (r - np.maximum(g, b) > 30)
y_indices, x_indices = np.where(red_mask)
if len(y_indices) > 0:
    print(f"Red pixels found: {len(y_indices)}")
    print(f"Bounding box of red: y=[{y_indices.min()}..{y_indices.max()}], x=[{x_indices.min()}..{x_indices.max()}]")
    crop = img[y_indices.min():y_indices.max()+1, x_indices.min():x_indices.max()+1]
    cv2.imwrite('crop_media5_red.png', crop)
    print("Saved crop_media5_red.png, shape:", crop.shape)
else:
    print("No red pixels found")
