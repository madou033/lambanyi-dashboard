'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../../lib/supabase';

const CarteSignalements = dynamic(
  function () { return import('./CarteSignalements'); },
  { ssr: false, loading: function () { return <p className="text-gray-500">Chargement de la carte...</p>; } }
);

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

export default function SignalementsPage() {
  const [signalements, setSignalements] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState('');

  useEffect(function () {
    charger();
  }, []);

  async function charger() {
    const { data } = await supabase
      .from('signalements_carte')
      .select('*')
      .order('created_at', { ascending: false });
    setSignalements(data || []);
  }

  async function changerStatut(id, statut) {
    await supabase
      .from('signalements')
      .update({ statut: statut })
      .eq('id', id);
    charger();
  }

  const filtres = signalements.filter(function (s) {
    return !filtreStatut || s.statut === filtreStatut;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Signalements ({filtres.length})
        </h2>
        <select
          value={filtreStatut}
          onChange={function (e) { setFiltreStatut(e.target.value); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="nouveau">Nouveau</option>
          <option value="en_cours">En cours</option>
          <option value="resolu">Resolu</option>
          <option value="rejete">Rejete</option>
        </select>
      </div>

      <div className="mb-6">
        <CarteSignalements signalements={filtres} />
        <p className="text-xs text-gray-400 mt-2">
          Rouge = nouveau, Orange = en cours, Vert = resolu, Gris = rejete
        </p>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {filtres.length === 0 && (
          <p className="p-6 text-gray-500 text-sm">Aucun signalement.</p>
        )}
        {filtres.map(function (s) {
          return (
            <div
              key={s.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-6 py-4 border-b border-gray-100"
            >
              <div>
                <p className="font-medium text-gray-800">
                  {libellesTypes[s.type_signalement] || s.type_signalement}
                  {s.quartier_nom && (
                    <span className="text-gray-500 font-normal">
                      {' '}- {s.quartier_nom}
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {s.description || 'Sans description'}
                </p>
                {s.photo_url && (
                  <a href={s.photo_url} target="_blank" rel="noreferrer">
                    <img
                      src={s.photo_url}
                      alt="Photo du signalement"
                      className="mt-2 h-24 w-32 object-cover rounded-lg border border-gray-200"
                    />
                  </a>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(s.created_at).toLocaleDateString('fr-FR')}
                  {s.latitude === null && ' - Pas de position GPS'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={
                  'text-xs px-3 py-1 rounded-full ' +
                  (couleursStatuts[s.statut] || 'bg-gray-100 text-gray-600')
                }>
                  {s.statut}
                </span>
                {s.statut === 'nouveau' && (
                  <button
                    onClick={function () { changerStatut(s.id, 'en_cours'); }}
                    className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg"
                  >
                    Prendre en charge
                  </button>
                )}
                {(s.statut === 'nouveau' || s.statut === 'en_cours') && (
                  <button
                    onClick={function () { changerStatut(s.id, 'resolu'); }}
                    className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg"
                  >
                    Marquer resolu
                  </button>
                )}
                {s.statut === 'nouveau' && (
                  <button
                    onClick={function () { changerStatut(s.id, 'rejete'); }}
                    className="text-xs bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded-lg"
                  >
                    Rejeter
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}