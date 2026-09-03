'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useEtatListe } from '@/lib/useEtatListe';
import {
  Badge,
  BandeauErreur,
  Btn,
  Champ,
  Chip,
  Modal,
  PageHeader,
  PaginationBar,
  cn,
  ilYA,
  nombre,
} from '@/components/ui';
import {
  BandeauMetriques,
  CarteListe,
  Recherche,
  Tableau,
  Td,
  Tr,
  exporterCsv,
  usePagination,
} from '@/components/liste';
import { MiniBarres } from '@/components/graphes';
import { IconPlus } from '@/components/icons';
import { peutEcrire } from '@/lib/contexte';
import { useContexte } from '@/components/ContexteProvider';
import { FiltreCommuneRegion, besoinFiltreCommuneRegion } from '@/components/FiltreCommuneRegion';

const FORM_VIDE = { nomComplet: '', telephone: '', email: '', motDePasse: '' };

const SCHEMA_LISTE = {
  q: { defaut: '', type: 'string' },
  filtre: { defaut: 'tous', type: 'string' },
  page: { defaut: 1, type: 'int' },
};

const FILTRES = [
  { code: 'tous', label: 'Tous' },
  { code: 'actif', label: 'En service' },
  { code: 'inactif', label: 'Désactivés' },
  { code: 'inactifs_7j', label: 'Sans pointage 7 j' },
];

const COLONNES = [
  { cle: 'nom', label: 'Collecteur' },
  { cle: 'tel', label: 'Téléphone' },
  { cle: 'quartiers', label: 'Quartiers desservis' },
  { cle: 'semaine', label: 'Activité 7 j', align: 'right' },
  { cle: 'depots', label: 'Dépôts 7 j', align: 'right' },
  { cle: 'dernier', label: 'Dernier pointage' },
  { cle: 'statut', label: 'Statut' },
  { cle: 'action', label: '', align: 'right', noPrint: true },
];

