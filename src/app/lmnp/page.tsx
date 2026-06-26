"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const BLUE = "#2563EB";
const TEAL = "#00B37D";
const BG = "#EEF2FF";
const RED = "#DC2626";
const ORANGE = "#D97706";
const GREEN = "#059669";

// Taux immobilier moyen France juin 2026
const DEFAULT_RATE = 3.6;
const DEFAULT_DURATION = 20;
const DEFAULT_APPORT = 10;
const DEFAULT_FRAIS_NOTAIRE = 7.5;
const DEFAULT_AMEUBLEMENT = 8000;
const DEFAULT_CHARGES = 15; // % du loyer (copro, taxe foncière, assurance, gestion)
const DEFAULT_VACANCE = 5; // % du temps vacant

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
      <label style={{ fontSize: 12, fontWeight: 500, color: "#6B7280" }}>
        Quartier / adresse — <span style={{ color: ORANGE }}>crucial pour estimer le loyer</span>
      </label>
      <input
        type="text"
        value={query}
        onChange={e => search(e.target.value)}
        placeholder="Ex : Lyon 6e, Paris 11, Bordeaux Chartrons, Marseille 13008..."
        style={{
          padding: "10px 14px", borderRadius: 10, fontSize: 15,
          border: "1.5px solid #DDE5FF", outline: "none", fontFamily: "inherit",
        }}
        onFocus={e => (e.target.style.borderColor = BLUE)}
        onBlur={e => { setTimeout(() => setOpen(false), 150); e.target.style.borderColor = "#DDE5FF"; }}
      />
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          background: "white", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          border: "1px solid #E5EAFF", overflow: "hidden", marginTop: 4,
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => pick(s)}
              style={{
                padding: "10px 14px", cursor: "pointer", borderBottom: i < suggestions.length - 1 ? "1px solid #f0f0f0" : "none",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = BG)}
              onMouseLeave={e => (e.currentTarget.style.background = "white")}
            >
              <span style={{ fontSize: 14 }}>{s.label}</span>
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
function SectionHeader({ label, color = "#9CA3AF" }: { label: string; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: BLUE, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 16,
  padding: 28,
  border: "1px solid #E5EAFF",
  boxShadow: "0 1px 4px rgba(37,99,235,0.06)",
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

  const set = useCallback((key: keyof Inputs, val: number | string) => {
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
          const loyer = surface > 0 ? loyerEstime(surface, ville) : 0;
          setInputs(prev => ({
            ...prev,
            prix: prix || prev.prix,
            surface: surface || prev.surface,
            ville: ville || prev.ville,
            loyer: loyer || prev.loyer,
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
        loyer: data.loyerEstime || prev.loyer,
        travaux: data.travauxEstime != null && data.travauxEstime > 0 ? data.travauxEstime : prev.travaux,
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

  const verdict = results
    ? results.rendementNet >= 7
      ? { label: "Top deal", color: GREEN, bg: "#ECFDF5" }
      : results.rendementNet >= 5
      ? { label: "Bon plan", color: "#047857", bg: "#ECFDF5" }
      : results.rendementNet >= 3
      ? { label: "Limite", color: ORANGE, bg: "#FFFBEB" }
      : { label: "À éviter", color: RED, bg: "#FEF2F2" }
    : null;

  const budgetOk = results ? results.cashFlowMensuel >= -400 : null;

  const Field = ({ label, value, onChange, unit = "€", step = 1, min = 0 }: {
    label: string; value: number; onChange: (v: number) => void;
    unit?: string; step?: number; min?: number;
  }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#6B7280" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number" value={value || ""} min={min} step={step}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 15, fontWeight: 600,
            border: `1.5px solid #DDE5FF`, outline: "none", background: "white", fontFamily: "inherit",
          }}
          onFocus={e => (e.target.style.borderColor = BLUE)}
          onBlur={e => (e.target.style.borderColor = "#DDE5FF")}
        />
        <span style={{ color: "#9CA3AF", fontWeight: 500, fontSize: 14, minWidth: 28, flexShrink: 0 }}>{unit}</span>
      </div>
    </div>
  );

  const suggere = tauxMarche(inputs.duree, inputs.apport);

  return (
    <main style={{
      minHeight: "100vh", background: BG, padding: "32px 16px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    }}>

      {/* Header */}
      <div style={{
        width: "100%", maxWidth: 720, borderRadius: 20, padding: "36px 40px",
        background: "linear-gradient(135deg, #1B3FD8 0%, #00B37D 100%)",
        color: "white",
      }}>
        <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>JuNe</div>
        <div style={{ fontSize: 16, fontWeight: 400, opacity: 0.8, marginTop: 6 }}>Simulateur LMNP</div>
        <div style={{ fontSize: 13, opacity: 0.65, marginTop: 4 }}>Colle une annonce, analyse ta rentabilité en 30 secondes</div>
      </div>

      <div style={{ width: "100%", maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Annonce */}
        <section style={cardStyle}>
          <SectionHeader label="Annonce immobilière" />
          <textarea
            rows={4}
            placeholder="Colle ici le lien ou le texte de l'annonce (SeLoger, LeBonCoin, PAP…)"
            value={inputs.annonce}
            onChange={e => set("annonce", e.target.value)}
            onPaste={handlePaste}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14,
              border: "1.5px solid #DDE5FF", outline: "none", resize: "vertical",
              fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
            }}
            onFocus={e => (e.target.style.borderColor = BLUE)}
            onBlur={e => (e.target.style.borderColor = "#DDE5FF")}
          />

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addImages(e.dataTransfer.files); }}
            onPaste={handlePaste}
            onClick={() => fileInputRef.current?.click()}
            style={{
              marginTop: 10, padding: "14px 16px", borderRadius: 10, cursor: "pointer",
              border: `2px dashed ${dragOver ? BLUE : "#DDE5FF"}`,
              background: dragOver ? "#EEF2FF" : "#F8FAFF",
              textAlign: "center", fontSize: 13, color: "#9CA3AF", transition: "all 0.15s",
            }}
          >
            Dépose ou colle des screenshots de l&apos;annonce ici
            <input
              ref={fileInputRef} type="file" accept="image/*" multiple hidden
              onChange={e => { if (e.target.files) addImages(e.target.files); e.target.value = ""; }}
            />
          </div>

          {images.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {images.map((src, i) => (
                <div key={i} style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1.5px solid #DDE5FF" }} />
                  <button
                    onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    style={{
                      position: "absolute", top: -6, right: -6, width: 18, height: 18,
                      borderRadius: "50%", background: RED, color: "white", border: "none",
                      cursor: "pointer", fontSize: 10, lineHeight: "18px", textAlign: "center", padding: 0,
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={parseAnnonce}
              disabled={(!inputs.annonce.trim() && images.length === 0) || loading}
              style={{
                padding: "11px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                background: (inputs.annonce.trim() || images.length > 0) && !loading ? `linear-gradient(135deg, ${BLUE}, ${TEAL})` : "#E5EAFF",
                color: (inputs.annonce.trim() || images.length > 0) && !loading ? "white" : "#9CA3AF",
                border: "none", cursor: (inputs.annonce.trim() || images.length > 0) && !loading ? "pointer" : "default",
              }}
            >
              {loading ? "Analyse en cours…" : images.length > 0 ? "Analyser les screenshots" : "Analyser l'annonce"}
            </button>
            {parsed && !error && (
              <span style={{ fontSize: 13, color: TEAL, fontWeight: 600 }}>Données extraites — vérifie ci-dessous</span>
            )}
            {error && (
              <span style={{ fontSize: 13, color: RED, fontWeight: 600 }}>⚠️ {error}</span>
            )}
          </div>
        </section>

        {/* Infos bien */}
        <section style={cardStyle}>
          <SectionHeader label="Le bien" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1/-1" }}>
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
            </div>
            <Field label="Prix d'achat" value={inputs.prix} onChange={v => set("prix", v)} step={1000} />
            <Field label="Surface" value={inputs.surface} onChange={v => {
              setInputs(prev => ({ ...prev, surface: v }));
            }} unit="m²" />
            <Field label="Loyer mensuel estimé" value={inputs.loyer} onChange={v => set("loyer", v)} />
            <div>
              <Field label="Budget travaux" value={inputs.travaux} onChange={v => set("travaux", v)} step={500} />
              {etatBien && (
                <p style={{ marginTop: 6, fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>
                  {etatBien}
                </p>
              )}
            </div>
          </div>
          {loyerInfo && inputs.loyer > 0 && (
            <p style={{ marginTop: 14, fontSize: 13, color: "#6B7280" }}>
              <strong style={{ color: BLUE }}>{fmt(loyerInfo.loyerM2, 0)} €/m²</strong> estimé
              {loyerInfo.precision === "arrondissement" ? ` dans cet arrondissement` : loyerInfo.precision === "codePostal" ? ` dans ce secteur` : ` à ${loyerInfo.city}`}
              {" "}— données observatoires 2025, à vérifier sur PAP/Leboncoin
            </p>
          )}
        </section>

        {/* Financement */}
        <section style={cardStyle}>
          <SectionHeader label="Financement" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Apport" value={inputs.apport} onChange={v => set("apport", v)} unit="%" min={0} step={1} />
            <Field label="Durée" value={inputs.duree} onChange={v => set("duree", v)} unit="ans" step={1} />
          </div>

          {/* Taux suggéré banner */}
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 10,
            background: "#EFF6FF", border: "1px solid #BFDBFE",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            fontSize: 13, color: "#1E3A8A",
          }}>
            <span>
              Taux marché estimé pour {inputs.duree} ans avec {inputs.apport}% d&apos;apport : <strong>{suggere}%</strong>
            </span>
            <button
              onClick={() => set("taux", suggere)}
              style={{
                flexShrink: 0, padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: BLUE, color: "white", border: "none", cursor: "pointer",
              }}
            >Appliquer</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
            <Field label="Taux crédit" value={inputs.taux} onChange={v => set("taux", v)} unit="%" step={0.05} />
            <Field label="Frais de notaire" value={inputs.fraisNotaire} onChange={v => set("fraisNotaire", v)} unit="%" step={0.1} />
            <Field label="Frais d'agence achat" value={inputs.fraisAgence} onChange={v => set("fraisAgence", v)} step={500} />
            <Field label="Ameublement LMNP" value={inputs.ameublement} onChange={v => set("ameublement", v)} step={500} />
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #E5EAFF" }}>
            <SectionHeader label="Charges annuelles récurrentes" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Taxe foncière" value={inputs.taxeFonciere} onChange={v => set("taxeFonciere", v)} step={50} />
              <Field label="Expert-comptable" value={inputs.expertComptable} onChange={v => set("expertComptable", v)} step={50} />
              <Field label="Assurance PNO" value={inputs.assurancePNO} onChange={v => set("assurancePNO", v)} step={25} />
              <Field label="Gestion + copro" value={inputs.charges} onChange={v => set("charges", v)} unit="% loyer" step={1} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <Field label="Vacance locative" value={inputs.vacance} onChange={v => set("vacance", v)} unit="%" step={0.5} />
          </div>
        </section>

        {/* Résultats */}
        {results && verdict && (
          <>
            {/* Verdict + résumé horizontal */}
            <section style={{ ...cardStyle, padding: "20px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontSize: 28, fontWeight: 900, color: verdict.color, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(results.rendementNet, 2)}%
                  </span>
                  <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>rendement net</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{
                    fontSize: 24, fontWeight: 800,
                    color: results.cashFlowMensuel >= -400 ? GREEN : RED,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {results.cashFlowMensuel >= 0 ? "+" : ""}{fmt(results.cashFlowMensuel)} €
                  </span>
                  <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>/mois</span>
                </div>
                <div style={{
                  padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                  background: verdict.bg, color: verdict.color, border: `1px solid ${verdict.color}30`,
                }}>
                  {verdict.label}
                </div>
                <div style={{
                  padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                  background: budgetOk ? "#ECFDF5" : "#FEF2F2",
                  color: budgetOk ? GREEN : RED,
                  border: `1px solid ${budgetOk ? "#A7F3D0" : "#FECACA"}`,
                }}>
                  {budgetOk ? "Budget OK" : `Effort ${fmt(Math.abs(results.cashFlowMensuel))} €/mois`}
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: "#9CA3AF" }}>
                Rendement brut : <strong style={{ color: "#374151" }}>{fmt(results.rendementBrut, 2)}%</strong>
                {" "}· Apport requis ≤ 400 €/mois pour budget acceptable
              </div>
            </section>

            {/* Cash flow — 3 colonnes */}
            <section style={cardStyle}>
              <SectionHeader label="Cash flow mensuel" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { label: "Invest. total", value: fmt(results.investissementTotal) + " €", sub: `prix + notaire${inputs.travaux > 0 ? " + travaux" : ""} + meubles` },
                  { label: "Emprunt", value: fmt(results.montantEmprunt) + " €", sub: `apport ${inputs.apport}%${inputs.travaux > 0 ? ` · travaux ${fmt(inputs.travaux)} €` : ""}` },
                  { label: "Mensualité crédit", value: fmt(results.mensualiteCredit) + " €/mois", sub: `${inputs.taux}% sur ${inputs.duree} ans`, color: RED },
                  { label: "Loyer net encaissé", value: fmt(results.loyerNetMensuel) + " €/mois", sub: `après charges, taxe, assurance`, color: GREEN },
                  { label: "Cash flow mensuel", value: (results.cashFlowMensuel >= 0 ? "+" : "") + fmt(results.cashFlowMensuel) + " €", sub: "loyer net − crédit", color: results.cashFlowMensuel >= -400 ? GREEN : RED, big: true },
                  { label: "Cash flow annuel", value: (results.cashFlowAnnuel >= 0 ? "+" : "") + fmt(results.cashFlowAnnuel) + " €", sub: "sur 12 mois", color: results.cashFlowAnnuel >= 0 ? GREEN : RED, big: true },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: "14px 16px", borderRadius: 12,
                    background: item.big ? `${item.color || BLUE}08` : "#F8FAFF",
                    border: item.big ? `1.5px solid ${item.color || BLUE}30` : "1px solid #E5EAFF",
                  }}>
                    <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: item.big ? 20 : 17, fontWeight: 800, color: item.color || "#111827", fontVariantNumeric: "tabular-nums" }}>{item.value}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4, lineHeight: 1.4 }}>{item.sub}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Avantage LMNP */}
            <section style={cardStyle}>
              <SectionHeader label="Avantage fiscal LMNP — régime réel" color={GREEN} />
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16, marginTop: -8, lineHeight: 1.6 }}>
                Amortissement du bien et des meubles = revenus locatifs souvent non imposés pendant 10–15 ans
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Amortissement annuel", value: fmt(results.amortissementAnnuel) + " €", sub: "immeuble (30 ans) + meubles (7 ans)" },
                  { label: "Économie d'impôt estimée", value: "~" + fmt(results.economieImpotAnnuelle) + " €/an", sub: "tranche 30% IR + 17.2% prélèvements sociaux" },
                ].map((item, i) => (
                  <div key={i} style={{ padding: "14px 16px", borderRadius: 12, background: "#F0FDF4", border: "1px solid #A7F3D0" }}>
                    <div style={{ fontSize: 11, color: GREEN, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: GREEN, fontVariantNumeric: "tabular-nums" }}>{item.value}</div>
                    <div style={{ fontSize: 11, color: "#6EE7B7", marginTop: 4 }}>{item.sub}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 14 }}>
                Estimation indicative. Consulte un comptable spécialisé LMNP pour optimiser ton montage fiscal.
              </p>
            </section>

            {/* Avis agent — chat */}
            <section style={{ background: "white", borderRadius: 16, overflow: "hidden", border: `1px solid #E5EAFF`, boxShadow: "0 1px 4px rgba(37,99,235,0.06)" }}>
              {/* Header */}
              <div style={{ padding: "18px 24px 16px", borderBottom: `1px solid #EEF2FF`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                    background: `linear-gradient(135deg, ${BLUE} 0%, #6366f1 100%)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 13, color: "white", letterSpacing: "0.02em",
                  }}>JN</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Agent expert LMNP</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>Analyse ton dossier · pose des questions · estime les travaux</div>
                  </div>
                </div>
                {conversation.length > 0 && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={refreshAnalysis}
                      disabled={avisLoading}
                      title="Relancer l'analyse avec les chiffres actuels"
                      style={{ fontSize: 12, color: BLUE, background: `${BLUE}0D`, border: `1px solid ${BLUE}30`, borderRadius: 8, cursor: avisLoading ? "default" : "pointer", padding: "5px 11px", fontWeight: 600, opacity: avisLoading ? 0.5 : 1 }}
                    >↻ Actualiser</button>
                    <button
                      onClick={() => { setConversation([]); setContexte(""); setReply(""); }}
                      style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", padding: "5px 11px" }}
                    >Nouveau</button>
                  </div>
                )}
              </div>

              {/* État initial */}
              {conversation.length === 0 && (
                <div style={{ padding: 24 }}>
                  <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
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
                        width: "100%", padding: "14px 16px", paddingBottom: 48, borderRadius: 14, fontSize: 14,
                        border: "1.5px solid #DDE5FF", outline: "none", resize: "none",
                        fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box",
                        color: "#0f172a", background: "#fafbff",
                      }}
                      onFocus={e => (e.target.style.borderColor = BLUE)}
                      onBlur={e => (e.target.style.borderColor = "#DDE5FF")}
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
                        padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                        background: avisLoading ? "#e2e8f0" : `linear-gradient(135deg, ${BLUE}, #6366f1)`,
                        color: avisLoading ? "#aaa" : "white", border: "none", cursor: avisLoading ? "default" : "pointer",
                      }}
                    >
                      {avisLoading ? "Analyse…" : "Lancer l'analyse →"}
                    </button>
                  </div>
                  <p style={{ marginTop: 10, fontSize: 11, color: "#b0bbcc" }}>⌘ + Entrée pour envoyer</p>
                </div>
              )}

              {/* Fil de conversation */}
              {conversation.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ maxHeight: 540, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                    {conversation.map((msg, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                        {msg.role === "agent" && (
                          <div style={{
                            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                            background: `linear-gradient(135deg, ${BLUE}, #6366f1)`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 800, fontSize: 10, color: "white", letterSpacing: "0.02em",
                          }}>JN</div>
                        )}
                        <div style={{
                          maxWidth: msg.role === "user" ? "75%" : "100%",
                          flex: msg.role === "agent" ? 1 : undefined,
                        }}>
                          {msg.role === "user" ? (
                            <div style={{
                              padding: "10px 16px", borderRadius: "18px 4px 18px 18px", fontSize: 14,
                              background: `${BLUE}12`, border: `1px solid ${BLUE}25`,
                              color: "#1e3a5f", lineHeight: 1.6, whiteSpace: "pre-wrap",
                            }}>{msg.text === "(pas de contexte supplémentaire)" ? "— aucun contexte ajouté" : msg.text}</div>
                          ) : (
                            <div style={{
                              padding: "16px 20px", borderRadius: "4px 18px 18px 18px", fontSize: 14,
                              background: "#f8faff", border: "1px solid #e8eeff",
                              color: "#1e293b", lineHeight: 1.75,
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
                          background: `linear-gradient(135deg, ${BLUE}, #6366f1)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 800, fontSize: 10, color: "white",
                        }}>JN</div>
                        <div style={{ padding: "14px 18px", borderRadius: "4px 18px 18px 18px", background: "#f8faff", border: "1px solid #e8eeff", display: "flex", gap: 5, alignItems: "center" }}>
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

                  {/* Barre de réponse */}
                  <div style={{ borderTop: "1px solid #eef2ff", padding: "14px 20px", background: "#fafbff" }}>
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
                          border: "1.5px solid #DDE5FF", outline: "none", resize: "none", overflow: "hidden",
                          fontFamily: "inherit", lineHeight: 1.5, background: "white", color: "#0f172a",
                          minHeight: 42, transition: "border-color 0.15s",
                        }}
                        onFocus={e => (e.target.style.borderColor = BLUE)}
                        onBlur={e => (e.target.style.borderColor = "#DDE5FF")}
                      />
                      <button
                        onClick={sendReply}
                        disabled={!reply.trim() || avisLoading}
                        style={{
                          width: 42, height: 42, borderRadius: 12, border: "none", flexShrink: 0,
                          background: reply.trim() && !avisLoading ? `linear-gradient(135deg, ${BLUE}, #6366f1)` : "#e8eeff",
                          cursor: reply.trim() && !avisLoading ? "pointer" : "default",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "background 0.15s",
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M22 2L11 13" stroke={reply.trim() && !avisLoading ? "white" : "#94a3b8"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={reply.trim() && !avisLoading ? "white" : "#94a3b8"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
            <style>{`
              @keyframes dotpulse {
                0%, 80%, 100% { opacity: 0.2; transform: scale(0.85); }
                40% { opacity: 1; transform: scale(1); }
              }
            `}</style>

            {/* Grille de lecture */}
            <section style={cardStyle}>
              <SectionHeader label="Grille de lecture" />
              {[
                { seuil: "≥ 7%", label: "Top deal", desc: "Cash flow positif probable, forte rentabilité", color: GREEN },
                { seuil: "5–7%", label: "Bon plan", desc: "Effort mensuel raisonnable, bon investissement", color: "#047857" },
                { seuil: "3–5%", label: "Limite", desc: "Regarder si la plus-value compense", color: ORANGE },
                { seuil: "< 3%", label: "À éviter", desc: "Trop d'effort sans rentabilité suffisante", color: RED },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 3 ? "1px solid #F3F4F6" : "none" }}>
                  <span style={{ fontWeight: 800, color: row.color, minWidth: 52, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{row.seuil}</span>
                  <span style={{ fontWeight: 600, color: row.color, minWidth: 100, fontSize: 13 }}>{row.label}</span>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>{row.desc}</span>
                </div>
              ))}
            </section>
          </>
        )}

        {!results && (
          <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", fontSize: 15 }}>
            Remplis le prix d&apos;achat et le loyer pour voir les résultats
          </div>
        )}
      </div>
    </main>
  );
}
