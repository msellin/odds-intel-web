import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const ALLOWED_HOST = "media.api-sports.io";
const ONE_YEAR = 31536000;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const w = Math.min(parseInt(req.nextUrl.searchParams.get("w") ?? "40", 10), 120);

  if (!url) {
    return new NextResponse("missing url", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("invalid url", { status: 400 });
  }

  if (parsed.hostname !== ALLOWED_HOST) {
    return new NextResponse("disallowed host", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "OddsIntel/1.0" },
    });
  } catch {
    return new NextResponse("upstream fetch failed", { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse("upstream error", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const isSvg = contentType.includes("svg");

  if (isSvg) {
    // SVGs are already tiny — pass through without resizing
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": `public, max-age=${ONE_YEAR}, s-maxage=${ONE_YEAR}, immutable`,
      },
    });
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  const webp = await sharp(buffer)
    .resize(w, w, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 80 })
    .toBuffer();

  return new NextResponse(new Uint8Array(webp), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": `public, max-age=${ONE_YEAR}, s-maxage=${ONE_YEAR}, immutable`,
    },
  });
}
