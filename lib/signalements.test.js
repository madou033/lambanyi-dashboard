import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  deposerEvenement,
  estEnRetard,
  libelleAffectation,
  libelleStatutSignalement,
  libelleTypeSignalement,
  MOTIF_MINIMUM,
  SEUIL_RETARD_MS,
  vuePilotageAbsente,
} from './signalements.js';

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

test('MOTIF_MINIMUM est de 10 caractères', function () {
  assert.equal(MOTIF_MINIMUM, 10);
});

test('libelleTypeSignalement conserve les libellés métier', function () {
  assert.equal(libelleTypeSignalement('depotoir_sauvage'), 'Dépotoir sauvage');
  assert.equal(libelleTypeSignalement('collecte_manquee'), 'Collecte manquée');
  assert.equal(libelleTypeSignalement('bac_plein'), 'Bac plein');
  assert.equal(libelleTypeSignalement('autre'), 'Autre');
  assert.equal(libelleTypeSignalement('inconnu_xyz'), 'inconnu xyz');
  assert.equal(libelleTypeSignalement(null), '—');
});

test('libelleStatutSignalement n’expose pas l’enum brut', function () {
  assert.equal(libelleStatutSignalement('nouveau'), 'Nouveau');
  assert.equal(libelleStatutSignalement('en_cours'), 'En cours');
  assert.equal(libelleStatutSignalement('resolu'), 'Résolu');
  assert.equal(libelleStatutSignalement('rejete'), 'Rejeté');
});

test('vuePilotageAbsente détecte une relation manquante', function () {
  assert.equal(vuePilotageAbsente({ code: '42P01' }), true);
  assert.equal(vuePilotageAbsente({ code: 'PGRST205' }), true);
  assert.equal(
    vuePilotageAbsente({ message: 'relation "signalements_pilotage" does not exist' }),
    true,
  );
  assert.equal(vuePilotageAbsente({ code: '42501', message: 'permission denied' }), false);
  assert.equal(vuePilotageAbsente(null), false);
});

test('deposerEvenement insère les colonnes attendues', async function () {
  const insertions = [];
  const client = {
    from: function (table) {
      return {
        insert: function (ligne) {
          insertions.push({ table, ligne });
          return { error: null };
        },
      };
    },
  };
  await deposerEvenement(client, {
    signalementId: 'sig-1',
    statut: 'en_cours',
    message: null,
    userId: 'user-1',
  });
  assert.deepEqual(insertions, [
    {
      table: 'signalements_evenements',
      ligne: {
        signalement_id: 'sig-1',
        statut: 'en_cours',
        auteur_id: 'user-1',
        message: null,
      },
    },
  ]);
});
