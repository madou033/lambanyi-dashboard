'use client';

/**
 * Briques de l'écran de liste — cf. DESIGN_SYSTEM.md §5.2.
 * Toolbar, chips, tableau dense, pagination, export CSV.
 */

import { Children, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/components/ui';
import { IconChevronBas, IconRecherche } from '@/components/icons';

/* ------------------------------------------------------------------ */
/* Carte de liste                                                      */
/* ------------------------------------------------------------------ */

/**
 * Enveloppe standard : en-tête (titre + décompte + outils), rangée de
 * chips, corps, pied de pagination.
 */
export function CarteListe({ titre, sousTitre, outils, chips, pied, delai = 60, children }) {
  return (
    <section
      className="lp-rise mt-6 rounded-2xl border border-line bg-panel"
      style={{ animationDelay: `${delai}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="m-0 text-[16px] font-semibold text-txt">{titre}</h2>
          {sousTitre ? <p className="mt-0.5 mb-0 text-[12px] text-muted2">{sousTitre}</p> : null}
        </div>
        {outils ? <div className="flex flex-wrap items-center gap-2">{outils}</div> : null}
      </div>

      {chips ? (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3">{chips}</div>
      ) : null}

      {children}

      {pied}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Contrôles de toolbar                                                */
/* ------------------------------------------------------------------ */

export function Recherche({ valeur, onChange, placeholder = 'Rechercher…', className }) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">Rechercher</span>
      <IconRecherche className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted2" />
      <input
        type="search"
        value={valeur}
        onChange={function (e) {
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="w-48 rounded-xl border border-line bg-bg2 py-2 pr-3 pl-8 text-[12.5px] text-txt outline-none placeholder:text-muted2 focus:border-line2 focus:ring-2 focus:ring-blue/30"
      />
    </label>
  );
}

export function SelectFiltre({ valeur, onChange, ariaLabel, className, children }) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={valeur}
        aria-label={ariaLabel}
        onChange={function (e) {
          onChange(e.target.value);
        }}
        className="cursor-pointer appearance-none rounded-xl border border-line2 bg-bg2 py-2 pr-8 pl-3 text-[12.5px] font-semibold text-txt outline-none focus:ring-2 focus:ring-blue/30"
      >
        {children}
      </select>
      <IconChevronBas className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted2" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tableau dense                                                       */
/* ------------------------------------------------------------------ */

/**
 * @param colonnes [{ cle, label, align?: 'right'|'center', className?, noPrint? }]
 */
export function Tableau({ colonnes, children, vide }) {
  const lignes = Children.toArray(children).filter(Boolean);
  const afficherVide = Boolean(vide) && lignes.length === 0;

  return (
    <div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line">
            {colonnes.map(function (c) {
              return (
                <th
                  key={c.cle}
                  scope="col"
                  className={cn(
                    'sticky top-0 z-10 bg-panel px-5 py-2.5 text-[10px] font-semibold tracking-wide text-muted uppercase',
                    c.align === 'right'
                      ? 'text-right'
                      : c.align === 'center'
                        ? 'text-center'
                        : 'text-left',
                    c.noPrint && 'no-print',
                    c.className,
                  )}
                >
                  {c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {lignes}
          {afficherVide ? (
            <tr>
              <td colSpan={colonnes.length} className="px-5 py-10 text-center text-[13px] text-muted2">
                {vide}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function Tr({ href, className, rang = 0, children, ...props }) {
  const router = useRouter();
  const cliquable = Boolean(href);

  function aller(e) {
    if (!cliquable) return;
    if (e.target.closest('a, button, input, select, textarea, label, [data-no-row-nav]')) return;
    router.push(href);
  }

  function clavier(e) {
    if (!cliquable) return;
    if (e.target.closest('a, button, input, select, textarea, label, [data-no-row-nav]')) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    router.push(href);
  }

  return (
    <tr
      role={cliquable ? 'link' : undefined}
      tabIndex={cliquable ? 0 : undefined}
      onClick={cliquable ? aller : undefined}
      onKeyDown={cliquable ? clavier : undefined}
      className={cn(
        'lp-rise border-b border-line last:border-b-0 transition-colors',
        'hover:bg-[color-mix(in_srgb,var(--lp-txt)_2.5%,transparent)]',
        cliquable &&
          'cursor-pointer outline-none focus-visible:bg-[color-mix(in_srgb,var(--lp-txt)_4%,transparent)] focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-inset',
        className,
      )}
      style={{ animationDelay: `${Math.min(rang, 12) * 30}ms` }}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({ align, mono, fort, className, children, ...props }) {
  return (
    <td
      className={cn(
        'px-5 py-3 text-[12.5px]',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        mono && 'font-mono tabular-nums',
        fort ? 'font-semibold text-txt' : 'text-muted',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

/** Découpe une liste et remet la page à 1 quand la liste change de taille. */
export function usePagination(items, taille = 25, controle) {
  const [pageInterne, setPageInterne] = useState(1);
  const [tailleVue, setTailleVue] = useState(items.length);
  const pages = Math.max(1, Math.ceil(items.length / taille));
  const controlee = Boolean(controle);

  if (!controlee && tailleVue !== items.length) {
    setTailleVue(items.length);
    setPageInterne(1);
  }

  const pageBrute = controlee ? controle.page : pageInterne;
  const page = Math.min(Math.max(1, pageBrute), pages);
  const setPage = controlee ? controle.onChange : setPageInterne;

  const tranche = useMemo(
    function () {
      const debut = (page - 1) * taille;
      return items.slice(debut, debut + taille);
    },
    [items, page, taille],
  );

  return { page, pages, total: items.length, tranche, setPage };
}

/* ------------------------------------------------------------------ */
/* Export CSV                                                          */
/* ------------------------------------------------------------------ */

/**
 * Télécharge un CSV point-virgule, BOM UTF-8 pour qu'Excel lise les accents.
 * @param lignes tableau de tableaux de valeurs, dans l'ordre des entêtes
 */
export function exporterCsv(nomFichier, entetes, lignes) {
  const echapper = function (c) {
    return `"${String(c ?? '').replace(/"/g, '""')}"`;
  };
  const contenu =
    '﻿' +
    [entetes, ...lignes]
      .map(function (l) {
        return l.map(echapper).join(';');
      })
      .join('\n');

  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `${nomFichier}_${new Date().toISOString().slice(0, 10)}.csv`;
  lien.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* En-tête d'impression                                                */
/* ------------------------------------------------------------------ */

/** Visible uniquement à l'impression — identifie la commune et le filtre. */
export function EnteteImpression({ titre, contexte }) {
  return (
    <div className="entete-impression" style={{ display: 'none', marginBottom: 12 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
        Commune de Lambanyi — {titre}
      </h2>
      <div style={{ fontSize: 12, marginTop: 4 }}>
        {contexte ? `${contexte} · ` : ''}
        Édité le {new Date().toLocaleDateString('fr-FR')}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bandeau de métriques d'écran                                        */
/* ------------------------------------------------------------------ */

/**
 * Grille de cartes-compteurs propre à un écran de liste — plus compacte que le
 * bandeau pouls du tableau de bord.
 * @param metriques [{ label, valeur, sous?, ton?, onClick?, actif? }]
 */
export function BandeauMetriques({ metriques, delai = 40 }) {
  const TONS = {
    defaut: 'text-txt',
    vert: 'text-green',
    teal: 'text-teal',
    or: 'text-gold',
    rouge: 'text-red',
    bleu: 'text-blue',
    muted: 'text-muted2',
  };
  return (
    <div
      className="lp-rise mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      style={{ animationDelay: `${delai}ms` }}
    >
      {metriques.map(function (m) {
        const contenu = (
          <>
            <span className="text-[9.5px] tracking-[1.8px] text-muted uppercase">{m.label}</span>
            <span
              className={cn(
                'font-mono text-[24px] leading-none font-bold tabular-nums',
                TONS[m.ton] ?? TONS.defaut,
              )}
            >
              {m.valeur}
            </span>
            {m.sous ? <span className="text-[11px] text-muted2">{m.sous}</span> : null}
          </>
        );
        const className = cn(
          'flex flex-col gap-1 rounded-xl border border-line bg-panel p-4',
          m.onClick &&
            'cursor-pointer outline-none transition-colors hover:bg-panel2 focus-visible:ring-2 focus-visible:ring-blue',
          m.actif && 'border-green ring-1 ring-green/30',
        );
        return m.onClick ? (
          <button
            key={m.label}
            type="button"
            onClick={m.onClick}
            aria-pressed={m.actif || undefined}
            className={className}
          >
            {contenu}
          </button>
        ) : (
          <div key={m.label} className={className}>
            {contenu}
          </div>
        );
      })}
    </div>
  );
}
