'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function PmePage() {
  const [pmes, setPmes] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [collecteurs, setCollecteurs] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState(null);
  const [panneauQuartiers, setPanneauQuartiers] = useState(null);

  const [form, setForm] = useState({
    nom: '',
    responsable: '',
    telephone: '',
    email: '',
    numeroAgrement: '',
  });

  useEffect(function () {
    chargerTout();
  }, []);

  async function chargerTout() {
    const r1 = await supabase.from('pme_apercu').select('*').order('nom');
    setPmes(r1.data || []);

    const r2 = await supabase
      .from('quartiers')
      .select('id, nom, code')
      .eq('actif', true)
      .order('nom');
    setQuartiers(r2.data || []);

    const r3 = await supabase
      .from('profils')
      .select('id, nom_complet, telephone, actif, pme_id')
      .eq('role', 'collecteur')
      .order('nom_complet');
    setCollecteurs(r3.data || []);
  }

  function majChamp(champ, valeur) {
    const copie = Object.assign({}, form);
    copie[champ] = valeur;
    setForm(copie);
  }

  async function ajouterPme() {
    setMessage(null);
    if (!form.nom) {
      setMessage({ type: 'erreur', texte: 'Le nom de la PME est obligatoire' });
      return;
    }
    setEnregistrement(true);
    const { error } = await supabase.from('pme').insert({
      nom: form.nom,
      responsable: form.responsable || null,
      telephone: form.telephone || null,
      email: form.email || null,
      numero_agrement: form.numeroAgrement || null,
    });
    setEnregistrement(false);
    if (error) {
      setMessage({ type: 'erreur', texte: error.message });
      return;
    }
    setMessage({ type: 'succes', texte: 'PME creee avec succes' });
    setForm({ nom: '', responsable: '', telephone: '', email: '', numeroAgrement: '' });
    setFormVisible(false);
    chargerTout();
  }

  async function ouvrirQuartiers(pme) {
    const { data } = await supabase
      .from('pme_quartiers')
      .select('quartier_id')
      .eq('pme_id', pme.id);
    const ids = (data || []).map(function (x) { return x.quartier_id; });
    setPanneauQuartiers({ pme: pme, ids: ids });
  }

  function basculerQuartier(id) {
    const actuels = panneauQuartiers.ids.slice();
    const index = actuels.indexOf(id);
    if (index === -1) { actuels.push(id); } else { actuels.splice(index, 1); }
    setPanneauQuartiers({ pme: panneauQuartiers.pme, ids: actuels });
  }

  async function enregistrerQuartiers() {
    setEnregistrement(true);
    await supabase.from('pme_quartiers').delete().eq('pme_id', panneauQuartiers.pme.id);
    if (panneauQuartiers.ids.length > 0) {
      const lignes = panneauQuartiers.ids.map(function (qid) {
        return { pme_id: panneauQuartiers.pme.id, quartier_id: qid };
      });
      const { error } = await supabase.from('pme_quartiers').insert(lignes);
      if (error) {
        setEnregistrement(false);
        setMessage({ type: 'erreur', texte: error.message });
        return;
      }
    }
    setEnregistrement(false);
    setPanneauQuartiers(null);
    setMessage({ type: 'succes', texte: 'Quartiers enregistres' });
    chargerTout();
  }

  async function affecterCollecteur(collecteurId, valeur) {
    const pmeId = valeur === '' ? null : valeur;
    await supabase.from('profils').update({ pme_id: pmeId }).eq('id', collecteurId);
    chargerTout();
  }

  async function basculerActifPme(pme) {
    await supabase.from('pme').update({ actif: !pme.actif }).eq('id', pme.id);
    chargerTout();
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          PME de collecte ({pmes.length})
        </h2>
        <button
          onClick={function () { setFormVisible(!formVisible); }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {formVisible ? 'Fermer' : '+ Ajouter une PME'}
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
          <h3 className="font-semibold text-gray-800 mb-4">Nouvelle PME</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nom de la PME *</label>
              <input
                value={form.nom}
                onChange={function (e) { majChamp('nom', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Ex: PME CAS"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Responsable</label>
              <input
                value={form.responsable}
                onChange={function (e) { majChamp('responsable', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Nom du gerant"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Telephone</label>
              <input
                value={form.telephone}
                onChange={function (e) { majChamp('telephone', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="6XX XX XX XX"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={function (e) { majChamp('email', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="contact@pme.gn"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Numero d agrement</label>
              <input
                value={form.numeroAgrement}
                onChange={function (e) { majChamp('numeroAgrement', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Reference communale"
              />
            </div>
          </div>
          <button
            onClick={ajouterPme}
            disabled={enregistrement}
            className="mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            {enregistrement ? 'Creation...' : 'Creer la PME'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3">PME</th>
              <th className="text-left px-4 py-3">Responsable</th>
              <th className="text-left px-4 py-3">Quartiers couverts</th>
              <th className="text-left px-4 py-3">Collecteurs</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pmes.length === 0 && (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-gray-500 text-center">
                  Aucune PME enregistree.
                </td>
              </tr>
            )}
            {pmes.map(function (p) {
              return (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {p.nom}
                    <div className="text-xs text-gray-500">{p.telephone || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.responsable || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-full mr-2">
                      {p.nb_quartiers}
                    </span>
                    {p.quartiers || 'Aucun quartier'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.nb_collecteurs}</td>
                  <td className="px-4 py-3">
                    <span className={
                      'text-xs px-3 py-1 rounded-full ' +
                      (p.actif
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600')
                    }>
                      {p.actif ? 'active' : 'desactivee'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={function () { ouvrirQuartiers(p); }}
                      className="text-sm text-green-700 hover:underline mr-3"
                    >
                      Quartiers
                    </button>
                    <button
                      onClick={function () { basculerActifPme(p); }}
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

      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Affectation des collecteurs
      </h2>
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3">Collecteur</th>
              <th className="text-left px-4 py-3">Telephone</th>
              <th className="text-left px-4 py-3">PME de rattachement</th>
            </tr>
          </thead>
          <tbody>
            {collecteurs.map(function (c) {
              return (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {c.nom_complet}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.telephone || '-'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={c.pme_id || ''}
                      onChange={function (e) { affecterCollecteur(c.id, e.target.value); }}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                      <option value="">Aucune PME</option>
                      {pmes.map(function (p) {
                        return (
                          <option key={p.id} value={p.id}>{p.nom}</option>
                        );
                      })}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {panneauQuartiers && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg max-h-full overflow-y-auto">
            <h3 className="font-semibold text-gray-800 mb-1">
              Quartiers couverts
            </h3>
            <p className="text-sm text-gray-500 mb-4">{panneauQuartiers.pme.nom}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {quartiers.map(function (q) {
                const coche = panneauQuartiers.ids.indexOf(q.id) !== -1;
                return (
                  <label
                    key={q.id}
                    className={
                      'flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer ' +
                      (coche
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300')
                    }
                  >
                    <input
                      type="checkbox"
                      checked={coche}
                      onChange={function () { basculerQuartier(q.id); }}
                    />
                    <span className="text-sm text-gray-800">{q.nom}</span>
                    <span className="text-xs text-gray-400">{q.code}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={function () { setPanneauQuartiers(null); }}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={enregistrerQuartiers}
                disabled={enregistrement}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg py-2 text-sm font-medium"
              >
                {enregistrement ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}