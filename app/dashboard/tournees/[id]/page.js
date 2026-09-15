'use client';

/**
 * La fiche d'une tournée planifiée : son créneau, son équipe, et surtout
 * les foyers qu'elle dessert — chacun ouvrant sa fiche courte (abonnement,
 * QR code, collecte, position).
 *
 * Les foyers viennent de foyers_de_tournee(), la même fonction que l'app
 * collecteur : ce que la mairie voit ici est exactement ce que le collecteur
 * a dans la main. L'état d'abonnement vient de menages_solde.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BandeauFiche } from '@/components/fiche';
import { BandeauMetriques, CarteListe, Recherche, Tableau, Tr, Td, usePagination } from '@/components/liste';
import { Badge, BandeauErreur, Btn, Chip, Panel, PaginationBar, heure, nombre } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { cheminContexte, peutEcrire } from '@/lib/contexte';
import { useContexte } from '@/components/ContexteProvider';
import { ListeCollecteurs, equipePlanifiee, nomsEquipe } from '../ListeCollecteurs';
import { FicheFoyer, etatAbonnement } from './FicheFoyer';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const OCCURRENCE = {
  planifiee: { ton: 'muted', libelle: 'Planifiée' },
  en_cours: { ton: 'vert', libelle: 'En cours' },
  terminee: { ton: 'teal', libelle: 'Terminée' },
  non_faite: { ton: 'rouge', libelle: 'Non faite' },
  suspendue: { ton: 'or', libelle: 'Suspendue' },
};

const PASSAGES = {
  effectue: { ton: 'teal', libelle: 'Effectué' },
  absent: { ton: 'or', libelle: 'Absent' },
  inaccessible: { ton: 'muted', libelle: 'Inaccessible' },
};

const FILTRES = [
  { code: 'tous', label: 'Tous' },
  { code: 'abonnes', label: 'Abonnés' },
  { code: 'retard', label: 'En retard' },
  { code: 'sans_abo', label: 'Sans abonnement' },
  { code: 'sans_position', label: 'Sans position' },
];

function heureCourte(h) {
  return h ? String(h).slice(0, 5) : '—';
}

function dateCourte(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function relation(objet) {
  return Array.isArray(objet) ? objet[0] : objet;
}

/** Supabase borne la longueur d'URL : un `in` de plusieurs centaines d'ids se découpe. */
async function soldesParLots(ids) {
  const lots = [];
  for (let i = 0; i < ids.length; i += 150) lots.push(ids.slice(i, i + 150));
  const reponses = await Promise.all(
    lots.map(function (lot) {
      return supabase
        .from('menages_solde')
        .select('menage_id, abonnement_id, plan_code, date_fin, mois_dus, total_du, est_solde, statut_menage, type_menage, nb_personnes')
        .in('menage_id', lot);
    }),
  );
  const erreur = reponses.find(function (r) { return r.error; });
  return { data: reponses.flatMap(function (r) { return r.data || []; }), error: erreur?.error || null };
}

