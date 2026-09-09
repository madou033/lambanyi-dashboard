'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Badge,
  BandeauErreur,
  Btn,
  Chip,
  Modal,
  PageHeader,
  Selecteur,
  cn,
  nombre,
} from '@/components/ui';
import { BandeauMetriques, CarteListe, Recherche } from '@/components/liste';
import { useContexte } from '@/components/ContexteProvider';

/* ------------------------------------------------------------------ */
/* Page : Affectation périmètre                                        */
/* ------------------------------------------------------------------ */

export default function PerimetresPage() {
  const { ctx } = useContexte();
  const [pmes, setPmes] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [liens, setLiens] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [filtrePme, setFiltrePme] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);

  const [perimetre, setPerimetre] = useState(null);
  const [messageForm, setMessageForm] = useState(null);

  const estAdmin = ctx?.niveau === 'commune' && ctx.droits?.includes('ecrire');

  const charger = useCallback(async function () {
    const communeId = ctx?.communeId;
    if (!communeId) return;
    const [rPme, rQuartiers, rLiens] = await Promise.all([
      supabase.from('pme_apercu').select('*').order('nom'),
      supabase.from('quartiers').select('id, nom, code').eq('commune_id', communeId).eq('actif', true).order('nom'),
      supabase.from('pme_quartiers').select('pme_id, quartier_id'),
    ]);
    setChargement(false);
    if (rPme.error || rQuartiers.error || rLiens.error) {
      setErreur(`Chargement incomplet : ${[rPme.error, rQuartiers.error, rLiens.error].filter(Boolean).map(function (e) { return e.message; }).join(' · ')}`);
      return;
    }
    setErreur(null);
    setPmes(rPme.data || []);
    setQuartiers(rQuartiers.data || []);
    setLiens(rLiens.data || []);
  }, [ctx]);

  useEffect(function () {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  const liensIndex = useMemo(function () {
    const idx = {};
    liens.forEach(function (l) {
      if (!idx[l.pme_id]) idx[l.pme_id] = new Set();
      idx[l.pme_id].add(l.quartier_id);
    });
    return idx;
  }, [liens]);

  const quartiersLocaux = useMemo(function () {
    return new Set(quartiers.map(function (q) { return q.id; }));
  }, [quartiers]);

  const pmesFiltrees = useMemo(function () {
    const q = recherche.trim().toLowerCase();
    return pmes.filter(function (p) {
      if (q && !(p.nom ?? '').toLowerCase().includes(q) && !(p.responsable ?? '').toLowerCase().includes(q)) return false;
      if (filtrePme === 'avec' && !(liensIndex[p.id] && [...(liensIndex[p.id])].some(function (qid) { return quartiersLocaux.has(qid); }))) return false;
      if (filtrePme === 'sans' && liensIndex[p.id] && [...(liensIndex[p.id])].some(function (qid) { return quartiersLocaux.has(qid); })) return false;
      return true;
    });
  }, [pmes, recherche, filtrePme, liensIndex, quartiersLocaux]);

  const nbAvecPerimetre = pmes.filter(function (p) {
    return liensIndex[p.id] && [...(liensIndex[p.id])].some(function (qid) { return quartiersLocaux.has(qid); });
  }).length;
  const nbSansPerimetre = pmes.length - nbAvecPerimetre;
  const nbAffectations = liens.filter(function (l) { return quartiersLocaux.has(l.quartier_id); }).length;
  const quartiersAffectes = new Set(liens.filter(function (l) { return quartiersLocaux.has(l.quartier_id); }).map(function (l) { return l.quartier_id; })).size;

  /* -- Modale périmètre ------------------------------------------- */

  async function ouvrirPerimetre(pme) {
    setMessageForm(null);
    const { data } = await supabase
      .from('pme_quartiers')
      .select('quartier_id')
      .eq('pme_id', pme.id);
    setPerimetre({
      pme,
      ids: (data || []).map(function (x) { return x.quartier_id; }),
      initialIds: (data || []).map(function (x) { return x.quartier_id; }),
    });
  }

  function basculerQuartier(id) {
    setPerimetre(function (p) {
      return {
        ...p,
        ids: p.ids.includes(id)
          ? p.ids.filter(function (x) { return x !== id; })
          : [...p.ids, id],
      };
    });
  }

  function toutCocher() {
    setPerimetre(function (p) {
      const tousLocaux = quartiers.map(function (q) { return q.id; });
      const horsLocaux = p.ids.filter(function (id) { return !quartiersLocaux.has(id); });
      return { ...p, ids: [...horsLocaux, ...tousLocaux] };
    });
  }

  function toutDecocher() {
    setPerimetre(function (p) {
      return { ...p, ids: p.ids.filter(function (id) { return !quartiersLocaux.has(id); }) };
    });
  }

  async function enregistrerPerimetre() {
    setEnregistrement(true);
    setMessageForm(null);
    const initiauxLocaux = (perimetre.initialIds || []).filter(function (id) { return quartiersLocaux.has(id); });
    const actuelsLocaux = perimetre.ids.filter(function (id) { return quartiersLocaux.has(id); });
    const aSupprimer = initiauxLocaux.filter(function (id) { return !actuelsLocaux.includes(id); });
    const aAjouter = actuelsLocaux.filter(function (id) { return !initiauxLocaux.includes(id); });
    if (aSupprimer.length > 0) {
      const { error } = await supabase.from('pme_quartiers').delete().eq('pme_id', perimetre.pme.id).in('quartier_id', aSupprimer);
      if (error) { setEnregistrement(false); setMessageForm(`Erreur : ${error.message}`); return; }
    }
    if (aAjouter.length > 0) {
      const { error } = await supabase.from('pme_quartiers').insert(
        aAjouter.map(function (qid) { return { pme_id: perimetre.pme.id, quartier_id: qid }; }),
      );
      if (error) { setEnregistrement(false); setMessageForm(`Erreur : ${error.message}`); return; }
    }
    setEnregistrement(false);
    setPerimetre(null);
    charger();
  }

  /* -- Rendu ------------------------------------------------------ */

  return (
    <div className="w-full">
      <PageHeader
        kicker="Partenaires · Zones de collecte"
        titre="Affectation périmètre"
        sousTitre="Attribuez les quartiers de votre commune aux PME de collecte. Chaque quartier peut être confié à plusieurs opérateurs."
      />

      <BandeauErreur message={erreur} onReessayer={charger} />

      <BandeauMetriques
        metriques={[
          {
            label: 'PME enregistrées',
            valeur: chargement ? '—' : nombre(pmes.length),
            sous: `${nombre(nbAvecPerimetre)} avec périmètre local`,
            ton: 'teal',
          },
          {
            label: 'Sans périmètre',
            valeur: chargement ? '—' : nombre(nbSansPerimetre),
            sous: nbSansPerimetre > 0 ? 'PME sans quartier local' : 'Toutes affectées',
            ton: nbSansPerimetre > 0 ? 'or' : 'teal',
          },
          {
            label: 'Affectations',
            valeur: chargement ? '—' : nombre(nbAffectations),
            sous: 'Liens PME ↔ quartier',
          },
          {
            label: 'Quartiers couverts',
            valeur: chargement ? '—' : nombre(quartiersAffectes),
            sous: `Sur ${nombre(quartiers.length)} au référentiel`,
            ton: quartiersAffectes < quartiers.length ? 'or' : 'teal',
          },
        ]}
      />

      {/* Toolbar */}
      <div className="lp-rise mt-6 flex flex-wrap items-center gap-2" style={{ animationDelay: '60ms' }}>
        <div className="flex flex-wrap gap-1.5">
          <Chip actif={filtrePme === ''} onClick={function () { setFiltrePme(''); }}>Toutes</Chip>
          <Chip actif={filtrePme === 'avec'} onClick={function () { setFiltrePme('avec'); }}>Avec périmètre</Chip>
          <Chip actif={filtrePme === 'sans'} onClick={function () { setFiltrePme('sans'); }}>Sans périmètre</Chip>
        </div>
        <div className="flex-1" />
        <Recherche valeur={recherche} onChange={setRecherche} placeholder="Nom de PME, responsable…" />
      </div>

      {/* Liste des PME */}
      <div className="mt-7">
        <CarteListe
          titre="Périmètres de collecte"
          sousTitre={`${nombre(pmesFiltrees.length)} PME`}
        >
          {chargement ? (
            <p className="m-0 text-[12px] text-muted2">Chargement…</p>
          ) : pmesFiltrees.length === 0 ? (
            <p className="m-0 py-6 text-center text-[13px] text-muted2">
              Aucune PME ne correspond à ces filtres.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {pmesFiltrees.map(function (p, rang) {
                const quartiersLocauxPme = liensIndex[p.id]
                  ? [...(liensIndex[p.id])].filter(function (qid) { return quartiersLocaux.has(qid); })
                  : [];
                const nomsQuartiers = quartiersLocauxPme.map(function (qid) {
                  const q = quartiers.find(function (x) { return x.id === qid; });
                  return q ? q.nom : '?';
                }).sort().join(', ');
                return (
                  <article
                    key={p.id}
                    className={cn(
                      'lp-rise flex flex-col rounded-xl border p-4 transition-colors',
                      p.actif ? 'border-line bg-panel' : 'border-dashed border-line opacity-65',
                    )}
                    style={{ animationDelay: `${Math.min(rang, 8) * 45}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display m-0 truncate text-[17px] leading-tight font-bold text-txt">
                          {p.nom}
                        </h3>
                        <p className="m-0 mt-1 truncate text-[12px] text-muted">
                          {p.responsable || <span className="text-muted2">Responsable non renseigné</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge ton={p.actif ? 'teal' : 'muted'}>{p.actif ? 'Agréée' : 'Suspendue'}</Badge>
                        <span className="font-mono text-[15px] font-bold tabular-nums text-txt">
                          {nombre(quartiersLocauxPme.length)}
                        </span>
                        <span className="text-[10px] text-muted2">quartier{quartiersLocauxPme.length > 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    <div className="mt-3 min-h-[28px] border-t border-line pt-3">
                      <p className="m-0 line-clamp-2 text-[11.5px] text-muted">
                        {nomsQuartiers || (
                          <span className="text-gold">Aucun quartier affecté — cette PME ne collecte pas dans votre commune.</span>
                        )}
                      </p>
                    </div>

                    {estAdmin ? (
                      <div className="mt-3 flex justify-end">
                        <Btn
                          variant="ghost"
                          className="cursor-pointer py-2"
                          onClick={function () { ouvrirPerimetre(p); }}
                        >
                          Modifier le périmètre
                        </Btn>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </CarteListe>
      </div>

      {/* Modale périmètre */}
      <Modal
        ouvert={Boolean(perimetre)}
        onFermer={function () { setPerimetre(null); }}
        titre="Périmètre de collecte"
        sousTitre={
          perimetre
            ? `${perimetre.pme.nom} · ${perimetre.ids.filter(function (id) { return quartiersLocaux.has(id); }).length} quartier${perimetre.ids.filter(function (id) { return quartiersLocaux.has(id); }).length > 1 ? 's' : ''} sélectionné${perimetre.ids.filter(function (id) { return quartiersLocaux.has(id); }).length > 1 ? 's' : ''}`
            : ''
        }
        taille="lg"
        bloquerFermeture={enregistrement}
        pied={
          <div className="flex flex-wrap justify-end gap-2">
            <Btn variant="ghost" disabled={enregistrement} onClick={function () { setPerimetre(null); }}>
              Annuler
            </Btn>
            <Btn variant="green" disabled={enregistrement} onClick={enregistrerPerimetre}>
              {enregistrement ? 'Enregistrement…' : 'Enregistrer le périmètre'}
            </Btn>
          </div>
        }
      >
        {messageForm ? (
          <p className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--lp-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-red)_14%,transparent)] px-4 py-2.5 text-[12.5px] text-txt">
            {messageForm}
          </p>
        ) : null}

        <p className="mt-0 mb-4 text-[12.5px] text-muted">
          Un quartier peut être confié à plusieurs opérateurs. Décocher un quartier retire la PME de
          son périmètre sans toucher aux tournées déjà planifiées.
        </p>

        <div className="mb-4 flex gap-2">
          <Btn variant="ghost" onClick={toutCocher} className="cursor-pointer text-[11px]">
            Tout cocher
          </Btn>
          <Btn variant="ghost" onClick={toutDecocher} className="cursor-pointer text-[11px]">
            Tout décocher
          </Btn>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {quartiers.map(function (q) {
            const coche = perimetre?.ids.includes(q.id);
            return (
              <button
                key={q.id}
                type="button"
                onClick={function () { basculerQuartier(q.id); }}
                aria-pressed={coche}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left outline-none transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-blue',
                  coche
                    ? 'border-green bg-[color-mix(in_srgb,var(--lp-green)_12%,transparent)]'
                    : 'border-line hover:border-line2 hover:bg-panel2',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid size-4 shrink-0 place-items-center rounded border-2 transition-colors',
                    coche ? 'border-green bg-green' : 'border-line2',
                  )}
                >
                  {coche ? (
                    <svg viewBox="0 0 12 12" className="size-2.5 text-encre" fill="none">
                      <path
                        d="M2.5 6.2 4.8 8.5 9.5 3.8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-txt">{q.nom}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted2">{q.code}</span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
