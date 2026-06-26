import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { estimerLoyerParAdresse } from "./loyers";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

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
  travauxEstime?: number;
  etatBien?: string;
}

function estimerLoyer(ville: string, surface: number, codePostal?: string): { loyer: number; loyerM2: number } {
  const { loyerM2 } = estimerLoyerParAdresse({ city: ville, codePostal, surface });
  return { loyer: Math.round(loyerM2 * surface), loyerM2 };
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

async function extractFromImages(images: string[]): Promise<{ prix: number; surface: number; ville: string; nbPieces: number; estNeuf: boolean; codePostal: string; travauxEstime: number; etatBien: string }> {
  if (!anthropic) throw new Error("Clé API Anthropic manquante — configure ANTHROPIC_API_KEY sur Vercel");

  const imageContent: Anthropic.ImageBlockParam[] = images.map((b64) => {
    const [header, data] = b64.split(",");
    const mediaType = (header.match(/data:([^;]+);/) || [])[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    return {
      type: "image",
      source: { type: "base64", media_type: mediaType || "image/jpeg", data },
    };
  });

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 768,
    messages: [{
      role: "user",
      content: [
        ...imageContent,
        {
          type: "text",
          text: `Tu vois des screenshots d'une annonce immobilière française. Extrais en JSON strict (pas de markdown) :
{"prix":0,"surface":0,"ville":"","codePostal":"","nbPieces":1,"estNeuf":false,"travauxEstime":0,"etatBien":""}
- prix : prix de vente en euros (entier, 0 si absent)
- surface : m² (entier)
- ville : nom de la ville
- codePostal : code postal 5 chiffres ou ""
- nbPieces : nombre de pièces (1 si studio)
- estNeuf : true si neuf/VEFA
- travauxEstime : budget travaux en euros estimé d'après l'état visible du bien (cuisine, salle de bain, sols, murs, menuiseries). 0 si état impeccable/rénové. Sois réaliste : rénovation légère 5 000-15 000€, partielle 15 000-40 000€, complète 40 000-80 000€+
- etatBien : description courte de l'état en 1 phrase (ex: "Cuisine et sdb à refaire, parquet en bon état" ou "Bien entièrement rénové, aucun travaux nécessaire")`,
        },
      ],
    }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
  const parsed = JSON.parse(text.replace(/```json?|```/g, "").trim());
  return {
    prix: parsed.prix || 0,
    surface: parsed.surface || 0,
    ville: parsed.ville || "",
    codePostal: parsed.codePostal || "",
    nbPieces: parsed.nbPieces || 1,
    estNeuf: Boolean(parsed.estNeuf),
    travauxEstime: parsed.travauxEstime || 0,
    etatBien: parsed.etatBien || "",
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { annonce, images } = body as { annonce?: string; images?: string[] };

  // Images mode
  if (images && images.length > 0) {
    let extracted;
    try {
      extracted = await extractFromImages(images);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
    const { loyer, loyerM2 } = estimerLoyer(extracted.ville, extracted.surface);
    return NextResponse.json({
      prix: extracted.prix,
      surface: extracted.surface,
      ville: extracted.ville,
      codePostal: extracted.codePostal,
      typeBien: extracted.nbPieces <= 1 ? "studio" : `T${extracted.nbPieces - 1}`,
      nbPieces: extracted.nbPieces,
      anneeConstruction: null,
      estNeuf: extracted.estNeuf,
      description: `${extracted.nbPieces > 1 ? `T${extracted.nbPieces - 1}` : "Studio"} ${extracted.surface}m² à ${extracted.ville || "?"}`,
      loyerEstime: loyer,
      loyerM2,
      travauxEstime: extracted.travauxEstime,
      etatBien: extracted.etatBien,
    } satisfies ParsedListing);
  }

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
