'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  deposerEvenement,
  estEnRetard,
  libelleAffectation,
  libelleTypeSignalement,
  MOTIF_MINIMUM,
  TYPES_SIGNALEMENT,
  vuePilotageAbsente,
} from '@/lib/signalements';
import { ModaleAffectationSignalement } from '@/components/ModaleAffectationSignalement';
import {
  Badge,
  BadgeStatut,
  BandeauErreur,
  Btn,
  Chip,
  PageHeader,
  cn,
  couleurTon,
  ilYA,
  nombre,
  tonStatut,
} from '@/components/ui';
import { BandeauMetriques, Recherche, SelectFiltre, exporterCsv } from '@/components/liste';
import { Bloc, Champ, Modal } from '@/components/ui';

const CarteSignalements = dynamic(
  function () {
    return import('./CarteSignalements');
  },
  {
    ssr: false,
    loading: function () {
      return (
        <div className="grid h-full place-items-center">
          <span className="font-mono text-[11px] tracking-[1.6px] text-muted2 uppercase">
            Chargement de la carte…
          </span>
        </div>
      );
    },
  },
);

const STATUTS = [
  { code: 'tous', label: 'Tous' },
  { code: 'en_retard', label: 'En retard' },
  { code: 'nouveau', label: 'Nouveaux' },
  { code: 'en_cours', label: 'En cours' },
  { code: 'resolu', label: 'Résolus' },
  { code: 'rejete', label: 'Rejetés' },
];

const PERIODES = [
  { code: '', label: 'Toutes les périodes' },
  { code: 'jour', label: "Aujourd'hui" },
  { code: 'semaine', label: '7 derniers jours' },
  { code: 'mois', label: '30 derniers jours' },
];

function horodatage(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} à ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

