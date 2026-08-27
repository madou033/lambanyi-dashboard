'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Badge,
  BandeauErreur,
  Btn,
  Champ,
  Chip,
  Modal,
  PageHeader,
  Selecteur,
  cn,
  nombre,
} from '@/components/ui';
import { BandeauMetriques } from '@/components/liste';
import { IconPlus } from '@/components/icons';

/** Numérotation ISO 8601 : 1 = lundi … 7 = dimanche. */
const JOURS = [
  { valeur: 1, label: 'Lundi', court: 'Lun' },
  { valeur: 2, label: 'Mardi', court: 'Mar' },
  { valeur: 3, label: 'Mercredi', court: 'Mer' },
  { valeur: 4, label: 'Jeudi', court: 'Jeu' },
  { valeur: 5, label: 'Vendredi', court: 'Ven' },
  { valeur: 6, label: 'Samedi', court: 'Sam' },
  { valeur: 7, label: 'Dimanche', court: 'Dim' },
];

const FORM_VIDE = {
  quartier_id: '',
  collecteur_id: '',
  jour_semaine: '1',
  heure_debut: '07:00',
};

function heureCourte(h) {
  return h ? String(h).slice(0, 5) : '—';
}

/** Jour ISO d'aujourd'hui — getDay() rend 0 le dimanche. */
function jourCourant() {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

/* ------------------------------------------------------------------ */
/* Carte de tournée                                                    */
/* ------------------------------------------------------------------ */

function CarteTournee({ t, rang, onOuvrir }) {
  const affectee = Boolean(t.profils);
  return (
    <button
      type="button"
      onClick={function () {
        onOuvrir(t);
      }}
      className={cn(
        'lp-rise group w-full cursor-pointer rounded-xl border p-2.5 text-left outline-none transition-all duration-150',
        'hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-blue',
        t.actif
          ? 'border-line bg-panel hover:border-line2'
          : 'border-dashed border-line bg-transparent opacity-55 hover:opacity-80',
      )}
      style={{ animationDelay: `${Math.min(rang, 8) * 35}ms` }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            'font-mono text-[15px] leading-none font-bold tabular-nums',
            t.actif ? 'text-txt' : 'text-muted2',
          )}
        >
          {heureCourte(t.heure_debut)}
        </span>
        <span
          aria-hidden
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            !t.actif ? 'bg-line2' : affectee ? 'bg-teal' : 'bg-gold',
          )}
        />
      </div>

      <div
        className={cn(
          'font-display mt-1.5 truncate text-[14px] leading-tight font-bold',
          t.actif ? 'text-txt' : 'text-muted',
        )}
      >
        {t.quartiers?.nom ?? 'Quartier supprimé'}
      </div>

      <div
        className={cn(
          'mt-1 truncate text-[11px]',
          affectee ? 'text-muted' : 'font-semibold text-gold',
        )}
      >
        {affectee ? t.profils.nom_complet : 'Non affectée'}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TourneesPage() {
  const [tournees, setTournees] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [collecteurs, setCollecteurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [voirSuspendues, setVoirSuspendues] = useState(true);
  const [filtreQuartier, setFiltreQuartier] = useState('');

  const [modaleCreation, setModaleCreation] = useState(false);
  const [form, setForm] = useState(FORM_VIDE);
  const [cible, setCible] = useState(null);
  const [affectation, setAffectation] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageForm, setMessageForm] = useState(null);

  const charger = useCallback(async function () {
    const [t, q, c] = await Promise.all([
      supabase
        .from('tournees')
        .select('id, jour_semaine, heure_debut, actif, quartier_id, collecteur_id, quartiers(nom), profils(nom_complet)')
        .order('jour_semaine')
        .order('heure_debut'),
      supabase.from('quartiers').select('id, nom').order('nom'),
      supabase
        .from('profils')
        .select('id, nom_complet')
        .eq('role', 'collecteur')
        .eq('actif', true)
        .order('nom_complet'),
    ]);
    setChargement(false);
    if (t.error) {
      setErreur(`Impossible de charger le planning : ${t.error.message}`);
      return;
    }
    setErreur(null);
    setTournees(t.data || []);
    setQuartiers(q.data || []);
    setCollecteurs(c.data || []);
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

  const visibles = useMemo(
    function () {
      return tournees.filter(function (t) {
        if (!voirSuspendues && !t.actif) return false;
        if (filtreQuartier && t.quartier_id !== filtreQuartier) return false;
        return true;
      });
    },
    [tournees, voirSuspendues, filtreQuartier],
  );

  const parJour = useMemo(
    function () {
      const map = new Map(
        JOURS.map(function (j) {
          return [j.valeur, []];
        }),
      );
      visibles.forEach(function (t) {
        map.get(t.jour_semaine)?.push(t);
      });
      return map;
    },
    [visibles],
  );

  const actives = tournees.filter(function (t) {
    return t.actif;
  });
  const nonAffectees = actives.filter(function (t) {
    return !t.collecteur_id;
  }).length;
  const quartiersCouverts = new Set(
    actives.map(function (t) {
      return t.quartier_id;
    }),
  ).size;
  const jourPlein = JOURS.reduce(
    function (best, j) {
      const n = actives.filter(function (t) {
        return t.jour_semaine === j.valeur;
      }).length;
      return n > best.n ? { label: j.label, n } : best;
    },
    { label: '—', n: 0 },
  );

  const aujourdhui = jourCourant();

  /* -- Actions ----------------------------------------------------- */

  function majChamp(champ, valeur) {
    setForm(function (f) {
      return { ...f, [champ]: valeur };
    });
  }

  function ouvrirCreation(jour) {
    setMessageForm(null);
    setForm({ ...FORM_VIDE, jour_semaine: String(jour ?? aujourdhui) });
    setModaleCreation(true);
  }

  async function creerTournee() {
    setMessageForm(null);
    if (!form.quartier_id) {
      setMessageForm('Le quartier est obligatoire.');
      return;
    }
    setEnregistrement(true);
    const ligne = {
      quartier_id: form.quartier_id,
      jour_semaine: parseInt(form.jour_semaine, 10),
      heure_debut: form.heure_debut,
    };
    if (form.collecteur_id) ligne.collecteur_id = form.collecteur_id;

    const { error } = await supabase.from('tournees').insert(ligne);
    setEnregistrement(false);
    if (error) {
      setMessageForm(`Erreur : ${error.message}`);
      return;
    }
    setModaleCreation(false);
    charger();
  }

  function ouvrirDetail(t) {
    setCible(t);
    setAffectation(t.collecteur_id ?? '');
    setMessageForm(null);
  }

  async function basculerActif() {
    setEnregistrement(true);
    const { error } = await supabase
      .from('tournees')
      .update({ actif: !cible.actif })
      .eq('id', cible.id);
    setEnregistrement(false);
    if (error) {
      setMessageForm(`Erreur : ${error.message}`);
      return;
    }
    setCible(null);
    charger();
  }

  async function enregistrerAffectation() {
    setEnregistrement(true);
    const { error } = await supabase
      .from('tournees')
      .update({ collecteur_id: affectation || null })
      .eq('id', cible.id);
    setEnregistrement(false);
    if (error) {
      setMessageForm(`Erreur : ${error.message}`);
      return;
    }
    setCible(null);
    charger();
  }

  return (
    <div className="w-full">
      <PageHeader
        kicker="Terrain · Planning hebdomadaire"
        titre="Tournées de collecte"
        sousTitre="Le passage de chaque quartier, jour par jour. Une tournée sans collecteur affecté ne partira pas."
        actions={
          <>
            <Btn
              variant="ghost"
              onClick={function () {
                window.print();
              }}
            >
              Imprimer
            </Btn>
            <Btn
              variant="green"
              onClick={function () {
                ouvrirCreation(null);
              }}
            >
              <IconPlus className="size-4" />
              Planifier une tournée
            </Btn>
          </>
        }
      />

      <BandeauErreur message={erreur} onReessayer={charger} />

      <BandeauMetriques
        metriques={[
          {
            label: 'Tournées actives',
            valeur: chargement ? '—' : nombre(actives.length),
            sous: `${nombre(tournees.length - actives.length)} suspendue${tournees.length - actives.length > 1 ? 's' : ''}`,
            ton: 'teal',
          },
          {
            label: 'Quartiers desservis',
            valeur: chargement ? '—' : nombre(quartiersCouverts),
            sous: `Sur ${nombre(quartiers.length)} au référentiel`,
            ton: quartiersCouverts < quartiers.length ? 'or' : 'teal',
          },
          {
            label: 'Sans collecteur',
            valeur: chargement ? '—' : nombre(nonAffectees),
            sous: nonAffectees > 0 ? 'À affecter' : 'Toutes affectées',
            ton: nonAffectees > 0 ? 'rouge' : 'defaut',
          },
          {
            label: 'Jour le plus chargé',
            valeur: chargement ? '—' : jourPlein.label,
            sous: `${nombre(jourPlein.n)} tournée${jourPlein.n > 1 ? 's' : ''}`,
          },
        ]}
      />

      {/* Toolbar */}
      <div
        className="no-print lp-rise mt-6 flex flex-wrap items-center gap-2"
        style={{ animationDelay: '60ms' }}
      >
        <Chip
          actif={voirSuspendues}
          onClick={function () {
            setVoirSuspendues(function (v) {
              return !v;
            });
          }}
        >
          Afficher les suspendues
        </Chip>
        <div className="flex-1" />
        <Selecteur
          value={filtreQuartier}
          aria-label="Filtrer par quartier"
          onChange={function (e) {
            setFiltreQuartier(e.target.value);
          }}
        >
          <option value="">Tous les quartiers</option>
          {quartiers.map(function (q) {
            return (
              <option key={q.id} value={q.id}>
                {q.nom}
              </option>
            );
          })}
        </Selecteur>
      </div>

      {/* Planning */}
      <div
        className="lp-rise mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
        style={{ animationDelay: '100ms' }}
      >
        {JOURS.map(function (j) {
          const duJour = parJour.get(j.valeur) ?? [];
          const cJour = j.valeur === aujourdhui;
          return (
            <section
              key={j.valeur}
              className={cn(
                'flex min-h-[220px] flex-col rounded-xl border p-2.5',
                cJour ? 'border-line2 bg-panel/40' : 'border-line',
              )}
            >
              <header className="mb-2.5 flex items-center justify-between gap-2 border-b border-line pb-2">
                <div className="min-w-0">
                  <h2
                    className={cn(
                      'm-0 truncate text-[11px] tracking-[1.8px] uppercase',
                      cJour ? 'font-semibold text-green' : 'text-muted',
                    )}
                  >
                    {j.label}
                  </h2>
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
                  duJour.map(function (t, rang) {
                    return (
                      <CarteTournee key={t.id} t={t} rang={rang} onOuvrir={ouvrirDetail} />
                    );
                  })
                )}
              </div>

              <button
                type="button"
                onClick={function () {
                  ouvrirCreation(j.valeur);
                }}
                className="no-print mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-1.5 text-[11px] text-muted2 outline-none transition-colors hover:border-line2 hover:text-muted focus-visible:ring-2 focus-visible:ring-blue"
              >
                <IconPlus className="size-3" />
                Ajouter
              </button>
            </section>
          );
        })}
      </div>

      {/* Création */}
      <Modal
        ouvert={modaleCreation}
        onFermer={function () {
          setModaleCreation(false);
        }}
        titre="Planifier une tournée"
        sousTitre="Un passage récurrent, chaque semaine au même jour et à la même heure."
        bloquerFermeture={enregistrement}
        pied={
          <div className="flex flex-wrap justify-end gap-2">
            <Btn
              variant="ghost"
              disabled={enregistrement}
              onClick={function () {
                setModaleCreation(false);
              }}
            >
              Annuler
            </Btn>
            <Btn variant="green" disabled={enregistrement} onClick={creerTournee}>
              {enregistrement ? 'Enregistrement…' : 'Planifier'}
            </Btn>
          </div>
        }
      >
        {messageForm ? (
          <p className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--lp-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-red)_14%,transparent)] px-4 py-2.5 text-[12.5px] text-txt">
            {messageForm}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
              Quartier *
            </span>
            <Selecteur
              value={form.quartier_id}
              onChange={function (e) {
                majChamp('quartier_id', e.target.value);
              }}
              className="w-full"
            >
              <option value="">— Choisir —</option>
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
              Jour
            </span>
            <Selecteur
              value={form.jour_semaine}
              onChange={function (e) {
                majChamp('jour_semaine', e.target.value);
              }}
              className="w-full"
            >
              {JOURS.map(function (j) {
                return (
                  <option key={j.valeur} value={j.valeur}>
                    {j.label}
                  </option>
                );
              })}
            </Selecteur>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
              Heure de début
            </span>
            <Champ
              type="time"
              value={form.heure_debut}
              onChange={function (e) {
                majChamp('heure_debut', e.target.value);
              }}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
              Collecteur
            </span>
            <Selecteur
              value={form.collecteur_id}
              onChange={function (e) {
                majChamp('collecteur_id', e.target.value);
              }}
              className="w-full"
            >
              <option value="">— Non affectée —</option>
              {collecteurs.map(function (c) {
                return (
                  <option key={c.id} value={c.id}>
                    {c.nom_complet}
                  </option>
                );
              })}
            </Selecteur>
            <span className="mt-1.5 block text-[11px] text-muted2">
              Une tournée peut être planifiée sans collecteur, mais elle ne partira pas tant
              qu&apos;elle n&apos;est pas affectée.
            </span>
          </label>
        </div>
      </Modal>

      {/* Détail */}
      <Modal
        ouvert={Boolean(cible)}
        onFermer={function () {
          setCible(null);
        }}
        titre={cible?.quartiers?.nom ?? 'Tournée'}
        sousTitre={
          cible
            ? `${JOURS.find(function (j) {
                return j.valeur === cible.jour_semaine;
              })?.label} · ${heureCourte(cible.heure_debut)}`
            : ''
        }
        taille="sm"
        bloquerFermeture={enregistrement}
        pied={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Btn
              variant={cible?.actif ? 'ghost' : 'green'}
              disabled={enregistrement}
              onClick={basculerActif}
            >
              {cible?.actif ? 'Suspendre' : 'Réactiver'}
            </Btn>
            <Btn variant="green" disabled={enregistrement} onClick={enregistrerAffectation}>
              {enregistrement ? 'Enregistrement…' : "Enregistrer l'affectation"}
            </Btn>
          </div>
        }
      >
        {messageForm ? (
          <p className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--lp-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-red)_14%,transparent)] px-4 py-2.5 text-[12.5px] text-txt">
            {messageForm}
          </p>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge ton={cible?.actif ? 'teal' : 'muted'}>
            {cible?.actif ? 'Active' : 'Suspendue'}
          </Badge>
          {cible && !cible.collecteur_id ? <Badge ton="rouge">Sans collecteur</Badge> : null}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
            Collecteur affecté
          </span>
          <Selecteur
            value={affectation}
            onChange={function (e) {
              setAffectation(e.target.value);
            }}
            className="w-full"
          >
            <option value="">— Non affectée —</option>
            {collecteurs.map(function (c) {
              return (
                <option key={c.id} value={c.id}>
                  {c.nom_complet}
                </option>
              );
            })}
          </Selecteur>
        </label>
      </Modal>
    </div>
  );
}
