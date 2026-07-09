'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

function CarteStat(props) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <p className="text-sm text-gray-500">{props.titre}</p>
      <p className="text-3xl font-bold mt-1" style={{ color: props.couleur }}>
        {props.valeur}
      </p>
      <p className="text-xs text-gray-400 mt-1">{props.detail}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [signalements, setSignalements] = useState([]);

  useEffect(function () {
    async function charger() {
      const debutJour = new Date();
      debutJour.setHours(0, 0, 0, 0);

      const [menages, abonnements, signalementsNouveaux, passagesJour] =
        await Promise.all([
          supabase.from('menages').select('id', { count: 'exact', head: true }),
          supabase.from('abonnements').select('id', { count: 'exact', head: true })
            .eq('statut', 'actif'),
          supabase.from('signalements').select('id', { count: 'exact', head: true })
            .in('statut', ['nouveau', 'en_cours']),
          supabase.from('passages').select('id', { count: 'exact', head: true })
            .gte('horodatage', debutJour.toISOString()),
        ]);

      setStats({
        menages: menages.count || 0,
        abonnements: abonnements.count || 0,
        signalements: signalementsNouveaux.count || 0,
        passages: passagesJour.count || 0,
      });

      const { data: derniers } = await supabase
        .from('signalements')
        .select('id, type_signalement, description, statut, created_at, quartiers(nom)')
        .order('created_at', { ascending: false })
        .limit(5);
      setSignalements(derniers || []);
    }
    charger();
  }, []);

  if (!stats) {
    return <p className="text-green-800">Chargement...</p>;
  }

  const libellesTypes = {
    depotoir_sauvage: 'Depotoir sauvage',
    collecte_manquee: 'Collecte manquee',
    bac_plein: 'Bac plein',
    autre: 'Autre',
  };

  const couleursStatuts = {
    nouveau: 'bg-red-100 text-red-700',
    en_cours: 'bg-yellow-100 text-yellow-700',
    resolu: 'bg-green-100 text-green-700',
    rejete: 'bg-gray-100 text-gray-600',
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Vue d'ensemble
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <CarteStat titre="Menages enregistres" valeur={stats.menages}
          detail="Total commune" couleur="#15803d" />
        <CarteStat titre="Abonnements actifs" valeur={stats.abonnements}
          detail="Paiement a jour" couleur="#2563eb" />
        <CarteStat titre="Signalements a traiter" valeur={stats.signalements}
          detail="Nouveaux + en cours" couleur="#dc2626" />
        <CarteStat titre="Passages aujourd'hui" valeur={stats.passages}
          detail="Collectes effectuees" couleur="#7c3aed" />
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Derniers signalements
      </h2>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {signalements.length === 0 && (
          <p className="p-6 text-gray-500 text-sm">
            Aucun signalement pour le moment.
          </p>
        )}
        {signalements.map(function (s) {
          return (
            <div key={s.id}
              className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-800">
                  {libellesTypes[s.type_signalement] || s.type_signalement}
                  {s.quartiers && (
                    <span className="text-gray-500 font-normal">
                      {' '}- {s.quartiers.nom}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {s.description || 'Sans description'}
                </p>
              </div>
              <span className={
                'text-xs px-3 py-1 rounded-full ' +
                (couleursStatuts[s.statut] || 'bg-gray-100 text-gray-600')
              }>
                {s.statut}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}