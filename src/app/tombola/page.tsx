"use client";

import React, { useState, useRef } from "react";

interface Participant {
  id: number;
  name: string;
}

interface Winner {
  participant: Participant;
  prize: Prize;
}

interface Prize {
  rank: number;
  emoji: string;
  label: string;
  description: string;
}

const PRIZES: Prize[] = [
  { rank: 1, emoji: "🥇", label: "1er prix", description: "T-shirt AssoConnect" },
  { rank: 2, emoji: "🥈", label: "2e prix", description: "Shot" },
  { rank: 3, emoji: "🥉", label: "3e prix", description: "Porte-clé AssoConnect" },
];

export default function Tombola() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [input, setInput] = useState("");
  const [winners, setWinners] = useState<Winner[] | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const nextId = useRef(1);

  function addParticipant(raw: string) {
    const names = raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const newOnes: Participant[] = names.map((name) => ({ id: nextId.current++, name }));
    setParticipants((prev) => [...prev, ...newOnes]);
    setInput("");
    setWinners(null);
  }

  function removeParticipant(id: number) {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    setWinners(null);
  }

  function reset() {
    setParticipants([]);
    setWinners(null);
    setInput("");
  }

  async function draw() {
    if (participants.length < PRIZES.length) return;
    setDrawing(true);
    setWinners(null);

    const pool = [...participants];
    const drawn: Winner[] = [];

    for (const prize of PRIZES) {
      await new Promise((r) => setTimeout(r, 700));
      const idx = Math.floor(Math.random() * pool.length);
      const winner = pool.splice(idx, 1)[0];
      setHighlighted(winner.id);
      await new Promise((r) => setTimeout(r, 600));
      drawn.push({ participant: winner, prize });
    }

    setHighlighted(null);
    setWinners(drawn);
    setDrawing(false);
  }

  const canDraw = participants.length >= PRIZES.length;

  return (
    <main className="min-h-screen p-6 flex flex-col items-center gap-8" style={{ backgroundColor: "#f0f4ff" }}>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-6xl">🎟️</span>
        <h1 className="text-4xl font-bold" style={{ color: "#1a1a2e" }}>Tombola AssoConnect</h1>
        <p style={{ color: "#2764F0" }} className="text-lg font-medium">Tirez au sort vos gagnants en toute transparence</p>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-6">

        {/* Lots à gagner */}
        <section className="bg-white rounded-2xl p-6 shadow-md flex flex-col gap-3" style={{ borderTop: "3px solid #2764F0" }}>
          <h2 className="text-lg font-semibold" style={{ color: "#2764F0" }}>Lots à gagner</h2>
          <div className="flex flex-col gap-2">
            {PRIZES.map((prize) => (
              <div key={prize.rank} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: "#f0f4ff" }}>
                <span className="text-2xl">{prize.emoji}</span>
                <div>
                  <span className="text-sm font-semibold" style={{ color: "#2764F0" }}>{prize.label}</span>
                  <span className="text-sm text-gray-600"> — {prize.description}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Participants */}
        <section className="bg-white rounded-2xl p-6 shadow-md flex flex-col gap-4" style={{ borderTop: "3px solid #2764F0" }}>
          <h2 className="text-lg font-semibold" style={{ color: "#2764F0" }}>Participants</h2>
          <div className="flex gap-2">
            <textarea
              className="flex-1 rounded-xl px-4 py-2 text-sm resize-none focus:outline-none"
              style={{ border: "1.5px solid #c7d7fd" }}
              onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px #2764F0")}
              onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
              rows={2}
              placeholder="Un nom par ligne, ou séparés par virgule/point-virgule…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addParticipant(input);
                }
              }}
            />
            <button
              onClick={() => addParticipant(input)}
              className="px-4 py-2 text-white font-semibold rounded-xl transition-all active:scale-95"
              style={{ backgroundColor: "#2764F0" }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#1a50d4")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#2764F0")}
            >
              Ajouter
            </button>
          </div>

          {participants.length > 0 ? (
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {participants.map((p) => (
                <span
                  key={p.id}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 ${highlighted === p.id ? "scale-110 shadow-lg" : ""}`}
                  style={
                    highlighted === p.id
                      ? { backgroundColor: "#ffd600", color: "#1a1a2e" }
                      : winners?.some((w) => w.participant.id === p.id)
                      ? { backgroundColor: "#e6edff", color: "#2764F0", textDecoration: "line-through", opacity: 0.5 }
                      : { backgroundColor: "#e6edff", color: "#2764F0" }
                  }
                >
                  {p.name}
                  {!drawing && (
                    <button
                      onClick={() => removeParticipant(p.id)}
                      className="ml-1 font-bold leading-none hover:text-red-500"
                      style={{ color: "#7ca4f8" }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Aucun participant pour l&apos;instant.</p>
          )}

          <div className="flex items-center justify-between text-sm" style={{ color: "#2764F0" }}>
            <span>{participants.length} participant{participants.length > 1 ? "s" : ""}</span>
            {participants.length > 0 && !drawing && (
              <button onClick={reset} className="text-xs underline text-red-400 hover:text-red-600">
                Tout effacer
              </button>
            )}
          </div>
        </section>

        {/* Tirage */}
        <section className="bg-white rounded-2xl p-6 shadow-md flex flex-col gap-4" style={{ borderTop: "3px solid #2764F0" }}>
          <button
            onClick={draw}
            disabled={!canDraw || drawing}
            className={`w-full py-4 rounded-xl text-white text-xl font-bold transition-all ${
              canDraw && !drawing ? "active:scale-95 shadow-md" : "cursor-not-allowed"
            } ${drawing ? "animate-pulse" : ""}`}
            style={{ backgroundColor: canDraw && !drawing ? "#2764F0" : "#d1d5db" }}
            onMouseOver={(e) => { if (canDraw && !drawing) e.currentTarget.style.backgroundColor = "#1a50d4"; }}
            onMouseOut={(e) => { if (canDraw && !drawing) e.currentTarget.style.backgroundColor = "#2764F0"; }}
          >
            {drawing ? "🥁 Tirage en cours…" : "🎉 Lancer le tirage !"}
          </button>

          {!canDraw && (
            <p className="text-xs text-center" style={{ color: "#2764F0", opacity: 0.6 }}>
              Il faut au moins {PRIZES.length} participants pour lancer le tirage.
            </p>
          )}
        </section>

        {/* Résultats */}
        {winners && winners.length > 0 && (
          <section className="bg-white rounded-2xl p-6 shadow-md flex flex-col gap-4" style={{ borderTop: "3px solid #2764F0" }}>
            <h2 className="text-lg font-semibold" style={{ color: "#2764F0" }}>🏆 Résultats du tirage</h2>
            <ol className="flex flex-col gap-3">
              {winners.map((w) => (
                <li
                  key={w.participant.id}
                  className="flex items-center gap-4 rounded-xl px-5 py-4"
                  style={{ backgroundColor: "#e6edff", border: "1.5px solid #c7d7fd" }}
                >
                  <span className="text-3xl">{w.prize.emoji}</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#2764F0" }}>
                      {w.prize.label} — {w.prize.description}
                    </span>
                    <span className="text-lg font-bold" style={{ color: "#1a1a2e" }}>{w.participant.name}</span>
                  </div>
                </li>
              ))}
            </ol>
            <button
              onClick={draw}
              disabled={drawing}
              className="text-sm underline self-center"
              style={{ color: "#2764F0" }}
            >
              Relancer un tirage
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