export default function TourneePage() {
  const { id } = useParams();
  const { ctx } = useContexte();
  const peutModifier = peutEcrire(ctx);
  const hrefListe = cheminContexte('/dashboard/tournees', ctx);

  const [tournee, setTournee] = useState(null);
  const [foyers, setFoyers] = useState([]);
  const [realisations, setRealisations] = useState([]);
  const [collecteurs, setCollecteurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [filtre, setFiltre] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [foyerOuvert, setFoyerOuvert] = useState(null);

  const [equipe, setEquipe] = useState([]);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState(null);

  const charger = useCallback(
    async function () {
      setChargement(true);
      const [t, f, r] = await Promise.all([
        supabase
          .from('tournees')
          .select('id, jour_semaine, heure_debut, actif, quartier_id, quartiers(nom, commune_id), tournees_collecteurs(collecteur_id, profils(nom_complet, telephone))')
          .eq('id', id)
          .maybeSingle(),
        supabase.rpc('foyers_de_tournee', { p_tournee_id: id }),
        supabase
          .from('tournees_realisation')
          .select('occurrence_id, jour, statut, debut_at, fin_at, collecteurs, collectes, a_desservir, absents, inaccessibles, note')
          .eq('tournee_id', id)
          .order('jour', { ascending: false })
          .limit(8),
      ]);

      if (t.error || !t.data) {
        setTournee(null);
        setChargement(false);
        setErreur(t.error ? `Impossible de charger la tournée : ${t.error.message}` : null);
        return;
      }
      setTournee(t.data);
      setEquipe(equipePlanifiee(t.data).map(function (c) { return c.id; }));
      setRealisations(r.data || []);

      if (f.error) {
        setFoyers([]);
        setChargement(false);
        setErreur(`Impossible de lister les foyers : ${f.error.message}`);
        return;
      }

      // L'état d'abonnement, puis les collecteurs affectables : ceux des
      // PME qui couvrent ce quartier.
      const liste = (f.data || []).map(function (x) { return { ...x, id: x.menage_id }; });
      const [s, pmes] = await Promise.all([
        soldesParLots(liste.map(function (x) { return x.id; })),
        supabase.from('pme_quartiers').select('pme_id').eq('quartier_id', t.data.quartier_id),
      ]);
      const soldes = new Map((s.data || []).map(function (x) { return [x.menage_id, x]; }));
      setFoyers(liste.map(function (x) { return { ...x, ...(soldes.get(x.id) || {}) }; }));

      const idsPme = (pmes.data || []).map(function (x) { return x.pme_id; });
      const c = idsPme.length
        ? await supabase
            .from('profils')
            .select('id, nom_complet')
            .eq('role', 'collecteur')
            .eq('actif', true)
            .in('pme_id', idsPme)
            .order('nom_complet')
        : { data: [] };
      setCollecteurs(c.data || []);

      setErreur(s.error ? `Foyers listés, mais sans leur solde : ${s.error.message}` : null);
      setChargement(false);
    },
    [id],
  );

  useEffect(
    function () {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      charger();
    },
    [charger],
  );

  /* -- Dérivés ------------------------------------------------------ */

  const quartier = relation(tournee?.quartiers)?.nom || 'Quartier';
  const equipeActuelle = useMemo(function () { return equipePlanifiee(tournee); }, [tournee]);
  const equipeModifiee = useMemo(
    function () {
      const avant = equipeActuelle.map(function (c) { return c.id; });
      return avant.length !== equipe.length || avant.some(function (x) { return !equipe.includes(x); });
    },
    [equipeActuelle, equipe],
  );

  const stats = useMemo(
    function () {
      const abonnes = foyers.filter(function (f) { return f.abonne; });
      return {
        total: foyers.length,
        abonnes: abonnes.length,
        aJour: abonnes.filter(function (f) { return f.est_solde; }).length,
        localises: foyers.filter(function (f) { return f.latitude != null; }).length,
        pointesAujourdhui: foyers.filter(function (f) { return f.statut; }).length,
      };
    },
    [foyers],
  );

  const visibles = useMemo(
    function () {
      const q = recherche.trim().toLowerCase();
      return foyers.filter(function (f) {
        if (filtre === 'abonnes' && !f.abonne) return false;
        if (filtre === 'retard' && !(f.abonne && !f.est_solde)) return false;
        if (filtre === 'sans_abo' && f.abonne) return false;
        if (filtre === 'sans_position' && f.latitude != null) return false;
        if (q && !`${f.code_menage} ${f.point_repere} ${f.telephone_contact || ''}`.toLowerCase().includes(q)) return false;
        return true;
      });
    },
    [foyers, filtre, recherche],
  );
  const pagination = usePagination(visibles, 25);
  const foyerSelectionne = foyerOuvert
    ? foyers.find(function (f) { return f.id === foyerOuvert; })
    : null;

  /* -- Actions ------------------------------------------------------ */

  async function enregistrerEquipe() {
    setMessage(null);
    setEnregistrement(true);
    const avant = equipeActuelle.map(function (c) { return c.id; });
    const retires = avant.filter(function (x) { return !equipe.includes(x); });
    const ajoutes = equipe.filter(function (x) { return !avant.includes(x); });
    let error = null;
    if (retires.length) {
      ({ error } = await supabase.from('tournees_collecteurs').delete().eq('tournee_id', id).in('collecteur_id', retires));
    }
    if (!error && ajoutes.length) {
      ({ error } = await supabase
        .from('tournees_collecteurs')
        .insert(ajoutes.map(function (c) { return { tournee_id: id, collecteur_id: c }; })));
    }
    setEnregistrement(false);
    if (error) {
      setMessage({ ton: 'rouge', texte: `L'équipe n'a pas pu être enregistrée : ${error.message}` });
      return;
    }
    setMessage({ ton: 'teal', texte: 'Équipe enregistrée. Chaque membre la voit dans son application.' });
    charger();
  }

  async function basculerActif() {
    setEnregistrement(true);
    const { error } = await supabase.from('tournees').update({ actif: !tournee.actif }).eq('id', id);
    setEnregistrement(false);
    if (error) {
      setMessage({ ton: 'rouge', texte: `Erreur : ${error.message}` });
      return;
    }
    charger();
  }

  /* -- Rendu -------------------------------------------------------- */

  if (!chargement && !tournee) {
    return (
      <div className="w-full">
        <BandeauFiche
          kicker="Terrain · Tournée"
          titre="Tournée introuvable"
          hrefRetour={hrefListe}
          meta={{ fil: [{ href: hrefListe, label: 'Tournées' }, { label: 'Introuvable' }] }}
        />
        <BandeauErreur message={erreur} onReessayer={charger} />
        <p className="mt-8 text-[13.5px] text-muted">
          Cette tournée est introuvable ou hors de votre périmètre.{' '}
          <Link href={hrefListe} className="font-semibold text-blue hover:underline">Retour au planning</Link>.
        </p>
      </div>
    );
  }

  const titre = chargement ? 'Chargement…' : `${quartier} · ${JOURS[tournee.jour_semaine - 1]} ${heureCourte(tournee.heure_debut)}`;

  return (
    <div className="w-full">
      <BandeauFiche
        kicker="Terrain · Tournée planifiée"
        titre={titre}
        hrefRetour={hrefListe}
        badges={
          chargement ? null : (
            <>
              <Badge ton={tournee.actif ? 'teal' : 'muted'}>{tournee.actif ? 'Active' : 'Suspendue'}</Badge>
              {equipeActuelle.length === 0 ? <Badge ton="rouge">Sans collecteur</Badge> : null}
            </>
          )
        }
        meta={{
          fil: [{ href: hrefListe, label: 'Tournées' }, { label: chargement ? 'Chargement…' : quartier }],
          ligne: chargement
            ? 'Chargement des informations…'
            : `Chaque ${JOURS[tournee.jour_semaine - 1].toLowerCase()} à ${heureCourte(tournee.heure_debut)} · ${
                equipeActuelle.length
                  ? nomsEquipe(equipeActuelle.map(function (c) { return c.nom_complet; }), 4)
                  : 'aucune équipe affectée'
              }`,
        }}
        actions={
          chargement || !peutModifier ? null : (
            <Btn variant={tournee.actif ? 'ghost' : 'green'} disabled={enregistrement} onClick={basculerActif}>
              {tournee.actif ? 'Suspendre la tournée' : 'Réactiver la tournée'}
            </Btn>
          )
        }
      />

      <BandeauErreur message={erreur} onReessayer={charger} />

      <BandeauMetriques
        metriques={[
          { label: 'Foyers du quartier', valeur: chargement ? '—' : nombre(stats.total), sous: `${nombre(stats.localises)} géolocalisé${stats.localises > 1 ? 's' : ''}` },
          { label: 'À desservir', valeur: chargement ? '—' : nombre(stats.abonnes), sous: 'Abonnement actif', ton: 'teal' },
          { label: 'À jour', valeur: chargement ? '—' : nombre(stats.aJour), sous: `${nombre(stats.abonnes - stats.aJour)} en retard`, ton: stats.abonnes - stats.aJour > 0 ? 'or' : 'teal' },
          { label: 'Pointés aujourd’hui', valeur: chargement ? '—' : nombre(stats.pointesAujourdhui), sous: stats.abonnes ? `sur ${nombre(stats.abonnes)} abonnés` : '—' },
        ]}
      />

      <div className="mt-8 grid items-start gap-x-10 gap-y-9 xl:grid-cols-12">
        <div className="flex flex-col gap-9 xl:col-span-8">
          <CarteListe
            titre={`Foyers · ${nombre(visibles.length)}`}
            sousTitre="Tous les foyers actifs du quartier, abonnés d’abord. Cliquez un foyer pour sa fiche."
            outils={<Recherche valeur={recherche} onChange={setRecherche} placeholder="Code, repère, téléphone…" />}
            chips={FILTRES.map(function (f) {
              return (
                <Chip key={f.code} actif={filtre === f.code} onClick={function () { setFiltre(f.code); }}>
                  {f.label}
                </Chip>
              );
            })}
            pied={
              <PaginationBar
                page={pagination.page}
                pages={pagination.pages}
                total={visibles.length}
                onChange={pagination.setPage}
              />
            }
          >
            <Tableau
              colonnes={[
                { cle: 'code', label: 'Code' },
                { cle: 'repere', label: 'Repère' },
                { cle: 'abo', label: 'Abonnement' },
                { cle: 'pos', label: 'Position', align: 'center' },
                { cle: 'jour', label: 'Aujourd’hui' },
              ]}
              vide={chargement ? 'Chargement…' : 'Aucun foyer ne correspond.'}
            >
              {pagination.tranche.map(function (f, i) {
                const abo = etatAbonnement(f);
                const p = f.statut ? PASSAGES[f.statut] : null;
                return (
                  <Tr
                    key={f.id}
                    rang={i}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={function () { setFoyerOuvert(f.id); }}
                    onKeyDown={function (e) {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setFoyerOuvert(f.id);
                      }
                    }}
                  >
                    <Td mono fort>{f.code_menage}</Td>
                    <Td>
                      <span className="block text-txt">{f.point_repere}</span>
                      {f.telephone_contact ? <span className="font-mono text-[11px] text-muted2">{f.telephone_contact}</span> : null}
                    </Td>
                    <Td><Badge ton={abo.ton}>{abo.libelle}</Badge></Td>
                    <Td align="center">
                      {f.latitude != null ? <span className="text-teal" title="Géolocalisé">●</span> : <span className="text-muted2" title="Sans position">○</span>}
                    </Td>
                    <Td>
                      {p ? (
                        <span className="flex items-center gap-2">
                          <Badge ton={p.ton}>{p.libelle}</Badge>
                          <span className="font-mono text-[11px] text-muted2">{heure(f.pointe_a)}</span>
                        </span>
                      ) : (
                        <span className="text-muted2">—</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tableau>
          </CarteListe>

          <CarteListe titre="Dernières réalisations" sousTitre="Ce que cette tournée a donné, jour par jour.">
            <Tableau
              colonnes={[
                { cle: 'jour', label: 'Jour' },
                { cle: 'equipe', label: 'Équipe' },
                { cle: 'etat', label: 'État' },
                { cle: 'depart', label: 'Départ' },
                { cle: 'collectes', label: 'Collectés', align: 'right' },
                { cle: 'absents', label: 'Absents', align: 'right' },
              ]}
              vide={chargement ? 'Chargement…' : 'Cette tournée n’est encore jamais partie.'}
            >
              {realisations.map(function (r, i) {
                const def = OCCURRENCE[r.statut] || OCCURRENCE.planifiee;
                return (
                  <Tr key={r.occurrence_id} rang={i}>
                    <Td mono>{dateCourte(r.jour)}</Td>
                    <Td>{r.collecteurs || <span className="text-red">Sans collecteur</span>}</Td>
                    <Td>
                      <Badge ton={def.ton}>{def.libelle}</Badge>
                      {r.note ? <span className="ml-2 text-[12px] text-muted2">{r.note}</span> : null}
                    </Td>
                    <Td mono>{r.debut_at ? heure(r.debut_at) : '—'}</Td>
                    <Td align="right" mono>{nombre(r.collectes)} / {nombre(r.a_desservir)}</Td>
                    <Td align="right" mono>{nombre((r.absents || 0) + (r.inaccessibles || 0))}</Td>
                  </Tr>
                );
              })}
            </Tableau>
          </CarteListe>
        </div>

        <aside className="flex flex-col gap-6 xl:col-span-4">
          <Panel titre="Équipe planifiée">
            {message ? (
              <p className={`mt-0 mb-3 text-[12.5px] ${message.ton === 'rouge' ? 'text-red' : 'text-teal'}`}>{message.texte}</p>
            ) : null}
            {peutModifier ? (
              <>
                <ListeCollecteurs
                  collecteurs={collecteurs}
                  choisis={equipe}
                  disabled={enregistrement || chargement}
                  onChange={setEquipe}
                  vide="Aucun collecteur actif pour ce quartier."
                />
                <p className="mt-2 mb-3 text-[11px] text-muted2">
                  Chaque membre voit la tournée dans son application et peut y pointer. Pour un
                  changement d’un seul jour, passez par l’onglet Réalisées du planning.
                </p>
                <Btn
                  variant="green"
                  className="w-full"
                  disabled={!equipeModifiee || enregistrement}
                  onClick={enregistrerEquipe}
                >
                  {enregistrement ? 'Enregistrement…' : 'Enregistrer l’équipe'}
                </Btn>
              </>
            ) : equipeActuelle.length ? (
              <ul className="m-0 list-none divide-y divide-line p-0">
                {equipeActuelle.map(function (c) {
                  return (
                    <li key={c.id} className="py-2 text-[12.5px] text-txt">
                      <Link href={cheminContexte(`/dashboard/collecteurs/${c.id}`, ctx)} className="hover:underline">
                        {c.nom_complet}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="m-0 text-[12.5px] text-muted2">Aucun collecteur affecté.</p>
            )}
          </Panel>

          {!peutModifier || !equipeActuelle.length ? null : (
            <Panel titre="Membres">
              <ul className="m-0 list-none divide-y divide-line p-0">
                {equipeActuelle.map(function (c) {
                  const tel = relation(
                    (tournee?.tournees_collecteurs || []).find(function (x) { return x.collecteur_id === c.id; })?.profils,
                  )?.telephone;
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
                      <Link href={cheminContexte(`/dashboard/collecteurs/${c.id}`, ctx)} className="font-semibold text-txt hover:underline">
                        {c.nom_complet}
                      </Link>
                      {tel ? <a href={`tel:${tel}`} className="font-mono text-[11.5px] text-blue hover:underline">{tel}</a> : null}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </aside>
      </div>

      {foyerSelectionne ? (
        <FicheFoyer
          foyer={foyerSelectionne}
          quartier={quartier}
          hrefFiche={cheminContexte(`/dashboard/menages/${foyerSelectionne.id}`, ctx)}
          onFermer={function () { setFoyerOuvert(null); }}
        />
      ) : null}
    </div>
  );
}
