/** Seuil d'aging produit : 24 h en statut nouveau. */
export const SEUIL_RETARD_MS = 24 * 60 * 60 * 1000;

export function estEnRetard(signalement, instant = Date.now()) {
  if (!signalement || signalement.statut !== 'nouveau' || !signalement.created_at) {
    return false;
  }
  return instant - new Date(signalement.created_at).getTime() > SEUIL_RETARD_MS;
}

/** Libellé court pour liste / bandeau. Null si non affecté. */
export function libelleAffectation(s) {
  if (!s?.assigne_pme_nom) return null;
  if (s.assigne_collecteur_nom) {
    return `${s.assigne_collecteur_nom} · ${s.assigne_pme_nom}`;
  }
  return s.assigne_pme_nom;
}
