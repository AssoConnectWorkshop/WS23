import QRCode from "qrcode";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const data = searchParams.get("data");
  if (!data) return new Response("missing data", { status: 400 });

  const svg = await QRCode.toString(data, {
    type: "svg",
    width: 300,
    margin: 2,
    color: { dark: "#1E4FCC", light: "#FFFFFF" },
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
