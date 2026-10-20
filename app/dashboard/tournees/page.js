'use client';

/**
 * Tournées — le calendrier.
 *
 * Une semaine datée, navigable : chaque carte est une tournée d'un jour
 * précis, telle que `tournees_occurrences` la porte. Ce n'est plus un gabarit
 * hebdomadaire qu'on interprète — ce qui s'affiche ici existe en base, et se
 * modifie ou se retire jour par jour.
 *
 * La planification, elle, reste récurrente : une série fabrique ses jours
 * (voir ModalePlanification), et le calendrier en est le résultat.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Badge, BandeauErreur, Btn, Chip, PageHeader, Selecteur, cn, nombre } from '@/components/ui';
import { BandeauMetriques } from '@/components/liste';
import { IconPlus } from '@/components/icons';
import { cheminContexte, peutEcrire } from '@/lib/contexte';
import { useContexte } from '@/components/ContexteProvider';
import { FiltreCommuneRegion } from '@/components/FiltreCommuneRegion';
import { Realisation } from './Realisation';
import { nomsEquipe } from './ListeCollecteurs';
import { ModalePlanification } from './ModalePlanification';
import { ModaleOccurrence } from './ModaleOccurrence';
import { ajouterJours, isoLocal, jourCourt, libelleJours, lundiDe, semaineDe, titreSemaine } from './dates';

const OCCURRENCE = {
  planifiee: { ton: 'muted', libelle: 'Planifiée', pastille: 'bg-line2' },
  en_cours: { ton: 'vert', libelle: 'En cours', pastille: 'bg-green' },
  terminee: { ton: 'teal', libelle: 'Terminée', pastille: 'bg-teal' },
  non_faite: { ton: 'rouge', libelle: 'Non faite', pastille: 'bg-red' },
  suspendue: { ton: 'or', libelle: 'Suspendue', pastille: 'bg-gold' },
};

function heureCourte(h) {
  return h ? String(h).slice(0, 5) : '—';
}

/* ------------------------------------------------------------------ */
/* Carte d'une tournée du jour                                         */
/* ------------------------------------------------------------------ */

