'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const JOURS = [
  { valeur: 1, label: 'Lundi' },
  { valeur: 2, label: 'Mardi' },
  { valeur: 3, label: 'Mercredi' },
  { valeur: 4, label: 'Jeudi' },
  { valeur: 5, label: 'Vendredi' },
  { valeur: 6, label: 'Samedi' },
  { valeur: 7, label: 'Dimanche' },
];

export default function TourneesPage() {
  const [tournees, setTournees] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [collecteurs, setCollecteurs] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState(null);

  const [form, setForm] = useState({
    quartier_id: '',
    collecteur_id: '',
    jour_semaine: '1',
    heure_debut: '07:00',
  });

  useEffect(function () {
    chargerReferentiel();
    chargerTournees();
  }, []);

  async function chargerReferentiel() {
    const [q, c] = await Promise.all([
      supabase.from('quartiers').select('id, nom').order('nom'),
      supabase.from('profils').select('id, nom_complet')
        .eq('role', 'collecteur').eq('actif', true).order('nom_complet'),
    ]);
    setQuartiers(q.data || []);
    setCollecteurs(c.data || []);
  }

  async function chargerTournees() {
    const { data } = await supabase
      .from('tournees')
      .select('id, jour_semaine, heure_debut, actif, quartiers(nom), profils(nom_complet)')
      .order('jour_semaine')
      .order('heure_debut');
    setTournees(data || []);
  }

  function majChamp(champ, valeur) {
    const copie = Object.assign({}, form);
    copie[champ] = valeur;
    setForm(copie);
  }

  async function ajouterTournee() {
    setMessage(null);

    if (!form.quartier_id) {
      setMessage({ type: 'erreur', texte: 'Le quartier est obligatoire' });
      return;
    }

    setEnregistrement(true);

    const ligne = {
      quartier_id: form.quartier_id,
      jour_semaine: parseInt(form.jour_semaine, 10),
      heure_debut: form.heure_debut,
    };
    if (form.collecteur_id) {
      ligne.collecteur_id = form.collecteur_id;
    }

    const { error } = await supabase.from('tournees').insert(ligne);

    setEnregistrement(false);

    if (error) {
      setMessage({ type: 'erreur', texte: 'Erreur : ' + error.message });
      return;
    }

    setMessage({ type: 'succes', texte: 'Tournee creee avec succes' });
    setForm({ quartier_id: '', collecteur_id: '', jour_semaine: '1', heure_debut: '07:00' });
    setFormVisible(false);
    chargerTournees();
  }

  async function basculerActif(tournee) {
    await supabase
      .from('tournees')
      .update({ actif: !tournee.actif })
      .eq('id', tournee.id);
    chargerTournees();
  }

  function nomJour(valeur) {
    const jour = JOURS.find(function (j) { return j.valeur === valeur; });
    return jour ? jour.label : valeur;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Tournees de collecte ({tournees.length})
        </h2>
        <button
          onClick={function () { setFormVisible(!formVisible); }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {formVisible ? 'Fermer' : '+ Planifier une tournee'}
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
          <h3 className="font-semibold text-gray-800 mb-4">Nouvelle tournee</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Quartier *</label>
              <select
                value={form.quartier_id}
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
              <label className="block text-sm text-gray-600 mb-1">Collecteur</label>
              <select
                value={form.collecteur_id}
                onChange={function (e) { majChamp('collecteur_id', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">-- Non affecte --</option>
                {collecteurs.map(function (c) {
                  return <option key={c.id} value={c.id}>{c.nom_complet}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Jour de la semaine</label>
              <select
                value={form.jour_semaine}
                onChange={function (e) { majChamp('jour_semaine', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {JOURS.map(function (j) {
                  return <option key={j.valeur} value={j.valeur}>{j.label}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Heure de debut</label>
              <input
                type="time"
                value={form.heure_debut}
                onChange={function (e) { majChamp('heure_debut', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <button
            onClick={ajouterTournee}
            disabled={enregistrement}
            className="mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            {enregistrement ? 'Enregistrement...' : 'Planifier'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3">Jour</th>
              <th className="text-left px-4 py-3">Heure</th>
              <th className="text-left px-4 py-3">Quartier</th>
              <th className="text-left px-4 py-3">Collecteur</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {tournees.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-gray-500 text-center">
                  Aucune tournee planifiee.
                </td>
              </tr>
            )}
            {tournees.map(function (t) {
              return (
                <tr key={t.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {nomJour(t.jour_semaine)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {t.heure_debut ? t.heure_debut.substring(0, 5) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {t.quartiers ? t.quartiers.nom : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {t.profils ? t.profils.nom_complet : 'Non affecte'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={
                      'text-xs px-3 py-1 rounded-full ' +
                      (t.actif
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600')
                    }>
                      {t.actif ? 'active' : 'suspendue'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={function () { basculerActif(t); }}
                      className="text-sm text-green-700 hover:underline"
                    >
                      {t.actif ? 'Suspendre' : 'Reactiver'}
                    </button>
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