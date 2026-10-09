import os, glob
from PIL import Image
from ultralytics import YOLO

model = YOLO('models/7segment_yolo.pt')
img_dir = r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded'

# Also let's check crop areas from test_smart_filter.mjs
crop_map = {
  'media_1791290409964.png': (126, 31, 126+455, 31+198),
  'media_1791294188976.png': (125, 225, 125+460, 225+200),
  'media_1791296798288.png': (125, 200, 125+455, 200+200),
}

for img_path in sorted(glob.glob(os.path.join(img_dir, '*.png'))):
    fname = os.path.basename(img_path)
    print(f"\n==================== {fname} ====================")
    img = Image.open(img_path).convert('RGB')
    
    # 1. Full image prediction
    res_full = model.predict(img, conf=0.10, verbose=False)[0]
    boxes_full = []
    for box in res_full.boxes:
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        conf = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        boxes_full.append((x1, cls_name, conf))
    boxes_full.sort(key=lambda b: b[0])
    digits_full = ''.join(b[1].replace('D','') for b in boxes_full if b[1].startswith('D'))
    print(f"Full image: digits=\"{digits_full}\", total_boxes={len(boxes_full)}")
    for b in boxes_full:
        print(f"   [Full] x={b[0]:.1f}, class={b[1]}, conf={b[2]:.2f}")

    # 2. Cropped image prediction if in crop_map
    if fname in crop_map:
        crop_box = crop_map[fname]
        cropped = img.crop(crop_box)
        res_crop = model.predict(cropped, conf=0.10, verbose=False)[0]
        boxes_crop = []
        for box in res_crop.boxes:
            cls_id = int(box.cls[0])
            cls_name = model.names[cls_id]
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            boxes_crop.append((x1, cls_name, conf))
        boxes_crop.sort(key=lambda b: b[0])
        digits_crop = ''.join(b[1].replace('D','') for b in boxes_crop if b[1].startswith('D'))
        print(f"Cropped ROI: digits=\"{digits_crop}\", total_boxes={len(boxes_crop)}")
        for b in boxes_crop:
            print(f"   [Crop] x={b[0]:.1f}, class={b[1]}, conf={b[2]:.2f}")
