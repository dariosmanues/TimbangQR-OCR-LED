import os
import cv2
import numpy as np
import tensorflow as tf
from tensorflow import keras

# Alphabet for Renjith Sasidharan's seven-segment OCR
ALPHABET = "0123456789."
BLANK_INDEX = len(ALPHABET)

_model = None

def _meshgrid(height, width):
    x_linspace = tf.linspace(-1.0, 1.0, width)
    y_linspace = tf.linspace(-1.0, 1.0, height)
    x_coordinates, y_coordinates = tf.meshgrid(x_linspace, y_linspace)
    x_coordinates = tf.reshape(x_coordinates, shape=(1, -1))
    y_coordinates = tf.reshape(y_coordinates, shape=(1, -1))
    ones = tf.ones_like(x_coordinates)
    return tf.concat([x_coordinates, y_coordinates, ones], 0)

def _repeat(x, num_repeats):
    ones = tf.ones((1, num_repeats), dtype="int32")
    x = tf.reshape(x, shape=(-1, 1))
    x = tf.matmul(x, ones)
    return tf.reshape(x, [-1])

def _transform(inputs):
    locnet_x, locnet_y = inputs
    output_size = locnet_x.shape[1:]
    batch_size = tf.shape(locnet_x)[0]
    height = tf.shape(locnet_x)[1]
    width = tf.shape(locnet_x)[2]
    num_channels = tf.shape(locnet_x)[3]

    locnet_y = tf.reshape(locnet_y, shape=(batch_size, 2, 3))
    locnet_y = tf.cast(locnet_y, "float32")

    output_height = output_size[0]
    output_width = output_size[1]
    indices_grid = _meshgrid(output_height, output_width)
    indices_grid = tf.expand_dims(indices_grid, 0)
    indices_grid = tf.reshape(indices_grid, [-1])
    indices_grid = tf.tile(indices_grid, tf.stack([batch_size]))
    indices_grid = tf.reshape(indices_grid, tf.stack([batch_size, 3, -1]))

    transformed_grid = tf.matmul(locnet_y, indices_grid)
    x_s = tf.slice(transformed_grid, [0, 0, 0], [-1, 1, -1])
    y_s = tf.slice(transformed_grid, [0, 1, 0], [-1, 1, -1])
    x = tf.reshape(x_s, [-1])
    y = tf.reshape(y_s, [-1])

    height_float = tf.cast(height, dtype="float32")
    width_float = tf.cast(width, dtype="float32")

    x = tf.cast(x, dtype="float32")
    y = tf.cast(y, dtype="float32")
    x = 0.5 * (x + 1.0) * width_float
    y = 0.5 * (y + 1.0) * height_float

    x0 = tf.cast(tf.floor(x), "int32")
    x1 = x0 + 1
    y0 = tf.cast(tf.floor(y), "int32")
    y1 = y0 + 1

    max_y = tf.cast(height - 1, dtype="int32")
    max_x = tf.cast(width - 1, dtype="int32")
    zero = tf.zeros([], dtype="int32")

    x0 = tf.clip_by_value(x0, zero, max_x)
    x1 = tf.clip_by_value(x1, zero, max_x)
    y0 = tf.clip_by_value(y0, zero, max_y)
    y1 = tf.clip_by_value(y1, zero, max_y)

    flat_image_dimensions = width * height
    pixels_batch = tf.range(batch_size) * flat_image_dimensions
    flat_output_dimensions = output_height * output_width
    base = _repeat(pixels_batch, flat_output_dimensions)
    base_y0 = base + y0 * width
    base_y1 = base + y1 * width
    indices_a = base_y0 + x0
    indices_b = base_y1 + x0
    indices_c = base_y0 + x1
    indices_d = base_y1 + x1

    flat_image = tf.reshape(locnet_x, shape=(-1, num_channels))
    flat_image = tf.cast(flat_image, dtype="float32")
    pixel_values_a = tf.gather(flat_image, indices_a)
    pixel_values_b = tf.gather(flat_image, indices_b)
    pixel_values_c = tf.gather(flat_image, indices_c)
    pixel_values_d = tf.gather(flat_image, indices_d)

    x0 = tf.cast(x0, "float32")
    x1 = tf.cast(x1, "float32")
    y0 = tf.cast(y0, "float32")
    y1 = tf.cast(y1, "float32")

    area_a = tf.expand_dims(((x1 - x) * (y1 - y)), 1)
    area_b = tf.expand_dims(((x1 - x) * (y - y0)), 1)
    area_c = tf.expand_dims(((x - x0) * (y1 - y)), 1)
    area_d = tf.expand_dims(((x - x0) * (y - y0)), 1)
    transformed_image = tf.add_n(
        [
            area_a * pixel_values_a,
            area_b * pixel_values_b,
            area_c * pixel_values_c,
            area_d * pixel_values_d,
        ]
    )

    return tf.reshape(
        transformed_image, shape=(batch_size, output_height, output_width, num_channels)
    )

