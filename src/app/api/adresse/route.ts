import { NextRequest, NextResponse } from "next/server";
import { estimerLoyerParAdresse } from "../lmnp/loyers";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const surface = parseFloat(req.nextUrl.searchParams.get("surface") ?? "30");

  if (q.length < 3) return NextResponse.json([]);

  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=6&type=housenumber,street,municipality`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return NextResponse.json([]);

  const data = await res.json();

  return NextResponse.json(
    (data.features ?? []).map((f: Record<string, unknown>) => {
      const props = f.properties as Record<string, unknown>;
      const codePostal = String(props.postcode ?? "");
      const citycode = String(props.citycode ?? "");
      const city = String(props.city ?? props.label ?? "");
      const { loyerM2, precision } = estimerLoyerParAdresse({ codePostal, citycode, city, surface });
      return {
        label: props.label,
        city,
        codePostal,
        citycode,
        loyerM2,
        loyerEstime: Math.round(loyerM2 * surface),
        precision,
      };
    })
  );
}
