'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useContexte } from '@/components/ContexteProvider';
import { BandeauErreur, Bloc, Btn, Champ, EmptyState, PageHeader } from '@/components/ui';

const CLES = [
  { cle: 'avance_mois_max', label: 'Mois payables d’avance', aide: 'Nombre de mois au-delà des mois déjà dus.', type: 'number', min: 0 },
  { cle: 'taux_penalite_mensuel', label: 'Taux de pénalité mensuel', aide: 'Pourcentage appliqué au reste à payer.', type: 'number', min: 0, step: '0.01' },
  { cle: 'jour_exigibilite', label: 'Jour d’exigibilité', aide: 'Jour du mois où la redevance devient exigible.', type: 'number', min: 1, max: 28 },
];

export default function ParametresPage() {
  const { ctx, profil } = useContexte();
  const [valeurs, setValeurs] = useState({});
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const communeId = ctx?.communeId;
  const charger = useCallback(async function () {
    if (!communeId) return;
    const { data, error } = await supabase.from('parametres').select('cle, valeur').eq('commune_id', communeId);
    if (error) setErreur(`Impossible de charger les paramètres : ${error.message}`);
    else setValeurs((data || []).reduce((a, p) => ({ ...a, [p.cle]: p.valeur }), {}));
    setChargement(false);
  }, [communeId]);
  useEffect(function () {
    // Les paramètres sont chargés après résolution du profil.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);
  async function enregistrer() {
    setEnregistrement(true);
    const result = await supabase.from('parametres').upsert(CLES.map((c) => ({ commune_id: communeId, cle: c.cle, valeur: valeurs[c.cle] || '' })), { onConflict: 'commune_id,cle' });
    setEnregistrement(false);
    if (result.error) setErreur(`Enregistrement impossible : ${result.error.message}`);
  }
  if (!ctx || ctx.niveau !== 'commune') return null;
  const editable = profil?.role === 'admin';
  return (
    <div className="w-full">
      <PageHeader kicker={`Administration · ${profil?.communes?.nom || 'Commune'}`} titre="Paramètres communaux" sousTitre="Ces valeurs s’appliquent aux échéances et aux paiements de votre commune." actions={editable ? <Btn variant="green" disabled={enregistrement} onClick={enregistrer}>{enregistrement ? 'Enregistrement…' : 'Enregistrer'}</Btn> : null} />
      <BandeauErreur message={erreur} onReessayer={charger} />
      <Bloc titre="Règles de facturation" delai={60}>
        {chargement ? <p className="text-[12px] text-muted2">Chargement des paramètres…</p> : (
          <div className="grid max-w-3xl gap-4">
            {CLES.map((c) => <label key={c.cle} className="grid gap-1.5 rounded-xl border border-line bg-panel p-4"><span className="text-[13px] font-semibold text-txt">{c.label}</span><span className="text-[11.5px] text-muted2">{c.aide}</span><Champ type={c.type} min={c.min} max={c.max} step={c.step} disabled={!editable} value={valeurs[c.cle] ?? ''} onChange={(e) => setValeurs({ ...valeurs, [c.cle]: e.target.value })} className="mt-1 max-w-xs font-mono tabular-nums" /></label>)}
          </div>
        )}
        {!chargement && Object.keys(valeurs).length === 0 ? <EmptyState>Aucun paramètre n’est configuré pour cette commune.</EmptyState> : null}
      </Bloc>
    </div>
  );
}
