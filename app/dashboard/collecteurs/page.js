'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function CollecteursPage() {
  const [collecteurs, setCollecteurs] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState(null);

  const [form, setForm] = useState({
    nomComplet: '',
    telephone: '',
    email: '',
    motDePasse: '',
  });

  useEffect(function () {
    chargerCollecteurs();
  }, []);

  async function chargerCollecteurs() {
    const { data } = await supabase
      .from('profils')
      .select('id, nom_complet, telephone, actif, created_at')
      .eq('role', 'collecteur')
      .order('created_at', { ascending: false });
    setCollecteurs(data || []);
  }

  function majChamp(champ, valeur) {
    const copie = Object.assign({}, form);
    copie[champ] = valeur;
    setForm(copie);
  }

  async function ajouterCollecteur() {
    setMessage(null);

    if (!form.nomComplet || !form.email || !form.motDePasse) {
      setMessage({ type: 'erreur', texte: 'Nom, email et mot de passe sont obligatoires' });
      return;
    }
    if (form.motDePasse.length < 6) {
      setMessage({ type: 'erreur', texte: 'Le mot de passe doit faire au moins 6 caracteres' });
      return;
    }

    setEnregistrement(true);

    const { data: session } = await supabase.auth.getSession();

    const reponse = await fetch('/api/collecteurs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        motDePasse: form.motDePasse,
        nomComplet: form.nomComplet,
        telephone: form.telephone,
        tokenAppelant: session.session.access_token,
      }),
    });

    const resultat = await reponse.json();
    setEnregistrement(false);

    if (!reponse.ok) {
      setMessage({ type: 'erreur', texte: resultat.erreur || 'Erreur inconnue' });
      return;
    }

    setMessage({ type: 'succes', texte: 'Collecteur cree avec succes' });
    setForm({ nomComplet: '', telephone: '', email: '', motDePasse: '' });
    setFormVisible(false);
    chargerCollecteurs();
  }

  async function basculerActif(collecteur) {
    await supabase
      .from('profils')
      .update({ actif: !collecteur.actif })
      .eq('id', collecteur.id);
    chargerCollecteurs();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Collecteurs ({collecteurs.length})
        </h2>
        <button
          onClick={function () { setFormVisible(!formVisible); }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {formVisible ? 'Fermer' : '+ Ajouter un collecteur'}
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
          <h3 className="font-semibold text-gray-800 mb-4">Nouveau collecteur</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nom complet *</label>
              <input
                value={form.nomComplet}
                onChange={function (e) { majChamp('nomComplet', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Ex: Mamadou Diallo"
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
              <label className="block text-sm text-gray-600 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={function (e) { majChamp('email', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="collecteur@lambanyi.gn"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Mot de passe *</label>
              <input
                type="text"
                value={form.motDePasse}
                onChange={function (e) { majChamp('motDePasse', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Minimum 6 caracteres"
              />
            </div>
          </div>
          <button
            onClick={ajouterCollecteur}
            disabled={enregistrement}
            className="mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            {enregistrement ? 'Creation...' : 'Creer le collecteur'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3">Nom</th>
              <th className="text-left px-4 py-3">Telephone</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {collecteurs.length === 0 && (
              <tr>
                <td colSpan="4" className="px-4 py-6 text-gray-500 text-center">
                  Aucun collecteur pour le moment.
                </td>
              </tr>
            )}
            {collecteurs.map(function (c) {
              return (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {c.nom_complet}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.telephone || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={
                      'text-xs px-3 py-1 rounded-full ' +
                      (c.actif
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600')
                    }>
                      {c.actif ? 'actif' : 'desactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={function () { basculerActif(c); }}
                      className="text-sm text-green-700 hover:underline"
                    >
                      {c.actif ? 'Desactiver' : 'Reactiver'}
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