function CarteOccurrence({ o, rang, onOuvrir }) {
  const def = OCCURRENCE[o.statut] || OCCURRENCE.planifiee;
  const sansEquipe = (o.nb_collecteurs || 0) === 0;
  const avance = o.jour > isoLocal();

  return (
    <button
      type="button"
      onClick={function () { onOuvrir(o); }}
      className={cn(
        'lp-rise group w-full cursor-pointer rounded-xl border p-2.5 text-left outline-none transition-all duration-150',
        'hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-blue',
        o.statut === 'suspendue'
          ? 'border-dashed border-line bg-transparent opacity-70 hover:opacity-90'
          : 'border-line bg-panel hover:border-line2',
      )}
      style={{ animationDelay: `${Math.min(rang, 8) * 35}ms` }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[15px] leading-none font-bold text-txt tabular-nums">
          {heureCourte(o.heure_debut)}
        </span>
        <span
          aria-hidden
          className={cn('size-1.5 shrink-0 rounded-full', sansEquipe && avance ? 'bg-gold' : def.pastille)}
        />
      </div>

      <div className="font-display mt-1.5 truncate text-[14px] leading-tight font-bold text-txt">
        {o.quartier}
      </div>

      <div
        className={cn('mt-1 truncate text-[11px]', sansEquipe ? 'font-semibold text-gold' : 'text-muted')}
      >
        {sansEquipe ? 'Sans collecteur' : nomsEquipe(o.collecteurs_noms || [])}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {!avance || o.statut !== 'planifiee' ? (
          <span className={cn('text-[10px] font-semibold tracking-wide uppercase', `text-${def.ton === 'vert' ? 'green' : def.ton === 'or' ? 'gold' : def.ton === 'rouge' ? 'red' : def.ton === 'teal' ? 'teal' : 'muted2'}`)}>
            {def.libelle}
          </span>
        ) : null}
        {o.hors_serie ? <Badge ton="bleu">Rattrapage</Badge> : null}
        {o.equipe_modifiee ? <Badge ton="bleu">Équipe du jour</Badge> : null}
        {o.heure_du_jour ? <Badge ton="bleu">Heure</Badge> : null}
        {o.note ? <span className="truncate text-[10px] text-muted2">{o.note}</span> : null}
      </div>

      {(o.collectes || 0) + (o.absents || 0) + (o.inaccessibles || 0) > 0 ? (
        <div className="mt-1 font-mono text-[10.5px] text-muted2 tabular-nums">
          {nombre(o.collectes)} / {nombre(o.a_desservir)} collectés
        </div>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TourneesPage() {
  const { ctx } = useContexte();
  const router = useRouter();
  const peutModifier = peutEcrire(ctx);

  const [ancre, setAncre] = useState(function () { return lundiDe(isoLocal()); });
  const [occurrences, setOccurrences] = useState([]);
  const [series, setSeries] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [collecteurs, setCollecteurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [onglet, setOnglet] = useState('calendrier');
  const [filtreQuartier, setFiltreQuartier] = useState('');
  const [filtreCommune, setFiltreCommune] = useState('');

  const [planification, setPlanification] = useState(null); // le jour cliqué, ou ''
  const [ouverte, setOuverte] = useState(null); // l'occurrence ouverte

  const jours = useMemo(function () { return semaineDe(ancre); }, [ancre]);
  const aujourdhui = isoLocal();

  const charger = useCallback(async function () {
    const q = ctx?.communeId || ctx?.lectureCommuneId
      ? supabase.from('quartiers').select('id, nom, commune_id').eq('commune_id', ctx.lectureCommuneId || ctx.communeId).order('nom')
      : ctx?.pmeId
        ? supabase.from('pme_quartiers').select('quartiers!inner(id, nom, commune_id)').eq('pme_id', ctx.pmeId)
        : supabase.from('quartiers').select('id, nom, commune_id').order('nom');
    const qResult = await q;
    const quartiersAutorises = ctx?.pmeId
      ? (qResult.data || []).map(function (x) { return x.quartiers; })
      : qResult.data || [];
    const idsQuartiers = quartiersAutorises.map(function (x) { return x.id; });
    const aucun = idsQuartiers.length === 0 && ctx?.pmeId;
    const bornes = [ancre, ajouterJours(ancre, 6)];

    const [o, s, c] = await Promise.all([
      aucun
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from('tournees_realisation')
            .select('*')
            .gte('jour', bornes[0])
            .lte('jour', bornes[1])
            .order('jour')
            .order('heure_debut'),
      aucun
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from('tournees')
            .select('id, heure_debut, actif, quartier_id, jours_semaine, date_debut, date_fin, quartiers(nom), tournees_collecteurs(collecteur_id, profils(nom_complet))')
            .in('quartier_id', idsQuartiers.length ? idsQuartiers : ['00000000-0000-0000-0000-000000000000'])
            .eq('actif', true)
            .order('heure_debut'),
      ctx?.niveau === 'pme'
        ? supabase
            .from('profils')
            .select('id, nom_complet')
            .eq('role', 'collecteur')
            .eq('actif', true)
            .eq('pme_id', ctx.pmeId)
            .order('nom_complet')
        : supabase
            .from('profils')
            .select('id, nom_complet')
            .eq('role', 'collecteur')
            .eq('actif', true)
            .in(
              'pme_id',
              (await supabase.from('pme_quartiers').select('pme_id').in('quartier_id', idsQuartiers)).data?.map(function (x) {
                return x.pme_id;
              }) || ['00000000-0000-0000-0000-000000000000'],
            )
            .order('nom_complet'),
    ]);

    setChargement(false);
    if (o.error) {
      setErreur(`Impossible de charger le calendrier : ${o.error.message}`);
      return;
    }
    setErreur(null);
    setQuartiers(quartiersAutorises);
    setOccurrences(o.data || []);
    setSeries(s.data || []);
    setCollecteurs(c.data || []);
  }, [ctx, ancre]);

  useEffect(
    function () {
      // Chargement initial et à chaque semaine. Les setState n'ont lieu
      // qu'après l'await, donc sans rendu en cascade synchrone.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      charger();
    },
    [charger],
  );

  /* -- Filtres ------------------------------------------------------ */

  const quartiersFiltres = useMemo(
    function () {
      if (!filtreCommune) return quartiers;
      return quartiers.filter(function (q) { return q.commune_id === filtreCommune; });
    },
    [quartiers, filtreCommune],
  );

  const idsVisibles = useMemo(
    function () {
      return new Set(quartiersFiltres.map(function (q) { return q.id; }));
    },
    [quartiersFiltres],
  );

  const visibles = useMemo(
    function () {
      return occurrences.filter(function (o) {
        if (idsVisibles.size && !idsVisibles.has(o.quartier_id)) return false;
        if (filtreQuartier && o.quartier_id !== filtreQuartier) return false;
        return true;
      });
    },
    [occurrences, filtreQuartier, idsVisibles],
  );

  const parJour = useMemo(
    function () {
      const map = new Map(jours.map(function (j) { return [j, []]; }));
      visibles.forEach(function (o) {
        map.get(o.jour)?.push(o);
      });
      return map;
    },
    [visibles, jours],
  );

  const bilan = useMemo(
    function () {
      const passees = visibles.filter(function (o) { return o.jour <= aujourdhui; });
      return {
        total: visibles.length,
        terminees: passees.filter(function (o) { return o.statut === 'terminee'; }).length,
        nonFaites: passees.filter(function (o) { return o.statut === 'non_faite'; }).length,
        suspendues: visibles.filter(function (o) { return o.statut === 'suspendue'; }).length,
        sansEquipe: visibles.filter(function (o) {
          return (o.nb_collecteurs || 0) === 0 && o.jour >= aujourdhui;
        }).length,
        collectes: visibles.reduce(function (a, o) { return a + (o.collectes || 0); }, 0),
        aDesservir: passees.reduce(function (a, o) { return a + (o.a_desservir || 0); }, 0),
        passees: passees.length,
      };
    },
    [visibles, aujourdhui],
  );

  const serieDe = useCallback(
    function (tourneeId) {
      return series.find(function (s) { return s.id === tourneeId; }) || null;
    },
    [series],
  );

  /* -- Rendu -------------------------------------------------------- */

  const semaineCourante = ancre === lundiDe(aujourdhui);

  return (
    <div className="w-full">
      <PageHeader
        kicker="Terrain · Calendrier des tournées"
        titre="Tournées de collecte"
        sousTitre="Chaque jour, ce qui est prévu et ce qui s’est passé. Une tournée se modifie ou se retire jour par jour ; la planification, elle, se fait par série."
        actions={
          <>
            <Btn variant="ghost" onClick={function () { window.print(); }}>Imprimer</Btn>
            {peutModifier ? (
              <Btn variant="green" onClick={function () { setPlanification(aujourdhui); }}>
                <IconPlus className="size-4" />
                Planifier une tournée
              </Btn>
            ) : null}
          </>
        }
      />

      <BandeauErreur message={erreur} onReessayer={charger} />

      <BandeauMetriques
        metriques={[
          {
            label: 'Tournées cette semaine',
            valeur: chargement ? '—' : nombre(bilan.total),
            sous: `${nombre(bilan.suspendues)} suspendue${bilan.suspendues > 1 ? 's' : ''}`,
            ton: 'teal',
          },
          {
            label: 'Réalisées',
            valeur: chargement ? '—' : bilan.passees ? `${Math.round((bilan.terminees / bilan.passees) * 100)} %` : '—',
            sous: `${nombre(bilan.terminees)} sur ${nombre(bilan.passees)} jours écoulés`,
            ton: bilan.passees && bilan.terminees / bilan.passees >= 0.9 ? 'teal' : bilan.passees ? 'or' : 'defaut',
          },
          {
            label: 'Non faites',
            valeur: chargement ? '—' : nombre(bilan.nonFaites),
            sous: bilan.nonFaites > 0 ? 'Aucun pointage ce jour-là' : 'Rien d’oublié',
            ton: bilan.nonFaites > 0 ? 'rouge' : 'defaut',
          },
          {
            label: 'Sans collecteur',
            valeur: chargement ? '—' : nombre(bilan.sansEquipe),
            sous: bilan.sansEquipe > 0 ? 'À affecter — ne partiront pas' : 'Toutes affectées',
            ton: bilan.sansEquipe > 0 ? 'rouge' : 'defaut',
          },
        ]}
      />

      {/* Onglets : le calendrier, ou le bilan d'une période. */}
      <div
        className="no-print lp-rise mt-6 flex flex-wrap items-center gap-2"
        style={{ animationDelay: '50ms' }}
        role="tablist"
        aria-label="Vue"
      >
        <Chip actif={onglet === 'calendrier'} role="tab" aria-selected={onglet === 'calendrier'} onClick={function () { setOnglet('calendrier'); }}>
          Calendrier
        </Chip>
        <Chip actif={onglet === 'bilan'} role="tab" aria-selected={onglet === 'bilan'} onClick={function () { setOnglet('bilan'); }}>
          Bilan
        </Chip>
      </div>

      {onglet === 'bilan' ? (
        <Realisation ctx={ctx} quartiersAutorises={quartiersFiltres} />
      ) : null}

      {/* Barre de navigation de la semaine */}
      <div
        className={cn('no-print lp-rise mt-4 flex flex-wrap items-center gap-2', onglet !== 'calendrier' && 'hidden')}
        style={{ animationDelay: '60ms' }}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Semaine précédente"
            onClick={function () { setAncre(ajouterJours(ancre, -7)); }}
            className="grid size-8 cursor-pointer place-items-center rounded-lg border border-line2 text-muted outline-none transition-colors hover:bg-panel2 hover:text-txt focus-visible:ring-2 focus-visible:ring-blue"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Semaine suivante"
            onClick={function () { setAncre(ajouterJours(ancre, 7)); }}
            className="grid size-8 cursor-pointer place-items-center rounded-lg border border-line2 text-muted outline-none transition-colors hover:bg-panel2 hover:text-txt focus-visible:ring-2 focus-visible:ring-blue"
          >
            ›
          </button>
        </div>
        <h2 className="font-display m-0 text-[15px] font-bold text-txt">{titreSemaine(ancre)}</h2>
        {!semaineCourante ? (
          <Btn variant="ghost" onClick={function () { setAncre(lundiDe(aujourdhui)); }}>
            Aujourd’hui
          </Btn>
        ) : (
          <Badge ton="teal">Semaine en cours</Badge>
        )}

        <div className="flex-1" />

        <FiltreCommuneRegion
          ctx={ctx}
          valeur={filtreCommune}
          onChange={function (v) { setFiltreCommune(v); setFiltreQuartier(''); }}
        />
        <Selecteur
          value={filtreQuartier}
          aria-label="Filtrer par quartier"
          onChange={function (e) { setFiltreQuartier(e.target.value); }}
        >
          <option value="">Tous les quartiers</option>
          {quartiersFiltres.map(function (q) {
            return <option key={q.id} value={q.id}>{q.nom}</option>;
          })}
        </Selecteur>
      </div>

      {/* La semaine */}
      <div
        className={cn('lp-rise mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7', onglet !== 'calendrier' && 'hidden')}
        style={{ animationDelay: '100ms' }}
      >
        {jours.map(function (j) {
          const duJour = parJour.get(j) ?? [];
          const cJour = j === aujourdhui;
          const passe = j < aujourdhui;
          return (
            <section
              key={j}
              className={cn(
                'flex min-h-[220px] flex-col rounded-xl border p-2.5',
                cJour ? 'border-line2 bg-panel/40' : 'border-line',
                passe && 'opacity-80',
              )}
            >
              <header className="mb-2.5 flex items-center justify-between gap-2 border-b border-line pb-2">
                <div className="min-w-0">
                  <h3
                    className={cn(
                      'm-0 truncate text-[11px] tracking-[1.8px] uppercase',
                      cJour ? 'font-semibold text-green' : 'text-muted',
                    )}
                  >
                    {jourCourt(j)}
                  </h3>
                  {cJour ? (
                    <span className="mt-0.5 block text-[9px] tracking-[1.4px] text-muted2 uppercase">
                      Aujourd&apos;hui
                    </span>
                  ) : null}
                </div>
                <span className="font-mono text-[11px] font-bold text-muted2 tabular-nums">
                  {duJour.length}
                </span>
              </header>

              <div className="flex min-h-0 flex-1 flex-col gap-2">
                {duJour.length === 0 ? (
                  <p className="m-0 py-4 text-center text-[11px] text-muted2">Aucun passage</p>
                ) : (
                  duJour.map(function (o, rang) {
                    return (
                      <CarteOccurrence
                        key={o.occurrence_id}
                        o={o}
                        rang={rang}
                        onOuvrir={peutModifier ? setOuverte : function () {
                          router.push(cheminContexte(`/dashboard/tournees/${o.tournee_id}`, ctx));
                        }}
                      />
                    );
                  })
                )}
              </div>

              {peutModifier ? (
                <button
                  type="button"
                  onClick={function () { setPlanification(j); }}
                  className="no-print mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-1.5 text-[11px] text-muted2 outline-none transition-colors hover:border-line2 hover:text-muted focus-visible:ring-2 focus-visible:ring-blue"
                >
                  <IconPlus className="size-3" />
                  Planifier
                </button>
              ) : null}
            </section>
          );
        })}
      </div>

      {/* Les séries, pour atteindre leur fiche : le calendrier montre des jours,
          pas la règle qui les produit. */}
      <section className={cn('lp-rise mt-8', onglet !== 'calendrier' && 'hidden')} style={{ animationDelay: '140ms' }}>
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2.5">
          <h2 className="m-0 text-[11px] tracking-[2.4px] text-muted uppercase">
            Tournées planifiées · {nombre(series.filter(function (s) { return !filtreQuartier || s.quartier_id === filtreQuartier; }).length)}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {series
            .filter(function (s) {
              if (idsVisibles.size && !idsVisibles.has(s.quartier_id)) return false;
              if (filtreQuartier && s.quartier_id !== filtreQuartier) return false;
              return true;
            })
            .map(function (s) {
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={function () { router.push(cheminContexte(`/dashboard/tournees/${s.id}`, ctx)); }}
                  className="cursor-pointer rounded-xl border border-line bg-panel px-3 py-2 text-left outline-none transition-colors hover:border-line2 focus-visible:ring-2 focus-visible:ring-blue"
                >
                  <span className="font-mono text-[12px] font-bold text-txt tabular-nums">
                    {heureCourte(s.heure_debut)}
                  </span>
                  <span className="ml-2 text-[12.5px] font-semibold text-txt">
                    {s.quartiers?.nom || 'Quartier supprimé'}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted2">
                    {libelleJours(s.jours_semaine)}
                    {s.date_fin ? ` · jusqu’au ${s.date_fin}` : ' · sans fin'}
                  </span>
                </button>
              );
            })}
          {series.length === 0 && !chargement ? (
            <p className="m-0 py-2 text-[12.5px] text-muted2">
              Aucune tournée planifiée sur ce périmètre.
            </p>
          ) : null}
        </div>
      </section>

      {/* Modales */}
      {peutModifier ? (
        <ModalePlanification
          ouvert={planification !== null}
          jour={planification || ''}
          quartiers={quartiersFiltres}
          collecteurs={collecteurs}
          series={series}
          onFermer={function () { setPlanification(null); }}
          onFait={function () { setPlanification(null); charger(); }}
        />
      ) : null}

      {peutModifier && ouverte ? (
        <ModaleOccurrence
          occurrence={ouverte}
          serie={serieDe(ouverte.tournee_id)}
          collecteurs={collecteurs}
          passee={ouverte.jour < aujourdhui}
          onFermer={function () { setOuverte(null); }}
          onFait={function () { setOuverte(null); charger(); }}
        />
      ) : null}
    </div>
  );
}
