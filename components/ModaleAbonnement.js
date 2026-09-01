'use client';

import { useEffect, useState } from 'react';
import { Btn, Modal, cn, montant } from '@/components/ui';

const TYPES_MENAGE = {
  residentiel: 'Résidentiel',
  commerce: 'Commerce',
  institution: 'Institution',
  industrie: 'Industrie',
};

export function ModaleAbonnement({ menage, ouvert, onFermer, onCree }) {
  const [plans, setPlans] = useState([]);
  const [planChoisi, setPlanChoisi] = useState('');
  const [chargement, setChargement] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(
    function () {
      if (!ouvert || !menage?.type_menage) return;
      let actif = true;

      async function chargerPlans() {
        setChargement(true);
        setPlans([]);
        setPlanChoisi('');
        setMessage(null);
        try {
          const reponse = await fetch(
            `/api/abonnements?type_menage=${encodeURIComponent(menage.type_menage)}`,
          );
          if (!reponse.ok) throw new Error('Service indisponible');
          const resultat = await reponse.json();
          if (actif) setPlans(resultat.data || []);
        } catch {
          if (actif) {
            setMessage(
              'Impossible de charger les plans tarifaires — vérifiez la configuration du serveur.',
            );
          }
        } finally {
          if (actif) setChargement(false);
        }
      }

      chargerPlans();
      return function () {
        actif = false;
      };
    },
    [ouvert, menage?.type_menage],
  );

  async function creerAbonnement() {
    if (!planChoisi || !menage?.menage_id) {
      setMessage('Choisissez un plan.');
      return;
    }
    setEnregistrement(true);
    setMessage(null);
    try {
      const reponse = await fetch('/api/abonnements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menage_id: menage.menage_id, plan_id: planChoisi }),
      });
      const resultat = await reponse.json().catch(function () {
        return {};
      });
      if (!reponse.ok) {
        setMessage(resultat.error || "L'abonnement n'a pas pu être créé.");
        return;
      }
      onCree?.(resultat.data);
      onFermer();
    } catch {
      setMessage('Erreur réseau.');
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Souscrire un abonnement"
      sousTitre={
        menage
          ? `${menage.code_menage} · ${TYPES_MENAGE[menage.type_menage] || menage.type_menage}`
          : ''
      }
      bloquerFermeture={enregistrement}
      pied={
        <div className="flex flex-wrap justify-end gap-2">
          <Btn variant="ghost" disabled={enregistrement} onClick={onFermer}>
            Annuler
          </Btn>
          <Btn
            variant="green"
            disabled={enregistrement || chargement || !planChoisi}
            onClick={creerAbonnement}
          >
            {enregistrement ? 'Création…' : "Créer l'abonnement"}
          </Btn>
        </div>
      }
    >
      {message ? (
        <p className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--lp-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-red)_14%,transparent)] px-4 py-2.5 text-[12.5px] text-txt">
          {message}
        </p>
      ) : null}

      <p className="mt-0 mb-4 text-[12.5px] text-muted">
        Le premier mois devient dû à la création. L&apos;abonnement ne s&apos;active qu&apos;une
        fois le paiement confirmé.
      </p>

      {chargement ? (
        <p className="m-0 text-[12.5px] text-muted2">Chargement des plans…</p>
      ) : plans.length === 0 ? (
        <p className="m-0 text-[12.5px] text-muted2">
          Aucun plan disponible pour ce type de foyer.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {plans.map(function (plan) {
            const choisi = planChoisi === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={function () {
                  setPlanChoisi(plan.id);
                }}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left outline-none transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-blue',
                  choisi
                    ? 'border-green bg-[color-mix(in_srgb,var(--lp-green)_12%,transparent)]'
                    : 'border-line hover:border-line2 hover:bg-panel2',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2.5 shrink-0 rounded-full border-2 transition-colors',
                    choisi ? 'border-green bg-green' : 'border-line2',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[12.5px] font-bold text-txt">
                    {plan.code}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-muted">
                    {plan.libelle} · {plan.passages_par_semaine} passage
                    {plan.passages_par_semaine > 1 ? 's' : ''}/semaine
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[13px] font-bold text-txt tabular-nums">
                  {montant(plan.montant_gnf)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
