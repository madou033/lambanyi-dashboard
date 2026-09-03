'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Badge,
  BandeauErreur,
  Bloc,
  Btn,
  Champ,
  PageHeader,
  cn,
  montant,
  nombre,
} from '@/components/ui';
import { BandeauMetriques } from '@/components/liste';
import { peutEcrire } from '@/lib/contexte';
import { useContexte } from '@/components/ContexteProvider';

const TYPES = [
  {
    code: 'residentiel',
    label: 'Résidentiel',
    description: 'Foyers d’habitation',
    accent: 'var(--lp-green)',
  },
  {
    code: 'commerce',
    label: 'Commerce',
    description: 'Boutiques, restaurants, marchés',
    accent: 'var(--lp-blue)',
  },
  {
    code: 'institution',
    label: 'Institution',
    description: 'Écoles, administrations, santé',
    accent: 'var(--lp-gold)',
  },
  {
    code: 'industrie',
    label: 'Industrie',
    description: 'Ateliers et unités de production',
    accent: 'var(--lp-violet)',
  },
];

/* ------------------------------------------------------------------ */
/* Carte de plan                                                       */
/* ------------------------------------------------------------------ */

function CartePlan({ plan, accent, rang, onEnregistrer, onBasculer, occupe, editable }) {
  const [valeur, setValeur] = useState(String(plan.montant_gnf));
  const [edite, setEdite] = useState(false);
  const [montantVu, setMontantVu] = useState(plan.montant_gnf);

  // Le champ se recale sur le montant enregistré, pendant le rendu.
  if (montantVu !== plan.montant_gnf) {
    setMontantVu(plan.montant_gnf);
    setValeur(String(plan.montant_gnf));
    setEdite(false);
  }

  const modifie = edite && String(parseInt(valeur, 10) || 0) !== String(plan.montant_gnf);
  const parJour = plan.duree_jours > 0 ? plan.montant_gnf / plan.duree_jours : 0;

  return (
    <article
      className={cn(
        'lp-rise flex flex-col rounded-xl border p-4 transition-colors',
        plan.actif ? 'border-line bg-panel' : 'border-dashed border-line opacity-60',
      )}
      style={{ animationDelay: `${Math.min(rang, 8) * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-sm"
              style={{ background: plan.actif ? accent : 'var(--lp-line2)' }}
            />
            <span className="font-mono text-[12.5px] font-bold text-txt">{plan.code}</span>
          </div>
          <p className="m-0 mt-1.5 text-[12.5px] text-muted">{plan.libelle}</p>
        </div>
        <Badge ton={plan.actif ? 'teal' : 'muted'}>{plan.actif ? 'Actif' : 'Retiré'}</Badge>
      </div>

      <dl className="m-0 mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3">
        <div>
          <dt className="text-[9.5px] tracking-[1.4px] text-muted2 uppercase">Passages</dt>
          <dd className="m-0 mt-0.5 font-mono text-[13px] font-bold text-txt tabular-nums">
            {plan.passages_par_semaine}/semaine
          </dd>
        </div>
        <div>
          <dt className="text-[9.5px] tracking-[1.4px] text-muted2 uppercase">Durée</dt>
          <dd className="m-0 mt-0.5 font-mono text-[13px] font-bold text-txt tabular-nums">
            {plan.duree_jours} jours
          </dd>
        </div>
      </dl>

      {editable ? <label className="mt-3.5 block">
        <span className="mb-1.5 flex items-baseline justify-between text-[9.5px] tracking-[1.4px] text-muted uppercase">
          Montant mensuel
          <span className="font-mono tracking-normal text-muted2 normal-case">
            ≈ {nombre(Math.round(parJour))} GNF/jour
          </span>
        </span>
        <div className="flex gap-2">
          <Champ
            type="number"
            min="0"
            step="1000"
            value={valeur}
            onChange={function (e) {
              setValeur(e.target.value);
              setEdite(true);
            }}
            className="font-mono tabular-nums"
          />
          <Btn
            variant={modifie ? 'green' : 'ghost'}
            disabled={!modifie || occupe}
            onClick={function () {
              onEnregistrer(plan, valeur);
            }}
            className="shrink-0 px-3 py-2"
          >
            {occupe ? '…' : 'OK'}
          </Btn>
        </div>
      </label> : null}

      {editable ? <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="font-mono text-[15px] font-bold text-txt tabular-nums">
          {montant(plan.montant_gnf)}
        </span>
        <button
          type="button"
          disabled={occupe}
          onClick={function () {
            onBasculer(plan);
          }}
          className="cursor-pointer rounded-lg border border-line2 px-2.5 py-1 text-[11px] font-semibold text-muted outline-none transition-colors hover:text-txt focus-visible:ring-2 focus-visible:ring-blue disabled:opacity-40"
        >
          {plan.actif ? 'Retirer' : 'Remettre'}
        </button>
      </div> : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TarifsPage() {
  const { ctx } = useContexte();
  const [plans, setPlans] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(async function () {
    let requete = supabase
      .from('plans_tarifaires')
      .select('id, code, libelle, montant_gnf, passages_par_semaine, type_menage, duree_jours, actif, commune_id, communes(nom, code)')
      .order('type_menage')
      .order('passages_par_semaine');
    if (peutEcrire(ctx) && ctx?.communeId) requete = requete.eq('commune_id', ctx.communeId);
    const { data, error } = await requete;
    setChargement(false);
    if (error) {
      setErreur(`Impossible de charger la grille : ${error.message}`);
      return;
    }
    setErreur(null);
    setPlans(data || []);
  }, [ctx]);

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

  const parType = useMemo(
    function () {
      const map = new Map(
        TYPES.map(function (t) {
          return [t.code, []];
        }),
      );
      plans.forEach(function (p) {
        if (!map.has(p.type_menage)) map.set(p.type_menage, []);
        map.get(p.type_menage).push(p);
      });
      return map;
    },
    [plans],
  );

  const actifs = plans.filter(function (p) {
    return p.actif;
  });
  const montants = actifs.map(function (p) {
    return p.montant_gnf;
  });

  async function enregistrerMontant(plan, brut) {
    if (!ctx?.communeId || plan.commune_id !== ctx.communeId) {
      setErreur('Cette formule tarifaire est hors du périmètre de la commune.');
      return;
    }
    const valeur = parseInt(brut, 10);
    if (!valeur || valeur <= 0) {
      setErreur('Le montant doit être un entier positif.');
      return;
    }
    setOccupe(true);
    setSucces(null);
    const { error } = await supabase
      .from('plans_tarifaires')
      .update({ montant_gnf: valeur })
      .eq('id', plan.id)
      .eq('commune_id', ctx.communeId);
    setOccupe(false);
    if (error) {
      setErreur(`Mise à jour refusée : ${error.message}`);
      return;
    }
    setErreur(null);
    setSucces(`${plan.code} passe à ${montant(valeur)}.`);
    charger();
  }

  async function basculerActif(plan) {
    if (!ctx?.communeId || plan.commune_id !== ctx.communeId) {
      setErreur('Cette formule tarifaire est hors du périmètre de la commune.');
      return;
    }
    setOccupe(true);
    const { error } = await supabase
      .from('plans_tarifaires')
      .update({ actif: !plan.actif })
      .eq('id', plan.id)
      .eq('commune_id', ctx.communeId);
    setOccupe(false);
    if (error) {
      setErreur(`Mise à jour refusée : ${error.message}`);
      return;
    }
    setErreur(null);
    setSucces(`${plan.code} ${plan.actif ? 'retiré de' : 'remis dans'} la grille.`);
    charger();
  }

  return (
    <div className="w-full">
      <PageHeader
        kicker="Recouvrement · Grille"
        titre="Tarifs"
        sousTitre="Formules d'abonnement par type de foyer et fréquence de passage. Un tarif modifié ne s'applique qu'aux abonnements souscrits ensuite."
        actions={
          <Btn
            variant="ghost"
            onClick={function () {
              window.print();
            }}
          >
            Imprimer
          </Btn>
        }
      />

      <BandeauErreur message={erreur} onReessayer={charger} />

      {succes ? (
        <p className="lp-rise mt-4 mb-0 rounded-xl border border-[color-mix(in_srgb,var(--lp-teal)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-teal)_14%,transparent)] px-4 py-2.5 text-[12.5px] text-txt">
          {succes}
        </p>
      ) : null}

      <BandeauMetriques
        metriques={[
          {
            label: 'Formules actives',
            valeur: chargement ? '—' : nombre(actifs.length),
            sous: `${nombre(plans.length - actifs.length)} retirée${plans.length - actifs.length > 1 ? 's' : ''}`,
            ton: 'teal',
          },
          {
            label: 'Tarif le plus bas',
            valeur: chargement || montants.length === 0 ? '—' : montant(Math.min(...montants)),
            sous: 'Par mois',
          },
          {
            label: 'Tarif le plus haut',
            valeur: chargement || montants.length === 0 ? '—' : montant(Math.max(...montants)),
            sous: 'Par mois',
          },
          {
            label: 'Types couverts',
            valeur: chargement
              ? '—'
              : nombre(
                  new Set(
                    actifs.map(function (p) {
                      return p.type_menage;
                    }),
                  ).size,
                ),
            sous: `Sur ${TYPES.length} au total`,
          },
        ]}
      />

      {ctx?.niveau === 'region' ? (
        <Bloc titre="Comparaison par commune" delai={80}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-line text-[10px] tracking-wide text-muted uppercase">
                  <th className="px-2 py-2">Code</th>
                  {[...new Set(plans.map(function (p) { return p.communes?.nom || p.commune_id; }).filter(Boolean))].map(function (nom) {
                    return <th key={nom} className="px-2 py-2">{nom}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {[...new Set(plans.map(function (p) { return p.code; }))].map(function (code) {
                  return (
                    <tr key={code} className="border-b border-line">
                      <td className="px-2 py-2 font-mono font-bold">{code}</td>
                      {[...new Set(plans.map(function (p) { return p.communes?.nom || p.commune_id; }).filter(Boolean))].map(function (nom) {
                        const plan = plans.find(function (p) { return p.code === code && (p.communes?.nom || p.commune_id) === nom; });
                        return <td key={nom} className="px-2 py-2 font-mono tabular-nums">{plan ? montant(plan.montant_gnf) : '—'}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Bloc>
      ) : null}

      <div className="mt-8 flex flex-col gap-9">
        {TYPES.map(function (t, i) {
          const liste = parType.get(t.code) ?? [];
          return (
            <Bloc
              key={t.code}
              titre={t.label}
              delai={100 + i * 40}
              extra={
                <span className="flex items-center gap-3">
                  <span className="text-[11px] text-muted2">{t.description}</span>
                  <span className="font-mono text-[10px] text-muted2 tabular-nums">
                    {nombre(liste.length)} formule{liste.length > 1 ? 's' : ''}
                  </span>
                </span>
              }
            >
              {chargement ? (
                <p className="m-0 text-[12px] text-muted2">Chargement…</p>
              ) : liste.length === 0 ? (
                <p className="m-0 text-[12px] text-muted2">
                  Aucune formule pour ce type de foyer — les abonnements y sont donc impossibles.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {liste.map(function (p, rang) {
                    return (
                      <CartePlan
                        key={p.id}
                        plan={p}
                        accent={t.accent}
                        rang={rang}
                        occupe={occupe}
                        onEnregistrer={enregistrerMontant}
                        onBasculer={basculerActif}
                        editable={peutEcrire(ctx)}
                      />
                    );
                  })}
                </div>
              )}
            </Bloc>
          );
        })}
      </div>
    </div>
  );
}
