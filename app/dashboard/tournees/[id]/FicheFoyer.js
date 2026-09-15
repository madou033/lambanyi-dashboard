'use client';

/**
 * La fiche courte d'un foyer, ouverte depuis la liste d'une tournée :
 * abonnement, QR code, ce que la collecte en a fait, et où il est.
 * Pour le reste (paiements, historique complet), la fiche ménage.
 */

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { LigneMeta } from '@/components/fiche';
import { Badge, BadgeStatut, Btn, Modal, heure, montant, nombre } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const CarteFoyer = dynamic(
  function () {
    return import('./CarteFoyer');
  },
  {
    ssr: false,
    loading: function () {
      return (
        <div className="grid h-full place-items-center text-[12px] text-muted2">Chargement de la carte…</div>
      );
    },
  },
);

const TYPES_MENAGE = {
  residentiel: 'Résidentiel',
  commerce: 'Commerce',
  institution: 'Institution',
  industrie: 'Industrie',
};

const PASSAGES = {
  effectue: { ton: 'teal', libelle: 'Effectué' },
  absent: { ton: 'or', libelle: 'Absent' },
  inaccessible: { ton: 'muted', libelle: 'Inaccessible' },
};

const MOTIFS = {
  bac_non_sorti: 'bac non sorti',
  acces_ferme: 'accès fermé',
  rue_bloquee: 'rue bloquée',
  autre: 'autre motif',
};

