'use client';

/**
 * Choix d'une équipe : une case par collecteur. Sert au planning (équipe
 * planifiée) et à la gestion d'un jour (équipe du jour).
 *
 * Un collecteur déjà dans l'équipe mais absent de la liste proposée (compte
 * désactivé, PME retirée du quartier) reste visible et décochable : on ne
 * fait pas disparaître une affectation sans le dire.
 */

import { cn } from '@/components/ui';

export function ListeCollecteurs({ collecteurs, choisis, onChange, disabled, vide }) {
  const ids = new Set(choisis);
  const connus = new Set(collecteurs.map(function (c) { return c.id; }));
  const horsListe = choisis.filter(function (id) { return !connus.has(id); });
  const lignes = collecteurs.concat(
    horsListe.map(function (id) { return { id, nom_complet: 'Collecteur hors liste', horsListe: true }; }),
  );

  function basculer(id) {
    if (ids.has(id)) {
      onChange(choisis.filter(function (x) { return x !== id; }));
    } else {
      onChange(choisis.concat(id));
    }
  }

  if (lignes.length === 0) {
    return <p className="m-0 text-[12px] text-muted2">{vide || 'Aucun collecteur disponible.'}</p>;
  }

  return (
    <div className="max-h-64 overflow-y-auto rounded-xl border border-line bg-bg2">
      {lignes.map(function (c) {
        const coche = ids.has(c.id);
        return (
          <label
            key={c.id}
            className={cn(
              'flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-[12.5px] last:border-b-0',
              coche ? 'text-txt' : 'text-muted',
              disabled && 'cursor-default opacity-60',
            )}
          >
            <input
              type="checkbox"
              checked={coche}
              disabled={disabled}
              onChange={function () { basculer(c.id); }}
              className="size-4 cursor-pointer accent-[var(--lp-green)]"
            />
            <span className={cn('truncate', coche && 'font-semibold')}>{c.nom_complet}</span>
            {c.horsListe ? <span className="ml-auto text-[10px] text-muted2 uppercase">hors liste</span> : null}
          </label>
        );
      })}
    </div>
  );
}

/** Les noms d'une équipe, courts : « Amadou, Binta » ou « Amadou, Binta +2 ». */
export function nomsEquipe(noms, max = 2) {
  const liste = (noms || []).filter(Boolean);
  if (liste.length <= max) return liste.join(', ');
  return `${liste.slice(0, max).join(', ')} +${liste.length - max}`;
}

/** L'équipe planifiée d'une tournée telle que la charge le planning. */
export function equipePlanifiee(tournee) {
  return (tournee?.tournees_collecteurs || []).map(function (x) {
    return { id: x.collecteur_id, nom_complet: x.profils?.nom_complet || 'Collecteur' };
  });
}
