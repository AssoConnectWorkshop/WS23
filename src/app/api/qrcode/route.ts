import * as QRCode from "qrcode";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const data = searchParams.get("data") ?? "";

  const svg = await QRCode.toString(data || "https://assoconnect-ws23.vercel.app/tombola-event/?participant=true", {
    type: "svg",
    width: 300,
    margin: 2,
    color: { dark: "#1E4FCC", light: "#FFFFFF" },
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
