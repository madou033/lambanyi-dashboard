'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useContexte } from '@/components/ContexteProvider';
import { BandeauErreur, Btn, Champ, EmptyState, Modal, PageHeader, nombre } from '@/components/ui';
import { CarteListe, Tableau, Td, Tr } from '@/components/liste';

const VIDE = { nom: '', code: '' };

export default function QuartiersPage() {
  const { ctx, communeLecture } = useContexte();
  const [communes, setCommunes] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [perimetres, setPerimetres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [form, setForm] = useState(VIDE);
  const [edition, setEdition] = useState(null);
  const [modale, setModale] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);

  const communeId = ctx?.lectureCommuneId || ctx?.communeId;
  const pmeId = ctx?.pmeId;
  const peutEcrire = ctx?.niveau === 'commune' && ctx.droits?.includes('ecrire');
  const charger = useCallback(async function () {
    if (!ctx) return;
    setChargement(true);
    const [rCommunes, rQuartiers, rPerimetres] = await Promise.all([
      supabase.from('communes').select('id, nom, code').eq('active', true).order('nom'),
      supabase.from('quartiers').select('id, nom, code, actif, commune_id').order('nom'),
      supabase.from('pme_quartiers').select('pme_id, quartier_id, pme(id, nom)'),
    ]);
    const first = [rCommunes, rQuartiers, rPerimetres].find((r) => r.error);
    if (first) setErreur(`Impossible de charger les quartiers : ${first.error.message}`);
    else {
      setCommunes(rCommunes.data || []);
      setQuartiers(rQuartiers.data || []);
      setPerimetres(rPerimetres.data || []);
      setErreur(null);
    }
    setChargement(false);
  }, [ctx]);

  useEffect(function () {
    // Le chargement dépend du profil fourni par le contexte.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  const visibles = useMemo(function () {
    if (pmeId) {
      const ids = new Set(perimetres.filter((p) => p.pme_id === pmeId).map((p) => p.quartier_id));
      return quartiers.filter((q) => ids.has(q.id) && q.actif);
    }
    return communeId ? quartiers.filter((q) => q.commune_id === communeId) : quartiers;
  }, [pmeId, quartiers, perimetres, communeId]);

  const nomTerritoire = communeLecture?.nom || communes.find((c) => c.id === communeId)?.nom || 'Région de Conakry';
  const pmeParQuartier = useMemo(() => perimetres.reduce((index, p) => {
    if (!index[p.quartier_id]) index[p.quartier_id] = [];
    if (p.pme?.nom) index[p.quartier_id].push(p.pme.nom);
    return index;
  }, {}), [perimetres]);

  async function enregistrer() {
    if (!form.nom.trim() || !form.code.trim() || !ctx?.communeId) return;
    setEnregistrement(true);
    const payload = { nom: form.nom.trim(), code: form.code.trim().toUpperCase(), commune_id: ctx.communeId };
    const result = edition
      ? await supabase.from('quartiers').update(payload).eq('id', edition.id)
      : await supabase.from('quartiers').insert(payload);
    setEnregistrement(false);
    if (result.error) setErreur(`Enregistrement impossible : ${result.error.message}`);
    else { setEdition(null); setForm(VIDE); setModale(false); charger(); }
  }

  async function supprimer(q) {
    if (!window.confirm(`Supprimer le quartier « ${q.nom} » ?`)) return;
    const { error } = await supabase.from('quartiers').delete().eq('id', q.id);
    if (error) setErreur(`Suppression impossible : ${error.message}`);
    else charger();
  }

  if (!ctx) return null;
  return (
    <div className="w-full">
      <PageHeader
        kicker={`Administration · ${nomTerritoire}`}
        titre="Quartiers"
        sousTitre={ctx.pmeId ? 'Les quartiers inclus dans le périmètre de votre PME.' : 'Référentiel territorial de la région et des communes.'}
        actions={peutEcrire ? <Btn variant="green" onClick={() => { setEdition(null); setForm(VIDE); setModale(true); }}>Nouveau quartier</Btn> : null}
      />
      <BandeauErreur message={erreur} onReessayer={charger} />
      <CarteListe titre={ctx.pmeId ? 'Mon périmètre' : 'Référentiel des quartiers'} sousTitre={chargement ? 'Chargement…' : `${nombre(visibles.length)} quartier${visibles.length > 1 ? 's' : ''}`}>
        <Tableau colonnes={[{ cle: 'nom', label: 'Quartier' }, { cle: 'code', label: 'Code' }, ...(ctx.pmeId ? [] : [{ cle: 'commune', label: 'Commune' }]), { cle: 'pme', label: 'PME affectées' }, ...(peutEcrire ? [{ cle: 'actions', label: 'Actions', noPrint: true }] : [])]} vide={chargement ? 'Chargement des quartiers…' : undefined}>
          {!chargement && visibles.length === 0 ? <tr><td colSpan={ctx.pmeId ? 4 : peutEcrire ? 5 : 4} className="px-5 py-10"><EmptyState>{ctx.pmeId ? 'Aucun quartier ne fait encore partie du périmètre de votre PME.' : 'Aucun quartier n’est enregistré dans ce périmètre.'}</EmptyState></td></tr> : null}
          {visibles.map((q, rang) => (
            <Tr key={q.id} rang={rang}>
              <Td fort>{q.nom}</Td>
              <Td mono>{q.code}</Td>
              {!ctx.pmeId ? <Td>{communes.find((c) => c.id === q.commune_id)?.nom || '—'}</Td> : null}
              <Td>{pmeParQuartier[q.id]?.join(', ') || <span className="text-muted2">Aucune PME</span>}</Td>
              {peutEcrire ? <Td className="no-print"><div className="flex gap-2"><button type="button" className="cursor-pointer text-blue outline-none focus-visible:ring-2 focus-visible:ring-blue" onClick={() => { setEdition(q); setForm({ nom: q.nom, code: q.code }); setModale(true); }}>Modifier</button><button type="button" className="cursor-pointer text-red outline-none focus-visible:ring-2 focus-visible:ring-blue" onClick={() => supprimer(q)}>Supprimer</button></div></Td> : null}
            </Tr>
          ))}
        </Tableau>
      </CarteListe>
      <Modal ouvert={peutEcrire && modale} onFermer={() => { setModale(false); setEdition(null); setForm(VIDE); }} titre={edition ? 'Modifier le quartier' : 'Nouveau quartier'} sousTitre="Le code doit être unique dans cette commune." pied={<div className="flex justify-end gap-2"><Btn variant="ghost" onClick={() => { setModale(false); setEdition(null); setForm(VIDE); }}>Annuler</Btn><Btn variant="green" disabled={enregistrement} onClick={enregistrer}>{enregistrement ? 'Enregistrement…' : 'Enregistrer'}</Btn></div>}>
        <div className="grid gap-4">
          <label><span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">Nom *</span><Champ value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></label>
          <label><span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">Code *</span><Champ value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
        </div>
      </Modal>
    </div>
  );
}
