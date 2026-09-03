import { NextResponse } from "next/server";
import { exigenceApi, menageDansContexte, refuserEcritureObservateur } from "@/lib/api-auth";

export async function GET(request) {
  const auth = await exigenceApi(request);
  if (auth.erreur) return auth.erreur;
  const { admin: sb, ctx } = auth;
  const type = request.nextUrl.searchParams.get("type_menage");
  const lectureCommuneId = request.nextUrl.searchParams.get("lectureCommuneId");
  let req = sb.from("plans_tarifaires")
    .select("id, code, libelle, montant_gnf, passages_par_semaine, type_menage")
    .eq("actif", true)
    .order("passages_par_semaine");
  const communeId = ctx.niveau === "commune" ? ctx.communeId : lectureCommuneId;
  if (communeId) req = req.eq("commune_id", communeId);
  if (type) req = req.eq("type_menage", type);
  const r = await req;
  if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });
  return NextResponse.json({ data: r.data });
}

export async function POST(request) {
  const auth = await exigenceApi(request);
  if (auth.erreur) return auth.erreur;
  const { admin: sb, ctx } = auth;
  const refus = refuserEcritureObservateur(ctx);
  if (refus) return refus;
  const body = await request.json();
  const menageId = body.menage_id;
  const planId = body.plan_id;

  if (!menageId || !planId) {
    return NextResponse.json({ error: "Menage ou plan manquant" }, { status: 400 });
  }
  const accessible = await menageDansContexte(sb, menageId, ctx);
  if (accessible.error) return NextResponse.json({ error: accessible.error.message }, { status: 400 });
  if (!accessible.data) return NextResponse.json({ error: "Menage introuvable" }, { status: 404 });

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