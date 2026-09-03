import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { contexteDepuisProfil, peutEcrire, ROLES_DASHBOARD } from '@/lib/contexte';
import { SUPABASE_URL } from '@/lib/supabase-cible';
import { SUPABASE_SERVICE_ROLE_KEY } from '@/lib/supabase-cible.server';

export function clientService() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function exigenceApi(request, options = {}) {
  const admin = clientService();
  const auth = request.headers.get('authorization') || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;

  if (options.allowBodyToken && !token && request.headers.get('content-type')?.includes('json')) {
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

export async function quartiersDuContexte(admin, ctx, lectureCommuneId = null) {
  if (ctx.niveau === 'pme') {
    const liens = await admin
      .from('pme_quartiers')
      .select('quartier_id')
      .eq('pme_id', ctx.pmeId);
    if (liens.error) return liens;
    return { data: liens.data.map((lien) => lien.quartier_id), error: null };
  }
  const communeId = ctx.niveau === 'commune' ? ctx.communeId : lectureCommuneId;
  if (!communeId) {
    const tous = await admin.from('quartiers').select('id').eq('actif', true);
    if (tous.error) return tous;
    return { data: tous.data.map((quartier) => quartier.id), error: null };
  }
  const quartiers = await admin
    .from('quartiers')
    .select('id')
    .eq('commune_id', communeId)
    .eq('actif', true);
  if (quartiers.error) return quartiers;
  return { data: quartiers.data.map((quartier) => quartier.id), error: null };
}

export async function menageDansContexte(admin, menageId, ctx, lectureCommuneId = null) {
  const quartiers = await quartiersDuContexte(admin, ctx, lectureCommuneId);
  if (quartiers.error) return quartiers;
  if (!quartiers.data.length) return { data: null, error: null };
  let requete = admin
    .from('menages')
    .select('id, quartier_id, commune_id')
    .eq('id', menageId)
    .in('quartier_id', quartiers.data);
  const communeId = ctx.niveau === 'commune' ? ctx.communeId : lectureCommuneId;
  if (communeId) requete = requete.eq('commune_id', communeId);
  return requete.maybeSingle();
}
