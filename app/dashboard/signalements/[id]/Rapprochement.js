'use client';

/**
 * Collecte manquée : ce que dit le pointage.
 *
 * Un habitant dit qu'on n'est pas passé ; le collecteur a peut-être pointé.
 * Ce bloc met les deux en face : les passages pointés chez ce foyer autour
 * de la date du signalement, avec l'heure, le motif, l'écart GPS — et
 * l'état de la tournée du quartier ce jour-là. La mairie tranche en un
 * clic, et sa décision est motivée par des faits horodatés.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge, Bloc, Btn, heure, nombre } from '@/components/ui';

const STATUTS = {
  effectue: { ton: 'teal', libelle: 'Effectué' },
  absent: { ton: 'or', libelle: 'Absent' },
  inaccessible: { ton: 'rouge', libelle: 'Inaccessible' },
};

const MOTIFS = {
  bac_non_sorti: 'bac non sorti',
  acces_ferme: 'accès fermé',
  rue_bloquee: 'rue bloquée',
  autre: 'autre motif',
};

const OCCURRENCE = {
  planifiee: 'planifiée, jamais démarrée',
  en_cours: 'en cours',
  terminee: 'terminée',
  non_faite: 'non faite',
  suspendue: 'suspendue',
};

function isoLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dateLisible(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function Rapprochement({ signalement, ouvert, enCours, onDecider }) {
  const [etat, setEtat] = useState({ chargement: true, foyer: null, passages: [], tournees: [], jour: null });

  const auteurId = signalement?.auteur_id;
  const type = signalement?.type_signalement;
  const creeLe = signalement?.created_at;

  useEffect(
    function () {
      if (type !== 'collecte_manquee' || !auteurId || !creeLe) return undefined;
      let vivant = true;

      async function lire() {
        const jour = isoLocal(new Date(creeLe));
        const veille = isoLocal(new Date(new Date(creeLe).getTime() - 86_400_000));

        const { data: foyer } = await supabase
          .from('menages')
          .select('id, code_menage, point_repere, quartier_id, quartiers(nom)')
          .eq('proprietaire_id', auteurId)
          .maybeSingle();

        if (!vivant) return;
        if (!foyer) {
          setEtat({ chargement: false, foyer: null, passages: [], tournees: [], jour });
          return;
        }

        const [p, t] = await Promise.all([
          supabase
            .from('passages_detail')
            .select('id, statut, motif, pointe_a, jour_local, ecart_m, hors_seuil, sans_position, collecteur, corrige_a')
            .eq('menage_id', foyer.id)
            .gte('jour_local', veille)
            .lte('jour_local', jour)
            .order('pointe_a', { ascending: false }),
          supabase
            .from('tournees_realisation')
            .select('occurrence_id, jour, heure_debut, statut, debut_at, fin_at, collecteurs, collectes, a_desservir')
            .eq('quartier_id', foyer.quartier_id)
            .gte('jour', veille)
            .lte('jour', jour)
            .order('jour', { ascending: false })
            .order('heure_debut'),
        ]);

        if (!vivant) return;
        setEtat({ chargement: false, foyer, passages: p.data || [], tournees: t.data || [], jour });
      }

      lire();
      return function () { vivant = false; };
    },
    [type, auteurId, creeLe],
  );

  if (type !== 'collecte_manquee') return null;

  const { chargement, foyer, passages, tournees, jour } = etat;
  const duJour = passages.filter((p) => p.jour_local === jour);
  const collecte = duJour.find((p) => p.statut === 'effectue');
  const nonCollecte = duJour.find((p) => p.statut !== 'effectue');

  function decider(statut) {
    let message;
    if (statut === 'rejete' && collecte) {
      message = `Passage pointé « effectué » le ${dateLisible(jour)} à ${heure(collecte.pointe_a)} par ${collecte.collecteur || 'le collecteur'}`
        + (collecte.ecart_m != null ? `, à ${nombre(collecte.ecart_m)} m du foyer` : '')
        + '.';
    } else if (statut === 'resolu' && nonCollecte) {
      message = `Le collecteur a pointé « ${STATUTS[nonCollecte.statut]?.libelle.toLowerCase()} »`
        + (nonCollecte.motif ? ` (${MOTIFS[nonCollecte.motif] || nonCollecte.motif})` : '')
        + ` le ${dateLisible(jour)} à ${heure(nonCollecte.pointe_a)}. Manquement reconnu, transmis à la PME.`;
    } else {
      message = `Aucun passage pointé chez ce foyer le ${dateLisible(jour)}. Manquement reconnu, transmis à la PME.`;
    }
    onDecider(statut, message);
  }

  return (
    <Bloc titre="Ce que dit le pointage">
      {chargement ? (
        <p className="m-0 text-[12.5px] text-muted2">Recherche du foyer et de ses passages…</p>
      ) : !foyer ? (
        <p className="m-0 text-[12.5px] text-muted2">
          L’auteur de ce signalement n’a pas de foyer déclaré : aucun pointage ne peut lui être rapproché.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-[12.5px] text-muted">
            Foyer <span className="font-mono tabular-nums text-txt">{foyer.code_menage}</span>
            {' · '}{foyer.point_repere}{' · '}{foyer.quartiers?.nom}
            {' — '}signalé le {dateLisible(jour)}.
          </p>

          {duJour.length === 0 ? (
            <p className="m-0 rounded-lg border border-line bg-panel2 px-4 py-3 text-[13px] text-txt">
              <strong>Aucun passage pointé</strong> chez ce foyer ce jour-là.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {duJour.map(function (p) {
                const def = STATUTS[p.statut] || { ton: 'muted', libelle: p.statut };
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel2 px-4 py-3 text-[13px]">
                    <Badge ton={def.ton}>{def.libelle}</Badge>
                    <span className="font-mono tabular-nums text-txt">{heure(p.pointe_a)}</span>
                    {p.motif ? <span className="text-muted">{MOTIFS[p.motif] || p.motif}</span> : null}
                    <span className="text-muted">par {p.collecteur || 'collecteur inconnu'}</span>
                    {p.sans_position ? (
                      <Badge ton="muted">sans position</Badge>
                    ) : p.ecart_m != null ? (
                      <Badge ton={p.hors_seuil ? 'or' : 'teal'}>à {nombre(p.ecart_m)} m du foyer</Badge>
                    ) : null}
                    {p.corrige_a ? <Badge ton="bleu">corrigé</Badge> : null}
                  </li>
                );
              })}
            </ul>
          )}

          {tournees.length ? (
            <p className="m-0 text-[12.5px] text-muted2">
              Tournée{tournees.length > 1 ? 's' : ''} du quartier :{' '}
              {tournees.map(function (t) {
                return `${t.jour === jour ? '' : 'veille, '}${String(t.heure_debut).slice(0, 5)} ${OCCURRENCE[t.statut] || t.statut}`
                  + (t.debut_at ? ` (départ ${heure(t.debut_at)})` : '')
                  + ` · ${nombre(t.collectes)}/${nombre(t.a_desservir)} collectés`;
              }).join(' ; ')}.
            </p>
          ) : (
            <p className="m-0 text-[12.5px] text-muted2">Aucune tournée planifiée dans ce quartier ce jour-là.</p>
          )}

          {ouvert ? (
            <div className="flex flex-wrap gap-2">
              {collecte ? (
                <Btn variant="green" disabled={enCours} onClick={function () { decider('rejete'); }}>
                  Collecte confirmée par le pointage
                </Btn>
              ) : null}
              <Btn variant="ghost" disabled={enCours} onClick={function () { decider('resolu'); }}>
                Manquement reconnu
              </Btn>
            </div>
          ) : null}
        </div>
      )}
    </Bloc>
  );
}
