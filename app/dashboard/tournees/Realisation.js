'use client';

/**
 * Le bilan d'une période : taux de réalisation, retards au départ, journées
 * non faites, foyers collectés.
 *
 * La gestion d'un jour — remplaçant, suspension, note, heure — vit désormais
 * dans le calendrier : une tournée s'y règle là où on la voit. Il reste ici ce
 * qu'un calendrier ne montre pas, parce que ça ne tient pas dans une case :
 * la tendance sur plusieurs semaines.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge, Chip, heure, nombre } from '@/components/ui';
import { BandeauMetriques, CarteListe, Tableau, Tr, Td, exporterCsv, usePagination } from '@/components/liste';
import { Btn, PaginationBar } from '@/components/ui';
import { ajouterJours, isoLocal, jourMois } from './dates';

const OCCURRENCE = {
  planifiee: { ton: 'muted', libelle: 'Planifiée' },
  en_cours: { ton: 'vert', libelle: 'En cours' },
  terminee: { ton: 'teal', libelle: 'Terminée' },
  non_faite: { ton: 'rouge', libelle: 'Non faite' },
  suspendue: { ton: 'or', libelle: 'Suspendue' },
};

function retardLisible(min) {
  if (min == null) return '—';
  if (Math.abs(min) < 5) return 'à l’heure';
  return min > 0 ? `+${min} min` : `${min} min`;
}

export function Realisation({ ctx, quartiersAutorises }) {
  const [periode, setPeriode] = useState(14);
  const [historique, setHistorique] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const idsQuartiers = useMemo(
    function () {
      return new Set((quartiersAutorises || []).map(function (q) { return q.id; }));
    },
    [quartiersAutorises],
  );

  const charger = useCallback(async function () {
    setChargement(true);
    const aujourdhui = isoLocal();
    const { data, error } = await supabase
      .from('tournees_realisation')
      .select('occurrence_id, tournee_id, jour, statut, debut_at, retard_min, note, hors_serie, quartier_id, quartier, heure_debut, heure_du_jour, collecteurs, equipe_modifiee, collectes, a_desservir, absents, inaccessibles, hors_seuil')
      .gte('jour', ajouterJours(aujourdhui, -periode))
      .lte('jour', aujourdhui)
      .order('jour', { ascending: false })
      .order('heure_debut');

    setChargement(false);
    if (error) {
      setErreur(`Impossible de lire la réalisation : ${error.message}`);
      return;
    }
    setErreur(null);
    setHistorique(data || []);
  }, [periode]);

  useEffect(
    function () {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      charger();
    },
    [charger],
  );

  const lignes = useMemo(
    function () {
      return historique.filter(function (r) {
        return idsQuartiers.size === 0 || idsQuartiers.has(r.quartier_id);
      });
    },
    [historique, idsQuartiers],
  );

  const pagination = usePagination(lignes, 25);

  // Indicateurs de période : seules les journées écoulées comptent.
  const bilan = useMemo(
    function () {
      const total = lignes.length;
      const faites = lignes.filter(function (r) { return r.statut === 'terminee' || r.statut === 'en_cours'; }).length;
      const nonFaites = lignes.filter(function (r) { return r.statut === 'non_faite'; }).length;
      const suspendues = lignes.filter(function (r) { return r.statut === 'suspendue'; }).length;
      const retards = lignes.filter(function (r) { return r.retard_min != null; }).map(function (r) { return r.retard_min; });
      const retardMoyen = retards.length
        ? Math.round(retards.reduce(function (a, b) { return a + b; }, 0) / retards.length)
        : null;
      return {
        total,
        faites,
        nonFaites,
        suspendues,
        retardMoyen,
        collectes: lignes.reduce(function (a, r) { return a + (r.collectes || 0); }, 0),
        aDesservir: lignes.reduce(function (a, r) { return a + (r.a_desservir || 0); }, 0),
        horsSeuil: lignes.reduce(function (a, r) { return a + (r.hors_seuil || 0); }, 0),
      };
    },
    [lignes],
  );

  function exporter() {
    exporterCsv(
      `tournees-${periode}j-${isoLocal()}.csv`,
      ['Jour', 'Heure', 'Quartier', 'Équipe', 'État', 'Départ', 'Retard (min)', 'Collectés', 'À desservir', 'Absents', 'Hors seuil'],
      lignes.map(function (r) {
        return [
          r.jour,
          String(r.heure_debut).slice(0, 5),
          r.quartier,
          r.collecteurs || '',
          (OCCURRENCE[r.statut] || {}).libelle || r.statut,
          r.debut_at ? heure(r.debut_at) : '',
          r.retard_min ?? '',
          r.collectes,
          r.a_desservir,
          (r.absents || 0) + (r.inaccessibles || 0),
          r.hors_seuil,
        ];
      }),
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <BandeauMetriques
        metriques={[
          {
            label: 'Tournées réalisées',
            valeur: chargement ? '—' : bilan.total ? `${Math.round((bilan.faites / bilan.total) * 100)} %` : '—',
            sous: `${nombre(bilan.faites)} sur ${nombre(bilan.total)} · ${periode} jours`,
            ton: bilan.total && bilan.faites / bilan.total >= 0.9 ? 'teal' : bilan.total ? 'or' : 'defaut',
          },
          {
            label: 'Non faites',
            valeur: chargement ? '—' : nombre(bilan.nonFaites),
            sous: `${nombre(bilan.suspendues)} suspendue${bilan.suspendues > 1 ? 's' : ''}`,
            ton: bilan.nonFaites > 0 ? 'rouge' : 'defaut',
          },
          {
            label: 'Retard moyen au départ',
            valeur: chargement ? '—' : retardLisible(bilan.retardMoyen),
            sous: 'Par rapport à l’heure prévue ce jour-là',
            ton: bilan.retardMoyen != null && bilan.retardMoyen > 30 ? 'or' : 'defaut',
          },
          {
            label: 'Foyers collectés',
            valeur: chargement ? '—' : nombre(bilan.collectes),
            sous: `sur ${nombre(bilan.aDesservir)} à desservir · ${nombre(bilan.horsSeuil)} pointage${bilan.horsSeuil > 1 ? 's' : ''} hors seuil`,
            ton: bilan.horsSeuil > 0 ? 'or' : 'teal',
          },
        ]}
      />

      {erreur ? <p className="m-0 text-[12.5px] text-red">{erreur}</p> : null}

      <CarteListe
        titre="Journal des tournées"
        sousTitre="Chaque tournée de chaque jour, la plus récente en premier. Pour la régler, ouvrez-la dans le calendrier."
        outils={<Btn variant="ghost" onClick={exporter}>Exporter en CSV</Btn>}
        chips={[7, 14, 30, 90].map(function (n) {
          return (
            <Chip key={n} actif={periode === n} onClick={function () { setPeriode(n); }}>
              {n} jours
            </Chip>
          );
        })}
        pied={
          <PaginationBar
            page={pagination.page}
            pages={pagination.pages}
            total={lignes.length}
            onChange={pagination.setPage}
          />
        }
      >
        <Tableau
          colonnes={[
            { cle: 'jour', label: 'Jour' },
            { cle: 'heure', label: 'Heure' },
            { cle: 'quartier', label: 'Quartier' },
            { cle: 'equipe', label: 'Équipe' },
            { cle: 'etat', label: 'État' },
            { cle: 'depart', label: 'Départ' },
            { cle: 'collectes', label: 'Collectés', align: 'right' },
            { cle: 'absents', label: 'Absents', align: 'right' },
            { cle: 'horsseuil', label: 'Hors seuil', align: 'right' },
          ]}
          vide={chargement ? 'Chargement…' : 'Aucune tournée sur la période.'}
        >
          {pagination.tranche.map(function (r, i) {
            const def = OCCURRENCE[r.statut] || OCCURRENCE.planifiee;
            return (
              <Tr key={r.occurrence_id} rang={i}>
                <Td mono>{jourMois(r.jour)}</Td>
                <Td mono>
                  {String(r.heure_debut).slice(0, 5)}
                  {r.heure_du_jour ? <span className="ml-1 text-blue">•</span> : null}
                </Td>
                <Td fort>{r.quartier}</Td>
                <Td>
                  {r.collecteurs || <span className="text-red">Sans collecteur</span>}
                  {r.equipe_modifiee ? <Badge ton="bleu" className="ml-2">Équipe du jour</Badge> : null}
                </Td>
                <Td>
                  <Badge ton={def.ton}>{def.libelle}</Badge>
                  {r.hors_serie ? <Badge ton="bleu" className="ml-2">Rattrapage</Badge> : null}
                  {r.note ? <span className="ml-2 text-[12px] text-muted2">{r.note}</span> : null}
                </Td>
                <Td mono>{r.debut_at ? `${heure(r.debut_at)} · ${retardLisible(r.retard_min)}` : '—'}</Td>
                <Td align="right" mono>{nombre(r.collectes)} / {nombre(r.a_desservir)}</Td>
                <Td align="right" mono>{nombre((r.absents || 0) + (r.inaccessibles || 0))}</Td>
                <Td align="right" mono className={r.hors_seuil > 0 ? 'text-gold' : ''}>{nombre(r.hors_seuil)}</Td>
              </Tr>
            );
          })}
        </Tableau>
      </CarteListe>
    </div>
  );
}
