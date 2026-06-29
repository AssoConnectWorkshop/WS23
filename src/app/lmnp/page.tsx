"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const BLUE = "#2563EB";
const TEAL = "#00B37D";
const BG = "#F7F8FC";
const RED = "#EF4444";
const ORANGE = "#F59E0B";
const GREEN = "#10B981";
const BLUE_LIGHT = "#EFF3FF";
const TEXT = "#0F172A";
const MUTED = "#64748B";
const BORDER = "#E8ECF4";

// Taux immobilier moyen France juin 2026
const DEFAULT_RATE = 3.6;
const DEFAULT_DURATION = 20;
const DEFAULT_APPORT = 10;
const DEFAULT_FRAIS_NOTAIRE = 7.5;
const DEFAULT_AMEUBLEMENT = 8000;
const DEFAULT_CHARGES = 15; // % du loyer (copro, taxe foncière, assurance, gestion)
const DEFAULT_VACANCE = 5; // % du temps vacant

function Field({ label, value, onChange, unit = "€", min = 0 }: {
  label: string; value: number; onChange: (v: number) => void;
  unit?: string; min?: number;
}) {
  const [local, setLocal] = useState(value === 0 ? "" : String(value));
  const focused = useRef(false);

  // Sync external value changes (e.g. autofill from listing) when not focused
  useEffect(() => {
    if (!focused.current) {
      setLocal(value === 0 ? "" : String(value));
    }
  }, [value]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: MUTED }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="text" inputMode="decimal" value={local}
          onChange={e => {
            const raw = e.target.value.replace(/,/g, ".");
            setLocal(raw);
            const num = parseFloat(raw);
            if (!isNaN(num) && num >= min) onChange(num);
            else if (raw === "" || raw === "-") onChange(0);
          }}
          onFocus={e => {
            focused.current = true;
            e.target.select();
            e.target.style.borderColor = BLUE;
          }}
          onBlur={e => {
            focused.current = false;
            const num = parseFloat(local.replace(/,/g, "."));
            const final = isNaN(num) ? 0 : Math.max(min, num);
            setLocal(final === 0 ? "" : String(final));
            onChange(final);
            e.target.style.borderColor = BORDER;
          }}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 15, fontWeight: 600,
            border: `1.5px solid ${BORDER}`, outline: "none", background: "white",
            fontFamily: "inherit", color: TEXT,
          }}
        />
        <span style={{ color: MUTED, fontWeight: 500, fontSize: 13, minWidth: 28, flexShrink: 0 }}>{unit}</span>
      </div>
    </div>
  );
}

function parseListingText(text: string) {
  const prixMatch = text.match(/(\d[\d\s]*)\s*€(?:\s*FAI)?(?:\s*\*)?/i) ||
    text.match(/prix[^:]*:\s*([\d\s]+)/i) ||
    text.match(/([\d\s]{5,})\s*euros?/i);
  const prix = prixMatch ? parseInt(prixMatch[1].replace(/\s/g, "")) : 0;

  const surfaceMatch = text.match(/(\d+)\s*m²/i) || text.match(/(\d+)\s*m2/i);
  const surface = surfaceMatch ? parseInt(surfaceMatch[1]) : 0;

  const villeMatch = text.match(/(?:à|situé[e]? à|commune de|ville de)\s+([A-ZÀ-Ü][a-zA-Zà-ü\-]+(?:\s[A-ZÀ-Ü][a-zA-Zà-ü\-]+)*)/i) ||
    text.match(/(\d{5})\s+([A-ZÀ-Ü][a-zA-Zà-ü\s\-]+)/);
  const ville = villeMatch ? (villeMatch[2] || villeMatch[1]).trim() : "";

  const piecesMatch = text.match(/(\d+)\s*(?:pièces?|P|chambres?)/i);
  const pieces = piecesMatch ? parseInt(piecesMatch[1]) : 0;

  return { prix, surface, ville, pieces };
}

function loyerEstime(surface: number, ville: string): number {
  const villeNorm = ville.toLowerCase();
  let prixM2 = 12;
  if (villeNorm.includes("paris")) prixM2 = 35;
  else if (["lyon", "marseille", "bordeaux", "nice"].some(v => villeNorm.includes(v))) prixM2 = 18;
  else if (["toulouse", "nantes", "montpellier", "strasbourg", "lille", "rennes"].some(v => villeNorm.includes(v))) prixM2 = 15;
  else if (["grenoble", "annecy", "aix-en-provence", "aix"].some(v => villeNorm.includes(v))) prixM2 = 16;
  else if (["chambéry", "angers", "tours", "dijon", "metz", "reims"].some(v => villeNorm.includes(v))) prixM2 = 12;
  return Math.round(surface * prixM2);
}