function CollecteursPage() {
  const { ctx } = useContexte();
  const [collecteurs, setCollecteurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  // Horodatage du dernier chargement : appeler Date.now() pendant le rendu
  // rendrait le composant impur.
  const [instant, setInstant] = useState(0);

  const [etat, maj] = useEtatListe(SCHEMA_LISTE);
  const recherche = etat.q;
  const filtre = etat.filtre;
  const [rechercheSaisie, setRechercheSaisie] = useState(etat.q);
  const [filtreCommune, setFiltreCommune] = useState('');

  const [modale, setModale] = useState(false);
  const [form, setForm] = useState(FORM_VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageForm, setMessageForm] = useState(null);
  const [bascule, setBascule] = useState(null);

  const charger = useCallback(async function () {
    // `collecteurs_activite` n'a pas de commune_id : un collecteur est ancré
    // à une PME. On borne via pme_id (périmètre PME, ou PME créatrice /
    // adoptante de la commune).
    let requete = supabase.from('collecteurs_activite').select('*').order('nom_complet');
    const communeId =
      ctx?.lectureCommuneId ||
      ctx?.communeId ||
      (besoinFiltreCommuneRegion(ctx) && filtreCommune ? filtreCommune : null);
    const idsVides = ['00000000-0000-0000-0000-000000000000'];

    if (ctx?.niveau === 'pme' && ctx.pmeId) {
      requete = requete.eq('pme_id', ctx.pmeId);
    } else if (communeId) {
      const [creatrices, adoptees] = await Promise.all([
        supabase.from('pme').select('id').eq('commune_creatrice_id', communeId),
        supabase
          .from('pme_quartiers')
          .select('pme_id, quartiers!inner(commune_id)')
          .eq('quartiers.commune_id', communeId),
      ]);
      if (creatrices.error || adoptees.error) {
        setChargement(false);
        setErreur(
          `Impossible de charger les collecteurs : ${(creatrices.error || adoptees.error).message}`,
        );
        return;
      }
      const idsPme = [
        ...new Set([
          ...(creatrices.data || []).map(function (ligne) {
            return ligne.id;
          }),
          ...(adoptees.data || []).map(function (ligne) {
            return ligne.pme_id;
          }),
        ]),
      ];
      requete = requete.in('pme_id', idsPme.length ? idsPme : idsVides);
    }

    const { data, error } = await requete;
    setChargement(false);
    if (error) {
      setErreur(`Impossible de charger les collecteurs : ${error.message}`);
      return;
    }
    setErreur(null);
    setCollecteurs(data || []);
    setInstant(Date.now());
  }, [ctx, filtreCommune]);

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

  useEffect(
    function () {
      if (rechercheSaisie === etat.q) return undefined;
      const minuteur = window.setTimeout(function () {
        maj({ q: rechercheSaisie });
      }, 300);
      return function () {
        window.clearTimeout(minuteur);
      };
    },
    [etat.q, maj, rechercheSaisie],
  );

  const filtres = useMemo(
    function () {
      const q = recherche.trim().toLowerCase();
      const seuil7j = instant - 7 * 86_400_000;
      return collecteurs.filter(function (c) {
        if (filtre === 'actif' && !c.actif) return false;
        if (filtre === 'inactif' && c.actif) return false;
        if (filtre === 'inactifs_7j') {
          if (!c.actif) return false;
          if (c.dernier_passage && new Date(c.dernier_passage).getTime() >= seuil7j) return false;
        }
        if (!q) return true;
        return `${c.nom_complet ?? ''} ${c.telephone ?? ''} ${c.quartier ?? ''}`
          .toLowerCase()
          .includes(q);
      });
    },
    [collecteurs, recherche, filtre, instant],
  );

  const { page, pages, total, tranche, setPage } = usePagination(filtres, 25, {
    page: etat.page,
    onChange: function (p) {
      maj({ page: p });
    },
  });

  const enService = collecteurs.filter(function (c) {
    return c.actif;
  });
  const passagesSemaine = collecteurs.reduce(function (s, c) {
    return s + Number(c.nb_passages_semaine || 0);
  }, 0);
  const seuil7j = instant - 7 * 86_400_000;
  const dormants = enService.filter(function (c) {
    return !c.dernier_passage || new Date(c.dernier_passage).getTime() < seuil7j;
  }).length;
  const maxSemaine = Math.max(1, ...collecteurs.map(function (c) {
    return Number(c.nb_passages_semaine || 0);
  }));

  /* -- Actions ----------------------------------------------------- */

  function majChamp(champ, valeur) {
    setForm(function (f) {
      return { ...f, [champ]: valeur };
    });
  }

  async function creerCollecteur() {
    setMessageForm(null);
    if (!form.nomComplet || !form.email || !form.motDePasse) {
      setMessageForm('Nom, email et mot de passe sont obligatoires.');
      return;
    }
    if (form.motDePasse.length < 6) {
      setMessageForm('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    setEnregistrement(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const reponse = await fetch('/api/collecteurs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          email: form.email,
          motDePasse: form.motDePasse,
          nomComplet: form.nomComplet,
          telephone: form.telephone,
          tokenAppelant: session.session.access_token,
        }),
      });
      const resultat = await reponse.json().catch(function () {
        return {};
      });
      setEnregistrement(false);
      if (!reponse.ok) {
        setMessageForm(resultat.erreur || "Le compte n'a pas pu être créé.");
        return;
      }
      setForm(FORM_VIDE);
      setModale(false);
      charger();
    } catch {
      setEnregistrement(false);
      setMessageForm(
        "Le service de création de comptes est injoignable — vérifiez la configuration du serveur.",
      );
    }
  }

  async function confirmerBascule() {
    setEnregistrement(true);
    const { error } = await supabase
      .from('profils')
      .update({ actif: !bascule.actif })
      .eq('id', bascule.id);
    setEnregistrement(false);
    if (error) {
      setErreur(`La mise à jour a échoué : ${error.message}`);
    }
    setBascule(null);
    charger();
  }

  function exporter() {
    exporterCsv(
      'collecteurs',
      [
        'Nom',
        'Téléphone',
        'Quartiers',
        'Passages 7 j',
        'Dépôts 7 j',
        'Passages total',
        'Dernier pointage',
        'Statut',
      ],
      filtres.map(function (c) {
        return [
          c.nom_complet,
          c.telephone,
          c.quartier,
          c.nb_passages_semaine,
          c.nb_depots_semaine,
          c.nb_passages_total,
          c.dernier_passage ? new Date(c.dernier_passage).toLocaleString('fr-FR') : '',
          c.actif ? 'en service' : 'désactivé',
        ];
      }),
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        kicker="Terrain · Agents de collecte"
        titre="Collecteurs"
        sousTitre="Agents affectés aux tournées. L'activité se lit sur les sept derniers jours — un agent sans pointage est un signal."
        actions={
          <>
            <Btn variant="ghost" onClick={exporter} disabled={filtres.length === 0}>
              Exporter
            </Btn>
            {peutEcrire(ctx) ? <Btn
              variant="green"
              onClick={function () {
                setMessageForm(null);
                setForm(FORM_VIDE);
                setModale(true);
              }}
            >
              <IconPlus className="size-4" />
              Nouveau collecteur
            </Btn> : null}
          </>
        }
      />

      <BandeauErreur message={erreur} onReessayer={charger} />

      <BandeauMetriques
        metriques={[
          {
            label: 'En service',
            valeur: chargement ? '—' : nombre(enService.length),
            sous: `${nombre(collecteurs.length - enService.length)} désactivé${collecteurs.length - enService.length > 1 ? 's' : ''}`,
            ton: 'teal',
            onClick: function () {
              maj({ filtre: 'actif' });
            },
            actif: filtre === 'actif',
          },
          {
            label: 'Passages cette semaine',
            valeur: chargement ? '—' : nombre(passagesSemaine),
            sous: 'Tous collecteurs confondus',
          },
          {
            label: 'Sans pointage 7 j',
            valeur: chargement ? '—' : nombre(dormants),
            sous: dormants > 0 ? 'Agents à relancer' : 'Tous ont pointé',
            ton: dormants > 0 ? 'or' : 'teal',
            onClick: function () {
              maj({ filtre: 'inactifs_7j' });
            },
            actif: filtre === 'inactifs_7j',
          },
          {
            label: 'Moyenne par agent',
            valeur: chargement || enService.length === 0
              ? '—'
              : nombre(Math.round(passagesSemaine / enService.length)),
            sous: 'Passages / semaine',
          },
        ]}
      />

      <CarteListe
        titre="Annuaire des collecteurs"
        sousTitre={
          chargement
            ? 'Chargement…'
            : `${nombre(total)} résultat${total > 1 ? 's' : ''}${total !== collecteurs.length ? ` · ${nombre(collecteurs.length)} au total` : ''}`
        }
        outils={
          <div className="flex flex-wrap items-center gap-2">
            <Recherche
              valeur={rechercheSaisie}
              onChange={function (v) {
                setRechercheSaisie(v);
              }}
              placeholder="Nom, téléphone…"
            />
            <FiltreCommuneRegion
              ctx={ctx}
              valeur={filtreCommune}
              onChange={setFiltreCommune}
            />
          </div>
        }
        chips={
          <div className="flex flex-wrap gap-1.5">
            {FILTRES.map(function (f) {
              return (
                <Chip
                  key={f.code}
                  actif={filtre === f.code}
                  onClick={function () {
                    maj({ filtre: f.code });
                  }}
                >
                  {f.label}
                </Chip>
              );
            })}
          </div>
        }
        pied={<PaginationBar page={page} pages={pages} total={total} onChange={setPage} />}
      >
        <Tableau
          colonnes={COLONNES}
          vide={
            chargement
              ? 'Chargement de l’annuaire…'
              : collecteurs.length === 0
                ? "Aucun collecteur — créez un premier compte pour affecter des tournées."
                : 'Aucun collecteur ne correspond à ces filtres.'
          }
        >
          {tranche.map(function (c, rang) {
            const dormant =
              c.actif && (!c.dernier_passage || new Date(c.dernier_passage).getTime() < seuil7j);
            return (
              <Tr key={c.id} rang={rang} href={`/dashboard/collecteurs/${c.id}`}>
                <Td fort>
                  <span className="flex items-center gap-2.5">
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
                    <span className="min-w-0 truncate" title={c.nom_complet || undefined}>
                      {c.nom_complet}
                    </span>
                  </span>
                </Td>
                <Td mono className="whitespace-nowrap">
                  {c.telephone || '—'}
                </Td>
                <Td className="max-w-[220px] truncate" title={c.quartier || undefined}>
                  {c.quartier || <span className="text-muted2">Aucune tournée affectée</span>}
                </Td>
                <Td align="right">
                  <span className="inline-flex items-center justify-end gap-2.5">
                    <span className="w-14">
                      <MiniBarres
                        valeurs={[
                          Math.max(0, Number(c.nb_passages_semaine || 0) - 2),
                          Number(c.nb_passages_semaine || 0),
                        ].map(function (v) {
                          return (v / maxSemaine) * 10;
                        })}
                        accent="var(--lp-teal)"
                      />
                    </span>
                    <span className="font-mono font-bold text-txt tabular-nums">
                      {nombre(c.nb_passages_semaine)}
                    </span>
                  </span>
                </Td>
                <Td align="right" mono>
                  {nombre(c.nb_depots_semaine)}
                </Td>
                <Td>
                  {c.dernier_passage ? (
                    <span className={cn(dormant && 'text-gold')}>{ilYA(c.dernier_passage)}</span>
                  ) : (
                    <span className="text-muted2">Jamais</span>
                  )}
                </Td>
                <Td>
                  {c.actif ? (
                    dormant ? (
                      <Badge ton="or">Inactif 7 j</Badge>
                    ) : (
                      <Badge ton="teal">En service</Badge>
                    )
                  ) : (
                    <Badge ton="muted">Désactivé</Badge>
                  )}
                </Td>
                <Td align="right" className="no-print">
                  {!peutEcrire(ctx) ? null : (
                  <button
                    type="button"
                    onClick={function () {
                      setBascule(c);
                    }}
                    className="cursor-pointer rounded-lg border border-line2 px-2.5 py-1 text-[11px] font-semibold text-txt outline-none transition-colors hover:bg-panel2 focus-visible:ring-2 focus-visible:ring-blue"
                  >
                    {c.actif ? 'Désactiver' : 'Réactiver'}
                  </button>
                  )}
                </Td>
              </Tr>
            );
          })}
        </Tableau>
      </CarteListe>

      {/* Création de compte */}
      <Modal
        ouvert={modale}
        onFermer={function () {
          setModale(false);
        }}
        titre="Nouveau collecteur"
        sousTitre="Un compte est créé pour l'application mobile de terrain."
        taille="lg"
        bloquerFermeture={enregistrement}
        pied={
          <div className="flex flex-wrap justify-end gap-2">
            <Btn
              variant="ghost"
              disabled={enregistrement}
              onClick={function () {
                setModale(false);
              }}
            >
              Annuler
            </Btn>
            <Btn variant="green" disabled={enregistrement} onClick={creerCollecteur}>
              {enregistrement ? 'Création…' : 'Créer le compte'}
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
              Nom complet *
            </span>
            <Champ
              value={form.nomComplet}
              onChange={function (e) {
                majChamp('nomComplet', e.target.value);
              }}
              placeholder="Prénom Nom"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
              Téléphone
            </span>
            <Champ
              value={form.telephone}
              onChange={function (e) {
                majChamp('telephone', e.target.value);
              }}
              placeholder="6XX XX XX XX"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
              Email *
            </span>
            <Champ
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={function (e) {
                majChamp('email', e.target.value);
              }}
              placeholder="agent@commune.gn"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
              Mot de passe *
            </span>
            <Champ
              type="password"
              autoComplete="new-password"
              value={form.motDePasse}
              onChange={function (e) {
                majChamp('motDePasse', e.target.value);
              }}
              placeholder="6 caractères minimum"
            />
          </label>
        </div>
      </Modal>

      {/* Bascule actif/inactif */}
      <Modal
        ouvert={Boolean(bascule)}
        onFermer={function () {
          setBascule(null);
        }}
        titre={bascule?.actif ? 'Désactiver ce collecteur ?' : 'Réactiver ce collecteur ?'}
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
              {enregistrement ? 'Patientez…' : bascule?.actif ? 'Désactiver' : 'Réactiver'}
            </Btn>
          </div>
        }
      >
        <p className="m-0 text-[13.5px] leading-relaxed text-muted">
          {bascule?.actif ? (
            <>
              <b className="text-txt">{bascule?.nom_complet}</b> ne pourra plus se connecter à
              l&apos;application de terrain ni pointer de passage. Ses tournées restent affectées — pensez
              à les réattribuer.
            </>
          ) : (
            <>
              <b className="text-txt">{bascule?.nom_complet}</b> retrouvera l&apos;accès à
              l&apos;application de terrain et pourra à nouveau pointer.
            </>
          )}
        </p>
      </Modal>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="font-mono text-[12px] tracking-[2px] text-muted2 uppercase">
          Ouverture de l’annuaire…
        </p>
      }
    >
      <CollecteursPage />
    </Suspense>
  );
}
