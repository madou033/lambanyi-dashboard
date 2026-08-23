'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();

  useEffect(
    function () {
      async function verifier() {
        const { data } = await supabase.auth.getSession();
        router.replace(data.session ? '/dashboard' : '/login');
      }
      verifier();
    },
    [router],
  );

  return (
    <main className="grid h-full place-items-center bg-bg">
      <p className="font-mono text-[12px] tracking-[2px] text-muted2 uppercase">Chargement…</p>
    </main>
  );
}
