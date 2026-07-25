import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function GET(request) {
  const sb = getAdmin();
  const type = request.nextUrl.searchParams.get("type_menage");
  let req = sb.from("plans_tarifaires")
    .select("id, code, libelle, montant_gnf, passages_par_semaine, type_menage")
    .eq("actif", true)
    .order("passages_par_semaine");
  if (type) req = req.eq("type_menage", type);
  const r = await req;
  if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });
  return NextResponse.json({ data: r.data });
}

export async function POST(request) {
  const sb = getAdmin();
  const body = await request.json();
  const menageId = body.menage_id;
  const planId = body.plan_id;

  if (!menageId || !planId) {
    return NextResponse.json({ error: "Menage ou plan manquant" }, { status: 400 });
  }

  const dejaLa = await sb.from("abonnements")
    .select("id").eq("menage_id", menageId).neq("statut", "resilie").limit(1);
  if (dejaLa.error) return NextResponse.json({ error: dejaLa.error.message }, { status: 400 });
  if (dejaLa.data.length > 0) {
    return NextResponse.json({ error: "Ce menage a deja un abonnement actif" }, { status: 400 });
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);

  const ins = await sb.from("abonnements").insert({
    menage_id: menageId,
    plan_id: planId,
    date_debut: aujourdhui,
    date_fin: aujourdhui,
    statut: "en_attente_paiement"
  }).select().single();

  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });
  return NextResponse.json({ data: ins.data });
}