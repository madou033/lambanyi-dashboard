import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estEnRetard, libelleAffectation, SEUIL_RETARD_MS } from './signalements.js';

test('estEnRetard : nouveau de plus de 24 h', function () {
  const instant = Date.parse('2026-09-02T12:00:00Z');
  const created = new Date(instant - SEUIL_RETARD_MS - 60_000).toISOString();
  assert.equal(estEnRetard({ statut: 'nouveau', created_at: created }, instant), true);
});

test('estEnRetard : nouveau de moins de 24 h', function () {
  const instant = Date.parse('2026-09-02T12:00:00Z');
  const created = new Date(instant - 3_600_000).toISOString();
  assert.equal(estEnRetard({ statut: 'nouveau', created_at: created }, instant), false);
});

test("estEnRetard : en_cours vieux n'est pas en retard", function () {
  const instant = Date.parse('2026-09-02T12:00:00Z');
  const created = new Date(instant - SEUIL_RETARD_MS * 3).toISOString();
  assert.equal(estEnRetard({ statut: 'en_cours', created_at: created }, instant), false);
});

test('libelleAffectation', function () {
  assert.equal(libelleAffectation({}), null);
  assert.equal(
    libelleAffectation({ assigne_pme_nom: 'Salubrité' }),
    'Salubrité',
  );
  assert.equal(
    libelleAffectation({
      assigne_pme_nom: 'Salubrité',
      assigne_collecteur_nom: 'Mamadou Bah',
    }),
    'Mamadou Bah · Salubrité',
  );
});
