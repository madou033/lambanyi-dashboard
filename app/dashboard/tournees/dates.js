/**
 * Dates du calendrier des tournées — en jours locaux, jamais en UTC.
 *
 * Toutes les dates circulent en `AAAA-MM-JJ`, la forme que porte la colonne
 * `jour` de `tournees_occurrences`. On évite `new Date(iso)` seul, qui lit la
 * chaîne comme de l'UTC et décale d'un jour à l'ouest de Greenwich : chaque
 * conversion passe par midi.
 */

const JOURS_COURTS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

export const JOURS = [
  { iso: 1, label: 'Lundi', court: 'Lun' },
  { iso: 2, label: 'Mardi', court: 'Mar' },
  { iso: 3, label: 'Mercredi', court: 'Mer' },
  { iso: 4, label: 'Jeudi', court: 'Jeu' },
  { iso: 5, label: 'Vendredi', court: 'Ven' },
  { iso: 6, label: 'Samedi', court: 'Sam' },
  { iso: 7, label: 'Dimanche', court: 'Dim' },
];

/** La date du jour, ou n'importe quelle Date, en AAAA-MM-JJ local. */
export function isoLocal(d = new Date()) {
  const p = function (n) {
    return String(n).padStart(2, '0');
  };
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Une Date à midi, pour que l'arithmétique ne bute pas sur les fuseaux. */
export function midi(iso) {
  return new Date(`${iso}T12:00:00`);
}

export function ajouterJours(iso, n) {
  const d = midi(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

export function ajouterMois(iso, n) {
  const d = midi(iso);
  const jour = d.getDate();
  d.setMonth(d.getMonth() + n);
  // 31 janvier + 1 mois : on reste en février, au dernier jour.
  if (d.getDate() < jour) d.setDate(0);
  return isoLocal(d);
}

/** Jour ISO 8601 : 1 = lundi … 7 = dimanche (getDay rend 0 le dimanche). */
export function jourIso(iso) {
  const j = midi(iso).getDay();
  return j === 0 ? 7 : j;
}

/** Le lundi de la semaine qui contient cette date. */
export function lundiDe(iso) {
  return ajouterJours(iso, 1 - jourIso(iso));
}

/** Les sept jours d'une semaine, à partir de son lundi. */
export function semaineDe(lundi) {
  return Array.from({ length: 7 }, function (_, i) {
    return ajouterJours(lundi, i);
  });
}

/** « lun. 20 » */
export function jourCourt(iso) {
  const d = midi(iso);
  return `${JOURS_COURTS[jourIso(iso) - 1]} ${d.getDate()}`;
}

/** « lun. 20 oct. » */
export function jourMois(iso) {
  const d = midi(iso);
  return `${JOURS_COURTS[jourIso(iso) - 1]} ${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' })}`;
}

/** « 20 octobre 2026 » */
export function dateLongue(iso) {
  return midi(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Le titre d'une semaine : « 19 – 25 octobre 2026 », ou à cheval sur deux mois. */
export function titreSemaine(lundi) {
  const d = midi(lundi);
  const f = midi(ajouterJours(lundi, 6));
  const meme = d.getMonth() === f.getMonth();
  const mois = function (x) {
    return x.toLocaleDateString('fr-FR', { month: 'long' });
  };
  return meme
    ? `${d.getDate()} – ${f.getDate()} ${mois(f)} ${f.getFullYear()}`
    : `${d.getDate()} ${mois(d)} – ${f.getDate()} ${mois(f)} ${f.getFullYear()}`;
}

/** « mardi et vendredi », « lundi, mercredi et vendredi », « chaque jour ». */
export function libelleJours(jours) {
  const liste = (jours || []).slice().sort(function (a, b) {
    return a - b;
  });
  if (liste.length === 0) return 'ponctuelle';
  if (liste.length === 7) return 'chaque jour';
  const noms = liste.map(function (j) {
    return (JOURS.find(function (x) { return x.iso === j; })?.label || '?').toLowerCase();
  });
  if (noms.length === 1) return noms[0];
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
}

/** Les portées proposées à la planification. */
export const PORTEES = [
  { code: 'jour', label: 'Ce jour seulement', mois: 0 },
  { code: '1m', label: '1 mois', mois: 1 },
  { code: '3m', label: '3 mois', mois: 3 },
  { code: '6m', label: '6 mois', mois: 6 },
  { code: '12m', label: '1 an', mois: 12 },
  { code: 'sans_fin', label: 'Sans fin', mois: null },
];

/** La date de fin qu'une portée implique, à partir du jour de départ. */
export function finDePortee(code, depart) {
  const p = PORTEES.find(function (x) { return x.code === code; });
  if (!p || p.code === 'sans_fin') return null;
  if (p.mois === 0) return depart;
  // Un mois de récurrence couvre jusqu'à la veille du même jour, le mois suivant.
  return ajouterJours(ajouterMois(depart, p.mois), -1);
}
