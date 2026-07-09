'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function MenagesPage() {
  const [menages, setMenages] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [filtreQuartier, setFiltreQuartier] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState(null);

  const [nouveauMenage, setNouveauMenage] = useState({
    quartier_id: '',
    point_repere: '',
    telephone_contact: '',
    type_menage: 'residentiel',
    nb_personnes: '',
  });

  useEffect(function () {
    chargerQuartiers();
    chargerMenages();
  }, []);

  async function chargerQuartiers() {
    const { data } = await supabase
      .from('quartiers')
      .select('id, nom')
      .order('nom');
    setQuartiers(data || []);
  }

  async function chargerMenages() {
    const { data } = await supabase
      .from('menages')
      .select('id, point_repere, telephone_contact, type_menage, statut, nb_personnes, created_at, quartiers(nom)')
      .order('created_at', { ascending: false });
    setMenages(data || []);
  }

  function majChamp(champ, valeur) {
    const copie = Object.assign({}, nouveauMenage);
    copie[champ] = valeur;
    setNouveauMenage(copie);
  }

  async function ajouterMenage() {
    setMessage(null);

    if (!nouveauMenage.quartier_id || !nouveauMenage.point_repere || !nouveauMenage.telephone_contact) {
      setMessage({ type: 'erreur', texte: 'Quartier, point de repere et telephone sont obligatoires' });
      return;
    }

    setEnregistrement(true);

    const ligne = {
      quartier_id: nouveauMenage.quartier_id,
      point_repere: nouveauMenage.point_repere,
      telephone_contact: nouveauMenage.telephone_contact,
      type_menage: nouveauMenage.type_menage,
    };
    if (nouveauMenage.nb_personnes) {
      ligne.nb_personnes = parseInt(nouveauMenage.nb_personnes, 10);
    }

    const { error } = await supabase.from('menages').insert(ligne);

    setEnregistrement(false);

    if (error) {
      setMessage({ type: 'erreur', texte: 'Erreur : ' + error.message });
      return;
    }

    setMessage({ type: 'succes', texte: 'Menage ajoute avec succes' });
    setNouveauMenage({
      quartier_id: '',
      point_repere: '',
      telephone_contact: '',
      type_menage: 'residentiel',
      nb_personnes: '',
    });
    setFormVisible(false);
    chargerMenages();
  }

  const menagesFiltres = menages.filter(function (m) {
    const texte = (m.point_repere + ' ' + m.telephone_contact).toLowerCase();
    const okRecherche = texte.includes(recherche.toLowerCase());
    const okQuartier = !filtreQuartier || (m.quartiers && m.quartiers.nom === filtreQuartier);
    return okRecherche && okQuartier;
  });

  const badgesStatut = {
    actif: 'bg-green-100 text-green-700',
    suspendu: 'bg-yellow-100 text-yellow-700',
    resilie: 'bg-gray-100 text-gray-600',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Menages ({menagesFiltres.length})
        </h2>
        <button
          onClick={function () { setFormVisible(!formVisible); }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {formVisible ? 'Fermer' : '+ Ajouter un menage'}
        </button>
      </div>

      {message && (
        <div className={
          'mb-4 p-3 rounded text-sm ' +
          (message.type === 'succes'
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-700')
        }>
          {message.texte}
        </div>
      )}

      {formVisible && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">Nouveau menage</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Quartier *</label>
              <select
                value={nouveauMenage.quartier_id}
                onChange={function (e) { majChamp('quartier_id', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">-- Choisir --</option>
                {quartiers.map(function (q) {
                  return <option key={q.id} value={q.id}>{q.nom}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Type</label>
              <select
                value={nouveauMenage.type_menage}
                onChange={function (e) { majChamp('type_menage', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="residentiel">Residentiel</option>
                <option value="commerce">Commerce</option>
                <option value="institution">Institution</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Point de repere *</label>
              <input
                value={nouveauMenage.point_repere}
                onChange={function (e) { majChamp('point_repere', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Ex: Pres de la mosquee, 2e rue"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Telephone *</label>
              <input
                value={nouveauMenage.telephone_contact}
                onChange={function (e) { majChamp('telephone_contact', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="6XX XX XX XX"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nombre de personnes</label>
              <input
                type="number"
                value={nouveauMenage.nb_personnes}
                onChange={function (e) { majChamp('nb_personnes', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Optionnel"
              />
            </div>
          </div>
          <button
            onClick={ajouterMenage}
            disabled={enregistrement}
            className="mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            {enregistrement ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          value={recherche}
          onChange={function (e) { setRecherche(e.target.value); }}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
          placeholder="Rechercher par repere ou telephone..."
        />
        <select
          value={filtreQuartier}
          onChange={function (e) { setFiltreQuartier(e.target.value); }}
          className="border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="">Tous les quartiers</option>
          {quartiers.map(function (q) {
            return <option key={q.id} value={q.nom}>{q.nom}</option>;
          })}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3">Quartier</th>
              <th className="text-left px-4 py-3">Point de repere</th>
              <th className="text-left px-4 py-3">Telephone</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {menagesFiltres.length === 0 && (
              <tr>
                <td colSpan="5" className="px-4 py-6 text-gray-500 text-center">
                  Aucun menage trouve.
                </td>
              </tr>
            )}
            {menagesFiltres.map(function (m) {
              return (
                <tr key={m.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {m.quartiers ? m.quartiers.nom : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.point_repere}</td>
                  <td className="px-4 py-3 text-gray-600">{m.telephone_contact}</td>
                  <td className="px-4 py-3 text-gray-600">{m.type_menage}</td>
                  <td className="px-4 py-3">
                    <span className={
                      'text-xs px-3 py-1 rounded-full ' +
                      (badgesStatut[m.statut] || 'bg-gray-100 text-gray-600')
                    }>
                      {m.statut}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}