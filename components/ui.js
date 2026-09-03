'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { MiniBarres } from '@/components/graphes';

/** Concatène des classes conditionnelles. */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* En-têtes                                                            */
/* ------------------------------------------------------------------ */

/**
 * En-tête d'écran — kicker tracké, H1 serif, phrase d'explication,
 * actions alignées à droite. Un seul par page.
 */
export function PageHeader({ kicker, titre, sousTitre, actions }) {
  return (
    <div className="lp-rise flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker ? (
          <div className="text-[10px] tracking-[2.5px] text-muted2 uppercase">{kicker}</div>
        ) : null}
        <h1 className="font-display m-0 mt-1 text-[27px] leading-tight font-bold text-txt">
          {titre}
        </h1>
        {sousTitre ? (
          <p className="mt-1.5 mb-0 max-w-2xl text-[12.5px] text-muted">{sousTitre}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Bloc éditorial — titre tracké sur filet, sans fond ni bordure.
 * `delai` décale l'entrée en scène (40 ms d'écart entre blocs).
 */
export function Bloc({ titre, extra, delai = 0, className, children }) {
  return (
    <section className={cn('lp-rise', className)} style={{ animationDelay: `${delai}ms` }}>
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-2.5">
        <h2 className="m-0 text-[11px] tracking-[2.4px] text-muted uppercase">{titre}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

/** Panneau encadré — pour un contenu qui doit se détacher du fond. */
export function Panel({ titre, action, className, children }) {
  return (
    <section className={cn('rounded-xl border border-line bg-panel', className)}>
      {titre ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h3 className="m-0 text-[13px] tracking-wide text-muted uppercase">{titre}</h3>
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Chiffres                                                            */
/* ------------------------------------------------------------------ */

const TONS_TEXTE = {
  defaut: 'text-txt',
  vert: 'text-green',
  teal: 'text-teal',
  or: 'text-gold',
  rouge: 'text-red',
  bleu: 'text-blue',
  muted: 'text-muted2',
};

/** KPI compact encadré. */
export function Kpi({ valeur, label, ton = 'defaut' }) {
  return (
    <div className="flex min-w-[142px] flex-1 flex-col justify-center rounded-[10px] border border-line bg-panel px-3.5 py-2">
      <div
        className={cn(
          'font-mono text-[22px] leading-none font-bold tabular-nums',
          TONS_TEXTE[ton] ?? TONS_TEXTE.defaut,
        )}
      >
        {valeur}
      </div>
      <div className="mt-1 text-[10px] tracking-wide text-muted uppercase">{label}</div>
    </div>
  );
}

/**
 * Compteur du bandeau pouls — cliquable, avec sparkline optionnelle.
 * C'est la pièce maîtresse du tableau de bord.
 */
export function Compteur({ label, valeur, sous, ton = 'defaut', href, graphe, accent, className }) {
  const contenu = (
    <>
      <span className="text-[9.5px] tracking-[1.8px] text-muted uppercase">{label}</span>
      <span
        className={cn(
          'font-mono text-[24px] leading-none font-bold tabular-nums sm:text-[28px]',
          TONS_TEXTE[ton] ?? TONS_TEXTE.defaut,
        )}
      >
        {valeur}
      </span>
      <span className="text-[11px] text-muted2 transition-colors group-hover:text-muted">
        {sous}
      </span>
      {graphe ? <MiniBarres valeurs={graphe} accent={accent} className="mt-1" /> : null}
    </>
  );

  const classe = cn(
    'group flex flex-col gap-1 rounded-xl border border-line bg-panel p-4 outline-none',
    'focus-visible:ring-2 focus-visible:ring-blue',
    href && 'cursor-pointer transition-colors hover:bg-panel2',
    className,
  );

  if (!href) return <div className={classe}>{contenu}</div>;
  return (
    <Link href={href} className={classe}>
      {contenu}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Statuts                                                             */
/* ------------------------------------------------------------------ */

/** Mapping métier statut → ton + libellé. cf. DESIGN_SYSTEM.md §4.1 */
const STATUTS = {
  // Ménages
  actif: { ton: 'teal', libelle: 'Actif' },
  suspendu: { ton: 'or', libelle: 'Suspendu' },
  resilie: { ton: 'muted', libelle: 'Résilié' },
  // Abonnements
  en_attente_paiement: { ton: 'or', libelle: 'Attente paiement' },
  expire: { ton: 'rouge', libelle: 'Expiré' },
  annule: { ton: 'muted', libelle: 'Annulé' },
  // Paiements
  en_attente: { ton: 'or', libelle: 'En attente' },
  confirme: { ton: 'teal', libelle: 'Confirmé' },
  echoue: { ton: 'rouge', libelle: 'Échoué' },
  // Signalements
  nouveau: { ton: 'rouge', libelle: 'Nouveau' },
  en_cours: { ton: 'or', libelle: 'En cours' },
  resolu: { ton: 'teal', libelle: 'Résolu' },
  rejete: { ton: 'muted', libelle: 'Rejeté' },
  // Passages
  effectue: { ton: 'teal', libelle: 'Effectué' },
  absent: { ton: 'or', libelle: 'Absent' },
  inaccessible: { ton: 'rouge', libelle: 'Inaccessible' },
};

const FONDS_TON = {
  vert: 'bg-[color-mix(in_srgb,var(--lp-green)_15%,transparent)] text-green',
  teal: 'bg-[color-mix(in_srgb,var(--lp-teal)_15%,transparent)] text-teal',
  or: 'bg-[color-mix(in_srgb,var(--lp-gold)_15%,transparent)] text-gold',
  rouge: 'bg-[color-mix(in_srgb,var(--lp-red)_16%,transparent)] text-red',
  bleu: 'bg-[color-mix(in_srgb,var(--lp-blue)_16%,transparent)] text-blue',
  violet: 'bg-[color-mix(in_srgb,var(--lp-violet)_16%,transparent)] text-violet',
  muted: 'bg-[color-mix(in_srgb,var(--lp-muted)_12%,transparent)] text-muted',
};

/** Badge générique — `ton` explicite. */
export function Badge({ ton = 'muted', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        FONDS_TON[ton] ?? FONDS_TON.muted,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Badge de statut métier — résout le ton et le libellé depuis le code. */
export function BadgeStatut({ statut, className }) {
  const def = STATUTS[statut];
  const libelle = def ? def.libelle : String(statut ?? '—').replaceAll('_', ' ');
  return (
    <Badge ton={def ? def.ton : 'muted'} className={className}>
      {libelle}
    </Badge>
  );
}

/** Ton associé à un statut — pour colorer un rail ou une barre. */
export function tonStatut(statut) {
  return STATUTS[statut] ? STATUTS[statut].ton : 'muted';
}

const VARS_TON = {
  vert: 'var(--lp-green)',
  teal: 'var(--lp-teal)',
  or: 'var(--lp-gold)',
  rouge: 'var(--lp-red)',
  bleu: 'var(--lp-blue)',
  violet: 'var(--lp-violet)',
  muted: 'var(--lp-muted2)',
};

/** Variable CSS d'un ton — pour les styles inline (rails, graphes). */
export function couleurTon(ton) {
  return VARS_TON[ton] ?? VARS_TON.muted;
}

/* ------------------------------------------------------------------ */
/* Contrôles                                                           */
/* ------------------------------------------------------------------ */

const VARIANTES_BTN = {
  ghost: 'border border-line2 bg-transparent text-txt hover:bg-panel2',
  // `text-encre` bascule avec le thème : les aplats d'accent sont clairs en
  // sombre (encre foncée) et foncés en clair (encre blanche).
  green: 'bg-green text-encre',
  teal: 'bg-teal text-encre',
  blue: 'bg-blue text-encre',
  gold: 'bg-gold text-encre',
  red: 'bg-red text-encre',
};

export function Btn({ variant = 'ghost', className, type = 'button', children, ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold outline-none transition-[filter] hover:brightness-110',
        'focus-visible:ring-2 focus-visible:ring-blue',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100',
        VARIANTES_BTN[variant] ?? VARIANTES_BTN.ghost,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Chip de filtre — rangée sous l'en-tête d'une liste. */
export function Chip({ actif, className, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      className={cn(
        'cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-blue',
        actif ? 'bg-panel2 text-txt' : 'text-muted hover:bg-panel2 hover:text-txt',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Champ de saisie standard. */
export function Champ({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-line bg-bg2 px-3 py-2 text-[12.5px] text-txt outline-none',
        'placeholder:text-muted2 focus:border-line2 focus:ring-2 focus:ring-blue/30',
        className,
      )}
      {...props}
    />
  );
}

/** Liste déroulante standard — chevron géré par l'appelant si besoin. */
export function Selecteur({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'cursor-pointer appearance-none rounded-xl border border-line2 bg-bg2 py-2 pr-8 pl-3 text-[12.5px] font-semibold text-txt outline-none',
        'focus:ring-2 focus:ring-blue/30',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* États                                                               */
/* ------------------------------------------------------------------ */

/** État vide — une phrase qui explique pourquoi, plus un CTA au maximum. */
export function EmptyState({ children, action }) {
  return (
    <div className="px-2.5 py-8 text-center">
      <p className="m-0 text-[13px] text-muted2">{children}</p>
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Bandeau d'erreur — factuel, avec une action de reprise. */
export function BandeauErreur({ message, onReessayer }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--lp-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-red)_14%,transparent)] px-4 py-3">
      <p className="m-0 text-[12.5px] text-txt">{message}</p>
      {onReessayer ? (
        <Btn variant="ghost" onClick={onReessayer}>
          Réessayer
        </Btn>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

export function PaginationBar({ page, pages, total, disabled, onChange, className }) {
  if (pages <= 1 && total === 0) return null;
  const classeBouton =
    'cursor-pointer rounded-lg border border-line2 px-3 py-1.5 text-[12px] text-muted outline-none transition-colors hover:text-txt focus-visible:ring-2 focus-visible:ring-blue disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2.5',
        className,
      )}
    >
      <span className="font-mono text-[11px] text-muted2 tabular-nums">
        {total} résultat{total > 1 ? 's' : ''} · page {page}/{Math.max(pages, 1)}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
          className={classeBouton}
        >
          Précédent
        </button>
        <button
          type="button"
          disabled={disabled || page >= pages}
          onClick={() => onChange(page + 1)}
          className={classeBouton}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modales                                                             */
/* ------------------------------------------------------------------ */

const TAILLES_MODALE = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  ouvert,
  onFermer,
  titre,
  sousTitre,
  taille = 'md',
  pied,
  bloquerFermeture = false,
  children,
}) {
  useEffect(
    function () {
      if (!ouvert) return undefined;
      const precedent = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      function surTouche(e) {
        if (e.key === 'Escape' && !bloquerFermeture) onFermer();
      }
      window.addEventListener('keydown', surTouche);
      return function () {
        document.body.style.overflow = precedent;
        window.removeEventListener('keydown', surTouche);
      };
    },
    [ouvert, onFermer, bloquerFermeture],
  );

  if (!ouvert) return null;

  return (
    <div className="lp-modal-root" role="dialog" aria-modal="true" aria-labelledby="lp-modal-titre">
      <button
        type="button"
        className="lp-modal-backdrop"
        aria-label="Fermer"
        disabled={bloquerFermeture}
        onClick={function () {
          if (!bloquerFermeture) onFermer();
        }}
      />
      <div className={cn('lp-modal-panel', TAILLES_MODALE[taille])}>
        <header className="shrink-0 border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="lp-modal-titre"
                className="font-display m-0 text-[20px] leading-tight font-bold text-txt"
              >
                {titre}
              </h2>
              {sousTitre ? <p className="mt-1 mb-0 text-[12.5px] text-muted">{sousTitre}</p> : null}
            </div>
            {!bloquerFermeture ? (
              <button
                type="button"
                onClick={onFermer}
                aria-label="Fermer"
                className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-line bg-panel2 text-[18px] text-muted outline-none transition-colors hover:text-txt focus-visible:ring-2 focus-visible:ring-blue"
              >
                ×
              </button>
            ) : null}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {pied ? <footer className="shrink-0 border-t border-line px-5 py-4">{pied}</footer> : null}
      </div>
    </div>
  );
}

export function ModalConfirmation({
  ouvert,
  titre,
  message,
  confirmerLabel = 'Confirmer',
  annulerLabel = 'Annuler',
  danger = false,
  pending = false,
  onConfirmer,
  onAnnuler,
}) {
  return (
    <Modal
      ouvert={ouvert}
      onFermer={onAnnuler}
      titre={titre}
      taille="sm"
      bloquerFermeture={pending}
      pied={
        <div className="flex flex-wrap justify-end gap-2">
          <Btn variant="ghost" disabled={pending} onClick={onAnnuler}>
            {annulerLabel}
          </Btn>
          <Btn variant={danger ? 'red' : 'green'} disabled={pending} onClick={onConfirmer}>
            {pending ? 'Patientez…' : confirmerLabel}
          </Btn>
        </div>
      }
    >
      <div className="text-[13.5px] leading-relaxed text-muted">{message}</div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Formatage                                                           */
/* ------------------------------------------------------------------ */

const FORMAT_NOMBRE = new Intl.NumberFormat('fr-FR');

export function nombre(valeur) {
  return FORMAT_NOMBRE.format(Number(valeur) || 0);
}

/** Montant en francs guinéens, sans décimales. */
export function montant(valeur) {
  return `${FORMAT_NOMBRE.format(Math.round(Number(valeur) || 0))} GNF`;
}

export function ilYA(iso) {
  if (!iso) return '—';
  const secondes = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secondes < 60) return "à l'instant";
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 31) return `il y a ${jours} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function heure(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
