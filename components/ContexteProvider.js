'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { avecLectureCommune, contexteDepuisProfil } from '@/lib/contexte';

const ContexteReact = createContext({ ctx: null, profil: null, setLectureCommune: function () {} });

export function ContexteProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sessionUserId, setSessionUserId] = useState(null);
  const [profilId, setProfilId] = useState(null);
  const [profil, setProfil] = useState(null);
  const [lectureCommune, setCommuneLecture] = useState(null);
  const communeParam = searchParams.get('commune');

  if (profilId !== sessionUserId) {
    setProfilId(sessionUserId);
    setProfil(null);
  }
  if (!communeParam && lectureCommune !== null) {
    setCommuneLecture(null);
  }

  useEffect(function () {
    let annule = false;
    async function charger() {
      const { data } = await supabase.auth.getSession();
      if (annule) return;
      const userId = data.session?.user?.id ?? null;
      setSessionUserId(userId);
      if (!userId) {
        router.push('/login');
        return;
      }
      const { data: profilCharge } = await supabase
        .from('profils')
        .select('id, nom_complet, role, commune_id, pme_id, communes(nom, code), pme(nom)')
        .eq('id', userId)
        .single();
      if (!annule) setProfil(profilCharge);
    }
    charger();
    return function () {
      annule = true;
    };
  }, [router]);

  useEffect(
    function () {
      let annule = false;
      if (!communeParam || profil?.role !== 'observateur_regional') return undefined;
      async function resoudreCommune() {
        const parId = await supabase.from('communes').select('id, nom, code').eq('id', communeParam).maybeSingle();
        if (annule) return;
        if (parId.data?.id) {
          setCommuneLecture(parId.data);
          return;
        }
        const parCode = await supabase.from('communes').select('id, nom, code').eq('code', communeParam).maybeSingle();
        if (!annule) setCommuneLecture(parCode.data || null);
      }
      resoudreCommune();
      return function () {
        annule = true;
      };
    },
    [communeParam, profil?.role],
  );

  const ctx = useMemo(function () {
    if (!profil) return null;
    const base = contexteDepuisProfil(profil);
    if (base.niveau !== 'region' || !lectureCommune?.id) return base;
    return avecLectureCommune(base, lectureCommune.id);
  }, [profil, lectureCommune]);

  const setLectureCommune = useCallback(function (communeId) {
    const params = new URLSearchParams(searchParams.toString());
    if (communeId) params.set('commune', communeId);
    else params.delete('commune');
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ''}`);
  }, [pathname, router, searchParams]);

  const valeur = useMemo(
    function () {
      return { ctx, profil, communeLecture: lectureCommune, setLectureCommune };
    },
    [ctx, profil, lectureCommune, setLectureCommune],
  );

  return <ContexteReact.Provider value={valeur}>{children}</ContexteReact.Provider>;
}

export function useContexte() {
  return useContext(ContexteReact);
}
