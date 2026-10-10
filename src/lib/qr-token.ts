// Normalise QR payloads from camera, image uploads, URLs and manual input.
// LPS can encode the stored opaque QR directly, or a URL carrying it.
export function tokenFromValue(value: string): string {
  const raw = value.replace(/^\uFEFF/, "").trim();
  if (!raw) return "";

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return raw;

  // LPS QR endpoints use ?code= and ?qrCode=. Older TimbangQR QR
  // URLs use ?token=. Never use the last generic URL segment
  // ("qr-generator", "scan") as a vehicle token.
  for (const key of ["token", "code", "qrCode", "qr", "text", "plate", "platNomor"]) {
    const found = url.searchParams.get(key)?.trim();
    if (found) return found;
  }

  const match = /\/(?:qr|scan|armada|vehicle)\/([^/?#]+)\/?$/i.exec(url.pathname);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  // Keep unrecognised URLs visible to the operator for diagnosis.
  // Do not silently treat "qr-generator" as a plate or token.
  return raw;
}
