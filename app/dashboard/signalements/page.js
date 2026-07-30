'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../../../lib/supabase';

const CarteSignalements = dynamic(
  function () { return import('./CarteSignalements'); },
  { ssr: false, loading: function () { return <p className="text-gray-500">Chargement de la carte...</p>; } }
);

function formatHeure(iso) {
  const d = new Date(iso);
  const maintenant = new Date();
  const diffMin = Math.floor((maintenant - d) / 60000);

  let relatif;
  if (diffMin < 1) relatif = 'a linstant';
  else if (diffMin < 60) relatif = 'il y a ' + diffMin + ' min';
  else if (diffMin < 1440) relatif = 'il y a ' + Math.floor(diffMin / 60) + ' h';
  else relatif = 'il y a ' + Math.floor(diffMin / 1440) + ' j';

  const absolu = d.toLocaleDateString('fr-FR') + ' a ' +
    d.getHours() + 'h' + String(d.getMinutes()).padStart(2, '0');

  return relatif + ' (' + absolu + ')';
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

export default function SignalementsPage() {
  const [signalements, setSignalements] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreQuartier, setFiltreQuartier] = useState('');
  const [filtreType, setFiltreType] = useState('');
  const [filtrePeriode, setFiltrePeriode] = useState('');

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

  const quartiersDispo = [];
  signalements.forEach(function (s) {
    if (s.quartier_nom && quartiersDispo.indexOf(s.quartier_nom) < 0) {
      quartiersDispo.push(s.quartier_nom);
    }
  });
  quartiersDispo.sort();

  function dansPeriode(iso) {
    if (!filtrePeriode) {
      return true;
    }
    const d = new Date(iso);
    const maintenant = new Date();
    const diffJours = (maintenant - d) / 86400000;
    if (filtrePeriode === 'jour') {
      return diffJours <= 1;
    }
    if (filtrePeriode === 'semaine') {
      return diffJours <= 7;
    }
    if (filtrePeriode === 'mois') {
      return diffJours <= 30;
    }
    return true;
  }

  const filtres = signalements.filter(function (s) {
    if (filtreStatut && s.statut !== filtreStatut) {
      return false;
    }
    if (filtreQuartier && s.quartier_nom !== filtreQuartier) {
      return false;
    }
    if (filtreType && s.type_signalement !== filtreType) {
      return false;
    }
    if (!dansPeriode(s.created_at)) {
      return false;
    }
    return true;
  });

  function reinitialiserFiltres() {
    setFiltreStatut('');
    setFiltreQuartier('');
    setFiltreType('');
    setFiltrePeriode('');
  }

  return (
    <div>
    <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">
              Signalements ({filtres.length})
            </h2>
            <button
              onClick={reinitialiserFiltres}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50"
            >
              Reinitialiser les filtres
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
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

            <select
              value={filtreQuartier}
              onChange={function (e) { setFiltreQuartier(e.target.value); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Tous les quartiers</option>
              {quartiersDispo.map(function (q) {
                return <option key={q} value={q}>{q}</option>;
              })}
            </select>

            <select
              value={filtreType}
              onChange={function (e) { setFiltreType(e.target.value); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Tous les types</option>
              <option value="depotoir_sauvage">Depotoir sauvage</option>
              <option value="collecte_manquee">Collecte manquee</option>
              <option value="bac_plein">Bac plein</option>
              <option value="autre">Autre</option>
            </select>

            <select
              value={filtrePeriode}
              onChange={function (e) { setFiltrePeriode(e.target.value); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Toutes les periodes</option>
              <option value="jour">Aujourd hui</option>
              <option value="semaine">7 derniers jours</option>
              <option value="mois">30 derniers jours</option>
            </select>
          </div>
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
                  {formatHeure(s.created_at)}
                  {s.latitude !== null && s.longitude !== null ? <a href={'https://www.google.com/maps?q=' + s.latitude + ',' + s.longitude} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{' - '}{Number(s.latitude).toFixed(5)}, {Number(s.longitude).toFixed(5)}</a> : ' - Pas de position GPS'}
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