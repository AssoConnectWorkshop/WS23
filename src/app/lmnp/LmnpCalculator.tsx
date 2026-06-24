"use client";

import { useState, useEffect, useCallback } from "react";
import type { ParsedListing } from "../api/lmnp/route";

interface Inputs {
  annonce: string;
  prix: number;
  surface: number;
  ville: string;
  loyer: number;
  apport: number;
  duree: number;
  taux: number;
  fraisAgence: number;
  travaux: number;
  taxeFonciere: number;
  chargesCopro: number;
  assurancePNO: number;
  gestionLocative: number;
  vacanceLocative: number;
  cfe: number;
  estNeuf: boolean;
}

interface Results {
  fraisNotaire: number;
  prixTotal: number;
  montantEmprunt: number;
  mensualiteCredit: number;
  chargesAnnuelles: number;
  chargesMensuelles: number;
  revenusBruts: number;
  cashFlowMensuel: number;
  cashFlowAnnuel: number;
  rentaBrute: number;
  rentaNette: number;
  amortissementAnnuel: number;
  resultatFiscalLMNP: number;
  economieImpot: number;
  cashFlowNet: number;
}

const DEFAULT_INPUTS: Inputs = {
  annonce: "",
  prix: 150000,
  surface: 35,
  ville: "",
  loyer: 700,
  apport: 20000,
  duree: 20,
  taux: 3.3,
  fraisAgence: 0,
  travaux: 0,
  taxeFonciere: 700,
  chargesCopro: 600,
  assurancePNO: 180,
  gestionLocative: 7,
  vacanceLocative: 8.3,
  cfe: 250,
  estNeuf: false,
};

