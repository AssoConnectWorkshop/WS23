import { NextRequest, NextResponse } from "next/server";

export interface ParsedListing {
  prix: number;
  surface: number;
  ville: string;
  codePostal: string;
  typeBien: string;
  nbPieces: number;
  anneeConstruction: number | null;
  estNeuf: boolean;
  description: string;
  loyerEstime: number;
  loyerM2: number;
}

const RENTAL_PRICES_M2: Record<string, number> = {
  paris: 35,
  lyon: 18,
  bordeaux: 17,
  marseille: 15,
  toulouse: 15,
  nantes: 16,
  montpellier: 16,
  lille: 17,
  strasbourg: 16,
  rennes: 16,
  nice: 22,
  grenoble: 14,
  toulon: 14,
  angers: 13,
  reims: 12,
  dijon: 13,
  metz: 12,
  nancy: 12,
  clermont: 11,
  rouen: 13,
  tours: 13,
  saint: 12,
  caen: 12,
};

function estimerLoyer(ville: string, surface: number): { loyer: number; loyerM2: number } {
  const villeLower = ville.toLowerCase().replace(/-/g, " ");
  let loyerM2 = 12;

  for (const [key, prix] of Object.entries(RENTAL_PRICES_M2)) {
    if (villeLower.includes(key)) {
      loyerM2 = prix;
      break;
    }
  }

  const loyer = Math.round(loyerM2 * surface);
  return { loyer, loyerM2 };
}

function extractFromText(text: string): { prix: number; surface: number; ville: string; nbPieces: number; estNeuf: boolean; codePostal: string } {
  const clean = text.replace(/\s+/g, " ");

  const prixMatch =
    clean.match(/(\d[\d\s]{4,})\s*€/i) ||
    clean.match(/prix[^\d]*(\d[\d\s]+)/i) ||
    clean.match(/(\d[\d\s]+)\s*euros?/i);
  const prix = prixMatch ? parseInt(prixMatch[1].replace(/\s/g, "")) : 0;

  const surfaceMatch = clean.match(/(\d{1,4})[,.]?\d*\s*m[²2]/i);
  const surface = surfaceMatch ? parseInt(surfaceMatch[1]) : 0;

  const cpMatch = clean.match(/\b(\d{5})\b/);
  const codePostal = cpMatch ? cpMatch[1] : "";

  const villeMatch =
    clean.match(/(?:à|situé[e]?\s+à|commune\s+de|ville\s+de|Ville\s*:)\s*([A-ZÀ-Üa-zà-ü][A-ZÀ-Üa-zà-ü\- ]{1,30})/i) ||
    clean.match(/\d{5}\s+([A-ZÀ-Ü][A-ZÀ-Üa-zà-ü\- ]{1,30})/);
  const ville = villeMatch ? villeMatch[1].trim() : "";

  const piecesMatch = clean.match(/(\d+)\s*(?:pièces?|P\b)/i);
  const nbPieces = piecesMatch ? parseInt(piecesMatch[1]) : 1;

  const estNeuf = /neuf|vefa|promotion|promoteur|livraison/i.test(clean);

  return { prix, surface, ville, nbPieces, estNeuf, codePostal };
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&euro;/g, "€")
    .replace(/\s{3,}/g, " ")
    .trim();
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const match = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    if (Array.isArray(data)) return data[0] || null;
    return data;
  } catch {
    return null;
  }
}

