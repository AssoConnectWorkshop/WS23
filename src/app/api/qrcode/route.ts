import QRCode from "qrcode";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const data = searchParams.get("data");
  if (!data) return NextResponse.json({ error: "missing data" }, { status: 400 });

  const png = await QRCode.toBuffer(data, {
    type: "png",
    width: 300,
    margin: 2,
    color: { dark: "#1E4FCC", light: "#FFFFFF" },
  });

  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
