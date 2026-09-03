'use client';

import { useEffect, useMemo, useState } from 'react';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useContexte } from '@/components/ContexteProvider';
import { BandeauErreur, PageHeader, nombre } from '@/components/ui';
import { CarteListe, Tableau, Td, Tr } from '@/components/liste';

function indexer(lignes, cle) {
  return lignes.reduce(function (index, ligne) {
    const valeur = ligne[cle];
    index[valeur] = (index[valeur] || 0) + 1;
    return index;
  }, {});
}

export default function CommunesPage() {
  const { ctx } = useContexte();
  const [communes, setCommunes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  if (ctx && ctx.niveau !== 'region') redirect('/dashboard');

  useEffect(function () {
    let annule = false;

    async function charger() {
      const [refCommunes, refQuartiers, refMenages, refSignalements] = await Promise.all([
        supabase.from('communes').select('id, nom, code').eq('active', true).order('nom'),
        supabase.from('quartiers').select('id, commune_id'),
        supabase.from('menages').select('id, commune_id'),
        supabase.from('signalements').select('id, statut, quartiers(commune_id)'),
      ]);
      if (annule) return;

      const premiereErreur = [refCommunes, refQuartiers, refMenages, refSignalements].find(function (r) {
        return r.error;
      });
      if (premiereErreur) {
        setErreur(`Impossible de charger les communes : ${premiereErreur.error.message}`);
        setChargement(false);
        return;
      }

      const quartiersParCommune = indexer(refQuartiers.data || [], 'commune_id');
      const menagesParCommune = indexer(refMenages.data || [], 'commune_id');
      const signalementsParCommune = (refSignalements.data || []).reduce(function (index, ligne) {
        const communeId = ligne.quartiers?.commune_id;
        if (ligne.statut === 'nouveau' || ligne.statut === 'en_cours') {
          index[communeId] = (index[communeId] || 0) + 1;
        }
        return index;
      }, {});

      setCommunes(
        (refCommunes.data || []).map(function (commune) {
          return {
            ...commune,
            quartiers: quartiersParCommune[commune.id] || 0,
            menages: menagesParCommune[commune.id] || 0,
            signalements: signalementsParCommune[commune.id] || 0,
          };
        }),
      );
      setErreur(null);
      setChargement(false);
    }

    charger();
    return function () {
      annule = true;
    };
  }, []);

  const totalMenages = useMemo(
    function () {
      return communes.reduce(function (total, commune) {
        return total + commune.menages;
      }, 0);
    },
    [communes],
  );

  return (
    <div className="w-full">
      <PageHeader
        kicker="Région de Conakry"
        titre="Communes"
        sousTitre="Les 13 communes de l'instance, leur couverture terrain et les alertes ouvertes."
      />

      <BandeauErreur message={erreur} />

      <CarteListe
        titre="Index territorial"
        sousTitre={
          chargement
            ? 'Chargement…'
            : `${nombre(communes.length)} communes · ${nombre(totalMenages)} foyers`
        }
      >
        <Tableau
          colonnes={[
            { cle: 'nom', label: 'Commune' },
            { cle: 'code', label: 'Code' },
            { cle: 'quartiers', label: 'Quartiers', align: 'right' },
            { cle: 'menages', label: 'Foyers', align: 'right' },
            { cle: 'signalements', label: 'Signalements ouverts', align: 'right' },
          ]}
          vide={chargement ? 'Chargement des communes…' : 'Aucune commune active dans cette instance.'}
        >
          {communes.map(function (commune, rang) {
            return (
              <Tr key={commune.id} rang={rang} href={`/dashboard?commune=${commune.id}`}>
                <Td fort>{commune.nom}</Td>
                <Td mono>{commune.code}</Td>
                <Td mono align="right">{nombre(commune.quartiers)}</Td>
                <Td mono align="right">{nombre(commune.menages)}</Td>
                <Td mono align="right" className={commune.signalements > 0 ? 'text-red' : undefined}>
                  {nombre(commune.signalements)}
                </Td>
              </Tr>
            );
          })}
        </Tableau>
      </CarteListe>
    </div>
  );
}
