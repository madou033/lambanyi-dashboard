'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useContexte } from '@/components/ContexteProvider';
import { peutEcrire } from '@/lib/contexte';
import {
  Badge,
  BandeauErreur,
  Bloc,
  Compteur,
  PageHeader,
  BadgeStatut,
  cn,
  couleurTon,
  ilYA,
  montant,
  nombre,
  tonStatut,
} from '@/components/ui';
import { BarreEmpilee, BarresActivite, BarresReparties, Donut, Jauge } from '@/components/graphes';
import { ICONES_ACTION, SECTIONS_NAV } from '@/lib/navigation';
import { IconAlerte, IconCamion } from '@/components/icons';
import { estEnRetard } from '@/lib/signalements';

/* ------------------------------------------------------------------ */
/* Agrégations temporelles                                             */
/* ------------------------------------------------------------------ */

/** Compte les événements par tranche d'une heure, du plus ancien au plus récent. */
function comptesParHeure(dates, heures) {
  const buckets = new Array(heures).fill(0);
  const maintenant = Date.now();
  for (const date of dates) {
    const ecart = Math.floor((maintenant - new Date(date).getTime()) / 3_600_000);
    if (ecart >= 0 && ecart < heures) buckets[heures - 1 - ecart] += 1;
  }
  return buckets;
}

function etiquettesHeures(heures) {
  const courante = new Date().getHours();
  return Array.from({ length: heures }, function (_, i) {
    const h = (courante - (heures - 1 - i) + heures * 24) % 24;
    return `${String(h).padStart(2, '0')}h`;
  });
}

/* ------------------------------------------------------------------ */
/* Signature — ligne de tournée                                        */
/* ------------------------------------------------------------------ */

const TRACE_QUARTIER =
  'M0,34 H120 v-13 h18 v13 H300 v-21 h14 v21 H430 v-9 h22 v9 H620 v-25 h16 v25 H760 v-12 h20 v12 H1000';

