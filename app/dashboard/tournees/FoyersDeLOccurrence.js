'use client';

/**
 * Les foyers d'une tournée, un jour donné, avec ce qu'il est advenu de chacun.
 *
 * Replié par défaut : on ouvre la modale d'un jour pour régler une heure ou
 * une équipe neuf fois sur dix, et un quartier compte des centaines de foyers.
 * La liste ne se charge qu'au premier dépli.
 *
 * Un foyer sans pointage n'a pas le même sens selon la date. Aujourd'hui ou
 * demain, il reste à faire. Hier, personne n'y est passé : c'est un manqué, et
 * c'est le seul endroit du back-office où cela se voit foyer par foyer.
 * Sauf si la tournée était suspendue ce jour-là — alors il n'y a rien à
 * reprocher à personne, et le dire serait faux.
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge, heure, nombre } from '@/components/ui';
import { IconChevronBas } from '@/components/icons';

const STATUTS = {
  effectue: { label: 'Effectué', ton: 'teal' },
  absent: { label: 'Absent', ton: 'or' },
  inaccessible: { label: 'Inaccessible', ton: 'rouge' },
};

const MOTIFS = {
  bac_non_sorti: 'Bac non sorti',
  acces_ferme: 'Accès fermé',
  rue_bloquee: 'Rue bloquée',
  autre: 'Autre motif',
};

/** L'état d'un foyer : son pointage, ou ce que son absence veut dire ce jour-là. */
function etat(foyer, passee, suspendue) {
  if (foyer.statut) return STATUTS[foyer.statut] || { label: foyer.statut, ton: 'muted' };
  if (suspendue) return { label: 'Non desservi', ton: 'muted' };
  return passee ? { label: 'Manqué', ton: 'rouge' } : { label: 'À faire', ton: 'muted' };
}

/** Ce que veut dire un foyer sans pointage, au pluriel près. */
function motRestant(n, passee, suspendue) {
  if (suspendue) return n > 1 ? 'non desservis' : 'non desservi';
  if (passee) return n > 1 ? 'manqués' : 'manqué';
  return 'à faire';
}

export function FoyersDeLOccurrence({ tourneeId, jour, passee, suspendue }) {
  const [ouvert, setOuvert] = useState(false);
  const [foyers, setFoyers] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function basculer() {
    const futur = !ouvert;
    setOuvert(futur);
    if (!futur || foyers || chargement) return;

    setChargement(true);
    const { data, error } = await supabase.rpc('foyers_de_tournee', {
      p_tournee_id: tourneeId,
      p_jour: jour,
    });
    setChargement(false);
    if (error) {
      setErreur(`Impossible de lire les foyers : ${error.message}`);
      return;
    }
    setErreur(null);
    setFoyers(data || []);
  }

  const liste = foyers || [];
  const pointes = liste.filter(function (f) { return f.statut; });
  const collectes = pointes.filter(function (f) { return f.statut === 'effectue'; }).length;
  const nonCollectes = pointes.length - collectes;
  const restants = liste.length - pointes.length;

  // Le compte se dit « sur N foyers » et non « N / N » : le bandeau de la
  // modale, lui, compte les foyers *abonnes* -- c'est ce que la tournee doit
  // desservir. Ici on liste tout le quartier, non-abonnes compris, comme le
  // collecteur les voit. Deux totaux differents cote a cote passeraient pour
  // une erreur si l'on ne disait pas lequel on compte.
  const resume = [
    `${nombre(collectes)} collecté${collectes > 1 ? 's' : ''} sur ${nombre(liste.length)} foyers`,
    nonCollectes > 0 ? `${nombre(nonCollectes)} non collecté${nonCollectes > 1 ? 's' : ''}` : null,
    restants > 0 ? `${nombre(restants)} ${motRestant(restants, passee, suspendue)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-line">
      <button
        type="button"
        onClick={basculer}
        aria-expanded={ouvert}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-3 text-left outline-none transition-colors hover:bg-panel focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-inset"
      >
        <IconChevronBas
          className={`size-4 shrink-0 text-muted transition-transform duration-150 ${ouvert ? '' : '-rotate-90'}`}
        />
        <span className="text-[12.5px] font-semibold text-txt">Foyers concernés</span>
        {foyers ? (
          <span className="font-mono text-[11px] text-muted2 tabular-nums">{nombre(liste.length)}</span>
        ) : null}
        <span className="flex-1" />
        {foyers && liste.length ? (
          <span className="font-mono text-[11px] text-muted2 tabular-nums">{resume}</span>
        ) : null}
      </button>

      {ouvert ? (
        <div className="border-t border-line">
          {chargement ? (
            <p className="m-0 px-3.5 py-4 text-[12px] text-muted2">Chargement des foyers…</p>
          ) : erreur ? (
            <p className="m-0 px-3.5 py-4 text-[12.5px] text-red">{erreur}</p>
          ) : !liste.length ? (
            <p className="m-0 px-3.5 py-4 text-[12px] text-muted2">
              Aucun foyer actif dans ce quartier.
            </p>
          ) : (
            <ul className="m-0 max-h-[340px] list-none overflow-y-auto p-0">
              {liste.map(function (foyer) {
                const def = etat(foyer, passee, suspendue);
                return (
                  <li
                    key={foyer.menage_id}
                    className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0"
                  >
                    <span className="font-mono text-[12px] font-semibold text-txt tabular-nums">
                      {foyer.code_menage}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
                      {foyer.point_repere || 'Sans repère'}
                      {foyer.abonne ? null : (
                        <span className="ml-2 text-[11px] text-muted2">· non abonné</span>
                      )}
                    </span>
                    {foyer.motif ? (
                      <span className="hidden text-[11px] text-muted2 sm:inline">
                        {MOTIFS[foyer.motif] || foyer.motif}
                      </span>
                    ) : null}
                    {foyer.pointe_a ? (
                      <span className="hidden font-mono text-[11px] text-muted2 tabular-nums sm:inline">
                        {heure(foyer.pointe_a)}
                      </span>
                    ) : null}
                    <Badge ton={def.ton}>{def.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
