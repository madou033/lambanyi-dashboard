import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lireCoordonnee, lirePosition } from './coordonnees.js';

test('lireCoordonnee : un nombre ordinaire passe', function () {
  assert.deepEqual(lireCoordonnee('9.615', 'latitude'), { valeur: 9.615, erreur: null });
  assert.deepEqual(lireCoordonnee('-13.622', 'longitude'), { valeur: -13.622, erreur: null });
  assert.deepEqual(lireCoordonnee(9.615, 'latitude'), { valeur: 9.615, erreur: null });
});

test('lireCoordonnee : la virgule du clavier francais est acceptee', function () {
  assert.equal(lireCoordonnee('9,615', 'latitude').valeur, 9.615);
  assert.equal(lireCoordonnee('-13,622', 'longitude').valeur, -13.622);
});

test('lireCoordonnee : le vide est un cas normal, pas une erreur', function () {
  for (const vide of ['', '   ', null, undefined]) {
    assert.deepEqual(lireCoordonnee(vide, 'latitude'), { valeur: null, erreur: null });
  }
});

test('lireCoordonnee : zero reste zero et ne devient pas « non renseigne »', function () {
  assert.equal(lireCoordonnee('0', 'latitude').valeur, 0);
  assert.equal(lireCoordonnee(0, 'longitude').valeur, 0);
});

// Le coeur du defaut : chacune de ces saisies rendait NaN, et NaN passait.
test('lireCoordonnee : aucune saisie illisible ne rend NaN', function () {
  for (const mauvais of ['-', '.', 'abc', '9.6.1', '9 6', '--9', '1e', '9,6,1']) {
    const lu = lireCoordonnee(mauvais, 'latitude');
    assert.equal(lu.valeur, null, `« ${mauvais} » aurait du etre refuse`);
    assert.match(lu.erreur, /n'est pas un nombre lisible/);
  }
});

test('lireCoordonnee : ni l\'infini ni les bornes depassees', function () {
  assert.match(lireCoordonnee('Infinity', 'latitude').erreur, /nombre lisible/);
  assert.match(lireCoordonnee('91', 'latitude').erreur, /entre -90 et 90/);
  assert.match(lireCoordonnee('-200', 'longitude').erreur, /entre -180 et 180/);
  // La latitude s'arrete a 90, la longitude non : les bornes ne sont pas les memes.
  assert.equal(lireCoordonnee('120', 'longitude').valeur, 120);
  assert.match(lireCoordonnee('120', 'latitude').erreur, /entre -90 et 90/);
});

test('lirePosition : un couple complet et valide donne une position', function () {
  const p = lirePosition('9,615', '-13.622');
  assert.deepEqual(p.position, [9.615, -13.622]);
  assert.equal(p.erreur, null);
  assert.equal(p.incomplete, false);
});

test('lirePosition : une saisie illisible ne produit jamais de position', function () {
  const p = lirePosition('abc', '-13.12');
  assert.equal(p.position, null);
  assert.equal(p.lat, null);
  assert.match(p.erreur, /latitude/i);
});

test('lirePosition : deux champs vides, aucune plainte', function () {
  const p = lirePosition('', '');
  assert.deepEqual(p, { lat: null, lon: null, position: null, erreur: null, incomplete: false });
});

test('lirePosition : un seul axe rempli est signale comme incomplet', function () {
  assert.equal(lirePosition('9.615', '').incomplete, true);
  assert.equal(lirePosition('', '-13.622').incomplete, true);
});
