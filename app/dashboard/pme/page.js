'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Badge,
  BandeauErreur,
  Bloc,
  Btn,
  Champ,
  Chip,
  Modal,
  PageHeader,
  Selecteur,
  cn,
  nombre,
} from '@/components/ui';
import { BandeauMetriques, Recherche } from '@/components/liste';
import { IconPlus } from '@/components/icons';

const FORM_VIDE = { nom: '', responsable: '', telephone: '', email: '', numeroAgrement: '' };

const FILTRES = [
  { code: 'tous', label: 'Toutes' },
  { code: 'actives', label: 'Agréées' },
  { code: 'inactives', label: 'Suspendues' },
  { code: 'sans_perimetre', label: 'Sans périmètre' },
];

/* ------------------------------------------------------------------ */
/* Carte de PME                                                        */
/* ------------------------------------------------------------------ */

function CartePme({ p, rang, onPerimetre, onBasculer }) {
  return (
    <article
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
        <Badge ton={p.actif ? 'teal' : 'muted'}>{p.actif ? 'Agréée' : 'Suspendue'}</Badge>
      </div>

      <dl className="m-0 mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5 border-y border-line py-3">
        <div>
          <dt className="text-[9.5px] tracking-[1.4px] text-muted2 uppercase">Quartiers</dt>
          <dd
            className={cn(
              'm-0 mt-0.5 font-mono text-[17px] leading-none font-bold tabular-nums',
              p.nb_quartiers > 0 ? 'text-txt' : 'text-gold',
            )}
          >
            {nombre(p.nb_quartiers)}
          </dd>
        </div>
        <div>
          <dt className="text-[9.5px] tracking-[1.4px] text-muted2 uppercase">Collecteurs</dt>
          <dd
            className={cn(
              'm-0 mt-0.5 font-mono text-[17px] leading-none font-bold tabular-nums',
              p.nb_collecteurs > 0 ? 'text-txt' : 'text-gold',
            )}
          >
            {nombre(p.nb_collecteurs)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 min-h-[34px]">
        <div className="text-[9.5px] tracking-[1.4px] text-muted2 uppercase">Périmètre</div>
        <p className="m-0 mt-1 line-clamp-2 text-[11.5px] text-muted">
          {p.quartiers || (
            <span className="text-gold">Aucun quartier affecté — la PME ne collecte nulle part.</span>
          )}
        </p>
      </div>

      <dl className="m-0 mt-3 flex flex-col gap-1 border-t border-line pt-3 text-[11.5px]">
        {p.telephone ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted2">Téléphone</dt>
            <dd className="m-0 font-mono text-txt">{p.telephone}</dd>
          </div>
        ) : null}
        {p.email ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted2">Email</dt>
            <dd className="m-0 truncate text-muted">{p.email}</dd>
          </div>
        ) : null}
        {p.numero_agrement ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted2">Agrément</dt>
            <dd className="m-0 font-mono text-txt">{p.numero_agrement}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex gap-2">
        <Btn
          variant="ghost"
          className="flex-1 justify-center py-2"
          onClick={function () {
            onPerimetre(p);
          }}
        >
          Périmètre
        </Btn>
        <Btn
          variant="ghost"
          className="py-2"
          onClick={function () {
            onBasculer(p);
          }}
        >
          {p.actif ? 'Suspendre' : 'Réagréer'}
        </Btn>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PmePage() {
  const [pmes, setPmes] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [collecteurs, setCollecteurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('tous');

  const [modaleCreation, setModaleCreation] = useState(false);
  const [form, setForm] = useState(FORM_VIDE);
  const [perimetre, setPerimetre] = useState(null);
  const [bascule, setBascule] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageForm, setMessageForm] = useState(null);

  const charger = useCallback(async function () {
    const [rPme, rQuartiers, rCollecteurs] = await Promise.all([
      supabase.from('pme_apercu').select('*').order('nom'),
      supabase.from('quartiers').select('id, nom, code').eq('actif', true).order('nom'),
      supabase
        .from('profils')
        .select('id, nom_complet, telephone, actif, pme_id')
        .eq('role', 'collecteur')
        .order('nom_complet'),
    ]);
    setChargement(false);
    if (rPme.error) {
      setErreur(`Impossible de charger les PME : ${rPme.error.message}`);
      return;
    }
    setErreur(null);
    setPmes(rPme.data || []);
    setQuartiers(rQuartiers.data || []);
    setCollecteurs(rCollecteurs.data || []);
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

  const filtrees = useMemo(
    function () {
      const q = recherche.trim().toLowerCase();
      return pmes.filter(function (p) {
        if (filtre === 'actives' && !p.actif) return false;
        if (filtre === 'inactives' && p.actif) return false;
        if (filtre === 'sans_perimetre' && p.nb_quartiers > 0) return false;
        if (!q) return true;
        return `${p.nom ?? ''} ${p.responsable ?? ''} ${p.quartiers ?? ''} ${p.numero_agrement ?? ''}`
          .toLowerCase()
          .includes(q);
      });
    },
    [pmes, recherche, filtre],
  );

  const agreees = pmes.filter(function (p) {
    return p.actif;
  });
  const quartiersCouverts = pmes.reduce(function (s, p) {
    return s + Number(p.nb_quartiers || 0);
  }, 0);
  const sansPerimetre = pmes.filter(function (p) {
    return p.nb_quartiers === 0;
  }).length;
  const nonRattaches = collecteurs.filter(function (c) {
    return !c.pme_id;
  }).length;

  /* -- Actions ----------------------------------------------------- */

  function majChamp(champ, valeur) {
    setForm(function (f) {
      return { ...f, [champ]: valeur };
    });
  }

  async function creerPme() {
    setMessageForm(null);
    if (!form.nom) {
      setMessageForm('Le nom de la PME est obligatoire.');
      return;
    }
    setEnregistrement(true);
    const { error } = await supabase.from('pme').insert({
      nom: form.nom,
      responsable: form.responsable || null,
      telephone: form.telephone || null,
      email: form.email || null,
      numero_agrement: form.numeroAgrement || null,
    });
    setEnregistrement(false);
    if (error) {
      setMessageForm(`Erreur : ${error.message}`);
      return;
    }
    setForm(FORM_VIDE);
    setModaleCreation(false);
    charger();
  }

  async function ouvrirPerimetre(pme) {
    setMessageForm(null);
    const { data } = await supabase
      .from('pme_quartiers')
      .select('quartier_id')
      .eq('pme_id', pme.id);
    setPerimetre({
      pme,
      ids: (data || []).map(function (x) {
        return x.quartier_id;
      }),
    });
  }

  function basculerQuartier(id) {
    setPerimetre(function (p) {
      return {
        ...p,
        ids: p.ids.includes(id)
          ? p.ids.filter(function (x) {
              return x !== id;
            })
          : [...p.ids, id],
      };
    });
  }

  async function enregistrerPerimetre() {
    setEnregistrement(true);
    setMessageForm(null);
    // On remplace l'affectation en bloc : plus simple et plus sûr qu'un
    // diff, la table ne porte que le couple (pme, quartier).
    const suppr = await supabase.from('pme_quartiers').delete().eq('pme_id', perimetre.pme.id);
    if (suppr.error) {
      setEnregistrement(false);
      setMessageForm(`Erreur : ${suppr.error.message}`);
      return;
    }
    if (perimetre.ids.length > 0) {
      const { error } = await supabase.from('pme_quartiers').insert(
        perimetre.ids.map(function (qid) {
          return { pme_id: perimetre.pme.id, quartier_id: qid };
        }),
      );
      if (error) {
        setEnregistrement(false);
        setMessageForm(`Erreur : ${error.message}`);
        return;
      }
    }
    setEnregistrement(false);
    setPerimetre(null);
    charger();
  }

  async function affecterCollecteur(collecteurId, valeur) {
    const { error } = await supabase
      .from('profils')
      .update({ pme_id: valeur || null })
      .eq('id', collecteurId);
    if (error) {
      setErreur(`L'affectation a échoué : ${error.message}`);
      return;
    }
    charger();
  }

  async function confirmerBascule() {
    setEnregistrement(true);
    const { error } = await supabase
      .from('pme')
      .update({ actif: !bascule.actif })
      .eq('id', bascule.id);
    setEnregistrement(false);
    if (error) setErreur(`La mise à jour a échoué : ${error.message}`);
    setBascule(null);
    charger();
  }

  return (
    <div className="w-full">
      <PageHeader
        kicker="Partenaires · Délégation"
        titre="PME de collecte"
        sousTitre="Opérateurs privés agréés par la commune. Le périmètre définit les quartiers dont ils ont la charge."
        actions={
          <Btn
            variant="green"
            onClick={function () {
              setMessageForm(null);
              setForm(FORM_VIDE);
              setModaleCreation(true);
            }}
          >
            <IconPlus className="size-4" />
            Nouvelle PME
          </Btn>
        }
      />

      <BandeauErreur message={erreur} onReessayer={charger} />

      <BandeauMetriques
        metriques={[
          {
            label: 'PME agréées',
            valeur: chargement ? '—' : nombre(agreees.length),
            sous: `${nombre(pmes.length - agreees.length)} suspendue${pmes.length - agreees.length > 1 ? 's' : ''}`,
            ton: 'teal',
          },
          {
            label: 'Quartiers délégués',
            valeur: chargement ? '—' : nombre(quartiersCouverts),
            sous: `Sur ${nombre(quartiers.length)} au référentiel`,
          },
          {
            label: 'Sans périmètre',
            valeur: chargement ? '—' : nombre(sansPerimetre),
            sous: sansPerimetre > 0 ? 'PME sans quartier' : 'Toutes affectées',
            ton: sansPerimetre > 0 ? 'or' : 'teal',
          },
          {
            label: 'Collecteurs non rattachés',
            valeur: chargement ? '—' : nombre(nonRattaches),
            sous: `Sur ${nombre(collecteurs.length)} agents`,
            ton: nonRattaches > 0 ? 'or' : 'defaut',
          },
        ]}
      />

      {/* Annuaire */}
      <div className="lp-rise mt-6 flex flex-wrap items-center gap-2" style={{ animationDelay: '60ms' }}>
        <div className="flex flex-wrap gap-1.5">
          {FILTRES.map(function (f) {
            return (
              <Chip
                key={f.code}
                actif={filtre === f.code}
                onClick={function () {
                  setFiltre(f.code);
                }}
              >
                {f.label}
              </Chip>
            );
          })}
        </div>
        <div className="flex-1" />
        <Recherche valeur={recherche} onChange={setRecherche} placeholder="Nom, responsable…" />
      </div>

      <div className="mt-7">
        <Bloc
          titre="Opérateurs agréés"
          delai={100}
          extra={
            <span className="font-mono text-[10px] text-muted2 tabular-nums">
              {nombre(filtrees.length)} sur {nombre(pmes.length)}
            </span>
          }
        >
          {chargement ? (
            <p className="m-0 text-[12px] text-muted2">Chargement de l&apos;annuaire…</p>
          ) : filtrees.length === 0 ? (
            <p className="m-0 py-6 text-center text-[13px] text-muted2">
              {pmes.length === 0
                ? "Aucune PME agréée — la collecte est intégralement assurée par la commune."
                : 'Aucune PME ne correspond à ces filtres.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtrees.map(function (p, rang) {
                return (
                  <CartePme
                    key={p.id}
                    p={p}
                    rang={rang}
                    onPerimetre={ouvrirPerimetre}
                    onBasculer={setBascule}
                  />
                );
              })}
            </div>
          )}
        </Bloc>
      </div>

      {/* Rattachement des collecteurs */}
      <div className="mt-9">
        <Bloc
          titre="Rattachement des collecteurs"
          delai={160}
          extra={
            nonRattaches > 0 ? (
              <span className="font-mono text-[10px] text-gold tabular-nums">
                {nombre(nonRattaches)} non rattaché{nonRattaches > 1 ? 's' : ''}
              </span>
            ) : null
          }
        >
          {collecteurs.length === 0 ? (
            <p className="m-0 text-[12px] text-muted2">
              Aucun collecteur enregistré — créez des comptes depuis l&apos;écran Collecteurs.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {collecteurs.map(function (c) {
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border border-line px-3 py-2.5',
                      !c.actif && 'opacity-60',
                    )}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line2 bg-panel2 font-mono text-[11px] font-bold text-txt">
                      {String(c.nom_complet ?? '?')
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map(function (m) {
                          return m[0];
                        })
                        .join('')
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-txt">
                        {c.nom_complet}
                      </span>
                      <span className="block truncate font-mono text-[10.5px] text-muted2">
                        {c.telephone || 'Sans téléphone'}
                      </span>
                    </span>
                    <Selecteur
                      value={c.pme_id || ''}
                      aria-label={`Rattacher ${c.nom_complet}`}
                      onChange={function (e) {
                        affecterCollecteur(c.id, e.target.value);
                      }}
                      className="w-32 shrink-0 py-1.5 text-[11.5px]"
                    >
                      <option value="">Commune</option>
                      {pmes.map(function (p) {
                        return (
                          <option key={p.id} value={p.id}>
                            {p.nom}
                          </option>
                        );
                      })}
                    </Selecteur>
                  </div>
                );
              })}
            </div>
          )}
        </Bloc>
      </div>

      {/* Création */}
      <Modal
        ouvert={modaleCreation}
        onFermer={function () {
          setModaleCreation(false);
        }}
        titre="Nouvelle PME"
        sousTitre="L'opérateur est créé sans périmètre — affectez-lui ensuite ses quartiers."
        taille="lg"
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
            <Btn variant="green" disabled={enregistrement} onClick={creerPme}>
              {enregistrement ? 'Enregistrement…' : 'Créer'}
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
          {[
            { cle: 'nom', label: 'Nom de la PME *', placeholder: 'Ex. Sanita Services', pleine: true },
            { cle: 'responsable', label: 'Responsable', placeholder: 'Prénom Nom' },
            { cle: 'telephone', label: 'Téléphone', placeholder: '6XX XX XX XX' },
            { cle: 'email', label: 'Email', placeholder: 'contact@pme.gn' },
            { cle: 'numeroAgrement', label: 'Numéro d’agrément', placeholder: 'Optionnel' },
          ].map(function (c) {
            return (
              <label key={c.cle} className={cn('block', c.pleine && 'sm:col-span-2')}>
                <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                  {c.label}
                </span>
                <Champ
                  value={form[c.cle]}
                  onChange={function (e) {
                    majChamp(c.cle, e.target.value);
                  }}
                  placeholder={c.placeholder}
                />
              </label>
            );
          })}
        </div>
      </Modal>

      {/* Périmètre */}
      <Modal
        ouvert={Boolean(perimetre)}
        onFermer={function () {
          setPerimetre(null);
        }}
        titre="Périmètre de collecte"
        sousTitre={
          perimetre
            ? `${perimetre.pme.nom} · ${perimetre.ids.length} quartier${perimetre.ids.length > 1 ? 's' : ''} sélectionné${perimetre.ids.length > 1 ? 's' : ''}`
            : ''
        }
        taille="lg"
        bloquerFermeture={enregistrement}
        pied={
          <div className="flex flex-wrap justify-end gap-2">
            <Btn
              variant="ghost"
              disabled={enregistrement}
              onClick={function () {
                setPerimetre(null);
              }}
            >
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

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {quartiers.map(function (q) {
            const coche = perimetre?.ids.includes(q.id);
            return (
              <button
                key={q.id}
                type="button"
                onClick={function () {
                  basculerQuartier(q.id);
                }}
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
                    <svg viewBox="0 0 12 12" className="size-2.5" fill="none">
                      <path
                        d="M2.5 6.2 4.8 8.5 9.5 3.8"
                        stroke="#04231a"
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

      {/* Bascule agrément */}
      <Modal
        ouvert={Boolean(bascule)}
        onFermer={function () {
          setBascule(null);
        }}
        titre={bascule?.actif ? "Suspendre l'agrément ?" : "Rétablir l'agrément ?"}
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
              {enregistrement ? 'Patientez…' : bascule?.actif ? 'Suspendre' : 'Rétablir'}
            </Btn>
          </div>
        }
      >
        <p className="m-0 text-[13.5px] leading-relaxed text-muted">
          {bascule?.actif ? (
            <>
              <b className="text-txt">{bascule?.nom}</b> sera marquée suspendue. Son périmètre et ses
              collecteurs restent enregistrés — rien n&apos;est supprimé.
            </>
          ) : (
            <>
              <b className="text-txt">{bascule?.nom}</b> redeviendra un opérateur agréé de la
              commune.
            </>
          )}
        </p>
      </Modal>
    </div>
  );
}