function normaliserSignalements(liste, positions, instant) {
  return (liste || []).map(function (s) {
    const position = positions.get(s.id);
    return {
      ...s,
      quartier_nom: s.quartier_nom ?? s.quartiers?.nom ?? null,
      assigne_pme_nom: s.assigne_pme_nom ?? s.assigne_pme?.nom ?? null,
      assigne_collecteur_nom:
        s.assigne_collecteur_nom ?? s.assigne_collecteur?.nom_complet ?? null,
      en_retard: s.en_retard === true || estEnRetard(s, instant),
      latitude: s.latitude ?? position?.latitude ?? null,
      longitude: s.longitude ?? position?.longitude ?? null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Ligne de file                                                       */
/* ------------------------------------------------------------------ */

function LigneSignalement({
  s,
  rang,
  selectionne,
  onSelection,
  onStatut,
  onAffecter,
  enCours,
}) {
  const ouvert = s.statut === 'nouveau' || s.statut === 'en_cours';
  const affectation = libelleAffectation(s);

  return (
    <article
      onMouseEnter={function () {
        onSelection(s.id);
      }}
      className={cn(
        'lp-rise group relative flex gap-3.5 border-b border-line py-4 pr-1 transition-colors last:border-b-0',
        selectionne
          ? 'bg-[color-mix(in_srgb,var(--lp-txt)_4%,transparent)]'
          : 'hover:bg-[color-mix(in_srgb,var(--lp-txt)_2.5%,transparent)]',
      )}
      style={{ animationDelay: `${Math.min(rang, 10) * 40}ms` }}
    >
      <Link
        href={`/dashboard/signalements/${s.id}`}
        className="absolute inset-0 z-0 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue"
        aria-label={`Ouvrir le signalement ${libelleTypeSignalement(s.type_signalement)}`}
      />
      <span
        aria-hidden
        className="w-[3px] shrink-0 self-stretch rounded-full"
        style={{
          background: s.en_retard ? 'var(--lp-gold)' : couleurTon(tonStatut(s.statut)),
        }}
      />

      {s.photo_url ? (
        <a
          href={s.photo_url}
          target="_blank"
          rel="noreferrer"
          className="relative z-10 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-blue"
          title="Ouvrir la photo"
          onClick={function (event) {
            event.stopPropagation();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.photo_url}
            alt=""
            className="size-16 rounded-lg border border-line object-cover"
          />
        </a>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <BadgeStatut statut={s.statut} />
          {s.en_retard ? <Badge ton="or">En retard</Badge> : null}
          {s.quartier_nom ? (
            <span className="font-mono text-[11px] tracking-wide text-green">{s.quartier_nom}</span>
          ) : (
            <span className="font-mono text-[11px] text-muted2">Quartier non renseigné</span>
          )}
          <span
            className="font-mono text-[10.5px] text-muted2"
            title={horodatage(s.created_at)}
          >
            {ilYA(s.created_at)}
          </span>
          {s.latitude == null ? <Badge ton="muted">Sans GPS</Badge> : null}
        </div>

        <h3 className="font-display m-0 mt-1 text-[17px] leading-tight font-bold text-txt">
          {libelleTypeSignalement(s.type_signalement)}
        </h3>

        <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-muted">
          {s.description || 'Sans description'}
        </p>

        {affectation ? (
          <p className="m-0 mt-1 text-[11px] text-muted">Affecté à {affectation}</p>
        ) : null}

        {s.latitude != null ? (
          <a
            href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="relative z-10 mt-1.5 inline-block font-mono text-[10.5px] text-blue outline-none hover:underline focus-visible:ring-2 focus-visible:ring-blue"
            onClick={function (event) {
              event.stopPropagation();
            }}
          >
            {Number(s.latitude).toFixed(5)}, {Number(s.longitude).toFixed(5)}
          </a>
        ) : null}

        {ouvert ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {s.statut === 'nouveau' ? (
              <button
                type="button"
                disabled={enCours}
                onClick={function (event) {
                  event.stopPropagation();
                  onStatut(s.id, 'en_cours');
                }}
                className="relative z-10 cursor-pointer rounded-lg border border-[color-mix(in_srgb,var(--lp-gold)_45%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-gold outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--lp-gold)_14%,transparent)] focus-visible:ring-2 focus-visible:ring-blue disabled:opacity-40"
              >
                Prendre en charge
              </button>
            ) : null}
            <Btn
              variant="ghost"
              className="relative z-10 px-2.5 py-1 text-[11px]"
              onClick={function (event) {
                event.stopPropagation();
                onAffecter(s);
              }}
            >
              Affecter
            </Btn>
            <button
              type="button"
              disabled={enCours}
              onClick={function (event) {
                event.stopPropagation();
                onStatut(s.id, 'resolu');
              }}
              className="relative z-10 cursor-pointer rounded-lg border border-[color-mix(in_srgb,var(--lp-teal)_45%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-teal outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--lp-teal)_14%,transparent)] focus-visible:ring-2 focus-visible:ring-blue disabled:opacity-40"
            >
              Marquer résolu
            </button>
            {s.statut === 'nouveau' ? (
              <button
                type="button"
                disabled={enCours}
                onClick={function (event) {
                  event.stopPropagation();
                  onStatut(s.id, 'rejete');
                }}
                className="relative z-10 cursor-pointer rounded-lg border border-line2 px-2.5 py-1 text-[11px] font-semibold text-muted outline-none transition-colors hover:text-txt focus-visible:ring-2 focus-visible:ring-blue disabled:opacity-40"
              >
                Rejeter
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SignalementsPage() {
  const [signalements, setSignalements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [cloture, setCloture] = useState(null);
  const [affectationCible, setAffectationCible] = useState(null);
  const [selectionId, setSelectionId] = useState(null);
  const [instant, setInstant] = useState(0);

  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [filtreQuartier, setFiltreQuartier] = useState('');
  const [filtreType, setFiltreType] = useState('');
  const [filtrePeriode, setFiltrePeriode] = useState('');
  const [recherche, setRecherche] = useState('');

  const charger = useCallback(async function () {
    const pilotage = await supabase
      .from('signalements_pilotage')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    const instantChargement = Date.now();
    setChargement(false);

    if (!pilotage.error) {
      setErreur(null);
      setInstant(instantChargement);
      setSignalements(normaliserSignalements(pilotage.data, new Map(), instantChargement));
      return;
    }

    if (!vuePilotageAbsente(pilotage.error)) {
      setErreur(`Impossible de charger les signalements : ${pilotage.error.message}`);
      return;
    }

    // Compatibilité temporaire tant que la migration créant la vue n'est pas
    // appliquée : table et jointures d'affectation, plus coordonnées de la vue carte.
    let [base, localises] = await Promise.all([
      supabase
        .from('signalements')
        .select(
          'id, type_signalement, description, statut, created_at, photo_url, quartier_id, assigne_pme_id, assigne_collecteur_id, quartiers(nom), assigne_pme:pme!signalements_assigne_pme_id_fkey(nom), assigne_collecteur:profils!signalements_assigne_collecteur_id_fkey(nom_complet)',
        )
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('signalements_carte').select('id, latitude, longitude'),
    ]);

    // Si les colonnes d'affectation ne sont pas encore migrées non plus, la
    // liste historique reste disponible, sans informations d'affectation.
    if (base.error) {
      base = await supabase
        .from('signalements')
        .select(
          'id, type_signalement, description, statut, created_at, photo_url, quartier_id, quartiers(nom)',
        )
        .order('created_at', { ascending: false })
        .limit(500);
    }

    if (base.error) {
      setErreur(`Impossible de charger les signalements : ${base.error.message}`);
      return;
    }
    setErreur(null);
    const positions = new Map(
      (localises.data || []).map(function (p) {
        return [p.id, p];
      }),
    );

    setInstant(instantChargement);
    setSignalements(normaliserSignalements(base.data, positions, instantChargement));
  }, []);

  useEffect(
    function () {
      // Chargement initial. React déconseille de déclencher un fetch depuis un
      // effet ; la parade propre serait une couche de données (React Query ou
      // Suspense), ce que ce chantier de design n'introduit pas. Les setState
      // n'ont lieu qu'après l'await, donc sans rendu en cascade synchrone.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      charger();
    },
    [charger],
  );

  /**
   * Le statut ne se met plus à jour directement : on dépose un événement, et
   * un trigger reporte le statut. C'est ce qui alimente la frise de suivi que
   * l'habitant consulte dans l'application mobile — une file d'attente qui
   * change de couleur sans rien expliquer ne vaut rien pour celui qui a
   * signalé.
   *
   * Clore exige un motif : c'est une contrainte de la base. Sans lui, le
   * trigger en inscrit un de substitution qui dit qu'aucun n'a été saisi.
   * Autant le demander pour de bon.
   */
  function demanderStatut(id, statut) {
    if (statut === 'en_cours') {
      poserEvenement(id, statut, null);
      return;
    }
    setCloture({ id, statut, message: '' });
  }

  async function poserEvenement(id, statut, message) {
    setEnCours(true);
    // Mise à jour optimiste : la file doit réagir à la vitesse du clic.
    setSignalements(function (liste) {
      return liste.map(function (s) {
        return s.id === id ? { ...s, statut, en_retard: false } : s;
      });
    });

    const { data: session } = await supabase.auth.getSession();
    const { error } = await deposerEvenement(supabase, {
      signalementId: id,
      statut,
      message,
      userId: session?.session?.user?.id ?? null,
    });

    setEnCours(false);
    setCloture(null);
    if (error) {
      setErreur(`La mise à jour a échoué : ${error.message}`);
      charger();
    }
  }

  const quartiers = useMemo(
    function () {
      return [
        ...new Set(
          signalements
            .map(function (s) {
              return s.quartier_nom;
            })
            .filter(Boolean),
        ),
      ].sort();
    },
    [signalements],
  );

  const filtres = useMemo(
    function () {
      const q = recherche.trim().toLowerCase();
      const seuils = { jour: 1, semaine: 7, mois: 30 };
      return signalements.filter(function (s) {
        if (
          filtreStatut === 'en_retard' &&
          s.en_retard !== true &&
          !estEnRetard(s, instant)
        ) {
          return false;
        }
        if (
          filtreStatut !== 'tous' &&
          filtreStatut !== 'en_retard' &&
          s.statut !== filtreStatut
        ) {
          return false;
        }
        if (filtreQuartier && s.quartier_nom !== filtreQuartier) return false;
        if (filtreType && s.type_signalement !== filtreType) return false;
        if (filtrePeriode) {
          const jours = (instant - new Date(s.created_at).getTime()) / 86_400_000;
          if (jours > seuils[filtrePeriode]) return false;
        }
        if (!q) return true;
        return `${s.description ?? ''} ${s.quartier_nom ?? ''} ${libelleTypeSignalement(s.type_signalement)}`
          .toLowerCase()
          .includes(q);
      });
    },
    [signalements, filtreStatut, filtreQuartier, filtreType, filtrePeriode, recherche, instant],
  );

  const compte = function (statut) {
    return signalements.filter(function (s) {
      if (statut === 'en_retard') {
        return s.en_retard === true || estEnRetard(s, instant);
      }
      return s.statut === statut;
    }).length;
  };

  const localisables = filtres.filter(function (s) {
    return s.latitude != null;
  }).length;

  function exporter() {
    exporterCsv(
      'signalements',
      ['Date', 'Type', 'Quartier', 'Description', 'Statut', 'Latitude', 'Longitude'],
      filtres.map(function (s) {
        return [
          horodatage(s.created_at),
          libelleTypeSignalement(s.type_signalement),
          s.quartier_nom,
          s.description,
          s.statut,
          s.latitude ?? '',
          s.longitude ?? '',
        ];
      }),
    );
  }

  function reinitialiser() {
    setFiltreStatut('tous');
    setFiltreQuartier('');
    setFiltreType('');
    setFiltrePeriode('');
    setRecherche('');
  }

  const filtreActif =
    filtreStatut !== 'tous' || filtreQuartier || filtreType || filtrePeriode || recherche;

  return (
    <div className="w-full">
      <PageHeader
        kicker="Citoyen · File de traitement"
        titre="Signalements"
        sousTitre="Remontées des citoyens et des collecteurs. Prenez en charge, puis clôturez — la file se vide par le haut."
        actions={
          <>
            {filtreActif ? (
              <Btn variant="ghost" onClick={reinitialiser}>
                Réinitialiser
              </Btn>
            ) : null}
            <Btn variant="ghost" onClick={exporter} disabled={filtres.length === 0}>
              Exporter
            </Btn>
          </>
        }
      />

      <BandeauErreur message={erreur} onReessayer={charger} />

      <BandeauMetriques
        metriques={[
          {
            label: 'Nouveaux',
            valeur: chargement ? '—' : nombre(compte('nouveau')),
            sous: 'Jamais ouverts',
            ton: compte('nouveau') > 0 ? 'rouge' : 'defaut',
          },
          {
            label: 'En cours',
            valeur: chargement ? '—' : nombre(compte('en_cours')),
            sous: 'Pris en charge',
            ton: compte('en_cours') > 0 ? 'or' : 'defaut',
          },
          {
            label: 'Résolus',
            valeur: chargement ? '—' : nombre(compte('resolu')),
            sous: 'Clôturés',
            ton: 'teal',
          },
          {
            label: 'Rejetés',
            valeur: chargement ? '—' : nombre(compte('rejete')),
            sous: 'Sans suite',
            ton: 'muted',
          },
        ]}
      />

      {/* Toolbar */}
      <div className="lp-rise mt-6 flex flex-wrap items-center gap-2" style={{ animationDelay: '60ms' }}>
        <div className="flex flex-wrap gap-1.5">
          {STATUTS.map(function (s) {
            const n = s.code === 'tous' ? signalements.length : compte(s.code);
            return (
              <Chip
                key={s.code}
                actif={filtreStatut === s.code}
                onClick={function () {
                  setFiltreStatut(s.code);
                }}
              >
                {s.label}
                <span className="ml-1.5 font-mono text-[10px] text-muted2 tabular-nums">{n}</span>
              </Chip>
            );
          })}
        </div>
        <div className="flex-1" />
        <Recherche valeur={recherche} onChange={setRecherche} placeholder="Description, quartier…" />
        <SelectFiltre valeur={filtreType} onChange={setFiltreType} ariaLabel="Filtrer par type">
          <option value="">Tous les types</option>
          {TYPES_SIGNALEMENT.map(function (t) {
            return (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            );
          })}
        </SelectFiltre>
        <SelectFiltre
          valeur={filtreQuartier}
          onChange={setFiltreQuartier}
          ariaLabel="Filtrer par quartier"
        >
          <option value="">Tous les quartiers</option>
          {quartiers.map(function (q) {
            return (
              <option key={q} value={q}>
                {q}
              </option>
            );
          })}
        </SelectFiltre>
        <SelectFiltre
          valeur={filtrePeriode}
          onChange={setFiltrePeriode}
          ariaLabel="Filtrer par période"
        >
          {PERIODES.map(function (p) {
            return (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            );
          })}
        </SelectFiltre>
      </div>

      {/* File + carte */}
      <div className="mt-7 grid items-start gap-x-10 gap-y-9 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Bloc
            titre="File de traitement"
            delai={120}
            extra={
              <span className="font-mono text-[10px] text-muted2 tabular-nums">
                {nombre(filtres.length)} sur {nombre(signalements.length)}
              </span>
            }
          >
            {chargement ? (
              <p className="m-0 text-[12px] text-muted2">Chargement de la file…</p>
            ) : filtres.length === 0 ? (
              <div className="py-8 text-center">
                <p className="m-0 text-[13px] text-muted2">
                  {signalements.length === 0
                    ? "Aucun signalement — les remontées citoyennes apparaîtront ici dès la première."
                    : 'Aucun signalement ne correspond à ces filtres.'}
                </p>
                {signalements.length > 0 ? (
                  <div className="mt-3 flex justify-center">
                    <Btn variant="ghost" onClick={reinitialiser}>
                      Réinitialiser les filtres
                    </Btn>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col">
                {filtres.map(function (s, rang) {
                  return (
                    <LigneSignalement
                      key={s.id}
                      s={s}
                      rang={rang}
                      selectionne={selectionId === s.id}
                      onSelection={setSelectionId}
                      onStatut={demanderStatut}
                      onAffecter={setAffectationCible}
                      enCours={enCours}
                    />
                  );
                })}
              </div>
            )}
          </Bloc>
        </div>

        <div className="xl:col-span-5 xl:sticky xl:top-4">
          <Bloc
            titre="Répartition sur le terrain"
            delai={160}
            extra={
              <span className="font-mono text-[10px] text-muted2 tabular-nums">
                {nombre(localisables)} géolocalisé{localisables > 1 ? 's' : ''}
              </span>
            }
          >
            <div className="h-[460px] overflow-hidden rounded-xl border border-line">
              <CarteSignalements
                signalements={filtres}
                selectionId={selectionId}
                onSelection={setSelectionId}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {[
                { label: 'Nouveau', ton: 'rouge' },
                { label: 'En cours', ton: 'or' },
                { label: 'Résolu', ton: 'teal' },
                { label: 'Rejeté', ton: 'muted' },
              ].map(function (l) {
                return (
                  <span key={l.label} className="flex items-center gap-1.5 text-[10.5px] text-muted">
                    <span
                      className="size-2 rounded-sm"
                      style={{ background: couleurTon(l.ton) }}
                    />
                    {l.label}
                  </span>
                );
              })}
            </div>
          </Bloc>
        </div>
      </div>

      <ModaleAffectationSignalement
        signalement={affectationCible}
        ouvert={affectationCible !== null}
        onFermer={function () {
          setAffectationCible(null);
        }}
        onAffecte={charger}
      />

      <Modal
        ouvert={cloture !== null}
        onFermer={function () {
          setCloture(null);
        }}
        titre={cloture?.statut === 'rejete' ? 'Rejeter le signalement' : 'Marquer résolu'}
        sousTitre="Ce message est visible par l'habitant qui a signalé."
        taille="sm"
        pied={
          <div className="flex justify-end gap-2">
            <Btn
              variant="ghost"
              onClick={function () {
                setCloture(null);
              }}
            >
              Annuler
            </Btn>
            <Btn
              variant={cloture?.statut === 'rejete' ? 'red' : 'teal'}
              disabled={enCours || (cloture?.message ?? '').trim().length < MOTIF_MINIMUM}
              onClick={function () {
                poserEvenement(cloture.id, cloture.statut, cloture.message.trim());
              }}
            >
              {enCours ? 'Enregistrement…' : 'Confirmer'}
            </Btn>
          </div>
        }
      >
        <Champ
          autoFocus
          value={cloture?.message ?? ''}
          onChange={function (e) {
            setCloture(function (c) {
              return { ...c, message: e.target.value };
            });
          }}
          placeholder={
            cloture?.statut === 'rejete'
              ? 'Doublon avec un signalement déjà traité.'
              : 'Bac vidé ce matin, abords nettoyés.'
          }
        />
        <p className="mt-2 mb-0 text-[11.5px] text-muted2">
          {(cloture?.message ?? '').trim().length < MOTIF_MINIMUM
            ? `Encore ${MOTIF_MINIMUM - (cloture?.message ?? '').trim().length} caractères. Recevoir « rejeté » sans motif est ce qui décourage de signaler une seconde fois.`
            : 'Ce motif apparaîtra daté dans le suivi du signalement.'}
        </p>
      </Modal>
    </div>
  );
}
