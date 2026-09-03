'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useContexte } from '@/components/ContexteProvider';
import { cheminContexte } from '@/lib/contexte';
import {
  Badge,
  BandeauErreur,
  EmptyState,
  PageHeader,
  nombre,
} from '@/components/ui';
import { BandeauMetriques, CarteListe, Recherche } from '@/components/liste';

/**
 * Façade régionale de /dashboard/pme :
 * - Conakry : index des communes
 * - Commune choisie : liste des PME (créatrices ou adoptantes)
 */
export default function PmeRegional() {
  const { ctx, setLectureCommune, communeLecture } = useContexte();
  const communeId = ctx?.lectureCommuneId || null;
  const [communes, setCommunes] = useState([]);
  const [pmes, setPmes] = useState([]);
  const [liens, setLiens] = useState([]);
  const [createurs, setCreateurs] = useState({});
  const [collecteurs, setCollecteurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [recherche, setRecherche] = useState('');

  const charger = useCallback(async function () {
    setChargement(true);
    const [rCommunes, rPme, rLiens, rCreateurs, rCollecteurs] = await Promise.all([
      supabase.from('communes').select('id, nom, code').eq('active', true).order('nom'),
      supabase.from('pme_apercu').select('*').order('nom'),
      supabase.from('pme_quartiers').select('pme_id, quartier_id, quartiers(id, nom, commune_id)'),
      supabase.from('pme').select('id, commune_creatrice_id'),
      supabase.from('profils').select('id, pme_id, actif').eq('role', 'collecteur'),
    ]);
    const premiere = [rCommunes, rPme, rLiens, rCreateurs, rCollecteurs].find(
      function (r) {
        return r.error;
      },
    );
    setChargement(false);
    if (premiere) {
      setErreur(`Impossible de charger les PME : ${premiere.error.message}`);
      return;
    }
    setErreur(null);
    setCommunes(rCommunes.data || []);
    setPmes(rPme.data || []);
    setLiens(rLiens.data || []);
    setCreateurs(
      (rCreateurs.data || []).reduce(function (index, p) {
        index[p.id] = p.commune_creatrice_id;
        return index;
      }, {}),
    );
    setCollecteurs(rCollecteurs.data || []);
  }, []);

  useEffect(
    function () {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      charger();
    },
    [charger],
  );

  const statsParCommune = useMemo(
    function () {
      return communes.map(function (commune) {
        const idsPme = new Set();
        Object.keys(createurs).forEach(function (pmeId) {
          if (createurs[pmeId] === commune.id) idsPme.add(pmeId);
        });
        const quartiersLocaux = new Set();
        liens.forEach(function (lien) {
          if (lien.quartiers?.commune_id === commune.id) {
            idsPme.add(lien.pme_id);
            quartiersLocaux.add(lien.quartier_id);
          }
        });
        const agents = collecteurs.filter(function (c) {
          return c.pme_id && idsPme.has(c.pme_id);
        }).length;
        return {
          ...commune,
          nbPme: idsPme.size,
          nbQuartiers: quartiersLocaux.size,
          nbCollecteurs: agents,
        };
      });
    },
    [communes, createurs, liens, collecteurs],
  );

  const pmesDeLaCommune = useMemo(
    function () {
      if (!communeId) return [];
      const ids = new Set();
      Object.keys(createurs).forEach(function (pmeId) {
        if (createurs[pmeId] === communeId) ids.add(pmeId);
      });
      liens.forEach(function (lien) {
        if (lien.quartiers?.commune_id === communeId) ids.add(lien.pme_id);
      });
      const q = recherche.trim().toLowerCase();
      return pmes
        .filter(function (p) {
          return ids.has(p.id);
        })
        .map(function (p) {
          const quartiersIci = liens
            .filter(function (lien) {
              return lien.pme_id === p.id && lien.quartiers?.commune_id === communeId;
            })
            .map(function (lien) {
              return lien.quartiers?.nom;
            })
            .filter(Boolean);
          const agents = collecteurs.filter(function (c) {
            return c.pme_id === p.id;
          }).length;
          return {
            ...p,
            commune_creatrice_id: createurs[p.id],
            estCreatrice: createurs[p.id] === communeId,
            quartiersIci,
            nbCollecteurs: agents,
          };
        })
        .filter(function (p) {
          if (!q) return true;
          return `${p.nom ?? ''} ${p.responsable ?? ''} ${p.quartiersIci.join(' ')}`
            .toLowerCase()
            .includes(q);
        });
    },
    [communeId, createurs, liens, pmes, collecteurs, recherche],
  );

  if (!communeId) {
    return (
      <div className="w-full">
        <PageHeader
          kicker="Région · Partenaires de collecte"
          titre="PME"
          sousTitre="Choisissez une commune pour parcourir les entreprises qui y collectent — créatrices ou adoptées."
        />
        <BandeauErreur message={erreur} onReessayer={charger} />
        <BandeauMetriques
          metriques={[
            {
              label: 'Communes',
              valeur: chargement ? '—' : nombre(communes.length),
              sous: 'Région de Conakry',
            },
            {
              label: 'PME agréées',
              valeur: chargement ? '—' : nombre(pmes.filter((p) => p.actif).length),
              sous: `${nombre(pmes.length)} au total`,
              ton: 'teal',
            },
            {
              label: 'Collecteurs',
              valeur: chargement ? '—' : nombre(collecteurs.length),
              sous: 'Tous opérateurs',
            },
          ]}
        />
        <CarteListe
          titre="PME par commune"
          sousTitre={
            chargement
              ? 'Chargement…'
              : `${nombre(statsParCommune.length)} communes · cliquez pour entrer`
          }
        >
          {chargement ? (
            <p className="m-0 px-5 py-8 text-center text-[13px] text-muted2">Chargement…</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {statsParCommune.map(function (commune, rang) {
                return (
                  <button
                    key={commune.id}
                    type="button"
                    onClick={function () {
                      setLectureCommune(commune.id);
                    }}
                    className="lp-rise cursor-pointer rounded-xl border border-line bg-bg2 p-4 text-left outline-none transition-colors hover:border-line2 hover:bg-panel2 focus-visible:ring-2 focus-visible:ring-blue"
                    style={{ animationDelay: `${Math.min(rang, 10) * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display m-0 truncate text-[17px] font-bold text-txt">
                          {commune.nom}
                        </h3>
                        <p className="m-0 mt-0.5 font-mono text-[11px] tracking-wide text-muted2">
                          {commune.code}
                        </p>
                      </div>
                      <Badge ton={commune.nbPme > 0 ? 'teal' : 'muted'}>
                        {nombre(commune.nbPme)} PME
                      </Badge>
                    </div>
                    <dl className="m-0 mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                      <div>
                        <dt className="text-[9.5px] tracking-[1.4px] text-muted2 uppercase">
                          Quartiers couverts
                        </dt>
                        <dd className="m-0 mt-0.5 font-mono text-[17px] font-bold text-txt tabular-nums">
                          {nombre(commune.nbQuartiers)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[9.5px] tracking-[1.4px] text-muted2 uppercase">
                          Collecteurs
                        </dt>
                        <dd className="m-0 mt-0.5 font-mono text-[17px] font-bold text-txt tabular-nums">
                          {nombre(commune.nbCollecteurs)}
                        </dd>
                      </div>
                    </dl>
                  </button>
                );
              })}
            </div>
          )}
        </CarteListe>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        kicker={`Région · ${communeLecture?.nom ?? 'Commune'}`}
        titre="PME"
        sousTitre="Entreprises créatrices ou adoptées sur cette commune. Lecture seule — la mairie gère les agréments."
        actions={
          <button
            type="button"
            onClick={function () {
              setLectureCommune(null);
            }}
            className="cursor-pointer rounded-xl border border-line2 px-3 py-2 text-[12.5px] text-muted outline-none hover:text-txt focus-visible:ring-2 focus-visible:ring-blue"
          >
            ← Toutes les communes
          </button>
        }
      />
      <BandeauErreur message={erreur} onReessayer={charger} />
      <BandeauMetriques
        metriques={[
          {
            label: 'PME ici',
            valeur: chargement ? '—' : nombre(pmesDeLaCommune.length),
            sous: 'Créatrices et adoptées',
            ton: 'teal',
          },
          {
            label: 'Créatrices',
            valeur: chargement
              ? '—'
              : nombre(pmesDeLaCommune.filter((p) => p.estCreatrice).length),
            sous: 'Fiche portée par la mairie',
          },
          {
            label: 'Adoptées',
            valeur: chargement
              ? '—'
              : nombre(pmesDeLaCommune.filter((p) => !p.estCreatrice).length),
            sous: 'Périmètre seulement',
          },
        ]}
      />
      <div className="mt-6 flex justify-end">
        <Recherche valeur={recherche} onChange={setRecherche} placeholder="Nom, responsable…" />
      </div>
      <CarteListe
        titre={`Opérateurs — ${communeLecture?.nom ?? 'commune'}`}
        sousTitre={
          chargement
            ? 'Chargement…'
            : `${nombre(pmesDeLaCommune.length)} PME`
        }
      >
        {chargement ? (
          <p className="m-0 px-5 py-8 text-center text-[13px] text-muted2">Chargement…</p>
        ) : pmesDeLaCommune.length === 0 ? (
          <div className="px-5 py-8">
            <EmptyState>
              Aucune PME n’est encore créatrice ni adoptée sur cette commune.
            </EmptyState>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {pmesDeLaCommune.map(function (p, rang) {
              return (
                <Link
                  key={p.id}
                  href={cheminContexte(`/dashboard/pme/${p.id}`, ctx)}
                  className="lp-rise block cursor-pointer rounded-xl border border-line bg-bg2 p-4 outline-none transition-colors hover:border-line2 hover:bg-panel2 focus-visible:ring-2 focus-visible:ring-blue"
                  style={{ animationDelay: `${Math.min(rang, 8) * 45}ms` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display m-0 truncate text-[17px] font-bold text-txt">
                      {p.nom}
                    </h3>
                    <Badge ton={p.actif ? 'teal' : 'muted'}>
                      {p.actif ? 'Agréée' : 'Suspendue'}
                    </Badge>
                  </div>
                  <p className="m-0 mt-1 truncate text-[12px] text-muted">
                    {p.responsable || 'Responsable non renseigné'}
                  </p>
                  <div className="mt-2">
                    <Badge ton={p.estCreatrice ? 'teal' : 'bleu'}>
                      {p.estCreatrice ? 'Créatrice' : 'Adoptée'}
                    </Badge>
                  </div>
                  <dl className="m-0 mt-3 grid grid-cols-2 gap-2 border-y border-line py-3">
                    <div>
                      <dt className="text-[9.5px] tracking-[1.4px] text-muted2 uppercase">
                        Quartiers ici
                      </dt>
                      <dd className="m-0 mt-0.5 font-mono text-[17px] font-bold text-txt tabular-nums">
                        {nombre(p.quartiersIci.length)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9.5px] tracking-[1.4px] text-muted2 uppercase">
                        Collecteurs
                      </dt>
                      <dd className="m-0 mt-0.5 font-mono text-[17px] font-bold text-txt tabular-nums">
                        {nombre(p.nbCollecteurs)}
                      </dd>
                    </div>
                  </dl>
                  <p className="m-0 mt-2 line-clamp-2 text-[11.5px] text-muted">
                    {p.quartiersIci.length
                      ? p.quartiersIci.join(', ')
                      : 'Aucun quartier sur cette commune'}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </CarteListe>
    </div>
  );
}
