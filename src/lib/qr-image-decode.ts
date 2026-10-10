import jsQR from "jsqr";

/**
 * Browser and Node compatible QR decoder. It reads actual image pixels, not
 * a known license plate or a hardcoded QR string.
 *
 * Every QR created by LPS uses the same image-decoding pipeline.
 */
export function decodeQrRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): string | null {
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width < 21 || height < 21 || width > 4096 || height > 4096 ||
      rgba.length !== width * height * 4) {
    return null;
  }

  try {
    const result = jsQR(rgba, width, height, { inversionAttempts: "attemptBoth" });
    return result?.data?.trim() || null;
  } catch {
    return null;
  }
}
