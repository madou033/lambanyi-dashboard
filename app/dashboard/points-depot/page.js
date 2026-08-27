'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Badge,
  BandeauErreur,
  Bloc,
  Btn,
  Champ,
  Chip,
  Modal,
  PageHeader,
  PaginationBar,
  Selecteur,
  cn,
  nombre,
} from '@/components/ui';
import {
  BandeauMetriques,
  CarteListe,
  Recherche,
  SelectFiltre,
  Tableau,
  Td,
  Tr,
  exporterCsv,
  usePagination,
} from '@/components/liste';
import { IconPlus } from '@/components/icons';

const CartePointsDepot = dynamic(
  function () {
    return import('./CartePointsDepot');
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
  { code: 'bac', label: 'Bac' },
  { code: 'point_regroupement', label: 'Point de regroupement' },
  { code: 'zone_traitement', label: 'Zone de traitement' },
  { code: 'decharge', label: 'Décharge' },
];

const FORM_VIDE = {
  id: null,
  nom: '',
  type_point: 'bac',
  quartier_id: '',
  pme_id: '',
  capacite_m3: '',
  adresse_repere: '',
  latitude: '',
  longitude: '',
};

const COLONNES = [
  { cle: 'nom', label: 'Point' },
  { cle: 'type', label: 'Type' },
  { cle: 'quartier', label: 'Quartier' },
  { cle: 'proprio', label: 'Propriétaire' },
  { cle: 'capacite', label: 'Capacité', align: 'right' },
  { cle: 'depots', label: 'Dépôts', align: 'right' },
  { cle: 'position', label: 'Position' },
  { cle: 'statut', label: 'Statut' },
  { cle: 'action', label: '', align: 'right', noPrint: true },
];

function libelleType(code) {
  const t = TYPES.find(function (x) {
    return x.code === code;
  });
  return t ? t.label : String(code ?? '—').replaceAll('_', ' ');
}

export default function PointsDepotPage() {
  const [points, setPoints] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [pmes, setPmes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [recherche, setRecherche] = useState('');
  const [fQuartier, setFQuartier] = useState('');
  const [fType, setFType] = useState('');
  const [fProprio, setFProprio] = useState('tous');

  const [modale, setModale] = useState(false);
  const [form, setForm] = useState(FORM_VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageForm, setMessageForm] = useState(null);
  const [bascule, setBascule] = useState(null);

  const charger = useCallback(async function () {
    try {
      const r = await fetch('/api/points-depot');
      if (!r.ok) throw new Error();
      const j = await r.json();
      setPoints(j.data || []);
      setErreur(null);
    } catch {
      setErreur(
        "Le référentiel des points de dépôt est injoignable — la clé de service Supabase n'est pas configurée.",
      );
    }
    setChargement(false);
  }, []);

  useEffect(
    function () {
      // Chargement initial. React déconseille de déclencher un fetch depuis un
      // effet ; la parade propre serait une couche de données (React Query ou
      // Suspense), ce que ce chantier de design n'introduit pas. Les setState
      // n'ont lieu qu'après l'await, donc sans rendu en cascade synchrone.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      charger();
      fetch('/api/points-depot?mode=referentiel')
        .then(function (r) {
          return r.ok ? r.json() : { quartiers: [], pme: [] };
        })
        .then(function (j) {
          setQuartiers(j.quartiers || []);
          setPmes(j.pme || []);
        })
        .catch(function () {
          setQuartiers([]);
          setPmes([]);
        });
    },
    [charger],
  );

  const filtres = useMemo(
    function () {
      const q = recherche.trim().toLowerCase();
      return points.filter(function (p) {
        if (fQuartier && p.quartier_id !== fQuartier) return false;
        if (fType && p.type_point !== fType) return false;
        if (fProprio === 'commune' && p.proprietaire !== 'Commune') return false;
        if (fProprio === 'pme' && p.proprietaire === 'Commune') return false;
        if (fProprio === 'inactifs' && p.actif) return false;
        if (fProprio === 'sans_gps' && p.latitude != null) return false;
        if (!q) return true;
        return `${p.nom ?? ''} ${p.adresse_repere ?? ''} ${p.quartier ?? ''}`
          .toLowerCase()
          .includes(q);
      });
    },
    [points, recherche, fQuartier, fType, fProprio],
  );

  const { page, pages, total, tranche, setPage } = usePagination(filtres, 20);

  const actifs = points.filter(function (p) {
    return p.actif;
  });
  const communaux = points.filter(function (p) {
    return p.proprietaire === 'Commune';
  }).length;
  const sansGps = points.filter(function (p) {
    return p.latitude == null;
  }).length;
  const capaciteTotale = actifs.reduce(function (s, p) {
    return s + Number(p.capacite_m3 || 0);
  }, 0);

  /* -- Actions ----------------------------------------------------- */

  function majChamp(champ, valeur) {
    setForm(function (f) {
      return { ...f, [champ]: valeur };
    });
  }

  function ouvrirCreation() {
    setMessageForm(null);
    setForm(FORM_VIDE);
    setModale(true);
  }

  function ouvrirEdition(p) {
    setMessageForm(null);
    setForm({
      id: p.id,
      nom: p.nom ?? '',
      type_point: p.type_point ?? 'bac',
      quartier_id: p.quartier_id ?? '',
      pme_id: p.pme_id ?? '',
      capacite_m3: p.capacite_m3 ?? '',
      adresse_repere: p.adresse_repere ?? '',
      latitude: p.latitude ?? '',
      longitude: p.longitude ?? '',
    });
    setModale(true);
  }

  async function enregistrer() {
    setMessageForm(null);
    if (!form.nom || !form.type_point) {
      setMessageForm('Le nom et le type sont obligatoires.');
      return;
    }
    setEnregistrement(true);
    try {
      const r = await fetch('/api/points-depot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json().catch(function () {
        return {};
      });
      setEnregistrement(false);
      if (!r.ok) {
        setMessageForm(j.error || "Le point n'a pas pu être enregistré.");
        return;
      }
      setModale(false);
      charger();
    } catch {
      setEnregistrement(false);
      setMessageForm('Erreur réseau.');
    }
  }

  async function confirmerBascule() {
    setEnregistrement(true);
    try {
      const r = await fetch('/api/points-depot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bascule.id, actif: !bascule.actif }),
      });
      setEnregistrement(false);
      if (!r.ok) {
        setErreur('La mise à jour a échoué.');
      }
      setBascule(null);
      charger();
    } catch {
      setEnregistrement(false);
      setBascule(null);
      setErreur('Erreur réseau.');
    }
  }

  function exporter() {
    exporterCsv(
      'points_depot',
      [
        'Nom',
        'Type',
        'Quartier',
        'Propriétaire',
        'Capacité m3',
        'Repère',
        'Latitude',
        'Longitude',
        'Dépôts',
        'Statut',
      ],
      filtres.map(function (p) {
        return [
          p.nom,
          libelleType(p.type_point),
          p.quartier,
          p.proprietaire,
          p.capacite_m3 ?? '',
          p.adresse_repere,
          p.latitude ?? '',
          p.longitude ?? '',
          p.nb_depots,
          p.actif ? 'actif' : 'inactif',
        ];
      }),
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        kicker="Terrain · Réseau d'équipements"
        titre="Points de dépôt"
        sousTitre="Bacs, points de regroupement et exutoires. Un point sans coordonnées reste invisible pour les collecteurs."
        actions={
          <>
            <Btn variant="ghost" onClick={exporter} disabled={filtres.length === 0}>
              Exporter
            </Btn>
            <Btn variant="green" onClick={ouvrirCreation}>
              <IconPlus className="size-4" />
              Nouveau point
            </Btn>
          </>
        }
      />

      <BandeauErreur message={erreur} onReessayer={charger} />

      <BandeauMetriques
        metriques={[
          {
            label: 'Points actifs',
            valeur: chargement ? '—' : nombre(actifs.length),
            sous: `${nombre(points.length - actifs.length)} désactivé${points.length - actifs.length > 1 ? 's' : ''}`,
            ton: 'teal',
          },
          {
            label: 'Capacité installée',
            valeur: chargement ? '—' : `${nombre(Math.round(capaciteTotale))} m³`,
            sous: 'Sur les points actifs',
          },
          {
            label: 'Gérés par la commune',
            valeur: chargement ? '—' : nombre(communaux),
            sous: `${nombre(points.length - communaux)} confié${points.length - communaux > 1 ? 's' : ''} aux PME`,
          },
          {
            label: 'Sans coordonnées',
            valeur: chargement ? '—' : nombre(sansGps),
            sous: sansGps > 0 ? 'À géolocaliser' : 'Tous cartographiés',
            ton: sansGps > 0 ? 'or' : 'teal',
          },
        ]}
      />

      <div className="mt-7 grid items-start gap-x-10 gap-y-9 xl:grid-cols-12">
        <div className="xl:col-span-5 xl:sticky xl:top-4">
          <Bloc
            titre="Réseau cartographié"
            delai={100}
            extra={
              <span className="font-mono text-[10px] text-muted2 tabular-nums">
                {nombre(
                  filtres.filter(function (p) {
                    return p.latitude != null;
                  }).length,
                )}{' '}
                localisés
              </span>
            }
          >
            <div className="h-[460px] overflow-hidden rounded-xl border border-line">
              <CartePointsDepot points={filtres} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {[
                { label: 'Commune', couleur: 'var(--lp-green)' },
                { label: 'PME', couleur: 'var(--lp-blue)' },
                { label: 'Désactivé', couleur: 'var(--lp-muted2)' },
              ].map(function (l) {
                return (
                  <span key={l.label} className="flex items-center gap-1.5 text-[10.5px] text-muted">
                    <span className="size-2 rounded-sm" style={{ background: l.couleur }} />
                    {l.label}
                  </span>
                );
              })}
            </div>
          </Bloc>
        </div>

        <div className="xl:col-span-7">
          <CarteListe
            titre="Référentiel des points"
            delai={140}
            sousTitre={
              chargement
                ? 'Chargement…'
                : `${nombre(total)} résultat${total > 1 ? 's' : ''}${total !== points.length ? ` · ${nombre(points.length)} au total` : ''}`
            }
            outils={
              <div className="flex flex-wrap items-center gap-2">
                <Recherche valeur={recherche} onChange={setRecherche} placeholder="Nom, repère…" />
                <SelectFiltre valeur={fType} onChange={setFType} ariaLabel="Filtrer par type">
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
                  valeur={fQuartier}
                  onChange={setFQuartier}
                  ariaLabel="Filtrer par quartier"
                >
                  <option value="">Tous les quartiers</option>
                  {quartiers.map(function (q) {
                    return (
                      <option key={q.id} value={q.id}>
                        {q.nom}
                      </option>
                    );
                  })}
                </SelectFiltre>
              </div>
            }
            chips={
              <div className="flex flex-wrap gap-1.5">
                {[
                  { code: 'tous', label: 'Tous' },
                  { code: 'commune', label: 'Commune' },
                  { code: 'pme', label: 'PME' },
                  { code: 'sans_gps', label: 'Sans GPS' },
                  { code: 'inactifs', label: 'Désactivés' },
                ].map(function (f) {
                  return (
                    <Chip
                      key={f.code}
                      actif={fProprio === f.code}
                      onClick={function () {
                        setFProprio(f.code);
                      }}
                    >
                      {f.label}
                    </Chip>
                  );
                })}
              </div>
            }
            pied={<PaginationBar page={page} pages={pages} total={total} onChange={setPage} />}
          >
            <Tableau
              colonnes={COLONNES}
              vide={
                chargement
                  ? 'Chargement du référentiel…'
                  : erreur
                    ? 'Référentiel indisponible.'
                    : points.length === 0
                      ? "Aucun point de dépôt — créez le premier bac du réseau."
                      : 'Aucun point ne correspond à ces filtres.'
              }
            >
              {tranche.map(function (p, rang) {
                return (
                  <Tr key={p.id} rang={rang}>
                    <Td fort className="max-w-[180px] truncate">
                      {p.nom}
                    </Td>
                    <Td>{libelleType(p.type_point)}</Td>
                    <Td>{p.quartier || <span className="text-muted2">Hors quartier</span>}</Td>
                    <Td>
                      <Badge ton={p.proprietaire === 'Commune' ? 'vert' : 'bleu'}>
                        {p.proprietaire}
                      </Badge>
                    </Td>
                    <Td align="right" mono>
                      {p.capacite_m3 ? `${p.capacite_m3} m³` : '—'}
                    </Td>
                    <Td align="right" mono>
                      {nombre(p.nb_depots)}
                    </Td>
                    <Td mono>
                      {p.latitude != null ? (
                        <a
                          href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue outline-none hover:underline focus-visible:ring-2 focus-visible:ring-blue"
                        >
                          {Number(p.latitude).toFixed(4)}, {Number(p.longitude).toFixed(4)}
                        </a>
                      ) : (
                        <span className="text-gold">Sans GPS</span>
                      )}
                    </Td>
                    <Td>
                      <Badge ton={p.actif ? 'teal' : 'muted'}>
                        {p.actif ? 'Actif' : 'Désactivé'}
                      </Badge>
                    </Td>
                    <Td align="right" className="no-print">
                      <span className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={function () {
                            ouvrirEdition(p);
                          }}
                          className="cursor-pointer rounded-lg border border-line2 px-2.5 py-1 text-[11px] font-semibold text-txt outline-none transition-colors hover:bg-panel2 focus-visible:ring-2 focus-visible:ring-blue"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={function () {
                            setBascule(p);
                          }}
                          className="cursor-pointer rounded-lg border border-line2 px-2.5 py-1 text-[11px] font-semibold text-muted outline-none transition-colors hover:text-txt focus-visible:ring-2 focus-visible:ring-blue"
                        >
                          {p.actif ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </Tableau>
          </CarteListe>
        </div>
      </div>

      {/* Création / édition */}
      <Modal
        ouvert={modale}
        onFermer={function () {
          setModale(false);
        }}
        titre={form.id ? 'Modifier le point de dépôt' : 'Nouveau point de dépôt'}
        sousTitre="Cliquez sur la carte ou faites glisser le marqueur pour poser la position."
        taille="xl"
        bloquerFermeture={enregistrement}
        pied={
          <div className="flex flex-wrap justify-end gap-2">
            <Btn
              variant="ghost"
              disabled={enregistrement}
              onClick={function () {
                setModale(false);
              }}
            >
              Annuler
            </Btn>
            <Btn variant="green" disabled={enregistrement} onClick={enregistrer}>
              {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
            </Btn>
          </div>
        }
      >
        {messageForm ? (
          <p className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--lp-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-red)_14%,transparent)] px-4 py-2.5 text-[12.5px] text-txt">
            {messageForm}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                Nom *
              </span>
              <Champ
                value={form.nom}
                onChange={function (e) {
                  majChamp('nom', e.target.value);
                }}
                placeholder="Ex. Bac marché central"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                Type *
              </span>
              <Selecteur
                value={form.type_point}
                onChange={function (e) {
                  majChamp('type_point', e.target.value);
                }}
                className="w-full"
              >
                {TYPES.map(function (t) {
                  return (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  );
                })}
              </Selecteur>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                Capacité (m³)
              </span>
              <Champ
                type="number"
                step="0.5"
                min="0"
                value={form.capacite_m3}
                onChange={function (e) {
                  majChamp('capacite_m3', e.target.value);
                }}
                placeholder="Optionnel"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                Quartier
              </span>
              <Selecteur
                value={form.quartier_id}
                onChange={function (e) {
                  majChamp('quartier_id', e.target.value);
                }}
                className="w-full"
              >
                <option value="">— Hors quartier —</option>
                {quartiers.map(function (q) {
                  return (
                    <option key={q.id} value={q.id}>
                      {q.nom}
                    </option>
                  );
                })}
              </Selecteur>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                Propriétaire
              </span>
              <Selecteur
                value={form.pme_id}
                onChange={function (e) {
                  majChamp('pme_id', e.target.value);
                }}
                className="w-full"
              >
                <option value="">— Commune —</option>
                {pmes.map(function (m) {
                  return (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  );
                })}
              </Selecteur>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                Repère
              </span>
              <Champ
                value={form.adresse_repere}
                onChange={function (e) {
                  majChamp('adresse_repere', e.target.value);
                }}
                placeholder="Ex. face à l'école primaire"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                Latitude
              </span>
              <Champ
                value={form.latitude}
                onChange={function (e) {
                  majChamp('latitude', e.target.value);
                }}
                placeholder="9.6150"
                className="font-mono"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                Longitude
              </span>
              <Champ
                value={form.longitude}
                onChange={function (e) {
                  majChamp('longitude', e.target.value);
                }}
                placeholder="-13.6220"
                className="font-mono"
              />
            </label>
          </div>

          <div
            className={cn(
              'h-[340px] overflow-hidden rounded-xl border border-line lg:h-auto lg:min-h-[340px]',
            )}
          >
            <CartePointsDepot
              points={points}
              idCourant={form.id}
              latitude={form.latitude}
              longitude={form.longitude}
              selectionnable
              onChoisir={function (lat, lon) {
                majChamp('latitude', lat.toFixed(6));
                majChamp('longitude', lon.toFixed(6));
              }}
            />
          </div>
        </div>
      </Modal>

      {/* Bascule actif/inactif */}
      <Modal
        ouvert={Boolean(bascule)}
        onFermer={function () {
          setBascule(null);
        }}
        titre={bascule?.actif ? 'Désactiver ce point ?' : 'Réactiver ce point ?'}
        taille="sm"
        bloquerFermeture={enregistrement}
        pied={
          <div className="flex flex-wrap justify-end gap-2">
            <Btn
              variant="ghost"
              disabled={enregistrement}
              onClick={function () {
                setBascule(null);
              }}
            >
              Annuler
            </Btn>
            <Btn
              variant={bascule?.actif ? 'red' : 'green'}
              disabled={enregistrement}
              onClick={confirmerBascule}
            >
              {enregistrement ? 'Patientez…' : bascule?.actif ? 'Désactiver' : 'Réactiver'}
            </Btn>
          </div>
        }
      >
        <p className="m-0 text-[13.5px] leading-relaxed text-muted">
          {bascule?.actif ? (
            <>
              <b className="text-txt">{bascule?.nom}</b> disparaîtra des points proposés aux
              collecteurs. Les dépôts déjà enregistrés sont conservés.
            </>
          ) : (
            <>
              <b className="text-txt">{bascule?.nom}</b> redeviendra sélectionnable par les
              collecteurs.
            </>
          )}
        </p>
      </Modal>
    </div>
  );
}
