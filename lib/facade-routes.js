import { lienVisible } from './contexte.js';

/**
 * Catalogue des routes dashboard et de leurs façades.
 * Duplique volontairement les `facades` de SECTIONS_NAV pour rester
 * importable hors Next (tests Node) sans icônes React.
 */
export const ROUTES_FACADE = [
  { to: '/dashboard/communes', facades: ['region'] },
  { to: '/dashboard', end: true, facades: ['region', 'commune', 'pme'] },
  { to: '/dashboard/menages', facades: ['region', 'commune', 'pme'] },
  { to: '/dashboard/qr-menages', facades: ['region', 'commune', 'pme'] },
  { to: '/dashboard/collecteurs', facades: ['region', 'commune', 'pme'] },
  { to: '/dashboard/tournees', facades: ['region', 'commune', 'pme'] },
  { to: '/dashboard/points-depot', facades: ['region', 'commune', 'pme'] },
  { to: '/dashboard/tarifs', facades: ['region', 'commune'] },
  { to: '/dashboard/paiements', facades: ['region', 'commune', 'pme'] },
  { to: '/dashboard/signalements', facades: ['region', 'commune', 'pme'] },
  { to: '/dashboard/pme', facades: ['region', 'commune', 'pme'] },
  { to: '/dashboard/quartiers', facades: ['region', 'commune', 'pme'] },
  { to: '/dashboard/parametres', facades: ['commune'] },
];

function lienEstActif(pathname, lien) {
  if (lien.end) return pathname === lien.to;
  return pathname === lien.to || pathname.startsWith(`${lien.to}/`);
}

/**
 * True si le pathname courant correspond à un lien de nav hors façade.
 * Les routes hors catalogue (profil, etc.) ne sont pas bloquées.
 */
export function cheminHorsFacade(pathname, ctx) {
  if (!pathname || !ctx) return false;
  const candidats = ROUTES_FACADE.filter(function (lien) {
    return lienEstActif(pathname, lien);
  });
  if (candidats.length === 0) return false;
  candidats.sort(function (a, b) {
    return b.to.length - a.to.length;
  });
  return !lienVisible(candidats[0], ctx);
}
