'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import {
  BandeauErreur,
  Btn,
  Chip,
  EmptyState,
  PageHeader,
  Selecteur,
  cn,
  nombre,
} from '@/components/ui';
import { Recherche } from '@/components/liste';
import { useContexte } from '@/components/ContexteProvider';

/** Colonnes de la planche — trois tient sur A4 portrait, quatre serre. */
const FORMATS = [
  { code: 3, label: '3 par ligne' },
  { code: 4, label: '4 par ligne' },
  { code: 5, label: '5 par ligne' },
];

const TAILLES_QR = { 3: 140, 4: 116, 5: 96 };

/** Référence stable : évite de recréer un tableau vide à chaque rendu. */
const VIDE = [];

export default function QrMenagesPage() {
  const { ctx, profil, communeLecture } = useContexte();
  const [quartiers, setQuartiers] = useState([]);
  const [quartierId, setQuartierId] = useState('');
  const [menages, setMenages] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [format, setFormat] = useState(3);

  useEffect(function () {
    const idCommune = ctx?.lectureCommuneId || ctx?.communeId;
    const requete = idCommune
      ? supabase.from('quartiers').select('id, nom, code').eq('commune_id', idCommune).eq('actif', true).order('nom')
      : ctx?.pmeId
        ? supabase.from('pme_quartiers').select('quartiers!inner(id, nom, code, actif)').eq('pme_id', ctx.pmeId)
        : supabase.from('quartiers').select('id, nom, code').eq('actif', true).order('nom');
    requete
      .then(function ({ data, error }) {
        if (error) {
          setErreur(`Impossible de charger les quartiers : ${error.message}`);
          return;
        }
        setQuartiers(ctx?.pmeId ? (data || []).map(function (x) { return x.quartiers; }) : data || []);
      });
  }, [ctx]);

  const charger = useCallback(
    async function () {
      if (!quartierId) return;
      setChargement(true);
      const { data, error } = await supabase
        .from('menages')
        .select('id, code_menage, point_repere, telephone_contact')
        .eq('quartier_id', quartierId)
        .not('code_menage', 'is', null)
        .order('code_menage');
      setChargement(false);
      if (error) {
        setErreur(`Impossible de charger les ménages : ${error.message}`);
        return;
      }
      setErreur(null);
      setMenages(data || []);
    },
    [quartierId],
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

  // Tant qu'aucun quartier n'est choisi, la planche est vide par dérivation :
  // pas besoin de remettre l'état à zéro depuis un effet.
  const duQuartier = quartierId ? menages : VIDE;

  const filtres = useMemo(
    function () {
      const q = recherche.trim().toLowerCase();
      if (!q) return duQuartier;
      return duQuartier.filter(function (m) {
        return `${m.code_menage ?? ''} ${m.point_repere ?? ''}`.toLowerCase().includes(q);
      });
    },
    [duQuartier, recherche],
  );

  const quartier = quartiers.find(function (q) {
    return q.id === quartierId;
  });
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
          kicker="Usagers · Atelier d'impression"
          titre="Codes QR"
          sousTitre="Planche à coller sur les bacs des foyers. Le code scanné par le collecteur pointe le passage."
          actions={
            <Btn
              variant="green"
              onClick={function () {
                window.print();
              }}
              disabled={filtres.length === 0}
            >
              Imprimer la planche
            </Btn>
          }
        />

        <BandeauErreur message={erreur} />

        <div className="lp-rise mt-6 flex flex-wrap items-center gap-2" style={{ animationDelay: '40ms' }}>
          <Selecteur
            value={quartierId}
            aria-label="Choisir un quartier"
            onChange={function (e) {
              setQuartierId(e.target.value);
            }}
          >
            <option value="">Choisir un quartier…</option>
            {quartiers.map(function (q) {
              return (
                <option key={q.id} value={q.id}>
                  {q.nom} ({q.code})
                </option>
              );
            })}
          </Selecteur>

          <Recherche valeur={recherche} onChange={setRecherche} placeholder="Code, repère…" />

          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map(function (f) {
              return (
                <Chip
                  key={f.code}
                  actif={format === f.code}
                  onClick={function () {
                    setFormat(f.code);
                  }}
                >
                  {f.label}
                </Chip>
              );
            })}
          </div>

          <div className="flex-1" />

          <span className="font-mono text-[11.5px] text-muted2 tabular-nums">
            {nombre(filtres.length)} étiquette{filtres.length > 1 ? 's' : ''}
            {filtres.length !== duQuartier.length ? ` sur ${nombre(duQuartier.length)}` : ''}
          </span>
        </div>
      </div>

      {/* En-tête d'impression */}
      <div className="entete-impression" style={{ display: 'none', marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          {territoire} — Codes QR des ménages
        </h2>
        <div style={{ fontSize: 12, marginTop: 4 }}>
          {quartier ? `${quartier.nom} (${quartier.code}) · ` : ''}
          {filtres.length} étiquettes · Édité le {new Date().toLocaleDateString('fr-FR')}
        </div>
      </div>

      {!quartierId ? (
        <div className="mt-10">
          <EmptyState>
            Choisissez un quartier pour composer sa planche d&apos;étiquettes.
          </EmptyState>
        </div>
      ) : chargement ? (
        <p className="mt-10 text-center text-[12.5px] text-muted2">Chargement des ménages…</p>
      ) : filtres.length === 0 ? (
        <div className="mt-10">
          <EmptyState>
            {duQuartier.length === 0
              ? "Aucun ménage codifié dans ce quartier — inscrivez des foyers au registre d'abord."
              : `Aucun ménage ne correspond à « ${recherche} ».`}
          </EmptyState>
        </div>
      ) : (
        <div
          className="planche mt-6 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${format}, minmax(0, 1fr))` }}
        >
          {filtres.map(function (m, rang) {
            return (
              <article
                key={m.id}
                className={cn(
                  'carte lp-rise flex flex-col items-center rounded-xl border border-line bg-panel p-3 text-center',
                )}
                style={{ animationDelay: `${Math.min(rang, 12) * 25}ms` }}
              >
                {/* Fond blanc obligatoire : un QR sombre n'est pas scannable. */}
                <div className="rounded-lg bg-white p-2">
                  <QRCodeSVG value={m.code_menage} size={TAILLES_QR[format]} level="M" />
                </div>
                <div className="mt-2.5 font-mono text-[13px] font-bold text-txt">
                  {m.code_menage}
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] text-muted">{m.point_repere}</div>
                <div className="mt-1.5 text-[9px] tracking-[1.4px] text-muted2 uppercase">
                  Lambanyi Propre
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        @media print {
          .planche {
            gap: 8px;
          }
          .carte {
            page-break-inside: avoid;
            border-color: var(--lp-line2) !important;
            background: var(--lp-panel) !important;
            color: var(--lp-txt) !important;
          }
          .carte * {
            color: var(--lp-txt) !important;
          }
        }
      `}</style>
    </div>
  );
}
