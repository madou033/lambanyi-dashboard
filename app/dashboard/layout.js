'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function DashboardLayout(props) {
  const router = useRouter();
  const pathname = usePathname();
  const [profil, setProfil] = useState(null);

  useEffect(function () {
    async function verifier() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/login');
        return;
      }
      const { data: p } = await supabase
        .from('profils')
        .select('nom_complet, role')
        .eq('id', data.session.user.id)
        .single();
      setProfil(p);
    }
    verifier();
  }, [router]);

  async function seDeconnecter() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const liens = [
    { href: '/dashboard', label: 'Vue d ensemble' },
    { href: '/dashboard/menages', label: 'Menages' },
    { href: '/dashboard/collecteurs', label: 'Collecteurs' },
    { href: '/dashboard/tournees', label: 'Tournees' },
    { href: '/dashboard/signalements', label: 'Signalements' },
  ];

  if (!profil) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-green-50">
        <p className="text-green-800">Chargement...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Lambanyi Propre</h1>
          <p className="text-sm text-green-100">Dashboard communal</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">
            {profil.nom_complet} ({profil.role})
          </span>
          <button
            onClick={seDeconnecter}
            className="bg-green-800 hover:bg-green-900 px-4 py-2 rounded-lg text-sm"
          >
            Deconnexion
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200 px-6 flex gap-2">
        {liens.map(function (lien) {
          const actif = pathname === lien.href;
          return (
            <Link
              key={lien.href}
              href={lien.href}
              className={
                'py-3 px-4 text-sm font-medium border-b-2 ' +
                (actif
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800')
              }
            >
              {lien.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-6">{props.children}</div>
    </div>
  );
}