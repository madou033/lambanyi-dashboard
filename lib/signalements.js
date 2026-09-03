/** Seuil d'aging produit : 24 h en statut nouveau. */
export const SEUIL_RETARD_MS = 24 * 60 * 60 * 1000;

/** Longueur minimale du motif, imposée par la contrainte de la table
 *  signalements_evenements. Dix caractères écartent « ok » et « fait ». */
export const MOTIF_MINIMUM = 10;

export const TYPES_SIGNALEMENT = [
  { code: 'depotoir_sauvage', label: 'Dépotoir sauvage' },
  { code: 'collecte_manquee', label: 'Collecte manquée' },
  { code: 'bac_plein', label: 'Bac plein' },
  { code: 'autre', label: 'Autre' },
];

const STATUTS_SIGNALEMENT = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  resolu: 'Résolu',
  rejete: 'Rejeté',
};

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

export function libelleTypeSignalement(code) {
  const t = TYPES_SIGNALEMENT.find(function (x) {
    return x.code === code;
  });
  return t ? t.label : String(code ?? '—').replaceAll('_', ' ');
}

export function libelleStatutSignalement(statut) {
  return STATUTS_SIGNALEMENT[statut] || String(statut ?? '—').replaceAll('_', ' ');
}

export function vuePilotageAbsente(error) {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /signalements_pilotage.*(introuvable|not found|does not exist)|relation.*does not exist/i.test(
      error?.message || '',
    )
  );
}

export async function deposerEvenement(client, { signalementId, statut, message, userId }) {
  return client.from('signalements_evenements').insert({
    signalement_id: signalementId,
    statut,
    auteur_id: userId ?? null,
    message,
  });
}
