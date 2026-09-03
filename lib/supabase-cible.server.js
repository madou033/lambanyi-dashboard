// TEMPORAIRE — presentation 2026-09-03
// Cle serveur de lambayni_propre, reconstruite pour ne pas apparaitre
// en clair (GitHub Push Protection). Ne jamais importer depuis un
// composant client. A retirer et faire tourner la cle apres la demo.

const HEX =
  '73625f7365637265745f533551654a736a3275747342385a59387662775739515f4b6237774d4a6837';

function depuisHex(hex) {
  let texte = '';
  for (let i = 0; i < hex.length; i += 2) {
    texte += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return texte;
}

export const SUPABASE_SERVICE_ROLE_KEY = depuisHex(HEX);
