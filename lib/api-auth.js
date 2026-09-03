import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { contexteDepuisProfil, peutEcrire, ROLES_DASHBOARD } from '@/lib/contexte';

export function clientService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
}

export async function exigenceApi(request) {
  const admin = clientService();
  const auth = request.headers.get('authorization') || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;

  if (!token && request.headers.get('content-type')?.includes('json')) {
    try {
      const body = await request.clone().json();
      token = body.tokenAppelant || null;
    } catch {
      // Le corps n'est pas exploitable ; l'absence de jeton sera refusée.
    }
  }

  if (!token) {
    return { erreur: NextResponse.json({ erreur: 'Non autorise' }, { status: 401 }) };
  }

  const { data: u, error } = await admin.auth.getUser(token);
  if (error || !u.user) {
    return { erreur: NextResponse.json({ erreur: 'Non autorise' }, { status: 401 }) };
  }

  const { data: profil } = await admin
    .from('profils')
    .select('id, role, commune_id, pme_id, actif')
    .eq('id', u.user.id)
    .single();
  if (!profil || !profil.actif || !ROLES_DASHBOARD.includes(profil.role)) {
    return { erreur: NextResponse.json({ erreur: 'Non autorise' }, { status: 403 }) };
  }

  let ctx;
  try {
    ctx = contexteDepuisProfil(profil);
  } catch {
    return { erreur: NextResponse.json({ erreur: 'Non autorise' }, { status: 403 }) };
  }
  return { ctx, profil, admin };
}

export function refuserEcritureObservateur(ctx) {
  if (!peutEcrire(ctx) || ctx.niveau === 'region') {
    return NextResponse.json({ erreur: 'Lecture seule' }, { status: 403 });
  }
  return null;
}
