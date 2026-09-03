'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ModaleAbonnement } from '@/components/ModaleAbonnement';
import { BandeauFiche, Journal, LigneJournal, LigneMeta } from '@/components/fiche';
import { BandeauMetriques, usePagination } from '@/components/liste';
import {
  Badge,
  BadgeStatut,
  BandeauErreur,
  Bloc,
  Btn,
  Chip,
  Modal,
  ModalConfirmation,
  PaginationBar,
  Panel,
  Selecteur,
  couleurTon,
  ilYA,
  montant,
  nombre,
  tonStatut,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { peutEcrire } from '@/lib/contexte';
import { useContexte } from '@/components/ContexteProvider';

const TYPES_MENAGE = {
  residentiel: 'Résidentiel',
  commerce: 'Commerce',
  institution: 'Institution',
  industrie: 'Industrie',
};

const FILTRES_PAIEMENT = [
  { code: 'tous', label: 'Tous' },
  { code: 'confirme', label: 'Confirmés' },
  { code: 'en_attente', label: 'En attente' },
  { code: 'initie', label: 'Initiés' },
  { code: 'echoue', label: 'Échoués' },
];

const FILTRES_PASSAGE = [
  { code: 'tous', label: 'Tous' },
  { code: 'effectue', label: 'Effectués' },
  { code: 'absent', label: 'Absents' },
  { code: 'inaccessible', label: 'Inaccessibles' },
];

const STATUTS_PASSAGE = {
  effectue: { label: 'Effectué', ton: 'teal' },
  absent: { label: 'Absent', ton: 'or' },
  inaccessible: { label: 'Inaccessible', ton: 'rouge' },
};

function relation(objet) {
  return Array.isArray(objet) ? objet[0] : objet;
}

function dateCourte(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function dansPeriode(iso, periode, instant) {
  if (periode === 'tous') return true;
  return new Date(iso).getTime() >= instant - Number(periode) * 86_400_000;
}

export default function MenagePage() {
  const { id } = useParams();
  const { ctx } = useContexte();
  const [solde, setSolde] = useState(null);
  const [foyer, setFoyer] = useState(null);
  const [abonnements, setAbonnements] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [passages, setPassages] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [instant, setInstant] = useState(0);
  const [filtrePaiement, setFiltrePaiement] = useState('tous');
  const [filtrePassage, setFiltrePassage] = useState('tous');
  const [periodePaiement, setPeriodePaiement] = useState('tous');
  const [periodePassage, setPeriodePassage] = useState('30');
  const [abonnementOuvert, setAbonnementOuvert] = useState(false);
  const [qrOuvert, setQrOuvert] = useState(false);
  const [basculeOuverte, setBasculeOuverte] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [copie, setCopie] = useState(false);

  const charger = useCallback(
    async function () {
      setChargement(true);
      const maintenant = Date.now();
      const il30j = new Date(maintenant - 30 * 86_400_000).toISOString();
      const [soldeReponse, foyerReponse] = await Promise.all([
        (async function () {
          let requete = supabase.from('menages_solde').select('*').eq('menage_id', id);
          if (ctx?.lectureCommuneId || ctx?.communeId) {
            requete = requete.eq('commune_id', ctx.lectureCommuneId || ctx.communeId);
          }
          if (ctx?.pmeId) {
            const liens = await supabase
              .from('pme_quartiers')
              .select('quartier_id')
              .eq('pme_id', ctx.pmeId);
            const idsQuartiers = (liens.data || []).map(function (lien) {
              return lien.quartier_id;
            });
            requete = requete.in(
              'quartier_id',
              idsQuartiers.length ? idsQuartiers : ['00000000-0000-0000-0000-000000000000'],
            );
          }
          return requete.maybeSingle();
        })(),
        supabase
          .from('menages')
          .select(
            'id, code_menage, point_repere, telephone_contact, type_menage, nb_personnes, statut, created_at, proprietaire_id, quartier_id, profils(nom_complet), quartiers(nom, commune_id)',
          )
          .eq('id', id)
          .maybeSingle(),
      ]);

      const soldeCharge = soldeReponse.data || null;
      const foyerBrut = foyerReponse.data || null;
      const communeId = ctx?.lectureCommuneId || ctx?.communeId;
      const foyerQuartier = relation(foyerBrut?.quartiers);
      const pmeQuartier = ctx?.pmeId && foyerBrut
        ? await supabase.from('pme_quartiers').select('quartier_id').eq('pme_id', ctx.pmeId).eq('quartier_id', foyerBrut.quartier_id).maybeSingle()
        : null;
      const foyerDansPerimetre =
        Boolean(foyerBrut) &&
        Boolean(
          (communeId && foyerQuartier?.commune_id === communeId) ||
            (ctx?.pmeId && Boolean(pmeQuartier?.data)) ||
            (!communeId && !ctx?.pmeId),
        );
      const foyerCharge = foyerDansPerimetre ? foyerBrut : null;
      if (foyerBrut && !foyerDansPerimetre) {
        setSolde(null);
        setFoyer(null);
        setAbonnements([]);
        setPaiements([]);
        setPassages([]);
        setInstant(maintenant);
        setChargement(false);
        setErreur(null);
        return;
      }
      const code = foyerCharge?.code_menage || soldeCharge?.code_menage;

      if (!soldeCharge && !foyerCharge) {
        setSolde(null);
        setFoyer(null);
        setAbonnements([]);
        setPaiements([]);
        setPassages([]);
        setInstant(maintenant);
        setChargement(false);
        const detail = soldeReponse.error?.message || foyerReponse.error?.message;
        setErreur(detail ? `Impossible de charger ce ménage : ${detail}` : null);
        return;
      }

      const [abonnementsImbriques, paiementsReponse, passagesReponse] = await Promise.all([
        supabase
          .from('abonnements')
          .select(
            'id, plan_id, statut, date_debut, date_fin, plans_tarifaires(code, libelle, montant_gnf)',
          )
          .eq('menage_id', id)
          .order('date_debut', { ascending: false }),
        code
          ? supabase
              .from('paiements_detail')
              .select('*')
              .eq('code_menage', code)
              .order('created_at', { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('passages')
          .select('id, statut, created_at, collecteur_id, profils(nom_complet)')
          .eq('menage_id', id)
          .gte('created_at', il30j)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      let abonnementsReponse = abonnementsImbriques;
      if (abonnementsImbriques.error) {
        abonnementsReponse = await supabase
          .from('abonnements')
          .select('id, plan_id, statut, date_debut, date_fin')
          .eq('menage_id', id)
          .order('date_debut', { ascending: false });
        const idsPlans = [
          ...new Set(
            (abonnementsReponse.data || [])
              .map(function (abonnement) {
                return abonnement.plan_id;
              })
              .filter(Boolean),
          ),
        ];
        if (!abonnementsReponse.error && idsPlans.length > 0) {
          const plansReponse = await supabase
            .from('plans_tarifaires')
            .select('id, code, libelle, montant_gnf')
            .in('id', idsPlans);
          if (!plansReponse.error) {
            const plans = new Map(
              (plansReponse.data || []).map(function (plan) {
                return [plan.id, plan];
              }),
            );
            abonnementsReponse.data = abonnementsReponse.data.map(function (abonnement) {
              return { ...abonnement, plans_tarifaires: plans.get(abonnement.plan_id) || null };
            });
          }
        }
      }

      setSolde(soldeCharge);
      setFoyer(foyerCharge);
      setAbonnements(abonnementsReponse.data || []);
      setPaiements(paiementsReponse.data || []);
      setPassages(passagesReponse.data || []);
      setInstant(maintenant);
      setChargement(false);

      const erreurPrincipale = soldeReponse.error || foyerReponse.error;
      const erreurSecondaire =
        abonnementsReponse.error || paiementsReponse.error || passagesReponse.error;
      const probleme = erreurPrincipale || erreurSecondaire;
      setErreur(
        probleme
          ? `Certaines informations n’ont pas pu être chargées : ${probleme.message}`
          : null,
      );
      if (code) document.title = `Ménage · ${code}`;
    },
    [id, ctx],
  );

  useEffect(
    function () {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      charger();
    },
    [charger],
  );

  const code = foyer?.code_menage || solde?.code_menage || '';
  const quartier = relation(foyer?.quartiers)?.nom || solde?.quartier || 'Quartier non renseigné';
  const statut = foyer?.statut || solde?.statut_menage;
  const abonnementActuel =
    abonnements.find(function (abonnement) {
      return abonnement.id === solde?.abonnement_id;
    }) || abonnements[0];
  const planActuel = relation(abonnementActuel?.plans_tarifaires);
  const dernierPassage = passages[0]?.created_at;
  const paiementsFiltres = useMemo(
    function () {
      return paiements.filter(function (paiement) {
        if (filtrePaiement !== 'tous' && paiement.statut !== filtrePaiement) return false;
        return dansPeriode(paiement.created_at, periodePaiement, instant);
      });
    },
    [filtrePaiement, instant, paiements, periodePaiement],
  );
  const passagesFiltres = useMemo(
    function () {
      return passages.filter(function (passage) {
        if (filtrePassage !== 'tous' && passage.statut !== filtrePassage) return false;
        return dansPeriode(passage.created_at, periodePassage, instant);
      });
    },
    [filtrePassage, instant, passages, periodePassage],
  );
  const paginationPaiements = usePagination(paiementsFiltres, 10);
  const paginationPassages = usePagination(passagesFiltres, 10);

  async function confirmerBascule() {
    const prochainStatut = statut === 'suspendu' ? 'actif' : 'suspendu';
    setEnregistrement(true);
    const { error } = await supabase.from('menages').update({ statut: prochainStatut }).eq('id', id);
    setEnregistrement(false);
    if (error) {
      setErreur(`La mise à jour a échoué : ${error.message}`);
      return;
    }
    setBasculeOuverte(false);
    charger();
  }

  async function copierCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopie(true);
      window.setTimeout(function () {
        setCopie(false);
      }, 1500);
    } catch {
      setErreur("Le code n’a pas pu être copié.");
    }
  }

  if (!chargement && !solde && !foyer) {
    return (
      <div className="w-full">
        <BandeauFiche
          kicker="Ménage"
          titre="Ménage introuvable"
          hrefRetour="/dashboard/menages"
          meta={{
            fil: [
              { href: '/dashboard/menages', label: 'Ménages' },
              { label: 'Introuvable' },
            ],
          }}
        />
        <BandeauErreur message={erreur} onReessayer={charger} />
        <p className="mt-8 text-[13.5px] text-muted">
          Ce ménage est introuvable ou n’est plus accessible.{' '}
          <Link
            href="/dashboard/menages"
            className="cursor-pointer rounded-sm font-semibold text-txt outline-none hover:text-teal focus-visible:ring-2 focus-visible:ring-blue"
          >
            Retour à la liste des ménages
          </Link>
          .
        </p>
      </div>
    );
  }

  const recouvrement = !solde?.abonnement_id
    ? { label: 'Sans abonnement', ton: 'muted' }
    : solde?.est_solde
      ? { label: 'À jour', ton: 'teal' }
      : { label: `${nombre(solde?.mois_dus)} mois`, ton: 'rouge' };

  return (
    <div className="w-full">
      <BandeauFiche
        kicker={chargement ? '—' : code}
        titre={
          chargement
            ? 'Chargement…'
            : foyer?.point_repere?.trim() || `Foyer · ${quartier}`
        }
        hrefRetour="/dashboard/menages"
        badges={
          chargement ? null : (
            <>
              <BadgeStatut statut={statut} />
              <Badge ton={recouvrement.ton}>{recouvrement.label}</Badge>
            </>
          )
        }
        meta={{
          fil: [
            { href: '/dashboard/menages', label: 'Ménages' },
            { label: chargement ? 'Chargement…' : code },
          ],
          ligne: chargement
            ? 'Chargement des informations…'
            : [
                quartier,
                TYPES_MENAGE[foyer?.type_menage || solde?.type_menage] ||
                  foyer?.type_menage ||
                  solde?.type_menage,
                foyer?.telephone_contact || solde?.telephone_contact || 'Sans téléphone',
                abonnementActuel?.date_fin
                  ? `Échéance ${dateCourte(abonnementActuel.date_fin)}`
                  : 'Sans échéance',
              ]
                .filter(Boolean)
                .join(' · '),
        }}
        actions={
          chargement ? null : (
            <>
              {solde?.abonnement_id && ctx?.niveau === 'commune' ? (
                <Link
                  href={`/dashboard/paiements?q=${encodeURIComponent(code)}`}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-green px-3.5 py-2.5 text-[13px] font-semibold text-encre outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-blue"
                >
                  Encaisser
                </Link>
              ) : peutEcrire(ctx) ? (
                <Btn variant="green" onClick={function () { setAbonnementOuvert(true); }}>
                  Souscrire
                </Btn>
              ) : null}
              <Btn variant="ghost" onClick={function () { setQrOuvert(true); }}>
                QR
              </Btn>
              {peutEcrire(ctx) ? <Btn
                variant={statut === 'suspendu' ? 'green' : 'red'}
                onClick={function () { setBasculeOuverte(true); }}
              >
                {statut === 'suspendu' ? 'Réactiver' : 'Suspendre'}
              </Btn> : null}
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
                label: 'Solde dû',
                valeur: chargement ? '—' : montant(solde?.total_du),
                sous: 'Créances ouvertes',
                ton: Number(solde?.total_du) > 0 ? 'rouge' : 'teal',
              },
              {
                label: 'Mois dus',
                valeur: chargement ? '—' : nombre(solde?.mois_dus),
                sous: solde?.abonnement_id ? 'Abonnement courant' : 'Sans abonnement',
                ton: Number(solde?.mois_dus) > 0 ? 'or' : 'defaut',
              },
              {
                label: 'Passages 30 jours',
                valeur: chargement ? '—' : nombre(passages.length),
                sous: 'Collectes enregistrées',
              },
              {
                label: 'Dernier passage',
                valeur: chargement ? '—' : dernierPassage ? ilYA(dernierPassage) : 'Jamais',
                sous: dernierPassage ? dateCourte(dernierPassage) : 'Aucun pointage',
              },
            ]}
          />

          <Bloc titre="Abonnement">
            {chargement ? (
              <p className="m-0 text-[12.5px] text-muted2">Chargement…</p>
            ) : abonnements.length === 0 ? (
              <p className="m-0 text-[12.5px] text-muted2">
                Aucun abonnement souscrit pour ce ménage.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3">
                  <div>
                    <p className="m-0 font-mono text-[13px] font-bold text-txt">
                      {planActuel?.code || 'Plan'}
                    </p>
                    <p className="mt-1 mb-0 text-[12px] text-muted">
                      {planActuel?.libelle || 'Plan tarifaire'} · du{' '}
                      <span className="font-mono tabular-nums">
                        {dateCourte(abonnementActuel?.date_debut)}
                      </span>{' '}
                      au{' '}
                      <span className="font-mono tabular-nums">
                        {dateCourte(abonnementActuel?.date_fin)}
                      </span>
                    </p>
                  </div>
                  <span className="font-mono text-[15px] font-bold text-txt tabular-nums">
                    {montant(solde?.total_du)}
                  </span>
                </div>
                <div className="divide-y divide-line">
                  {abonnements.map(function (abonnement) {
                    const plan = relation(abonnement.plans_tarifaires);
                    return (
                      <div
                        key={abonnement.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                      >
                        <span className="text-[12.5px] text-txt">
                          <span className="font-mono font-bold">{plan?.code || 'Plan'}</span>
                          <span className="ml-2 font-mono text-[11.5px] text-muted tabular-nums">
                            {dateCourte(abonnement.date_debut)} — {dateCourte(abonnement.date_fin)}
                          </span>
                        </span>
                        <BadgeStatut statut={abonnement.statut} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Bloc>

          <Journal
            titre="Journal des paiements"
            extra={
              paiements.length > 30 ? (
                <Selecteur
                  value={periodePaiement}
                  aria-label="Période du journal des paiements"
                  onChange={function (e) { setPeriodePaiement(e.target.value); }}
                >
                  <option value="30">30 jours</option>
                  <option value="90">90 jours</option>
                  <option value="tous">Toute la période</option>
                </Selecteur>
              ) : null
            }
            chips={FILTRES_PAIEMENT.map(function (filtre) {
              return (
                <Chip
                  key={filtre.code}
                  actif={filtrePaiement === filtre.code}
                  onClick={function () { setFiltrePaiement(filtre.code); }}
                >
                  {filtre.label}
                </Chip>
              );
            })}
            vide={
              chargement
                ? 'Chargement…'
                : paiementsFiltres.length === 0
                  ? 'Aucun paiement avec ce statut sur cette période.'
                  : null
            }
            pied={
              <PaginationBar
                page={paginationPaiements.page}
                pages={paginationPaiements.pages}
                total={paginationPaiements.total}
                onChange={paginationPaiements.setPage}
              />
            }
          >
            {paginationPaiements.tranche.map(function (paiement, rang) {
              const periode = [dateCourte(paiement.periode_debut), dateCourte(paiement.periode_fin)]
                .filter(function (date) { return date !== '—'; })
                .join(' — ');
              return (
                <LigneJournal
                  key={paiement.id}
                  href="/dashboard/paiements"
                  rail={couleurTon(tonStatut(paiement.statut))}
                  titre={
                    <span className="font-mono tabular-nums">{montant(paiement.montant_gnf)}</span>
                  }
                  sous={periode || paiement.reference_externe || 'Période non renseignée'}
                  droite={dateCourte(paiement.created_at)}
                  rang={rang}
                />
              );
            })}
          </Journal>

          <Journal
            titre="Journal des passages"
            extra={
              passages.length > 30 ? (
                <Selecteur
                  value={periodePassage}
                  aria-label="Période du journal des passages"
                  onChange={function (e) { setPeriodePassage(e.target.value); }}
                >
                  <option value="7">7 jours</option>
                  <option value="30">30 jours</option>
                </Selecteur>
              ) : null
            }
            chips={FILTRES_PASSAGE.map(function (filtre) {
              return (
                <Chip
                  key={filtre.code}
                  actif={filtrePassage === filtre.code}
                  onClick={function () { setFiltrePassage(filtre.code); }}
                >
                  {filtre.label}
                </Chip>
              );
            })}
            vide={
              chargement
                ? 'Chargement…'
                : passagesFiltres.length === 0
                  ? 'Aucun passage avec ce statut sur cette période.'
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
              const definition = STATUTS_PASSAGE[passage.statut] || {
                label: passage.statut || 'Sans statut',
                ton: 'muted',
              };
              const collecteur =
                relation(passage.profils)?.nom_complet || 'Collecteur non renseigné';
              return (
                <LigneJournal
                  key={passage.id}
                  rail={couleurTon(definition.ton)}
                  titre={
                    <span className="flex flex-wrap items-center gap-2">
                      {collecteur}
                      <Badge ton={definition.ton}>{definition.label}</Badge>
                    </span>
                  }
                  droite={dateCourte(passage.created_at)}
                  rang={rang}
                />
              );
            })}
          </Journal>
        </div>

        <aside className="flex flex-col gap-9 xl:col-span-4">
          <Panel titre="Identité">
            <dl className="m-0">
              <LigneMeta label="Code">
                <span className="font-mono tabular-nums">{code || '—'}</span>
              </LigneMeta>
              <LigneMeta label="Type">
                {TYPES_MENAGE[foyer?.type_menage || solde?.type_menage] ||
                  foyer?.type_menage ||
                  solde?.type_menage ||
                  '—'}
              </LigneMeta>
              <LigneMeta label="Personnes">
                <span className="font-mono tabular-nums">{foyer?.nb_personnes ?? '—'}</span>
              </LigneMeta>
              <LigneMeta label="Téléphone">
                <span className="font-mono tabular-nums">
                  {foyer?.telephone_contact || solde?.telephone_contact || '—'}
                </span>
              </LigneMeta>
              <LigneMeta label="Propriétaire">
                {relation(foyer?.profils)?.nom_complet || 'Non rattaché'}
              </LigneMeta>
            </dl>
          </Panel>

          <Panel titre="Actions">
            <div className="flex flex-col items-start gap-3">
              <Link
                href="/dashboard/qr-menages"
                className="cursor-pointer rounded-sm text-[12.5px] font-semibold text-txt outline-none hover:text-teal focus-visible:ring-2 focus-visible:ring-blue"
              >
                Planche QR du quartier
              </Link>
              <Btn variant="ghost" onClick={copierCode}>
                {copie ? 'Code copié' : 'Copier le code'}
              </Btn>
            </div>
          </Panel>

          <Panel titre="Lié">
            <p className="m-0 text-[12.5px] text-txt">{quartier}</p>
          </Panel>
        </aside>
      </div>

      <ModaleAbonnement
        menage={
          foyer
            ? { ...foyer, menage_id: foyer.id }
            : {
                menage_id: solde?.menage_id,
                type_menage: solde?.type_menage,
                code_menage: solde?.code_menage,
              }
        }
        ouvert={abonnementOuvert}
        onFermer={function () { setAbonnementOuvert(false); }}
        onCree={charger}
      />

      <Modal
        ouvert={qrOuvert}
        onFermer={function () { setQrOuvert(false); }}
        titre={`QR · ${code}`}
        taille="sm"
      >
        <div className="flex flex-col items-center gap-3 py-3">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={code} size={180} />
          </div>
          <span className="font-mono text-[13px] font-bold text-txt tabular-nums">{code}</span>
        </div>
      </Modal>

      <ModalConfirmation
        ouvert={basculeOuverte}
        titre={statut === 'suspendu' ? 'Réactiver ce ménage ?' : 'Suspendre ce ménage ?'}
        message={
          statut === 'suspendu'
            ? 'Le ménage redeviendra actif dans le registre.'
            : 'Le ménage restera au registre, mais son statut passera à suspendu.'
        }
        confirmerLabel={statut === 'suspendu' ? 'Réactiver' : 'Suspendre'}
        danger={statut !== 'suspendu'}
        pending={enregistrement}
        onConfirmer={confirmerBascule}
        onAnnuler={function () { setBasculeOuverte(false); }}
      />
    </div>
  );
}
