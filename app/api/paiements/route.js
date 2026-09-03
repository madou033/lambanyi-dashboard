import { NextResponse } from "next/server";
import { exigenceApi, menageDansContexte, refuserEcritureObservateur } from "@/lib/api-auth";

async function bornerParContexte(sb, req, ctx, p, colonne) {
  let communeId = ctx.niveau === "commune" ? ctx.communeId : p.get("lectureCommuneId");
  let quartierReq = sb.from("quartiers").select("id");
  if (communeId) {
    quartierReq = quartierReq.eq("commune_id", communeId);
  } else if (ctx.niveau === "pme") {
    const liens = await sb.from("pme_quartiers").select("quartier_id").eq("pme_id", ctx.pmeId);
    if (liens.error) return { error: liens.error };
    const ids = liens.data.map(function (x) { return x.quartier_id; });
    return ids.length ? req.in(colonne, ids) : req.in(colonne, ["00000000-0000-0000-0000-000000000000"]);
  } else if (!communeId) {
    return req;
  }
  const quartiers = await quartierReq;
  if (quartiers.error) return { error: quartiers.error };
  const ids = quartiers.data.map(function (x) { return x.id; });
  return ids.length ? req.in(colonne, ids) : req.in(colonne, ["00000000-0000-0000-0000-000000000000"]);
}

async function bornerPaiementsDetail(sb, req, ctx, p) {
  let menages = sb.from("menages").select("code_menage, quartier_id");
  let communeId = ctx.niveau === "commune" ? ctx.communeId : p.get("lectureCommuneId");
  if (communeId) {
    const quartiers = await sb.from("quartiers").select("id").eq("commune_id", communeId);
    if (quartiers.error) return { error: quartiers.error };
    menages = menages.in("quartier_id", quartiers.data.map(function (x) { return x.id; }));
  } else if (ctx.niveau === "pme") {
    const liens = await sb.from("pme_quartiers").select("quartier_id").eq("pme_id", ctx.pmeId);
    if (liens.error) return { error: liens.error };
    menages = menages.in("quartier_id", liens.data.map(function (x) { return x.quartier_id; }));
  } else if (!communeId) {
    return req;
  }
  const r = await menages;
  if (r.error) return { error: r.error };
  return r.data.length
    ? req.in("code_menage", r.data.map(function (x) { return x.code_menage; }))
    : req.in("code_menage", ["__aucun__"]);
}

function appliquerFiltres(req, p) {
  const quartier = p.get("quartier");
  const statut = p.get("statut");
  const mode = p.get("fournisseur");
  const du = p.get("du");
  const au = p.get("au");
  if (quartier) req = req.eq("quartier", quartier);
  if (statut) req = req.eq("statut", statut);
  if (mode) req = req.eq("fournisseur", mode);
  if (du) req = req.gte("created_at", du);
  if (au) req = req.lte("created_at", au + "T23:59:59");
  return req;
}

function versCsv(lignes) {
  const entetes = [
    "Date", "Code menage", "Quartier", "Point de repere", "Telephone",
    "Type", "Plan", "Montant GNF", "Penalite GNF", "Mois",
    "Periode debut", "Periode fin", "Mode", "Reference", "Statut"
  ];
  const lig = lignes.map(function (p) {
    return [
      new Date(p.created_at).toLocaleDateString("fr-FR"),
      p.code_menage || "",
      p.quartier || "",
      p.point_repere || "",
      p.telephone_contact || "",
      p.type_menage || "",
      p.plan_code || "",
      p.montant_gnf || 0,
      p.penalite_gnf || 0,
      p.mois_regles || "",
      p.periode_debut || "",
      p.periode_fin || "",
      p.fournisseur || "",
      p.reference_externe || "",
      p.statut || ""
    ].map(function (c) {
      const s = String(c).replace(/"/g, '""');
      return '"' + s + '"';
    }).join(";");
  });
  return "\uFEFF" + entetes.join(";") + "\n" + lig.join("\n");
}

export async function GET(request) {
  const auth = await exigenceApi(request);
  if (auth.erreur) return auth.erreur;
  const { admin: sb, ctx } = auth;
  const p = request.nextUrl.searchParams;
  const mode = p.get("mode") || "recents";

  if (mode === "quartiers") {
    let req = sb.from("quartiers").select("id, nom").eq("actif", true).order("nom");
    const borne = await bornerParContexte(sb, req, ctx, p, "id");
    if (borne.error) return NextResponse.json({ error: borne.error.message }, { status: 400 });
    const r = await borne;
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });
    return NextResponse.json({ data: r.data.map(function (q) { return q.nom; }) });
  }

  if (mode === "recherche") {
    const q = (p.get("q") || "").trim();
    if (q.length < 2) return NextResponse.json({ data: [] });
    const filtre =
      "code_menage.ilike.%" + q + "%," +
      "telephone_contact.ilike.%" + q + "%," +
      "point_repere.ilike.%" + q + "%";
    let req = sb.from("menages_solde").select("*").or(filtre).limit(15);
    const borne = await bornerParContexte(sb, req, ctx, p, "quartier_id");
    if (borne.error) return NextResponse.json({ error: borne.error.message }, { status: 400 });
    const r = await borne;
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });
    return NextResponse.json({ data: r.data });
  }

  if (mode === "solde") {
    const id = p.get("abonnement_id");
    if (!id) return NextResponse.json({ error: "abonnement_id manquant" }, { status: 400 });
    let acces = sb.from("menages_solde").select("abonnement_id, quartier_id").eq("abonnement_id", id);
    const borneSolde = await bornerParContexte(sb, acces, ctx, p, "quartier_id");
    if (borneSolde.error) return NextResponse.json({ error: borneSolde.error.message }, { status: 400 });
    const accesResultat = await borneSolde;
    if (accesResultat.error) return NextResponse.json({ error: accesResultat.error.message }, { status: 400 });
    if (!accesResultat.data.length) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
    }
    const r = await sb.rpc("solde_abonnement", { p_abonnement_id: id });
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });
    const solde = Array.isArray(r.data) ? r.data[0] : r.data;
    let communeId = ctx.niveau === "commune" ? ctx.communeId : p.get("lectureCommuneId");
    if (!communeId) {
      const quartier = await sb.from("quartiers").select("commune_id")
        .eq("id", accesResultat.data[0].quartier_id).single();
      if (quartier.error) return NextResponse.json({ error: quartier.error.message }, { status: 400 });
      communeId = quartier.data.commune_id;
    }
    let prReq = sb.from("parametres").select("valeur").eq("cle", "avance_mois_max");
    if (communeId) prReq = prReq.eq("commune_id", communeId);
    const pr = await prReq.maybeSingle();
    const avance = pr.data ? parseInt(pr.data.valeur, 10) : 0;
    return NextResponse.json({ data: solde, avance_mois_max: avance });
  }

  if (mode === "export") {
    let req = sb.from("paiements_detail").select("*").order("created_at", { ascending: false }).limit(5000);
    const borne = await bornerPaiementsDetail(sb, req, ctx, p);
    if (borne.error) return NextResponse.json({ error: borne.error.message }, { status: 400 });
    req = borne;
    req = appliquerFiltres(req, p);
    const r = await req;
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });
    const nom = "paiements_" + new Date().toISOString().slice(0, 10) + ".csv";
    return new NextResponse(versCsv(r.data), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + nom + '"'
      }
    });
  }

  const limite = parseInt(p.get("limite") || "50", 10);
  let req = sb.from("paiements_detail").select("*").order("created_at", { ascending: false }).limit(limite);
  const borne = await bornerPaiementsDetail(sb, req, ctx, p);
  if (borne.error) return NextResponse.json({ error: borne.error.message }, { status: 400 });
  req = borne;
  req = appliquerFiltres(req, p);
  const r = await req;
  if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });

  let total = 0;
  let totalPen = 0;
  r.data.forEach(function (x) {
    if (x.statut === "confirme") {
      total += Number(x.montant_gnf || 0);
      totalPen += Number(x.penalite_gnf || 0);
    }
  });
  return NextResponse.json({ data: r.data, total: total, total_penalite: totalPen });
}

