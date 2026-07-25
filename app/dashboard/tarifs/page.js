'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const TYPES = ['residentiel', 'institution', 'commerce', 'industrie'];

function formaterMontant(n) {
  const s = String(n);
  let sortie = '';
  let compte = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    sortie = s.charAt(i) + sortie;
    compte = compte + 1;
    if (compte % 3 === 0 && i > 0) { sortie = ' ' + sortie; }
  }
  return sortie;
}

export default function TarifsPage() {
  const [plans, setPlans] = useState([]);
  const [edition, setEdition] = useState({});
  const [message, setMessage] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(function () { charger(); }, []);

  async function charger() {
    setChargement(true);
    const { data } = await supabase
      .from('plans_tarifaires')
      .select('id, code, libelle, montant_gnf, passages_par_semaine, type_menage, duree_jours, actif')
      .order('type_menage')
      .order('passages_par_semaine');
    setPlans(data || []);
    setEdition({});
    setChargement(false);
  }

  function majMontant(id, valeur) {
    const copie = Object.assign({}, edition);
    copie[id] = valeur;
    setEdition(copie);
  }

  async function enregistrer(plan) {
    const brut = edition[plan.id];
    const montant = parseInt(brut, 10);
    if (!montant || montant <= 0) {
      setMessage({ type: 'erreur', texte: 'Montant invalide' });
      return;
    }
    const { error } = await supabase
      .from('plans_tarifaires')
      .update({ montant_gnf: montant })
      .eq('id', plan.id);
    if (error) {
      setMessage({ type: 'erreur', texte: error.message });
      return;
    }
    setMessage({ type: 'succes', texte: 'Tarif mis a jour : ' + plan.code });
    charger();
  }

  async function basculerActif(plan) {
    await supabase
      .from('plans_tarifaires')
      .update({ actif: !plan.actif })
      .eq('id', plan.id);
    charger();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Grille tarifaire</h2>
          <p className="text-sm text-gray-500">
            Abonnement mensuel par type de menage et nombre de passages par semaine.
          </p>
        </div>
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

      {chargement && (
        <div className="bg-white rounded-xl shadow p-6 text-gray-500">Chargement...</div>
      )}

      {!chargement && TYPES.map(function (type) {
        const lignes = plans.filter(function (p) { return p.type_menage === type; });
        if (lignes.length === 0) { return null; }
        return (
          <div key={type} className="bg-white rounded-xl shadow overflow-x-auto mb-6">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 capitalize">{type}</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3">Code</th>
                  <th className="text-left px-4 py-3">Passages / semaine</th>
                  <th className="text-left px-4 py-3">Montant actuel</th>
                  <th className="text-left px-4 py-3">Nouveau montant (GNF)</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map(function (p) {
                  const valeur = edition[p.id] !== undefined
                    ? edition[p.id]
                    : String(p.montant_gnf);
                  const modifie = parseInt(valeur, 10) !== p.montant_gnf;
                  return (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-800">{p.code}</td>
                      <td className="px-4 py-3 text-gray-600">{p.passages_par_semaine}</td>
                      <td className="px-4 py-3 text-gray-800">
                        {formaterMontant(p.montant_gnf)} GNF
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={valeur}
                          onChange={function (e) { majMontant(p.id, e.target.value); }}
                          className="w-32 border border-gray-300 rounded-lg px-3 py-1.5"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={
                          'text-xs px-3 py-1 rounded-full ' +
                          (p.actif
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600')
                        }>
                          {p.actif ? 'actif' : 'desactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={function () { enregistrer(p); }}
                          disabled={!modifie}
                          className={
                            'text-sm mr-3 ' +
                            (modifie
                              ? 'text-green-700 hover:underline'
                              : 'text-gray-300 cursor-not-allowed')
                          }
                        >
                          Enregistrer
                        </button>
                        <button
                          onClick={function () { basculerActif(p); }}
                          className="text-sm text-gray-600 hover:underline"
                        >
                          {p.actif ? 'Desactiver' : 'Reactiver'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}