'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BandeauFiche, Journal, LigneJournal, LigneMeta } from '@/components/fiche';
import { ModaleAffectationSignalement } from '@/components/ModaleAffectationSignalement';
import { usePagination } from '@/components/liste';
import {
  Badge,
  BadgeStatut,
  BandeauErreur,
  Bloc,
  Btn,
  Champ,
  Modal,
  PaginationBar,
  Panel,
  couleurTon,
  ilYA,
  tonStatut,
} from '@/components/ui';
import {
  deposerEvenement,
  estEnRetard,
  libelleAffectation,
  libelleStatutSignalement,
  libelleTypeSignalement,
  MOTIF_MINIMUM,
  vuePilotageAbsente,
} from '@/lib/signalements';
import { supabase } from '@/lib/supabase';

const SELECT_AVEC_AFFECTATION =
  'id, auteur_id, type_signalement, description, statut, created_at, photo_url, quartier_id, assigne_pme_id, assigne_collecteur_id, assigne_le, assigne_par, quartiers(nom), assigne_pme:pme!signalements_assigne_pme_id_fkey(nom), assigne_collecteur:profils!signalements_assigne_collecteur_id_fkey(nom_complet), auteur:profils!signalements_auteur_id_fkey(nom_complet)';

const SELECT_SANS_AFFECTATION =
  'id, auteur_id, type_signalement, description, statut, created_at, photo_url, quartier_id, quartiers(nom), auteur:profils!signalements_auteur_id_fkey(nom_complet)';

const SELECT_MINIMAL =
  'id, auteur_id, type_signalement, description, statut, created_at, photo_url, quartier_id, quartiers(nom)';

function relation(objet) {
  return Array.isArray(objet) ? objet[0] : objet;
}

function horodatage(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} à ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

function normaliser(s, instant, position) {
  const auteur = relation(s.auteur) || relation(s.profils);
  return {
    ...s,
    quartier_nom: s.quartier_nom ?? relation(s.quartiers)?.nom ?? null,
    assigne_pme_nom: s.assigne_pme_nom ?? relation(s.assigne_pme)?.nom ?? null,
    assigne_collecteur_nom:
      s.assigne_collecteur_nom ?? relation(s.assigne_collecteur)?.nom_complet ?? null,
    auteur_nom: s.auteur_nom ?? auteur?.nom_complet ?? null,
    en_retard: s.en_retard === true || estEnRetard(s, instant),
    latitude: s.latitude ?? position?.latitude ?? null,
    longitude: s.longitude ?? position?.longitude ?? null,
  };
}

function sousEvenement(ev) {
  const profil = relation(ev.profils);
  const nom = profil?.nom_complet;
  const role = profil?.role;
  const auteur = nom ? (role ? `${nom} (${role})` : nom) : null;
  const message = (ev.message || '').trim();
  return [message, auteur].filter(Boolean).join(' · ') || null;
}

