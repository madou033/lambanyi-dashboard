'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useContexte } from '@/components/ContexteProvider';

/**
 * Observateur régional uniquement : choisit Conakry (toute la région)
 * ou une commune. Le reste du dashboard suit via ?commune=.
 */
export function SelecteurTerritoire() {
  const { ctx, communeLecture, setLectureCommune } = useContexte();
  const [communes, setCommunes] = useState([]);

  useEffect(
    function () {
      if (ctx?.niveau !== 'region') return undefined;
      let annule = false;
      async function charger() {
        const { data } = await supabase
          .from('communes')
          .select('id, nom, code')
          .eq('active', true)
          .order('nom');
        if (!annule) setCommunes(data || []);
      }
      charger();
      return function () {
        annule = true;
      };
    },
    [ctx?.niveau],
  );

  if (ctx?.niveau !== 'region') return null;

  const valeur = ctx.lectureCommuneId || '';

  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="hidden text-[10px] tracking-[1.5px] text-muted2 uppercase sm:inline">
        Territoire
      </span>
      <select
        value={valeur}
        aria-label="Territoire observé"
        onChange={function (e) {
          setLectureCommune(e.target.value || null);
        }}
        className="max-w-[220px] cursor-pointer truncate rounded-full border border-line2 bg-panel py-1.5 pr-8 pl-3 font-mono text-[12px] tracking-wide text-txt outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        <option value="">Conakry (région)</option>
        {communes.map(function (commune) {
          return (
            <option key={commune.id} value={commune.id}>
              {commune.nom}
              {commune.code ? ` · ${commune.code}` : ''}
            </option>
          );
        })}
      </select>
      {communeLecture?.nom ? (
        <span className="hidden text-[11px] text-muted md:inline">Lecture seule</span>
      ) : null}
    </label>
  );
}