function LigneQuartier() {
  return (
    <svg viewBox="0 0 1000 44" preserveAspectRatio="none" aria-hidden className="h-9 w-full">
      <path d={TRACE_QUARTIER} fill="none" stroke="var(--lp-line)" strokeWidth="1.4" />
      <path
        d={TRACE_QUARTIER}
        fill="none"
        stroke="var(--lp-green)"
        strokeWidth="1.6"
        strokeLinecap="round"
        pathLength={1000}
        strokeDasharray="80 920"
        className="motion-safe:animate-[lp-trace_7s_linear_infinite]"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Actions rapides                                                     */
/* ------------------------------------------------------------------ */

const ACTIONS_RAPIDES = [
  {
    to: '/dashboard/menages',
    titre: 'Registre des ménages',
    sous: 'Inscrire · abonner',
    Icon: ICONES_ACTION.menages,
    accent: 'var(--lp-green)',
  },
  {
    to: '/dashboard/signalements',
    titre: 'Traiter les signalements',
    sous: 'Remontées citoyennes',
    Icon: IconAlerte,
    accent: 'var(--lp-red)',
  },
  {
    to: '/dashboard/tournees',
    titre: 'Planifier une tournée',
    sous: 'Quartier · collecteur',
    Icon: IconCamion,
    accent: 'var(--lp-blue)',
  },
  {
    to: '/dashboard/paiements',
    titre: 'Encaisser',
    sous: 'Abonnements & reçus',
    Icon: ICONES_ACTION.tarifs,
    accent: 'var(--lp-gold)',
  },
];

function ActionsRapides() {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {ACTIONS_RAPIDES.map(function ({ to, titre, sous, Icon, accent }) {
        return (
          <Link
            key={to}
            href={to}
            className={cn(
              'group flex items-center gap-2.5 rounded-xl border border-line p-2.5 outline-none',
              'transition-all duration-150 hover:-translate-y-px hover:border-line2 hover:bg-panel',
              'focus-visible:ring-2 focus-visible:ring-blue',
            )}
          >
            <span
              className="grid size-9 shrink-0 place-items-center rounded-lg transition-transform duration-150 group-hover:scale-105"
              style={{
                background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                color: accent,
              }}
            >
              <Icon className="size-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[12px] leading-tight font-semibold text-txt">
                {titre}
              </span>
              <span className="mt-0.5 block truncate text-[10px] text-muted2">{sous}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Référentiels d'affichage                                            */
/* ------------------------------------------------------------------ */

const TYPES_SIGNALEMENT = [
  { code: 'depotoir_sauvage', label: 'Dépotoir sauvage', couleur: 'var(--lp-red)' },
  { code: 'collecte_manquee', label: 'Collecte manquée', couleur: 'var(--lp-gold)' },
  { code: 'bac_plein', label: 'Bac plein', couleur: 'var(--lp-blue)' },
  { code: 'autre', label: 'Autre', couleur: 'var(--lp-violet)' },
];

const STATUTS_SIGNALEMENT = [
  { code: 'nouveau', label: 'Nouveau', couleur: 'var(--lp-red)' },
  { code: 'en_cours', label: 'En cours', couleur: 'var(--lp-gold)' },
  { code: 'resolu', label: 'Résolu', couleur: 'var(--lp-teal)' },
  { code: 'rejete', label: 'Rejeté', couleur: 'var(--lp-muted2)' },
];

const STATUTS_PASSAGE = [
  { code: 'effectue', label: 'Effectué', couleur: 'var(--lp-teal)' },
  { code: 'absent', label: 'Absent', couleur: 'var(--lp-gold)' },
  { code: 'inaccessible', label: 'Inaccessible', couleur: 'var(--lp-red)' },
];

function libelleType(code) {
  const t = TYPES_SIGNALEMENT.find(function (x) {
    return x.code === code;
  });
  return t ? t.label : String(code ?? '—').replaceAll('_', ' ');
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function VueDEnsemble() {
  const { ctx, communeLecture } = useContexte();
  const [donnees, setDonnees] = useState(null);
  const [communes, setCommunes] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [rechargement, setRechargement] = useState(0);
  const [dateLongue, setDateLongue] = useState('');

  // Rendue après montage : le serveur et le client n'ont pas la même heure.
  useEffect(function () {
    const id = window.setTimeout(function () {
      setDateLongue(
        new Date().toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      );
    }, 0);
    return function () {
      window.clearTimeout(id);
    };
  }, []);

  useEffect(
    function () {
      let annule = false;

      async function charger() {
        const communeId = ctx?.lectureCommuneId || ctx?.communeId || null;
        let quartierIds = null;
        let menageIds = null;
        const idsVides = ['00000000-0000-0000-0000-000000000000'];
        if (communeId) {
          const [refQuartiers, refMenages] = await Promise.all([
            supabase.from('quartiers').select('id').eq('commune_id', communeId),
            supabase.from('menages').select('id').eq('commune_id', communeId),
          ]);
          if (refQuartiers.error || refMenages.error) {
            if (!annule) setErreur('Impossible de charger le périmètre communal.');
            return;
          }
          quartierIds = (refQuartiers.data || []).map(function (ligne) {
            return ligne.id;
          });
          menageIds = (refMenages.data || []).map(function (ligne) {
            return ligne.id;
          });
        }
        if (ctx?.niveau === 'pme' && ctx.pmeId) {
          const perimeter = await supabase
            .from('pme_quartiers')
            .select('quartier_id')
            .eq('pme_id', ctx.pmeId);
          if (perimeter.error) {
            if (!annule) setErreur(`Impossible de charger le périmètre : ${perimeter.error.message}`);
            return;
          }
          quartierIds = (perimeter.data || []).map(function (ligne) {
            return ligne.quartier_id;
          });
          const menagesPerimetre = await supabase
            .from('menages')
            .select('id')
            .in('quartier_id', quartierIds.length ? quartierIds : idsVides);
          if (menagesPerimetre.error) {
            if (!annule) setErreur(`Impossible de charger le périmètre : ${menagesPerimetre.error.message}`);
            return;
          }
          menageIds = (menagesPerimetre.data || []).map(function (ligne) {
            return ligne.id;
          });
        }
        const debutJour = new Date();
        debutJour.setHours(0, 0, 0, 0);
        const il24h = new Date(Date.now() - 24 * 3_600_000).toISOString();
        const debutMois = new Date();
        debutMois.setDate(1);
        debutMois.setHours(0, 0, 0, 0);

        const requeteMenages = supabase.from('menages').select('id', { count: 'exact', head: true });
        const requeteQuartiers = supabase.from('quartiers').select('id', { count: 'exact', head: true });
        const requeteSignalements = supabase
          .from('signalements')
          .select('id, type_signalement, description, statut, created_at, quartiers!inner(nom, commune_id)')
          .order('created_at', { ascending: false })
          .limit(300);
        const requetePassages = supabase
          .from('passages')
          .select('id, statut, created_at, quartiers!inner(commune_id)')
          .gte('created_at', il24h)
          .limit(2000);

        if (communeId) {
          requeteMenages.eq('commune_id', communeId);
          requeteQuartiers.eq('commune_id', communeId);
          requeteSignalements.eq('quartiers.commune_id', communeId);
          requetePassages.eq('quartiers.commune_id', communeId);
        } else if (quartierIds) {
          const ids = quartierIds.length ? quartierIds : idsVides;
          requeteMenages.in('quartier_id', ids);
          requeteQuartiers.in('id', ids);
          requeteSignalements.in('quartier_id', ids);
          requetePassages.in('quartier_id', ids);
        }
        const requeteAbonnements = supabase
          .from('abonnements')
          .select('id', { count: 'exact', head: true })
          .eq('statut', 'actif');
        const requeteSoldes = supabase
          .from('menages_solde')
          .select('menage_id', { count: 'exact', head: true })
          .eq('est_solde', true);
        const requetePaiements = supabase
          .from('paiements')
          .select('id, montant_gnf, penalite_gnf, statut, created_at')
          .gte('created_at', debutMois.toISOString())
          .limit(2000);
        if (menageIds) {
          const ids = menageIds.length ? menageIds : idsVides;
          requeteAbonnements.in('menage_id', ids);
          requeteSoldes.in('menage_id', ids);
          requetePaiements.in('menage_id', ids);
        }

        const [
          menages,
          quartiers,
          abonnementsActifs,
          menagesSoldes,
          tourneesActives,
          signalements,
          passages,
          paiements,
        ] = await Promise.all([
          requeteMenages,
          requeteQuartiers,
          requeteAbonnements,
          requeteSoldes,
          supabase.from('tournees').select('id', { count: 'exact', head: true }).eq('actif', true),
          requeteSignalements,
          // NB : la table `passages` horodate avec `created_at` (et non
          // `horodatage`, qui n'existe pas au schéma).
          requetePassages,
          requetePaiements,
        ]);

        if (annule) return;

        const premiereErreur = [
          menages,
          quartiers,
          abonnementsActifs,
          menagesSoldes,
          tourneesActives,
          signalements,
          passages,
          paiements,
        ].find(function (r) {
          return r.error;
        });

        if (premiereErreur) {
          setErreur(
            `Impossible de charger les indicateurs : ${premiereErreur.error.message}`,
          );
          return;
        }

        setErreur(null);
        setDonnees({
          menages: menages.count || 0,
          quartiers: quartiers.count || 0,
          abonnementsActifs: abonnementsActifs.count || 0,
          menagesSoldes: menagesSoldes.count || 0,
          tourneesActives: tourneesActives.count || 0,
          signalements: signalements.data || [],
          passages: passages.data || [],
          paiements: paiements.data || [],
          debutJour: debutJour.getTime(),
        });

        if (ctx?.niveau === 'region' && !communeId) {
          const [refCommunes, refQuartiers, refMenages] = await Promise.all([
            supabase.from('communes').select('id, nom, code').eq('active', true).order('nom'),
            supabase.from('quartiers').select('id, commune_id'),
            supabase.from('menages').select('id, commune_id'),
          ]);
          if (!annule && !refCommunes.error && !refQuartiers.error && !refMenages.error) {
            const quartiersParCommune = (refQuartiers.data || []).reduce(function (index, quartier) {
              index[quartier.commune_id] = (index[quartier.commune_id] || 0) + 1;
              return index;
            }, {});
            const menagesParCommune = (refMenages.data || []).reduce(function (index, menage) {
              index[menage.commune_id] = (index[menage.commune_id] || 0) + 1;
              return index;
            }, {});
            setCommunes(
              (refCommunes.data || []).map(function (commune) {
                return {
                  ...commune,
                  quartiers: quartiersParCommune[commune.id] || 0,
                  menages: menagesParCommune[commune.id] || 0,
                };
              }),
            );
          }
        } else {
          setCommunes([]);
        }
      }

      charger();
      const id = window.setInterval(charger, 60_000);
      return function () {
        annule = true;
        window.clearInterval(id);
      };
    },
    [ctx, rechargement],
  );

  const enChargement = !donnees && !erreur;
  const d = donnees;
  const communeId = ctx?.lectureCommuneId || ctx?.communeId || null;
  const regionSansFiltre = ctx?.niveau === 'region' && !communeId;

  /* Dérivés */
  const signalements = d?.signalements ?? [];
  const passages = d?.passages ?? [];
  const paiements = d?.paiements ?? [];

  const aTraiter = signalements.filter(function (s) {
    return s.statut === 'nouveau' || s.statut === 'en_cours';
  });
  const passagesDuJour = passages.filter(function (p) {
    return new Date(p.created_at).getTime() >= (d?.debutJour ?? 0);
  });
  const passagesEffectues = passagesDuJour.filter(function (p) {
    return p.statut === 'effectue';
  });
  const encaisseMois = paiements
    .filter(function (p) {
      return p.statut === 'confirme';
    })
    .reduce(function (s, p) {
      return s + Number(p.montant_gnf || 0) + Number(p.penalite_gnf || 0);
    }, 0);

  const tauxCouverture = d && d.menages > 0 ? (d.menagesSoldes / d.menages) * 100 : 0;
  const partAbonnes = d && d.menages > 0 ? Math.round((d.abonnementsActifs / d.menages) * 100) : 0;

  const heures24 = etiquettesHeures(24);
  const passagesParHeure = comptesParHeure(
    passages.map(function (p) {
      return p.created_at;
    }),
    24,
  );
  const signalementsParHeure = comptesParHeure(
    signalements.map(function (s) {
      return s.created_at;
    }),
    24,
  );

  const spark = function (valeurs) {
    return valeurs.slice(-12);
  };

  const passages24h = passagesParHeure.reduce(function (s, n) {
    return s + n;
  }, 0);
  const signalements24h = signalementsParHeure.reduce(function (s, n) {
    return s + n;
  }, 0);

  const parType = TYPES_SIGNALEMENT.map(function (t) {
    return {
      label: t.label,
      couleur: t.couleur,
      n: signalements.filter(function (s) {
        return s.type_signalement === t.code;
      }).length,
    };
  }).sort(function (a, b) {
    return b.n - a.n;
  });

  const parStatut = STATUTS_SIGNALEMENT.map(function (s) {
    return {
      label: s.label,
      couleur: s.couleur,
      n: signalements.filter(function (x) {
        return x.statut === s.code;
      }).length,
    };
  });

  const parStatutPassage = STATUTS_PASSAGE.map(function (s) {
    return {
      label: s.label,
      couleur: s.couleur,
      n: passagesDuJour.filter(function (p) {
        return p.statut === s.code;
      }).length,
    };
  });

  const journal = signalements.slice(0, 7);

  const valeur = function (v) {
    return enChargement ? '—' : v;
  };

  return (
    <div className="w-full">
      <PageHeader
        kicker={regionSansFiltre ? 'Région de Conakry' : 'Vue d’ensemble · Commune'}
        titre={regionSansFiltre ? 'Vue d’ensemble' : 'Situation générale'}
        sousTitre={
          ctx?.niveau === 'pme'
            ? 'Le pouls opérationnel de votre périmètre de quartiers.'
            : communeId
              ? `Le pouls opérationnel de ${communeLecture?.nom ?? 'la commune sélectionnée'}.`
              : undefined
        }
        actions={
          <div className="text-right text-[12px] text-muted first-letter:uppercase">
            {dateLongue || ' '}
          </div>
        }
      />

      <div className="lp-rise mt-3" style={{ animationDelay: '40ms' }}>
        <LigneQuartier />
      </div>

      <BandeauErreur
        message={erreur}
        onReessayer={function () {
          setErreur(null);
          setRechargement(function (n) {
            return n + 1;
          });
        }}
      />

      {regionSansFiltre ? (
        <Bloc
          titre="Pouls par commune"
          delai={50}
          extra={
            <span className="font-mono text-[10px] text-muted2 tabular-nums">
              {enChargement ? '— communes' : `${nombre(communes.length)} communes`}
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {enChargement
              ? Array.from({ length: 13 }, function (_, index) {
                  return (
                    <div key={index} className="rounded-xl border border-line bg-panel p-3">
                      <span className="block font-mono text-[22px] font-bold leading-none text-txt tabular-nums">
                        —
                      </span>
                      <span className="mt-1 block text-[10px] uppercase text-muted2">Commune</span>
                    </div>
                  );
                })
              : communes.map(function (commune) {
                  return (
                    <Link
                      key={commune.id}
                      href={`/dashboard?commune=${commune.id}`}
                      className="cursor-pointer rounded-xl border border-line bg-panel p-3 outline-none transition-colors hover:border-line2 hover:bg-panel2 focus-visible:ring-2 focus-visible:ring-blue"
                    >
                      <span className="block truncate text-[12px] font-semibold text-txt">{commune.nom}</span>
                      <span className="mt-2 block font-mono text-[22px] font-bold leading-none text-txt tabular-nums">
                        {nombre(commune.menages)}
                      </span>
                      <span className="mt-1 block text-[10px] uppercase text-muted2">foyers · {commune.code}</span>
                    </Link>
                  );
                })}
          </div>
        </Bloc>
      ) : null}

      {!regionSansFiltre && d && d.menages === 0 ? (
        <div className="lp-rise mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3">
          <p className="m-0 text-[13px] text-muted">
            {ctx?.niveau === 'pme'
              ? 'Aucun foyer enregistré dans ce périmètre.'
              : 'Aucun foyer enregistré dans cette commune.'}
          </p>
          {peutEcrire(ctx) ? (
            <Link
              href="/dashboard/menages"
              className="cursor-pointer rounded-lg bg-green px-3.5 py-2.5 text-[13px] font-semibold text-encre outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-blue"
            >
              Inscrire un ménage
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="lp-rise mt-4" style={{ animationDelay: '60ms' }}>
        <ActionsRapides />
      </div>

      {/* Pouls — cartes séparées (identité Pharmly) */}
      <div
        className="lp-rise mt-5 mb-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        style={{ animationDelay: '90ms' }}
      >
        <Compteur
          label="Ménages inscrits"
          valeur={valeur(nombre(d?.menages))}
          sous={`${d?.quartiers ?? 0} quartier${(d?.quartiers ?? 0) > 1 ? 's' : ''} couvert${(d?.quartiers ?? 0) > 1 ? 's' : ''}`}
          href="/dashboard/menages"
        />
        <Compteur
          label="Abonnements actifs"
          valeur={valeur(nombre(d?.abonnementsActifs))}
          sous={`${partAbonnes} % du registre`}
          ton={partAbonnes >= 60 ? 'teal' : 'or'}
          href="/dashboard/menages"
        />
        <Compteur
          label="Signalements à traiter"
          valeur={valeur(aTraiter.length)}
          sous={aTraiter.length > 0 ? 'Nouveaux et en cours' : 'File vide · rien à traiter'}
          ton={aTraiter.length > 0 ? 'rouge' : 'defaut'}
          href="/dashboard/signalements"
          graphe={spark(signalementsParHeure)}
          accent="var(--lp-red)"
        />
        <Compteur
          label="Passages du jour"
          valeur={valeur(passagesDuJour.length)}
          sous={`${passagesEffectues.length} collecte${passagesEffectues.length > 1 ? 's' : ''} effectuée${passagesEffectues.length > 1 ? 's' : ''}`}
          ton={passagesDuJour.length > 0 ? 'teal' : 'defaut'}
          href="/dashboard/tournees"
          graphe={spark(passagesParHeure)}
          accent="var(--lp-teal)"
        />
        <Compteur
          label="Encaissé ce mois"
          valeur={valeur(montant(encaisseMois))}
          sous={`${d?.tourneesActives ?? 0} tournée${(d?.tourneesActives ?? 0) > 1 ? 's' : ''} active${(d?.tourneesActives ?? 0) > 1 ? 's' : ''}`}
          ton="or"
          href="/dashboard/paiements"
        />
      </div>

      {/* Rangée 1 — activité 24 h + nature des signalements */}
      <div className="grid items-start gap-x-10 gap-y-9 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Bloc
            titre="Activité des dernières 24 heures"
            delai={120}
            extra={
              <span className="font-mono text-[10px] text-muted2 tabular-nums">
                {passages24h} passages · {signalements24h} signalements (24 h)
              </span>
            }
          >
            <BarresActivite
              etiquettes={heures24}
              uniteVide="Aucun passage ni signalement dans les 24 dernières heures"
              series={[
                { label: 'Passages', couleur: 'var(--lp-teal)', valeurs: passagesParHeure },
                { label: 'Signalements', couleur: 'var(--lp-red)', valeurs: signalementsParHeure },
              ]}
            />
          </Bloc>
        </div>

        <div className="flex flex-col gap-9 xl:col-span-4">
          <Bloc titre="Nature des signalements" delai={160}>
            <Donut
              parts={parType}
              libelleCentre="signalements"
              vide="Aucun signalement enregistré pour l'instant."
            />
          </Bloc>

          <Bloc titre="Traitement des signalements" delai={200}>
            <BarreEmpilee
              segments={parStatut}
              vide="Le traitement s'affichera dès le premier signalement."
            />
          </Bloc>
        </div>
      </div>

      {/* Rangée 2 — journal + collecte du jour */}
      <div className="mt-9 grid items-start gap-x-10 gap-y-9 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Bloc
            titre="Derniers signalements"
            delai={240}
            extra={
              <Link
                href="/dashboard/signalements"
                className="text-[10.5px] text-muted outline-none transition-colors hover:text-txt focus-visible:ring-2 focus-visible:ring-blue"
              >
                Tout voir →
              </Link>
            }
          >
            {enChargement ? (
              <p className="m-0 text-[12px] text-muted2">Chargement du journal…</p>
            ) : journal.length === 0 ? (
              <p className="m-0 text-[12px] text-muted2">
                Aucun signalement pour le moment — les remontées citoyennes apparaîtront ici.
              </p>
            ) : (
              <div className="flex flex-col">
                {journal.map(function (s, rang) {
                  const retard = estEnRetard(s);
                  return (
                    <Link
                      key={s.id}
                      href="/dashboard/signalements"
                      className={cn(
                        'lp-rise group flex gap-3.5 border-b border-line py-3 outline-none transition-colors last:border-b-0',
                        'hover:bg-[color-mix(in_srgb,var(--lp-txt)_2.5%,transparent)]',
                        'focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-inset',
                      )}
                      style={{ animationDelay: `${Math.min(rang, 10) * 45}ms` }}
                    >
                      <span
                        aria-hidden
                        className="w-[3px] shrink-0 self-stretch rounded-full"
                        style={{
                          background: retard
                            ? 'var(--lp-gold)'
                            : couleurTon(tonStatut(s.statut)),
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {retard ? (
                            <Badge ton="or">En retard</Badge>
                          ) : (
                            <BadgeStatut statut={s.statut} />
                          )}
                          {s.quartiers?.nom ? (
                            <span className="font-mono text-[11px] tracking-wide text-green">
                              {s.quartiers.nom}
                            </span>
                          ) : null}
                          <span className="font-mono text-[10.5px] text-muted2">
                            {ilYA(s.created_at)}
                          </span>
                        </div>
                        <p className="font-display m-0 mt-1 text-[16px] font-bold text-txt">
                          {libelleType(s.type_signalement)}
                        </p>
                        <p className="m-0 mt-0.5 truncate text-[12px] text-muted">
                          {s.description || 'Sans description'}
                        </p>
                      </div>
                      <span className="hidden shrink-0 self-center text-[10px] text-muted2 opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                        Ouvrir →
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Bloc>
        </div>

        <div className="flex flex-col gap-9 xl:col-span-5">
          <Bloc titre="Collecte du jour" delai={280}>
            <BarresReparties
              lignes={parStatutPassage}
              vide="Aucun passage pointé aujourd'hui."
            />
          </Bloc>

          <Bloc
            titre="Couverture du recouvrement"
            delai={320}
            extra={
              <span className="font-mono text-[10px] text-muted2 tabular-nums">
                {nombre(d?.menages)} foyers
              </span>
            }
          >
            {enChargement ? (
              <p className="m-0 text-[12px] text-muted2">Calcul en cours…</p>
            ) : (d?.menages ?? 0) === 0 ? (
              <p className="m-0 text-[12px] text-muted2">
                Aucun ménage au registre — la couverture se calculera dès la première inscription.
              </p>
            ) : (
              <Jauge
                pourcentage={tauxCouverture}
                libelle="à jour"
                couleur="var(--lp-green)"
                details={[
                  {
                    label: 'Foyers à jour',
                    valeur: nombre(d.menagesSoldes),
                    couleur: 'var(--lp-teal)',
                  },
                  {
                    label: 'Foyers en dette',
                    valeur: nombre(d.menages - d.menagesSoldes),
                    couleur: 'var(--lp-red)',
                  },
                  {
                    label: 'Abonnements actifs',
                    valeur: nombre(d.abonnementsActifs),
                    couleur: 'var(--lp-txt)',
                  },
                ]}
              />
            )}
          </Bloc>
        </div>
      </div>

      {/* Périmètre plateforme */}
      <div className="mt-10">
        <Bloc titre="Périmètre plateforme" delai={360}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {SECTIONS_NAV.map(function (section) {
              const operationnel = section.liens.some(function (l) {
                return l.disponible;
              });
              const destination =
                section.liens.find(function (l) {
                  return l.disponible;
                }) ?? section.liens[0];
              const Icon = section.Icon;
              return (
                <Link
                  key={section.id}
                  href={destination.to}
                  className={cn(
                    'group rounded-xl border border-line p-3 outline-none transition-all duration-150',
                    'hover:-translate-y-0.5 hover:border-line2 hover:bg-panel',
                    'focus-visible:ring-2 focus-visible:ring-blue',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Icon className="size-4 text-muted transition-colors group-hover:text-txt" />
                    <span className="font-mono text-[8.5px] tracking-wider text-muted2">
                      {section.domaine}
                    </span>
                  </div>
                  <div className="mt-2.5 truncate text-[11.5px] font-semibold text-txt">
                    {section.titre}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[8.5px] tracking-wide uppercase">
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        operationnel
                          ? 'bg-teal motion-safe:animate-[lp-pulse_2s_infinite]'
                          : 'bg-line2',
                      )}
                    />
                    <span className={operationnel ? 'text-teal' : 'text-muted2'}>
                      {operationnel ? 'Opérationnel' : 'Bientôt'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Bloc>
      </div>
    </div>
  );
}
