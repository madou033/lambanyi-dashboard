import { NextResponse } from "next/server";
import { exigenceApi, quartiersDuContexte, refuserEcritureObservateur } from "@/lib/api-auth";

async function pmeAutorisee(sb, ctx, pmeId, quartiers) {
  if (!pmeId) return true;
  if (ctx.niveau === "pme") return pmeId === ctx.pmeId;
  const pme = await sb.from("pme").select("id, commune_creatrice_id")
    .eq("id", pmeId).eq("actif", true).maybeSingle();
  if (pme.error) return pme;
  if (!pme.data) return { data: null, error: null };
  if (pme.data.commune_creatrice_id === ctx.communeId) return pme;
  const adoption = await sb.from("pme_quartiers").select("quartier_id")
    .eq("pme_id", pmeId).in("quartier_id", quartiers);
  if (adoption.error) return adoption;
  return { data: adoption.data.length ? pme.data : null, error: null };
}

async function verifierPerimetre(sb, ctx, quartierId, pmeId) {
  if (!quartierId && !pmeId) return { data: null, error: null };
  if (ctx.niveau === "pme" && pmeId !== ctx.pmeId) return { data: null, error: null };
  const quartiers = await quartiersDuContexte(sb, ctx);
  if (quartiers.error) return quartiers;
  if (quartierId && !quartiers.data.includes(quartierId)) return { data: null, error: null };
  const pme = await pmeAutorisee(sb, ctx, pmeId, quartiers.data);
  if (pme.error) return pme;
  return pme.data ? { data: true, error: null } : { data: null, error: null };
}

export async function GET(request) {
  const auth = await exigenceApi(request);
  if (auth.erreur) return auth.erreur;
  const { admin: sb } = auth;
  const p = request.nextUrl.searchParams;
  const ctx = auth.ctx;
  const quartiers = await quartiersDuContexte(sb, ctx, p.get("lectureCommuneId"));
  if (quartiers.error) return NextResponse.json({ error: quartiers.error.message }, { status: 400 });

  if (p.get("mode") === "referentiel") {
    const q = await sb.from("quartiers").select("id, nom").in("id", quartiers.data).order("nom");
    let m = sb.from("pme").select("id, nom").eq("actif", true);
    if (ctx.niveau === "pme") {
      m = m.eq("id", ctx.pmeId);
    } else if (ctx.niveau !== "region" && quartiers.data.length) {
      const adoption = await sb.from("pme_quartiers").select("pme_id").in("quartier_id", quartiers.data);
      if (adoption.error) return NextResponse.json({ error: adoption.error.message }, { status: 400 });
      const ids = adoption.data.map((row) => row.pme_id);
      m = ids.length
        ? m.or(`commune_creatrice_id.eq.${ctx.communeId},id.in.(${ids.join(",")})`)
        : m.eq("commune_creatrice_id", ctx.communeId);
    } else if (ctx.niveau !== "region") {
      m = m.eq("id", "00000000-0000-0000-0000-000000000000");
    }
    const pmes = await m.order("nom");
    return NextResponse.json({ quartiers: q.data || [], pme: pmes.data || [] });
  }

  let req = sb.from("points_depot_detail").select("*").order("nom");
  if (ctx.niveau === "pme") {
    if (quartiers.data.length) {
      req = req.eq("pme_id", ctx.pmeId).in("quartier_id", quartiers.data);
    } else {
      req = req.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  } else if (quartiers.data.length) {
    req = req.in("quartier_id", quartiers.data);
  } else {
    req = req.eq("id", "00000000-0000-0000-0000-000000000000");
  }
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
  const perimetre = await verifierPerimetre(sb, ctx, b.quartier_id || null, b.pme_id || null);
  if (perimetre.error) return NextResponse.json({ error: perimetre.error.message }, { status: 400 });
  if (!perimetre.data) return NextResponse.json({ error: "Hors perimetre" }, { status: 403 });

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
  const point = await sb.from("points_depot").select("id, quartier_id, pme_id").eq("id", b.id).maybeSingle();
  if (point.error) return NextResponse.json({ error: point.error.message }, { status: 400 });
  if (!point.data) return NextResponse.json({ error: "Point introuvable" }, { status: 404 });
  const perimetre = await verifierPerimetre(sb, ctx, point.data.quartier_id, point.data.pme_id);
  if (perimetre.error) return NextResponse.json({ error: perimetre.error.message }, { status: 400 });
  if (!perimetre.data) return NextResponse.json({ error: "Hors perimetre" }, { status: 403 });

  const r = await sb.from("points_depot")
    .update({ actif: b.actif, updated_at: new Date().toISOString() })
    .eq("id", b.id).select().single();

  if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });
  return NextResponse.json({ data: r.data });
}