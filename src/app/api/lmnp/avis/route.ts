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
  const { inputs, results, loyerInfo, conversation } = body as {
    inputs: Record<string, number | string | boolean>;
    results: Record<string, number>;
    loyerInfo: { loyerM2: number; precision: string; city: string } | null;
    conversation: { role: "user" | "agent"; text: string }[];
  };

  const systemPrompt = `Tu es un agent immobilier expert en investissement locatif LMNP, avec 15 ans d'expérience. Tu analyses des dossiers avec franchise et précision.

Dossier en cours :
- Prix d'achat : ${Number(inputs.prix).toLocaleString("fr-FR")} € | Surface : ${inputs.surface} m² | Localisation : ${inputs.ville || "non précisée"}${loyerInfo ? ` (loyer ${loyerInfo.loyerM2}€/m², précision : ${loyerInfo.precision})` : ""}
- Travaux : ${Number(inputs.travaux || 0).toLocaleString("fr-FR")} € | Loyer estimé : ${inputs.loyer} €/mois
- Apport : ${inputs.apport}% | Taux : ${inputs.taux}% sur ${inputs.duree} ans | Mensualité : ${Math.round(results.mensualiteCredit)} €/mois
- Investissement total : ${Math.round(results.investissementTotal).toLocaleString("fr-FR")} € | Cash-flow : ${Math.round(results.cashFlowMensuel)} €/mois
- Rendement brut : ${results.rendementBrut?.toFixed(2)}% | Net : ${results.rendementNet?.toFixed(2)}%
- Amortissement LMNP : ${Math.round(results.amortissementAnnuel).toLocaleString("fr-FR")} €/an | Éco. impôt : ~${Math.round(results.economieImpotAnnuelle).toLocaleString("fr-FR")} €/an`;

  // Build conversation history — first user message triggers full analysis, subsequent are follow-ups
  const isFirstMessage = conversation.filter(m => m.role === "agent").length === 0;

  const messages: Anthropic.MessageParam[] = [];

  if (isFirstMessage) {
    const userContext = conversation[0]?.text ?? "";
    messages.push({
      role: "user",
      content: `${userContext !== "(pas de contexte supplémentaire)" ? `Contexte : ${userContext}\n\n` : ""}Donne ton analyse en 3 parties :
**1. TON VERDICT** (2-3 phrases directes — dis clairement si c'est un bon deal ou pas et pourquoi)
**2. CE QUI EST SOLIDE / CE QUI M'INQUIÈTE** (points forts et risques, bullet points avec des chiffres)
**3. MES QUESTIONS** (3 à 5 questions précises pour affiner l'analyse)
Sois direct, sans langue de bois. Réponds en français.`,
    });
  } else {
    // Rebuild full conversation
    for (const msg of conversation) {
      if (msg.role === "user") {
        messages.push({ role: "user", content: msg.text });
      } else {
        messages.push({ role: "assistant", content: msg.text });
      }
    }
    // If last message is from agent, add a prompt to continue
    if (messages[messages.length - 1]?.role === "assistant") {
      messages.push({ role: "user", content: "(attends la réponse de l'investisseur)" });
    }
  }

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  return NextResponse.json({ avis: text });
}
