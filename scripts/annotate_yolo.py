import cv2
import os
import glob
from ultralytics import YOLO

model = YOLO('models/7segment_yolo.pt')
img_dir = r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded'
out_dir = 'debug_yolo_outputs'
os.makedirs(out_dir, exist_ok=True)

for img_path in sorted(glob.glob(os.path.join(img_dir, '*.png'))):
    fname = os.path.basename(img_path)
    img = cv2.imread(img_path)
    if img is None:
        continue
    
    res = model.predict(img, conf=0.25, verbose=False)[0]
    annotated = res.plot()
    out_file = os.path.join(out_dir, fname)
    cv2.imwrite(out_file, annotated)
    print(f"Saved: {out_file} (boxes: {len(res.boxes)})")
