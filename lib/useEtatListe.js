'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { appliquerPatch, ecrireEtat, lireEtat } from '@/lib/etat-liste';

export function useEtatListe(schema) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const etat = lireEtat(searchParams, schema);

  const maj = useCallback(
    function (patch) {
      const suivant = appliquerPatch(etat, patch);
      const qs = ecrireEtat(suivant, schema);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [etat, pathname, router, schema],
  );

  return [etat, maj];
}
