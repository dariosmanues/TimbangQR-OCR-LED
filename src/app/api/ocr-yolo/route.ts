import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_YOLO_URL = "https://stainless-tolerance-cole-impact.trycloudflare.com";

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

export async function GET(request: Request) {
  const targetUrl = resolveTargetUrl(request);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${targetUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ online: true, targetUrl, ...data });
    }
    return NextResponse.json({
      online: false,
      targetUrl,
      error: `Health check gagal (Status: ${res.status}) di ${targetUrl}`,
    });
  } catch (err: any) {
    return NextResponse.json({
      online: false,
      targetUrl,
      error: `Server YOLO OCR tidak dapat dihubungi di ${targetUrl}. Pastikan server aktif (python scripts/yolo_ocr_server.py / tunnel)`,
      details: err?.message,
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.image) {
      return NextResponse.json({ error: "Parameter 'image' wajib diisi (base64)" }, { status: 400 });
    }

    const targetUrl = resolveTargetUrl(request, body);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${targetUrl}/ocr`, {
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
      return NextResponse.json({ error: `YOLO Server Error (${targetUrl}): ${errText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ ...data, targetUrl });
  } catch (err: any) {
    const isConnRefused = err?.cause?.code === "ECONNREFUSED" || err?.name === "AbortError";
    const targetUrl = resolveTargetUrl(request);
    return NextResponse.json(
      {
        success: false,
        online: false,
        targetUrl,
        error: isConnRefused
          ? `Server YOLO (${targetUrl}) tidak merespons atau waktu tunggu habis. Pastikan python scripts/yolo_ocr_server.py atau tunnel aktif.`
          : (err?.message || "Gagal menghubungi YOLO server"),
      },
      { status: 503 }
    );
  }
}