function mensualiteCredit(capital: number, tauxAnnuel: number, dureeAns: number): number {
  const r = tauxAnnuel / 100 / 12;
  const n = dureeAns * 12;
  if (r === 0) return capital / n;
  return (capital * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function tauxMarche(duree: number, apport: number): number {
  const base = duree <= 10 ? 3.10 : duree <= 15 ? 3.30 : duree <= 20 ? 3.55 : 3.75;
  const adj = apport < 10 ? 0.30 : apport < 20 ? 0.10 : apport < 30 ? 0 : apport < 40 ? -0.10 : -0.20;
  return Math.round((base + adj) * 20) / 20;
}

interface Inputs {
  annonce: string;
  prix: number;
  surface: number;
  ville: string;
  loyer: number;
  apport: number;
  taux: number;
  duree: number;
  fraisNotaire: number;
  ameublement: number;
  charges: number;
  vacance: number;
  travaux: number;
  fraisAgence: number;
  taxeFonciere: number;
  expertComptable: number;
  assurancePNO: number;
}

interface Results {
  investissementTotal: number;
  montantEmprunt: number;
  mensualiteCredit: number;
  loyerNetMensuel: number;
  cashFlowMensuel: number;
  cashFlowAnnuel: number;
  rendementBrut: number;
  rendementNet: number;
  amortissementAnnuel: number;
  economieImpotAnnuelle: number;
}

function compute(inputs: Inputs): Results {
  const fraisNotaireEuros = inputs.prix * (inputs.fraisNotaire / 100);
  const investissementTotal = inputs.prix + fraisNotaireEuros + inputs.ameublement + inputs.travaux + inputs.fraisAgence;
  const apportEuros = inputs.prix * (inputs.apport / 100);
  const montantEmprunt = investissementTotal - apportEuros;
  const mensualite = mensualiteCredit(montantEmprunt, inputs.taux, inputs.duree);

  const loyerMensuelBrut = inputs.loyer * (1 - inputs.vacance / 100);
  const chargesMensuelles = inputs.loyer * (inputs.charges / 100);
  const chargesFixesMensuelles = (inputs.taxeFonciere + inputs.expertComptable + inputs.assurancePNO) / 12;
  const loyerNetMensuel = loyerMensuelBrut - chargesMensuelles - chargesFixesMensuelles;

  const cashFlowMensuel = loyerNetMensuel - mensualite;
  const cashFlowAnnuel = cashFlowMensuel * 12;

  const rendementBrut = (inputs.loyer * 12 / investissementTotal) * 100;
  const rendementNet = ((loyerNetMensuel * 12) / investissementTotal) * 100;

  const amortissementImmeuble = (inputs.prix * 0.85) / 30;
  const amortissementMeubles = inputs.ameublement / 7;
  const amortissementAnnuel = amortissementImmeuble + amortissementMeubles;
  const economieImpotAnnuelle = amortissementAnnuel * 0.472;

  return {
    investissementTotal,
    montantEmprunt,
    mensualiteCredit: mensualite,
    loyerNetMensuel,
    cashFlowMensuel,
    cashFlowAnnuel,
    rendementBrut,
    rendementNet,
    amortissementAnnuel,
    economieImpotAnnuelle,
  };
}

function fmt(n: number, dec = 0) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

interface AdresseSuggestion {
  label: string;
  city: string;
  codePostal: string;
  loyerM2: number;
  loyerEstime: number;
  precision: string;
  taxeFonciere: number;
  assurancePNO: number;
}

function AddressAutocomplete({ surface, onSelect }: {
  surface: number;
  onSelect: (s: AdresseSuggestion) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AdresseSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  const search = (q: string) => {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/adresse?q=${encodeURIComponent(q)}&surface=${surface}`);
        const data: AdresseSuggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch { setSuggestions([]); }
    }, 280);
  };

  const pick = (s: AdresseSuggestion) => {
    setQuery(s.label);
    setOpen(false);
    onSelect(s);
  };

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: MUTED }}>
        Quartier / adresse — <span style={{ color: ORANGE }}>crucial pour estimer le loyer</span>
      </label>
      <input
        type="text"
        value={query}
        onChange={e => search(e.target.value)}
        placeholder="Ex : Lyon 6e, Paris 11, Bordeaux Chartrons, Marseille 13008..."
        style={{
          padding: "10px 14px", borderRadius: 10, fontSize: 14,
          border: `1.5px solid ${BORDER}`, outline: "none", fontFamily: "inherit",
          background: "white", color: TEXT,
        }}
        onFocus={e => (e.target.style.borderColor = BLUE)}
        onBlur={e => { setTimeout(() => setOpen(false), 150); e.target.style.borderColor = BORDER; }}
      />
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: "white", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          border: `1px solid ${BORDER}`, overflow: "hidden", marginTop: 4,
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => pick(s)}
              style={{
                padding: "10px 14px", cursor: "pointer", borderBottom: i < suggestions.length - 1 ? `1px solid ${BORDER}` : "none",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = BLUE_LIGHT)}
              onMouseLeave={e => (e.currentTarget.style.background = "white")}
            >
              <span style={{ fontSize: 14, color: TEXT }}>{s.label}</span>
              <span style={{ fontSize: 12, color: BLUE, fontWeight: 700, whiteSpace: "nowrap", marginLeft: 8 }}>
                ~{s.loyerM2} €/m²
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentMessage({ text, onApplyTravaux, blue }: { text: string; onApplyTravaux: (m: number) => void; blue: string }) {
  const travaux = (() => {
    const m = text.match(/(?:budget\s+travaux[^:]*:|travaux[^:]*estimé[^:]*:)\s*[\*~]*([\d\s]+(?:\s*000)?)\s*€/i);
    if (!m) return null;
    const n = parseInt(m[1].replace(/\s/g, ""));
    return n >= 1000 ? n : null;
  })();

  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];

  const renderInline = (s: string, key: number): React.ReactNode => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={key}>
        {parts.map((p, i) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={i} style={{ fontWeight: 700, color: "#0f172a" }}>{p.slice(2, -2)}</strong>
            : p
        )}
      </span>
    );
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const headingMatch = line.match(/^\*\*(\d+\.\s*.+?)\*\*\s*$/) || line.match(/^#+\s*(.+)$/);
    if (headingMatch) {
      const label = headingMatch[1];
      const accent = label.toLowerCase().includes("solid") || label.toLowerCase().includes("point") ? "#10b981"
        : label.toLowerCase().includes("inqui") || label.toLowerCase().includes("risque") ? "#f59e0b"
        : label.toLowerCase().includes("question") ? blue
        : blue;
      nodes.push(
        <div key={i} style={{ marginTop: i > 0 ? 18 : 0, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 16, borderRadius: 2, background: accent, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: accent }}>{label}</span>
        </div>
      );
      i++; continue;
    }
    if (line.match(/^[-•]\s+/)) {
      const bullets: string[] = [];
      while (i < lines.length && lines[i].match(/^[-•]\s+/)) {
        bullets.push(lines[i].replace(/^[-•]\s+/, ""));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} style={{ margin: "6px 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          {bullets.map((b, bi) => (
            <li key={bi} style={{ fontSize: 14, lineHeight: 1.65, color: "#334155", listStyleType: "disc" }}>{renderInline(b, bi)}</li>
          ))}
        </ul>
      );
      continue;
    }
    if (line.match(/^\d+\.\s+/)) {
      nodes.push(<p key={i} style={{ margin: "4px 0", fontSize: 14, lineHeight: 1.65, color: "#334155" }}>{renderInline(line, i)}</p>);
      i++; continue;
    }
    if (line.trim() === "") { nodes.push(<div key={i} style={{ height: 6 }} />); i++; continue; }
    nodes.push(<p key={i} style={{ margin: "3px 0", fontSize: 14, lineHeight: 1.7, color: "#334155" }}>{renderInline(line, i)}</p>);
    i++;
  }

  return (
    <div>
      {nodes}
      {travaux && (
        <button
          onClick={() => onApplyTravaux(travaux)}
          style={{
            marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 9, border: `1.5px solid ${blue}`,
            background: `${blue}08`, color: blue, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={blue} strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Appliquer {travaux.toLocaleString("fr-FR")} € de travaux
        </button>
      )}
    </div>
  );
}

// Section header with accent bar
function SectionHeader({ label, color = MUTED }: { label: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: BLUE, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
    </div>
  );
}

function mdToHtml(text: string): string {
  return text
    // Strip markdown tables (lines with |)
    .replace(/^\|.*\|$/gm, "")
    .replace(/^\|[-| :]+\|$/gm, "")
    // Headings
    .replace(/^#{1,3}\s+(.+)$/gm, "<h3>$1</h3>")
    // Horizontal rules
    .replace(/^---+$/gm, "<hr>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Bullet points
    .replace(/^[-•✅❌]\s+(.+)$/gm, "<li>$1</li>")
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    // Blockquote
    .replace(/^>\s+(.+)$/gm, "<blockquote>$1</blockquote>")
    // Paragraphs: blank lines → <br>
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, " ")
    // Clean up empty tags
    .replace(/<h3><\/h3>/g, "")
    .trim();
}

function openPrintWindow(
  inputs: Inputs,
  results: Results,
  verdict: { label: string; color: string; bg: string } | null,
  conversation: { role: string; text: string }[]
) {
  const f = (n: number, d = 0) => Math.round(n).toLocaleString("fr-FR");
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const cfColor = results.cashFlowMensuel >= 0 ? "#059669" : "#dc2626";
  const loyerNetColor = results.loyerNetMensuel >= 0 ? "#059669" : "#f59e0b";

  const agentMsgs = conversation.filter(m => m.role === "agent");
  const firstAgent = agentMsgs[0];
  const lastAgent = agentMsgs.length > 1 ? agentMsgs[agentMsgs.length - 1] : null;

  const agentSection = agentMsgs.length > 0 ? `
    <div class="section-title">Avis de l'agent expert LMNP</div>
    <div class="agent-box">
      ${firstAgent ? mdToHtml(firstAgent.text) : ""}
    </div>
    ${lastAgent ? `<div class="agent-label">Analyse finale</div><div class="agent-box">${mdToHtml(lastAgent.text)}</div>` : ""}
  ` : "";

  const cashRows = [
    { label: `Loyer brut`, value: inputs.loyer, color: "#059669" },
    { label: `− Vacance (${inputs.vacance}%)`, value: -Math.round(inputs.loyer * inputs.vacance / 100), color: "#dc2626" },
    { label: `− Charges & gestion (${inputs.charges}%)`, value: -Math.round(inputs.loyer * inputs.charges / 100), color: "#dc2626" },
    { label: `− Taxe foncière (÷12)`, value: -Math.round(inputs.taxeFonciere / 12), color: "#dc2626" },
    { label: `− Comptable + PNO (÷12)`, value: -Math.round((inputs.expertComptable + inputs.assurancePNO) / 12), color: "#dc2626" },
    { label: `= Loyer net`, value: Math.round(results.loyerNetMensuel), color: loyerNetColor, bold: true },
    { label: `− Mensualité crédit`, value: -Math.round(results.mensualiteCredit), color: "#dc2626" },
    { label: `= Cash flow mensuel`, value: Math.round(results.cashFlowMensuel), color: cfColor, bold: true, big: true },
  ].map(r => `
    <tr class="${r.big ? "row-big" : r.bold ? "row-bold" : ""}">
      <td>${r.label}</td>
      <td style="color:${r.color};text-align:right;font-weight:${r.bold ? 700 : 400}">${r.value >= 0 ? "+" : ""}${f(r.value)} €</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>JuNe — Analyse LMNP · ${inputs.ville || "Bien"}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Inter", system-ui, -apple-system, sans-serif; color: #0f172a; background: white; font-size: 13px; line-height: 1.5; }
  .page { max-width: 780px; margin: 0 auto; padding: 32px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2.5px solid #2563EB; margin-bottom: 22px; }
  .logo { font-size: 26px; font-weight: 900; color: #2563EB; letter-spacing: -0.03em; }
  .logo-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .prop-name { font-size: 16px; font-weight: 700; text-align: right; }
  .prop-sub { font-size: 11px; color: #64748b; text-align: right; margin-top: 3px; }
  .verdict-box { display: flex; align-items: center; gap: 18px; padding: 14px 20px; border-radius: 10px; margin-bottom: 22px; background: ${verdict?.bg || "#f8faff"}; border: 2px solid ${verdict?.color ? verdict.color + "50" : "#e2e8f0"}; }
  .verdict-label { font-size: 30px; font-weight: 900; color: ${verdict?.color || "#0f172a"}; }
  .verdict-detail { font-size: 13px; color: ${verdict?.color || "#374151"}; font-weight: 600; }
  .verdict-cf { font-size: 12px; color: #64748b; margin-top: 3px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 22px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  .grid-item { display: flex; justify-content: space-between; align-items: center; padding: 9px 14px; border-bottom: 1px solid #f1f5f9; }
  .grid-item:nth-child(odd) { border-right: 1px solid #f1f5f9; }
  .grid-label { font-size: 11px; color: #64748b; }
  .grid-value { font-size: 13px; font-weight: 700; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #2563EB; padding-bottom: 7px; border-bottom: 1px solid #dbeafe; margin-bottom: 12px; margin-top: 20px; }
  table.cf { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  table.cf td { padding: 5px 8px; font-size: 12px; }
  table.cf tr.row-bold td { border-top: 1px solid #e2e8f0; padding-top: 8px; font-weight: 600; }
  table.cf tr.row-big { background: ${cfColor}12; border-radius: 6px; }
  table.cf tr.row-big td { font-size: 15px; font-weight: 800; padding: 8px 10px; }
  .fiscal { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px; margin-bottom: 20px; }
  .fiscal-box { background: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 14px; }
  .fiscal-label { font-size: 10px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  .fiscal-value { font-size: 18px; font-weight: 800; color: #059669; }
  .fiscal-sub { font-size: 10px; color: #6ee7b7; margin-top: 2px; }
  .agent-box { background: #f8faff; border: 1px solid #e8eeff; border-radius: 8px; padding: 14px 16px; font-size: 12px; line-height: 1.75; color: #1e293b; margin-bottom: 10px; }
  .agent-box h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #2563EB; margin: 14px 0 5px; }
  .agent-box h3:first-child { margin-top: 0; }
  .agent-box ul { padding-left: 18px; margin: 5px 0; }
  .agent-box li { margin: 3px 0; }
  .agent-box hr { border: none; border-top: 1px solid #e2e8f0; margin: 8px 0; }
  .agent-box blockquote { border-left: 3px solid #2563EB; padding-left: 10px; color: #374151; font-style: italic; margin: 6px 0; }
  .agent-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin: 12px 0 5px; }
  .footer { border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; margin-top: 20px; }
  @media print {
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 20px 28px; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="logo">JuNe</div>
      <div class="logo-sub">Simulateur LMNP — Analyse d'investissement</div>
    </div>
    <div>
      <div class="prop-name">${inputs.ville || "Bien immobilier"}</div>
      <div class="prop-sub">${inputs.surface} m² · ${f(inputs.prix)} € · ${date}</div>
    </div>
  </div>

  ${verdict ? `
  <div class="verdict-box">
    <div class="verdict-label">${verdict.label}</div>
    <div>
      <div class="verdict-detail">Rendement net ${results.rendementNet.toFixed(2)}% · Rendement brut ${results.rendementBrut.toFixed(2)}%</div>
      <div class="verdict-cf">Cash flow mensuel : <strong style="color:${cfColor}">${results.cashFlowMensuel >= 0 ? "+" : ""}${f(results.cashFlowMensuel)} €/mois</strong></div>
    </div>
  </div>` : ""}

  <div class="section-title">Chiffres clés</div>
  <div class="grid2">
    ${[
      { label: "Prix d'achat", value: `${f(inputs.prix)} €` },
      { label: "Surface", value: `${inputs.surface} m²` },
      { label: "Investissement total", value: `${f(results.investissementTotal)} €` },
      { label: "Emprunt", value: `${f(results.montantEmprunt)} €` },
      { label: "Apport", value: `${inputs.apport}%` },
      { label: "Taux / Durée", value: `${inputs.taux}% sur ${inputs.duree} ans` },
      { label: "Mensualité crédit", value: `<span style="color:#dc2626">${f(results.mensualiteCredit)} €/mois</span>` },
      { label: "Loyer estimé", value: `<span style="color:#059669">${f(inputs.loyer)} €/mois</span>` },
      { label: "Budget travaux", value: `${f(inputs.travaux)} €` },
      { label: "Rendement brut", value: `${results.rendementBrut.toFixed(2)}%` },
    ].map(item => `<div class="grid-item"><span class="grid-label">${item.label}</span><span class="grid-value">${item.value}</span></div>`).join("")}
  </div>

  <div class="section-title">Détail du cash flow mensuel</div>
  <table class="cf">
    ${cashRows}
  </table>

  <div class="fiscal">
    <div class="fiscal-box">
      <div class="fiscal-label">Amortissement annuel</div>
      <div class="fiscal-value">${f(results.amortissementAnnuel)} €</div>
      <div class="fiscal-sub">immeuble 30 ans + meubles 7 ans</div>
    </div>
    <div class="fiscal-box">
      <div class="fiscal-label">Économie d'impôt estimée</div>
      <div class="fiscal-value">~${f(results.economieImpotAnnuelle)} €/an</div>
      <div class="fiscal-sub">tranche 30% IR + 17.2% prélèvements sociaux</div>
    </div>
  </div>

  ${agentSection}

  <div class="footer">
    <span>JuNe — Simulateur LMNP · Estimation indicative, non contractuelle</span>
    <span>Consulte un expert-comptable spécialisé LMNP pour valider ton montage fiscal</span>
  </div>
</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// ─── Card style ───────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "white",
  borderRadius: 16,
  padding: "24px 28px",
  border: `1px solid ${BORDER}`,
  boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
};

export default function LMNPPage() {
  const [inputs, setInputs] = useState<Inputs>({
    annonce: "",
    prix: 0,
    surface: 0,
    ville: "",
    loyer: 0,
    apport: DEFAULT_APPORT,
    taux: DEFAULT_RATE,
    duree: DEFAULT_DURATION,
    fraisNotaire: DEFAULT_FRAIS_NOTAIRE,
    ameublement: DEFAULT_AMEUBLEMENT,
    charges: DEFAULT_CHARGES,
    vacance: DEFAULT_VACANCE,
    travaux: 0,
    fraisAgence: 0,
    taxeFonciere: 800,
    expertComptable: 600,
    assurancePNO: 150,
  });
  const [parsed, setParsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loyerInfo, setLoyerInfo] = useState<{ loyerM2: number; precision: string; city: string } | null>(null);
  const [contexte, setContexte] = useState("");
  const [conversation, setConversation] = useState<{ role: "user" | "agent"; text: string }[]>([]);
  const [reply, setReply] = useState("");
  const [avisLoading, setAvisLoading] = useState(false);
  const [etatBien, setEtatBien] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chargesOpen, setChargesOpen] = useState(true);
  const [cfDetailOpen, setCfDetailOpen] = useState(true);
  const [lectureOpen, setLectureOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [tauxManuel, setTauxManuel] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!tauxManuel) {
      setInputs(prev => ({ ...prev, taux: tauxMarche(prev.duree, prev.apport) }));
    }
  }, [inputs.duree, inputs.apport, tauxManuel]);

  const set = useCallback((key: keyof Inputs, val: number | string) => {
    if (key === "taux") setTauxManuel(true);
    setInputs(prev => ({ ...prev, [key]: val }));
  }, []);

  const addImages = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = e => {
        const b64 = e.target?.result as string;
        setImages(prev => prev.includes(b64) ? prev : [...prev, b64]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); addImages(files); }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [addImages]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files).filter(f => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); addImages(files); }
  }, [addImages]);

  const parseAnnonce = async () => {
    setLoading(true);
    setError("");

    try {
      let body: Record<string, unknown>;

      if (images.length > 0) {
        body = { images };
      } else {
        const text = inputs.annonce.trim();
        const isUrl = /^https?:\/\//i.test(text);
        if (!isUrl) {
          const { prix, surface, ville, pieces: _pieces } = parseListingText(text);
          const loyer = (surface > 0 && ville) ? loyerEstime(surface, ville) : 0;
          setInputs(prev => ({
            ...prev,
            prix: prix || prev.prix,
            surface: surface || prev.surface,
            ville: ville || prev.ville,
            loyer: (loyer && !prev.loyer) ? loyer : prev.loyer,
          }));
          setParsed(true);
          setLoading(false);
          return;
        }
        body = { annonce: text };
      }

      const res = await fetch("/api/lmnp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");
      setInputs(prev => ({
        ...prev,
        prix: data.prix || prev.prix,
        surface: data.surface || prev.surface,
        ville: data.ville || prev.ville,
        loyer: (data.loyerEstime && data.ville && !prev.loyer) ? data.loyerEstime : prev.loyer,
        travaux: data.travauxEstime != null && data.travauxEstime > 0 ? data.travauxEstime : prev.travaux,
        taxeFonciere: data.taxeFonciere != null && data.taxeFonciere > 0 ? data.taxeFonciere : prev.taxeFonciere,
        // chargesCopro is monthly → annualize and add to charges% approximation is impractical; store as taxeFonciere override only
      }));
      if (data.etatBien) setEtatBien(data.etatBien);
      setParsed(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const results = inputs.prix > 0 && inputs.loyer > 0 ? compute(inputs) : null;

  const callAvis = useCallback(async (conv: { role: "user" | "agent"; text: string }[], currentInputs: Inputs, currentResults: Results | null) => {
    setAvisLoading(true);
    try {
      const res = await fetch("/api/lmnp/avis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: currentInputs, results: currentResults, loyerInfo, conversation: conv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConversation(prev => [...prev, { role: "agent", text: data.avis }]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      setConversation(prev => [...prev, { role: "agent", text: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setAvisLoading(false);
    }
  }, [loyerInfo]);

  const sendReply = useCallback(async () => {
    if (!reply.trim()) return;
    const userMsg = reply.trim();
    setReply("");
    const newConv = [...conversation, { role: "user" as const, text: userMsg }];
    setConversation(newConv);
    await callAvis(newConv, inputs, results);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reply, conversation, inputs, results, callAvis]);

  const refreshAnalysis = useCallback(async () => {
    const msg = "Les chiffres ont changé (travaux, loyer ou autres paramètres mis à jour). Refais une analyse complète avec les nouvelles données du dossier.";
    const newConv = [...conversation, { role: "user" as const, text: msg }];
    setConversation(newConv);
    await callAvis(newConv, inputs, results);
  }, [conversation, inputs, results, callAvis]);

  // Parse ALL agent messages for proposed changes — robust multi-pattern extraction
  const parseProposals = useCallback((): Partial<Inputs> => {
    const allAgent = conversation.filter(m => m.role === "agent").map(m => m.text).join("\n");
    const lastAgent = [...conversation].reverse().find(m => m.role === "agent")?.text ?? "";
    const updated: Partial<Inputs> = {};

    // Priority: last message structured block, then last message free text, then full history
    const sources = [
      lastAgent.match(/PARAM[EÈ]TRES?\s+[ÀA]\s+R[EÉ]VISER[^:\n]*:?\s*([^\n]+)/i)?.[1],
      lastAgent,
      allAgent,
    ].filter(Boolean) as string[];

    for (const src of sources) {
      if (!updated.loyer) {
        const m = src.match(/loyer\s*[→:à]\s*\*{0,2}([\d\s]+)\s*€(?:\/mois)?/i)
          || src.match(/([\d\s]{3,5})\s*€\/mois(?:\s+de\s+loyer|\s+pour\s+le\s+loyer)/i)
          || src.match(/loyer\s+(?:potentiel|réaliste|estimé|mensuel|à|de)\s+\*{0,2}([\d\s]{3,5})\s*€/i)
          || src.match(/passer\s+le\s+loyer\s+[àa]\s+([\d\s]+)\s*€/i)
          || src.match(/loyer\s+[àa]\s+([\d\s]+)\s*€/i);
        if (m) { const v = parseInt(m[1].replace(/\s/g, "")); if (v >= 200 && v <= 10000) updated.loyer = v; }
      }
      if (!updated.travaux) {
        const m = src.match(/(?:budget\s+)?travaux\s*[→:à]\s*\*{0,2}([\d\s]+)\s*€/i)
          || src.match(/Budget\s+travaux\s+estimé\s*:\s*\*{0,2}([\d\s]+)\s*€/i)
          || src.match(/travaux\s+(?:estimés?\s+[àa]|de|:)\s*([\d\s]+)\s*€/i);
        if (m) { const v = parseInt(m[1].replace(/\s/g, "")); if (v >= 500) updated.travaux = v; }
      }
      if (!updated.taux) {
        const m = src.match(/taux\s*[→:à]\s*([\d,.]+)\s*%/i)
          || src.match(/taux\s+(?:de|à|:)\s*([\d,.]+)\s*%/i);
        if (m) { const v = parseFloat(m[1].replace(",", ".")); if (v >= 1 && v <= 10) updated.taux = v; }
      }
      if (!updated.prix) {
        const m = src.match(/prix\s*[→:à]\s*([\d\s]+)\s*€/i)
          || src.match(/négocier\s+(?:à|autour\s+de)\s*([\d\s]+)\s*€/i)
          || src.match(/prix\s+d['']achat\s+[àa]\s+([\d\s]+)\s*€/i);
        if (m) { const v = parseInt(m[1].replace(/\s/g, "")); if (v >= 10000 && v <= 5000000) updated.prix = v; }
      }
    }
    return updated;
  }, [conversation]);

  const integrateAndRefresh = useCallback(async () => {
    const updated = parseProposals();
    if (Object.keys(updated).length > 0) setInputs(prev => ({ ...prev, ...updated }));

    const items = [
      updated.loyer ? `loyer → ${updated.loyer} €/mois` : null,
      updated.travaux ? `travaux → ${updated.travaux.toLocaleString("fr-FR")} €` : null,
      updated.taux ? `taux → ${updated.taux}%` : null,
      updated.prix ? `prix → ${updated.prix.toLocaleString("fr-FR")} €` : null,
    ].filter(Boolean);
    const msg = items.length > 0
      ? `OK, j'intègre : ${items.join(", ")}. Refais l'analyse complète avec ces chiffres mis à jour.`
      : "Refais l'analyse complète en tenant compte de tout ce qu'on a discuté.";
    const newConv = [...conversation, { role: "user" as const, text: msg }];
    setConversation(newConv);
    const nextInputs = { ...inputs, ...updated };
    const nextResults = nextInputs.prix > 0 && nextInputs.loyer > 0 ? compute(nextInputs) : null;
    await callAvis(newConv, nextInputs, nextResults);
  }, [conversation, inputs, callAvis, parseProposals]);

  const verdict = results
    ? results.rendementNet >= 7
      ? { label: "Top deal", color: GREEN, bg: "#ECFDF5" }
      : results.rendementNet >= 5
      ? { label: "Bon plan", color: "#047857", bg: "#ECFDF5" }
      : results.rendementNet >= 3
      ? { label: "Limite", color: ORANGE, bg: "#FFFBEB" }
      : { label: "À éviter", color: RED, bg: "#FEF2F2" }
    : null;

  const suggere = tauxMarche(inputs.duree, inputs.apport);


  // ── Layout ──────────────────────────────────────────────────────────────────
  return (
    <main style={{
      minHeight: "100vh",
      background: BG,
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      color: TEXT,
    }}>
      <style>{`
        @keyframes dotpulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
        @media print { .no-print { display: none !important; } }
        * { box-sizing: border-box; }
      `}</style>

      {/* Top bar */}
      <div style={{
        background: "white",
        borderBottom: `1px solid ${BORDER}`,
        padding: "0 24px",
        display: "flex", alignItems: "center", height: 56,
      }} className="no-print">
        <span style={{ fontSize: 20, fontWeight: 900, color: BLUE, letterSpacing: "-0.03em" }}>JuNe</span>
        <span style={{ fontSize: 13, color: MUTED, marginLeft: 12, fontWeight: 400 }}>Simulateur LMNP</span>
      </div>

      {/* Two-column layout */}
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "32px 24px 64px",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: 24,
        alignItems: "flex-start",
      }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div style={{
          width: isMobile ? "100%" : 480,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}>

          {/* Import zone */}
          <section style={card}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Analyser une annonce</div>
              <div style={{ fontSize: 13, color: MUTED }}>Colle une URL, du texte ou glisse des screenshots</div>
            </div>

            <textarea
              rows={4}
              placeholder="https://seloger.com/... ou colle le texte de l'annonce"
              value={inputs.annonce}
              onChange={e => set("annonce", e.target.value)}
              onPaste={handlePaste}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14,
                border: `1.5px solid ${BORDER}`, outline: "none", resize: "vertical",
                fontFamily: "inherit", lineHeight: 1.5, color: TEXT, background: "white",
              }}
              onFocus={e => (e.target.style.borderColor = BLUE)}
              onBlur={e => (e.target.style.borderColor = BORDER)}
            />

            {/* Drag-drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); addImages(e.dataTransfer.files); }}
              onPaste={handlePaste}
              onClick={() => fileInputRef.current?.click()}
              style={{
                marginTop: 10, padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                border: `2px dashed ${dragOver ? BLUE : BORDER}`,
                background: dragOver ? BLUE_LIGHT : "#FAFBFF",
                textAlign: "center", transition: "all 0.15s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1.8" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <span style={{ fontSize: 13, color: MUTED }}>Glisser des screenshots ou cliquer</span>
              <input
                ref={fileInputRef} type="file" accept="image/*" multiple hidden
                onChange={e => { if (e.target.files) addImages(e.target.files); e.target.value = ""; }}
              />
            </div>

            {/* Thumbnails */}
            {images.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {images.map((src, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, border: `1.5px solid ${BORDER}` }} />
                    <button
                      onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                      style={{
                        position: "absolute", top: -5, right: -5, width: 16, height: 16,
                        borderRadius: "50%", background: RED, color: "white", border: "none",
                        cursor: "pointer", fontSize: 9, lineHeight: "16px", textAlign: "center", padding: 0,
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Analyze button */}
            <button
              onClick={parseAnnonce}
              disabled={(!inputs.annonce.trim() && images.length === 0) || loading}
              style={{
                marginTop: 14, width: "100%", padding: "12px 20px", borderRadius: 10,
                fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer",
                background: (!inputs.annonce.trim() && images.length === 0) || loading
                  ? "#E2E8F0"
                  : "linear-gradient(135deg, #2563EB, #4F46E5)",
                color: (!inputs.annonce.trim() && images.length === 0) || loading ? "#94A3B8" : "white",
                transition: "all 0.15s",
              }}
            >
              {loading ? "Analyse en cours…" : images.length > 0 ? "Analyser les screenshots →" : "Analyser →"}
            </button>

            {parsed && !error && (
              <p style={{ marginTop: 10, fontSize: 13, color: GREEN, fontWeight: 600 }}>
                Données extraites — vérifie ci-dessous
              </p>
            )}
            {error && (
              <p style={{ marginTop: 10, fontSize: 13, color: RED, fontWeight: 600 }}>⚠️ {error}</p>
            )}
          </section>

          {/* Le bien */}
          <section style={card}>
            <SectionHeader label="Le bien" />
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Prix d'achat" value={inputs.prix} onChange={v => set("prix", v)} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Surface" value={inputs.surface} onChange={v => setInputs(prev => ({ ...prev, surface: v }))} unit="m²" />
                <div>
                  <Field label="Loyer mensuel" value={inputs.loyer} onChange={v => set("loyer", v)} />
                  {loyerInfo && inputs.loyer > 0 && (
                    <p style={{ marginTop: 5, fontSize: 11, color: MUTED }}>
                      Marché: ~{loyerInfo.loyerM2} €/m² ({loyerInfo.precision})
                    </p>
                  )}
                </div>
              </div>
              <AddressAutocomplete
                surface={inputs.surface || 30}
                onSelect={({ city, codePostal: _cp, loyerEstime: loyer, loyerM2, precision, taxeFonciere, assurancePNO }) => {
                  setInputs(prev => ({
                    ...prev,
                    ville: city,
                    loyer: prev.surface > 0 ? loyer : prev.loyer,
                    taxeFonciere,
                    assurancePNO,
                  }));
                  setLoyerInfo({ loyerM2, precision, city });
                }}
              />
              {etatBien && (
                <p style={{ fontSize: 12, color: MUTED, fontStyle: "italic" }}>{etatBien}</p>
              )}
            </div>
          </section>

          {/* Financement */}
          <section style={card}>
            <SectionHeader label="Financement" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Apport" value={inputs.apport} onChange={v => set("apport", v)} unit="%" />
              <div>
                <Field label="Taux crédit" value={inputs.taux} onChange={v => set("taux", v)} unit="%" />
                <button
                  onClick={() => { setTauxManuel(false); set("taux", suggere); }}
                  style={{
                    marginTop: 6, padding: "3px 10px", borderRadius: 6, fontSize: 11,
                    background: BLUE_LIGHT, color: BLUE, border: "none", cursor: "pointer", fontWeight: 600,
                  }}
                >
                  {tauxManuel ? `Revenir au marché : ${suggere}%` : `Taux marché auto : ${suggere}%`}
                </button>
              </div>
              <Field label="Durée" value={inputs.duree} onChange={v => set("duree", v)} unit="ans" />
            </div>
            {results && (
              <p style={{ marginTop: 14, fontSize: 13, color: MUTED }}>
                Mensualité estimée: <strong style={{ color: TEXT }}>{fmt(results.mensualiteCredit)} €/mois</strong>
              </p>
            )}
          </section>

          {/* Charges avancées — collapsible */}
          <section style={card}>
            <button
              onClick={() => setChargesOpen(o => !o)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, height: 14, borderRadius: 2, background: BLUE }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Charges &amp; frais
                </span>
              </div>
              <span style={{ fontSize: 13, color: MUTED, transition: "transform 0.2s", display: "inline-block", transform: chargesOpen ? "rotate(180deg)" : "none" }}>▾</span>
            </button>

            {chargesOpen && (
              <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Travaux (€)" value={inputs.travaux} onChange={v => set("travaux", v)} />
                <Field label="Frais notaire (%)" value={inputs.fraisNotaire} onChange={v => set("fraisNotaire", v)} unit="%" />
                <Field label="Ameublement (€)" value={inputs.ameublement} onChange={v => set("ameublement", v)} />
                <Field label="Taxe foncière (€/an)" value={inputs.taxeFonciere} onChange={v => set("taxeFonciere", v)} />
                <Field label="Frais agence (€)" value={inputs.fraisAgence} onChange={v => set("fraisAgence", v)} />
                <Field label="Expert-comptable (€/an)" value={inputs.expertComptable} onChange={v => set("expertComptable", v)} />
                <Field label="Charges & gestion (% loyer)" value={inputs.charges} onChange={v => set("charges", v)} unit="%" />
                <Field label="Assurance PNO (€/an)" value={inputs.assurancePNO} onChange={v => set("assurancePNO", v)} />
                <Field label="Vacance locative (%)" value={inputs.vacance} onChange={v => set("vacance", v)} unit="%" />
              </div>
            )}
          </section>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          position: isMobile ? "static" : "sticky",
          top: 24,
          alignSelf: "flex-start",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}>
          {results && verdict ? (
            <>
              {/* Hero KPI */}
              <section style={{ ...card, textAlign: "center", padding: "32px 28px" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Cash flow mensuel
                </div>
                <div style={{
                  fontSize: 40, fontWeight: 900, letterSpacing: "-0.03em",
                  color: results.cashFlowMensuel >= 0 ? GREEN : RED,
                  fontVariantNumeric: "tabular-nums", lineHeight: 1.1,
                }}>
                  {results.cashFlowMensuel >= 0 ? "+" : ""}{fmt(results.cashFlowMensuel)} €
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                  <span style={{
                    padding: "5px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                    background: BLUE_LIGHT, color: BLUE,
                  }}>
                    Rendement net {fmt(results.rendementNet, 2)}%
                  </span>
                  <span style={{
                    padding: "5px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                    background: "#F1F5F9", color: MUTED,
                  }}>
                    Brut {fmt(results.rendementBrut, 2)}%
                  </span>
                </div>

                <div style={{ marginTop: 14 }}>
                  <span style={{
                    display: "inline-block", padding: "7px 18px", borderRadius: 999,
                    fontSize: 14, fontWeight: 800,
                    background: verdict.bg, color: verdict.color,
                    border: `1.5px solid ${verdict.color}40`,
                  }}>
                    {verdict.label}
                  </span>
                </div>

                <div style={{ marginTop: 12, fontSize: 12, color: MUTED }}>
                  Effort réel après fiscalité : ~{fmt(results.cashFlowMensuel + results.economieImpotAnnuelle / 12)} €/mois
                </div>
              </section>

              {/* Cash flow detail — collapsible */}
              <section style={card}>
                <button
                  onClick={() => setCfDetailOpen(o => !o)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 3, height: 14, borderRadius: 2, background: BLUE }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Détail du cash flow
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: MUTED, display: "inline-block", transform: cfDetailOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
                </button>

                {cfDetailOpen && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 0, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                    {[
                      { label: "Loyer brut", value: inputs.loyer, color: GREEN },
                      { label: `− Vacance (${inputs.vacance}%)`, value: -Math.round(inputs.loyer * inputs.vacance / 100), color: RED, muted: true },
                      { label: `− Charges & gestion (${inputs.charges}%)`, value: -Math.round(inputs.loyer * inputs.charges / 100), color: RED, muted: true },
                      { label: `− Taxe foncière (÷12)`, value: -Math.round(inputs.taxeFonciere / 12), color: RED, muted: true },
                      { label: `− Comptable + PNO (÷12)`, value: -Math.round((inputs.expertComptable + inputs.assurancePNO) / 12), color: RED, muted: true },
                      { label: "= Loyer net", value: Math.round(results.loyerNetMensuel), color: results.loyerNetMensuel >= 0 ? GREEN : ORANGE, bold: true, sep: true },
                      { label: `− Mensualité crédit`, value: -Math.round(results.mensualiteCredit), color: RED, muted: true },
                      { label: "= Cash flow mensuel", value: Math.round(results.cashFlowMensuel), color: results.cashFlowMensuel >= 0 ? GREEN : RED, bold: true, big: true, sep: true },
                    ].map((row, i) => (
                      <div key={i} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: row.big ? "10px 12px" : "7px 12px",
                        marginTop: row.sep ? 4 : 0,
                        borderTop: row.sep ? `1px solid ${BORDER}` : "none",
                        borderRadius: row.big ? 8 : 0,
                        background: row.big ? `${row.color}10` : "transparent",
                      }}>
                        <span style={{ color: row.bold ? TEXT : MUTED, fontWeight: row.bold ? 600 : 400 }}>{row.label}</span>
                        <span style={{ color: row.color, fontWeight: row.bold ? 800 : 500, fontSize: row.big ? 15 : 13 }}>
                          {row.value >= 0 ? "+" : ""}{fmt(row.value)} €
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Chiffres clés — 2x3 grid */}
              <section style={card}>
                <SectionHeader label="Chiffres clés" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Invest. total", value: fmt(results.investissementTotal) + " €" },
                    { label: "Emprunt", value: fmt(results.montantEmprunt) + " €" },
                    { label: "Mensualité", value: fmt(results.mensualiteCredit) + " €/m", color: RED },
                    { label: "Loyer net", value: fmt(results.loyerNetMensuel) + " €/m", color: GREEN },
                    { label: "Amortissement", value: fmt(results.amortissementAnnuel) + " €/an" },
                    { label: "Éco. impôt", value: "~" + fmt(results.economieImpotAnnuelle) + " €/an", color: GREEN },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: "12px 14px", borderRadius: 10, background: "#F8FAFF", border: `1px solid ${BORDER}` }}>
                      <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: item.color || TEXT, fontVariantNumeric: "tabular-nums" }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* LMNP fiscal advantage */}
              <section style={{ ...card, background: "#F0FDF4", border: "1px solid #A7F3D0" }}>
                <SectionHeader label="Avantage fiscal LMNP — régime réel" color={GREEN} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ padding: "14px 16px", borderRadius: 10, background: "white", border: "1px solid #A7F3D0" }}>
                    <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Amortissement annuel</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: GREEN, fontVariantNumeric: "tabular-nums" }}>{fmt(results.amortissementAnnuel)} €</div>
                    <div style={{ fontSize: 11, color: "#6EE7B7", marginTop: 3 }}>immeuble 30 ans + meubles 7 ans</div>
                  </div>
                  <div style={{ padding: "14px 16px", borderRadius: 10, background: "white", border: "1px solid #A7F3D0" }}>
                    <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Économie d&apos;impôt</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: GREEN, fontVariantNumeric: "tabular-nums" }}>~{fmt(results.economieImpotAnnuelle)} €/an</div>
                    <div style={{ fontSize: 11, color: "#6EE7B7", marginTop: 3 }}>tranche 30% + prélèvements sociaux</div>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div style={{
              ...card,
              textAlign: "center", padding: "48px 28px", color: MUTED,
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Remplis le prix d&apos;achat et le loyer</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>pour voir les résultats ici</div>
            </div>
          )}
        </div>
      </div>

      {/* ── AGENT SECTION — full width ──────────────────────────────────── */}
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "0 24px 32px",
      }}>
        <section style={{ background: "white", borderRadius: 16, border: `1px solid ${BORDER}`, boxShadow: "0 1px 3px rgba(15,23,42,0.06)", overflow: "hidden" }}>
          {/* Agent header */}
          <div style={{
            padding: "18px 24px", borderBottom: `1px solid ${BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg, #2563EB 0%, #6366F1 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 13, color: "white",
              }}>JN</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>Agent expert LMNP</div>
                <div style={{ fontSize: 12, color: MUTED }}>Analyse ton dossier · pose des questions · estime les travaux</div>
              </div>
            </div>
            {conversation.length > 0 && (
              <div style={{ display: "flex", gap: 8 }} className="no-print">
                <button
                  onClick={refreshAnalysis}
                  disabled={avisLoading}
                  style={{
                    fontSize: 12, color: BLUE, background: BLUE_LIGHT, border: `1px solid ${BLUE}30`,
                    borderRadius: 8, cursor: avisLoading ? "default" : "pointer", padding: "5px 11px",
                    fontWeight: 600, opacity: avisLoading ? 0.5 : 1,
                  }}
                >↻ Actualiser</button>
                <button
                  onClick={() => { setConversation([]); setContexte(""); setReply(""); }}
                  style={{
                    fontSize: 12, color: MUTED, background: "none", border: `1px solid ${BORDER}`,
                    borderRadius: 8, cursor: "pointer", padding: "5px 11px",
                  }}
                >Nouveau</button>
              </div>
            )}
          </div>

          {/* No conversation yet */}
          {conversation.length === 0 && (
            <div style={{ padding: 24 }} className="no-print">
              <p style={{ fontSize: 13, color: MUTED, marginBottom: 14, lineHeight: 1.6 }}>
                Donne du contexte sur le bien : état général, DPE, charges de copro, ton objectif (défiscaliser, cash-flow, revente…). L&apos;agent analyse et creuse ce qui manque.
              </p>
              <div style={{ position: "relative" }}>
                <textarea
                  rows={4}
                  value={contexte}
                  onChange={e => setContexte(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      const userMsg = contexte.trim() || "(pas de contexte supplémentaire)";
                      setConversation([{ role: "user", text: userMsg }]);
                      setAvisLoading(true);
                      try {
                        const res = await fetch("/api/lmnp/avis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputs, results, loyerInfo, conversation: [{ role: "user", text: userMsg }] }) });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        setConversation(prev => [...prev, { role: "agent", text: data.avis }]);
                        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                      } catch (e) {
                        setConversation(prev => [...prev, { role: "agent", text: `⚠️ ${(e as Error).message}` }]);
                      } finally { setAvisLoading(false); }
                    }
                  }}
                  placeholder="Ex : immeuble années 70, cuisine et sdb à refaire, charges de copro 180 €/mois, DPE D. Je cherche à défiscaliser sur 10 ans…"
                  style={{
                    width: "100%", padding: "14px 16px", paddingBottom: 52, borderRadius: 12, fontSize: 14,
                    border: `1.5px solid ${BORDER}`, outline: "none", resize: "none",
                    fontFamily: "inherit", lineHeight: 1.6, color: TEXT, background: "#FAFBFF",
                  }}
                  onFocus={e => (e.target.style.borderColor = BLUE)}
                  onBlur={e => (e.target.style.borderColor = BORDER)}
                />
                <button
                  onClick={async () => {
                    const userMsg = contexte.trim() || "(pas de contexte supplémentaire)";
                    setConversation([{ role: "user", text: userMsg }]);
                    setAvisLoading(true);
                    try {
                      const res = await fetch("/api/lmnp/avis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputs, results, loyerInfo, conversation: [{ role: "user", text: userMsg }] }) });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error);
                      setConversation(prev => [...prev, { role: "agent", text: data.avis }]);
                      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                    } catch (e) {
                      setConversation(prev => [...prev, { role: "agent", text: `⚠️ ${(e as Error).message}` }]);
                    } finally { setAvisLoading(false); }
                  }}
                  disabled={avisLoading}
                  style={{
                    position: "absolute", bottom: 10, right: 10,
                    padding: "9px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                    background: avisLoading ? "#E2E8F0" : "linear-gradient(135deg, #2563EB, #6366F1)",
                    color: avisLoading ? "#94A3B8" : "white", border: "none", cursor: avisLoading ? "default" : "pointer",
                  }}
                >
                  {avisLoading ? "Analyse…" : "Lancer l'analyse →"}
                </button>
              </div>
              <p style={{ marginTop: 8, fontSize: 11, color: "#B0BBCC" }}>⌘ + Entrée pour envoyer</p>
            </div>
          )}

          {/* Conversation */}
          {conversation.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ maxHeight: 480, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                {conversation.map((msg, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                    {msg.role === "agent" && (
                      <div style={{
                        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                        background: "linear-gradient(135deg, #2563EB, #6366F1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 10, color: "white",
                      }}>JN</div>
                    )}
                    <div style={{
                      maxWidth: msg.role === "user" ? "75%" : "100%",
                      flex: msg.role === "agent" ? 1 : undefined,
                    }}>
                      {msg.role === "user" ? (
                        <div style={{
                          padding: "10px 16px", borderRadius: "18px 4px 18px 18px", fontSize: 14,
                          background: BLUE_LIGHT, border: `1px solid ${BLUE}25`,
                          color: "#1E3A5F", lineHeight: 1.6, whiteSpace: "pre-wrap",
                        }}>{msg.text === "(pas de contexte supplémentaire)" ? "— aucun contexte ajouté" : msg.text}</div>
                      ) : (
                        <div style={{
                          padding: "16px 20px", borderRadius: "4px 18px 18px 18px", fontSize: 14,
                          background: "#F8FAFF", border: `1px solid ${BORDER}`,
                          color: "#1E293B", lineHeight: 1.75,
                        }}>
                          <AgentMessage text={msg.text} onApplyTravaux={(m) => { set("travaux", m); setEtatBien(`Estimé par l'agent : ${m.toLocaleString("fr-FR")} €`); }} blue={BLUE} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {avisLoading && (
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: "linear-gradient(135deg, #2563EB, #6366F1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 10, color: "white",
                    }}>JN</div>
                    <div style={{ padding: "14px 18px", borderRadius: "4px 18px 18px 18px", background: "#F8FAFF", border: `1px solid ${BORDER}`, display: "flex", gap: 5, alignItems: "center" }}>
                      {[0, 1, 2].map(d => (
                        <span key={d} style={{
                          width: 7, height: 7, borderRadius: "50%", background: BLUE, opacity: 0.3,
                          animation: "dotpulse 1.2s ease-in-out infinite",
                          animationDelay: `${d * 0.2}s`,
                          display: "inline-block",
                        }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Intégrer et relancer */}
              {conversation.some(m => m.role === "agent") && !avisLoading && (() => {
                const proposals = parseProposals();
                const chips = [
                  proposals.loyer ? `Loyer → ${proposals.loyer} €/mois` : null,
                  proposals.prix ? `Prix → ${proposals.prix.toLocaleString("fr-FR")} €` : null,
                  proposals.travaux ? `Travaux → ${proposals.travaux.toLocaleString("fr-FR")} €` : null,
                  proposals.taux ? `Taux → ${proposals.taux}%` : null,
                ].filter(Boolean) as string[];
                return (
                  <div style={{ padding: "12px 20px", borderTop: `1px solid ${BORDER}`, background: "#F0FDF4" }} className="no-print">
                    {chips.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                        <span style={{ fontSize: 11, color: "#059669", fontWeight: 600, alignSelf: "center" }}>Détecté :</span>
                        {chips.map((c, i) => (
                          <span key={i} style={{ fontSize: 12, fontWeight: 700, color: "#065f46", background: "#D1FAE5", borderRadius: 6, padding: "3px 10px", border: "1px solid #A7F3D0" }}>{c}</span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={integrateAndRefresh}
                      style={{
                        width: "100%", padding: "11px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                        background: "linear-gradient(135deg, #10B981, #059669)",
                        color: "white", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
                      {chips.length > 0 ? "Intégrer ces chiffres et relancer l'analyse" : "Relancer l'analyse avec les hypothèses discutées"}
                    </button>
                  </div>
                );
              })()}

              {/* Reply bar */}
              <div style={{ borderTop: `1px solid ${BORDER}`, padding: "14px 20px", background: "#FAFBFF" }} className="no-print">
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <textarea
                    rows={1}
                    value={reply}
                    onChange={e => {
                      setReply(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    onKeyDown={async e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!reply.trim() || avisLoading) return; await sendReply(); }
                    }}
                    disabled={avisLoading}
                    placeholder="Réponds à l'agent… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
                    style={{
                      flex: 1, padding: "10px 14px", borderRadius: 12, fontSize: 14,
                      border: `1.5px solid ${BORDER}`, outline: "none", resize: "none", overflow: "hidden",
                      fontFamily: "inherit", lineHeight: 1.5, background: "white", color: TEXT,
                      minHeight: 42,
                    }}
                    onFocus={e => (e.target.style.borderColor = BLUE)}
                    onBlur={e => (e.target.style.borderColor = BORDER)}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!reply.trim() || avisLoading}
                    style={{
                      width: 42, height: 42, borderRadius: 12, border: "none", flexShrink: 0,
                      background: reply.trim() && !avisLoading ? "linear-gradient(135deg, #2563EB, #6366F1)" : "#E8EEFF",
                      cursor: reply.trim() && !avisLoading ? "pointer" : "default",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13" stroke={reply.trim() && !avisLoading ? "white" : "#94A3B8"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={reply.trim() && !avisLoading ? "white" : "#94A3B8"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Grille de lecture — collapsible */}
        <section style={{ ...card, marginTop: 16 }} className="no-print">
          <button
            onClick={() => setLectureOpen(o => !o)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: BLUE }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Grille de lecture
              </span>
            </div>
            <span style={{ fontSize: 13, color: MUTED, display: "inline-block", transform: lectureOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
          </button>

          {lectureOpen && (
            <div style={{ marginTop: 16 }}>
              {[
                { seuil: "≥ 7%", label: "Top deal", desc: "Cash flow positif probable, forte rentabilité", color: GREEN },
                { seuil: "5–7%", label: "Bon plan", desc: "Effort mensuel raisonnable, bon investissement", color: "#047857" },
                { seuil: "3–5%", label: "Limite", desc: "Regarder si la plus-value compense", color: ORANGE },
                { seuil: "< 3%", label: "À éviter", desc: "Trop d'effort sans rentabilité suffisante", color: RED },
              ].map((row, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 0",
                  borderBottom: i < 3 ? `1px solid ${BORDER}` : "none",
                }}>
                  <span style={{ fontWeight: 800, color: row.color, minWidth: 52, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{row.seuil}</span>
                  <span style={{ fontWeight: 600, color: row.color, minWidth: 100, fontSize: 13 }}>{row.label}</span>
                  <span style={{ fontSize: 13, color: MUTED }}>{row.desc}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* PDF export */}
        {conversation.length > 0 && results && verdict && (
          <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 8 }} className="no-print">
            <button
              onClick={() => openPrintWindow(inputs, results, verdict, conversation)}
              style={{
                padding: "13px 36px", borderRadius: 12, fontSize: 15, fontWeight: 700,
                background: "linear-gradient(135deg, #2563EB, #6366F1)",
                color: "white", border: "none", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8" rx="1"/>
              </svg>
              Télécharger l&apos;analyse en PDF
            </button>
            <p style={{ marginTop: 8, fontSize: 12, color: MUTED }}>Synthèse : chiffres clés + avis de l&apos;agent</p>
          </div>
        )}
      </div>
    </main>
  );
}
