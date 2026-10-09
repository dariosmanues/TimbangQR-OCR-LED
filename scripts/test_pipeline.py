import cv2
import numpy as np
from ultralytics import YOLO

class YoloLedOcr:
    def __init__(self, model_path='models/7segment_yolo.pt'):
        self.model = YOLO(model_path)
    
    def process_image(self, img_bgr, conf=0.15):
        h, w = img_bgr.shape[:2]
        
        # Run YOLO prediction
        res = self.model.predict(img_bgr, conf=conf, verbose=False)[0]
        
        raw_boxes = []
        for box in res.boxes:
            cls_id = int(box.cls[0])
            cls_name = self.model.names[cls_id]
            conf_val = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            
            # Extract patch for brightness/color check
            patch = img_bgr[max(0, int(y1)):min(h, int(y2)), max(0, int(x1)):min(w, int(x2))]
            if patch.size == 0:
                continue
            
            mean_b = float(patch[:, :, 0].mean())
            mean_g = float(patch[:, :, 1].mean())
            mean_r = float(patch[:, :, 2].mean())
            max_r = float(patch[:, :, 2].max())
            red_excess = mean_r - max(mean_g, mean_b)
            
            raw_boxes.append({
                'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
                'center_x': (x1 + x2) / 2.0,
                'width': x2 - x1,
                'height': y2 - y1,
                'cls': cls_name,
                'conf': conf_val,
                'mean_r': mean_r,
                'red_excess': red_excess,
                'max_r': max_r
            })
        
        # Separate digits vs screen/total box
        digits = [b for b in raw_boxes if b['cls'].startswith('D')]
        
        if not digits:
            return {
                'success': False,
                'digits': '',
                'weightKg': 0,
                'confidence': 0,
                'boxes': [],
                'message': 'Tidak ada digit LED terdeteksi'
            }
        
        # Sort digits left-to-right
        digits.sort(key=lambda b: b['center_x'])
        
        # Deduplicate overlapping boxes (e.g. both D1 and D7 detected at same spot)
        filtered_digits = []
        for d in digits:
            if not filtered_digits:
                filtered_digits.append(d)
                continue
            prev = filtered_digits[-1]
            # If horizontal overlap > 40% of width
            overlap = min(prev['x2'], d['x2']) - max(prev['x1'], d['x1'])
            if overlap > 0.4 * min(prev['width'], d['width']):
                # Choose the one with higher confidence
                if d['conf'] > prev['conf']:
                    filtered_digits[-1] = d
            else:
                filtered_digits.append(d)
        
        # Filter inactive (unlit) segments:
        # On LED displays, active digits glow bright red.
        # Inactive digits are dim / unlit background 8s.
        max_excess = max([d['red_excess'] for d in filtered_digits], default=0)
        max_mean_r = max([d['mean_r'] for d in filtered_digits], default=0)
        
        active_digits = []
        for d in filtered_digits:
            # An active LED digit must have significant red excess and brightness
            is_active = True
            if max_excess > 50:
                if d['red_excess'] < max(35.0, max_excess * 0.62):
                    is_active = False
            elif max_mean_r > 120:
                if d['mean_r'] < max_mean_r * 0.70:
                    is_active = False
            
            if is_active:
                active_digits.append(d)
        
        if not active_digits:
            return {
                'success': False,
                'digits': '',
                'weightKg': 0,
                'confidence': 0,
                'boxes': [],
                'message': 'Semua segmen redup / non-aktif'
            }
        
        digit_str = ''.join(d['cls'].replace('D', '') for d in active_digits)
        avg_conf = sum(d['conf'] for d in active_digits) / len(active_digits)
        
        try:
            val = int(digit_str)
        except ValueError:
            val = 0
            
        return {
            'success': True,
            'digits': digit_str,
            'weightKg': val,
            'confidence': round(avg_conf, 3),
            'boxes': [
                {
                    'digit': d['cls'].replace('D', ''),
                    'conf': round(d['conf'], 2),
                    'box': [round(d['x1'], 1), round(d['y1'], 1), round(d['x2'], 1), round(d['y2'], 1)]
                }
                for d in active_digits
            ],
            'message': f'YOLO: Terbaca {digit_str} ({round(avg_conf*100)}%)'
        }

if __name__ == '__main__':
    ocr = YoloLedOcr()
    
    crops = {
      'media_1 (room background)': (r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791287848093.png', (120, 30, 460, 200)),
      'media_2 (scale 1600)': (r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791289094051.png', (180, 40, 320, 160)),
      'media_3 (scale 1600)': (r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791290409964.png', (240, 40, 520, 180)),
      'media_4 (human face)': (r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791291376133.png', (120, 30, 460, 200)),
      'media_6 (scale 1600)': (r'C:\Users\Axioo Pongo\.gemini\antigravity-ide\brain\b2fe221c-3caa-47db-9775-9f13ddb7da4f\.user_uploaded\media_1791296798288.png', (240, 220, 520, 380)),
    }
    
    for label, (path, (x1, y1, x2, y2)) in crops.items():
        img = cv2.imread(path)
        crop = img[y1:y2, x1:x2]
        res = ocr.process_image(crop)
        print(f"[{label}] => {res['digits']} (kg={res['weightKg']}, conf={res['confidence']}) | {res['message']}")
