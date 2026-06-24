"use client";

import { useState } from "react";

const prefixes = [
  "Les Amis du", "La Confrérie du", "Le Cercle des", "L'Union des",
  "Les Défenseurs du", "La Ligue des", "Les Gardiens du", "Le Club des",
  "La Société des", "Les Protecteurs du", "L'Association des", "Les Chevaliers du",
  "La Fédération des", "Les Héros du", "Le Collectif des",
];

const natures = [
  "Caillou Mouillé", "Champignon Bizarre", "Feuille Morte",
  "Limace Pressée", "Escargot Futuriste", "Bourdon Stressé",
  "Gland Philosophe", "Orties en Colère", "Pissenlit Rebelle",
  "Bouse Engagée", "Ver de Terre Ambitieux", "Fourmi Syndicaliste",
  "Araignée Bienveillante", "Taupe Visionnaire", "Merle Siffleur",
  "Mousse Humide", "Fougère Agressive", "Crapaud Distingué",
  "Sanglier Cultivé", "Hérisson Timide", "Blaireau Enthousiaste",
  "Marmotte Workaholic", "Pivert Acharné", "Écureuil Paranoïaque",
  "Chouette Indécise", "Renard Opportuniste", "Lapins Furieux",
  "Gendarme de Haie", "Pluie Fine du Dimanche", "Boue Festive",
];

const suffixes = [
  "", "", "", // souvent pas de suffixe
  "et Fiers de l'Être", "en Lutte", "Unis et Déterminés",
  "du Dimanche", "Incompris", "Mais Engagés",
  "de France", "Anonymes", "et Solidaires",
  "en Marche (lente)", "du Grand Air", "Connectés à la Terre",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generate(): string {
  const suffix = pickRandom(suffixes);
  return `${pickRandom(prefixes)} ${pickRandom(natures)}${suffix ? " " + suffix : ""}`;
}

export default function Generateur() {
  const [name, setName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shake, setShake] = useState(false);

  function handleGenerate() {
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setName(generate());
    setCopied(false);
  }

  async function handleCopy() {
    if (!name) return;
    await navigator.clipboard.writeText(name);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-8 bg-green-50">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-6xl">🌿</span>
        <h1 className="text-4xl font-bold text-green-900">Générateur de Nom d'Asso</h1>
        <p className="text-green-700 text-lg">Thème : la nature (et l'absurde)</p>
      </div>

      <div
        className="w-full max-w-xl min-h-32 bg-white border-2 border-green-300 rounded-2xl flex items-center justify-center p-8 shadow-md transition-all"
        style={{ animation: shake ? "shake 0.4s ease" : "none" }}
      >
        {name ? (
          <p className="text-2xl font-semibold text-center text-green-900 leading-snug">{name}</p>
        ) : (
          <p className="text-gray-400 text-lg italic text-center">
            Clique sur le bouton pour trouver ton asso idéale 🍄
          </p>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleGenerate}
          className="px-8 py-4 bg-green-600 hover:bg-green-700 active:scale-95 text-white text-lg font-semibold rounded-xl shadow transition-all"
        >
          🎲 Générer un nom
        </button>

        {name && (
          <button
            onClick={handleCopy}
            className="px-6 py-4 bg-white hover:bg-green-50 border-2 border-green-300 text-green-800 text-lg font-semibold rounded-xl shadow transition-all"
          >
            {copied ? "✅ Copié !" : "📋 Copier"}
          </button>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px) rotate(-1deg); }
          40% { transform: translateX(6px) rotate(1deg); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </main>
  );
}
