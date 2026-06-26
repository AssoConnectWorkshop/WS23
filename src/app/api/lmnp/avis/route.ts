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

  const localisationDetail = [
    inputs.ville ? `ville/quartier : ${inputs.ville}` : null,
    loyerInfo?.city && loyerInfo.city !== inputs.ville ? `commune : ${loyerInfo.city}` : null,
    loyerInfo ? `loyer de marché : ${loyerInfo.loyerM2} €/m² (précision ${loyerInfo.precision})` : null,
  ].filter(Boolean).join(", ");

  const systemPrompt = `Tu es un agent immobilier expert en investissement locatif LMNP, avec 15 ans d'expérience. Tu analyses des dossiers avec franchise et précision.

DONNÉES COMPLÈTES DU DOSSIER — tout ce qui suit est déjà connu, ne pose JAMAIS de question là-dessus :
- Localisation : ${localisationDetail || "non précisée"}
- Prix d'achat : ${Number(inputs.prix).toLocaleString("fr-FR")} € | Surface : ${inputs.surface} m²
- Loyer estimé : ${inputs.loyer} €/mois | Travaux prévus : ${Number(inputs.travaux || 0).toLocaleString("fr-FR")} €
- Apport : ${inputs.apport}% | Taux crédit : ${inputs.taux}% sur ${inputs.duree} ans
- Mensualité : ${Math.round(results?.mensualiteCredit ?? 0)} €/mois | Investissement total : ${Math.round(results?.investissementTotal ?? 0).toLocaleString("fr-FR")} €
- Cash-flow mensuel : ${Math.round(results?.cashFlowMensuel ?? 0)} € | Annuel : ${Math.round(results?.cashFlowAnnuel ?? 0)} €
- Rendement brut : ${results?.rendementBrut?.toFixed(2)}% | Net : ${results?.rendementNet?.toFixed(2)}%
- Charges annuelles : taxe foncière ${inputs.taxeFonciere} €, expert-comptable ${inputs.expertComptable} €, PNO ${inputs.assurancePNO} €, gestion+copro ${inputs.charges}% du loyer, vacance ${inputs.vacance}%
- Amortissement LMNP : ${Math.round(results?.amortissementAnnuel ?? 0).toLocaleString("fr-FR")} €/an | Économie impôt : ~${Math.round(results?.economieImpotAnnuelle ?? 0).toLocaleString("fr-FR")} €/an`;

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

RÈGLE ABSOLUE sur les questions : tout ce qui est dans le dossier ci-dessus est DÉJÀ CONNU — n'en parle pas, ne le demande pas, ne le redemande pas (y compris la ville, le quartier, l'arrondissement, le prix, la surface, le loyer, les charges, le taux, la durée, l'apport…). Pose uniquement des questions sur ce qui est ABSENT du dossier : état du bien (cuisine, sdb, isolation), DPE, syndic et charges de copro réelles, situation locative actuelle (libre ou occupé), profil fiscal de l'investisseur (TMI, déjà propriétaire ?), horizon d'investissement, projet de revente, concurrence locative dans la rue.

Si l'investisseur décrit l'état du bien (cuisine vétuste, salle de bain à refaire, travaux de peinture, etc.) ou partage des photos, estime un budget travaux chiffré avec cette formule : "Budget travaux estimé : X €" (remplace X par le montant en chiffres). Sois précis et réaliste.
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
