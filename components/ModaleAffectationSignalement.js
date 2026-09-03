'use client';

import { useEffect, useMemo, useState } from 'react';
import { Btn, Modal, Selecteur } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export function ModaleAffectationSignalement({
  signalement,
  ouvert,
  onFermer,
  onAffecte,
}) {
  const [pmes, setPmes] = useState([]);
  const [pmeQuartiers, setPmeQuartiers] = useState([]);
  const [collecteurs, setCollecteurs] = useState([]);
  const [pmeId, setPmeId] = useState('');
  const [collecteurId, setCollecteurId] = useState('');
  const [chargement, setChargement] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState(null);
  const cleOuverture = ouvert ? (signalement?.id ?? '__sans_signalement__') : null;
  const [cleVue, setCleVue] = useState(null);

  if (cleVue !== cleOuverture) {
    setCleVue(cleOuverture);
    setPmes([]);
    setPmeQuartiers([]);
    setCollecteurs([]);
    setPmeId('');
    setCollecteurId('');
    setChargement(Boolean(ouvert));
    setEnregistrement(false);
    setMessage(null);
  }

  useEffect(
    function () {
      if (!ouvert) return undefined;
      let actif = true;

      async function chargerOptions() {
        const [reponsePmes, reponsePerimetres, reponseCollecteurs] = await Promise.all([
          supabase.from('pme').select('id, nom').eq('actif', true).order('nom'),
          supabase.from('pme_quartiers').select('pme_id, quartier_id'),
          supabase
            .from('profils')
            .select('id, nom_complet, pme_id')
            .eq('role', 'collecteur')
            .eq('actif', true)
            .order('nom_complet'),
        ]);

        if (!actif) return;
        setPmes(reponsePmes.data || []);
        setPmeQuartiers(reponsePerimetres.data || []);
        setCollecteurs(reponseCollecteurs.data || []);
        setChargement(false);

        const erreur =
          reponsePmes.error || reponsePerimetres.error || reponseCollecteurs.error;
        if (erreur) {
          setMessage(`Impossible de charger les options d’affectation : ${erreur.message}`);
        }
      }

      chargerOptions();
      return function () {
        actif = false;
      };
    },
    [ouvert, signalement?.id],
  );

  const pmesTriees = useMemo(
    function () {
      const quartierId = signalement?.quartier_id;
      const pmesPrioritaires = new Set(
        pmeQuartiers
          .filter(function (lien) {
            return String(lien.quartier_id) === String(quartierId);
          })
          .map(function (lien) {
            return String(lien.pme_id);
          }),
      );

      return pmes
        .map(function (pme, index) {
          return { pme, index };
        })
        .sort(function (a, b) {
          const prioriteA = pmesPrioritaires.has(String(a.pme.id)) ? 0 : 1;
          const prioriteB = pmesPrioritaires.has(String(b.pme.id)) ? 0 : 1;
          return prioriteA - prioriteB || a.index - b.index;
        })
        .map(function ({ pme }) {
          return pme;
        });
    },
    [pmes, pmeQuartiers, signalement?.quartier_id],
  );

  const collecteursFiltres = useMemo(
    function () {
      return collecteurs.filter(function (collecteur) {
        return String(collecteur.pme_id) === String(pmeId);
      });
    },
    [collecteurs, pmeId],
  );

  async function affecter() {
    if (!signalement?.id || !pmeId) {
      setMessage('Choisissez une PME.');
      return;
    }

    setEnregistrement(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('affecter_signalement', {
        p_signalement_id: signalement.id,
        p_pme_id: pmeId,
        p_collecteur_id: collecteurId || null,
      });

      if (error) {
        setMessage(`L’affectation n’a pas pu être enregistrée : ${error.message}`);
        return;
      }

      onAffecte?.();
      onFermer();
    } catch (error) {
      setMessage(
        `L’affectation n’a pas pu être enregistrée : ${error?.message || 'erreur réseau'}`,
      );
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Affecter le signalement"
      bloquerFermeture={enregistrement}
      pied={
        <div className="flex flex-wrap justify-end gap-2">
          <Btn variant="ghost" disabled={enregistrement} onClick={onFermer}>
            Annuler
          </Btn>
          <Btn
            variant="green"
            disabled={enregistrement || chargement || !pmeId}
            onClick={affecter}
          >
            {enregistrement ? 'Affectation…' : 'Affecter'}
          </Btn>
        </div>
      }
    >
      {message ? (
        <p
          role="alert"
          className="mt-0 mb-4 rounded-xl border border-[color-mix(in_srgb,var(--lp-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-red)_14%,transparent)] px-4 py-2.5 text-[12.5px] text-txt"
        >
          {message}
        </p>
      ) : null}

      {chargement ? (
        <p className="m-0 text-[12.5px] text-muted2">Chargement des options d’affectation…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted">
            PME
            <Selecteur
              className="w-full"
              value={pmeId}
              disabled={enregistrement}
              onChange={function (event) {
                setPmeId(event.target.value);
                setCollecteurId('');
                setMessage(null);
              }}
            >
              <option value="">Choisir une PME</option>
              {pmesTriees.map(function (pme) {
                return (
                  <option key={pme.id} value={pme.id}>
                    {pme.nom}
                  </option>
                );
              })}
            </Selecteur>
          </label>

          <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted">
            Collecteur
            <Selecteur
              className="w-full"
              value={collecteurId}
              disabled={enregistrement || !pmeId}
              onChange={function (event) {
                setCollecteurId(event.target.value);
                setMessage(null);
              }}
            >
              <option value="">Toute la PME</option>
              {collecteursFiltres.map(function (collecteur) {
                return (
                  <option key={collecteur.id} value={collecteur.id}>
                    {collecteur.nom_complet}
                  </option>
                );
              })}
            </Selecteur>
          </label>
        </div>
      )}
    </Modal>
  );
}
