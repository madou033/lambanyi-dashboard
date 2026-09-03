import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ROLES_DASHBOARD,
  contexteDepuisProfil,
  peutEcrire,
  lienVisible,
  cheminContexte,
} from './contexte.js';
import { cheminHorsFacade } from './facade-routes.js';

test('admin → niveau commune, droits ecrire', function () {
  const ctx = contexteDepuisProfil({
    role: 'admin',
    commune_id: 'c1',
    pme_id: null,
  });
  assert.equal(ctx.niveau, 'commune');
  assert.equal(ctx.communeId, 'c1');
  assert.equal(peutEcrire(ctx), true);
  assert.deepEqual(ctx.droits, ['lire', 'ecrire']);
});

test('observateur → region, pas ecrire', function () {
  const ctx = contexteDepuisProfil({
    role: 'observateur_regional',
    commune_id: null,
    pme_id: null,
  });
  assert.equal(ctx.niveau, 'region');
  assert.equal(peutEcrire(ctx), false);
  assert.ok(ctx.droits.includes('agreger'));
});

test('gerant → pme', function () {
  const ctx = contexteDepuisProfil({
    role: 'gerant_pme',
    commune_id: null,
    pme_id: 'p1',
  });
  assert.equal(ctx.niveau, 'pme');
  assert.equal(peutEcrire(ctx), true);
});

test('superviseur n est pas un role dashboard', function () {
  assert.equal(ROLES_DASHBOARD.includes('superviseur'), false);
  assert.throws(function () {
    contexteDepuisProfil({ role: 'superviseur', commune_id: 'c1' });
  });
});

test('lien tarifs masque pour la PME', function () {
  const ctx = contexteDepuisProfil({
    role: 'gerant_pme',
    pme_id: 'p1',
  });
  assert.equal(
    lienVisible({ facades: ['region', 'commune'] }, ctx),
    false,
  );
  assert.equal(
    lienVisible({ facades: ['region', 'commune', 'pme'] }, ctx),
    true,
  );
});

test('lien Communes visible seulement en region', function () {
  const lien = { facades: ['region'] };
  assert.equal(
    lienVisible(lien, contexteDepuisProfil({ role: 'observateur_regional' })),
    true,
  );
  assert.equal(
    lienVisible(lien, contexteDepuisProfil({ role: 'admin', commune_id: 'c1' })),
    false,
  );
});

test('cheminContexte conserve le drill-down observateur', function () {
  const base = contexteDepuisProfil({ role: 'observateur_regional' });
  const ctx = { ...base, lectureCommuneId: 'c-lam' };
  assert.equal(cheminContexte('/dashboard/menages', ctx), '/dashboard/menages?commune=c-lam');
  assert.equal(cheminContexte('/dashboard', base), '/dashboard');
  assert.equal(
    cheminContexte('/dashboard/menages?foo=1', ctx),
    '/dashboard/menages?foo=1&commune=c-lam',
  );
});

test('cheminHorsFacade bloque parametres hors commune et tarifs hors PME', function () {
  const pme = contexteDepuisProfil({ role: 'gerant_pme', pme_id: 'p1' });
  const region = contexteDepuisProfil({ role: 'observateur_regional' });
  const admin = contexteDepuisProfil({ role: 'admin', commune_id: 'c1' });
  assert.equal(cheminHorsFacade('/dashboard/parametres', pme), true);
  assert.equal(cheminHorsFacade('/dashboard/parametres', region), true);
  assert.equal(cheminHorsFacade('/dashboard/parametres', admin), false);
  assert.equal(cheminHorsFacade('/dashboard/tarifs', pme), true);
  assert.equal(cheminHorsFacade('/dashboard/tarifs', region), false);
  assert.equal(cheminHorsFacade('/dashboard/communes', pme), true);
  assert.equal(cheminHorsFacade('/dashboard/communes', region), false);
  assert.equal(cheminHorsFacade('/dashboard/profil', pme), false);
});
