import { NextResponse } from 'next/server';
import { exigenceApi, refuserEcritureObservateur } from '@/lib/api-auth';

/** Vérifie qu'un collecteur est lisible / gérable dans le contexte courant. */
async function collecteurDuContexte(admin, collecteurId, ctx) {
  const { data: profil, error } = await admin
    .from('profils')
    .select('id, nom_complet, telephone, actif, created_at, pme_id, role')
    .eq('id', collecteurId)
    .eq('role', 'collecteur')
    .maybeSingle();
  if (error) return { data: null, error };
  if (!profil) return { data: null, error: null };

  if (ctx.niveau === 'pme') {
    if (profil.pme_id !== ctx.pmeId) return { data: null, error: null };
    return { data: profil, error: null };
  }

  if (ctx.niveau === 'commune') {
    if (!profil.pme_id) {
      // Collecteur communal sans PME : visible / gérable par la commune
      // (créé depuis l'espace commune sans rattachement).
      return { data: profil, error: null };
    }
    const [creatrice, adoption] = await Promise.all([
      admin
        .from('pme')
        .select('id')
        .eq('id', profil.pme_id)
        .eq('commune_creatrice_id', ctx.communeId)
        .maybeSingle(),
      admin
        .from('pme_quartiers')
        .select('pme_id, quartiers!inner(commune_id)')
        .eq('pme_id', profil.pme_id)
        .eq('quartiers.commune_id', ctx.communeId)
        .limit(1),
    ]);
    if (creatrice.error) return { data: null, error: creatrice.error };
    if (adoption.error) return { data: null, error: adoption.error };
    if (!creatrice.data && !(adoption.data || []).length) {
      return { data: null, error: null };
    }
    return { data: profil, error: null };
  }

  // Observateur régional : lecture de tout le catalogue.
  return { data: profil, error: null };
}

export async function GET(request, { params }) {
  const auth = await exigenceApi(request);
  if (auth.erreur) return auth.erreur;
  const { admin, ctx } = auth;
  const { id } = await params;

  const cible = await collecteurDuContexte(admin, id, ctx);
  if (cible.error) {
    return NextResponse.json({ erreur: cible.error.message }, { status: 400 });
  }
  if (!cible.data) {
    return NextResponse.json({ erreur: 'Collecteur introuvable' }, { status: 404 });
  }

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(id);
  if (userError) {
    return NextResponse.json({ erreur: userError.message }, { status: 400 });
  }

  let pmeNom = null;
  if (cible.data.pme_id) {
    const pme = await admin.from('pme').select('nom').eq('id', cible.data.pme_id).maybeSingle();
    if (!pme.error) pmeNom = pme.data?.nom || null;
  }

  return NextResponse.json({
    id: cible.data.id,
    nom_complet: cible.data.nom_complet,
    telephone: cible.data.telephone,
    actif: cible.data.actif,
    created_at: cible.data.created_at,
    pme_id: cible.data.pme_id,
    pme_nom: pmeNom,
    email: userData.user?.email || null,
  });
}

/**
 * Réinitialisation du mot de passe — admin communal uniquement.
 * Corps : { motDePasse }
 */
export async function PATCH(request, { params }) {
  const auth = await exigenceApi(request, { allowBodyToken: true });
  if (auth.erreur) return auth.erreur;
  const { admin, ctx } = auth;
  const refus = refuserEcritureObservateur(ctx);
  if (refus) return refus;

  if (ctx.niveau !== 'commune') {
    return NextResponse.json(
      { erreur: 'Seul un administrateur communal peut réinitialiser le mot de passe.' },
      { status: 403 },
    );
  }

  const { id } = await params;
  const corps = await request.json().catch(function () {
    return {};
  });
  const motDePasse = typeof corps.motDePasse === 'string' ? corps.motDePasse : '';

  if (motDePasse.length < 6) {
    return NextResponse.json(
      { erreur: 'Le mot de passe doit faire au moins 6 caractères.' },
      { status: 400 },
    );
  }

  const cible = await collecteurDuContexte(admin, id, ctx);
  if (cible.error) {
    return NextResponse.json({ erreur: cible.error.message }, { status: 400 });
  }
  if (!cible.data) {
    return NextResponse.json({ erreur: 'Collecteur hors périmètre' }, { status: 403 });
  }

  const { error } = await admin.auth.admin.updateUserById(id, { password: motDePasse });
  if (error) {
    return NextResponse.json({ erreur: error.message }, { status: 400 });
  }

  return NextResponse.json({ succes: true });
}
