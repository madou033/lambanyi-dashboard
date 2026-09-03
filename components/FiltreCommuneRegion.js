'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SelectFiltre } from '@/components/liste';

/** Observateur en vue Conakry (pas de commune choisie dans la topbar). */
export function besoinFiltreCommuneRegion(ctx) {
  return Boolean(ctx && ctx.niveau === 'region' && !ctx.lectureCommuneId);
}

export function useCommunesActives(actif) {
  const [communes, setCommunes] = useState([]);
  useEffect(
    function () {
      if (!actif) {
        setCommunes([]);
        return undefined;
      }
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
    [actif],
  );
  return communes;
}

/**
 * Filtre local « Toutes les communes » / une commune.
 * Visible seulement en mode Conakry régional.
 */
export function FiltreCommuneRegion({ ctx, valeur, onChange, className }) {
  const actif = besoinFiltreCommuneRegion(ctx);
  const communes = useCommunesActives(actif);
  if (!actif) return null;
  return (
    <SelectFiltre
      valeur={valeur || ''}
      onChange={onChange}
      ariaLabel="Filtrer par commune"
      className={className}
    >
      <option value="">Toutes les communes</option>
      {communes.map(function (commune) {
        return (
          <option key={commune.id} value={commune.id}>
            {commune.nom}
          </option>
        );
      })}
    </SelectFiltre>
  );
}
