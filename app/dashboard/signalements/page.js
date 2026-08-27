'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
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
import { Bloc } from '@/components/ui';

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

const TYPES = [
  { code: 'depotoir_sauvage', label: 'Dépotoir sauvage' },
  { code: 'collecte_manquee', label: 'Collecte manquée' },
  { code: 'bac_plein', label: 'Bac plein' },
  { code: 'autre', label: 'Autre' },
];

const STATUTS = [
  { code: 'tous', label: 'Tous' },
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

function libelleType(code) {
  const t = TYPES.find(function (x) {
    return x.code === code;
  });
  return t ? t.label : String(code ?? '—').replaceAll('_', ' ');
}

function horodatage(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} à ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Ligne de file                                                       */
/* ------------------------------------------------------------------ */

function LigneSignalement({ s, rang, selectionne, onSelection, onStatut, enCours }) {
  const ouvert = s.statut === 'nouveau' || s.statut === 'en_cours';

  return (
    <article
      onMouseEnter={function () {
        onSelection(s.id);
      }}
      className={cn(
        'lp-rise group flex gap-3.5 border-b border-line py-4 pr-1 transition-colors last:border-b-0',
        selectionne
          ? 'bg-[color-mix(in_srgb,var(--lp-txt)_4%,transparent)]'
          : 'hover:bg-[color-mix(in_srgb,var(--lp-txt)_2.5%,transparent)]',
      )}
      style={{ animationDelay: `${Math.min(rang, 10) * 40}ms` }}
    >
      <span
        aria-hidden
        className="w-[3px] shrink-0 self-stretch rounded-full"
        style={{ background: couleurTon(tonStatut(s.statut)) }}
      />

      {s.photo_url ? (
        <a
          href={s.photo_url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-blue"
          title="Ouvrir la photo"
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
          {libelleType(s.type_signalement)}
        </h3>

        <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-muted">
          {s.description || 'Sans description'}
        </p>

        {s.latitude != null ? (
          <a
            href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-block font-mono text-[10.5px] text-blue outline-none hover:underline focus-visible:ring-2 focus-visible:ring-blue"
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
                onClick={function () {
                  onStatut(s.id, 'en_cours');
                }}
                className="cursor-pointer rounded-lg border border-[color-mix(in_srgb,var(--lp-gold)_45%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-gold outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--lp-gold)_14%,transparent)] focus-visible:ring-2 focus-visible:ring-blue disabled:opacity-40"
              >
                Prendre en charge
              </button>
            ) : null}
            <button
              type="button"
              disabled={enCours}
              onClick={function () {
                onStatut(s.id, 'resolu');
              }}
              className="cursor-pointer rounded-lg border border-[color-mix(in_srgb,var(--lp-teal)_45%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-teal outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--lp-teal)_14%,transparent)] focus-visible:ring-2 focus-visible:ring-blue disabled:opacity-40"
            >
              Marquer résolu
            </button>
            {s.statut === 'nouveau' ? (
              <button
                type="button"
                disabled={enCours}
                onClick={function () {
                  onStatut(s.id, 'rejete');
                }}
                className="cursor-pointer rounded-lg border border-line2 px-2.5 py-1 text-[11px] font-semibold text-muted outline-none transition-colors hover:text-txt focus-visible:ring-2 focus-visible:ring-blue disabled:opacity-40"
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
  const [selectionId, setSelectionId] = useState(null);
  const [instant, setInstant] = useState(0);

  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [filtreQuartier, setFiltreQuartier] = useState('');
  const [filtreType, setFiltreType] = useState('');
  const [filtrePeriode, setFiltrePeriode] = useState('');
  const [recherche, setRecherche] = useState('');

  const charger = useCallback(async function () {
    // La vue `signalements_carte` n'expose que les signalements géolocalisés.
    // On part donc de la table complète et on n'y greffe les coordonnées que
    // pour ceux qui en ont — sinon les remontées sans GPS resteraient invisibles.
    const [base, localises] = await Promise.all([
      supabase
        .from('signalements')
        .select('id, type_signalement, description, statut, created_at, photo_url, quartiers(nom)')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('signalements_carte').select('id, latitude, longitude'),
    ]);
    setChargement(false);

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

    setInstant(Date.now());
    setSignalements(
      (base.data || []).map(function (s) {
        const p = positions.get(s.id);
        return {
          ...s,
          quartier_nom: s.quartiers?.nom ?? null,
          latitude: p ? p.latitude : null,
          longitude: p ? p.longitude : null,
        };
      }),
    );
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

  async function changerStatut(id, statut) {
    setEnCours(true);
    // Mise à jour optimiste : la file doit réagir à la vitesse du clic.
    setSignalements(function (liste) {
      return liste.map(function (s) {
        return s.id === id ? { ...s, statut } : s;
      });
    });
    const { error } = await supabase.from('signalements').update({ statut }).eq('id', id);
    setEnCours(false);
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
        if (filtreStatut !== 'tous' && s.statut !== filtreStatut) return false;
        if (filtreQuartier && s.quartier_nom !== filtreQuartier) return false;
        if (filtreType && s.type_signalement !== filtreType) return false;
        if (filtrePeriode) {
          const jours = (instant - new Date(s.created_at).getTime()) / 86_400_000;
          if (jours > seuils[filtrePeriode]) return false;
        }
        if (!q) return true;
        return `${s.description ?? ''} ${s.quartier_nom ?? ''} ${libelleType(s.type_signalement)}`
          .toLowerCase()
          .includes(q);
      });
    },
    [signalements, filtreStatut, filtreQuartier, filtreType, filtrePeriode, recherche, instant],
  );

  const compte = function (statut) {
    return signalements.filter(function (s) {
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
          libelleType(s.type_signalement),
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
          {TYPES.map(function (t) {
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
                      onStatut={changerStatut}
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
    </div>
  );
}
