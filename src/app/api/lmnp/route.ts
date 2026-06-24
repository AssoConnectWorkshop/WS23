import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export async function POST(req: NextRequest) {
  const { annonce } = await req.json();

  if (!annonce || typeof annonce !== "string") {
    return NextResponse.json({ error: "Annonce manquante" }, { status: 400 });
  }

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyse cette annonce immobilière et extrais les informations suivantes en JSON strict (sans markdown, juste le JSON):
{
  "prix": <prix en euros, nombre entier>,
  "surface": <surface en m², nombre entier>,
  "ville": "<ville>",
  "codePostal": "<code postal si disponible, sinon vide>",
  "typeBien": "<studio|T1|T2|T3|T4|appartement|maison>",
  "nbPieces": <nombre de pièces, entier>,
  "anneeConstruction": <année ou null>,
  "estNeuf": <true si neuf/VEFA/promotion, false sinon>
}

Si une information n'est pas disponible, utilise null pour les nombres et "" pour les chaînes.
Pour le prix, prends le prix de vente affiché (pas le loyer).

Annonce:
${annonce}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Réponse inattendue du modèle" }, { status: 500 });
  }

  let parsed;
  try {
    const jsonText = content.text.trim();
    parsed = JSON.parse(jsonText);
  } catch {
    return NextResponse.json({ error: "Impossible de parser la réponse" }, { status: 500 });
  }

  const { loyer, loyerM2 } = estimerLoyer(
    parsed.ville || "",
    parsed.surface || 0
  );

  const result: ParsedListing = {
    prix: parsed.prix || 0,
    surface: parsed.surface || 0,
    ville: parsed.ville || "",
    codePostal: parsed.codePostal || "",
    typeBien: parsed.typeBien || "appartement",
    nbPieces: parsed.nbPieces || 1,
    anneeConstruction: parsed.anneeConstruction || null,
    estNeuf: parsed.estNeuf || false,
    description: `${parsed.typeBien || "Bien"} ${parsed.surface}m² à ${parsed.ville}`,
    loyerEstime: loyer,
    loyerM2,
  };

  return NextResponse.json(result);
}
