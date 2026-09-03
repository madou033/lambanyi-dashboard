import { NextResponse } from 'next/server';
import { exigenceApi, refuserEcritureObservateur } from '@/lib/api-auth';

export async function POST(request) {
  try {
    const auth = await exigenceApi(request, { allowBodyToken: true });
    if (auth.erreur) return auth.erreur;
    const { admin: supabaseAdmin, ctx } = auth;
    const refus = refuserEcritureObservateur(ctx);
    if (refus) return refus;
    const corps = await request.json();
    const { email, motDePasse, nomComplet, telephone } = corps;

    if (!email || !motDePasse || !nomComplet) {
      return NextResponse.json(
        { erreur: 'Champs obligatoires manquants' },
        { status: 400 }
      );
    }

    if (!['commune', 'pme'].includes(ctx.niveau)) {
      return NextResponse.json({ erreur: 'Lecture seule' }, { status: 403 });
    }

    let pmeId = corps.pme_id || null;
    if (ctx.niveau === 'pme') {
      pmeId = ctx.pmeId;
    } else if (pmeId) {
      const pme = await supabaseAdmin
        .from('pme')
        .select('id, commune_creatrice_id')
        .eq('id', pmeId)
        .eq('actif', true)
        .maybeSingle();
      if (pme.error) {
        return NextResponse.json({ erreur: pme.error.message }, { status: 400 });
      }
      const ancrage = await supabaseAdmin
        .from('pme_quartiers')
        .select('quartier_id, quartiers!inner(commune_id)')
        .eq('pme_id', pmeId)
        .eq('quartiers.commune_id', ctx.communeId)
        .limit(1);
      if (!pme.data || (!ancrage.data?.length && pme.data.commune_creatrice_id !== ctx.communeId)) {
        return NextResponse.json({ erreur: 'Non autorise' }, { status: 403 });
      }
    }

    // 2. Creer le compte auth du collecteur
    const { data: nouveau, error: erreurCreation } =
      await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: motDePasse,
        email_confirm: true,
      });

    if (erreurCreation) {
      return NextResponse.json(
        { erreur: erreurCreation.message },
        { status: 400 }
      );
    }

    // 3. Creer son profil collecteur
    const { error: erreurProfil } = await supabaseAdmin
      .from('profils')
      .insert({
        id: nouveau.user.id,
        nom_complet: nomComplet,
        telephone: telephone || null,
        role: 'collecteur',
        pme_id: pmeId,
      });

    if (erreurProfil) {
      await supabaseAdmin.auth.admin.deleteUser(nouveau.user.id);
      return NextResponse.json(
        { erreur: erreurProfil.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ succes: true, id: nouveau.user.id });
  } catch (e) {
    return NextResponse.json(
      { erreur: 'Erreur serveur : ' + e.message },
      { status: 500 }
    );
  }
}