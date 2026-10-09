import { NextResponse } from "next/server";

const YOLO_SERVER_URL = process.env.YOLO_OCR_URL || "http://127.0.0.1:5001";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${YOLO_SERVER_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ online: true, ...data });
    }
    return NextResponse.json({ online: false, error: "Health check status failed" });
  } catch {
    return NextResponse.json({
      online: false,
      error: `Server YOLO OCR belum berjalan di ${YOLO_SERVER_URL}. Jalankan: python scripts/yolo_ocr_server.py`,
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.image) {
      return NextResponse.json({ error: "Parameter 'image' wajib diisi (base64)" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${YOLO_SERVER_URL}/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: body.image,
        configuredDigits: body.configuredDigits !== undefined ? body.configuredDigits : 4,
        conf: body.conf || 0.15,
        colorMode: body.colorMode || "red",
        preprocess: body.preprocess !== false,
        engine: body.engine || "yolo",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `YOLO Server Error: ${errText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    const isConnRefused = err?.cause?.code === "ECONNREFUSED" || err?.name === "AbortError";
    return NextResponse.json(
      {
        success: false,
        online: false,
        error: isConnRefused
          ? `Server YOLO lokal (port 5001) tidak merespons. Jalankan: python scripts/yolo_ocr_server.py`
          : (err?.message || "Gagal menghubungi YOLO server"),
      },
      { status: 503 }
    );
  }
}
