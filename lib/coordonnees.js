/**
 * Lecture d'une coordonnée saisie à la main.
 *
 * Trois étages la lisaient avec `Number(valeur)` en ne se gardant que de la
 * chaîne vide et de `null`. Or `Number` rend `NaN` dès que la saisie n'est pas
 * un nombre, et `NaN` traverse tout :
 *
 *   - `NaN != null` est vrai, donc la carte le passait à Leaflet, qui refusait
 *     la vue — « Invalid LatLng object: (NaN, -13.12) », l'écran de création
 *     cassé net ;
 *   - `NaN < -90` et `NaN > 90` sont tous deux faux, donc le contrôle de
 *     bornes de l'API le laissait passer ;
 *   - `JSON.stringify(NaN)` vaut `null`, donc le point finissait enregistré
 *     sans position, sans un mot, après que l'agent ait tapé ses chiffres.
 *
 * Le second cas est le plus coûteux : une panne silencieuse qui perd la donnée.
 *
 * La virgule est acceptée. Un clavier français écrit « 9,615 » — le refuser
 * serait un piège, pas une validation.
 */

/** Bornes de chaque axe, pour que l'appelant n'ait pas à les réécrire. */
export const BORNES = {
  latitude: { min: -90, max: 90, nom: 'La latitude' },
  longitude: { min: -180, max: 180, nom: 'La longitude' },
};

/**
 * @returns {{ valeur: number|null, erreur: string|null }}
 *   `valeur` null signifie « non renseigné » — un point de dépôt sans GPS est
 *   un cas normal. Elle n'est jamais `NaN` : c'est tout l'objet du module.
 */
export function lireCoordonnee(brut, axe) {
  const bornes = BORNES[axe];
  if (brut === '' || brut == null) return { valeur: null, erreur: null };

  const texte = String(brut).trim().replace(',', '.');
  if (texte === '') return { valeur: null, erreur: null };

  const n = Number(texte);
  if (!Number.isFinite(n)) {
    return { valeur: null, erreur: `${bornes.nom} n'est pas un nombre lisible.` };
  }
  if (n < bornes.min || n > bornes.max) {
    return {
      valeur: null,
      erreur: `${bornes.nom} doit tenir entre ${bornes.min} et ${bornes.max}.`,
    };
  }
  return { valeur: n, erreur: null };
}

/**
 * Le couple, tel que la carte et l'API le veulent.
 *
 * `position` ne vaut un couple que si les deux axes sont lus et valides : une
 * demi-position ne se place pas sur une carte. Une saisie à moitié faite n'est
 * pas une erreur — on attend la suite sans rien dire.
 */
export function lirePosition(latitude, longitude) {
  const lat = lireCoordonnee(latitude, 'latitude');
  const lon = lireCoordonnee(longitude, 'longitude');
  const erreur = lat.erreur || lon.erreur || null;
  const complete = lat.valeur != null && lon.valeur != null;

  return {
    lat: lat.valeur,
    lon: lon.valeur,
    position: complete ? [lat.valeur, lon.valeur] : null,
    erreur,
    // Un seul axe rempli : l'enregistrement perdrait la position en silence.
    incomplete: !complete && (lat.valeur != null || lon.valeur != null),
  };
}
