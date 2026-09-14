'use client';

/**
 * Les tournées réalisées : ce qui était prévu, ce qui est parti, quand, et
 * ce qui a été collecté. Alimenté par la vue `tournees_realisation` et la
 * table `tournees_occurrences`.
 *
 * Deux usages :
 *   - gérer un jour : désigner un remplaçant, suspendre une tournée (férié,
 *     panne), rétablir ;
 *   - lire une période : taux de réalisation, retards, non faites.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge, Btn, Champ, Chip, Modal, Selecteur, nombre, heure } from '@/components/ui';
import { BandeauMetriques, CarteListe, Tableau, Tr, Td } from '@/components/liste';
import { peutEcrire } from '@/lib/contexte';

const OCCURRENCE = {
  planifiee: { ton: 'muted', libelle: 'Planifiée' },
  en_cours: { ton: 'vert', libelle: 'En cours' },
  terminee: { ton: 'teal', libelle: 'Terminée' },
  non_faite: { ton: 'rouge', libelle: 'Non faite' },
  suspendue: { ton: 'or', libelle: 'Suspendue' },
};

const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

function isoLocal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function jourIso(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const j = d.getDay();
  return j === 0 ? 7 : j;
}

function dateLisible(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return `${JOURS_COURTS[d.getDay()]} ${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function retardLisible(min) {
  if (min == null) return '—';
  if (Math.abs(min) < 5) return 'à l’heure';
  return min > 0 ? `+${min} min` : `${min} min`;
}

export function Realisation({ ctx, tournees, collecteurs, quartiersAutorises }) {
  const [jour, setJour] = useState(isoLocal());
  const [periode, setPeriode] = useState(14);
  const [historique, setHistorique] = useState([]);
  const [duJour, setDuJour] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [cible, setCible] = useState(null);         // { tournee, occurrence }
  const [remplacant, setRemplacant] = useState('');
  const [note, setNote] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  const idsQuartiers = useMemo(
    () => new Set((quartiersAutorises || []).map((q) => q.id)),
    [quartiersAutorises],
  );

  const charger = useCallback(async function () {
    setChargement(true);
    const depuis = new Date();
    depuis.setDate(depuis.getDate() - periode);

    const [h, j] = await Promise.all([
      supabase
        .from('tournees_realisation')
        .select('*')
        .gte('jour', isoLocal(depuis))
        .lte('jour', isoLocal())
        .order('jour', { ascending: false })
        .order('heure_debut'),
      supabase
        .from('tournees_realisation')
        .select('*')
        .eq('jour', jour),
    ]);

    setChargement(false);
    if (h.error || j.error) {
      setErreur(`Impossible de lire la réalisation : ${(h.error || j.error).message}`);
      return;
    }
    setErreur(null);
    setHistorique((h.data || []).filter((r) => idsQuartiers.size === 0 || idsQuartiers.has(r.quartier_id)));
    setDuJour(j.data || []);
  }, [jour, periode, idsQuartiers]);

  useEffect(function () {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  // Les tournées du jour choisi : le planning du jour de semaine, fusionné
  // avec les occurrences qui existent déjà (elles n'existent qu'à partir de
  // la nuit précédente, ou dès qu'on agit dessus).
  const lignesDuJour = useMemo(function () {
    const js = jourIso(jour);
    const occurrences = new Map(duJour.map((o) => [o.tournee_id, o]));
    return (tournees || [])
      .filter((t) => t.actif && t.jour_semaine === js)
      .filter((t) => idsQuartiers.size === 0 || idsQuartiers.has(t.quartier_id))
      .map((t) => ({ tournee: t, occurrence: occurrences.get(t.id) || null }))
      .sort((a, b) => String(a.tournee.heure_debut).localeCompare(String(b.tournee.heure_debut)));
  }, [tournees, duJour, jour, idsQuartiers]);

  // Indicateurs de période : seules les journées passées comptent.
  const bilan = useMemo(function () {
    const passees = historique.filter((r) => r.jour < isoLocal() || ['terminee', 'non_faite', 'suspendue'].includes(r.statut));
    const total = passees.length;
    const faites = passees.filter((r) => r.statut === 'terminee' || r.statut === 'en_cours').length;
    const nonFaites = passees.filter((r) => r.statut === 'non_faite').length;
    const suspendues = passees.filter((r) => r.statut === 'suspendue').length;
    const retards = passees.filter((r) => r.retard_min != null).map((r) => r.retard_min);
    const retardMoyen = retards.length ? Math.round(retards.reduce((a, b) => a + b, 0) / retards.length) : null;
    const collectes = passees.reduce((a, r) => a + (r.collectes || 0), 0);
    const aDesservir = passees.reduce((a, r) => a + (r.a_desservir || 0), 0);
    const horsSeuil = passees.reduce((a, r) => a + (r.hors_seuil || 0), 0);
    return { total, faites, nonFaites, suspendues, retardMoyen, collectes, aDesservir, horsSeuil };
  }, [historique]);

  function ouvrir(ligne) {
    setCible(ligne);
    setRemplacant(ligne.occurrence?.remplacant ? ligne.occurrence.collecteur_id : '');
    setNote(ligne.occurrence?.note || '');
  }

  async function enregistrer(statut) {
    if (!cible) return;
    setEnregistrement(true);
    const ligne = {
      tournee_id: cible.tournee.id,
      jour,
      collecteur_id: remplacant || null,
      note: note.trim() || null,
    };
    if (statut) ligne.statut = statut;
    const { error } = await supabase
      .from('tournees_occurrences')
      .upsert(ligne, { onConflict: 'tournee_id,jour' });
    setEnregistrement(false);
    if (error) {
      setErreur(`Enregistrement refusé : ${error.message}`);
      return;
    }
    setCible(null);
    charger();
  }

  const aujourdhui = isoLocal();

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
            sous: 'Par rapport à l’heure planifiée',
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
        titre="Gérer un jour"
        sousTitre="Remplaçant, suspension, note. Le collecteur voit le changement dans son application."
        outils={
          <Champ
            type="date"
            value={jour}
            aria-label="Jour"
            onChange={function (e) { setJour(e.target.value); }}
          />
        }
      >
        <Tableau
          colonnes={[
            { cle: 'heure', label: 'Heure' },
            { cle: 'quartier', label: 'Quartier' },
            { cle: 'collecteur', label: 'Collecteur' },
            { cle: 'tat', label: 'État' },
            { cle: 'dpart', label: 'Départ' },
            { cle: 'collects', label: 'Collectés', align: 'right' },
            { cle: 'action', label: '' },
          ]}
          vide="Aucune tournée planifiée ce jour-là."
        >
          {lignesDuJour.map(function ({ tournee, occurrence }, i) {
            const statut = occurrence?.statut || 'planifiee';
            const def = OCCURRENCE[statut] || OCCURRENCE.planifiee;
            return (
              <Tr key={tournee.id} rang={i}>
                <Td mono>{String(tournee.heure_debut).slice(0, 5)}</Td>
                <Td fort>{tournee.quartiers?.nom || '—'}</Td>
                <Td>
                  {occurrence?.collecteur || tournee.profils?.nom_complet || <span className="text-red">Sans collecteur</span>}
                  {occurrence?.remplacant ? <Badge ton="bleu" className="ml-2">Remplaçant</Badge> : null}
                </Td>
                <Td>
                  <Badge ton={def.ton}>{def.libelle}</Badge>
                  {occurrence?.note ? <span className="ml-2 text-[12px] text-muted2">{occurrence.note}</span> : null}
                </Td>
                <Td mono>
                  {occurrence?.debut_at ? `${heure(occurrence.debut_at)} · ${retardLisible(occurrence.retard_min)}` : '—'}
                </Td>
                <Td align="right" mono>
                  {occurrence ? `${nombre(occurrence.collectes)} / ${nombre(occurrence.a_desservir)}` : '—'}
                </Td>
                <Td align="right">
                  {peutEcrire(ctx) ? (
                    <Btn variant="ghost" onClick={function () { ouvrir({ tournee, occurrence }); }}>
                      Gérer
                    </Btn>
                  ) : null}
                </Td>
              </Tr>
            );
          })}
        </Tableau>
      </CarteListe>

      <CarteListe
        titre="Historique"
        sousTitre="Chaque tournée de chaque jour, la plus récente en premier."
        chips={[7, 14, 30].map(function (n) {
          return (
            <Chip key={n} actif={periode === n} onClick={function () { setPeriode(n); }}>
              {n} jours
            </Chip>
          );
        })}
      >
        <Tableau
          colonnes={[
            { cle: 'jour', label: 'Jour' },
            { cle: 'heure', label: 'Heure' },
            { cle: 'quartier', label: 'Quartier' },
            { cle: 'collecteur', label: 'Collecteur' },
            { cle: 'tat', label: 'État' },
            { cle: 'dpart', label: 'Départ' },
            { cle: 'collects', label: 'Collectés', align: 'right' },
            { cle: 'absents', label: 'Absents', align: 'right' },
            { cle: 'horsseuil', label: 'Hors seuil', align: 'right' },
          ]}
          vide={chargement ? 'Chargement…' : 'Aucune tournée sur la période.'}
        >
          {historique.map(function (r, i) {
            const def = OCCURRENCE[r.statut] || OCCURRENCE.planifiee;
            const futur = r.jour > aujourdhui;
            return (
              <Tr key={r.occurrence_id} rang={i}>
                <Td mono>{dateLisible(r.jour)}</Td>
                <Td mono>{String(r.heure_debut).slice(0, 5)}</Td>
                <Td fort>{r.quartier}</Td>
                <Td>
                  {r.collecteur || <span className="text-red">Sans collecteur</span>}
                  {r.remplacant ? <Badge ton="bleu" className="ml-2">Remplaçant</Badge> : null}
                </Td>
                <Td><Badge ton={futur ? 'muted' : def.ton}>{futur ? 'À venir' : def.libelle}</Badge></Td>
                <Td mono>{r.debut_at ? `${heure(r.debut_at)} · ${retardLisible(r.retard_min)}` : '—'}</Td>
                <Td align="right" mono>{nombre(r.collectes)} / {nombre(r.a_desservir)}</Td>
                <Td align="right" mono>{nombre(r.absents + r.inaccessibles)}</Td>
                <Td align="right" mono className={r.hors_seuil > 0 ? 'text-gold' : ''}>{nombre(r.hors_seuil)}</Td>
              </Tr>
            );
          })}
        </Tableau>
      </CarteListe>

      <Modal
        ouvert={Boolean(cible)}
        onFermer={function () { setCible(null); }}
        titre={cible ? `${cible.tournee.quartiers?.nom || 'Tournée'} · ${dateLisible(jour)} · ${String(cible.tournee.heure_debut).slice(0, 5)}` : ''}
        sousTitre="Ce que vous décidez ici ne vaut que pour ce jour. Le planning hebdomadaire ne change pas."
        pied={
          <>
            <Btn variant="ghost" onClick={function () { setCible(null); }}>Annuler</Btn>
            {cible?.occurrence?.statut === 'suspendue' ? (
              <Btn variant="green" disabled={enregistrement} onClick={function () { enregistrer('planifiee'); }}>
                Rétablir la tournée
              </Btn>
            ) : (
              <Btn variant="ghost" disabled={enregistrement} onClick={function () { enregistrer('suspendue'); }}>
                Suspendre ce jour
              </Btn>
            )}
            <Btn variant="green" disabled={enregistrement} onClick={function () { enregistrer(null); }}>
              {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Collecteur ce jour</span>
            <Selecteur value={remplacant} onChange={function (e) { setRemplacant(e.target.value); }}>
              <option value="">{cible?.tournee.profils?.nom_complet ? `${cible.tournee.profils.nom_complet} (titulaire)` : 'Titulaire du planning'}</option>
              {(collecteurs || [])
                .filter((c) => c.id !== cible?.tournee.collecteur_id)
                .map(function (c) {
                  return <option key={c.id} value={c.id}>{c.nom_complet}</option>;
                })}
            </Selecteur>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Note (visible par le collecteur)</span>
            <Champ
              value={note}
              placeholder="Jour férié, panne de charrette, agent absent…"
              onChange={function (e) { setNote(e.target.value); }}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
