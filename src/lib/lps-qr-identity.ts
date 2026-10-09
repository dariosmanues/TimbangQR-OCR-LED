export type LpsIdentity = { token: string; normalizedPlate: string };
export type LpsArmada = {
  id: string;
  platNomor: string;
  normalizedPlate: string;
  namaLps: string;
  namaSupir: string | null;
  jenisArmada: string | null;
  qrCode: string;
  isActive: boolean;
};

export class LpsQrError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "LpsQrError";
  }
}

export function normalizePlate(value: string) {
  return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeLpsName(value: string) {
  return value.normalize("NFKC").toUpperCase()
    .replace(/^LPS[\s._-]+/, "")
    .replace(/[^A-Z0-9]/g, "");
}

// QR yang dibuat LPS berbentuk LPS-{plat tanpa spasi}-{timestamp}.
// Sufiks 8 karakter juga didukung untuk QR lama dari fallback generator LPS.
// Hanya API LPS yang boleh mengesahkan QR; hasil regex BUKAN otorisasi.
export function parseLpsQrToken(value: string): LpsIdentity | null {
  const token = value.trim();
  const match = /^LPS-([A-Z]{1,3}\d{1,6}[A-Z]{0,4})-(\d{10,17}|[A-Fa-f0-9]{8})$/i.exec(token);
  return match ? { token, normalizedPlate: normalizePlate(match[1]) } : null;
}

export function verifyLpsArmada(identity: LpsIdentity, body: unknown): LpsArmada {
  if (!body || typeof body !== "object") {
    throw new LpsQrError("Respons API LPS tidak valid.", 502);
  }
  const response = body as { success?: boolean; valid?: boolean; data?: Partial<LpsArmada> };
  if (response.success !== true || response.valid !== true) {
    throw new LpsQrError("QR LPS tidak ditemukan atau armada tidak aktif.", 404);
  }
  const data = response.data;
  if (!data || typeof data.id !== "string" || !data.id ||
      typeof data.platNomor !== "string" || typeof data.namaLps !== "string" ||
      typeof data.qrCode !== "string" || typeof data.isActive !== "boolean") {
    throw new LpsQrError("Data identitas armada dari API LPS tidak lengkap.", 502);
  }
  if (!data.isActive || data.qrCode !== identity.token ||
      normalizePlate(data.platNomor) !== identity.normalizedPlate ||
      (data.normalizedPlate && normalizePlate(data.normalizedPlate) !== identity.normalizedPlate)) {
    throw new LpsQrError("QR LPS tidak cocok dengan identitas armada yang terdaftar.", 422);
  }
  if (!data.namaLps.trim() || !normalizeLpsName(data.namaLps)) {
    throw new LpsQrError("Nama LPS dari API belum dapat dicocokkan.", 422);
  }
  return {
    id: data.id,
    platNomor: data.platNomor.trim(),
    normalizedPlate: identity.normalizedPlate,
    namaLps: data.namaLps.trim(),
    namaSupir: typeof data.namaSupir === "string" ? data.namaSupir.trim() || null : null,
    jenisArmada: typeof data.jenisArmada === "string" ? data.jenisArmada.trim() || null : null,
    qrCode: data.qrCode,
    isActive: true,
  };
}

