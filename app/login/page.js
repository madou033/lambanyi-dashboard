'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(false);

  async function seConnecter() {
    setErreur(null);
    setChargement(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: motDePasse,
    });

    if (error) {
      setErreur('Email ou mot de passe incorrect');
      setChargement(false);
      return;
    }

    const { data: profil } = await supabase
      .from('profils')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (!profil || (profil.role !== 'admin' && profil.role !== 'superviseur')) {
      await supabase.auth.signOut();
      setErreur('Acces reserve au personnel de la commune');
      setChargement(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-green-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-green-800 text-center">
          Lambanyi Propre
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Dashboard communal - Connexion staff
        </p>

        {erreur && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">
            {erreur}
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={function (e) { setEmail(e.target.value); }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="votre@email.com"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mot de passe
        </label>
        <input
          type="password"
          value={motDePasse}
          onChange={function (e) { setMotDePasse(e.target.value); }}
          onKeyDown={function (e) { if (e.key === 'Enter') { seConnecter(); } }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Votre mot de passe"
        />

        <button
          onClick={seConnecter}
          disabled={chargement}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg"
        >
          {chargement ? 'Connexion...' : 'Se connecter'}
        </button>
      </div>
    </main>
  );
}