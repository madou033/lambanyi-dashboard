'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Home() {
  const router = useRouter();

  useEffect(function () {
    async function verifier() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
    verifier();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-green-50">
      <p className="text-green-800">Chargement...</p>
    </main>
  );
}