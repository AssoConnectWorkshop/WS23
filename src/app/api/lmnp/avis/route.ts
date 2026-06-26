import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export async function POST(req: NextRequest) {
  if (!anthropic) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY manquante sur Vercel" }, { status: 503 });
  }

  const body = await req.json();
  const { inputs, results, contexte, loyerInfo } = body;

  const prompt = `Tu es un agent immobilier expert en investissement locatif LMNP (Loueur Meublé Non Professionnel), avec 15 ans d'expérience. Tu analyses des dossiers d'investissement avec franchise et précision.

Voici le dossier soumis :

**Le bien**
- Prix d'achat : ${inputs.prix?.toLocaleString("fr-FR")} €
- Surface : ${inputs.surface} m²
- Localisation : ${inputs.ville || "non précisée"}${loyerInfo ? ` (données loyer : ${loyerInfo.precision})` : ""}
- Loyer estimé : ${inputs.loyer} €/mois
- Travaux prévus : ${inputs.travaux || 0} €

**Financement**
- Apport : ${inputs.apport}% (${Math.round(inputs.prix * inputs.apport / 100)?.toLocaleString("fr-FR")} €)
- Taux : ${inputs.taux}% sur ${inputs.duree} ans
- Mensualité crédit : ${Math.round(results.mensualiteCredit)} €/mois

**Résultats calculés**
- Investissement total : ${Math.round(results.investissementTotal)?.toLocaleString("fr-FR")} €
- Cash-flow mensuel : ${Math.round(results.cashFlowMensuel)} €/mois
- Rendement brut : ${results.rendementBrut?.toFixed(2)}%
- Rendement net : ${results.rendementNet?.toFixed(2)}%
- Amortissement LMNP : ${Math.round(results.amortissementAnnuel)?.toLocaleString("fr-FR")} €/an
- Économie d'impôt estimée : ${Math.round(results.economieImpotAnnuelle)?.toLocaleString("fr-FR")} €/an

**Contexte apporté par l'investisseur**
${contexte?.trim() || "(aucun contexte supplémentaire)"}

---

Donne ton analyse en 3 parties :

**1. TON VERDICT** (2-3 phrases directes, sans langue de bois — dis clairement si c'est un bon deal ou pas et pourquoi)

**2. CE QUI EST SOLIDE / CE QUI M'INQUIÈTE** (points forts et risques concrets, bullet points)

**3. MES QUESTIONS** (3 à 5 questions précises que tu poserais à l'investisseur pour affiner l'analyse — questions que tu n'as pas encore la réponse)

Sois direct, précis, professionnel. Utilise des chiffres. Évite les banalités.
Réponds en français.`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  return NextResponse.json({ avis: text });
}