export async function POST(request) {
  const auth = await exigenceApi(request);
  if (auth.erreur) return auth.erreur;
  const { admin: sb, ctx } = auth;
  const refus = refuserEcritureObservateur(ctx);
  if (refus || ctx.niveau !== "commune") {
    return refus || NextResponse.json({ erreur: "Lecture seule" }, { status: 403 });
  }
  const body = await request.json();

  const abonnementId = body.abonnement_id;
  const mois = parseInt(body.mois, 10);
  const fournisseur = body.fournisseur || "especes";
  const reference = body.reference_externe || null;
  const note = body.note || null;

  if (!abonnementId) {
    return NextResponse.json({ error: "Abonnement non selectionne" }, { status: 400 });
  }
  if (!mois || mois < 1) {
    return NextResponse.json({ error: "Nombre de mois invalide" }, { status: 400 });
  }

  const menage = await sb.from("abonnements")
    .select("menage_id")
    .eq("id", abonnementId)
    .maybeSingle();
  if (menage.error) return NextResponse.json({ error: menage.error.message }, { status: 400 });
  if (!menage.data) return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
  const accessible = await menageDansContexte(sb, menage.data.menage_id, ctx);
  if (accessible.error) return NextResponse.json({ error: accessible.error.message }, { status: 400 });
  if (!accessible.data) return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });

  const rs = await sb.rpc("solde_abonnement", { p_abonnement_id: abonnementId });
  if (rs.error) return NextResponse.json({ error: rs.error.message }, { status: 400 });
  const solde = Array.isArray(rs.data) ? rs.data[0] : rs.data;
  if (!solde) return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });

  const pr = await sb.from("parametres").select("valeur")
    .eq("cle", "avance_mois_max")
    .eq("commune_id", ctx.communeId)
    .maybeSingle();
  const avance = pr.data ? parseInt(pr.data.valeur, 10) : 0;
  const maxMois = solde.mois_dus + avance;

  if (mois > maxMois) {
    return NextResponse.json(
      { error: "Surplus refuse : " + maxMois + " mois payables au maximum" },
      { status: 400 }
    );
  }

  const penUnitaire = solde.mois_dus > 0 ? Math.round(solde.penalite_due / solde.mois_dus) : 0;
  const penalite = penUnitaire * Math.min(mois, solde.mois_dus);
  const montant = mois * solde.montant_mensuel;

  const ins = await sb.from("paiements").insert({
    abonnement_id: abonnementId,
    montant_gnf: montant,
    penalite_gnf: penalite,
    fournisseur: fournisseur,
    reference_externe: reference,
    note: note,
    statut: "en_attente"
  }).select().single();

  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 });

  const upd = await sb.from("paiements").update({ statut: "confirme" })
    .eq("id", ins.data.id).select().single();

  if (upd.error) {
    await sb.from("paiements").update({ statut: "echoue" }).eq("id", ins.data.id);
    return NextResponse.json({ error: upd.error.message }, { status: 400 });
  }

  return NextResponse.json({ data: upd.data, montant: montant, penalite: penalite });
}