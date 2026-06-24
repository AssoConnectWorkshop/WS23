import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tombola_participants")
    .select("id, prenom, nom, created_at")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { prenom, nom } = await req.json();
  if (!prenom?.trim() || !nom?.trim()) {
    return NextResponse.json({ error: "Prénom et nom requis" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tombola_participants")
    .insert({ prenom: prenom.trim(), nom: nom.trim() })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE() {
  const supabase = await createClient();
  const { error } = await supabase.from("tombola_participants").delete().gte("id", 0);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
