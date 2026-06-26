import { NextRequest, NextResponse } from "next/server";
import { estimerLoyerParAdresse } from "../lmnp/loyers";

interface Suggestion {
  label: string;
  city: string;
  codePostal: string;
  citycode: string;
  loyerM2: number;
  loyerEstime: number;
  precision: string;
  taxeFonciere: number;
  assurancePNO: number;
}

function makeSuggestion(label: string, city: string, codePostal: string, citycode: string, surface: number): Suggestion {
  const { loyerM2, precision, taxeFonciere, assurancePNO } = estimerLoyerParAdresse({ codePostal, citycode, city, surface });
  return { label, city, codePostal, citycode, loyerM2, loyerEstime: Math.round(loyerM2 * surface), precision, taxeFonciere, assurancePNO };
}

async function searchApiAdresse(q: string, surface: number): Promise<Suggestion[]> {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features ?? []).map((f: Record<string, unknown>) => {
    const p = f.properties as Record<string, unknown>;
    return makeSuggestion(String(p.label ?? ""), String(p.city ?? ""), String(p.postcode ?? ""), String(p.citycode ?? ""), surface);
  });
}

async function searchNominatim(q: string, surface: number): Promise<Suggestion[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + " France")}&format=json&addressdetails=1&limit=5&countrycodes=fr`;
  const res = await fetch(url, {
    headers: { "User-Agent": "LMNP-Calculator/1.0" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const data: Record<string, unknown>[] = await res.json();

  return data
    .filter(item => {
      const cls = String(item.class ?? "");
      const type = String(item.type ?? "");
      // Keep neighbourhoods, suburbs, quarters, cities, municipalities
      return ["place", "boundary", "landuse"].includes(cls) ||
        ["neighbourhood", "suburb", "quarter", "village", "town", "city", "municipality", "residential"].includes(type);
    })
    .map(item => {
      const addr = item.address as Record<string, string> ?? {};
      const codePostal = addr.postcode?.replace(/\s/g, "").slice(0, 5) ?? "";
      const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
      const neighbourhood = addr.neighbourhood ?? addr.suburb ?? addr.quarter ?? "";
      const label = neighbourhood
        ? `${neighbourhood}, ${city}${codePostal ? ` (${codePostal})` : ""}`
        : String(item.display_name ?? "").split(",").slice(0, 2).join(",").trim();
      return makeSuggestion(label, city, codePostal, "", surface);
    })
    .filter(s => s.label && s.codePostal);
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const surface = parseFloat(req.nextUrl.searchParams.get("surface") ?? "30");

  if (q.length < 2) return NextResponse.json([]);

  // Run both APIs in parallel
  const [adresse, nominatim] = await Promise.allSettled([
    searchApiAdresse(q, surface),
    searchNominatim(q, surface),
  ]);

  const adresseResults = adresse.status === "fulfilled" ? adresse.value : [];
  const nominatimResults = nominatim.status === "fulfilled" ? nominatim.value : [];

  // Merge: Nominatim neighbourhood results first, then api-adresse
  const seen = new Set<string>();
  const merged: Suggestion[] = [];
  for (const s of [...nominatimResults, ...adresseResults]) {
    const key = `${s.label}|${s.codePostal}`;
    if (!seen.has(key)) { seen.add(key); merged.push(s); }
  }

  return NextResponse.json(merged.slice(0, 7));
}
