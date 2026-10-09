import os, glob, cv2
from ultralytics import YOLO

model = YOLO('models/7segment_yolo.pt')
img_dir = r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded'

# Crops corresponding to the LED indicator area
crops = {
  'media_1791287848093.png': (120, 30, 460, 200),  # Room
  'media_1791289094051.png': (180, 40, 320, 160),  # Scale 1600
  'media_1791290409964.png': (240, 40, 520, 180),  # Scale 1600
  'media_1791291376133.png': (120, 30, 460, 200),  # Face
  'media_1791294188976.png': (125, 200, 580, 400), # Phone 1600
  'media_1791296798288.png': (240, 220, 520, 380), # Scale 1600
}

for fname, (x1, y1, x2, y2) in crops.items():
    img_path = os.path.join(img_dir, fname)
    img = cv2.imread(img_path)
    if img is None: continue
    
    crop = img[y1:y2, x1:x2]
    h, w = crop.shape[:2]
    
    res = model.predict(crop, conf=0.15, verbose=False)[0]
    boxes = []
    for box in res.boxes:
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        if not cls_name.startswith('D'):
            continue
        conf = float(box.conf[0])
        bx1, by1, bx2, by2 = box.xyxy[0].tolist()
        patch = crop[max(0, int(by1)):min(h, int(by2)), max(0, int(bx1)):min(w, int(bx2))]
        r = float(patch[:,:,2].mean()) if patch.size else 0
        g = float(patch[:,:,1].mean()) if patch.size else 0
        b = float(patch[:,:,0].mean()) if patch.size else 0
        excess = r - max(g, b)
        boxes.append({
            'x': (bx1 + bx2) / 2,
            'digit': cls_name[1],
            'conf': conf,
            'r': r,
            'excess': excess
        })
    
    # Sort left to right
    boxes.sort(key=lambda b: b['x'])
    
    # Filter out dim inactive segments (where excess is low compared to max active excess)
    max_excess = max([b['excess'] for b in boxes], default=0)
    # Filter active boxes
    active_boxes = [b for b in boxes if (b['excess'] >= max(40, max_excess * 0.55))]
    
    raw_str = ''.join(b['digit'] for b in boxes)
    active_str = ''.join(b['digit'] for b in active_boxes)
    print(f"\n{fname}:")
    print(f"  All detected:    \"{raw_str}\" ({len(boxes)} boxes)")
    print(f"  Active LED only: \"{active_str}\" ({len(active_boxes)} boxes, max_excess={max_excess:.1f})")
    for b in boxes:
        is_act = "ACTIVE" if b in active_boxes else "dim/off"
        print(f"    d={b['digit']} conf={b['conf']:.2f} x={b['x']:.1f} excess={b['excess']:.1f} r={b['r']:.1f} [{is_act}]")
