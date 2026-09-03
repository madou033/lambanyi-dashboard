import { NextResponse } from "next/server";
import { exigenceApi, refuserEcritureObservateur } from "@/lib/api-auth";

export async function GET(request) {
  const auth = await exigenceApi(request);
  if (auth.erreur) return auth.erreur;
  const { admin: sb } = auth;
  const p = request.nextUrl.searchParams;

  if (p.get("mode") === "referentiel") {
    const q = await sb.from("quartiers").select("id, nom").eq("actif", true).order("nom");
    const m = await sb.from("pme").select("id, nom").eq("actif", true).order("nom");
    return NextResponse.json({ quartiers: q.data || [], pme: m.data || [] });
  }

  let req = sb.from("points_depot_detail").select("*").order("nom");
  if (p.get("quartier_id")) req = req.eq("quartier_id", p.get("quartier_id"));
  if (p.get("type_point")) req = req.eq("type_point", p.get("type_point"));
  if (p.get("proprietaire")) req = req.eq("proprietaire", p.get("proprietaire"));

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
  const b = await request.json();

  if (!b.nom || !b.type_point) {
    return NextResponse.json({ error: "Nom et type obligatoires" }, { status: 400 });
  }

  const lat = b.latitude === "" || b.latitude === null ? null : Number(b.latitude);
  const lon = b.longitude === "" || b.longitude === null ? null : Number(b.longitude);

  if (lat !== null && (lat < -90 || lat > 90)) {
    return NextResponse.json({ error: "Latitude hors limites" }, { status: 400 });
  }
  if (lon !== null && (lon < -180 || lon > 180)) {
    return NextResponse.json({ error: "Longitude hors limites" }, { status: 400 });
  }

  const r = await sb.rpc("enregistrer_point_depot", {
    p_id: b.id || null,
    p_nom: b.nom,
    p_type: b.type_point,
    p_quartier_id: b.quartier_id || null,
    p_pme_id: b.pme_id || null,
    p_capacite: b.capacite_m3 ? Number(b.capacite_m3) : null,
    p_repere: b.adresse_repere || null,
    p_lat: lat,
    p_lon: lon
  });

  if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });
  return NextResponse.json({ id: r.data });
}

export async function PATCH(request) {
  const auth = await exigenceApi(request);
  if (auth.erreur) return auth.erreur;
  const { admin: sb, ctx } = auth;
  const refus = refuserEcritureObservateur(ctx);
  if (refus) return refus;
  const b = await request.json();
  if (!b.id) return NextResponse.json({ error: "Identifiant manquant" }, { status: 400 });

  const r = await sb.from("points_depot")
    .update({ actif: b.actif, updated_at: new Date().toISOString() })
    .eq("id", b.id).select().single();

  if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });
  return NextResponse.json({ data: r.data });
}