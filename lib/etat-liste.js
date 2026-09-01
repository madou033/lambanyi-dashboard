function lireValeur(brut, champ) {
  if (brut == null || brut === '') return champ.defaut;
  if (champ.type === 'int') {
    const n = parseInt(brut, 10);
    return Number.isFinite(n) && n > 0 ? n : champ.defaut;
  }
  return brut;
}

export function lireEtat(searchParams, schema) {
  const etat = {};
  for (const cle of Object.keys(schema)) {
    etat[cle] = lireValeur(searchParams.get(cle), schema[cle]);
  }
  return etat;
}

export function ecrireEtat(etat, schema) {
  const params = new URLSearchParams();
  for (const cle of Object.keys(schema)) {
    const valeur = etat[cle];
    const defaut = schema[cle].defaut;
    if (valeur == null || valeur === '' || valeur === defaut) continue;
    params.set(cle, String(valeur));
  }
  return params.toString();
}

export function appliquerPatch(etat, patch) {
  const suivant = { ...etat, ...patch };
  const cles = Object.keys(patch);
  if (!(cles.length === 1 && cles[0] === 'page')) {
    suivant.page = 1;
  }
  return suivant;
}

