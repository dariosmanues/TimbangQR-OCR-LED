import os, glob, cv2
from ultralytics import YOLO

model = YOLO('models/7segment_yolo.pt')
img_dir = r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded'

for img_path in sorted(glob.glob(os.path.join(img_dir, '*.png'))):
    fname = os.path.basename(img_path)
    img = cv2.imread(img_path)
    h, w = img.shape[:2]
    
    # Let's run prediction with standard conf=0.25
    res = model.predict(img, conf=0.25, verbose=False)[0]
    boxes = []
    for box in res.boxes:
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        conf = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        
        # Crop the box patch to inspect pixel intensity/color
        patch = img[max(0, int(y1)):min(h, int(y2)), max(0, int(x1)):min(w, int(x2))]
        if patch.size > 0:
            b, g, r = patch[:,:,0].mean(), patch[:,:,1].mean(), patch[:,:,2].mean()
            # LED redness score: red excess = r - max(g, b)
            red_excess = r - max(g, b)
            max_r = patch[:,:,2].max()
            boxes.append({
                'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
                'cls': cls_name, 'conf': conf,
                'mean_r': r, 'red_excess': red_excess, 'max_r': max_r
            })
    
    boxes.sort(key=lambda b: b['x1'])
    print(f"\n==================== {fname} (total {len(boxes)} boxes) ====================")
    for b in boxes:
        print(f"  {b['cls']:<6} conf={b['conf']:.2f} x=[{b['x1']:.1f}..{b['x2']:.1f}] y=[{b['y1']:.1f}..{b['y2']:.1f}] mean_r={b['mean_r']:.1f} excess={b['red_excess']:.1f} max_r={b['max_r']}")
