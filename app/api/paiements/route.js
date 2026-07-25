import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
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
  const sb = getAdmin();
  const p = request.nextUrl.searchParams;
  const mode = p.get("mode") || "recents";

  if (mode === "quartiers") {
    const r = await sb.from("quartiers").select("nom").eq("actif", true).order("nom");
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
    const r = await sb.from("menages_solde").select("*").or(filtre).limit(15);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });
    return NextResponse.json({ data: r.data });
  }

  if (mode === "solde") {
    const id = p.get("abonnement_id");
    if (!id) return NextResponse.json({ error: "abonnement_id manquant" }, { status: 400 });
    const r = await sb.rpc("solde_abonnement", { p_abonnement_id: id });
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 400 });
    const solde = Array.isArray(r.data) ? r.data[0] : r.data;
    const pr = await sb.from("parametres").select("valeur").eq("cle", "avance_mois_max").maybeSingle();
    const avance = pr.data ? parseInt(pr.data.valeur, 10) : 0;
    return NextResponse.json({ data: solde, avance_mois_max: avance });
  }

  if (mode === "export") {
    let req = sb.from("paiements_detail").select("*").order("created_at", { ascending: false }).limit(5000);
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
  const sb = getAdmin();
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

  const rs = await sb.rpc("solde_abonnement", { p_abonnement_id: abonnementId });
  if (rs.error) return NextResponse.json({ error: rs.error.message }, { status: 400 });
  const solde = Array.isArray(rs.data) ? rs.data[0] : rs.data;
  if (!solde) return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });

  const pr = await sb.from("parametres").select("valeur").eq("cle", "avance_mois_max").maybeSingle();
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