import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_YOLO_URL = "https://width-frankfurt-recent-courtesy.trycloudflare.com";

function resolveTargetUrl(request: Request, body?: { yoloUrl?: string }): string {
  const headerUrl = request.headers.get("x-yolo-url");
  if (headerUrl && headerUrl.trim()) {
    return cleanUrl(headerUrl);
  }

  try {
    const urlObj = new URL(request.url);
    const queryUrl = urlObj.searchParams.get("yoloUrl") || urlObj.searchParams.get("url");
    if (queryUrl && queryUrl.trim()) {
      return cleanUrl(queryUrl);
    }
  } catch {}

  if (body?.yoloUrl && typeof body.yoloUrl === "string" && body.yoloUrl.trim()) {
    return cleanUrl(body.yoloUrl);
  }

  return cleanUrl(process.env.YOLO_OCR_URL || DEFAULT_YOLO_URL);
}

function cleanUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, "");
  if (!u.startsWith("http://") && !u.startsWith("https://")) {
    u = `http://${u}`;
  }
  return u;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.image) {
      return NextResponse.json({ success: false, error: "Parameter 'image' wajib diisi" }, { status: 400 });
    }

    const targetUrl = resolveTargetUrl(request, body);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${targetUrl}/qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: body.image }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Server QR error (${targetUrl}): status ${res.status}` },
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

