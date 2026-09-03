export const ROLES_DASHBOARD = [
  'observateur_regional',
  'admin',
  'gerant_pme',
];

export function contexteDepuisProfil(profil) {
  const role = profil && profil.role;
  if (!ROLES_DASHBOARD.includes(role)) {
    throw new Error('role_non_autorise');
  }
  if (role === 'observateur_regional') {
    return {
      niveau: 'region',
      communeId: null,
      pmeId: null,
      droits: ['lire', 'agreger'],
      lectureCommuneId: null,
    };
  }
  if (role === 'admin') {
    return {
      niveau: 'commune',
      communeId: profil.commune_id,
      pmeId: null,
      droits: ['lire', 'ecrire'],
      lectureCommuneId: null,
    };
  }
  return {
    niveau: 'pme',
    communeId: null,
    pmeId: profil.pme_id,
    droits: ['lire', 'ecrire'],
    lectureCommuneId: null,
  };
}

export function peutEcrire(ctx) {
  return Boolean(ctx && ctx.droits && ctx.droits.indexOf('ecrire') !== -1);
}

export function avecLectureCommune(ctx, communeId) {
  if (!ctx || ctx.niveau !== 'region') return ctx;
  return { ...ctx, lectureCommuneId: communeId || null };
}

export function lienVisible(lien, ctx) {
  if (!lien || !ctx) return false;
  const facades = lien.facades || ['commune'];
  return facades.indexOf(ctx.niveau) !== -1;
}

/**
 * Conserve le drill-down observateur (?commune=) sur les liens de navigation.
 * Sans lectureCommuneId, renvoie le chemin tel quel.
 */
export function cheminContexte(to, ctx) {
  if (!to || !ctx || !ctx.lectureCommuneId) return to;
  if (String(to).indexOf('commune=') !== -1) return to;
  const sep = String(to).indexOf('?') === -1 ? '?' : '&';
  return `${to}${sep}commune=${encodeURIComponent(ctx.lectureCommuneId)}`;
}
