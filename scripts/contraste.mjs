/**
 * Validateur de contraste — cf. DESIGN_SYSTEM.md §2.3.
 *
 * Lit les deux palettes directement dans `app/globals.css` et vérifie, pour
 * chacune :
 *   · chaque jeton porteur de texte contre les quatre surfaces ;
 *   · l'encre (`--lp-encre`) posée sur chaque aplat d'accent ;
 *   · le texte d'un badge sur sa propre teinte à 15 %.
 *
 * Seuil : 4.5:1 (AA texte courant). L'interface descend à 10–11 px, donc on
 * n'applique pas la tolérance « grand texte ».
 *
 *   node scripts/contraste.mjs
 *
 * Doit rendre 0 échec. À relancer après toute retouche de palette.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SEUIL = 4.5;
const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

/* -- Colorimétrie ---------------------------------------------------- */

const canaux = (h) => {
  const c = h.replace('#', '').trim();
  const plein = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  return plein.match(/../g).map((x) => parseInt(x, 16) / 255);
};
const lineaire = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (h) => {
  const [r, v, b] = canaux(h).map(lineaire);
  return 0.2126 * r + 0.7152 * v + 0.0722 * b;
};
const contraste = (a, b) => {
  const [haut, bas] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (haut + 0.05) / (bas + 0.05);
};
/** Équivaut à `color-mix(in srgb, fg pct%, transparent)` posé sur `fond`. */
const melange = (fg, pct, fond) => {
  const f = canaux(fg);
  const b = canaux(fond);
  const a = pct / 100;
  return (
    '#' +
    f
      .map((c, i) => Math.round((c * a + b[i] * (1 - a)) * 255).toString(16).padStart(2, '0'))
      .join('')
  );
};

/* -- Lecture des palettes ------------------------------------------- */

const css = readFileSync(join(racine, 'app', 'globals.css'), 'utf8');

function palette(selecteur) {
  const i = css.indexOf(selecteur);
  if (i < 0) throw new Error(`Sélecteur introuvable : ${selecteur}`);
  const bloc = css.slice(i, css.indexOf('}', i));
  const jetons = {};
  for (const [, cle, valeur] of bloc.matchAll(/--lp-([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    jetons[cle] = valeur;
  }
  return jetons;
}

const THEMES = [
  ['SOMBRE', palette('[data-theme="dark"] {')],
  ['CLAIR', palette('[data-theme="light"] {')],
];

const ACCENTS = ['green', 'gold', 'teal', 'blue', 'red', 'violet'];
const TEXTES = ['txt', 'muted', 'muted2', ...ACCENTS];

/* -- Vérification ---------------------------------------------------- */

let echecs = 0;

function ligne(etiquette, ratio) {
  const ok = ratio >= SEUIL;
  if (!ok) echecs += 1;
  console.log(`  ${etiquette.padEnd(34)} ${ratio.toFixed(2).padStart(6)}  ${ok ? 'ok' : 'ÉCHEC'}`);
}

for (const [nom, p] of THEMES) {
  const surfaces = { bg: p.bg, bg2: p.bg2, panel: p.panel, panel2: p.panel2 };
  console.log(`\n════ ${nom} ════`);

  console.log('— jetons de texte, pire des quatre surfaces');
  for (const t of TEXTES) {
    const pire = Math.min(...Object.values(surfaces).map((s) => contraste(p[t], s)));
    ligne(`${t} (${p[t]})`, pire);
  }

  console.log(`— encre ${p.encre} sur aplat d'accent`);
  for (const a of ACCENTS) ligne(`encre sur bg-${a}`, contraste(p.encre, p[a]));

  console.log('— badge : accent sur sa teinte 15 % posée sur panel');
  for (const a of ACCENTS) {
    ligne(`text-${a} sur teinte`, contraste(p[a], melange(p[a], 15, p.panel)));
  }
}

console.log(`\n${echecs === 0 ? '✓ 0 échec' : `✗ ${echecs} échec(s)`} — seuil ${SEUIL}:1`);
process.exit(echecs === 0 ? 0 : 1);