def get_seven_seg_model():
    global _model
    if _model is not None:
        return _model

    model_path = os.path.join(os.path.dirname(__file__), "..", "seven_seg_repo", "seven_seg_crnn.keras")
    model_path = os.path.abspath(model_path)
    if not os.path.isfile(model_path):
        raise FileNotFoundError(f"Model {model_path} tidak ditemukan!")

    print(f"[Seven-Seg CRNN] Memuat model dari: {model_path}")
    _model = keras.models.load_model(
        model_path,
        custom_objects={"_transform": _transform},
        safe_mode=False
    )
    # Warmup graph
    dummy_input = np.zeros((1, 31, 200, 1), dtype=np.float32)
    _model(dummy_input, training=False)
    print("[Seven-Seg CRNN] Model berhasil dimuat dan siap!")
    return _model

def ctc_greedy_decode(preds_seq):
    best_indices = np.argmax(preds_seq, axis=-1)
    decoded_chars = []
    prev_idx = None
    for idx in best_indices:
        if idx != prev_idx and idx != BLANK_INDEX:
            decoded_chars.append(ALPHABET[idx])
        prev_idx = idx
    return "".join(decoded_chars)

def predict_seven_segment_ocr(
    image_bgr: np.ndarray,
    configured_digits: int = 4,
    color_mode: str = "red",
    preprocess: bool = True
) -> dict:
    """
    Prediksi angka 7-Segment display menggunakan arsitektur CRNN (Renjith Sasidharan):
    1. Grayscale & HSV Masking opsional untuk isolasi LED.
    2. Resize standar ke (200, 31).
    3. Normalisasi piksel ke [0, 1].
    4. Inferensi CRNN + Spatial Transformer Network (STN).
    5. Dekoding CTC Greedy Decoder.
    """
    model = get_seven_seg_model()

    # Preprocessing
    if preprocess:
        hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
        if color_mode == "green":
            mask = cv2.inRange(hsv, np.array([35, 60, 40]), np.array([85, 255, 255]))
        else:
            m1 = cv2.inRange(hsv, np.array([0, 50, 40]), np.array([12, 255, 255]))
            m2 = cv2.inRange(hsv, np.array([168, 50, 40]), np.array([180, 255, 255]))
            mask = cv2.bitwise_or(m1, m2)

        if cv2.countNonZero(mask) > 20:
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
            mask_cleaned = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
            gray = cv2.bitwise_and(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY), mask_cleaned)
        else:
            gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    else:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    resized = cv2.resize(gray, (200, 31))
    tensor_input = resized[np.newaxis, ..., np.newaxis].astype(np.float32) / 255.0

    preds = model(tensor_input, training=False).numpy()
    preds_seq = preds[0]  # shape: (48, 12)

    raw_text = ctc_greedy_decode(preds_seq)
    # Rata-rata probabilitas token terpilih
    best_probs = np.max(preds_seq, axis=-1)
    confidence = float(np.mean(best_probs))

    # Bersihkan hanya digit angka
    digits_only = "".join(c for c in raw_text if c.isdigit())

    if configured_digits and configured_digits > 0:
        if len(digits_only) > configured_digits:
            digits_only = digits_only[-configured_digits:]
        elif len(digits_only) < configured_digits and len(digits_only) > 0:
            pass

    try:
        val = int(digits_only) if digits_only else 0
    except ValueError:
        val = 0

    success = len(digits_only) > 0 and (configured_digits <= 0 or len(digits_only) == configured_digits)

    return {
        "success": success,
        "digits": digits_only,
        "weightKg": val,
        "confidence": round(confidence, 3),
        "digitCount": len(digits_only),
        "message": f"CRNN 7-Segment: Terbaca {digits_only or '—'} KG ({round(confidence * 100)}%)",
        "engine": "sevenseg",
    }
