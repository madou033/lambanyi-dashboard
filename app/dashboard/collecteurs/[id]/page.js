'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BandeauFiche, Journal, LigneJournal, LigneMeta } from '@/components/fiche';
import { MiniBarres } from '@/components/graphes';
import { BandeauMetriques, usePagination } from '@/components/liste';
import {
  Badge,
  BandeauErreur,
  Bloc,
  Btn,
  Chip,
  Modal,
  PaginationBar,
  Panel,
  Selecteur,
  couleurTon,
  ilYA,
  nombre,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const STATUTS_PASSAGE = {
  effectue: { label: 'Effectué', ton: 'teal' },
  absent: { label: 'Absent', ton: 'or' },
  inaccessible: { label: 'Inaccessible', ton: 'rouge' },
};

const FILTRES_PASSAGE = [
  { code: 'tous', label: 'Tous' },
  { code: 'effectue', label: 'Effectués' },
  { code: 'absent', label: 'Absents' },
  { code: 'inaccessible', label: 'Inaccessibles' },
];

function heureCourte(h) {
  return h ? String(h).slice(0, 5) : '—';
}

function passagesParJour(dates, jours, instant) {
  const buckets = new Array(jours).fill(0);
  for (const date of dates) {
    const ecart = Math.floor((instant - new Date(date).getTime()) / 86_400_000);
    if (ecart >= 0 && ecart < jours) buckets[jours - 1 - ecart] += 1;
  }
  return buckets;
}

function relation(objet) {
  return Array.isArray(objet) ? objet[0] : objet;
}

export default function CollecteurPage() {
  const { id } = useParams();
  const [activite, setActivite] = useState(null);
  const [profil, setProfil] = useState(null);
  const [tournees, setTournees] = useState([]);
  const [passages, setPassages] = useState([]);
  const [depots, setDepots] = useState([]);
  const [collegues, setCollegues] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [instant, setInstant] = useState(0);
  const [filtrePassage, setFiltrePassage] = useState('tous');
  const [periode, setPeriode] = useState('30');
  const [bascule, setBascule] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [tourneeEnCours, setTourneeEnCours] = useState(null);

  const charger = useCallback(
    async function () {
      setChargement(true);
      const il30j = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [activiteReponse, profilAvecPme, tourneesReponse, passagesReponse, depotsReponse, colleguesReponse] =
        await Promise.all([
          supabase.from('collecteurs_activite').select('*').eq('id', id).maybeSingle(),
          supabase
            .from('profils')
            .select('id, nom_complet, telephone, actif, created_at, pme_id, pme(nom)')
            .eq('id', id)
            .maybeSingle(),
          supabase
            .from('tournees')
            .select(
              'id, jour_semaine, heure_debut, actif, quartier_id, collecteur_id, quartiers(nom)',
            )
            .eq('collecteur_id', id)
            .order('jour_semaine')
            .order('heure_debut'),
          supabase
            .from('passages')
            .select(
              'id, statut, created_at, menage_id, menages(code_menage, point_repere, quartiers(nom))',
            )
            .eq('collecteur_id', id)
            .gte('created_at', il30j)
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('depots')
            .select('id, created_at, nb_charrettes, note, points_depot(nom)')
            .eq('collecteur_id', id)
            .gte('created_at', il30j)
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('profils')
            .select('id, nom_complet, actif')
            .eq('role', 'collecteur')
            .order('nom_complet'),
        ]);

      let profilReponse = profilAvecPme;
      if (profilAvecPme.error) {
        profilReponse = await supabase
          .from('profils')
          .select('id, nom_complet, telephone, actif, created_at, pme_id')
          .eq('id', id)
          .maybeSingle();
        if (!profilReponse.error && profilReponse.data?.pme_id) {
          const pmeReponse = await supabase
            .from('pme')
            .select('nom')
            .eq('id', profilReponse.data.pme_id)
            .maybeSingle();
          if (!pmeReponse.error) {
            profilReponse.data = { ...profilReponse.data, pme: pmeReponse.data };
          }
        }
      }

      setChargement(false);
      setInstant(Date.now());
      setActivite(activiteReponse.data || null);
      setProfil(profilReponse.data || null);
      setTournees(tourneesReponse.data || []);
      setPassages(passagesReponse.data || []);
      setDepots(depotsReponse.data || []);
      setCollegues(
        (colleguesReponse.data || []).filter(function (collegue) {
          return collegue.actif || collegue.id === id;
        }),
      );

      if (activiteReponse.error || profilReponse.error) {
        const detail = activiteReponse.error?.message || profilReponse.error?.message;
        setErreur(`Impossible de charger ce collecteur : ${detail}`);
        return;
      }

      const erreurSecondaire =
        tourneesReponse.error ||
        passagesReponse.error ||
        depotsReponse.error ||
        colleguesReponse.error;
      setErreur(
        erreurSecondaire
          ? `Certaines informations n’ont pas pu être chargées : ${erreurSecondaire.message}`
          : null,
      );

      const nom = profilReponse.data?.nom_complet || activiteReponse.data?.nom_complet;
      if (nom) document.title = `Collecteur · ${nom}`;
    },
    [id],
  );

  useEffect(
    function () {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      charger();
    },
    [charger],
  );

  const fiche = profil || activite;
  const nom = profil?.nom_complet || activite?.nom_complet || 'Collecteur';
  const telephone = profil?.telephone || activite?.telephone || '';
  const dernier = activite?.dernier_passage || passages[0]?.created_at;
  const seuil7j = instant - 7 * 86_400_000;
  const dormant =
    Boolean(fiche?.actif) && (!dernier || new Date(dernier).getTime() < seuil7j);
  const quartiers = useMemo(
    function () {
      const noms = tournees
        .map(function (tournee) {
          return relation(tournee.quartiers)?.nom;
        })
        .filter(Boolean);
      return [...new Set(noms)].join(', ');
    },
    [tournees],
  );
  const valeurs7j = useMemo(
    function () {
      return instant
        ? passagesParJour(
            passages.map(function (passage) {
              return passage.created_at;
            }),
            7,
            instant,
          )
        : new Array(7).fill(0);
    },
    [instant, passages],
  );
  const libelles7j = useMemo(
    function () {
      return new Array(7).fill(null).map(function (_, i) {
        return new Date(instant - (6 - i) * 86_400_000).toLocaleDateString('fr-FR', {
          weekday: 'short',
        });
      });
    },
    [instant],
  );
  const depots7j = depots.filter(function (depot) {
    return instant && new Date(depot.created_at).getTime() >= seuil7j;
  }).length;
  const passagesPeriode = useMemo(
    function () {
      const jours = Number(periode);
      const seuil = instant - jours * 86_400_000;
      return passages.filter(function (passage) {
        return new Date(passage.created_at).getTime() >= seuil;
      });
    },
    [instant, passages, periode],
  );
  const passagesFiltres = useMemo(
    function () {
      if (filtrePassage === 'tous') return passagesPeriode;
      return passagesPeriode.filter(function (passage) {
        return passage.statut === filtrePassage;
      });
    },
    [filtrePassage, passagesPeriode],
  );
  const paginationPassages = usePagination(passagesFiltres, 10);
  const paginationDepots = usePagination(depots, 10);

  async function confirmerBascule() {
    setEnregistrement(true);
    const { error } = await supabase
      .from('profils')
      .update({ actif: !fiche.actif })
      .eq('id', id);
    setEnregistrement(false);
    if (error) {
      setErreur(`La mise à jour a échoué : ${error.message}`);
      return;
    }
    setBascule(false);
    charger();
  }

  async function reaffecter(tourneeId, collecteurId) {
    setTourneeEnCours(tourneeId);
    const { error } = await supabase
      .from('tournees')
      .update({ collecteur_id: collecteurId || null })
      .eq('id', tourneeId);
    setTourneeEnCours(null);
    if (error) {
      setErreur(`La réaffectation a échoué : ${error.message}`);
      return;
    }
    charger();
  }

  if (!chargement && !activite && !profil) {
    return (
      <div className="w-full">
        <BandeauFiche
          kicker="Terrain · Collecteur"
          titre="Collecteur introuvable"
          hrefRetour="/dashboard/collecteurs"
          meta={{
            fil: [
              { href: '/dashboard/collecteurs', label: 'Collecteurs' },
              { label: 'Introuvable' },
            ],
          }}
        />
        <BandeauErreur message={erreur} onReessayer={charger} />
        <p className="mt-8 text-[13.5px] text-muted">
          Ce collecteur est introuvable ou n’est plus accessible.{' '}
          <Link
            href="/dashboard/collecteurs"
            className="cursor-pointer rounded-sm font-semibold text-txt outline-none hover:text-teal focus-visible:ring-2 focus-visible:ring-blue"
          >
            Retour à la liste des collecteurs
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <BandeauFiche
        kicker="Terrain · Collecteur"
        titre={chargement ? 'Chargement…' : nom}
        hrefRetour="/dashboard/collecteurs"
        badges={
          chargement ? null : fiche?.actif ? (
            dormant ? (
              <Badge ton="or">Inactif 7 j</Badge>
            ) : (
              <Badge ton="teal">En service</Badge>
            )
          ) : (
            <Badge ton="muted">Désactivé</Badge>
          )
        }
        meta={{
          fil: [
            { href: '/dashboard/collecteurs', label: 'Collecteurs' },
            { label: chargement ? 'Chargement…' : nom },
          ],
          ligne: chargement
            ? 'Chargement des informations…'
            : [
                telephone || 'Sans téléphone',
                quartiers || 'Aucune tournée',
                dernier ? `Dernier pointage ${ilYA(dernier)}` : 'Jamais pointé',
              ].join(' · '),
        }}
        actions={
          chargement || !fiche ? null : (
            <>
              {telephone ? (
                <a
                  href={`tel:${telephone}`}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line2 bg-transparent px-3.5 py-2.5 text-[13px] font-semibold text-txt outline-none transition-[filter] hover:bg-panel2 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-blue"
                >
                  Appeler
                </a>
              ) : null}
              <Btn
                variant={fiche.actif ? 'red' : 'green'}
                onClick={function () {
                  setBascule(true);
                }}
              >
                {fiche.actif ? 'Désactiver' : 'Réactiver'}
              </Btn>
            </>
          )
        }
      />

      <BandeauErreur message={erreur} onReessayer={charger} />

      <div className="mt-8 grid items-start gap-x-10 gap-y-9 xl:grid-cols-12">
        <div className="flex flex-col gap-9 xl:col-span-8">
          <BandeauMetriques
            metriques={[
              {
                label: 'Passages 7 jours',
                valeur: chargement ? '—' : nombre(activite?.nb_passages_semaine ?? valeurs7j.reduce((a, b) => a + b, 0)),
                sous: 'Pointages récents',
                ton: 'teal',
              },
              {
                label: 'Dépôts 7 jours',
                valeur: chargement ? '—' : nombre(activite?.nb_depots_semaine ?? depots7j),
                sous: 'Dépôts enregistrés',
              },
              {
                label: 'Passages total',
                valeur: chargement ? '—' : nombre(activite?.nb_passages_total),
                sous: 'Depuis l’inscription',
              },
              {
                label: 'Tournées actives',
                valeur: chargement
                  ? '—'
                  : nombre(
                      tournees.filter(function (tournee) {
                        return tournee.actif;
                      }).length,
                    ),
                sous: `${nombre(tournees.length)} affectée${tournees.length > 1 ? 's' : ''}`,
              },
            ]}
          />

          <Bloc titre="Activité 7 jours">
            {valeurs7j.every(function (valeur) {
              return valeur === 0;
            }) ? (
              <p className="m-0 text-[12.5px] text-muted2">Aucun passage sur les sept derniers jours.</p>
            ) : (
              <div>
                <MiniBarres valeurs={valeurs7j} accent="var(--lp-teal)" className="h-24" />
                <div className="mt-2 grid grid-cols-7 gap-1 text-center font-mono text-[9px] text-muted2">
                  {libelles7j.map(function (jour, i) {
                    return <span key={`${jour}-${i}`}>{jour}</span>;
                  })}
                </div>
              </div>
            )}
          </Bloc>

          <Bloc titre="Tournées affectées">
            {tournees.length === 0 ? (
              <p className="m-0 text-[12.5px] text-muted2">
                Aucune tournée affectée — réaffectez depuis le rail ou le planning.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line text-[10px] tracking-wide text-muted uppercase">
                      <th className="px-4 py-2.5 font-semibold">Jour</th>
                      <th className="px-4 py-2.5 font-semibold">Heure</th>
                      <th className="px-4 py-2.5 font-semibold">Quartier</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournees.map(function (tournee) {
                      return (
                        <tr key={tournee.id} className="border-b border-line last:border-b-0">
                          <td className="px-4 py-2.5 text-[12.5px] font-semibold text-txt">
                            {JOURS[Number(tournee.jour_semaine) - 1] || '—'}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[12px] text-muted tabular-nums">
                            {heureCourte(tournee.heure_debut)}
                          </td>
                          <td className="px-4 py-2.5 text-[12.5px] text-muted">
                            {relation(tournee.quartiers)?.nom || 'Sans quartier'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Badge ton={tournee.actif ? 'teal' : 'muted'}>
                              {tournee.actif ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Bloc>

          <Journal
            titre="Journal des passages"
            extra={
              passages.length > 30 ? (
                <Selecteur
                  value={periode}
                  aria-label="Période du journal des passages"
                  onChange={function (e) {
                    setPeriode(e.target.value);
                  }}
                >
                  <option value="7">7 jours</option>
                  <option value="30">30 jours</option>
                </Selecteur>
              ) : null
            }
            chips={
              FILTRES_PASSAGE.map(function (filtre) {
                return (
                  <Chip
                    key={filtre.code}
                    actif={filtrePassage === filtre.code}
                    onClick={function () {
                      setFiltrePassage(filtre.code);
                    }}
                  >
                    {filtre.label}
                  </Chip>
                );
              })
            }
            vide={
              chargement
                ? 'Chargement des passages…'
                : passagesFiltres.length === 0
                  ? 'Aucun passage sur cette période avec ce statut.'
                  : null
            }
            pied={
              <PaginationBar
                page={paginationPassages.page}
                pages={paginationPassages.pages}
                total={paginationPassages.total}
                onChange={paginationPassages.setPage}
              />
            }
          >
            {paginationPassages.tranche.map(function (passage, rang) {
              const menage = relation(passage.menages);
              const quartier = relation(menage?.quartiers)?.nom;
              const statut = STATUTS_PASSAGE[passage.statut] || {
                label: passage.statut || 'Sans statut',
                ton: 'muted',
              };
              return (
                <LigneJournal
                  key={passage.id}
                  href={`/dashboard/menages/${passage.menage_id}`}
                  rail={couleurTon(statut.ton)}
                  titre={
                    <span className="flex flex-wrap items-center gap-2">
                      {menage?.code_menage ? (
                        <span className="font-mono tabular-nums">{menage.code_menage}</span>
                      ) : (
                        <span>Ménage</span>
                      )}
                      <Badge ton={statut.ton}>{statut.label}</Badge>
                    </span>
                  }
                  sous={[menage?.point_repere, quartier].filter(Boolean).join(' · ') || 'Sans précision'}
                  droite={ilYA(passage.created_at)}
                  rang={rang}
                />
              );
            })}
          </Journal>

          <Journal
            titre="Journal des dépôts"
            vide={
              chargement
                ? 'Chargement des dépôts…'
                : depots.length === 0
                  ? 'Aucun dépôt sur les trente derniers jours.'
                  : null
            }
            pied={
              <PaginationBar
                page={paginationDepots.page}
                pages={paginationDepots.pages}
                total={paginationDepots.total}
                onChange={paginationDepots.setPage}
              />
            }
          >
            {paginationDepots.tranche.map(function (depot, rang) {
              const point = relation(depot.points_depot);
              const charrettes = Number(depot.nb_charrettes || 0);
              return (
                <LigneJournal
                  key={depot.id}
                  rail="var(--lp-green)"
                  titre={point?.nom || 'Point de dépôt'}
                  sous={
                    <>
                      <span className="font-mono tabular-nums">{nombre(charrettes)}</span>{' '}
                      charrette{charrettes > 1 ? 's' : ''}
                    </>
                  }
                  droite={ilYA(depot.created_at)}
                  rang={rang}
                />
              );
            })}
          </Journal>
        </div>

        <aside className="flex flex-col gap-9 xl:col-span-4">
          <Panel titre="Identité">
            <dl className="m-0">
              <LigneMeta label="Téléphone">
                {telephone ? (
                  <span className="font-mono tabular-nums">{telephone}</span>
                ) : (
                  <span className="text-muted2">Sans téléphone</span>
                )}
              </LigneMeta>
              <LigneMeta label="PME">{relation(profil?.pme)?.nom || 'Commune'}</LigneMeta>
              <LigneMeta label="Inscrit le">
                {profil?.created_at ? (
                  <span className="font-mono tabular-nums">
                    {new Date(profil.created_at).toLocaleDateString('fr-FR')}
                  </span>
                ) : (
                  '—'
                )}
              </LigneMeta>
            </dl>
          </Panel>

          <Panel titre="Actions">
            {tournees.length === 0 ? (
              <p className="m-0 text-[12.5px] text-muted2">Aucune tournée à réaffecter.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {tournees.map(function (tournee) {
                  return (
                    <div key={tournee.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
                      <p className="mt-0 mb-2 text-[12px] text-muted">
                        <b className="text-txt">
                          {relation(tournee.quartiers)?.nom || 'Sans quartier'}
                        </b>{' '}
                        · {JOURS[Number(tournee.jour_semaine) - 1] || 'Jour inconnu'}
                      </p>
                      <Selecteur
                        value={tournee.collecteur_id || ''}
                        disabled={tourneeEnCours === tournee.id}
                        aria-label={`Réaffecter la tournée ${relation(tournee.quartiers)?.nom || ''}`}
                        className="w-full"
                        onChange={function (e) {
                          reaffecter(tournee.id, e.target.value);
                        }}
                      >
                        <option value="">— Non affectée —</option>
                        {collegues.map(function (collegue) {
                          return (
                            <option key={collegue.id} value={collegue.id}>
                              {collegue.nom_complet}
                              {!collegue.actif ? ' (désactivé)' : ''}
                            </option>
                          );
                        })}
                      </Selecteur>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel titre="Lié">
            <p className="m-0 text-[12.5px] text-txt">
              {relation(profil?.pme)?.nom || 'Commune'}
            </p>
          </Panel>
        </aside>
      </div>

      <Modal
        ouvert={bascule}
        onFermer={function () {
          setBascule(false);
        }}
        titre={fiche?.actif ? 'Désactiver ce collecteur ?' : 'Réactiver ce collecteur ?'}
        taille="sm"
        bloquerFermeture={enregistrement}
        pied={
          <div className="flex flex-wrap justify-end gap-2">
            <Btn
              variant="ghost"
              disabled={enregistrement}
              onClick={function () {
                setBascule(false);
              }}
            >
              Annuler
            </Btn>
            <Btn
              variant={fiche?.actif ? 'red' : 'green'}
              disabled={enregistrement}
              onClick={confirmerBascule}
            >
              {enregistrement ? 'Patientez…' : fiche?.actif ? 'Désactiver' : 'Réactiver'}
            </Btn>
          </div>
        }
      >
        <p className="m-0 text-[13.5px] leading-relaxed text-muted">
          {fiche?.actif ? (
            <>
              <b className="text-txt">{nom}</b> ne pourra plus se connecter à l&apos;application de
              terrain ni pointer de passage. Ses tournées restent affectées — pensez à les
              réattribuer.
            </>
          ) : (
            <>
              <b className="text-txt">{nom}</b> retrouvera l&apos;accès à l&apos;application de
              terrain et pourra à nouveau pointer.
            </>
          )}
        </p>
      </Modal>
    </div>
  );
}
