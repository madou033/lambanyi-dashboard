'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useEtatListe } from '@/lib/useEtatListe';
import {
  BadgeStatut,
  BandeauErreur,
  Badge,
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
  exporterCsv,
  usePagination,
} from '@/components/liste';
import { IconPlus } from '@/components/icons';
import { ModaleAbonnement } from '@/components/ModaleAbonnement';

const TYPES_MENAGE = [
  { code: 'residentiel', label: 'Résidentiel' },
  { code: 'commerce', label: 'Commerce' },
  { code: 'institution', label: 'Institution' },
  { code: 'industrie', label: 'Industrie' },
];

const FILTRES_PAIEMENT = [
  { code: 'tous', label: 'Tous' },
  { code: 'a_jour', label: 'À jour' },
  { code: 'en_retard', label: 'En dette' },
  { code: 'sans', label: 'Sans abonnement' },
];

const SCHEMA_LISTE = {
  q: { defaut: '', type: 'string' },
  quartier: { defaut: '', type: 'string' },
  statut: { defaut: '', type: 'string' },
  paiement: { defaut: 'tous', type: 'string' },
  page: { defaut: 1, type: 'int' },
};

const FORM_VIDE = {
  quartier_id: '',
  point_repere: '',
  telephone_contact: '',
  type_menage: 'residentiel',
  nb_personnes: '',
};

const COLONNES = [
  { cle: 'code', label: 'Code' },
  { cle: 'quartier', label: 'Quartier' },
  { cle: 'repere', label: 'Point de repère' },
  { cle: 'tel', label: 'Téléphone' },
  { cle: 'type', label: 'Type' },
  { cle: 'plan', label: 'Plan' },
  { cle: 'echeance', label: 'Échéance' },
  { cle: 'solde', label: 'Recouvrement' },
  { cle: 'statut', label: 'Statut' },
  { cle: 'action', label: '', align: 'right', noPrint: true },
];

function libelleType(code) {
  const t = TYPES_MENAGE.find(function (x) {
    return x.code === code;
  });
  return t ? t.label : code;
}