function dateCourte(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** L'état d'abonnement en un badge : ce que la tournée a besoin de savoir. */
export function etatAbonnement(f) {
  if (f.abonne) {
    return f.est_solde
      ? { ton: 'teal', libelle: 'Abonné · à jour' }
      : { ton: 'or', libelle: `Abonné · ${nombre(f.mois_dus)} mois du${f.mois_dus > 1 ? 's' : ''}` };
  }
  if (f.abonnement_id) return { ton: 'rouge', libelle: 'Abonnement inactif' };
  return { ton: 'muted', libelle: 'Sans abonnement' };
}

function Section({ titre, children }) {
  return (
    <section>
      <h3 className="mt-0 mb-1.5 text-[10px] tracking-[2px] text-muted2 uppercase">{titre}</h3>
      {children}
    </section>
  );
}

export function FicheFoyer({ foyer, quartier, hrefFiche, onFermer }) {
  const [passages, setPassages] = useState(null);
  const [effectues30j, setEffectues30j] = useState(0);
  const [carte, setCarte] = useState(false);

  const localise = foyer.latitude != null && foyer.longitude != null;
  const abo = etatAbonnement(foyer);
  const aujourdhui = foyer.statut ? PASSAGES[foyer.statut] : null;

  useEffect(
    function () {
      let vivant = true;
      const maintenant = Date.now();
      const depuis = new Date(maintenant - 60 * 86_400_000).toISOString();
      const seuil30j = maintenant - 30 * 86_400_000;
      // Les derniers passages, toutes tournées confondues : ce foyer peut
      // être desservi par deux tournées du même quartier.
      supabase
        .from('passages_detail')
        .select('id, statut, motif, pointe_a, jour_local, collecteur, ecart_m, hors_seuil')
        .eq('menage_id', foyer.id)
        .gte('pointe_a', depuis)
        .order('pointe_a', { ascending: false })
        .limit(8)
        .then(function (r) {
          if (!vivant) return;
          const liste = r.data || [];
          setPassages(liste);
          setEffectues30j(liste.filter(function (p) {
            return p.statut === 'effectue' && new Date(p.pointe_a).getTime() >= seuil30j;
          }).length);
        });
      return function () {
        vivant = false;
      };
    },
    [foyer.id],
  );

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre={foyer.code_menage}
      sousTitre={`${foyer.point_repere}${quartier ? ` · ${quartier}` : ''}`}
      taille="lg"
      pied={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={hrefFiche}
            className="text-[12.5px] font-semibold text-blue outline-none hover:underline focus-visible:ring-2 focus-visible:ring-blue"
          >
            Ouvrir la fiche complète du ménage →
          </Link>
          <Btn variant="ghost" onClick={onFermer}>Fermer</Btn>
        </div>
      }
    >
      <div className="grid gap-6 sm:grid-cols-[176px_1fr]">
        {/* QR code : le même que sur la planche imprimable. */}
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={foyer.code_menage} size={150} level="M" />
          </div>
          <span className="font-mono text-[12px] font-bold tracking-wide text-txt">{foyer.code_menage}</span>
          <span className="text-center text-[11px] text-muted2">Le code que le collecteur scanne.</span>
        </div>

        <div className="flex flex-col gap-5">
          <Section titre="Abonnement">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge ton={abo.ton}>{abo.libelle}</Badge>
              {foyer.est_solde && foyer.abonne ? null : foyer.total_du > 0 ? (
                <span className="text-[12px] text-muted">{montant(foyer.total_du)} dus</span>
              ) : null}
            </div>
            <dl className="m-0">
              <LigneMeta label="Formule">{foyer.plan_code || '—'}</LigneMeta>
              <LigneMeta label="Échéance">{dateCourte(foyer.date_fin)}</LigneMeta>
            </dl>
          </Section>

          <Section titre="Foyer">
            <dl className="m-0">
              <LigneMeta label="Type">
                {TYPES_MENAGE[foyer.type_menage] || foyer.type_menage || '—'}
                {foyer.nb_personnes ? ` · ${nombre(foyer.nb_personnes)} personne${foyer.nb_personnes > 1 ? 's' : ''}` : ''}
              </LigneMeta>
              <LigneMeta label="Téléphone">
                {foyer.telephone_contact ? (
                  <a href={`tel:${foyer.telephone_contact}`} className="font-mono text-blue hover:underline">
                    {foyer.telephone_contact}
                  </a>
                ) : (
                  '—'
                )}
              </LigneMeta>
              <LigneMeta label="Statut">
                <BadgeStatut statut={foyer.statut_menage || 'actif'} />
              </LigneMeta>
            </dl>
          </Section>

          <Section titre="Collecte">
            <dl className="m-0">
              <LigneMeta label="Aujourd’hui">
                {aujourdhui ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge ton={aujourdhui.ton}>{aujourdhui.libelle}</Badge>
                    <span className="text-[12px] text-muted">
                      {heure(foyer.pointe_a)}
                      {foyer.motif ? ` · ${MOTIFS[foyer.motif] || foyer.motif}` : ''}
                      {foyer.ecart_m != null ? ` · à ${nombre(foyer.ecart_m)} m` : ''}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted2">Pas encore pointé</span>
                )}
              </LigneMeta>
              <LigneMeta label="30 jours">
                {passages === null ? 'Chargement…' : `${nombre(effectues30j)} collecte${effectues30j > 1 ? 's' : ''} effectuée${effectues30j > 1 ? 's' : ''}`}
              </LigneMeta>
            </dl>
            {passages && passages.length ? (
              <ul className="m-0 mt-1 list-none divide-y divide-line rounded-xl border border-line p-0">
                {passages.slice(0, 5).map(function (p) {
                  const def = PASSAGES[p.statut] || PASSAGES.inaccessible;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12px]">
                      <span className="font-mono text-muted">{dateCourte(p.jour_local)} {heure(p.pointe_a)}</span>
                      <Badge ton={def.ton}>{def.libelle}</Badge>
                      <span className="text-muted2">
                        {p.collecteur || 'Collecteur inconnu'}
                        {p.motif ? ` · ${MOTIFS[p.motif] || p.motif}` : ''}
                        {p.hors_seuil ? ' · loin du foyer' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : passages && passages.length === 0 ? (
              <p className="m-0 text-[12px] text-muted2">Aucun passage sur les 60 derniers jours.</p>
            ) : null}
          </Section>

          <Section titre="Localisation">
            {localise ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-[12.5px] text-txt">
                    {foyer.latitude.toFixed(6)}, {foyer.longitude.toFixed(6)}
                  </span>
                  <Btn
                    variant={carte ? 'ghost' : 'blue'}
                    onClick={function () {
                      setCarte(function (v) { return !v; });
                    }}
                  >
                    {carte ? 'Masquer la carte' : 'Voir sur la carte'}
                  </Btn>
                  <a
                    href={`https://www.google.com/maps?q=${foyer.latitude},${foyer.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] font-semibold text-blue hover:underline"
                  >
                    Google Maps ↗
                  </a>
                </div>
                {carte ? (
                  <div className="mt-3 h-64 overflow-hidden rounded-xl border border-line">
                    <CarteFoyer
                      latitude={foyer.latitude}
                      longitude={foyer.longitude}
                      code={foyer.code_menage}
                      repere={foyer.point_repere}
                      abonne={foyer.abonne}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <p className="m-0 text-[12px] text-muted2">
                Position non renseignée : le foyer a été déclaré sans GPS.
              </p>
            )}
          </Section>
        </div>
      </div>
    </Modal>
  );
}