export default function SignalementPage() {
  const { id } = useParams();
  const [signalement, setSignalement] = useState(null);
  const [evenements, setEvenements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [cloture, setCloture] = useState(null);
  const [affectationOuverte, setAffectationOuverte] = useState(false);
  const [instant, setInstant] = useState(0);

  const charger = useCallback(
    async function () {
      const instantChargement = Date.now();

      const [pilotage, evenementsAvecProfils] = await Promise.all([
        supabase.from('signalements_pilotage').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('signalements_evenements')
          .select('id, statut, message, created_at, auteur_id, profils(nom_complet, role)')
          .eq('signalement_id', id)
          .order('created_at', { ascending: true }),
      ]);

      let evenementsReponse = evenementsAvecProfils;
      if (evenementsAvecProfils.error) {
        evenementsReponse = await supabase
          .from('signalements_evenements')
          .select('id, statut, message, created_at, auteur_id')
          .eq('signalement_id', id)
          .order('created_at', { ascending: true });
      }

      let ligne = null;
      let position = null;
      let erreurPrincipale = null;

      if (!pilotage.error) {
        ligne = pilotage.data;
      } else if (!vuePilotageAbsente(pilotage.error)) {
        erreurPrincipale = `Impossible de charger ce signalement : ${pilotage.error.message}`;
      } else {
        let [base, carte] = await Promise.all([
          supabase.from('signalements').select(SELECT_AVEC_AFFECTATION).eq('id', id).maybeSingle(),
          supabase
            .from('signalements_carte')
            .select('latitude, longitude')
            .eq('id', id)
            .maybeSingle(),
        ]);

        if (base.error) {
          base = await supabase
            .from('signalements')
            .select(SELECT_SANS_AFFECTATION)
            .eq('id', id)
            .maybeSingle();
        }

        if (base.error) {
          base = await supabase
            .from('signalements')
            .select(SELECT_MINIMAL)
            .eq('id', id)
            .maybeSingle();
        }

        if (base.error) {
          erreurPrincipale = `Impossible de charger ce signalement : ${base.error.message}`;
        } else {
          ligne = base.data;
          if (!carte.error) position = carte.data;
        }
      }

      if (ligne?.auteur_id && !ligne.auteur_nom && !relation(ligne.auteur)?.nom_complet) {
        const auteur = await supabase
          .from('profils')
          .select('nom_complet')
          .eq('id', ligne.auteur_id)
          .maybeSingle();
        if (!auteur.error && auteur.data) {
          ligne = { ...ligne, auteur_nom: auteur.data.nom_complet };
        }
      }

      setChargement(false);
      setInstant(instantChargement);
      setSignalement(ligne ? normaliser(ligne, instantChargement, position) : null);
      setEvenements(evenementsReponse.data || []);

      const erreurSecondaire = evenementsReponse.error;
      if (erreurPrincipale) {
        setErreur(erreurPrincipale);
      } else if (erreurSecondaire) {
        setErreur(
          `Certaines informations n’ont pas pu être chargées : ${erreurSecondaire.message}`,
        );
      } else {
        setErreur(null);
      }

      if (ligne) {
        document.title = `Signalement · ${libelleTypeSignalement(ligne.type_signalement)}`;
      }
    },
    [id],
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

  const pagination = usePagination(evenements, 10);
  const typeLibelle = signalement
    ? libelleTypeSignalement(signalement.type_signalement)
    : chargement
      ? 'Chargement…'
      : 'Introuvable';
  const ouvert = signalement?.statut === 'nouveau' || signalement?.statut === 'en_cours';
  const affecte = Boolean(signalement?.assigne_pme_id);
  const retard =
    signalement &&
    (signalement.en_retard === true || estEnRetard(signalement, instant || Date.now()));
  const affectation = signalement ? libelleAffectation(signalement) : null;

  function demanderStatut(statut) {
    if (statut === 'en_cours') {
      poserEvenement(statut, null);
      return;
    }
    setCloture({ statut, message: '' });
  }

  async function poserEvenement(statut, message) {
    setEnCours(true);
    setSignalement(function (s) {
      return s ? { ...s, statut, en_retard: false } : s;
    });

    const { data: session } = await supabase.auth.getSession();
    const { error } = await deposerEvenement(supabase, {
      signalementId: id,
      statut,
      message,
      userId: session?.session?.user?.id ?? null,
    });

    setEnCours(false);
    setCloture(null);
    if (error) {
      setErreur(`La mise à jour a échoué : ${error.message}`);
      charger();
      return;
    }
    charger();
  }

  if (!chargement && !signalement) {
    return (
      <div className="w-full">
        <BandeauFiche
          kicker="Terrain · Signalement"
          titre="Signalement introuvable"
          hrefRetour="/dashboard/signalements"
          meta={{
            fil: [
              { href: '/dashboard/signalements', label: 'Signalements' },
              { label: 'Introuvable' },
            ],
          }}
        />
        <BandeauErreur message={erreur} onReessayer={charger} />
        <p className="mt-8 text-[13.5px] text-muted">
          Ce signalement est introuvable ou n’est plus accessible.{' '}
          <Link
            href="/dashboard/signalements"
            className="cursor-pointer rounded-sm font-semibold text-txt outline-none hover:text-teal focus-visible:ring-2 focus-visible:ring-blue"
          >
            Retour à la liste des signalements
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <BandeauFiche
        kicker="Terrain · Signalement"
        titre={chargement ? 'Chargement…' : typeLibelle}
        hrefRetour="/dashboard/signalements"
        badges={
          chargement || !signalement ? null : retard ? (
            <Badge ton="or">En retard</Badge>
          ) : (
            <BadgeStatut statut={signalement.statut} />
          )
        }
        meta={{
          fil: [
            { href: '/dashboard/signalements', label: 'Signalements' },
            { label: typeLibelle },
          ],
          ligne: chargement
            ? 'Chargement des informations…'
            : [
                signalement.quartier_nom || 'Quartier non renseigné',
                affectation || 'Non affecté',
                signalement.created_at ? ilYA(signalement.created_at) : '—',
              ].join(' · '),
        }}
        actions={
          chargement || !signalement || !ouvert ? null : (
            <>
              {signalement.statut === 'nouveau' ? (
                <Btn
                  variant="gold"
                  disabled={enCours}
                  onClick={function () {
                    demanderStatut('en_cours');
                  }}
                >
                  Prendre en charge
                </Btn>
              ) : null}
              <Btn
                variant="ghost"
                onClick={function () {
                  setAffectationOuverte(true);
                }}
              >
                {affecte ? 'Réaffecter' : 'Affecter'}
              </Btn>
            </>
          )
        }
      />

      <BandeauErreur message={erreur} onReessayer={charger} />

      <div className="mt-8 grid items-start gap-x-10 gap-y-9 xl:grid-cols-12">
        <div className="flex flex-col gap-9 xl:col-span-8">
          <Bloc titre="Description">
            {chargement ? (
              <p className="m-0 text-[12.5px] text-muted2">Chargement…</p>
            ) : (
              <div className="flex flex-col gap-4">
                {signalement.photo_url ? (
                  <a
                    href={signalement.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="outline-none focus-visible:ring-2 focus-visible:ring-blue"
                    title="Ouvrir la photo"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signalement.photo_url}
                      alt=""
                      className="max-h-80 w-full rounded-xl border border-line object-cover"
                    />
                  </a>
                ) : null}
                <p className="m-0 text-[13.5px] leading-relaxed text-txt">
                  {signalement.description || 'Sans description'}
                </p>
              </div>
            )}
          </Bloc>

          <Bloc titre="Localisation">
            {chargement ? (
              <p className="m-0 text-[12.5px] text-muted2">Chargement…</p>
            ) : signalement.latitude != null && signalement.longitude != null ? (
              <div className="flex flex-col gap-1.5">
                <a
                  href={`https://www.google.com/maps?q=${signalement.latitude},${signalement.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit cursor-pointer rounded-sm font-semibold text-blue outline-none hover:underline focus-visible:ring-2 focus-visible:ring-blue"
                >
                  Ouvrir dans Google Maps
                </a>
                <span className="font-mono text-[12px] text-muted tabular-nums">
                  {Number(signalement.latitude).toFixed(5)},{' '}
                  {Number(signalement.longitude).toFixed(5)}
                </span>
              </div>
            ) : (
              <p className="m-0 text-[12.5px] text-muted2">
                Sans GPS — ce signalement n’a pas été géolocalisé à la saisie.
              </p>
            )}
          </Bloc>

          <Journal
            titre="Frise de suivi"
            vide={
              chargement
                ? 'Chargement de la frise…'
                : evenements.length === 0
                  ? 'Aucun événement n’a encore été enregistré sur ce dossier — la frise se construit à la création, à l’affectation et à chaque changement de statut.'
                  : null
            }
            pied={
              evenements.length > 10 ? (
                <PaginationBar
                  page={pagination.page}
                  pages={pagination.pages}
                  total={pagination.total}
                  onChange={pagination.setPage}
                />
              ) : null
            }
          >
            {pagination.tranche.map(function (ev, rang) {
              return (
                <LigneJournal
                  key={ev.id}
                  rail={couleurTon(tonStatut(ev.statut))}
                  titre={libelleStatutSignalement(ev.statut)}
                  sous={sousEvenement(ev)}
                  droite={ilYA(ev.created_at)}
                  rang={rang}
                />
              );
            })}
          </Journal>
        </div>

        <aside className="flex flex-col gap-9 xl:col-span-4">
          <Panel titre="Identité">
            {chargement ? (
              <p className="m-0 text-[12.5px] text-muted2">Chargement…</p>
            ) : (
              <dl className="m-0">
                <LigneMeta label="Auteur">
                  {signalement.auteur_nom || (
                    <span className="text-muted2">Non renseigné</span>
                  )}
                </LigneMeta>
                <LigneMeta label="Quartier">
                  {signalement.quartier_nom || (
                    <span className="text-muted2">Quartier non renseigné</span>
                  )}
                </LigneMeta>
                <LigneMeta label="Type">{typeLibelle}</LigneMeta>
              </dl>
            )}
          </Panel>

          <Panel
            titre="Affectation"
            action={
              chargement || !ouvert ? null : (
                <Btn
                  variant="ghost"
                  className="px-2.5 py-1 text-[11px]"
                  onClick={function () {
                    setAffectationOuverte(true);
                  }}
                >
                  {affecte ? 'Réaffecter' : 'Affecter'}
                </Btn>
              )
            }
          >
            {chargement ? (
              <p className="m-0 text-[12.5px] text-muted2">Chargement…</p>
            ) : (
              <dl className="m-0">
                <LigneMeta label="PME">
                  {signalement.assigne_pme_nom || (
                    <span className="text-muted2">Non affecté</span>
                  )}
                </LigneMeta>
                <LigneMeta label="Agent">
                  {signalement.assigne_pme_nom ? (
                    signalement.assigne_collecteur_nom || 'Toute la PME'
                  ) : (
                    <span className="text-muted2">—</span>
                  )}
                </LigneMeta>
                <LigneMeta label="Le">
                  {signalement.assigne_le ? (
                    <span className="font-mono tabular-nums">
                      {horodatage(signalement.assigne_le)}
                    </span>
                  ) : (
                    <span className="text-muted2">—</span>
                  )}
                </LigneMeta>
              </dl>
            )}
          </Panel>

          <Panel titre="Actions">
            {chargement ? (
              <p className="m-0 text-[12.5px] text-muted2">Chargement…</p>
            ) : ouvert ? (
              <div className="flex flex-col gap-2">
                {signalement.statut === 'nouveau' ? (
                  <Btn
                    variant="gold"
                    disabled={enCours}
                    onClick={function () {
                      demanderStatut('en_cours');
                    }}
                  >
                    Prendre en charge
                  </Btn>
                ) : null}
                <Btn
                  variant="teal"
                  disabled={enCours}
                  onClick={function () {
                    demanderStatut('resolu');
                  }}
                >
                  Marquer résolu
                </Btn>
                {signalement.statut === 'nouveau' ? (
                  <Btn
                    variant="ghost"
                    disabled={enCours}
                    onClick={function () {
                      demanderStatut('rejete');
                    }}
                  >
                    Rejeter
                  </Btn>
                ) : null}
              </div>
            ) : (
              <p className="m-0 text-[12.5px] text-muted2">
                Ce dossier est clos — plus aucune action de statut n’est possible.
              </p>
            )}
          </Panel>
        </aside>
      </div>

      <ModaleAffectationSignalement
        signalement={signalement}
        ouvert={affectationOuverte}
        onFermer={function () {
          setAffectationOuverte(false);
        }}
        onAffecte={charger}
      />

      <Modal
        ouvert={cloture !== null}
        onFermer={function () {
          setCloture(null);
        }}
        titre={cloture?.statut === 'rejete' ? 'Rejeter le signalement' : 'Marquer résolu'}
        sousTitre="Ce message est visible par l'habitant qui a signalé."
        taille="sm"
        pied={
          <div className="flex justify-end gap-2">
            <Btn
              variant="ghost"
              onClick={function () {
                setCloture(null);
              }}
            >
              Annuler
            </Btn>
            <Btn
              variant={cloture?.statut === 'rejete' ? 'red' : 'teal'}
              disabled={enCours || (cloture?.message ?? '').trim().length < MOTIF_MINIMUM}
              onClick={function () {
                poserEvenement(cloture.statut, cloture.message.trim());
              }}
            >
              {enCours ? 'Enregistrement…' : 'Confirmer'}
            </Btn>
          </div>
        }
      >
        <Champ
          autoFocus
          value={cloture?.message ?? ''}
          onChange={function (e) {
            setCloture(function (c) {
              return { ...c, message: e.target.value };
            });
          }}
          placeholder={
            cloture?.statut === 'rejete'
              ? 'Doublon avec un signalement déjà traité.'
              : 'Bac vidé ce matin, abords nettoyés.'
          }
        />
        <p className="mt-2 mb-0 text-[11.5px] text-muted2">
          {(cloture?.message ?? '').trim().length < MOTIF_MINIMUM
            ? `Encore ${MOTIF_MINIMUM - (cloture?.message ?? '').trim().length} caractères. Recevoir « rejeté » sans motif est ce qui décourage de signaler une seconde fois.`
            : 'Ce motif apparaîtra daté dans le suivi du signalement.'}
        </p>
      </Modal>
    </div>
  );
}