function dateCourte(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** Le recouvrement se lit d'un coup d'œil : à jour, en dette, ou jamais souscrit. */
function CelluleSolde({ m }) {
  if (!m.abonnement_id) return <Badge ton="muted">Sans abonnement</Badge>;
  if (m.est_solde) return <Badge ton="teal">À jour</Badge>;
  return (
    <span className="inline-flex items-center gap-2">
      <Badge ton="rouge">
        {m.mois_dus} mois
      </Badge>
      <span className="font-mono text-[11.5px] font-bold text-red tabular-nums">
        {montant(m.total_du)}
      </span>
    </span>
  );
}

function MenagesPage() {
  const [lignes, setLignes] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [etat, maj] = useEtatListe(SCHEMA_LISTE);
  const recherche = etat.q;
  const filtreQuartier = etat.quartier;
  const filtreStatut = etat.statut;
  const filtrePaiement = etat.paiement;

  const [modaleMenage, setModaleMenage] = useState(false);
  const [form, setForm] = useState(FORM_VIDE);
  const [cible, setCible] = useState(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageForm, setMessageForm] = useState(null);

  const charger = useCallback(async function () {
    const [registre, refQuartiers] = await Promise.all([
      supabase.from('menages_solde').select('*').order('code_menage', { ascending: true }),
      supabase.from('quartiers').select('id, nom').order('nom'),
    ]);
    setChargement(false);
    if (registre.error) {
      setErreur(`Impossible de charger le registre : ${registre.error.message}`);
      return;
    }
    setErreur(null);
    setLignes(registre.data || []);
    setQuartiers(refQuartiers.data || []);
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
      return lignes.filter(function (m) {
        if (filtreQuartier && m.quartier !== filtreQuartier) return false;
        if (filtreStatut && m.statut_menage !== filtreStatut) return false;
        if (filtrePaiement === 'a_jour' && m.est_solde !== true) return false;
        if (filtrePaiement === 'en_retard' && !(m.abonnement_id && m.est_solde === false)) return false;
        if (filtrePaiement === 'sans' && m.abonnement_id) return false;
        if (!q) return true;
        return `${m.code_menage ?? ''} ${m.point_repere ?? ''} ${m.telephone_contact ?? ''}`
          .toLowerCase()
          .includes(q);
      });
    },
    [lignes, recherche, filtreQuartier, filtreStatut, filtrePaiement],
  );

  const { page, pages, total, tranche, setPage } = usePagination(filtrees, 25, {
    page: etat.page,
    onChange: function (p) {
      maj({ page: p });
    },
  });

  const totalDu = filtrees.reduce(function (s, m) {
    return s + Number(m.total_du || 0);
  }, 0);
  const nbRetard = filtrees.filter(function (m) {
    return m.abonnement_id && m.est_solde === false;
  }).length;
  const nbSans = filtrees.filter(function (m) {
    return !m.abonnement_id;
  }).length;
  const nbAJour = filtrees.filter(function (m) {
    return m.est_solde === true;
  }).length;

  /* -- Actions ----------------------------------------------------- */

  function majChamp(champ, valeur) {
    setForm(function (f) {
      return { ...f, [champ]: valeur };
    });
  }

  async function enregistrerMenage() {
    setMessageForm(null);
    if (!form.quartier_id || !form.point_repere || !form.telephone_contact) {
      setMessageForm('Quartier, point de repère et téléphone sont obligatoires.');
      return;
    }
    setEnregistrement(true);
    const ligne = {
      quartier_id: form.quartier_id,
      point_repere: form.point_repere,
      telephone_contact: form.telephone_contact,
      type_menage: form.type_menage,
    };
    if (form.nb_personnes) ligne.nb_personnes = parseInt(form.nb_personnes, 10);

    const { error } = await supabase.from('menages').insert(ligne);
    setEnregistrement(false);
    if (error) {
      setMessageForm(`Erreur : ${error.message}`);
      return;
    }
    setForm(FORM_VIDE);
    setModaleMenage(false);
    charger();
  }

  function ouvrirAbonnement(m) {
    setCible(m);
  }

  function exporter() {
    exporterCsv(
      'menages',
      [
        'Code',
        'Quartier',
        'Point de repère',
        'Téléphone',
        'Type',
        'Plan',
        'Échéance',
        'Mois dus',
        'Montant dû (GNF)',
        'Recouvrement',
        'Statut',
      ],
      filtrees.map(function (m) {
        const etat = !m.abonnement_id ? 'sans abonnement' : m.est_solde ? 'à jour' : 'en dette';
        return [
          m.code_menage,
          m.quartier,
          m.point_repere,
          m.telephone_contact,
          libelleType(m.type_menage),
          m.plan_code,
          m.date_fin,
          m.mois_dus ?? '',
          m.total_du || 0,
          etat,
          m.statut_menage,
        ];
      }),
    );
  }

  const contexteImpression = [
    filtreQuartier || 'tous quartiers',
    FILTRES_PAIEMENT.find(function (f) {
      return f.code === filtrePaiement;
    })?.label,
    `${nombre(total)} foyers · ${montant(totalDu)} dus`,
  ].join(' · ');

  return (
    <div className="w-full">
      <div className="no-print">
        <PageHeader
          kicker="Usagers · Registre"
          titre="Ménages"
          sousTitre="Foyers abonnés de la commune, avec leur situation de recouvrement. Un foyer sans abonnement n'est pas facturable."
          actions={
            <>
              <Btn variant="ghost" onClick={exporter} disabled={filtrees.length === 0}>
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
              <Btn
                variant="green"
                onClick={function () {
                  setMessageForm(null);
                  setForm(FORM_VIDE);
                  setModaleMenage(true);
                }}
              >
                <IconPlus className="size-4" />
                Nouveau ménage
              </Btn>
            </>
          }
        />

        <BandeauErreur message={erreur} onReessayer={charger} />

        <BandeauMetriques
          metriques={[
            {
              label: 'Créances ouvertes',
              valeur: chargement ? '—' : montant(totalDu),
              sous: 'Sur la sélection courante',
              ton: totalDu > 0 ? 'rouge' : 'teal',
              onClick: function () {
                maj({ paiement: 'en_retard' });
              },
              actif: filtrePaiement === 'en_retard',
            },
            {
              label: 'Foyers à jour',
              valeur: chargement ? '—' : nombre(nbAJour),
              sous: total > 0 ? `${Math.round((nbAJour / total) * 100)} % de la sélection` : '—',
              ton: 'teal',
              onClick: function () {
                maj({ paiement: 'a_jour' });
              },
              actif: filtrePaiement === 'a_jour',
            },
            {
              label: 'Foyers en dette',
              valeur: chargement ? '—' : nombre(nbRetard),
              sous: 'Abonnement non soldé',
              ton: nbRetard > 0 ? 'or' : 'defaut',
              onClick: function () {
                maj({ paiement: 'en_retard' });
              },
              actif: filtrePaiement === 'en_retard',
            },
            {
              label: 'Sans abonnement',
              valeur: chargement ? '—' : nombre(nbSans),
              sous: 'À souscrire',
              ton: nbSans > 0 ? 'rouge' : 'defaut',
              onClick: function () {
                maj({ paiement: 'sans' });
              },
              actif: filtrePaiement === 'sans',
            },
          ]}
        />
      </div>

      <div className="zone-impression">
        <EnteteImpression titre="Registre des ménages" contexte={contexteImpression} />

        <CarteListe
          titre="Registre des ménages"
          sousTitre={
            chargement
              ? 'Chargement…'
              : `${nombre(total)} résultat${total > 1 ? 's' : ''}${total !== lignes.length ? ` · ${nombre(lignes.length)} au total` : ''}`
          }
          outils={
            <div className="no-print flex flex-wrap items-center gap-2">
              <Recherche
                valeur={recherche}
                onChange={function (v) {
                  maj({ q: v });
                }}
                placeholder="Code, repère, téléphone…"
              />
              <SelectFiltre
                valeur={filtreQuartier}
                onChange={function (v) {
                  maj({ quartier: v });
                }}
                ariaLabel="Filtrer par quartier"
              >
                <option value="">Tous les quartiers</option>
                {quartiers.map(function (q) {
                  return (
                    <option key={q.id} value={q.nom}>
                      {q.nom}
                    </option>
                  );
                })}
              </SelectFiltre>
              <SelectFiltre
                valeur={filtreStatut}
                onChange={function (v) {
                  maj({ statut: v });
                }}
                ariaLabel="Filtrer par statut"
              >
                <option value="">Tous les statuts</option>
                <option value="actif">Actif</option>
                <option value="suspendu">Suspendu</option>
                <option value="resilie">Résilié</option>
              </SelectFiltre>
            </div>
          }
          chips={
            <div className="no-print flex flex-wrap gap-1.5">
              {FILTRES_PAIEMENT.map(function (f) {
                return (
                  <Chip
                    key={f.code}
                    actif={filtrePaiement === f.code}
                    onClick={function () {
                      maj({ paiement: f.code });
                    }}
                  >
                    {f.label}
                  </Chip>
                );
              })}
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
                ? 'Chargement du registre…'
                : lignes.length === 0
                  ? "Aucun ménage au registre — commencez par en inscrire un."
                  : 'Aucun ménage ne correspond à ces filtres.'
            }
          >
            {tranche.map(function (m, rang) {
              return (
                <Tr key={m.menage_id} rang={rang} href={`/dashboard/menages/${m.menage_id}`}>
                  <Td mono fort>
                    {m.code_menage || '—'}
                  </Td>
                  <Td>{m.quartier || '—'}</Td>
                  <Td className="max-w-[220px] truncate">{m.point_repere || '—'}</Td>
                  <Td mono>{m.telephone_contact || '—'}</Td>
                  <Td>{libelleType(m.type_menage)}</Td>
                  <Td mono>{m.plan_code || '—'}</Td>
                  <Td mono>{dateCourte(m.date_fin)}</Td>
                  <Td>
                    <CelluleSolde m={m} />
                  </Td>
                  <Td>
                    <BadgeStatut statut={m.statut_menage} />
                  </Td>
                  <Td align="right" className="no-print">
                    {!m.abonnement_id ? (
                      <button
                        type="button"
                        onClick={function () {
                          ouvrirAbonnement(m);
                        }}
                        className={cn(
                          'cursor-pointer rounded-lg border border-line2 px-2.5 py-1 text-[11px] font-semibold text-txt outline-none',
                          'transition-colors hover:bg-panel2 focus-visible:ring-2 focus-visible:ring-blue',
                        )}
                      >
                        Abonner
                      </button>
                    ) : null}
                  </Td>
                </Tr>
              );
            })}
          </Tableau>
        </CarteListe>
      </div>

      {/* Nouveau ménage */}
      <Modal
        ouvert={modaleMenage}
        onFermer={function () {
          setModaleMenage(false);
        }}
        titre="Nouveau ménage"
        sousTitre="Le code du foyer est généré automatiquement à partir du code du quartier."
        taille="lg"
        bloquerFermeture={enregistrement}
        pied={
          <div className="flex flex-wrap justify-end gap-2">
            <Btn
              variant="ghost"
              disabled={enregistrement}
              onClick={function () {
                setModaleMenage(false);
              }}
            >
              Annuler
            </Btn>
            <Btn variant="green" disabled={enregistrement} onClick={enregistrerMenage}>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
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
              Type de foyer
            </span>
            <Selecteur
              value={form.type_menage}
              onChange={function (e) {
                majChamp('type_menage', e.target.value);
              }}
              className="w-full"
            >
              {TYPES_MENAGE.map(function (t) {
                return (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                );
              })}
            </Selecteur>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
              Point de repère *
            </span>
            <Champ
              value={form.point_repere}
              onChange={function (e) {
                majChamp('point_repere', e.target.value);
              }}
              placeholder="Ex. près de la mosquée, 2ᵉ rue"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
              Téléphone *
            </span>
            <Champ
              value={form.telephone_contact}
              onChange={function (e) {
                majChamp('telephone_contact', e.target.value);
              }}
              placeholder="6XX XX XX XX"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
              Nombre de personnes
            </span>
            <Champ
              type="number"
              min="1"
              value={form.nb_personnes}
              onChange={function (e) {
                majChamp('nb_personnes', e.target.value);
              }}
              placeholder="Optionnel"
            />
          </label>
        </div>
      </Modal>

      <ModaleAbonnement
        menage={cible}
        ouvert={Boolean(cible)}
        onFermer={function () {
          setCible(null);
        }}
        onCree={charger}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="font-mono text-[12px] tracking-[2px] text-muted2 uppercase">
          Ouverture du registre…
        </p>
      }
    >
      <MenagesPage />
    </Suspense>
  );
}
