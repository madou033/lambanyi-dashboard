'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Badge,
  BadgeStatut,
  BandeauErreur,
  Btn,
  Champ,
  Chip,
  Modal,
  PageHeader,
  PaginationBar,
  Selecteur,
  cn,
  montant,
  nombre,
} from '@/components/ui';
import {
  BandeauMetriques,
  CarteListe,
  EnteteImpression,
  Recherche,
  SelectFiltre,
  Tableau,
  Td,
  Tr,
  usePagination,
} from '@/components/liste';
import { IconPlus, IconRecherche } from '@/components/icons';
import { peutEcrire } from '@/lib/contexte';
import { useContexte } from '@/components/ContexteProvider';
import { supabase } from '@/lib/supabase';
import { filtreCommune } from '@/lib/perimetre';

async function apiHeaders(contentType) {
  const { data } = await supabase.auth.getSession();
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;
  if (data.session?.access_token) {
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

const MODES = [
  { code: 'especes', label: 'Espèces' },
  { code: 'orange_money', label: 'Orange Money' },
  { code: 'orange_money_mock', label: 'Orange Money (test)' },
];

const STATUTS = [
  { code: '', label: 'Tous les statuts' },
  { code: 'confirme', label: 'Confirmés' },
  { code: 'en_attente', label: 'En attente' },
  { code: 'initie', label: 'Initiés' },
  { code: 'echoue', label: 'Échoués' },
  { code: 'annule', label: 'Annulés' },
];

const COLONNES = [
  { cle: 'date', label: 'Date' },
  { cle: 'menage', label: 'Ménage' },
  { cle: 'quartier', label: 'Quartier' },
  { cle: 'plan', label: 'Plan' },
  { cle: 'periode', label: 'Période couverte' },
  { cle: 'mois', label: 'Mois', align: 'right' },
  { cle: 'montant', label: 'Montant', align: 'right' },
  { cle: 'penalite', label: 'Pénalité', align: 'right' },
  { cle: 'mode', label: 'Mode' },
  { cle: 'statut', label: 'Statut' },
];

function libelleMode(code) {
  const m = MODES.find(function (x) {
    return x.code === code;
  });
  return m ? m.label : String(code ?? '—').replaceAll('_', ' ');
}

function dateCourte(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

/* ------------------------------------------------------------------ */
/* Guichet d'encaissement                                              */
/* ------------------------------------------------------------------ */

function Guichet({ ouvert, onFermer, onEncaisse, requeteInitiale = '', lectureCommuneId }) {
  const [requete, setRequete] = useState('');
  const [resultats, setResultats] = useState([]);
  const [cherche, setCherche] = useState(false);
  const [choisi, setChoisi] = useState(null);
  const [solde, setSolde] = useState(null);
  const [avance, setAvance] = useState(0);
  const [mois, setMois] = useState(1);
  const [mode, setMode] = useState('especes');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);

  const [ouvertVu, setOuvertVu] = useState(ouvert);

  // Remise à zéro à la fermeture — le guichet doit toujours rouvrir vierge.
  // Ajustement pendant le rendu : un effet enchaînerait un rendu de plus.
  if (ouvert !== ouvertVu) {
    setOuvertVu(ouvert);
    if (!ouvert) {
      setRequete('');
      setResultats([]);
      setChoisi(null);
      setSolde(null);
      setErreur(null);
      setSucces(null);
      setReference('');
      setNote('');
    } else if (requeteInitiale.trim().length >= 2) {
      setRequete(requeteInitiale.trim());
    }
  }

  async function chercher(qForce) {
    const q = String(qForce ?? requete).trim();
    if (q.length < 2) return;
    setRequete(q);
    setCherche(true);
    setErreur(null);
    try {
      const params = new URLSearchParams({ mode: 'recherche', q });
      if (lectureCommuneId) params.set('lectureCommuneId', lectureCommuneId);
      const r = await fetch(`/api/paiements?${params.toString()}`, {
        headers: await apiHeaders(),
      });
      if (!r.ok) throw new Error();
      const j = await r.json();
      setResultats(j.data || []);
    } catch {
      setErreur('Le service de recherche est injoignable.');
    }
    setCherche(false);
  }

  useEffect(
    function () {
      if (!ouvert) return;
      const q = requeteInitiale.trim();
      if (q.length < 2) return;
      // Le fetch d'ouverture met à jour les résultats après sa résolution.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      chercher(q);
    },
    // Intentionnellement limité à l'ouverture : chercher est recréée à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ouvert, requeteInitiale],
  );

  async function selectionner(m) {
    setChoisi(m);
    setResultats([]);
    setErreur(null);
    setSucces(null);
    if (!m.abonnement_id) {
      setSolde(null);
      return;
    }
    try {
      const r = await fetch(`/api/paiements?mode=solde&abonnement_id=${m.abonnement_id}`, {
        headers: await apiHeaders(),
      });
      const j = await r.json();
      setSolde(j.data);
      setAvance(j.avance_mois_max || 0);
      setMois(j.data && j.data.mois_dus > 0 ? j.data.mois_dus : 1);
    } catch {
      setErreur("Impossible de lire le solde de l'abonnement.");
    }
  }

  async function enregistrer() {
    setOccupe(true);
    setErreur(null);
    setSucces(null);
    try {
      const r = await fetch('/api/paiements', {
        method: 'POST',
        headers: await apiHeaders('application/json'),
        body: JSON.stringify({
          abonnement_id: choisi.abonnement_id,
          mois,
          fournisseur: mode,
          reference_externe: reference,
          note,
        }),
      });
      const j = await r.json().catch(function () {
        return {};
      });
      setOccupe(false);
      if (!r.ok) {
        setErreur(j.error || "Le paiement n'a pas pu être enregistré.");
        return;
      }
      setSucces(
        `Encaissé : ${montant(j.montant)}${j.penalite > 0 ? ` + ${montant(j.penalite)} de pénalité` : ''}`,
      );
      setReference('');
      setNote('');
      selectionner(choisi);
      onEncaisse();
    } catch {
      setOccupe(false);
      setErreur('Erreur réseau.');
    }
  }

  const maxMois = solde ? solde.mois_dus + avance : 1;
  const totalMontant = solde ? mois * solde.montant_mensuel : 0;
  const totalPenalite =
    solde && solde.mois_dus > 0
      ? Math.round(solde.penalite_due / solde.mois_dus) * Math.min(mois, solde.mois_dus)
      : 0;

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Guichet d'encaissement"
      sousTitre="Un mois entier par tranche. La pénalité de retard est calculée automatiquement."
      taille="lg"
      bloquerFermeture={occupe}
      pied={
        choisi && solde ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-[13px] font-bold text-txt tabular-nums">
              {montant(totalMontant + totalPenalite)}
              {totalPenalite > 0 ? (
                <span className="ml-2 text-[11px] font-normal text-gold">
                  dont {montant(totalPenalite)} de pénalité
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Btn
                variant="ghost"
                disabled={occupe}
                onClick={function () {
                  setChoisi(null);
                  setSolde(null);
                }}
              >
                Changer de ménage
              </Btn>
              <Btn variant="green" disabled={occupe || mois < 1} onClick={enregistrer}>
                {occupe ? 'Encaissement…' : 'Encaisser'}
              </Btn>
            </div>
          </div>
        ) : null
      }
    >
      {erreur ? (
        <p className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--lp-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-red)_14%,transparent)] px-4 py-2.5 text-[12.5px] text-txt">
          {erreur}
        </p>
      ) : null}
      {succes ? (
        <p className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--lp-teal)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-teal)_14%,transparent)] px-4 py-2.5 text-[12.5px] text-txt">
          {succes}
        </p>
      ) : null}

      {!choisi ? (
        <>
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Rechercher un ménage</span>
              <IconRecherche className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted2" />
              <input
                autoFocus
                value={requete}
                onChange={function (e) {
                  setRequete(e.target.value);
                }}
                onKeyDown={function (e) {
                  if (e.key === 'Enter') chercher();
                }}
                placeholder="Code ménage, téléphone ou point de repère…"
                className="w-full rounded-xl border border-line bg-bg2 py-2.5 pr-3 pl-9 text-[13px] text-txt outline-none placeholder:text-muted2 focus:border-line2 focus:ring-2 focus:ring-blue/30"
              />
            </label>
            <Btn variant="green" onClick={chercher} disabled={requete.trim().length < 2}>
              {cherche ? 'Recherche…' : 'Chercher'}
            </Btn>
          </div>

          {resultats.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2">
              {resultats.map(function (m) {
                return (
                  <button
                    key={m.menage_id}
                    type="button"
                    onClick={function () {
                      selectionner(m);
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 text-left outline-none transition-colors hover:border-line2 hover:bg-panel2 focus-visible:ring-2 focus-visible:ring-blue"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[12.5px] font-bold text-txt">
                        {m.code_menage}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                        {m.quartier} · {m.point_repere}
                      </span>
                    </span>
                    {!m.abonnement_id ? (
                      <Badge ton="muted">Sans abonnement</Badge>
                    ) : m.est_solde ? (
                      <Badge ton="teal">À jour</Badge>
                    ) : (
                      <Badge ton="rouge">{montant(m.total_du)}</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          ) : requete.trim().length >= 2 && !cherche ? (
            <p className="mt-6 text-center text-[12.5px] text-muted2">
              Aucun ménage ne correspond à « {requete} ».
            </p>
          ) : (
            <p className="mt-6 text-center text-[12.5px] text-muted2">
              Cherchez le foyer par son code, son téléphone ou son repère.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[13px] font-bold text-txt">{choisi.code_menage}</div>
              <div className="mt-0.5 truncate text-[11.5px] text-muted">
                {choisi.quartier} · {choisi.point_repere}
              </div>
            </div>
            {choisi.telephone_contact ? (
              <span className="font-mono text-[11.5px] text-muted2">
                {choisi.telephone_contact}
              </span>
            ) : null}
          </div>

          {!choisi.abonnement_id ? (
            <p className="m-0 text-[12.5px] text-muted2">
              Ce foyer n&apos;a pas d&apos;abonnement — souscrivez-en un depuis le registre des ménages
              avant d&apos;encaisser.
            </p>
          ) : !solde ? (
            <p className="m-0 text-[12.5px] text-muted2">Lecture du solde…</p>
          ) : (
            <>
              <div className="mb-5 grid grid-cols-3 gap-3">
                {[
                  {
                    label: 'Mois dus',
                    valeur: nombre(solde.mois_dus),
                    ton: solde.mois_dus > 0 ? 'text-red' : 'text-teal',
                  },
                  { label: 'Mensualité', valeur: montant(solde.montant_mensuel), ton: 'text-txt' },
                  {
                    label: 'Pénalité due',
                    valeur: montant(solde.penalite_due),
                    ton: solde.penalite_due > 0 ? 'text-gold' : 'text-muted2',
                  },
                ].map(function (k) {
                  return (
                    <div
                      key={k.label}
                      className="rounded-xl border border-line px-3.5 py-2.5"
                    >
                      <div className={cn('font-mono text-[17px] font-bold tabular-nums', k.ton)}>
                        {k.valeur}
                      </div>
                      <div className="mt-1 text-[9.5px] tracking-wide text-muted uppercase">
                        {k.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              <label className="mb-4 block">
                <span className="mb-2 flex items-baseline justify-between text-[10px] tracking-[1.6px] text-muted uppercase">
                  Mois à encaisser
                  <span className="font-mono text-[11px] tracking-normal text-muted2 normal-case">
                    max {maxMois}
                    {avance > 0 ? ` · ${avance} mois d'avance autorisés` : ''}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max={Math.max(1, maxMois)}
                    value={mois}
                    onChange={function (e) {
                      setMois(parseInt(e.target.value, 10));
                    }}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-[var(--lp-green)]"
                  />
                  <span className="w-10 shrink-0 text-right font-mono text-[17px] font-bold text-txt tabular-nums">
                    {mois}
                  </span>
                </div>
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                    Mode de règlement
                  </span>
                  <Selecteur
                    value={mode}
                    onChange={function (e) {
                      setMode(e.target.value);
                    }}
                    className="w-full"
                  >
                    {MODES.map(function (m) {
                      return (
                        <option key={m.code} value={m.code}>
                          {m.label}
                        </option>
                      );
                    })}
                  </Selecteur>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                    Référence
                  </span>
                  <Champ
                    value={reference}
                    onChange={function (e) {
                      setReference(e.target.value);
                    }}
                    placeholder={mode === 'especes' ? 'Optionnel' : 'Transaction Orange Money'}
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                    Note
                  </span>
                  <Champ
                    value={note}
                    onChange={function (e) {
                      setNote(e.target.value);
                    }}
                    placeholder="Optionnel"
                  />
                </label>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function PaiementsPage() {
  const searchParams = useSearchParams();
  const { ctx, profil, communeLecture } = useContexte();
  const qUrl = (searchParams.get('q') || '').trim();
  const [liste, setListe] = useState([]);
  const [totaux, setTotaux] = useState({ montant: 0, penalite: 0 });
  const [quartiers, setQuartiers] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [guichet, setGuichet] = useState(qUrl.length >= 2);

  const [fQuartier, setFQuartier] = useState('');
  const [fStatut, setFStatut] = useState('');
  const [fMode, setFMode] = useState('');
  const [fDu, setFDu] = useState('');
  const [fAu, setFAu] = useState('');
  const [recherche, setRecherche] = useState('');

  const parametres = useCallback(
    function () {
      const p = new URLSearchParams();
      if (fQuartier) p.set('quartier', fQuartier);
      if (fStatut) p.set('statut', fStatut);
      if (fMode) p.set('fournisseur', fMode);
      if (fDu) p.set('du', fDu);
      if (fAu) p.set('au', fAu);
      return p;
    },
    [fQuartier, fStatut, fMode, fDu, fAu],
  );

  const charger = useCallback(
    async function () {
      const p = parametres();
      p.set('mode', 'recents');
      p.set('limite', '200');
      if (ctx?.lectureCommuneId) p.set('lectureCommuneId', ctx.lectureCommuneId);
      try {
        let perimetre = filtreCommune(supabase.from('quartiers').select('id, nom'), ctx);
        if (ctx?.pmeId) {
          const liens = await supabase.from('pme_quartiers').select('quartier_id').eq('pme_id', ctx.pmeId);
          perimetre = supabase.from('quartiers').select('id, nom').in(
            'id',
            liens.data?.map(function (x) { return x.quartier_id; }) || ['00000000-0000-0000-0000-000000000000'],
          );
        }
        const quartiersPerimetre = await perimetre;
        const nomsQuartiers = new Set((quartiersPerimetre.data || []).map(function (q) { return q.nom; }));
        const r = await fetch(`/api/paiements?${p.toString()}`, {
          headers: await apiHeaders(),
        });
        if (!r.ok) throw new Error();
        const j = await r.json();
        const listeChargee =
          ctx?.pmeId
            ? (j.data || []).filter(function (paiement) { return nomsQuartiers.has(paiement.quartier); })
            : j.data || [];
        setListe(listeChargee);
        setTotaux({
          montant: listeChargee.reduce(function (total, paiement) {
            return total + Number(paiement.montant_gnf || 0);
          }, 0),
          penalite: listeChargee.reduce(function (total, paiement) {
            return total + Number(paiement.penalite_gnf || 0);
          }, 0),
        });
        setErreur(null);
      } catch {
        setErreur(
          "Le journal des paiements est injoignable — la clé de service Supabase n'est pas configurée.",
        );
      }
      setChargement(false);
    },
    [parametres, ctx],
  );

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

  useEffect(function () {
    apiHeaders().then(function (headers) {
      return fetch('/api/paiements?mode=quartiers', { headers });
    })
      .then(function (r) {
        return r.ok ? r.json() : { data: [] };
      })
      .then(function (j) {
        setQuartiers(j.data || []);
      })
      .catch(function () {
        setQuartiers([]);
      });
  }, []);

  const filtrees = useMemo(
    function () {
      const q = recherche.trim().toLowerCase();
      if (!q) return liste;
      return liste.filter(function (p) {
        return `${p.code_menage ?? ''} ${p.telephone_contact ?? ''} ${p.reference_externe ?? ''}`
          .toLowerCase()
          .includes(q);
      });
    },
    [liste, recherche],
  );

  const { page, pages, total, tranche, setPage } = usePagination(filtrees, 25);

  const confirmes = filtrees.filter(function (p) {
    return p.statut === 'confirme';
  });
  const enAttente = filtrees.filter(function (p) {
    return p.statut === 'en_attente' || p.statut === 'initie';
  }).length;
  const moisRegles = confirmes.reduce(function (s, p) {
    return s + Number(p.mois_regles || 0);
  }, 0);

  function exporter() {
    const p = parametres();
    p.set('mode', 'export');
    if (ctx?.lectureCommuneId) p.set('lectureCommuneId', ctx.lectureCommuneId);
    window.location.href = `/api/paiements?${p.toString()}`;
  }

  function reinitialiser() {
    setFQuartier('');
    setFStatut('');
    setFMode('');
    setFDu('');
    setFAu('');
    setRecherche('');
  }

  const filtreActif = fQuartier || fStatut || fMode || fDu || fAu || recherche;
  const peutEncaisser = ctx?.niveau === 'commune' && peutEcrire(ctx);
  const territoire =
    ctx?.niveau === 'region'
      ? ctx.lectureCommuneId
        ? `Conakry → ${communeLecture?.nom ?? ctx.lectureCommuneId}`
        : 'Région de Conakry'
      : ctx?.niveau === 'pme'
        ? profil?.pme?.nom ?? 'PME'
        : profil?.communes?.nom ?? 'Commune';

  return (
    <div className="w-full">
      <div className="no-print">
        <PageHeader
          kicker="Recouvrement · Journal"
          titre="Paiements"
          sousTitre="Encaissements des abonnements, période couverte comprise. Chaque tranche règle un mois entier."
          actions={
            <>
              {filtreActif ? (
                <Btn variant="ghost" onClick={reinitialiser}>
                  Réinitialiser
                </Btn>
              ) : null}
              <Btn variant="ghost" onClick={exporter}>
                Exporter
              </Btn>
              <Btn
                variant="ghost"
                onClick={function () {
                  window.print();
                }}
              >
                Imprimer
              </Btn>
              {peutEncaisser ? (
                <Btn
                  variant="green"
                  onClick={function () {
                    setGuichet(true);
                  }}
                >
                  <IconPlus className="size-4" />
                  Encaisser
                </Btn>
              ) : null}
            </>
          }
        />

        <BandeauErreur message={erreur} onReessayer={charger} />

        <BandeauMetriques
          metriques={[
            {
              label: 'Encaissé',
              valeur: chargement ? '—' : montant(totaux.montant),
              sous: `${nombre(confirmes.length)} paiement${confirmes.length > 1 ? 's' : ''} confirmé${confirmes.length > 1 ? 's' : ''}`,
              ton: 'teal',
            },
            {
              label: 'Pénalités perçues',
              valeur: chargement ? '—' : montant(totaux.penalite),
              sous: 'Majorations de retard',
              ton: totaux.penalite > 0 ? 'or' : 'defaut',
            },
            {
              label: 'Mois réglés',
              valeur: chargement ? '—' : nombre(moisRegles),
              sous: 'Sur la sélection',
            },
            {
              label: 'En attente',
              valeur: chargement ? '—' : nombre(enAttente),
              sous: enAttente > 0 ? 'À confirmer' : 'Rien en suspens',
              ton: enAttente > 0 ? 'or' : 'defaut',
            },
          ]}
        />
      </div>

      <div className="zone-impression">
        <EnteteImpression
          titre="Journal des encaissements"
          territoire={territoire}
          contexte={`${fQuartier || 'tous quartiers'} · ${montant(totaux.montant)} encaissés`}
        />

        <CarteListe
          titre="Journal des encaissements"
          sousTitre={
            chargement
              ? 'Chargement…'
              : `${nombre(total)} paiement${total > 1 ? 's' : ''} · 200 plus récents`
          }
          outils={
            <div className="no-print flex flex-wrap items-center gap-2">
              <Recherche
                valeur={recherche}
                onChange={setRecherche}
                placeholder="Code, téléphone, réf.…"
              />
              <SelectFiltre
                valeur={fQuartier}
                onChange={setFQuartier}
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
              <SelectFiltre valeur={fMode} onChange={setFMode} ariaLabel="Filtrer par mode">
                <option value="">Tous les modes</option>
                {MODES.map(function (m) {
                  return (
                    <option key={m.code} value={m.code}>
                      {m.label}
                    </option>
                  );
                })}
              </SelectFiltre>
            </div>
          }
          chips={
            <div className="no-print flex flex-wrap items-center gap-1.5">
              {STATUTS.map(function (s) {
                return (
                  <Chip
                    key={s.code || 'tous'}
                    actif={fStatut === s.code}
                    onClick={function () {
                      setFStatut(s.code);
                    }}
                  >
                    {s.label}
                  </Chip>
                );
              })}
              <span className="ml-2 flex items-center gap-2 text-[11px] text-muted2">
                <span>Du</span>
                <input
                  type="date"
                  value={fDu}
                  onChange={function (e) {
                    setFDu(e.target.value);
                  }}
                  className="rounded-lg border border-line bg-bg2 px-2 py-1 font-mono text-[11px] text-txt outline-none focus:ring-2 focus:ring-blue/30"
                />
                <span>au</span>
                <input
                  type="date"
                  value={fAu}
                  onChange={function (e) {
                    setFAu(e.target.value);
                  }}
                  className="rounded-lg border border-line bg-bg2 px-2 py-1 font-mono text-[11px] text-txt outline-none focus:ring-2 focus:ring-blue/30"
                />
              </span>
            </div>
          }
          pied={
            <PaginationBar
              className="no-print"
              page={page}
              pages={pages}
              total={total}
              onChange={setPage}
            />
          }
        >
          <Tableau
            colonnes={COLONNES}
            vide={
              chargement
                ? 'Chargement du journal…'
                : erreur
                  ? 'Journal indisponible.'
                  : liste.length === 0
                    ? "Aucun encaissement — utilisez le guichet pour enregistrer le premier."
                    : 'Aucun paiement ne correspond à ces filtres.'
            }
          >
            {tranche.map(function (p, rang) {
              return (
                <Tr key={p.id} rang={rang}>
                  <Td mono>{dateCourte(p.created_at)}</Td>
                  <Td mono fort>
                    {p.code_menage || '—'}
                  </Td>
                  <Td>{p.quartier || '—'}</Td>
                  <Td mono>{p.plan_code || '—'}</Td>
                  <Td mono className="whitespace-nowrap">
                    {p.periode_debut ? (
                      <>
                        {dateCourte(p.periode_debut)}
                        <span className="mx-1 text-muted2">→</span>
                        {dateCourte(p.periode_fin)}
                      </>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td align="right" mono>
                    {p.mois_regles || '—'}
                  </Td>
                  <Td align="right" mono fort>
                    {montant(p.montant_gnf)}
                  </Td>
                  <Td align="right" mono className={p.penalite_gnf > 0 ? 'text-gold' : undefined}>
                    {p.penalite_gnf > 0 ? montant(p.penalite_gnf) : '—'}
                  </Td>
                  <Td>{libelleMode(p.fournisseur)}</Td>
                  <Td>
                    <BadgeStatut statut={p.statut} />
                  </Td>
                </Tr>
              );
            })}
          </Tableau>
        </CarteListe>
      </div>

      <Guichet
        ouvert={guichet}
        requeteInitiale={qUrl}
        lectureCommuneId={ctx?.lectureCommuneId}
        onFermer={function () {
          setGuichet(false);
        }}
        onEncaisse={charger}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="font-mono text-[12px] tracking-[2px] text-muted2 uppercase">
          Ouverture du journal…
        </p>
      }
    >
      <PaiementsPage />
    </Suspense>
  );
}
