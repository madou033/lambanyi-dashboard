import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const corps = await request.json();
    const { email, motDePasse, nomComplet, telephone, tokenAppelant } = corps;

    if (!email || !motDePasse || !nomComplet || !tokenAppelant) {
      return NextResponse.json(
        { erreur: 'Champs obligatoires manquants' },
        { status: 400 }
      );
    }

    // 1. Verifier que l'appelant est bien admin ou superviseur
    const { data: appelant, error: erreurToken } =
      await supabaseAdmin.auth.getUser(tokenAppelant);

    if (erreurToken || !appelant.user) {
      return NextResponse.json({ erreur: 'Non autorise' }, { status: 401 });
    }

    const { data: profilAppelant } = await supabaseAdmin
      .from('profils')
      .select('role')
      .eq('id', appelant.user.id)
      .single();

    if (!profilAppelant || (profilAppelant.role !== 'admin' && profilAppelant.role !== 'superviseur')) {
      return NextResponse.json({ erreur: 'Non autorise' }, { status: 403 });
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