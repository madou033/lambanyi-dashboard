import {
  IconAlerte,
  IconCamion,
  IconDash,
  IconEquipe,
  IconEtiquette,
  IconImmeuble,
  IconMaison,
  IconPortefeuille,
  IconPoubelle,
  IconQr,
  IconRouages,
} from '@/components/icons';

/**
 * Taxonomie du dashboard — groupes par domaine métier.
 * `disponible: false` = module planifié (affiché grisé, étiquette « bientôt »).
 * cf. DESIGN_SYSTEM.md §3.2
 */
export const SECTIONS_NAV = [
  {
    id: 'communes',
    titre: 'Communes',
    domaine: 'RÉGION',
    description: 'Pilotage des communes de la région de Conakry.',
    Icon: IconImmeuble,
    liens: [
      { to: '/dashboard/communes', label: 'Communes', disponible: true, facades: ['region'] },
    ],
  },
  {
    id: 'pilotage',
    titre: 'Pilotage',
    domaine: 'COMMUNE',
    description: "Vue d'ensemble de l'activité d'assainissement de la commune.",
    Icon: IconDash,
    liens: [
      {
        to: '/dashboard',
        end: true,
        label: "Vue d'ensemble",
        disponible: true,
        facades: ['region', 'commune', 'pme'],
      },
    ],
  },
  {
    id: 'usagers',
    titre: 'Usagers',
    domaine: 'FOYERS',
    description: 'Registre des ménages abonnés et de leurs codes de collecte.',
    Icon: IconMaison,
    liens: [
      { to: '/dashboard/menages', label: 'Ménages', disponible: true, facades: ['region', 'commune', 'pme'] },
      { to: '/dashboard/qr-menages', label: 'Codes QR', disponible: true, facades: ['region', 'commune', 'pme'] },
    ],
  },
  {
    id: 'terrain',
    titre: 'Terrain',
    domaine: 'COLLECTE',
    description: 'Collecteurs, tournées planifiées et points de dépôt du réseau.',
    Icon: IconCamion,
    liens: [
      { to: '/dashboard/collecteurs', label: 'Collecteurs', disponible: true, facades: ['region', 'commune', 'pme'] },
      { to: '/dashboard/tournees', label: 'Tournées', disponible: true, facades: ['region', 'commune', 'pme'] },
      { to: '/dashboard/points-depot', label: 'Points de dépôt', disponible: true, facades: ['region', 'commune', 'pme'] },
    ],
  },
  {
    id: 'recouvrement',
    titre: 'Recouvrement',
    domaine: 'FINANCE',
    description: 'Grille tarifaire, abonnements et encaissements.',
    Icon: IconPortefeuille,
    liens: [
      { to: '/dashboard/tarifs', label: 'Tarifs', disponible: true, facades: ['region', 'commune'] },
      { to: '/dashboard/paiements', label: 'Paiements', disponible: true, facades: ['region', 'commune', 'pme'] },
    ],
  },
  {
    id: 'signalements',
    titre: 'Signalements',
    domaine: 'CITOYEN',
    description: 'Remontées des citoyens et des collecteurs à traiter.',
    Icon: IconAlerte,
    liens: [{ to: '/dashboard/signalements', label: 'Signalements', disponible: true, facades: ['region', 'commune', 'pme'] }],
  },
  {
    id: 'partenaires',
    titre: 'Partenaires',
    domaine: 'PME',
    description: 'PME de collecte et périmètres qui leur sont affectés.',
    Icon: IconImmeuble,
    liens: [{ to: '/dashboard/pme', label: 'PME', disponible: true, facades: ['region', 'commune', 'pme'] }],
  },
  {
    id: 'administration',
    titre: 'Administration',
    domaine: 'ADMIN',
    description: 'Quartiers, comptes et paramétrage de la plateforme.',
    Icon: IconRouages,
    liens: [
      { to: '/dashboard/quartiers', label: 'Quartiers', disponible: true, facades: ['region', 'commune', 'pme'] },
      { to: '/dashboard/parametres', label: 'Paramètres', disponible: true, facades: ['commune'] },
    ],
  },
];

/** Icônes secondaires réexportées pour les tuiles d'action rapide. */
export const ICONES_ACTION = {
  menages: IconMaison,
  collecteurs: IconEquipe,
  tarifs: IconEtiquette,
  depots: IconPoubelle,
  qr: IconQr,
};

/** Liens livrés, dans l'ordre des raccourcis Alt+1…9. */
export const LIENS_DISPONIBLES = SECTIONS_NAV.flatMap(function (s) {
  return s.liens.filter(function (l) {
    return l.disponible;
  });
}).slice(0, 9);

export function lienEstActif(pathname, lien) {
  if (lien.end) return pathname === lien.to;
  return pathname === lien.to || pathname.startsWith(`${lien.to}/`);
}