function extractNextData(html: string): Record<string, unknown> | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function deepFind(obj: unknown, keys: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) {
    if ((obj as Record<string, unknown>)[key] !== undefined) return (obj as Record<string, unknown>)[key];
  }
  for (const val of Object.values(obj as Record<string, unknown>)) {
    const found = deepFind(val, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

async function fetchListingText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Accept-Language": "fr-FR,fr;q=0.9",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function POST(req: NextRequest) {
  const { annonce } = await req.json();

  if (!annonce || typeof annonce !== "string") {
    return NextResponse.json({ error: "Annonce manquante" }, { status: 400 });
  }

  const isUrl = /^https?:\/\//i.test(annonce.trim());
  let extracted: { prix: number; surface: number; ville: string; nbPieces: number; estNeuf: boolean; codePostal: string };

  if (isUrl) {
    let html: string;
    try {
      html = await fetchListingText(annonce.trim());
    } catch (e) {
      return NextResponse.json({ error: `Impossible de charger la page : ${(e as Error).message}` }, { status: 502 });
    }

    // Try __NEXT_DATA__ first (SeLoger, Bien'ici)
    const nextData = extractNextData(html);
    if (nextData) {
      const prix = deepFind(nextData, ["price", "prix", "salePrice", "listingPrice"]);
      const surface = deepFind(nextData, ["surface", "surfaceArea", "area", "livingArea"]);
      const ville = deepFind(nextData, ["city", "ville", "cityLabel", "town"]);
      const cp = deepFind(nextData, ["postalCode", "zipCode", "codePostal"]);
      const pieces = deepFind(nextData, ["rooms", "roomsCount", "nbRooms", "nbPieces"]);
      const neuf = deepFind(nextData, ["isNew", "estNeuf", "newProperty"]);

      if (prix || surface) {
        extracted = {
          prix: typeof prix === "number" ? prix : parseInt(String(prix || "0").replace(/\D/g, "")) || 0,
          surface: typeof surface === "number" ? surface : parseInt(String(surface || "0")) || 0,
          ville: String(ville || ""),
          nbPieces: typeof pieces === "number" ? pieces : parseInt(String(pieces || "1")) || 1,
          estNeuf: Boolean(neuf),
          codePostal: String(cp || ""),
        };
      } else {
        extracted = extractFromText(stripHtml(html));
      }
    } else {
      // JSON-LD fallback
      const ld = extractJsonLd(html);
      if (ld) {
        extracted = {
          prix: typeof ld.price === "number" ? ld.price : parseInt(String(ld.price || ld.offers || "0").replace(/\D/g, "")) || 0,
          surface: typeof ld.floorSize === "number" ? ld.floorSize : 0,
          ville: String((ld.address as Record<string, unknown>)?.addressLocality || ld.addressLocality || ""),
          nbPieces: typeof ld.numberOfRooms === "number" ? ld.numberOfRooms : 1,
          estNeuf: false,
          codePostal: String((ld.address as Record<string, unknown>)?.postalCode || ""),
        };
        if (!extracted.prix && !extracted.surface) {
          extracted = extractFromText(stripHtml(html));
        }
      } else {
        extracted = extractFromText(stripHtml(html));
      }
    }

    // Extract city from URL slug as fallback
    if (!extracted.ville) {
      const urlCity = annonce.match(/\/(?:achat|location)\/(?:appartement|maison|studio)\/([a-z0-9-]+)\//i);
      if (urlCity) {
        const citySlug = urlCity[1].replace(/-\d+eme.*$/, "").replace(/-/g, " ");
        extracted.ville = citySlug.charAt(0).toUpperCase() + citySlug.slice(1);
      }
    }
  } else {
    extracted = extractFromText(annonce);
  }

  const { loyer, loyerM2 } = estimerLoyer(extracted.ville, extracted.surface);

  const result: ParsedListing = {
    prix: extracted.prix,
    surface: extracted.surface,
    ville: extracted.ville,
    codePostal: extracted.codePostal,
    typeBien: extracted.nbPieces <= 1 ? "studio" : extracted.nbPieces === 2 ? "T1" : `T${extracted.nbPieces - 1}`,
    nbPieces: extracted.nbPieces,
    anneeConstruction: null,
    estNeuf: extracted.estNeuf,
    description: `${extracted.nbPieces > 1 ? `T${extracted.nbPieces - 1}` : "Studio"} ${extracted.surface}m² à ${extracted.ville || "?"}`,
    loyerEstime: loyer,
    loyerM2,
  };

  return NextResponse.json(result);
}
