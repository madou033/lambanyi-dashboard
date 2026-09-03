'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useContexte } from '@/components/ContexteProvider';
import { cheminContexte } from '@/lib/contexte';
import { BandeauFiche, LigneMeta } from '@/components/fiche';
import {
  Badge,
  BandeauErreur,
  Bloc,
  EmptyState,
  Panel,
  cn,
  ilYA,
  nombre,
} from '@/components/ui';
import { BandeauMetriques, Tableau, Td, Tr } from '@/components/liste';

export default function FichePmePage() {
  const { id } = useParams();
  const { ctx, communeLecture } = useContexte();
  const lectureCommuneId = ctx?.lectureCommuneId || null;
  const [pme, setPme] = useState(null);
  const [creatrice, setCreatrice] = useState(null);
  const [perimetre, setPerimetre] = useState([]);
  const [collecteurs, setCollecteurs] = useState([]);
  const [tournees, setTournees] = useState(0);
  const [signalements, setSignalements] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async function () {
    if (!id) return;
    setChargement(true);
    const [rPme, rLiens, rCollecteurs] = await Promise.all([
      supabase
        .from('pme')
        .select(
          'id, nom, responsable, telephone, email, numero_agrement, actif, created_at, commune_creatrice_id, communes:commune_creatrice_id(id, nom, code)',
        )
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('pme_quartiers')
        .select('quartier_id, quartiers(id, nom, code, commune_id, communes(id, nom, code))')
        .eq('pme_id', id),
      supabase
        .from('profils')
        .select('id, nom_complet, telephone, actif, created_at')
        .eq('role', 'collecteur')
        .eq('pme_id', id)
        .order('nom_complet'),
    ]);

    if (rPme.error || !rPme.data) {
      setChargement(false);
      setErreur(rPme.error?.message || 'PME introuvable');
      return;
    }

    const liens = rLiens.data || [];
    const idsQuartiers = liens.map(function (l) {
      return l.quartier_id;
    });

    const [rTournees, rSignalements, rActivite] = await Promise.all([
      idsQuartiers.length
        ? supabase
            .from('tournees')
            .select('id', { count: 'exact', head: true })
            .eq('actif', true)
            .in('quartier_id', idsQuartiers)
        : Promise.resolve({ count: 0, error: null }),
      idsQuartiers.length
        ? supabase
            .from('signalements')
            .select('id', { count: 'exact', head: true })
            .in('statut', ['nouveau', 'en_cours'])
            .in('quartier_id', idsQuartiers)
        : Promise.resolve({ count: 0, error: null }),
      supabase.from('collecteurs_activite').select('*').eq('pme_id', id),
    ]);

    const activiteParId = (rActivite.data || []).reduce(function (index, ligne) {
      index[ligne.id] = ligne;
      return index;
    }, {});

    setPme(rPme.data);
    setCreatrice(rPme.data.communes || null);
    setPerimetre(
      liens.map(function (lien) {
        return {
          id: lien.quartier_id,
          nom: lien.quartiers?.nom,
          code: lien.quartiers?.code,
          commune_id: lien.quartiers?.commune_id,
          commune_nom: lien.quartiers?.communes?.nom,
          commune_code: lien.quartiers?.communes?.code,
        };
      }),
    );
    setCollecteurs(
      (rCollecteurs.data || []).map(function (c) {
        const act = activiteParId[c.id];
        return {
          ...c,
          quartier: act?.quartier || null,
          nb_passages_semaine: act?.nb_passages_semaine ?? 0,
          dernier_passage: act?.dernier_passage || null,
        };
      }),
    );
    setTournees(rTournees.count || 0);
    setSignalements(rSignalements.count || 0);
    setErreur(
      [rLiens.error, rCollecteurs.error, rTournees.error, rSignalements.error, rActivite.error]
        .filter(Boolean)
        .map(function (e) {
          return e.message;
        })
        .join(' · ') || null,
    );
    setChargement(false);
  }, [id]);

  useEffect(
    function () {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      charger();
    },
    [charger],
  );

  const perimetreAffiche = useMemo(
    function () {
      if (!lectureCommuneId) return perimetre;
      return perimetre.filter(function (q) {
        return q.commune_id === lectureCommuneId;
      });
    },
    [perimetre, lectureCommuneId],
  );

  const autresCommunes = useMemo(
    function () {
      if (!lectureCommuneId) return [];
      const noms = new Map();
      perimetre.forEach(function (q) {
        if (q.commune_id && q.commune_id !== lectureCommuneId && q.commune_nom) {
          noms.set(q.commune_id, q.commune_nom);
        }
      });
      return [...noms.values()];
    },
    [perimetre, lectureCommuneId],
  );

  const parCommune = useMemo(
    function () {
      const index = new Map();
      perimetreAffiche.forEach(function (q) {
        const cle = q.commune_id || 'x';
        if (!index.has(cle)) {
          index.set(cle, {
            id: cle,
            nom: q.commune_nom || 'Sans commune',
            code: q.commune_code,
            quartiers: [],
          });
        }
        index.get(cle).quartiers.push(q);
      });
      return [...index.values()].sort(function (a, b) {
        return a.nom.localeCompare(b.nom, 'fr');
      });
    },
    [perimetreAffiche],
  );

  const agentsActifs = collecteurs.filter(function (c) {
    return c.actif;
  }).length;

  if (chargement && !pme) {
    return (
      <p className="m-0 py-16 text-center font-mono text-[12px] tracking-[2px] text-muted2 uppercase">
        Ouverture de la fiche…
      </p>
    );
  }

  if (!pme) {
    return <BandeauErreur message={erreur || 'PME introuvable'} onReessayer={charger} />;
  }

  return (
    <div className="w-full">
      <BandeauFiche
        hrefRetour={cheminContexte('/dashboard/pme', ctx)}
        kicker="Partenaire de collecte"
        titre={pme.nom}
        badges={
          <>
            <Badge ton={pme.actif ? 'teal' : 'muted'}>{pme.actif ? 'Agréée' : 'Suspendue'}</Badge>
            {creatrice ? <Badge ton="bleu">Créée à {creatrice.nom}</Badge> : null}
          </>
        }
        meta={{
          fil: [
            { label: 'PME', href: cheminContexte('/dashboard/pme', ctx) },
            { label: pme.nom },
          ],
          ligne: [
            pme.responsable,
            pme.numero_agrement ? `Agrément ${pme.numero_agrement}` : null,
            communeLecture?.nom ? `Lecture · ${communeLecture.nom}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
        }}
      />

      <BandeauErreur message={erreur} onReessayer={charger} />

      <BandeauMetriques
        metriques={[
          {
            label: 'Quartiers',
            valeur: nombre(perimetreAffiche.length),
            sous: lectureCommuneId
              ? 'Sur cette commune'
              : `${nombre(parCommune.length)} commune${parCommune.length > 1 ? 's' : ''}`,
          },
          {
            label: 'Collecteurs',
            valeur: nombre(agentsActifs),
            sous: `${nombre(collecteurs.length)} au total`,
            ton: 'teal',
          },
          {
            label: 'Tournées actives',
            valeur: nombre(tournees),
            sous: 'Sur le périmètre',
          },
          {
            label: 'Signalements ouverts',
            valeur: nombre(signalements),
            sous: 'Nouveau ou en cours',
            ton: signalements > 0 ? 'or' : 'defaut',
          },
        ]}
      />

      {autresCommunes.length > 0 ? (
        <p className="mt-4 mb-0 text-[12.5px] text-muted">
          Aussi présente à {autresCommunes.join(', ')} — élargissez le territoire à Conakry pour tout
          voir.
        </p>
      ) : null}

      <div className="mt-9 grid items-start gap-x-10 gap-y-9 xl:grid-cols-12">
        <div className="flex flex-col gap-9 xl:col-span-8">
          <Bloc titre="Périmètre de collecte" delai={40}>
            {parCommune.length === 0 ? (
              <EmptyState>
                {lectureCommuneId
                  ? 'Aucun quartier de cette commune n’est affecté à cette PME.'
                  : 'Aucun quartier n’est encore affecté.'}
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-5">
                {parCommune.map(function (groupe) {
                  return (
                    <div key={groupe.id}>
                      <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
                        <h3 className="m-0 text-[12.5px] font-semibold text-txt">{groupe.nom}</h3>
                        <span className="font-mono text-[11px] text-muted2 tabular-nums">
                          {nombre(groupe.quartiers.length)} quartier
                          {groupe.quartiers.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                        {groupe.quartiers.map(function (q) {
                          return (
                            <li
                              key={q.id}
                              className="rounded-lg border border-line bg-bg2 px-2.5 py-1 text-[12px] text-txt"
                            >
                              {q.nom}
                              {q.code ? (
                                <span className="ml-1.5 font-mono text-[10px] text-muted2">
                                  {q.code}
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </Bloc>

          <Bloc titre="Collecteurs enregistrés" delai={80}>
            {collecteurs.length === 0 ? (
              <EmptyState>Aucun collecteur n’est rattaché à cette PME.</EmptyState>
            ) : (
              <Tableau
                colonnes={[
                  { cle: 'nom', label: 'Agent' },
                  { cle: 'tel', label: 'Téléphone' },
                  { cle: 'quartiers', label: 'Tournées' },
                  { cle: 'passages', label: 'Passages 7 j' },
                  { cle: 'statut', label: 'Statut' },
                ]}
              >
                {collecteurs.map(function (c, rang) {
                  return (
                    <Tr key={c.id} rang={rang} href={`/dashboard/collecteurs/${c.id}`}>
                      <Td className="font-semibold text-txt">{c.nom_complet}</Td>
                      <Td className="font-mono text-[12px]">{c.telephone || '—'}</Td>
                      <Td className="max-w-[180px] truncate text-muted" title={c.quartier || undefined}>
                        {c.quartier || 'Aucune tournée'}
                      </Td>
                      <Td className="font-mono tabular-nums">{nombre(c.nb_passages_semaine)}</Td>
                      <Td>
                        <Badge ton={c.actif ? 'teal' : 'muted'}>
                          {c.actif ? 'En service' : 'Désactivé'}
                        </Badge>
                        {c.dernier_passage ? (
                          <span className="mt-1 block text-[10px] text-muted2">
                            Vu {ilYA(c.dernier_passage)}
                          </span>
                        ) : null}
                      </Td>
                    </Tr>
                  );
                })}
              </Tableau>
            )}
          </Bloc>
        </div>

        <div className="xl:col-span-4">
          <Panel titre="Fiche" className="lp-rise" style={{ animationDelay: '120ms' }}>
            <dl className="m-0">
              <LigneMeta label="Responsable">{pme.responsable || '—'}</LigneMeta>
              <LigneMeta label="Téléphone">
                <span className="font-mono">{pme.telephone || '—'}</span>
              </LigneMeta>
              <LigneMeta label="Email">{pme.email || '—'}</LigneMeta>
              <LigneMeta label="Agrément">
                <span className="font-mono">{pme.numero_agrement || '—'}</span>
              </LigneMeta>
              <LigneMeta label="Créatrice">{creatrice?.nom || '—'}</LigneMeta>
              <LigneMeta label="Depuis">
                {pme.created_at
                  ? new Date(pme.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'}
              </LigneMeta>
            </dl>
            <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
              <Link
                href={cheminContexte('/dashboard/collecteurs', ctx)}
                className={cn(
                  'cursor-pointer rounded-lg border border-line px-3 py-2 text-[12.5px] text-txt',
                  'outline-none hover:bg-panel2 focus-visible:ring-2 focus-visible:ring-blue',
                )}
              >
                Voir les collecteurs →
              </Link>
              <Link
                href={cheminContexte('/dashboard/tournees', ctx)}
                className={cn(
                  'cursor-pointer rounded-lg border border-line px-3 py-2 text-[12.5px] text-txt',
                  'outline-none hover:bg-panel2 focus-visible:ring-2 focus-visible:ring-blue',
                )}
              >
                Voir les tournées →
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