function calcMensualite(capital: number, tauxAnnuel: number, dureeAns: number): number {
  if (capital <= 0) return 0;
  const r = tauxAnnuel / 100 / 12;
  const n = dureeAns * 12;
  if (r === 0) return capital / n;
  return (capital * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function computeResults(inp: Inputs): Results {
  const fraisNotaire = inp.prix * (inp.estNeuf ? 0.025 : 0.075);
  const prixTotal = inp.prix + fraisNotaire + inp.fraisAgence + inp.travaux;
  const montantEmprunt = Math.max(0, prixTotal - inp.apport);
  const mensualiteCredit = calcMensualite(montantEmprunt, inp.taux, inp.duree);

  const gestionMensuelle = (inp.loyer * inp.gestionLocative) / 100;
  const vacanceMensuelle = (inp.loyer * inp.vacanceLocative) / 100;
  const chargesMensuelles =
    inp.taxeFonciere / 12 +
    inp.chargesCopro / 12 +
    inp.assurancePNO / 12 +
    gestionMensuelle +
    vacanceMensuelle +
    inp.cfe / 12;

  const chargesAnnuelles = chargesMensuelles * 12;
  const revenusBruts = inp.loyer * 12 * (1 - inp.vacanceLocative / 100);

  const cashFlowMensuel = inp.loyer - mensualiteCredit - chargesMensuelles;
  const cashFlowAnnuel = cashFlowMensuel * 12;

  const rentaBrute = prixTotal > 0 ? (inp.loyer * 12) / prixTotal : 0;
  const rentaNette = prixTotal > 0 ? (revenusBruts - chargesAnnuelles) / prixTotal : 0;

  // LMNP amortissement : 85% du prix sur 30 ans + 15% mobilier sur 7 ans
  const amortissementBien = (inp.prix * 0.85) / 30;
  const amortissementMobilier = (inp.prix * 0.15) / 7;
  const amortissementAnnuel = amortissementBien + amortissementMobilier;

  const interetsAnnuels = mensualiteCredit * 12 - (montantEmprunt > 0 ? montantEmprunt / (inp.duree * 12) * 12 : 0);
  const resultatFiscalLMNP = Math.max(
    0,
    revenusBruts - chargesAnnuelles - amortissementAnnuel - Math.abs(interetsAnnuels * 0.7)
  );

  // Impôt économisé vs micro-BIC (sans LMNP réel on paierait ~30% sur 50% des revenus)
  const baseMicroBIC = revenusBruts * 0.5;
  const impotMicroBIC = baseMicroBIC * 0.3;
  const impotReel = resultatFiscalLMNP * 0.3;
  const economieImpot = Math.max(0, impotMicroBIC - impotReel);

  const cashFlowNet = cashFlowAnnuel + economieImpot;

  return {
    fraisNotaire,
    prixTotal,
    montantEmprunt,
    mensualiteCredit,
    chargesAnnuelles,
    chargesMensuelles,
    revenusBruts,
    cashFlowMensuel,
    cashFlowAnnuel,
    rentaBrute,
    rentaNette,
    amortissementAnnuel,
    resultatFiscalLMNP,
    economieImpot,
    cashFlowNet,
  };
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtEur(n: number, decimals = 0): string {
  return `${fmt(n, decimals)} €`;
}

function fmtPct(n: number): string {
  return `${fmt(n * 100, 2)} %`;
}

function Verdict({ results, maxCashFlow }: { results: Results; maxCashFlow: number }) {
  const renta = results.rentaNette;
  const cashOk = results.cashFlowMensuel >= -maxCashFlow;
  const isTop = renta >= 0.07;
  const isOk = renta >= 0.05;

  let color = "bg-red-50 border-red-200 text-red-800";
  let emoji = "❌";
  let label = "Pas rentable";
  let sublabel = "Rendement insuffisant";

  if (isTop && cashOk) {
    color = "bg-emerald-50 border-emerald-200 text-emerald-800";
    emoji = "🚀";
    label = "Excellent investissement !";
    sublabel = `Rendement net ${fmtPct(renta)} — au-dessus des 7% cibles`;
  } else if (isTop && !cashOk) {
    color = "bg-amber-50 border-amber-200 text-amber-800";
    emoji = "⚠️";
    label = "Bon rendement mais effort trop élevé";
    sublabel = `${fmtEur(Math.abs(results.cashFlowMensuel))}/mois > budget de ${fmtEur(maxCashFlow)}/mois`;
  } else if (isOk && cashOk) {
    color = "bg-blue-50 border-blue-200 text-blue-800";
    emoji = "👍";
    label = "Investissement correct";
    sublabel = `Rendement net ${fmtPct(renta)} — entre 5% et 7%`;
  } else if (isOk && !cashOk) {
    color = "bg-amber-50 border-amber-200 text-amber-800";
    emoji = "⚠️";
    label = "Rendement OK mais effort trop élevé";
    sublabel = `${fmtEur(Math.abs(results.cashFlowMensuel))}/mois > budget de ${fmtEur(maxCashFlow)}/mois`;
  } else {
    color = "bg-red-50 border-red-200 text-red-800";
  }

  return (
    <div className={`rounded-2xl border-2 p-5 ${color}`}>
      <div className="text-3xl mb-1">{emoji}</div>
      <div className="font-bold text-lg">{label}</div>
      <div className="text-sm mt-1 opacity-80">{sublabel}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="opacity-60">Rendement brut</div>
          <div className="font-bold text-base">{fmtPct(results.rentaBrute)}</div>
        </div>
        <div>
          <div className="opacity-60">Rendement net</div>
          <div className="font-bold text-base">{fmtPct(results.rentaNette)}</div>
        </div>
        <div>
          <div className="opacity-60">Cash-flow mensuel</div>
          <div className={`font-bold text-base ${results.cashFlowMensuel >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {results.cashFlowMensuel >= 0 ? "+" : ""}{fmtEur(results.cashFlowMensuel)}
          </div>
        </div>
        <div>
          <div className="opacity-60">Cash-flow annuel</div>
          <div className={`font-bold text-base ${results.cashFlowAnnuel >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {results.cashFlowAnnuel >= 0 ? "+" : ""}{fmtEur(results.cashFlowAnnuel)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: "green" | "red" | "blue" }) {
  const cls = highlight === "green" ? "text-emerald-600 font-bold" : highlight === "red" ? "text-red-600 font-bold" : highlight === "blue" ? "text-blue-600 font-bold" : "";
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-gray-100 last:border-0">
      <div>
        <span className="text-sm text-gray-600">{label}</span>
        {sub && <span className="text-xs text-gray-400 ml-1">({sub})</span>}
      </div>
      <span className={`text-sm font-medium tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

function NumInput({ label, value, onChange, suffix = "€", step = 1000, min = 0 }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="relative">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>
      </div>
    </label>
  );
}

export default function LmnpCalculator() {
  const [inp, setInp] = useState<Inputs>(DEFAULT_INPUTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<ParsedListing | null>(null);
  const maxCashFlow = 400;

  const results = computeResults(inp);

  const upd = useCallback((key: keyof Inputs, value: number | boolean | string) => {
    setInp((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (parsed) {
      setInp((prev) => ({
        ...prev,
        prix: parsed.prix || prev.prix,
        surface: parsed.surface || prev.surface,
        ville: parsed.ville || prev.ville,
        loyer: parsed.loyerEstime || prev.loyer,
        estNeuf: parsed.estNeuf,
        fraisAgence: 0,
        taxeFonciere: Math.round((parsed.loyerEstime || prev.loyer) * 0.9),
        chargesCopro: 600,
      }));
    }
  }, [parsed]);

  async function analyser() {
    if (!inp.annonce.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/lmnp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annonce: inp.annonce }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const data: ParsedListing = await res.json();
      setParsed(data);
    } catch (e) {
      setError((e as Error).message || "Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="text-2xl">🏠</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Simulateur LMNP</h1>
            <p className="text-sm text-gray-500">Calcul de rentabilité — Loueur Meublé Non Professionnel</p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche — inputs */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Coller l'annonce */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span>📋</span> Coller une annonce
            </h2>
            <textarea
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm h-36 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Colle l'annonce immobilière ici (SeLoger, LeBonCoin, Bien'ici…)"
              value={inp.annonce}
              onChange={(e) => upd("annonce", e.target.value)}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            <button
              onClick={analyser}
              disabled={loading || !inp.annonce.trim()}
              className="mt-2 w-full rounded-lg bg-blue-600 text-white text-sm font-medium py-2.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Analyse en cours…" : "✨ Analyser avec l'IA"}
            </button>
            {parsed && (
              <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
                <strong>Bien détecté :</strong> {parsed.description}<br />
                Loyer estimé : <strong>{fmtEur(parsed.loyerEstime)}/mois</strong> ({parsed.loyerM2} €/m²)
              </div>
            )}
          </div>

          {/* Bien & financement */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span>🏗️</span> Bien & financement
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <NumInput label="Prix du bien" value={inp.prix} onChange={(v) => upd("prix", v)} step={5000} />
              <NumInput label="Surface" value={inp.surface} onChange={(v) => upd("surface", v)} suffix="m²" step={1} />
              <NumInput label="Frais d'agence" value={inp.fraisAgence} onChange={(v) => upd("fraisAgence", v)} step={500} />
              <NumInput label="Travaux" value={inp.travaux} onChange={(v) => upd("travaux", v)} step={1000} />
              <NumInput label="Apport" value={inp.apport} onChange={(v) => upd("apport", v)} step={1000} />
              <NumInput label="Durée crédit" value={inp.duree} onChange={(v) => upd("duree", v)} suffix="ans" step={1} min={5} />
              <NumInput label="Taux crédit" value={inp.taux} onChange={(v) => upd("taux", v)} suffix="%" step={0.05} min={0} />
              <NumInput label="Loyer mensuel" value={inp.loyer} onChange={(v) => upd("loyer", v)} step={25} />
            </div>
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={inp.estNeuf}
                onChange={(e) => upd("estNeuf", e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-600">Bien neuf / VEFA (frais notaire réduits à 2.5%)</span>
            </label>
          </div>

          {/* Charges */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span>💸</span> Charges annuelles
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <NumInput label="Taxe foncière" value={inp.taxeFonciere} onChange={(v) => upd("taxeFonciere", v)} step={50} />
              <NumInput label="Charges copro" value={inp.chargesCopro} onChange={(v) => upd("chargesCopro", v)} step={50} />
              <NumInput label="Assurance PNO" value={inp.assurancePNO} onChange={(v) => upd("assurancePNO", v)} step={10} />
              <NumInput label="CFE" value={inp.cfe} onChange={(v) => upd("cfe", v)} step={50} />
              <NumInput label="Gestion locative" value={inp.gestionLocative} onChange={(v) => upd("gestionLocative", v)} suffix="%" step={0.5} min={0} />
              <NumInput label="Vacance locative" value={inp.vacanceLocative} onChange={(v) => upd("vacanceLocative", v)} suffix="%" step={0.5} min={0} />
            </div>
          </div>
        </div>

        {/* Colonne droite — résultats */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Verdict results={results} maxCashFlow={maxCashFlow} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Investissement total */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                💰 Investissement total
              </h2>
              <Row label="Prix du bien" value={fmtEur(inp.prix)} />
              <Row label="Frais de notaire" value={fmtEur(results.fraisNotaire)} sub={inp.estNeuf ? "2.5%" : "7.5%"} />
              <Row label="Frais d'agence" value={fmtEur(inp.fraisAgence)} />
              <Row label="Travaux" value={fmtEur(inp.travaux)} />
              <Row label="Prix total" value={fmtEur(results.prixTotal)} highlight="blue" />
              <Row label="Apport personnel" value={fmtEur(inp.apport)} />
              <Row label="Montant emprunté" value={fmtEur(results.montantEmprunt)} />
            </div>

            {/* Crédit immobilier */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                🏦 Crédit immobilier
              </h2>
              <Row label="Capital emprunté" value={fmtEur(results.montantEmprunt)} />
              <Row label="Taux" value={`${inp.taux} %`} />
              <Row label="Durée" value={`${inp.duree} ans`} />
              <Row label="Mensualité crédit" value={fmtEur(results.mensualiteCredit)} highlight="blue" />
              <Row label="Coût total crédit" value={fmtEur(results.mensualiteCredit * inp.duree * 12)} />
              <Row label="Intérêts totaux" value={fmtEur(results.mensualiteCredit * inp.duree * 12 - results.montantEmprunt)} />
            </div>

            {/* Cash-flow mensuel */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                📅 Cash-flow mensuel
              </h2>
              <Row label="Loyer encaissé" value={`+ ${fmtEur(inp.loyer)}`} highlight="green" />
              <Row label="Mensualité crédit" value={`- ${fmtEur(results.mensualiteCredit)}`} />
              <Row label="Charges mensuelles" value={`- ${fmtEur(results.chargesMensuelles)}`} />
              <div className="mt-2 pt-2 border-t border-gray-100">
                <Row
                  label="CASH-FLOW MENSUEL"
                  value={`${results.cashFlowMensuel >= 0 ? "+" : ""}${fmtEur(results.cashFlowMensuel)}`}
                  highlight={results.cashFlowMensuel >= 0 ? "green" : "red"}
                />
                <Row
                  label="CASH-FLOW ANNUEL"
                  value={`${results.cashFlowAnnuel >= 0 ? "+" : ""}${fmtEur(results.cashFlowAnnuel)}`}
                  highlight={results.cashFlowAnnuel >= 0 ? "green" : "red"}
                />
              </div>
              <div className="mt-3 rounded-lg bg-gray-50 p-3">
                <div className="text-xs text-gray-500 mb-1">Effort mensuel vs budget ({fmtEur(maxCashFlow)}/mois)</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${Math.abs(results.cashFlowMensuel) <= maxCashFlow ? "bg-emerald-400" : "bg-red-400"}`}
                    style={{ width: `${Math.min(100, (Math.abs(Math.min(0, results.cashFlowMensuel)) / maxCashFlow) * 100)}%` }}
                  />
                </div>
                <div className="text-xs mt-1 font-medium">
                  {results.cashFlowMensuel >= 0
                    ? `✅ Autofinancé (${fmtEur(results.cashFlowMensuel)}/mois de surplus)`
                    : Math.abs(results.cashFlowMensuel) <= maxCashFlow
                    ? `✅ Dans le budget (${fmtEur(Math.abs(results.cashFlowMensuel))}/mois)`
                    : `❌ Dépasse le budget (${fmtEur(Math.abs(results.cashFlowMensuel))}/mois)`}
                </div>
              </div>
            </div>

            {/* LMNP fiscal */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                🧾 Avantage LMNP (régime réel)
              </h2>
              <Row label="Revenus locatifs nets" value={fmtEur(results.revenusBruts)} />
              <Row label="Charges déductibles" value={`- ${fmtEur(results.chargesAnnuelles)}`} />
              <Row label="Amortissement annuel" value={`- ${fmtEur(results.amortissementAnnuel)}`} sub="bien + mobilier" />
              <Row label="Résultat fiscal" value={fmtEur(results.resultatFiscalLMNP)} />
              <Row label="Économie d'impôt vs micro-BIC" value={`+ ${fmtEur(results.economieImpot)}`} highlight="green" />
              <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-700">
                Grâce aux amortissements LMNP, votre résultat fiscal est quasi nul = <strong>0 impôt sur vos revenus locatifs</strong> pendant ~20 ans.
              </div>
            </div>
          </div>

          {/* Barre récap synthèse */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
              📊 Synthèse
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Prix total", value: fmtEur(results.prixTotal), color: "text-gray-800" },
                { label: "Apport min conseillé", value: fmtEur(results.fraisNotaire + inp.travaux), color: "text-blue-600" },
                { label: "Rendement brut", value: fmtPct(results.rentaBrute), color: results.rentaBrute >= 0.07 ? "text-emerald-600" : results.rentaBrute >= 0.05 ? "text-blue-600" : "text-red-500" },
                { label: "Rendement net", value: fmtPct(results.rentaNette), color: results.rentaNette >= 0.07 ? "text-emerald-600" : results.rentaNette >= 0.05 ? "text-blue-600" : "text-red-500" },
              ].map((item) => (
                <div key={item.label} className="text-center rounded-xl bg-gray-50 p-4">
                  <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" /> &gt;7% = Top</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" /> 5–7% = Correct</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> &lt;5% = Insuffisant</span>
              <span className="ml-auto">Budget max : {fmtEur(maxCashFlow)}/mois</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
