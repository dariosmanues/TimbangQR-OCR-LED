import { NextResponse } from "next/server";

const YOLO_SERVER_URL = process.env.YOLO_OCR_URL || "http://127.0.0.1:5001";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.image) {
      return NextResponse.json({ success: false, error: "Parameter 'image' wajib diisi" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${YOLO_SERVER_URL}/qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: body.image }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Server QR error: status ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Gagal menghubungi service QR decoder",
      },
      { status: 500 }
    );
  }
}
