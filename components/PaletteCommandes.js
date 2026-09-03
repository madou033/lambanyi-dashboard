'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { IconRecherche } from '@/components/icons';
import { SECTIONS_NAV } from '@/lib/navigation';
import { cheminContexte, lienVisible } from '@/lib/contexte';

function normaliser(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function correspond(requete, ...champs) {
  if (!requete) return true;
  const q = normaliser(requete);
  return champs.some(function (c) {
    return normaliser(c).includes(q);
  });
}

function itemsNav(ctx) {
  return SECTIONS_NAV.flatMap(function (section) {
    return section.liens.filter(function (lien) {
      return lien.disponible && lienVisible(lien, ctx);
    }).map(function (lien) {
      return {
        kind: 'nav',
        id: `nav:${lien.to}`,
        label: lien.label,
        domaine: section.domaine,
        section: section.titre,
        description: section.description,
        to: cheminContexte(lien.to, ctx),
        disponible: lien.disponible,
        Icon: section.Icon,
      };
    });
  });
}

export function PaletteCommandes({ ouvert, onFermer, onNaviguer, actions = [], ctx }) {
  const [requete, setRequete] = useState('');
  const [curseur, setCurseur] = useState(0);
  const [ouvertVu, setOuvertVu] = useState(ouvert);
  const champRef = useRef(null);

  const resultats = useMemo(
    function () {
      const nav = itemsNav(ctx).filter(function (i) {
        return correspond(requete, i.label, i.section, i.domaine, i.description);
      });
      const act = actions
        .filter(function (a) {
          return correspond(requete, a.label, a.description ?? '');
        })
        .map(function (a) {
          return { kind: 'action', ...a };
        });
      return [...nav, ...act];
    },
    [requete, actions, ctx],
  );

  // Remise à zéro pendant le rendu, au moment où la palette s'ouvre : un
  // effet provoquerait un rendu en cascade juste avant l'affichage.
  if (ouvert !== ouvertVu) {
    setOuvertVu(ouvert);
    if (ouvert) {
      setRequete('');
      setCurseur(0);
    }
  }

  useEffect(
    function () {
      if (!ouvert) return undefined;
      const id = window.setTimeout(function () {
        champRef.current?.focus();
      }, 10);
      return function () {
        window.clearTimeout(id);
      };
    },
    [ouvert],
  );

  if (!ouvert) return null;

  function executer(item) {
    onFermer();
    if (item.kind === 'nav') onNaviguer(item.to);
    else item.executer();
  }

  function surTouche(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onFermer();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCurseur(function (c) {
        return resultats.length === 0 ? 0 : (c + 1) % resultats.length;
      });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCurseur(function (c) {
        return resultats.length === 0 ? 0 : (c - 1 + resultats.length) % resultats.length;
      });
      return;
    }
    if (e.key === 'Enter' && resultats[curseur]) {
      e.preventDefault();
      executer(resultats[curseur]);
    }
  }

  return (
    <div
      className="lp-modal-root items-start pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
    >
      <button type="button" className="lp-modal-backdrop" aria-label="Fermer" onClick={onFermer} />
      <div className="lp-modal-panel max-w-xl">
        <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-4 py-3">
          <IconRecherche className="size-4 shrink-0 text-muted2" />
          <input
            ref={champRef}
            value={requete}
            onChange={function (e) {
              setRequete(e.target.value);
              setCurseur(0);
            }}
            onKeyDown={surTouche}
            placeholder="Aller à une page, exécuter une action…"
            aria-label="Rechercher"
            autoComplete="off"
            className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] text-txt outline-none placeholder:text-muted2"
          />
          <kbd className="shrink-0 rounded border border-line2 px-1.5 py-0.5 font-mono text-[10px] text-muted2">
            Échap
          </kbd>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {resultats.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted2">
              Aucune correspondance pour « {requete} ».
            </p>
          ) : (
            resultats.map(function (item, i) {
              const Icon = item.Icon;
              const selectionne = i === curseur;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={function () {
                    setCurseur(i);
                  }}
                  onClick={function () {
                    executer(item);
                  }}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left outline-none transition-colors',
                    selectionne ? 'bg-panel2' : 'hover:bg-panel2',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-lg border border-line',
                      item.danger ? 'text-red' : selectionne ? 'text-green' : 'text-muted',
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block truncate text-[12.5px] font-semibold',
                        item.danger ? 'text-red' : 'text-txt',
                      )}
                    >
                      {item.label}
                      {item.kind === 'nav' && !item.disponible ? (
                        <span className="ml-2 rounded border border-line2 px-1 py-px text-[8.5px] font-normal tracking-wide text-muted2 uppercase">
                          bientôt
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-muted2">
                      {item.kind === 'nav' ? item.section : item.description}
                    </span>
                  </span>
                  {item.kind === 'nav' ? (
                    <span className="shrink-0 rounded border border-line2 px-1 py-px font-mono text-[8.5px] tracking-wider text-muted2">
                      {item.domaine}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4 border-t border-line px-4 py-2 font-mono text-[10px] text-muted2">
          <span>↑ ↓ naviguer</span>
          <span>↵ ouvrir</span>
          <span>Échap fermer</span>
        </div>
      </div>
    </div>
  );
}
