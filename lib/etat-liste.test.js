import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appliquerPatch, ecrireEtat, lireEtat } from './etat-liste.js';

const SCHEMA = {
  q: { defaut: '', type: 'string' },
  filtre: { defaut: 'tous', type: 'string' },
  page: { defaut: 1, type: 'int' },
};

test('lireEtat applique les défauts quand l’URL est vide', function () {
  const etat = lireEtat(new URLSearchParams(''), SCHEMA);
  assert.deepEqual(etat, { q: '', filtre: 'tous', page: 1 });
});

test('lireEtat parse page en entier et ignore une page invalide', function () {
  const etat = lireEtat(new URLSearchParams('page=abc&filtre=actif'), SCHEMA);
  assert.equal(etat.page, 1);
  assert.equal(etat.filtre, 'actif');
});

test('ecrireEtat omet les valeurs par défaut', function () {
  const qs = ecrireEtat({ q: '', filtre: 'tous', page: 1 }, SCHEMA);
  assert.equal(qs, '');
  const qs2 = ecrireEtat({ q: 'ama', filtre: 'actif', page: 2 }, SCHEMA);
  assert.equal(new URLSearchParams(qs2).get('q'), 'ama');
  assert.equal(new URLSearchParams(qs2).get('filtre'), 'actif');
  assert.equal(new URLSearchParams(qs2).get('page'), '2');
});

test('appliquerPatch remet page à 1 dès qu’un filtre change', function () {
  const suivant = appliquerPatch(
    { q: '', filtre: 'tous', page: 3 },
    { filtre: 'actif' },
  );
  assert.equal(suivant.page, 1);
  assert.equal(suivant.filtre, 'actif');
});

test('appliquerPatch conserve la page si seul page change', function () {
  const suivant = appliquerPatch(
    { q: 'x', filtre: 'actif', page: 2 },
    { page: 3 },
  );
  assert.equal(suivant.page, 3);
  assert.equal(suivant.q, 'x');
});

test('lireEtat rejette une page partiellement numerique', function () {
  const etat = lireEtat(
    new URLSearchParams('page=2foo&filtre=actif'),
    SCHEMA,
  );
  assert.equal(etat.page, 1);
  assert.equal(etat.filtre, 'actif');
});

test('appliquerPatch preserve l etat quand le patch est vide', function () {
  const suivant = appliquerPatch(
    { q: 'x', filtre: 'actif', page: 3 },
    {},
  );
  assert.equal(suivant.page, 3);
  assert.equal(suivant.q, 'x');
  assert.equal(suivant.filtre, 'actif');
});

